import { Component, EventEmitter, OnInit, Output, model, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LoanTypeService, LoanType } from '../services/loan-type.service';

export interface LoanFilters {
  propertyTypeCategory: string;
  state: string;
  loanType: string;
  minAmount: string;
  maxAmount: string;
}

// Interface for better type safety
interface StateOption {
  name: string;
  value: string;
}

@Component({
  selector: 'app-property-filter',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './property-filter.component.html',
  styleUrls: ['./property-filter.component.css'],
})
export class PropertyFilterComponent implements OnInit {
  // Modern Angular 18 approach using inject() function
  private readonly loanTypeService = inject(LoanTypeService);

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
  readonly propertyTypes = [
    'Commercial',
    'Healthcare',
    'Hospitality',
    'Industrial',
    'Land',
    'Mixed Use',
    'Multifamily',
    'Office',
    'Residential',
    'Retail',
    'Special Purpose',
  ] as const;

  // Made readonly for better immutability and properly typed
  readonly states: StateOption[] = [
    { name: 'Alabama', value: 'AL' },
    { name: 'Alaska', value: 'AK' },
    { name: 'Arizona', value: 'AZ' },
    { name: 'Arkansas', value: 'AR' },
    { name: 'California', value: 'CA' },
    { name: 'Colorado', value: 'CO' },
    { name: 'Connecticut', value: 'CT' },
    { name: 'Delaware', value: 'DE' },
    { name: 'Florida', value: 'FL' },
    { name: 'Georgia', value: 'GA' },
    { name: 'Hawaii', value: 'HI' },
    { name: 'Idaho', value: 'ID' },
    { name: 'Illinois', value: 'IL' },
    { name: 'Indiana', value: 'IN' },
    { name: 'Iowa', value: 'IA' },
    { name: 'Kansas', value: 'KS' },
    { name: 'Kentucky', value: 'KY' },
    { name: 'Louisiana', value: 'LA' },
    { name: 'Maine', value: 'ME' },
    { name: 'Maryland', value: 'MD' },
    { name: 'Massachusetts', value: 'MA' },
    { name: 'Michigan', value: 'MI' },
    { name: 'Minnesota', value: 'MN' },
    { name: 'Mississippi', value: 'MS' },
    { name: 'Missouri', value: 'MO' },
    { name: 'Montana', value: 'MT' },
    { name: 'Nebraska', value: 'NE' },
    { name: 'Nevada', value: 'NV' },
    { name: 'New Hampshire', value: 'NH' },
    { name: 'New Jersey', value: 'NJ' },
    { name: 'New Mexico', value: 'NM' },
    { name: 'New York', value: 'NY' },
    { name: 'North Carolina', value: 'NC' },
    { name: 'North Dakota', value: 'ND' },
    { name: 'Ohio', value: 'OH' },
    { name: 'Oklahoma', value: 'OK' },
    { name: 'Oregon', value: 'OR' },
    { name: 'Pennsylvania', value: 'PA' },
    { name: 'Rhode Island', value: 'RI' },
    { name: 'South Carolina', value: 'SC' },
    { name: 'South Dakota', value: 'SD' },
    { name: 'Tennessee', value: 'TN' },
    { name: 'Texas', value: 'TX' },
    { name: 'Utah', value: 'UT' },
    { name: 'Vermont', value: 'VT' },
    { name: 'Virginia', value: 'VA' },
    { name: 'Washington', value: 'WA' },
    { name: 'West Virginia', value: 'WV' },
    { name: 'Wisconsin', value: 'WI' },
    { name: 'Wyoming', value: 'WY' },
  ] as const;

  loanTypes: LoanType[] = [];

  ngOnInit(): void {
    // Get loan types from the service
    this.loanTypes = this.loanTypeService.getAllLoanTypes();
    // Initialize display values
    this.updateDisplayValues();
  }

  // TrackBy functions for better performance with *ngFor
  trackByStateValue(index: number, state: StateOption): string {
    return state.value;
  }

  trackByLoanTypeValue(index: number, loanType: LoanType): string {
    return loanType.value;
  }

  // Method to update display values from model
  private updateDisplayValues(): void {
    this.displayMinAmount = this.formatCurrency(this.filters().minAmount);
    this.displayMaxAmount = this.formatCurrency(this.filters().maxAmount);
  }

  // Format value as US currency
  private formatCurrency(value: string): string {
    if (!value) return '';

    // Remove non-numeric characters
    const numericValue = value.replace(/[^0-9.]/g, '');
    if (!numericValue) return '';

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
  private parseCurrency(value: string): string {
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
  updateFilter(field: keyof LoanFilters, value: string): void {
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