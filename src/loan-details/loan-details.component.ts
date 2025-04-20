// loan-details.component.ts
import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LoanService, Loan } from '../services/loan.service';
import { AuthService } from '../services/auth.service';
import { switchMap, catchError } from 'rxjs/operators';
import { Observable, of, Subscription } from 'rxjs';
import { doc, getDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-loan-details',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './loan-details.component.html',
  styleUrls: ['./loan-details.component.css'],
})
export class LoanDetailsComponent implements OnInit, OnDestroy {
  // Inject services
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private loanService = inject(LoanService);
  private authService = inject(AuthService);

  // Subscriptions
  private authSubscription: Subscription | null = null;
  private routeSubscription: Subscription | null = null;

  // State management with signals
  loan = signal<Loan | null>(null);
  isLoading = signal<boolean>(true);
  errorMessage = signal<string | null>(null);
  isAuthenticated = signal<boolean>(false);

  // Property type color map (copied from loans component for consistency)
  propertyColorMap: { [key: string]: string } = {
    Commercial: '#1E90FF',
    Healthcare: '#cb4335',
    Hospitality: '#1b4f72',
    Industrial: '#708090',
    Land: '#023020',
    MixedUse: '#8A2BE2',
    'Multi-family': '#6c3483',
    Office: '#4682B4',
    Residential: '#DC143C',
    Retail: '#FFD700',
    SpecialPurpose: '#A52A2A',
  };

  ngOnInit(): void {
    // Check authentication status
    this.authSubscription = this.authService.isLoggedIn$.subscribe(
      (isLoggedIn) => {
        this.isAuthenticated.set(isLoggedIn);

        // If not authenticated, we could redirect, but the AuthGuard should already handle this
        if (!isLoggedIn) {
          console.warn(
            'User is not authenticated. AuthGuard should have prevented access.'
          );
        }
      }
    );

    // Get loan ID from route params and load loan details
    this.routeSubscription = this.route.paramMap
      .pipe(
        switchMap((params) => {
          const id = params.get('id');
          if (!id) {
            this.errorMessage.set('Loan ID not found in URL.');
            this.isLoading.set(false);
            return of(null);
          }

          return this.loadLoanDetails(id);
        })
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    // Clean up subscriptions when component is destroyed
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
  }

  /**
   * Loads loan details by ID
   */
  loadLoanDetails(id: string): Observable<Loan | null> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    return this.loanService.getLoanById(id).pipe(
      switchMap((loan) => {
        if (!loan) {
          this.errorMessage.set('Loan not found.');
          this.isLoading.set(false);
          return of(null);
        }

        this.loan.set(loan);
        this.isLoading.set(false);
        return of(loan);
      }),
      catchError((error) => {
        console.error('Error loading loan details:', error);
        this.errorMessage.set('Failed to load loan details. Please try again.');
        this.isLoading.set(false);
        return of(null);
      })
    );
  }

  /**
   * Retry loading the loan details
   */
  retryLoadLoan(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadLoanDetails(id).subscribe();
    } else {
      // Handle case where ID is missing
      this.errorMessage.set('Loan ID not found in URL.');
    }
  }

  /**
   * Get background color for property type
   */
  getColor(propertyType: string): string {
    return this.propertyColorMap[propertyType] || '#000000'; // fallback to black
  }

  /**
   * Format currency values (copied from loans component for consistency)
   */
  formatCurrency(value: string): string {
    if (!value) return '$0';

    // Remove any existing currency formatting
    const numericValue =
      typeof value === 'string' ? value.replace(/[$,]/g, '') : value;

    // Convert string to number and format as currency
    const amount = Number(numericValue);
    if (isNaN(amount)) return '$0';

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /**
   * Format date values (copied from loans component for consistency)
   */
  getFormattedDate(date: any): string {
    if (!date) return 'N/A';

    try {
      // If date is a Firebase timestamp, convert to JS Date
      const jsDate = date.toDate ? date.toDate() : new Date(date);

      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(jsDate);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  }

  /**
   * Navigate back to loans list
   */
  goBack(): void {
    this.router.navigate(['/loans']);
  }
}
