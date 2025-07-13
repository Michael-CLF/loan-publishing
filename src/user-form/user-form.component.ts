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
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, tap, takeUntil, finalize } from 'rxjs/operators';
import { of, Subject } from 'rxjs';
import { VerificationCodeService } from '../services/verification-code.service';
import { EmailService } from '../services/email.service';
import { ModalService } from '../services/modal.service';
import { LocationService } from 'src/services/location.service';
import { StripeService } from '../services/stripe.service';
import { FirestoreService } from '../services/firestore.service';

export interface StateOption {
  value: string;
  name: string;
}

export interface UserTypeOption {
  value: string;
  name: string;
}

// Interface for applied coupon details (keep this one)
interface AppliedCouponDetails {
  code: string;
  discount: number;
  discountType: 'percentage' | 'fixed';
  description?: string;
}

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './user-form.component.html',
  styleUrls: ['./user-form.component.css'],
  providers: [EmailService],
})
export class UserFormComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private emailService = inject(EmailService);
  private verificationService = inject(VerificationCodeService);
  private modalService = inject(ModalService);
  private readonly locationService = inject(LocationService);
  private injector = inject(Injector);
  private stripeService = inject(StripeService);
  private firestoreService = inject(FirestoreService);

  // Component destruction subject for cleanup
  private destroy$ = new Subject<void>();

  userForm!: FormGroup;
  isLoading = false;
  successMessage = '';
  errorMessage = '';
  phone: any;

  // Coupon-related properties
  isValidatingCoupon = false;
  couponApplied = false;
  appliedCouponDetails: AppliedCouponDetails | null = null;

  // Define all US states - using the same approach as lender registration
  states: StateOption[] = [];

  ngOnInit(): void {
    // Use the LocationService to get states in the same format as lender registration
    const footprintLocations = this.locationService.getFootprintLocations();
    this.states = footprintLocations.map((location) => ({
      value: location.value,
      name: location.name,
    }));

    this.userForm = this.fb.group({
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
      company: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[A-Za-z0-9 ]+$/),
        ],
      ],
      email: ['', [Validators.required, Validators.email]],
      phone: [
        '',
        [
          Validators.required,
          Validators.pattern(/^[\d\(\)\-\+\s]*$/),
          Validators.minLength(14),
        ],
      ],
      city: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[A-Za-z ]+$/),
        ],
      ],
      state: ['', [Validators.required]],
      tos: [false, [Validators.requiredTrue]],
      interval: ['monthly', [Validators.required]],
      applyTrial: [false],
      // Add coupon code form control
      couponCode: [''], // Optional field, no validators by default
    });

    console.log('Initial TOS control state:', {
      value: this.userForm.get('tos')?.value,
      status: this.userForm.get('tos')?.status,
      enabled: !this.userForm.get('tos')?.disabled,
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectBilling(interval: 'monthly' | 'annually'): void {
    this.userForm.patchValue({
      interval: interval
    });
  }

  formatPhoneNumber(): void {
    let phone = this.userForm.get('phone')?.value;
    if (phone) {
      phone = phone.replace(/\D/g, ''); // digits only
      if (phone.length > 10) phone = phone.slice(0, 10);

      let formatted = phone;
      if (phone.length >= 6) {
        formatted = `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(
          6
        )}`;
      } else if (phone.length >= 3) {
        formatted = `(${phone.slice(0, 3)}) ${phone.slice(3)}`;
      } else {
        formatted = phone;
      }

      this.userForm.get('phone')?.setValue(formatted, { emitEvent: false });
    }
  }

  /**
 * Save user data to Firestore with inactive status before Stripe checkout
 */
private async saveUserToFirestore(formData: any): Promise<void> {
  try {
    console.log('🔄 Creating Firebase Auth user and saving to Firestore...');
    
    // ✅ Create a temporary UID for now, Firebase Auth user will be created by webhook
const tempUid = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Prepare originator data for Firestore
const originatorData = {
  uid: tempUid, // Temporary UID, webhook will update with real Firebase UID
  id: tempUid,
  email: formData.email.toLowerCase().trim(),
  firstName: formData.firstName,
  lastName: formData.lastName,
  company: formData.company,
  phone: formData.phone,
  city: formData.city,
  state: formData.state,
  role: 'originator',
  subscriptionStatus: 'inactive',
  registrationCompleted: false,
  paymentPending: true,
  billingInterval: formData.interval,
  isTemporary: true, // Mark as temporary until webhook processes
  contactInfo: {
    firstName: formData.firstName,
    lastName: formData.lastName,
    contactEmail: formData.email.toLowerCase().trim(),
    contactPhone: formData.phone,
    company: formData.company,
    city: formData.city,
    state: formData.state,
  }
};

// Save to Firestore using the FirestoreService
await this.firestoreService.setDocument(
  `originators/${tempUid}`, 
  originatorData
).toPromise();
console.log('✅ User saved to Firestore with inactive status');
    
  } catch (error) {
    console.error('❌ Error saving user to Firestore:', error);
    throw error;
  }
}
  
 /**
 * Proceeds with checkout session creation - UPDATED to save user first
 */
private async proceedWithCheckout(formData: any): Promise<void> {
  try {
    // ✅ NEW: Save user to Firestore FIRST with inactive status
    await this.saveUserToFirestore(formData);
    
    // Store originator data for post-payment processing
    const originatorData = {
      email: formData.email,
      firstName: formData.firstName,
      lastName: formData.lastName,
      company: formData.company,
      phone: formData.phone,
      city: formData.city,
      state: formData.state,
      role: 'originator',
      billingInterval: formData.interval,
      coupon: this.appliedCouponDetails ? {
        code: this.appliedCouponDetails.code,
        discount: this.appliedCouponDetails.discount,
        discountType: this.appliedCouponDetails.discountType
      } : null
    };

    try {
      localStorage.setItem('completeOriginatorData', JSON.stringify(originatorData));
      localStorage.setItem('showRegistrationModal', 'true');
    } catch (err) {
      console.error('Failed to store originator data locally', err);
    }

    // Create Stripe checkout session (simplified - no userData needed)
    const checkoutData: any = {
      email: formData.email,
      role: 'originator',
      interval: formData.interval as 'monthly' | 'annually',
    };

    // Add coupon if applied
    if (this.couponApplied && this.appliedCouponDetails) {
      checkoutData.coupon = {
        code: this.appliedCouponDetails.code,
        discount: this.appliedCouponDetails.discount,
        discountType: this.appliedCouponDetails.discountType
      };
    }

    this.stripeService.createCheckoutSession(checkoutData)
      .pipe(
        tap((checkoutResponse) => {
          console.log('✅ Stripe checkout session created:', checkoutResponse);
          window.location.href = checkoutResponse.url;
        }),
        catchError((error) => {
          this.isLoading = false;
          console.error('Stripe error:', error);
          this.errorMessage = error.message || 'Failed to initiate payment. Please try again.';
          return of(null);
        })
      )
      .subscribe();

  } catch (error) {
    this.isLoading = false;
    this.errorMessage = 'Failed to create account. Please try again.';
    console.error('Error in registration flow:', error);
  }
}

  /**
   * Handles the response from Stripe promotion code validation
   */
  private handlePromotionCodeResponse(response: any): void {
    if (response.valid && response.promotion_code) {
      const coupon = response.promotion_code.coupon;
      
      // Coupon is valid - apply it
      this.couponApplied = true;
      this.appliedCouponDetails = {
        code: response.promotion_code.code,
        discount: coupon.percent_off || (coupon.amount_off / 100), // Convert cents to dollars for fixed amounts
        discountType: coupon.percent_off ? 'percentage' : 'fixed',
        description: coupon.name
      };
      
      // Clear any existing errors
      this.clearCouponErrors();
      
      console.log('Promotion code applied successfully:', this.appliedCouponDetails);
    } else {
      // Coupon is invalid
      this.resetCouponState();
      this.setCouponError(response.error || 'Invalid promotion code');
    }
  }

  /**
   * Sets coupon validation errors
   */
  private setCouponError(errorMessage: string): void {
    const couponControl = this.userForm.get('couponCode');
    if (couponControl) {
      couponControl.setErrors({ 
        couponError: errorMessage 
      });
    }
  }
  /**
   * Clears coupon validation errors
   */
  private clearCouponErrors(): void {
    const couponControl = this.userForm.get('couponCode');
    if (couponControl) {
      couponControl.setErrors(null);
    }
  }

  /**
   * Resets coupon application state
   */
  private resetCouponState(): void {
    this.couponApplied = false;
    this.appliedCouponDetails = null;
    this.clearCouponErrors();
  }

  async onSubmit(): Promise<void> {
  Object.keys(this.userForm.controls).forEach((key) => {
    const control = this.userForm.get(key);
    control?.markAsTouched();
  });

  if (this.userForm.invalid) {
    return;
  }

  this.isLoading = true;
  this.errorMessage = '';
  this.successMessage = '';

  const formData = this.userForm.value;

  try {
    // Save user to Firestore first
    await this.saveUserToFirestore(formData);
    
    // Then proceed with Stripe checkout
    await this.proceedWithCheckout(formData);
  } catch (error) {
    this.isLoading = false;
    this.errorMessage = 'Registration failed. Please try again.';
    console.error('Registration error:', error);
  }
}
}