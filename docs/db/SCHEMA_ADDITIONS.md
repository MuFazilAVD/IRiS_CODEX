# IRiS — DB Schema Additions
## APPENDS TO: db/SCHEMA.md

Add these tables to the existing schema. Table numbering continues from 31.

---

## 32. audit_events
```sql
-- Central immutable audit log for all platform actions
CREATE TABLE audit_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id        VARCHAR(50) UNIQUE NOT NULL, -- e.g. AUD-2026-04-29-001
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  module          VARCHAR(50) NOT NULL CHECK (module IN (
                    'settlement','cession','contract','calculation',
                    'reference_data','access','compliance','population','admin')),
  event_type      VARCHAR(100) NOT NULL, -- 'Settlement Approved','AI Recommendation','Manual Override', etc.
  actor_type      VARCHAR(20) NOT NULL CHECK (actor_type IN ('human','ai','system')),
  actor_id        VARCHAR(200),          -- user email or 'system' or 'agent.cession-mapper-v3.2.1'
  entity_id       VARCHAR(100),          -- e.g. STL-2026-Q1-184, LSC-2024-019
  entity_type     VARCHAR(50),           -- 'settlement','contract','cession_file', etc.
  description     TEXT NOT NULL,
  financial_impact_amount DECIMAL(18,2),
  financial_impact_currency VARCHAR(10),
  is_high_impact  BOOLEAN DEFAULT false, -- true if |financial_impact| >= 1M in base currency
  approval_status VARCHAR(20) DEFAULT 'n/a' CHECK (approval_status IN ('n/a','pending','approved','rejected')),
  is_sensitive    BOOLEAN DEFAULT false,
  contract_id     VARCHAR(30) REFERENCES contracts(contract_id),
  cedent_id       VARCHAR(20) REFERENCES cedents(cedent_id),
  cession_file_id UUID REFERENCES cession_files(id),
  settlement_id   VARCHAR(30),
  ip_address      VARCHAR(50),
  session_id      VARCHAR(100),
  created_at      TIMESTAMPTZ DEFAULT NOW()
  -- Immutable: no UPDATE or DELETE allowed on this table
);
CREATE INDEX idx_ae_timestamp ON audit_events(timestamp DESC);
CREATE INDEX idx_ae_module ON audit_events(module, timestamp DESC);
CREATE INDEX idx_ae_actor ON audit_events(actor_id, timestamp DESC);
CREATE INDEX idx_ae_entity ON audit_events(entity_id, timestamp DESC);
CREATE INDEX idx_ae_financial ON audit_events(is_high_impact, timestamp DESC);
```

## 33. ai_decision_log
```sql
-- Tracks every AI agent call with prompt, confidence, and outcome
CREATE TABLE ai_decision_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_event_id  UUID REFERENCES audit_events(id),
  agent_name      VARCHAR(100) NOT NULL,  -- 'Cession Mapper v3.2.1'
  agent_version   VARCHAR(20),
  module          VARCHAR(50),
  decision        TEXT NOT NULL,           -- what the AI decided/recommended
  confidence      DECIMAL(5,4) NOT NULL,   -- 0.0 to 1.0
  below_threshold BOOLEAN DEFAULT false,   -- true if confidence < 0.90
  prompt_summary  TEXT,                    -- truncated prompt sent
  input_ref       VARCHAR(200),            -- e.g. sftp://atlas/in/CES-2026-04-118.xlsx
  human_review_required BOOLEAN DEFAULT false,
  human_reviewer  UUID REFERENCES users(id),
  human_outcome   VARCHAR(50),             -- 'approved','rejected','overridden'
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

## 34. manual_overrides
```sql
-- Every human override of an AI or system value, with mandatory reason
CREATE TABLE manual_overrides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  override_ref    VARCHAR(50) UNIQUE NOT NULL, -- e.g. CALC-2026-Q1-918
  audit_event_id  UUID REFERENCES audit_events(id),
  module          VARCHAR(50) NOT NULL,
  entity_id       VARCHAR(100) NOT NULL,
  field_name      VARCHAR(100) NOT NULL,
  original_value  VARCHAR(500),
  override_value  VARCHAR(500),
  reason          TEXT NOT NULL,
  financial_impact_amount DECIMAL(18,2),
  financial_impact_currency VARCHAR(10),
  approver_id     UUID REFERENCES users(id),
  approver_role   VARCHAR(50),
  approver_title  VARCHAR(100),          -- e.g. 'Chief Actuary'
  approved_at     TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

