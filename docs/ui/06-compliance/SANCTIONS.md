# IRiS — Compliance Module UI Specs
## Covers: Sanctions Screening + Audit & Traceability

---

# SANCTIONS SCREENING PAGE

**Route:** `/compliance/sanctions`  
**Auth:** `compliance`, `super_admin`

> **Screening flow (per your spec):**  
> 1. Keyword match against watchlist cache (OFAC SDN, FinCEN 314(a), EU Consolidated, FIS Adverse Media)  
> 2. If **no match** → **Passed** (green, auto-cleared)  
> 3. If **match found** → send to **IRiS Engine (Claude API)** for LLM verification  
>    - If LLM determines **false positive** → **Passed**  
>    - If LLM confirms match → **Flag for manual review**  
> 4. Manual review by compliance officer → **Cleared** or **Escalated**

> **Triggering:** Screening runs automatically during:
> - New Cedant onboarding (Step 12 in wizard)
> - Cession file processing (Step 4: Screening in the pipeline)
> - Periodic scheduled re-screening of all active cedants

---

## Layout

```
Home › Compliance & Audit › Sanctions Screening

Sanctions Screening                    [Trigger Bulk Screening]
                                       [Export Screening Report]

[KPI Grid — same 14 metrics as Compliance Dashboard]

[Screening Status by Cedant — bar chart]
[Override Trend (6m) — line chart]
[Compliance Holds Summary — horizontal bar]

[Audit Risk Heatmap — table]
[Active Screening Hits — list panel]
```

---

## KPI Grid (14 cards, 2 rows × 7)

Same values as Compliance Dashboard. Refer `ui/02-dashboard/DASHBOARD.md` Compliance View.

---

## Screening Status by Cedant Chart
Bar chart (stacked): green = cleared, red = hits  
Cedants on X axis: Northstar, Helvetia, Maple Leaf, Atlas  
Values: Northstar ~1900 clear / 0 hits, Helvetia ~1550 clear / 0, Maple Leaf ~900 clear / 0, Atlas ~1000 clear / small red  

---

## Active Screening Hits Panel
Header: "Active Screening Hits" + "Open →" link

```
Sergei V. Markov             [Escalated]      OFAC SDN · conf 0.88
John A. Whitcomb             [Pending Review] FinCEN 314(a) · conf 0.71
Atlas Corporate Pensions     [Under Review]   OFAC SDN · conf 0.42
```

Clicking each → opens a screening detail slide-in.

---

## Screening Detail Slide-in

```
Screening Hit Detail                             [×]
SHM-887 · OFAC SDN

Entity:       Sergei V. Markov
Cedant:       Northstar Pension Trust
Member ID:    PEN-0100234
Match Type:   OFAC SDN
Source:       OFAC DB (US Treasury)
Confidence:   88%
Matched On:   2025-04-29 09:14
──────────────────────────────────
IRiS Engine Reasoning:
"Name, DOB and country match exceeds threshold 0.85.
 Recommend human review before proceeding."
──────────────────────────────────
[Mark as False Positive]  [Escalate]  [Clear — Compliance Sign-off]
```

---

## Screening Flow Integration Points

### In Cession File Pipeline (Step 4 — Compliance & AML)
The Screening step in the pipeline (see SETTLEMENTS_AND_CALC_ENGINE.md Step 4) shows:
- Entities from the cession file screened against the watchlist cache
- Matches shown in the Match Table
- Actions: Escalate to Compliance | Mark as False Positive | Request Additional Data

### In Cedant Onboarding (Step 12 — Sanction Screening)
Already documented in CEDENTS.md. Screening is triggered per cedant entity.

---

## API Integration (Mock for POC)

