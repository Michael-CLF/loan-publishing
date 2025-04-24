import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LenderService, Lender } from '../../services/lender.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-lender-details',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './lender-details.component.html',
  styleUrl: './lender-details.component.css',
})
export class LenderDetailsComponent implements OnInit, OnDestroy {
  lender: Lender | null = null;
  loading = true;
  error = false;
  isFavorited: boolean = false; // Initialize isFavorited

  private destroy$ = new Subject<void>();
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private lenderService = inject(LenderService);

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.loadLenderDetails(id);
        this.checkFavoriteStatus(id); // Call checkFavoriteStatus here
      } else {
        this.error = true;
        this.loading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadLenderDetails(id: string): void {
    this.loading = true;

    this.lenderService
      .getLender(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.lender = data;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading lender details:', err);
          this.error = true;
          this.loading = false;
        },
      });
  }

  checkFavoriteStatus(lenderId: string): void {
    const favoriteStatus = localStorage.getItem(`lender-${lenderId}-favorite`);
    this.isFavorited = favoriteStatus === 'true'; // Set the favorite status based on localStorage
  }

  toggleFavorite(): void {
    if (!this.lender?.id) {
      console.warn('Lender ID is not available.');
      return;
    }

    this.isFavorited = !this.isFavorited;

    // Persist the favorite status in localStorage
    localStorage.setItem(
      `lender-${this.lender.id}-favorite`,
      String(this.isFavorited)
    );
  }

  // Helper methods to safely access nested properties
  getContactName(): string {
    const firstName = this.lender?.contactInfo?.firstName || '';
    const lastName = this.lender?.contactInfo?.lastName || '';
    return `${firstName} ${lastName}`.trim() || 'Not specified';
  }

  getCompanyName(): string {
    return this.lender?.contactInfo?.company || 'Not specified';
  }

  getEmail(): string {
    return this.lender?.contactInfo?.contactEmail || 'Not specified';
  }

  getPhone(): string {
    return this.lender?.contactInfo?.contactPhone || 'Not specified';
  }

  getLocation(): string {
    const city = this.lender?.contactInfo?.city || '';
    const state = this.lender?.contactInfo?.state || '';
    return city && state ? `${city}, ${state}` : 'Not specified';
  }

  getLenderTypes(): string {
    if (
      !this.lender?.productInfo?.lenderTypes ||
      this.lender.productInfo.lenderTypes.length === 0
    ) {
      return 'None specified';
    }

    return this.lender.productInfo.lenderTypes
      .map((type) => this.getLenderTypeName(type))
      .join(', ');
  }

  getPropertyCategories(): string {
    if (
      !this.lender?.productInfo?.propertyCategories ||
      this.lender.productInfo.propertyCategories.length === 0
    ) {
      return 'None specified';
    }

    return this.lender.productInfo.propertyCategories.join(', ');
  }

  getPropertyTypes(): string {
    if (
      !this.lender?.productInfo?.propertyTypes ||
      this.lender.productInfo.propertyTypes.length === 0
    ) {
      return 'None specified';
    }

    return this.lender.productInfo.propertyTypes.join(', ');
  }

  getLendingStates(): string {
    if (
      !this.lender?.footprintInfo?.lendingFootprint ||
      this.lender.footprintInfo.lendingFootprint.length === 0
    ) {
      return 'None specified';
    }

    return this.lender.footprintInfo.lendingFootprint.join(', ');
  }

  getLoanRange(): string {
    if (!this.lender?.productInfo) {
      return 'Not specified';
    }

    // More robust number conversion with fallback values
    let min = 0;
    let max = 0;

    try {
      const minValue = this.lender.productInfo.minLoanAmount;
      const maxValue = this.lender.productInfo.maxLoanAmount;

      // Log the raw values for debugging
      console.log('Raw minLoanAmount:', minValue, 'type:', typeof minValue);
      console.log('Raw maxLoanAmount:', maxValue, 'type:', typeof maxValue);

      if (minValue !== undefined && minValue !== null) {
        if (typeof minValue === 'number') {
          min = minValue;
        } else if (typeof minValue === 'string') {
          // Use a safe string replacement
          const cleanMin = String(minValue).replace(/[^0-9.]/g, '');
          min = parseFloat(cleanMin) || 0;
        } else {
          // For any other type
          min = Number(minValue) || 0;
        }
      }

      if (maxValue !== undefined && maxValue !== null) {
        if (typeof maxValue === 'number') {
          max = maxValue;
        } else if (typeof maxValue === 'string') {
          // Use a safe string replacement
          const cleanMax = String(maxValue).replace(/[^0-9.]/g, '');
          max = parseFloat(cleanMax) || 0;
        } else {
          // For any other type
          max = Number(maxValue) || 0;
        }
      }

      // Check if values are valid numbers
      if (isNaN(min)) min = 0;
      if (isNaN(max)) max = 0;

      // Log the processed values
      console.log('Processed min:', min);
      console.log('Processed max:', max);
    } catch (error) {
      console.error('Error processing loan amounts:', error);
    }

    return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
  }

  // Helper method for displaying lender types
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

  goBack(): void {
    this.router.navigate(['/lender-list']);
  }
}
