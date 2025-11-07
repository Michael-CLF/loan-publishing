import { Component, EventEmitter, OnInit, Output, Input, model, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LoanTypeService, LoanType } from '../../services/loan-type.service';

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

  // ✅ NEW: Inputs for count display
  @Input() loanCount: number = 0;
  @Input() isLoading: boolean = false;

  // Display values for formatted currency input
  displayMinAmount = '';
  displayMaxAmount = '';

  // Emit when filters are applied
  @Output() applyFilters = new EventEmitter<LoanFilters>();

  // ✅ FIXED: Property types now match exactly what's stored in Firebase loans
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

  // ✅ FIXED: States now properly handle the mismatch between display and Firebase storage
  // UI shows full names, but we need to send full names to match Firebase loan storage
  readonly states: StateOption[] = [
    { name: 'Alabama', value: 'Alabama' },
    { name: 'Alaska', value: 'Alaska' },
    { name: 'Arizona', value: 'Arizona' },
    { name: 'Arkansas', value: 'Arkansas' },
    { name: 'California', value: 'California' },
    { name: 'Colorado', value: 'Colorado' },
    { name: 'Connecticut', value: 'Connecticut' },
    { name: 'Delaware', value: 'Delaware' },
    { name: 'Florida', value: 'Florida' },
    { name: 'Georgia', value: 'Georgia' },
    { name: 'Hawaii', value: 'Hawaii' },
    { name: 'Idaho', value: 'Idaho' },
    { name: 'Illinois', value: 'Illinois' },
    { name: 'Indiana', value: 'Indiana' },
    { name: 'Iowa', value: 'Iowa' },
    { name: 'Kansas', value: 'Kansas' },
    { name: 'Kentucky', value: 'Kentucky' },
    { name: 'Louisiana', value: 'Louisiana' },
    { name: 'Maine', value: 'Maine' },
    { name: 'Maryland', value: 'Maryland' },
    { name: 'Massachusetts', value: 'Massachusetts' },
    { name: 'Michigan', value: 'Michigan' },
    { name: 'Minnesota', value: 'Minnesota' },
    { name: 'Mississippi', value: 'Mississippi' },
    { name: 'Missouri', value: 'Missouri' },
    { name: 'Montana', value: 'Montana' },
    { name: 'Nebraska', value: 'Nebraska' },
    { name: 'Nevada', value: 'Nevada' },
    { name: 'New Hampshire', value: 'New Hampshire' },
    { name: 'New Jersey', value: 'New Jersey' },
    { name: 'New Mexico', value: 'New Mexico' },
    { name: 'New York', value: 'New York' },
    { name: 'North Carolina', value: 'North Carolina' },
    { name: 'North Dakota', value: 'North Dakota' },
    { name: 'Ohio', value: 'Ohio' },
    { name: 'Oklahoma', value: 'Oklahoma' },
    { name: 'Oregon', value: 'Oregon' },
    { name: 'Pennsylvania', value: 'Pennsylvania' },
    { name: 'Rhode Island', value: 'Rhode Island' },
    { name: 'South Carolina', value: 'South Carolina' },
    { name: 'South Dakota', value: 'South Dakota' },
    { name: 'Tennessee', value: 'Tennessee' },
    { name: 'Texas', value: 'Texas' },
    { name: 'Utah', value: 'Utah' },
    { name: 'Vermont', value: 'Vermont' },
    { name: 'Virginia', value: 'Virginia' },
    { name: 'Washington', value: 'Washington' },
    { name: 'West Virginia', value: 'West Virginia' },
    { name: 'Wisconsin', value: 'Wisconsin' },
    { name: 'Wyoming', value: 'Wyoming' },
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