export type ContractEditableSectionKey =
  | 'master_data'
  | 'economic_terms'
  | 'reference_pool'
  | 'actuarial_basis'
  | 'risk_limits'
  | 'operational_terms'
  | 'compliance_docs'

export type ContractSectionKey =
  | ContractEditableSectionKey
  | 'audit_approval'
  | 'details_performance'
  | 'member_list'
  | 'file_templates'
  | 'amendments'
  | 'calculations'
  | 'audit_compliance'

export interface FieldOption {
  label: string
  value: string
}

export interface FieldConfig {
  key: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'date' | 'number' | 'checkbox' | 'email'
  options?: FieldOption[]
  colSpan?: 1 | 2 | 3
  readOnly?: boolean
}

export interface ContractSectionNavItem {
  key: ContractSectionKey
  title: string
  index: string
  group: 'Master Data' | 'Operations'
  editable: boolean
}

export const contractDetailSections: ContractSectionNavItem[] = [
  { key: 'master_data', title: 'Master Data', index: '01', group: 'Master Data', editable: true },
  { key: 'economic_terms', title: 'Economic Terms', index: '02', group: 'Master Data', editable: true },
  { key: 'reference_pool', title: 'Reference Pool', index: '03', group: 'Master Data', editable: true },
  { key: 'actuarial_basis', title: 'Actuarial Basis', index: '04', group: 'Master Data', editable: true },
  { key: 'risk_limits', title: 'Risk & Limits', index: '05', group: 'Master Data', editable: true },
  { key: 'operational_terms', title: 'Operational Terms', index: '06', group: 'Master Data', editable: true },
  { key: 'compliance_docs', title: 'Compliance & Docs', index: '07', group: 'Master Data', editable: true },
  { key: 'audit_approval', title: 'Audit & Approval', index: '08', group: 'Master Data', editable: false },
  { key: 'details_performance', title: 'Details & Performance', index: 'A', group: 'Operations', editable: false },
  { key: 'member_list', title: 'Member List', index: 'B', group: 'Operations', editable: false },
  { key: 'file_templates', title: 'File Templates', index: 'C', group: 'Operations', editable: false },
  { key: 'amendments', title: 'Amendments', index: 'D', group: 'Operations', editable: false },
  { key: 'calculations', title: 'Calculations', index: 'E', group: 'Operations', editable: false },
  { key: 'audit_compliance', title: 'Audit & Compliance', index: 'F', group: 'Operations', editable: false },
]

export const contractSectionRouteMap: Record<ContractEditableSectionKey, string> = {
  master_data: 'master-data',
  economic_terms: 'economic-terms',
  reference_pool: 'reference-pool',
  actuarial_basis: 'actuarial-basis',
  risk_limits: 'risk-limits',
  operational_terms: 'operational-terms',
  compliance_docs: 'compliance-docs',
}

const counterpartyRoleOptions: FieldOption[] = [
  { label: 'Reinsurer', value: 'Reinsurer' },
  { label: 'Cedant', value: 'Cedant' },
]

const swapTypeOptions: FieldOption[] = [
  { label: 'Indemnity', value: 'Indemnity' },
  { label: 'Funded', value: 'Funded' },
  { label: 'Parametric', value: 'Parametric' },
]

const structureOptions: FieldOption[] = [
  { label: 'Single tranche', value: 'Single tranche' },
  { label: 'Multi-tranche', value: 'Multi-tranche' },
]

const contractStatusOptions: FieldOption[] = [
  { label: 'Draft', value: 'draft' },
  { label: 'Active', value: 'active' },
  { label: 'Suspended', value: 'suspended' },
  { label: 'Terminated', value: 'terminated' },
  { label: 'Run-off', value: 'run-off' },
]

const currencyOptions: FieldOption[] = [
  { label: 'GBP', value: 'GBP' },
  { label: 'CHF', value: 'CHF' },
  { label: 'EUR', value: 'EUR' },
  { label: 'USD', value: 'USD' },
  { label: 'CAD', value: 'CAD' },
]

const frequencyOptions: FieldOption[] = [
  { label: 'Monthly', value: 'Monthly' },
  { label: 'Quarterly', value: 'Quarterly' },
  { label: 'Annual', value: 'Annual' },
]

const benefitTypeOptions: FieldOption[] = [
  { label: 'Defined Benefit', value: 'Defined Benefit' },
  { label: 'Defined Contribution', value: 'Defined Contribution' },
  { label: 'Hybrid', value: 'Hybrid' },
]

