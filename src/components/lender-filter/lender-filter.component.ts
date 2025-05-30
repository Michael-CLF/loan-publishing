import {
  Component,
  EventEmitter,
  OnInit,
  Output,
  inject,
  model,
} from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LenderFilterService } from '../../services/lender-filter.service';
import { LenderFilters, FilterOption } from '../../models/lender-filters.model';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-lender-filter',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, RouterModule],
  templateUrl: './lender-filter.component.html',
  styleUrl: './lender-filter.component.css',
})
export class LenderFilterComponent implements OnInit {
  // Output event to emit when filters are applied
  private filterService = inject(LenderFilterService);

  // Use the filters from the service
  get filters() {
    return this.filterService.filters;
  }

  // ADDED: Define loanTypes for template compatibility
  // This is an alias for loanTypeOptions to match what your template is expecting
  get loanTypes(): FilterOption[] {
    return this.loanTypeOptions;
  }

  // Lender types
  lenderTypeOptions: FilterOption[] = [
    { value: 'agency', name: 'Agency Lender' },
    { value: 'balance sheet', name: 'Balance Sheet' },
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
    { value: 'mixed-use', name: 'Mixed Use' },
    { value: 'multifamily', name: 'Multifamily' },
    { value: 'office', name: 'Office' },
    { value: 'residential', name: 'Residential' },
    { value: 'retail', name: 'Retail' },
    { value: 'special-purpose', name: 'Special Purpose' },
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

 states = [
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
];

  ngOnInit(): void {
    // Nothing needed here since we're using the filter service
  }

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
  onResetFilters(): void {
    this.filterService.resetFilters();
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
}
