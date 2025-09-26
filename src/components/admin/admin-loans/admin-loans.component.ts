// src/app/components/admin/admin-loans/admin-loans.component.ts

import { Component, Input, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DateUtilsService } from '../../../utils/date-utils.service';
import { 
  Firestore, 
  collection, 
  getDocs 
} from '@angular/fire/firestore';

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

@Component({
  selector: 'app-admin-loans',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-loans.component.html',
  styleUrls: ['./admin-loans.component.css']
})
export class AdminLoansComponent {
  private dateUtils = inject(DateUtilsService);
  private firestore = inject(Firestore);

  // Input properties
  @Input() loans = signal<LoanData[]>([]);
  @Input() userFilter = signal<string>('');

async ngOnInit() {
  await this.loadLoans();
}

async loadLoans() {
  try {
    const loansRef = collection(this.firestore, 'loans');
    const loansSnapshot = await getDocs(loansRef);
    
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
    originatorName: this.getOriginatorName(data['originatorId'] || data['createdBy'])
  };
});
    this.loans.set(loansData);
  } catch (error) {
    console.error('Error loading loans:', error);
  }
}

  // Sorting properties
  sortColumn = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Computed filtered loans
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

  // Add this method to your AdminLoansComponent class
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

// Add this method for originator name lookup
getOriginatorName(uid?: string): string {
  if (!uid) return 'N/A';
  // You'll need to implement originator name lookup or return a placeholder
  return uid.substring(0, 8).toUpperCase(); // fallback to short UID
}

  // Format currency
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
    }).format(numAmount);
  }

  // Format date
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

  // Get status display class
  getStatusClass(loan: LoanData): string {
    const status = (loan.status || 'pending').toLowerCase();
    return `status-${status}`;
  }

  // Get shortened loan ID for display
  getShortLoanId(id: string): string {
    return id?.substring(0, 8).toUpperCase() || 'N/A';
  }

  // Get location string
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

  // Format property type for display
  formatPropertyType(category: string, subCategory?: string): string {
    if (!category) return 'N/A';
    
    if (subCategory) {
      return `${category} - ${subCategory}`;
    }
    return category;
  }

  // Sorting
  sortLoans(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    // Note: For actual sorting implementation, you'd need to update the loans signal
    // This is a basic structure - full sorting would require more complex logic
  }

  getSortIcon(column: string): string {
    if (column !== this.sortColumn) return '';
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  // Get loan amount range for grouping/display
  getLoanAmountRange(amount: number): string {
    if (amount < 100000) return 'Under $100K';
    if (amount < 500000) return '$100K - $500K';
    if (amount < 1000000) return '$500K - $1M';
    if (amount < 5000000) return '$1M - $5M';
    if (amount < 10000000) return '$5M - $10M';
    return 'Over $10M';
  }

  // Get days since loan creation
  getDaysSinceCreated(createdAt: Date): number {
    const normalized = this.dateUtils.normalizeTimestamp(createdAt);
    return this.dateUtils.daysBetween(normalized, new Date());
  }

  // Get urgency indicator based on loan age
  getUrgencyClass(loan: LoanData): string {
    const days = this.getDaysSinceCreated(loan.createdAt);
    if (days <= 7) return 'urgency-new';
    if (days <= 30) return 'urgency-recent';
    if (days <= 90) return 'urgency-moderate';
    return 'urgency-old';
  }
}