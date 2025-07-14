import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LoanService } from '../services/loan.service';
import { AuthService } from '../services/auth.service';
import { switchMap, catchError, tap, map } from 'rxjs/operators';
import { of, Subscription } from 'rxjs';
import { Loan } from '../models/loan-model.model';
import {
  Firestore,
  collection,
  query,
  doc,
  getDoc,
  where,
  getDocs,
} from '@angular/fire/firestore';
import { User } from '../models/user.model';
import { LoanTypeService } from '../services/loan-type.service';
import { FirestoreService } from '../services/firestore.service';
import { getPropertySubcategoryName } from '../shared/constants/property-mappings';
import { LoanUtils, PropertySubcategoryValue } from '../models/loan-model.model';

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
  user = signal<User | null>(null);
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
            tap((loan) => {
              if (loan) {
                console.log('LOAN DETAILS: Loan loaded:', loan);
                this.loan.set(loan);

                // If the loan has a createdBy field, load that user's data
                if (loan.createdBy) {
                  this.loadLoanCreatorData(loan.createdBy);
                } else {
                  console.log(
                    'Loan has no createdBy field to load creator data'
                  );
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

  loadLoanCreatorData(creatorId: string): void {
    if (!creatorId) {
      console.log('No creator ID available for this loan');
      return;
    }

    console.log('Loading loan creator (originator) data for ID:', creatorId);

    // First check the 'users' collection which should have the originator
    const userDocRef = doc(this.firestore, 'users', creatorId);

    getDoc(userDocRef)
      .then((docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data();
          console.log('Found originator data in users collection:', userData);

          // Create a properly structured User object with type assertion
          const user: User = {
            uid: docSnap.id,
            firstName: userData['firstName'] || '',
            lastName: userData['lastName'] || '',
            email: userData['email'] || '',
            company:
              userData['company'] || userData['contactInfo']?.['company'] || '',
            phone: userData['phone'] || '',
            city: userData['city'] || '',
            state: userData['state'] || '',
            role: 'originator' as 'originator', // Type assertion
            createdAt: userData['createdAt']?.toDate() || new Date(),
          };

          this.user.set(user);
          console.log('Originator user data set to:', this.user());
        } else {
          // If not found in users, try the originators collection
          const originatorDocRef = doc(
            this.firestore,
            'originators',
            creatorId
          );
          getDoc(originatorDocRef).then((originatorSnap) => {
            if (originatorSnap.exists()) {
              const originatorData = originatorSnap.data();
              console.log(
                'Found originator in originators collection:',
                originatorData
              );

              // Standardize the data structure with proper typing
              const user: User = {
                uid: originatorSnap.id,
                firstName:
                  originatorData['contactInfo']?.['firstName'] ||
                  originatorData['firstName'] ||
                  '',
                lastName:
                  originatorData['contactInfo']?.['lastName'] ||
                  originatorData['lastName'] ||
                  '',
                email:
                  originatorData['contactInfo']?.['contactEmail'] ||
                  originatorData['email'] ||
                  '',
                company:
                  originatorData['contactInfo']?.['company'] ||
                  originatorData['company'] ||
                  '',
                phone:
                  originatorData['contactInfo']?.['contactPhone'] ||
                  originatorData['phone'] ||
                  '',
                city:
                  originatorData['contactInfo']?.['city'] ||
                  originatorData['city'] ||
                  '',
                state:
                  originatorData['contactInfo']?.['state'] ||
                  originatorData['state'] ||
                  '',
                role: 'originator' as 'originator', // Type assertion
                createdAt: originatorData['createdAt']?.toDate() || new Date(),
              };

              this.user.set(user);
              console.log(
                'Originator user data set from originators collection:',
                this.user()
              );
            } else {
              console.log('No originator found with ID:', creatorId);
            }
          });
        }
      })
      .catch((error) => {
        console.error('Error finding originator by ID:', error);
      });
  }

  loadOriginatorDetails(originatorId: string): void {
    console.log('Loading originator details for ID:', originatorId);

    // First try the originators collection (new structure)
    this.firestoreService
      .getDocument(`originators/${originatorId}`)
      .pipe(
        catchError((error) => {
          console.error('Error fetching from originators collection:', error);

          // Fallback to users collection if not found in originators collection
          return this.firestoreService
            .getDocument(`users/${originatorId}`)
            .pipe(
              map((userData) => {
                if (!userData) return null;

                console.log('Found user data in users collection:', userData);

                // Map the users collection data to the standard contact structure
                return {
                  id: userData.id,
                  contactInfo: {
                    firstName: userData['firstName'] || '',
                    lastName: userData['lastName'] || '',
                    contactEmail: userData['email'] || '', // Map email to contactEmail
                    contactPhone: userData['phone'] || '',
                    company: userData['company'] || '',
                    city: userData['city'] || '',
                    state: userData['state'] || '',
                  },
                };
              })
            );
        })
      )
      .subscribe({
        next: (data) => {
          if (data) {
            console.log('Originator details loaded:', data);
            this.originatorDetails.set(data);

            // ADDITION: Also set the user data if not already set
            // This ensures both signals have the data
            if (!this.user()) {
              const user: User = {
                uid: data.id,
                firstName: data.contactInfo?.firstName || '',
                lastName: data.contactInfo?.lastName || '',
                email: data.contactInfo?.contactEmail || '',
                company: data.contactInfo?.company || '',
                phone: data.contactInfo?.contactPhone || '',
                city: data.contactInfo?.city || '',
                state: data.contactInfo?.state || '',
                role: 'originator' as 'originator',
                createdAt: new Date(),
              };
              this.user.set(user);
              console.log(
                'User signal set from originator details:',
                this.user()
              );
            }
          } else {
            console.log('No originator details found');
            this.originatorDetails.set(null);
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

async loadCurrentUserData(): Promise<void> {
  // Don't reload user data if we already have it from the loan's creator
  if (this.loan() && this.loan()?.createdBy && this.user()) {
    console.log('LOAN DETAILS: User data already loaded from loan creator');
    return;
  }

  console.log('LOAN DETAILS: Loading current user data');

  try {
    const currentUser = await this.authService.getCurrentFirebaseUser();

    if (currentUser && currentUser.email) {
      console.log('LOAN DETAILS: Current user email:', currentUser.email);

      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, where('email', '==', currentUser.email));

      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const userDoc = snapshot.docs[0];
        const userData = userDoc.data() as User;
        userData.uid = userDoc.id;

        console.log('LOAN DETAILS: Found user data:', userData);
        this.user.set(userData);
      } else {
        console.log('LOAN DETAILS: No user found with current user email');
      }
    }
  } catch (error) {
    console.error('LOAN DETAILS: Error finding user by email:', error);
  }
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

              // If the loan has a createdBy field, load that user's data
              if (loan.createdBy) {
                this.loadLoanCreatorData(loan.createdBy);
              } else {
                console.log('Loan has no createdBy field to load creator data');
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
  return this.user()?.role === 'lender';
}

isOriginator(): boolean {
  return this.user()?.role === 'originator';
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