## 35. screening_events
```sql
-- All sanctions screening runs (pipeline + cedant + ad-hoc)
CREATE TABLE screening_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screening_ref   VARCHAR(50) UNIQUE NOT NULL, -- e.g. SHM-887
  trigger_type    VARCHAR(50) NOT NULL CHECK (trigger_type IN (
                    'cedant_onboarding','pipeline','periodic','adhoc')),
  entity_name     VARCHAR(300) NOT NULL,
  entity_type     VARCHAR(50),            -- 'individual','organisation','cedant'
  cedent_id       VARCHAR(20) REFERENCES cedents(cedent_id),
  contract_id     VARCHAR(30) REFERENCES contracts(contract_id),
  cession_file_id UUID REFERENCES cession_files(id),
  member_id       VARCHAR(50),
  -- Step 1: keyword match
  keyword_match   BOOLEAN DEFAULT false,
  matched_lists   TEXT[],                 -- e.g. ['OFAC SDN','FinCEN 314(a)']
  -- Step 2: LLM verification (if keyword_match=true)
  llm_called      BOOLEAN DEFAULT false,
  llm_confidence  DECIMAL(5,4),
  llm_reasoning   TEXT,
  llm_is_genuine  BOOLEAN,               -- null if llm not called
  -- Outcome
  result          VARCHAR(30) NOT NULL DEFAULT 'pending'
                  CHECK (result IN ('cleared','review','escalated','false_positive','pending')),
  -- Manual review (if result='review' or 'escalated')
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  review_outcome  VARCHAR(30) CHECK (review_outcome IN ('cleared','escalated','false_positive')),
  review_notes    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_se_cedent ON screening_events(cedent_id, created_at DESC);
CREATE INDEX idx_se_result ON screening_events(result, created_at DESC);
```

## 36. reference_data_versions
```sql
-- Version-controlled reference data: mortality tables, yield curves, FX, assumption sets
CREATE TABLE reference_data_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_id          VARCHAR(50) UNIQUE NOT NULL, -- e.g. CMI-2024-M, YC-GBP-GILT
  data_type       VARCHAR(50) NOT NULL CHECK (data_type IN (
                    'mortality_table','yield_curve','fx_rate','assumption_set','file_template','screening_cache')),
  name            VARCHAR(300) NOT NULL,
  source          VARCHAR(200),           -- Bloomberg, CMI, BoE, etc.
  version         VARCHAR(50) NOT NULL,   -- e.g. v2025.04.29, 2024
  effective_date  DATE NOT NULL,
  status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','locked','deprecated')),
  is_locked       BOOLEAN DEFAULT false,
  locked_by       UUID REFERENCES users(id),
  locked_at       TIMESTAMPTZ,
  contracts_using INTEGER DEFAULT 0,      -- denormalized count for display
  data_payload    JSONB,                  -- actual data (FX rates, yield curve tenors, etc.)
  file_path       VARCHAR(500),           -- for large tables (mortality tables, etc.)
  notes           TEXT,
  uploaded_by     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_rdv_type ON reference_data_versions(data_type, status);
CREATE INDEX idx_rdv_ref ON reference_data_versions(ref_id);
```

