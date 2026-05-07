from __future__ import annotations

import csv
import io
import json
import logging
import zipfile
from typing import Any

from app.errors import IrisAPIError
from app.models.report import Report
from app.repositories.reports_repository import ReportsRepository


logger = logging.getLogger(__name__)

CATEGORY_LABELS = {
    "Historical": "Historical Reports",
    "Dynamic": "Dynamic Reports",
    "Debugging": "Debugging Reports",
    "Movement": "Movement Reports",
    "Compliance": "Compliance Reports",
    "Financial": "Financial Reports",
    "Admin": "Admin & Access Reports",
}


class ReportsService:
    def __init__(self, repository: ReportsRepository) -> None:
        self.repository = repository

    def list_reports(
        self,
        role: str,
        category: str | None,
        cedent_id: str | None,
        contract_id: str | None,
        period: str | None,
        sensitivity: str | None,
    ) -> dict[str, Any]:
        logger.info("Loading report catalog")
        logger.debug(
            "Report catalog role=%s category=%s cedent_id=%s contract_id=%s period=%s sensitivity=%s",
            role,
            category,
            cedent_id,
            contract_id,
            period,
            sensitivity,
        )
        accessible = [report for report in self.repository.list_reports() if self._can_access(report, role)]
        counts = self._category_counts(accessible)
        filtered = accessible

        if category and category not in {"all", "All Reports"}:
            filtered = [report for report in filtered if report.category == category]

        normalized_sensitivity = (sensitivity or "").strip()
        if normalized_sensitivity and normalized_sensitivity.lower() != "all":
            filtered = [report for report in filtered if report.sensitivity.lower() == normalized_sensitivity.lower()]

        return {
            "total": len(filtered),
            "categories": counts,
            "items": [self._serialize_report(report) for report in filtered],
        }

    def get_report_detail(self, report_id: str, role: str) -> dict[str, Any]:
        logger.info("Loading report detail preview")
        logger.debug("Report detail report_id=%s role=%s", report_id, role)
        report = self._get_report_or_error(report_id)
        if not self._can_access(report, role):
            logger.error("Report detail forbidden for report_id=%s role=%s", report_id, role)
            raise IrisAPIError(403, "Forbidden", "Role is not permitted for this report")

        previews = self.repository.get_report_previews()
        preview = previews.get(report_id)
        if preview is None:
            logger.error("Report preview missing for report_id=%s", report_id)
            raise IrisAPIError(404, "Report preview not found", "The requested report preview has not been configured")

        return {
            **self._serialize_report(report),
            "insight": preview.get("insight", ""),
            "metrics": preview.get("metrics", []),
            "graph": preview.get("graph"),
            "table": preview.get("table", {"columns": [], "rows": []}),
            "notes": preview.get("notes", []),
        }

    def export_reports(self, report_ids: list[str], export_format: str, filters: dict[str, Any], role: str) -> dict[str, Any]:
        logger.info("Exporting reports bundle")
        logger.debug("Reports export role=%s report_ids=%s format=%s filters=%s", role, report_ids, export_format, filters)
        if not report_ids:
            logger.error("Report export rejected because no report_ids were supplied")
            raise IrisAPIError(400, "No reports selected", "Select at least one report before exporting")

        reports = [self._get_report_or_error(report_id) for report_id in report_ids]
        for report in reports:
            if not self._can_access(report, role):
                logger.error("Report export forbidden for report_id=%s role=%s", report.report_id, role)
                raise IrisAPIError(403, "Forbidden", "Role is not permitted to export one or more selected reports")

        normalized_format = export_format.strip().lower()
        if normalized_format == "csv":
            content = self._build_csv_export(reports, filters)
            return {
                "filename": "reports-export.csv",
                "content_type": "text/csv;charset=utf-8;",
                "content": content.encode("utf-8"),
            }
        if normalized_format == "excel":
            content = self._build_excel_export(reports, filters)
            return {
                "filename": "reports-export.xls",
                "content_type": "application/vnd.ms-excel",
                "content": content.encode("utf-8"),
            }
        if normalized_format == "pdf":
            return {
                "filename": "reports-export.pdf",
                "content_type": "application/pdf",
                "content": self._build_pdf_export(reports, filters),
            }
        if normalized_format == "zip":
            return {
                "filename": "reports-export.zip",
                "content_type": "application/zip",
                "content": self._build_zip_export(reports, filters),
            }

        logger.error("Report export rejected because format=%s is invalid", export_format)
        raise IrisAPIError(400, "Invalid format", "Export format must be csv, excel, pdf, or zip")

    def _serialize_report(self, report: Report) -> dict[str, Any]:
        return {
            "report_id": report.report_id,
            "name": report.name,
            "description": report.description,
            "category": report.category,
            "cadence": report.cadence,
            "distribution": list(report.distribution or []),
            "sensitivity": report.sensitivity,
            "is_accessible": True,
        }

    def _category_counts(self, reports: list[Report]) -> list[dict[str, Any]]:
        counts = {category: 0 for category in CATEGORY_LABELS}
        for report in reports:
            counts[report.category] = counts.get(report.category, 0) + 1

        items = [{"category": "All", "label": "All Reports", "count": len(reports)}]
        for category, label in CATEGORY_LABELS.items():
            items.append({"category": category, "label": label, "count": counts.get(category, 0)})
        return items

    def _can_access(self, report: Report, role: str) -> bool:
        return role == "super_admin" or role in (report.roles_with_access or [])

    def _get_report_or_error(self, report_id: str) -> Report:
        report = self.repository.get_report_by_id(report_id)
        if report is None:
            logger.error("Report not found for report_id=%s", report_id)
            raise IrisAPIError(404, "Report not found", "The requested report does not exist")
        return report

    def _build_csv_export(self, reports: list[Report], filters: dict[str, Any]) -> str:
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["Report ID", "Name", "Category", "Cadence", "Sensitivity", "Distribution", "Filters"])
        filters_text = json.dumps(filters, sort_keys=True)
        for report in reports:
            writer.writerow(
                [
                    report.report_id,
                    report.name,
                    report.category,
                    report.cadence,
                    report.sensitivity,
                    ", ".join(report.distribution or []),
                    filters_text,
                ]
            )
        return buffer.getvalue()

    def _build_excel_export(self, reports: list[Report], filters: dict[str, Any]) -> str:
        rows = [
            "Report ID\tName\tCategory\tCadence\tSensitivity\tDistribution\tFilters",
        ]
        filters_text = json.dumps(filters, sort_keys=True)
        for report in reports:
            rows.append(
                "\t".join(
                    [
                        report.report_id,
                        report.name,
                        report.category,
                        report.cadence or "",
                        report.sensitivity,
                        ", ".join(report.distribution or []),
                        filters_text,
                    ]
                )
            )
        return "\n".join(rows)

    def _build_pdf_export(self, reports: list[Report], filters: dict[str, Any]) -> bytes:
        lines = [
            "IRiS Reports Export",
            "",
            f"Selected reports: {len(reports)}",
            f"Filters: {json.dumps(filters, sort_keys=True)}",
            "",
        ]
        lines.extend(f"{report.report_id} | {report.name} | {report.category} | {report.sensitivity}" for report in reports)
        return self._simple_pdf_bytes(lines)

    def _build_zip_export(self, reports: list[Report], filters: dict[str, Any]) -> bytes:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("README.txt", "IRiS regulatory pack export (mock POC bundle)")
            archive.writestr("reports.csv", self._build_csv_export(reports, filters))
            archive.writestr("filters.json", json.dumps(filters, indent=2, sort_keys=True))
        return buffer.getvalue()

    def _simple_pdf_bytes(self, lines: list[str]) -> bytes:
        escaped_lines = [line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") for line in lines]
        text_lines = []
        y_position = 760
        for line in escaped_lines:
            text_lines.append(f"BT /F1 11 Tf 50 {y_position} Td ({line}) Tj ET")
            y_position -= 16
        page_stream = "\n".join(text_lines).encode("utf-8")

        objects: list[bytes] = []
        objects.append(b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n")
        objects.append(b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n")
        objects.append(
            b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n"
        )
        objects.append(f"4 0 obj << /Length {len(page_stream)} >> stream\n".encode("utf-8") + page_stream + b"\nendstream endobj\n")
        objects.append(b"5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n")

        output = io.BytesIO()
        output.write(b"%PDF-1.4\n")
        offsets = [0]
        for obj in objects:
            offsets.append(output.tell())
            output.write(obj)

        xref_start = output.tell()
        output.write(f"xref\n0 {len(objects) + 1}\n".encode("utf-8"))
        output.write(b"0000000000 65535 f \n")
        for offset in offsets[1:]:
            output.write(f"{offset:010d} 00000 n \n".encode("utf-8"))
        output.write(b"trailer << /Size 6 /Root 1 0 R >>\n")
        output.write(f"startxref\n{xref_start}\n%%EOF".encode("utf-8"))
        return output.getvalue()
