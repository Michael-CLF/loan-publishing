// src/app/components/loans/loans.component.ts
import {
  Component,
  OnInit,
  inject,
  Injector,
  signal,
  WritableSignal,
  runInInjectionContext,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from '@angular/fire/firestore';

import { LoanService } from '../../services/loan.service';
import { AuthService } from '../../services/auth.service';
import { FirestoreService } from 'src/services/firestore.service';
import { LoanTypeService } from '../../services/loan-type.service';

import { Loan, LoanUtils, PropertySubcategoryValue } from '../../models/loan-model.model';
import { LOAN_TYPES } from '../../shared/constants/loan-constants';
import { getPropertySubcategoryName } from '../../shared/constants/property-mappings';
import { getStateName } from '../../shared/constants/state-mappings';

import { LoanFilterComponent } from '../loan-filter/loan-filter.component';
import { LoanFilters } from '../../services/loan-filter.service';

interface PropertyCategoryOption {
  value: string;
  displayName: string;
}

interface LoanTypeOption {
  value: string;
  displayName: string;
}

@Component({
  selector: 'app-loans',
  standalone: true,
  templateUrl: './loans.component.html',
  styleUrls: ['./loans.component.css'],
  imports: [CommonModule, RouterModule, LoanFilterComponent],
})
export class LoansComponent implements OnInit {
  // Services
  private readonly loanService = inject(LoanService);
  private readonly router = inject(Router);
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(Injector);
  private readonly authService = inject(AuthService);
  private readonly firestoreService = inject(FirestoreService);
  private readonly loanTypeService = inject(LoanTypeService);

  // UI constants
  loanTypes = LOAN_TYPES;
  getStateName = getStateName;

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
    { value: 'portfolio', displayName: 'Portfolio Loan' },
    { value: 'dscr', displayName: 'DSCR' },
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

  // State
  public loans: WritableSignal<Loan[]> = signal<Loan[]>([]);
  public allLoans: WritableSignal<Loan[]> = signal<Loan[]>([]);
  public loansLoading = signal<boolean>(true);
  public errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.loadAllLoans();
  }

  /**
   * Load and normalize loans once.
   * Adds:
   *  - loanAmountNum: number
   *  - stateAbbr: string (e.g., 'FL')
   *  - stateName: string (e.g., 'Florida') for display only
   *  - propertyCategory: string (copy of propertyTypeCategory for predicate stability)
   *  - loanTypeStd: string lowercased
   */
  async loadAllLoans(): Promise<void> {
    this.loansLoading.set(true);
    this.errorMessage.set(null);

    try {
      const loansCollectionRef = collection(this.firestore, 'loans');
      const q = query(loansCollectionRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await runInInjectionContext(this.injector, () => getDocs(q));

      const normalized: Loan[] = [];
      querySnapshot.forEach((d) => {
        const raw = d.data() as any;

        const amountNum =
          Number(String(raw?.loanAmount ?? '0').replace(/[^0-9.]/g, '')) || 0;

        const abbr = raw?.state || '';
        const name = abbr ? getStateName(abbr) : '';

        const propertyCategory = raw?.propertyTypeCategory || raw?.propertyCategory || '';

        const loanTypeStd = String(raw?.loanType ?? '').toLowerCase().trim();

        const n: any = {
          id: d.id,
          ...raw,
          loanAmountNum: amountNum,
          stateAbbr: abbr,
          stateName: name,
          propertyCategory,
          loanTypeStd,
        };

        normalized.push(n as Loan);
      });

      this.allLoans.set(normalized);
      this.loans.set(normalized);
      await this.checkFavoriteStatus();
    } catch (err) {
      console.error('Error loading loans:', err);
      this.errorMessage.set('Failed to load loans. Please try again.');
    } finally {
      this.loansLoading.set(false);
    }
  }

  /**
   * Client-side filtering. Keeps your existing method name.
   * The child emits LoanFilters with: propertyTypeCategory, state (abbr), loanType, minAmount, maxAmount.
   */
  handleFilterApply(filters: LoanFilters): void {
    this.loansLoading.set(true);
    this.errorMessage.set(null);

    try {
      const next = this.allLoans().filter((loan) => this.matchesFilters(loan, filters));
      this.loans.set(next);
    } catch (err) {
      console.error('Error filtering loans:', err);
      this.errorMessage.set('Failed to filter loans. Please try again.');
      this.loans.set(this.allLoans());
    } finally {
      this.loansLoading.set(false);
      // keep favorite badges correct
      this.checkFavoriteStatus();
    }
  }

  /**
   * Predicate used by client-side filtering.
   * Matches property type, state, loan type, and numeric min/max.
   */
  private matchesFilters(loan: any, f: LoanFilters): boolean {
    const matchesType =
      !f.propertyTypeCategory ||
      loan.propertyCategory === f.propertyTypeCategory ||
      loan.propertyTypeCategory === f.propertyTypeCategory;

    // State: we filter on abbreviations from Firestore
    const matchesState = !f.state || loan.stateAbbr === f.state || loan.state === f.state;

    // Loan type: normalize both sides
    const lt = String(loan.loanTypeStd ?? loan.loanType ?? '').toLowerCase().trim();
    const targetLt = String(f.loanType ?? '').toLowerCase().trim();
    const matchesLoanType = !targetLt || lt === targetLt;

    const amt = Number(loan.loanAmountNum ?? 0) || 0;
    const minOk = !f.minAmount || amt >= Number(f.minAmount);
    const maxOk = !f.maxAmount || amt <= Number(f.maxAmount);

    return matchesType && matchesState && matchesLoanType && minOk && maxOk;
  }

  // ===== Existing methods preserved =====

  async toggleFavorite(loan: Loan): Promise<void> {
    try {
      const firebaseUser = await firstValueFrom(this.authService.getCurrentFirebaseUser());
      if (!firebaseUser?.uid) {
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
        this.firestoreService.toggleFavoriteLoan(userId, loan, !isFavorite),
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
      if (!firebaseUser?.uid) return;

      const userId = firebaseUser.uid;
      const favoritesRef = collection(this.firestore, 'loanFavorites');
      const q = query(favoritesRef, where('userId', '==', userId));
      const snap = await runInInjectionContext(this.injector, () => getDocs(q));

      const favIds = new Set<string>();
      snap.forEach((d) => {
        const f = d.data() as any;
        if (f['loanId']) favIds.add(String(f['loanId']));
      });

      const updated = this.loans().map((l) => ({
        ...l,
        isFavorite: favIds.has(l.id || ''),
      }));

      this.loans.set(updated);
    } catch (error) {
      console.error('Error checking favorite status:', error);
    }
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
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  getFormattedDate(date: any): string {
    try {
      const jsDate = date?.toDate ? date.toDate() : new Date(date);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(jsDate);
    } catch {
      return 'Invalid Date';
    }
  }

  formatPropertyCategory(category: string): string {
    const match = this.allPropertyCategoryOptions.find((opt) => opt.value === category);
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