**Screening logic (backend mock):**
```python
async def screen_entity(entity_name: str, dob: str = None) -> dict:
    # Step 1: keyword match against screening_cache table
    matches = keyword_match(entity_name, screening_cache)
    
    if not matches:
        return {"result": "cleared", "confidence": 1.0, "method": "keyword_no_match"}
    
    # Step 2: LLM verification via Claude API
    prompt = f"""
    Potential sanctions match: '{entity_name}' (DOB: {dob})
    Matched against: {matches}
    
    Determine if this is a genuine sanctions match or false positive.
    Return JSON: {{"is_genuine_match": bool, "confidence": float, "reasoning": str}}
    """
    llm_result = await claude_api_call(prompt)
    
    if not llm_result["is_genuine_match"]:
        return {"result": "cleared", "confidence": llm_result["confidence"], "method": "llm_false_positive"}
    
    return {"result": "review", "confidence": llm_result["confidence"], 
            "method": "llm_confirmed", "reasoning": llm_result["reasoning"]}
```

---

# AUDIT & TRACEABILITY PAGE

**Route:** `/compliance/audit`  
**Auth:** `compliance`, `super_admin`

**POC Status:** All data is **mock**. The `audit_events` table is seeded with demo records.

---

## Layout

```
Home › Compliance & Audit › Audit Management

Audit & Traceability                              [Reports]
Regulator-grade traceability across every operational, financial, actuarial and AI action

LEFT NAV                        RIGHT CONTENT AREA
─────────────────               ─────────────────────────────────────────
Overview                        [Active section content]
  ■ Audit Dashboard
  🔍 Audit Search

Risk & Governance
  $ Financial Impact Changes
  ✓ Approval Audit
  🤖 AI Decision Audit
  ✋ Manual Overrides

Data & Access
  📋 Reference Data Audit
  🔑 Access Logs
  📄 Document History

Reporting
  ↓ Export Audit Reports
```

---

## OVERVIEW: Audit Dashboard

**KPI tiles (2 rows × 3):**

Row 1:
| Audit events today | High-risk changes | Pending approvals | Manual overrides |
|---|---|---|---|
| 10 (+23% vs 7d avg, green) | 7 (2 critical, red) | 3 (oldest 3h) | 1 (awaiting review) |

Row 2:
| AI decisions pending review | Failed screenings | High financial impact |
|---|---|---|
| 1 (confidence < 0.90, red) | 0 (last 24h, green) | 4 (≥ £1M change, amber) |

**Today · Audit timeline (right-side, vertical timeline):**

```
● 11:11:42  [Settlement] [Human]  Settlement Approved      [High Impact · GBP 4.21M] [Pending]
            Approved Q1 settlement after reconciliation review

● 10:48:09  [Cession]   [AI]     AI Recommendation                                  [Pending]
            Auto-mapped 14 of 16 columns; flagged 2 for analyst review

● 09:14:33  [Contract]  [Human]  Contract Created         [High Impact · GBP 1.42B] [Pending]
            Created longevity swap contract — 12,840 lives, GBP 1.42B notional

● 08:42:18  [Ref Data]  [System] Reference Data Upd...    [High Impact · GBP 2.84M] [Pending]
            Daily GBP nominal curve refresh from BoE feed

● 08:11:05  [Cession]   [System] SFTP File Received
            File received via SFTP — atlas/in/CES-2026-04-118.xlsx (2.4MB, 12,840 rows)

● 07:55:21  [Access]    [Human]  Sensitive Export
            Downloaded financial impact report (Q1 2026, all cedants)
```

**Timeline dot colors:** Settlement=amber, Cession=blue, Contract=red, Ref Data=grey, Access=teal

**Below timeline — two panels:**

**High-impact financial changes panel (left):**
```
$ Settlement Approved     GBP 4.21M    STL-2026-Q1-184 · CED-1042
$ Contract Amendment      GBP 1.84M    LSC-2024-018 · CED-1042
$ Contract Created        GBP 1.42B    LSC-2026-022 · CED-1156
$ Reference Data Update   GBP 2.64M    GBP-NOMINAL-2026Q2 · —
```

**AI decisions awaiting human review panel (right):**
```
✦ Cession Mapper · v3.2.1                          conf 0.81
  Auto-mapped 14 of 16 columns; flagged 2 for a...
```

