// src/app/lender-registration/lender-stripe-payment.component.ts

import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  inject,
  Injector,
  runInInjectionContext,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { StripeService } from '../../services/stripe.service';
import { catchError, tap, switchMap, take } from 'rxjs/operators';
import { of } from 'rxjs';
import { CheckoutSessionRequest } from '../../services/stripe.service';


interface LenderData {
  companyName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  completeFormData?: {
    contactInfo: any;
    productInfo: any;
    footprintInfo: any;
  };
}

interface PaymentResult {
  success: boolean;
  message?: string;
  error?: string;
}

@Component({
  selector: 'app-lender-stripe-payment',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './lender-stripe-payment.component.html',
  styleUrls: ['./lender-stripe-payment.component.css'],
})
export class LenderStripePaymentComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private injector = inject(Injector);
  private stripeService = inject(StripeService);

  @Input() lenderData!: LenderData;
  @Output() paymentComplete = new EventEmitter<PaymentResult>();
  @Output() paymentError = new EventEmitter<PaymentResult>();

  paymentForm!: FormGroup;
  isLoading = false;
  errorMessage = '';

  ngOnInit(): void {
    this.initializePaymentForm();
    this.validateLenderData();
  }

  private initializePaymentForm(): void {
    this.paymentForm = this.fb.group({
      interval: ['monthly'],
    });
  }

  private validateLenderData(): void {
    if (!this.lenderData) {
      console.error('LenderStripePaymentComponent: lenderData is required');
      this.paymentError.emit({
        success: false,
        error: 'Lender data not provided',
      });
    }
  }

  selectBilling(interval: 'monthly' | 'annually'): void {
    this.paymentForm.patchValue({ interval });
  }

  onSubmit(): void {
    this.paymentForm.markAllAsTouched();
    this.paymentForm.get('interval')?.markAsTouched();

    if (this.paymentForm.invalid) {
      this.errorMessage = 'Please select a billing option';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    const paymentData = this.paymentForm.value;

    runInInjectionContext(this.injector, () => {
      this.processLenderPayment(paymentData);
    });
  }

 private async processLenderPayment(paymentData: CheckoutSessionRequest): Promise<void> {

  this.isLoading = true;

  try {
   const checkoutResponse = await this.stripeService.createCheckoutSession(paymentData);


    if (!checkoutResponse || !checkoutResponse.url) {
      throw new Error('Invalid response from Stripe');
    }

    console.log('✅ Stripe checkout session created:', checkoutResponse);

    this.paymentComplete.emit({
      success: true,
      message: 'Redirecting to payment processor...'
    });

    console.log('➡️ Redirecting to:', checkoutResponse.url);
    window.location.href = checkoutResponse.url;

  } catch (error) {
    console.error('❌ Error in processLenderPayment:', error);
    this.handlePaymentError(error);
    this.isLoading = false;
  }
}


  private handlePaymentError(error: any): void {
    this.isLoading = false;
    console.error('Lender payment error:', error);

    let errorMessage = 'Payment processing failed. Please try again.';
    if (error.code === 'auth/email-already-in-use') {
      errorMessage =
        'This email is already registered. Please use a different email or contact support.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    this.errorMessage = errorMessage;
    this.paymentError.emit({ success: false, error: errorMessage });
  }

  getDisplayPrice(): string {
    const interval = this.paymentForm.get('interval')?.value;
    return interval === 'monthly' ? '$149.00/month' : '$1610.00/year';
  }

  getSavingsAmount(): string {
    return '$178.00';
  }
}
