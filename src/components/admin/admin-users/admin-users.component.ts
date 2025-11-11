import { Component, OnInit, inject, signal } from '@angular/core';
import {
  Firestore,
  collection,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
  updateDoc,
} from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { LoanService } from '../../../services/loan.service';
import { DestroyRef } from '@angular/core';
import { FirestoreService } from '../../../services/firestore.service';
import { ModalService } from 'src/services/modal.service';
import { LocationService } from '../../../services/location.service';
import { CsvExportService } from '../../../utils/csv-export.service';
import { DateUtilsService } from '../../../utils/date-utils.service';
import { UserWithActivity } from '../../../interfaces/user-activity.interface';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.css'],
})
export class AdminUsersComponent implements OnInit {
  private firestore = inject(Firestore);
  private router = inject(Router);
  private loanService = inject(LoanService);
  private destroyRef = inject(DestroyRef);
  private firestoreService = inject(FirestoreService);
  private modalService = inject(ModalService);
  private locationService = inject(LocationService);
  private csvExportService = inject(CsvExportService);
  private dateUtils = inject(DateUtilsService);
 
  userFilter = '';
  filteredLenders = signal<UserWithActivity[]>([]);
  filteredOriginators = signal<UserWithActivity[]>([]);
  lenders = signal<UserWithActivity[]>([]);
  originators = signal<UserWithActivity[]>([]);

  adminAuthenticated = signal(false);
  loans = signal<any[]>([]);

  loading = signal(false);
  error = signal<string | null>(null);

  private originatorsMap = new Map<string, any>();
  private lendersMap = new Map<string, any>();
  private originatorNames = new Map<string, string>();

  // Sorting properties
  sortColumn = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  lenderSortColumn = '';
  lenderSortDirection: 'asc' | 'desc' = 'asc';
  originatorSortColumn = '';
  originatorSortDirection: 'asc' | 'desc' = 'asc';
  loanSortColumn = '';
  loanSortDirection: 'asc' | 'desc' = 'asc';

  testTimestampFix(): void {
    console.log('🧪 TESTING TIMESTAMP FIXES:');

    // Test with your actual data format
    const stringDate = "07/30/2025, 5:03 PM";
    const firestoreTimestamp = new Date(); // Simulating current Firestore timestamp

    console.log('Original string date:', stringDate);
    console.log('Normalized string date:', this.normalizeTimestamp(stringDate));
    console.log('Formatted string date:', this.formatDate(stringDate));

    console.log('Firestore timestamp:', firestoreTimestamp);
    console.log('Normalized Firestore timestamp:', this.normalizeTimestamp(firestoreTimestamp));
    console.log('Formatted Firestore timestamp:', this.formatDate(firestoreTimestamp));
  }

 ngOnInit() {
  // Skip password check - user is already authenticated
  this.adminAuthenticated.set(true);
  this.loadAllData();
}

  downloadUsersAsCSV(): void {
    const originators = this.originators().map((o) => ({
      firstName: o.firstName || '',
      lastName: o.lastName || '',
      email: o.email || '',
      role: 'originator',
    }));

    console.log('Lenders:', this.lenders());
    const lenders = this.lenders().map((l) => ({
      firstName: l.firstName || '',
      lastName: l.lastName || '',
      email: l.email || '',
      role: 'lender',
    }));

    const combined = [...originators, ...lenders].filter((u) => u.email);
    const filename = `users-${new Date().toISOString().split('T')[0]}`;
    this.csvExportService.downloadCSV(combined, filename);
  }

  // Add this method to filter users
  applyUserFilter(): void {
    const filter = this.userFilter.toLowerCase();

    // If no filter, show all
    if (!filter) {
      this.filteredLenders.set(this.lenders());
      this.filteredOriginators.set(this.originators());
      return;
    }

    // Filter lenders
    this.filteredLenders.set(
      this.lenders().filter(
        (lender) =>
          lender.accountNumber?.toLowerCase().includes(filter) ||
          lender.company?.toLowerCase().includes(filter) ||
          lender.lastName?.toLowerCase().includes(filter)
      )
    );

    // Filter originators
    this.filteredOriginators.set(
      this.originators().filter(
        (originator) =>
          originator.accountNumber?.toLowerCase().includes(filter) ||
          originator.company?.toLowerCase().includes(filter) ||
          originator.lastName?.toLowerCase().includes(filter)
      )
    );
  }

