import { Component, OnInit, inject, signal } from '@angular/core';
import { Firestore, collection, getDocs, doc, setDoc, serverTimestamp, updateDoc } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LoanService, Loan } from '../../services/loan.service';
import { DestroyRef } from '@angular/core';
import { FirestoreService } from '../../services/firestore.service';
import { ModalService } from 'src/services/modal.service';
import { LocationService } from '../../services/location.service';
import { CsvExportService } from '../../utils/csv-export.service';


@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css'],
})
export class AdminComponent implements OnInit {
  private firestore = inject(Firestore);
  private router = inject(Router);
  private loanService = inject(LoanService);
  private destroyRef = inject(DestroyRef);
  private firestoreService = inject(FirestoreService);
  private modalService = inject(ModalService);
  private locationService = inject(LocationService);
  private csvExportService = inject(CsvExportService);


  userFilter = '';
  filteredLenders = signal<any[]>([]);
  filteredOriginators = signal<any[]>([]);

  private readonly adminCode = 'gk#1uykG&R%pH*2L10UW1';

  adminAuthenticated = signal(false);
  enteredCode = '';
  codeError = signal(false);

  lenders = signal<any[]>([]);
  originators = signal<any[]>([]);
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

  ngOnInit() {
    const isAuthenticated = localStorage.getItem('adminAccess') === 'true';
    this.adminAuthenticated.set(isAuthenticated);
    if (isAuthenticated) {
      this.loadAllData();
    }
  

    // Initialize the signal
    this.adminAuthenticated.set(isAuthenticated);
    console.log('Admin authenticated state:', isAuthenticated);

    // If already authenticated, load the data
    if (isAuthenticated) {
      this.loadAllData();
    }
  }

  downloadUsersAsCSV(): void {
  const originators = this.originators().map(o => ({
    firstName: o.firstName || '',
    lastName: o.lastName || '',
    email: o.email || '',
    role: 'originator',
    
  }));

  console.log('Lenders:', this.lenders());
  const lenders = this.lenders().map(l => ({
    
    firstName: l.firstName || '',
    lastName: l.lastName || '',
    email: l.email || '',
    role: 'lender',
  }));

  const combined = [...originators, ...lenders].filter(u => u.email);
  const filename = `users-${new Date().toISOString().split('T')[0]}`;
  this.csvExportService.downloadCSV(combined, filename);
}



  // Helper method to get and format lender types
getLenderTypes(lender: any): string {
  // Check both possible locations for lender types
  const types = lender.lenderTypes || lender.productInfo?.lenderTypes || lender.types;
  
  // If we have an array of types, format each one and join them with commas
  if (types && Array.isArray(types) && types.length > 0) {
    return types.map(type => this.formatLenderType(type)).join(', ');
  }
  
  // If we have a single string type
  if (types && typeof types === 'string') {
    return this.formatLenderType(types);
  }
  
  // Default fallback
  return 'N/A';
}

// Helper method to format a single lender type value
private formatLenderType(type: string): string {
  if (!type) return 'N/A';
  
  // Replace underscores with spaces
  let formatted = type.replace(/_/g, ' ');
  
  // Capitalize each word
  formatted = formatted.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
    
  return formatted;
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

  verifyAdminCode() {
    if (this.enteredCode === this.adminCode) {
      localStorage.setItem('adminAccess', 'true');
      this.adminAuthenticated.set(true);
      this.codeError.set(false);
      this.loadAllData();
    } else {
      this.codeError.set(true);
    }
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

  // Helper method to standardize timestamp handling
  private normalizeTimestamp(timestamp: any): Date {
    if (!timestamp) return new Date();
    
    // Handle Firestore Timestamp objects
    if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
      return timestamp.toDate();
    }
    
    // Handle timestamp objects with seconds/nanoseconds
    if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
      return new Date(timestamp.seconds * 1000);
    }
    
    // Handle raw serverTimestamp objects
    if (timestamp && typeof timestamp === 'object' && timestamp._methodName === 'serverTimestamp') {
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

        const originator = {
          id: doc.id,
          accountNumber: doc.id.substring(0, 8).toUpperCase(),
          firstName: contactInfo['firstName'] || data['firstName'] || '',
          lastName: contactInfo['lastName'] || data['lastName'] || '',
          email: contactInfo['contactEmail'] || data['email'] || '',
          company: contactInfo['company'] || data['company'] || '',
          city: contactInfo['city'] || data['city'] || '',
          state: contactInfo['state'] || data['state'] || '',
          createdAt: this.normalizeTimestamp(data['createdAt']), // Use normalized timestamp
          role: 'originator',
        };

        // Store in maps for reference
        const userId = data['userId'] || doc.id;
        this.originatorsMap.set(userId, originator);
        this.originatorNames.set(userId, 
          `${originator.firstName} ${originator.lastName}`.trim() || 
          originator.email || 'N/A');

        return originator;
      });

      // Load lenders
      const lendersRef = collection(this.firestore, 'lenders');
      const lendersSnapshot = await getDocs(lendersRef);
      