## 37. screening_cache_lists
```sql
-- The watchlists used for sanctions screening
CREATE TABLE screening_cache_lists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_name       VARCHAR(100) NOT NULL UNIQUE, -- 'OFAC SDN', 'FinCEN 314(a)', etc.
  provider        VARCHAR(100) NOT NULL,
  record_count    INTEGER DEFAULT 0,
  last_sync       TIMESTAMPTZ,
  status          VARCHAR(20) DEFAULT 'active',
  data_payload    JSONB,                  -- cached list entries (name, DOB, aliases, etc.)
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Initial seed data:
INSERT INTO screening_cache_lists (list_name, provider, record_count, last_sync, status) VALUES
('OFAC SDN',         'US Treasury',     12847,   '2025-04-29 04:00:00+00', 'active'),
('FinCEN 314(a)',     'FinCEN',           4122,   '2025-04-29 04:05:00+00', 'active'),
('EU Consolidated',  'European Council', 8490,   '2025-04-29 04:10:00+00', 'active'),
('FIS Adverse Media','FIS',           2140882,   '2025-04-29 03:30:00+00', 'active');
```

## 38. reports
```sql
-- Report catalog (static list for POC)
CREATE TABLE reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       VARCHAR(20) UNIQUE NOT NULL, -- RPT-H-001
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  category        VARCHAR(50) NOT NULL CHECK (category IN (
                    'Historical','Dynamic','Debugging','Movement','Compliance','Financial','Admin')),
  cadence         VARCHAR(50),           -- 'Monthly','Quarterly','Annual','Weekly'
  distribution    TEXT[],                -- ['Claims Ops','Finance','Cedant Relationship']
  sensitivity     VARCHAR(20) DEFAULT 'Standard' CHECK (sensitivity IN ('Standard','Sensitive')),
  roles_with_access TEXT[],             -- ['underwriter','claims_ops','compliance','admin','super_admin']
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

## 39. pipeline_processing_log
```sql
-- Full pipeline log for the Operations pipeline (new V2 format)
CREATE TABLE pipeline_processing_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id      VARCHAR(50) UNIQUE NOT NULL, -- e.g. IRIS-PRC-59206-A
  cession_file_id UUID REFERENCES cession_files(id),
  cedent_id       VARCHAR(20) REFERENCES cedents(cedent_id),
  contract_id     VARCHAR(30) REFERENCES contracts(contract_id),
  period_label    VARCHAR(20),           -- 'Q1 2026'
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  -- Step statuses
  normalization_status    VARCHAR(20) DEFAULT 'pending',
  calculations_status     VARCHAR(20) DEFAULT 'pending',
  variance_analysis_status VARCHAR(20) DEFAULT 'pending',
  screening_status        VARCHAR(20) DEFAULT 'pending',
  ai_decision_status      VARCHAR(20) DEFAULT 'pending',
  outcome_status          VARCHAR(20) DEFAULT 'pending',
  -- Normalization results
  total_records           INTEGER,
  affected_records        INTEGER,
  imputed_fields          INTEGER,
  -- Calculations results
  fixed_leg_amount        DECIMAL(18,2),
  floating_leg_amount     DECIMAL(18,2),
  net_position            DECIMAL(18,2),
  -- Variance analysis
  portfolio_variance_pct  DECIMAL(6,4),
  variance_threshold_pct  DECIMAL(6,4),
  breach_status           VARCHAR(30),
  -- Screening results
  entities_screened       INTEGER,
  matches_found           INTEGER,
  false_positives         INTEGER,
  critical_alerts         INTEGER,
  -- AI Decision
  ai_confidence           DECIMAL(5,4),
  ai_risk_level           VARCHAR(20),
  ai_decision             VARCHAR(100),
  -- Final outcome
  final_status            VARCHAR(50),
  settlement_amount       DECIMAL(18,2),
  approval_required       BOOLEAN DEFAULT false,
  sla_status              VARCHAR(20),
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Updated Seed Data Order
Add to migration after existing 17 tables:
18. audit_events
19. ai_decision_log
20. manual_overrides
21. screening_events
22. reference_data_versions
23. screening_cache_lists
24. reports
25. pipeline_processing_log

---

## Seed Data for New Tables

