// admin-dashboard.component.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminStateService } from '../../../services/admin-state.service';
import { AdminApiService } from '../../../services/admin-api.service';
import { PromotionService } from '../../../services/promotion.service';
import { AdminOverview } from '../../../services/admin-api.service';



@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css'],
})
export class AdminDashboardComponent implements OnInit {
  // Services
  private readonly router = inject(Router);
  private readonly adminState = inject(AdminStateService);
  private readonly adminApi = inject(AdminApiService);
  private promotionService = inject(PromotionService);


  // UI-only gate text (this is just for the UI, real validation happens server-side)
  private readonly adminCode = 'gk#1uykG&R%pH*2L10UW1';

  // Auth state - using signals from AdminStateService
  adminAuthenticated = this.adminState.isAuthenticated;
  enteredCode = '';
  codeError = signal(false);

  // +++ INSERT
  overview: AdminOverview | null = null;
  overviewLoading = false;
  overviewError = '';

  promoList: any[] = [];
  promoLoading = false;
  promoError = '';


  // Stats - using computed values from AdminStateService
  totalOriginators = this.adminState.totalOriginators;
  totalLenders = this.adminState.totalLenders;
  totalLoans = this.adminState.totalLoans;
  activePromotions = this.adminState.activePromotions;
  loading = this.adminState.isLoading;


  showCode = false;
  toggleShowCode(): void {
    this.showCode = !this.showCode;
  }

  ngOnInit(): void {
    this.checkAuthentication();
  }

  /** Check authentication status on component load */
  private async checkAuthentication(): Promise<void> {
    const isAuth = await this.adminState.checkAuthStatus();
    if (isAuth) this.refreshAdminDashboard();
  }

  /** Submit admin code for verification */
  async verifyAdminCode(): Promise<void> {
    if (!this.enteredCode) {
      this.codeError.set(true);
      return;
    }

    this.codeError.set(false);
    const result = await this.adminState.login(this.enteredCode);

    if (result?.success) {
      this.enteredCode = '';
      this.refreshAdminDashboard();  // load data after successful auth
    } else {
      this.codeError.set(true);
    }
  }

  /** Convenience refresher used by both paths */
  refreshAdminDashboard(): void {
    this.loadOverview();
    this.loadPromotions();
  }

  /** Unchanged helpers */
  loadOverview(): void {
    this.overviewLoading = true;
    this.overviewError = '';
    this.adminApi.getOverview()
      .then(res => { this.overview = res; })
      .catch(err => { this.overviewError = err?.message || 'Failed to load overview'; })
      .finally(() => { this.overviewLoading = false; });
  }

  loadPromotions(): void {
    this.promoLoading = true;
    this.promoError = '';
    this.promotionService.getAllPromotionCodes()
      .subscribe({
        next: (res) => { this.promoList = res?.codes || []; },
        error: (err) => { this.promoError = err?.message || 'Failed to load promotions'; },
        complete: () => { this.promoLoading = false; }
      });
  }


  // Navigation methods
  navigateToOriginators(): void {
    this.router.navigate(['/admin/users']);
  }

  navigateToLenders(): void {
    this.router.navigate(['/admin/lenders']);
  }

  navigateToLoans(): void {
    this.router.navigate(['/admin/loans']);
  }

  navigateToBilling(): void {
    this.router.navigate(['/admin/billing']);
  }

  navigateToPayments(): void {
    this.router.navigate(['/admin/payments']);
  }

  /**
   * Exit admin mode and logout
   */
  async exitAdminMode(): Promise<void> {
    await this.adminState.logout();
    this.enteredCode = '';
    this.router.navigate(['/dashboard']);
  }

  // Quick action methods
  createNewPromotion(): void {
    this.router.navigate(['/admin/billing'], {
      queryParams: { action: 'create' }
    });
  }

  viewRecentPayments(): void {
    this.router.navigate(['/admin/payments'], {
      queryParams: { filter: 'recent' }
    });
  }

  downloadUserReport(): void {
    this.router.navigate(['/admin/users'], {
      queryParams: { action: 'export' }
    });
  }

  /**
   * Refresh dashboard data
   */
  async refreshData(): Promise<void> {
    await this.adminState.refresh();
  }
}