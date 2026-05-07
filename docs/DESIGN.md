# IRiS — Global Design System

## Brand Identity
- **Product Name:** IRiS (Intelligent Reinsurance System)
- **Parent Brand:** MetLife
- **Logo:** MetLife logo (top-left) + vertical divider + "IRiS" bold + "(Intelligent Reinsurance System)" in smaller text
- **Environment Banner:** "Production · EU-WEST-2 · SOC 2 Type II" (top center, muted text)

---

## Color Palette

```css
/* === PRIMARY PALETTE === */
--iris-navy:       #0D1B2A;   /* Sidebar background, primary dark surfaces */
--iris-navy-light: #112233;   /* Sidebar hover, secondary dark surfaces */
--iris-blue:       #1A6B9A;   /* Primary action buttons, links, active nav */
--iris-blue-light: #2980B9;   /* Button hover state */
--iris-white:      #FFFFFF;   /* Main content background, cards */
--iris-bg:         #F5F7FA;   /* Page background (light grey) */

/* === ACCENT / STATUS === */
--iris-teal:       #00BCD4;   /* IRiS AI / chatbot accent, STP%, positive trend */
--iris-green:      #2ECC71;   /* Success, Active status, Cleared screening */
--iris-green-dark: #27AE60;   /* Green hover */
--iris-amber:      #F39C12;   /* Warning, Pending, Medium priority */
--iris-orange:     #E67E22;   /* High priority, SLA approaching */
--iris-red:        #E74C3C;   /* Critical, Failed, Error, Breach */
--iris-purple:     #8E44AD;   /* Compliance holds, special flags */

/* === NEUTRAL === */
--iris-text-primary:   #1A2332;  /* Main body text */
--iris-text-secondary: #546E7A;  /* Subtitles, labels */
--iris-text-muted:     #90A4AE;  /* Timestamps, metadata */
--iris-border:         #E1E8ED;  /* Card borders, table borders */
--iris-border-dark:    #B0BEC5;  /* Input borders */
--iris-surface:        #FAFBFC;  /* Subtle surface variation */

/* === KPI CARD ACCENTS (left border colors) === */
--kpi-green:  #2ECC71;
--kpi-amber:  #F39C12;
--kpi-red:    #E74C3C;
--kpi-blue:   #3498DB;
--kpi-teal:   #00BCD4;
```

### Tailwind Config Extension
```js
// tailwind.config.js
colors: {
  iris: {
    navy:      '#0D1B2A',
    navyLight: '#112233',
    blue:      '#1A6B9A',
    blueLight: '#2980B9',
    teal:      '#00BCD4',
    green:     '#2ECC71',
    amber:     '#F39C12',
    orange:    '#E67E22',
    red:       '#E74C3C',
    purple:    '#8E44AD',
  }
}
```

---

## Typography

```css
/* === FONT FAMILY === */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
/* Import: @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'); */

/* === SCALE === */
--text-xs:   11px / 16px  /* Timestamps, metadata, badges */
--text-sm:   12px / 18px  /* Table cells, secondary labels */
--text-base: 13px / 20px  /* Body text, form labels */
--text-md:   14px / 22px  /* Nav items, card text */
--text-lg:   16px / 24px  /* Section titles, card headers */
--text-xl:   18px / 28px  /* Page subtitles */
--text-2xl:  22px / 32px  /* Page titles (e.g. "Cedants") */
--text-3xl:  28px / 38px  /* Dashboard titles (e.g. "Admin Command Center") */
--text-kpi:  32px / 40px  /* KPI numbers (e.g. "184", "47") */

/* === WEIGHT === */
300 → light (subtitle text)
400 → regular (body)
500 → medium (labels, nav)
600 → semibold (card titles, section headers)
700 → bold (page titles, KPI numbers)
```

---

## Layout

