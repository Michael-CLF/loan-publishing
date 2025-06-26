// dashboard.component.ts
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { User as FirebaseUser } from '@angular/fire/auth';
import {
  NotificationPreferencesService,
} from '../services/notification-preferences.service';
import {
  LenderNotificationPreferences,
  DEFAULT_LENDER_NOTIFICATION_PREFERENCES
} from '../types/notification.types';
import {
  Firestore,
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
import { ModalService } from '../services/modal.service';

// Services
import { AuthService } from '../services/auth.service';
import { FirestoreService } from '../services/firestore.service';
import { LenderService } from '../services/lender.service';
import { LoanService } from '../services/loan.service';
import { EmailNotificationService } from '../services/email-notification.service';

// Models
import { Loan as LoanModel } from '../models/loan-model.model';
import { SavedLoan } from '../models/saved-loan.model';
import { Loan } from '../models/loan-model.model';
import { getUserId } from '../utils/user-helpers';
import { UserData } from '../models';
import { LocationService } from '../services/location.service';
import { createTimestamp } from '../utils/firebase.utils';
import { getPropertySubcategoryName } from '../shared/constants/property-mappings';
import { LoanUtils, PropertySubcategoryValue } from '../models/loan-model.model';
import { getStateName } from '../shared/constants/state-mappings';
import { UserRegSuccessModalComponent } from '../modals/user-reg-success-modal/user-reg-success-modal.component';
import { LenderRegSuccessModalComponent } from 'src/modals/lender-reg-success-modal/lender-reg-success-modal.component';


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
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, UserRegSuccessModalComponent, LenderRegSuccessModalComponent],
})
export class DashboardComponent implements OnInit {
  // Dependency injection
  private readonly authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly firestore = inject(Firestore);
  private readonly firestoreService = inject(FirestoreService);
  private readonly lenderService = inject(LenderService);
  private readonly loanService = inject(LoanService);
  private readonly modalService = inject(ModalService);
  public readonly locationService = inject(LocationService);
  private readonly notificationPreferencesService = inject(NotificationPreferencesService);
  private readonly emailNotificationService = inject(EmailNotificationService);

  getPropertySubcategoryName = getPropertySubcategoryName;
  getStateName = getStateName;

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
  notificationOptIn = computed(() => this.notificationPrefs().wantsEmailNotifications);

