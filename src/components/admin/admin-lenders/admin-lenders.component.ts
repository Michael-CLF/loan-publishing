// src/app/components/admin/admin-lenders/admin-lenders.component.ts

import { Component, Input, Output, EventEmitter, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserWithActivity } from '../../../interfaces/user-activity.interface';
import { DateUtilsService } from '../../../utils/date-utils.service';
import { LocationService } from '../../../services/location.service';
import { 
  Firestore, 
  collection, 
  getDocs 
} from '@angular/fire/firestore';
import { Router, RouterModule } from '@angular/router';


@Component({
  selector: 'app-admin-lenders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-lenders.component.html',
  styleUrls: ['./admin-lenders.component.css']
})
export class AdminLendersComponent implements OnInit {
  private dateUtils = inject(DateUtilsService);
  private locationService = inject(LocationService);
  private firestore = inject(Firestore);
  private loading = signal(false);

  // Input properties
  @Input() lenders = signal<UserWithActivity[]>([]);
  @Input() userFilter = signal<string>('');

  // Output events
  @Output() viewUser = new EventEmitter<UserWithActivity>();
  @Output() deleteUser = new EventEmitter<UserWithActivity>();


// Add data loading
async ngOnInit() {
  await this.loadLenders();
}

async loadLenders() {
  this.loading.set(true);
  try {
    const lendersRef = collection(this.firestore, 'lenders');
    const lendersSnapshot = await getDocs(lendersRef);
    
    const lendersData = lendersSnapshot.docs.map((doc) => {
      const data = doc.data();
      const contactInfo = data['contactInfo'] || {};
      
      // Use your existing data processing logic from admin-users
      const createdAt = this.dateUtils.normalizeTimestamp(data['createdAt']);
      const lastLoginAt = data['lastLoginAt'] ? this.dateUtils.normalizeTimestamp(data['lastLoginAt']) : null;
      const daysSinceLastLogin = this.dateUtils.getDaysSinceLastLogin(lastLoginAt);
      const loginStatus = this.dateUtils.getLoginStatus(daysSinceLastLogin);

      return {
        id: doc.id,
        accountNumber: doc.id.substring(0, 8).toUpperCase(),
        firstName: data['firstName'] || contactInfo['firstName'] || '',
        lastName: data['lastName'] || contactInfo['lastName'] || '',
        company: data['company'] || contactInfo['company'] || '',
        email: data['email'] || contactInfo['contactEmail'] || '',
        // ... rest of the mapping logic
        createdAt,
        lastLoginAt,
        daysSinceLastLogin,
        loginStatus,
        role: 'lender' as const,
      };
    });
    
    this.lenders.set(lendersData);
  } catch (error) {
    console.error('Error loading lenders:', error);
  } finally {
    this.loading.set(false);
  }
}

  // Sorting properties
  sortColumn = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Computed filtered lenders
  filteredLenders = computed(() => {
    const filter = this.userFilter().toLowerCase();
    if (!filter) return this.lenders();

    return this.lenders().filter(lender =>
      lender.accountNumber?.toLowerCase().includes(filter) ||
      lender.company?.toLowerCase().includes(filter) ||
      lender.lastName?.toLowerCase().includes(filter) ||
      lender.firstName?.toLowerCase().includes(filter) ||
      lender.email?.toLowerCase().includes(filter)
    );
  });

  // Get full name from first and last name
  getFullName(user: UserWithActivity): string {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A';
  }

  // Get location from city and state
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

  // Get formatted state name
  getFormattedStateName(state?: string): string {
    if (!state) return '';
    return this.locationService.formatValueForDisplay(state);
  }

  // Get lender types formatted
  getLenderTypes(lender: UserWithActivity): string {
    if (!lender) return 'N/A';

    const types =
      lender.lenderTypes ||
      lender.productInfo?.lenderTypes ||
      lender._rawData?.productInfo?.lenderTypes ||
      lender._rawData?.lenderTypes;

    if (types && Array.isArray(types) && types.length > 0) {
      return types.map(type => this.formatLenderType(type)).join(', ');
    }

    if (types && typeof types === 'string') {
      return this.formatLenderType(types);
    }

    return 'General';
  }

  // Format individual lender type
  private formatLenderType(type: string | any): string {
    if (!type) return 'General';

    if (typeof type === 'object') {
      if (type.name) return type.name;
      if (type.value) return this.formatLenderTypeString(type.value);
      if (type.displayName) return type.displayName;
    }

    if (typeof type === 'string') {
      return this.formatLenderTypeString(type);
    }

    return 'General';
  }

  // Format lender type strings
  private formatLenderTypeString(type: string): string {
    if (!type) return 'General';

    const typeMap: { [key: string]: string } = {
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
    };

    if (typeMap[type]) {
      return typeMap[type];
    }

    const lowerType = type.toLowerCase();
    const matchedKey = Object.keys(typeMap).find(
      key => key.toLowerCase() === lowerType
    );
    if (matchedKey) {
      return typeMap[matchedKey];
    }

    return type
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim() || 'General';
  }

  // Login tracking methods
  getLastLoginText(user: UserWithActivity): string {
    return this.dateUtils.formatDaysAgo(user.daysSinceLastLogin);
  }

  getLoginStatusColor(user: UserWithActivity): string {
    return this.dateUtils.getStatusColor(user.loginStatus);
  }

  // Date formatting
  formatCreatedDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  formatLastLoginDate(date: Date | null): string {
    if (!date) return 'Never';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  // Event handlers
  onViewUser(lender: UserWithActivity): void {
    this.viewUser.emit(lender);
  }

  onDeleteUser(lender: UserWithActivity): void {
    this.deleteUser.emit(lender);
  }

  // Sorting
  sortLenders(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    // Apply sorting to the signal (this would need to be implemented based on your sorting needs)
    // For now, the computed filtered list handles basic filtering
  }

  getSortIcon(column: string): string {
    if (column !== this.sortColumn) return '';
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }
}