  async loadAllData() {
    try {
      this.loading.set(true);
      this.error.set(null);

      // Load data
      await this.loadOriginatorsAndLenders();
      await this.loadLoansDirectly();

      // Initialize filtered data
      this.filteredLenders.set(this.lenders());
      this.filteredOriginators.set(this.originators());
    } catch (err) {
      console.error('Error loading data:', err);
      this.error.set('Failed to load data. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  getFormattedStateName(state?: string): string {
    if (!state) return '';
    return this.locationService.formatValueForDisplay(state);
  }

  // In admin.component.ts, replace your current normalizeTimestamp method with this:

  private normalizeTimestamp(timestamp: any): Date {
    if (!timestamp) return new Date();

    // ✅ FIX: Handle string dates FIRST (this was missing)
    if (typeof timestamp === 'string') {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Handle Firestore Timestamp objects  
    if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
      return timestamp.toDate();
    }

    // Handle timestamp objects with seconds/nanoseconds
    if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
      return new Date(timestamp.seconds * 1000);
    }

    // Handle raw serverTimestamp objects
    if (
      timestamp &&
      typeof timestamp === 'object' &&
      timestamp._methodName === 'serverTimestamp'
    ) {
      return new Date(); // Current date for display purposes
    }

    // Handle JavaScript Date objects
    if (timestamp instanceof Date) {
      return timestamp;
    }

    // Default fallback
    return new Date();
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

  async loadOriginatorsAndLenders() {
  try {
    // Clear existing maps
    this.originatorsMap.clear();
    this.lendersMap.clear();
    this.originatorNames.clear();

    // Load originators
    const originatorsRef = collection(this.firestore, 'originators');
    const originatorsSnapshot = await getDocs(originatorsRef);

    const originatorsData = originatorsSnapshot.docs.map((doc) => {
      const data = doc.data();
      const contactInfo = data['contactInfo'] || {};

      const createdAt = this.dateUtils.normalizeTimestamp(data['createdAt']);
      const lastLoginAt = data['lastLoginAt'] ? this.dateUtils.normalizeTimestamp(data['lastLoginAt']) : null;
      const daysSinceLastLogin = this.dateUtils.getDaysSinceLastLogin(lastLoginAt);
      const loginStatus = this.dateUtils.getLoginStatus(daysSinceLastLogin);

      const originator: UserWithActivity = {
        id: doc.id,
        accountNumber: doc.id.substring(0, 8).toUpperCase(),
        firstName: contactInfo['firstName'] || data['firstName'] || '',
        lastName: contactInfo['lastName'] || data['lastName'] || '',
        email: contactInfo['contactEmail'] || data['email'] || '',
        company: contactInfo['company'] || data['company'] || '',
        city: contactInfo['city'] || data['city'] || '',
        state: contactInfo['state'] || data['state'] || '',
        createdAt,
        lastLoginAt,
        daysSinceLastLogin,
        loginStatus,
        role: 'originator',
      };

      // Store in maps for reference
      const userId = data['userId'] || doc.id;
      this.originatorsMap.set(userId, originator);
      this.originatorNames.set(
        userId,
        `${originator.firstName} ${originator.lastName}`.trim() ||
          originator.email ||
          'N/A'
      );

      return originator;
    });

    // Load lenders with comprehensive fallback handling
    const lendersRef = collection(this.firestore, 'lenders');
    const lendersSnapshot = await getDocs(lendersRef);

    const lendersData = lendersSnapshot.docs.map((doc) => {
      const data = doc.data();
      const contactInfo = data['contactInfo'] || {};
      const productInfo = data['productInfo'] || {};

      const createdAt = this.dateUtils.normalizeTimestamp(data['createdAt']);
      const lastLoginAt = data['lastLoginAt'] ? this.dateUtils.normalizeTimestamp(data['lastLoginAt']) : null;
      const daysSinceLastLogin = this.dateUtils.getDaysSinceLastLogin(lastLoginAt);
      const loginStatus = this.dateUtils.getLoginStatus(daysSinceLastLogin);

      const lender: UserWithActivity = {
        id: doc.id,
        accountNumber: doc.id.substring(0, 8).toUpperCase(),
        firstName: data['firstName'] || contactInfo['firstName'] || '',
        lastName: data['lastName'] || contactInfo['lastName'] || '',
        company: data['company'] || contactInfo['company'] || '',
        city: data['city'] || contactInfo['city'] || '',
        state: data['state'] || contactInfo['state'] || '',
        email: data['email'] || contactInfo['contactEmail'] || contactInfo['email'] || '',
        phone: data['phone'] || contactInfo['contactPhone'] || contactInfo['phone'] || '',
        createdAt,
        lastLoginAt,
        daysSinceLastLogin,
        loginStatus,
        role: 'lender',
        lenderTypes: productInfo['lenderTypes'] || data['lenderTypes'] || [],
        productInfo: productInfo,
        contactInfo: contactInfo,
        _rawData: data,
      };

      // Store in map for quick lookup
      this.lendersMap.set(doc.id, lender);
      return lender;
    });

    // Update signals
    this.lenders.set(lendersData);
    this.originators.set(originatorsData);

    console.log('Admin: Loaded users with login tracking:', {
      lenders: lendersData.length,
      originators: originatorsData.length,
      lendersWithLogins: lendersData.filter(l => l.lastLoginAt).length,
      originatorsWithLogins: originatorsData.filter(o => o.lastLoginAt).length
    });
  } catch (err) {
    console.error('Error loading originators and lenders:', err);
    throw err;
  }
}
 

  // ✅ ENHANCED: Updated getLenderTypes method for admin component
  getLenderTypes(lender: any): string {
    if (!lender) return 'N/A';

    // ✅ Try all possible locations for lender types
    const types =
      lender.lenderTypes ||
      lender.productInfo?.lenderTypes ||
      lender._rawData?.productInfo?.lenderTypes ||
      lender._rawData?.lenderTypes ||
      lender.types;

    console.log(`Getting lender types for ${lender.id}:`, {
      lenderTypes: lender.lenderTypes,
      productInfoTypes: lender.productInfo?.lenderTypes,
      rawTypes: lender._rawData?.lenderTypes,
      finalTypes: types,
    });

    // If we have an array of types, format each one and join them with commas
    if (types && Array.isArray(types) && types.length > 0) {
      return types.map((type) => this.formatLenderType(type)).join(', ');
    }

    // If we have a single string type
    if (types && typeof types === 'string') {
      return this.formatLenderType(types);
    }

    // ✅ More informative fallback
    return 'General';
  }

  // ✅ ENHANCED: Better lender type formatting
  private formatLenderType(type: string | any): string {
    if (!type) return 'General';

    // ✅ Handle object format (with name or value properties)
    if (typeof type === 'object') {
      if (type.name) return type.name;
      if (type.value) return this.formatLenderTypeString(type.value);
      if (type.displayName) return type.displayName;
    }

    // ✅ Handle string format
    if (typeof type === 'string') {
      return this.formatLenderTypeString(type);
    }

    return 'General';
  }

  // ✅ NEW: Helper method to format lender type strings
  private formatLenderTypeString(type: string): string {
    if (!type) return 'General';

    // ✅ Enhanced mapping for common lender types
    const typeMap: { [key: string]: string } = {
      // Snake case format
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
      general: 'General',
      hard_money: 'Hard Money Lender',
      life_insurance: 'Life Insurance Lender',
      mezzanine_lender: 'Mezzanine Lender',
      non_qm_lender: 'Non-QM Lender',
      portfolio_lender: 'Portfolio Lender',
      private_lender: 'Private Lender',
      sba: 'SBA Lender',
      usda: 'USDA Lender',

      // Camel case format (legacy)
      balanceSheet: 'Balance Sheet',
      bridgeLender: 'Bridge Lender',
      conduitLender: 'Conduit Lender (CMBS)',
      constructionLender: 'Construction Lender',
      correspondentLender: 'Correspondent Lender',
      creditUnion: 'Credit Union',
      directLender: 'Direct Lender',
      familyOffice: 'Family Office',
      hardMoney: 'Hard Money Lender',
      lifeInsurance: 'Life Insurance Lender',
      mezzanineLender: 'Mezzanine Lender',
      nonQmLender: 'Non-QM Lender',
      portfolioLender: 'Portfolio Lender',
      privateLender: 'Private Lender',
    };

    // ✅ Try exact match first
    if (typeMap[type]) {
      return typeMap[type];
    }

    // ✅ Try case-insensitive match
    const lowerType = type.toLowerCase();
    const matchedKey = Object.keys(typeMap).find(
      (key) => key.toLowerCase() === lowerType
    );
    if (matchedKey) {
      return typeMap[matchedKey];
    }

    // ✅ Fallback: Format snake_case/camelCase to readable format
    return (
      type
        .replace(/([a-z])([A-Z])/g, '$1 $2') // Handle camelCase
        .replace(/_/g, ' ') // Handle snake_case
        .replace(/\b\w/g, (l) => l.toUpperCase()) // Capitalize each word
        .trim() || 'General'
    );
  }

  // ✅ NEW: Debug method to analyze lender data structure
  debugLenderDataStructure(): void {
    console.log('=== ADMIN LENDER DATA STRUCTURE DEBUG ===');
    const lenders = this.lenders();
    console.log(`Total lenders: ${lenders.length}`);

    lenders.forEach((lender, index) => {
      console.log(`Lender ${index + 1} (${lender.id}):`);
      console.log('- Name:', lender.firstName, lender.lastName);
      console.log('- Company:', lender.company);
      console.log('- Types:', lender.lenderTypes);
      console.log('- ContactInfo keys:', Object.keys(lender.contactInfo || {}));
      console.log('- ProductInfo keys:', Object.keys(lender.productInfo || {}));
      console.log('- Raw data keys:', Object.keys(lender._rawData || {}));
      console.log('---');
    });
  }

  async loadLoansDirectly() {
    try {
      console.log('Loading loans directly from loans collection...');
      const loansRef = collection(this.firestore, 'loans');
      const loansSnapshot = await getDocs(loansRef);
      console.log('Loans snapshot received:', loansSnapshot.docs.length);

      if (loansSnapshot.empty) {
        this.loans.set([]);
        return;
      }

      const loansData = loansSnapshot.docs.map((doc) => {
        const data = doc.data();

        const originatorId = data['originatorId'] || data['createdBy'];

        return {
          id: doc.id,
          loanAmount: this.parseAmount(data['loanAmount']),
          propertyTypeCategory:
            data['propertyTypeCategory'] || data['propertyType'] || 'Unknown',
          propertySubCategory: data['propertySubCategory'] || '',
          transactionType: data['transactionType'] || '',
          city: data['city'] || '',
          state: data['state'] || '',
          contact: data['contact'] || data['email'] || '',
          email: data['email'] || '',
          phone: data['phone'] || '',
          createdAt: this.normalizeTimestamp(data['createdAt']), // Use normalized timestamp
          createdBy: data['createdBy'] || '',
          originatorId,
          status: data['status'] || 'Pending',
          originatorName: this.getOriginatorName(originatorId),
        };
      });

      this.loans.set(loansData);
      console.log('Processed loans:', loansData.length);
    } catch (err) {
      console.error('Error loading loans:', err);
      this.error.set('Failed to load loans. Please try again.');
    }
  }

  getOriginatorName(uid?: string): string {
    if (!uid) return 'N/A';

    const originator = this.originatorsMap.get(uid);
    if (originator) {
      const name = `${originator.firstName || ''} ${originator.lastName || ''
        }`.trim();
      return name || originator.email || 'N/A';
    }

    return uid.substring(0, 8).toUpperCase(); // fallback to short UID
  }

  // Parse amount values from various formats
  parseAmount(value: any): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    if (typeof value === 'number') {
      return isNaN(value) ? 0 : value;
    }

    // Try to parse as number if it's a string
    if (typeof value === 'string') {
      // Remove currency symbols and commas
      const cleanValue = value.replace(/[$,]/g, '');
      const parsedValue = parseFloat(cleanValue);
      return isNaN(parsedValue) ? 0 : parsedValue;
    }

    return 0;
  }

  viewUser(user: any): void {
    if (user.role === 'lender') {
      this.router.navigate(['/lender-details', user.id]);
    } else if (user.role === 'originator') {
      this.router.navigate(['/originator-details', user.id]); // if this route exists
    } else {
      console.warn('Unknown user role:', user);
    }
  }

  confirmDelete(user: any): void {
    this.modalService.openDeleteAccountModal(user.role).then((confirmed) => {
      if (!confirmed) return;

      const collection = user.role === 'lender' ? 'lenders' : 'originators';

      this.firestoreService
        .deleteDocument(`${collection}/${user.id}`)
        .then(() => {
          console.log(`Deleted ${user.role}: ${user.id}`);

          // Update signal
          if (user.role === 'lender') {
            this.lenders.set(this.lenders().filter((u) => u.id !== user.id));
            // Also update filtered signal
            this.filteredLenders.set(
              this.filteredLenders().filter((u) => u.id !== user.id)
            );
          } else {
            this.originators.set(
              this.originators().filter((u) => u.id !== user.id)
            );
            // Also update filtered signal
            this.filteredOriginators.set(
              this.filteredOriginators().filter((u) => u.id !== user.id)
            );
          }
        })
        .catch((err: any) => {
          console.error('Error deleting user:', err);
          alert('Failed to delete user.');
        });
    });
  }

  // Add this to your admin component
  compareLenderAndOriginatorTimestamps() {
    // Get one lender with working timestamp
    const lendersRef = collection(this.firestore, 'lenders');
    getDocs(lendersRef).then((snapshot) => {
      if (snapshot.docs.length > 0) {
        const lenderDoc = snapshot.docs[0];
        console.log('WORKING LENDER TIMESTAMP:');
        console.log('- Lender ID:', lenderDoc.id);
        console.log('- createdAt:', lenderDoc.data()['createdAt']);
        console.log('- Type:', typeof lenderDoc.data()['createdAt']);
        if (lenderDoc.data()['createdAt']) {
          console.log('- JSON:', JSON.stringify(lenderDoc.data()['createdAt']));
          console.log(
            '- Has toDate:',
            'toDate' in lenderDoc.data()['createdAt']
          );
          console.log(
            '- Properties:',
            Object.getOwnPropertyNames(lenderDoc.data()['createdAt'])
          );
          console.log(
            '- Prototype:',
            Object.getPrototypeOf(lenderDoc.data()['createdAt'])
          );
        }
      }
    });

    // Get one originator with non-working timestamp
    const originatorsRef = collection(this.firestore, 'originators');
    getDocs(originatorsRef).then((snapshot) => {
      if (snapshot.docs.length > 0) {
        const originatorDoc = snapshot.docs[0];
        console.log('NON-WORKING ORIGINATOR TIMESTAMP:');
        console.log('- Originator ID:', originatorDoc.id);
        console.log('- createdAt:', originatorDoc.data()['createdAt']);
        console.log('- Type:', typeof originatorDoc.data()['createdAt']);
        if (originatorDoc.data()['createdAt']) {
          console.log(
            '- JSON:',
            JSON.stringify(originatorDoc.data()['createdAt'])
          );
          console.log(
            '- Has toDate:',
            'toDate' in originatorDoc.data()['createdAt']
          );
          console.log(
            '- Properties:',
            Object.getOwnPropertyNames(originatorDoc.data()['createdAt'])
          );
          console.log(
            '- Prototype:',
            Object.getPrototypeOf(originatorDoc.data()['createdAt'])
          );
        }
      }
    });
  }

  // Simple test function to create an originator with lender-style structure
  async createTestOriginator() {
    // Get current time
    const serverTime = serverTimestamp();

    // Create data exactly like a lender
    const testData = {
      uid: 'test-' + new Date().getTime(),
      id: 'test-' + new Date().getTime(),
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      company: 'Test Company',
      role: 'originator',
      createdAt: serverTime,
      updatedAt: serverTime,
      // Add nested structure like lenders have
      contactInfo: {
        firstName: 'Test',
        lastName: 'User',
        contactEmail: 'test@example.com',
        company: 'Test Company',
      },
    };

    // Add directly to originators collection
    const docRef = doc(this.firestore, `originators/${testData.id}`);
    await setDoc(docRef, testData);
    console.log('Test originator created with ID:', testData.id);

    // Reload data to see if it worked
    this.loadAllData();
  }

  formatDate(timestamp: any): string {
    if (!timestamp) return 'N/A';

    try {
      // Handle unresolved serverTimestamp placeholder
      if (
        timestamp &&
        typeof timestamp === 'object' &&
        '_methodName' in timestamp &&
        timestamp._methodName === 'serverTimestamp'
      ) {
        return 'Pending'; // Or any other message you prefer
      }

      // Handle Firestore Timestamp
      if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
        return timestamp.toDate().toLocaleDateString();
      }

      // Handle JavaScript Date objects
      if (timestamp instanceof Date) {
        return timestamp.toLocaleDateString();
      }

      // Handle timestamp objects with seconds/nanoseconds
      if (
        timestamp &&
        typeof timestamp === 'object' &&
        'seconds' in timestamp
      ) {
        return new Date(timestamp.seconds * 1000).toLocaleDateString();
      }

      // Handle string dates
      if (typeof timestamp === 'string') {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString();
        }
      }

      // Return the string value for anything else
      return String(timestamp);
    } catch (err) {
      console.error('Error formatting date:', err);
      return 'Invalid date';
    }
  }

  async fixAllTimestamps() {
    try {
      // Call the fix method from your firestore service
      const result = await this.firestoreService.fixOriginatorTimestamps();

      alert(
        `Fixed ${result.fixed} out of ${result.total} documents with timestamp issues.`
      );

      // Reload data to show the fixed timestamps
      this.loadAllData();
    } catch (error) {
      console.error('Error fixing timestamps:', error);
      alert('Failed to fix timestamps. Please try again.');
    }
  }

  // Format currency
  formatCurrency(amount: any): string {
    // Handle string inputs (convert to number)
    let numAmount: number;

    if (amount === null || amount === undefined) {
      return '-';
    }

    if (typeof amount === 'string') {
      // Remove any currency symbols and commas
      const cleanedAmount = amount.replace(/[$,]/g, '');
      numAmount = parseFloat(cleanedAmount);
    } else {
      numAmount = amount;
    }

    // Check if conversion resulted in a valid number
    if (isNaN(numAmount)) {
      return '-';
    }

    // Format as currency
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(numAmount);
  }

  exitAdminMode(): void {
  // Navigate back to admin dashboard
  this.router.navigate(['/admin/dashboard']);
}

  // Get full name from first and last name
  getFullName(user: any): string {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A';
  }

  // Get location from city and state
  getLocation(user: any): string {
    if (user.city && user.state) {
      return `${user.city}, ${this.getFormattedStateName(user.state)}`;
    } else if (user.city) {
      return user.city;
    } else if (user.state) {
      return this.getFormattedStateName(user.state);
    }
    return 'N/A';
  }

  // Get status display class
  getStatusClass(loan: any): string {
    const status = (loan.status || 'pending').toLowerCase();
    return `status-${status}`;
  }

  // Get formatted last login text