---

## OVERVIEW: Audit Search

**Advanced filtering bar:**
```
[🔍 Audit ID, entity, user, action...]  [Module: all ▾]  [Actor: all ▾]  [Approval: all ▾]  [Impact: all ▾]
[Risk: all ▾]                                                                                [↓ Export 15]
```

**Results table header:** "15 matching events"  
Columns: Timestamp | Module | Event | Entity | Actor

```
2026-04-29 11:11:42 | [Settlement] | Settlement Approved                           | STL-2026-Q1-184  | ● Human
                      Approved Q1 settlement after reconciliation review

2026-04-29 10:48:09 | [Cession]   | AI Recommendation                             | CES-2026-04-118  | ● AI  ag...
                      Auto-mapped 14 of 16 columns; flagged 2 for analyst review

2026-04-29 10:22:55 | [Calculation]| Manual Override                               | CALC-2026-Q1-918 | ● Human
                      Override mortality improvement scaling factor for 2026 cohort
```

Module tag colors: Settlement=blue, Cession=teal, Calculation=purple, Contract=navy, Access=grey, Reference Data=amber

---

## RISK & GOVERNANCE: Financial Impact Changes

**Header:** "Financial Impact Changes · 6 events" + [↓ Export]

Columns: Timestamp | Module | Event | Entity | Actor

```
2026-04-29 11:11:42 | [Settlement]    | Settlement Approved           | STL-2026-Q1-184      | ● Human d.rhodes@reinsure.io
                      Approved Q1 settlement after reconciliation review
2026-04-29 10:22:55 | [Calculation]   | Manual Override               | CALC-2026-Q1-918     | ● Human k.tanaka@reinsure.io
                      Override mortality improvement scaling factor for 2026 cohort
2026-04-29 09:58:14 | [Contract]      | Contract Amendment            | LSC-2024-018         | ● Human s.fernandez@reinsure.io
                      Floating leg benchmark changed from LIBOR-fallback to SOFR + 38bps
2026-04-29 09:14:33 | [Contract]      | Contract Created              | LSC-2026-022         | ● Human s.fernandez@reinsure.io
                      Created longevity swap contract — 12,840 lives, GBP 1.42B notional
2026-04-29 08:42:18 | [Reference Data]| Reference Data Update         | GBP-NOMINAL-2026Q2   | ● System system
                      Daily GBP nominal curve refresh from BoE feed
```

---

## RISK & GOVERNANCE: Approval Audit

**Header:** "Approval Audit · 7 events" + [↓ Export]

Same table structure as Financial Impact. Same seed data rows (same audit events cross-referenced).

---

## RISK & GOVERNANCE: AI Decision Audit

**KPI chips (3):**
| AI decisions logged | Below confidence floor | Human overrides |
|---|---|---|
| 3 (last 30d) | 1 (< 0.90 → manual review, red) | 0 (reasons captured) |

**AI decision audit · explainability log (list of AI decision cards):**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🤖 Cession Mapper v3.2.1    [Cession]    [confidence 0.81]    2026-04-29 10:48:09 │
│ Map 'Pensioner_Ref' → member_id; flag 'Annuity_Type_Code' & 'Spouse_Indicator'    │
│ for human confirmation                                                          │
│                                                                                 │
│ Prompt: Map columns of incoming cession file to      Input ref: sftp://atlas/in/   │
│ canonical schema using historical patterns for                CES-2026-04-118.xlsx │
│ cedant {cedant_id}.                                                             │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ 🤖 Sanctions Screener v2.4.0 [Compliance] [confidence 0.99]  2026-04-29 09:27:14 │
│ Clear — no matches above threshold                                              │
│                                                                                 │
│ Prompt: Screen entity '{cedant_name}' against       Input ref: ced:CED-1133     │
│ OFAC SDN, FinCEN 311 with fuzzy match threshold 0.85                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## RISK & GOVERNANCE: Manual Overrides

