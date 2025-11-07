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
import { LoanService } from '../../services/loan.service';
import { Loan } from '../../models/loan-model.model';
import { AuthService } from '../../services/auth.service';
import { take } from 'rxjs/operators';
import { LoanTypeService } from '../../services/loan-type.service';
import {
  Firestore,
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc,
  where,
} from '@angular/fire/firestore';
import { PropertyFilterComponent } from '../property-filter/property-filter.component';
import { LOAN_TYPES } from '../../shared/constants/loan-constants';
import { FirestoreService } from 'src/services/firestore.service';
import { getPropertySubcategoryName } from '../../shared/constants/property-mappings';
import { LoanUtils, PropertySubcategoryValue } from '../../models/loan-model.model';
import { getStateName } from '../../shared/constants/state-mappings';
import { firstValueFrom } from 'rxjs';

interface PropertyCategoryOption {
  value: string;
  displayName: string;
}

interface LoanTypeOption {
  value: string;
  displayName: string;
}

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
  private loanService = inject(LoanService);
  private router = inject(Router);
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  private authService = inject(AuthService);
  private firestoreService = inject(FirestoreService);
  private loanTypeService = inject(LoanTypeService);

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

  propertyColorMap: Record<string, string> = {
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

  loanTypes = LOAN_TYPES;
  getStateName = getStateName;

  loans = signal<Loan[]>([]);
  allLoans = signal<Loan[]>([]);
  loansLoading = signal<boolean>(true);
  errorMessage = signal<string | null>(null);

  ngOnInit() {
    this.loadAllLoans();
  }

  async loadAllLoans(): Promise<void> {
    this.loansLoading.set(true);
    this.errorMessage.set(null);

    try {
      const loansCollectionRef = collection(this.firestore, 'loans');
      const q = query(loansCollectionRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await runInInjectionContext(this.injector, () => getDocs(q));

      const allLoans: Loan[] = [];
      querySnapshot.forEach((doc) => {
        const loanData = doc.data();
        allLoans.push({ id: doc.id, ...loanData } as Loan);
      });

      this.loans.set(allLoans);
      this.allLoans.set(allLoans);
      await this.checkFavoriteStatus();
    } catch (error) {
      this.errorMessage.set('Failed to load loans. Please try again.');
      console.error('Error loading loans:', error);
    } finally {
      this.loansLoading.set(false);
    }
  }

  async toggleFavorite(loan: Loan): Promise<void> {
    try {
      const firebaseUser = await firstValueFrom(this.authService.getCurrentFirebaseUser());

      if (!firebaseUser || !firebaseUser.uid) {
        alert('Please log in to save favorites');
        this.router.navigate(['/login']);
        return;
      }

      const userId = firebaseUser.uid;


     const userProfile = await firstValueFrom(this.authService.getUserProfile());



      if (!userProfile || userProfile.role !== 'lender') {
        alert('Only lenders can save favorite loans');
        return;
      }


      const isFavorite = loan.isFavorite === true;
      loan.isFavorite = !isFavorite;

      const userDocRef = doc(this.firestore, `lenders/${userId}`);
      const userDoc = await runInInjectionContext(this.injector, () => getDoc(userDocRef));

      if (!userDoc.exists()) {
        loan.isFavorite = isFavorite;
        alert('Lender profile not found');
        return;
      }

      await runInInjectionContext(this.injector, () =>
        this.firestoreService.toggleFavoriteLoan(userId, loan, !isFavorite)
      );
    } catch (error) {
      const currentState = loan.isFavorite === true;
      loan.isFavorite = !currentState;
      this.errorMessage.set('Failed to update favorite status. Please try again.');
      console.error('❌ Error in toggleFavorite:', error);
    }
  }

  async checkFavoriteStatus(): Promise<void> {
    try {
      const firebaseUser = await firstValueFrom(this.authService.getCurrentFirebaseUser());
      if (!firebaseUser || !firebaseUser.uid) return;

      const userId = firebaseUser.uid;



      const favoritesRef = collection(this.firestore, 'favorites');
      const q = query(favoritesRef, where('userId', '==', userId));
      const querySnapshot = await runInInjectionContext(this.injector, () => getDocs(q));

      const favoriteIds = new Set<string>();
      querySnapshot.forEach((doc) => {
        const favorite = doc.data();
        if (favorite['loanId']) favoriteIds.add(favorite['loanId']);
      });

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
    this.loansLoading.set(true);
    this.errorMessage.set(null);

    this.firestoreService
      .filterLoans(filters.propertyTypeCategory, filters.state, filters.loanType, filters.minAmount, filters.maxAmount)
      .subscribe({
        next: (filteredLoans) => {
          this.loans.set(filteredLoans);
          this.loansLoading.set(false);
          this.checkFavoriteStatus();
        },
        error: (error) => {
          this.loansLoading.set(false);
          this.loans.set(this.allLoans());
          this.errorMessage.set('Failed to filter loans. Please try again.');
          console.error('Error filtering loans:', error);
        },
      });
  }

  viewLoanDetails(id: string): void {
    if (id) this.router.navigate(['/loans', id]);
  }

  editLoan(id: string): void {
    if (id) this.router.navigate(['/loans/edit', id]);
  }

  deleteLoan(id: string): void {
    if (confirm('Are you sure you want to delete this loan?')) {
      this.loanService.deleteLoan(id).subscribe({
        next: () => {
          const updated = this.loans().filter((loan) => loan.id !== id);
          this.loans.set(updated);
          this.allLoans.set(updated);
        },
        error: (error) => {
          this.errorMessage.set('Failed to delete loan. Please try again later.');
          console.error('Error deleting loan:', error);
        },
      });
    }
  }

  formatCurrency(value: string): string {
    const amount = Number(value?.replace(/[$,]/g, '') || 0);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  }

  getFormattedDate(date: any): string {
    try {
      const jsDate = date?.toDate ? date.toDate() : new Date(date);
      return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(jsDate);
    } catch {
      return 'Invalid Date';
    }
  }

  formatPropertyCategory(category: string): string {
    const match = this.allPropertyCategoryOptions.find(opt => opt.value === category);
    return match?.displayName || category;
  }

  formatPropertySubcategory(sub: PropertySubcategoryValue): string {
    return getPropertySubcategoryName(LoanUtils.getSubcategoryValue(sub));
  }

  getLoanTypeName(value: string): string {
    return this.loanTypeService.getLoanTypeName(value);
  }

  getColor(propertyType: string): string {
    return this.propertyColorMap[propertyType] || '#000000';
  }
}
