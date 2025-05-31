// src/app/shared/constants/lender-type-mappings.ts

// Lender type mappings (for productInfo.lenderTypes)
export const LENDER_TYPES: Record<string, string> = {
  agency: 'Agency Lender',
  balanceSheet: 'Balance Sheet',
  balance_sheet: 'Balance Sheet',
  bank: 'Bank',
  bridge_lender: 'Bridge Lender',
  cdfi: 'CDFI Lender',
  conduit_lender: 'Conduit Lender (CMBS)',
  construction_lender: 'Construction Lender',
  correspondent_lender: 'Correspondent Lender',
  credit_union: 'Credit Union',
  crowdfunding: 'Crowdfunding Platform',
  direct_lender: 'Direct Lender',
  family_office: 'Family Office',
  hard_money: 'Hard Money Lender',
  life_insurance: 'Life Insurance Lender',
  mezzanine_lender: 'Mezzanine Lender',
  non_qm_lender: 'Non-QM Lender',
  portfolio_lender: 'Portfolio Lender',
  private_lender: 'Private Lender',
  sba: 'SBA Lender',
  usda: 'USDA Lender',
  general: 'General Lender',
};

// Loan type mappings (for productInfo.loanTypes)
export const LOAN_TYPES: Record<string, string> = {
  agency: 'Agency Loans',
  balance_sheet: 'Balance Sheet',
  bridge: 'Bridge Loans',
  cmbs: 'CMBS Loans',
  commercial: 'Commercial Loans',
  construction: 'Construction Loans',
  general: 'General',
  hard_money: 'Hard Money Loans',
  mezzanine: 'Mezzanine Loans',
  'non-qm': 'Non-QM Loans',
  non_qm: 'Non-QM Loans',
  rehab: 'Rehab Loans',
  renovation: 'Renovation Loans',
  sba: 'SBA Loans',
  sba7a: 'SBA 7(a)',
  sba504: 'SBA 504',
  usda: 'USDA Loans',
  
  // Transaction types
  purchase: 'Purchase',
  refinance: 'Refinance',
  cash_out_refinance: 'Cash-Out Refinance',
  
  // Additional loan types from your constants
  'fix & flip': 'Fix & Flip',
  fixFlip: 'Fix & Flip',
  'new construction': 'New Construction',
  'rehab/renovation': 'Rehab/Renovation',
  
  // Handle variations in casing
  Purchase: 'Purchase',
  Refinance: 'Refinance',
  Construction: 'Construction Loans',
  Bridge: 'Bridge Loans',
  SBA: 'SBA Loans',
  USDA: 'USDA Loans',
  'Hard Money': 'Hard Money Loans',
  Conventional: 'Conventional Loans',
  Mezzanine: 'Mezzanine Loans',
};

// Transaction type mappings (for loan forms)
export const TRANSACTION_TYPES: Record<string, string> = {
  purchase: 'Purchase',
  refinance: 'Refinance',
  cash_out_refinance: 'Cash-Out Refinance',
  rate_and_term_refinance: 'Rate & Term Refinance',
};

// Utility functions
export function getLenderTypeName(value: string): string {
  return LENDER_TYPES[value] || formatFallbackName(value);
}

export function getLoanTypeName(value: string): string {
  return LOAN_TYPES[value] || formatFallbackName(value);
}

export function getTransactionTypeName(value: string): string {
  return TRANSACTION_TYPES[value] || formatFallbackName(value);
}

// Fallback formatter for unknown values
function formatFallbackName(value: string): string {
  if (!value) return '';
  
  return value
    .replace(/[_-]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Get all available lender types for dropdowns
export function getAllLenderTypes(): Array<{value: string, name: string}> {
  return Object.entries(LENDER_TYPES).map(([value, name]) => ({
    value,
    name
  }));
}

// Get all available loan types for dropdowns
export function getAllLoanTypes(): Array<{value: string, name: string}> {
  return Object.entries(LOAN_TYPES).map(([value, name]) => ({
    value,
    name
  }));
}

// Get all available transaction types for dropdowns
export function getAllTransactionTypes(): Array<{value: string, name: string}> {
  return Object.entries(TRANSACTION_TYPES).map(([value, name]) => ({
    value,
    name
  }));
}