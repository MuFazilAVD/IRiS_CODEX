# IRiS — Dashboard Page (4 Role Views)

**Route:** `/dashboard`  
**File:** `src/pages/dashboard/DashboardPage.tsx`  
**Auth:** All authenticated roles

Renders role-specific content. `super_admin` uses role dropdown to switch view.

---

## Shared Structure (All Roles)

```
[PageHeader — role-specific title + quick action buttons]
[IRiS Insight Banner]
[KPI Grid — 2 rows × 4 cols = 8 cards]
[Graphs Row — 3 columns]
[Recent Activities / Intelligence section]
```

Data sources:
- KPIs: `GET /api/v1/dashboard/kpis` → role from JWT
- Intelligence: `GET /api/v1/dashboard/intelligence`
- Graphs: `GET /api/v1/dashboard/graphs`
- Recent Activities (admin only): `GET /api/v1/dashboard/recent-activities`

---

## 1. ADMIN VIEW — "Admin Command Center"

### Quick Actions Row
```
[Assign Role] [Approve Ref Data] [Failed Integration] [+ Create User ●] [Review Access Change ●]
```
(● = primary dark button style)

### IRiS Insight Banner
> "Atlas SFTP integration degraded (last 2 cycles). 4 user provisioning requests pending; 2 require elevated entitlement review."

### KPI Grid (8 cards)
| Label | Value | Trend | Border | Subtitle |
|-------|-------|-------|--------|----------|
| Active Users | 184 | up ↗ | green | +12 MTD |
| Pending User Approval | 4 | neutral — | amber | 2 elevated |
| Role Change Requests | 6 | neutral — | blue | Awaiting |
| Access Violations (24h) | 2 | up ↗ | red | Investigating |
| Failed Logins (24h) | 37 | up ↗ | red | 5 IPs flagged |
| Privileged Access Reviews | 3 | neutral — | blue | Quarterly cycle |
| Workflow Failures | 1 | neutral — | amber | Settlement post |
| Batch Job Failures | 2 | neutral — | amber | Last 24h |

Second row:
| Ref Data Updates Pending | 5 | — | amber | Mortality, Curves |
| Integration Health | 9/10 | — | green | 1 degraded |
| SFTP Failures (24h) | 1 | — | red | Atlas endpoint |
| API Failure Alerts | 0 | — | green | All healthy |
| System Performance | Nominal | — | green | p95 < 800ms |
| Pending Admin Approvals | 8 | — | blue | Cross-team |

### Graphs Row (3 columns)
1. **User Role Distribution** — Donut chart
   - Data: Underwriting 35%, Claims Ops 40%, Compliance 15%, Admin 5%, Read-only 5%
   - Colors: `#0D1B2A`, `#00BCD4`, `#F39C12`, `#2ECC71`, `#90A4AE`

2. **Access Audit Trend (7d)** — Dual line chart
   - X: Mon–Sun
   - Left Y: events count (0–2200), line navy
   - Right Y: alerts count (0–8), line red
   - Data: events [550, 1650, 1650, 1650, 2200, 1100, 0], alerts [2, 4, 5, 7, 6, 2, 0]

3. **Batch Job Trend** — Bar chart (Mon–Sun)
   - Success bars (green): [130, 125, 135, 138, 150, 82, 80]
   - Failed bars (red): [5, 8, 10, 3, 0, 2, 1]

### Below Graphs
- **Integration Health panel** (left 2/3): Grid of integrations with status badges. See mock data.
- **Pending Admin Approvals panel** (right 1/3): List of REQ-XXXX items with Pending badges.

### Recent Activities Section
Tabbed: **Team Activities (7)** | **IRiS AI (6)** | **Escalations (3)**  
Filter pills: All / FYA / FYI | All processes dropdown | All people dropdown  
Activity feed items: see `GET /api/v1/dashboard/recent-activities` response format.

---

## 2. UNDERWRITING VIEW — "Underwriting Command Center"

### Quick Actions
```
[Upload Population] [Review Amendment] [Run Experience Analysis] [+ New Cedant ●] [+ New Contract ●]
```

### IRiS Insight Banner
> "Mortality experience exceeds assumption by 1.18% across 5 contracts. Largest impact on LSC-2024-019 (+£1.2M)."

