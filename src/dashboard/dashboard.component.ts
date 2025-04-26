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
import { AuthService } from '../services/auth.service';
import { LenderService } from '../services/lender.service';
import { User } from '@angular/fire/auth';
import { take } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  addDoc,
} from '@angular/fire/firestore';
import { LOAN_TYPES } from '../shared/loan-constants';
import { LoanService } from '../services/loan.service';

// Define interfaces
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
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  standalone: true,
  imports: [CommonModule],
})
export class DashboardComponent implements OnInit {
  // Injected services
  private authService = inject(AuthService);
  private router = inject(Router);
  private lenderService = inject(LenderService);
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);
  private firestore = inject(Firestore);
  private loanService = inject(LoanService);

  // User state
  user: User | null = null;
  userData: UserData | null = null;
  userRole: 'originator' | 'lender' | null = null;
  loading = true;
  error: string | null = null;
  accountNumber: string = '';

  // Lender-specific data
  lenderData: any | null = null;

  // Signals for user's published loans
  loans = signal<Loan[]>([]);
  loansLoading = signal(true);
  loansError = signal<string | null>(null);

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
    'Residential Property': '#DC143C',
    Retail: '#660000',
    'Special Purpose': '#6e2c00',
  };

  loanTypes = LOAN_TYPES;
  /**
   * Initialize the dashboard component
   */
  getLoanTypeName(value: string): string {
    if (!value) return '';
    const loanType = this.loanTypes.find(
      (type) => type.value.toLowerCase() === value.toLowerCase()
    );
    return loanType ? loanType.name : value;
  }

  ngOnInit(): void {
    console.log('Dashboard component initializing...');
    this.loadUserData();
  }

  loadLenderData(lenderId: string): void {
    console.log(`Loading lender data for ID: ${lenderId}`);

    // First try using the lender service
    this.lenderService.getLender(lenderId).subscribe(
      (lenderData) => {
        console.log('Lender data loaded:', lenderData);
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
            } else {
              console.error('Lender document not found in lenders collection');
              this.error = 'Failed to load lender information';
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
            this.user = user;
            this.accountNumber = user.uid.substring(0, 8);

            this.accountNumber = this.authService.getShortUid(user.uid);

            const userDocRef = doc(this.firestore, `users/${user.uid}`);

            console.log('Authenticated user:', user.email);
            this.user = user;
            this.accountNumber = user.uid.substring(0, 8);

            // Get user profile from Firestore
            try {
              const userDocRef = doc(this.firestore, `users/${user.uid}`);
              const userDocSnap = await runInInjectionContext(
                this.injector,
                () => getDoc(userDocRef)
              );

              if (userDocSnap.exists()) {
                // Found user document
                const userData = {
                  id: userDocSnap.id,
                  ...userDocSnap.data(),
                } as UserData;

                this.userData = userData;
                this.userRole = userData.role || null;

                console.log(`User role: ${userData.role}`);

                // If lender, load lender data
                if (userData.role === 'lender' && userData.lenderId) {
                  this.loadLenderData(userData.lenderId);

                  // Load saved loans for lenders
                  this.loadSavedLoans(user.uid);
                }

                // Load published loans (for originators primarily)
                this.loadLoans(user.uid);
              } else {
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
                  console.log('Lender document data:', lenderDocSnap.data());
                  const userData = {
                    id: lenderDocSnap.id,
                    ...lenderDocSnap.data(),
                    role: 'lender', // Explicitly set role
                  } as UserData;

                  this.userData = userData;
                  this.userRole = 'lender';

                  console.log(`Found user in lenders collection`);
                  console.error(`No user document found for ID: ${user.uid}`);
                  this.error = 'User profile not found';

                  this.loadLenderData(user.uid);
                  this.loadSavedLoans(user.uid);
                } else {
                  console.error(
                    `No user document found in any collection for ID: ${user.uid}`
                  );
                  this.error = 'User profile not found';

                  await this.createDefaultUserProfile(user);
                }
              }
            } catch (error) {
              console.error('Error fetching user document:', error);
              this.error = 'Error loading user profile';
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
   * Create default user profile if none exists
   */
  async createDefaultUserProfile(user: User): Promise<void> {
    try {
      const defaultUserData: Partial<UserData> = {
        email: user.email || '',
        firstName: '',
        lastName: '',
        company: '',
        createdAt: new Date(),
        role: null, // User will need to select role
      };

      // Set the data in component state
      this.userData = { id: user.uid, ...defaultUserData } as UserData;
      console.log('Created default user profile');
    } catch (error) {
      console.error('Error creating default user profile:', error);
      this.error = 'Failed to create user profile';
    }
  }

  /**
   * Load loans created by the user (primarily for originators)
   */
  async loadLoans(userId: string): Promise<void> {
    console.log('Loading loans for user:', userId);
    this.loansLoading.set(true);
    this.loansError.set(null);

    try {
      const loansCollectionRef = collection(this.firestore, 'loans');
      const q = query(
        loansCollectionRef,
        where('createdBy', '==', userId),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await runInInjectionContext(this.injector, () =>
        getDocs(q)
      );

      const userLoans: Loan[] = [];
      querySnapshot.forEach((doc) => {
        userLoans.push({
          id: doc.id,
          ...doc.data(),
        } as Loan);
      });

      console.log(`Found ${userLoans.length} loans for user ${userId}`);
      this.loans.set(userLoans);
    } catch (error) {
      console.error('Error loading loans:', error);
      this.loansError.set('Failed to load your loans. Please try again.');
    } finally {
      this.loansLoading.set(false);
    }
  }

  /**
   * Load saved loans for lenders
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
        console.log('Saved loan data:', userSavedLoans);
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
   * Select user role if not already set
   */
  selectRole(role: 'lender' | 'originator'): void {
    this.loading = true;

    this.authService.updateUserRole(role).subscribe({
      next: () => {
        this.userRole = role;
        this.loading = false;

        // Redirect to appropriate registration form
        if (role === 'lender') {
          this.router.navigate(['/lender-registration']);
        } else {
          this.router.navigate(['/user-form']);
        }
      },
      error: (error) => {
        console.error('Error updating user role:', error);
        this.error = 'Failed to update role';
        this.loading = false;
      },
    });
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
   * Method to save a loan (for All Loans page)
   */
  async saveLoan(loan: Loan): Promise<void> {
    if (!this.user) {
      alert('Please log in to save loans');
      this.router.navigate(['/login']);
      return;
    }

    if (this.userRole !== 'lender') {
      alert('Only lenders can save loans');
      return;
    }

    try {
      // Check if already saved
      const savedLoansCollectionRef = collection(this.firestore, 'savedLoans');
      const q = query(
        savedLoansCollectionRef,
        where('loanId', '==', loan.id),
        where('savedBy', '==', this.user.uid)
      );

      const querySnapshot = await runInInjectionContext(this.injector, () =>
        getDocs(q)
      );

      if (!querySnapshot.empty) {
        alert('You have already saved this loan');
        return;
      }

      // Save the loan
      const savedLoanData = {
        loanId: loan.id,
        loanData: loan,
        savedBy: this.user.uid,
        savedAt: new Date(),
      };

      await runInInjectionContext(this.injector, () =>
        addDoc(savedLoansCollectionRef, savedLoanData)
      );

      alert('Loan saved successfully');

      // Refresh saved loans
      this.loadSavedLoans(this.user.uid);
    } catch (error) {
      console.error('Error saving loan:', error);
      alert(
        'Failed to save loan: ' +
          (error instanceof Error ? error.message : String(error))
      );
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

  isLender(): boolean {
    return this.userRole === 'lender';
  }

  isOriginator(): boolean {
    return this.userRole === 'originator';
  }

  // Navigation and action methods
  viewLoanDetails(loanId: string): void {
    this.router.navigate(['/loans', loanId]);
  }

  editLoan(loanId: string): void {
    this.router.navigate(['/loans', loanId, 'edit']);
  }

  createNewLoan(): void {
    this.router.navigate(['/loan']);
  }

  editAccount(): void {
    this.router.navigate(['/account/edit']);
  }

  editLenderProfile(): void {
    // Navigate to lender profile edit page
    this.router.navigate(['/lender-profile/edit']);
  }

  async deleteLoan(loanId: string): Promise<void> {
    if (confirm('Are you sure you want to delete this loan?')) {
      try {
        const loanDocRef = doc(this.firestore, `loans/${loanId}`);
        await runInInjectionContext(this.injector, () => deleteDoc(loanDocRef));

        // Update the loans signal
        const currentLoans = this.loans();
        this.loans.set(currentLoans.filter((loan) => loan.id !== loanId));

        alert('Loan deleted successfully');
      } catch (error) {
        console.error('Error deleting loan:', error);
        alert(
          'Failed to delete loan: ' +
            (error instanceof Error ? error.message : String(error))
        );
      }
    }
  }

  async deleteAccount(): Promise<void> {
    if (
      confirm(
        'Are you sure you want to delete your account? This action cannot be undone.'
      )
    ) {
      try {
        if (this.user && this.userData) {
          // Delete user document from Firestore
          const userDocRef = doc(this.firestore, `users/${this.userData.id}`);
          await runInInjectionContext(this.injector, () =>
            deleteDoc(userDocRef)
          );

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
        } else {
          throw new Error('User account information not available');
        }
      } catch (error) {
        console.error('Error deleting account:', error);
        alert(
          'Failed to delete account: ' +
            (error instanceof Error ? error.message : String(error))
        );
      }
    }
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
