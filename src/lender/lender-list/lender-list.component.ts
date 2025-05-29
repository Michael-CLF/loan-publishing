import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

import { LenderFilterComponent } from '../../components/lender-filter/lender-filter.component';
import { LenderFilterService } from '../../services/lender-filter.service';

@Component({
  selector: 'app-lender-list',
  standalone: true,
  imports: [CommonModule, RouterModule, LenderFilterComponent],
  templateUrl: './lender-list.component.html',
  styleUrl: './lender-list.component.css',
})
export class LenderListComponent {
  private filterService = inject(LenderFilterService);
  private router = inject(Router);

  lenders = this.filterService.lenders;
  loading = this.filterService.loading;

  // Pagination setup
  pageSize = 15;
  currentPage = 1;

  get paginatedLenders() {
    const allLenders = this.lenders();
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return allLenders.slice(startIndex, startIndex + this.pageSize);
  }

  get totalPages() {
    return Math.ceil(this.lenders().length / this.pageSize);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  getLenderTypeName(value: string): string {
    const lenderTypeMap: { [key: string]: string } = {
      agency: 'Agency Lender',
      'balance sheet': 'Balance Sheet',
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

  navigateTo(lenderId: string): void {
    this.router.navigate(['/lender-details', lenderId]);
  }
}
