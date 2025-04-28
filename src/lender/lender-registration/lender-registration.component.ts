import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  FormControl,
  Validators,
  AbstractControl,
  ValidatorFn,
  ReactiveFormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { take, switchMap, catchError, finalize, map } from 'rxjs/operators';
import { of, from, Observable } from 'rxjs';

import { LenderContactComponent } from '../../lender/lender-contact/lender-contact.component';
import { LenderProductComponent } from '../../lender/lender-product/lender-product.component';
import { LenderFootprintComponent } from '../../lender/lender-footprint/lender-footprint.component';
import { LenderReviewComponent } from '../../lender/lender-review/lender-review.component';
import { LenderService } from '../../services/lender.service';
import { EmailExistsValidator } from '../../services/email-exists.validator';
import { AuthService } from '../../services/auth.service';
import { FirestoreService } from '../../services/firestore.service';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { collection } from '@angular/fire/firestore';
import { EmailAuthService } from '../../services/email-auth.service';
import { PasswordAuthService } from '../../services/password-auth.service';

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
export class LenderRegistrationComponent implements OnInit {
  // Injected services
  private lenderService = inject(LenderService);
  private emailExistsValidator = inject(EmailExistsValidator);
  private router = inject(Router);
  private authService = inject(AuthService);
  private emailAuthService = inject(EmailAuthService);
  private firestoreService = inject(FirestoreService);
  private firestore = inject(Firestore);
  private fb = inject(FormBuilder);
  private passwordAuthService = inject(PasswordAuthService);

  // Component state
  lenderForm!: FormGroup;
  currentStep = 0;
  isLoading = false;
  submitted = false;
  successMessage = '';
  errorMessage = '';

  // User ID storage for linking documents
  private userId: string | null = null;
  private contactDataSaved = false;