      const lendersData = lendersSnapshot.docs.map((doc) => {
        const data = doc.data();
        const contactInfo = data['contactInfo'] || {};
        const productInfo = data['productInfo'] || {};

        const lender = {
          id: doc.id,
          accountNumber: doc.id.substring(0, 8).toUpperCase(),
          firstName: contactInfo['firstName'] || '',
          lastName: contactInfo['lastName'] || '',
          company: data['company'] || contactInfo['company'] || '',
          city: contactInfo['city'] || '',
          state: contactInfo['state'] || '',
          createdAt: this.normalizeTimestamp(data['createdAt']), // Use normalized timestamp
          role: 'lender',
          // Include lender types for display
          lenderTypes: data['lenderTypes'] || productInfo['lenderTypes'] || [],
          productInfo: productInfo,
          email: contactInfo['contactEmail'] || data['email'] || '',

        };

        // Store in map for quick lookup
        this.lendersMap.set(doc.id, lender);
        return lender;
      });

      // Update signals
      this.lenders.set(lendersData);
      this.originators.set(originatorsData);
    } catch (err) {
      console.error('Error loading originators and lenders:', err);
      throw err;
    }
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
      const name = `${originator.firstName || ''} ${
        originator.lastName || ''
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
    getDocs(lendersRef).then(snapshot => {
      if (snapshot.docs.length > 0) {
        const lenderDoc = snapshot.docs[0];
        console.log('WORKING LENDER TIMESTAMP:');
        console.log('- Lender ID:', lenderDoc.id);
        console.log('- createdAt:', lenderDoc.data()['createdAt']);
        console.log('- Type:', typeof lenderDoc.data()['createdAt']);
        if (lenderDoc.data()['createdAt']) {
          console.log('- JSON:', JSON.stringify(lenderDoc.data()['createdAt']));
          console.log('- Has toDate:', 'toDate' in lenderDoc.data()['createdAt']);
          console.log('- Properties:', Object.getOwnPropertyNames(lenderDoc.data()['createdAt']));
          console.log('- Prototype:', Object.getPrototypeOf(lenderDoc.data()['createdAt']));
        }
      }
    });
    
    // Get one originator with non-working timestamp
    const originatorsRef = collection(this.firestore, 'originators');
    getDocs(originatorsRef).then(snapshot => {
      if (snapshot.docs.length > 0) {
        const originatorDoc = snapshot.docs[0];
        console.log('NON-WORKING ORIGINATOR TIMESTAMP:');
        console.log('- Originator ID:', originatorDoc.id);
        console.log('- createdAt:', originatorDoc.data()['createdAt']);
        console.log('- Type:', typeof originatorDoc.data()['createdAt']);
        if (originatorDoc.data()['createdAt']) {
          console.log('- JSON:', JSON.stringify(originatorDoc.data()['createdAt']));
          console.log('- Has toDate:', 'toDate' in originatorDoc.data()['createdAt']);
          console.log('- Properties:', Object.getOwnPropertyNames(originatorDoc.data()['createdAt']));
          console.log('- Prototype:', Object.getPrototypeOf(originatorDoc.data()['createdAt']));
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
        company: 'Test Company'
      }
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
    if (timestamp && 
        typeof timestamp === 'object' && 
        '_methodName' in timestamp && 
        timestamp._methodName === 'serverTimestamp') {
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
    if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
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
    
    alert(`Fixed ${result.fixed} out of ${result.total} documents with timestamp issues.`);
    
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

  // Exit admin mode
  exitAdminMode(): void {
    localStorage.removeItem('adminAccess');
    this.adminAuthenticated.set(false);
    this.router.navigate(['/dashboard']);
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

  // Sorting methods
  sortLenders(column: string): void {
    if (this.lenderSortColumn === column) {
      this.lenderSortDirection = this.lenderSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.lenderSortColumn = column;
      this.lenderSortDirection = 'asc';
    }
    
    this.filteredLenders.update(lenders => {
      return [...lenders].sort((a, b) => {
        let valueA = this.getSortValue(a, column);
        let valueB = this.getSortValue(b, column);
        
        return this.compareValues(valueA, valueB, this.lenderSortDirection);
      });
    });
  }

  sortOriginators(column: string): void {
    if (this.originatorSortColumn === column) {
      this.originatorSortDirection = this.originatorSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.originatorSortColumn = column;
      this.originatorSortDirection = 'asc';
    }
    
    this.filteredOriginators.update(originators => {
      return [...originators].sort((a, b) => {
        let valueA = this.getSortValue(a, column);
        let valueB = this.getSortValue(b, column);
        
        return this.compareValues(valueA, valueB, this.originatorSortDirection);
      });
    });
  }

  sortLoans(column: string): void {
    if (this.loanSortColumn === column) {
      this.loanSortDirection = this.loanSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.loanSortColumn = column;
      this.loanSortDirection = 'asc';
    }
    
    this.loans.update(loans => {
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
      return `${item.firstName || ''} ${item.lastName || ''}`.trim().toLowerCase();
    } else if (column === 'location') {
      return `${item.city || ''} ${this.getFormattedStateName(item.state) || ''}`.trim().toLowerCase();
    } else if (column === 'type') {
      return this.getLenderTypes(item).toLowerCase();
    } else if (column === 'createdAt') {
      return this.normalizeTimestamp(item.createdAt).getTime();
    }
    
    // Default case - direct property access
    return (item[column] || '').toString().toLowerCase();
  }

  private compareValues(valueA: any, valueB: any, direction: 'asc' | 'desc'): number {
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

  getSortIcon(column: string, currentSortColumn: string, direction: 'asc' | 'desc'): string {
    if (column !== currentSortColumn) return '';
    return direction === 'asc' ? '↑' : '↓';
  }
}