**Warning banner (amber):**  
"⚠ Mandatory override controls — No override is permitted without a captured reason and a recorded approver. All overrides feed the regulatory exception report."

**Header:** "Manual overrides · 1 captured"

**Override card:**
```
Manual Override · CALC-2026-Q1-918                              2026-04-29 10:22:55

┌────────────────────┐  ┌────────────────────┐  ┌──────────────────────────────┐
│ Original           │  │ Override           │  │ Approver                     │
│ 1.25               │  │ 1.18               │  │ j.morales@reinsure.io        │
└────────────────────┘  └────────────────────┘  │ Chief Actuary                │
                                                 └──────────────────────────────┘

Reason: CMI 2024 release expected within 7d; using interim calibrated value to avoid stale assumption.
[Financial impact -GBP 3.18M]  ← red badge
```

---

## DATA & ACCESS: Reference Data Audit

**Header:** "Reference Data Audit · 1 events" + [↓ Export]

Columns: Timestamp | Module | Event | Entity | Actor | Channel

```
2026-04-29 08:42:18 | [Reference Data] | Reference Data Update | GBP-NOMINAL-2026Q2 | ● System system.market-data-feed | Batch
                      Daily GBP nominal curve refresh from BoE feed
```

---

## DATA & ACCESS: Access Logs

**Header:** "Access Logs · 3 events" + [↓ Export]

Columns: Timestamp | Module | Event | Entity | Actor

```
2026-04-29 07:55:21 | [Access] | Sensitive Export     | RPT-FIN-IMPACT-Q1-2026 | ● Human a.lindqvist@reinsure.io
                      Downloaded financial impact report (Q1 2026, all cedants)

2026-04-28 16:08:11 | [Access] | Permission Change    | USR-00284              | ● Human p.okafor@reinsure.io
                      Granted Compliance Officer role to k.tanaka@reinsure.io

2026-04-28 11:14:02 | [Access] | Failed Login         | sess_failed_44a        | ● System unknown@external
                      Failed login attempt (3rd in 5 min) — account locked
```

---

## DATA & ACCESS: Document History

**Header:** "Document History · 5 events" + [↓ Export]

```
2026-04-29 11:11:42 | [Settlement] | Settlement Approved      | STL-2026-Q1-184 | ● Human d.rhodes@reinsure.io
                      Approved Q1 settlement after reconciliation review

2026-04-29 10:22:55 | [Calculation]| Manual Override          | CALC-2026-Q1-918| ● Human k.tanaka@reinsure.io
                      Override mortality improvement scaling factor for 2026 cohort

2026-04-29 09:58:14 | [Contract]   | Contract Amendment       | LSC-2024-018    | ● Human s.fernandez@reinsure.io
                      Floating leg benchmark changed from LIBOR-fallback to SOFR + 38bps

2026-04-29 09:14:33 | [Contract]   | Contract Created         | LSC-2026-022    | ● Human s.fernandez@reinsure.io
                      Created longevity swap contract — 12,840 lives, GBP 1.42B notional

2026-04-28 10:01:45 | [Document]   | Document Upload          | DOC-99102       | ● Human s.fernandez@reinsure.io
                      Uploaded executed amendment AMD-2026-014
```

---

## REPORTING: Export Audit Reports

**Section header:** "Downloadable audit reports"

6 report rows, each with [↓ CSV] [↓ JSON] buttons:

| Report | Description |
|--------|-------------|
| Audit Report | Full audit log with filters applied. |
| Regulatory Review Report | Quarterly review pack for PRA / EIOPA / NAIC. |
| Compliance Report | Sanctions screenings, hits, escalations & sign-offs. |
| Override Exception Report | All manual overrides with reasons & approvers. |
| AI Governance Report | AI decisions, confidence & override rates. |
| Financial Impact Report | All events with financial impact, signed and netted. |

**Export logic (mock):** Clicking CSV or JSON triggers a download of pre-generated static files. No real export engine for POC.
