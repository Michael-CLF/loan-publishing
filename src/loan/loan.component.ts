import {
  Component,
  OnInit,
  ChangeDetectorRef,
  signal,
  computed,
  effect,
  inject,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { LoanService } from '../services/loan.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { ModalService } from '../services/modal.service';

// Type definitions
type PropertyCategory =
  | 'Commercial'
  | 'Healthcare'
  | 'Hospitality'
  | 'Industrial'
  | 'Multifamily'
  | 'Mixed Use'
  | 'Office'
  | 'Residential'
  | 'Retail'
  | 'Special Purpose';

@Component({
  selector: 'app-loan',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterModule, FormsModule],
  templateUrl: './loan.component.html',
  styleUrls: ['./loan.component.css'],
})
export class LoanComponent implements OnInit {
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private loanService = inject(LoanService);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);
  private modalService = inject(ModalService);

  // Form group
  propertyForm!: FormGroup;

  // Make Object available to template
  Object = Object;

  // Loading and error states
  isSubmitting = signal(false);
  submissionError = signal<string | null>(null);
  submissionSuccess = signal(false);

  loanTypes = [
    { value: 'agency', name: 'Agency' },
    { value: 'acquisition', name: 'Acquisition Loan' },
    { value: 'balance sheet', name: 'Balance Sheet' },
    { value: 'bridge', name: 'Bridge Loan' },
    { value: 'bridge_perm', name: 'Bridge to Permanent' },
    { value: 'dscr', name: 'DSCR' },
    { value: 'fix_Flip', name: 'Fix & Flip' },
    { value: 'hard_money', name: 'Hard Money' },
    { value: 'construction', name: 'New Construction' },
    { value: 'portfolio', name: 'Portfolio Loan' },
    { value: 'purchase_money', name: 'Purchase Money Loan' },
    { value: 'rehab', name: 'Rehab/Renovation' },
    { value: 'sba_express', name: 'SBA Express' },
    { value: 'sba_7a', name: 'SBA 7(a)' },
    { value: 'sba_504', name: 'SBA 504' },
    { value: 'usda', name: 'USDA' },
  ];

  propertyCategories = signal<Record<PropertyCategory, string[]>>({
    Commercial: [
       	'Auto Repair Shop',
         'Bank Branch',
         'Business Center',
         'Call Center',
         'Car Wash',
         'Dry Cleaner',
         'Funeral Home',
         'General Commercial',
         'Printing Facility',
         'Sales Office',
         'Showroom',
         'Truck Terminal',
    ],
    
    Healthcare: [
      'Assisted Living',
      'Hospital',
      'Independent Living',
      'Rehab Facility',
      'Urgent Care',
    ],
    Hospitality: [
      'Hospitality Land',
      'Hotel',
      'Long-term Rentals',
      'Motel',
      'Short-term Rentals',
    ],
    Industrial: [
      'Cold Storage',
      'Flex Space',
      'Industrial Land',
      'RV Park',
      'Self Storage',
      'Warehouse',
    ],
    Multifamily: [
      'Affordable Housing',
      'Apartment Building',
      'Assisted Living',
      'Independent Living',
      'Manufactured',
      'Military Housing',
      'Mixed Use',
      'Multifamily Land',
      'Senior Housing',
      'Single Family Portfolio',
      'Student Housing',
    ],
    'Mixed Use': [
      'Live/Work Units',
      'Residential + Office',
      'Residential over Retail',
      'Retail + Office',
    ],
    Office: ['Medical Office', 'Office Condo', 'Professional Office Building'],

    Residential: [
      '1-4 Units',
      'Condo',
      'Duplex',
      'PUD',
      'Residential Portfolio',
      'Townhome',
      'Triplex',
      'Quadplex',
    ],
    Retail: [
      'Anchored Center',
      'Mall',
      'NNN Retail',
      'Restaurant',
      'Retail Land',
      'Single Tenant',
      'Strip Mall',
    ],
    'Special Purpose': [
      'Car Dealership',
      'Church',
      'Data Center',
      'Daycare',
      'Energy Park',
      'Farm',
      'Gas Station',
      'Golf Course',
      'Marina',
      'Mobile Home',
      'Other',
      'Parking Garage',
      'R&D',
      'Resort RV Park',
      'Service Station',
      'Stadium',
    ],
  });

  // Computed signal for category keys with better typing
  categoryKeys = computed(
    () => Object.keys(this.propertyCategories()) as PropertyCategory[]
  );

  // Signal for the selected category
  selectedCategory = signal<PropertyCategory | ''>('');

  // Computed signal for subcategories based on selected category
  selectedSubCategories = computed(() => {
    const category = this.selectedCategory();
    return category ? this.propertyCategories()[category] : [];
  });

  states = signal<{ name: string; value: string }[]>([
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
]);


  constructor() {
    // Initialize the form in the constructor
    this.initForm();

    // Set up effect to handle category changes
    effect(() => {
      const category = this.selectedCategory();
      if (this.propertyForm && category !== undefined) {
        this.propertyForm.get('propertySubCategory')?.setValue('');
        this.propertyForm.get('propertySubCategory')?.updateValueAndValidity();
      }
    });
  }

  ngOnInit(): void {
    // Run change detection after component initialization
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 0);
  }

  private initForm(): void {
    this.propertyForm = this.fb.group({
      propertyTypeCategory: ['', Validators.required],
      propertySubCategory: ['', Validators.required],
      transactionType: ['', Validators.required],
      loanAmount: [
        '',
        [
          Validators.required,
          Validators.pattern(/^(\$)?[\d,]+(\.\d{1,2})?$/),
          Validators.minLength(8),
        ],
      ],
      loanType: ['', [Validators.required]],
      propertyValue: ['', [Validators.required, Validators.minLength(8)]],
      ltv: ['', [Validators.required, Validators.min(1), Validators.max(100)]],
      noi: [''],
      city: ['', Validators.required],
      state: ['', Validators.required],
      numberOfSponsors: ['', [Validators.required, Validators.min(1)]],
      sponsorsLiquidity: ['', [Validators.required, Validators.minLength(5)]],
      sponsorFico: [
        '',
        [Validators.required, Validators.min(300), Validators.max(850)],
      ],
      experienceInYears: ['', [Validators.required, Validators.min(1)]],
      notes: [''],
      termsOfService: [false, Validators.requiredTrue],
    });
  }

  onCategoryChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedCategory.set(value as PropertyCategory);

    // Ensure the formControl is updated
    this.propertyForm.get('propertyTypeCategory')?.setValue(value);
    this.propertyForm.get('propertyTypeCategory')?.updateValueAndValidity();

    // Force change detection
    this.cdr.detectChanges();
  }

  formatLoanAmount(event: Event): void {
    const input = event.target as HTMLInputElement;

    // Find which form control this input is associated with
    const control = input.getAttribute('formControlName');
    if (!control) return;

    // Remove all non-digit characters
    const digitsOnly = input.value.replace(/[^\d]/g, '');

    if (digitsOnly.length === 0) {
      this.propertyForm.get(control)?.setValue('');
      return;
    }

    // Format the number to USD
    const formatted = `$${Number(digitsOnly).toLocaleString('en-US')}`;

    // Update the form control value
    this.propertyForm.get(control)?.setValue(formatted, { emitEvent: false });

    // Trigger change detection to ensure UI updates
    this.cdr.detectChanges();
  }

  onSubmit(): void {
    if (this.propertyForm.valid) {
      console.log('Form submitted successfully:', this.propertyForm.value);

      // Reset states
      this.isSubmitting.set(true);
      this.submissionError.set(null);
      this.submissionSuccess.set(false);

      // Send the form data to Firebase through the service
      this.loanService
        .createLoan(this.propertyForm.value)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (loanId) => {
            console.log('Loan created with ID:', loanId);
            this.isSubmitting.set(false);
            this.submissionError.set(null);
            this.submissionSuccess.set(true);

            this.modalService.openLoanSuccessModal();

            // Force change detection to ensure the success message appears
            this.cdr.detectChanges();

            setTimeout(() => {
              this.router.navigate(['/dashboard']);
            }, 3000);
          },
          error: (error) => {
            console.error('Error creating loan:', error);
            this.isSubmitting.set(false);
            this.submissionError.set(
              'Failed to create loan: ' + (error.message || 'Unknown error')
            );
          },
        });
    } else {
      console.warn('Form is invalid. Please fix the errors.');

      // Mark all fields as touched to show validation errors
      Object.keys(this.propertyForm.controls).forEach((key) => {
        const control = this.propertyForm.get(key);
        control?.markAsTouched();
        control?.updateValueAndValidity();
      });

      // Force change detection to ensure validation messages appear
      this.cdr.detectChanges();
    }
  }

  // Helper methods to simplify template code
  isInvalid(controlName: string): boolean {
    const control = this.propertyForm.get(controlName);
    return !!control && control.invalid && control.touched;
  }

  hasError(controlName: string, errorName: string): boolean {
    const control = this.propertyForm.get(controlName);
    return !!control && control.hasError(errorName) && control.touched;
  }
}
