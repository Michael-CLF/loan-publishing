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

  navigateToLoan(planType: 'single' | 'team'): void {
    // Store the plan type in localStorage
    localStorage.setItem('selectedPlan', planType);

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
