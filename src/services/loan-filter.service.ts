// src/app/services/loan-filter.service.ts
import { Injectable, signal } from '@angular/core';

export interface LoanFilters {
  /** e.g. 'residential', 'multifamily', 'retail' */
  propertyTypeCategory: string;
  /** 2-letter abbreviation, e.g. 'FL', 'NC', 'IL' */
  state: string;
  /** stored value, e.g. 'dscr', 'portfolio', 'bridge' */
  loanType: string;
  /** numeric string, e.g. '250000' */
  minAmount: string;
  /** numeric string, e.g. '750000' */
  maxAmount: string;
}

@Injectable({ providedIn: 'root' })
export class LoanFilterService {
  // single source of truth for current filters
  private readonly _filters = signal<LoanFilters>({
    propertyTypeCategory: '',
    state: '',
    loanType: '',
    minAmount: '',
    maxAmount: '',
  });

  /** Read-only signal for consumers */
  get filters() {
    return this._filters.asReadonly();
  }

  /** Snapshot getter (non-reactive) */
  getFilters(): LoanFilters {
    return this._filters();
  }

  /** Merge-in updates without losing other fields */
  updateFilters(patch: Partial<LoanFilters>): void {
    this._filters.update(cur => ({ ...cur, ...patch }));
  }

  /** Reset everything to "All" */
  resetFilters(): void {
    this._filters.set({
      propertyTypeCategory: '',
      state: '',
      loanType: '',
      minAmount: '',
      maxAmount: '',
    });
  }
}
