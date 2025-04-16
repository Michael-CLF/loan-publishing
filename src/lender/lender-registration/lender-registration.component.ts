import { Component, OnInit } from '@angular/core';
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
import { LenderContactComponent } from '../../lender/lender-contact/lender-contact.component';
import { LenderProductComponent } from '../../lender/lender-product/lender-product.component';
import { LenderFootprintComponent } from '../../lender/lender-footprint/lender-footprint.component';

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

@Component({
  selector: 'app-lender-registration',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LenderContactComponent,
    LenderProductComponent,
    LenderFootprintComponent,
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

  states: StateOption[] = [
    { value: 'AL', name: 'Alabama' },
    { value: 'AK', name: 'Alaska' },
    // ... rest of your states
  ];

  lenderTypes: LenderTypeOption[] = [
    { value: 'agency', name: 'Agency Lender (Fannie/Freddie)' },
    { value: 'bank', name: 'Bank' },
    { value: 'bridge_lender', name: 'Bridge Lender' },
    { value: 'cdfi', name: 'CDFI Lender' },
    { value: 'conduit_lender', name: 'Conduit Lender (CMBS)' },
    { value: 'construction_lender', name: 'Construction Lender' },
    { value: 'correspondent_lender', name: 'Correspondent Lender' },
    { value: 'credit_union', name: 'Credit Union' },
    { value: 'crowdfunding', name: 'Crowdfunding Platform' },
    { value: 'direct_lender', name: 'Direct Lender' },
    { value: 'family_office', name: 'Family Office' },
    { value: 'hard_money', name: 'Hard Money Lender' },
    { value: 'life_insurance', name: 'Life Insurance Lender' },
    { value: 'mezzanine_lender', name: 'Mezzanine Lender' },
    { value: 'mortgage_broker', name: 'Mortgage Broker' },
    { value: 'non_qm_lender', name: 'Non-QM Lender' },
    { value: 'portfolio_lender', name: 'Portfolio Lender' },
    { value: 'private_lender', name: 'Private Lender' },
    { value: 'sba', name: 'SBA Lender' },
    { value: 'usda', name: 'USDA Lender' },
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
        { value: 'distribution-center', name: 'Distribution Center' }, // could overlap with industrial
        { value: 'dry-cleaner', name: 'Dry Cleaner' },
        { value: 'funeral-home', name: 'Funeral Home' }, // could also go in special-purpose
        { value: 'general-commercial', name: 'General Commercial' }, // catch-all
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
          value: '1-4-unit-residential-property',
          name: '1-4 Unit residential property',
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

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.initializeForm();
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

  public getStepFormGroup(): FormGroup {
    // Get appropriate form group based on current step
    switch (this.currentStep) {
      case 0:
        return this.contactForm;
      case 1:
        return this.productForm;
      case 2:
        return this.footprintForm;
      default:
        return this.contactForm; // Default fallback
    }
  }

  private initializeForm(): void {
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
      contactPhone: ['', [Validators.required]],
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

    const productStep = this.fb.group({
      lenderTypes: this.fb.array([], Validators.required),
      minLoanAmount: ['', [Validators.required, Validators.minLength(6)]],
      maxLoanAmount: ['', [Validators.required, Validators.minLength(6)]],
      propertyCategories: this.fb.array([], Validators.required),
      propertyTypes: this.fb.array([], Validators.required),
      city: ['', [Validators.required, Validators.minLength(2)]],
      state: ['', Validators.required],
    });

    const footprintStep = this.fb.group({
      lendingFootprint: [[], Validators.required],
      propertyTypes: this.fb.group({}),
    });

    // Initialize the main form
    this.lenderForm = this.fb.group({
      contactInfo: contactStep,
      productInfo: productStep,
      footprintInfo: footprintStep,
    });

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
    });
  }

  // Checkbox change handlers
  onLenderTypeChange(event: any, value: string): void {
    const checked = event.target.checked;
    const lenderTypesArray = this.lenderTypesArray;

    if (checked) {
      lenderTypesArray.push(this.fb.control(value));
    } else {
      const index = lenderTypesArray.controls.findIndex(
        (control) => control.value === value
      );
      if (index >= 0) {
        lenderTypesArray.removeAt(index);
      }
    }
  }

  onPropertyCategoryChange(event: any, value: string): void {
    const checked = event.target.checked;
    const propertyCategoriesArray = this.propertyCategoriesArray;

    if (checked) {
      propertyCategoriesArray.push(this.fb.control(value));
    } else {
      const index = propertyCategoriesArray.controls.findIndex(
        (control) => control.value === value
      );
      if (index >= 0) {
        propertyCategoriesArray.removeAt(index);
      }
    }
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
  }

  // Helper method to check if a value is selected in a FormArray
  isOptionSelected(formArrayName: string, value: string): boolean {
    const formArray = this.productForm.get(formArrayName) as FormArray;
    return formArray.controls.some((control) => control.value === value);
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

  nextStep(): void {
    const currentForm = this.getStepFormGroup();
    Object.values(currentForm.controls).forEach((control) =>
      control.markAsTouched()
    );
    if (currentForm.valid && this.currentStep < 2) this.currentStep++;
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
    for (let step = 0; step <= 2; step++) {
      this.currentStep = step;
      if (!this.getStepFormGroup().valid) {
        this.errorMessage = 'Please complete all required fields';
        return;
      }
    }
    this.successMessage = 'Lender registration completed successfully!';
    console.log('Form Data:', this.lenderForm.value);
  }

  // Object keys method for debug display
  objectKeys(obj: any): string[] {
    return Object.keys(obj);
  }
}
