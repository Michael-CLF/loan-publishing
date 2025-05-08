// src/app/services/lender-filter.service.ts
import { Injectable, signal, effect, inject, computed } from '@angular/core';
import { LenderFilters } from '../models/lender-filters.model';
import { FirestoreService } from './firestore.service';

@Injectable({
  providedIn: 'root',
})
export class LenderFilterService {
  // Signals for filters and data
  private filtersSignal = signal<LenderFilters>({
    lenderType: '',
    propertyCategory: '',
    state: '',
    loanAmount: '',
    loanType: '',
  });

  private firestoreService = inject(FirestoreService);

  private lendersSignal = signal<any[]>([]);
  private loadingSignal = signal<boolean>(false);

  // Auto-fetch data when filters change
  private fetchEffect = effect(() => {
    const filters = this.filtersSignal();

    this.loadingSignal.set(true);
    this.firestoreService
      .filterLenders(
        filters.lenderType,
        filters.propertyCategory,
        filters.state,
        filters.loanAmount,
        filters.loanType
      )
      .subscribe({
        next: (lenders) => {
          this.lendersSignal.set(lenders);
          this.loadingSignal.set(false);
        },
        error: (err) => {
          console.error('Error loading lenders:', err);
          this.lendersSignal.set([]);
          this.loadingSignal.set(false);
        },
      });
  });

  // Public accessors
  get filters() {
    return this.filtersSignal.asReadonly();
  }

  get lenders() {
    return this.lendersSignal.asReadonly();
  }

  get loading() {
    return this.loadingSignal.asReadonly();
  }

  updateFilters(filters: Partial<LenderFilters>): void {
    this.filtersSignal.update((current) => ({
      ...current,
      ...filters,
    }));
  }

  resetFilters(): void {
    this.filtersSignal.set({
      lenderType: '',
      propertyCategory: '',
      state: '',
      loanAmount: '',
      loanType: '',
    });
  }

  // Optional utilities
  formatLoanAmount(value: string): string {
    if (!value) return '';
    const numericValue = value.replace(/[^0-9.]/g, '');
    const amount = parseFloat(numericValue);
    if (isNaN(amount)) return '';
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  cleanLoanAmount(value: string): string {
    const parts = value.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    return value;
  }
}
