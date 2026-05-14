export type AppRole = 'super_admin' | 'admin' | 'underwriter' | 'claims_ops' | 'compliance'

export interface User {
  id: string
  email: string
  full_name: string | null
  role: AppRole
  is_active: boolean
}

export interface AuthResponse {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  user: User
}

export interface DashboardKpi {
  label: string
  value: string
  trend: 'up' | 'down' | 'neutral'
  trend_value?: string
  subtitle: string
  border_color: 'green' | 'amber' | 'red' | 'blue' | 'teal'
}

export interface QuickAction {
  label: string
  action: string
  variant?: 'primary'
}

export interface DashboardPayload {
  role: Exclude<AppRole, 'super_admin'>
  title: string
  subtitle: string
  insight: string
  quick_actions: QuickAction[]
  kpis: DashboardKpi[]
  supplementary_panels?: DashboardSupplementaryPanel[]
}

export interface DashboardSupplementaryPanelItem {
  id: string
  title: string
  description?: string
  badge?: string
  metric?: string
  metric_tone?: 'default' | 'negative'
}

export interface DashboardSupplementaryHeatmapRow {
  area: string
  low: number
  medium: number
  high: number
}

export interface DashboardSupplementaryPanel {
  id: string
  title: string
  variant?: 'list' | 'status_grid' | 'heatmap'
  action_label?: string
  action?: string
  meta_text?: string
  items?: DashboardSupplementaryPanelItem[]
  heatmap_rows?: DashboardSupplementaryHeatmapRow[]
}

export interface IntelligenceItem {
  id: string
  module: string
  cedant: string
  period: string
  sla: string
  flag: string
  priority: string
  contract_id: string
  contract_type: string
  message: string
  impact: string
  action_label: string
  action: string
}

export interface IntelligencePayload {
  role: Exclude<AppRole, 'super_admin'>
  items: IntelligenceItem[]
}

export interface GraphDataset {
  label?: string
  data: number[]
  color?: string
  colors?: string[]
  dashed?: boolean
}

export interface GraphConfig {
  id: string
  title: string
  subtitle?: string
  type: 'donut' | 'line' | 'bar' | 'bar_horizontal' | 'area'
  data: {
    labels: string[]
    datasets: GraphDataset[]
  }
}

export interface GraphPayload {
  role: Exclude<AppRole, 'super_admin'>
  graphs: GraphConfig[]
}

export type DashboardRecentActivitiesTabKey = 'team_activities' | 'iris_ai' | 'escalations'

export interface DashboardRecentActivityChip {
  label: string
  tone: 'default' | 'info' | 'positive' | 'warning' | 'negative'
}

export interface DashboardRecentActivityItem {
  id: string
  tab: DashboardRecentActivitiesTabKey
  actor_label: string
  actor_kind: 'person' | 'system' | 'iris'
  module: string
  priority: 'FYA' | 'FYI'
  title: string
  timestamp_label: string
  meta_segments: string[]
  emphasis_chip?: DashboardRecentActivityChip | null
  metric_chip?: DashboardRecentActivityChip | null
  worklist_ref?: string | null
  action?: string | null
}

export interface DashboardRecentActivitiesPayload {
  role: Exclude<AppRole, 'super_admin'>
  window_label: string
  default_tab: DashboardRecentActivitiesTabKey
  items: DashboardRecentActivityItem[]
}

export interface WorklistSummary {
  my_critical: number
  overdue: number
  pending_approvals: number
  compliance_holds: number
  ai_exception_queue: number
  team_backlog: number
  awaiting_review: number
}

export interface WorklistItem {
  wl_id: string
  title: string
  description?: string
  category?: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'in_progress' | 'pending_review' | 'resolved' | 'closed'
  assigned_role?: string
  contract_id?: string
  cedent_id?: string
  source?: string
  ai_generated?: boolean
  compliance_hold?: boolean
  elapsed_display?: string
  is_approaching?: boolean
  is_overdue?: boolean
  breadcrumb?: string
  cedent_name?: string
  assigned_to_email?: string | null
  entity_display?: string
  financial_impact_display?: string | null
  is_high_impact?: boolean
  confidence_display?: string | null
  action_label?: string | null
}

export interface WorklistPayload {
  summary: WorklistSummary
  total: number
  items: WorklistItem[]
}

export interface CedentListItem {
  cedent_id: string
  legal_entity_name: string
  country: string | null
  aum: string
  contracts_count: number
  screening_status: string
  status: string
  onboarded_date: string | null
  actions: string[]
}

export interface CedentsListPayload {
  total: number
  page: number
  page_size: number
  items: CedentListItem[]
}

export interface LegalEntitySection {
  cedent_id: string
  legal_entity_name: string
  trading_name: string
  registered_company_number: string
  tax_identification_number: string
  lei: string
  entity_type: string
  jurisdiction_of_incorporation: string
  country_of_registration: string
  date_of_incorporation: string
  regulatory_status: string
  ownership_structure: string
  parent_company: string
  group_structure: string
}

export interface PensionSchemeSection {
  scheme_id: string
  scheme_name: string
  scheme_type: string
  trustee_name: string
  trustee_type?: string
  administrator?: string
  total_members?: number | string
  active_members?: number | string
  deferred_members?: number | string
  pensioner_members?: number | string
  total_assets_amount?: number | string
  total_assets_currency?: string
  total_liabilities_amount?: number | string
  funding_level_pct?: number | string
  valuation_date?: string
  actuarial_firm?: string
  investment_consultant?: string
  scheme_registration_number: string
  scheme_country: string
  scheme_currency: string
  benefit_type: string
  retirement_age_rules: string
  indexation_rules: string
  spouse_benefits: string
  guaranteed_period_rules: string
  deferred_member_rules: string
}

export interface KeyContact {
  category: string
  full_name: string
  designation: string
  department: string
  email: string
  phone: string
  mobile: string
  preferred_contact: string
  language: string
  is_primary?: boolean
  contact_type?: string
}

