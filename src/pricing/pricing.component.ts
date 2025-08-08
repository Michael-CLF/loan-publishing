import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-pricing',
  templateUrl: './pricing.component.html',
  styleUrls: ['./pricing.component.css'],
})
export class PricingComponent {
  private router = inject(Router);
  private authService = inject(AuthService);

  // Track billing cycle for each plan
  isOriginatorAnnual = false;
  isLenderAnnual = false;
  isMortgageCompanyAnnual = false;

  toggleMortgageCompanyBilling(): void {
    this.isMortgageCompanyAnnual = !this.isMortgageCompanyAnnual;
  }

  toggleOriginatorBilling(): void {
    this.isOriginatorAnnual = !this.isOriginatorAnnual;
  }

  toggleLenderBilling(): void {
    this.isLenderAnnual = !this.isLenderAnnual;
  }

  onGetStarted(planType: 'originators' | 'lenders' | 'mortgage-companies'): void {
    // Handle plan selection logic here
    console.log('Selected plan:', planType);
    // Navigate to signup or trigger appropriate action
  }

  navigateToUserForm(planType: 'originators' | 'lenders' | 'mortgage-companies'): void {
    // Get the selected billing cycle based on plan type
    const billingCycle = this.getBillingCycle(planType);
    
    // Store the plan type and billing cycle in localStorage
    localStorage.setItem('selectedPlan', planType);
    localStorage.setItem('selectedBilling', billingCycle);

    console.log('Selected plan:', planType, 'Billing:', billingCycle);

    // Navigate to the appropriate registration form
    if (planType === 'lenders') {
      this.router.navigate(['/lender-registration']);
    } else {
      // originators and mortgage-companies go to user-form
      this.router.navigate(['/user-form']);
    }
  }

  navigateToLoan(planType: 'originator' | 'lender'): void {
    // Get the selected billing cycle based on plan type
    const billingCycle = planType === 'originator' 
      ? (this.isOriginatorAnnual ? 'annual' : 'monthly')
      : (this.isLenderAnnual ? 'annual' : 'monthly');
    
    // Store the plan type and billing cycle in localStorage
    localStorage.setItem('selectedPlan', planType);
    localStorage.setItem('selectedBilling', billingCycle);

   // Check if user is authenticated
this.authService.isLoggedIn$
  .pipe(take(1))
  .subscribe((isLoggedIn) => {
    if (isLoggedIn) {
      this.router.navigate(['/loan']);
    } else {
      localStorage.setItem('redirectUrl', '/loan');
      this.router.navigate(['/login']);
    }
  });
  }

  /**
   * Helper method to get billing cycle based on plan type
   * Follows DRY principle and makes the code more maintainable
   */
  private getBillingCycle(planType: 'originators' | 'lenders' | 'mortgage-companies'): string {
    switch (planType) {
      case 'originators':
        return this.isOriginatorAnnual ? 'annual' : 'monthly';
      case 'lenders':
        return this.isLenderAnnual ? 'annual' : 'monthly';
      case 'mortgage-companies':
        return this.isMortgageCompanyAnnual ? 'annual' : 'monthly';
      default:
        return 'monthly';
    }
  }
}