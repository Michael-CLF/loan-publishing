export interface MortgageInput {
  loanAmount: number;
  interestRate: number;
  loanTerm: number;
  propertyTax: number;
  insurance: number;
}

export interface MortgageResult {
  principalAndInterest: number;
  propertyTax: number;
  insurance: number;
  totalMonthlyPayment: number;
  totalInterestPaid: number;
  totalPaid: number;
  amortizationSchedule: AmortizationEntry[];
}

export interface AmortizationEntry {
  month: number;
  principalPayment: number;
  interestPayment: number;
  totalPayment: number;
  remainingBalance: number;
  totalInterestPaid: number;
}
