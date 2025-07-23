import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  Injector,
  runInInjectionContext,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  FormControl,
  Validators,
  AbstractControl,
  ValidatorFn,
  ValidationErrors,
  ReactiveFormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { catchError, tap, takeUntil, finalize } from 'rxjs/operators';
import { of } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { LenderContactComponent } from '../../lender/lender-contact/lender-contact.component';
import { LenderProductComponent } from '../../lender/lender-product/lender-product.component';
import { LenderFootprintComponent } from '../../lender/lender-footprint/lender-footprint.component';
import { LenderReviewComponent } from '../../lender/lender-review/lender-review.component';
import { from, Subject } from 'rxjs';
import { EmailExistsValidator } from '../../services/email-exists.validator';
import { AuthService } from '../../services/auth.service';
import { ModalService } from '../../services/modal.service';
import { StepManagementService } from './step-management';
import { FormCoordinationService } from './form-coordination';
import { LocationService } from '../../services/location.service';
import { StripeService, CheckoutSessionRequest } from '../../services/stripe.service';
import { FootprintLocation } from '../../models/footprint-location.model';
import { LenderStripePaymentComponent } from '../lender-stripe-payment/lender-stripe-payment.component';
import {
  PROPERTY_CATEGORIES,
  PROPERTY_SUBCATEGORIES,
  PropertyCategory,
  PropertySubcategory
} from '../../shared/constants/property-mappings';

export interface LenderTypeOption {
  value: string;
  name: string;
}

export interface LoanTypes {
  value: string;
  name: string;
}

export interface SubCategory {
  value: string;
  name: string;
}

export interface StateOption {
  value: string;
  name: string;
}

interface CouponValidationResponse {
  valid: boolean;
  coupon?: {
    id: string;
    code: string;
    discount: number;
    discountType: 'percentage' | 'fixed';
    description?: string;
  };
  error?: string;
}

