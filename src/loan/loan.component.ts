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
import { RouterModule } from '@angular/router';

// Type definitions
type PropertyCategory =
  | 'Healthcare'
  | 'Hospitality'
  | 'Industrial Property'
  | 'Multi-family'
  | 'Office'
  | 'Retail Property'
  | 'Special Purpose Loans';

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

  // Form group
  propertyForm!: FormGroup;

  // Make Object available to template
  Object = Object;

  // Using signals for reactive state management
  propertyCategories = signal<Record<PropertyCategory, string[]>>({
    Healthcare: [
      'Assisted Living',
      'Hospital',
      'Independent Living',
      'Rehab Facility',
    ],
    Hospitality: [
      'Hospitality Land',
      'Hotel',
      'Long-term Rentals',
      'Motel',
      'Short-term Rentals',
    ],
    'Industrial Property': [
      'Cold Storage',
      'Flex Space',
      'Industrial Land',
      'RV Park',
      'Self Storage',
      'Warehouse',
    ],
    'Multi-family': [
      'Affordable Housing',
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
    Office: [
      '1-4 Unit Residential Property',
      'Co-op Duplex',
      'Condominium',
      'Medical Office',
      'Professional Office Building',
      'Quadplex',
      'Single Family',
      'Triplex',
    ],
    'Retail Property': [
      'Anchored Center',
      'Mall',
      'NNN Retail',
      'Restaurant',
      'Retail Land',
      'Single Tenant',
      'Strip Mall',
    ],
    'Special Purpose Loans': [
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

  // States array
  states = signal<string[]>([
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
      loanAmount: ['', [Validators.required, Validators.minLength(8)]],
      propertyValue: ['', [Validators.required, Validators.minLength(8)]],
      ltv: ['', [Validators.required, Validators.min(1), Validators.max(100)]],
      noi: [''],
      city: ['', Validators.required],
      state: ['', Validators.required],
      numberOfSponsors: ['', [Validators.required, Validators.min(1)]],
      sponsorFico: [
        '',
        [Validators.required, Validators.min(300), Validators.max(850)],
      ],
      experienceInYears: ['', [Validators.required, Validators.min(0)]],
      contact: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern('^\\d{10}$')]],
      email: ['', [Validators.required, Validators.email]],
      notes: [''],
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
      // Add logic to send the data to a backend or process it

      // Reset form after submission if needed
      // this.propertyForm.reset();
      // this.selectedCategory.set('');
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
