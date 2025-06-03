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

onGetStarted(planType: 'originators' | 'lenders' | 'mortgage-companies'): void {
  // Handle plan selection logic here
  console.log('Selected plan:', planType);
  // Navigate to signup or trigger appropriate action
}

  toggleOriginatorBilling(): void {
    this.isOriginatorAnnual = !this.isOriginatorAnnual;
  }

  toggleLenderBilling(): void {
    this.isLenderAnnual = !this.isLenderAnnual;
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
    this.authService
      .getAuthStatus()
      .pipe(take(1))
      .subscribe((isLoggedIn) => {
        if (isLoggedIn) {
          // User is authenticated, navigate to loan form
          this.router.navigate(['/loan']);
        } else {
          // User is not authenticated, store the redirect URL and navigate to login
          localStorage.setItem('redirectUrl', '/loan');
          this.router.navigate(['/login']);
        }
      });
  }
}