export interface FinancialTreasurySection {
  bank_name: string
  account_number: string
  sort_code: string
  iban: string
  swift_bic: string
  account_currency: string
  payment_method: string
  settlement_instructions: string
}

export interface ContractReadinessSection {
  isda_signed: boolean
  isda_date: string
  csa_signed: boolean
  csa_date: string
  nda_signed: boolean
  nda_date: string
  kyc_complete: boolean
  aml_complete: boolean
  data_sharing_agreed: boolean
  file_format_agreed: boolean
  sftp_configured_tested: boolean
  notes: string
}

export interface PopulationExposureSection {
  total_lives: number | string
  average_age: number | string
  pct_male: number | string
  pct_female: number | string
  total_annuity_pa_amount: number | string
  currency: string
  avg_annuity_per_life: number | string
  geographic_spread: string
  age_distribution: string
  mortality_table_used: string
}

export interface ComplianceKycSection {
  kyc_status: string
  kyc_completed_date: string
  kyc_provider: string
  aml_status: string
  pep_check_done: boolean
  beneficial_owner_verified: boolean
  high_risk_jurisdiction: boolean
  risk_rating: string
  review_frequency: string
  next_review_date: string
  notes: string
}

export interface RegulatoryDocument {
  doc_type: string
  doc_name: string
  doc_date: string
  expiry_date: string
  regulator: string
  file_name?: string
}

export interface ScreeningSourceStatus {
  source: string
  status: string
  last_scan: string
  reference: string
  matches: number
}

export interface ScreeningHistoryItem {
  id: string
  screening_date: string
  source: string
  scan_type?: string
  result: string
  reference_id: string
  matches: number
  reviewer?: string
  notes?: string
}

export interface SanctionScreeningSection {
  total_scans: number
  open_hits: number
  sources_monitored: number
  next_periodic_due: string
  source_status: ScreeningSourceStatus[]
  history: ScreeningHistoryItem[]
}

export interface OperationalConnectivitySection {
  sftp_host: string
  sftp_port: number | string
  sftp_username: string
  sftp_key_fingerprint: string
  sftp_status: string
  file_format: string
  file_encoding: string
  submission_frequency: string
  notification_email: string
}

export interface ActuarialPreferencesSection {
  mortality_table: string
  improvement_scale: string
  base_year: number | string
  long_term_rate: number | string
  initial_rate: number | string
  convergence_period: number | string
  age_rating_adjustment: number | string
  loading_factor: number | string
  discount_rate: number | string
  discount_basis: string
  valuation_method: string
  experience_study_frequency: string
  notes: string
}

export interface AccessBeneficiaryRule {
  rule_type: string
  pct_benefit: number | string
  conditions: string
  rule_description: string
}

export interface AuditEvent {
  timestamp: string
  actor: string
  action: string
  detail: string
}

export interface CedentContractSummary {
  contract_id: string
  contract_name: string
  notional: number
  currency: string
  status: string
  inception_date: string | null
  lives: number
}

export interface CedentCalculationsSummary {
  status: string
  message: string
}

export interface CedentDetailPayload {
  cedent_id: string
  legal_entity_name: string
  status: string
  screening_status: string
  country: string | null
  aum: number
  aum_currency: string
  contracts_count: number
  onboarded_date: string | null
  legal_entity: LegalEntitySection
  pension_scheme: PensionSchemeSection
  key_contacts: KeyContact[]
  financial_treasury: FinancialTreasurySection
  contract_readiness: ContractReadinessSection
  population_exposure: PopulationExposureSection
  compliance_kyc: ComplianceKycSection
  sanction_screening: SanctionScreeningSection
  regulatory_docs: RegulatoryDocument[]
  operational_connectivity: OperationalConnectivitySection
  actuarial_preferences: ActuarialPreferencesSection
  access_beneficiary_rules: AccessBeneficiaryRule[]
  audit_approval: AuditEvent[]
  mapped_contracts: CedentContractSummary[]
  calculations: CedentCalculationsSummary
}

export interface CedentCreateResponse {
  cedent_id: string
  status: string
}

export interface CedentStatusResponse {
  cedent_id: string
  status: string
  worklist_item: string | null
}

export interface ScreeningHistoryPayload {
  total_scans: number
  open_hits: number
  sources_monitored: number
  next_periodic_due: string
  history: ScreeningHistoryItem[]
}

export interface ScreeningTriggerResponse {
  screening_id: string
  status: string
  estimated_completion_seconds: number
}

export interface AiExtractField {
  value: string
  confidence: number
  citation: string
}

export interface AiExtractResponse {
  extracted_fields: Record<string, AiExtractField>
  sections_populated: string[]
  low_confidence_fields: string[]
}

export interface ContractListItem {
  contract_id: string
  contract_name: string
  cedent_id: string | null
  cedent_name: string
  notional: number
  currency: string
  fixed_rate: number
  floating_definition: string
  inception_date: string | null
  maturity_date: string | null
  lives_count: number
  version: string
  status: string
  actions: string[]
}

export interface ContractsListPayload {
  total: number
  page: number
  page_size: number
  items: ContractListItem[]
}

export interface ContractMasterDataSection {
  contract_id: string
  contract_name: string
  contract_version: string
  cedent_id: string
  cedent_name: string
  counterparty_role: string
  parent_contract_id: string
  swap_type: string
  structure: string
  master_agreement_reference: string
  inception_date: string
  effective_date: string
  maturity_date: string
  duration_years: number | string
  governing_law: string
  jurisdiction: string
  status: string
}

export interface ContractEconomicTermsSection {
  notional_amount: number | string
  currency: string
  settlement_currency: string
  fixed_leg_rate_pct: number | string
  fixed_leg_basis: string
  fixed_leg_frequency: string
  floating_leg_definition: string
  floating_leg_index_table: string
  floating_leg_frequency: string
  payment_lag_days: number | string
  fx_reference_source: string
  collateral_required: boolean
  collateral_threshold: number | string
  independent_amount: number | string
  is_locked: boolean
}

