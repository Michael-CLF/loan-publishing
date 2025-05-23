// Import what we need
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Added for ngModel support
import { Router, RouterLink } from '@angular/router';
import { User as FirebaseUser } from '@angular/fire/auth';

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
import { LoanService } from '../services/loan.service';

// Constants
import { LOAN_TYPES } from '../shared/loan-constants';

// Models
import { Loan as LoanModel } from '../models/loan-model.model';
import { SavedLoan } from '../models/saved-loan.model';
import { Loan } from '../models/loan-model.model';
import { getUserId } from '../utils/user-helpers';
import { UserData } from '../models';
import { ModalService } from '../services/modal.service';
import { LocationService } from '../services/location.service';
import { Timestamp } from '@angular/fire/firestore';
import { createTimestamp, createServerTimestamp, toFirestoreTimestamp } from '../utils/firebase.utils';


@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule], // Added FormsModule
})
export class DashboardComponent implements OnInit {
  // Dependency injection
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly firestore = inject(Firestore);
  private readonly firestoreService = inject(FirestoreService);
  private readonly lenderService = inject(LenderService);
  private readonly loanService = inject(LoanService);
  private readonly modalService = inject(ModalService);
  public readonly locationService = inject(LocationService);

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

  // Notification preferences - UPDATED STRUCTURE
  notificationPrefs = {
    wantsEmailNotifications: false,
    preferredPropertyCategories: [] as string[],
    preferredPropertyTypes: [] as string[], // Added for template compatibility
    preferredLoanTypes: [] as string[],
    minLoanAmount: 0,
    footprint: [] as string[],
  };

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
  savedLendersWithDetails = signal<any[]>([]);

  // Property colors for visualization
  propertyColorMap: Record<string, string> = {
    Commercial: '#1E90FF',
    Healthcare: '#cb4335',
    Hospitality: '#1b4f72',
    Industrial: '#2c3e50',
    Land: '#023020',
    'Mixed Use': '#8A2BE2',
    Multifamily: '#6c3483',
    Office: '#4682B4',
    Residential: '#DC143C',
    Retail: '#660000',
    'Special Purpose': '#6e2c00',
  };

  loanTypes = LOAN_TYPES;

  // Property types for notification preferences - NEW ADDITION
  allPropertyTypes: string[] = [
    'Commercial',
    'Healthcare', 
    'Hospitality',
    'Industrial',
    'Land',
    'Mixed Use',
    'Multifamily',
    'Office',
    'Residential',
    'Retail',
    'Special Purpose'
  ];

  // Available loan types for notification preferences - NEW ADDITION
  allLoanTypes: string[] = [
    'Purchase',
    'Refinance', 
    'Construction',
    'Bridge',
    'SBA',
    'USDA',
    'Conventional',
    'Hard Money',
    'Mezzanine',
    'Equity'
  ];

