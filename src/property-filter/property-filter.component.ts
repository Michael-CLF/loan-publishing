// property-filter.component.ts
import { Component, EventEmitter, Output, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
  imports: [CommonModule, FormsModule],
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
    'Retail Property',
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
    'Agency Loans (Fannie Mae/Freddie)',
    'Asset-Based Loans',
    'Bank Statement Loans',
    'Bridge Loans',
    'CMBS',
    'Construction Loans',
    'Construction-to-Permanent Loans',
    'Credit Tenant Lease (CTL) Financing',
    'DSCR Loans for 1–4 unit rentals',
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
    this.applyFilters.emit(this.filters());
  }
}
