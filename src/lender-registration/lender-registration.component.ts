import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule, NgIf } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { LenderContactComponent } from './lender-contact/lender-contact.component';
import { LenderProductComponent } from './lender-product/lender-product.component';
import { LenderFootprintComponent } from './lender-footprint/lender-footprint.component';

// Mock data for dropdown options - you can move this to a service later
interface State {
  value: string;
  name: string;
}

interface LenderType {
  value: string;
  name: string;
}

@Component({
  selector: 'app-lender-registration',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LenderContactComponent,
    LenderProductComponent,
    LenderFootprintComponent,
    NgIf,
  ],
  templateUrl: './lender-registration.component.html',
  styleUrls: ['./lender-registration.component.css'],
})
export class LenderRegistrationComponent implements OnInit {
  lenderForm!: FormGroup;
  currentStep = 0;
  isLoading = false;
  submitted = false;
  successMessage = '';
  errorMessage = '';

  // Dropdown options (available to all child components)
  states: State[] = [
    { value: 'AL', name: 'Alabama' },
    { value: 'AK', name: 'Alaska' },
    { value: 'AZ', name: 'Arizona' },
    // Add all other states as needed
  ];

  lenderTypes: LenderType[] = [
    { value: 'agency', name: 'Agency Lender (Fannie/Freddie)' },
    { value: 'bank', name: 'Bank' },
    { value: 'bridge_lender', name: 'Bridge Lender' },
    // Add all other lender types as needed
  ];

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.initializeForm();
  }

  // Initialize the form with all fields needed across all steps
  private initializeForm(): void {
    this.lenderForm = this.fb.group(
      {
        // Contact information (Step 1)
        firstName: ['', Validators.required],
        lastName: ['', Validators.required],
        contactPhone: [
          '',
          [
            Validators.required,
            Validators.pattern(
              /^(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/
            ),
          ],
        ],
        contactEmail: ['', [Validators.required, Validators.email]],
        city: ['', Validators.required],
        state: ['', Validators.required],

        // Product information (Step 2)
        lenderType: ['', Validators.required],
        minLoanAmount: ['', [Validators.required, Validators.min(1)]],
        maxLoanAmount: ['', [Validators.required, Validators.min(1)]],

        // Footprint information (Step 3)
        lendingFootprint: [[] as string[], Validators.required],
        propertyTypes: this.fb.group({
          // Will be populated dynamically in the footprint component
        }),
      },
      { validators: this.validateLoanAmounts }
    );
  }

  // Custom validator to ensure max loan amount is greater than min loan amount
  private validateLoanAmounts(
    group: FormGroup
  ): { [key: string]: boolean } | null {
    const minLoanAmount = parseFloat(group.get('minLoanAmount')?.value);
    const maxLoanAmount = parseFloat(group.get('maxLoanAmount')?.value);

    if (minLoanAmount && maxLoanAmount && maxLoanAmount <= minLoanAmount) {
      group.get('maxLoanAmount')?.setErrors({ min: true });
      return { invalidLoanRange: true };
    }

    return null;
  }

  // Step navigation methods
  nextStep(): void {
    // Validate current step before proceeding
    if (this.validateCurrentStep()) {
      if (this.currentStep < 2) {
        this.currentStep++;
      }
    }
  }

  prevStep(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
    }
  }

  // Validate just the fields in the current step
  validateCurrentStep(): boolean {
    const step1Fields = [
      'firstName',
      'lastName',
      'contactPhone',
      'contactEmail',
      'city',
      'state',
    ];
    const step2Fields = ['lenderType', 'minLoanAmount', 'maxLoanAmount'];
    const step3Fields = ['lendingFootprint', 'propertyTypes'];

    let fieldsToCheck: string[] = [];

    switch (this.currentStep) {
      case 0:
        fieldsToCheck = step1Fields;
        break;
      case 1:
        fieldsToCheck = step2Fields;
        break;
      case 2:
        fieldsToCheck = step3Fields;
        break;
    }

    // Mark fields as touched to trigger validation
    fieldsToCheck.forEach((field) => {
      const control = this.lenderForm.get(field);
      if (control) {
        control.markAsTouched();
      }
    });

    // Check if the fields in current step are valid
    return fieldsToCheck.every((field) => {
      const control = this.lenderForm.get(field);
      return control ? control.valid : false;
    });
  }

  // Form submission
  submitForm(): void {
    this.submitted = true;
    this.errorMessage = '';
    this.successMessage = '';

    if (this.lenderForm.invalid) {
      console.log('Form is invalid');
      return;
    }

    this.isLoading = true;

    // Process form data for submission
    const formData = this.prepareFormData();
    console.log('Form data to submit:', formData);

    // Simulate API call
    setTimeout(() => {
      this.isLoading = false;
      this.successMessage = 'Lender registration completed successfully!';
      // In real app, you would call your service here
      // this.lenderService.register(formData).subscribe(...)
    }, 1500);
  }

  // Prepare form data for submission
  private prepareFormData(): any {
    const formValue = this.lenderForm.value;

    // Process propertyTypes to get selected values
    const propertyTypesGroup = formValue.propertyTypes || {};
    const selectedPropertyTypes = Object.entries(propertyTypesGroup)
      .filter(([_, value]) => value === true)
      .map(([key]) => key);

    return {
      contactInfo: {
        firstName: formValue.firstName,
        lastName: formValue.lastName,
        contactPhone: formValue.contactPhone,
        contactEmail: formValue.contactEmail,
        city: formValue.city,
        state: formValue.state,
      },
      productInfo: {
        lenderType: formValue.lenderType,
        loanAmounts: {
          min: parseFloat(formValue.minLoanAmount || '0'),
          max: parseFloat(formValue.maxLoanAmount || '0'),
        },
      },
      footprintInfo: {
        lendingFootprint: formValue.lendingFootprint,
        propertyTypes: selectedPropertyTypes,
      },
    };
  }
}
