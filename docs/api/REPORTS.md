# IRiS - Reports API

## GET `/reports`
Returns the role-filtered static report catalog.

## GET `/reports/settlement-artifacts`
Returns generated Settlement cession output files.

These files are created during Settlement file processing and stored in the repo-backed generated report registry.

**Response 200:**
```json
{
  "total": 2,
  "items": [
    {
      "artifact_id": "ces-2026-015-cash-settlements-tracker",
      "settlement_id": "SET-2025-Q1-002",
      "cession_file_id": "CES-2026-015",
      "contract_id": "LSC-2025-002",
      "cedent": "Bavarian Industrial Fund",
      "period": "Q1 2025",
      "report_type": "Cash Settlements Tracker",
      "filename": "CES-2026-015_SET-2025-Q1-002_cash_settlements_tracker.csv",
      "format": "csv",
      "generated_at": "2026-05-08T07:41:01Z",
      "source_filename": "bavarian_settlement_2025Q1.csv",
      "reconciliation_decision": "accept",
      "mismatch_count": 0
    }
  ]
}
```

## GET `/reports/settlement-artifacts/{artifact_id}/download`
Downloads a generated Settlement output CSV.

The Reports UI also fetches this CSV to support the `Open / View` row action by parsing the response into an in-page popup table without introducing a separate view endpoint.

Generated artifact types:
- Cash Settlements Tracker
- GRDR Load Form

## POST `/reports/export`
Exports selected catalog reports as CSV, Excel, PDF, or ZIP.