getLastLoginText(user: UserWithActivity): string {
  return this.dateUtils.formatDaysAgo(user.daysSinceLastLogin);
}

// Get status indicator class
getLoginStatusClass(user: UserWithActivity): string {
  return this.dateUtils.getStatusClass(user.loginStatus);
}

// Get status indicator color
getLoginStatusColor(user: UserWithActivity): string {
  return this.dateUtils.getStatusColor(user.loginStatus);
}

// Format creation date consistently
formatCreatedDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Format last login date consistently  
formatLastLoginDate(date: Date | null): string {
  if (!date) return 'Never';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

  // Sorting methods
  sortLenders(column: string): void {
    if (this.lenderSortColumn === column) {
      this.lenderSortDirection =
        this.lenderSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.lenderSortColumn = column;
      this.lenderSortDirection = 'asc';
    }

    this.filteredLenders.update((lenders) => {
      return [...lenders].sort((a, b) => {
        let valueA = this.getSortValue(a, column);
        let valueB = this.getSortValue(b, column);

        return this.compareValues(valueA, valueB, this.lenderSortDirection);
      });
    });
  }

  sortOriginators(column: string): void {
    if (this.originatorSortColumn === column) {
      this.originatorSortDirection =
        this.originatorSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.originatorSortColumn = column;
      this.originatorSortDirection = 'asc';
    }

    this.filteredOriginators.update((originators) => {
      return [...originators].sort((a, b) => {
        let valueA = this.getSortValue(a, column);
        let valueB = this.getSortValue(b, column);

        return this.compareValues(valueA, valueB, this.originatorSortDirection);
      });
    });
  }

  sortLoans(column: string): void {
    if (this.loanSortColumn === column) {
      this.loanSortDirection =
        this.loanSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.loanSortColumn = column;
      this.loanSortDirection = 'asc';
    }

    this.loans.update((loans) => {
      return [...loans].sort((a, b) => {
        let valueA = this.getSortValue(a, column);
        let valueB = this.getSortValue(b, column);

        return this.compareValues(valueA, valueB, this.loanSortDirection);
      });
    });
  }

  private getSortValue(item: any, column: string): any {
    // Handle special case columns
    if (column === 'name') {
      return `${item.firstName || ''} ${item.lastName || ''}`
        .trim()
        .toLowerCase();
    } else if (column === 'location') {
      return `${item.city || ''} ${this.getFormattedStateName(item.state) || ''
        }`
        .trim()
        .toLowerCase();
    } else if (column === 'type') {
      return this.getLenderTypes(item).toLowerCase();
    } else if (column === 'createdAt') {
      return this.normalizeTimestamp(item.createdAt).getTime();
    }

    // Default case - direct property access
    return (item[column] || '').toString().toLowerCase();
  }

  private compareValues(
    valueA: any,
    valueB: any,
    direction: 'asc' | 'desc'
  ): number {
    // Handle date comparison (timestamp)
    if (typeof valueA === 'number' && typeof valueB === 'number') {
      return direction === 'asc' ? valueA - valueB : valueB - valueA;
    }

    // Handle string comparison
    if (typeof valueA === 'string' && typeof valueB === 'string') {
      return direction === 'asc'
        ? valueA.localeCompare(valueB)
        : valueB.localeCompare(valueA);
    }

    // Fallback comparison
    if (valueA < valueB) return direction === 'asc' ? -1 : 1;
    if (valueA > valueB) return direction === 'asc' ? 1 : -1;
    return 0;
  }

  getSortIcon(
    column: string,
    currentSortColumn: string,
    direction: 'asc' | 'desc'
  ): string {
    if (column !== currentSortColumn) return '';
    return direction === 'asc' ? '↑' : '↓';
  }
}
