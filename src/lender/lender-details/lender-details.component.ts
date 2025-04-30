import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Lender, LenderService } from '../../services/lender.service';
import { FavoritesService } from '../../services/favorites.service';
import { AuthService } from '../../services/auth.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-lender-details',
  standalone: true,
  imports: [CommonModule, RouterModule],
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  checkFavoriteStatus(lenderId: string): void {
    this.isFavorited = this.favoritesService.isFavorite(lenderId);
  }

  toggleFavorite(): void {
    if (!this.lender?.id) {
      console.warn('Lender ID is not available.');
      return;
    }

    this.isFavorited = !this.isFavorited;
    this.favoritesService.toggleFavorite(this.lender.id);
    this.isFavorited = this.favoritesService.isFavorite(this.lender.id);
  }

  goBack(): void {
    this.router.navigate(['/lender-list']);
  }

  // --- Helper methods for contact information ---
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

  // --- Helper methods for product information ---
  getLenderTypes(): string {
    if (
      !this.lender?.productInfo?.lenderTypes ||
      this.lender.productInfo.lenderTypes.length === 0
    ) {
      return 'None specified';
    }
    return this.lender.productInfo.lenderTypes
      .map((type) => this.getLenderTypeName(type))
      .join(', ');
  }

  getPropertyCategories(): string {
    if (
      !this.lender?.productInfo?.propertyCategories ||
      this.lender.productInfo.propertyCategories.length === 0
    ) {
      return 'None specified';
    }
    return this.lender.productInfo.propertyCategories
      .map((category) => this.getPropertyCategoryName(category))
      .join(', ');
  }

  // Add this method to your component class
  getPropertyCategoryName(value: string): string {
    const propertyCategoryMap: { [key: string]: string } = {
      'industrial-property': 'Industrial Property',
      hospitality: 'Hospitality',
      'mixed-use': 'Mixed-Use',
      office: 'Office',
      commercial: 'Commercial',
      healthcare: 'Healthcare',
      // Add all your property categories here
    };
    return propertyCategoryMap[value] || value;
  }

  getLoanTypeName(value: string): string {
    const loanTypeMap: { [key: string]: string } = {
      commercial: 'Commercial Loans',
      construction: 'Construction Loans',
      bridge: 'Bridge Loans',
      rehab: 'Rehab Loans',
      'non-qm': 'Non-QM Loans',
      sba: 'SBA Loans',
      cmbs: 'CMBS Loans',
      agency: 'Agency Loans',
      hard_money: 'Hard Money Loans',
      mezzanine: 'Mezzanine Loan',
    };
    return loanTypeMap[value] || value;
  }
  getPropertyCategoriesArray(): string[] {
    if (!this.lender?.productInfo?.propertyCategories) return [];

    return this.lender.productInfo.propertyCategories.map((category) =>
      this.getPropertyCategoryName(category)
    );
  }

  getPropertyTypes(): string {
    if (
      !this.lender?.productInfo?.propertyTypes ||
      this.lender.productInfo.propertyTypes.length === 0
    ) {
      return 'None specified';
    }
    return this.lender.productInfo.propertyTypes.join(', ');
  }

  getLoanRange(): string {
    if (!this.lender?.productInfo) {
      return 'Not specified';
    }

    let min = 0;
    let max = 0;

    try {
      const minValue = this.lender?.productInfo?.minLoanAmount as
        | string
        | number;
      const maxValue = this.lender?.productInfo?.maxLoanAmount as
        | string
        | number;

      if (typeof minValue === 'number') {
        min = minValue;
      } else if (typeof minValue === 'string') {
        min = parseFloat(minValue.replace(/[^0-9.]/g, '')) || 0;
      }

      if (typeof maxValue === 'number') {
        max = maxValue;
      } else if (typeof maxValue === 'string') {
        max = parseFloat(maxValue.replace(/[^0-9.]/g, '')) || 0;
      }
    } catch (error) {
      console.error('Error processing loan amounts:', error);
    }

    return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
  }

  // Check if loan types exist
  hasLoanTypes(): boolean {
    return (
      !!this.lender?.productInfo?.loanTypes &&
      this.lender.productInfo.loanTypes.length > 0
    );
  }

  getLoanTypesArray(): string[] {
    if (!this.lender?.productInfo?.loanTypes) return [];
    return this.lender.productInfo.loanTypes.map((type) =>
      this.getLoanTypeName(type)
    );
  }
  // --- Helper methods for footprint information ---
  getLendingStates(): string {
    if (
      !this.lender?.footprintInfo?.lendingFootprint ||
      this.lender.footprintInfo.lendingFootprint.length === 0
    ) {
      return 'None specified';
    }
    return this.lender.footprintInfo.lendingFootprint.join(', ');
  }

  // --- Helper methods for property types ---
  hasPropertyTypes(): boolean {
    return (
      !!this.lender?.productInfo?.propertyTypes &&
      this.lender.productInfo.propertyTypes.length > 0
    );
  }

  getPropertyTypesArray(): string[] {
    return this.lender?.productInfo?.propertyTypes || [];
  }

  // --- Helper methods for subcategories ---
  // Add this method to your component
  getFormattedSubcategories(): string {
    if (
      !this.lender?.productInfo?.subcategorySelections ||
      this.lender.productInfo.subcategorySelections.length === 0
    ) {
      return 'None specified';
    }

    // Format each subcategory for display
    return this.lender.productInfo.subcategorySelections
      .map((subcategory) => {
        // Split by colon and format nicely
        const parts = subcategory.split(':');
        if (parts.length > 1) {
          return parts[1]
            .split('-')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        }
        return subcategory;
      })
      .join(', ');
  }

  getSubcategories(): string[] {
    return this.lender?.productInfo?.subcategorySelections || [];
  }

  hasSubcategories(): boolean {
    return (
      !!this.lender?.productInfo?.subcategorySelections &&
      this.lender.productInfo.subcategorySelections.length > 0
    );
  }

  formatSubcategory(subcategory: string): string {
    const parts = subcategory.split(':');
    if (parts.length > 1) {
      return parts[1]
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
    return subcategory;
  }

  getCategoryFromSubcategory(subcategory: string): string {
    const parts = subcategory.split(':');
    if (parts.length > 0) {
      // Transform the category name from kebab-case to Title Case
      return parts[0]
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
    return '';
  }

  getGroupedSubcategories(): { [category: string]: string[] } {
    const subcategories = this.getSubcategories();
    const grouped: { [category: string]: string[] } = {};

    subcategories.forEach((subcategory) => {
      const category = this.getCategoryFromSubcategory(subcategory);
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(subcategory);
    });

    return grouped;
  }

  // --- Mapping helper methods ---
  getLenderTypeName(value: string): string {
    const lenderTypeMap: { [key: string]: string } = {
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
    return lenderTypeMap[value] || value;
  }
  getLendingStatesArray(): string[] {
    const states = this.getLendingStates(); // existing method, probably returns a string like "NC, SC, GA"
    return states ? states.split(',').map((state) => state.trim()) : [];
  }
}