### KPI Grid
| Label | Value | Trend | Border |
|-------|-------|-------|--------|
| Active Cedants | 42 | up ↗ | green |
| Active Contracts | 47 | up ↗ | green |
| Pending Approval | 5 | neutral | amber |
| Total Covered Lives | 612,840 | up ↗ | teal |
| Mortality Deviation | +1.18% | up ↗ | red |
| Exposure at Risk | $24.8B | up ↗ | blue |
| Near Renewal (90d) | 4 | neutral | amber |

### Graphs Row
1. **Exposure by Cedant** — Horizontal bar chart (USD bn)
   - Labels: Northstar, Helvetia, Bavarian, Maple
   - Values: [4.2, 3.1, 2.8, 1.9]

2. **Mortality — Expected vs Actual** — Line chart
   - Expected (dashed grey): [0.92, 0.92, 0.92, 0.92, 0.92]
   - Actual (red): [0.95, 0.98, 1.02, 1.10, 1.20]
   - X: Q1 2024 → Q1 2025

3. **Contract Status Distribution** — Donut
   - Active: 38, Draft: 4, Suspended: 2, Run-off: 3

### Intelligence Feed
Same cards as intelligence API, filtered to underwriting items.

---

## 3. CLAIMS OPS VIEW — "Claims Ops Command Center"

### Quick Actions
```
[Reprocess File] [Trigger Reconciliation] [Exception Report] [Review Failed File ●] [Settlement Exceptions ●]
```

### IRiS Insight Banner
> "3 cession files have validation errors. Atlas SFTP endpoint degraded; 2 files queued for retry."

### KPI Grid
| Label | Value | Trend | Border |
|-------|-------|-------|--------|
| Files Received Today | 24 | up ↗ | green |
| Files Pending | 12 | neutral | amber |
| Failed Validations | 3 | up ↗ | red |
| Mapping Exceptions | 18 | neutral | amber |
| Settlement Pending | 8 | neutral | blue |
| Reconciliation Breaks | 11 | up ↗ | red |
| Batch Success Rate | 97.4% | neutral | teal |

### Graphs Row
1. **File Processing Pipeline** — Bar chart showing files at each stage
2. **Reconciliation Exception Trend** — Line chart (6 weeks)
3. **Settlement Approval Status** — Donut chart

---

## 4. COMPLIANCE VIEW — "Compliance Command Center"

### Quick Actions
```
[Investigate Audit Exception] [Review Access Alert] [Trigger Manual Screening] [Review Screening Hit ●] [Approve Override ●]
```

### IRiS Insight Banner
> "OFAC SDN match (0.88 confidence) on PEN-0104012 escalated. 3 overrides > $1M await Risk Committee approval."

### KPI Grid (14 cards, 2 rows of 7)
Row 1:
| Monthly Screening Pending | 9 | — | blue | Cycle Apr-25 |
| OFAC Matches | 4 | up | red | 1 escalated |
| FinCEN Matches | 2 | — | amber | analyst review |
| False Positives Pending | 11 | — | blue | Awaiting closure |
| Overrides Awaiting Approval | 3 | up | red | 2 > $1M impact |
| High Impact Changes | 5 | — | amber | Req. 4-eyes |
| Audit Exceptions Open | 7 | up | red | 2 SLA breach |

Row 2:
| Sensitive Export Alerts | 4 | — | amber | Last 7d |
| Access Violations | 1 | — | red | u-205 locked |
| Ref Data Changes | 3 | — | blue | Mortality, FX |
| Compliance Holds Active | 2 | — | red | Atlas, Markov |
| Escalated Tasks | 4 | up | red | Risk Committee |
| Contracts Under Review | 2 | — | amber | LSC-2025-007 |
| Screening Coverage | 98.7% | — | green | Compliant |

### Graphs Row
1. **Screening Status by Cedant** — Bar chart
2. **Override Trend (6m)** — Line chart
3. **Compliance Holds Summary** — Grouped bar (Sanctions, AML, PEP)

---

## Loading State
Show skeleton cards (grey animated shimmer) while KPIs are loading.  
Graph placeholders: grey rectangle same size as chart.

## Error State
Toast notification: "Failed to load dashboard data. Retrying..." with retry button.

## Refresh
Auto-refresh KPIs every 60 seconds (configurable). Show last-refreshed timestamp top-right of KPI section.
