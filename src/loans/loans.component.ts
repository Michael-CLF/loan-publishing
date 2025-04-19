// loans.component.ts
import {
  Component,
  OnInit,
  inject,
  signal,
  Injector,
  runInInjectionContext,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LoanService, Loan } from '../services/loan.service';
import {
  Firestore,
  collection,
  query,
  orderBy,
  getDocs,
} from '@angular/fire/firestore';

@Component({
  selector: 'app-loans',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './loans.component.html',
  styleUrls: ['./loans.component.css'],
})
export class LoansComponent implements OnInit {
  // Services via inject pattern (Angular 14+)
  private loanService = inject(LoanService);
  private router = inject(Router);
  private firestore = inject(Firestore);
  private injector = inject(Injector);

  propertyColorMap: { [key: string]: string } = {
    Commercial: '#1E90FF',
    Healthcare: '#cb4335',
    Hospitality: '#1b4f72',
    Industrial: '#708090',
    Land: '#023020',
    MixedUse: '#8A2BE2',
    'Multi-family': '#6c3483',
    Office: '#4682B4',
    Residential: '#DC143C',
    Retail: '#FFD700',
    SpecialPurpose: '#A52A2A',
  };

  // 👇 Accessor method
  getColor(propertyType: string): string {
    return this.propertyColorMap[propertyType] || '#000000'; // fallback to black
  }

  // State management using signals (Angular 16+)
  loans = signal<Loan[]>([]);
  loansLoading = signal<boolean>(true);
  errorMessage = signal<string | null>(null);

  ngOnInit() {
    console.log('LoansComponent initialized');
    this.loadAllLoans();
  }

  /**
   * Loads all loans directly from Firestore
   */
  async loadAllLoans(): Promise<void> {
    console.log('loadAllLoans() called');
    this.loansLoading.set(true);
    this.errorMessage.set(null);

    try {
      // Create a reference to the loans collection
      const loansCollectionRef = collection(this.firestore, 'loans');

      // Create a query for all loans, ordered by creation date
      const q = query(loansCollectionRef, orderBy('createdAt', 'desc'));

      // Execute the query within the injection context
      const querySnapshot = await runInInjectionContext(this.injector, () =>
        getDocs(q)
      );

      const allLoans: Loan[] = [];

      // Process each loan document
      querySnapshot.forEach((doc) => {
        const loanData = doc.data();
        allLoans.push({
          id: doc.id,
          ...loanData,
        } as Loan);
      });

      console.log(`Found ${allLoans.length} loans`, allLoans);

      // Update the loans signal with the fetched data
      this.loans.set(allLoans);
    } catch (error) {
      console.error('Error loading loans:', error);
      this.errorMessage.set('Failed to load loans. Please try again.');
    } finally {
      this.loansLoading.set(false);
    }
  }

  /**
   * Navigate to view a loan's details
   */
  viewLoanDetails(id: string): void {
    if (id) {
      this.router.navigate(['/loans', id]);
    }
  }

  /**
   * Navigate to edit a loan
   */
  editLoan(id: string): void {
    if (id) {
      this.router.navigate(['/loans/edit', id]);
    }
  }

  /**
   * Delete a loan
   */
  deleteLoan(id: string): void {
    if (confirm('Are you sure you want to delete this loan?')) {
      this.loanService.deleteLoan(id).subscribe({
        next: () => {
          // Update the local state by removing the deleted loan
          const updatedLoans = this.loans().filter((loan) => loan.id !== id);
          this.loans.set(updatedLoans);
        },
        error: (error) => {
          console.error('Error deleting loan:', error);
          this.errorMessage.set(
            'Failed to delete loan. Please try again later.'
          );
        },
      });
    }
  }

  /**
   * Format currency values
   */
  formatCurrency(value: string): string {
    if (!value) return '$0';

    // Remove any existing currency formatting
    const numericValue =
      typeof value === 'string' ? value.replace(/[$,]/g, '') : value;

    // Convert string to number and format as currency
    const amount = Number(numericValue);
    if (isNaN(amount)) return '$0';

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /**
   * Format date values
   */
  getFormattedDate(date: any): string {
    if (!date) return 'N/A';

    try {
      // If date is a Firebase timestamp, convert to JS Date
      const jsDate = date.toDate ? date.toDate() : new Date(date);

      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(jsDate);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  }
}
