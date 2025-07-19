import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { LoanService } from '../services/loan.service';
import { LenderService, Lender } from '../services/lender.service';
import { Loan, LoanUtils, PropertySubcategoryValue } from '../models/loan-model.model';
import { StateMigrationService } from '../services/update-states';
import { getPropertySubcategoryName } from '../shared/constants/property-mappings';
import { Router } from '@angular/router';

interface MatchedLender {
  lender: Lender;
  matchScore: number;
  matchBreakdown: {
    loanType: boolean;
    loanAmount: boolean;
    propertyType: boolean;
    propertySubCategory: boolean;
    hasRelatedSubcategory: boolean;
    state: boolean;
    ficoScore: boolean;
  };
}

@Component({
  selector: 'app-loan-matches',
  templateUrl: './loan-matches.component.html',
  styleUrls: ['./loan-matches.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class LoanMatchesComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private loanService = inject(LoanService);
  private lenderService = inject(LenderService);
  private stateMigration = inject(StateMigrationService);
  private router = inject(Router);
  

  // Existing signals
  matchedLoan = signal<Loan | null>(null);
  matchedLenders = signal<MatchedLender[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  // New signal for tracking expanded lender details
  expandedLenders = signal<Set<string>>(new Set());

  ngOnInit(): void {
    const loanId = this.route.snapshot.paramMap.get('loanId');
    if (!loanId) {
      this.error.set('Loan ID not found in URL.');
      this.loading.set(false);
      return;
    }

    this.loanService.getLoanById(loanId).subscribe({
      next: (loanData: Loan | null) => {
        if (!loanData) {
          this.error.set('Loan not found.');
          this.loading.set(false);
          return;
        }

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

viewLenderDetails(lenderId: string): void {
  this.router.navigate(['/lender-details', lenderId]);
}
  /**
   * Check if a lender's details are currently expanded
   */
  isLenderExpanded(lenderId: string): boolean {
    return this.expandedLenders().has(lenderId);
  }

  /**
   * Format currency values for display
   */
  formatCurrency(value: string | number | undefined): string {
    if (!value) return 'Not specified';
    
    const numValue = typeof value === 'string' ? 
      parseFloat(value.toString().replace(/[^0-9.]/g, '')) : 
      value;
    
    if (isNaN(numValue) || numValue === 0) return 'Not specified';
    
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(numValue);
  }

  // Existing formatting methods
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
      next: (lenders: Lender[]) => {
        console.log(`\n🏁 Starting matching process for ${lenders.length} total lenders`);
        
        const viableLenders = lenders.filter(lender => 
          this.passesHardElimination(loan, lender)
        );

        console.log(`\n📊 SUMMARY: ${viableLenders.length} out of ${lenders.length} lenders passed hard elimination`);
        
        if (viableLenders.length === 0) {
          console.log(`⚠️ WARNING: No lenders passed hard elimination! Check your criteria.`);
        }

        const matches: MatchedLender[] = viableLenders.map((lender) => {
          const breakdown = this.calculateMatchBreakdown(loan, lender);
          const matchScore = this.calculateWeightedScore(breakdown);
          
          const lenderName = `${lender.contactInfo?.firstName || ''} ${lender.contactInfo?.lastName || ''}`.trim();
          console.log(`📈 ${lenderName} scored: ${matchScore}%`, breakdown);

          return { lender, matchScore, matchBreakdown: breakdown };
        });

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
    return true;
  }

  private calculateWeightedScore(breakdown: any): number {
    const weights = {
      loanAmount: 18,
      propertyType: 20,
      ficoScore: 17,
      state: 15,
      loanType: 10,
      propertySubCategory: 20,
    };

    let weightedScore = 0;

    console.log('🔢 Scoring breakdown:', breakdown);
    console.log('⚖️ Updated weights:', weights);

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
      console.log(`✅ +${weights.propertySubCategory}% for exact subcategory match`);
    } else if (breakdown.hasRelatedSubcategory) {
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

  // Property type matching
  const lenderPropertyTypes = productInfo.propertyCategories || [];
  const loanPropertyType = loan.propertyTypeCategory?.toLowerCase();
  console.log(`🏠 Property Type Check: "${loanPropertyType}" must be in [${lenderPropertyTypes.map(t => `"${t}"`).join(', ')}]`);
  
  const propertyTypeMatch = lenderPropertyTypes.some(
    (type: string) => type.toLowerCase() === loanPropertyType
  );
  console.log(`🏠 Property type match result: ${propertyTypeMatch}`);

  // Subcategory matching
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
    // Hard elimination criteria (now showing actual match results)
    loanType: loanTypeMatch,        
    loanAmount: true,               // Already passed hard elimination
    propertyType: propertyTypeMatch, // Now shows actual property type match
    ficoScore: true,                // Already passed hard elimination
    
    // Scoring criteria
    state: stateMatch,
    propertySubCategory: exactSubcategoryMatch,
    hasRelatedSubcategory: hasRelatedSubcategory,  // NEW: For partial credit
  };

  console.log(`📊 Final breakdown for ${lenderName}:`, breakdown);
  return breakdown;
}


  getSubcategoryDisplay(): string {
    const loan = this.matchedLoan();
    if (!loan?.propertySubCategory) return 'None';
    
    console.log('DEBUG - getSubcategoryDisplay:', {
      type: typeof loan.propertySubCategory,
      value: loan.propertySubCategory
    });
    
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