export interface ContractReferencePoolSection {
  pool_name: string
  lives_covered: number | string
  average_age: number | string
  male_female_split: string
  average_pension_amount: number | string
  pool_currency: string
  geographic_concentration: string
  benefit_type: string
  indexation_basis: string
  closed_open: string
  data_as_of: string
  data_source_reference: string
}

export interface ContractActuarialBasisSection {
  mortality_table_id: string
  mortality_table_name: string
  mortality_improvement_scale: string
  discount_curve_id: string
  discount_curve_source: string
  inflation_assumption: string
  longevity_loading_pct: number | string
  expense_loading_pct: number | string
  assumption_set_id: string
  last_revaluation: string
  next_revaluation_due: string
}

export interface ContractRiskLimitsSection {
  max_loss_limit: number | string
  aggregate_limit: number | string
  deductible: number | string
  catastrophe_cap: number | string
  rating_downgrade_trigger: string
  risk_committee_approval_required: boolean
  early_termination_event: string
  novation_rights: string
  cedant_change_of_control: string
}

export interface ContractOperationalTermsSection {
  settlement_calendar: string
  cession_file_format: string
  cession_file_frequency: string
  sftp_endpoint_id: string
  encryption_method: string
  reporting_package: string
  lead_underwriter: string
  operations_contact: string
  legal_contact: string
}

export interface ContractComplianceDocument {
  doc_type: string
  doc_name: string
  doc_date: string
  status: string
  file_name: string
}

export interface ContractPerformanceKpi {
  label: string
  value: string
  subtitle?: string
  accent: 'default' | 'danger' | 'positive' | 'negative'
}

export interface ContractSummaryCardItem {
  label: string
  value: string
}

export interface ContractSummaryCard {
  title: string
  items: ContractSummaryCardItem[]
}

export interface ContractOverviewMetric {
  label: string
  value: string
  change?: string
  tone: 'default' | 'positive' | 'negative' | 'warning'
}

export interface ContractOperationalTraceItem {
  timestamp: string
  title: string
  description: string
  actor: string
  status: string
}

export interface ContractVitalityIndex {
  label: string
  value: string
  caption: string
  tone: 'positive' | 'warning' | 'negative' | 'default'
}

export interface ContractDecisionIntelligence {
  headline: string
  insight: string
  supporting_points: string[]
}

export interface ContractTechnicalVaultItem {
  label: string
  value: string
  kind: 'log' | 'document' | 'node'
}

export interface ContractSettlementRow {
  period: string
  expected_deaths: number
  actual_deaths: number
  ae_ratio: number
  fixed_leg: number
  floating_leg: number
  net_settled: number
  active_pensioners: number
  status: string
}

export interface ContractDetailsPerformancePayload {
  contract_id: string
  current_notional: number
  lives_active: number
  lives_deceased_ytd: number
  ae_ratio_ytd: number
  bel: number
  mtm: number
  renewal_offset_days: number
  headline_metrics: ContractPerformanceKpi[]
  summary_cards: ContractSummaryCard[]
  cumulative_net_variance: number
  settlement_history: ContractSettlementRow[]
  overview_metrics: ContractOverviewMetric[]
  operational_trace: ContractOperationalTraceItem[]
  vitality_indices: ContractVitalityIndex[]
  decision_intelligence: ContractDecisionIntelligence
  technical_vault: ContractTechnicalVaultItem[]
}

export interface ContractFileTemplate {
  id: string
  file_type: string
  template_name: string
  schema_version: string
  format: string
  frequency: string
  channel: string
  last_received: string
  required_columns: string[]
  is_active: boolean
}

export interface ContractAmendment {
  id: string
  version: string
  type: string
  summary: string
  submitted: string
  effective: string
  status: string
  changed_sections: string[]
  changes: Record<string, unknown>
}

export interface ContractAuditChecklistItem {
  control: string
  status: string
  owner: string
  due_date: string
  notes: string
}

export interface ContractAuditTrailItem {
  timestamp: string
  actor: string
  type: string
  action: string
  detail: string
}

export interface ContractAuditComplianceSection {
  checklist: ContractAuditChecklistItem[]
  audit_trail: ContractAuditTrailItem[]
}

export interface ContractClause {
  clause_id: string
  category: string
  clause_title: string
  summary_citation: string
  applies_to_transactions: string
}

export interface ContractMemberSummary {
  total_members: number
  active_members: number
  deferred_members: number
  spouse_members: number
  deceased_members: number
  currency: string
  last_verified_date: string
}

export interface ContractDetailPayload {
  contract_id: string
  contract_name: string
  cedent_id: string | null
  cedent_name: string
  status: string
  renewal_date: string
  notional: number
  currency: string
  lives_count: number
  version: string
  master_data: ContractMasterDataSection
  economic_terms: ContractEconomicTermsSection
  reference_pool: ContractReferencePoolSection
  actuarial_basis: ContractActuarialBasisSection
  risk_limits: ContractRiskLimitsSection
  operational_terms: ContractOperationalTermsSection
  compliance_docs: ContractComplianceDocument[]
  audit_approval: AuditEvent[]
  details_performance: ContractDetailsPerformancePayload
  file_templates: ContractFileTemplate[]
  amendments: ContractAmendment[]
  audit_compliance: ContractAuditComplianceSection
  member_population: ContractMemberSummary
  contract_clauses: ContractClause[]
}

export interface ContractCreateResponse {
  contract_id: string
  status: string
}

export interface ContractAmendmentResponse {
  contract_id: string
  amendment_id: string
  status: string
  worklist_item: string
}

export interface ContractCalculationBreakdownItem {
  period: string
  value: number
}