### audit_events (sample rows)
```sql
INSERT INTO audit_events (audit_id, module, event_type, actor_type, actor_id, entity_id, entity_type, description, financial_impact_amount, financial_impact_currency, is_high_impact, approval_status) VALUES
('AUD-2026-04-29-001', 'settlement', 'Settlement Approved', 'human', 'd.rhodes@reinsure.io', 'STL-2026-Q1-184', 'settlement', 'Approved Q1 settlement after reconciliation review', 4210000, 'GBP', true, 'approved'),
('AUD-2026-04-29-002', 'cession', 'AI Recommendation', 'ai', 'agent.cession-mapper-v3.2.1', 'CES-2026-04-118', 'cession_file', 'Auto-mapped 14 of 16 columns; flagged 2 for analyst review', NULL, NULL, false, 'pending'),
('AUD-2026-04-29-003', 'calculation', 'Manual Override', 'human', 'k.tanaka@reinsure.io', 'CALC-2026-Q1-918', 'calculation', 'Override mortality improvement scaling factor for 2026 cohort', 3180000, 'GBP', true, 'approved'),
('AUD-2026-04-29-004', 'contract', 'Contract Amendment', 'human', 's.fernandez@reinsure.io', 'LSC-2024-018', 'contract', 'Floating leg benchmark changed from LIBOR-fallback to SOFR + 38bps', 1840000, 'GBP', true, 'approved'),
('AUD-2026-04-29-005', 'contract', 'Contract Created', 'human', 's.fernandez@reinsure.io', 'LSC-2026-022', 'contract', 'Created longevity swap contract — 12,840 lives, GBP 1.42B notional', 1420000000, 'GBP', true, 'approved'),
('AUD-2026-04-29-006', 'reference_data', 'Reference Data Update', 'system', 'system.market-data-feed', 'GBP-NOMINAL-2026Q2', 'reference_data', 'Daily GBP nominal curve refresh from BoE feed', 2640000, 'GBP', true, 'pending'),
('AUD-2026-04-29-007', 'access', 'Sensitive Export', 'human', 'a.lindqvist@reinsure.io', 'RPT-FIN-IMPACT-Q1-2026', 'report', 'Downloaded financial impact report (Q1 2026, all cedants)', NULL, NULL, false, 'n/a'),
('AUD-2026-04-28-001', 'access', 'Permission Change', 'human', 'p.okafor@reinsure.io', 'USR-00284', 'user', 'Granted Compliance Officer role to k.tanaka@reinsure.io', NULL, NULL, false, 'n/a'),
('AUD-2026-04-28-002', 'access', 'Failed Login', 'system', 'unknown@external', 'sess_failed_44a', 'session', 'Failed login attempt (3rd in 5 min) — account locked', NULL, NULL, false, 'n/a'),
('AUD-2026-04-28-003', 'admin', 'Document Upload', 'human', 's.fernandez@reinsure.io', 'DOC-99102', 'document', 'Uploaded executed amendment AMD-2026-014', NULL, NULL, false, 'n/a');
```

### manual_overrides (1 seed row)
```sql
INSERT INTO manual_overrides (override_ref, module, entity_id, field_name, original_value, override_value, reason, financial_impact_amount, financial_impact_currency, approver_role, approver_title) VALUES
('CALC-2026-Q1-918', 'calculation', 'CALC-2026-Q1-918', 'mortality_improvement_factor', '1.25', '1.18', 'CMI 2024 release expected within 7d; using interim calibrated value to avoid stale assumption.', -3180000, 'GBP', 'compliance', 'Chief Actuary');
```

