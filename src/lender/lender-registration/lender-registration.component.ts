// src/app/lender-registration/lender-registration.component.ts

import {
  Component,
  OnInit,
  inject,
  Injector,
  runInInjectionContext,
  OnDestroy,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  FormControl,
  Validators,
  AbstractControl,
  ValidatorFn,
  ReactiveFormsModule,
  ValidationErrors,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { take, switchMap, catchError, finalize, map } from 'rxjs/operators';
import { of, from, Observable, Subscription } from 'rxjs';

import { LenderContactComponent } from '../../lender/lender-contact/lender-contact.component';
import { LenderProductComponent } from '../../lender/lender-product/lender-product.component';
import { LenderFootprintComponent } from '../../lender/lender-footprint/lender-footprint.component';
import { LenderReviewComponent } from '../../lender/lender-review/lender-review.component';
import { EmailExistsValidator } from '../../services/email-exists.validator';
import { AuthService } from '../../services/auth.service';
import { FirestoreService } from '../../services/firestore.service';
import { Firestore, doc } from '@angular/fire/firestore';
import { collection } from '@angular/fire/firestore';
import { ModalService } from '../../services/modal.service';
import { getUserId } from '../../utils/user-helpers';
import { StepManagementService } from './step-management';
import { FormCoordinationService } from './form-coordination';
import { LocationService } from '../../services/location.service';
import { FootprintLocation } from '../../models/footprint-location.model';

export interface PropertyCategory {
  name: string;
  value: string;
  subcategories: { name: string; value: string }[];
}

export interface StateOption {
  value: string;
  name: string;
}

export interface CityOption {
  value: string;
  name: string;
}

export interface LenderTypeOption {
  value: string;
  name: string;
}

export interface SubCategory {
  value: string;
  name: string;
}

export interface PropertyTypes {
  value: string;
  name: string;
  subCategories: SubCategory[];
}

export interface LoanTypes {
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
    LenderReviewComponent,
  ],
  templateUrl: './lender-registration.component.html',
  styleUrls: ['./lender-registration.component.css'],
})
export class LenderRegistrationComponent implements OnInit, OnDestroy {
  // Injected services
  private emailExistsValidator = inject(EmailExistsValidator);
  private router = inject(Router);
  private authService = inject(AuthService);
  private firestoreService = inject(FirestoreService);
  private firestore = inject(Firestore);
  private modalService = inject(ModalService);
  private injector = inject(Injector);
  public stepService = inject(StepManagementService);
  private formCoordination = inject(FormCoordinationService);
  private locationService = inject(LocationService);

  states: FootprintLocation[] = [];

  // Component state
  lenderForm!: FormGroup;
  currentStep = 0;
  isLoading = false;
  submitted = false;
  successMessage = '';
  errorMessage = '';

  // Subscriptions
  private subscriptions: Subscription[] = [];