export interface ContractCalculationPayload {
  metric: string
  aggregation: string
  group_by: string
  from: string
  to: string
  result_label: string
  result_value: number
  currency: string
  breakdown: ContractCalculationBreakdownItem[]
}

export interface ContractMemberRecord {
  member_id: string
  name: string
  age: number
  gender: string
  annuity_amount: number
  currency: string
  status: string
  last_verified: string
  defer_reason: string
}

export interface ContractMemberListPayload {
  contract_id: string
  total: number
  display_total?: number
  page: number
  page_size: number
  total_pages?: number
  summary: ContractMemberSummary
  items: ContractMemberRecord[]
}

export interface ContractUploadMembersResponse {
  upload_id: string
  status: string
  filename: string | null
  bytes_received: number
  message: string
}

export interface PopulationFiltersApplied {
  cedent: string
  contract: string
  status: string
}

export interface PopulationRecord {
  member_id: string
  contract_id: string
  age: number
  gender: string
  annual_pension: number
  currency: string
  status: string
  last_verified: string
}

export interface PopulationListPayload {
  total: number
  filters_applied: PopulationFiltersApplied
  items: PopulationRecord[]
}

export interface PopulationHistoryEntry {
  effective_from: string
  effective_to: string | null
  status: string
  annual_pension: number
  is_current: boolean
}

export interface PopulationHistoryPayload {
  member_id: string
  history: PopulationHistoryEntry[]
}

export interface PopulationDeferResponse {
  member_id: string
  status: string
  effective_from: string
}

export interface ClaimsCessionMetrics {
  in_pipeline: number
  exceptions: number
  processed: number
  stp_pct: number
  pipeline_throughput: {
    records_ingested: number
    files: number
    in_exception: number
    avg_processing_time: string
  }
}

export interface ClaimsCessionQueueItem {
  file_id: string
  filename: string
  cedent: string
  cedent_id: string | null
  file_type: string
  contract_id: string | null
  records: number
  stage: string
  critical_count: number
  received_at: string
  sla_deadline: string
}

export interface ClaimsCessionQueuePayload {
  metrics: ClaimsCessionMetrics
  items: ClaimsCessionQueueItem[]
}

export interface ClaimsDetectionPayload {
  file_type: string
  file_type_confidence: number
  cedent: string
  cedent_id: string | null
  cedent_confidence: number
  iris_reasoning: string
}

export interface ClaimsContractMappingPayload {
  contract_id: string
  contract_name: string
  version: string
  period: string
  confidence: number
  matching_basis: string
  notional: number
  currency: string
  lives_covered: number
  inception_date: string
  maturity_date: string
  status: string
  fixed_leg_rate_pct: number
  floating_leg: string
  expected_fixed_leg: number
}

export interface ClaimsClause {
  clause_id: string
  clause_title: string
  category: string
  status: string
  description: string
  fields_affected: string[]
  active: boolean
}

export interface ClaimsClausesPayload {
  title: string
  subtitle: string
  flagged_count: number
  clauses_checked: ClaimsClause[]
}

export interface ClaimsValidationIssue {
  severity: string
  row: number
  field: string
  issue: string
  current_value: string | null
  ai_suggestion: string | null
  ai_confidence: number
  clause_reference: string
}

export interface ClaimsValidationPayload {
  records: number
  columns_mapped: number
  critical_errors: number
  warnings: number
  informational: number
  issues: ClaimsValidationIssue[]
}

export interface ClaimsExceptionItem extends ClaimsValidationIssue {
  exception_id: string
  resolution: string
}

export interface ClaimsExceptionsPayload {
  title: string
  subtitle: string
  critical: number
  warnings: number
  informational: number
  unresolved: number
  items: ClaimsExceptionItem[]
}

export interface ClaimsProcessPayload {
  title: string
  subtitle: string
  engine_plan: string[]
  iris_note: string
}

export interface ClaimsSettlementImpact {
  fixed_leg_adjustment: number
  currency: string
  settlement_id_created: string
}

export interface ClaimsSettlementReconciliationAmountSet {
  fixed_leg: number
  floating_leg: number
  fee: number
  interest_prior_period: number
  net_settlement_amount: number
  recomputed_net?: number
}

export interface ClaimsSettlementReconciliationMismatch {
  field: string
  uploaded: number
  expected: number
  issue_type: string
  message: string
}

export interface ClaimsSettlementReconciliation {
  settlement_id: string
  decision: 'accept' | 'review'
  calculation_period: string
  period_start: string
  period_end: string
  payment_date: string | null
  currency: string
  expected_source: string
  mock_expected: boolean
  uploaded: ClaimsSettlementReconciliationAmountSet
  system: ClaimsSettlementReconciliationAmountSet
  mismatches: ClaimsSettlementReconciliationMismatch[]
  incoming_row_count?: number
}

export interface ClaimsSummaryPayload {
  file_id: string
  contract_id: string
  file_type: string
  period: string
  records_processed: number
  exceptions_resolved: number
  exceptions_overridden: number
  settlement_impact: ClaimsSettlementImpact | null
  population_changes: Record<string, number> | null
  worklist_items_created: number
  audit_trail_id: string
  liability_impact: number | null
  fixed_leg_recomputed: number | null
  net_settlement_amount: number | null
  settlement_reconciliation?: ClaimsSettlementReconciliation | null
  insight: string
}

export interface ClaimsWorklistScreeningSummary {
  screening_ref: string
  status: string | null
  headline: string
  description: string
  tone: 'default' | 'positive' | 'warning' | 'negative'
  watchlists_screened: string[]
  confidence_pct: number | null
  analysis_label: string | null
  recommended_action: string | null
  candidate_name: string | null
  candidate_list: string | null
}

