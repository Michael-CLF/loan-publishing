import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StripeService } from '../../services/stripe.service';
import { tap, catchError, takeUntil, finalize } from 'rxjs/operators';
import { of, Subject } from 'rxjs';

/**
 * Test component for validating Stripe coupon functionality
 * Uses existing StripeService methods to test coupon with $1 product
 */
@Component({
  selector: 'app-test-checkout',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './test-checkout.component.html',
  styleUrls: ['./test-checkout.component.css'],
})
export class TestCheckoutComponent implements OnDestroy {
  // Angular 18 best practice: Use inject() function
  private readonly stripeService = inject(StripeService);
  
  // Component destruction subject for cleanup
  private readonly destroy$ = new Subject<void>();
  
  // Component state
  isLoading = false;
  errorMessage = '';

  // Properties for template
  get currentHostname(): string {
    return window.location.hostname;
  }

  get currentTimestamp(): number {
    return Date.now();
  }

  /**
   * Creates a test checkout session using your existing createCheckoutSession method
   * Modified to work with your $1 test product instead of the regular originator product
   */
  testCouponCheckout(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    // Use your existing checkout data structure but modified for testing
    const testCheckoutData = {
      email: 'test@yoursite.com',
      role: 'originator', // Keep the same role
      interval: 'monthly' as 'monthly' | 'annually',
      
      // Mark this as a test to help your backend handle it differently
      isTestMode: true,
      testProduct: true,
      
      userData: {
        firstName: 'Test',
        lastName: 'User',
        company: 'Test Company',
        phone: '(555) 123-4567',
        city: 'Test City',
        state: 'NC',
      },
      
      // Apply the test coupon
      coupon: {
        code: '3MONTHSTEST',
        discount: 100,
        discountType: 'percentage' as 'percentage' | 'fixed'
      }
    };

    // Use your existing createCheckoutSession method
    this.stripeService.createCheckoutSession(testCheckoutData)
      .pipe(
        takeUntil(this.destroy$),
        tap((checkoutResponse: any) => {
          console.log('✅ Test checkout session created:', checkoutResponse);
          // Redirect to Stripe checkout page
          if (checkoutResponse?.url) {
            window.location.href = checkoutResponse.url;
          } else {
            throw new Error('No checkout URL received from Stripe');
          }
        }),
        catchError((error: any) => {
          console.error('Test checkout error:', error);
          this.handleCheckoutError(error);
          return of(null);
        }),
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe();
  }

  /**
   * Tests coupon validation using your existing validatePromotionCode method
   */
  testCouponValidation(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.stripeService.validatePromotionCode('3MONTHSTEST')
      .pipe(
        takeUntil(this.destroy$),
        tap((response: any) => {
          console.log('✅ Coupon validation result:', response);
          
          if (response?.valid) {
            alert(`✅ Coupon is VALID!\n\nDetails:\n- Code: ${response.promotion_code?.code}\n- Discount: ${response.promotion_code?.coupon?.percent_off || response.promotion_code?.coupon?.amount_off}${response.promotion_code?.coupon?.percent_off ? '%' : ' cents'} off`);
          } else {
            alert(`❌ Coupon is INVALID!\n\nError: ${response?.error || 'Unknown validation error'}`);
          }
        }),
        catchError((error: any) => {
          console.error('Coupon validation failed:', error);
          this.errorMessage = `Coupon validation failed: ${error.message || 'Unknown error'}`;
          alert(`❌ Coupon validation failed: ${error.message || 'Unknown error'}`);
          return of(null);
        }),
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe();
  }

  /**
   * Simple test using a direct Stripe payment link
   * You'll need to create this link in your Stripe dashboard
   */
  testWithPaymentLink(): void {
    // This would open a pre-configured Stripe payment link
    // You need to create this in your Stripe dashboard first
    const paymentLinkUrl = 'https://buy.stripe.com/test_YOUR_PAYMENT_LINK_HERE';
    
    alert('To use this feature:\n\n1. Go to your Stripe Dashboard\n2. Create a Payment Link for your $1 test product\n3. Add your 3MONTHSTEST coupon to the link\n4. Replace the URL in this method');
    
    // Uncomment this line after setting up your payment link:
    // window.open(paymentLinkUrl, '_blank');
  }

  /**
   * Handles checkout errors with proper user feedback
   */
  private handleCheckoutError(error: any): void {
    const errorMessage = error?.message || error?.error?.message || 'Unknown error occurred';
    this.errorMessage = `Test checkout failed: ${errorMessage}`;
    
    // Log detailed error for debugging
    console.error('Detailed error information:', {
      error,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    });
  }

  /**
   * Clear error message
   */
  clearError(): void {
    this.errorMessage = '';
  }

  /**
   * Cleanup subscriptions on component destruction
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}