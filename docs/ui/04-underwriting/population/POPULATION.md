# IRiS — Population Page

**Route:** `/underwriting/population`
**Auth:** `underwriter`, `super_admin`

> This spec is embedded in `ui/04-underwriting/contracts/CONTRACTS.md` under "POPULATION PAGE".
> Refer there for the full specification including table columns, filter dropdowns,
> member history drawer, status badge colors, and upload button behaviour.

## Quick Reference
- Cedant dropdown → cascades to Contract dropdown → Status filter
- Table: Member ID | Contract | Age | Gender | Annuity | Status | Last Verified | Actions
- [Defer] button → PATCH `/api/v1/underwriting/population/{member_id}/defer`
- [History] button → slide-in drawer with SCD2 history timeline
- [Upload cedant file] → opens FileProcessingModal
- API: `GET /api/v1/underwriting/population`