  // ✅ Signal for saving state
  savingOptIn = signal(false);
  showRegistrationSuccessModal = signal(false);
  showLenderRegistrationSuccessModal = signal(false);
  showDashboardContent = signal(false);

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
    'Commercial': '#1E90FF',
    'Healthcare': '#cb4335',
    'Hospitality': '#1b4f72',
    'Industrial': '#2c3e50',
    'Land': '#023020',
    'Mixed Use': '#8A2BE2',
    'Multifamily': '#6c3483',
    'Office': '#4682B4',
    'Residential': '#DC143C',
    'Retail': '#660000',
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
    { value: 'sba_504', displayName: 'SBA 504' }
  ];

  // Available states for footprint selection
  allStates: string[] = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
  ];

  ngOnInit(): void {
    console.log('Dashboard component initializing...');
    
    // ✅ FIXED: Check for registration success FIRST, before loading user data
    const isRegistrationSuccess = this.authService.getRegistrationSuccess() || 
                                  localStorage.getItem('showRegistrationModal') === 'true';
    
    if (isRegistrationSuccess) {
      console.log('🎉 Registration success detected - showing modal first');
      this.handleRegistrationSuccessFlow();
    } else {
      console.log('📋 No registration success - proceeding with normal dashboard load');
      this.showDashboardContent.set(true);
      this.subscribeToAuthState();
    }
  }

  private handleRegistrationSuccessFlow(): void {
    // First, subscribe to auth and load minimal user data to determine role
    this.subscribeToAuthState();
    
    // Wait a moment for user data to load, then show appropriate modal
    setTimeout(() => {
      const role = this.userRole || this.userData?.role;
      
      if (role === 'lender') {
        console.log('🏢 Showing lender registration success modal');
        this.showLenderRegistrationSuccessModal.set(true);
      } else {
        console.log('👤 Showing originator registration success modal');
        this.showRegistrationSuccessModal.set(true);
      }
    }, 1000);
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

  closeRegistrationSuccessModal(): void {
    this.showRegistrationSuccessModal.set(false);
    this.authService.clearRegistrationSuccess();
    
    setTimeout(() => {
      this.showDashboardContent.set(true);
    }, 300);
  }
  /**
   * Close lender registration success modal
   */
  closeLenderRegistrationSuccessModal(): void {
    this.showLenderRegistrationSuccessModal.set(false);
    this.authService.clearRegistrationSuccess();
    
    // ✅ NEW: Show dashboard content after modal closes
    setTimeout(() => {
      this.showDashboardContent.set(true);
    }, 300);
  }

  
    /**
   * Handle logged out state
   */
  private handleLoggedOut(): void {
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
            setTimeout(() => {
              console.log('🎯 User data loaded, checking for registration success...');
            }, 100);
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
   * ✅ FIXED: Handle existing user profile with proper notification loading
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
        company: data.company || (data.contactInfo && data.contactInfo.company) || '',
        firstName: data.contactInfo?.firstName || '',
        lastName: data.contactInfo?.lastName || '',
        phone: data.contactInfo?.contactPhone || '',
        email: data.contactInfo?.contactEmail || '',
        city: data.contactInfo?.city || '',
        state: data.contactInfo?.state || '',
        role: 'lender',
      };

      // ✅ Load notification preferences for lenders AFTER user data is set
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

    this.authService.waitForAuthInit().pipe(
      switchMap(() => this.authService.isLoggedIn$),
      filter(isLoggedIn => isLoggedIn),
      take(1),
      switchMap(() => {
        console.log('🔍 Calling getNotificationPreferences...');
        return this.notificationPreferencesService.getNotificationPreferences();
      })
    ).subscribe({
      next: (preferences: any) => {
        console.log('🔍 Raw server response:', preferences);
        console.log('🔍 wantsEmailNotifications value:', preferences?.wantsEmailNotifications);

        const actualPrefs = preferences?.data?.preferences || preferences?.preferences || preferences;

        if (actualPrefs) {
          // ✅ Use actualPrefs instead of preferences
          this.notificationPrefs.set({
            wantsEmailNotifications: actualPrefs.wantsEmailNotifications || false, // ← Use actualPrefs!
            propertyCategories: actualPrefs.propertyCategory || [],
            subcategorySelections: actualPrefs.subcategorySelections || [],
            loanTypes: actualPrefs.loanTypes || [],
            minLoanAmount: actualPrefs.minLoanAmount || 0,
            ficoScore: actualPrefs.ficoScore || 0,
            footprint: actualPrefs.footprint || [],
          });
          console.log('✅ Updated notification preferences signal:', this.notificationPrefs());
        } else {


          console.warn('⚠️ No notification preferences found. Using defaults.');
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
      error: (error) => {
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
      wantsEmailNotifications: newStatus
    });

    // ✅ Save to backend
    this.emailNotificationService.toggleEmailNotificationsCallable(newStatus).pipe(
      finalize(() => {
        // ✅ Always clear saving state when done
        this.savingOptIn.set(false);
      })
    ).subscribe({
      next: (response) => {
        console.log('✅ Notification opt-in status updated via Cloud Function:', response);
      },
      error: (error) => {
        console.error('❌ Error toggling notification opt-in via Cloud Function:', error);

        // ✅ Revert the optimistic update on error
        const revertedPrefs = this.notificationPrefs();
        this.notificationPrefs.set({
          ...revertedPrefs,
          wantsEmailNotifications: !newStatus
        });

        // ✅ Show user-friendly error message
        alert('Failed to update notification preferences. Please try again.');
      }
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
          this.firestore,
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
      propertyCategories: currentCategories
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
      subcategorySelections: currentSelections
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
      loanTypes: currentLoanTypes
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
      footprint: currentFootprint
    });
  }

  // ✅ FIXED: Helper methods using proper signal access
  isCategorySelected(categoryValue: string): boolean {
    return this.notificationPrefs().propertyCategories.includes(categoryValue);
  }

  isSubcategorySelected(subcategoryValue: string): boolean {
    return this.notificationPrefs().subcategorySelections.includes(subcategoryValue);
  }

  isLoanTypeSelected(loanTypeValue: string): boolean {
    return this.notificationPrefs().loanTypes.includes(loanTypeValue);
  }

  isStateSelected(state: string): boolean {
    return this.notificationPrefs().footprint.includes(state);
  }

  // ✅ Helper methods for display names
  getCategoryDisplayName(categoryValue: string): string {
    const category = this.allPropertyCategoryOptions.find(cat => cat.value === categoryValue);
    return category ? category.displayName : categoryValue;
  }

  getLoanTypeDisplayName(loanTypeValue: string): string {
    const loanType = this.allLoanTypeOptions.find(type => type.value === loanTypeValue);
    return loanType ? loanType.displayName : loanTypeValue;
  }

  // ✅ Angular 18 Best Practice: Computed values for template
  get formattedPropertyTypes(): string {
    return this.notificationPrefs().propertyCategories
      .map(cat => this.getCategoryDisplayName(cat))
      .join(', ');
  }

  get formattedLoanTypes(): string {
    return this.notificationPrefs().loanTypes
      .map(type => this.getLoanTypeDisplayName(type))
      .join(', ');
  }

  get formattedFootprintStates(): string {
    return this.notificationPrefs().footprint
      .map(state => this.getFormattedStateName(state))
      .join(', ');
  }

  onMinLoanAmountChange(event: any): void {
    const value = event.target.value;
    const numericValue = parseFloat(value.toString().replace(/[^0-9.]/g, ''));
    const currentPrefs = this.notificationPrefs();

    this.notificationPrefs.set({
      ...currentPrefs,
      minLoanAmount: isNaN(numericValue) ? 0 : numericValue
    });
  }

  // ✅ FIXED: Reset method using proper signal updates
  resetNotificationPreferences(): void {
    if (confirm('Are you sure you want to reset all notification preferences to defaults?')) {
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
      this.notificationPreferencesService.getNotificationPreferences().subscribe({
        next: (serverPrefs) => {
          if (!serverPrefs) {
            console.error('No server preferences found.');
            return;
          }
          console.log('✅ Server preferences:', serverPrefs);
          console.log('Email Notifications Enabled:', serverPrefs.wantsEmailNotifications);
          console.log('Property Categories:', serverPrefs.propertyCategories);
          console.log('Subcategory Selections:', serverPrefs.subcategorySelections);
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
    return this.notificationPrefs().loanTypes
      .map(lt => this.getLoanTypeDisplayName(lt))
      .join(', ');
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

  getLenderCompanyName(lenderFavorite: any): string {
    if (!lenderFavorite.lenderData) {
      return 'Unknown Company';
    }

    const companyFromContactInfo =
      lenderFavorite.lenderData.contactInfo?.company;
    const firstName = lenderFavorite.lenderData.contactInfo?.firstName || '';
    const lastName = lenderFavorite.lenderData.contactInfo?.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();

    if (companyFromContactInfo && companyFromContactInfo !== '') {
      return companyFromContactInfo;
    }

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
          this.firestore,
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
    const categoryOption = this.allPropertyCategoryOptions.find(opt => opt.value === category);
    return categoryOption ? categoryOption.displayName : category;
  }

  formatPropertySubcategory(subcategory: PropertySubcategoryValue): string {
    return getPropertySubcategoryName(LoanUtils.getSubcategoryValue(subcategory));
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
        const loanDocRef = doc(this.firestore, `loans/${loanId}`);
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
        footprint: []
      });
    } else {
      // Select all states
      this.notificationPrefs.set({
        ...currentPrefs,
        footprint: [...this.allStates]
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

    const collectionName = this.userRole === 'lender' ? 'lenders' : 'originators';
    const userDocRef = doc(this.firestore, `${collectionName}/${this.userData.id}`);
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