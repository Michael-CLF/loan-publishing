import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LenderFilterService } from '../../services/lender-filter.service';
import { LenderFilters, FilterOption } from '../../models/lender-filters.model';

@Component({
  selector: 'app-lender-filter',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe],
  templateUrl: './lender-filter.component.html',
  styleUrl: './lender-filter.component.css',
})
export class LenderFilterComponent {
  // Output event to emit when filters are applied
  @Output() applyFilters = new EventEmitter<LenderFilters>();
  private filterService = inject(LenderFilterService);

  // Use the filters from the service
  get filters() {
    return this.filterService.filters;
  }

  // Lender types
  lenderTypeOptions: FilterOption[] = [
    { value: 'agency', name: 'Agency Lender' },
    { value: 'bank', name: 'Bank' },
    { value: 'bridge_lender', name: 'Bridge Lender' },
    { value: 'cdfi', name: 'CDFI Lender' },
    { value: 'conduit_lender', name: 'Conduit Lender (CMBS)' },
    { value: 'construction_lender', name: 'Construction Lender' },
    { value: 'correspondent_lender', name: 'Correspondent Lender' },
    { value: 'credit_union', name: 'Credit Union' },
    { value: 'crowdfunding', name: 'Crowdfunding Platform' },
    { value: 'direct_lender', name: 'Direct Lender' },
    { value: 'family_office', name: 'Family Office' },
    { value: 'general', name: 'General' },
    { value: 'hard_money', name: 'Hard Money Lender' },
    { value: 'life_insurance', name: 'Life Insurance Lender' },
    { value: 'mezzanine_lender', name: 'Mezzanine Lender' },
    { value: 'non_qm_lender', name: 'Non-QM Lender' },
    { value: 'portfolio_lender', name: 'Portfolio Lender' },
    { value: 'private_lender', name: 'Private Lender' },
    { value: 'sba', name: 'SBA Lender' },
    { value: 'usda', name: 'USDA Lender' },
  ];
  // Property categories
  propertyCategoryOptions: FilterOption[] = [
    { value: 'commercial', name: 'Commercial' },
    { value: 'healthcare', name: 'Healthcare' },
    { value: 'hospitality', name: 'Hospitality' },
    { value: 'industrial', name: 'Industrial' },
    { value: 'land', name: 'Land' },
    { value: 'mixed_use', name: 'Mixed Use' },
    { value: 'multi-family', name: 'Multi-family' },
    { value: 'office', name: 'Office' },
    { value: 'residential', name: 'Residential' },
    { value: 'retail', name: 'Retail' },
    { value: 'special_purpose', name: 'Special Purpose' },
  ];

  // Loan Types with display names
  loanTypeOptions: FilterOption[] = [
    { value: 'agency', name: 'Agency' },
    { value: 'bridge', name: 'Bridge' },
    { value: 'cmbs', name: 'CMBS' },
    { value: 'commercial', name: 'Commercial' },
    { value: 'construction', name: 'Construction' },
    { value: 'general', name: 'General' },
    { value: 'hard_money', name: 'Hard Money' },
    { value: 'mezzanine', name: 'Mezzanine' },
    { value: 'non-qm', name: 'Non-QM' },
    { value: 'rehab', name: 'Rehab' },
    { value: 'sba', name: 'SBA' },
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
    let updatedValue = value;

    if (field === 'loanAmount' && value) {
      updatedValue = value.replace(/[^0-9.]/g, '');
    }

    this.filterService.updateFilters({
      [field]: updatedValue,
    } as Partial<LenderFilters>);
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
    const currentFilters = this.filterService.getFilters();

    // Clean up loan amount before emitting
    if (currentFilters.loanAmount) {
      currentFilters.loanAmount = currentFilters.loanAmount.replace(
        /[^0-9.]/g,
        ''
      );
    }

    console.log('Emitting filters:', currentFilters);
    this.applyFilters.emit(currentFilters);
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
    this.filterService.resetFilters();
    this.applyFilters.emit(this.filterService.getFilters());
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
      general: 'General',
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
