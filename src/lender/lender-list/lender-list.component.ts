import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FirestoreService } from '../../services/firestore.service';
import { LenderFilterComponent } from '../../components/lender-filter/lender-filter.component';
import { LenderFilterService } from '../../services/lender-filter.service';
import { LenderService, Lender } from '../../services/lender.service';
import { Subscription } from 'rxjs';
import { LenderFilters } from '../../models/lender-filters.model';

@Component({
  selector: 'app-lender-list',
  standalone: true,
  imports: [CommonModule, RouterModule, LenderFilterComponent],
  templateUrl: './lender-list.component.html',
  styleUrl: './lender-list.component.css',
})
export class LenderListComponent implements OnInit, OnDestroy {
  lenders: Lender[] = [];
  filteredLenders: Lender[] = [];
  loading = true;
  error = false;

  private firestoreService = inject(FirestoreService);
  private lenderService = inject(LenderService);
  private router = inject(Router);
  private lendersSubscription: Subscription | null = null;
  private filterService = inject(LenderFilterService);

  ngOnInit(): void {
    this.loadLenders();
  }

  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    if (this.lendersSubscription) {
      this.lendersSubscription.unsubscribe();
    }
  }

  loadLenders(): void {
    this.loading = true;

    if (this.lendersSubscription) {
      this.lendersSubscription.unsubscribe();
    }

    // Use the getAllLenders method from LenderService
    this.lendersSubscription = this.lenderService.getAllLenders().subscribe({
      next: (lenders: Lender[]) => {
        this.lenders = lenders;
        this.loading = false;
        console.log('Loaded lenders:', this.lenders.length);
      },
      error: (err: Error) => {
        console.error('Error loading lenders:', err);
        this.error = true;
        this.loading = false;
      },
    });
  }

  // This method matches the (applyFilters) output from LenderFilterComponent
  applyFilters(filters: LenderFilters): void {
    this.loading = true;
    console.log('Applying filters:', filters);

    if (this.lendersSubscription) {
      this.lendersSubscription.unsubscribe();
    }

    // Use the searchLenders method from LenderService
    this.lendersSubscription = this.lenderService
      .searchLenders(
        filters.lenderType,
        filters.propertyCategory,
        filters.state,
        filters.loanAmount,
        filters.loanType
      )
      .subscribe({
        next: (filteredLenders: Lender[]) => {
          this.lenders = filteredLenders; // Update the lenders array directly
          this.loading = false;
          console.log('Filtered lenders:', filteredLenders.length);
        },
        error: (err: Error) => {
          console.error('Error filtering lenders:', err);
          this.error = true;
          this.loading = false;
        },
      });
  }

  // This method matches the (resetFilters) output from LenderFilterComponent
  resetFilters(): void {
    this.loading = true;
    console.log('Resetting filters...');

    // Reset to original lenders list
    this.loadLenders();
  }

  getLenderTypeName(value: string): string {
    const lenderTypeMap: { [key: string]: string } = {
      agency: 'Agency Lender',
      balanceSheet: 'Balance Sheet',
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

    return lenderTypeMap[value] || value;
  }

  // This is for the template click handler
  navigateTo(lenderId: string): void {
    this.router.navigate(['/lender-details', lenderId]);
  }
}
