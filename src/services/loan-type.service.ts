// loan-type.service.ts
import { Injectable } from '@angular/core';

export interface LoanType {
  value: string;
  name: string;
}

@Injectable({
  providedIn: 'root',
})
export class LoanTypeService {
  private loanTypes: LoanType[] = [
    { value: 'agency', name: 'Agency Loans' },
    { value: 'bridge', name: 'Bridge Loans' },
    { value: 'cmbs', name: 'CMBS Loans' },
    { value: 'commercial', name: 'Commercial Loans' },
    { value: 'construction', name: 'Construction Loans' },
    { value: 'hard_money', name: 'Hard Money Loans' },
    { value: 'mezzanine', name: 'Mezzanine Loan' },
    { value: 'rehab', name: 'Rehab Loans' },
    { value: 'non_qm', name: 'Non-QM Loans' },
    { value: 'sba', name: 'SBA Loans' },
    { value: 'usda', name: 'USDA Loans' },
    { value: 'acquisition', name: 'Acquisition Loan' },
    { value: 'balance_sheet', name: 'Balance Sheet' },
    { value: 'bridge_perm', name: 'Bridge to Permanent' },
    { value: 'dscr', name: 'DSCR' },
    { value: 'fix_flip', name: 'Fix & Flip' },
    { value: 'purchase_money', name: 'Purchase Money Loan' },
    { value: 'portfolio', name: 'Portfolio Loan' },
    { value: 'sba_express', name: 'SBA Express' },
    { value: 'sba_7a', name: 'SBA 7(a)' },
    { value: 'sba_504', name: 'SBA 504' },
  ];

  getAllLoanTypes(): LoanType[] {
    return this.loanTypes;
  }

  getLoanTypeName(value: string): string {
    const loanType = this.loanTypes.find((type) => type.value === value);
    return loanType ? loanType.name : value;
  }
}