import {
  Component,
  OnInit,
  inject,
  DestroyRef,
  Injector,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LenderService } from '../../services/lender.service';
import { User as FirebaseUser } from '@angular/fire/auth';
import { take } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  deleteDoc,
  DocumentData,
  DocumentSnapshot,
  Timestamp,
} from '@angular/fire/firestore';
import { UserData } from '../../models/user-data.model';
// Import the Lender interface from the service instead of the model file
import { Lender } from '../../services/lender.service';

// Interface for loan data
interface Loan {
  id?: string;
  propertyTypeCategory: string;
  propertySubCategory: string;
  transactionType: string;
  loanAmount: string;
  loanType: string;
  propertyValue: string;
  ltv: number;
  noi?: string;
  city: string;
  state: string;
  numberOfSponsors: number;
  sponsorsLiquidity: string;
  sponsorFico: number;
  experienceInYears: number;
  contact: string;
  phone: string;
  email: string;
  notes?: string;
  createdBy?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Interface for saved loan data
interface SavedLoan {
  id: string; // Ensure this is required, not optional
  loanId: string;
  loanData: Loan;
  savedBy: string;
  savedAt: Timestamp;
}

@Component({
  selector: 'app-lender-dashboard',
  templateUrl: './lender-dashboard.component.html',
  styleUrls: ['./lender-dashboard.component.css'],
  standalone: true,
  imports: [CommonModule],
})
export class LenderDashboardComponent implements OnInit {
  // Injected services using dependency injection
  private authService = inject(AuthService);
  private router = inject(Router);
  private lenderService = inject(LenderService);
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);
  private firestore = inject(Firestore);

  // User state with proper typing
  firebaseUser = signal<FirebaseUser | null>(null);
  userData = signal<UserData | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  accountNumber = signal<string>('');

  // Lender-specific data with proper typing
  lenderData = signal<Lender | null>(null);

  // Signals for lender's saved loans
  savedLoans = signal<SavedLoan[]>([]);
  savedLoansLoading = signal(true);
  savedLoansError = signal<string | null>(null);

  // Property colors for visualization
  propertyColorMap: Record<string, string> = {
    Commercial: '#1E90FF',
    Healthcare: '#cb4335',
    Hospitality: '#1b4f72',
    Industrial: '#2c3e50',
    Land: '#023020',
    'Mixed Use': '#8A2BE2',
    'Multi-family': '#6c3483',
    Office: '#4682B4',
    Residential: '#DC143C',
    Retail: '#660000',
    'Special Purpose': '#6e2c00',
  };

  /**
   * Initialize the lender dashboard component
   */
  ngOnInit(): void {
    console.log('Lender Dashboard component initializing...');
    this.loadUserData();
  }

  /**
   * Load lender data from LenderService
   */
  loadLenderData(lenderId: string): void {
    console.log(`Loading lender data for ID: ${lenderId}`);

    // Use the lender service to fetch lender data
    this.lenderService
      .getLender(lenderId)
      .pipe(take(1))
      .subscribe({
        next: (lenderData) => {
          console.log('Lender data loaded from service:', lenderData);
          if (lenderData) {
            // Make sure id is not undefined by using lenderId as fallback
            const lenderWithId: Lender = {
              ...lenderData,
              id: lenderData.id ?? lenderId,
            };
            this.lenderData.set(lenderWithId);
          } else {
            this.fetchLenderDataDirectly(lenderId);
          }
        },
        error: (error) => {
          console.error('Error loading lender data from service:', error);
          this.fetchLenderDataDirectly(lenderId);
        },
      });
  }

