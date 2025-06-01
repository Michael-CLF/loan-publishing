// src/app/models/saved-loan.model.ts
import { Loan } from '../models/loan-model.model';
import { Timestamp } from '@angular/fire/firestore';

export interface SavedLoan {
  id: string;
  loanId: string;
  loanData: Loan;
  userId: string;
  createdAt?: Timestamp | Date; // ⬅️ Add this line
}
