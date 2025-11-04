// admin-dashboard.component.ts (NEW COMPLETE FILE)
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminStateService } from '../../../services/admin-state.service';
import { AdminApiService } from '../../../services/admin-api.service';
import { PromotionService } from '../../../services/promotion.service';
import { AdminOverview } from '../../../services/admin-api.service';
import { FormsModule } from '@angular/forms';

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

  // --- Login State ---
  loading = signal(false); 
  errorMessage = signal<string | null>(null);
  // Auth state - using signals from AdminStateService
  adminAuthenticated = this.adminState.isAuthenticated;
  
  // --- Dashboard Data State ---
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
  // 🗑️ REMOVED: loading = this.adminState.isLoading;

  // 🗑️ REMOVED: showCode, toggleShowCode()

  constructor() {}

  ngOnInit(): void {
    this.checkAuthentication();
  }

  /** Check authentication status on component load */
  private async checkAuthentication(): Promise<void> {
    const isAuth = await this.adminState.checkAuthStatus();
    if (isAuth) this.refreshAdminDashboard();
  } 
  async verifyAdminCode(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);

    try {
        // Call the service method, which handles the Google pop-up
        const loginResult = await this.adminApi.login(); // No arguments needed for Google Sign-in

        if (loginResult.ok || loginResult.success) { 
            // 1. Refresh global state
            await this.adminState.refresh();
            
            // 2. Navigate away from the login form to the dashboard
            this.router.navigate(['/admin/dashboard']); 
            
            // 3. Load initial data
            this.refreshAdminDashboard();
        } else {
            // Failed login (pop-up closed or missing admin claim)
            this.errorMessage.set(loginResult.error || loginResult.message || 'Login failed. Check your credentials and admin status.');
        }
    } catch (error: any) {
        console.error('Login error:', error);
        this.errorMessage.set(error.message || 'An unexpected network error occurred during login.');
    } finally {
        this.loading.set(false);
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
    // 🗑️ REMOVED: this.enteredCode = '';
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