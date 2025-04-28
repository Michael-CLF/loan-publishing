// src/app/models/saved-loan.model.ts
import { Loan } from '../models/loan-model.model';

export interface SavedLoan {
  id?: string;
  loanId: string;
  loanData: Loan;
  savedBy: string;
  savedAt: any;
}
