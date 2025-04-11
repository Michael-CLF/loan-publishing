import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-loan',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterModule], // Added CommonModule for ngIf, ngFor directives
  templateUrl: './loan.component.html',
  styleUrls: ['./loan.component.css'],
})
export class LoanComponent {
  propertyForm: FormGroup;
  selectedSubCategories: string[] = [];

  // Make Object explicitly available for the template
  Object = Object;

  propertyCategories: { [key in PropertyCategory]: string[] } = {
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
  };

  states: string[] = [
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

  constructor(private fb: FormBuilder) {
    this.propertyForm = this.fb.group({
      city: ['', Validators.required],
      contact: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern('^\\d{10}$')]], // Assuming 10 digit phone numbers
      email: ['', [Validators.required, Validators.email]],
      experienceInYears: ['', [Validators.required, Validators.min(0)]],
      loanAmount: ['', [Validators.required, Validators.minLength(8)]],
      propertyValue: ['', [Validators.required, Validators.minLength(8)]],
      ltv: [
        '',
        [Validators.required, Validators.min(1), Validators.minLength(2)],
      ], // Example LTV range 1-100%
      notes: [''],
      numberOfSponsors: ['', [Validators.required, Validators.min(1)]],
      propertyTypeCategory: ['', Validators.required],
      propertySubCategory: ['', Validators.required],
      sponsorFico: [
        '',
        [Validators.required, Validators.min(300), Validators.max(850)],
      ], // FICO range
      state: ['', Validators.required],
    });
  }

  formatLoanAmount(event: Event): void {
    const input = event.target as HTMLInputElement;
    const fieldName = input.name; // You can use the `name` attribute to detect which field triggered the event

    // Remove all non-digit characters
    const digitsOnly = input.value.replace(/[^\d]/g, '');

    if (digitsOnly.length === 0) {
      // Clear the form control only for the relevant field
      this.propertyForm.get(fieldName)?.setValue('');
      return;
    }

    // Format the number to USD
    const formatted = `$${Number(digitsOnly).toLocaleString('en-US')}`;

    // Set the formatted value in the form control only for the relevant field
    this.propertyForm.get(fieldName)?.setValue(formatted, { emitEvent: false });

    // Set the input value manually so it reflects in the UI
    input.value = formatted;
  }

  onCategoryChange(event: Event): void {
    const selectedCategory = (event.target as HTMLSelectElement)
      .value as keyof typeof this.propertyCategories;
    this.selectedSubCategories =
      this.propertyCategories[selectedCategory] || [];
    this.propertyForm.patchValue({ propertySubCategory: '' });
  }

  onSubmit(): void {
    if (this.propertyForm.valid) {
      console.log('Form submitted successfully:', this.propertyForm.value);
      // Add logic to send the data to a backend or process it
    } else {
      console.warn('Form is invalid. Please fix the errors.');
      this.propertyForm.markAllAsTouched(); // Trigger validation messages
    }
  }
}

type PropertyCategory =
  | 'Healthcare'
  | 'Hospitality'
  | 'Industrial Property'
  | 'Multi-family'
  | 'Office'
  | 'Retail Property'
  | 'Special Purpose Loans';