export interface ClaimsWorklistTask {
  wl_id: string
  task: string
  type: string
  team: string
  assigned_person?: string | null
  priority: string
  status?: string
  status_label?: string
  status_tone?: 'neutral' | 'positive' | 'warning' | 'negative'
  sla: string
  description: string
  target_url?: string | null
  target_label?: string | null
  screening_summary?: ClaimsWorklistScreeningSummary | null
}

export interface ClaimsDownstreamFileArtifact {
  artifact_id: string
  settlement_id: string
  cession_file_id: string
  contract_id: string
  cedent: string
  period: string
  report_type: string
  filename: string
  format: string
  generated_at: string
  source_filename: string
  reconciliation_decision: 'accept' | 'review'
  mismatch_count: number
  published?: boolean
  published_at?: string | null
  download_url: string
}

export interface ClaimsDownstreamFilesPayload {
  title: string
  subtitle: string
  items: ClaimsDownstreamFileArtifact[]
  pushed: boolean
  pushed_at?: string | null
}

export interface ClaimsWorklistPayload {
  title: string
  subtitle: string
  items: ClaimsWorklistTask[]
}

export interface ClaimsAuditEvent {
  timestamp: string
  actor: string
  type: string
  action: string
  detail: string
}

export interface ClaimsAuditPayload {
  title: string
  subtitle: string
  items: ClaimsAuditEvent[]
}

export interface ClaimsStageHistoryItem {
  stage: string
  completed_at: string
}

export interface ClaimsPipelineStageLogItem {
  stage: string
  status: string
  timestamp: string
}

export interface ClaimsCessionDetailPayload {
  file_id: string
  filename: string
  cedent: string
  cedent_id: string | null
  contract_id: string | null
  file_type: string
  records: number
  stage: string
  current_step: string
  stage_history: ClaimsStageHistoryItem[]
  detection: ClaimsDetectionPayload
  contract_mapping: ClaimsContractMappingPayload
  clauses: ClaimsClausesPayload
  validation: ClaimsValidationPayload
  exceptions: ClaimsExceptionsPayload
  process: ClaimsProcessPayload
  summary: ClaimsSummaryPayload
  downstream_files: ClaimsDownstreamFilesPayload
  worklist: ClaimsWorklistPayload
  audit: ClaimsAuditPayload
}

export interface ClaimsUploadResponse {
  file_id: string
  status: string
  pipeline_session_id: string
  next_stage: string
}

export interface ClaimsPipelineStageResponse {
  file_id: string
  stage: string
  result?: unknown
  clauses_checked?: ClaimsClause[]
}

export interface ClaimsPipelineStatusPayload {
  file_id: string
  current_stage: string
  pct_complete: number
  stage_log: ClaimsPipelineStageLogItem[]
}

export interface ClaimsSettlementMetrics {
  pending_approval: number
  pending_amount: number
  paid_ytd: number
  dispute_count: number
}

export interface ClaimsSettlementListItem {
  settlement_id: string
  settlement_display_id?: string
  contract_id: string | null
  contract_display_id?: string | null
  contract_name: string
  contract_version?: string
  cedent_id: string | null
  cedent_name: string
  period_label: string
  fixed_leg: number
  floating_leg: number
  net_amount: number
  currency: string
  direction: string
  payment_due: string
  status: string
  iris_recommendation?: 'accept' | 'adjust' | 'review'
}

export interface ClaimsSettlementListPayload {
  metrics: ClaimsSettlementMetrics
  items: ClaimsSettlementListItem[]
}

export interface ClaimsSettlementVarianceReview {
  confidence: number
  classification: string
  threshold: number
  breach: boolean
  variance_pct: number
  root_cause: string
  historical_comparison: string
  rationale: string
  recommendation: string
}

export interface ClaimsSettlementContributor {
  member_id: string
  member_name: string
  event: string
  event_date: string
  impact: number
  is_late: boolean
}

export interface ClaimsSettlementWorkflowStep {
  stage: string
  owner: string
  rule: string
  status: string
  updated_at: string
}

export interface ClaimsSettlementDetailPayload {
  settlement_id: string
  settlement_display_id?: string
  contract_id: string | null
  contract_display_id?: string | null
  contract_name: string
  contract_version: string
  cedent_id: string | null
  cedent_name: string
  period_label: string
  period_start: string | null
  period_end: string | null
  currency: string
  direction: string
  payment_due: string
  status: string
  source: string
  last_updated: string
  fixed_leg: number
  floating_leg: number
  net_amount: number
  variance_review: ClaimsSettlementVarianceReview
  contributors: ClaimsSettlementContributor[]
  approval_workflow: ClaimsSettlementWorkflowStep[]
  audit_trail: ClaimsAuditEvent[]
  notes: string | null
  dispute_reason: string | null
  approved_at: string | null
}

export interface ClaimsSettlementApproveResponse {
  settlement_id: string
  status: string
  approved_at: string
}

export interface ClaimsSettlementDisputeResponse {
  settlement_id: string
  status: string
  disputed_at: string
}

export interface ClaimsSettlementHoldResponse {
  settlement_id: string
  status: string
  held_at: string
}

export interface ClaimsCalculationContractOption {
  contract_id: string
  contract_name: string
  contract_version: string
  cedent_id: string | null
  cedent_name: string
  currency: string
  status: string
  valuation_date: string | null
  assumption_snapshot: string
}

export interface ClaimsCalculationResult {
  calculation_id: string
  contract_id: string
  period: string
  fixed_leg: number
  floating_leg: number
  net: number
  ae_ratio: number
  lives_start: number
  deaths_actual: number
  deaths_expected: number
  bel_current: number
  bel_previous: number
  bel_change: number
}

export type OperationsStepId =
  | 'normalization'
  | 'calculations'
  | 'variance_analysis'
  | 'screening'
  | 'ai_decision'
  | 'outcome'

export interface OperationsPipelineListItem {
  process_id: string
  filename: string
  cedent: string
  cedent_id: string | null
  received_at: string
  priority: string
  current_step: string
  current_step_id: OperationsStepId
  pipeline_health: string
  period?: string | null
}

