import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FirestoreService } from '../../services/firestore.service';
import { LenderFilterComponent } from '../../components/lender-filter/lender-filter.component';
import { LenderService } from '../../services/lender.service';
import { Subscription } from 'rxjs';

export interface Lender {
  id?: string;
  name: string;
  lenderType: string;
  propertyCategories?: string[];
  states?: string[];
  productInfo?: {
    minLoanAmount?: number;
    maxLoanAmount?: number;
    lenderTypes?: string[];
  };
  contactInfo?: any;
}

export interface LenderFilters {
  lenderType: string;
  propertyCategory: string;
  state: string;
  loanAmount: string;
}

@Component({
  selector: 'app-lender-list',
  standalone: true,
  imports: [CommonModule, RouterModule, LenderFilterComponent],
  templateUrl: './lender-list.component.html',
  styleUrl: './lender-list.component.css',
})
export class LenderListComponent implements OnInit, OnDestroy {
  lenders: Lender[] = [];
  loading = true;
  private lenderService = inject(LenderService);
  private lendersSubscription: Subscription | null = null; // Add this line
  private subscription: Subscription | null = null;

  constructor(
    private firestoreService: FirestoreService,
    public router: Router
  ) {}

  ngOnInit(): void {
    this.loadLenders();
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  loadLenders(): void {
    this.loading = true;
    console.log('Starting to load lenders...');

    this.lendersSubscription = this.lenderService.getAllLenders().subscribe({
      next: (data: Lender[]) => {
        // Add type annotation here
        console.log('Lenders received:', data);
        this.lenders = data;
        this.loading = false;
      },
      error: (error: any) => {
        // Add type annotation here
        console.error('Error loading lenders:', error);
        this.loading = false;
      },
      complete: () => {
        console.log('Lenders subscription completed');
      },
    });
  }

  applyFilters(filters: LenderFilters): void {
    this.loading = true;
    console.log('Applying filters:', filters);

    if (this.lendersSubscription) {
      this.lendersSubscription.unsubscribe();
    }

    this.lendersSubscription = this.lenderService
      .searchLenders(
        filters.lenderType,
        filters.propertyCategory,
        filters.state,
        filters.loanAmount
      )
      .subscribe({
        next: (data: Lender[]) => {
          // Add type annotation here
          console.log('Filtered lenders received:', data);
          this.lenders = data;
          this.loading = false;
        },
        error: (error: any) => {
          // Add type annotation here
          console.error('Error filtering lenders:', error);
          this.loading = false;
        },
      });
  }

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

  navigateTo(id: string): void {
    this.router.navigate(['/lender-details', id]);
  }
}