const closedOpenOptions: FieldOption[] = [
  { label: 'Closed', value: 'Closed' },
  { label: 'Open', value: 'Open' },
]

const fileFormatOptions: FieldOption[] = [
  { label: 'CSV', value: 'CSV' },
  { label: 'XLSX', value: 'XLSX' },
  { label: 'XML', value: 'XML' },
]

export const calculationMetricOptions: FieldOption[] = [
  { label: 'Settlement Variance', value: 'settlement_variance' },
  { label: 'Fixed Leg Total', value: 'fixed_leg_total' },
  { label: 'Floating Leg Total', value: 'floating_leg_total' },
  { label: 'A/E Ratio', value: 'ae_ratio' },
]

export const calculationAggregationOptions: FieldOption[] = [
  { label: 'Sum', value: 'sum' },
  { label: 'Average', value: 'avg' },
  { label: 'Min', value: 'min' },
  { label: 'Max', value: 'max' },
]

export const calculationGroupByOptions: FieldOption[] = [
  { label: 'Per Quarter', value: 'per_quarter' },
  { label: 'Per Year', value: 'per_year' },
  { label: 'Total', value: 'total' },
]

export const memberStatusOptions: FieldOption[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Deferred', value: 'deferred' },
  { label: 'Deceased', value: 'deceased' },
]

export const amendmentTypeOptions: FieldOption[] = [
  { label: 'Notional', value: 'Notional' },
  { label: 'Rate', value: 'Rate' },
  { label: 'Pool', value: 'Pool' },
  { label: 'Operational', value: 'Operational' },
  { label: 'Other', value: 'Other' },
]

export const amendmentSectionOptions: Array<{ label: string; value: string }> = [
  { label: 'Economic Terms', value: 'economic_terms' },
  { label: 'Risk & Limits', value: 'risk_limits' },
  { label: 'Operational Terms', value: 'operational_terms' },
  { label: 'Reference Pool', value: 'reference_pool' },
]

export const masterDataFields: FieldConfig[] = [
  { key: 'contract_id', label: 'Contract ID', type: 'text', readOnly: true },
  { key: 'contract_name', label: 'Contract Name', type: 'text' },
  { key: 'contract_version', label: 'Contract Version', type: 'text', readOnly: true },
  { key: 'cedent_id', label: 'Cedant ID', type: 'text' },
  { key: 'cedent_name', label: 'Cedant', type: 'text', readOnly: true },
  { key: 'counterparty_role', label: 'Counterparty Role', type: 'select', options: counterpartyRoleOptions },
  { key: 'parent_contract_id', label: 'Parent Contract', type: 'text' },
  { key: 'swap_type', label: 'Swap Type', type: 'select', options: swapTypeOptions },
  { key: 'structure', label: 'Structure', type: 'select', options: structureOptions },
  { key: 'master_agreement_reference', label: 'Master Agreement Reference', type: 'text' },
  { key: 'inception_date', label: 'Inception Date', type: 'date' },
  { key: 'effective_date', label: 'Effective Date', type: 'date' },
  { key: 'maturity_date', label: 'Maturity Date', type: 'date' },
  { key: 'duration_years', label: 'Duration (years)', type: 'number' },
  { key: 'governing_law', label: 'Governing Law', type: 'text' },
  { key: 'jurisdiction', label: 'Jurisdiction', type: 'text' },
  { key: 'status', label: 'Status', type: 'select', options: contractStatusOptions },
]

export const economicTermsFields: FieldConfig[] = [
  { key: 'notional_amount', label: 'Notional Amount', type: 'number' },
  { key: 'currency', label: 'Currency', type: 'select', options: currencyOptions },
  { key: 'settlement_currency', label: 'Settlement Currency', type: 'select', options: currencyOptions },
  { key: 'fixed_leg_rate_pct', label: 'Fixed Leg Rate (%)', type: 'number' },
  { key: 'fixed_leg_basis', label: 'Fixed Leg Basis', type: 'text' },
  { key: 'fixed_leg_frequency', label: 'Fixed Leg Frequency', type: 'select', options: frequencyOptions },
  { key: 'floating_leg_definition', label: 'Floating Leg Definition', type: 'text' },
  { key: 'floating_leg_index_table', label: 'Floating Leg Index / Table', type: 'text' },
  { key: 'floating_leg_frequency', label: 'Floating Leg Frequency', type: 'select', options: frequencyOptions },
  { key: 'payment_lag_days', label: 'Payment Lag (days)', type: 'number' },
  { key: 'fx_reference_source', label: 'FX Reference Source', type: 'text' },
  { key: 'collateral_required', label: 'Collateral Required', type: 'checkbox' },
  { key: 'collateral_threshold', label: 'Collateral Threshold', type: 'number' },
  { key: 'independent_amount', label: 'Independent Amount', type: 'number' },
  { key: 'is_locked', label: 'Section Locked', type: 'checkbox', readOnly: true },
]

