from __future__ import annotations

import logging
import secrets
from copy import deepcopy
from datetime import date, datetime, timezone
from typing import Any

from app.errors import IrisAPIError
from app.models.audit_event import AuditEvent
from app.models.reference_data_version import ReferenceDataVersion
from app.models.screening_cache_list import ScreeningCacheList
from app.models.user import User
from app.repositories.admin_repository import AdminRepository
from app.services.auth_service import AuthService
from app.repositories.auth_repository import AuthRepository
from app.workflow_agents import (
    VALID_FALLBACK_MODES,
    VALID_HITL_BEHAVIORS,
    clamp_threshold,
    merge_workflow_agent_configs,
)


logger = logging.getLogger(__name__)
UTC = timezone.utc

VALID_ROLES = {"super_admin", "admin", "underwriter", "claims_ops", "compliance"}
VALID_STATUSES = {"active", "invited", "suspended", "inactive"}
VALID_LIBRARY_TYPES = {"mortality_table", "yield_curve", "fx_rate", "assumption_set", "file_template", "screening_cache"}


class AdminService:
    def __init__(self, repository: AdminRepository) -> None:
        self.repository = repository
        self.auth_service = AuthService(AuthRepository(repository.db))

    def list_users(self) -> dict[str, Any]:
        logger.info("Loading admin users list")
        state = self.repository.load_state()
        overrides = state.get("user_status_overrides", {})
        users = [self._serialize_user(user, overrides.get(user.email, {})) for user in self.repository.list_users()]
        return {"total": len(users), "users": users}

    def create_user(self, full_name: str, email: str, role: str, actor: User) -> dict[str, Any]:
        logger.info("Creating admin-managed user")
        logger.debug("Create user request email=%s role=%s", email, role)
        normalized_email = email.strip().lower()
        normalized_role = role.strip()
        if normalized_role not in VALID_ROLES:
            logger.error("Rejected user creation for email=%s because role=%s is invalid", normalized_email, normalized_role)
            raise IrisAPIError(400, "Invalid role", "Role is not supported by the platform")
        if self.repository.get_user_by_email(normalized_email):
            logger.error("Rejected user creation because email=%s already exists", normalized_email)
            raise IrisAPIError(409, "User exists", "A user with this email already exists")

        temp_password = f"iris_{secrets.token_urlsafe(6)[:8]}"
        created = self.repository.create_user(
            User(
                username=normalized_email.split("@")[0],
                email=normalized_email,
                full_name=full_name.strip(),
                role=normalized_role,
                password_hash=self.auth_service.hash_password(temp_password),
                is_active=False,
            )
        )

        state = self.repository.load_state()
        state.setdefault("user_status_overrides", {})[created.email] = {"status": "invited"}
        self.repository.save_state(state)
        self._record_access_event(actor.email, "/admin/users", "CREATE")
        return {
            "id": created.id,
            "email": created.email,
            "role": created.role,
            "status": "invited",
            "temp_password": temp_password,
        }

    def update_user(self, user_id: str, role: str | None, status: str | None, actor: User) -> dict[str, Any]:
        logger.info("Updating admin-managed user")
        logger.debug("Update user request user_id=%s role=%s status=%s", user_id, role, status)
        user = self.repository.get_user_by_id(user_id)
        if user is None:
            logger.error("User update failed because user_id=%s was not found", user_id)
            raise IrisAPIError(404, "User not found", "The requested user does not exist")

        state = self.repository.load_state()
        if role is not None:
            normalized_role = role.strip()
            if normalized_role not in VALID_ROLES:
                logger.error("Rejected role update for user_id=%s because role=%s is invalid", user_id, normalized_role)
                raise IrisAPIError(400, "Invalid role", "Role is not supported by the platform")
            user.role = normalized_role

        next_status = self._resolve_status(user, state)
        if status is not None:
            normalized_status = status.strip().lower()
            if normalized_status not in VALID_STATUSES:
                logger.error("Rejected status update for user_id=%s because status=%s is invalid", user_id, normalized_status)
                raise IrisAPIError(400, "Invalid status", "Status is not supported by the platform")
            next_status = normalized_status
            user.is_active = normalized_status == "active"
            state.setdefault("user_status_overrides", {})[user.email] = {"status": normalized_status}

        updated = self.repository.update_user(user)
        self.repository.save_state(state)
        self._record_access_event(actor.email, f"/admin/users/{updated.id}", "EDIT")
        return self._serialize_user(updated, {"status": next_status})

    def revoke_user(self, user_id: str, actor: User) -> dict[str, Any]:
        logger.info("Revoking admin-managed user access")
        logger.debug("Revoke user request user_id=%s", user_id)
        user = self.repository.get_user_by_id(user_id)
        if user is None:
            logger.error("User revoke failed because user_id=%s was not found", user_id)
            raise IrisAPIError(404, "User not found", "The requested user does not exist")

        user.is_active = False
        updated = self.repository.update_user(user)
        state = self.repository.load_state()
        state.setdefault("user_status_overrides", {})[updated.email] = {"status": "suspended"}
        self.repository.save_state(state)
        self._record_access_event(actor.email, f"/admin/users/{updated.id}", "DELETE")
        return {"id": updated.id, "status": "suspended"}

    def list_permissions(self) -> dict[str, Any]:
        logger.info("Loading admin permissions matrix")
        state = self.repository.load_state()
        return {"items": deepcopy(state.get("permissions", []))}

    def list_workflow_agents(self) -> dict[str, Any]:
        logger.info("Loading admin workflow-agent configuration")
        state = self.repository.load_state()
        configs = merge_workflow_agent_configs(state.get("workflow_agents"))
        if state.get("workflow_agents") != configs:
            state["workflow_agents"] = configs
            self.repository.save_state(state)
        return {"items": configs}

    def update_workflow_agent(self, agent_key: str, payload: dict[str, Any], actor: User) -> dict[str, Any]:
        logger.info("Updating admin workflow-agent configuration")
        logger.debug("Workflow-agent update key=%s payload=%s", agent_key, payload)
        state = self.repository.load_state()
        configs = merge_workflow_agent_configs(state.get("workflow_agents"))
        config_map = {item["key"]: item for item in configs}
        current = config_map.get(agent_key)
        if current is None:
            logger.error("Workflow-agent update failed because key=%s is unknown", agent_key)
            raise IrisAPIError(404, "Workflow agent not found", "The requested workflow agent does not exist")

        updated = deepcopy(current)
        if payload.get("enabled") is not None:
            updated["enabled"] = bool(payload["enabled"])
        if payload.get("confidence_threshold") is not None:
            updated["confidence_threshold"] = clamp_threshold(payload["confidence_threshold"])
        if payload.get("always_pause_for_hitl") is not None:
            updated["always_pause_for_hitl"] = bool(payload["always_pause_for_hitl"])
        if payload.get("hitl_behavior") is not None:
            hitl_behavior = str(payload["hitl_behavior"]).strip()
            if hitl_behavior not in VALID_HITL_BEHAVIORS:
                logger.error("Workflow-agent update rejected because hitl_behavior=%s is invalid", hitl_behavior)
                raise IrisAPIError(400, "Invalid HITL behavior", "HITL behavior is not supported by the platform")
            updated["hitl_behavior"] = hitl_behavior
        if payload.get("escalation_rule") is not None:
            updated["escalation_rule"] = str(payload["escalation_rule"]).strip()
        if payload.get("retry_limit") is not None:
            try:
                updated["retry_limit"] = max(0, int(payload["retry_limit"]))
            except (TypeError, ValueError) as exc:
                logger.error("Workflow-agent update rejected because retry_limit=%s is invalid", payload["retry_limit"])
                raise IrisAPIError(400, "Invalid retry limit", "Retry limit must be a whole number") from exc
        if payload.get("fallback_mode") is not None:
            fallback_mode = str(payload["fallback_mode"]).strip()
            if fallback_mode not in VALID_FALLBACK_MODES:
                logger.error("Workflow-agent update rejected because fallback_mode=%s is invalid", fallback_mode)
                raise IrisAPIError(400, "Invalid fallback mode", "Fallback mode is not supported by the platform")
            updated["fallback_mode"] = fallback_mode

        next_configs = []
        for item in configs:
            next_configs.append(updated if item["key"] == agent_key else item)
        state["workflow_agents"] = next_configs
        self.repository.save_state(state)
        self._record_access_event(actor.email, f"/admin/workflow-agents/{agent_key}", "EDIT")
        return updated

    def list_approval_matrix(self) -> dict[str, Any]:
        logger.info("Loading admin approval matrix")
        state = self.repository.load_state()
        return {"items": deepcopy(state.get("approval_matrix", []))}

    def list_access_logs(self) -> dict[str, Any]:
        logger.info("Loading admin access logs")
        items = [self._serialize_access_event(item) for item in self.repository.list_access_events()]
        logger.debug("Loaded admin access log count=%s", len(items))
        return {"total": len(items), "items": items}

    def list_library_items(self, data_type: str | None) -> dict[str, Any]:
        logger.info("Loading admin reference library list")
        logger.debug("Reference library request type=%s", data_type)
        normalized_type = (data_type or "").strip().lower()
        if normalized_type and normalized_type not in VALID_LIBRARY_TYPES:
            logger.error("Reference library request rejected because type=%s is invalid", normalized_type)
            raise IrisAPIError(400, "Invalid data type", "Reference data type is not supported by the platform")

        if normalized_type == "screening_cache":
            items = [self._serialize_screening_cache(item) for item in self.repository.list_screening_cache_lists()]
            return {"type": "screening_cache", "items": items}

        library_items = [self._serialize_reference_version(item) for item in self.repository.list_reference_versions(normalized_type or None)]
        if not normalized_type:
            library_items.extend(self._serialize_screening_cache(item) for item in self.repository.list_screening_cache_lists())
        logger.debug("Reference library response type=%s item_count=%s", normalized_type or "all", len(library_items))
        return {"type": normalized_type or "all", "items": library_items}

    def get_library_item(self, ref_id: str) -> dict[str, Any]:
        logger.info("Loading admin reference library detail")
        logger.debug("Reference library detail request ref_id=%s", ref_id)
        item = self.repository.get_reference_version(ref_id)
        if item is not None:
            return self._serialize_reference_version(item)

        screening_cache = self.repository.get_screening_cache_list(ref_id)
        if screening_cache is not None:
            return self._serialize_screening_cache(screening_cache)

        logger.error("Reference library detail not found for ref_id=%s", ref_id)
        raise IrisAPIError(404, "Reference item not found", "The requested reference data item does not exist")

    def upload_library_version(
        self,
        data_type: str,
        source: str,
        effective_date: str,
        filename: str | None,
        notes: str | None,
        actor: User,
    ) -> dict[str, Any]:
        logger.info("Uploading new reference library version")
        logger.debug(
            "Reference library upload type=%s source=%s effective_date=%s filename=%s",
            data_type,
            source,
            effective_date,
            filename,
        )
        normalized_type = data_type.strip().lower()
        if normalized_type not in VALID_LIBRARY_TYPES - {"screening_cache"}:
            logger.error("Rejected reference upload because type=%s is invalid", normalized_type)
            raise IrisAPIError(400, "Invalid data type", "Reference data type is not supported in the POC")

        try:
            parsed_effective_date = date.fromisoformat(effective_date)
        except ValueError as exc:
            logger.error("Rejected reference upload because effective_date=%s is invalid", effective_date)
            raise IrisAPIError(400, "Invalid effective date", "Effective date must be a valid ISO date") from exc

        created_ref = f"REF-{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}"
        record = self.repository.create_reference_version(
            ReferenceDataVersion(
                ref_id=created_ref,
                data_type=normalized_type,
                name=filename or f"{normalized_type.replace('_', ' ').title()} Upload",
                source=source.strip(),
                version=f"v{datetime.now(UTC).strftime('%Y.%m.%d')}",
                effective_date=parsed_effective_date,
                status="active",
                is_locked=False,
                contracts_using=0,
                notes=notes,
                uploaded_by=actor.id,
                data_payload={
                    "filename": filename,
                    "notes": notes or "",
                    "mock": True,
                },
            )
        )
        self._record_reference_event(
            actor.email,
            record.ref_id,
            "Reference Data Upload",
            f"Uploaded new {normalized_type.replace('_', ' ')} version {record.ref_id}",
        )
        return {"ref_id": created_ref, "status": "active", "data_type": normalized_type}

    def force_sync_screening_cache(self, list_name: str, actor: User) -> dict[str, Any]:
        logger.info("Forcing screening cache sync")
        logger.debug("Screening cache sync request list_name=%s", list_name)
        item = self.repository.get_screening_cache_list(list_name)
        if item is not None:
            now = datetime.now(UTC)
            item.last_sync = now
            item.updated_at = now
            updated = self.repository.update_screening_cache_list(item)
            self._record_reference_event(
                actor.email,
                updated.list_name,
                "Screening Cache Sync",
                f"Initiated screening cache sync for {updated.list_name}",
            )
            return {"list_name": updated.list_name, "status": updated.status, "message": "Sync initiated"}
        logger.error("Screening cache sync failed because list_name=%s was not found", list_name)
        raise IrisAPIError(404, "Screening list not found", "The requested screening cache list does not exist")

    def get_integration_health(self) -> dict[str, Any]:
        logger.info("Loading admin integration health")
        return {"items": self.repository.get_integration_health()}

    def get_pending_approvals(self) -> dict[str, Any]:
        logger.info("Loading admin pending approvals")
        return {"items": self.repository.get_pending_approvals()}

    def get_audit_log(self) -> dict[str, Any]:
        logger.info("Loading admin audit log")
        return self.list_access_logs()

    def _resolve_status(self, user: User, state: dict[str, Any]) -> str:
        override = state.get("user_status_overrides", {}).get(user.email, {})
        if override.get("status"):
            return override["status"]
        return "active" if user.is_active else "inactive"

    def _serialize_user(self, user: User, override: dict[str, Any]) -> dict[str, Any]:
        status = override.get("status", "active" if user.is_active else "inactive")
        return {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "status": status,
            "last_login": user.last_login.isoformat() if user.last_login else None,
        }

    def _serialize_access_event(self, event: AuditEvent) -> dict[str, Any]:
        return {
            "timestamp": event.timestamp.isoformat().replace("+00:00", "Z"),
            "user": event.actor_id or "system",
            "resource": event.entity_id or "-",
            "action": event.event_type,
            "ip": event.ip_address or "internal",
        }

    def _serialize_reference_version(self, version: ReferenceDataVersion) -> dict[str, Any]:
        payload = deepcopy(version.data_payload or {})
        item = {
            "ref_id": version.ref_id,
            "data_type": version.data_type,
            "name": version.name,
            "source": version.source,
            "version": version.version,
            "effective_date": version.effective_date.isoformat(),
            "status": version.status,
            "contracts_using": version.contracts_using,
            "is_locked": version.is_locked,
            "data_payload": payload,
        }

        if version.data_type == "fx_rate":
            item.update(
                {
                    "code": payload.get("code"),
                    "fx_to_usd": payload.get("fx_to_usd"),
                    "as_of": version.effective_date.isoformat(),
                }
            )
        elif version.data_type == "yield_curve":
            item.update(
                {
                    "currency": payload.get("currency"),
                    "tenors": payload.get("tenors"),
                    "as_of": version.effective_date.isoformat(),
                }
            )
        elif version.data_type == "assumption_set":
            item.update(
                {
                    "mortality": payload.get("mortality"),
                    "curve": payload.get("curve"),
                    "inflation": payload.get("inflation"),
                    "used_by": payload.get("used_by"),
                }
            )
        elif version.data_type == "file_template":
            item.update(
                {
                    "template": payload.get("template", version.ref_id),
                    "cedant": payload.get("cedant"),
                    "fields": payload.get("fields"),
                    "format": payload.get("format"),
                }
            )

        return item

    def _serialize_screening_cache(self, item: ScreeningCacheList) -> dict[str, Any]:
        return {
            "list_name": item.list_name,
            "provider": item.provider,
            "records": item.record_count,
            "last_sync": item.last_sync.strftime("%Y-%m-%d %H:%M") if item.last_sync else None,
            "status": item.status,
            "data_payload": deepcopy(item.data_payload or {}),
        }

    def _record_access_event(self, actor_id: str, resource: str, action: str) -> None:
        self._record_audit_event(
            module="access",
            actor_id=actor_id,
            event_type=action,
            entity_id=resource,
            entity_type="route",
            description=f"{action} {resource}",
            ip_address="internal",
        )

    def _record_reference_event(self, actor_id: str, entity_id: str, event_type: str, description: str) -> None:
        self._record_audit_event(
            module="reference_data",
            actor_id=actor_id,
            event_type=event_type,
            entity_id=entity_id,
            entity_type="reference_data",
            description=description,
            ip_address="internal",
        )

    def _record_audit_event(
        self,
        module: str,
        actor_id: str,
        event_type: str,
        entity_id: str,
        entity_type: str,
        description: str,
        ip_address: str,
    ) -> None:
        timestamp = datetime.now(UTC)
        audit_id = self.repository.get_next_audit_id(timestamp.strftime("%Y-%m-%d"))
        self.repository.create_audit_event(
            AuditEvent(
                audit_id=audit_id,
                timestamp=timestamp,
                module=module,
                event_type=event_type,
                actor_type="human" if actor_id != "system" else "system",
                actor_id=actor_id,
                entity_id=entity_id,
                entity_type=entity_type,
                description=description,
                approval_status="n/a",
                ip_address=ip_address,
            )
        )