  states: StateOption[] = [
    { value: 'AL', name: 'Alabama' },
    { value: 'AK', name: 'Alaska' },
    { value: 'AZ', name: 'Arizona' },
    { value: 'AR', name: 'Arkansas' },
    { value: 'CA', name: 'California' },
    { value: 'CO', name: 'Colorado' },
    { value: 'CT', name: 'Connecticut' },
    { value: 'DE', name: 'Delaware' },
    { value: 'FL', name: 'Florida' },
    { value: 'GA', name: 'Georgia' },
    { value: 'HI', name: 'Hawaii' },
    { value: 'ID', name: 'Idaho' },
    { value: 'IL', name: 'Illinois' },
    { value: 'IN', name: 'Indiana' },
    { value: 'IA', name: 'Iowa' },
    { value: 'KS', name: 'Kansas' },
    { value: 'KY', name: 'Kentucky' },
    { value: 'LA', name: 'Louisiana' },
    { value: 'ME', name: 'Maine' },
    { value: 'MD', name: 'Maryland' },
    { value: 'MA', name: 'Massachusetts' },
    { value: 'MI', name: 'Michigan' },
    { value: 'MN', name: 'Minnesota' },
    { value: 'MS', name: 'Mississippi' },
    { value: 'MO', name: 'Missouri' },
    { value: 'MT', name: 'Montana' },
    { value: 'NE', name: 'Nebraska' },
    { value: 'NV', name: 'Nevada' },
    { value: 'NH', name: 'New Hampshire' },
    { value: 'NJ', name: 'New Jersey' },
    { value: 'NM', name: 'New Mexico' },
    { value: 'NY', name: 'New York' },
    { value: 'NC', name: 'North Carolina' },
    { value: 'ND', name: 'North Dakota' },
    { value: 'OH', name: 'Ohio' },
    { value: 'OK', name: 'Oklahoma' },
    { value: 'OR', name: 'Oregon' },
    { value: 'PA', name: 'Pennsylvania' },
    { value: 'RI', name: 'Rhode Island' },
    { value: 'SC', name: 'South Carolina' },
    { value: 'SD', name: 'South Dakota' },
    { value: 'TN', name: 'Tennessee' },
    { value: 'TX', name: 'Texas' },
    { value: 'UT', name: 'Utah' },
    { value: 'VT', name: 'Vermont' },
    { value: 'VA', name: 'Virginia' },
    { value: 'WA', name: 'Washington' },
    { value: 'WV', name: 'West Virginia' },
    { value: 'WI', name: 'Wisconsin' },
    { value: 'WY', name: 'Wyoming' },
    { value: 'DC', name: 'District of Columbia' },
  ];

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
    { value: 'Family Office', name: 'Family Office' },
    { value: 'General', name: 'General' },
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
    { value: 'commercial', name: 'Commercial Loans' },
    { value: 'construction', name: 'Construction Loans' },
    { value: 'bridge', name: 'Bridge Loans' },
    { value: 'rehab', name: 'Rehab Loans' },
    { value: 'non-qm', name: 'Non-QM Loans' },
    { value: 'sba', name: 'SBA Loans' },
    { value: 'cmbs', name: 'CMBS Loans' },
    { value: 'agency', name: 'Agency Loans' },
    { value: 'hard_money', name: 'Hard Money Loans' },
    { value: 'mezzanine', name: 'Mezzanine Loan' },
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
        { value: 'distribution-center', name: 'Distribution Center' },
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
        { value: 'hospitality-land', name: 'Hospitality Land' },
        { value: 'hotel', name: 'Hotel' },
        { value: 'long-term-rentals', name: 'Long-term rentals' },
        { value: 'motel', name: 'Motel' },
        { value: 'short-term-rentals', name: 'Short-term rentals' },
      ],
    },
    {
      value: 'industrial-property',
      name: 'Industrial property',
      subcategories: [
        { value: 'cold-storage', name: 'Cold Storage' },
        { value: 'flex-space', name: 'Flex space' },
        { value: 'industrial-land', name: 'Industrial Land' },
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
        { value: 'hospitality-land', name: 'Hospitality Land' },
        { value: 'industrial-land', name: 'Industrial Land' },
        { value: 'retail-land', name: 'Retail Land' },
        { value: 'raw-land', name: 'Raw Land' },
      ],
    },

    {
      value: 'mixed-use',
      name: 'Mixed Use',
      subcategories: [
        { value: 'live-work', name: 'Live/Work Units' },
        { value: 'residential-retail', name: 'Residential over Retail' },
        { value: 'residential-office', name: 'Residential + Office' },
        { value: 'retail-office', name: 'Retail + Office' },
      ],
    },

    {
      value: 'office',
      name: 'Office',
      subcategories: [
        { value: 'medical-office', name: 'Medical office' },
        {
          value: 'professional-office-building',
          name: 'Professional office building',
        },
      ],
    },
    {
      value: 'residential-types',
      name: 'Residential Types',
      subcategories: [
        {
          value: '1-4-units',
          name: '1-4 Units',
        },
        { value: 'co-op', name: 'CO-OP' },
        { value: 'condominium', name: 'Condominium' },
        { value: 'quadplex', name: 'Quadplex' },
        { value: 'single-family', name: 'Single family' },
        { value: 'triplex', name: 'Triplex' },
      ],
    },
    {
      value: 'retail',
      name: 'Retail',
      subcategories: [
        { value: 'anchored-center', name: 'Anchored Center' },
        { value: 'mall', name: 'Mall' },
        { value: 'nnn-retail', name: 'NNN retail' },
        { value: 'restaurant', name: 'Restaurant' },
        { value: 'retail-land', name: 'Retail land' },
        { value: 'single-tenant', name: 'Single tenant' },
        { value: 'strip-mall', name: 'Strip mall' },
        { value: 'mixed_use', name: 'Mixed-Use' },
      ],
    },
    {
      value: 'special-purpose-loans',
      name: 'Special purpose loans',
      subcategories: [
        { value: 'auto-dealership', name: 'Auto dealership' },
        { value: 'church', name: 'Church' },
        { value: 'data-center', name: 'Data center' },
        { value: 'daycare', name: 'Daycare' },
        { value: 'energy-park', name: 'Energy Park' },
        { value: 'farm', name: 'Farm' },
        { value: 'gas-station', name: 'Gas station' },
        { value: 'golf-course', name: 'Golf Course' },
        { value: 'marina', name: 'Marina' },
        { value: 'mobile-home-park', name: 'Mobile home Park' },
        { value: 'parking-garage', name: 'Parking garage' },
        { value: 'r-and-d', name: 'R&D' },
        { value: 'resort-rv-park', name: 'Resort RV Park' },
        { value: 'service-station', name: 'Service station' },
        { value: 'data_center', name: 'Data Center' },
        { value: 'stadium', name: 'Stadium' },
        { value: 'sports_complex', name: 'Sports Complex' },
      ],
    },
  ];

  constructor() {}

  ngOnInit(): void {
    this.initializeForm();

    // Get current user ID if available
    this.authService
      .getCurrentUser()
      .pipe(take(1))
      .subscribe((user) => {
        if (user) {
          this.userId = user.uid;
          console.log('Current user ID:', this.userId);
        }
      });

    console.log('Registration form initialized:', this.lenderForm);
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

    // Create empty form arrays for lender types, property categories, and property types
    const lenderTypesArray = this.fb.array([], [this.minSelectedCheckboxes(1)]);
    const propertyCategoriesArray = this.fb.array(
      [],
      [this.minSelectedCheckboxes(1)]
    );
    const propertyTypesArray = this.fb.array([]);

    const productStep = this.fb.group({
      lenderTypes: lenderTypesArray,
      minLoanAmount: [null, [Validators.required, Validators.minLength(7)]],
      maxLoanAmount: [null, [Validators.required, Validators.minLength(7)]],
      propertyCategories: propertyCategoriesArray,
      propertyTypes: propertyTypesArray,
    });

    const footprintStep = this.fb.group({
      lendingFootprint: [[], Validators.required],
    });

    // Initialize the main form
    this.lenderForm = this.fb.group({
      contactInfo: contactStep,
      productInfo: productStep,
      footprintInfo: footprintStep,
      termsAccepted: [false, Validators.requiredTrue],
    });

    // Log the initialized form arrays to check they're created correctly
    console.log('Lender types array initialized:', lenderTypesArray);
    console.log(
      'Property categories array initialized:',
      propertyCategoriesArray
    );
    console.log('Property types array initialized:', propertyTypesArray);

    // Force form to evaluate all controls
    setTimeout(() => {
      // Trigger validation on the entire form
      this.lenderForm.updateValueAndValidity({
        onlySelf: false,
        emitEvent: true,
      });

      // Trigger validation on each step form
      this.contactForm.updateValueAndValidity({
        onlySelf: false,
        emitEvent: true,
      });
      this.productForm.updateValueAndValidity({
        onlySelf: false,
        emitEvent: true,
      });
      this.footprintForm.updateValueAndValidity({
        onlySelf: false,
        emitEvent: true,
      });

      console.log('Form initialized:', this.lenderForm.valid);
    });
  }

  // Checkbox change handlers
  onLenderTypeChange(event: any, typeValue: string): void {
    const checked = event.target.checked || event.type === 'click';
    const lenderTypesArray = this.lenderTypesArray;

    // Find the full lender type object with both value and name
    const lenderTypeObject = this.lenderTypes.find(
      (t) => t.value === typeValue
    );

    if (checked) {
      // Store the entire lender type object instead of just the value
      lenderTypesArray.push(this.fb.control(lenderTypeObject));
      console.log(`Added lender type: ${typeValue}`);
    } else {
      const index = lenderTypesArray.controls.findIndex(
        (control) => control.value.value === typeValue
      );
      if (index >= 0) {
        lenderTypesArray.removeAt(index);
        console.log(`Removed lender type: ${typeValue}`);
      }
    }

    // Update validation
    lenderTypesArray.updateValueAndValidity();
    this.productForm.updateValueAndValidity();
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

    // Then, save user data to Firebase
    return this.authService.getCurrentUser().pipe(
      take(1),
      switchMap((user) => {
        if (!user) {
          // If no user is logged in, we need to handle this case
          // Since we're in the middle of a form flow, we need to keep the user's progress
          // We'll create a temp user document with a generated ID
          const newDocRef = doc(collection(this.firestore, 'lenderProfiles'));
          this.userId = newDocRef.id;

          // Store data in localStorage for later association with auth
          localStorage.setItem('pendingLenderId', this.userId);

          // Return as if we have a user but note it's temporary
          return of({ uid: this.userId, isTemporary: true } as any);
        }
        return of(user);
      }),
      switchMap((user) => {
        if (!user) {
          throw new Error('Failed to get or create user');
        }

        this.userId = user.uid;
        const contactData = this.contactForm.value;

        // Save to lenderProfiles collection instead of users
        const lenderProfileData = {
          userId: user.uid,
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

        // Store in lenderProfiles collection
        return this.firestoreService.setDocument(
          `lenderProfiles/${user.uid}`,
          lenderProfileData
        );
      }),
      map(() => true),
      catchError((error) => {
        console.error('Error saving user data:', error);
        return of(false);
      })
    );
  }

  nextStep(): void {
    const currentForm = this.getStepFormGroup();
    this.markAllAsTouched(currentForm);

    // Clear any previous error messages when attempting to go to the next step
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
              this.currentStep++;
              // Clear error message explicitly on success
              this.errorMessage = '';
            } else {
              this.errorMessage =
                'Failed to save contact information. Please try again.';
            }
          });
      } else if (this.currentStep < 3) {
        // For other steps, just proceed
        this.currentStep++;
      }
    } else {
      // Display more specific error information
      Object.keys(currentForm.controls).forEach((key) => {
        const control = currentForm.get(key);
        if (control && control.invalid) {
          console.log(`Control '${key}' is invalid:`, control.errors);
        }
      });
    }
  }

  prevStep(): void {
    if (this.currentStep > 0) this.currentStep--;
  }

  isCurrentStepValid(): boolean {
    const currentForm = this.getStepFormGroup();
    return currentForm.valid;
  }

  submitForm(): void {
    this.submitted = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.markAllAsTouched(this.lenderForm);

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

    // Create Firebase Auth user immediately
    this.passwordAuthService
      .registerUser(email, 'defaultPassword', {
        company: formData.contactInfo?.company,
        firstName: formData.contactInfo?.firstName,
        lastName: formData.contactInfo?.lastName,
        email: email,
        phone: formData.contactInfo?.contactPhone,
        city: formData.contactInfo?.city,
        state: formData.contactInfo?.state,
        role: 'lender', // 🔥 Important: Set role as 'lender'
      })
      .pipe(
        switchMap((user: any) => {
          if (!user) {
            throw new Error('User registration failed');
          }
          // Save the lender profile separately into lenderProfiles collection
          const lenderProfileData = {
            contactInfo: formData.contactInfo,
            productInfo: formData.productInfo,
            footprintInfo: formData.footprintInfo,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          // Save to lenderProfiles/{user.uid}
          return this.firestoreService.setDocument(
            `lenderProfiles/${user.uid}`,
            lenderProfileData
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
        if (result !== null && !this.errorMessage) {
          this.successMessage = 'Registration successful!';
          this.isLoading = false;
          this.router.navigate(['/dashboard']);
        }
      });
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

    // Create a clean copy without any circular references
    const cleanStatesData: Record<string, boolean | Record<string, boolean>> =
      {};

    // Extract only the state selections and county selections
    if (statesData && typeof statesData === 'object') {
      Object.keys(statesData).forEach((key) => {
        // Either it's a state boolean or a counties object
        if (typeof statesData[key] === 'boolean') {
          cleanStatesData[key] = statesData[key];
        } else if (
          key.includes('_counties') &&
          typeof statesData[key] === 'object'
        ) {
          // It's a counties object, copy it
          cleanStatesData[key] = {
            ...(statesData[key] as Record<string, boolean>),
          };
        }
      });
    }
    return cleanStatesData;
  }

  private saveLenderData(userId: string): Observable<any> {
    const formData = this.lenderForm.value;

    // Skip updating lenderProfiles since it's already created
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
        // Then save footprint data
        const locationData = {
          lenderProfileId: userId,
          lendingFootprint: formData.footprintInfo.lendingFootprint || [],
          states: this.extractStatesData(formData.footprintInfo.states),
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
