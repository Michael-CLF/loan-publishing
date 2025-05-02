// src/app/dashboard/dashboard.component.ts
import { Component, OnInit, inject, DestroyRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { User as FirebaseUser } from '@angular/fire/auth';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  addDoc,
} from '@angular/fire/firestore';

// Services
import { AuthService } from '../services/auth.service';
import { FirestoreService } from '../services/firestore.service';
import { LenderService } from '../services/lender.service';
import { RouterLink } from '@angular/router';

// Constants
import { LOAN_TYPES } from '../shared/loan-constants';

// Models
import { Loan as LoanModel } from '../models/loan-model.model';
import { SavedLoan } from '../models/saved-loan.model';
import { LoanService } from '../services/loan.service';
import { Loan } from '../models/loan-model.model';
import { getUserId } from '../utils/user-helpers';
import {
  UserData,
  Originator,
  Lender,
  isLender,
  isOriginator,
  userDataToUser,
} from '../models';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  standalone: true,
  imports: [CommonModule, RouterLink],
})
export class DashboardComponent implements OnInit {
  // Dependency injection
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly firestore = inject(Firestore);
  private readonly firestoreService = inject(FirestoreService);
  private readonly lenderService = inject(LenderService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loanService = inject(LoanService);

  // State properties
  isLoggedIn = false;
  role: string | undefined;
  user: FirebaseUser | null = null;
  userData: UserData = {} as UserData;
  userRole: 'originator' | 'lender' | undefined = undefined;
  loading = true;
  error: string | null = null;
  accountNumber = '';

  // Lender-specific data
  lenderData: any | null = null;

  // Reactive signals for better performance
  loans = signal<Loan[]>([]);
  loansLoading = signal(true);
  loansError = signal<string | null>(null);

  savedLoans = signal<SavedLoan[]>([]);
  savedLoansLoading = signal(true);
  savedLoansError = signal<string | null>(null);

  savedLenders = signal<any[]>([]);
  savedLendersLoading = signal(true);
  savedLendersError = signal<string | null>(null);

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

  loanTypes = LOAN_TYPES;

  /**
   * Initialize the dashboard component
   */
  ngOnInit(): void {
    console.log('Dashboard component initializing...');
    this.subscribeToAuthState();
  }

  /**
   * Subscribe to authentication state changes
   */
  private subscribeToAuthState(): void {
    this.authService.isLoggedIn$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((loggedIn) => {
        console.log('DashboardComponent - Auth state changed:', loggedIn);
        this.isLoggedIn = loggedIn;

        if (loggedIn) {
          this.loadUserData();
        } else {
          this.handleLoggedOut();
        }
      });
  }

  /**
   * Handle logged out state
   */
  private handleLoggedOut(): void {
    this.userData = {} as UserData;
    this.accountNumber = '';
    this.router.navigate(['/login']);
  }

  /**
   * Get loan type name from its value
   */
  getLoanTypeName(value: string): string {
    if (!value) return '';

    const loanType = this.loanTypes.find(
      (type) => type.value.toLowerCase() === value.toLowerCase()
    );

    return loanType ? loanType.name : value;
  }

  /**
   * Load user data from Firestore
   */
  loadUserData(): void {
    console.log('DashboardComponent - Loading user data...');
    this.loading = true;
    this.error = null;

    this.authService
      .getCurrentUser()
      .pipe(takeUntilDestroyed(this.destroyRef)) // Add this line
      .subscribe({
        next: async (user) => {
          if (!user) {
            this.handleNoAuthenticatedUser();
            return;
          }

          this.user = {
            uid: user.uid || user.id,
            email: user.email,
            // Add other necessary FirebaseUser properties
          } as FirebaseUser;

          const userId = getUserId(user);
          console.log('Logged in user ID:', userId);
          if (userId) {
            try {
              await this.fetchUserProfile(this.user);
            } catch (error: any) {
              this.handleUserProfileError(error, userId);
            }
          } else {
            console.error('No user ID available');
            this.handleNoAuthenticatedUser();
          }
        },
        error: (error: any) => {
          console.error('Error getting current user:', error);
          this.error = 'Authentication error';
          this.loading = false;
        },
      });
  }

  /**
   * Handle case when no authenticated user is found
   */
  private handleNoAuthenticatedUser(): void {
    console.log('DashboardComponent - No authenticated user found');
    this.error = 'Not logged in';
    this.userData = {} as UserData;
    this.loading = false;
    this.router.navigate(['/login']);
  }

  /**
   * Fetch user profile from Firestore
   */
  private async fetchUserProfile(fbUser: FirebaseUser): Promise<void> {
    if (!fbUser || !fbUser.uid) {
      this.handleNoAuthenticatedUser();
      return;
    }

    this.accountNumber = fbUser.uid.substring(0, 8);

    // Try lenders collection first
    const lenderDocRef = doc(this.firestore, `lenders/${fbUser.uid}`);
    const lenderSnap = await getDoc(lenderDocRef);

    if (lenderSnap.exists()) {
      await this.handleExistingUserProfile(lenderSnap, fbUser);
      return;
    }

    // If not found in lenders, try users collection
    const userDocRef = doc(this.firestore, `users/${fbUser.uid}`);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      await this.handleExistingUserProfile(userSnap, fbUser);
      return;
    }

    // If not found in either collection
    await this.handleMissingUserProfile(fbUser);
  }

