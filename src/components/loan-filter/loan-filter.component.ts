// src/app/components/loan-filter/loan-filter.component.ts
import {
  Component,
  EventEmitter,
  Output,
  Input,
  signal,
  WritableSignal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
  import { FormsModule } from '@angular/forms';
import { LoanFilterService, LoanFilters } from '../../services/loan-filter.service';
import { getStateName } from '../../shared/constants/state-mappings';

type Option = { value: string; name: string };

// 2-letter state codes used in Firestore (e.g., "FL")
const STATE_CODES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
];

@Component({
  selector: 'app-loan-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './loan-filter.component.html',
  styleUrls: ['./loan-filter.component.css'],
})
export class LoanFilterComponent {
  /** Inputs used by parent header */
  @Input() loanCount = 0;
  @Input() isLoading = false;

  /** Output: keep existing name */
  @Output() applyFilters = new EventEmitter<LoanFilters>();

  /** Local UI model */
  readonly filters: WritableSignal<LoanFilters> = signal<LoanFilters>({
    propertyTypeCategory: '',
    state: '',
    loanType: '',
    minAmount: '', // numeric string only, e.g. "200000"
    maxAmount: '', // numeric string only
  });

  /** Display strings shown in inputs (formatted as $X,XXX,XXX) */
  displayMinAmount = '';
  displayMaxAmount = '';

  /** Dropdowns — values must match Firestore */
  propertyTypeOptions: Option[] = [
    { value: '', name: 'All Property Types' },
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

  stateOptions: Option[] = [
    { value: '', name: 'All States' },
    ...STATE_CODES.map(code => ({ value: code, name: getStateName(code) })),
  ];

  loanTypeOptions: Option[] = [
    { value: '', name: 'All Loan Types' },
    { value: 'agency', name: 'Agency Loans' },
    { value: 'bridge', name: 'Bridge Loans' },
    { value: 'cmbs', name: 'CMBS Loans' },
    { value: 'commercial', name: 'Commercial Loans' },
    { value: 'construction', name: 'Construction Loans' },
    { value: 'hard_money', name: 'Hard Money Loans' },
    { value: 'mezzanine', name: 'Mezzanine Loan' },
    { value: 'rehab', name: 'Rehab Loans' },
    { value: 'non_qm', name: 'Non-QM Loans' },
    { value: 'sba', name: 'SBA Loans' },
    { value: 'usda', name: 'USDA Loans' },
    { value: 'portfolio', name: 'Portfolio Loan' },
    { value: 'dscr', name: 'DSCR' },
  ];

  constructor(private readonly loanFilterService: LoanFilterService) {}

  /** Generic updater for selects */
  updateFilter<K extends keyof LoanFilters>(key: K, value: LoanFilters[K]): void {
    this.filters.update(cur => ({ ...cur, [key]: value }));
  }

  /** Format helpers */
  private toDigits(raw: string): string {
    return (raw || '').replace(/\D+/g, '');
  }

  private toCurrency(digits: string): string {
    if (!digits) return '';
    const n = Number(digits);
    if (!Number.isFinite(n)) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(n);
  }

  /** Min amount: keep numeric in filters, show formatted in the input */
  onMinAmountChange(raw: string): void {
    const digits = this.toDigits(raw);
    this.filters.update(cur => ({ ...cur, minAmount: digits }));
    this.displayMinAmount = this.toCurrency(digits);
  }

  /** Max amount: keep numeric in filters, show formatted in the input */
  onMaxAmountChange(raw: string): void {
    const digits = this.toDigits(raw);
    this.filters.update(cur => ({ ...cur, maxAmount: digits }));
    this.displayMaxAmount = this.toCurrency(digits);
  }

  /** Persist + emit */
  onApplyFilters(): void {
    const f = this.filters();
    this.loanFilterService.updateFilters(f);
    this.applyFilters.emit(f);
  }

  /** Reset */
  onResetFilters(): void {
    this.filters.set({
      propertyTypeCategory: '',
      state: '',
      loanType: '',
      minAmount: '',
      maxAmount: '',
    });
    this.displayMinAmount = '';
    this.displayMaxAmount = '';
    this.loanFilterService.resetFilters();
    this.applyFilters.emit(this.filters());
  }

  /** TrackBy */
  trackByValue = (_: number, opt: Option) => opt.value;
  trackByName  = (_: number, opt: Option) => opt.name;
}
