// test-checkout.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StripeService } from '../../services/stripe.service';
import { tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-test-checkout',
  standalone: true,
  imports: [CommonModule],
  templateUrl:'./test-checkout.component.html',
  styleUrls: ['./test-checkout.component.css'],
})
   
export class TestCheckoutComponent {
  private stripeService = inject(StripeService);
  
  isLoading = false;

  testCouponCheckout(): void {
    this.isLoading = true;
    
    const testCheckoutData = {
      email: 'test@yoursite.com',
      role: 'originator',
      interval: 'monthly' as 'monthly' | 'annually',
      userData: {
        firstName: 'Test',
        lastName: 'User',
        company: 'Test Company',
        phone: '(555) 123-4567',
        city: 'Test City',
        state: 'NC',
      },
      coupon: {
        code: '3MONTHSTEST',
        discount: 100, // Adjust to match your actual coupon
        discountType: 'percentage' as 'percentage' | 'fixed'
      }
    };

    this.stripeService.createCheckoutSession(testCheckoutData)
      .pipe(
        tap((checkoutResponse) => {
          console.log('✅ Test checkout session created:', checkoutResponse);
          window.location.href = checkoutResponse.url;
        }),
        catchError((error) => {
          this.isLoading = false;
          console.error('Test checkout error:', error);
          alert('Test checkout failed: ' + (error.message || 'Unknown error'));
          return of(null);
        })
      )
      .subscribe();
  }
}