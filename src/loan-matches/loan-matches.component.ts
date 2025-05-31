// loan-matches.component.ts - Complete standalone component with weighted matching

import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { LoanService } from '../services/loan.service';
import { LenderService, Lender } from '../services/lender.service';
import { Loan } from '../models/loan-model.model';
import { StateMigrationService } from '../services/update-states';

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
  imports: [CommonModule],
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
        console.log(`\n🏁 Starting matching process for ${lenders.length} total lenders`);
        
        // Filter out lenders that fail hard elimination criteria
        const viableLenders = lenders.filter(lender => 
          this.passesHardElimination(loan, lender)
        );

        console.log(`\n📊 SUMMARY: ${viableLenders.length} out of ${lenders.length} lenders passed hard elimination`);
        
        if (viableLenders.length === 0) {
          console.log(`⚠️ WARNING: No lenders passed hard elimination! Check your criteria.`);
        }

        // Calculate weighted scores only for viable lenders
        const matches: MatchedLender[] = viableLenders.map((lender) => {
          const breakdown = this.calculateMatchBreakdown(loan, lender);
          const matchScore = this.calculateWeightedScore(breakdown);
          
          const lenderName = `${lender.contactInfo?.firstName || ''} ${lender.contactInfo?.lastName || ''}`.trim();
          console.log(`📈 ${lenderName} scored: ${matchScore}%`, breakdown);

          return { lender, matchScore, matchBreakdown: breakdown };
        });

        // Sort by match score (highest first)
        matches.sort((a, b) => b.matchScore - a.matchScore);

        this.matchedLenders.set(matches);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error loading lenders.');
        this.loading.set(false);
      },
    });
  }

  /**
   * Hard elimination criteria - if any of these fail, lender is completely filtered out
   */
  private passesHardElimination(loan: Loan, lender: Lender): boolean {
    const productInfo = lender.productInfo || {};
    const lenderName = `${lender.contactInfo?.firstName || ''} ${lender.contactInfo?.lastName || ''}`.trim() || 'Unknown Lender';
    
    console.log(`\n🔍 Checking lender: ${lenderName}`);
    console.log('📋 Loan Details:', {
      propertyType: loan.propertyTypeCategory,
      loanAmount: loan.loanAmount,
      sponsorFico: loan.sponsorFico,
      loanType: loan.loanType
    });
    console.log('🏦 Lender ProductInfo:', productInfo);

    // 1. FICO Score Hard Elimination
    const ficoRequired = Number(productInfo.ficoScore || 0);
    const borrowerFico = Number(loan.sponsorFico || 0);
    console.log(`📊 FICO Check: Borrower ${borrowerFico} vs Required ${ficoRequired}`);
    
    if (borrowerFico < ficoRequired) {
      console.log(`❌ FICO ELIMINATION: ${borrowerFico} < ${ficoRequired}`);
      return false;
    }
    console.log(`✅ FICO PASS`);

    // 2. Loan Amount Hard Elimination  
    const loanAmount = Number(loan.loanAmount?.toString().replace(/[,$]/g, '') || 0);
    const minLoan = Number(productInfo.minLoanAmount || 0);
    const maxLoan = Number(productInfo.maxLoanAmount || 0);
    console.log(`💰 Loan Amount Check: ${loanAmount} must be between ${minLoan} and ${maxLoan}`);
    
    if (loanAmount === 0) {
      console.log(`❌ LOAN AMOUNT ELIMINATION: Invalid loan amount (${loan.loanAmount})`);
      return false;
    }
    
    if (loanAmount < minLoan || loanAmount > maxLoan) {
      console.log(`❌ LOAN AMOUNT ELIMINATION: ${loanAmount} not in range [${minLoan}, ${maxLoan}]`);
      return false;
    }
    console.log(`✅ LOAN AMOUNT PASS`);

    // 3. Property Type Hard Elimination (case-insensitive)
    const lenderPropertyTypes = productInfo.propertyCategories || [];
    const loanPropertyType = loan.propertyTypeCategory?.toLowerCase();
    console.log(`🏠 Property Type Check: "${loanPropertyType}" must be in [${lenderPropertyTypes.map(t => `"${t}"`).join(', ')}]`);
    
    const hasPropertyMatch = lenderPropertyTypes.some(
      (type: string) => type.toLowerCase() === loanPropertyType
    );
    
    if (!hasPropertyMatch) {
      console.log(`❌ PROPERTY TYPE ELIMINATION: "${loanPropertyType}" not found in lender types`);
      return false;
    }
    console.log(`✅ PROPERTY TYPE PASS`);

    // 4. LTV Hard Elimination (when you add this field)
    // Uncomment when LTV is added to your loan model
    /*
    const borrowerLTV = Number(loan.ltv || 0);
    const maxLTV = Number(productInfo.maxLTV || 0);
    console.log(`📈 LTV Check: ${borrowerLTV}% vs Max ${maxLTV}%`);
    if (borrowerLTV > maxLTV) {
      console.log(`❌ LTV ELIMINATION: ${borrowerLTV}% > ${maxLTV}%`);
      return false;
    }
    console.log(`✅ LTV PASS`);
    */

    console.log(`🎉 ${lenderName} PASSED ALL HARD ELIMINATIONS!`);
    return true; // Passed all hard eliminations
  }

  /**
   * Calculate match breakdown for remaining criteria (non-elimination factors)
   */
  private calculateMatchBreakdown(loan: Loan, lender: Lender) {
    const productInfo = lender.productInfo || {};
    const footprintInfo = lender.footprintInfo || {};
    const lenderName = `${lender.contactInfo?.firstName || ''} ${lender.contactInfo?.lastName || ''}`.trim();

    console.log(`\n🔍 Calculating breakdown for ${lenderName}`);

    // State matching - handle undefined arrays safely
    console.log(`🗺️ State Check: Loan state "${loan.state}" vs Lender footprint:`, footprintInfo.lendingFootprint || 'undefined');
    const stateMatch = (footprintInfo.lendingFootprint || []).some(
      (state: string) => state.toLowerCase() === loan.state?.toLowerCase()
    );
    console.log(`🗺️ State match result: ${stateMatch}`);

    // Loan type matching - handle undefined arrays safely
    console.log(`📋 Loan Type Check: Loan type "${loan.loanType}" vs Lender types:`, productInfo.loanTypes || 'undefined');
    const loanTypeMatch = (productInfo.loanTypes || []).some(
      (type: string) => type.toLowerCase() === loan.loanType?.toLowerCase()
    );
    console.log(`📋 Loan type match result: ${loanTypeMatch}`);

    // Subcategory matching - handle undefined arrays safely and check variations
    const expectedSubcategory = `${loan.propertyTypeCategory}:${loan.propertySubCategory}`;
    const expectedSubcategoryAlt = `${loan.propertyTypeCategory?.toLowerCase()}:${loan.propertySubCategory?.toLowerCase()}`;
    console.log(`🏢 Subcategory Check: Looking for "${expectedSubcategory}" or "${expectedSubcategoryAlt}" in:`, productInfo.subcategorySelections || 'undefined');
    
    const subcategoryMatch = (productInfo.subcategorySelections || []).some(subcat => 
      subcat === expectedSubcategory || 
      subcat === expectedSubcategoryAlt ||
      subcat.toLowerCase() === expectedSubcategory.toLowerCase()
    );
    console.log(`🏢 Subcategory match result: ${subcategoryMatch}`);

    const breakdown = {
      // Hard elimination criteria (always true for lenders that make it here)
      loanType: loanTypeMatch,        // Now weighted, not elimination
      loanAmount: true,               // Already passed hard elimination
      propertyType: true,             // Already passed hard elimination  
      ficoScore: true,                // Already passed hard elimination
      
      // Scoring criteria
      state: stateMatch,
      propertySubCategory: subcategoryMatch,
    };

    console.log(`📊 Final breakdown for ${lenderName}:`, breakdown);
    return breakdown;
  }

  /**
   * Calculate weighted score using the tiered approach
   */
  private calculateWeightedScore(breakdown: any): number {
    // Define weights for ALL criteria that matter
    const weights = {
      // Hard elimination criteria that passed get base points
      loanAmount: 20,               // Loan amount within range
      propertyType: 25,             // Property type match
      ficoScore: 15,                // FICO above minimum
      
      // Preference/optimization criteria
      state: 20,                    // Geographic preference
      loanType: 15,                 // Loan type preference  
      propertySubCategory: 5,       // Subcategory specialization
    };

    let weightedScore = 0;

    console.log('🔢 Scoring breakdown:', breakdown);
    console.log('⚖️ Weights:', weights);

    // Calculate weighted score for ALL criteria
    if (breakdown.loanAmount) {
      weightedScore += weights.loanAmount;
      console.log(`✅ +${weights.loanAmount}% for loan amount match`);
    }
    if (breakdown.propertyType) {
      weightedScore += weights.propertyType;
      console.log(`✅ +${weights.propertyType}% for property type match`);
    }
    if (breakdown.ficoScore) {
      weightedScore += weights.ficoScore;
      console.log(`✅ +${weights.ficoScore}% for FICO match`);
    }
    if (breakdown.state) {
      weightedScore += weights.state;
      console.log(`✅ +${weights.state}% for state match`);
    } else {
      console.log(`❌ 0% for state match (no match)`);
    }
    if (breakdown.loanType) {
      weightedScore += weights.loanType;
      console.log(`✅ +${weights.loanType}% for loan type match`);
    } else {
      console.log(`❌ 0% for loan type match (no match)`);
    }
    if (breakdown.propertySubCategory) {
      weightedScore += weights.propertySubCategory;
      console.log(`✅ +${weights.propertySubCategory}% for subcategory match`);
    } else {
      console.log(`❌ 0% for subcategory match (no match)`);
    }

    console.log(`🎯 Final weighted score: ${weightedScore}%`);
    return weightedScore;
  }
}