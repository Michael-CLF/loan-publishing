// admin-state.service.ts
import { Injectable, signal, computed, inject } from '@angular/core';
import { AdminApiService } from './admin-api.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminAuthService } from './admin-auth.service';
import { firstValueFrom } from 'rxjs';



export interface DashboardStats {
  originators: number;
  lenders: number;
  loans: number;
  activePromotions: number;
  recentActivity?: any[];
}

export interface AdminState {
  isAuthenticated: boolean;
  isLoading: boolean;
  stats: DashboardStats | null;
  error: string | null;
  lastRefreshed: Date | null;
}

@Injectable({ providedIn: 'root' })
export class AdminStateService {

  private readonly adminApi = inject(AdminApiService);
  
  // State signals
  private readonly _isAuthenticated = signal(false);
  private readonly _isLoading = signal(false);
  private readonly _stats = signal<DashboardStats | null>(null);
  private readonly _error = signal<string | null>(null);
  private readonly _lastRefreshed = signal<Date | null>(null);
   private readonly adminAuth = inject(AdminAuthService);
  
  // Public computed signals
  readonly isAuthenticated = this._isAuthenticated.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly stats = this._stats.asReadonly();
  readonly error = this._error.asReadonly();
  readonly lastRefreshed = this._lastRefreshed.asReadonly();
  
  // Computed values for individual stats
  readonly totalOriginators = computed(() => this._stats()?.originators ?? 0);
  readonly totalLenders = computed(() => this._stats()?.lenders ?? 0);
  readonly totalLoans = computed(() => this._stats()?.loans ?? 0);
  readonly activePromotions = computed(() => this._stats()?.activePromotions ?? 0);
  readonly recentActivity = computed(() => this._stats()?.recentActivity ?? []);
  
  // Combined state for convenience
  readonly state = computed<AdminState>(() => ({
    isAuthenticated: this._isAuthenticated(),
    isLoading: this._isLoading(),
    stats: this._stats(),
    error: this._error(),
    lastRefreshed: this._lastRefreshed()
  }));

  constructor() {
    // Initialize by checking authentication status
    this.checkAuthStatus();
  }

  /**
   * Set authentication status
   */
  setAuthenticated(value: boolean): void {
    this._isAuthenticated.set(value);
    if (!value) {
      // Clear stats when logged out
      this._stats.set(null);
      this._lastRefreshed.set(null);
    }
  }

  /**
   * Load dashboard statistics
   */
  async loadDashboardStats(): Promise<void> {
    if (!this._isAuthenticated()) {
      this._error.set('Not authenticated');
      return;
    }

    this._isLoading.set(true);
    this._error.set(null);
    
    try {
      const data = await this.adminApi.getOverview();
      
      this._stats.set({
        originators: data.originators,
        lenders: data.lenders,
        loans: data.loans,
        activePromotions: data.activePromotions,
        recentActivity: data.recentActivity || []
      });
      
      this._lastRefreshed.set(new Date());
      this._error.set(null);
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
      this._error.set('Failed to load dashboard data. Please try again.');
      this._stats.set(null);
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Refresh dashboard data
   */
  async refresh(): Promise<void> {
    await this.loadDashboardStats();
  }

async checkAuthStatus(): Promise<boolean> {
  try {
    const response = await this.adminApi.checkAuth();
    const isAuth = (response as any)?.authenticated === true;
    this.setAuthenticated(isAuth);
    return isAuth;
  } catch {
    this.setAuthenticated(false);
    return false;
  }
}


  async login(code: string): Promise<{ success: boolean; error?: string }> {
  this._isLoading.set(true);
  this._error.set(null);

  try {
    // 1) exchange code -> sets cookie
    const result = await firstValueFrom(this.adminAuth.exchangeCodeForToken(code));
    if (!result?.ok) {
      const msg = 'Invalid admin code';
      this._error.set(msg);
      return { success: false, error: msg };
    }

    // 2) confirm cookie-auth with backend
    const status = await this.adminApi.checkAuth();
    const authenticated = !!status?.authenticated;

    this.setAuthenticated(authenticated);
    if (authenticated) {
      await this.loadDashboardStats();
      return { success: true };
    } else {
      const msg = 'Authentication failed';
      this._error.set(msg);
      return { success: false, error: msg };
    }
  } catch (error: any) {
    const msg = error?.message || 'Login failed. Please try again.';
    this._error.set(msg);
    return { success: false, error: msg };
  } finally {
    this._isLoading.set(false);
  }
}



  /**
   * Admin logout
   */
  async logout(): Promise<void> {
    try {
      await this.adminApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.setAuthenticated(false);
    }
  }

  /**
   * Clear error message
   */
  clearError(): void {
    this._error.set(null);
  }

  /**
   * Set loading state
   */
  setLoading(value: boolean): void {
    this._isLoading.set(value);
  }
}