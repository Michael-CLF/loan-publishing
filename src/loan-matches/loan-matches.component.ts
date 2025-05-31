// ✅ File: loan-matches.component.ts

import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { LoanService } from '../services/loan.service';
import { LenderService } from '../services/lender.service';
import { Loan } from '../models/loan-model.model';
import { Lender } from '../services/lender.service';
import { StateMigrationService } from '../services/update-states'; // adjust path as needed


interface MatchedLender {
  lender: Lender;
  matchScore: number;
  matchBreakdown: {
    loanType: boolean;
    loanAmount: boolean;
    propertyType: boolean;
    propertySubCategory: boolean;
    state: boolean;
    ficoScore: boolean;
  };
}

@Component({
  selector: 'app-loan-matches',
  templateUrl: './loan-matches.component.html',
  styleUrls: ['./loan-matches.component.css'],
  standalone: true,
  imports: [CommonModule], // ✅ Add this line
})
export class LoanMatchesComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private loanService = inject(LoanService);
  private lenderService = inject(LenderService);
  private stateMigration = inject(StateMigrationService);

  matchedLoan = signal<Loan | null>(null);
  matchedLenders = signal<MatchedLender[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    const loanId = this.route.snapshot.paramMap.get('loanId');
    if (!loanId) {
      this.error.set('Loan ID not found in URL.');
      this.loading.set(false);
      return;
    }

    this.loanService.getLoanById(loanId).subscribe({
      next: (loanData) => {
        if (!loanData) {
          this.error.set('Loan not found.');
          this.loading.set(false);
          return;
        }

        this.matchedLoan.set(loanData);
        this.loadLendersAndMatch(loanData);
      },
      error: () => {
        this.error.set('Error loading loan.');
        this.loading.set(false);
      },
    });
  }

  async runMigration() {
    await this.stateMigration.updateLenderFootprints();
  }

  private loadLendersAndMatch(loan: Loan): void {
    this.lenderService.getAllLenders().subscribe({
      next: (lenders) => {
        const matches: MatchedLender[] = lenders.map((lender) => {
          const productInfo = lender.productInfo || {};
          const footprintInfo = lender.footprintInfo || {};

          const loanAmountMatch =
            !!loan.loanAmount &&
            !!productInfo.minLoanAmount &&
            !!productInfo.maxLoanAmount &&
            Number(loan.loanAmount) >= Number(productInfo.minLoanAmount) &&
            Number(loan.loanAmount) <= Number(productInfo.maxLoanAmount);

          // ✅ Fixed: Use lendingFootprint array instead of states object
          const stateMatch = footprintInfo.lendingFootprint?.some(
            state => state.toLowerCase() === loan.state?.toLowerCase()
          ) || false;

          const breakdown = {
            loanType: productInfo.loanTypes?.includes(loan.loanType?.toLowerCase()) || false,
            loanAmount: loanAmountMatch,
            propertyType: productInfo.propertyCategories?.includes(loan.propertyTypeCategory) || false,
            propertySubCategory: productInfo.subcategorySelections?.includes(`${loan.propertyTypeCategory}:${loan.propertySubCategory}`) || false,
            state: stateMatch,
            ficoScore: Number(loan.sponsorFico) >= Number(productInfo.ficoScore || 0),
          };

          const matchedCount = Object.values(breakdown).filter(Boolean).length;
          const matchScore = (matchedCount / Object.keys(breakdown).length) * 100;

          return { lender, matchScore, matchBreakdown: breakdown };
        });

        this.matchedLenders.set(matches);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error loading lenders.');
        this.loading.set(false);
      },
    });
  }
}