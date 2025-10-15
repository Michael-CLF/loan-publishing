// src/app/components/admin/admin-loans/admin-loans.component.ts

import { Component, Input, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DateUtilsService } from '../../../utils/date-utils.service';
import { UserService } from '../../../services/user.service';
import { 
  Firestore, 
  collection, 
  getDocs 
} from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';

/**
 * Loan data interface for admin dashboard
 * Following Angular 18 best practices with explicit typing
 */
export interface LoanData {
  id: string;
  loanAmount: number;
  propertyTypeCategory: string;
  propertySubCategory?: string;
  transactionType: string;
  city: string;
  state: string;
  contact: string;
  email: string;
  phone: string;
  createdAt: Date;
  createdBy: string;
  originatorId: string;
  status: string;
  originatorName: string;
}

/**
 * AdminLoansComponent - Displays all loans with proper formatting
 * 
 * Angular 18 Best Practices:
 * - Signal-based reactive state management
 * - Computed signals for filtering
 * - Proper dependency injection with inject()
 * - Efficient batch loading of user data
 * - Type-safe implementation
 * - Separation of concerns with utility methods
 */
@Component({
  selector: 'app-admin-loans',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-loans.component.html',
  styleUrls: ['./admin-loans.component.css']
})
export class AdminLoansComponent implements OnInit {
  // Dependency injection using Angular 18 inject() pattern
  private dateUtils = inject(DateUtilsService);
  private firestore = inject(Firestore);
  private userService = inject(UserService);

  // Signal-based state management (Angular 18)
  @Input() loans = signal<LoanData[]>([]);
  @Input() userFilter = signal<string>('');
  
  isLoading = signal<boolean>(false);

  // Sorting state
  sortColumn = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  /**
   * Computed signal for filtered loans
   * Automatically updates when loans() or userFilter() changes
   */
  filteredLoans = computed(() => {
    const filter = this.userFilter().toLowerCase();
    if (!filter) return this.loans();

    return this.loans().filter(loan =>
      loan.id?.toLowerCase().includes(filter) ||
      loan.originatorName?.toLowerCase().includes(filter) ||
      loan.city?.toLowerCase().includes(filter) ||
      loan.state?.toLowerCase().includes(filter) ||
      loan.propertyTypeCategory?.toLowerCase().includes(filter) ||
      loan.contact?.toLowerCase().includes(filter)
    );
  });

  /**
   * Property category mapping for display formatting
   * Maps database values to user-friendly names
   */
  private readonly categoryMap: Record<string, string> = {
    'residential': 'Residential',
    'commercial': 'Commercial',
    'multifamily': 'Multifamily',
    'industrial': 'Industrial',
    'retail': 'Retail',
    'office': 'Office',
    'mixed_use': 'Mixed Use',
    'special_purpose': 'Special Purpose',
    'hospitality': 'Hospitality',
    'healthcare': 'Healthcare',
    'land': 'Land'
  };