### reports (sample rows)
```sql
INSERT INTO reports (report_id, name, description, category, cadence, distribution, sensitivity, roles_with_access) VALUES
('RPT-H-001', 'Settlement Calculation Report', 'Settlement generated for a contract over a reporting period including fixed/floating legs and adjustments.', 'Historical', 'Quarterly', ARRAY['Claims Ops','Finance','Cedant Relationship'], 'Sensitive', ARRAY['claims_ops','underwriter','admin','super_admin']),
('RPT-H-002', 'Control Report', 'Control checks and reconciliation breaks for financial accuracy.', 'Historical', 'Monthly', ARRAY['Claims Ops','Internal Audit'], 'Standard', ARRAY['claims_ops','admin','super_admin']),
('RPT-H-003', 'Collateral Exposure Calculation', 'Collateral and reserve exposure visibility per cedant and contract.', 'Historical', 'Monthly', ARRAY['Risk','Treasury'], 'Standard', ARRAY['underwriter','admin','super_admin']),
('RPT-H-004', 'Cash Flows', 'Projected and actual cashflow reporting per contract and year.', 'Historical', 'Quarterly', ARRAY['Treasury','Finance'], 'Standard', ARRAY['underwriter','claims_ops','admin','super_admin']),
('RPT-D-001', 'Historical Fixed and Floating Legs', 'Trend analysis of fixed vs floating payments with mortality impact.', 'Dynamic', 'Quarterly', ARRAY['Actuarial','Risk'], 'Standard', ARRAY['underwriter','claims_ops','super_admin']),
('RPT-D-002', 'Sanity Check Report', 'Validation report for suspicious movements and unusual liability changes.', 'Dynamic', 'Monthly', ARRAY['Claims Ops','Actuarial'], 'Standard', ARRAY['claims_ops','super_admin']),
('RPT-C-001', 'Sanctions Screening Summary', 'All screening runs, matches and dispositions.', 'Compliance', 'Monthly', ARRAY['Compliance','Legal'], 'Sensitive', ARRAY['compliance','super_admin']),
('RPT-C-002', 'Regulatory Submission Pack', 'PRA/EIOPA/NAIC formatted quarterly pack.', 'Compliance', 'Quarterly', ARRAY['Compliance','Regulator'], 'Sensitive', ARRAY['compliance','super_admin']),
('RPT-C-003', 'KYC & AML Status Report', 'AML and KYC expiry tracker per cedant.', 'Compliance', 'Annual', ARRAY['Compliance'], 'Sensitive', ARRAY['compliance','admin','super_admin']),
('RPT-F-001', 'BEL Valuation Report', 'Best Estimate Liability across all contracts.', 'Financial', 'Quarterly', ARRAY['Actuarial','Finance','Risk'], 'Sensitive', ARRAY['underwriter','admin','super_admin']),
('RPT-F-002', 'Net Settlement P&L', 'Net payout position across all cedants.', 'Financial', 'Quarterly', ARRAY['Finance','Senior Management'], 'Sensitive', ARRAY['claims_ops','admin','super_admin']),
('RPT-F-003', 'FX Exposure Report', 'Multi-currency exposure and hedging requirement.', 'Financial', 'Monthly', ARRAY['Treasury'], 'Standard', ARRAY['claims_ops','underwriter','super_admin']),
('RPT-F-004', 'Collateral Adequacy', 'Threshold monitoring and top-up triggers.', 'Financial', 'Monthly', ARRAY['Risk','Treasury'], 'Standard', ARRAY['underwriter','admin','super_admin']),
('RPT-F-005', 'Experience Study', 'A/E mortality analysis vs CMI baseline.', 'Financial', 'Annual', ARRAY['Actuarial','Underwriting'], 'Standard', ARRAY['underwriter','super_admin']),
('RPT-A-001', 'User Access Audit', 'All access events, permission changes, failed logins.', 'Admin', 'Monthly', ARRAY['IT Admin','Compliance'], 'Sensitive', ARRAY['admin','compliance','super_admin']),
('RPT-A-002', 'Role Change Log', 'All role elevations and approvals.', 'Admin', 'Monthly', ARRAY['IT Admin'], 'Standard', ARRAY['admin','super_admin']),
('RPT-A-003', 'System Performance Log', 'Pipeline throughput, SLA adherence.', 'Admin', 'Weekly', ARRAY['IT Admin'], 'Standard', ARRAY['admin','super_admin']),
('RPT-A-004', 'AI Override Governance', 'All AI overrides with approver sign-off.', 'Admin', 'Monthly', ARRAY['Compliance','Senior Management'], 'Sensitive', ARRAY['compliance','admin','super_admin']);
```