### App Shell
```
┌─────────────────────────────────────────────────────────────┐
│ TOPBAR (56px height, white, border-bottom: 1px #E1E8ED)     │
│  [Environment pill]        [Role dropdown]  [User avatar]   │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│  SIDEBAR     │   MAIN CONTENT AREA                         │
│  240px wide  │   padding: 32px 40px                        │
│  bg: #0D1B2A │   background: #F5F7FA                       │
│  fixed left  │   overflow-y: auto                          │
│              │                                              │
│  [Logo]      │                                              │
│  [Nav items] │                                              │
│  [Collapse]  │                                              │
│  [Version]   │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

### Sidebar Specs
- Width: 240px (collapsed: 64px)
- Background: `#0D1B2A`
- Logo area: 72px height, padding 16px
- Section label: `11px / ALL CAPS / color: #546E7A / padding: 20px 16px 6px`
- Nav item: `14px / weight 500 / color: #90A4AE / padding: 10px 16px / border-radius 6px`
- Nav item (active): `color: white / background: rgba(26,107,154,0.4) / border-left: 3px solid #00BCD4`
- Nav item (hover): `color: white / background: rgba(255,255,255,0.08)`
- Version text: `10px / color: #546E7A / bottom 16px`

### Topbar Specs
- Height: 56px
- Background: white
- Border-bottom: `1px solid #E1E8ED`
- Environment pill: `"Production · EU-WEST-2 · SOC 2 Type II"` — `12px / color: #546E7A`
- Role dropdown: `border: 1px solid #E1E8ED / border-radius 6px / 13px`
- User avatar: 32px circle, initials, background `#1A6B9A`, white text

---

## Component Specs

### KPI Card
```
┌─────────────────────────────┐
│ [left border 3px colored]   │
│ Label text (13px muted)     │
│                    [trend ↗]│
│ VALUE (32px bold)           │
│ Subtitle (12px muted)       │
└─────────────────────────────┘
- background: white
- border: 1px solid #E1E8ED
- border-radius: 8px
- padding: 16px 20px
- min-height: 100px
- left border colors: green=good, amber=warning, red=critical, blue=neutral, teal=AI
- trend arrows: ↗ green, ↘ red, — grey
```

### Status Badge
```css
/* Base */
.badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; }

/* Variants */
.badge-active      { background: #D5F5E3; color: #1E8449; }
.badge-inactive    { background: #F2F3F4; color: #717D7E; }
.badge-onboarding  { background: #D6EAF8; color: #1A5276; }
.badge-cleared     { background: #D5F5E3; color: #1E8449; border: 1px solid #82E0AA; }
.badge-pending     { background: #FEF9E7; color: #9A7D0A; border: 1px solid #F9E79F; }
.badge-review      { background: #FDEDEC; color: #922B21; border: 1px solid #F1948A; }
.badge-critical    { background: #FDEDEC; color: #922B21; }
.badge-high        { background: #FEF5E7; color: #784212; }
.badge-medium      { background: #FEF9E7; color: #7D6608; }
.badge-low         { background: #EBF5FB; color: #1A5276; }
```

### Data Table
```
- Header: background #F8F9FA / font-size 12px / weight 600 / color #546E7A / ALL CAPS
- Row: height 48px / font-size 13px / border-bottom 1px #F0F2F5
- Row hover: background #F8F9FA
- Sticky header: yes
- Pagination: show count "X of Y" top-right
```

### Page Header
```
[breadcrumb path]
[Page Title H1 — 28px bold]           [Primary CTA Button]
[Subtitle — 13px muted]
[IRiS Insight banner — if applicable]
```

### IRiS Insight Banner
```
Background: #EBF5FB (light blue)
Border: 1px solid #AED6F1
Icon: ✦ (star/sparkle) in #1A6B9A
Text: "IRiS Insight · [message]"  13px
Right: "Review →" link
```

### Primary Button
```css
background: #0D1B2A;  /* Dark navy */
color: white;
padding: 8px 16px;
border-radius: 6px;
font-size: 13px;
font-weight: 600;
hover: background #1A6B9A;
```

### Secondary Button (outline)
```css
background: white;
border: 1px solid #E1E8ED;
color: #1A2332;
padding: 8px 16px;
border-radius: 6px;
font-size: 13px;
hover: background #F5F7FA;
```

