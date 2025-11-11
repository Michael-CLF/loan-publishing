import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LoanService } from '../../services/loan.service';
import { AuthService } from '../../services/auth.service';
import { switchMap, catchError, tap, take, map } from 'rxjs/operators';
import { of, Subscription } from 'rxjs';
import { Loan } from '../../models/loan-model.model';
import { Firestore } from '@angular/fire/firestore';
import { User } from '../../models/user.model';
import { LoanTypeService } from '../../services/loan-type.service';
import { FirestoreService } from '../../services/firestore.service';
import { getPropertySubcategoryName } from '../../shared/constants/property-mappings';
import { LoanUtils, PropertySubcategoryValue } from '../../models/loan-model.model';
import { firstValueFrom } from 'rxjs';
import { doc, getDoc } from '@angular/fire/firestore';


// Property category interface for better type safety
interface PropertyCategoryOption {
  value: string;        // Snake_case for storage/matching
  displayName: string;  // User-friendly display name
}

interface LoanTypeOption {
  value: string;        // Snake_case for storage/matching  
  displayName: string;  // User-friendly display name
}

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
  private firestoreService = inject(FirestoreService);
  public loanTypeService = inject(LoanTypeService);

  // Subscriptions
  private authSubscription: Subscription | null = null;
  private routeSubscription: Subscription | null = null;
  private userSubscription: Subscription | null = null;

  // State management with signals
  loan = signal<Loan | null>(null);
  userData: User | null = null;
  isLoading = signal<boolean>(true);
  errorMessage = signal<string | null>(null);
  isAuthenticated = signal<boolean>(false);
  originatorDetails = signal<any | null>(null);

  // Property colors for visualization - handle both old and new formats
  propertyColorMap: Record<string, string> = {
    // New standardized format (snake_case)
    commercial: '#1E90FF',
    healthcare: '#cb4335',
    hospitality: '#1b4f72',
    industrial: '#2c3e50',
    land: '#023020',
    mixed_use: '#8A2BE2',
    multifamily: '#6c3483',
    office: '#4682B4',
    residential: '#DC143C',
    retail: '#660000',
    special_purpose: '#6e2c00',

    // Legacy format (Title Case/spaces) - for backward compatibility
    'Commercial': '#1E90FF',
    'Healthcare': '#cb4335',
    'Hospitality': '#1b4f72',
    'Industrial': '#154360',
    'Land': '#023020',
    'Mixed Use': '#8A2BE2',
    'Multifamily': '#6c3483',
    'Office': '#4682B4',
    'Residential': '#DC143C',
    'Retail': '#660000',
    'Special Purpose': '#6e2c00',
  };

  // Add this array after propertyColorMap and before allLoanTypeOptions:
  allPropertyCategoryOptions: PropertyCategoryOption[] = [
    { value: 'commercial', displayName: 'Commercial' },
    { value: 'healthcare', displayName: 'Healthcare' },
    { value: 'hospitality', displayName: 'Hospitality' },
    { value: 'industrial', displayName: 'Industrial' },
    { value: 'land', displayName: 'Land' },
    { value: 'mixed_use', displayName: 'Mixed Use' },
    { value: 'multifamily', displayName: 'Multifamily' },
    { value: 'office', displayName: 'Office' },
    { value: 'residential', displayName: 'Residential' },
    { value: 'retail', displayName: 'Retail' },
    { value: 'special_purpose', displayName: 'Special Purpose' },
  ];

  // Replace the existing allLoanTypeOptions array with this complete version:
  allLoanTypeOptions: LoanTypeOption[] = [
    { value: 'agency', displayName: 'Agency Loans' },
    { value: 'bridge', displayName: 'Bridge Loans' },
    { value: 'cmbs', displayName: 'CMBS Loans' },
    { value: 'commercial', displayName: 'Commercial Loans' },
    { value: 'construction', displayName: 'Construction Loans' },
    { value: 'hard_money', displayName: 'Hard Money Loans' },
    { value: 'mezzanine', displayName: 'Mezzanine Loan' },
    { value: 'rehab', displayName: 'Rehab Loans' },
    { value: 'non_qm', displayName: 'Non-QM Loans' },
    { value: 'sba', displayName: 'SBA Loans' },
    { value: 'usda', displayName: 'USDA Loans' },
    // Add these missing loan types:
    { value: 'acquisition', displayName: 'Acquisition Loan' },
    { value: 'balance_sheet', displayName: 'Balance Sheet' },
    { value: 'bridge_perm', displayName: 'Bridge to Permanent' },
    { value: 'dscr', displayName: 'DSCR' },
    { value: 'fix_flip', displayName: 'Fix & Flip' },
    { value: 'portfolio', displayName: 'Portfolio Loan' },
    { value: 'sba_express', displayName: 'SBA Express' },
    { value: 'sba_7a', displayName: 'SBA 7(a)' },
    { value: 'sba_504', displayName: 'SBA 504' }
  ];

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

          // Instead of calling loadLoanDetails, directly use loanService here
          this.isLoading.set(true);
          this.errorMessage.set(null);

          return this.loanService.getLoanById(id).pipe(
            tap((loan: Loan | null) => {
              if (loan) {
                console.log('LOAN DETAILS: Loan loaded:', loan);
                this.loan.set(loan);

                // If the loan has a userId field, load that user's data
                if ((loan as any).userId) {
                  this.loadLoanCreatorData((loan as any).userId);
                } else {
                  console.log('Loan has no userId field to load creator data');
                }


                // If the loan has an originatorId, load the originator details
                if (loan.originatorId) {
                  this.loadOriginatorDetails(loan.originatorId);
                } else {
                  console.log(
                    'Loan has no originatorId to load originator data'
                  );
                }
              } else {
                this.errorMessage.set('Loan not found.');
              }
            }),
            catchError((error) => {
              console.error('Error loading loan details:', error);
              this.errorMessage.set(
                'Failed to load loan details. Please try again.'
              );
              return of(null);
            }),
            tap(() => {
              this.isLoading.set(false);
            })
          );
        })
      )
      .subscribe();
  }

  async loadCurrentUserData(): Promise<void> {
    // Don't reload user data if we already have it from the loan's creator
    if (this.loan() && this.loan()?.userId && this.userData) {
      console.log('LOAN DETAILS: User data already loaded from loan creator');
      return;
    }

    console.log('LOAN DETAILS: Loading current user data');

    // Use the proven auth service method
    this.authService.getUserProfile().subscribe({
      next: (profile) => {
        if (profile) {
          console.log('Found current user profile:', profile);

          // Map using the same logic as navbar and creator data loading
          const user: User = {
            uid: profile.id,
            firstName: profile.contactInfo?.firstName || profile.firstName || '',
            lastName: profile.contactInfo?.lastName || profile.lastName || '',
            email: profile.contactInfo?.contactEmail || profile.email || '',
            company: profile.contactInfo?.company || profile.company || '',
            phone: profile.contactInfo?.contactPhone || profile.phone || '',
            city: profile.contactInfo?.city || profile.city || '',
            state: profile.contactInfo?.state || profile.state || '',
            role: profile.role || 'originator',
            createdAt: (profile.createdAt && (profile.createdAt as any).toDate)
              ? (profile.createdAt as any).toDate()
              : (profile.createdAt ? new Date(profile.createdAt) : new Date()),

          };

          this.userData = user;
          console.log('Current user data set successfully:', this.userData);
        } else {
          console.log('No profile found for current user');
        }
      },
      error: (error) => {
        console.error('Error loading current user data:', error);
      }
    });
  }

  // Find this method and replace it
  loadLoanCreatorData(creatorId: string): void {
    // below: loadLoanCreatorData(creatorId: string): void {
    if (!creatorId) {
      console.log('No creator ID available for this loan');
      return;
    }

    console.log('Loading loan creator (originator) data for ID:', creatorId);

    // Single source of truth: users/{uid}
    this.firestoreService
      .getDocument(`users/${creatorId}`)
      .pipe(take(1))
      .subscribe({
        next: (profile: any | null) => {
          if (!profile) {
            console.log('No profile found for creator ID:', creatorId);
            this.userData = null as any; // keeps your template’s *ngIf logic consistent
            return;
          }

          const user: User = {
            uid: profile.id || creatorId,
            firstName: profile.contactInfo?.firstName ?? profile.firstName ?? '',
            lastName: profile.contactInfo?.lastName ?? profile.lastName ?? '',
            email: profile.contactInfo?.contactEmail ?? profile.email ?? '',
            company: profile.contactInfo?.company ?? profile.company ?? '',
            phone: profile.contactInfo?.contactPhone ?? profile.phone ?? '',
            city: profile.contactInfo?.city ?? profile.city ?? '',
            state: profile.contactInfo?.state ?? profile.state ?? '',
            role: profile.role ?? 'originator',
            createdAt: profile.createdAt?.toDate ? profile.createdAt.toDate() : (profile.createdAt ?? new Date()),
          };

          this.userData = user;
          console.log('User data set successfully from creator profile:', this.userData);
        },
        error: (error) => {
          console.error('Error loading creator data:', error);
          this.userData = null as any;
        }
      });
  }


  loadOriginatorDetails(originatorId: string): void {
    // below: loadOriginatorDetails(originatorId: string): void {
    console.log('Loading originator details for ID:', originatorId);

    this.firestoreService
      .getDocument(`users/${originatorId}`)
      .pipe(take(1))
      .subscribe({
        next: (userData: any | null) => {
          if (!userData) {
            console.log('No originator details found');
            this.originatorDetails.set(null);
            return;
          }

          // Normalize to { id, contactInfo: {...} }
          const data = {
            id: userData.id || originatorId,
            contactInfo: {
              firstName: userData.contactInfo?.firstName ?? userData.firstName ?? '',
              lastName: userData.contactInfo?.lastName ?? userData.lastName ?? '',
              contactEmail: userData.contactInfo?.contactEmail ?? userData.email ?? '',
              contactPhone: userData.contactInfo?.contactPhone ?? userData.phone ?? '',
              company: userData.contactInfo?.company ?? userData.company ?? '',
              city: userData.contactInfo?.city ?? userData.city ?? '',
              state: userData.contactInfo?.state ?? userData.state ?? '',
            }
          };

          this.originatorDetails.set(data);

          // Also seed userData if it is still empty
          if (!this.userData) {
            const user: User = {
              uid: data.id,
              firstName: data.contactInfo.firstName,
              lastName: data.contactInfo.lastName,
              email: data.contactInfo.contactEmail,
              company: data.contactInfo.company,
              phone: data.contactInfo.contactPhone,
              city: data.contactInfo.city,
              state: data.contactInfo.state,
              role: 'originator',
              createdAt: new Date(),
            };
            this.userData = user;
            console.log('User signal set from originator details:', this.userData);
          }
        },
        error: (err) => {
          console.error('Error loading originator details:', err);
          this.originatorDetails.set(null);
        },
      });
  }

  formatPropertyCategory(category: string): string {
    const categoryOption = this.allPropertyCategoryOptions.find(opt => opt.value === category);
    return categoryOption ? categoryOption.displayName : category;
  }

  formatPropertySubcategory(subcategory: PropertySubcategoryValue): string {
    // Use the LoanUtils to safely extract the value
    return getPropertySubcategoryName(LoanUtils.getSubcategoryValue(subcategory));
  }

  // Add this method to your LoanDetailsComponent class
  getLoanTypeName(loanType: string | undefined): string {
    if (!loanType) return '';
    return this.loanTypeService.getLoanTypeName(loanType);
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
   * Retry loading the loan details
   */
  retryLoadLoan(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      // Reset loading states
      this.isLoading.set(true);
      this.errorMessage.set(null);

      // Use loanService directly instead of calling loadLoanDetails
      this.loanService
        .getLoanById(id)
        .pipe(
          tap((loan) => {
            if (loan) {
              console.log('LOAN DETAILS: Loan loaded:', loan);
              this.loan.set(loan);

              // If the loan has a userId field, load that user's data
              if ((loan as any).userId) {
                this.loadLoanCreatorData((loan as any).userId);
              } else {
                console.log('Loan has no userId field to load creator data');
              }


              // If the loan has an originatorId, load the originator details
              if (loan.originatorId) {
                this.loadOriginatorDetails(loan.originatorId);
              } else {
                console.log('Loan has no originatorId to load originator data');
              }
            } else {
              this.errorMessage.set('Loan not found.');
            }
          }),
          catchError((error) => {
            console.error('Error loading loan details:', error);
            this.errorMessage.set(
              'Failed to load loan details. Please try again.'
            );
            return of(null);
          }),
          tap(() => {
            this.isLoading.set(false);
          })
        )
        .subscribe();
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

  formatPhoneNumber(phone?: string): string {
    if (!phone) return '';

    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return phone;
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

  isLender(): boolean {
    return this.userData?.role === 'lender';
  }

  isOriginator(): boolean {
    return this.userData?.role === 'originator';
  }

  returnToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }



  /**
   * Navigate back to loans list
   */
  goBack(): void {
    this.router.navigate(['/loans']);
  }
}