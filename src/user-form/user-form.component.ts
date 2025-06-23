import {
  Component,
  OnInit,
  inject,
  Injector,
  runInInjectionContext,
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
import { catchError, tap, switchMap, take } from 'rxjs/operators';
import { of } from 'rxjs';
import { VerificationCodeService } from '../services/verification-code.service';
import { EmailService } from '../services/email.service';
import { ModalService } from '../services/modal.service';
import { usaStatesWithCounties } from 'typed-usa-states/dist/states-with-counties';
import { LocationService } from 'src/services/location.service';
import { StripeService } from '../services/stripe.service'; // ADD THIS IMPORT

export interface StateOption {
  value: string;
  name: string;
}

export interface UserTypeOption {
  value: string;
  name: string;
}

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './user-form.component.html',
  styleUrls: ['./user-form.component.css'],
  providers: [EmailService],
})
export class UserFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private emailService = inject(EmailService);
  private verificationService = inject(VerificationCodeService);
  private modalService = inject(ModalService);
  private readonly locationService = inject(LocationService);
  private injector = inject(Injector);
  private stripeService = inject(StripeService); // ADD THIS INJECTION

  userForm!: FormGroup;
  isLoading = false;
  successMessage = '';
  errorMessage = '';
  phone: any;

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
      applyTrial: [false]
    });

    console.log('Initial TOS control state:', {
      value: this.userForm.get('tos')?.value,
      status: this.userForm.get('tos')?.status,
      enabled: !this.userForm.get('tos')?.disabled,
    });
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

  onSubmit(): void {
    // Mark form as touched to show validation errors
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

    // Run Firebase operations inside injection context for consistency with LenderRegistrationComponent
    runInInjectionContext(this.injector, () => {
      // MODIFIED: Register user with pending subscription status
      this.authService
        .registerUser(formData.email, 'defaultPassword123', {
          firstName: formData.firstName,
          lastName: formData.lastName,
          company: formData.company,
          userType: formData.userType,
          phone: formData.phone,
          city: formData.city,
          state: formData.state,
          role: 'originator',
          // ADD THESE FIELDS
          billingInterval: formData.interval,
          subscriptionStatus: 'pending', // Mark as pending until payment
          registrationCompleted: false // Flag to track full registration
        })
         .pipe(
        // MODIFIED: Get the current user after registration
        switchMap(() => {
          // Get the current authenticated user
          return this.authService.getCurrentUser().pipe(take(1));
        }),
        // MODIFIED: Create Stripe checkout session
        switchMap((user) => {
          if (user && user.uid) {
            // Create Stripe checkout session
            return this.stripeService.createCheckoutSession({
              email: formData.email,
              role: 'originator',
              interval: formData.interval as 'monthly' | 'annually',
              userId: user.uid,
              userData: {
                firstName: formData.firstName,
                lastName: formData.lastName,
                company: formData.company,
                phone: formData.phone,
                city: formData.city,
                state: formData.state,
              }
            });
          } else {
            throw new Error('User registration succeeded but user not found');
          }
        }),
        tap((checkoutResponse) => {
          // Redirect to Stripe Checkout
          window.location.href = checkoutResponse.url;
        }),
        catchError((error) => {
          this.isLoading = false;
          console.error('Registration error:', error);
          if (error.code === 'auth/email-already-in-use') {
            this.errorMessage =
              'This email is already registered. Please use a different email or login with your existing account.';
          } else {
            this.errorMessage = error.message || 'Registration failed. Please try again.';
          }
          return of(null);
        })
      )
      .subscribe();
  });
}
}