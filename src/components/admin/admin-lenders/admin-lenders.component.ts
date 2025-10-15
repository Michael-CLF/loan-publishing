// src/app/components/admin/admin-lenders/admin-lenders.component.ts

import { 
  Component, 
  Input, 
  inject, 
  signal, 
  OnInit, 
  computed,
  effect 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { 
  Firestore, 
  collection, 
  getDocs 
} from '@angular/fire/firestore';

// Interfaces
import { UserWithActivity } from '../../../interfaces/user-activity.interface';

// Services
import { DateUtilsService } from '../../../utils/date-utils.service';
import { LocationService } from '../../../services/location.service';
import { ModalService } from '../../../services/modal.service';
import { FirestoreService } from '../../../services/firestore.service';

@Component({
  selector: 'app-admin-lenders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-lenders.component.html',
  styleUrls: ['./admin-lenders.component.css']
})
export class AdminLendersComponent implements OnInit {
  // Dependency injection using modern inject() function
  private readonly firestore = inject(Firestore);
  private readonly router = inject(Router);
  private readonly dateUtils = inject(DateUtilsService);
  private readonly locationService = inject(LocationService);
  private readonly modalService = inject(ModalService);
  private readonly firestoreService = inject(FirestoreService);

  // Input properties - using signals for reactive data flow
  @Input() userFilter = signal<string>('');

  // State signals
  lenders = signal<UserWithActivity[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  // Sorting state
  sortColumn = signal<string>('');
  sortDirection = signal<'asc' | 'desc'>('asc');

  // Computed signal for filtered and sorted lenders
  filteredLenders = computed(() => {
    let lenders = this.lenders();
    const filter = this.userFilter().toLowerCase();

    // Apply filtering
    if (filter) {
      lenders = lenders.filter(lender =>
        lender.accountNumber?.toLowerCase().includes(filter) ||
        lender.company?.toLowerCase().includes(filter) ||
        lender.lastName?.toLowerCase().includes(filter) ||
        lender.firstName?.toLowerCase().includes(filter) ||
        lender.email?.toLowerCase().includes(filter)
      );
    }

    // Apply sorting
    const column = this.sortColumn();
    if (column) {
      lenders = [...lenders].sort((a, b) => {
        const valueA = this.getSortValue(a, column);
        const valueB = this.getSortValue(b, column);
        return this.compareValues(valueA, valueB, this.sortDirection());
      });
    }

    return lenders;
  });

  // Effect to log changes (optional - for debugging)
  constructor() {
    effect(() => {
      console.log('Filtered lenders count:', this.filteredLenders().length);
    });
  }

  // Lifecycle hook - load data on component initialization
  async ngOnInit(): Promise<void> {
    await this.loadLenders();
  }

  /**
   * Load lenders from Firestore
   * Following Angular best practice: handle async operations with proper error handling
   */
  async loadLenders(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const lendersRef = collection(this.firestore, 'lenders');
      const lendersSnapshot = await getDocs(lendersRef);
      
      const lendersData = lendersSnapshot.docs.map((doc) => {
        const data = doc.data();
        const contactInfo = data['contactInfo'] || {};
        const productInfo = data['productInfo'] || {};
        
        // Normalize timestamps consistently
        const createdAt = this.dateUtils.normalizeTimestamp(data['createdAt']);
        const lastLoginAt = data['lastLoginAt'] 
          ? this.dateUtils.normalizeTimestamp(data['lastLoginAt']) 
          : null;
        const daysSinceLastLogin = this.dateUtils.getDaysSinceLastLogin(lastLoginAt);
        const loginStatus = this.dateUtils.getLoginStatus(daysSinceLastLogin);

        // Build lender object with comprehensive fallback handling
        const lender: UserWithActivity = {
          id: doc.id,
          accountNumber: doc.id.substring(0, 8).toUpperCase(),
          firstName: data['firstName'] || contactInfo['firstName'] || '',
          lastName: data['lastName'] || contactInfo['lastName'] || '',
          company: data['company'] || contactInfo['company'] || '',
          city: data['city'] || contactInfo['city'] || '',
          state: data['state'] || contactInfo['state'] || '',
          email: data['email'] || contactInfo['contactEmail'] || contactInfo['email'] || '',
          phone: data['phone'] || contactInfo['contactPhone'] || contactInfo['phone'] || '',
          createdAt,
          lastLoginAt,
          daysSinceLastLogin,
          loginStatus,
          role: 'lender',
          lenderTypes: productInfo['lenderTypes'] || data['lenderTypes'] || [],
          productInfo: productInfo,
          contactInfo: contactInfo,
          _rawData: data,
        };

        return lender;
      });
      
      this.lenders.set(lendersData);
      
      console.log('Loaded lenders:', {
        total: lendersData.length,
        withLogins: lendersData.filter(l => l.lastLoginAt).length
      });

    } catch (err) {
      console.error('Error loading lenders:', err);
      this.error.set('Failed to load lenders. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Navigate to lender details page
   * @param lender - The lender to view
   */
  onViewUser(lender: UserWithActivity): void {
    this.router.navigate(['/lender-details', lender.id]);
  }

  /**
   * Delete lender with confirmation modal
   * @param lender - The lender to delete
   */
  async onDeleteUser(lender: UserWithActivity): Promise<void> {
    try {
      const confirmed = await this.modalService.openDeleteAccountModal('lender');
      
      if (!confirmed) {
        return;
      }

      // Delete from Firestore
      await this.firestoreService.deleteDocument(`lenders/${lender.id}`);
      
      console.log(`Successfully deleted lender: ${lender.id}`);

      // Update local state by filtering out the deleted lender
      this.lenders.update(current => 
        current.filter(l => l.id !== lender.id)
      );

    } catch (err) {
      console.error('Error deleting lender:', err);
      this.error.set('Failed to delete lender. Please try again.');
    }
  }

  // ============================================================================
  // DISPLAY FORMATTING METHODS
  // ============================================================================

  /**
   * Get full name from first and last name
   */
  getFullName(user: UserWithActivity): string {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return fullName || 'N/A';
  }

  /**
   * Get formatted location string
   */
  getLocation(user: UserWithActivity): string {
    if (user.city && user.state) {
      return `${user.city}, ${this.getFormattedStateName(user.state)}`;
    } else if (user.city) {
      return user.city;
    } else if (user.state) {
      return this.getFormattedStateName(user.state);
    }
    return 'N/A';
  }

  /**
   * Get formatted state name (e.g., "NC" -> "North Carolina")
   */
  getFormattedStateName(state?: string): string {
    if (!state) return '';
    return this.locationService.formatValueForDisplay(state);
  }

  /**
   * Get formatted lender types as comma-separated string
   */
  getLenderTypes(lender: UserWithActivity): string {
    if (!lender) return 'N/A';

    // Try all possible locations for lender types
    const types =
      lender.lenderTypes ||
      lender.productInfo?.lenderTypes ||
      lender._rawData?.productInfo?.lenderTypes ||
      lender._rawData?.lenderTypes;

    // Handle array of types
    if (Array.isArray(types) && types.length > 0) {
      return types.map(type => this.formatLenderType(type)).join(', ');
    }

    // Handle single string type
    if (typeof types === 'string') {
      return this.formatLenderType(types);
    }

    return 'General';
  }

  /**
   * Format individual lender type (handles objects and strings)
   */
  private formatLenderType(type: string | any): string {
    if (!type) return 'General';

    // Handle object format with various property names
    if (typeof type === 'object') {
      if (type.name) return type.name;
      if (type.value) return this.formatLenderTypeString(type.value);
      if (type.displayName) return type.displayName;
    }

    // Handle string format
    if (typeof type === 'string') {
      return this.formatLenderTypeString(type);
    }

    return 'General';
  }

  /**
   * Format lender type strings with proper capitalization and spacing
   */
  private formatLenderTypeString(type: string): string {
    if (!type) return 'General';

    // Comprehensive mapping of lender types
    const typeMap: Record<string, string> = {
      // Snake case format
      agency: 'Agency Lender',
      balance_sheet: 'Balance Sheet',
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
      general: 'General',
      hard_money: 'Hard Money Lender',
      life_insurance: 'Life Insurance Lender',
      mezzanine_lender: 'Mezzanine Lender',
      non_qm_lender: 'Non-QM Lender',
      portfolio_lender: 'Portfolio Lender',
      private_lender: 'Private Lender',
      sba: 'SBA Lender',
      usda: 'USDA Lender',
      
      // Camel case format (legacy support)
      balanceSheet: 'Balance Sheet',
      bridgeLender: 'Bridge Lender',
      conduitLender: 'Conduit Lender (CMBS)',
      constructionLender: 'Construction Lender',
      correspondentLender: 'Correspondent Lender',
      creditUnion: 'Credit Union',
      directLender: 'Direct Lender',
      familyOffice: 'Family Office',
      hardMoney: 'Hard Money Lender',
      lifeInsurance: 'Life Insurance Lender',
      mezzanineLender: 'Mezzanine Lender',
      nonQmLender: 'Non-QM Lender',
      portfolioLender: 'Portfolio Lender',
      privateLender: 'Private Lender',
    };

    // Try exact match first
    if (typeMap[type]) {
      return typeMap[type];
    }

    // Try case-insensitive match
    const lowerType = type.toLowerCase();
    const matchedKey = Object.keys(typeMap).find(
      key => key.toLowerCase() === lowerType
    );
    
    if (matchedKey) {
      return typeMap[matchedKey];
    }

    // Fallback: Format snake_case/camelCase to readable format
    return type
      .replace(/([a-z])([A-Z])/g, '$1 $2')  // camelCase -> camel Case
      .replace(/_/g, ' ')                    // snake_case -> snake case
      .replace(/\b\w/g, l => l.toUpperCase()) // Capitalize each word
      .trim() || 'General';
  }

  // ============================================================================
  // LOGIN TRACKING METHODS
  // ============================================================================

  /**
   * Get human-readable last login text (e.g., "2 days ago", "Never")
   */
  getLastLoginText(user: UserWithActivity): string {
    return this.dateUtils.formatDaysAgo(user.daysSinceLastLogin);
  }

  /**
   * Get color indicator for login status
   */
  getLoginStatusColor(user: UserWithActivity): string {
    return this.dateUtils.getStatusColor(user.loginStatus);
  }

  /**
   * Format creation date consistently
   */
  formatCreatedDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  /**
   * Format last login date consistently
   */
  formatLastLoginDate(date: Date | null): string {
    if (!date) return 'Never';
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  // ============================================================================
  // SORTING METHODS
  // ============================================================================

  /**
   * Sort lenders by column
   * @param column - Column name to sort by
   */
  sortLenders(column: string): void {
    if (this.sortColumn() === column) {
      // Toggle direction if same column
      this.sortDirection.set(
        this.sortDirection() === 'asc' ? 'desc' : 'asc'
      );
    } else {
      // New column, default to ascending
      this.sortColumn.set(column);
      this.sortDirection.set('asc');
    }
  }

  /**
   * Get sort icon for column header
   */
  getSortIcon(column: string): string {
    if (column !== this.sortColumn()) return '';
    return this.sortDirection() === 'asc' ? '↑' : '↓';
  }

  /**
   * Get sortable value from lender object based on column
   */
  private getSortValue(lender: UserWithActivity, column: string): any {
    switch (column) {
      case 'name':
        return this.getFullName(lender).toLowerCase();
      
      case 'company':
        return (lender.company || '').toLowerCase();
      
      case 'location':
        return this.getLocation(lender).toLowerCase();
      
      case 'type':
        return this.getLenderTypes(lender).toLowerCase();
      
      case 'email':
        return (lender.email || '').toLowerCase();
      
      case 'createdAt':
        return lender.createdAt.getTime();
      
      case 'lastLoginAt':
        return lender.lastLoginAt?.getTime() ?? 0;
      
      case 'accountNumber':
        return lender.accountNumber || '';
      
      default:
        return '';
    }
  }

  /**
   * Compare two values for sorting
   */
  private compareValues(
    valueA: any,
    valueB: any,
    direction: 'asc' | 'desc'
  ): number {
    // Handle numeric comparison
    if (typeof valueA === 'number' && typeof valueB === 'number') {
      return direction === 'asc' ? valueA - valueB : valueB - valueA;
    }

    // Handle string comparison
    if (typeof valueA === 'string' && typeof valueB === 'string') {
      return direction === 'asc'
        ? valueA.localeCompare(valueB)
        : valueB.localeCompare(valueA);
    }

    // Fallback comparison
    if (valueA < valueB) return direction === 'asc' ? -1 : 1;
    if (valueA > valueB) return direction === 'asc' ? 1 : -1;
    return 0;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Reload lenders data (can be called from template or parent)
   */
  async refresh(): Promise<void> {
    await this.loadLenders();
  }
}