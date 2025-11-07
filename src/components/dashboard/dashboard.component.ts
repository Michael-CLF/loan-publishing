// dashboard.component.ts
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { User as FirebaseUser } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';
import { NotificationPreferencesService } from '../../services/notification-preferences.service';
import {
  LenderNotificationPreferences,
  DEFAULT_LENDER_NOTIFICATION_PREFERENCES,
} from '../../types/notification.types';
import {
  Firestore,
  getFirestore,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  deleteDoc,
  addDoc,
} from '@angular/fire/firestore';
import { switchMap, filter, take, finalize } from 'rxjs/operators';
import { collection } from '@angular/fire/firestore';
import { ActivatedRoute } from '@angular/router';
import { ModalService } from '../../services/modal.service';

// Services
import { AuthService } from '../../services/auth.service';
import { LenderService } from '../../services/lender.service';
import { LoanService } from '../../services/loan.service';
import { EmailNotificationService } from '../../services/email-notification.service';

// Models
import { Loan as LoanModel } from '../../models/loan-model.model';
import { SavedLoan } from '../../models/saved-loan.model';
import { Loan } from '../../models/loan-model.model';
import { UserData } from '../../models';
import { LocationService } from '../../services/location.service';
import { createTimestamp } from '../../utils/firebase.utils';
import { getPropertySubcategoryName } from '../../shared/constants/property-mappings';
import {
  LoanUtils,
  PropertySubcategoryValue,
} from '../../models/loan-model.model';
import { getStateName } from '../../shared/constants/state-mappings';
import { FirestoreService } from 'src/services/firestore.service';

// Property category interface for better type safety
interface PropertyCategoryOption {
  value: string; // Snake_case for storage/matching
  displayName: string; // User-friendly display name
}

interface LoanTypeOption {
  value: string; // Snake_case for storage/matching
  displayName: string; // User-friendly display name
}

interface SimpleUser {
  uid: string;
  displayName: string;
  email: string;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  providers: [
     LenderService,
    LoanService,
    EmailNotificationService,
    LocationService,
    NotificationPreferencesService
  ]
})

export class DashboardComponent implements OnInit {
  // Dependency injection
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  public readonly firestoreService = inject(FirestoreService);
  private readonly lenderService = inject(LenderService);
  private readonly loanService = inject(LoanService);
  private readonly modalService = inject(ModalService);
  public readonly locationService = inject(LocationService);
  private readonly notificationPreferencesService = inject(
    NotificationPreferencesService
  );
  private readonly emailNotificationService = inject(EmailNotificationService);
  private route = inject(ActivatedRoute);

  getPropertySubcategoryName = getPropertySubcategoryName;
  getStateName = getStateName;

  // State properties
  isLoggedIn = false;
  role: string | undefined;
  user: SimpleUser | null = null;
  userData: UserData = {} as UserData;
  userRole: 'originator' | 'lender' | undefined = undefined;
  loading = true;
  error: string | null = null;
  accountNumber = '';

  // Lender-specific data
  lenderData: any | null = null;

  // ✅ Angular 18 Best Practice: Use signals for reactive state management
  notificationPrefs = signal<LenderNotificationPreferences>({
    wantsEmailNotifications: false,
    propertyCategories: [],
    subcategorySelections: [],
    loanTypes: [],
    minLoanAmount: 0,
    ficoScore: 0,
    footprint: [],
  });

  // ✅ Computed signal for toggle state - automatically syncs with preferences
  notificationOptIn = computed(
    () => this.notificationPrefs().wantsEmailNotifications
  );

  // ✅ Signal for saving state
  savingOptIn = signal(false);

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

  // Property colors for visualization - handle both old and new formats
  propertyColorMap: Record<string, string> = {
    // New standardized format (snake_case)
    commercial: '#1E90FF',
    healthcare: '#cb4335',
    hospitality: '#1b4f72',
    industrial: '#154360',
    land: '#023020',
    mixed_use: '#8A2BE2',
    multifamily: '#6c3483',
    office: '#4682B4',
    residential: '#DC143C',
    retail: '#660000',
    special_purpose: '#6e2c00',

    // Legacy format (Title Case/spaces) - for backward compatibility
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

  // ✅ CORRECTED: Property categories matching registration exactly
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

  // ✅ CORRECTED: Loan types matching registration exactly
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
    { value: 'purchase_money', displayName: 'Purchase Money Loan' },
    { value: 'acquisition', displayName: 'Acquisition Loan' },
    { value: 'balance_sheet', displayName: 'Balance Sheet' },
    { value: 'bridge_perm', displayName: 'Bridge to Permanent' },
    { value: 'dscr', displayName: 'DSCR' },
    { value: 'fix_flip', displayName: 'Fix & Flip' },
    { value: 'portfolio', displayName: 'Portfolio Loan' },
    { value: 'sba_express', displayName: 'SBA Express' },
    { value: 'sba_7a', displayName: 'SBA 7(a)' },
    { value: 'sba_504', displayName: 'SBA 504' },
  ];

