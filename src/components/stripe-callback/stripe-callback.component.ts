import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { registerLocaleData } from '@angular/common';
import localeEn from '@angular/common/locales/en';
import { take } from 'rxjs/operators';
import { ResolveFn, ActivatedRouteSnapshot } from '@angular/router';

registerLocaleData(localeEn);

export const stripeCallbackResolver: ResolveFn<boolean> = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const payment = route.queryParams['payment'];
  
  if (payment === 'success') {
    authService.setRegistrationSuccess(true);
    return true;
  }
  return false;
};

@Component({
  selector: 'app-stripe-callback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stripe-callback.component.html',
  styleUrls: ['./stripe-callback.component.css']
})
export class StripeCallbackComponent implements OnInit {
  // Angular 18 best practice: Use inject() function
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);

  // Angular 18 best practice: Use signals for reactive state
  public isLoading = signal(true);
  public showSuccessModal = signal(false);
  public hasError = signal(false);
  public paymentStatus = signal<'success' | 'cancel' | null>(null);
  

  constructor() {
    // Angular 18 best practice: Use effect for side effects
    effect(() => {
      if (this.paymentStatus() === 'success') {
        this.handleSuccessfulPayment();
      }
    });
  }
  

  ngOnInit(): void {
    this.processPaymentCallback();
  }

  private processPaymentCallback(): void {
    // Get payment status from query parameters
    this.route.queryParams.subscribe(params => {
      const payment = params['payment'];
      
      console.log('Payment callback received:', payment);
      
      if (payment === 'success') {
        this.paymentStatus.set('success');
        this.isLoading.set(false);
      } else if (payment === 'cancel') {
        this.paymentStatus.set('cancel');
        this.hasError.set(true);
        this.isLoading.set(false);
      } else {
        // Invalid callback, redirect to home
        this.router.navigate(['/']);
      }
    });
  }

  private handleSuccessfulPayment(): void {
    // Set registration success flag in AuthService for dashboard modal
    this.authService.setRegistrationSuccess(true);
    this.router.navigate(['/dashboard']);
  }
}