  /**
   * Handle existing user profile
   */
  /**
   * Handle existing user profile
   */
  async handleExistingUserProfile(
    docSnap: any,
    fbUser: FirebaseUser
  ): Promise<void> {
    console.log('DashboardComponent - User profile found:', docSnap.data());

    const data = docSnap.data();

    if (data.role === 'lender') {
      // It's a lender
      this.userData = {
        id: docSnap.id,
        company: data.contactInfo?.company || '',
        firstName: data.contactInfo?.firstName || '',
        lastName: data.contactInfo?.lastName || '',
        phone: data.contactInfo?.contactPhone || '',
        email: data.contactInfo?.contactEmail || '',
        city: data.contactInfo?.city || '',
        state: data.contactInfo?.state || '',
        role: 'lender',
      };
    } else if (data.role === 'originator') {
      // It's an originator
      this.userData = {
        id: docSnap.id,
        ...data,
      } as UserData;
    } else {
      console.error('DashboardComponent - Unknown user role:', data.role);
    }

    this.userRole = this.userData.role;

    // Add safety check before loading additional data
    if (!this.destroyRef) return;

    if (this.userRole === 'lender' && fbUser.uid) {
      await this.loadSavedLoans(fbUser.uid);
    }

    // Add safety check before calling potentially problematic method
    if (!this.destroyRef) return;

    if (this.userRole === 'originator' && fbUser.uid) {
      await this.loadSavedLenders(fbUser.uid);
    }

    // Final safety check before updating UI state
    if (!this.destroyRef) return;

    if (fbUser.uid) {
      await this.loadLoans(fbUser.uid);
    }

    // Final UI update
    if (!this.destroyRef) return;
    this.loading = false;
  }

  /**
   * Handle missing user profile
   */
  private async handleMissingUserProfile(fbUser: FirebaseUser): Promise<void> {
    console.error(`No document found for user ID: ${fbUser.uid}`);
    this.error = 'User profile not found';

    this.userData = {
      id: fbUser.uid,
      email: fbUser.email || 'Unknown email',
      firstName: 'Account',
      lastName: 'Needs Setup',
    } as UserData;

    this.loading = false;
  }

  /**
   * Handle error loading user profile
   */
  private handleUserProfileError(error: any, userId: string): void {
    console.error(`Error fetching profile for user ${userId}:`, error);
    this.error = 'Error loading profile';

    this.userData = {
      id: userId,
      email: this.user?.email || 'Unknown email',
    } as UserData;

    this.loading = false;
  }

