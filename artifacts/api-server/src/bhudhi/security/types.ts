export interface SecurityValidationResult {
  valid: boolean;
  violations: string[];
}

export interface SecurityChecks {
  budgetOk: boolean;
  riskOk: boolean;
  adoptionOk: boolean;
  alignmentOk: boolean;
  complianceOk: boolean;
}
