# IRiS — Underwriting API

## Base URL: `/api/v1/underwriting`
Accessible to roles: `underwriter`, `super_admin`

---

## CEDENTS

### GET `/cedents`
List all cedants with summary data.

**Query params:**
- `search` — string filter on name/ID/country
- `status` — filter: all|active|inactive|onboarding
- `page`, `page_size` — pagination (default 20)

**Response 200:**
```json
{
  "total": 6,
  "page": 1,
  "items": [
    {
      "cedent_id": "CED-1042",
      "legal_entity_name": "Northstar Pension Trust",
      "country": "UK",
      "aum": "$12.4B",
      "contracts_count": 4,
      "screening_status": "cleared",
      "status": "active",
      "onboarded_date": "2021-03-14",
      "actions": ["view", "edit"]
    }
  ]
}
```

---

### GET `/cedents/{cedent_id}`
Full cedant record with all section data.

**Response 200:**
```json
{
  "cedent_id": "CED-1042",
  "legal_entity_name": "Northstar Pension Trust",
  "status": "active",
  "screening_status": "cleared",
  "country": "UK",
  "aum": 12400000000,
  "aum_currency": "USD",
  "contracts_count": 4,
  "legal_entity": { ... },
  "pension_scheme": { ... },
  "key_contacts": [ ... ],
  "financial_treasury": { ... },
  "contract_readiness": { ... },
  "population_exposure": { ... },
  "compliance_kyc": { ... },
  "sanction_screening": { ... },
  "regulatory_docs": [ ... ],
  "operational_connectivity": { ... },
  "actuarial_preferences": { ... },
  "access_beneficiary_rules": [ ... ]
}
```

---

### POST `/cedents`
Create new cedant (step 1: just the ID + basic info).

**Request:**
```json
{
  "legal_entity_name": "Acme Pension Fund",
  "country": "UK",
  "entity_type": "Pension Trust"
}
```

**Response 201:**
```json
{ "cedent_id": "CED-1202", "status": "onboarding" }
```

---

### PATCH `/cedents/{cedent_id}/{section}`
Update a specific section of cedant data.

**Sections:** `legal-entity` | `pension-scheme` | `key-contacts` | `financial-treasury` | `contract-readiness` | `population-exposure` | `compliance-kyc` | `regulatory-docs` | `operational-connectivity` | `actuarial-preferences` | `access-beneficiary-rules`

**Request:** JSON body with the section's fields.

**Response 200:** Updated section data.

---

### POST `/cedents/ai-extract`
Send uploaded document to Claude API for field extraction.

**Request:** `multipart/form-data` with `file` field.

**Response 200:**
```json
{
  "extracted_fields": {
    "legal_entity_name": { "value": "Northstar Pension Trust", "confidence": 0.98, "citation": "Page 1, header" },
    "lei": { "value": "5299001042ABCD1234EF56", "confidence": 0.95, "citation": "Section 2.1" },
    "country": { "value": "UK", "confidence": 0.99, "citation": "Page 1" }
  },
  "sections_populated": ["legal_entity", "pension_scheme", "key_contacts"],
  "low_confidence_fields": ["tax_identification_number"]
}
```

---

### POST `/cedents/{cedent_id}/sanction-screening`
Trigger a sanctions screening run for this cedant.

**Request:**
```json
{ "sources": ["OFAC", "FinCEN"] }
```

**Response 200:**
```json
{
  "screening_id": "uuid",
  "status": "initiated",
  "estimated_completion_seconds": 5
}
```

---

### GET `/cedents/{cedent_id}/sanction-screening/history`
Get all screening history for this cedant.

**Response 200:**
```json
{
  "total_scans": 18,
  "open_hits": 3,
  "sources_monitored": 2,
  "next_periodic_due": "2025-09-15",
  "history": [
    {
      "id": "uuid",
      "screening_date": "2025-03-15T00:00:00Z",
      "source": "OFAC",
      "result": "cleared",
      "reference_id": "REF-50000",
      "matches": 0
    }
  ]
}
```

---

### PATCH `/cedents/{cedent_id}/status`
Activate / deactivate / reactivate cedant.

**Request:**
```json
{ "status": "active", "reason": "Reactivation approved by compliance" }
```

---

## CONTRACTS

### GET `/contracts`
List all contracts.

**Query params:** `cedent_id`, `status`, `search`, `page`, `page_size`

