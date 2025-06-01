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
import { LoanService } from '../services/loan.service';
import { Loan } from '../models/loan-model.model';
import { AuthService } from '../services/auth.service';
import { take } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { LoanTypeService } from '../services/loan-type.service';
import {
  Firestore,
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc,
  addDoc,
  deleteDoc,
  where,
} from '@angular/fire/firestore';
import { PropertyFilterComponent } from '../property-filter/property-filter.component';
import { LOAN_TYPES } from '../shared/constants/loan-constants';
import { FirestoreService } from 'src/services/firestore.service';
import { getPropertySubcategoryName } from '../shared/constants/property-mappings';
import { LoanUtils, PropertySubcategoryValue } from '../models/loan-model.model';
import { getStateName } from '../shared/constants/state-mappings';


// Property category interface for better type safety
interface PropertyCategoryOption {
  value: string;        // Snake_case for storage/matching
  displayName: string;  // User-friendly display name
}

interface LoanTypeOption {
  value: string;        // Snake_case for storage/matching  
  displayName: string;  // User-friendly display name
}

// Define the interface here instead of importing it
interface LoanFilters {
  propertyTypeCategory: string;
  state: string;
  loanType: string;
  minAmount: string;
  maxAmount: string;
  isFavorite?: boolean;
}

@Component({
  selector: 'app-loans',
  standalone: true,
  imports: [CommonModule, RouterModule, PropertyFilterComponent],
  templateUrl: './loans.component.html',
  styleUrls: ['./loans.component.css'],
})
export class LoansComponent implements OnInit {
  // Services via inject pattern (Angular 14+)
  private loanService = inject(LoanService);
  private router = inject(Router);
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  private authService = inject(AuthService);
  private firestoreService = inject(FirestoreService);
  private loanTypeService = inject(LoanTypeService);

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
  ];


 // Property colors for visualization - handle both old and new formats
