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
import { User } from '@angular/fire/auth';
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
} from '@angular/fire/firestore';

// Define interfaces - reuse from your existing component
interface UserData {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  phone?: string;
  city?: string;
  state?: string;
  role?: 'originator' | 'lender' | null;
  createdAt?: any;
  accountNumber?: string;
  lenderId?: string;
  [key: string]: any;
}

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
  createdAt?: any;
  updatedAt?: any;
}

interface SavedLoan {
  id?: string;
  loanId: string;
  loanData: Loan;
  savedBy: string;
  savedAt: any;
}

@Component({
  selector: 'app-lender-dashboard',
  templateUrl: './lender-dashboard.component.html',
  styleUrls: ['./lender-dashboard.component.css'],
  standalone: true,
  imports: [CommonModule],
})
export class LenderDashboardComponent implements OnInit {
  // Injected services
  private authService = inject(AuthService);
  private router = inject(Router);
  private lenderService = inject(LenderService);
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);
  private firestore = inject(Firestore);

  // User state
  user: User | null = null;
  userData: UserData | null = null;
  loading = true;
  error: string | null = null;
  accountNumber: string = '';

  // Lender-specific data
  lenderData: any | null = null;

  // Signals for lender's saved loans
  savedLoans = signal<SavedLoan[]>([]);
  savedLoansLoading = signal(true);
  savedLoansError = signal<string | null>(null);

  // Property colors for visualization
  propertyColorMap: { [key: string]: string } = {
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
   * Load lender data from Firebase
   */
  /**
   * Load lender data from Firebase
   */
  loadLenderData(lenderId: string): void {
    console.log(`Loading lender data for ID: ${lenderId}`);

    // First try using the lender service
    this.lenderService.getLender(lenderId).subscribe(
      (lenderData) => {
        console.log('Lender data loaded from service:', lenderData);
        this.lenderData = lenderData;
      },
      (error) => {
        console.error('Error loading lender data from service:', error);

        // Fallback: Try to get the lender document directly
        const lenderDocRef = doc(this.firestore, `lenders/${lenderId}`);
        runInInjectionContext(this.injector, () => getDoc(lenderDocRef))
          .then((docSnap) => {
            if (docSnap.exists()) {
              console.log(
                'Lender data loaded directly from Firestore:',
                docSnap.data()
              );
              this.lenderData = docSnap.data();
              return;
            } else {
              console.error('Lender document not found in lenders collection');

              // Try one more fallback - check if this user is in the users collection with role='lender'
              const userDocRef = doc(this.firestore, `users/${lenderId}`);
              return runInInjectionContext(this.injector, () =>
                getDoc(userDocRef)
              ).then((userDocSnap) => {
                if (
                  userDocSnap.exists() &&
                  userDocSnap.data()['role'] === 'lender'
                ) {
                  console.log(
                    'Found lender data in users collection:',
                    userDocSnap.data()
                  );

                  // Create a basic lender profile from user data
                  this.lenderData = {
                    id: userDocSnap.id,
                    productInfo: userDocSnap.data()['lenderProductInfo'] || {
                      minLoanAmount: '0',
                      maxLoanAmount: '0',
                    },
                    contactInfo: {
                      firstName: userDocSnap.data()['firstName'] || '',
                      lastName: userDocSnap.data()['lastName'] || '',
                      contactEmail: userDocSnap.data()['email'] || '',
                      contactPhone: userDocSnap.data()['phone'] || '',
                      city: userDocSnap.data()['city'] || '',
                      state: userDocSnap.data()['state'] || '',
                    },
                  };
                } else {
                  console.error('No lender information found for this user');
                  this.error =
                    'Lender profile not found. Please complete your lender registration.';
                }
              });
            }
          })
          .catch((err) => {
            console.error('Error loading lender document directly:', err);
            this.error = 'Failed to load lender information';
          });
      }
    );
  }

  loadUserData(): void {
    console.log('Loading user data...');
    this.loading = true;
    this.error = null;

    try {
      // Get the current authenticated user
      this.authService
        .getCurrentUser()
        .pipe(take(1))
        .subscribe(
          async (user) => {
            if (!user) {
              console.log('No user logged in');
              this.error = 'Not logged in';
              this.loading = false;
              this.router.navigate(['/login']);
              return;
            }

            this.user = user;
            console.log('Authenticated user:', user.email);
            this.accountNumber = this.authService.getShortUid(user.uid);

            // Get user profile from Firestore
            try {
              // First check the users collection
              const userDocRef = doc(this.firestore, `users/${user.uid}`);
              const userDocSnap = await runInInjectionContext(
                this.injector,
                () => getDoc(userDocRef)
              );

              if (userDocSnap.exists()) {
                // Found user document in users collection
                const userData = {
                  id: userDocSnap.id,
                  ...userDocSnap.data(),
                } as UserData;

                this.userData = userData;

                // Check if this user is a lender
                if (userData.role === 'lender') {
                  // If user has a lenderId, load lender data
                  if (userData.lenderId) {
                    this.loadLenderData(userData.lenderId);
                  } else {
                    // Try using user's ID as lenderId
                    this.loadLenderData(user.uid);
                  }

                  // Load saved loans
                  this.loadSavedLoans(user.uid);
                } else {
                  // This user is not a lender, redirect to the appropriate dashboard
                  console.log(
                    'User is not a lender, redirecting to user dashboard'
                  );
                  this.router.navigate(['/dashboard']);
                  return;
                }
              } else {
                // User not found in users collection, check lenders collection
                console.log(
                  'Checking for user in lenders collection at path:',
                  `lenders/${user.uid}`
                );

                const lenderDocRef = doc(this.firestore, `lenders/${user.uid}`);
                const lenderDocSnap = await runInInjectionContext(
                  this.injector,
                  () => getDoc(lenderDocRef)
                );

                console.log('Lender document exists:', lenderDocSnap.exists());

                if (lenderDocSnap.exists()) {
                  // Found user in lenders collection
                  console.log(
                    'Lender document data found:',
                    lenderDocSnap.data()
                  );
                  const lenderData = lenderDocSnap.data();

                  // Create user data from lender document
                  const userData = {
                    id: lenderDocSnap.id,
                    firstName: lenderData['contactInfo']?.firstName || '',
                    lastName: lenderData['contactInfo']?.lastName || '',
                    email:
                      lenderData['contactInfo']?.contactEmail ||
                      user.email ||
                      '',
                    company: lenderData['contactInfo']?.company || '',
                    phone: lenderData['contactInfo']?.contactPhone || '',
                    city: lenderData['contactInfo']?.city || '',
                    state: lenderData['contactInfo']?.state || '',
                    role: 'lender', // Explicitly set role
                    lenderId: user.uid, // Use user ID as lenderId
                  } as UserData;

                  this.userData = userData;

                  // Set lender data
                  this.lenderData = lenderData;

                  // Load saved loans for this lender
                  this.loadSavedLoans(user.uid);

                  // Create a proper user record in the users collection for future use
                  try {
                    // Using runInInjectionContext to run Firestore operations
                    const userDocRef = doc(this.firestore, `users/${user.uid}`);
                    await runInInjectionContext(this.injector, () =>
                      setDoc(userDocRef, userData)
                    );
                    console.log('Created user record from lender data');
                  } catch (err) {
                    console.warn(
                      'Failed to create user record from lender data:',
                      err
                    );
                    // Non-fatal error, continue
                  }
                } else {
                  // User not found in either collection
                  console.error(
                    `No user document found in any collection for ID: ${user.uid}`
                  );
                  this.error =
                    'User profile not found. Please complete your registration.';

                  // Redirect to registration or dashboard based on your app flow
                  this.router.navigate(['/dashboard']);
                }
              }
            } catch (error) {
              console.error('Error fetching user document:', error);
              this.error = 'Error loading user profile';
              this.loading = false;
            }

            this.loading = false;
          },
          (error) => {
            console.error('Error getting current user:', error);
            this.error = 'Authentication error';
            this.loading = false;
          }
        );
    } catch (error) {
      console.error('Error in loadUserData:', error);
      this.error =
        'Error fetching data: ' +
        (error instanceof Error ? error.message : String(error));
      this.loading = false;
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
        userSavedLoans.push({
          id: doc.id,
          ...doc.data(),
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
   * Contact the loan originator
   */
  contactOriginator(loan: Loan): void {
    if (loan.email) {
      window.location.href = `mailto:${loan.email}?subject=Interest in your loan listing&body=I am interested in learning more about your loan listing for ${loan.propertyTypeCategory} in ${loan.city}, ${loan.state}.`;
    } else {
      alert('Contact information is not available for this loan.');
    }
  }

  // Utility methods
  formatPhoneNumber(phone?: string): string {
    if (!phone) return '';

    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return phone;
  }

  formatCurrency(value: string | number): string {
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

  getFormattedDate(date: any): string {
    if (!date) return 'N/A';

    try {
      const timestamp = date.toDate ? date.toDate() : new Date(date);
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

  getColor(propertyType: string): string {
    return this.propertyColorMap[propertyType] || '#000000';
  }

  // Navigation and action methods
  viewLoanDetails(loanId: string): void {
    this.router.navigate(['/loans', loanId]);
  }

  editAccount(): void {
    this.router.navigate(['/account/edit']);
  }

  editLenderProfile(): void {
    this.router.navigate(['/lender-profile/edit']);
  }

  deleteAccount(): Promise<void> {
    if (
      confirm(
        'Are you sure you want to delete your account? This action cannot be undone.'
      )
    ) {
      try {
        if (this.user && this.userData) {
          // Delete user document from Firestore
          const userDocRef = doc(this.firestore, `users/${this.userData.id}`);
          return runInInjectionContext(this.injector, () =>
            deleteDoc(userDocRef)
          ).then(() => {
            // Log out the user
            this.authService.logout().subscribe({
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
          });
        } else {
          throw new Error('User account information not available');
        }
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

  logout(): void {
    console.log('Logging out...');
    this.loading = true;

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
          this.error = 'Error during logout';
          this.loading = false;
        },
      });
  }
}
