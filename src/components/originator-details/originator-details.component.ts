// originator-details.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Firestore, doc, getDoc, collection, query, where, getDocs } from '@angular/fire/firestore';
import { LocationService } from '../../services/location.service'; // Adjust path as needed

@Component({
  selector: 'app-originator-details',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './originator-details.component.html',
  styleUrls: ['./originator-details.component.css']
})
export class OriginatorDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private firestore = inject(Firestore);
  private locationService = inject(LocationService);

  originatorId: string | null = null;
  originator: any = null;
  originatorLoans: any[] = [];
  loading = true;
  loansLoading = true;
  error: string | null = null;
  loansError: string | null = null;

// Property colors for visualization - handle both old and new formats
propertyColorMap: Record<string, string> = {
  // New standardized format (snake_case)
  commercial: '#1E90FF',
  healthcare: '#cb4335',
  hospitality: '#1b4f72',
  industrial: '#2c3e50',
  land: '#023020',
  mixed_use: '#8A2BE2',
  multifamily: '#6c3483',
  office: '#4682B4',
  residential: '#DC143C',
  retail: '#660000',
  special_purpose: '#6e2c00',
  
  // Legacy format (Title Case/spaces) - for backward compatibility
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

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.originatorId = params.get('id');
      if (this.originatorId) {
        this.loadOriginatorDetails(this.originatorId);
        this.loadOriginatorLoans(this.originatorId);
      } else {
        this.error = 'No originator ID provided';
        this.loading = false;
      }
    });
  }

  async loadOriginatorDetails(id: string): Promise<void> {
    try {
      this.loading = true;
      this.error = null;

      const originatorDocRef = doc(this.firestore, `originators/${id}`);
      const originatorSnap = await getDoc(originatorDocRef);

      if (originatorSnap.exists()) {
        const data = originatorSnap.data();
        const contactInfo = data['contactInfo'] || {};

        this.originator = {
          id: originatorSnap.id,
          accountNumber: originatorSnap.id.substring(0, 8).toUpperCase(),
          firstName: contactInfo['firstName'] || data['firstName'] || '',
          lastName: contactInfo['lastName'] || data['lastName'] || '',
          email: contactInfo['contactEmail'] || data['email'] || '',
          company: contactInfo['company'] || data['company'] || '',
          phone: contactInfo['contactPhone'] || data['phone'] || '',
          city: contactInfo['city'] || data['city'] || '',
          state: contactInfo['state'] || data['state'] || '',
          createdAt: data['createdAt'],
          role: 'originator'
        };
      } else {
        this.error = 'Originator not found';
      }
    } catch (err) {
      console.error('Error loading originator details:', err);
      this.error = 'Failed to load originator details';
    } finally {
      this.loading = false;
    }
  }

  async loadOriginatorLoans(originatorId: string): Promise<void> {
    try {
      this.loansLoading = true;
      this.loansError = null;

      // Query loans collection for loans created by this originator
      const loansRef = collection(this.firestore, 'loans');
      const q = query(loansRef, where('originatorId', '==', originatorId));
      
      // If 'originatorId' isn't the field name, try 'createdBy' as fallback
      let querySnapshot = await getDocs(q);
      
      // If no results with originatorId, try createdBy field
      if (querySnapshot.empty) {
        const qFallback = query(loansRef, where('createdBy', '==', originatorId));
        querySnapshot = await getDocs(qFallback);
      }

      if (querySnapshot.empty) {
        this.originatorLoans = [];
        return;
      }

      this.originatorLoans = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          loanAmount: this.parseAmount(data['loanAmount']),
          propertyTypeCategory: data['propertyTypeCategory'] || data['propertyType'] || 'Unknown',
          propertySubCategory: data['propertySubCategory'] || '',
          transactionType: data['transactionType'] || '',
          city: data['city'] || '',
          state: data['state'] || '',
          createdAt: data['createdAt'] || new Date(),
          status: data['status'] || 'Active',
          ltv: data['ltv'] || 'N/A',
          loanType: data['loanType'] || '',
          // Add other loan fields you want to display
        };
      });

    } catch (err) {
      console.error('Error loading originator loans:', err);
      this.loansError = 'Failed to load loans for this originator';
    } finally {
      this.loansLoading = false;
    }
  }

  parseAmount(value: any): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    if (typeof value === 'number') {
      return isNaN(value) ? 0 : value;
    }

    // Try to parse as number if it's a string
    if (typeof value === 'string') {
      // Remove currency symbols and commas
      const cleanValue = value.replace(/[$,]/g, '');
      const parsedValue = parseFloat(cleanValue);
      return isNaN(parsedValue) ? 0 : parsedValue;
    }

    return 0;
  }

  getFormattedStateName(state?: string): string {
    if (!state) return '';
    return this.locationService.formatValueForDisplay(state);
  }

  formatDate(timestamp: any): string {
    if (!timestamp) return 'N/A';

    try {
      // Handle Firestore Timestamp
      if (timestamp.toDate) {
        return timestamp.toDate().toLocaleDateString();
      }

      // Handle regular date
      return new Date(timestamp).toLocaleDateString();
    } catch (err) {
      return 'Invalid date';
    }
  }

  formatCurrency(value: string | number): string {
    if (!value) return '$0';

    if (typeof value === 'string' && value.includes('$')) {
      return value;
    }

    const numValue =
      typeof value === 'string'
        ? parseFloat(value.replace(/[^\d.-]/g, ''))
        : value;

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numValue);
  }

  getColor(propertyType: string): string {
    return this.propertyColorMap[propertyType] || '#000000';
  }

  viewLoanDetails(loanId: string): void {
    this.router.navigate(['/loans', loanId]);
  }

  goBack(): void {
    this.router.navigate(['/admin']);
  }
}