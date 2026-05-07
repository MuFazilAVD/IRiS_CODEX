# IRiS — Global Layout & Shared Components

## AppShell
Wraps every authenticated page. Renders:
1. `<Sidebar />` — fixed left, 240px
2. `<Topbar />` — fixed top, full width minus sidebar
3. `<main>` — content area, `margin-left: 240px; margin-top: 56px; background: #F5F7FA; min-height: calc(100vh - 56px); padding: 32px 40px;`
4. `<IRiSChatbot />` — fixed bottom-right floating button

---

## Sidebar Component

```
┌──────────────────────┐
│ [MetLife logo] IRiS  │  ← 72px height, padding 16px
│ (Intelligent         │
│  Reinsurance System) │
├──────────────────────┤
│ Operations           │  ← section label
│   🏠 Dashboard       │  ← nav item
│   ☰  Worklist        │
├──────────────────────┤
│ Underwriting         │  ← only if role: underwriter|super_admin
│   🏢 Cedants         │
│   📄 Contracts       │
│   👥 Population      │
├──────────────────────┤
│ Claims & Settlement  │  ← only if role: claims_ops|super_admin
│   📁 Cession Files   │
│   💰 Settlements     │
│   🔢 Calc Engine     │
├──────────────────────┤
│ Compliance & Audit   │  ← only if role: compliance|super_admin
│   🛡  Sanctions      │
├──────────────────────┤
│ [⊡ Collapse menu]    │  ← bottom
│ IRiS v2025.04.29     │
│ Build 4182           │
└──────────────────────┘
```

**Behavior:**
- Active item: `bg-iris-navyLight border-l-2 border-iris-teal text-white`
- Hover: `bg-white/8 text-white`
- Collapse: hides labels, shows only icons (64px width)
- Role-based section visibility enforced via `useAuth()` hook

---

## Topbar Component

```
┌─────────────────────────────────────────────────────────────────────┐
│ Production · EU-WEST-2 · SOC 2 Type II          [Role ▾]  [A Admin▾]│
└─────────────────────────────────────────────────────────────────────┘
```

**Elements:**
- Left: Environment string `text-xs text-iris-textSecondary`
- Right: Role dropdown + User avatar dropdown
- **Role Dropdown** (super_admin only): `<select>` with options [Admin, Underwriting, Claims Ops, Compliance]. Switching role re-renders dashboard and nav sections.
- **User Dropdown**: Shows full name + role subtitle. Options: Profile, Logout.

---

## Breadcrumb Component
```tsx
<Breadcrumb items={["Home", "Underwriting", "Cedants", "CED-1042", "Legal Entity"]} />
```
Renders: `Home › Underwriting › Cedants › CED-1042 › Legal Entity`  
Style: `12px / text-iris-textMuted / separator: ›`  
Last item: `text-iris-textPrimary font-medium`

---

## PageHeader Component
```tsx
<PageHeader
  title="Cedants"
  subtitle="Counterparties ceding longevity risk to the platform"
  action={<Button>+ New Cedant</Button>}
  insight="Mortality experience exceeds assumption by 1.18%..."  // optional
/>
```

---

## KPICard Component
```tsx
<KPICard
  label="Active Cedants"
  value="42"
  trend="up"          // up | down | neutral
  trendValue="+2 QTD"
  subtitle="Pension schemes currently ceding..."
  borderColor="green" // green | amber | red | blue | teal
/>
```

**Layout:**
```
┌─[green border]──────────────────────────┐
│ Active Cedants              ↗           │
│ 42                                      │
│ +2 QTD                                  │
│ Pension schemes currently ceding...     │
└─────────────────────────────────────────┘
```

---

