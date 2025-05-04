// src/app/services/loan-filter.service.ts
import { Injectable, signal } from '@angular/core';
import { LoanFilters } from '../models/loan-filters.model'; // You'd need to create this

@Injectable({
  providedIn: 'root',
})
export class LoanFilterService {
  // Use signals for reactive state management (Angular 18 approach)
  private filtersSignal = signal<LoanFilters>({
    propertyTypeCategory: '',
    state: '',
    loanType: '',
    loanAmount: '',
  });

  // Methods to update filters
  updateFilters(filters: Partial<LoanFilters>): void {
    this.filtersSignal.update((current) => ({
      ...current,
      ...filters,
    }));
  }

  // Method to reset filters
  resetFilters(): void {
    this.filtersSignal.set({
      propertyTypeCategory: '',
      state: '',
      loanType: '',
      loanAmount: '',
    });
  }

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