export interface OperationsPipelinesPayload {
  active_pipelines: OperationsPipelineListItem[]
}

export interface OperationsPipelineStep {
  id: OperationsStepId
  label: string
  subtitle: string
  status: 'pending' | 'in_progress' | 'complete'
}

export interface OperationsActionLogItem {
  timestamp: string
  action: string
  step: string
  decision: string
  notes: string
}

export interface OperationsPipelinePayload {
  process_id: string
  filename: string
  cedent: string
  cedent_id: string | null
  received_at: string
  priority: string
  period: string | null
  pipeline_health: string
  current_step: string
  current_step_id: OperationsStepId
  total_records?: number | null
  affected_records?: number | null
  aborted: boolean
  steps: OperationsPipelineStep[]
  action_log: OperationsActionLogItem[]
  last_action_at?: string | null
}

export interface OperationsNormalizationInputRow {
  'RED ID': string
  'First Name': string
  'Last Name': string
  DOB: string
  'Monthly Pension': string
  Gender: string
  'Spouse Flag': string
  'Event Type': string
  'Event Date': string
  dob_issue?: boolean
}

export interface OperationsNormalizationMappingRow {
  source_field: string
  target_field: string
  transformation: string
}

export interface OperationsNormalizationRule {
  title: string
  body: string
}

export interface OperationsValidationFieldRow {
  field_name: string
  checked: number
  issues: number
  corrected: number
  inferred: number
  status: string
  method_used: string
}

export interface OperationsValidationRiskIndicators {
  imputed_count: number
  inferred_count: number
  confidence: number
  risk_level: string
}

export interface OperationsNormalizedOutputRow {
  member_id: string
  full_name: string
  dob: string
  age: number | string
  monthly_pension: number
  gender: string
  spouse_flag: string
  event_type: string
  event_date: string
}

export interface OperationsNormalizationPayload {
  process_id: string
  filename: string
  cedent: string
  period: string
  started_at: string
  tabs: string[]
  input_preview: {
    total_pages: number
    columns: string[]
    rows: OperationsNormalizationInputRow[]
  }
  column_mapping: OperationsNormalizationMappingRow[]
  normalization_rules: OperationsNormalizationRule[]
  validation: {
    total_fields: number
    fields_with_issues: number
    fields_corrected: number
    fields_inferred: number
    field_validations: OperationsValidationFieldRow[]
    risk_indicators: OperationsValidationRiskIndicators
    filter_pills: string[]
    actions: string[]
  }
  normalized_output: {
    columns: string[]
    rows: OperationsNormalizedOutputRow[]
  }
  step: OperationsPipelineStep
}

export interface OperationsCalculationsPayload {
  process_id: string
  title: string
  subtitle: string
  fixed_leg_amount: number
  floating_leg_amount: number
  net_position: number
  net_direction: string
  currency: string
  pricing_basis: string
  fixed_leg: {
    rate: number
    notional: number
    day_count: string
    period: string
  }
  floating_leg: {
    observed_mortality_rate: number
    source: string
    notional: number
    period: string
  }
  insights: string[]
  step: OperationsPipelineStep
}

export interface OperationsVarianceBreakdownRow {
  component: string
  expected: number
  observed: number
  variance: number
}

export interface OperationsVariancePayload {
  process_id: string
  title: string
  subtitle: string
  portfolio_variance_pct: number
  threshold_pct: number
  breach_status: string
  impact_amount: number
  impact_currency: string
  breakdown: OperationsVarianceBreakdownRow[]
  insights: string[]
  actions: string[]
  step: OperationsPipelineStep
}

export interface OperationsScreeningMatchRow {
  screening_ref: string
  entity_name: string
  dob: string | null
  member_id: string | null
  match_type: string
  source: string
  confidence: number
  status: string
}

export interface OperationsScreeningEntity {
  screening_ref: string
  entity_name: string
  dob: string | null
  cedent_id: string | null
  member_id: string | null
  trigger_type: string
  cession_file_id: string
}

export interface OperationsScreeningPayload {
  process_id: string
  title: string
  subtitle: string
  entities_screened: number
  matches_found: number
  false_positives: number
  critical_alerts: number
  match_table: OperationsScreeningMatchRow[]
  entities: OperationsScreeningEntity[]
  insight: string
  step: OperationsPipelineStep
}

export interface ComplianceScreenEntityResponse {
  screening_ref: string
  entity_name: string
  result: string
  matched_lists: string[]
  llm_called: boolean
  llm_confidence: number
  llm_reasoning: string
  method: string
  source?: string
  trigger_type?: string
  cedent_id?: string | null
  member_id?: string | null
  cession_file_id?: string | null
  sources_screened?: string[]
  identity_context?: ComplianceCedentIdentityContext | null
  identity_match_summary?: ComplianceIdentityMatchSummaryItem[]
}

export interface OperationsAIDecisionPanelItem {
  status: string
  text: string
}

export interface OperationsAIDecisionFlag {
  severity: string
  text: string
}

export interface OperationsAIDecisionPayload {
  process_id: string
  title: string
  subtitle: string
  confidence_score: number
  risk_level: string
  decision: string
  human_review_required: boolean
  decision_panel: OperationsAIDecisionPanelItem[]
  flags: OperationsAIDecisionFlag[]
  actions: string[]
  step: OperationsPipelineStep
}

export interface OperationsOutcomePayload {
  process_id: string
  title: string
  subtitle: string
  final_status: string
  settlement_amount: number
  settlement_currency: string
  approval_required: boolean
  sla_status: string
  summary: {
    contract: string
    total_records: number
    issues_resolved: boolean
    compliance: string
  }
  actions: string[]
  step: OperationsPipelineStep
}

