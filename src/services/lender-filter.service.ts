// src/app/services/lender-filter.service.ts
import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { Lender } from '../models/lender.model';
import { LenderFilters } from '../models/lender-filters.model';

@Injectable({
  providedIn: 'root',
})
export class LenderFilterService {
  // Use signals for reactive state management (Angular 18 approach)
  private filtersSignal = signal<LenderFilters>({
    lenderType: '',
    propertyCategory: '',
    state: '',
    loanAmount: '',
    loanType: '',
  });

  // Methods to update filters
  updateFilters(filters: Partial<LenderFilters>): void {
    this.filtersSignal.update((current) => ({
      ...current,
      ...filters,
    }));
  }

  // Method to reset filters
  resetFilters(): void {
    this.filtersSignal.set({
      lenderType: '',
      propertyCategory: '',
      state: '',
      loanAmount: '',
      loanType: '',
    });
  }

  // Get current filter values
  getFilters() {
    return this.filtersSignal();
  }

  // Get filters as a read-only signal
  get filters() {
    return this.filtersSignal.asReadonly();
  }

  // Format loan amount for display
  formatLoanAmount(value: string): string {
    if (!value) return '';
    // Remove non-numeric characters except decimal point
    const numericValue = value.replace(/[^0-9.]/g, '');
    // Convert to number and format
    const amount = parseFloat(numericValue);
    if (isNaN(amount)) return '';
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  // Clean loan amount value (remove multiple decimal points)
  cleanLoanAmount(value: string): string {
    const parts = value.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    return value;
  }
}