propertyColorMap: Record<string, string> = {
  // New standardized format (snake_case)
  commercial: '#1E90FF',
  healthcare: '#cb4335',
  hospitality: '#1b4f72',
  industrial: '#2c3e50',
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

  // Add this to your LoansComponent class
  loanTypes = LOAN_TYPES;
  getStateName = getStateName;


  // Add this method to your component class

  formatPropertyCategory(category: string): string {
  const categoryOption = this.allPropertyCategoryOptions.find(opt => opt.value === category);
  return categoryOption ? categoryOption.displayName : category;
}

formatPropertySubcategory(subcategory: PropertySubcategoryValue): string {
  return getPropertySubcategoryName(LoanUtils.getSubcategoryValue(subcategory));
}

  getLoanTypeName(value: string): string {
    console.log('Dashboard - looking up loan type value:', value);
    return this.loanTypeService.getLoanTypeName(value);
  }

  // 👇 Accessor method
  getColor(propertyType: string): string {
    return this.propertyColorMap[propertyType] || '#000000'; // fallback to black
  }

  // State management using signals (Angular 16+)
  loans = signal<Loan[]>([]);
  allLoans = signal<Loan[]>([]); // Store all loans for filtering
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
      this.allLoans.set(allLoans); // Store all loans for filtering

      // Check favorite status after loading loans
      await this.checkFavoriteStatus();
    } catch (error) {
      console.error('Error loading loans:', error);
      this.errorMessage.set('Failed to load loans. Please try again.');
    } finally {
      this.loansLoading.set(false);
    }
  }

  /**
   * Toggles the favorite status of a loan and saves it to Firestore
   */
  async toggleFavorite(loan: Loan): Promise<void> {
    try {
      const user = await firstValueFrom(
        this.authService.getCurrentUser().pipe(take(1))
      );

      if (!user) {
        alert('Please log in to save favorites');
        this.router.navigate(['/login']);
        return;
      }
      const userId = user.uid || user.id || '';

      if (!userId) {
        console.error('User ID is missing from user object:', user);
        alert('Unable to save favorite: User ID not found');
        return;
      }

      // First check if user is a lender
      if (user.role !== 'lender') {
        alert('Only lenders can save favorite loans');
        return;
      }

      // Store current favorite state
      const isFavorite = loan.isFavorite === true;

      // Toggle for UI feedback - using explicit boolean assignment
      loan.isFavorite = !isFavorite;

      let userDocRef = doc(
        this.firestore,
        `lenders/${userId}` // Changed from users to lenders since we know it's a lender
      );

      let userDoc = await runInInjectionContext(this.injector, () =>
        getDoc(userDocRef)
      );

      if (!userDoc.exists()) {
        console.error('Lender profile not found');
        alert('Lender profile not found');

        // Revert UI state
        loan.isFavorite = isFavorite;
        return;
      }

      // Call service with the toggled boolean value
      await runInInjectionContext(this.injector, () =>
        this.firestoreService.toggleFavoriteLoan(
          userId,
          loan,
          !isFavorite // Pass the toggled boolean directly
        )
      );
    } catch (error) {
      console.error('Error toggling favorite:', error);

      // Revert UI state if operation failed - safely toggle back
      const currentState = loan.isFavorite === true;
      loan.isFavorite = !currentState;

      this.errorMessage.set(
        'Failed to update favorite status. Please try again.'
      );
    }
  }
  /**
   * Checks if each loan is favorited by the current user
   */
  async checkFavoriteStatus(): Promise<void> {
    try {
      const user = await this.authService
        .getCurrentUser()
        .pipe(take(1))
        .toPromise();
      if (!user) return;

      const favoritesRef = collection(this.firestore, 'favorites');
      const q = query(favoritesRef, where('userId', '==', user['uid']));

      const querySnapshot = await runInInjectionContext(this.injector, () =>
        getDocs(q)
      );

      const favoriteIds = new Set<string>();

      querySnapshot.forEach((document) => {
        const favorite = document.data();
        if (favorite['loanId']) {
          favoriteIds.add(favorite['loanId']);
        }
      });

      // Update favorite status for each loan
      const updatedLoans = this.loans().map((loan) => ({
        ...loan,
        isFavorite: favoriteIds.has(loan.id || ''),
      }));

      this.loans.set(updatedLoans);
    } catch (error) {
      console.error('Error checking favorite status:', error);
    }
  }

  handleFilterApply(filters: LoanFilters): void {
    console.log('Applying filters:', filters);

    const filteredResults = this.allLoans().filter((loan) => {
      // Filter by property type
      if (
        filters.propertyTypeCategory &&
        loan.propertyTypeCategory !== filters.propertyTypeCategory
      ) {
        return false;
      }

      // Filter by state
      if (filters.state && loan.state !== filters.state) {
        return false;
      }

      if (
        filters.loanType &&
        loan.loanType?.toLowerCase() !== filters.loanType.toLowerCase()
      ) {
        return false;
      }

      // Parse loan amount - remove any formatting characters
      const loanAmountString = String(loan.loanAmount || '0');
      const loanAmount = Number(loanAmountString.replace(/[^0-9.-]/g, ''));

      // Parse min amount - remove any formatting characters
      let minAmount = 0;
      if (filters.minAmount) {
        const minAmountString = String(filters.minAmount);
        minAmount = Number(minAmountString.replace(/[^0-9.-]/g, ''));
      }

      // Parse max amount - remove any formatting characters
      let maxAmount = Number.MAX_VALUE; // Default to a very high number
      if (filters.maxAmount) {
        const maxAmountString = String(filters.maxAmount);
        maxAmount = Number(maxAmountString.replace(/[^0-9.-]/g, ''));
      }

      // Debug values
      console.log(
        `Loan: ${loan.id}, Amount: ${loanAmount}, Min: ${minAmount}, Max: ${maxAmount}`
      );

      // Check for NaN values
      if (isNaN(loanAmount)) {
        console.warn(
          `Invalid loan amount for loan ${loan.id}: ${loan.loanAmount}`
        );
        return false; // Filter out loans with invalid amounts
      }

      // Filter by min amount
      if (filters.minAmount && !isNaN(minAmount) && loanAmount < minAmount) {
        return false;
      }

      // Filter by max amount
      if (filters.maxAmount && !isNaN(maxAmount) && loanAmount > maxAmount) {
        return false;
      }

      return true;
    });

    console.log(
      `Filtered from ${this.allLoans().length} to ${
        filteredResults.length
      } loans`
    );

    // Update the displayed loans with the filtered results
    this.loans.set(filteredResults);
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

          // Also update the allLoans signal
          const updatedAllLoans = this.allLoans().filter(
            (loan) => loan.id !== id
          );
          this.allLoans.set(updatedAllLoans);
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
