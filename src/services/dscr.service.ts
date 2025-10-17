import { Injectable } from '@angular/core';
import { DscrCalculation } from '../models/dscr.model';

@Injectable({
  providedIn: 'root',
})
export class DscrService {
  constructor() {}

  /**
   * Calculate the Debt Service Coverage Ratio (DSCR)
   * @param netOperatingIncome Annual Net Operating Income
   * @param totalDebtService Annual Debt Service
   * @param propertyValue Optional property value for calculating LTV
   * @param loanAmount Optional loan amount for calculating LTV
   * @returns DscrCalculation object with results
   */
  calculateDscr(
    netOperatingIncome: number,
    totalDebtService: number,
    propertyValue?: number,
    loanAmount?: number,
  ): DscrCalculation {
    // Convert inputs to numbers to ensure proper calculation
    const noi = Number(netOperatingIncome);
    const debt = Number(totalDebtService);

    // Calculate DSCR = NOI / Debt Service
    const dscrValue = debt > 0 ? noi / debt : 0;

    // Calculate LTV if both property value and loan amount are provided
    let loanToValueRatio: number | null = null;
    if (propertyValue && loanAmount && propertyValue > 0) {
      loanToValueRatio = Number(loanAmount) / Number(propertyValue);
    }

    // Generate interpretation text based on DSCR value
    const interpretation = this.generateDscrInterpretation(
      dscrValue,
      loanToValueRatio,
    );

    return {
      dscrValue,
      netOperatingIncome: noi,
      totalDebtService: debt,
      loanToValueRatio,
      interpretation,
    };
  }

  /**
   * Generate an interpretation of the DSCR calculation result
   * @param dscrValue The calculated DSCR value
   * @param loanToValueRatio Optional LTV ratio for more detailed interpretation
   * @returns Interpretation text
   */
  private generateDscrInterpretation(
    dscrValue: number,
    loanToValueRatio: number | null,
  ): string {
    let interpretation = '';

    if (dscrValue === 0) {
      return 'Unable to calculate DSCR. Please ensure debt service is greater than zero.';
    }

    if (dscrValue < 1.0) {
      interpretation =
        'Your property is not generating enough income to cover the debt payments. This indicates negative cash flow and high risk. Lenders typically require a minimum DSCR of 1.0.';
    } else if (dscrValue >= 1.0 && dscrValue < 1.25) {
      interpretation =
        'Your property is generating just enough income to cover debt payments. While acceptable to some lenders, this provides limited buffer for unexpected expenses or vacancies.';
    } else if (dscrValue >= 1.25 && dscrValue < 1.5) {
      interpretation =
        'Your property has a good debt coverage ratio. Most lenders consider this a healthy DSCR, indicating the property generates sufficient income to cover debt with a reasonable buffer.';
    } else {
      interpretation =
        'Your property has an excellent debt coverage ratio. This strong cash flow position indicates low risk and a substantial buffer for handling unexpected expenses or vacancies.';
    }

    // Add LTV context if available
    if (loanToValueRatio !== null) {
      const ltvPercent = loanToValueRatio * 100;
      if (loanToValueRatio > 0.8) {
        interpretation += ` Note that your loan-to-value ratio of ${ltvPercent.toFixed(1)}% is relatively high, which may increase lending risk.`;
      } else if (loanToValueRatio < 0.6) {
        interpretation += ` Your loan-to-value ratio of ${ltvPercent.toFixed(1)}% is quite favorable, which reduces overall investment risk.`;
      }
    }

    return interpretation;
  }
}