  async createDefaultUserProfile(fbUser: FirebaseUser): Promise<void> {
    try {
      const defaultUserData: Partial<UserData> = {
        id: fbUser.uid,
        email: fbUser.email || '',
        firstName: '',
        lastName: '',
        company: '',
        createdAt: new Date(),
        role: undefined,
      };

      this.userData = defaultUserData as UserData;
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

    this.loanService.getMyLoans().subscribe({
      next: (serviceLoans) => {
        // Convert service loans to your component's expected type if needed
        const loans = serviceLoans.map((loan) => loan as unknown as LoanModel);

        console.log(`Found ${loans.length} loans for user ${userId}`);
        this.loans.set(loans);
        this.loansLoading.set(false);
      },
      error: (error: Error) => {
        console.error('Error loading loans:', error);
        this.loansError.set('Failed to load your loans. Please try again.');
        this.loansLoading.set(false);
      },
    });
  }

  /**
   * Load saved loans for lenders
   */
  async loadSavedLoans(userId: string): Promise<void> {
    console.log('Loading saved loans for lender:', userId);
    this.savedLoansLoading.set(true);
    this.savedLoansError.set(null);

    this.firestoreService
      .getSavedLoans(userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (userSavedLoans) => {
          console.log(
            `Found ${userSavedLoans.length} saved loans for user ${userId}`
          );
          this.savedLoans.set(userSavedLoans);
          this.savedLoansLoading.set(false);
        },
        error: (error: any) => {
          // In your loadSavedLoans method
          console.log('Loading saved loans for user ID:', userId);
          // Compare this printed ID with what you see in your Firestore console
          console.error('Error loading saved loans:', error);
          this.savedLoansError.set(
            'Failed to load your saved loans. Please try again.'
          );
          this.savedLoansLoading.set(false);
        },
      });
  }
  /**
   * Save a loan for a lender
   */
  async saveLoan(loan: Loan): Promise<void> {
    if (!this.user || !this.user.uid) {
      alert('Please log in to save loans');
      this.router.navigate(['/login']);
      return;
    }

    if (this.userRole !== 'lender') {
      alert('Only lenders can save loans');
      return;
    }

    try {
      await this.checkAndSaveLoan(loan);
    } catch (error) {
      console.error('Error saving loan:', error);
      alert('Failed to save loan: ' + this.getErrorMessage(error));
    }
  }

  /**
   * Check if loan is already saved and save if not
   */
  private async checkAndSaveLoan(loan: Loan): Promise<void> {
    if (!this.user || !this.user.uid) {
      return;
    }

    const savedLoansCollectionRef = collection(this.firestore, 'loanFavorites');
    const q = query(
      savedLoansCollectionRef,
      where('loanId', '==', loan.id),
      where('userId', '==', this.user.uid)
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      alert('You have already saved this loan');
      return;
    }

    const savedLoanData = {
      loanId: loan.id,
      loanData: loan,
      userId: this.user.uid,
      createdAt: new Date(),
    };

    await addDoc(savedLoansCollectionRef, savedLoanData);
    alert('Loan saved successfully');

    if (this.user && this.user.uid) {
      await this.loadSavedLoans(this.user.uid);
    }
  }

  /**
   * Remove a saved loan
   */
  async removeSavedLoan(savedLoanId: string): Promise<void> {
    if (
      confirm('Are you sure you want to remove this from your saved loans?')
    ) {
      try {
        const savedLoanDocRef = doc(
          this.firestore,
          `loanFavorites/${savedLoanId}`
        );

        await deleteDoc(savedLoanDocRef);

        // Update the savedLoans signal
        const currentSavedLoans = this.savedLoans();
        this.savedLoans.set(
          currentSavedLoans.filter((loan) => loan.id !== savedLoanId)
        );

        alert('Loan removed from saved list');
      } catch (error) {
        console.error('Error removing saved loan:', error);
        alert('Failed to remove loan: ' + this.getErrorMessage(error));
      }
    }
  }