## StatusBadge Component
```tsx
<StatusBadge status="active" />      // → green "Active"
<StatusBadge status="cleared" />     // → green "Cleared"
<StatusBadge status="pending" />     // → amber "Pending"
<StatusBadge status="review" />      // → red "Review"
<StatusBadge status="critical" />    // → red "Critical"
<StatusBadge status="high" />        // → amber "High"
<StatusBadge status="onboarding" />  // → blue "Onboarding"
<StatusBadge status="inactive" />    // → grey "Inactive"
```

---

## DataTable Component
```tsx
<DataTable
  columns={[
    { key: "cedent_id", label: "ID", width: 100 },
    { key: "name", label: "Name", render: (v, row) => <Link>{v}</Link> },
    { key: "status", label: "Status", render: (v) => <StatusBadge status={v} /> }
  ]}
  data={items}
  onRowClick={(row) => navigate(`/cedants/${row.cedent_id}`)}
  loading={isLoading}
  emptyMessage="No cedants found"
/>
```

---

## IRiSInsightBanner Component
```tsx
<IRiSInsightBanner
  message="Mortality experience exceeds assumption by 1.18% across 5 contracts."
  link={{ label: "Review", href: "/contracts?filter=mortality" }}
/>
```

Style: light blue background `#EBF5FB`, border `#AED6F1`, sparkle icon, `text-sm`

---

## IRiSChatbot Component (Floating)

**Trigger:** Fixed circle button, bottom-right: `bottom: 24px; right: 24px; width: 52px; height: 52px; border-radius: 50%; background: #0D1B2A;` — contains `✦` sparkle icon in teal.

**Drawer state (open):**
- Slides in from right
- Width 380px, full viewport height
- Header: "IRiS Assistant" + current role chip + X close
- Conversation area: scrollable, messages with user/assistant bubbles
- Input: fixed bottom, text field + send button
- Empty state: "Ask me anything about your contracts, settlements, or cedants."

**API call:** POST `/api/v1/chatbot/message` on send.

**Navigation support:** If response contains `[NAV: /path]`, show a clickable "Go to →" chip in the response bubble that triggers `navigate(path)`.

---

## SectionPanel Component (for detail pages)

Used in Cedant Detail and Contract Detail pages.

```
┌──────────────────────────────────────────────────────────────┐
│ [Sections ◄]  │  [Tab Content Area]                         │
│               │                                              │
│ Master Data   │  Section Title                    [Edit]    │
│  01 Legal...  │                                              │
│  02 Pension.. │  ┌──────────────────────────────────────┐   │
│  03 Key Cont  │  │ Sub-section heading                  │   │
│  ...          │  │ Field grid (3 columns)               │   │
│               │  └──────────────────────────────────────┘   │
│ Operations    │                                              │
│  A  Details   │                                              │
│  B  Members   │                                              │
│  C  Templates │                                              │
└───────────────┴──────────────────────────────────────────────┘
```

Left panel: `200px / white / border-right 1px #E1E8ED`  
Active item: `font-weight: 600 / border-left: 3px solid #00BCD4 / color: #0D1B2A`  
Right panel: `flex-1 / padding: 32px / overflow-y: auto`

---

## FieldGrid Component
For form display in read-only and edit modes.
```tsx
<FieldGrid cols={3}>
  <Field label="Cedant ID" value="CED-1042" />
  <Field label="Legal Entity Name" value="Northstar Pension Trust" required />
  <Field label="Trading Name" value="" />
</FieldGrid>
```

Read mode: label (12px muted) + value (13px) in bordered input-style container  
Edit mode: actual `<input>` fields

---

## PipelineStepBar Component
Used in cession file processing modal.

```
Upload ✓ → Detect ✓ → Map Contract ✓ → Clauses ✓ → [Validate] → Exceptions → Process → Summary → Worklist → Audit
```

Props: `steps: string[], currentStep: number, completedSteps: number[]`  
Completed: teal circle + checkmark  
Active: filled teal circle + bold text + pulsing  
Upcoming: grey circle + grey text  
Line between: grey (incomplete) → teal (complete)