  /**
   * Property subcategory mapping for display formatting
   * Maps database values (category:subcategory) to user-friendly names
   */
  private readonly subcategoryMap: Record<string, string> = {
    // Residential
    'residential:1_4_units': '1-4 Units',
    'residential:single_family': 'Single Family',
    'residential:condominium': 'Condominium',
    'residential:co_op': 'Co-op',
    'residential:triplex': 'Triplex',
    'residential:quadplex': 'Quadplex',
    'residential:manufactured_home': 'Manufactured Home',
    'residential:mobile_home_double_wide': 'Mobile Home Double Wide',
    'residential:mobile_home_single_wide': 'Mobile Home Single Wide',
    'residential:modular_home': 'Modular Home',
    
    // Commercial
    'commercial:auto_repair_shop': 'Auto Repair Shop',
    'commercial:bank_branch': 'Bank Branch',
    'commercial:business_center': 'Business Center',
    'commercial:call_center': 'Call Center',
    'commercial:car_wash': 'Car Wash',
    'commercial:dry_cleaner': 'Dry Cleaner',
    'commercial:funeral_home': 'Funeral Home',
    'commercial:general_commercial': 'General Commercial',
    'commercial:printing_facility': 'Printing Facility',
    'commercial:sales_office': 'Sales Office',
    'commercial:showroom': 'Showroom',
    'commercial:truck_terminal': 'Truck Terminal',
    
    // Multifamily
    'multifamily:apartment_building': 'Apartment Building',
    'multifamily:affordable_housing': 'Affordable Housing',
    'multifamily:independent_living': 'Independent Living',
    'multifamily:manufactured': 'Manufactured',
    'multifamily:military_housing': 'Military Housing',
    'multifamily:senior_housing': 'Senior Housing',
    'multifamily:student_housing': 'Student Housing',
    
    // Industrial
    'industrial:warehouse': 'Warehouse',
    'industrial:distribution_center': 'Distribution Center',
    'industrial:cold_storage': 'Cold Storage',
    'industrial:flex_space': 'Flex Space',
    'industrial:self_storage': 'Self Storage',
    
    // Retail
    'retail:anchored_center': 'Anchored Center',
    'retail:mall': 'Mall',
    'retail:mixed_use_retail': 'Mixed Use Retail',
    'retail:nnn_retail': 'NNN Retail',
    'retail:restaurant': 'Restaurant',
    'retail:single_tenant': 'Single Tenant',
    'retail:strip_mall': 'Strip Mall',
    
    // Office
    'office:corporate_office': 'Corporate Headquarters',
    'office:executive_suites': 'Executive Suites/Co-working',
    'office:medical_office': 'Medical Office',
    'office:professional_office_building': 'Professional Office Building',
    'office:flex': 'Office/Industrial',
    
    // Mixed Use
    'mixed_use:live_work': 'Live/Work Units',
    'mixed_use:residential_office': 'Residential + Office',
    'mixed_use:residential_retail': 'Residential over Retail',
    'mixed_use:retail_office': 'Retail + Office',
    
    // Healthcare
    'healthcare:assisted_living': 'Assisted Living',
    'healthcare:hospital': 'Hospital',
    'healthcare:independent_living': 'Independent Living',
    'healthcare:rehab_facility': 'Rehab Facility',
    'healthcare:urgent_care': 'Urgent Care',
    
    // Hospitality
    'hospitality:hotel': 'Hotel',
    'hospitality:motel': 'Motel',
    'hospitality:long_term_rentals': 'Long-term Rentals',
    'hospitality:short_term_rentals': 'Short-term Rentals',
    
    // Special Purpose
    'special_purpose:auto_dealership': 'Auto Dealership',
    'special_purpose:church': 'Church',
    'special_purpose:data_center': 'Data Center',
    'special_purpose:daycare': 'Daycare',
    'special_purpose:energy_park': 'Energy Park',
    'special_purpose:farm': 'Farm',
    'special_purpose:gas_station': 'Gas Station',
    'special_purpose:golf_course': 'Golf Course',
    'special_purpose:marina': 'Marina',
    'special_purpose:mobile_home_park': 'Mobile Home Park',
    'special_purpose:parking_garage': 'Parking Garage',
    'special_purpose:r_and_d': 'R&D',
    'special_purpose:resort_rv_park': 'Resort RV Park',
    'special_purpose:service_station': 'Service Station',
    'special_purpose:sports_complex': 'Sports Complex',
    'special_purpose:stadium': 'Stadium'
  };

  async ngOnInit() {
    await this.loadLoans();
  }

