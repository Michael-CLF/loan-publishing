// Lender-registration.component.ts
import {
  Component,
  OnInit,
  OnDestroy,
  inject,
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
import { Subscription, Subject, of, from } from 'rxjs';
import { EmailExistsValidator } from '../../services/email-exists.validator';
import { AuthService } from '../../services/auth.service';
import { ModalService } from '../../services/modal.service';
import { StepManagementService } from './step-management';
import { FormCoordinationService } from './form-coordination';
import { LocationService } from '../../services/location.service';
import { StripeService } from '../../services/stripe.service';
import { FootprintLocation } from '../../models/footprint-location.model';
import { LenderStripePaymentComponent } from '../lender-stripe-payment/lender-stripe-payment.component';
import { LenderFormService } from '../../services/lender-registration.service';
import { PromotionService } from './../../services/promotion.service';
import { LenderContactComponent } from '../../lender/lender-contact/lender-contact.component';
import { LenderProductComponent } from '../../lender/lender-product/lender-product.component';
import { LenderFootprintComponent } from '../../lender/lender-footprint/lender-footprint.component';
import { LenderReviewComponent } from '../../lender/lender-review/lender-review.component';
import { firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { User } from '@angular/fire/auth';
import { environment } from '../../environments/environment';

import {
  Firestore,
  doc,
  setDoc,
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';

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
  private locationService = inject(LocationService);
  private emailExistsValidator = inject(EmailExistsValidator);
  public stepService = inject(StepManagementService);
  private formCoordination = inject(FormCoordinationService);
  private lenderFormService = inject(LenderFormService);
  private promotionService = inject(PromotionService);
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  states: FootprintLocation[] = [];
  lenderForm!: FormGroup;
  currentStep = 0;
  isLoading = false;
  submitted = false;
  successMessage = '';
  errorMessage = '';
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

    // Initialize payment section if it doesn't exist
    if (!this.lenderFormService.getFormSection('payment')) {
      this.lenderFormService.setFormSection('payment', {
        billingInterval: 'monthly',
        couponCode: '',
        couponApplied: false,
        appliedCouponDetails: null,
        validatedCouponCode: ''
      });
    }

    this.subscriptions.push(
      this.stepService.currentStep$.subscribe((step) => {
        this.currentStep = step;
        this.toggleStepValidation();
        this.errorMessage = '';
        this.saveCurrentStepData();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private saveCurrentStepData(): void {
    switch (this.currentStep) {
      case 0:
        if (this.contactForm.valid) {
          this.lenderFormService.setFormSection('contact', this.contactForm.value);
        }
        break;
      case 1:
        if (this.productForm.valid) {
          this.lenderFormService.setFormSection('product', this.productForm.value);
        }
        break;
      case 2:
        if (this.footprintForm.valid) {
          this.lenderFormService.setFormSection('footprint', this.footprintForm.value);
        }
        break;
      case 3:
        this.lenderFormService.setFormSection('termsAccepted', this.lenderForm.get('termsAccepted')?.value);
        break;
      case 4:
        const paymentData = this.lenderFormService.getFormSection('payment') || {};
        this.lenderFormService.setFormSection('payment', {
          ...paymentData,
          billingInterval: this.lenderForm.get('interval')?.value || 'monthly'
        });
        break;
    }
  }

  // ------------------------
  // Form getters
  // ------------------------
  get validatedCouponCode(): string {
    return this.lenderFormService.getFormSection('payment')?.validatedCouponCode || '';
  }
  get couponApplied(): boolean {
    return this.lenderFormService.getFormSection('payment')?.couponApplied || false;
  }
  get appliedCouponDetails(): any {
    return this.lenderFormService.getFormSection('payment')?.appliedCouponDetails || null;
  }

  get contactForm(): FormGroup {
    const form = this.lenderForm.get('contactInfo');
    if (form instanceof FormGroup) return form;
    throw new Error('contactInfo is not a FormGroup');
  }
  get productForm(): FormGroup {
    const form = this.lenderForm.get('productInfo');
    if (form instanceof FormGroup) return form;
    throw new Error('productInfo is not a FormGroup');
  }
  get footprintForm(): FormGroup {
    const form = this.lenderForm.get('footprintInfo');
    if (form instanceof FormGroup) return form;
    throw new Error('footprintInfo is not a FormGroup');
  }

  get lenderTypesArray(): FormArray { return this.productForm.get('lenderTypes') as FormArray; }
  get propertyCategoriesArray(): FormArray { return this.productForm.get('propertyCategories') as FormArray; }
  get propertyTypesArray(): FormArray { return this.productForm.get('propertyTypes') as FormArray; }
  get loanTypesArray(): FormArray { return this.productForm.get('loanTypes') as FormArray; }
  get termsAccepted(): FormControl { return this.lenderForm.get('termsAccepted') as FormControl; }

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
    switch (this.currentStep) {
      case 0: return this.contactForm;
      case 1: return this.productForm;
      case 2: return this.footprintForm;
      case 3:
      case 4: return this.lenderForm;
      default: return this.contactForm;
    }
  }

  selectBilling(interval: 'monthly' | 'annually'): void {
    this.lenderForm.patchValue({ interval });
    const currentPayment = this.lenderFormService.getFormSection('payment') || {};
    this.lenderFormService.setFormSection('payment', { ...currentPayment, billingInterval: interval });
  }

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
      company: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[A-Za-z0-9 ]+$/)]],
      firstName: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[A-Za-z ]+$/)]],
      lastName: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[A-Za-z ]+$/)]],
      contactPhone: ['', [Validators.required, Validators.pattern(/^\(\d{3}\) \d{3}-\d{4}$/)]],
      contactEmail: ['', [Validators.required, Validators.email], this.emailExistsValidator.validate.bind(this.emailExistsValidator)],
      city: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[A-Za-z ]+$/)]],
      state: ['', Validators.required],
      couponCode: ['']
    });

    const lenderTypesArray = this.fb.array([], { validators: [this.minSelectedCheckboxes(1)], updateOn: 'change' });
    const propertyCategoriesArray = this.fb.array([], { validators: [this.minSelectedCheckboxes(1)], updateOn: 'change' });
    const propertyTypesArray = this.fb.array([]);
    const loanTypesArray = this.fb.array([], { validators: [this.minSelectedCheckboxes(1)], updateOn: 'change' });
    const subcategorySelectionsArray = this.fb.array([]);

    const productStep = this.fb.group({
      lenderTypes: lenderTypesArray,
      minLoanAmount: [null, [Validators.required, Validators.pattern(/^\d{6,}$/)]],
      maxLoanAmount: [null, [Validators.required, Validators.pattern(/^\d{6,}$/)]],
      ficoScore: ['', [Validators.required, Validators.min(300), Validators.max(850), Validators.pattern(/^\d+$/)]],
      propertyCategories: propertyCategoriesArray,
      propertyTypes: propertyTypesArray,
      loanTypes: loanTypesArray,
      subcategorySelections: subcategorySelectionsArray,
    });

    const footprintStep = this.fb.group({
      lendingFootprint: [[]],
      states: this.fb.group({}),
    });

    this.lenderForm = this.fb.group({
      contactInfo: contactStep,
      productInfo: productStep,
      footprintInfo: footprintStep,
      termsAccepted: [false],
      interval: ['monthly', [Validators.required]],
      promotion_code: ['']
    });

    this.initializeStateCountiesStructure();

    setTimeout(() => {
      this.toggleStepValidation();
      console.log('Form initialized with structure:');
      this.debugFormStructure(this.lenderForm);
    });
  }

  private toggleStepValidation(): void {
    console.log(`Toggling validation for step ${this.currentStep}`);
    this.disableAllValidators();

    switch (this.currentStep) {
      case 0: this.enableContactValidators(); break;
      case 1: this.enableProductValidators(); break;
      case 2: this.enableFootprintValidators(); break;
      case 3:
        this.enableContactValidators();
        this.enableProductValidators();
        this.enableFootprintValidators();
        const termsControl = this.lenderForm.get('termsAccepted');
        if (termsControl) {
          termsControl.setValidators(Validators.requiredTrue);
          termsControl.updateValueAndValidity({ emitEvent: false });
        }
        break;
      case 5:
        const intervalControl = this.lenderForm.get('interval');
        if (intervalControl) {
          intervalControl.setValidators(Validators.required);
          intervalControl.updateValueAndValidity({ emitEvent: false });
        }
        break;
    }

    this.contactForm.updateValueAndValidity({ emitEvent: false });
    this.productForm.updateValueAndValidity({ emitEvent: false });
    this.footprintForm.updateValueAndValidity({ emitEvent: false });
    this.lenderForm.updateValueAndValidity({ emitEvent: false });

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

  private disableAllValidators(): void {
    const termsControl = this.lenderForm.get('termsAccepted');
    if (termsControl) {
      termsControl.clearValidators();
      termsControl.updateValueAndValidity({ emitEvent: false });
    }

    const lendingFootprint = this.footprintForm.get('lendingFootprint');
    if (lendingFootprint) {
      lendingFootprint.clearValidators();
      lendingFootprint.updateValueAndValidity({ emitEvent: false });
    }

    const statesGroup = this.footprintForm.get('states') as FormGroup;
    if (statesGroup) {
      statesGroup.clearValidators();
      statesGroup.updateValueAndValidity({ emitEvent: false });
    }
  }

  private enableContactValidators(): void {
    this.contactForm.updateValueAndValidity({ emitEvent: false });
  }
  private enableProductValidators(): void {
    this.productForm.updateValueAndValidity({ emitEvent: false });
  }
  private enableFootprintValidators(): void {
    const lendingFootprint = this.footprintForm.get('lendingFootprint');
    if (lendingFootprint) {
      lendingFootprint.setValidators(Validators.required);
      lendingFootprint.updateValueAndValidity({ emitEvent: false });
    }

    const statesGroup = this.footprintForm.get('states') as FormGroup;
    if (statesGroup) {
      statesGroup.setValidators(this.atLeastOneStateValidator());
      statesGroup.updateValueAndValidity({ emitEvent: false });

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
    console.log('States group valid:', (this.footprintForm.get('states') as FormGroup)?.valid);
  }

  private atLeastOneStateValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const statesGroup = control as FormGroup;
      if (!statesGroup) return { noStateSelected: true };

      const stateControls = Object.keys(statesGroup.controls).filter(
        (key) => !key.includes('_counties')
      );

      const selectedStates = stateControls.filter(
        (key) => statesGroup.get(key)?.value === true
      );

      return selectedStates.length > 0 ? null : { noStateSelected: true };
    };
  }

  private initializeStateCountiesStructure(): void {
    const statesFormGroup = this.footprintForm.get('states') as FormGroup;

    this.states.forEach((state) => {
      const stateValue = state.value;

      if (!statesFormGroup.contains(stateValue)) {
        statesFormGroup.addControl(stateValue, this.fb.control(false));
      }

      const countiesKey = `${stateValue}_counties`;
      if (!statesFormGroup.contains(countiesKey)) {
        statesFormGroup.addControl(countiesKey, this.fb.group({}));
      }
    });
  }

  onLenderTypeChange(event: any, typeValue: string): void {
    event.stopPropagation();
    const lenderTypesArray = this.lenderTypesArray;

    while (lenderTypesArray.length > 0) {
      lenderTypesArray.removeAt(0);
    }

    const lenderTypeObject = this.lenderTypes.find((t) => t.value === typeValue);
    if (lenderTypeObject) {
      lenderTypesArray.push(this.fb.control(lenderTypeObject));
    }

    lenderTypesArray.updateValueAndValidity();
    this.productForm.updateValueAndValidity();
  }

  private debugFormStructure(form: FormGroup, prefix = ''): void {
    Object.keys(form.controls).forEach((key) => {
      const control = form.get(key);
      const path = prefix ? `${prefix}.${key}` : key;

      if (control instanceof FormGroup) {
        console.log(`Group: ${path}, Valid: ${control.valid}`);
        this.debugFormStructure(control, path);
      } else if (control instanceof FormArray) {
        console.log(`Array: ${path}, Valid: ${control.valid}, Length: ${control.length}, Errors:`, control.errors);
      } else if (control) {
        console.log(`Control: ${path}, Valid: ${control.valid}, Value: ${control.value}, Errors:`, control.errors);
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

    propertyTypesArray.updateValueAndValidity();
    this.productForm.updateValueAndValidity();
  }

  isOptionSelected(formArrayName: string, value: string): boolean {
    const formArray = this.productForm.get(formArrayName) as FormArray;
    return formArray.controls.some((control) =>
      typeof control.value === 'object'
        ? control.value.value === value
        : control.value === value
    );
  }

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

  nextStep(): void {
    const currentForm = this.getStepFormGroup();
    this.markAllAsTouched(currentForm);
    this.errorMessage = '';

    console.log('Form valid:', currentForm.valid);
    console.log('Form value:', currentForm.value);

    if (!currentForm.valid) {
      this.errorMessage = this.getStepErrorMessage();
      return;
    }

    this.saveCurrentStepData();

    if (this.currentStep < 5) {
      this.stepService.moveToNextStep();
    }
  }

  prevStep(): void {
    if (this.currentStep > 0) {
      this.stepService.moveToPreviousStep();
    }
  }

  private getStepErrorMessage(): string {
    switch (this.currentStep) {
      case 0: return 'Please complete all required fields in the contact section';
      case 1: return 'Please complete all required fields in the product section';
      case 2: return 'Please select at least one state for your lending footprint';
      case 3: return 'Please review all information and agree to the terms';
      case 4: return 'Please select a billing option and complete payment';
      default: return 'Please complete all required fields';
    }
  }

  isCurrentStepValid(): boolean {
    const currentForm = this.getStepFormGroup();
    return currentForm.valid;
  }

  submitForm(): void {
    this.isLoading = true;
    this.lenderFormService.setFormSection('termsAccepted', true);

    const formData = this.lenderFormService.getFullForm();
    const email = formData.contact?.contactEmail;

    if (!email) {
      alert('Email is required');
      this.isLoading = false;
      return;
    }

    this.proceedToStripe(email, formData);
  }

async proceedToStripe(email: string, formData: any): Promise<void> {
  this.isLoading = true;
  this.errorMessage = '';

  try {
    console.log('🔍 Creating user document and proceeding to payment for:', email);

    // Step 1: Create user document in Firestore with proper UID
    const userCreationResponse = await this.createUserDocument(email, formData);
    console.log('✅ User document created with UID:', userCreationResponse.uid);

    // Step 2: Build payload for Stripe
    const interval: 'monthly' | 'annually' =
      (this.lenderFormService.getFormSection('payment')?.billingInterval || 'monthly');

    const promotionCode =
      this.lenderFormService.getFormSection('payment')?.validatedCouponCode || null;

    const userData = {
      userId: userCreationResponse.uid,
      firstName: formData?.contact?.firstName || '',
      lastName: formData?.contact?.lastName || '',
      company: formData?.contact?.company || '',
      phone: formData?.contact?.contactPhone || '',
      city: formData?.contact?.city || '',
      state: formData?.contact?.state || '',
    };

    console.log('🔍 Creating Stripe checkout session with:', userData);

    // Step 3: Create Stripe checkout session
    const checkoutResponse = await this.stripeService.createCheckoutSession({
      email: email.toLowerCase().trim(),
      role: 'lender',
      interval,
      userData,
      promotion_code: promotionCode
    });

    console.log('✅ Stripe checkout response:', checkoutResponse);

    // Step 4: Redirect to Stripe
    window.location.href = checkoutResponse.url;

  } catch (err: any) {
    console.error('❌ Error in payment flow:', err);
    this.errorMessage = err?.message || 'Failed to process payment. Please try again.';
    this.isLoading = false;
  }
}

private async createUserDocument(email: string, formData: any): Promise<{ uid: string }> {
  console.log('🔄 Creating user document for:', email);

  // Generate a proper Firebase-compatible UID
  const uid = this.generateFirebaseUID();
  
  // Create the Firestore document with inactive status
  await this.createOrMergeLenderDocument(uid, formData, email);
  
  console.log('✅ User document created with UID:', uid);
  return { uid };
}

private generateFirebaseUID(): string {
  // Generate a Firebase-compatible UID (28 characters, alphanumeric)
  // Using timestamp prefix for uniqueness + random suffix
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  const combined = (timestamp + randomPart).substring(0, 28);
  
  // Pad if necessary to ensure 28 characters
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = combined;
  while (result.length < 28) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

  private async createOrMergeLenderDocument(uid: string, formData: any, email: string): Promise<void> {
  const createdAt = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const lenderData = {
    id: uid,
    uid,
    email: email.toLowerCase(),

    // Contact info
    firstName: formData.contact?.firstName || '',
    lastName: formData.contact?.lastName || '',
    company: formData.contact?.company || '',
    phone: formData.contact?.contactPhone || '',
    city: formData.contact?.city || '',
    state: formData.contact?.state || '',

    // Full form data
    contactInfo: formData.contact || {},
    productInfo: formData.product || {},
    footprintInfo: formData.footprint || {},

    // Subscription status only - no paymentPending field
    subscriptionStatus: 'inactive',
    role: 'lender',

    // Timestamps
    createdAt,
    updatedAt: createdAt
  };

  const ref = doc(this.firestore, `lenders/${uid}`);
  await setDoc(ref, lenderData, { merge: true });

  console.log('✅ Firestore document created for UID:', uid);
}

  // ----------------------
  // Misc helpers
  // ----------------------
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

  onCouponValidated(event: any): void {
    console.log('🎫 PARENT: Received coupon validation event:', event);
    const paymentData = this.lenderFormService.getFormSection('payment');
    console.log('🎫 PARENT: Current payment state in service:', paymentData);
  }

  private parseNumericValue(value: any): number {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    return parseFloat(value.toString().replace(/[^0-9.]/g, '')) || 0;
  }
}
