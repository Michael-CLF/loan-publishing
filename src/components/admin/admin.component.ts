import { Component, OnInit, inject, signal } from '@angular/core';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LoanService, Loan } from '../../services/loan.service';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FirestoreService } from '../../services/firestore.service';
import { ModalService } from 'src/services/modal.service';

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

  // Secret admin code
  private readonly adminCode = 'gk#1uykG&R%pH*2L10UW1';

  // Authentication state
  adminAuthenticated = signal(false);
  enteredCode = '';
  codeError = signal(false);

  // Data signals
  lenders = signal<any[]>([]);
  originators = signal<any[]>([]);
  loans = signal<any[]>([]);

  // UI state signals
  loading = signal(false);
  error = signal<string | null>(null);

  // Cached originator and lender data for loan association
  private originatorsMap = new Map<string, any>();
  private lendersMap = new Map<string, any>();
  private originatorNames = new Map<string, string>();

  ngOnInit() {
    // Check if already authenticated from previous session
    const isAuthenticated = localStorage.getItem('adminAccess') === 'true';

    // Initialize the signal
    this.adminAuthenticated.set(isAuthenticated);
    console.log('Admin authenticated state:', isAuthenticated);

    // If already authenticated, load the data
    if (isAuthenticated) {
      this.loadAllData();
    }
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
    } catch (err) {
      console.error('Error loading data:', err);
      this.error.set('Failed to load data. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async loadOriginatorsAndLenders() {
    try {
      // Clear existing maps
      this.originatorsMap.clear();
      this.lendersMap.clear();
      this.originatorNames.clear();

      // Load originators from 'originators' collection
      console.log('Loading originators from originators collection...');
      const originatorsRef = collection(this.firestore, 'originators');
      const originatorsSnapshot = await getDocs(originatorsRef);
      console.log(
        'Originators snapshot received:',
        originatorsSnapshot.docs.length,
        'documents'
      );

      // Log the structure of the first originator document if available
      if (originatorsSnapshot.docs.length > 0) {
        const firstOriginator = originatorsSnapshot.docs[0].data();
        console.log('First originator document structure:', firstOriginator);
      }

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
          createdAt: data['createdAt'],
          role: 'originator',
        };

        const userId = data['userId'] || doc.id;
        this.originatorsMap.set(userId, originator);

        const fullName =
          `${originator.firstName} ${originator.lastName}`.trim();
        this.originatorNames.set(userId, fullName || originator.email || 'N/A');

        return originator;
      });

      // Load lenders from 'lenders' collection
      console.log('Loading lenders from lenders collection...');
      const lendersRef = collection(this.firestore, 'lenders');
      const lendersSnapshot = await getDocs(lendersRef);
      console.log(
        'Lenders snapshot received:',
        lendersSnapshot.docs.length,
        'documents'
      );

      // Log the structure of the first lender document if available
      if (lendersSnapshot.docs.length > 0) {
        const firstLender = lendersSnapshot.docs[0].data();
        console.log('First lender document structure:', firstLender);
      }

      const lendersData = lendersSnapshot.docs.map((doc) => {
        const data = doc.data();
        const contactInfo = data['contactInfo'] || {};

        const lender = {
          id: doc.id,
          accountNumber: doc.id.substring(0, 8).toUpperCase(),
          firstName: contactInfo['firstName'] || '',
          lastName: contactInfo['lastName'] || '',
          email: contactInfo['contactEmail'] || '',
          company: data['company'] || contactInfo['company'] || '',
          city: contactInfo['city'] || '',
          state: contactInfo['state'] || '',
          createdAt: data['createdAt'] || new Date(),
          role: 'lender',
        };

        // Store in map for quick lookup
        this.lendersMap.set(doc.id, lender);

        return lender;
      });

      // Update signals
      this.lenders.set(lendersData);
      this.originators.set(originatorsData);

      console.log('Originators loaded:', originatorsData.length);
      console.log('Lenders loaded:', lendersData.length);
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
          createdAt: data['createdAt'] || new Date(),
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
          } else {
            this.originators.set(
              this.originators().filter((u) => u.id !== user.id)
            );
          }
        })
        .catch((err: any) => {
          console.error('Error deleting user:', err);
          alert('Failed to delete user.');
        });
    });
  }

  // Format date for display
  formatDate(timestamp: any): string {
    if (!timestamp) return 'N/A';

    try {
      // Handle Firestore Timestamp
      if (timestamp.toDate) {
        return timestamp.toDate().toLocaleDateString();
      }

      // Handle regular date
      return new Date(timestamp).toLocaleDateString();
    } catch (err) {
      return 'Invalid date';
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
      return `${user.city}, ${user.state}`;
    } else if (user.city) {
      return user.city;
    } else if (user.state) {
      return user.state;
    }
    return 'N/A';
  }

  // Get status display class
  getStatusClass(loan: any): string {
    const status = (loan.status || 'pending').toLowerCase();
    return `status-${status}`;
  }
}
