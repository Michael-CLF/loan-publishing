import { Component, EventEmitter, Output, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

export interface LoanFilters {
  propertyTypeCategory: string;
  state: string;
  loanType: string;
  minAmount: string;
  maxAmount: string;
}

@Component({
  selector: 'app-property-filter',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './property-filter.component.html',
  styleUrls: ['./property-filter.component.css'],
})
export class PropertyFilterComponent {
  // Modern Angular 18 approach using the new model inputs
  filters = model<LoanFilters>({
    propertyTypeCategory: '',
    state: '',
    loanType: '',
    minAmount: '',
    maxAmount: '',
  });

  // Display values for formatted currency input
  displayMinAmount = '';
  displayMaxAmount = '';

  // Emit when filters are applied
  @Output() applyFilters = new EventEmitter<LoanFilters>();

  // Property type options matching your existing propertyColorMap
  propertyTypes = [
    'Commercial',
    'Healthcare',
    'Hospitality',
    'Industrial Property',
    'Land',
    'MixedUse',
    'Multi-family',
    'Office',
    'Residential',
    'Retail',
    'Special Purpose',
  ];

  // Most common US states
  states = [
    'Alabama',
    'Alaska',
    'Arizona',
    'Arkansas',
    'California',
    'Colorado',
    'Connecticut',
    'Delaware',
    'Florida',
    'Georgia',
    'Hawaii',
    'Idaho',
    'Illinois',
    'Indiana',
    'Iowa',
    'Kansas',
    'Kentucky',
    'Louisiana',
    'Maine',
    'Maryland',
    'Massachusetts',
    'Michigan',
    'Minnesota',
    'Mississippi',
    'Missouri',
    'Montana',
    'Nebraska',
    'Nevada',
    'New Hampshire',
    'New Jersey',
    'New Mexico',
    'New York',
    'North Carolina',
    'North Dakota',
    'Ohio',
    'Oklahoma',
    'Oregon',
    'Pennsylvania',
    'Rhode Island',
    'South Carolina',
    'South Dakota',
    'Tennessee',
    'Texas',
    'Utah',
    'Vermont',
    'Virginia',
    'Washington',
    'West Virginia',
    'Wisconsin',
    'Wyoming',
  ];

  // Loan types based on your existing data
  loanTypes = [
    'Agency',
    'Asset-Based Loans',
    'Bank Statement Loans',
    'Bridge Loans',
    'CMBS',
    'Construction Loans',
    'Construction-to-Permanent Loans',
    'Credit Tenant Lease (CTL) Financing',
    'DSCR',
    'Ground-Up Construction Loans',
    'Hard Money Loans',
    'ITIN Loans',
    'Mezzanine Financing',
    'Non-Qualified Mortgage (Non-QM) Loans',
    'Opportunity Zone Financing',
    'Permanent Loans (Stabilized properties)',
    'SBA 504 Loans (For owner-occupied properties)',
    'SBA 7(a) Loans (Flexible use, including working capital and real estate)',
    'Syndicated Loans',
  ];

  constructor() {
    // Initialize display values
    this.updateDisplayValues();
  }

  // Method to update display values from model
  updateDisplayValues(): void {
    this.displayMinAmount = this.formatCurrency(this.filters().minAmount);
    this.displayMaxAmount = this.formatCurrency(this.filters().maxAmount);
  }

  // Format value as US currency
  formatCurrency(value: string): string {
    if (!value) return '';

    // Remove non-numeric characters
    const numericValue = value.replace(/[^0-9.]/g, '');

    // Format as US currency
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

    return formatter.format(Number(numericValue));
  }

  // Parse currency string to numeric value
  parseCurrency(value: string): string {
    // Remove currency symbols and commas
    return value.replace(/[^0-9.]/g, '');
  }

  // Handle input changes for currency fields
  onCurrencyInput(field: 'minAmount' | 'maxAmount', event: Event): void {
    const input = event.target as HTMLInputElement;
    const rawValue = input.value;

    // Parse to get numeric value
    const numericValue = this.parseCurrency(rawValue);

    // Update the model with numeric value
    this.updateFilter(field, numericValue);

    // Update display with formatted value
    if (field === 'minAmount') {
      this.displayMinAmount = this.formatCurrency(numericValue);
    } else {
      this.displayMaxAmount = this.formatCurrency(numericValue);
    }

    // Set cursor position after formatting
    setTimeout(() => {
      const cursorPos = input.value.indexOf('.');
      input.setSelectionRange(
        cursorPos > 0 ? cursorPos : input.value.length,
        cursorPos > 0 ? cursorPos : input.value.length
      );
    }, 0);
  }

  // Method to update a specific filter field
  updateFilter(field: string, value: string): void {
    this.filters.update((current) => ({
      ...current,
      [field]: value,
    }));
  }

  // Method to apply filters
  onApplyFilters(): void {
    this.applyFilters.emit(this.filters());
  }

  // Method to reset filters
  onResetFilters(): void {
    this.filters.set({
      propertyTypeCategory: '',
      state: '',
      loanType: '',
      minAmount: '',
      maxAmount: '',
    });

    // Reset display values
    this.displayMinAmount = '';
    this.displayMaxAmount = '';

    this.applyFilters.emit(this.filters());
  }
}