  // Available states for footprint selection - NEW ADDITION
  allStates: string[] = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
  ];

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
    this.authService.isLoggedIn$.subscribe((loggedIn) => {
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
    let loanType = this.loanTypes.find((type) => type.value === value);

    // If not found, try case-insensitive match
    if (!loanType) {
      loanType = this.loanTypes.find(
        (type) => type.value.toLowerCase() === value.toLowerCase()
      );
    }

    // If still not found, try to convert camelCase to a readable format
    if (!loanType) {
      // Convert camelCase to Title Case with spaces
      const formatted = value
        .replace(/([A-Z])/g, ' $1') // Add space before capital letters
        .replace(/^./, (str) => str.toUpperCase()); // Capitalize first letter

      return formatted.trim();
    }

    return loanType ? loanType.name : value;
  }

  /**
   * Load user data from Firestore
   */
  loadUserData(): void {
    console.log('DashboardComponent - Loading user data...');
    this.loading = true;
    this.error = null;

    this.authService.getCurrentUser().subscribe({
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

    // If not found in lenders, try originators collection
    const userDocRef = doc(this.firestore, `originators/${fbUser.uid}`);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      await this.handleExistingUserProfile(userSnap, fbUser);
      return;
    }

    // If not found in either collection
    await this.handleMissingUserProfile(fbUser);
  }

  /**
   * Handle existing user profile - ENHANCED with notification preferences
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
        company:
          data.company || (data.contactInfo && data.contactInfo.company) || '',
        firstName: data.contactInfo?.firstName || '',
        lastName: data.contactInfo?.lastName || '',
        phone: data.contactInfo?.contactPhone || '',
        email: data.contactInfo?.contactEmail || '',
        city: data.contactInfo?.city || '',
        state: data.contactInfo?.state || '',
        role: 'lender',
      };

      // Load notification preferences for lenders - NEW ADDITION
      this.notificationPrefs = {
        wantsEmailNotifications: data.wantsEmailNotifications ?? false,
        preferredPropertyCategories: data.productInfo?.propertyCategories ?? [],
        preferredPropertyTypes: data.productInfo?.propertyCategories ?? [], // Sync with preferredPropertyCategories
        preferredLoanTypes: data.productInfo?.loanTypes ?? [],
        minLoanAmount: data.productInfo?.minLoanAmount ?? 0,
        footprint: Object.keys(data.footprintInfo?.states || {}),
      };
    } else if (data.role === 'originator') {
      this.userData = {
        id: docSnap.id,
        email: data.contactInfo?.contactEmail || data.email || '',
        firstName: data.contactInfo?.firstName || data.firstName || '',
        lastName: data.contactInfo?.lastName || data.lastName || '',
        phone: data.contactInfo?.contactPhone || data.phone || '',
        company: data.contactInfo?.company || data.company || '',
        city: data.contactInfo?.city || data.city || '',
        state: data.contactInfo?.state || data.state || '',
        role: 'originator',
      };
    }

    this.userRole = this.userData.role;

    // Rest of the method remains unchanged
    if (this.userRole === 'lender' && fbUser.uid) {
      await this.loadSavedLoans(fbUser.uid);
    }

    if (this.userRole === 'originator' && fbUser.uid) {
      await this.loadSavedLenders(fbUser.uid);
    }

    if (fbUser.uid) {
      await this.loadLoans(fbUser.uid);
    }

    // Final UI update
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
        createdAt: createTimestamp(), // Using utility function instead of Timestamp.fromDate(new Date())
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

    this.firestoreService.getSavedLoans(userId).subscribe({
      next: (userSavedLoans) => {
        console.log(
          `Found ${userSavedLoans.length} saved loans for originators ${userId}`
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
      createdAt: createTimestamp(), // Using utility function instead of new Date()
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
    // Get the saved loan data from our current list
    const savedLoan = this.savedLoans().find((loan) => loan.id === savedLoanId);

    if (!savedLoan) {
      console.error('Saved loan not found:', savedLoanId);
      return;
    }

    // Open the remove saved loan modal
    const confirmed = await this.modalService.openRemoveSavedLoanModal(
      savedLoan.loanData
    );

    if (confirmed) {
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

        // Show success message directly with alert
        alert('Loan removed from saved list');
      } catch (error) {
        console.error('Error removing saved loan:', error);
        alert('Failed to remove loan: ' + this.getErrorMessage(error));
      }
    }
  }

  /**
   * Toggle property type preference for notifications - NEW METHOD
   */
  togglePropertyType(propertyType: string): void {
    const index = this.notificationPrefs.preferredPropertyTypes.indexOf(propertyType);
    
    if (index > -1) {
      // Remove if already selected
      this.notificationPrefs.preferredPropertyTypes.splice(index, 1);
    } else {
      // Add if not selected
      this.notificationPrefs.preferredPropertyTypes.push(propertyType);
    }

    // Keep preferredPropertyCategories in sync
    this.notificationPrefs.preferredPropertyCategories = [...this.notificationPrefs.preferredPropertyTypes];
  }

  /**
   * Toggle loan type preference for notifications - NEW METHOD
   */
  toggleLoanType(loanType: string): void {
    const index = this.notificationPrefs.preferredLoanTypes.indexOf(loanType);
    
    if (index > -1) {
      // Remove if already selected
      this.notificationPrefs.preferredLoanTypes.splice(index, 1);
    } else {
      // Add if not selected
      this.notificationPrefs.preferredLoanTypes.push(loanType);
    }
  }

  /**
   * Toggle state in footprint for notifications - NEW METHOD
   */
  toggleFootprintState(state: string): void {
    const index = this.notificationPrefs.footprint.indexOf(state);
    
    if (index > -1) {
      // Remove if already selected
      this.notificationPrefs.footprint.splice(index, 1);
    } else {
      // Add if not selected
      this.notificationPrefs.footprint.push(state);
    }
  }

  /**
   * Check if a loan type is selected - HELPER METHOD
   */
  isLoanTypeSelected(loanType: string): boolean {
    return this.notificationPrefs.preferredLoanTypes.includes(loanType);
  }

  /**
   * Check if a state is selected in footprint - HELPER METHOD
   */
  isStateSelected(state: string): boolean {
    return this.notificationPrefs.footprint.includes(state);
  }

  /**
   * Format minimum loan amount input - HELPER METHOD
   */
  onMinLoanAmountChange(event: any): void {
    const value = event.target.value;
    // Remove any non-numeric characters except decimal points
    const numericValue = parseFloat(value.toString().replace(/[^0-9.]/g, ''));
    this.notificationPrefs.minLoanAmount = isNaN(numericValue) ? 0 : numericValue;
  }

  /**
   * Reset notification preferences to defaults - NEW METHOD
   */
  resetNotificationPreferences(): void {
    if (confirm('Are you sure you want to reset all notification preferences to defaults?')) {
      this.notificationPrefs = {
        wantsEmailNotifications: false,
        preferredPropertyCategories: [],
        preferredPropertyTypes: [],
        preferredLoanTypes: [],
        minLoanAmount: 0,
        footprint: [],
      };
      
      console.log('Notification preferences reset to defaults');
    }
  }

  /**
   * Save notification preferences - ENHANCED METHOD
   */
  async saveNotificationPreferences(): Promise<void> {
    if (!this.userData?.id || this.userRole !== 'lender') return;

    try {
      const updateData = {
        wantsEmailNotifications: this.notificationPrefs.wantsEmailNotifications,
        productInfo: {
          propertyCategories: this.notificationPrefs.preferredPropertyTypes, // Use preferredPropertyTypes for consistency
          loanTypes: this.notificationPrefs.preferredLoanTypes,
          minLoanAmount: this.notificationPrefs.minLoanAmount,
        },
        footprintInfo: {
          states: this.notificationPrefs.footprint.reduce((acc, cur) => {
            acc[cur] = true;
            return acc;
          }, {} as Record<string, boolean>),
        },
      };

      await this.firestoreService.updateDocument(`lenders/${this.userData.id}`, updateData);
      
      console.log('Notification preferences saved:', updateData);
      alert('Notification preferences saved successfully.');
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
      alert('Error saving preferences.');
    }
  }

  /**
   * Toggle email notifications - ENHANCED METHOD
   */
  async toggleEmailNotifications(enabled: boolean): Promise<void> {
    if (!this.userData?.id || this.userRole !== 'lender') return;

    try {
      // Update the local state
      this.notificationPrefs.wantsEmailNotifications = enabled;
      
      // Update in Firestore
      await this.firestoreService.updateDocument(`lenders/${this.userData.id}`, {
        wantsEmailNotifications: enabled,
      });
      alert('Notification preference updated.');
    } catch (error) {
      console.error('Error updating notification preference:', error);
      alert('Failed to update preference.');
    }
  }

  /**
   * Load saved lenders for originators
   */
  async loadSavedLenders(originatorId: string): Promise<void> {
    console.log('Loading saved lenders for originator:', originatorId);
    this.savedLendersLoading.set(true);
    this.savedLendersError.set(null);

    this.firestoreService.getOriginatorLenderFavorites(originatorId).subscribe({
      next: (favorites) => {
        console.log(
          `Found ${favorites.length} saved lenders for originator ${originatorId}`
        );
        this.savedLenders.set(favorites);

        // Load the full lender details for each favorite
        this.loadLenderDetailsForFavorites(favorites);
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

  private loadLenderDetailsForFavorites(favorites: any[]): void {
    if (favorites.length === 0) {
      this.savedLendersWithDetails.set([]);
      this.savedLendersLoading.set(false);
      return;
    }

    const lendersWithDetails: any[] = [];
    let loadedCount = 0;

    // For each favorite, fetch the lender details
    favorites.forEach((favorite) => {
      this.lenderService.getLender(favorite.lenderId).subscribe({
        next: (lender) => {
          if (lender) {
            lendersWithDetails.push({
              ...favorite,
              lenderData: lender,
            });
          } else {
            // Handle missing lender (we'll keep the favorite but mark it)
            lendersWithDetails.push({
              ...favorite,
              lenderData: { notFound: true },
            });
          }
          loadedCount++;
          if (loadedCount === favorites.length) {
            this.savedLendersWithDetails.set(lendersWithDetails);
            this.savedLendersLoading.set(false);
          }
        },
        error: (err) => {
          console.error(
            `Error loading lender details for ${favorite.lenderId}:`,
            err
          );
          // Still count this as loaded, but with an error
          lendersWithDetails.push({
            ...favorite,
            lenderData: { error: true },
          });

          loadedCount++;
          if (loadedCount === favorites.length) {
            this.savedLendersWithDetails.set(lendersWithDetails);
            this.savedLendersLoading.set(false);
          }
        },
      });
    });
  }

  getLenderContactName(lenderFavorite: any): string {
    if (
      !lenderFavorite.lenderData ||
      lenderFavorite.lenderData.notFound ||
      lenderFavorite.lenderData.error
    ) {
      return 'Unknown';
    }

    const firstName = lenderFavorite.lenderData.contactInfo?.firstName || '';
    const lastName = lenderFavorite.lenderData.contactInfo?.lastName || '';

    return firstName || lastName
      ? `${firstName} ${lastName}`.trim()
      : 'Not specified';
  }

  /* Get lender company name from all possible locations*/
  getLenderCompanyName(lenderFavorite: any): string {
    if (!lenderFavorite.lenderData) {
      return 'Unknown Company';
    }

    // Get the company name from the contactInfo object
    const companyFromContactInfo =
      lenderFavorite.lenderData.contactInfo?.company;
    const firstName = lenderFavorite.lenderData.contactInfo?.firstName || '';
    const lastName = lenderFavorite.lenderData.contactInfo?.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();

    // Return the company name if it exists and isn't empty
    if (companyFromContactInfo && companyFromContactInfo !== '') {
      return companyFromContactInfo;
    }

    // If we don't have a company name, use the person's name as a fallback
    if (fullName) {
      return `${fullName}'s Company`;
    }

    return 'Unknown Company';
  }
  /**
   * Get lender types as string
   */
  getLenderTypes(lenderFavorite: any): string {
    if (
      !lenderFavorite.lenderData ||
      !lenderFavorite.lenderData.productInfo?.lenderTypes?.length
    ) {
      return 'Not specified';
    }

    // Return just the first lender type to keep it concise in the table
    const firstType = lenderFavorite.lenderData.productInfo.lenderTypes[0];
    return this.getLenderTypeName(firstType);
  }

  getLenderLoanRange(lenderFavorite: any): string {
    if (!lenderFavorite.lenderData || !lenderFavorite.lenderData.productInfo) {
      return 'Not specified';
    }

    const minAmount = lenderFavorite.lenderData.productInfo.minLoanAmount;
    const maxAmount = lenderFavorite.lenderData.productInfo.maxLoanAmount;

    if (!minAmount && !maxAmount) {
      return 'Not specified';
    }

    return (
      this.formatCurrency(minAmount || 0) +
      ' - ' +
      this.formatCurrency(maxAmount || 0)
    );
  }

  getLenderTypeName(value: string): string {
    const map: { [key: string]: string } = {
      agency: 'Agency Lender',
      balanceSheet: 'Balance Sheet',
      bank: 'Bank',
      bridge_lender: 'Bridge Lender',
      cdfi: 'CDFI Lender',
      conduit_lender: 'Conduit Lender (CMBS)',
      construction_lender: 'Construction Lender',
      correspondent_lender: 'Correspondent Lender',
      credit_union: 'Credit Union',
      crowdfunding: 'Crowdfunding Platform',
      direct_lender: 'Direct Lender',
      family_office: 'Family Office',
      hard_money: 'Hard Money Lender',
      life_insurance: 'Life Insurance Lender',
      mezzanine_lender: 'Mezzanine Lender',
      non_qm_lender: 'Non-QM Lender',
      portfolio_lender: 'Portfolio Lender',
      private_lender: 'Private Lender',
      sba: 'SBA Lender',
      usda: 'USDA Lender',
    };

    return map[value] || value;
  }

  viewLenderDetails(lenderId: string): void {
    this.router.navigate(['/lender-details', lenderId]);
  }

  /**
   * Remove a saved lender
   */
  async removeSavedLender(savedFavoriteId: string): Promise<void> {
    // Find the saved lender in our list
    const savedLender = this.savedLendersWithDetails().find(
      (lender) => lender.id === savedFavoriteId
    );

    if (!savedLender) {
      console.error('Saved lender not found:', savedFavoriteId);
      return;
    }

    // Open the remove saved lender modal
    const confirmed = await this.modalService.openRemoveSavedLenderModal(
      savedLender.lenderData
    );

    if (confirmed) {
      try {
        const docRef = doc(
          this.firestore,
          `originatorLenderFavorites/${savedFavoriteId}`
        );
        await deleteDoc(docRef);

        // Update the favorites lists
        const currentFavorites = this.savedLenders();
        this.savedLenders.set(
          currentFavorites.filter((fav) => fav.id !== savedFavoriteId)
        );

        // Update the details list too
        const currentDetails = this.savedLendersWithDetails();
        this.savedLendersWithDetails.set(
          currentDetails.filter((fav) => fav.id !== savedFavoriteId)
        );

        alert('Lender removed from saved list');
      } catch (error) {
        console.error('Error removing saved lender:', error);
        alert('Failed to remove saved lender: ' + this.getErrorMessage(error));
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

  getFormattedStateName(state?: string): string {
    if (!state) return '';
    return this.locationService.formatValueForDisplay(state);
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
    // Find the loan in our loans array
    const loanToDelete = this.loans().find((loan) => loan.id === loanId);

    if (!loanToDelete) {
      console.error('Loan not found:', loanId);
      return;
    }

    // Open the delete published loan modal
    const confirmed = await this.modalService.openDeletePublishedLoanModal(
      loanToDelete
    );

    if (confirmed) {
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
    // Determine the user type based on the current userRole
    const userType = this.userRole as 'lender' | 'originator';

    // Open the delete account modal
    const confirmed = await this.modalService.openDeleteAccountModal(userType);

    if (confirmed) {
      try {
        await this.deleteUserAndLogout();
      } catch (error) {
        console.error('Error deleting account:', error);
        alert('Failed to delete account: ' + this.getErrorMessage(error));
      }
    }
  }

  // Update the deleteUserAndLogout method to redirect to home page
  private async deleteUserAndLogout(): Promise<void> {
    if (!this.userData || !this.userData.id) {
      throw new Error('User account information not available');
    }

    // Determine the appropriate collection based on user role
    const collection = this.userRole === 'lender' ? 'lenders' : 'originators';
    const userDocRef = doc(this.firestore, `${collection}/${this.userData.id}`);
    await deleteDoc(userDocRef);

    // Log out the user
    this.authService.logout().subscribe({
      next: () => {
        alert('Your account has been deleted successfully');
        this.router.navigate(['/']); // Redirect to home page
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

    this.authService.logout().subscribe({
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