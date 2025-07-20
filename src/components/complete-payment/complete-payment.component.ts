import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-complete-payment',
  standalone: true,
  templateUrl: './complete-payment.component.html',
  styleUrls: ['./complete-payment.component.css'],
  imports: [CommonModule]
})
export class CompletePaymentComponent {

  // ✅ Track billing cycle for each plan
  isOriginatorAnnual = false;
  isLenderAnnual = false;

  /**
   * ✅ Toggle billing cycle for originators
   */
  toggleOriginatorBilling(): void {
    this.isOriginatorAnnual = !this.isOriginatorAnnual;
  }

  /**
   * ✅ Toggle billing cycle for lenders
   */
  toggleLenderBilling(): void {
    this.isLenderAnnual = !this.isLenderAnnual;
  }

  /**
   * ✅ Navigate to Stripe payment link based on selected plan and billing
   */
  navigateToPayment(planType: 'originators' | 'lenders'): void {
    const billingCycle = this.getBillingCycle(planType);
    const paymentUrl = this.buildPaymentUrl(planType, billingCycle);
    
    console.log('Navigating to payment:', {
      planType,
      billingCycle,
      paymentUrl
    });

    // Redirect to Stripe payment link
    window.location.href = paymentUrl;
  }

  /**
   * ✅ Build Stripe payment URL for the selected plan
   */
  private buildPaymentUrl(planType: 'originators' | 'lenders', billingCycle: 'monthly' | 'annual'): string {
    // ✅ TODO: Replace these with your actual Stripe payment link URLs
    const paymentLinks = {
      originators: {
        monthly: 'https://buy.stripe.com/6oU6oHbnW9fk3JLfm7ffy01', 
        annual: 'https://buy.stripe.com/cNi14n77G9fka893Dpffy02'
      },
      lenders: {
        monthly: 'https://buy.stripe.com/14AdR94Zy2QWdkl2zlffy03', 
        annual: 'https://buy.stripe.com/9B65kD2Rqajoa898XJffy04'
      }
    };

    return paymentLinks[planType][billingCycle];
  }

  /**
   * ✅ Get billing cycle for the specified plan type
   */
  private getBillingCycle(planType: 'originators' | 'lenders'): 'monthly' | 'annual' {
    if (planType === 'originators') {
      return this.isOriginatorAnnual ? 'annual' : 'monthly';
    } else {
      return this.isLenderAnnual ? 'annual' : 'monthly';
    }
  }
}