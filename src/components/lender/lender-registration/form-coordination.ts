// src/app/lender-registration/form-coordination.ts

import { Injectable, inject } from '@angular/core';
import {
  FormGroup,
  FormBuilder,
  ValidatorFn,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { StepManagementService } from './step-management';

@Injectable({
  providedIn: 'root',
})
export class FormCoordinationService {
  private fb = inject(FormBuilder);
  private stepService = inject(StepManagementService);

  // Main form and step-specific form groups
  private mainForm: FormGroup = this.fb.group({});
  private contactForm: FormGroup = this.fb.group({});
  private productForm: FormGroup = this.fb.group({});
  private footprintForm: FormGroup = this.fb.group({});

  constructor() {
    // Initialize the form structure
    this.initForms();

    // Listen for step changes to activate/deactivate validators
    this.stepService.currentStep$.subscribe((stepIndex) => {
      this.toggleValidators(stepIndex);
    });
  }

  private initForms(): void {
    // Initialize individual form groups with their controls
    this.contactForm = this.fb.group({
      // Contact form controls (initialized without validators)
      firstName: [''],
      lastName: [''],
      contactEmail: [''],
      contactPhone: [''],
      company: [''],
      city: [''],
      state: [''],
    });

    this.productForm = this.fb.group({
      // Product form controls (initialized without validators)
      lenderTypes: this.fb.array([]),
      propertyCategories: this.fb.array([]),
      subcategorySelections: this.fb.array([]),
      minLoanAmount: [''],
      maxLoanAmount: [''],
      loanTypes: this.fb.array([]),
      ficoScore: [''],
    });

    this.footprintForm = this.fb.group({
      // Footprint form controls (initialized without validators)
      lendingFootprint: [[]],
      states: this.fb.group({}),
    });

    // Add the subforms to the main form
    this.mainForm = this.fb.group({
      contact: this.contactForm,
      product: this.productForm,
      footprint: this.footprintForm,
      termsAccepted: [false],
    });
  }

  // Toggle validators based on the current step
  private toggleValidators(currentStep: number): void {
    // Disable all validators first
    this.disableAllValidators();

    // Enable validators only for the current step
    switch (currentStep) {
      case 0:
        this.enableContactValidators();
        break;
      case 1:
        this.enableProductValidators();
        break;
      case 2:
        this.enableFootprintValidators();
        break;
      case 3:
        // Enable all validators for review step
        this.enableContactValidators();
        this.enableProductValidators();
        this.enableFootprintValidators();
        break;
    }
  }

  // Disable all validators across the form
  private disableAllValidators(): void {
    this.disableFormValidators(this.contactForm);
    this.disableFormValidators(this.productForm);
    this.disableFormValidators(this.footprintForm);
  }

  // Helper to disable all validators in a form group
  private disableFormValidators(form: FormGroup): void {
    Object.keys(form.controls).forEach((key) => {
      const control = form.get(key);
      if (control instanceof FormGroup) {
        this.disableFormValidators(control);
      } else {
        control?.clearValidators();
        control?.updateValueAndValidity({ emitEvent: false });
      }
    });
  }

  // Enable validators for contact step
  private enableContactValidators(): void {
    // Add your validators here
    // Example:
    const contactControls = this.contactForm.controls;

    // Clear and set new validators for each control
    Object.keys(contactControls).forEach((key) => {
      const control = contactControls[key];
      control.clearValidators();

      // Apply appropriate validators based on the field
      // (This is where you add your actual validation rules)
    });

    this.contactForm.updateValueAndValidity({ emitEvent: false });
  }

  // Enable validators for product step
  private enableProductValidators(): void {
    // Add your validators here
    // Don't validate states prematurely - this is the key fix
  }

  // Enable validators for footprint step
  private enableFootprintValidators(): void {
    // Only add the state selection validators in this step
    const statesGroup = this.footprintForm.get('states') as FormGroup;
    if (statesGroup) {
      statesGroup.setValidators(this.atLeastOneStateValidator());
      statesGroup.updateValueAndValidity({ emitEvent: false });
    }
  }

  // Validator for ensuring at least one state is selected
  private atLeastOneStateValidator(): ValidatorFn {
    return (formGroup: AbstractControl): ValidationErrors | null => {
      const statesGroup = formGroup as FormGroup;
      if (!statesGroup) return { noStateSelected: true };

      const anyStateSelected = Object.keys(statesGroup.controls)
        .filter((key) => !key.includes('_counties'))
        .some((key) => statesGroup.get(key)?.value === true);

      return anyStateSelected ? null : { noStateSelected: true };
    };
  }

  // Get the main form
  getMainForm(): FormGroup {
    return this.mainForm;
  }

  // Get specific step forms
  getContactForm(): FormGroup {
    return this.contactForm;
  }

  getProductForm(): FormGroup {
    return this.productForm;
  }

  getFootprintForm(): FormGroup {
    return this.footprintForm;
  }

  // Get error messages
  getStepErrorMessage(stepIndex: number): string | null {
    switch (stepIndex) {
      case 0:
        return this.getContactErrorMessage();
      case 1:
        return this.getProductErrorMessage();
      case 2:
        return this.getFootprintErrorMessage();
      default:
        return null;
    }
  }

  // Individual error message generators
  private getContactErrorMessage(): string | null {
    if (this.contactForm.valid) return null;

    // Return specific error messages based on which control is invalid
    const controls = this.contactForm.controls;
    if (controls['firstName'].invalid) return 'Please enter a valid first name';
    if (controls['lastName'].invalid) return 'Please enter a valid last name';
    if (controls['company'].invalid) return 'Please enter a valid company name';
    if (controls['contactEmail'].invalid) {
      const emailErrors = controls['contactEmail'].errors;
      if (emailErrors?.['emailTaken']) {
        return 'This email is already registered';
      }
      return 'Please enter a valid email address';
    }
    if (controls['contactPhone'].invalid)
      return 'Please enter a valid phone number';
    if (controls['city'].invalid) return 'Please enter a valid city';
    if (controls['state'].invalid) return 'Please select a state';

    return 'Please complete all required fields in the contact section';
  }

  private getProductErrorMessage(): string | null {
    if (this.productForm.valid) return null;

    // Check for specific errors in the product form
    if (this.productForm.get('lenderTypes')?.invalid) {
      return 'Please select at least one lender type';
    }
    if (this.productForm.get('propertyCategories')?.invalid) {
      return 'Please select at least one property category';
    }
    if (this.productForm.get('minLoanAmount')?.invalid) {
      return 'Please enter a valid minimum loan amount';
    }
    if (this.productForm.get('maxLoanAmount')?.invalid) {
      return 'Please enter a valid maximum loan amount';
    }
    if (this.productForm.get('loanTypes')?.invalid) {
      return 'Please select at least one loan type';
    }

    return 'Please complete all required fields in the product section';
  }

  private getFootprintErrorMessage(): string | null {
    if (this.footprintForm.valid) return null;

    // Check for footprint-specific errors
    const lendingFootprint = this.footprintForm.get('lendingFootprint');
    if (!lendingFootprint?.value || lendingFootprint.value.length === 0) {
      return 'Please select at least one state for your lending footprint';
    }

    return 'Please complete the lending footprint section';
  }
}
