// lender-details.component.ts - Add missing methods
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Lender, LenderService } from '../../services/lender.service';
import { FavoritesService } from '../../services/favorites.service';
import { AuthService } from '../../services/auth.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { propertyColorMap } from '../../shared/property-category-colors';
import { SavedLenderSuccessModalComponent } from '../../modals/saved-lender-success-modal/saved-lender-success-modal.component';

@Component({
  selector: 'app-lender-details',
  standalone: true,
  imports: [CommonModule, RouterModule, SavedLenderSuccessModalComponent],
  templateUrl: './lender-details.component.html',
  styleUrls: ['./lender-details.component.css'],
})
export class LenderDetailsComponent implements OnInit, OnDestroy {
  lender: Lender | null = null;
  loading = true;
  error = false;
  isFavorited = false;
  userRole: 'originator' | 'lender' | null = null;
  isAuthenticated = false;
  showModal = false;

  private destroy$ = new Subject<void>();
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private favoritesService = inject(FavoritesService);
  private authService = inject(AuthService);
  private lenderService = inject(LenderService);

  ngOnInit(): void {
    this.authService.getCurrentUser().subscribe((user) => {
      if (user) {
        this.isAuthenticated = true;
        this.userRole = user.role || null;
      } else {
        this.isAuthenticated = false;
        this.userRole = null;
      }
    });

    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.loadLenderDetails(id);

        if (this.userRole === 'originator') {
          this.checkFavoriteStatus(id);
        }
      } else {
        this.error = true;
        this.loading = false;
      }
    });

    // Subscribe to modal visibility
    this.favoritesService.showModal$
      .pipe(takeUntil(this.destroy$))
      .subscribe((showModal) => {
        this.showModal = showModal;
      });
  }

  closeModal(): void {
    this.favoritesService.closeModal();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadLenderDetails(id: string): void {
    this.loading = true;

    this.lenderService
      .getLender(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lender) => {
          this.lender = lender;
          if (!lender) {
            this.error = true;
            console.log('Lender not found');
          } else {
            console.log('LENDER DETAILS: Lender loaded:', this.lender);
          }
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading lender details:', err);
          this.error = true;
          this.loading = false;
        },
      });
  }

  // Add missing goBack method
  goBack(): void {
    this.router.navigate(['/lender-list']);
  }

  // Add missing getCategoryStyle method
  getCategoryStyle(category: string): { [key: string]: string } {
    return {
      'background-color': this.getCategoryColor(category),
      color: '#fff',
      padding: '8px',
      'border-radius': '4px',
    };
  }

  // Add get color function needed by getCategoryStyle
  getCategoryColor(category: string): string {
    return propertyColorMap[category] || '#808080'; // fallback to gray
  }

  checkFavoriteStatus(lenderId: string): void {
    // Skip if not authenticated or not an originator
    if (!this.isAuthenticated || this.userRole !== 'originator') {
      this.isFavorited = false;
      return;
    }

    // Use the async method to get the initial state
    this.favoritesService
      .isFavorite(lenderId)
      .then((isFavorited) => {
        this.isFavorited = isFavorited;
      })
      .catch((error) => {
        console.error('Error checking favorite status:', error);
        this.isFavorited = false;
      });
  }

  async toggleFavorite(): Promise<void> {
    // Check if lender and lender id are available
    if (!this.lender?.id) {
      console.warn('Lender ID is not available.');
      return;
    }

    if (!this.isAuthenticated) {
      // Redirect to login if not logged in
      this.router.navigate(['/login']);
      return;
    }

    if (this.userRole !== 'originator') {
      alert('Only originators can save lenders to favorites.');
      return;
    }

    try {
      // Store the lender ID in a local variable to ensure it's not null in the closure
      const lenderId = this.lender.id;

      // Disable button during operation to prevent multiple clicks
      const savedBtn = document.querySelector(
        '.favorite-button'
      ) as HTMLButtonElement;
      if (savedBtn) {
        savedBtn.disabled = true;
      }

      // Toggle in Firestore using the stored lender ID
      await this.favoritesService.toggleFavorite(lenderId);

      // Wait a moment for the operation to be processed
      setTimeout(async () => {
        // Update the local state based on the current state in Firestore
        this.isFavorited = await this.favoritesService.isFavorite(lenderId);

        // Re-enable button
        if (savedBtn) {
          savedBtn.disabled = false;
        }
      }, 500);
    } catch (error) {
      console.error('Error toggling favorite:', error);
      alert('There was an error updating your favorites. Please try again.');

      // Re-enable button on error
      const savedBtn = document.querySelector(
        '.favorite-button'
      ) as HTMLButtonElement;
      if (savedBtn) {
        savedBtn.disabled = false;
      }
    }
  }

  // Keep all the existing methods...
  getContactName(): string {
    const firstName = this.lender?.contactInfo?.firstName || '';
    const lastName = this.lender?.contactInfo?.lastName || '';
    return `${firstName} ${lastName}`.trim() || 'Not specified';
  }

  getCompanyName(): string {
    return this.lender?.contactInfo?.company || 'Not specified';
  }

  getEmail(): string {
    return this.lender?.contactInfo?.contactEmail || 'Not specified';
  }

  getPhone(): string {
    return this.lender?.contactInfo?.contactPhone || 'Not specified';
  }

  getLocation(): string {
    const city = this.lender?.contactInfo?.city || '';
    const state = this.lender?.contactInfo?.state || '';
    return city && state ? `${city}, ${state}` : 'Not specified';
  }

  // Product Info
  getLenderTypes(): string {
    if (!this.lender?.productInfo?.lenderTypes?.length) return 'None specified';
    return this.lender.productInfo.lenderTypes
      .map(this.getLenderTypeName)
      .join(', ');
  }

  getPropertyCategories(): string {
    if (!this.lender?.productInfo?.propertyCategories?.length)
      return 'None specified';
    return this.lender.productInfo.propertyCategories
      .map(this.getPropertyCategoryName)
      .join(', ');
  }

  getLenderTypeName(value: string): string {
    const map: { [key: string]: string } = {
      agency: 'Agency Lender',
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

  getPropertyCategoryName(value: string): string {
    const propertyCategoryMap: { [key: string]: string } = {
      commercial: 'Commercial',
      healthcare: 'Healthcare',
      hospitality: 'Hospitality',
      industrial: 'Industrial',
      land: 'Land',
      mixed_use: 'Mixed Use',
      office: 'Office',
      residential: 'Residential',
      retail: 'Retail',
      special_purpose: 'Special Purpose',
    };
    return propertyCategoryMap[value] || value;
  }

  getLoanTypeName(value: string): string {
    const loanTypeMap: { [key: string]: string } = {
      agency: 'Agency Loans',
      bridge: 'Bridge Loans',
      cmbs: 'CMBS Loans',
      commercial: 'Commercial Loans',
      construction: 'Construction Loans',
      hard_money: 'Hard Money Loans',
      mezzanine: 'Mezzanine Loan',
      'non-qm': 'Non-QM Loans',
      rehab: 'Rehab Loans',
      sba: 'SBA Loans',
    };
    return loanTypeMap[value] || value;
  }

  getLoanRange(): string {
    if (!this.lender?.productInfo) return 'Not specified';

    const parseAmount = (val: string | number): number =>
      typeof val === 'number'
        ? val
        : parseFloat(val.replace(/[^0-9.]/g, '')) || 0;

    const min = parseAmount(this.lender?.productInfo?.minLoanAmount ?? 0);
    const max = parseAmount(this.lender?.productInfo?.maxLoanAmount ?? 0);

    return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
  }

  hasLoanTypes(): boolean {
    return !!this.lender?.productInfo?.loanTypes?.length;
  }

  getLoanTypesArray(): string[] {
    return this.lender?.productInfo?.loanTypes?.map(this.getLoanTypeName) || [];
  }

  getPropertyTypes(): string {
    return (
      this.lender?.productInfo?.propertyTypes?.join(', ') || 'None specified'
    );
  }

  hasPropertyTypes(): boolean {
    return !!this.lender?.productInfo?.propertyTypes?.length;
  }

  getPropertyCategoriesArray(): string[] {
    return (
      this.lender?.productInfo?.propertyCategories?.map(
        this.getPropertyCategoryName
      ) || []
    );
  }

  // Lending Footprint
  getLendingStates(): string {
    return (
      this.lender?.footprintInfo?.lendingFootprint?.join(', ') ||
      'None specified'
    );
  }

  getLendingStatesArray(): string[] {
    return this.getLendingStates()
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  // Subcategories
  getFormattedSubcategories(): string {
    return (
      this.lender?.productInfo?.subcategorySelections
        ?.map(this.formatSubcategory)
        .join(', ') || 'None specified'
    );
  }

  getSubcategories(): string[] {
    return this.lender?.productInfo?.subcategorySelections || [];
  }

  hasSubcategories(): boolean {
    return !!this.lender?.productInfo?.subcategorySelections?.length;
  }

  formatSubcategory(sub: string): string {
    const parts = sub.split(':');
    return parts.length > 1
      ? parts[1]
          .split('-')
          .map((w) => w[0].toUpperCase() + w.slice(1))
          .join(' ')
      : sub;
  }

  getCategoryFromSubcategory(sub: string): string {
    const parts = sub.split(':')[0];
    return parts
      .split('-')
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(' ');
  }

  getGroupedSubcategories(): { [category: string]: string[] } {
    const grouped: { [key: string]: string[] } = {};
    for (const sub of this.getSubcategories()) {
      const cat = this.getCategoryFromSubcategory(sub);
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(sub);
    }
    return grouped;
  }
}
