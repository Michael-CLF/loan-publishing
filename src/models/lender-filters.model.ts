// src/app/models/lender-filters.model.ts
export interface LenderFilters {
  lenderType: string;
  propertyCategory: string;
  state: string;
  loanAmount: string;
  loanType: string;
}

export interface FilterOption {
  value: string;
  name: string;
}