  /**
   * Fallback method to fetch lender data directly from Firestore
   */
  private async fetchLenderDataDirectly(lenderId: string): Promise<void> {
    try {
      // Try to get the lender document directly
      const lenderDocRef = doc(this.firestore, `lenders/${lenderId}`);
      const docSnap = await runInInjectionContext(this.injector, () =>
        getDoc(lenderDocRef)
      );

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (!data) {
          console.error('Lender document exists but has no data');
          this.error.set(
            'Lender profile incomplete. Please update your profile.'
          );
          return;
        }

        console.log('Lender data loaded directly from Firestore:', data);

        // Create a minimal Lender object from document data ensuring id is always defined
        const lenderData: Lender = {
          id: docSnap.id, // This will always be defined as it comes from the docSnap.id
          name: data['name'] || '',
          lenderType: data['lenderType'] || '',
          // Add other required properties with defaults
          propertyCategories: data['propertyCategories'] || [],
          states: data['states'] || [],
          productInfo: data['productInfo'] || {},
          contactInfo: data['contactInfo'] || {},
          footprintInfo: data['footprintInfo'] || { lendingFootprint: [] },
        };

        this.lenderData.set(lenderData);
        return;
      }

      console.error('Lender document not found in lenders collection');
      // Try one more fallback - check if this user is in the users collection with role='lender'
      await this.checkUserAsLender(lenderId);
    } catch (err) {
      console.error('Error loading lender document directly:', err);
      this.error.set('Failed to load lender information');
    }
  }

  /**
   * Check if user exists in users collection with role='lender'
   */
  private async checkUserAsLender(userId: string): Promise<void> {
    try {
      const userDocRef = doc(this.firestore, `users/${userId}`);
      const userDocSnap = await runInInjectionContext(this.injector, () =>
        getDoc(userDocRef)
      );

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        if (userData && userData['role'] === 'lender') {
          console.log('Found lender data in users collection:', userData);

          // Create a basic lender profile from user data ensuring id is non-optional
          const lenderData: Lender = {
            id: userDocSnap.id, // This comes from the document ID so it's always defined
            name: `${userData['firstName'] || ''} ${
              userData['lastName'] || ''
            }`.trim(),
            lenderType: userData['lenderType'] || '',
            propertyCategories: userData['propertyCategories'] || [],
            states: userData['states'] || [],
            productInfo: {
              minLoanAmount: userData['minLoanAmount'] || 0,
              maxLoanAmount: userData['maxLoanAmount'] || 0,
              lenderTypes: [userData['lenderType'] || ''].filter(
                (lt) => lt !== ''
              ),
              propertyCategories: userData['propertyCategories'] || [],
              propertyTypes: userData['propertyTypes'] || [],
            },
            contactInfo: {
              firstName: userData['firstName'] || '',
              lastName: userData['lastName'] || '',
              contactPhone: userData['phone'] || '',
              contactEmail: userData['email'] || '',
              city: userData['city'] || '',
              state: userData['state'] || '',
            },
            footprintInfo: {
              lendingFootprint: userData['lendingFootprint'] || [],
            },
          };

          this.lenderData.set(lenderData);
          return;
        }
      }

      console.error('No lender information found for this user');
      this.error.set(
        'Lender profile not found. Please complete your lender registration.'
      );
    } catch (err) {
      console.error('Error checking user as lender:', err);
      this.error.set('Failed to load user information');
    }
  }

  /**
   * Load user data from Firebase Authentication and Firestore
   */
  loadUserData(): void {
    console.log('Loading user data...');
    this.loading.set(true);
    this.error.set(null);

    try {
      // Get the current authenticated user
      this.authService
        .getCurrentUser()
        .pipe(take(1))
        .subscribe({
          next: async (userData) => {
            if (!userData) {
              console.log('No user logged in');
              this.error.set('Not logged in');
              this.loading.set(false);
              this.router.navigate(['/login']);
              return;
            }

            console.log('Authenticated user:', userData.email);
            this.userData.set(userData);

            // Also get the Firebase user for auth operations
            this.authService
              .getFirebaseUser()
              .pipe(take(1))
              .subscribe({
                next: (fbUser) => {
                  this.firebaseUser.set(fbUser);
                  if (fbUser) {
                    this.accountNumber.set(
                      this.authService.getShortUid(fbUser.uid)
                    );
                  }
                },
              });

            // Check if this user is a lender
            if (userData.role === 'lender') {
              // If user has a lenderId, load lender data
              if (userData.lenderId) {
                this.loadLenderData(userData.lenderId);
              } else {
                // Try using user's ID as lenderId
                this.loadLenderData(userData.id);
              }

              // Load saved loans
              this.loadSavedLoans(userData.id);
            } else {
              // This user is not a lender, redirect to the appropriate dashboard
              console.log(
                'User is not a lender, redirecting to user dashboard'
              );
              this.router.navigate(['/dashboard']);
            }

            this.loading.set(false);
          },
          error: (error) => {
            console.error('Error getting current user:', error);
            this.error.set('Authentication error');
            this.loading.set(false);
          },
        });
    } catch (error) {
      console.error('Error in loadUserData:', error);
      this.error.set(
        'Error fetching data: ' +
          (error instanceof Error ? error.message : String(error))
      );
      this.loading.set(false);
    }
  }

  /**
   * Load saved loans for the lender
   */
  async loadSavedLoans(userId: string): Promise<void> {
    console.log('Loading saved loans for lender:', userId);
    this.savedLoansLoading.set(true);
    this.savedLoansError.set(null);

    try {
      const savedLoansCollectionRef = collection(this.firestore, 'savedLoans');
      const q = query(
        savedLoansCollectionRef,
        where('savedBy', '==', userId),
        orderBy('savedAt', 'desc')
      );

      const querySnapshot = await runInInjectionContext(this.injector, () =>
        getDocs(q)
      );

      const userSavedLoans: SavedLoan[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        userSavedLoans.push({
          id: doc.id,
          loanId: data['loanId'],
          loanData: data['loanData'],
          savedBy: data['savedBy'],
          savedAt: data['savedAt'],
        } as SavedLoan);
      });

      console.log(
        `Found ${userSavedLoans.length} saved loans for user ${userId}`
      );
      this.savedLoans.set(userSavedLoans);
    } catch (error) {
      console.error('Error loading saved loans:', error);
      this.savedLoansError.set(
        'Failed to load your saved loans. Please try again.'
      );
    } finally {
      this.savedLoansLoading.set(false);
    }
  }

  /**
   * Remove a saved loan from the lender's saved list
   */
  async removeSavedLoan(savedLoanId: string): Promise<void> {
    if (
      confirm('Are you sure you want to remove this from your saved loans?')
    ) {
      try {
        const savedLoanDocRef = doc(
          this.firestore,
          `savedLoans/${savedLoanId}`
        );
        await runInInjectionContext(this.injector, () =>
          deleteDoc(savedLoanDocRef)
        );

        // Update the savedLoans signal
        const currentSavedLoans = this.savedLoans();
        this.savedLoans.set(
          currentSavedLoans.filter((loan) => loan.id !== savedLoanId)
        );

        alert('Loan removed from saved list');
      } catch (error) {
        console.error('Error removing saved loan:', error);
        alert(
          'Failed to remove loan: ' +
            (error instanceof Error ? error.message : String(error))
        );
      }
    }
  }

  /**
   * Contact the loan originator via email
   */
  contactOriginator(loan: Loan): void {
    if (loan.email) {
      window.location.href = `mailto:${loan.email}?subject=Interest in your loan listing&body=I am interested in learning more about your loan listing for ${loan.propertyTypeCategory} in ${loan.city}, ${loan.state}.`;
    } else {
      alert('Contact information is not available for this loan.');
    }
  }

  /**
   * Format phone number to (XXX) XXX-XXXX
   */
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
  formatCurrency(value: string | number | undefined): string {
    if (!value) return '$0';

    if (typeof value === 'string' && value.includes('$')) {
      return value;
    }

    const numValue =
      typeof value === 'string'
        ? parseFloat(value.replace(/[^\d.-]/g, ''))
        : value;

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numValue);
  }

  /**
   * Format date values from Firestore Timestamp or Date
   */
  getFormattedDate(date: Timestamp | Date | unknown): string {
    if (!date) return 'N/A';

    try {
      let timestamp: Date;

      if (date instanceof Timestamp) {
        timestamp = date.toDate();
      } else if (date instanceof Date) {
        timestamp = date;
      } else if (
        typeof date === 'object' &&
        date !== null &&
        'toDate' in date &&
        typeof date.toDate === 'function'
      ) {
        // Handle Firestore Timestamp-like objects
        timestamp = (date as { toDate: () => Date }).toDate();
      } else {
        // Try to parse as a date string
        timestamp = new Date(String(date));
      }

      return timestamp.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'N/A';
    }
  }

  /**
   * Get color for property type
   */
  getColor(propertyType: string): string {
    return this.propertyColorMap[propertyType] || '#000000';
  }

  /**
   * Navigate to loan details page
   */
  viewLoanDetails(loanId: string): void {
    this.router.navigate(['/loans', loanId]);
  }

  /**
   * Navigate to account edit page
   */
  editAccount(): void {
    this.router.navigate(['/account/edit']);
  }

  /**
   * Navigate to lender profile edit page
   */
  editLenderProfile(): void {
    this.router.navigate(['/lender-profile/edit']);
  }

  /**
   * Delete user account from Firebase
   */
  async deleteAccount(): Promise<void> {
    if (
      confirm(
        'Are you sure you want to delete your account? This action cannot be undone.'
      )
    ) {
      try {
        const userData = this.userData();
        if (!userData) {
          throw new Error('User account information not available');
        }

        // Delete user document from Firestore
        const userDocRef = doc(this.firestore, `users/${userData.id}`);
        await runInInjectionContext(this.injector, () => deleteDoc(userDocRef));

        // Delete lender document if it exists
        if (userData.lenderId) {
          const lenderDocRef = doc(
            this.firestore,
            `lenders/${userData.lenderId}`
          );
          try {
            await runInInjectionContext(this.injector, () =>
              deleteDoc(lenderDocRef)
            );
            console.log('Deleted lender document');
          } catch (err) {
            console.warn('Failed to delete lender document:', err);
            // Non-fatal error, continue with logout
          }
        }

        // Log out the user
        this.authService
          .logout()
          .pipe(take(1))
          .subscribe({
            next: () => {
              alert('Your account has been deleted successfully');
              this.router.navigate(['/login']);
            },
            error: (error) => {
              console.error(
                'Error during logout after account deletion:',
                error
              );
              throw error;
            },
          });
      } catch (error) {
        console.error('Error deleting account:', error);
        alert(
          'Failed to delete account: ' +
            (error instanceof Error ? error.message : String(error))
        );
        return Promise.reject(error);
      }
    }
    return Promise.resolve();
  }

  /**
   * Log out the current user
   */
  logout(): void {
    console.log('Logging out...');
    this.loading.set(true);

    this.authService
      .logout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          console.log('Logout successful');
          this.router.navigate(['/login']);
        },
        error: (error) => {
          console.error('Error during logout:', error);
          this.error.set('Error during logout');
          this.loading.set(false);
        },
      });
  }
}