  /**
   * Load saved lenders for originators
   */
  async loadSavedLenders(originatorId: string): Promise<void> {
    console.log('Loading saved lenders for originator:', originatorId);
    this.savedLendersLoading.set(true);
    this.savedLendersError.set(null);

    this.firestoreService
      .getOriginatorLenderFavorites(originatorId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (favorites) => {
          console.log(
            `Found ${favorites.length} saved lenders for originator ${originatorId}`
          );
          this.savedLenders.set(favorites);
          this.savedLendersLoading.set(false);
        },
        error: (error: any) => {
          console.error('Error loading saved lenders:', error);
          this.savedLendersError.set(
            'Failed to load your saved lenders. Please try again.'
          );
          this.savedLendersLoading.set(false);
        },
      });
  }

  async removeSavedLender(savedFavoriteId: string): Promise<void> {
    if (confirm('Are you sure you want to remove this saved lender?')) {
      try {
        const docRef = doc(
          this.firestore,
          `originatorLenderFavorites/${savedFavoriteId}`
        );
        await deleteDoc(docRef);

        const currentFavorites = this.savedLenders();
        this.savedLenders.set(
          currentFavorites.filter((fav) => fav.id !== savedFavoriteId)
        );

        alert('Lender removed from favorites.');
      } catch (error) {
        console.error('Error removing saved lender:', error);
        alert('Failed to remove saved lender.');
      }
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
        this.navigateAfterRoleSelection(role);
      },
      error: (error: any) => {
        console.error('Error updating user role:', error);
        this.error = 'Failed to update role';
        this.loading = false;
      },
    });
  }

  /**
   * Navigate to appropriate form after role selection
   */
  private navigateAfterRoleSelection(role: 'lender' | 'originator'): void {
    if (role === 'lender') {
      this.router.navigate(['/lender-registration']);
    } else {
      this.router.navigate(['/user-form']);
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

  /**
   * Format phone number
   */
  formatPhoneNumber(phone?: string): string {
    if (!phone) return '';

    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);

    return match ? `(${match[1]}) ${match[2]}-${match[3]}` : phone;
  }

  /**
   * Format currency value
   */
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

  /**
   * Format date
   */
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

  /**
   * Get color for property type
   */
  getColor(propertyType: string): string {
    return this.propertyColorMap[propertyType] || '#000000';
  }

  /**
   * Check if user is a lender
   */
  isLender(): boolean {
    return this.userRole === 'lender';
  }

  /**
   * Check if user is an originator
   */
  isOriginator(): boolean {
    return this.userRole === 'originator';
  }

  /**
   * Navigation: View loan details
   */
  viewLoanDetails(loanId: string): void {
    this.router.navigate(['/loans', loanId]);
  }

  /**
   * Navigation: Edit loan
   */
  editLoan(loanId: string): void {
    this.router.navigate(['/loans', loanId, 'edit']);
  }

  /**
   * Navigation: Create new loan
   */
  createNewLoan(): void {
    this.router.navigate(['/loan']);
  }

  /**
   * Navigation: Edit account
   */
  editAccount(): void {
    this.router.navigate(['/account/edit']);
  }

  /**
   * Navigation: Edit lender profile
   */
  editLenderProfile(): void {
    this.router.navigate(['/lender-profile/edit']);
  }

  /**
   * Delete a loan
   */
  async deleteLoan(loanId: string): Promise<void> {
    if (confirm('Are you sure you want to delete this loan?')) {
      try {
        const loanDocRef = doc(this.firestore, `loans/${loanId}`);
        await deleteDoc(loanDocRef);

        // Update the loans signal
        const currentLoans = this.loans();
        this.loans.set(currentLoans.filter((loan) => loan.id !== loanId));

        alert('Loan deleted successfully');
      } catch (error) {
        console.error('Error deleting loan:', error);
        alert('Failed to delete loan: ' + this.getErrorMessage(error));
      }
    }
  }

  /**
   * Delete user account
   */
  async deleteAccount(): Promise<void> {
    if (
      confirm(
        'Are you sure you want to delete your account? This action cannot be undone.'
      )
    ) {
      try {
        await this.deleteUserAndLogout();
      } catch (error) {
        console.error('Error deleting account:', error);
        alert('Failed to delete account: ' + this.getErrorMessage(error));
      }
    }
  }

  /**
   * Delete user document and logout
   */
  private async deleteUserAndLogout(): Promise<void> {
    if (!this.userData || !this.userData.id) {
      throw new Error('User account information not available');
    }

    // Determine the appropriate collection based on user role
    const collection = this.userRole === 'lender' ? 'lenders' : 'users';
    const userDocRef = doc(this.firestore, `${collection}/${this.userData.id}`);
    await deleteDoc(userDocRef);

    // Log out the user
    this.authService.logout().subscribe({
      next: () => {
        alert('Your account has been deleted successfully');
        this.router.navigate(['/login']);
      },
      error: (error: any) => {
        console.error('Error during logout after account deletion:', error);
        throw error;
      },
    });
  }

  /**
   * Logout user
   */
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
        error: (error: any) => {
          console.error('Error during logout:', error);
          this.error = 'Error during logout';
          this.loading = false;
        },
      });
  }

  /**
   * Get error message from error object
   */
  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