**Response 200:**
```json
{
  "total": 5,
  "items": [
    {
      "contract_id": "LSC-2024-019",
      "contract_name": "Northstar Pension Trust Longevity Swap 2024",
      "cedent_id": "CED-1042",
      "cedent_name": "Northstar Pension Trust",
      "notional": 1250000000,
      "currency": "GBP",
      "fixed_rate": 0.0285,
      "floating_definition": "Realized mortality",
      "inception_date": "2024-01-15",
      "maturity_date": "2054-01-15",
      "lives_count": 18420,
      "version": "v1.2",
      "status": "active"
    }
  ]
}
```

---

### GET `/contracts/{contract_id}`
Full contract with all sections.

**Response 200:**
```json
{
  "contract_id": "LSC-2024-019",
  "master_data": { ... },
  "economic_terms": { ... },
  "reference_pool": { ... },
  "actuarial_basis": { ... },
  "risk_limits": { ... },
  "operational_terms": { ... },
  "compliance_docs": [ ... ],
  "amendments": [ ... ],
  "file_templates": [ ... ]
}
```

---

### POST `/contracts`
Create a new contract.

**Request:** Contract master data fields. Returns `contract_id`.

---

### PATCH `/contracts/{contract_id}/{section}`
Update a contract section. Returns 403 if section is locked post-inception.

**Sections:** `master-data` | `economic-terms` | `reference-pool` | `actuarial-basis` | `risk-limits` | `operational-terms` | `compliance-docs`

---

### POST `/contracts/{contract_id}/amend`
Create a contract amendment.

**Request:**
```json
{
  "description": "Notional adjustment following Q4 review",
  "changed_sections": ["economic_terms"],
  "changes": { "notional_amount": 1180000000 }
}
```

---

### GET `/contracts/{contract_id}/details-performance`
Returns performance metrics and settlement history for a contract.

**Response 200:**
```json
{
  "contract_id": "LSC-2024-019",
  "current_notional": 1180000000,
  "lives_active": 17204,
  "lives_deceased_ytd": 216,
  "ae_ratio_ytd": 1.018,
  "bel": 892000000,
  "settlements": [
    {
      "period": "Q1 2024",
      "fixed_leg": 8420000,
      "floating_leg": 8603000,
      "net": 183000,
      "direction": "reinsurer_to_cedant",
      "status": "paid"
    }
  ]
}
```

---

### GET `/contracts/{contract_id}/calculations`
Aggregation calculator — compute settlement metrics.

**Query params:**
- `metric` — `settlement_variance` | `fixed_leg_total` | `floating_leg_total` | `ae_ratio`
- `aggregation` — `sum` | `avg` | `min` | `max`
- `group_by` — `per_quarter` | `per_year` | `total`
- `from` — quarter label e.g. `Q1 2024`
- `to` — quarter label e.g. `Q1 2025`

**Response 200:**
```json
{
  "metric": "settlement_variance",
  "aggregation": "sum",
  "group_by": "per_quarter",
  "from": "Q1 2024",
  "to": "Q1 2025",
  "result_label": "SUM of settlements · 5 quarter(s)",
  "result_value": 474031,
  "currency": "CHF",
  "breakdown": [
    { "period": "Q1 2024", "value": 182642 },
    { "period": "Q2 2024", "value": 94200 },
    { "period": "Q3 2024", "value": 78900 },
    { "period": "Q4 2024", "value": 61800 },
    { "period": "Q1 2025", "value": 56489 }
  ]
}
```

---

### GET `/contracts/{contract_id}/member-list`
Returns paginated member list for the contract.

**Query params:** `status`, `page`, `page_size`

---

### POST `/contracts/{contract_id}/upload-members`
Upload a population file (CSV) to update the member list.

**Request:** `multipart/form-data` with `file`

---

## POPULATION

### GET `/population`
Returns policy register records across contracts.

**Query params:**
- `cedent_id` — filter by cedant
- `contract_id` — filter by contract
- `status` — all|active|deceased|deferred|suspended
- `page`, `page_size`

**Response 200:**
```json
{
  "total": 14,
  "filters_applied": { "cedent": "Northstar Pension Trust", "contract": "LSC-2024-019", "status": "all" },
  "items": [
    {
      "member_id": "PEN-0100234",
      "contract_id": "LSC-2024-019",
      "age": 62,
      "gender": "F",
      "annual_pension": 12000,
      "currency": "GBP",
      "status": "active",
      "last_verified": "2025-03-31"
    }
  ]
}
```

---

### GET `/population/{member_id}/history`
Returns SCD2 history for a single member.

**Response 200:**
```json
{
  "member_id": "PEN-0100234",
  "history": [
    {
      "effective_from": "2024-01-15",
      "effective_to": null,
      "status": "active",
      "annual_pension": 12000,
      "is_current": true
    }
  ]
}
```

---

### PATCH `/population/{member_id}/defer`
Mark a member as deferred.