  /**
   * Load all loans from Firestore with originator information
   * Uses efficient batch loading to prevent N+1 query problem
   */
  async loadLoans() {
    this.isLoading.set(true);
    
    try {
      const loansRef = collection(this.firestore, 'loans');
      const loansSnapshot = await getDocs(loansRef);
      
      // Map Firestore documents to LoanData interface
      const loansData = loansSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          loanAmount: this.parseAmount(data['loanAmount']),
          propertyTypeCategory: data['propertyTypeCategory'] || 'Unknown',
          propertySubCategory: data['propertySubCategory'] || '',
          transactionType: data['transactionType'] || '',
          city: data['city'] || '',
          state: data['state'] || '',
          contact: data['contact'] || data['email'] || '',
          email: data['email'] || '',
          phone: data['phone'] || '',
          createdAt: this.dateUtils.normalizeTimestamp(data['createdAt']),
          createdBy: data['createdBy'] || '',
          originatorId: data['originatorId'] || data['createdBy'] || '',
          status: data['status'] || 'Pending',
          originatorName: 'Loading...'
        } as LoanData;
      });

      // Batch load all originator names efficiently (prevents N+1 queries)
      await this.loadOriginatorNames(loansData);
      
      // Update signal with complete data
      this.loans.set(loansData);
    } catch (error) {
      console.error('❌ Error loading loans:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Batch load originator names for all loans
   * Angular 18 best practice: Load all user data in one operation
   * 
   * @param loans - Array of loans to populate with originator names
   */
 /**
 * Load originator names for all loans
 * Uses existing UserService methods
 */
private async loadOriginatorNames(loans: LoanData[]): Promise<void> {
  // Extract unique originator IDs
  const originatorIds = [...new Set(
    loans
      .map(loan => loan.originatorId)
      .filter(id => id)
  )];

  if (originatorIds.length === 0) {
    loans.forEach(loan => loan.originatorName = 'N/A');
    return;
  }

  try {
    // Load each user profile using existing getUserProfileByUid method
    const userPromises = originatorIds.map(uid => 
      firstValueFrom(this.userService.getUserProfileByUid(uid))
    );

    const users = await Promise.all(userPromises);

    // Create a map of uid to user profile
    const userMap = new Map<string, any>();
    users.forEach((user, index) => {
      if (user) {
        userMap.set(originatorIds[index], user);
      }
    });

    // Populate originator names from user data
    loans.forEach(loan => {
      if (loan.originatorId) {
        const user = userMap.get(loan.originatorId);
        
        if (user) {
          loan.originatorName = this.formatOriginatorName(user);
        } else {
          loan.originatorName = this.formatUidFallback(loan.originatorId);
        }
      } else {
        loan.originatorName = 'N/A';
      }
    });
  } catch (error) {
    console.error('❌ Error loading originator names:', error);
    // Set fallback names on error
    loans.forEach(loan => {
      if (loan.originatorId) {
        loan.originatorName = this.formatUidFallback(loan.originatorId);
      } else {
        loan.originatorName = 'N/A';
      }
    });
  }
}

  /**
   * Format originator name from user profile
   * Priority order: displayName > firstName + lastName > firstName > email > UID
   * 
   * @param user - User profile object
   * @returns Formatted display name
   */
 /**
 * Format originator name from user profile
 * Priority order: displayName > firstName + lastName > firstName > email > contactEmail > UID
 */
private formatOriginatorName(user: any): string {
  // Check for displayName
  if (user.displayName) {
    return user.displayName;
  }

  // Check for firstName + lastName
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }

  // Check for just firstName
  if (user.firstName) {
    return user.firstName;
  }

  // Check for email at root level
  if (user.email) {
    return user.email.split('@')[0];
  }

  // Check for email in contactInfo (your user structure might have this)
  if (user.contactInfo?.contactEmail) {
    return user.contactInfo.contactEmail.split('@')[0];
  }

  // Check for email in nested structure
  if (user.contact?.email) {
    return user.contact.email.split('@')[0];
  }

  // Fall back to formatted UID
  return this.formatUidFallback(user.uid || user.id);
}
  /**
   * Format UID as fallback display name
   * Shows first 8 characters in uppercase
   * 
   * @param uid - User ID
   * @returns Formatted UID
   */
  private formatUidFallback(uid: string): string {
    if (!uid) return 'N/A';
    return uid.substring(0, 8).toUpperCase();
  }

  /**
   * Parse amount from various formats (string with $, number, etc.)
   * Handles currency strings like "$2,040,000" and converts to number
   * 
   * @param value - Amount in any format
   * @returns Parsed number value
   */
  parseAmount(value: any): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    if (typeof value === 'number') {
      return isNaN(value) ? 0 : value;
    }

    if (typeof value === 'string') {
      const cleanValue = value.replace(/[$,]/g, '');
      const parsedValue = parseFloat(cleanValue);
      return isNaN(parsedValue) ? 0 : parsedValue;
    }

    return 0;
  }

  /**
   * Format currency for display
   * 
   * @param amount - Amount as string or number
   * @returns Formatted currency string (e.g., "$2,040,000")
   */
  formatCurrency(amount: any): string {
    let numAmount: number;

    if (amount === null || amount === undefined) {
      return '-';
    }

    if (typeof amount === 'string') {
      const cleanedAmount = amount.replace(/[$,]/g, '');
      numAmount = parseFloat(cleanedAmount);
    } else {
      numAmount = amount;
    }

    if (isNaN(numAmount)) {
      return '-';
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numAmount);
  }

  /**
   * Format date for display
   * 
   * @param date - Date object or Firestore timestamp
   * @returns Formatted date string (e.g., "May 14, 2025")
   */
  formatDate(date: Date): string {
    if (!date) return 'N/A';
    
    try {
      const normalizedDate = this.dateUtils.normalizeTimestamp(date);
      return normalizedDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  }

  /**
   * Get CSS class for loan status badge
   * 
   * @param loan - Loan data object
   * @returns CSS class name
   */
  getStatusClass(loan: LoanData): string {
    const status = (loan.status || 'pending').toLowerCase();
    return `status-${status}`;
  }

  /**
   * Get shortened loan ID for display
   * 
   * @param id - Full loan ID
   * @returns First 8 characters in uppercase
   */
  getShortLoanId(id: string): string {
    return id?.substring(0, 8).toUpperCase() || 'N/A';
  }

  /**
   * Get formatted location string
   * 
   * @param loan - Loan data object
   * @returns Formatted location (e.g., "Potomac, Maryland")
   */
  getLocation(loan: LoanData): string {
    if (loan.city && loan.state) {
      return `${loan.city}, ${loan.state}`;
    } else if (loan.city) {
      return loan.city;
    } else if (loan.state) {
      return loan.state;
    }
    return 'N/A';
  }

  /**
   * Format property type for display
   * Converts database values to user-friendly names
   * Handles both properly formatted and legacy data
   * 
   * @param category - Property category (e.g., "residential" or "Residential")
   * @param subCategory - Property subcategory (e.g., "residential:1_4_units" or "1-4 Units")
   * @returns Formatted property type (e.g., "Residential - 1-4 Units")
   */
  formatPropertyType(category: string, subCategory?: string): string {
    if (!category) return 'N/A';
    
    // Format category
    const formattedCategory = this.formatCategory(category);
    
    if (!subCategory) {
      return formattedCategory;
    }
    
    // Format subcategory
    const formattedSub = this.formatSubcategory(subCategory);
    
    if (!formattedSub) {
      return formattedCategory;
    }
    
    return `${formattedCategory} - ${formattedSub}`;
  }

  /**
   * Format property category
   * Handles both database values (lowercase) and display values (Title Case)
   * 
   * @param category - Category value from database
   * @returns Formatted display name
   */
  private formatCategory(category: string): string {
    if (!category) return 'Unknown';
    
    // If already formatted (starts with capital), return as is
    if (category[0] === category[0].toUpperCase() && category.includes(' ')) {
      return category;
    }
    
    // Convert database value to display name
    return this.categoryMap[category.toLowerCase()] || category;
  }

  /**
   * Format property subcategory
   * Handles both database format (category:subcategory) and display format
   * 
   * @param sub - Subcategory value from database
   * @returns Formatted display name
   */
  private formatSubcategory(sub: string): string {
    if (!sub) return '';
    
    // If already formatted (contains spaces or dashes), return as is
    if (sub.includes(' ') || sub.includes('-')) {
      return sub;
    }
    
    // Try exact match first
    if (this.subcategoryMap[sub]) {
      return this.subcategoryMap[sub];
    }
    
    // Try lowercase match
    const lowerSub = sub.toLowerCase();
    if (this.subcategoryMap[lowerSub]) {
      return this.subcategoryMap[lowerSub];
    }
    
    // If contains colon, extract and format the subcategory part
    if (sub.includes(':')) {
      const [category, subcategory] = sub.split(':');
      const key = `${category.toLowerCase()}:${subcategory.toLowerCase()}`;
      
      if (this.subcategoryMap[key]) {
        return this.subcategoryMap[key];
      }
      
      // Fallback: format subcategory part nicely
      return subcategory
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
    
    // Last resort: format snake_case to Title Case
    return sub
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
 * Sort loans by column with actual implementation
 * Toggles direction if same column clicked again
 */
sortLoans(column: string): void {
  if (this.sortColumn === column) {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    this.sortColumn = column;
    this.sortDirection = 'asc';
  }

  // Actually sort the loans
  const sorted = [...this.loans()].sort((a, b) => {
    let valueA: any;
    let valueB: any;

    // Get values based on column
    switch (column) {
      case 'id':
        valueA = a.id;
        valueB = b.id;
        break;
      case 'loanAmount':
        valueA = a.loanAmount;
        valueB = b.loanAmount;
        break;
      case 'propertyTypeCategory':
        valueA = this.formatCategory(a.propertyTypeCategory);
        valueB = this.formatCategory(b.propertyTypeCategory);
        break;
      case 'city':
        valueA = a.city?.toLowerCase() || '';
        valueB = b.city?.toLowerCase() || '';
        break;
      case 'originatorName':
        valueA = a.originatorName?.toLowerCase() || '';
        valueB = b.originatorName?.toLowerCase() || '';
        break;
      case 'status':
        valueA = a.status?.toLowerCase() || '';
        valueB = b.status?.toLowerCase() || '';
        break;
      case 'createdAt':
        valueA = a.createdAt;
        valueB = b.createdAt;
        break;
      default:
        return 0;
    }

    // Compare values
    let comparison = 0;
    
    if (valueA instanceof Date && valueB instanceof Date) {
      comparison = valueA.getTime() - valueB.getTime();
    } else if (typeof valueA === 'number' && typeof valueB === 'number') {
      comparison = valueA - valueB;
    } else {
      comparison = String(valueA).localeCompare(String(valueB));
    }

    return this.sortDirection === 'asc' ? comparison : -comparison;
  });

  // Update the signal with sorted data
  this.loans.set(sorted);
}

  /**
   * Get sort icon for column header
   * 
   * @param column - Column name
   * @returns Arrow icon or empty string
   */
  getSortIcon(column: string): string {
    if (column !== this.sortColumn) return '';
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  /**
   * Get loan amount range category for display
   * 
   * @param amount - Loan amount
   * @returns Range category (e.g., "$1M - $5M")
   */
  getLoanAmountRange(amount: number): string {
    if (amount < 100000) return '$0 - $100K';
    if (amount < 500000) return '$100K - $500K';
    if (amount < 1000000) return '$500K - $1M';
    if (amount < 5000000) return '$1M - $5M';
    if (amount < 10000000) return '$5M - $10M';
    return 'Over $10M';
  }

  /**
   * Get days since loan was created
   * 
   * @param createdAt - Creation date
   * @returns Number of days
   */
  getDaysSinceCreated(createdAt: Date): number {
    const normalized = this.dateUtils.normalizeTimestamp(createdAt);
    return this.dateUtils.daysBetween(normalized, new Date());
  }

  /**
   * Get urgency CSS class based on loan age
   * Used for color-coding loan rows
   * 
   * @param loan - Loan data object
   * @returns CSS class name
   */
  getUrgencyClass(loan: LoanData): string {
    const days = this.getDaysSinceCreated(loan.createdAt);
    if (days <= 7) return 'urgency-new';
    if (days <= 30) return 'urgency-recent';
    if (days <= 90) return 'urgency-moderate';
    return 'urgency-old';
  }
}