### Section Panel (contract/cedent detail)
```
Left sidebar: 200px / white / border-right 1px #E1E8ED
  - "Sections" label + collapse arrow
  - Group labels: "Master Data", "Operations"
  - Items: 13px / numbered (01, 02...) / active: bold + left border #00BCD4
Right content: flex-1 / padding 32px / background white
```

### Worklist Card
```
background: white
border: 1px solid #E1E8ED
border-left: 4px solid [priority color]
border-radius: 8px
padding: 16px 20px

Priority badge top-left
↗ expand icon top-right
Title: 15px bold
WL-XXXX · Category: 12px mono muted
Time elapsed pill (amber if approaching, red if overdue)
Source pill (AI Agent / System Rule / Human)
Footer: category path
```

### Modal / Wizard
```
Overlay: rgba(0,0,0,0.4)
Panel: white / border-radius 12px / max-width 900px / max-height 90vh
Header: padding 24px / border-bottom 1px #E1E8ED
  - Title (18px bold) + subtitle (12px muted) + X close
Left step nav: 200px / steps numbered, active = teal circle
Right content: flex-1 / padding 32px / scrollable
Footer: border-top / Back + Next/Continue buttons
```

### Pipeline Step Bar (Cession File Processing)
```
Horizontal stepper across top of modal
Steps: Upload → Detect → Map Contract → Clauses → Validate → Exceptions → Process → Summary → Worklist → Audit
Active step: filled teal circle + bold text
Completed: teal outline circle + checkmark
Upcoming: grey circle + grey text
Connecting line: thin grey, teal when completed
```

### Form Fields
```css
input, select {
  border: 1px solid #E1E8ED;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  color: #1A2332;
  background: white;
}
input:focus { border-color: #1A6B9A; outline: none; box-shadow: 0 0 0 2px rgba(26,107,154,0.15); }
label { font-size: 12px; font-weight: 500; color: #546E7A; margin-bottom: 4px; }
```

### IRiS Chatbot (Floating)
```
Trigger button: fixed bottom-right / 52px circle / background #0D1B2A / ✦ icon white
Drawer: fixed right 0 / width 380px / height 100vh / white / shadow-lg
Header: "IRiS Assistant" + role context + close button
Message bubbles: user=right/navy, assistant=left/light grey
Input: bottom / text field + send button
```

---

## Spacing Scale
```
4px   (xs)   — tight inline spacing
8px   (sm)   — within components
12px  (md)   — between related elements
16px  (lg)   — standard padding
20px  (xl)   — card padding
24px  (2xl)  — section gaps
32px  (3xl)  — page padding
40px  (4xl)  — large section spacing
```

---

## Graph / Chart Specs

### Colors for Charts
```
Series 1 (primary):   #0D1B2A (navy)
Series 2 (secondary): #1A6B9A (blue)
Series 3 (tertiary):  #00BCD4 (teal)
Series 4 (highlight): #E74C3C (red — alerts)
Series 5:             #F39C12 (amber)
Series 6:             #2ECC71 (green)
```

### Donut/Pie Charts
- Background slice color: `#F0F2F5`
- Legend: below chart, horizontal, 12px text
- Center label: none (clean donut)

### Line Charts
- Grid lines: `#F0F2F5`
- Axes: `12px / #90A4AE`
- Tooltip: white card with border, 12px

### Bar Charts
- Default bar fill: `#0D1B2A`
- Success bars: `#2ECC71`
- Failed bars: `#E74C3C`
- Gap between bars: 4px

---

## Iconography
Use **Lucide React** icons throughout. Key icon mappings:
```
Dashboard:      LayoutDashboard
Worklist:       ListTodo
Cedants:        Building2
Contracts:      FileText
Population:     Users
Cession Files:  FolderOpen
Settlements:    DollarSign
Calc Engine:    Calculator
Sanctions:      Shield
Admin:          Settings
Chatbot:        Sparkles
Upload:         Upload
Alert/Critical: AlertTriangle
Success:        CheckCircle
Info:           Info
Filter:         Filter
Search:         Search
Edit:           Pencil
View:           Eye
Expand:         ArrowUpRight
Back:           ArrowLeft
```

---

## Responsive Breakpoints
POC is **desktop-first** (1280px+). Minimum supported width: 1024px.
Mobile is out of scope for POC.
