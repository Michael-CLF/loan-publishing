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

interface SubcategoryItem {
  value: string;  // Database format (snake_case)
  name: string;   // Display name (Title Case)
}

interface CategoryOption {
  value: string;  // Database format (snake_case)  
  name: string;   // Display name (Title Case)
}

interface LoanTypeOption {
  value: string;  // Database format
  name: string;   // Display name
}

interface TransactionTypeOption {
  value: string;  // Database format
  name: string;   // Display name
}

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

propertyCategoryOptions: CategoryOption[] = [
  { value: 'commercial', name: 'Commercial' },
  { value: 'healthcare', name: 'Healthcare' },
  { value: 'hospitality', name: 'Hospitality' },
  { value: 'industrial', name: 'Industrial' },
  { value: 'multifamily', name: 'Multifamily' },
  { value: 'mixed_use', name: 'Mixed Use' },
  { value: 'office', name: 'Office' },
  { value: 'residential', name: 'Residential' },
  { value: 'retail', name: 'Retail' },
  { value: 'special_purpose', name: 'Special Purpose' },
];

// All subcategories with standardized category:subcategory format
propertySubcategories: Record<string, SubcategoryItem[]> = {
  commercial: [
    { value: 'commercial:auto_repair_shop', name: 'Auto Repair Shop' },
    { value: 'commercial:bank_branch', name: 'Bank Branch' },
    { value: 'commercial:business_center', name: 'Business Center' },
    { value: 'commercial:call_center', name: 'Call Center' },
    { value: 'commercial:car_wash', name: 'Car Wash' },
    { value: 'commercial:dry_cleaner', name: 'Dry Cleaner' },
    { value: 'commercial:funeral_home', name: 'Funeral Home' },
    { value: 'commercial:general_commercial', name: 'General Commercial' },
    { value: 'commercial:printing_facility', name: 'Printing Facility' },
    { value: 'commercial:sales_office', name: 'Sales Office' },
    { value: 'commercial:showroom', name: 'Showroom' },
    { value: 'commercial:truck_terminal', name: 'Truck Terminal' },
  ],
  
  healthcare: [
    { value: 'healthcare:assisted_living', name: 'Assisted Living' },
    { value: 'healthcare:hospital', name: 'Hospital' },
    { value: 'healthcare:independent_living', name: 'Independent Living' },
    { value: 'healthcare:rehab_facility', name: 'Rehab Facility' },
    { value: 'healthcare:urgent_care', name: 'Urgent Care' },
  ],

  hospitality: [
    { value: 'hospitality:hotel', name: 'Hotel' },
    { value: 'hospitality:long_term_rentals', name: 'Long-term Rentals' },
    { value: 'hospitality:motel', name: 'Motel' },
    { value: 'hospitality:short_term_rentals', name: 'Short-term Rentals' },
  ],

  industrial: [
    { value: 'industrial:cold_storage', name: 'Cold Storage' },
    { value: 'industrial:distribution_center', name: 'Distribution Center' },
    { value: 'industrial:flex_space', name: 'Flex Space' },
    { value: 'industrial:self_storage', name: 'Self Storage' },
    { value: 'industrial:warehouse', name: 'Warehouse' },
  ],

  multifamily: [
    { value: 'multifamily:affordable_housing', name: 'Affordable Housing' },
    { value: 'multifamily:apartment_building', name: 'Apartment Building' },
    { value: 'multifamily:independent_living', name: 'Independent Living' },
    { value: 'multifamily:manufactured', name: 'Manufactured' },
    { value: 'multifamily:military_housing', name: 'Military Housing' },
    { value: 'multifamily:senior_housing', name: 'Senior Housing' },
    { value: 'multifamily:student_housing', name: 'Student Housing' },
  ],

  mixed_use: [
    { value: 'mixed_use:live_work', name: 'Live/Work Units' },
    { value: 'mixed_use:residential_office', name: 'Residential + Office' },
    { value: 'mixed_use:residential_retail', name: 'Residential over Retail' },
    { value: 'mixed_use:retail_office', name: 'Retail + Office' },
  ],

  office: [
     { value: 'corporate_office', name: 'Corporate Headquarters' },
         { value: 'executive_suites', name: 'Executive Suites/Co-working spaces' },
         { value: 'medical_office', name: 'Medical Office' },
         {
          value: 'professional_office_building',
          name: 'Professional Office Building',
         },
         { value: 'flex', name: 'Office/Industrial' },
  ],

  residential: [
    { value: 'residential:1_4_units', name: '1-4 Units' },
    { value: 'residential:co_op', name: 'Co-op' },
    { value: 'residential:condominium', name: 'Condominium' },
    { value: 'residential:quadplex', name: 'Quadplex' },
    { value: 'residential:single_family', name: 'Single Family' },
    { value: 'residential:triplex', name: 'Triplex' },
  ],

  retail: [
    { value: 'retail:anchored_center', name: 'Anchored Center' },
    { value: 'retail:mall', name: 'Mall' },
    { value: 'retail:mixed_use_retail', name: 'Mixed Use Retail' },
    { value: 'retail:nnn_retail', name: 'NNN Retail' },
    { value: 'retail:restaurant', name: 'Restaurant' },
    { value: 'retail:single_tenant', name: 'Single Tenant' },
    { value: 'retail:strip_mall', name: 'Strip Mall' },
  ],

  special_purpose: [
    { value: 'special_purpose:auto_dealership', name: 'Auto Dealership' },
    { value: 'special_purpose:church', name: 'Church' },
    { value: 'special_purpose:data_center', name: 'Data Center' },
    { value: 'special_purpose:daycare', name: 'Daycare' },
    { value: 'special_purpose:energy_park', name: 'Energy Park' },
    { value: 'special_purpose:farm', name: 'Farm' },
    { value: 'special_purpose:gas_station', name: 'Gas Station' },
    { value: 'special_purpose:golf_course', name: 'Golf Course' },
    { value: 'special_purpose:marina', name: 'Marina' },
    { value: 'special_purpose:mobile_home_park', name: 'Mobile Home Park' },
    { value: 'special_purpose:parking_garage', name: 'Parking Garage' },
    { value: 'special_purpose:r_and_d', name: 'R&D' },
    { value: 'special_purpose:resort_rv_park', name: 'Resort RV Park' },
    { value: 'special_purpose:service_station', name: 'Service Station' },
    { value: 'special_purpose:sports_complex', name: 'Sports Complex' },
    { value: 'special_purpose:stadium', name: 'Stadium' },
  ],
};