export const referencePoolFields: FieldConfig[] = [
  { key: 'pool_name', label: 'Pool Name', type: 'text' },
  { key: 'lives_covered', label: 'Lives Covered', type: 'number' },
  { key: 'average_age', label: 'Average Age', type: 'number' },
  { key: 'male_female_split', label: 'Male / Female Split', type: 'text' },
  { key: 'average_pension_amount', label: 'Average Pension Amount', type: 'number' },
  { key: 'pool_currency', label: 'Pool Currency', type: 'select', options: currencyOptions },
  { key: 'geographic_concentration', label: 'Geographic Concentration', type: 'textarea', colSpan: 3 },
  { key: 'benefit_type', label: 'Benefit Type', type: 'select', options: benefitTypeOptions },
  { key: 'indexation_basis', label: 'Indexation Basis', type: 'text' },
  { key: 'closed_open', label: 'Closed / Open', type: 'select', options: closedOpenOptions },
  { key: 'data_as_of', label: 'Data As Of', type: 'date' },
  { key: 'data_source_reference', label: 'Data Source Reference', type: 'text', colSpan: 2 },
]

export const actuarialBasisFields: FieldConfig[] = [
  { key: 'mortality_table_id', label: 'Mortality Table ID', type: 'text' },
  { key: 'mortality_table_name', label: 'Mortality Table Name', type: 'text' },
  { key: 'mortality_improvement_scale', label: 'Mortality Improvement Scale', type: 'textarea', colSpan: 3 },
  { key: 'discount_curve_id', label: 'Discount Curve ID', type: 'text' },
  { key: 'discount_curve_source', label: 'Discount Curve Source', type: 'text' },
  { key: 'inflation_assumption', label: 'Inflation Assumption', type: 'text' },
  { key: 'longevity_loading_pct', label: 'Longevity Loading (%)', type: 'number' },
  { key: 'expense_loading_pct', label: 'Expense Loading (%)', type: 'number' },
  { key: 'assumption_set_id', label: 'Assumption Set ID', type: 'text' },
  { key: 'last_revaluation', label: 'Last Revaluation', type: 'date' },
  { key: 'next_revaluation_due', label: 'Next Revaluation Due', type: 'date' },
]

export const riskLimitsFields: FieldConfig[] = [
  { key: 'max_loss_limit', label: 'Max Loss Limit', type: 'number' },
  { key: 'aggregate_limit', label: 'Aggregate Limit', type: 'number' },
  { key: 'deductible', label: 'Deductible', type: 'number' },
  { key: 'catastrophe_cap', label: 'Catastrophe Cap', type: 'number' },
  { key: 'rating_downgrade_trigger', label: 'Rating Downgrade Trigger', type: 'text' },
  { key: 'risk_committee_approval_required', label: 'Risk Committee Approval Required', type: 'checkbox' },
  { key: 'early_termination_event', label: 'Early Termination Event', type: 'textarea', colSpan: 3 },
  { key: 'novation_rights', label: 'Novation Rights', type: 'textarea', colSpan: 3 },
  { key: 'cedant_change_of_control', label: 'Cedant Change of Control', type: 'textarea', colSpan: 3 },
]

export const operationalTermsFields: FieldConfig[] = [
  { key: 'settlement_calendar', label: 'Settlement Calendar', type: 'text' },
  { key: 'cession_file_format', label: 'Cession File Format', type: 'select', options: fileFormatOptions },
  { key: 'cession_file_frequency', label: 'Cession File Frequency', type: 'select', options: frequencyOptions },
  { key: 'sftp_endpoint_id', label: 'SFTP Endpoint ID', type: 'text' },
  { key: 'encryption_method', label: 'Encryption Method', type: 'text' },
  { key: 'reporting_package', label: 'Reporting Package', type: 'text' },
  { key: 'lead_underwriter', label: 'Lead Underwriter', type: 'email' },
  { key: 'operations_contact', label: 'Operations Contact', type: 'email' },
  { key: 'legal_contact', label: 'Legal Contact', type: 'email' },
]

export function createEmptyComplianceDoc() {
  return {
    doc_type: '',
    doc_name: '',
    doc_date: '',
    status: 'draft',
    file_name: '',
  }
}
