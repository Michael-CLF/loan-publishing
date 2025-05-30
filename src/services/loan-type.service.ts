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
    { value: 'agency', name: 'Agency' },
    { value: 'balanceSheet', name: 'Balance Sheet' },
    { value: 'bridge', name: 'Bridge Loan' },
    { value: 'dscr', name: 'DSCR' },
    { value: 'fixFlip', name: 'Fix & Flip' },
    { value: 'hard_money', name: 'Hard Money' },
    { value: 'construction', name: 'New Construction' },
    { value: 'rehab', name: 'Rehab/Renovation' },
    { value: 'sba7a', name: 'SBA 7(a)' },
    { value: 'sba504', name: 'SBA 504' },
    { value: 'usda', name: 'USDA' },
  ];

  getAllLoanTypes(): LoanType[] {
    return this.loanTypes;
  }

  getLoanTypeName(value: string): string {
    const loanType = this.loanTypes.find((type) => type.value === value);
    return loanType ? loanType.name : value;
  }
}
