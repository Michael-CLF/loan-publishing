// Updated lender-details.component.ts - Using the new mapping constants

import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Lender, LenderService } from '../../services/lender.service';
import { FavoritesService } from '../../services/favorites.service';
import { AuthService } from '../../services/auth.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { propertyColorMap } from '../../shared/property-category-colors';
import { SavedLenderSuccessModalComponent } from '../../modals/saved-lender-success-modal/saved-lender-success-modal.component';

// Import the new mapping constants
import {
  getPropertyCategoryName,
  getPropertySubcategoryName,
  getCategoryFromSubcategory,
} from '../../shared/constants/property-mappings';
import {
  getLenderTypeName,
  getLoanTypeName,
} from '../../shared/constants/lender-type-mappings';
import { formatStateForDisplay } from '../../shared/constants/state-mappings';

@Component({
  selector: 'app-lender-details',
  standalone: true,
  imports: [CommonModule, RouterModule, SavedLenderSuccessModalComponent],
  templateUrl: './lender-details.component.html',
  styleUrls: ['./lender-details.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  private cdr = inject(ChangeDetectorRef);

  async ngOnInit(): Promise<void> {
    const user = await this.authService.getCurrentFirebaseUser();
    if (user) {
      this.isAuthenticated = true;
      this.userRole = null;
      this.isAuthenticated = false;
      this.userRole = null;
    }
    this.cdr.markForCheck();

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
        this.cdr.markForCheck();
      }
    });

    // Subscribe to modal visibility
    this.favoritesService.showModal$
      .pipe(takeUntil(this.destroy$))
      .subscribe((showModal) => {
        this.showModal = showModal;
        this.cdr.markForCheck();
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
    this.cdr.markForCheck();

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
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error loading lender details:', err);
          this.error = true;
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  formatCategoryName(category: string): string {
    return getPropertyCategoryName(category);
  }

  goBack(): void {
    this.router.navigate(['/lender-list']);
  }

  getCategoryStyle(category: string): { [key: string]: string } {
    return {
      'background-color': this.getCategoryColor(category),
      color: '#fff',
      padding: '8px',
      'border-radius': '4px',
    };
  }

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
        this.cdr.markForCheck();
      })
      .catch((error) => {
        console.error('Error checking favorite status:', error);
        this.isFavorited = false;
        this.cdr.markForCheck();
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
        this.cdr.markForCheck();

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

// ✅ FIXED: Replace these methods in your lender-details.component.ts

// =============================================
// CONTACT INFORMATION METHODS (Enhanced with comprehensive fallbacks)
// =============================================

getContactName(): string {
  if (!this.lender) return 'Not specified';

  // ✅ Only access properties that exist in Lender interface
  const firstName = this.lender.contactInfo?.firstName || '';
  const lastName = this.lender.contactInfo?.lastName || '';

  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || 'Not specified';
}

getCompanyName(lender: any): string {
  if (!lender) return 'N/A';

  // ✅ Check all possible locations for company data
  const topCompany = lender.company;
  const contactInfoCompany = lender.contactInfo?.company;

  const company = (topCompany || contactInfoCompany || '').trim();
  return company !== '' ? company : 'N/A';
}

getEmail(): string {
  if (!this.lender) return 'Not specified';

  // ✅ Only access properties that exist in Lender interface
  const email = this.lender.contactInfo?.contactEmail || '';

  return email || 'Not specified';
}

getPhone(): string {
  if (!this.lender) return 'Not specified';

  // ✅ Only access properties that exist in Lender interface
  const phone = this.lender.contactInfo?.contactPhone || '';

  return phone || 'Not specified';
}

getLocation(): string {
  if (!this.lender) return 'Not specified';

  // ✅ Only access properties that exist in Lender interface
  const city = this.lender.contactInfo?.city || '';
  const state = this.lender.contactInfo?.state || '';

  if (city && state) {
    return `${city}, ${formatStateForDisplay(state)}`;
  } else if (city) {
    return city;
  } else if (state) {
    return formatStateForDisplay(state);
  }

  return 'Not specified';
}

// =============================================
// PRODUCT INFO METHODS (Enhanced with comprehensive fallbacks)
// =============================================

getLenderTypes(): string {
  console.log('🔍 DEBUG - Full lender object:', this.lender);
  console.log('🔍 DEBUG - lenderTypes from productInfo:', this.lender?.productInfo?.lenderTypes);

  if (!this.lender) return 'None specified';

  // ✅ Only access properties that exist in Lender interface
  const lenderTypes = this.lender.productInfo?.lenderTypes || [];

  console.log('🔍 DEBUG - final lenderTypes array:', lenderTypes);

  if (!Array.isArray(lenderTypes) || lenderTypes.length === 0) {
    console.log('🔍 DEBUG - no lender types found, returning general');
    return 'General';
  }

  const result = lenderTypes
    .map((type: any) => {
      console.log('🔍 DEBUG - processing type:', type);

      // Handle object with name property
      if (type && typeof type === 'object' && type.name) {
        console.log('🔍 DEBUG - using name:', type.name);
        return type.name;
      }

      // Handle object with value property
      if (type && typeof type === 'object' && type.value) {
        console.log('🔍 DEBUG - using value:', type.value);
        return this.formatLenderType(type.value);
      }

      // Handle string
      if (typeof type === 'string') {
        console.log('🔍 DEBUG - using string:', type);
        return this.formatLenderType(type);
      }

      console.log('🔍 DEBUG - unknown type format');
      return null;
    })
    .filter((name) => name && name !== 'Unknown')
    .join(', ');

  console.log('🔍 DEBUG - final getLenderTypes result:', result);
  return result || 'General';
}

getLoanRange(): string {
  console.log('🔍 DEBUG - Full lender object for loan range:', this.lender);
  console.log('🔍 DEBUG - productInfo:', this.lender?.productInfo);

  if (!this.lender) return 'Not specified';

  // ✅ Only access properties that exist in Lender interface
  const productInfo = this.lender.productInfo;
  
  const minAmount = productInfo?.minLoanAmount || 0;
  const maxAmount = productInfo?.maxLoanAmount || 0;

  console.log('🔍 DEBUG - minAmount:', minAmount, 'maxAmount:', maxAmount);

  // ✅ Handle number | string types as defined in Lender model
  const minValue = this.parseNumericValue(minAmount);
  const maxValue = this.parseNumericValue(maxAmount);

  console.log('🔍 DEBUG - parsed minValue:', minValue, 'maxValue:', maxValue);

  if ((minValue === 0 || isNaN(minValue)) && (maxValue === 0 || isNaN(maxValue))) {
    console.log('🔍 DEBUG - both amounts are zero or NaN');
    return 'Not specified';
  }

  const result = `${Number(minValue || 0).toLocaleString()} - ${Number(maxValue || 0).toLocaleString()}`;
  console.log('🔍 DEBUG - final getLoanRange result:', result);
  return result;
}

// =============================================
// UTILITY METHODS
// =============================================

/**
 * ✅ NEW: Helper method to format lender types
 */
private formatLenderType(type: string): string {
  if (!type) return 'General';

  // ✅ Enhanced mapping for common lender types
  const typeMap: { [key: string]: string } = {
    // Snake case format
    'agency': 'Agency Lender',
    'balance_sheet': 'Balance Sheet',
    'bank': 'Bank',
    'bridge_lender': 'Bridge Lender', 
    'cdfi': 'CDFI Lender',
    'conduit_lender': 'Conduit Lender (CMBS)',
    'construction_lender': 'Construction Lender',
    'correspondent_lender': 'Correspondent Lender',
    'credit_union': 'Credit Union',
    'crowdfunding': 'Crowdfunding Platform',
    'direct_lender': 'Direct Lender',
    'family_office': 'Family Office',
    'general': 'General',
    'hard_money': 'Hard Money Lender',
    'life_insurance': 'Life Insurance Lender',
    'mezzanine_lender': 'Mezzanine Lender',
    'non_qm_lender': 'Non-QM Lender',
    'portfolio_lender': 'Portfolio Lender',
    'private_lender': 'Private Lender',
    'sba': 'SBA Lender',
    'usda': 'USDA Lender',
    
    // Camel case format (legacy)
    'balanceSheet': 'Balance Sheet',
    'bridgeLender': 'Bridge Lender',
    'conduitLender': 'Conduit Lender (CMBS)', 
    'constructionLender': 'Construction Lender',
    'correspondentLender': 'Correspondent Lender',
    'creditUnion': 'Credit Union',
    'directLender': 'Direct Lender',
    'familyOffice': 'Family Office',
    'hardMoney': 'Hard Money Lender',
    'lifeInsurance': 'Life Insurance Lender',
    'mezzanineLender': 'Mezzanine Lender',
    'nonQmLender': 'Non-QM Lender',
    'portfolioLender': 'Portfolio Lender',
    'privateLender': 'Private Lender'
  };

  // ✅ Try exact match first
  if (typeMap[type]) {
    return typeMap[type];
  }

  // ✅ Try case-insensitive match
  const lowerType = type.toLowerCase();
  const matchedKey = Object.keys(typeMap).find(key => 
    key.toLowerCase() === lowerType
  );
  if (matchedKey) {
    return typeMap[matchedKey];
  }

  // ✅ Fallback: Format snake_case/camelCase to readable format
  return type
    .replace(/([a-z])([A-Z])/g, '$1 $2') // Handle camelCase
    .replace(/_/g, ' ') // Handle snake_case
    .replace(/\b\w/g, l => l.toUpperCase()) // Capitalize each word
    .trim() || 'General';
}

/**
 * ✅ NEW: Helper method to parse numeric values from string or number
 */
private parseNumericValue(value: any): number {
  if (value === undefined || value === null) return 0;
  
  if (typeof value === 'number') return value;
  
  if (typeof value === 'string') {
    const numericString = value.replace(/[^0-9.]/g, '');
    const parsedValue = parseFloat(numericString);
    return isNaN(parsedValue) ? 0 : parsedValue;
  }
  
  return 0;
}

/**
 * ✅ FIXED: Debug method with proper TypeScript typing
 */
debugLenderDataStructure(): void {
  console.log('=== LENDER DETAILS DATA STRUCTURE DEBUG ===');
  console.log('Full lender object:', this.lender);
  
  if (this.lender) {
    // ✅ Use type assertion to access all properties for debugging
    const lenderAsAny = this.lender as any;
    console.log('Root level properties:', Object.keys(lenderAsAny));
    console.log('ContactInfo:', this.lender.contactInfo);
    console.log('ProductInfo:', this.lender.productInfo);
    console.log('FootprintInfo:', this.lender.footprintInfo);
    
    if (this.lender.contactInfo) {
      console.log('ContactInfo properties:', Object.keys(this.lender.contactInfo));
    }
    
    if (this.lender.productInfo) {
      console.log('ProductInfo properties:', Object.keys(this.lender.productInfo));
    }
    
    // Test each method
    console.log('=== METHOD RESULTS ===');
    console.log('getContactName():', this.getContactName());
    console.log('getCompanyName():', this.getCompanyName(this.lender));
    console.log('getEmail():', this.getEmail());
    console.log('getPhone():', this.getPhone());
    console.log('getLocation():', this.getLocation());
    console.log('getLenderTypes():', this.getLenderTypes());
    console.log('getLoanRange():', this.getLoanRange());
  }
}

  hasLoanTypes(): boolean {
    return true; // Always show loan types section
  }

  getLoanTypesArray(): string[] {
    const rawTypes = this.lender?.productInfo?.loanTypes || [];

    return rawTypes
      .map((lt: any) => {
        if (typeof lt === 'string') return getLoanTypeName(lt);
        if (typeof lt === 'object') {
          // Prefer the custom name if provided
          return lt.name || getLoanTypeName(lt.value || '');
        }
        return '';
      })
      .filter((val) => val)
      .sort((a, b) => a.localeCompare(b));
  }

  // Template helper methods to avoid function calls in templates
  getFormattedSubcategoryName(subcategory: string): string {
    return getPropertySubcategoryName(subcategory);
  }

  // =============================================
  // LENDING FOOTPRINT METHODS (Using new mappings)
  // =============================================

  getLendingStatesArray(): string[] {
    console.log('🔍 DEBUG - footprintInfo:', this.lender?.footprintInfo);
    console.log(
      '🔍 DEBUG - lendingFootprint raw:',
      this.lender?.footprintInfo?.lendingFootprint
    );

    if (!this.lender?.footprintInfo?.lendingFootprint) return [];

    const result = this.lender.footprintInfo.lendingFootprint
      .map((state) => {
        console.log('🔍 DEBUG - processing state:', state);
        const formatted = formatStateForDisplay(state);
        console.log('🔍 DEBUG - formatted to:', formatted);
        return formatted;
      })
      .filter((state) => state.length > 0)
      .sort((a, b) => a.localeCompare(b));

    console.log('🔍 DEBUG - final getLendingStatesArray result:', result);
    return result;
  }



  

  // =============================================
  // SUBCATEGORIES METHODS (Using new mappings)
  // =============================================

  getSubcategories(): string[] {
    return this.lender?.productInfo?.subcategorySelections || [];
  }

  hasSubcategories(): boolean {
    return true; // Always show subcategories section
  }

  // UPDATED: Now uses the mapping constants and handles objects safely
  formatSubcategory(sub: string | any): string {
    // Handle both string and object formats safely
    if (typeof sub === 'string') {
      return getPropertySubcategoryName(sub);
    }

    if (typeof sub === 'object' && sub !== null) {
      // If it's an object, try to get the value or name property
      const value = sub.value || sub.name || '';
      return getPropertySubcategoryName(value);
    }

    return 'Unknown';
  }

  // UPDATED: Now uses the mapping constants
  getCategoryFromSubcategory(sub: string): string {
    return getCategoryFromSubcategory(sub);
  }

  getGroupedSubcategories(): { [category: string]: string[] } {
    const subcategories = this.getSubcategories();

    if (!subcategories.length) {
      return { 'No Categories': [] };
    }

    const grouped: { [key: string]: string[] } = {};
    for (const sub of subcategories) {
      const cat = this.getCategoryFromSubcategory(sub);
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(sub);
    }
    return grouped;
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  // Empty state handlers
  getEmptyStateMessage(sectionType: 'subcategories' | 'loanTypes'): string {
    switch (sectionType) {
      case 'subcategories':
        return 'No property categories have been specified for this lender.';
      case 'loanTypes':
        return 'No loan types have been specified for this lender.';
      default:
        return 'No data available.';
    }
  }
}
