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

  // ✅ NEW: Expose signals for count badge display
  get filters() {
    return this.filterService.filters;
  }

  get lenders() {
    return this.filterService.lenders;
  }

  get loading() {
    return this.filterService.loading;
  }

  // ADDED: Define loanTypes for template compatibility
  // This is an alias for loanTypeOptions to match what your template is expecting
  get loanTypes(): FilterOption[] {
    return this.loanTypeOptions;
  }

  // Lender types - these match Firebase exactly
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

  // ✅ FIXED: Property categories now match Firebase lender storage exactly (lowercase with underscores)
  propertyCategoryOptions: FilterOption[] = [
    { value: 'commercial', name: 'Commercial' },
    { value: 'healthcare', name: 'Healthcare' },
    { value: 'hospitality', name: 'Hospitality' },
    { value: 'industrial', name: 'Industrial' },
    { value: 'land', name: 'Land' },
    { value: 'mixed_use', name: 'Mixed Use' },
    { value: 'multifamily', name: 'Multifamily' },
    { value: 'office', name: 'Office' },
    { value: 'residential', name: 'Residential' },
    { value: 'retail', name: 'Retail' },
    { value: 'special_purpose', name: 'Special Purpose' },
  ];

  // ✅ FIXED: Loan Types now match Firebase lender storage exactly (lowercase with underscores)
  loanTypeOptions: FilterOption[] = [
    { value: 'agency', name: 'Agency' },
    { value: 'bridge', name: 'Bridge' },
    { value: 'cmbs', name: 'CMBS' },
    { value: 'commercial', name: 'Commercial' },
    { value: 'construction', name: 'Construction' },
    { value: 'general', name: 'General' },
    { value: 'hard_money', name: 'Hard Money' },
    { value: 'mezzanine', name: 'Mezzanine' },
    { value: 'non_qm', name: 'Non-QM' },
    { value: 'rehab', name: 'Rehab' },
    { value: 'sba', name: 'SBA' },
    { value: 'usda', name: 'USDA' },
  ];

  // ✅ FIXED: States now send full names to be converted to abbreviations by FirestoreService
  // This matches what lenders expect in their footprintInfo.lendingFootprint (state abbreviations)
  states = [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 
    'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 
    'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 
    'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 
    'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 
    'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 
    'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 
    'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 
    'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 
    'West Virginia', 'Wisconsin', 'Wyoming'
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