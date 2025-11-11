// Updated lender-details.component.ts - Using the new mapping constants

import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  AfterViewInit,
  DestroyRef
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
export class LenderDetailsComponent implements OnInit, OnDestroy, AfterViewInit {
  lender: Lender | null = null;
  loading = true;
  error = false;
  isFavorited = false;
  userRole: 'originator' | 'lender' | 'admin' | null = null;
  isAuthenticated = false;
  showModal = false;
  backTarget: string = '/dashboard';

  private destroy$ = new Subject<void>();
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private favoritesService = inject(FavoritesService);
  private authService = inject(AuthService);
  private lenderService = inject(LenderService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  private copyProtectionEnabled = false;
  private copyProtectionInitialized = false;


  private setupCopyProtection(): void {
  if (!this.copyProtectionEnabled || this.copyProtectionInitialized) return;

    // Disable right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // Disable copy keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent Ctrl+C, Cmd+C, Ctrl+X, Cmd+X, Ctrl+A, Cmd+A
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'x' || e.key === 'a')) {
        e.preventDefault();
        return false;
      }
      return true;
    };

    // Disable text selection via CSS (backup method)
    const disableSelection = () => {
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
    };

    // Apply protection
    disableSelection();
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    this.copyProtectionInitialized = true;
    this.setupCopyProtection(); // Add this line



    // Cleanup when component is destroyed (Angular 18 pattern)
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
    });
    this.setupCopyProtection(); // Add this line
  }

  async ngOnInit(): Promise<void> {
    // Resolve basic auth state
    const user = await this.authService.getCurrentFirebaseUser();
    this.isAuthenticated = !!user;

    const fromAdminQP = this.route.snapshot.queryParamMap.get('origin') === 'admin';
    const fromAdminState = history.state?.fromAdmin === true;

 if (fromAdminQP || fromAdminState) {
    this.backTarget = '/admin/dashboard';
  } else {
    this.backTarget = '/dashboard';
  }

  this.authService.getUserProfile()
    .pipe(takeUntil(this.destroy$))
    .subscribe((profile) => {
      const role = (profile as any)?.role ?? null;
      const rawIsAdmin = (profile as any)?.isAdmin;
      const isAdmin = role === 'admin' || rawIsAdmin === true || rawIsAdmin === 'true';

      // Update local role for any other logic you have
      this.userRole = (role === 'admin' || role === 'lender' || role === 'originator') ? role : null;

      // If profile confirms admin, override target to admin dashboard
      if (isAdmin) {
        this.backTarget = '/admin/dashboard';
      }

      this.cdr.markForCheck();
    });

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

  ngAfterViewInit(): void {
    // Setup copy protection after view initializes
    setTimeout(() => {
      this.setupCopyProtection();
    }, 100);
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

  // =============================================
  // CONTACT INFORMATION METHODS (Enhanced with comprehensive fallbacks)
  // =============================================

  getContactName(): string {
    if (!this.lender) return 'Not specified';

    // ✅ Use type assertion to safely check all possible locations
    const lenderAny = this.lender as any;
    const firstName =
      this.lender.contactInfo?.firstName ||
      lenderAny.firstName ||
      '';
    const lastName =
      this.lender.contactInfo?.lastName ||
      lenderAny.lastName ||
      '';

    const fullName = `${firstName} ${lastName}`.trim();
    console.log('🔍 DEBUG - getContactName:', { firstName, lastName, fullName });
    return fullName || 'Not specified';
  }

  getCompanyName(lender: any): string {
    if (!lender) return 'N/A';

    // ✅ Use type assertion to safely check all possible locations
    const lenderAny = lender as any;
    const company =
      lender.contactInfo?.company ||
      lenderAny.company ||
      '';

    console.log('🔍 DEBUG - getCompanyName:', {
      contactInfoCompany: lender.contactInfo?.company,
      rootCompany: lenderAny.company,
      finalCompany: company
    });

    return company.trim() || 'N/A';
  }

  getEmail(): string {
    if (!this.lender) return 'Not specified';

    // ✅ Use type assertion to safely check all possible locations
    const lenderAny = this.lender as any;
    const email =
      this.lender.contactInfo?.contactEmail ||
      lenderAny.contactEmail ||
      lenderAny.email ||
      '';

    console.log('🔍 DEBUG - getEmail:', {
      contactInfoEmail: this.lender.contactInfo?.contactEmail,
      rootContactEmail: lenderAny.contactEmail,
      rootEmail: lenderAny.email,
      finalEmail: email
    });

    return email || 'Not specified';
  }

  getPhone(): string {
    if (!this.lender) return 'Not specified';

    // ✅ Use type assertion to safely check all possible locations
    const lenderAny = this.lender as any;
    const phone =
      this.lender.contactInfo?.contactPhone ||
      lenderAny.contactPhone ||
      lenderAny.phone ||
      '';

    console.log('🔍 DEBUG - getPhone:', {
      contactInfoPhone: this.lender.contactInfo?.contactPhone,
      rootContactPhone: lenderAny.contactPhone,
      rootPhone: lenderAny.phone,
      finalPhone: phone
    });

    return phone || 'Not specified';
  }

  getLocation(): string {
    if (!this.lender) return 'Not specified';

    // ✅ Use type assertion to safely check all possible locations
    const lenderAny = this.lender as any;
    const city =
      this.lender.contactInfo?.city ||
      lenderAny.city ||
      '';
    const state =
      this.lender.contactInfo?.state ||
      lenderAny.state ||
      '';

    console.log('🔍 DEBUG - getLocation:', {
      contactInfoCity: this.lender.contactInfo?.city,
      contactInfoState: this.lender.contactInfo?.state,
      rootCity: lenderAny.city,
      rootState: lenderAny.state,
      finalCity: city,
      finalState: state
    });

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

    if (!this.lender?.footprintInfo) return [];

    const footprintInfo = this.lender.footprintInfo as any;
    let statesArray: string[] = [];

    // ✅ 1) Prefer lendingFootprint array if it exists and has data
    if (Array.isArray(footprintInfo.lendingFootprint) && footprintInfo.lendingFootprint.length > 0) {
      statesArray = footprintInfo.lendingFootprint;
      console.log('🔍 DEBUG - Using lendingFootprint array:', statesArray);
    }

    // ✅ 2) If no array data, fall back to states object keys
    else if (footprintInfo.states && typeof footprintInfo.states === 'object') {
      statesArray = Object.keys(footprintInfo.states)
        .filter((key) => footprintInfo.states[key] === true);
      console.log('🔍 DEBUG - Using states object keys:', statesArray);
    }

    // ✅ 3) Format all states for display
    const result = statesArray
      .map((state) => formatStateForDisplay(state))
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

  private normalizeCategory(value: string): string {
    if (!value) return '';
    return value.trim().toLowerCase().replace(/[\s_-]+/g, '_');
  }

  getCategoriesWithOptionalSubcategories(): { category: string; subcategories: string[] }[] {
    if (!this.lender?.productInfo?.propertyCategories) return [];

    const categories = this.lender.productInfo.propertyCategories.map(cat => this.normalizeCategory(cat));
    const subcategories = this.lender.productInfo.subcategorySelections || [];

    // Group subcategories by category
    const groupedSubs: { [key: string]: string[] } = {};
    for (const sub of subcategories) {
      const cat = this.normalizeCategory(getCategoryFromSubcategory(sub));
      if (!groupedSubs[cat]) groupedSubs[cat] = [];
      groupedSubs[cat].push(sub);
    }

    // Map categories with their subcategories (or empty array)
    return categories.map(cat => ({
      category: cat,
      subcategories: groupedSubs[cat] || []
    }));
  }


  // UPDATED: Now uses the mapping constants
  getCategoryFromSubcategory(sub: string): string {
    return getCategoryFromSubcategory(sub);
  }


  getGroupedSubcategories(): { [category: string]: string[] } {
    const categories = this.lender?.productInfo?.propertyCategories || [];
    const subcategories = this.lender?.productInfo?.subcategorySelections || [];

    const grouped: { [key: string]: string[] } = {};

    // Always start with the categories
    for (const cat of categories) {
      const formattedCat = this.formatCategoryName(cat);
      grouped[formattedCat] = [];
    }

    // Then attach subcategories to the matching category
    for (const sub of subcategories) {
      const catKey = this.getCategoryFromSubcategory(sub);
      const formattedCatKey = this.formatCategoryName(catKey);

      if (!grouped[formattedCatKey]) {
        grouped[formattedCatKey] = [];
      }

      if (!grouped[formattedCatKey].includes(sub)) {
        grouped[formattedCatKey].push(sub);
      }
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
