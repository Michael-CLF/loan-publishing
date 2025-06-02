// loan-matches.component.ts - Complete standalone component with weighted matching

import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { LoanService } from '../services/loan.service';
import { LenderService, Lender } from '../services/lender.service';
import { Loan, LoanUtils, PropertySubcategoryValue } from '../models/loan-model.model'; // ADDED: Import LoanUtils
import { StateMigrationService } from '../services/update-states';
import { getPropertySubcategoryName } from '../shared/constants/property-mappings';

interface MatchedLender {
  lender: Lender;
  matchScore: number;
  matchBreakdown: {
    loanType: boolean;
    loanAmount: boolean;
    propertyType: boolean;
    propertySubCategory: boolean;
    hasRelatedSubcategory: boolean;  // ADD THIS LINE
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

      // ADD THESE DEBUG LOGS
      console.log('Raw loan data:', loanData);
      console.log('propertySubCategory type:', typeof loanData.propertySubCategory);
      console.log('propertySubCategory value:', loanData.propertySubCategory);
      
      this.matchedLoan.set(loanData);
      this.loadLendersAndMatch(loanData);
    },
    error: () => {
      this.error.set('Error loading loan.');
      this.loading.set(false);
    },
  });
}

// Add these formatting methods to your component class:

formatPropertyCategory(category: string | undefined): string {
  if (!category) return '';
  
  const categoryMap: Record<string, string> = {
    commercial: 'Commercial',
    healthcare: 'Healthcare',
    hospitality: 'Hospitality',
    industrial: 'Industrial',
    land: 'Land',
    mixed_use: 'Mixed Use',
    multifamily: 'Multifamily',
    office: 'Office',
    residential: 'Residential',
    retail: 'Retail',
    special_purpose: 'Special Purpose'
  };
  
  return categoryMap[category.toLowerCase()] || category;
}

 formatPropertySubcategory(subcategory: PropertySubcategoryValue): string {
    // Use the LoanUtils to safely extract the value
    return getPropertySubcategoryName(LoanUtils.getSubcategoryValue(subcategory));
  }

