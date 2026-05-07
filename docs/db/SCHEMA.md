# IRiS — Database Schema (PostgreSQL)

## Conventions
- All tables have `created_at TIMESTAMPTZ DEFAULT NOW()` and `updated_at TIMESTAMPTZ`
- IDs are strings (business keys like CED-1042) or UUIDs for internal tables
- Soft deletes via `is_active BOOLEAN` — never hard delete
- SCD2 pattern for policy_register: `effective_from / effective_to / is_current`

---

## 1. users
```sql
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username     VARCHAR(100) UNIQUE NOT NULL,
  email        VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name    VARCHAR(200),
  role         VARCHAR(50) NOT NULL CHECK (role IN ('super_admin','admin','underwriter','claims_ops','compliance')),
  is_active    BOOLEAN DEFAULT true,
  last_login   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
```

## 2. cedents
```sql
CREATE TABLE cedents (
  cedent_id        VARCHAR(20) PRIMARY KEY,  -- e.g. CED-1042
  legal_entity_name VARCHAR(300) NOT NULL,
  trading_name      VARCHAR(300),
  registered_company_number VARCHAR(100),
  tax_identification_number VARCHAR(100),
  lei               VARCHAR(20),             -- 20-char ISO 17442
  entity_type       VARCHAR(100),            -- 'Pension Trust', 'Life Insurer', etc.
  jurisdiction      VARCHAR(100),
  country_of_registration VARCHAR(10),       -- ISO 3166-1 alpha-2
  date_of_incorporation DATE,
  regulatory_status VARCHAR(100),
  ownership_structure VARCHAR(200),
  parent_company    VARCHAR(200),
  group_structure   TEXT,
  aum_amount        DECIMAL(18,2),
  aum_currency      VARCHAR(10) DEFAULT 'USD',
  status            VARCHAR(50) DEFAULT 'onboarding'
                    CHECK (status IN ('onboarding','active','inactive','suspended')),
  screening_status  VARCHAR(50) DEFAULT 'pending'
                    CHECK (screening_status IN ('pending','cleared','review','failed')),
  onboarded_date    DATE,
  is_active         BOOLEAN DEFAULT true,
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

## 3. cedent_pension_scheme
```sql
CREATE TABLE cedent_pension_scheme (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cedent_id       VARCHAR(20) REFERENCES cedents(cedent_id),
  scheme_name     VARCHAR(300),
  scheme_type     VARCHAR(100),   -- 'Defined Benefit', 'Defined Contribution'
  scheme_reg_number VARCHAR(100),
  trustee_name    VARCHAR(300),
  trustee_type    VARCHAR(100),
  administrator   VARCHAR(300),
  total_members   INTEGER,
  active_members  INTEGER,
  deferred_members INTEGER,
  pensioner_members INTEGER,
  total_assets_amount DECIMAL(18,2),
  total_assets_currency VARCHAR(10),
  total_liabilities_amount DECIMAL(18,2),
  funding_level_pct DECIMAL(5,2),
  valuation_date  DATE,
  actuarial_firm  VARCHAR(200),
  investment_consultant VARCHAR(200),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

## 4. cedent_key_contacts
```sql
CREATE TABLE cedent_key_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cedent_id   VARCHAR(20) REFERENCES cedents(cedent_id),
  contact_name VARCHAR(200) NOT NULL,
  role_title  VARCHAR(200),
  department  VARCHAR(200),
  email       VARCHAR(255),
  phone       VARCHAR(50),
  is_primary  BOOLEAN DEFAULT false,
  contact_type VARCHAR(50),  -- 'trustee','legal','operational','actuary','compliance'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

## 5. cedent_financial_treasury
```sql
CREATE TABLE cedent_financial_treasury (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cedent_id       VARCHAR(20) REFERENCES cedents(cedent_id),
  bank_name       VARCHAR(200),
  bank_account_number VARCHAR(100),
  sort_code       VARCHAR(20),
  iban            VARCHAR(50),
  swift_bic       VARCHAR(20),
  account_currency VARCHAR(10),
  payment_method  VARCHAR(100),
  settlement_instructions TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

## 6. cedent_contract_readiness
```sql
CREATE TABLE cedent_contract_readiness (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cedent_id   VARCHAR(20) REFERENCES cedents(cedent_id),
  isda_signed BOOLEAN DEFAULT false,
  isda_date   DATE,
  csa_signed  BOOLEAN DEFAULT false,
  nda_signed  BOOLEAN DEFAULT false,
  kyc_complete BOOLEAN DEFAULT false,
  aml_complete BOOLEAN DEFAULT false,
  data_sharing_agreed BOOLEAN DEFAULT false,
  file_format_agreed  BOOLEAN DEFAULT false,
  sftp_configured     BOOLEAN DEFAULT false,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

## 7. cedent_population_exposure
```sql
CREATE TABLE cedent_population_exposure (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cedent_id       VARCHAR(20) REFERENCES cedents(cedent_id),
  total_lives     INTEGER,
  avg_age         DECIMAL(5,2),
  pct_male        DECIMAL(5,2),
  pct_female      DECIMAL(5,2),
  total_annuity_pa_amount DECIMAL(18,2),
  total_annuity_pa_currency VARCHAR(10),
  avg_annuity_per_life DECIMAL(12,2),
  geographic_spread TEXT,  -- JSON
  age_distribution  TEXT,  -- JSON
  mortality_table_used VARCHAR(100),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

## 8. cedent_compliance_kyc
```sql
CREATE TABLE cedent_compliance_kyc (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cedent_id       VARCHAR(20) REFERENCES cedents(cedent_id),
  kyc_status      VARCHAR(50),  -- 'complete','pending','failed'
  kyc_completed_date DATE,
  kyc_provider    VARCHAR(200),
  aml_status      VARCHAR(50),
  pep_check_done  BOOLEAN DEFAULT false,
  beneficial_owner_verified BOOLEAN DEFAULT false,
  high_risk_jurisdiction BOOLEAN DEFAULT false,
  risk_rating     VARCHAR(20),  -- 'low','medium','high'
  review_frequency VARCHAR(50), -- 'annual','biennial'
  next_review_date DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

## 9. cedent_sanction_screenings
```sql
CREATE TABLE cedent_sanction_screenings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cedent_id       VARCHAR(20) REFERENCES cedents(cedent_id),
  screening_date  TIMESTAMPTZ DEFAULT NOW(),
  screening_type  VARCHAR(50),  -- 'periodic','adhoc','onboarding'
  source          VARCHAR(50),  -- 'OFAC','FinCEN','UN','EU','HMT'
  result          VARCHAR(50),  -- 'cleared','match','possible_match'
  reference_id    VARCHAR(100),
  match_details   JSONB,
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  outcome         VARCHAR(50),  -- 'cleared','escalated','false_positive'
  list_version    VARCHAR(100),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

## 10. cedent_regulatory_docs
```sql
CREATE TABLE cedent_regulatory_docs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cedent_id   VARCHAR(20) REFERENCES cedents(cedent_id),
  doc_type    VARCHAR(100),  -- 'annual_report','actuarial_cert','regulatory_filing'
  doc_name    VARCHAR(300),
  doc_date    DATE,
  expiry_date DATE,
  regulator   VARCHAR(100),
  file_path   VARCHAR(500),
  status      VARCHAR(50),   -- 'current','expired','pending'
  uploaded_by UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

## 11. cedent_operational_connectivity
```sql
CREATE TABLE cedent_operational_connectivity (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cedent_id       VARCHAR(20) REFERENCES cedents(cedent_id),
  sftp_host       VARCHAR(300),
  sftp_port       INTEGER DEFAULT 22,
  sftp_username   VARCHAR(200),
  sftp_key_fingerprint VARCHAR(200),
  sftp_status     VARCHAR(50),  -- 'healthy','degraded','down'
  last_sftp_test  TIMESTAMPTZ,
  file_format     VARCHAR(50),  -- 'CSV','XLSX','XML','fixed-width'
  file_encoding   VARCHAR(20),  -- 'UTF-8','ASCII'
  submission_frequency VARCHAR(50), -- 'monthly','quarterly'
  notification_email VARCHAR(255),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

## 12. cedent_actuarial_preferences
```sql
CREATE TABLE cedent_actuarial_preferences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cedent_id       VARCHAR(20) REFERENCES cedents(cedent_id),
  mortality_table VARCHAR(100),     -- 'CMI S3','SOA 2014','DAV 2008T'
  improvement_scale VARCHAR(100),   -- 'CMI 2022','MP-2021'
  base_year       INTEGER,
  improvement_factor DECIMAL(5,4),
  valuation_basis VARCHAR(100),
  discount_rate_type VARCHAR(50),   -- 'fixed','gilts_plus'
  discount_rate   DECIMAL(5,4),
  experience_study_frequency VARCHAR(50),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

## 13. cedent_access_beneficiary_rules
```sql
CREATE TABLE cedent_access_beneficiary_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cedent_id   VARCHAR(20) REFERENCES cedents(cedent_id),
  rule_type   VARCHAR(100),  -- 'spousal','dependant','contingent'
  rule_description TEXT,
  pct_benefit DECIMAL(5,2),
  conditions  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

## 14. cedent_audit_trail
```sql
CREATE TABLE cedent_audit_trail (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cedent_id   VARCHAR(20) REFERENCES cedents(cedent_id),
  action      VARCHAR(200),
  changed_by  UUID REFERENCES users(id),
  changed_at  TIMESTAMPTZ DEFAULT NOW(),
  old_values  JSONB,
  new_values  JSONB,
  section     VARCHAR(100),
  ip_address  VARCHAR(50)
);
```

---

## 15. contracts
```sql
CREATE TABLE contracts (
  contract_id       VARCHAR(30) PRIMARY KEY,  -- e.g. LSC-2024-019
  contract_name     VARCHAR(300) NOT NULL,
  contract_version  VARCHAR(20) DEFAULT 'v1.0',
  cedent_id         VARCHAR(20) REFERENCES cedents(cedent_id),
  parent_contract_id VARCHAR(30) REFERENCES contracts(contract_id),
  counterparty_role VARCHAR(50) DEFAULT 'Reinsurer',
  swap_type         VARCHAR(100),  -- 'Indemnity','Funded','Parametric'
  structure         VARCHAR(100),  -- 'Single tranche','Multi-tranche'
  master_agreement_ref VARCHAR(100),
  inception_date    DATE NOT NULL,
  effective_date    DATE,
  maturity_date     DATE,
  duration_years    INTEGER,
  governing_law     VARCHAR(100),
  jurisdiction      VARCHAR(100),
  status            VARCHAR(50) DEFAULT 'active'
                    CHECK (status IN ('draft','active','suspended','terminated','run-off')),
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

## 16. contract_economic_terms
```sql
CREATE TABLE contract_economic_terms (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id       VARCHAR(30) REFERENCES contracts(contract_id),
  notional_amount   DECIMAL(20,2) NOT NULL,
  currency          VARCHAR(10) NOT NULL,
  settlement_currency VARCHAR(10),
  fixed_leg_rate    DECIMAL(8,6) NOT NULL,    -- e.g. 0.0285 = 2.85%
  fixed_leg_basis   VARCHAR(50) DEFAULT 'ACT/365',
  fixed_leg_frequency VARCHAR(50),            -- 'Monthly','Quarterly','Annual'
  floating_leg_definition VARCHAR(200),       -- 'Realized mortality'
  floating_leg_index VARCHAR(200),            -- 'CMI 2024 SAPS'
  floating_leg_frequency VARCHAR(50),
  payment_lag_days  INTEGER DEFAULT 30,
  fx_reference_source VARCHAR(100),           -- 'Bloomberg WMR 4pm'
  collateral_required BOOLEAN DEFAULT false,
  collateral_threshold DECIMAL(18,2),
  independent_amount DECIMAL(18,2),
  is_locked         BOOLEAN DEFAULT false,   -- true after inception
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

## 17. contract_reference_pool
```sql
CREATE TABLE contract_reference_pool (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     VARCHAR(30) REFERENCES contracts(contract_id),
  pool_name       VARCHAR(200),
  inclusion_criteria TEXT,
  exclusion_criteria TEXT,
  age_min         INTEGER,
  age_max         INTEGER,
  gender_filter   VARCHAR(20),  -- 'M','F','All'
  scheme_sections TEXT,
  benefit_types   TEXT,
  geographic_scope VARCHAR(100),
  lives_count     INTEGER,
  total_notional  DECIMAL(18,2),
  as_of_date      DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

## 18. contract_actuarial_basis
```sql
CREATE TABLE contract_actuarial_basis (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id         VARCHAR(30) REFERENCES contracts(contract_id),
  base_mortality_table VARCHAR(100),
  improvement_model   VARCHAR(100),
  base_year           INTEGER,
  long_term_rate      DECIMAL(6,4),
  initial_rate        DECIMAL(6,4),
  convergence_period  INTEGER,
  age_rating_adjustment DECIMAL(5,2),
  loading_factor      DECIMAL(5,4),
  discount_rate       DECIMAL(6,4),
  discount_basis      VARCHAR(100),
  valuation_method    VARCHAR(100),
  experience_review_trigger DECIMAL(5,2),  -- AE deviation % that triggers review
  is_locked           BOOLEAN DEFAULT false,
  locked_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
```

## 19. contract_risk_limits
```sql
CREATE TABLE contract_risk_limits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     VARCHAR(30) REFERENCES contracts(contract_id),
  max_notional    DECIMAL(20,2),
  mortality_deviation_trigger DECIMAL(5,2),  -- e.g. 5.00 = 5%
  settlement_variance_threshold DECIMAL(5,2),
  portfolio_variance_limit DECIMAL(10,2),
  concentration_limit DECIMAL(5,2),          -- max % in any one age band
  recapture_trigger_rating VARCHAR(20),       -- credit rating that triggers recapture
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

## 20. contract_operational_terms
```sql
CREATE TABLE contract_operational_terms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     VARCHAR(30) REFERENCES contracts(contract_id),
  cession_file_deadline_day INTEGER,   -- day of month/quarter
  cession_file_format VARCHAR(50),
  validation_tolerance_pct DECIMAL(5,2),
  sla_validation_days INTEGER,
  sla_settlement_days INTEGER,
  dispute_resolution TEXT,
  administrator_name VARCHAR(200),
  administrator_contact VARCHAR(255),
  sftp_path       VARCHAR(500),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

## 21. contract_compliance_docs
```sql
CREATE TABLE contract_compliance_docs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id VARCHAR(30) REFERENCES contracts(contract_id),
  doc_type    VARCHAR(100),
  doc_name    VARCHAR(300),
  doc_date    DATE,
  file_path   VARCHAR(500),
  status      VARCHAR(50),
  uploaded_by UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

## 22. contract_amendments
```sql
CREATE TABLE contract_amendments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     VARCHAR(30) REFERENCES contracts(contract_id),
  amendment_number INTEGER,
  amendment_date  DATE,
  description     TEXT,
  changed_sections TEXT[],
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  status          VARCHAR(50),  -- 'draft','pending_approval','approved','rejected'
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

## 23. contract_file_templates
```sql
CREATE TABLE contract_file_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     VARCHAR(30) REFERENCES contracts(contract_id),
  file_type       VARCHAR(100) NOT NULL,  -- 'Pension Status','Fixed Leg','Mortality Report', etc.
  template_name   VARCHAR(200),
  frequency       VARCHAR(50),
  required_columns JSONB,
  sample_file_path VARCHAR(500),
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

## 24. fixed_leg_schedule
```sql
-- IMMUTABLE after is_locked = true. No UPDATE after lock.
CREATE TABLE fixed_leg_schedule (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     VARCHAR(30) REFERENCES contracts(contract_id),
  period_number   INTEGER NOT NULL,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  fixed_amount    DECIMAL(18,2) NOT NULL,
  currency        VARCHAR(10) NOT NULL,
  is_locked       BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
  -- NO updated_at — this is append-only
);
CREATE INDEX idx_fls_contract ON fixed_leg_schedule(contract_id);
```

---

## 25. policy_register (SCD2)
```sql
CREATE TABLE policy_register (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     VARCHAR(30) REFERENCES contracts(contract_id),
  member_id       VARCHAR(50) NOT NULL,         -- e.g. PEN-0100234
  policy_id       VARCHAR(50),                  -- internal ref
  date_of_birth   DATE NOT NULL,
  gender          CHAR(1) CHECK (gender IN ('M','F')),
  smoker_status   VARCHAR(20),                  -- 'smoker','non-smoker','unknown'
  postcode        VARCHAR(20),
  annual_pension  DECIMAL(12,2) NOT NULL,
  pension_currency VARCHAR(10) DEFAULT 'GBP',
  escalation_type VARCHAR(50),                  -- 'fixed','RPI','CPI','LPI'
  escalation_rate DECIMAL(5,4),
  status          VARCHAR(30) DEFAULT 'active'
                  CHECK (status IN ('active','deceased','deferred','suspended','transferred')),
  date_of_death   DATE,
  commencement_date DATE,
  -- SCD2 columns
  effective_from  DATE NOT NULL,
  effective_to    DATE,                         -- NULL = current record
  is_current      BOOLEAN DEFAULT true,
  source_cession_file_id UUID,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_pr_contract ON policy_register(contract_id, is_current);
CREATE INDEX idx_pr_member ON policy_register(member_id);
```

---

## 26. cession_files
```sql
CREATE TABLE cession_files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id         VARCHAR(30) NOT NULL UNIQUE,  -- e.g. CES-2025-09-015
  contract_id     VARCHAR(30) REFERENCES contracts(contract_id),
  cedent_id       VARCHAR(20) REFERENCES cedents(cedent_id),
  filename        VARCHAR(300) NOT NULL,
  file_type       VARCHAR(100),    -- 'Pension Status','Fixed Leg','Mortality Report', etc.
  period_start    DATE,
  period_end      DATE,
  record_count    INTEGER,
  received_at     TIMESTAMPTZ DEFAULT NOW(),
  received_via    VARCHAR(50),     -- 'SFTP','Manual Upload','API'
  stage           VARCHAR(50) DEFAULT 'uploaded'
                  CHECK (stage IN ('uploaded','detecting','detected','mapping','mapped',
                                   'clauses','validating','validated','exceptions',
                                   'processing','processed','worklist','audited','approved','rejected')),
  ai_file_type_confidence DECIMAL(5,2),
  ai_cedent_confidence    DECIMAL(5,2),
  error_count     INTEGER DEFAULT 0,
  warning_count   INTEGER DEFAULT 0,
  critical_count  INTEGER DEFAULT 0,
  sla_deadline    TIMESTAMPTZ,
  sla_breached    BOOLEAN DEFAULT false,
  processed_by    UUID REFERENCES users(id),
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

## 27. cession_file_records
```sql
CREATE TABLE cession_file_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cession_file_id UUID REFERENCES cession_files(id),
  row_number      INTEGER,
  member_id       VARCHAR(50),
  raw_data        JSONB,
  mapped_data     JSONB,
  validation_status VARCHAR(50),  -- 'valid','warning','error','critical'
  validation_issues JSONB,        -- array of {severity, field, issue, ai_suggestion}
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

## 28. cession_file_exceptions
```sql
CREATE TABLE cession_file_exceptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cession_file_id UUID REFERENCES cession_files(id),
  row_number      INTEGER,
  field_name      VARCHAR(100),
  severity        VARCHAR(20),   -- 'critical','warning','info'
  issue_type      VARCHAR(100),
  description     TEXT,
  current_value   VARCHAR(500),
  ai_suggestion   VARCHAR(500),
  ai_confidence   DECIMAL(5,2),
  resolution      VARCHAR(50),   -- 'pending','accepted','overridden','rejected'
  resolved_by     UUID REFERENCES users(id),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 29. settlements
```sql
CREATE TABLE settlements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id   VARCHAR(30) NOT NULL UNIQUE,   -- e.g. SET-2025-Q1-019
  contract_id     VARCHAR(30) REFERENCES contracts(contract_id),
  cedent_id       VARCHAR(20) REFERENCES cedents(cedent_id),
  cession_file_id UUID REFERENCES cession_files(id),
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  period_label    VARCHAR(50),         -- 'Q1 2025'
  fixed_leg_amount    DECIMAL(18,2),
  floating_leg_amount DECIMAL(18,2),
  net_amount          DECIMAL(18,2),   -- floating - fixed
  currency            VARCHAR(10),
  direction           VARCHAR(30),     -- 'reinsurer_to_cedant' | 'cedant_to_reinsurer'
  payment_due_date    DATE,
  payment_date        DATE,
  status          VARCHAR(50) DEFAULT 'calculated'
                  CHECK (status IN ('calculated','pending_approval','approved','disputed','paid','cancelled')),
  cedant_confirmed    BOOLEAN DEFAULT false,
  reinsurer_confirmed BOOLEAN DEFAULT false,
  approved_by         UUID REFERENCES users(id),
  approved_at         TIMESTAMPTZ,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 30. worklist_items
```sql
CREATE TABLE worklist_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wl_id           VARCHAR(20) NOT NULL UNIQUE,   -- e.g. WL-9201
  title           VARCHAR(500) NOT NULL,
  description     TEXT,
  category        VARCHAR(100),    -- 'Reconciliation Mismatch','OFAC Match','AI Mapping Failure', etc.
  priority        VARCHAR(20) DEFAULT 'medium'
                  CHECK (priority IN ('critical','high','medium','low')),
  status          VARCHAR(50) DEFAULT 'open'
                  CHECK (status IN ('open','in_progress','pending_review','resolved','closed')),
  assigned_role   VARCHAR(50),     -- which role sees this
  assigned_to     UUID REFERENCES users(id),
  contract_id     VARCHAR(30) REFERENCES contracts(contract_id),
  cedent_id       VARCHAR(20) REFERENCES cedents(cedent_id),
  cession_file_id UUID REFERENCES cession_files(id),
  settlement_id   VARCHAR(30),
  source          VARCHAR(50),     -- 'AI Agent','System Rule','Human','SFTP'
  source_detail   VARCHAR(200),
  sla_deadline    TIMESTAMPTZ,
  elapsed_minutes INTEGER,
  compliance_hold BOOLEAN DEFAULT false,
  ai_generated    BOOLEAN DEFAULT false,
  breadcrumb      VARCHAR(200),    -- e.g. 'Settlement Approval · Variance > 0.5%'
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_wl_role ON worklist_items(assigned_role, status);
```

---

## 31. experience_reports
```sql
CREATE TABLE experience_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     VARCHAR(30) REFERENCES contracts(contract_id),
  report_period_start DATE,
  report_period_end   DATE,
  expected_deaths INTEGER,
  actual_deaths   INTEGER,
  ae_ratio        DECIMAL(6,4),
  ae_by_age_band  JSONB,
  ae_by_gender    JSONB,
  statistical_significance DECIMAL(5,4),
  notes           TEXT,
  generated_by    UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Seed Data Order (for Alembic / init script)
1. users
2. cedents
3. cedent_pension_scheme, cedent_key_contacts, cedent_financial_treasury
4. cedent_contract_readiness, cedent_population_exposure
5. cedent_compliance_kyc, cedent_sanction_screenings
6. cedent_regulatory_docs, cedent_operational_connectivity
7. cedent_actuarial_preferences, cedent_access_beneficiary_rules
8. contracts
9. contract_economic_terms, contract_reference_pool, contract_actuarial_basis
10. contract_risk_limits, contract_operational_terms
11. contract_compliance_docs, contract_amendments, contract_file_templates
12. fixed_leg_schedule
13. policy_register
14. cession_files, cession_file_records, cession_file_exceptions
15. settlements
16. worklist_items
17. experience_reports
