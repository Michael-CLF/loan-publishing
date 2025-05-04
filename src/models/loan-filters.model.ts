// src/app/models/loan-filters.model.ts
export interface LoanFilters {
  propertyTypeCategory: string;
  state: string;
  loanType: string;
  loanAmount: string;
  isFavorite?: boolean;
}
