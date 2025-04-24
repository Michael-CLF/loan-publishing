import {
  Component,
  OnInit,
  inject,
  NgZone,
  DestroyRef,
  Injector,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { User } from '@angular/fire/auth';
import { take } from 'rxjs/operators';
import { of } from 'rxjs';
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
  CollectionReference,
} from '@angular/fire/firestore';

// Define a type for our user data
interface UserData {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  phone?: string;
  city?: string;
  state?: string;
  createdAt?: any;
  accountNumber?: string; // Optional property
  [key: string]: any; // Allow for additional properties
}

// Define loan interface
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

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  standalone: true,
  imports: [CommonModule],
})
export class DashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);
  private firestore = inject(Firestore);

  propertyColorMap: { [key: string]: string } = {
    Commercial: '#1E90FF',
    Healthcare: '#cb4335',
    Hospitality: '#1b4f72',
    'Industrial Property': '#2c3e50',
    Land: '#023020',
    MixedUse: '#8A2BE2',
    'Multi-family': '#6c3483',
    Office: '#4682B4',
    'Residential Property': '#DC143C',
    'Retail Property': '#660000',
    'Special Purpose': '#6e2c00',
  };

  // 👇 Accessor method
  getColor(propertyType: string): string {
    return this.propertyColorMap[propertyType] || '#000000'; // fallback to black
  }

  user: User | null = null;
  userData: UserData | null = null;
  userRole: 'originator' | 'lender' | null = null;
  loading = true;
  error: string | null = null;
  accountNumber: string = ''; // Add this property to the component

  // Loan data using signals for reactivity
  loans = signal<Loan[]>([]);
  loansLoading = signal(true);
  loansError = signal<string | null>(null);

  ngOnInit(): void {
    console.log('Dashboard component initializing...');
    this.loadUserData();
  }

  loadUserData(): void {
    console.log('Loading user data...');
    this.loading = true;
    this.error = null;

    runInInjectionContext(this.injector, async () => {
      try {
        // Get all users in the collection first to see what's available
        console.log('Fetching all users in collection...');
        const usersCollectionRef = collection(this.firestore, 'users');
        const querySnapshot = await getDocs(usersCollectionRef);

        console.log('All users in collection:');
        let foundUsers = false;
        const allUsers: UserData[] = [];

        querySnapshot.forEach((doc) => {
          foundUsers = true;
          const userData = doc.data();
          allUsers.push({ id: doc.id, ...userData } as UserData);
          console.log(`User document: ${doc.id}`, userData);
        });

        if (!foundUsers) {
          console.log('No user documents found in the users collection');
          this.error = 'No users found in database';
          this.loading = false;
          return;
        }

        // Now get the current authenticated user
        this.authService
          .getCurrentUser()
          .pipe(take(1))
          .subscribe(async (user) => {
            if (user) {
              console.log('Authenticated user:', user.email);
              console.log('Authenticated user UID:', user.uid);
              this.user = user;

              // Generate the shortened UID for the account number
              this.accountNumber = user.uid.substring(0, 8);

              // First try the direct path with the user's UID
              const userDocRef = doc(this.firestore, `users/${user.uid}`);
              const docSnap = await runInInjectionContext(this.injector, () =>
                getDoc(userDocRef)
              );

              if (docSnap.exists()) {
                // Success! Document found with matching UID
                console.log('User profile found!', docSnap.data());
                this.userData = {
                  id: docSnap.id,
                  ...docSnap.data(),
                } as UserData;

                const userRole = this.userData?.['role'];
                if (userRole === 'originator') {
                  console.log('Loading originator dashboard...');
                } else if (userRole === 'lender') {
                  console.log('Loading lender dashboard...');
                }

                this.userRole = this.userData?.['role']; // Optional: useful for template logic
                this.loading = false;

                // Load loans after user is authenticated
                this.loadLoans(user.uid);
              } else {
                console.log(`No document found at users/${user.uid}`);

                // Look for a document with matching email instead
                const authenticatedEmail = user.email?.toLowerCase();
                console.log(
                  'Looking for documents with matching email:',
                  authenticatedEmail
                );

                let foundByEmail = false;

                if (authenticatedEmail) {
                  for (const docData of allUsers) {
                    if (
                      docData.email &&
                      docData.email.toLowerCase() === authenticatedEmail
                    ) {
                      console.log(
                        `Found matching email in document with ID: ${docData.id}`
                      );
                      this.userData = docData;
                      foundByEmail = true;
                      this.loading = false;

                      // Load loans after user is authenticated
                      this.loadLoans(user.uid);
                      break;
                    }
                  }
                }

                if (!foundByEmail) {
                  // No matching document by UID or email
                  console.log('No matching user document found');
                  this.error = 'User profile not found';
                  this.loading = false;

                  // Just use the first user in the collection for testing
                  if (allUsers.length > 0) {
                    console.log(
                      'Using first available user for testing:',
                      allUsers[0]
                    );
                    this.userData = allUsers[0];
                    this.error = `Using test user: ${
                      allUsers[0].email || 'Unknown'
                    }`;

                    // Load loans for test user
                    this.loadLoans(allUsers[0].id);
                  }
                }
              }
            } else {
              console.log('No user logged in');
              this.error = 'Not logged in';
              this.loading = false;
            }
          });
      } catch (error) {
        console.error('Error in loadUserData:', error);
        this.error =
          'Error fetching data: ' +
          (error instanceof Error ? error.message : String(error));
        this.loading = false;
      }
    });
  }

  // Load loans for the authenticated user
  async loadLoans(userId: string): Promise<void> {
    console.log('Loading loans for user:', userId);
    this.loansLoading.set(true);
    this.loansError.set(null);

    try {
      // Create a reference to the loans collection
      const loansCollectionRef = collection(this.firestore, 'loans');

      // Create a query to get loans created by the current user
      const q = query(
        loansCollectionRef,
        where('createdBy', '==', userId),
        orderBy('createdAt', 'desc')
      );

      // Execute the query
      const querySnapshot = await runInInjectionContext(this.injector, () =>
        getDocs(q)
      );

      const userLoans: Loan[] = [];

      // Process each loan document
      querySnapshot.forEach((doc) => {
        const loanData = doc.data();
        userLoans.push({
          id: doc.id,
          ...loanData,
        } as Loan);
      });

      console.log(
        `Found ${userLoans.length} loans for user ${userId}`,
        userLoans
      );

      // Update the loans signal with the fetched data
      this.loans.set(userLoans);
      this.loansLoading.set(false);
    } catch (error) {
      console.error('Error loading loans:', error);
      this.loansError.set('Failed to load your loans. Please try again.');
      this.loansLoading.set(false);
    }
  }

  formatPhoneNumber(phone?: string): string {
    if (!phone) return '';

    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return phone; // fallback
  }

  // Format currency display
  formatCurrency(value: string | number): string {
    if (!value) return '$0';

    // If already formatted (has $ sign), return as is
    if (typeof value === 'string' && value.includes('$')) {
      return value;
    }

    // Convert to number if string without $ sign
    const numValue =
      typeof value === 'string'
        ? parseFloat(value.replace(/[^\d.-]/g, ''))
        : value;

    // Format as USD
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numValue);
  }

  // Get formatted date
  getFormattedDate(date: any): string {
    if (!date) return 'N/A';

    try {
      // Handle Firebase timestamp or Date object
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

  // Navigation methods
  viewLoanDetails(loanId: string): void {
    this.router.navigate(['/loans', loanId]);
  }

  editLoan(loanId: string): void {
    this.router.navigate(['/loans', loanId, 'edit']);
  }

  async deleteLoan(loanId: string): Promise<void> {
    if (confirm('Are you sure you want to delete this loan?')) {
      try {
        // Delete the loan document
        const loanDocRef = doc(this.firestore, `loans/${loanId}`);
        await runInInjectionContext(this.injector, () => deleteDoc(loanDocRef));

        // Remove the deleted loan from the displayed list
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

  // Account management methods
  editAccount(): void {
    this.router.navigate(['/account/edit']);
  }

  async deleteAccount(): Promise<void> {
    if (
      confirm(
        'Are you sure you want to delete your account? This action cannot be undone.'
      )
    ) {
      try {
        if (this.user && this.userData) {
          // Delete the user document from Firestore
          const userDocRef = doc(this.firestore, `users/${this.userData.id}`);
          await runInInjectionContext(this.injector, () =>
            deleteDoc(userDocRef)
          );

          // For now, just log out the user
          // You'll need to implement proper user deletion in your auth service
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
