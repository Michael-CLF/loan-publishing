/**
 * Interface representing the result of a DSCR calculation
 */
export interface DscrCalculation {
  /**
   * The calculated Debt Service Coverage Ratio value
   */
  dscrValue: number;

  /**
   * Net Operating Income used in calculation
   */
  netOperatingIncome: number;

  /**
   * Total Debt Service used in calculation
   */
  totalDebtService: number;

  /**
   * Loan to Value ratio (optional)
   */
  loanToValueRatio: number | null;

  /**
   * Human-readable interpretation of the DSCR result
   */
  interpretation: string;
}

/**
 * Interface for DSCR calculator form data
 */
export interface DscrFormData {
  netOperatingIncome: number;
  totalDebtService: number;
  propertyValue?: number;
  loanAmount?: number;
}
