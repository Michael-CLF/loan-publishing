import { Component, EventEmitter, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface LenderFilters {
  lenderType: string;
  propertyCategory: string;
  state: string;
  loanAmount: string;
}

@Component({
  selector: 'app-lender-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lender-filter.component.html',
  styleUrl: './lender-filter.component.css',
})
export class LenderFilterComponent {
  // Output event to emit when filters are applied
  @Output() applyFilters = new EventEmitter<LenderFilters>();

  // Current filters state
  filters = signal<LenderFilters>({
    lenderType: '',
    propertyCategory: '',
    state: '',
    loanAmount: '',
  });

  // Lender types
  lenderTypes = [
    'agency',
    'bank',
    'bridge_lender',
    'cdfi',
    'conduit_lender',
    'construction_lender',
    'correspondent_lender',
    'credit_union',
    'crowdfunding',
    'direct_lender',
    'family_office',
    'hard_money',
    'life_insurance',
    'mezzanine_lender',
    'non_qm_lender',
    'portfolio_lender',
    'private_lender',
    'sba',
    'usda',
  ];

  // Property categories
  propertyCategories = [
    'Commercial',
    'Healthcare',
    'Hospitality',
    'Industrial',
    'Land',
    'MixedUse',
    'Multi-family',
    'Office',
    'Residential',
    'Retail Property',
    'Special Purpose',
  ];

  // US states
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

  validateLoanAmount(amount: string): boolean {
    if (!amount) return true;
    const numericValue = parseFloat(amount.replace(/[^0-9.]/g, ''));
    return !isNaN(numericValue) && numericValue >= 0;
  }

  updateFilter(field: keyof LenderFilters, value: string | null): void {
    this.filters.update((current) => ({
      ...current,
      [field]: value,
    }));
  }

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

  onApplyFilters(): void {
    const cleanedFilters = { ...this.filters() };

    if (cleanedFilters.loanAmount) {
      cleanedFilters.loanAmount = cleanedFilters.loanAmount.replace(
        /[^0-9.]/g,
        ''
      );
    }

    this.applyFilters.emit(cleanedFilters);
  }

  cleanLoanAmount(value: string): string {
    // Remove multiple decimal points
    const parts = value.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    return value;
  }

  onResetFilters(): void {
    this.filters.set({
      lenderType: '',
      propertyCategory: '',
      state: '',
      loanAmount: '',
    });

    this.applyFilters.emit(this.filters());
  }

  getLenderTypeName(value: string): string {
    const lenderTypeMap: { [key: string]: string } = {
      agency: 'Agency Lender',
      bank: 'Bank',
      bridge_lender: 'Bridge Lender',
      cdfi: 'CDFI Lender',
      conduit_lender: 'Conduit Lender (CMBS)',
      construction_lender: 'Construction Lender',
      correspondent_lender: 'Correspondent Lender',
      credit_union: 'Credit Union',
      crowdfunding: 'Crowdfunding Platform',
      direct_lender: 'Direct Lender',
      family_office: 'Family Office',
      hard_money: 'Hard Money Lender',
      life_insurance: 'Life Insurance Lender',
      mezzanine_lender: 'Mezzanine Lender',
      non_qm_lender: 'Non-QM Lender',
      portfolio_lender: 'Portfolio Lender',
      private_lender: 'Private Lender',
      sba: 'SBA Lender',
      usda: 'USDA Lender',
    };

    return lenderTypeMap[value] || value;
  }
}
function getLenderTypeName(value: any, string: any) {
  throw new Error('Function not implemented.');
}