getLoanTypeName(loanType: string | undefined): string {
  if (!loanType) return '';
  
  const loanTypeMap: Record<string, string> = {
    agency: 'Agency Loans',
    bridge: 'Bridge Loans',
    cmbs: 'CMBS Loans',
    commercial: 'Commercial Loans',
    construction: 'Construction Loans',
    hard_money: 'Hard Money Loans',
    mezzanine: 'Mezzanine Loan',
    rehab: 'Rehab Loans',
    non_qm: 'Non-QM Loans',
    sba: 'SBA Loans',
    usda: 'USDA Loans',
    acquisition: 'Acquisition Loan',
    balance_sheet: 'Balance Sheet',
    bridge_perm: 'Bridge to Permanent',
    dscr: 'DSCR',
    fix_flip: 'Fix & Flip',
    purchase_money: 'Purchase Money Loan',
    portfolio: 'Portfolio Loan',
    sba_express: 'SBA Express',
    sba_7a: 'SBA 7(a)',
    sba_504: 'SBA 504'
  };
  
  return loanTypeMap[loanType.toLowerCase()] || loanType;
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


    console.log(`🎉 ${lenderName} PASSED ALL HARD ELIMINATIONS!`);
    return true; // Passed all hard eliminations
  }

  /**
   * Calculate weighted score using improved business logic
   */
  private calculateWeightedScore(breakdown: any): number {
    // Updated weights with better business logic
    const weights = {
      // Hard elimination criteria (base score - 65%)
      loanAmount: 18,               // Can they fund it?
      propertyType: 20,             // Do they do this property type?
      ficoScore: 17,                // Meet credit requirements?
      
      // Preference criteria (35%)
      state: 15,                    // Geographic preference  
      loanType: 10,                 // Loan type preference
      propertySubCategory: 20,       // Exact subcategory match (reduced weight)
    };

    let weightedScore = 0;

    console.log('🔢 Scoring breakdown:', breakdown);
    console.log('⚖️ Updated weights:', weights);

    // Hard elimination base points
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

    // Preference bonuses
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

    // Subcategory matching with partial credit
    if (breakdown.propertySubCategory) {
      weightedScore += weights.propertySubCategory;
      console.log(`✅ +${weights.propertySubCategory}% for exact subcategory match`);
    } else if (breakdown.hasRelatedSubcategory) {
      // NEW: Partial credit for having ANY subcategory in the same property type
      const partialCredit = 1;
      weightedScore += partialCredit;
      console.log(`🔶 +${partialCredit}% for related subcategory match (partial credit)`);
    } else {
      console.log(`❌ 0% for subcategory match (no match)`);
    }

    console.log(`🎯 Final weighted score: ${weightedScore}%`);
    return weightedScore;
  }

  /**
   * Enhanced match breakdown with partial subcategory credit
   */
  private calculateMatchBreakdown(loan: Loan, lender: Lender) {
    const productInfo = lender.productInfo || {};
    const footprintInfo = lender.footprintInfo || {};
    const lenderName = `${lender.contactInfo?.firstName || ''} ${lender.contactInfo?.lastName || ''}`.trim();

    console.log(`\n🔍 Calculating breakdown for ${lenderName}`);

    // State matching
    console.log(`🗺️ State Check: Loan state "${loan.state}" vs Lender footprint:`, footprintInfo.lendingFootprint || 'undefined');
    const stateMatch = (footprintInfo.lendingFootprint || []).some(
      (state: string) => state.toLowerCase() === loan.state?.toLowerCase()
    );
    console.log(`🗺️ State match result: ${stateMatch}`);

    // Loan type matching
    console.log(`📋 Loan Type Check: Loan type "${loan.loanType}" vs Lender types:`, productInfo.loanTypes || 'undefined');
    const loanTypeMatch = (productInfo.loanTypes || []).some(
      (type: string) => type.toLowerCase() === loan.loanType?.toLowerCase()
    );
    console.log(`📋 Loan type match result: ${loanTypeMatch}`);

    // FIXED: Use LoanUtils to safely extract subcategory value
    console.log('Debug - propertySubCategory:', {
      type: typeof loan.propertySubCategory,
      value: loan.propertySubCategory,
      stringified: JSON.stringify(loan.propertySubCategory)
    });

    const subcategoryValue = LoanUtils.getSubcategoryValue(loan.propertySubCategory);
    const expectedSubcategory = subcategoryValue.toLowerCase();
    
    console.log(`🏢 Expected subcategory format: "${expectedSubcategory}"`);
    console.log(`🏢 Lender subcategories:`, productInfo.subcategorySelections || 'undefined');
    
    // Exact subcategory match
    const exactSubcategoryMatch = (productInfo.subcategorySelections || []).some(subcat => 
      subcat.toLowerCase() === expectedSubcategory
    );
    
    // NEW: Check for ANY subcategory in the same property category (partial credit)
    const loanPropertyCategory = loan.propertyTypeCategory?.toLowerCase();
    const hasRelatedSubcategory = !exactSubcategoryMatch && (productInfo.subcategorySelections || []).some(subcat => 
      subcat.toLowerCase().startsWith(`${loanPropertyCategory}:`)
    );
    
    console.log(`🏢 Exact subcategory match: ${exactSubcategoryMatch}`);
    console.log(`🏢 Has related subcategory: ${hasRelatedSubcategory}`);

    const breakdown = {
      // Hard elimination criteria (always true for lenders that make it here)
      loanType: loanTypeMatch,        
      loanAmount: true,               // Already passed hard elimination
      propertyType: true,             // Already passed hard elimination  
      ficoScore: true,                // Already passed hard elimination
      
      // Scoring criteria
      state: stateMatch,
      propertySubCategory: exactSubcategoryMatch,
      hasRelatedSubcategory: hasRelatedSubcategory,  // NEW: For partial credit
    };

    console.log(`📊 Final breakdown for ${lenderName}:`, breakdown);
    return breakdown;
  }

  // ADDED: Helper method for template to display subcategory safely
  getSubcategoryDisplay(): string {
    const loan = this.matchedLoan();
    if (!loan?.propertySubCategory) return 'None';
    
    console.log('DEBUG - getSubcategoryDisplay:', {
      type: typeof loan.propertySubCategory,
      value: loan.propertySubCategory
    });
    
    // Handle both string and object formats
    if (typeof loan.propertySubCategory === 'string') {
      return loan.propertySubCategory;
    }
    
    if (typeof loan.propertySubCategory === 'object' && loan.propertySubCategory !== null) {
      const subcatObj = loan.propertySubCategory as any;
      console.log('DEBUG - subcatObj properties:', Object.keys(subcatObj));
      return subcatObj.name || subcatObj.value || JSON.stringify(subcatObj);
    }
    
    return 'None';
  }
}