### reference_data_versions (sample rows)
```sql
INSERT INTO reference_data_versions (ref_id, data_type, name, source, version, effective_date, status, is_locked, contracts_using, data_payload) VALUES
('CMI-2024-M', 'mortality_table', 'CMI Self-Administered Pension Schemes 2024 — Male', 'CMI', '2024', '2025-01-01', 'active', false, 12, '{"type":"qx_table","base_year":2024}'),
('CMI-2024-F', 'mortality_table', 'CMI Self-Administered Pension Schemes 2024 — Female', 'CMI', '2024', '2025-01-01', 'active', false, 12, '{"type":"qx_table","base_year":2024}'),
('SOA-2024-G2', 'mortality_table', 'SOA Pri-2012 with MP-2021 — Generational', 'SOA', '2024.1', '2024-04-01', 'active', false, 8, NULL),
('BVS-DE-2018G', 'mortality_table', 'Heubeck Richttafeln 2018 G', 'Heubeck', '2018G', '2019-01-01', 'locked', true, 4, NULL),
('YC-GBP-GILT', 'yield_curve', 'GBP Gilt Yield Curve', 'Bank of England', 'v2025.04.29', '2025-04-29', 'active', false, 0, '{"currency":"GBP","tenors":30}'),
('YC-USD-UST', 'yield_curve', 'USD US Treasury H.15', 'US Treasury H.15', 'v2025.04.29', '2025-04-29', 'active', false, 0, '{"currency":"USD","tenors":30}'),
('YC-EUR-EIOPA', 'yield_curve', 'EUR EIOPA RFR', 'EIOPA RFR', 'v2025.03.31', '2025-03-31', 'active', false, 0, '{"currency":"EUR","tenors":30}'),
('YC-CHF-SARON', 'yield_curve', 'CHF SIX SARON Curve', 'SIX SARON Curve', 'v2025.04.29', '2025-04-29', 'active', false, 0, '{"currency":"CHF","tenors":30}'),
('AS-2025-NS-019', 'assumption_set', 'Northstar 2025 Base', 'Internal', '2025.1', '2025-01-15', 'locked', true, 0, '{"mortality":"CMI-2024-M/F","curve":"YC-GBP-GILT","inflation":"RPI 3.1%","used_by":"LSC-2024-019"}'),
('AS-2025-HV-031', 'assumption_set', 'Helvetia 2025 Base', 'Internal', '2025.1', '2025-03-01', 'locked', true, 0, '{"mortality":"BVS-CH-2020","curve":"YC-CHF-SARON","inflation":"CPI 1.4%","used_by":"LSC-2024-031"}'),
('AS-2025-ML-044', 'assumption_set', 'Maple Leaf 2025 Base', 'Internal', '2025.1', '2025-06-12', 'locked', true, 0, '{"mortality":"SOA-2024-G2","curve":"YC-CAD-GoC","inflation":"CPI 2.2%","used_by":"LSC-2024-044"}'),
('AS-2025-AT-007', 'assumption_set', 'Atlas 2025 Draft', 'Internal', '2025.1', '2025-04-01', 'active', false, 0, '{"mortality":"SOA-2024-G2","curve":"YC-USD-UST","inflation":"CPI 2.4%","used_by":"LSC-2025-007"}'),
('TPL-NS-CES-v3', 'file_template', 'Northstar Cession Template v3', 'Internal', 'v3.2', '2025-01-01', 'active', false, 0, '{"fields":84,"format":"CSV","cedant":"CED-1042"}'),
('TPL-HV-CES-v2', 'file_template', 'Helvetia Cession Template v2', 'Internal', 'v2.1', '2025-01-01', 'active', false, 0, '{"fields":76,"format":"CSV","cedant":"CED-1087"}'),
('TPL-ML-CES-v1', 'file_template', 'Maple Leaf Cession Template v1', 'Internal', 'v1.4', '2025-01-01', 'active', false, 0, '{"fields":71,"format":"XML","cedant":"CED-1156"}'),
('TPL-BV-CES-v2', 'file_template', 'Bavarian Cession Template v2', 'Internal', 'v2.0', '2025-01-01', 'active', false, 0, '{"fields":88,"format":"CSV","cedant":"CED-1201"}');
```