  // Available states for footprint selection
  allStates: string[] = [
    'AL',
    'AK',
    'AZ',
    'AR',
    'CA',
    'CO',
    'CT',
    'DE',
    'FL',
    'GA',
    'HI',
    'ID',
    'IL',
    'IN',
    'IA',
    'KS',
    'KY',
    'LA',
    'ME',
    'MD',
    'MA',
    'MI',
    'MN',
    'MS',
    'MO',
    'MT',
    'NE',
    'NV',
    'NH',
    'NJ',
    'NM',
    'NY',
    'NC',
    'ND',
    'OH',
    'OK',
    'OR',
    'PA',
    'RI',
    'SC',
    'SD',
    'TN',
    'TX',
    'UT',
    'VT',
    'VA',
    'WA',
    'WV',
    'WI',
    'WY',
  ];

  ngOnInit(): void {
    console.log('🏗️ DASHBOARD COMPONENT - ngOnInit started');
    console.log('Dashboard component initializing...');
    this.waitForAuthAndLoadData();
  }

  private waitForAuthAndLoadData(): void {
    console.log('⏳ Dashboard - Waiting for auth to be ready...');

    this.authService.authReady$
      .pipe(
        filter((ready) => ready),
        take(1)
      )
      .subscribe({
        next: () => {
          console.log('✅ Dashboard - Auth is ready, loading user data');
          this.loadUserData();
        },
        error: (error) => {
          console.error('❌ Dashboard - Auth ready check failed:', error);
          this.error = 'Authentication service not available';
          this.loading = false;
          this.handleNoAuthenticatedUser();
        },
      });
  }

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
    console.log('🚪 DASHBOARD - handleLoggedOut called, redirecting to login');
    this.userData = {} as UserData;
    this.accountNumber = '';
    this.router.navigate(['/login']);
  }

  getLoanTypeName(value: string): string {
    if (!value) return '';

    let loanType = this.allLoanTypeOptions.find((type) => type.value === value);

    // If not found, try case-insensitive match
    if (!loanType) {
      loanType = this.allLoanTypeOptions.find(
        (type) => type.value.toLowerCase() === value.toLowerCase()
      );
    }

    // If still not found, try to convert camelCase to a readable format
    if (!loanType) {
      const formatted = value
        .replace(/([A-Z])/g, ' $1') // Add space before capital letters
        .replace(/^./, (str) => str.toUpperCase()); // Capitalize first letter
      return formatted.trim();
    }

    return loanType.displayName; // ✅ Use displayName consistently
  }

  async loadUserData(): Promise<void> {
    console.log('🟡 DashboardComponent - Loading user data...');
    this.loading = true;
    this.error = null;

    try {
      // ✅ Auth service should now be ready
      const userProfile = await this.authService
        .getUserProfile()
        .pipe(take(1))
        .toPromise();

      if (!userProfile) {
        this.handleNoAuthenticatedUser();
        return;
      }

      // ✅ Set basic user info for internal use
      this.user = {
        uid: userProfile.id,
        displayName: `${
          userProfile['contactInfo']?.firstName || userProfile.firstName || ''
        } ${
          userProfile['contactInfo']?.lastName || userProfile.lastName || ''
        }`.trim(),
        email:
          userProfile['contactInfo']?.contactEmail || userProfile.email || '',
      };

      // ✅ Generate account number
      this.accountNumber = userProfile.id.substring(0, 8);

      // ✅ Map the user profile to flat userData structure based on role
      if (userProfile.role === 'lender') {
        this.userData = {
          id: userProfile.id,
          email:
            userProfile['contactInfo']?.contactEmail || userProfile.email || '',
          firstName:
            userProfile['contactInfo']?.firstName ||
            userProfile.firstName ||
            '',
          lastName:
            userProfile['contactInfo']?.lastName || userProfile.lastName || '',
          phone:
            userProfile['contactInfo']?.contactPhone || userProfile.phone || '',
          city: userProfile['contactInfo']?.city || userProfile.city || '',
          state: userProfile['contactInfo']?.state || userProfile.state || '',
          company:
            userProfile['contactInfo']?.company || userProfile.company || '',
          role: 'lender',
          accountNumber: this.accountNumber,
        };

        // ✅ Load notification preferences for lenders
        this.loadNotificationPreferencesFromService();
      } else if (userProfile.role === 'originator') {
        this.userData = {
          id: userProfile.id,
          email:
            userProfile['contactInfo']?.contactEmail || userProfile.email || '',
          firstName:
            userProfile['contactInfo']?.firstName ||
            userProfile.firstName ||
            '',
          lastName:
            userProfile['contactInfo']?.lastName || userProfile.lastName || '',
          phone:
            userProfile['contactInfo']?.contactPhone || userProfile.phone || '',
          company:
            userProfile['contactInfo']?.company || userProfile.company || '',
          city: userProfile['contactInfo']?.city || userProfile.city || '',
          state: userProfile['contactInfo']?.state || userProfile.state || '',
          role: 'originator',
        };
      }

      // ✅ Set user role for template conditionals
      this.userRole = this.userData.role;

      console.log('✅ User profile loaded and mapped:', {
        user: this.user,
        userData: this.userData,
        userRole: this.userRole,
      });

      // ✅ Load role-specific data
      if (this.userRole === 'lender' && this.user.uid) {
        await this.loadSavedLoans(this.user.uid);
      }

      if (this.userRole === 'originator' && this.user.uid) {
        await this.loadSavedLenders(this.user.uid);
      }

      // ✅ Load loans for both roles
      if (this.user.uid) {
        await this.loadLoans(this.user.uid);
      }
    } catch (error) {
      console.error('❌ Error loading user profile:', error);
      this.error =
        'Unable to load user profile. Please try refreshing the page.';
      this.handleNoAuthenticatedUser();
    } finally {
      this.loading = false;
    }
  }

  /**
   * Load complete lender data including product and footprint info
   */
  private async loadLenderCompleteData(): Promise<void> {
    if (this.userRole !== 'lender' || !this.user?.uid) {
      return;
    }

    try {
      const lenderRef = doc(
        this.firestoreService.firestore,
        `lenders/${this.user.uid}`
      );
      const lenderSnap = await getDoc(lenderRef);

      if (lenderSnap.exists()) {
        this.lenderData = lenderSnap.data();
        console.log('✅ Complete lender data loaded:', this.lenderData);

        // Log specific sections for debugging
        console.log('Product Info:', this.lenderData.productInfo);
        console.log('Footprint Info:', this.lenderData.footprintInfo);
      }
    } catch (error) {
      console.error('❌ Error loading complete lender data:', error);
    }
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
   * Fetch user profile from firestoreSService.firestore
   */
  private async fetchUserProfile(fbUser: FirebaseUser): Promise<void> {
    if (!fbUser || !fbUser.uid) {
      this.handleNoAuthenticatedUser();
      return;
    }

    this.accountNumber = fbUser.uid.substring(0, 8);

    // Try lenders collection first
    const lenderDocRef = doc(
      this.firestoreService.firestore,
      `lenders/${fbUser.uid}`
    );
    const lenderSnap = await getDoc(lenderDocRef);

    if (lenderSnap.exists()) {
      await this.handleExistingUserProfile(lenderSnap, fbUser);
      return;
    }

    // If not found in lenders, try originators collection
    const userDocRef = doc(
      this.firestoreService.firestore,
      `originators/${fbUser.uid}`
    );
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      await this.handleExistingUserProfile(userSnap, fbUser);
      return;
    }

    // If not found in either collection
    await this.handleMissingUserProfile(fbUser);
  }

  async handleExistingUserProfile(
    docSnap: any,
    fbUser: FirebaseUser
  ): Promise<void> {
    console.log('DashboardComponent - User profile found:', docSnap.data());

    const data = docSnap.data();

    if (data.role === 'lender') {
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
      this.loadNotificationPreferencesFromService();
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

    // Load role-specific data
    if (this.userRole === 'lender' && fbUser.uid) {
      await this.loadLenderCompleteData();
      await this.loadSavedLoans(fbUser.uid);
    }

    if (this.userRole === 'originator' && fbUser.uid) {
      await this.loadSavedLenders(fbUser.uid);
    }

    if (fbUser.uid) {
      await this.loadLoans(fbUser.uid);
    }
    this.loading = false;
  }
  /**
   * ✅ FIXED: Load notification preferences with proper error handling and signal updates
   */
  private loadNotificationPreferencesFromService(): void {
    console.log('🔍 Loading notification preferences...');

    this.authService.isLoggedIn$
      .pipe(
        filter((isLoggedIn: boolean) => isLoggedIn),
        take(1),
        switchMap(() => {
          console.log('🔍 Calling getNotificationPreferences...');
          return this.notificationPreferencesService.getNotificationPreferences();
        })
      )
      .subscribe({
        next: (preferences: any) => {
          console.log('🔍 Raw server response:', preferences);
          console.log(
            '🔍 wantsEmailNotifications value:',
            preferences?.wantsEmailNotifications
          );

          const actualPrefs =
            preferences?.data?.preferences ||
            preferences?.preferences ||
            preferences;

          if (actualPrefs) {
            // ✅ Use actualPrefs instead of preferences
            this.notificationPrefs.set({
              wantsEmailNotifications:
                actualPrefs.wantsEmailNotifications || false, // ← Use actualPrefs!
              propertyCategories: actualPrefs.propertyCategory || [],
              subcategorySelections: actualPrefs.subcategorySelections || [],
              loanTypes: actualPrefs.loanTypes || [],
              minLoanAmount: actualPrefs.minLoanAmount || 0,
              ficoScore: actualPrefs.ficoScore || 0,
              footprint: actualPrefs.footprint || [],
            });
            console.log(
              '✅ Updated notification preferences signal:',
              this.notificationPrefs()
            );
          } else {
            console.warn(
              '⚠️ No notification preferences found. Using defaults.'
            );
            this.notificationPrefs.set({
              wantsEmailNotifications: false,
              propertyCategories: [],
              subcategorySelections: [],
              loanTypes: [],
              minLoanAmount: 0,
              ficoScore: 0,
              footprint: [],
            });
          }
        },
        error: (error: any) => {
          console.error('❌ Error loading notification preferences:', error);
          this.notificationPrefs.set({
            wantsEmailNotifications: false,
            propertyCategories: [],
            subcategorySelections: [],
            loanTypes: [],
            minLoanAmount: 0,
            ficoScore: 0,
            footprint: [],
          });
        },
      });
  }

  /**
   * ✅ FIXED: Toggle notification opt-in with proper signal updates
   */
  toggleNotificationOptIn(event: Event): void {
    const input = event.target as HTMLInputElement;
    const newStatus = input.checked;

    console.log('🔄 Toggling notification opt-in to:', newStatus);

    // ✅ Set saving state
    this.savingOptIn.set(true);

    // ✅ Optimistically update the UI by updating the signal
    const currentPrefs = this.notificationPrefs();
    this.notificationPrefs.set({
      ...currentPrefs,
      wantsEmailNotifications: newStatus,
    });

    // ✅ Save to backend
    this.emailNotificationService
      .toggleEmailNotificationsCallable(newStatus)
      .pipe(
        finalize(() => {
          // ✅ Always clear saving state when done
          this.savingOptIn.set(false);
        })
      )
      .subscribe({
        next: (response) => {
          console.log(
            '✅ Notification opt-in status updated via Cloud Function:',
            response
          );
        },
        error: (error) => {
          console.error(
            '❌ Error toggling notification opt-in via Cloud Function:',
            error
          );

          // ✅ Revert the optimistic update on error
          const revertedPrefs = this.notificationPrefs();
          this.notificationPrefs.set({
            ...revertedPrefs,
            wantsEmailNotifications: !newStatus,
          });

          // ✅ Show user-friendly error message
          alert('Failed to update notification preferences. Please try again.');
        },
      });
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
        createdAt: createTimestamp(),
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

    this.loanService.loadLoans(userId).subscribe({
      next: (serviceLoans: LoanModel[]) => {
        console.log(`✅ Dashboard: Loaded ${serviceLoans.length} loans`);
        this.loans.set(serviceLoans);
        this.loansLoading.set(false); // ✅ Reset loading state
      },
      error: (error: any) => {
        console.error('❌ Error loading loans:', error);
        this.loansError.set('Failed to load your loans. Please try again.');
        this.loansLoading.set(false); // ✅ Reset loading state on error
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
        console.log('Loading saved loans for user ID:', userId);
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

    const savedLoansCollectionRef = collection(
      this.firestoreService.firestore,
      'loanFavorites'
    );
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
      createdAt: createTimestamp(),
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
    const savedLoan = this.savedLoans().find((loan) => loan.id === savedLoanId);

    if (!savedLoan) {
      console.error('Saved loan not found:', savedLoanId);
      return;
    }

    const confirmed = await this.modalService.openRemoveSavedLoanModal(
      savedLoan.loanData
    );

    if (confirmed) {
      try {
        const savedLoanDocRef = doc(
          this.firestoreService.firestore,
          `loanFavorites/${savedLoanId}`
        );

        await deleteDoc(savedLoanDocRef);

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
   * ✅ FIXED: Toggle methods using proper signal access
   */
  togglePropertyCategory(categoryValue: string): void {
    const currentPrefs = this.notificationPrefs();
    const currentCategories = [...currentPrefs.propertyCategories];
    const index = currentCategories.indexOf(categoryValue);

    if (index > -1) {
      currentCategories.splice(index, 1);
    } else {
      currentCategories.push(categoryValue);
    }

    this.notificationPrefs.set({
      ...currentPrefs,
      propertyCategories: currentCategories,
    });
  }

  toggleSubcategorySelection(subcategoryValue: string): void {
    const currentPrefs = this.notificationPrefs();
    const currentSelections = [...currentPrefs.subcategorySelections];
    const index = currentSelections.indexOf(subcategoryValue);

    if (index > -1) {
      currentSelections.splice(index, 1);
    } else {
      currentSelections.push(subcategoryValue);
    }

    this.notificationPrefs.set({
      ...currentPrefs,
      subcategorySelections: currentSelections,
    });
  }

  toggleLoanType(loanTypeValue: string): void {
    const currentPrefs = this.notificationPrefs();
    const currentLoanTypes = [...currentPrefs.loanTypes];
    const index = currentLoanTypes.indexOf(loanTypeValue);

    if (index > -1) {
      currentLoanTypes.splice(index, 1);
    } else {
      currentLoanTypes.push(loanTypeValue);
    }

    this.notificationPrefs.set({
      ...currentPrefs,
      loanTypes: currentLoanTypes,
    });
  }

  toggleFootprintState(state: string): void {
    const currentPrefs = this.notificationPrefs();
    const currentFootprint = [...currentPrefs.footprint];
    const index = currentFootprint.indexOf(state);

    if (index > -1) {
      currentFootprint.splice(index, 1);
    } else {
      currentFootprint.push(state);
    }

    this.notificationPrefs.set({
      ...currentPrefs,
      footprint: currentFootprint,
    });
  }

  // ✅ FIXED: Helper methods using proper signal access
  isCategorySelected(categoryValue: string): boolean {
    return this.notificationPrefs().propertyCategories.includes(categoryValue);
  }

  isSubcategorySelected(subcategoryValue: string): boolean {
    return this.notificationPrefs().subcategorySelections.includes(
      subcategoryValue
    );
  }

  isLoanTypeSelected(loanTypeValue: string): boolean {
    return this.notificationPrefs().loanTypes.includes(loanTypeValue);
  }

  isStateSelected(state: string): boolean {
    return this.notificationPrefs().footprint.includes(state);
  }

  // ✅ Helper methods for display names
  getCategoryDisplayName(categoryValue: string): string {
    const category = this.allPropertyCategoryOptions.find(
      (cat) => cat.value === categoryValue
    );
    return category ? category.displayName : categoryValue;
  }

  getLoanTypeDisplayName(loanTypeValue: string): string {
    const loanType = this.allLoanTypeOptions.find(
      (type) => type.value === loanTypeValue
    );
    return loanType ? loanType.displayName : loanTypeValue;
  }

  getLenderProductInfo(): any {
    return this.lenderData?.productInfo || null;
  }

  /**
   * Get lender footprint info for display
   */
  getLenderFootprintInfo(): any {
    return this.lenderData?.footprintInfo || null;
  }

  /**
   * Check if lender has complete profile
   */
  lenderHasCompleteProfile(): boolean {
    return !!(this.lenderData?.productInfo && this.lenderData?.footprintInfo);
  }
  get formattedPropertyTypes(): string {
    return this.notificationPrefs()
      .propertyCategories.map((cat) => this.getCategoryDisplayName(cat))
      .join(', ');
  }

  get formattedLoanTypes(): string {
    return this.notificationPrefs()
      .loanTypes.map((type) => this.getLoanTypeDisplayName(type))
      .join(', ');
  }

  get formattedFootprintStates(): string {
    return this.notificationPrefs()
      .footprint.map((state) => this.getFormattedStateName(state))
      .join(', ');
  }

  onMinLoanAmountChange(event: any): void {
    const value = event.target.value;
    const numericValue = parseFloat(value.toString().replace(/[^0-9.]/g, ''));
    const currentPrefs = this.notificationPrefs();

    this.notificationPrefs.set({
      ...currentPrefs,
      minLoanAmount: isNaN(numericValue) ? 0 : numericValue,
    });
  }

  // ✅ FIXED: Reset method using proper signal updates
  resetNotificationPreferences(): void {
    if (
      confirm(
        'Are you sure you want to reset all notification preferences to defaults?'
      )
    ) {
      this.notificationPrefs.set({
        wantsEmailNotifications: false,
        propertyCategories: [],
        subcategorySelections: [],
        loanTypes: [],
        minLoanAmount: 0,
        ficoScore: 0,
        footprint: [],
      });

      console.log('Notification preferences reset to defaults');
    }
  }

  async debugNotificationPreferences(): Promise<void> {
    console.log('=== NOTIFICATION PREFERENCES DEBUG ===');
    console.log('Current component preferences:', this.notificationPrefs());
    console.log('User role:', this.userRole);
    console.log('Is lender:', this.isLender());

    if (this.userRole === 'lender') {
      this.notificationPreferencesService
        .getNotificationPreferences()
        .subscribe({
          next: (serverPrefs) => {
            if (!serverPrefs) {
              console.error('No server preferences found.');
              return;
            }
            console.log('✅ Server preferences:', serverPrefs);
            console.log(
              'Email Notifications Enabled:',
              serverPrefs.wantsEmailNotifications
            );
            console.log('Property Categories:', serverPrefs.propertyCategories);
            console.log(
              'Subcategory Selections:',
              serverPrefs.subcategorySelections
            );
            console.log('Loan Types:', serverPrefs.loanTypes);
            console.log('Minimum Loan Amount:', serverPrefs.minLoanAmount);
            console.log('FICO Score:', serverPrefs.ficoScore);
            console.log('Footprint:', serverPrefs.footprint);
          },
          error: (error) => {
            console.error('Error loading server preferences:', error);
          },
        });
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

    favorites.forEach((favorite) => {
      this.lenderService.getLender(favorite.lenderId).subscribe({
        next: (lender) => {
          if (lender) {
            lendersWithDetails.push({
              ...favorite,
              lenderData: lender,
            });
          } else {
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

  getFormattedLoanTypes(): string {
    return this.notificationPrefs()
      .loanTypes.map((lt) => this.getLoanTypeDisplayName(lt))
      .join(', ');
  }

  // ✅ UPDATED: Dashboard Component Lender Methods with Angular 18 best practices
  // Replace these methods in your dashboard.component.ts

  /**
   * ✅ FIXED: Get lender contact name with proper null checking
   */
  getLenderContactName(lenderFavorite: any): string {
    if (
      !lenderFavorite?.lenderData ||
      lenderFavorite.lenderData.notFound ||
      lenderFavorite.lenderData.error
    ) {
      return 'Not specified';
    }

    // ✅ Match exact Lender model structure with fallbacks
    const firstName =
      lenderFavorite.lenderData.contactInfo?.firstName ||
      lenderFavorite.lenderData.firstName ||
      '';
    const lastName =
      lenderFavorite.lenderData.contactInfo?.lastName ||
      lenderFavorite.lenderData.lastName ||
      '';

    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || 'Not specified';
  }

  /**
   * ✅ FIXED: Get lender company name with all possible fallback locations
   */
  getLenderCompanyName(lenderFavorite: any): string {
    if (!lenderFavorite?.lenderData) {
      return 'Unknown Company';
    }

    // ✅ Check all possible company locations per Lender model
    const topLevelCompany = lenderFavorite.lenderData.company;
    const contactInfoCompany = lenderFavorite.lenderData.contactInfo?.company;

    const company = (topLevelCompany || contactInfoCompany || '').trim();

    if (company && company !== '') {
      return company;
    }

    // ✅ Fallback to name-based company if no company specified
    const firstName =
      lenderFavorite.lenderData.contactInfo?.firstName ||
      lenderFavorite.lenderData.firstName ||
      '';
    const lastName =
      lenderFavorite.lenderData.contactInfo?.lastName ||
      lenderFavorite.lenderData.lastName ||
      '';
    const fullName = `${firstName} ${lastName}`.trim();

    return fullName ? `${fullName}'s Company` : 'Unknown Company';
  }

  /**
   * ✅ FIXED: Get lender types with updated data access matching Lender model
   */
  getLenderTypes(lenderFavorite: any): string {
    if (!lenderFavorite?.lenderData) {
      return 'general';
    }

    // ✅ Check both productInfo.lenderTypes and top-level lenderTypes per Lender model
    const productInfoTypes = lenderFavorite.lenderData.productInfo?.lenderTypes;
    const topLevelTypes = lenderFavorite.lenderData.lenderTypes;

    const lenderTypes = productInfoTypes || topLevelTypes || [];

    if (!Array.isArray(lenderTypes) || lenderTypes.length === 0) {
      return 'general';
    }

    // ✅ Get first lender type and format it
    const firstType = lenderTypes[0];

    // ✅ Handle both string and object formats
    if (typeof firstType === 'string') {
      return this.getLenderTypeName(firstType);
    }

    if (typeof firstType === 'object' && firstType?.name) {
      return firstType.name;
    }

    if (typeof firstType === 'object' && firstType?.value) {
      return this.getLenderTypeName(firstType.value);
    }

    return 'general';
  }

  /**
   * ✅ FIXED: Get lender loan range matching Lender model structure
   */
  getLenderLoanRange(lenderFavorite: any): string {
    if (!lenderFavorite?.lenderData) {
      return '$100,000 - $10,000,000';
    }

    // ✅ Check both productInfo and top-level amounts per Lender model
    const productInfo = lenderFavorite.lenderData.productInfo;
    const topLevel = lenderFavorite.lenderData;

    const minAmount =
      productInfo?.minLoanAmount || topLevel?.minLoanAmount || 0;
    const maxAmount =
      productInfo?.maxLoanAmount || topLevel?.maxLoanAmount || 0;

    // ✅ Handle number | string types as defined in Lender model
    const minValue =
      typeof minAmount === 'string'
        ? parseFloat(minAmount.replace(/[^\d.-]/g, ''))
        : Number(minAmount);
    const maxValue =
      typeof maxAmount === 'string'
        ? parseFloat(maxAmount.replace(/[^\d.-]/g, ''))
        : Number(maxAmount);

    if (
      (minValue === 0 || isNaN(minValue)) &&
      (maxValue === 0 || isNaN(maxValue))
    ) {
      return '$100,000 - $10,000,000'; // ✅ Default fallback
    }

    // ✅ Format both amounts consistently
    const formattedMin = this.formatCurrency(minValue || 100000);
    const formattedMax = this.formatCurrency(maxValue || 10000000);

    return `${formattedMin} - ${formattedMax}`;
  }

  /**
   * ✅ ENHANCED: Improved lender type name mapping matching registration cleanup
   */
  getLenderTypeName(value: string): string {
    if (!value) return 'General Lender';

    // ✅ Updated mapping to match your registration cleanup naming conventions
    const lenderTypeMap: { [key: string]: string } = {
      // New standardized format (snake_case)
      agency: 'Agency Lender',
      balance_sheet: 'Balance Sheet',
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
      general: 'General Lender',
      hard_money: 'Hard Money Lender',
      life_insurance: 'Life Insurance Lender',
      mezzanine_lender: 'Mezzanine Lender',
      non_qm_lender: 'Non-QM Lender',
      portfolio_lender: 'Portfolio Lender',
      private_lender: 'Private Lender',
      sba: 'SBA Lender',
      usda: 'USDA Lender',

      // Legacy format support (camelCase/spaces) for backward compatibility
      balanceSheet: 'Balance Sheet',
      'balance sheet': 'Balance Sheet',
      bridgeLender: 'Bridge Lender',
      'bridge lender': 'Bridge Lender',
      conduitLender: 'Conduit Lender (CMBS)',
      'conduit lender': 'Conduit Lender (CMBS)',
      constructionLender: 'Construction Lender',
      'construction lender': 'Construction Lender',
      correspondentLender: 'Correspondent Lender',
      'correspondent lender': 'Correspondent Lender',
      creditUnion: 'Credit Union',
      'credit union': 'Credit Union',
      directLender: 'Direct Lender',
      'direct lender': 'Direct Lender',
      familyOffice: 'Family Office',
      'family office': 'Family Office',
      hardMoney: 'Hard Money Lender',
      'hard money': 'Hard Money Lender',
      lifeInsurance: 'Life Insurance Lender',
      'life insurance': 'Life Insurance Lender',
      mezzanineLender: 'Mezzanine Lender',
      'mezzanine lender': 'Mezzanine Lender',
      nonQmLender: 'Non-QM Lender',
      'non qm lender': 'Non-QM Lender',
      'non-qm lender': 'Non-QM Lender',
      portfolioLender: 'Portfolio Lender',
      'portfolio lender': 'Portfolio Lender',
      privateLender: 'Private Lender',
      'private lender': 'Private Lender',
    };

    // ✅ Try exact match first
    if (lenderTypeMap[value]) {
      return lenderTypeMap[value];
    }

    // ✅ Try case-insensitive match
    const lowerValue = value.toLowerCase();
    const foundKey = Object.keys(lenderTypeMap).find(
      (key) => key.toLowerCase() === lowerValue
    );

    if (foundKey) {
      return lenderTypeMap[foundKey];
    }

    // ✅ Fallback: format the value nicely
    return (
      value
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase())
        .trim() || 'General Lender'
    );
  }

  // ✅ DEBUGGING: Add this method temporarily to identify data structure issues
  debugLenderDataStructure(): void {
    console.log('=== LENDER DATA STRUCTURE DEBUG ===');
    console.log(
      'savedLendersWithDetails signal:',
      this.savedLendersWithDetails()
    );

    const firstLender = this.savedLendersWithDetails()[0];
    if (firstLender) {
      console.log('First lender structure:', firstLender);
      console.log('lenderData structure:', firstLender.lenderData);

      if (firstLender.lenderData) {
        console.log('contactInfo:', firstLender.lenderData.contactInfo);
        console.log('productInfo:', firstLender.lenderData.productInfo);
        console.log('footprintInfo:', firstLender.lenderData.footprintInfo);
        console.log('company (top-level):', firstLender.lenderData.company);

        // Check all top-level properties
        console.log(
          'All lenderData properties:',
          Object.keys(firstLender.lenderData)
        );

        if (firstLender.lenderData.contactInfo) {
          console.log(
            'All contactInfo properties:',
            Object.keys(firstLender.lenderData.contactInfo)
          );
        }

        if (firstLender.lenderData.productInfo) {
          console.log(
            'All productInfo properties:',
            Object.keys(firstLender.lenderData.productInfo)
          );
          console.log(
            'lenderTypes array:',
            firstLender.lenderData.productInfo.lenderTypes
          );
          console.log(
            'minLoanAmount:',
            firstLender.lenderData.productInfo.minLoanAmount
          );
          console.log(
            'maxLoanAmount:',
            firstLender.lenderData.productInfo.maxLoanAmount
          );
        }
      }
    }
  }

  viewLenderDetails(lenderId: string): void {
    this.router.navigate(['/lender-details', lenderId]);
  }

  /**
   * Remove a saved lender
   */
  async removeSavedLender(savedFavoriteId: string): Promise<void> {
    const savedLender = this.savedLendersWithDetails().find(
      (lender) => lender.id === savedFavoriteId
    );

    if (!savedLender) {
      console.error('Saved lender not found:', savedFavoriteId);
      return;
    }

    const confirmed = await this.modalService.openRemoveSavedLenderModal(
      savedLender.lenderData
    );

    if (confirmed) {
      try {
        const docRef = doc(
          this.firestoreService.firestore,
          `originatorLenderFavorites/${savedFavoriteId}`
        );
        await deleteDoc(docRef);

        const currentFavorites = this.savedLenders();
        this.savedLenders.set(
          currentFavorites.filter((fav) => fav.id !== savedFavoriteId)
        );

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

  formatPropertyCategory(category: string): string {
    const categoryOption = this.allPropertyCategoryOptions.find(
      (opt) => opt.value === category
    );
    return categoryOption ? categoryOption.displayName : category;
  }

  formatPropertySubcategory(subcategory: PropertySubcategoryValue): string {
    return getPropertySubcategoryName(
      LoanUtils.getSubcategoryValue(subcategory)
    );
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

  goToMatches(loanId: string): void {
    this.router.navigate(['/loan', loanId, 'matches']);
  }

  /**
   * Delete a loan
   */
  async deleteLoan(loanId: string): Promise<void> {
    const loanToDelete = this.loans().find((loan) => loan.id === loanId);

    if (!loanToDelete) {
      console.error('Loan not found:', loanId);
      return;
    }

    const confirmed = await this.modalService.openDeletePublishedLoanModal(
      loanToDelete
    );

    if (confirmed) {
      try {
        const loanDocRef = doc(
          this.firestoreService.firestore,
          `loans/${loanId}`
        );
        await deleteDoc(loanDocRef);

        const currentLoans = this.loans();
        this.loans.set(currentLoans.filter((loan) => loan.id !== loanId));

        alert('Loan deleted successfully');
      } catch (error) {
        console.error('Error deleting loan:', error);
        alert('Failed to delete loan: ' + this.getErrorMessage(error));
      }
    }
  }

  // ✅ FIXED: Toggle all states using proper signal updates
  toggleAllStates(): void {
    const currentPrefs = this.notificationPrefs();

    if (this.areAllStatesSelected()) {
      // Deselect all states
      this.notificationPrefs.set({
        ...currentPrefs,
        footprint: [],
      });
    } else {
      // Select all states
      this.notificationPrefs.set({
        ...currentPrefs,
        footprint: [...this.allStates],
      });
    }
  }

  // ✅ FIXED: Helper methods using proper signal access
  areAllStatesSelected(): boolean {
    return this.notificationPrefs().footprint.length === this.allStates.length;
  }

  areSomeStatesSelected(): boolean {
    const footprintLength = this.notificationPrefs().footprint.length;
    return footprintLength > 0 && footprintLength < this.allStates.length;
  }

  /**
   * Delete user account
   */
  async deleteAccount(): Promise<void> {
    const userType = this.userRole as 'lender' | 'originator';

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

  private async deleteUserAndLogout(): Promise<void> {
    if (!this.userData || !this.userData.id) {
      throw new Error('User account information not available');
    }

    const collectionName =
      this.userRole === 'lender' ? 'lenders' : 'originators';
    const userDocRef = doc(
      this.firestoreService.firestore,
      `${collectionName}/${this.userData.id}`
    );
    await deleteDoc(userDocRef);

    this.authService.logout().subscribe({
      next: () => {
        alert('Your account has been deleted successfully');
        this.router.navigate(['/']);
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