export interface ChatbotConversationEntry {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatbotResponsePayload {
  response: string
  navigation_action: string | null
  sql_query_used: string | null
  sources: string[]
}

export interface SanctionsWorkspaceKpi {
  id: string
  label: string
  value: number
  subtitle: string
  tone: 'default' | 'positive' | 'negative' | string
  suffix?: string
}

export interface SanctionsWorkspaceTab {
  key: 'all_cases' | 'pending_review' | 'auto_cleared' | 'blocked' | 'historical' | string
  label: string
  count: number
}

export interface SanctionsWorkspaceCase {
  screening_ref: string
  entity_name: string
  entity_subtitle: string
  trigger: string
  watchlists: string[]
  matches_count: number
  risk_label: string
  risk_score: number
  confidence_pct: number
  ai_recommendation: string
  status: string
  started_at: string
  processing_seconds: number
  country: string
}

export interface ComplianceActiveHit {
  screening_ref: string
  hit_id: string
  entity: string
  cedent_id: string
  cedent_name: string
  member_id: string | null
  match_type: string
  source: string
  confidence: number
  matched_on: string
  status: string
  reasoning: string
  resolution_notes?: string | null
  resolved_at?: string | null
  identity_context?: ComplianceCedentIdentityContext | null
  identity_match_summary?: ComplianceIdentityMatchSummaryItem[]
}

export interface ComplianceScreeningCacheWorkbookEntry {
  entity_name: string
  aliases: string[]
  list_identifier: string
  entity_type: string
  country: string
  street_address: string
  city: string
  postal_code: string
  tax_identification_number: string
  company_registration_number: string
  dob: string
}

export interface ComplianceScreeningCacheWorkbook {
  list_name: string
  display_name: string
  provider: string
  record_count: number
  last_sync: string
  status: string
  filename: string
  entries: ComplianceScreeningCacheWorkbookEntry[]
}

export interface ComplianceCedentIdentityContext {
  cedent_id: string
  name: string
  trading_name?: string | null
  street_address: string
  city: string
  postal_code: string
  country: string
  ssn_tin: string
  uk_company_registration_number: string
  source: string
}

export interface ComplianceIdentityMatchSummaryItem {
  field: string
  cedent_value: string
  watchlist_value: string
  status: 'match' | 'mismatch' | 'missing' | string
}

export interface ComplianceSanctionsOverviewPayload {
  title: string
  subtitle: string
  workspace_note: string
  kpis: SanctionsWorkspaceKpi[]
  tabs: SanctionsWorkspaceTab[]
  filters: {
    trigger_options: string[]
    country_options: string[]
  }
  screening_cache_workbooks: ComplianceScreeningCacheWorkbook[]
  cases: SanctionsWorkspaceCase[]
}

export interface ComplianceActiveHitsPayload {
  total: number
  items: ComplianceActiveHit[]
}

export interface ComplianceCedentScreeningPayload {
  cedent_id: string
  cedent_name: string
  screening_status: string
  sanction_screening: SanctionScreeningSection
  identity_context?: ComplianceCedentIdentityContext | null
}

export interface ComplianceBulkScreeningResponse {
  screening_run_id: string
  scope: string
  sources: string[]
  cedents_screened: number
  cedent_ids: string[]
  status: string
}

export interface ComplianceBulkScreeningJobResponse {
  job_id: string
  status: string
  estimated_duration_seconds: number
}

export interface SanctionsCaseEntitySection {
  entity_name: string
  aliases: string[]
  registration_number: string
  registered_address: string
  country: string
  entity_descriptor: string
  bank_details: string
  beneficial_owners: string[]
  identity_context?: ComplianceCedentIdentityContext | null
}

export interface SanctionsCaseSummary {
  headline: string
  description: string
  tone: 'positive' | 'warning' | 'negative' | string
}

export interface SanctionsCaseFieldScore {
  label: string
  value: number
}

export interface SanctionsCaseRawMatch {
  title: string
  candidate_name: string
  candidate_id: string
  subtitle: string
  country: string
  entity_type: string
  aggregate_score: number
  field_scores: SanctionsCaseFieldScore[]
}

export interface SanctionsCaseAnalysisFactor {
  text: string
  weight_pct: number
  tone: 'positive' | 'negative' | string
}

export interface SanctionsCaseAnalysisCheck {
  label: string
  passed: boolean
}

export interface SanctionsCaseAnalysis {
  label: string
  confidence_pct: number
  headline: string
  body: string
  factors: SanctionsCaseAnalysisFactor[]
  checks: SanctionsCaseAnalysisCheck[]
  recommended_action: string
}

export interface SanctionsCaseSimpleItem {
  label: string
  value: string
}

export interface SanctionsCaseDecisionHistory {
  times_reviewed: number
  last_verdict: string
  note: string
  entries: Array<{
    period: string
    screening_scope: string
    screened_on: string
    watchlists: string
    decision: string
    rationale: string
  }>
}

export interface SanctionsCaseAdverseMedia {
  severity: string
  note: string
  summary_line?: string
  sources_checked?: string[]
  last_checked?: string
  records: Array<{
    published_at: string
    source: string
    headline: string
    summary: string
  }>
}

export interface SanctionsCaseAuditEvent {
  timestamp: string
  actor: string
  actor_type: string
  detail: string
}

export interface ComplianceSanctionsCaseDetailPayload {
  screening_ref: string
  entity_name: string
  title: string
  subtitle: string
  status: string
  trigger: string
  watchlists_screened: string[]
  started_at: string
  processing_seconds: number
  entity_under_screening: SanctionsCaseEntitySection
  summary: SanctionsCaseSummary
  raw_match: SanctionsCaseRawMatch | null
  analysis: SanctionsCaseAnalysis | null
  network_analysis: {
    items: SanctionsCaseSimpleItem[]
    note: string
  }
  decision_history: SanctionsCaseDecisionHistory
  adverse_media: SanctionsCaseAdverseMedia
  audit_trail: SanctionsCaseAuditEvent[]
  sources_screened?: string[]
}

export interface ComplianceHitResolutionResponse {
  screening_ref: string
  status: string
  action: string
  resolved_at: string
  notes: string | null
}

export interface AuditEventItem {
  audit_id: string
  timestamp: string
  module: string
  event_type: string
  actor_type: string
  actor_id: string
  entity_id: string
  entity_type: string
  description: string
  financial_impact_amount: number | null
  financial_impact_currency: string | null
  is_high_impact: boolean
  approval_status: string
  risk_level: string
  channel: string
  dashboard_high_impact: boolean
  document_history: boolean
}

export interface AuditEventListPayload {
  total: number
  items: AuditEventItem[]
}

export interface AuditSearchPayload extends AuditEventListPayload {
  page: number
  page_size: number
}

export interface AuditDashboardKpis {
  audit_events_today: number
  pct_change_vs_7d: number
  high_risk_changes: number
  high_risk_critical: number
  pending_approvals: number
  oldest_pending_hours: number
  manual_overrides: number
  ai_decisions_pending_review: number
  ai_below_confidence: number
  failed_screenings: number
  high_financial_impact: number
}

export interface AuditAIDecision {
  agent_name: string
  agent_version: string
  module: string
  confidence: number
  below_threshold: boolean
  decision: string
  prompt_summary: string
  input_ref: string
  human_review_required: boolean
  timestamp: string
}

export interface AuditDashboardPayload {
  kpis: AuditDashboardKpis
  timeline: AuditEventItem[]
  high_impact_changes: AuditEventItem[]
  ai_pending_review: AuditAIDecision[]
}

export interface AuditAIDecisionKpis {
  ai_decisions_logged: number
  below_confidence_floor: number
  human_overrides: number
}

export interface AuditAIDecisionPayload {
  kpis: AuditAIDecisionKpis
  decisions: AuditAIDecision[]
}

export interface AuditManualOverride {
  override_ref: string
  module: string
  entity_id: string
  field_name: string
  original_value: string
  override_value: string
  reason: string
  financial_impact_amount: number
  financial_impact_currency: string
  approver_role: string
  approver_title: string
  approver_id: string
  approved_at: string
}

export interface AuditManualOverridesPayload {
  total: number
  overrides: AuditManualOverride[]
}

export interface AuditExportReportItem {
  name: string
  description: string
  formats: string[]
}

export interface AuditExportReportsPayload {
  reports: AuditExportReportItem[]
}

export type ReportCategory = 'All' | 'Historical' | 'Dynamic' | 'Debugging' | 'Movement' | 'Compliance' | 'Financial' | 'Admin'

export interface ReportsCategoryCount {
  category: ReportCategory
  label: string
  count: number
}

export interface ReportsCatalogItem {
  report_id: string
  name: string
  description: string
  category: Exclude<ReportCategory, 'All'>
  cadence: string
  distribution: string[]
  sensitivity: 'Standard' | 'Sensitive'
  is_accessible: boolean
}

export interface ReportsCatalogPayload {
  total: number
  categories: ReportsCategoryCount[]
  items: ReportsCatalogItem[]
}

export interface ReportDetailMetric {
  label: string
  value: string
  subtitle: string
  tone: 'default' | 'positive' | 'negative' | 'warning'
}

export interface ReportPreviewTable {
  columns: string[]
  rows: Array<Record<string, string>>
}

export interface ReportDetailPayload extends ReportsCatalogItem {
  insight: string
  metrics: ReportDetailMetric[]
  graph: GraphConfig | null
  table: ReportPreviewTable
  notes: string[]
}

export interface SettlementReportArtifact {
  artifact_id: string
  settlement_id: string
  cession_file_id: string
  contract_id: string
  cedent: string
  period: string
  report_type: string
  filename: string
  format: string
  generated_at: string
  source_filename: string
  reconciliation_decision: 'accept' | 'review'
  mismatch_count: number
}

export interface SettlementReportArtifactsPayload {
  total: number
  items: SettlementReportArtifact[]
}

export interface AdminUserRecord {
  id: string
  full_name: string | null
  email: string
  role: AppRole
  status: 'active' | 'invited' | 'suspended' | 'inactive'
  last_login: string | null
}

export interface AdminUsersPayload {
  total: number
  users: AdminUserRecord[]
}

export interface AdminCreateUserResponse {
  id: string
  email: string
  role: AppRole
  status: string
  temp_password: string
}

export interface AdminPermissionRow {
  module: string
  view: string[]
  edit: string[]
  approve: string[]
  override: string[]
}

export interface AdminPermissionsPayload {
  items: AdminPermissionRow[]
}

export interface AdminApprovalMatrixRow {
  action: string
  threshold: string
  required_approvers: string
}

export interface AdminApprovalMatrixPayload {
  items: AdminApprovalMatrixRow[]
}

export interface AdminAccessLogItem {
  timestamp: string
  user: string
  resource: string
  action: string
  ip: string
}

export interface AdminAccessLogsPayload {
  total: number
  items: AdminAccessLogItem[]
}

export interface AdminLibraryItem {
  ref_id?: string
  data_type?: string
  code?: string
  name?: string
  fx_to_usd?: number
  as_of?: string
  source?: string
  version?: string
  effective_date?: string
  status?: string
  contracts_using?: number
  is_locked?: boolean
  currency?: string
  tenors?: number
  mortality?: string
  curve?: string
  inflation?: string
  used_by?: string
  template?: string
  cedant?: string
  fields?: number
  format?: string
  data_payload?: Record<string, unknown>
  list_name?: string
  provider?: string
  records?: number
  last_sync?: string
}

export interface AdminLibraryPayload {
  type: string
  items: AdminLibraryItem[]
}

export interface AdminLibraryUploadResponse {
  ref_id: string
  status: string
  data_type: string
}

export interface AdminScreeningCacheSyncResponse {
  list_name: string
  status: string
  message: string
}
