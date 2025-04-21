import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LoanService, Loan } from '../services/loan.service';
import { AuthService } from '../services/auth.service';
import { switchMap, catchError, tap } from 'rxjs/operators';
import { Observable, of, Subscription } from 'rxjs';
import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
} from '@angular/fire/firestore';
import { User } from '../models/user.model';

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
  private firestore = inject(Firestore);

  // Subscriptions
  private authSubscription: Subscription | null = null;
  private routeSubscription: Subscription | null = null;
  private userSubscription: Subscription | null = null;

  // State management with signals
  loan = signal<Loan | null>(null);
  user = signal<User | null>(null);
  isLoading = signal<boolean>(true);
  errorMessage = signal<string | null>(null);
  isAuthenticated = signal<boolean>(false);

  // Property type color map
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
    Retail: '#c00000',
    SpecialPurpose: '#A52A2A',
  };

  ngOnInit(): void {
    // Check authentication status and load user data
    this.authSubscription = this.authService.isLoggedIn$.subscribe(
      (isLoggedIn) => {
        this.isAuthenticated.set(isLoggedIn);

        if (isLoggedIn) {
          // Load the current user data
          this.loadCurrentUserData();
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

  /**
   * Load the current user's profile data
   */
  loadCurrentUserData(): void {
    console.log('LOAN DETAILS: Loading current user data');

    this.userSubscription = this.authService
      .getCurrentUser()
      .subscribe((currentUser) => {
        if (currentUser && currentUser.email) {
          console.log('LOAN DETAILS: Current user email:', currentUser.email);

          // Use the current user's email to find the user document
          const usersRef = collection(this.firestore, 'users');
          const q = query(usersRef, where('email', '==', currentUser.email));

          getDocs(q)
            .then((snapshot) => {
              if (!snapshot.empty) {
                const userDoc = snapshot.docs[0];
                const userData = userDoc.data() as User;
                userData.uid = userDoc.id;

                console.log('LOAN DETAILS: Found user data:', userData);
                this.user.set(userData);
              } else {
                console.log(
                  'LOAN DETAILS: No user found with current user email'
                );
              }
            })
            .catch((error) => {
              console.error(
                'LOAN DETAILS: Error finding user by email:',
                error
              );
            });
        } else {
          console.log('LOAN DETAILS: No current user or email available');
        }
      });
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  /**
   * Loads loan details by ID
   */
  loadLoanDetails(id: string): Observable<Loan | null> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    return this.loanService.getLoanById(id).pipe(
      tap((loan) => {
        if (loan) {
          console.log('LOAN DETAILS: Loan loaded:', loan);
          this.loan.set(loan);
        } else {
          this.errorMessage.set('Loan not found.');
        }
      }),
      catchError((error) => {
        console.error('Error loading loan details:', error);
        this.errorMessage.set('Failed to load loan details. Please try again.');
        return of(null);
      }),
      tap(() => {
        this.isLoading.set(false);
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
      this.errorMessage.set('Loan ID not found in URL.');
    }
  }

  /**
   * Get background color for property type
   */
  getColor(propertyType: string): string {
    return this.propertyColorMap[propertyType] || '#000000';
  }

  /**
   * Format currency values
   */
  formatCurrency(value: string): string {
    if (!value) return '$0';

    const numericValue =
      typeof value === 'string' ? value.replace(/[$,]/g, '') : value;

    const amount = Number(numericValue);
    if (isNaN(amount)) return '$0';

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /**
   * Format date values
   */
  getFormattedDate(date: any): string {
    if (!date) return 'N/A';

    try {
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
