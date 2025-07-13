import {
  Component,
  OnInit,
  inject,
  OnDestroy
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { takeUntil, catchError, finalize } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { LocationService } from 'src/services/location.service';
import { StripeService } from '../services/stripe.service';
import { User, onAuthStateChanged } from '@angular/fire/auth'
import { Auth } from '@angular/fire/auth';


export interface StateOption {
  value: string;
  name: string;
}

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './user-form.component.html',
  styleUrls: ['./user-form.component.css']
})
export class UserFormComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private locationService = inject(LocationService);
  private stripeService = inject(StripeService);
   private auth = inject(Auth);

  private destroy$ = new Subject<void>();

  userForm!: FormGroup;
  isLoading = false;
  errorMessage = '';
  couponApplied = false;
  states: StateOption[] = [];

  ngOnInit(): void {
    const footprintLocations = this.locationService.getFootprintLocations();
    this.states = footprintLocations.map((location) => ({
      value: location.value,
      name: location.name,
    }));

    this.userForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[A-Za-z ]+$/)]],
      lastName: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[A-Za-z ]+$/)]],
      company: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[A-Za-z0-9 ]+$/)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[\d\(\)\-\+\s]*$/), Validators.minLength(14)]],
      city: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[A-Za-z ]+$/)]],
      state: ['', [Validators.required]],
      tos: [false, [Validators.requiredTrue]],
      interval: ['monthly', [Validators.required]],
      applyTrial: [false],
      couponCode: ['']
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectBilling(interval: 'monthly' | 'annually'): void {
    this.userForm.patchValue({ interval });
  }

  formatPhoneNumber(): void {
    let phone = this.userForm.get('phone')?.value;
    if (phone) {
      phone = phone.replace(/\D/g, '').slice(0, 10);
      let formatted = phone;
      if (phone.length >= 6) {
        formatted = `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
      } else if (phone.length >= 3) {
        formatted = `(${phone.slice(0, 3)}) ${phone.slice(3)}`;
      }
      this.userForm.get('phone')?.setValue(formatted, { emitEvent: false });
    }
  }

  public async getCurrentUser(): Promise<User | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(this.auth, (user: User | null) => {
      unsubscribe();
      resolve(user);
    });
  });
}

  validateCoupon(): void {
    const couponCode = this.userForm.get('couponCode')?.value?.trim();
    if (!couponCode) return;

    this.isLoading = true;
    this.stripeService.validatePromotionCode(couponCode).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.isLoading = false),
      catchError(error => {
        console.error('Coupon validation failed:', error);
        this.userForm.get('couponCode')?.setErrors({ invalidCoupon: true });
        return of(null);
      })
    ).subscribe(response => {
      if (response?.valid) {
        this.couponApplied = true;
        this.userForm.get('couponCode')?.setErrors(null);
      } else {
        this.userForm.get('couponCode')?.setErrors({ invalidCoupon: true });
      }
    });
  }


  async onSubmit(): Promise<void> {
    Object.keys(this.userForm.controls).forEach((key) => {
      this.userForm.get(key)?.markAsTouched();
    });

    if (this.userForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';

    const formData = this.userForm.value;

    try {
      const currentUser = await this.authService.getCurrentFirebaseUser();
      const uid = currentUser?.uid;
      if (!uid) throw new Error('User not authenticated');


      const checkoutResponse = await this.stripeService.createCheckoutSession({
        uid,
        ...formData
      });

      if (checkoutResponse?.url) {
        window.location.href = checkoutResponse.url;
      } else {
        throw new Error('Stripe checkout URL not returned');
      }

    } catch (error) {
      console.error('Registration or checkout failed:', error);
      this.errorMessage = 'Something went wrong. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }
}