  // User ID storage for linking documents
  private userId: string | null = null;
  private contactDataSaved = false;

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
    { value: 'non-qm', name: 'Non-QM Loans' },
    { value: 'sba', name: 'SBA Loans' },
    { value: 'usda', name: 'USDA Loans' },
  ];

  propertyCategories: PropertyCategory[] = [
    {
      value: 'commercial',
      name: 'Commercial',
      subcategories: [
        { value: 'auto-repair-shop', name: 'Auto Repair Shop' },
        { value: 'bank-branch', name: 'Bank Branch' },
        { value: 'business-center', name: 'Business Center' },
        { value: 'call-center', name: 'Call Center' },
        { value: 'car-wash', name: 'Car Wash' },
        { value: 'dry-cleaner', name: 'Dry Cleaner' },
        { value: 'funeral-home', name: 'Funeral Home' },
        { value: 'general-commercial', name: 'General Commercial' },
        { value: 'printing-facility', name: 'Printing Facility' },
        { value: 'sales-office', name: 'Sales Office' },
        { value: 'showroom', name: 'Showroom' },
        { value: 'truck-terminal', name: 'Truck Terminal' },
      ],
    },
    {
      value: 'healthcare',
      name: 'Healthcare',
      subcategories: [
        { value: 'assisted-living', name: 'Assisted Living' },
        { value: 'hospital', name: 'Hospital' },
        { value: 'independent-living', name: 'Independent Living' },
        { value: 'rehab-facility', name: 'Rehab Facility' },
      ],
    },
    {
      value: 'hospitality',
      name: 'Hospitality',
      subcategories: [
        { value: 'hotel', name: 'Hotel' },
        { value: 'long-term-rentals', name: 'Long-Term Rentals' },
        { value: 'motel', name: 'Motel' },
        { value: 'short-term-rentals', name: 'Short-Term Rentals' },
      ],
    },
    {
      value: 'industrial',
      name: 'Industrial',
      subcategories: [
        { value: 'cold-storage', name: 'Cold Storage' },
        { value: 'distribution-center', name: 'Distribution Center' },
        { value: 'flex-space', name: 'Flex Space' },
        { value: 'self-storage', name: 'Self Storage' },
        { value: 'warehouse', name: 'Warehouse' },
      ],
    },
    {
      value: 'land',
      name: 'Land',
      subcategories: [
        { value: 'energy-park', name: 'Energy Park' },
        { value: 'entitled-land', name: 'Entitled Land' },
        { value: 'farm', name: 'Farm' },
        { value: 'golf-course', name: 'Golf Course' },
        { value: 'industrial-land', name: 'Industrial Land' },
        { value: 'raw-land', name: 'Raw Land' },
        { value: 'retail-land', name: 'Retail Land' },
      ],
    },
    {
      value: 'mixed-use',
      name: 'Mixed Use',
      subcategories: [
        { value: 'live-work', name: 'Live/Work Units' },
        { value: 'residential-office', name: 'Residential + Office' },
        { value: 'residential-retail', name: 'Residential over Retail' },
        { value: 'retail-office', name: 'Retail + Office' },
      ],
    },
    {
      value: 'multifamily',
      name: 'Multifamily',
      subcategories: [
        { value: 'affordable-housing', name: 'Affordable housing' },
        { value: 'market-rate', name: 'Market Rate' },
        { value: 'independent-living', name: 'Independent living' },
        { value: 'manufactured', name: 'Manufactured' },
        { value: 'military-housing', name: 'Military Housing' },
        { value: 'senior-housing', name: 'Senior housing' },
        { value: 'student-housing', name: 'Student housing' },
      ],
    },
    {
      value: 'office',
      name: 'Office',
      subcategories: [
        { value: 'medical-office', name: 'Medical Office' },
        {
          value: 'professional-office-building',
          name: 'Professional Office Building',
        },
      ],
    },
    {
      value: 'residential',
      name: 'Residential',
      subcategories: [
        { value: '1-4-units', name: '1-4 Units' },
        { value: 'co-op', name: 'CO-OP' },
        { value: 'condominium', name: 'Condominium' },
        { value: 'quadplex', name: 'Quadplex' },
        { value: 'single-family', name: 'Single Family' },
        { value: 'triplex', name: 'Triplex' },
      ],
    },
    {
      value: 'retail',
      name: 'Retail',
      subcategories: [
        { value: 'anchored-center', name: 'Anchored Center' },
        { value: 'mall', name: 'Mall' },
        { value: 'mixed-use-retail', name: 'Mixed-Use Retail' },
        { value: 'nnn-retail', name: 'NNN Retail' },
        { value: 'restaurant', name: 'Restaurant' },
        { value: 'single-tenant', name: 'Single Tenant' },
        { value: 'strip-mall', name: 'Strip Mall' },
      ],
    },
    {
      value: 'specialPurpose',
      name: 'Special Purpose',
      subcategories: [
        { value: 'auto-dealership', name: 'Auto Dealership' },
        { value: 'church', name: 'Church' },
        { value: 'data-center', name: 'Data Center' },
        { value: 'daycare', name: 'Daycare' },
        { value: 'gas-station', name: 'Gas Station' },
        { value: 'marina', name: 'Marina' },
        { value: 'mobile-home-park', name: 'Mobile Home Park' },
        { value: 'parking-garage', name: 'Parking Garage' },
        { value: 'r-and-d', name: 'R&D Facility' },
        { value: 'resort-rv-park', name: 'Resort RV Park' },
        { value: 'service-station', name: 'Service Station' },
        { value: 'sports-complex', name: 'Sports Complex' },
        { value: 'stadium', name: 'Stadium' },
      ],
    },
  ];

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.initializeForm();
    this.states = this.locationService.getFootprintLocations();
    this.initializeStateCountiesStructure();

    // Get current user ID if available
    this.authService
      .getCurrentUser()
      .pipe(take(1))
      .subscribe((user) => {
        if (user) {
          this.userId = getUserId(user) || '';
          console.log('Current user ID:', this.userId);
        }
      });

    // Subscribe to step changes to manage validation
    this.subscriptions.push(
      this.stepService.currentStep$.subscribe((step) => {
        this.currentStep = step;
        this.toggleStepValidation();
        this.errorMessage = '';
      })
    );

    console.log('Registration form initialized:', this.lenderForm);
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
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

  public getStepFormGroup(): FormGroup {
    // Get appropriate form group based on current step
    switch (this.currentStep) {
      case 0:
        return this.contactForm;
      case 1:
        return this.productForm;
      case 2:
        return this.footprintForm;
      case 3:
        return this.lenderForm; // Return the entire form for review step
      default:
        return this.contactForm; // Default fallback
    }
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
          Validators.pattern(/^[A-Za-z ]+$/),
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
      contactPhone: ['', [Validators.required]],
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

    // Create product step form group with all arrays
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

    // Then enable only validators for the current step
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
        // Terms acceptance only required at final step
        const termsControl = this.lenderForm.get('termsAccepted');
        if (termsControl) {
          termsControl.setValidators(Validators.requiredTrue);
          termsControl.updateValueAndValidity({ emitEvent: false });
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
      // In the parent form, states is INSIDE footprintInfo
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

    // If form is valid, proceed
    if (currentForm.valid) {
      // If completing step 1 (contact info) and not already saved, save user data to Firebase
      if (this.currentStep === 0 && !this.contactDataSaved) {
        this.isLoading = true;

        this.saveUserData()
          .pipe(
            finalize(() => {
              this.isLoading = false;
            })
          )
          .subscribe((success) => {
            if (success) {
              this.contactDataSaved = true;
              this.stepService.moveToNextStep();
              // Clear error message explicitly on success
              this.errorMessage = '';
            } else {
              this.errorMessage =
                'Failed to save contact information. Please try again.';
            }
          });
      } else if (this.currentStep < 3) {
        // For other steps, just proceed to next step using the service
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
      default:
        return 'Please complete all required fields';
    }
  }

  isCurrentStepValid(): boolean {
    const currentForm = this.getStepFormGroup();
    return currentForm.valid;
  }

  private saveUserData(): Observable<boolean> {
    if (!this.contactForm.valid) {
      return of(false);
    }

    // First, save to localStorage as a backup
    try {
      localStorage.setItem(
        'lenderContactData',
        JSON.stringify(this.contactForm.value)
      );
      this.contactDataSaved = true;
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }

    // Then, save user data to Firebase (inside injection context)
    return runInInjectionContext(this.injector, () => {
      return this.authService.getCurrentUser().pipe(
        take(1),
        switchMap((user) => {
          if (!user) {
            // Only create a temporary ID, but don't create a document yet
            const newDocRef = doc(collection(this.firestore, 'lenders'));
            this.userId = newDocRef.id;
            localStorage.setItem('pendingLenderId', this.userId);

            // Just return the ID without creating a document
            return of(true);
          } else {
            // We have a user, store their ID
            this.userId = user.uid || '';
            const contactData = this.contactForm.value;

            // Save to lenders collection
            const lenderProfileData = {
              userId: this.userId,
              contactInfo: {
                firstName: contactData.firstName,
                lastName: contactData.lastName,
                contactEmail: contactData.contactEmail,
                contactPhone: contactData.contactPhone,
                company: contactData.company,
                city: contactData.city,
                state: contactData.state,
              },
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            // Store in lenders collection
            return this.firestoreService.setDocument(
              `lenders/${this.userId}`,
              lenderProfileData
            );
          }
        }),
        map(() => true),
        catchError((error) => {
          console.error('Error saving user data:', error);
          return of(false);
        })
      );
    });
  }

  submitForm(): void {
    this.submitted = true;
    this.errorMessage = '';
    this.successMessage = '';
    console.log('Submit button clicked!');

    this.markAllAsTouched(this.lenderForm);

    // Force re-validation of states selection (Step 3)
    this.footprintForm.get('states')?.updateValueAndValidity();

    console.log('Terms accepted:', this.lenderForm.get('termsAccepted')?.value);
    console.log('Form valid:', this.lenderForm.valid);

    if (!this.lenderForm.valid) {
      this.isLoading = false;
      if (this.lenderForm.get('termsAccepted')?.invalid) {
        this.errorMessage = 'You must agree to the Terms of Service to proceed';
      } else {
        this.errorMessage = 'Please complete all required fields';
      }
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

    // Run all Firebase operations inside injection context
    runInInjectionContext(this.injector, () => {
      // Create Firebase Auth user
      this.authService // Changed from passwordAuthService to authService
        .registerUser(email, 'defaultPassword', {
          company: formData.contactInfo?.company,
          firstName: formData.contactInfo?.firstName,
          lastName: formData.contactInfo?.lastName,
          email: email,
          phone: formData.contactInfo?.contactPhone,
          city: formData.contactInfo?.city,
          state: formData.contactInfo?.state,
          role: 'lender',
        })
        .pipe(
          switchMap((user: any) => {
            if (!user) {
              throw new Error('User registration failed');
            }

            // Create a clean lender data object
            const lenderData = {
              userId: user.uid,
              contactInfo: formData.contactInfo,
              productInfo: {
                lenderTypes: this.extractLenderTypes(
                  formData.productInfo.lenderTypes
                ),
                propertyCategories:
                  formData.productInfo.propertyCategories || [],
                subcategorySelections:
                  formData.productInfo.subcategorySelections || [],
                loanTypes: formData.productInfo.loanTypes || [],
                minLoanAmount: this.parseNumericValue(
                  formData.productInfo.minLoanAmount
                ),
                maxLoanAmount: this.parseNumericValue(
                  formData.productInfo.maxLoanAmount
                ),
              },
              footprintInfo: {
                lendingFootprint: formData.footprintInfo.lendingFootprint || [],
                states: this.extractStatesData(formData.footprintInfo.states),
              },
              role: 'lender',
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            // Save to lenders collection
            return this.firestoreService.setDocument(
              `lenders/${user.uid}`,
              lenderData
            );
          }),
          catchError((error) => {
            console.error('Registration error:', error);
            this.errorMessage = 'Registration failed. Please try again.';
            this.isLoading = false;
            return of(null);
          })
        )
        .subscribe((result: any) => {
          if (result !== null) {
            this.successMessage = '';
            this.isLoading = false;

            // Show success modal
            this.modalService.openLenderRegistrationSuccessModal();

            // Redirect to dashboard after a short delay
            setTimeout(() => {
              this.router.navigate(['/dashboard']);
            }, 3000);
          }
        });
    });
  }

  private handleRegistrationSuccess(): void {
    this.successMessage = 'Registration successful!';
    this.isLoading = false;

    // Show success modal
    this.modalService.openLenderRegistrationSuccessModal();

    // Redirect to lender dashboard after a short delay
    setTimeout(() => {
      this.router.navigate(['/dashboard']);
    }, 3000); // 3 second delay so user can see the success message
  }

  private filterSelectedStatesAndCounties(
    statesData: any
  ): Record<string, boolean | Record<string, boolean>> {
    if (!statesData) return {};

    const filteredStates: Record<string, boolean | Record<string, boolean>> =
      {};

    // Only include states that are true (selected)
    Object.keys(statesData).forEach((key) => {
      // If it's a state boolean and is true, include it
      if (!key.includes('_counties') && statesData[key] === true) {
        filteredStates[key] = true;

        // If there's a counties object for this state, filter it too
        const countiesKey = `${key}_counties`;
        if (
          statesData[countiesKey] &&
          typeof statesData[countiesKey] === 'object'
        ) {
          const countiesObj = statesData[countiesKey];
          const filteredCounties: Record<string, boolean> = {};

          // Only include counties that are true (selected)
          Object.keys(countiesObj).forEach((countyKey) => {
            if (countiesObj[countyKey] === true) {
              filteredCounties[countyKey] = true;
            }
          });

          // Only add the counties object if at least one county is selected
          if (Object.keys(filteredCounties).length > 0) {
            filteredStates[countiesKey] = filteredCounties;
          }
        }
      }
    });

    return filteredStates;
  }

  // Your existing helper methods remain unchanged
  private extractLenderTypes(lenderTypes: any[]): string[] {
    if (!lenderTypes || !Array.isArray(lenderTypes)) return [];

    // Handle both formats: [{value: 'type1', name: 'Type 1'}] or ['type1', 'type2']
    return lenderTypes.map((type) => {
      if (typeof type === 'object' && type !== null && 'value' in type) {
        return type.value;
      }
      return type;
    });
  }

  private parseNumericValue(value: any): number {
    if (typeof value === 'number') return value;
    if (!value) return 0;

    // Handle string values (possibly with currency formatting)
    const numericString = value.toString().replace(/[^0-9.]/g, '');
    return parseFloat(numericString) || 0;
  }

  private extractStatesData(
    statesData: any
  ): Record<string, boolean | Record<string, boolean>> {
    if (!statesData) return {};

    // Create a clean copy without any circular references and only selected items
    const cleanStatesData: Record<string, boolean | Record<string, boolean>> =
      {};

    // Extract only the selected state selections and county selections
    if (statesData && typeof statesData === 'object') {
      Object.keys(statesData).forEach((key) => {
        // Only include states that are selected (true)
        if (!key.includes('_counties') && statesData[key] === true) {
          cleanStatesData[key] = statesData[key];

          // Check if there are counties for this state
          const countiesKey = `${key}_counties`;
          if (
            statesData[countiesKey] &&
            typeof statesData[countiesKey] === 'object'
          ) {
            const countiesObj = statesData[countiesKey];
            const selectedCounties: Record<string, boolean> = {};

            // Only include selected counties
            Object.keys(countiesObj).forEach((countyKey) => {
              if (countiesObj[countyKey] === true) {
                selectedCounties[countyKey] = true;
              }
            });

            // Only add counties if at least one is selected
            if (Object.keys(selectedCounties).length > 0) {
              cleanStatesData[countiesKey] = selectedCounties;
            }
          }
        }
      });
    }
    return cleanStatesData;
  }

  private saveLenderData(userId: string): Observable<any> {
    const formData = this.lenderForm.value;

    // Skip updating lenders since it's already created
    // Go directly to saving products data
    const productData = {
      lenderProfileId: userId,
      lenderTypes: this.extractLenderTypes(formData.productInfo.lenderTypes),
      propertyCategories: formData.productInfo.propertyCategories || [],
      subcategorySelections: formData.productInfo.subcategorySelections || [],
      loanTypes: formData.productInfo.loanTypes || [],
      minLoanAmount: this.parseNumericValue(formData.productInfo.minLoanAmount),
      maxLoanAmount: this.parseNumericValue(formData.productInfo.maxLoanAmount),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log('Saving product data:', productData);

    // Start with setting the product data
    return from(
      this.firestoreService.setDocument(`products/${userId}`, productData)
    ).pipe(
      switchMap(() => {
        // Filter footprint data to only include selected states
        const filteredStates = this.extractStatesData(
          formData.footprintInfo.states
        );

        // Then save footprint data with only selected states
        const locationData = {
          lenderProfileId: userId,
          lendingFootprint: formData.footprintInfo.lendingFootprint || [],
          states: filteredStates, // Use the filtered states data
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        console.log('Saving location data:', locationData);

        return from(
          this.firestoreService.setDocument(`locations/${userId}`, locationData)
        );
      }),
      map(() => true),
      catchError((error) => {
        console.error('Error in save operation:', error);
        return of(null);
      })
    );
  }

  private handleSuccess() {
    this.successMessage = 'Lender registration completed successfully!';

    console.log('Registration successful, preparing for redirection');

    // Show success message and redirect after a short delay
    setTimeout(() => {
      console.log('Redirecting to lender dashboard');
      this.router
        .navigate(['/lender-dashboard'])
        .then((success) => {
          if (!success) {
            console.error('Navigation was prevented');
            this.errorMessage =
              'Could not redirect to dashboard. Please navigate manually.';
          }
        })
        .catch((error) => {
          console.error('Navigation error:', error);
          this.errorMessage = 'Error during redirection. Please try again.';
        });
    }, 3000); // 3 second delay so user can see the success message
  }
}
