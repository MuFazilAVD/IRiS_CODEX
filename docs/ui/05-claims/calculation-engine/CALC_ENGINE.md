# IRiS — Calculation Engine Page

**Route:** `/claims/calculation-engine`
**Auth:** `claims_ops`, `super_admin`

> Full specification embedded in `ui/05-claims/cession-files/CESSION_FILES.md`
> under "CALCULATION ENGINE PAGE".

## Quick Reference
- Contract selector dropdown (live from DB)
- Calculation Type: Settlement | Fixed Leg | Floating Leg | A/E Ratio
- Period From / Period To dropdowns (quarters)
- [Run Calculation] → `POST /iris/api/v1/claims/calculations/run`
- Result panel: Fixed Leg | Floating Leg | Net | A/E | BEL | Lives | Deaths
- [Export to Settlement] | [Save Calculation]