// Loan types with proper database values
loanTypes: LoanTypeOption[] = [
  { value: 'agency', name: 'Agency' },
  { value: 'acquisition', name: 'Acquisition Loan' },
  { value: 'balance_sheet', name: 'Balance Sheet' },
  { value: 'bridge', name: 'Bridge Loan' },
  { value: 'bridge_perm', name: 'Bridge to Permanent' },
  { value: 'dscr', name: 'DSCR' },
  { value: 'fix_flip', name: 'Fix & Flip' },
  { value: 'hard_money', name: 'Hard Money' },
  { value: 'construction', name: 'New Construction' },
  { value: 'portfolio', name: 'Portfolio Loan' },
  { value: 'rehab', name: 'Rehab/Renovation' },
  { value: 'sba_express', name: 'SBA Express' },
  { value: 'sba_7a', name: 'SBA 7(a)' },
  { value: 'sba_504', name: 'SBA 504' },
  { value: 'usda', name: 'USDA' },
];

// Transaction types with proper database values
transactionTypes: TransactionTypeOption[] = [
  { value: 'purchase', name: 'Purchase' },
  { value: 'refinance', name: 'Refinance' },
  { value: 'cash_out_refinance', name: 'Cash-Out Refinance' },
  { value: 'rate_and_term_refinance', name: 'Rate & Term Refinance' },
];

// Signal for selected category (now using database value)
selectedCategoryValue = signal<string>('');

// Computed signal for subcategories based on selected category
selectedSubCategories = computed(() => {
  const categoryValue = this.selectedCategoryValue();
  return categoryValue ? this.propertySubcategories[categoryValue] || [] : [];
});

// Updated onCategoryChange method
onCategoryChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  
  // Set the signal using the database value
  this.selectedCategoryValue.set(value);

  // Update the form control with the database value
  this.propertyForm.get('propertyTypeCategory')?.setValue(value);
  this.propertyForm.get('propertyTypeCategory')?.updateValueAndValidity();

  // Reset subcategory when category changes
  this.propertyForm.get('propertySubCategory')?.setValue('');
  this.propertyForm.get('propertySubCategory')?.updateValueAndValidity();

  // Force change detection
  this.cdr.detectChanges();
}
 

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

  effect(() => {
  const category = this.selectedCategoryValue(); // ✅ Use the new signal name
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