interface AppliedCouponDetails {
  code: string;
  displayCode?: string;
  discount: number;
  discountType: 'percentage' | 'fixed';
  description?: string;
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
    LenderReviewComponent,
    LenderStripePaymentComponent,
  ],
  templateUrl: './lender-registration.component.html',
  styleUrls: ['./lender-registration.component.css'],
})
export class LenderRegistrationComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private modalService = inject(ModalService);
  private stripeService = inject(StripeService);
  private injector = inject(Injector);
  private locationService = inject(LocationService);
  private emailExistsValidator = inject(EmailExistsValidator);
  public stepService = inject(StepManagementService);
  private formCoordination = inject(FormCoordinationService);

  states: FootprintLocation[] = [];
  lenderForm!: FormGroup;
  currentStep = 0;
  isLoading = false;
  submitted = false;
  successMessage = '';
  errorMessage = '';
  isValidatingCoupon = false;
  couponApplied = false;
  appliedCouponDetails: AppliedCouponDetails | null = null;
  private subscriptions: Subscription[] = [];
  private destroy$ = new Subject<void>();

  lenderTypes: LenderTypeOption[] = [
    { value: 'agency', name: 'Agency Lender' },
    { value: 'bank', name: 'Bank' },
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

  loanTypes: LoanTypes[] = [
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
  ];

  propertyCategories: PropertyCategory[] = Object.entries(PROPERTY_CATEGORIES).map(([categoryValue, categoryName]) => {
    const subcategories: PropertySubcategory[] = Object.entries(PROPERTY_SUBCATEGORIES)
      .filter(([key]) => key.startsWith(`${categoryValue}:`))
      .map(([key, name]) => ({
        value: key,
        name,
      }));

    return {
      value: categoryValue,
      name: categoryName,
      subcategories,
    };
  });


  ngOnInit(): void {
    this.initializeForm();
    this.states = this.locationService.getFootprintLocations();
    this.initializeStateCountiesStructure();

    this.subscriptions.push(
      this.stepService.currentStep$.subscribe((step) => {
        this.currentStep = step;
        this.toggleStepValidation();
        this.errorMessage = '';
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  // Type-safe getters for form groups
  get contactForm(): FormGroup {
    const form = this.lenderForm.get('contactInfo');
    if (form instanceof FormGroup) {
      return form;
    }
    throw new Error('contactInfo is not a FormGroup');
  }

  get productForm(): FormGroup {
    const form = this.lenderForm.get('productInfo');
    if (form instanceof FormGroup) {
      return form;
    }
    throw new Error('productInfo is not a FormGroup');
  }

  get footprintForm(): FormGroup {
    const form = this.lenderForm.get('footprintInfo');
    if (form instanceof FormGroup) {
      return form;
    }
    throw new Error('footprintInfo is not a FormGroup');
  }

  // FormArray getters
  get lenderTypesArray(): FormArray {
    return this.productForm.get('lenderTypes') as FormArray;
  }

  get propertyCategoriesArray(): FormArray {
    return this.productForm.get('propertyCategories') as FormArray;
  }

  get propertyTypesArray(): FormArray {
    return this.productForm.get('propertyTypes') as FormArray;
  }

  get loanTypesArray(): FormArray {
    return this.productForm.get('loanTypes') as FormArray;
  }

  get termsAccepted(): FormControl {
    return this.lenderForm.get('termsAccepted') as FormControl;
  }

  getLenderData() {
    return {
      companyName: this.lenderForm.get('contactInfo.company')?.value || '',
      firstName: this.lenderForm.get('contactInfo.firstName')?.value || '',
      lastName: this.lenderForm.get('contactInfo.lastName')?.value || '',
      email: this.lenderForm.get('contactInfo.contactEmail')?.value || '',
      phone: this.lenderForm.get('contactInfo.contactPhone')?.value || '',
      city: this.lenderForm.get('contactInfo.city')?.value || '',
      state: this.lenderForm.get('contactInfo.state')?.value || '',
      completeFormData: {
        contactInfo: this.lenderForm.get('contactInfo')?.value,
        productInfo: this.lenderForm.get('productInfo')?.value,
        footprintInfo: this.lenderForm.get('footprintInfo')?.value
      }
    };
  }

  handlePaymentComplete(event: any) {
    console.log('Payment completed:', event);
    this.successMessage = event.message || 'Payment completed successfully!';
  }

  handlePaymentError(event: any) {
    console.log('Payment error:', event);
    this.errorMessage = event.error || 'Payment failed. Please try again.';
  }

  public getStepFormGroup(): FormGroup {
    // Get appropriate form group based on current step (1-based)
    switch (this.currentStep) {
      case 0:
        return this.contactForm;     // Step 1: Contact
      case 1:
        return this.productForm;     // Step 2: Product
      case 2:
        return this.footprintForm;   // Step 3: Footprint
      case 3:
      case 4:
        return this.lenderForm;      // Step 4: Review, Step 5: Payment
      default:
        return this.contactForm;     // Default fallback
    }
  }

  selectBilling(interval: 'monthly' | 'annually'): void {
    this.lenderForm.patchValue({ interval });
  }

  // Custom validator for minimum checkbox selection
  private minSelectedCheckboxes(min = 1): ValidatorFn {
    return (formArray: AbstractControl): { [key: string]: any } | null => {
      if (formArray instanceof FormArray) {
        const totalSelected = formArray.controls.length;
        return totalSelected >= min ? null : { required: true };
      }
      return null;
    };
  }

  private initializeForm(): void {
    // Create contact step form group
    const contactStep = this.fb.group({
      company: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[A-Za-z0-9 ]+$/),
        ],
      ],
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
          Validators.pattern(/^\d{10}$/),
        ],
      ],
      contactEmail: [
        '',
        [Validators.required, Validators.email],
        this.emailExistsValidator.validate.bind(this.emailExistsValidator),
      ],
      city: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[A-Za-z ]+$/),
        ],
      ],
      state: ['', Validators.required],
      couponCode: ['']
    });

    // Create form arrays with explicit debug names
    const lenderTypesArray = this.fb.array([], {
      validators: [this.minSelectedCheckboxes(1)],
      updateOn: 'change',
    });

    const propertyCategoriesArray = this.fb.array([], {
      validators: [this.minSelectedCheckboxes(1)],
      updateOn: 'change',
    });

    const propertyTypesArray = this.fb.array([]);

    // Explicitly create loan types array with validator
    const loanTypesArray = this.fb.array([], {
      validators: [this.minSelectedCheckboxes(1)],
      updateOn: 'change',
    });

    // Create subcategory selections array
    const subcategorySelectionsArray = this.fb.array([]);

    const productStep = this.fb.group({
      lenderTypes: lenderTypesArray,
      minLoanAmount: [
        null,
        [Validators.required, Validators.pattern(/^\d{6,}$/)],
      ],
      maxLoanAmount: [
        null,
        [Validators.required, Validators.pattern(/^\d{6,}$/)],
      ],
      ficoScore: [
        '',
        [
          Validators.required,
          Validators.min(300),
          Validators.max(850),
          Validators.pattern(/^\d+$/),
        ],
      ],
      propertyCategories: propertyCategoriesArray,
      propertyTypes: propertyTypesArray,
      loanTypes: loanTypesArray,
      subcategorySelections: subcategorySelectionsArray,
    });

    // Create footprint step form group WITHOUT validators initially
    const footprintStep = this.fb.group({
      lendingFootprint: [[]],
      states: this.fb.group({}),
    });

    // Initialize the main form
    this.lenderForm = this.fb.group({
      contactInfo: contactStep,
      productInfo: productStep,
      footprintInfo: footprintStep,
      termsAccepted: [false],
      interval: ['monthly', [Validators.required]], // Add billing interval here
    });

    // Initialize counties structure
    this.initializeStateCountiesStructure();

    // Apply validators based on current step
    setTimeout(() => {
      this.toggleStepValidation();

      // Log form status after initialization
      console.log('Form initialized with structure:');
      this.debugFormStructure(this.lenderForm);
    });
  }

  // New method to toggle validators based on current step
  private toggleStepValidation(): void {
    console.log(`Toggling validation for step ${this.currentStep}`);

    // First, disable all validators that should only be active in specific steps
    this.disableAllValidators();
    switch (this.currentStep) {
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
        // Enable all validators for review
        this.enableContactValidators();
        this.enableProductValidators();
        this.enableFootprintValidators();
        // Terms acceptance only required at review step
        const termsControl = this.lenderForm.get('termsAccepted');
        if (termsControl) {
          termsControl.setValidators(Validators.requiredTrue);
          termsControl.updateValueAndValidity({ emitEvent: false });
        }
        break;
      case 5:
        // Payment step - require billing interval
        const intervalControl = this.lenderForm.get('interval');
        if (intervalControl) {
          intervalControl.setValidators(Validators.required);
          intervalControl.updateValueAndValidity({ emitEvent: false });
        }
        break;
    }

    // Force update validation status on all form groups
    this.contactForm.updateValueAndValidity({ emitEvent: false });
    this.productForm.updateValueAndValidity({ emitEvent: false });
    this.footprintForm.updateValueAndValidity({ emitEvent: false });

    // Update the entire form
    this.lenderForm.updateValueAndValidity({ emitEvent: false });

    // Add additional debug info for step 2 (footprint)
    if (this.currentStep === 2) {
      const statesGroup = this.footprintForm.get('states') as FormGroup;
      if (statesGroup) {
        const selectedStates = Object.keys(statesGroup.controls)
          .filter((key) => !key.includes('_counties'))
          .filter((key) => statesGroup.get(key)?.value === true);

        console.log('Selected states:', selectedStates);
        console.log('States group valid:', statesGroup.valid);
        console.log('States group errors:', statesGroup.errors);
      }
    }

    console.log(
      `Validation applied for step ${this.currentStep}, form valid: ${this.lenderForm.valid}`
    );
  }

  // Disable all validators
  private disableAllValidators(): void {
    // Remove validators from terms
    const termsControl = this.lenderForm.get('termsAccepted');
    if (termsControl) {
      termsControl.clearValidators();
      termsControl.updateValueAndValidity({ emitEvent: false });
    }

    // Remove validators from footprint
    const lendingFootprint = this.footprintForm.get('lendingFootprint');
    if (lendingFootprint) {
      lendingFootprint.clearValidators();
      lendingFootprint.updateValueAndValidity({ emitEvent: false });
    }

    // States validator is handled separately
    const statesGroup = this.footprintForm.get('states') as FormGroup;
    if (statesGroup) {
      statesGroup.clearValidators();
      statesGroup.updateValueAndValidity({ emitEvent: false });
    }
  }

  // Enable contact step validators
  private enableContactValidators(): void {
    // Contact form validators are already set in initializeForm
    this.contactForm.updateValueAndValidity({ emitEvent: false });
  }

  // Enable product step validators
  private enableProductValidators(): void {
    // Product form validators are already set in initializeForm
    this.productForm.updateValueAndValidity({ emitEvent: false });
  }

  // Enable footprint step validators
  private enableFootprintValidators(): void {
    // Apply validation to lendingFootprint
    const lendingFootprint = this.footprintForm.get('lendingFootprint');
    if (lendingFootprint) {
      lendingFootprint.setValidators(Validators.required);
      lendingFootprint.updateValueAndValidity({ emitEvent: false });
    }

    // This is the key change - apply validator directly to the states FormGroup
    const statesGroup = this.footprintForm.get('states') as FormGroup;
    if (statesGroup) {
      statesGroup.setValidators(this.atLeastOneStateValidator());
      statesGroup.updateValueAndValidity({ emitEvent: false });

      // Add debug output to check selected states
      console.log(
        'States selection status:',
        Object.keys(statesGroup.controls)
          .filter((key) => !key.includes('_counties'))
          .map((key) => ({ state: key, selected: statesGroup.get(key)?.value }))
          .filter((item) => item.selected)
      );
    }

    this.footprintForm.updateValueAndValidity({ emitEvent: false });
    console.log('Footprint form valid:', this.footprintForm.valid);
    console.log('States group valid:', statesGroup?.valid);
  }

  private atLeastOneStateValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const statesGroup = control as FormGroup;

      if (!statesGroup) {
        console.error('States form group is null');
        return { noStateSelected: true };
      }

      // Get all state controls (exclude counties)
      const stateControls = Object.keys(statesGroup.controls).filter(
        (key) => !key.includes('_counties')
      );

      // Check if any state is selected (has value true)
      const selectedStates = stateControls.filter(
        (key) => statesGroup.get(key)?.value === true
      );

      const anyStateSelected = selectedStates.length > 0;

      console.log('State validator found selected states:', selectedStates);
      console.log('Any state selected:', anyStateSelected);

      return anyStateSelected ? null : { noStateSelected: true };
    };
  }

  // Add this new method for counties initialization
  private initializeStateCountiesStructure(): void {
    const statesFormGroup = this.footprintForm.get('states') as FormGroup;

    // Pre-initialize state entries for all states
    this.states.forEach((state) => {
      const stateValue = state.value;

      // Add state selection control if it doesn't exist
      if (!statesFormGroup.contains(stateValue)) {
        statesFormGroup.addControl(stateValue, this.fb.control(false));
      }

      // Add a properly initialized counties FormGroup if it doesn't exist
      const countiesKey = `${stateValue}_counties`;
      if (!statesFormGroup.contains(countiesKey)) {
        statesFormGroup.addControl(countiesKey, this.fb.group({}));
      }
    });
  }

  // Update the onLenderTypeChange method to enforce single selection
  onLenderTypeChange(event: any, typeValue: string): void {
    event.stopPropagation(); // Prevent event bubbling
    const lenderTypesArray = this.lenderTypesArray;

    // Clear the array first (to ensure radio button behavior)
    while (lenderTypesArray.length > 0) {
      lenderTypesArray.removeAt(0);
    }

    // Find the full lender type object
    const lenderTypeObject = this.lenderTypes.find(
      (t) => t.value === typeValue
    );

    // Add only the selected type
    if (lenderTypeObject) {
      lenderTypesArray.push(this.fb.control(lenderTypeObject));
    }

    // Update validation
    lenderTypesArray.updateValueAndValidity();
    this.productForm.updateValueAndValidity();
  }

  // Add this helper method for deep form inspection
  private debugFormStructure(form: FormGroup, prefix = ''): void {
    Object.keys(form.controls).forEach((key) => {
      const control = form.get(key);
      const path = prefix ? `${prefix}.${key}` : key;

      if (control instanceof FormGroup) {
        console.log(`Group: ${path}, Valid: ${control.valid}`);
        this.debugFormStructure(control, path);
      } else if (control instanceof FormArray) {
        console.log(
          `Array: ${path}, Valid: ${control.valid}, Length: ${control.length}, Errors:`,
          control.errors
        );
      } else if (control) {
        console.log(
          `Control: ${path}, Valid: ${control.valid}, Value: ${control.value}, Errors:`,
          control.errors
        );
      }
    });
  }

  onPropertyCategoryChange(event: any, value: string): void {
    const checked = event.target.checked;
    const propertyCategoriesArray = this.propertyCategoriesArray;

    if (checked) {
      propertyCategoriesArray.push(this.fb.control(value));
      console.log(`Added property category: ${value}`);
    } else {
      const index = propertyCategoriesArray.controls.findIndex(
        (control) => control.value === value
      );
      if (index >= 0) {
        propertyCategoriesArray.removeAt(index);
        console.log(`Removed property category: ${value}`);
      }
    }

    // Log for debugging
    console.log(
      'Property categories after change:',
      propertyCategoriesArray.value
    );
    console.log('Property categories count:', propertyCategoriesArray.length);
    console.log('Property categories valid:', propertyCategoriesArray.valid);
    console.log('Property categories errors:', propertyCategoriesArray.errors);

    // Update validation
    propertyCategoriesArray.updateValueAndValidity();
    this.productForm.updateValueAndValidity();
  }

  onPropertyTypeChange(event: any, value: string): void {
    const checked = (event.target as HTMLInputElement).checked;
    const propertyTypesArray = this.propertyTypesArray;

    if (checked) {
      propertyTypesArray.push(this.fb.control(value));
    } else {
      const index = propertyTypesArray.controls.findIndex(
        (control) => control.value === value
      );
      if (index >= 0) {
        propertyTypesArray.removeAt(index);
      }
    }

    // Update validation
    propertyTypesArray.updateValueAndValidity();
    this.productForm.updateValueAndValidity();
  }

  // Helper method to check if a value is selected in a FormArray
  isOptionSelected(formArrayName: string, value: string): boolean {
    const formArray = this.productForm.get(formArrayName) as FormArray;
    return formArray.controls.some((control) =>
      typeof control.value === 'object'
        ? control.value.value === value
        : control.value === value
    );
  }

  // Form validation methods
  isControlInvalid(controlName: string): boolean {
    const control = this.productForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  controlHasError(controlName: string, errorName: string): boolean {
    const control = this.productForm.get(controlName);
    return !!control && control.hasError(errorName);
  }

  markControlAsTouched(controlName: string): void {
    const control = this.productForm.get(controlName);
    if (control) control.markAsTouched();
  }

  // Helper method to mark all controls in a form group as touched
  private markAllAsTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach((key) => {
      const control = formGroup.get(key);
      if (control instanceof FormGroup) {
        this.markAllAsTouched(control);
      } else if (control instanceof FormArray) {
        for (let i = 0; i < control.length; i++) {
          if (control.at(i) instanceof FormGroup) {
            this.markAllAsTouched(control.at(i) as FormGroup);
          } else {
            control.at(i).markAsTouched();
          }
        }
        control.markAsTouched();
      } else if (control) {
        control.markAsTouched();
      }
    });
  }

  // Next step handler - updated to use step service
  nextStep(): void {
    const currentForm = this.getStepFormGroup();
    this.markAllAsTouched(currentForm);

    // Clear any previous error messages
    this.errorMessage = '';

    console.log('Form valid:', currentForm.valid);
    console.log('Form value:', currentForm.value);
    if (this.productForm.valid) {
      // allow next
    } else {
      console.log(this.productForm.value);
      console.log(this.productForm.valid);
    }

    Object.keys(this.productForm.controls).forEach((controlName) => {
      const control = this.productForm.get(controlName);
      if (control?.invalid) {
        console.log(`❌ Invalid control: ${controlName}`, control.errors);
      }
    });

    // If form is valid, proceed
    if (currentForm.valid) {
      // If completing contact info step, save to localStorage as backup
      if (this.currentStep === 0) {
        try {
          localStorage.setItem(
            'lenderContactData',
            JSON.stringify(this.contactForm.value)
          );
          console.log('Contact data saved to localStorage');
        } catch (error) {
          console.error('Error saving to localStorage:', error);
        }
      }

      // For all steps, just proceed to next step
      if (this.currentStep < 5) {
        this.stepService.moveToNextStep();
      }
    } else {
      // Display appropriate error message based on the current step
      this.errorMessage = this.getStepErrorMessage();
    }
  }

  prevStep(): void {
    if (this.currentStep > 0) {
      this.stepService.moveToPreviousStep();
    }
  }

  private getStepErrorMessage(): string {
    switch (this.currentStep) {
      case 0:
        return 'Please complete all required fields in the contact section';
      case 1:
        return 'Please complete all required fields in the product section';
      case 2:
        return 'Please select at least one state for your lending footprint';
      case 3:
        return 'Please review all information and agree to the terms';
      case 4:
        return 'Please select a billing option and complete payment';
      default:
        return 'Please complete all required fields';
    }
  }

  isCurrentStepValid(): boolean {
    const currentForm = this.getStepFormGroup();
    return currentForm.valid;
  }

  // MODIFIED: Combined submit and payment processing
  submitForm(): void {
    this.submitted = true;
    this.markAllAsTouched(this.lenderForm);
    this.errorMessage = '';
    this.successMessage = '';
    this.footprintForm.get('states')?.updateValueAndValidity();
    console.log('Terms accepted:', this.lenderForm.get('termsAccepted')?.value);
    console.log('Form valid:', this.lenderForm.valid);

    if (!this.lenderForm.valid) {
      this.isLoading = false;
      this.errorMessage = this.getStepErrorMessage();
      return;
    }

    this.isLoading = true;

    const formData = this.lenderForm.value;
    const email = formData.contactInfo?.contactEmail;

    if (!email) {
      this.errorMessage = 'Email is required';
      this.isLoading = false;
      return;
    }

    // ✅ Store registration data for webhook (same pattern as originator)
    try {
      localStorage.setItem('pendingRegistration', JSON.stringify(formData));
      console.log('✅ Lender registration data stored for webhook processing');
    } catch (err) {
      console.error('Failed to store lender data locally', err);
      this.errorMessage = 'Failed to prepare registration. Please try again.';
      this.isLoading = false;
      return;
    }

    // ✅ NEW: Create Stripe checkout session directly (no user creation)
    runInInjectionContext(this.injector, () => {
      const payload: CheckoutSessionRequest = {
        email: email,
        role: 'lender',
        interval: formData.interval,
        userData: {
          firstName: formData.contactInfo.firstName,
          lastName: formData.contactInfo.lastName,
          company: formData.contactInfo.company,
          phone: formData.contactInfo.contactPhone,
          city: formData.contactInfo.city,
          state: formData.contactInfo.state
        }
      };

      // ✅ Add validated promotion code if present
      if (this.couponApplied && this.appliedCouponDetails) {
        payload.promotion_code = this.appliedCouponDetails.code;
      }
      console.log('🚀 LENDER: Payload being sent to Stripe:', {
        hasPromotionCode: !!payload.promotion_code,
        promotionCode: payload.promotion_code,
        couponApplied: this.couponApplied,
        appliedCouponDetails: this.appliedCouponDetails,
        fullPayload: payload
      });

      from(this.stripeService.createCheckoutSession(payload)).pipe(
        catchError((error: any) => {
          this.isLoading = false;
          console.error('❌ Stripe checkout error:', error);
          this.errorMessage = error.message || 'Failed to create checkout session. Please try again.';
          return of(null);
        })
      ).subscribe({
        next: (checkoutResponse) => {
          console.log('🔥 CALLBACK EXECUTED - WE ARE HERE!');
          console.log('🔍 Full checkoutResponse object:', checkoutResponse);
          console.log('🔍 checkoutResponse.url:', checkoutResponse?.url);
          console.log('🔍 Type of response:', typeof checkoutResponse);

          if (checkoutResponse && checkoutResponse.url) {
            console.log('✅ Stripe checkout session created, redirecting to:', checkoutResponse.url);
            console.log('🚀 About to redirect...');
            console.log('🚀 About to redirect...');
            try {
              window.location.href = checkoutResponse.url;
              console.log('✅ Redirect initiated');
            } catch (err) {
              console.error('❌ Redirect failed:', err);
              // Fallback redirect method
              window.open(checkoutResponse.url, '_self');
            }
          } else {
            console.log('❌ No URL in response or invalid response');
            this.isLoading = false;
            this.errorMessage = 'Invalid checkout response. Please try again.';
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.error('❌ Checkout error:', error);
          this.errorMessage = 'An unexpected error occurred. Please try again.';
        }
      });
    });
  }

  private extractStringValues(input: any[]): string[] {
    return input?.map((i) => typeof i === 'object' && i?.value ? i.value : i) || [];
  }

  private extractLenderTypes(lenderTypes: any[]): string[] {
    return lenderTypes?.map((t) => t?.value || t) || [];
  }

  private extractSelectedStatesArray(statesData: any): string[] {
    return Object.keys(statesData || {}).filter(
      (key) => !key.includes('_counties') && statesData[key] === true
    );
  }

  validateCoupon(): void {
    const couponCode = this.lenderForm.get('contactInfo.couponCode')?.value?.trim();
    if (!couponCode) return;

    this.isValidatingCoupon = true;

    this.stripeService.validatePromotionCode(couponCode)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isValidatingCoupon = false),
        catchError((error: HttpErrorResponse) => {
          console.error('Coupon validation error:', error);
          this.setCouponError('Unable to validate coupon. Please try again.');
          return of(null);
        })
      )
      .subscribe(response => {
        if (response) {
          this.handleCouponValidationResponse(response);
        }
      });
  }

  private handleCouponValidationResponse(response: any): void {
    if (response.valid && response.promotion_code) {
      this.couponApplied = true;

      const coupon = response.promotion_code.coupon;
      this.appliedCouponDetails = {
        code: response.promotion_code.id,
        displayCode: response.promotion_code.code,
        discount: coupon.percent_off || coupon.amount_off || 0,
        discountType: coupon.percent_off ? 'percentage' : 'fixed',
        description: coupon.name
      };
      console.log('🎫 LENDER: Coupon validation successful:', {
        promotionCodeId: response.promotion_code.id,
        displayCode: response.promotion_code.code,
        appliedCouponDetails: this.appliedCouponDetails,
        couponApplied: this.couponApplied
      });
      this.clearCouponErrors();
    } else {
      this.resetCouponState();
      this.setCouponError(response.error || 'Invalid coupon code');
    }
  }

  private setCouponError(errorMessage: string): void {
    const couponControl = this.lenderForm.get('contactInfo.couponCode');
    if (couponControl) {
      couponControl.setErrors({ couponError: errorMessage });
    }
  }

  private clearCouponErrors(): void {
    const couponControl = this.lenderForm.get('contactInfo.couponCode');
    if (couponControl) {
      couponControl.setErrors(null);
    }
  }

  private resetCouponState(): void {
    this.couponApplied = false;
    this.appliedCouponDetails = null;
    this.clearCouponErrors();
  }

  private parseNumericValue(value: any): number {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    return parseFloat(value.toString().replace(/[^0-9.]/g, '')) || 0;
  }
}