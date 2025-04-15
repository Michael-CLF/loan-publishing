import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidatorFn,
} from '@angular/forms';
import { CommonModule, NgIf } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { LenderContactComponent } from './lender-contact/lender-contact.component';
import { LenderProductComponent } from './lender-product/lender-product.component';
import { LenderFootprintComponent } from './lender-footprint/lender-footprint.component';

// Define interfaces for dropdown options
export interface StateOption {
  value: string;
  name: string;
}

export interface LenderTypeOption {
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
  states: StateOption[] = [
    { value: 'AL', name: 'Alabama' },
    { value: 'AK', name: 'Alaska' },
    { value: 'AZ', name: 'Arizona' },
    // Add all other states as needed
  ];

  lenderTypes: LenderTypeOption[] = [
    { value: 'agency', name: 'Agency Lender (Fannie/Freddie)' },
    { value: 'bank', name: 'Bank' },
    { value: 'bridge_lender', name: 'Bridge Lender' },
    // Add all other lender types as needed
  ];

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.initializeForm();
  }

  // Get the current form group based on step
  getStepFormGroup(): FormGroup {
    let formGroup: AbstractControl | null;

    switch (this.currentStep) {
      case 0:
        formGroup = this.lenderForm.get('contactInfo');
        break;
      case 1:
        formGroup = this.lenderForm.get('productInfo');
        break;
      case 2:
        formGroup = this.lenderForm.get('footprintInfo');
        break;
      default:
        formGroup = this.lenderForm.get('contactInfo');
    }

    // Type guard to ensure we have a FormGroup
    if (formGroup && formGroup instanceof FormGroup) {
      return formGroup;
    }

    // This should never happen if the form is initialized correctly
    console.error('Form group not found for step', this.currentStep);
    return new FormGroup({});
  }

  // Get contact info form group
  get contactForm(): FormGroup {
    const control = this.lenderForm.get('contactInfo');
    return control instanceof FormGroup ? control : new FormGroup({});
  }

  // Get product info form group
  get productForm(): FormGroup {
    const control = this.lenderForm.get('productInfo');
    return control instanceof FormGroup ? control : new FormGroup({});
  }

  // Get footprint info form group
  get footprintForm(): FormGroup {
    const control = this.lenderForm.get('footprintInfo');
    return control instanceof FormGroup ? control : new FormGroup({});
  }

  // Initialize the form with separate form groups for each step
  private initializeForm(): void {
    // Step 1: Contact Information
    const contactStep = this.fb.group({
      firstName: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[A-Za-z ]+$/),
        ],
      ],
      lastName: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[A-Za-z ]+$/),
        ],
      ],
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
      city: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[A-Za-z ]+$/),
        ],
      ],
      state: ['', Validators.required],
    });

    // Step 2: Product Information
    const productStep = this.fb.group({
      lenderType: ['', Validators.required],
      minLoanAmount: ['', [Validators.required, Validators.minLength(6)]],
      maxLoanAmount: ['', [Validators.required, Validators.minLength(6)]],
    });

    // Step 3: Footprint Information
    const footprintStep = this.fb.group({
      lendingFootprint: [[] as string[], Validators.required],
      propertyTypes: this.fb.group({
        // Will be populated dynamically in the footprint component
      }),
    });

    // Main form
    this.lenderForm = this.fb.group({
      contactInfo: contactStep,
      productInfo: productStep,
      footprintInfo: footprintStep,
    });

    // Add custom validator for loan amounts
    const productInfoGroup = this.lenderForm.get('productInfo');
    if (productInfoGroup instanceof FormGroup) {
      productInfoGroup.setValidators(this.validateLoanAmounts());
    }

    // Debug: Log form setup
    console.log('Form initialized:', this.lenderForm);
  }

  // Custom validator to ensure max loan amount is greater than min loan amount
  // Changed to a function that returns a ValidatorFn
  private validateLoanAmounts(): ValidatorFn {
    return (control: AbstractControl): { [key: string]: boolean } | null => {
      // We need to check that control is a FormGroup
      if (!(control instanceof FormGroup)) {
        return null;
      }

      const group = control as FormGroup;
      const minLoanAmount = parseFloat(group.get('minLoanAmount')?.value);
      const maxLoanAmount = parseFloat(group.get('maxLoanAmount')?.value);

      if (minLoanAmount && maxLoanAmount && maxLoanAmount <= minLoanAmount) {
        group.get('maxLoanAmount')?.setErrors({ min: true });
        return { invalidLoanRange: true };
      }

      return null;
    };
  }

  // Step navigation methods with enhanced debugging
  nextStep(): void {
    console.log('==== NEXT STEP CLICKED ====');
    console.log('Current step:', this.currentStep);

    // Get current step form group
    const currentFormGroup = this.getStepFormGroup();
    console.log('Current form group status:', {
      valid: currentFormGroup.valid,
      touched: currentFormGroup.touched,
      dirty: currentFormGroup.dirty,
      errors: currentFormGroup.errors,
    });

    // Validate current step before proceeding
    const isStepValid = this.validateCurrentStep();
    console.log('Step validation result:', isStepValid);

    if (isStepValid) {
      if (this.currentStep < 2) {
        this.currentStep++;
        console.log('Moving to step:', this.currentStep);
      }
    } else {
      console.error('Cannot proceed - current step validation failed');
    }
  }

  prevStep(): void {
    console.log('==== PREV STEP CLICKED ====');
    if (this.currentStep > 0) {
      this.currentStep--;
      console.log('Moving to step:', this.currentStep);
    }
  }

  // Improved validate current step function
  validateCurrentStep(): boolean {
    console.log('Validating current step:', this.currentStep);

    // Get the current form group
    const currentFormGroup = this.getStepFormGroup();

    // Mark all controls in this group as touched to trigger validation
    Object.keys(currentFormGroup.controls).forEach((controlName) => {
      const control = currentFormGroup.get(controlName);
      if (control) {
        control.markAsTouched();
        console.log(
          `${controlName} valid:`,
          control.valid,
          'value:',
          control.value
        );
      }
    });

    // Special handling for property types in step 3
    if (this.currentStep === 2) {
      const propertyTypesGroup = currentFormGroup.get('propertyTypes');
      if (
        propertyTypesGroup &&
        propertyTypesGroup instanceof FormGroup &&
        Object.keys(propertyTypesGroup.value || {}).length > 0
      ) {
        // Check if at least one property type is selected
        const hasSelectedType = Object.values(propertyTypesGroup.value).some(
          (value) => value === true
        );
        if (!hasSelectedType) {
          console.error('No property type selected');
          propertyTypesGroup.setErrors({ required: true });
        }
      }
    }

    return currentFormGroup.valid;
  }

  // Form submission
  submitForm(): void {
    console.log('==== SUBMIT FORM CLICKED ====');
    this.submitted = true;
    this.errorMessage = '';
    this.successMessage = '';

    // Validate all steps one final time
    let allStepsValid = true;
    const originalStep = this.currentStep;

    // Check each step
    for (let step = 0; step <= 2; step++) {
      this.currentStep = step;
      if (!this.validateCurrentStep()) {
        console.error(`Validation failed for step ${step}`);
        allStepsValid = false;
      }
    }

    // Restore original step
    this.currentStep = originalStep;

    if (!allStepsValid) {
      console.error('Form validation failed');
      this.errorMessage = 'Please complete all required fields';
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
    const contactValue = this.contactForm.value || {};
    const productValue = this.productForm.value || {};
    const footprintValue = this.footprintForm.value || {};

    // Process propertyTypes to get selected values
    const propertyTypesGroup = footprintValue.propertyTypes || {};
    const selectedPropertyTypes = Object.entries(propertyTypesGroup)
      .filter(([_, value]) => value === true)
      .map(([key]) => key);

    return {
      contactInfo: {
        firstName: contactValue.firstName,
        lastName: contactValue.lastName,
        contactPhone: contactValue.contactPhone,
        contactEmail: contactValue.contactEmail,
        city: contactValue.city,
        state: contactValue.state,
      },
      productInfo: {
        lenderType: productValue.lenderType,
        loanAmounts: {
          min: parseFloat(productValue.minLoanAmount || '0'),
          max: parseFloat(productValue.maxLoanAmount || '0'),
        },
      },
      footprintInfo: {
        lendingFootprint: footprintValue.lendingFootprint,
        propertyTypes: selectedPropertyTypes,
      },
    };
  }
}
