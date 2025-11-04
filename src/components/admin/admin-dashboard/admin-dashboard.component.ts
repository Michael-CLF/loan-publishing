// admin-dashboard.component.ts (NEW COMPLETE FILE)

import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
// 🔑 NEW: Replace FormsModule with ReactiveFormsModule for proper form handling
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms'; 
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminStateService } from '../../../services/admin-state.service';
import { AdminApiService } from '../../../services/admin-api.service';
import { PromotionService } from '../../../services/promotion.service';
import { AdminOverview } from '../../../services/admin-api.service';
// 🗑️ REMOVED: FormBuilder, FormGroup, Validators import from root
// (They are now imported from @angular/forms above)


@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  // 🔑 NEW: Add ReactiveFormsModule to imports
  imports: [CommonModule, FormsModule, ReactiveFormsModule], 
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css'],
})
export class AdminDashboardComponent implements OnInit {
  // Services
  private readonly router = inject(Router);
  private readonly adminState = inject(AdminStateService);
  private readonly adminApi = inject(AdminApiService);
  private promotionService = inject(PromotionService);
  // 🔑 NEW: Inject FormBuilder at the class level
  private readonly fb = inject(FormBuilder); 

  // --- Login State ---
  
  // 🔑 NEW: Form Group for Email/Password login
  loginForm: FormGroup; 
  loading = signal(false); // Unified loading state
  errorMessage = signal<string | null>(null); // New error message for login

  // 🗑️ REMOVED: enteredCode, codeError

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

  constructor() {
    // 🔑 CONSTRUCTOR LOGIC: Initialize the form with Validators
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.checkAuthentication();
  }

  /** Check authentication status on component load */
  private async checkAuthentication(): Promise<void> {
    const isAuth = await this.adminState.checkAuthStatus();
    if (isAuth) this.refreshAdminDashboard();
  }

  /**
   * 🔑 NEW LOGIN LOGIC: Signs in with Firebase and exchanges token for session cookie.
   * This replaces the old code verification method.
   */
  async verifyAdminCode(): Promise<void> {
    if (this.loginForm.invalid) {
        this.errorMessage.set('Please enter a valid email and password.');
        return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    try {
        const { email, password } = this.loginForm.value;
        
        // Call the refactored service method with email/password
        const loginResult = await this.adminApi.login({ email, password });

        if (loginResult.ok || loginResult.success) { 
            // 1. Refresh global state
            await this.adminState.refresh();
            
            // 2. Navigate away from the login form to the dashboard
            this.router.navigate(['/admin/dashboard']); 
            
            // 3. Load initial data
            this.refreshAdminDashboard();
        } else {
            // Failed login (Firebase Auth or missing admin claim)
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
    // 🔑 NEW: Clear the form on logout
    this.loginForm.reset(); 
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