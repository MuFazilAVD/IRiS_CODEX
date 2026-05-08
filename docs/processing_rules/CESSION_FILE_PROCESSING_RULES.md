# Cession File Processing Rules

These rules are the runtime contract for the Claims > Cession Files pipeline.

## Shared Pipeline Rules
- Upload stores the raw tabular content and detection metadata only.
- Detection must be confirmed before validation artifacts are created.
- If file type, cedent, or contract is changed, records and exceptions must be rebuilt from the uploaded source content.
- Contract clauses shown in the UI must be derived from the confirmed contract and current database state.
- Processing must not run while unresolved exceptions remain.

## Pension Status
- Required fields: `member_id`, `date_of_birth`, `gender`, `annual_pension`, `status`.
- Allowed statuses: `active`, `deferred`, `deceased`.
- Member IDs must exist in current `policy_register` rows for the confirmed contract.
- Every current active member for the confirmed contract must be present in the upload.
- Exceptions should include DB-backed suggestions when the current `policy_register` row has a trusted value.
- Processing applies SCD2 updates to `policy_register`.
- After processing, calculate fixed leg from contract terms, floating leg from current population rows, net settlement as `floating - fixed`, create/update a settlement row, and create a Claims Ops settlement approval worklist item.

## Fixed Leg
- Validate fixed-leg amounts against confirmed contract economic terms.
- Validate currency against the confirmed contract currency.
- Processing produces settlement-impacting output and routes exceptions to Claims Ops.

## Settlement
- Required fields: `Calculation Period`, `Payment Date`, `Pensioner Movement`, `Applicable Indexation/Escalation`, `Fixed Leg`, `Floating Leg`, `Fee`, `Interest on Over/Underpayment from Prior Period`, `Net Settlement Amount`.
- Header aliases such as `Applicable Indexation / Escalation` and `Fee (Admin)` are valid Settlement headers after normalization.
- CSV and tab-delimited CSV uploads are parsed using detected delimiters.
- Detect as `Settlement` only when every required settlement header is present.
- Match by confirmed cedent and contract before reconciliation.
- Compare uploaded fixed leg and floating leg against IRiS expected values for the mapped contract-period.
- Recompute net as `floating - fixed + fee + interest`, treating fee and interest as signed file values.
- Matching is exact after currency amount normalization to cents.
- Exact matches create/update a `pending_approval` settlement with IRiS recommendation `accept`; final approval remains the existing human settlement approval workflow.
- Exceptions are strictly data validation issues such as missing required fields, invalid periods, invalid dates, or non-numeric amounts.
- Fixed-leg, floating-leg, or net reconciliation mismatches are not validation exceptions; they are highlighted in the summary and routed to a Claims Ops reconciliation worklist item with IRiS recommendation `review`.
- Processing generates two repo-backed report output files for Reports > Settlement reports: Cash Settlements Tracker CSV and GRDR Load Form CSV.
- If contract-period expected values are not tracked, use a deterministic `MOCK IMPLEMENTATION` fallback and store the fallback in mock settlement override data.

## Mortality Report
- Validate mortality rows against the confirmed contract population.
- Death rows require a valid death date and evidence fields where available.
- Processing should apply confirmed death movements through SCD2 population updates when implemented.

## Spouse Events
- Validate member IDs against the confirmed contract population.
- Route unsupported or incomplete beneficiary changes to Claims Ops review.

## Activity Report
- Validate member IDs and activity codes against the confirmed contract population.
- Route unsupported transitions to Claims Ops review.

## Fee Schedule
- Validate uploaded fees against confirmed contract terms.
- Route settlement-impacting differences to Claims Ops review.
