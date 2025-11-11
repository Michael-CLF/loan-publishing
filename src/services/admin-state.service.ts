// src/services/admin-state.service.ts
import { Injectable, signal, computed, inject } from '@angular/core';
import { AdminApiService } from './admin-api.service';
import { AdminAuthService } from './admin-auth.service';
import { PromotionService } from './promotion.service';
import { Auth } from '@angular/fire/auth';
import {
  Firestore,
  doc,
  getDoc,
  getDocs,
  collection,
  getCountFromServer,
  query,
} from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { firstValueFrom } from 'rxjs';
import { AdminPromotionService } from './admin-promotionService';

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
  // deps
  private readonly adminApi = inject(AdminApiService);
  private readonly adminAuth = inject(AdminAuthService);
  private readonly auth = inject(Auth);
  private readonly db = inject(Firestore);
  private readonly functions = inject(Functions);
  private readonly promotionService = inject(PromotionService);
  private adminPromotionService = inject(AdminPromotionService);

  // base signals
  private readonly _isAuthenticated = signal(false);
  private readonly _isLoading = signal(false);
  private readonly _stats = signal<DashboardStats | null>(null);
  private readonly _error = signal<string | null>(null);
  private readonly _lastRefreshed = signal<Date | null>(null);

  // public read-only signals
  readonly isAuthenticated = this._isAuthenticated.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly stats = this._stats.asReadonly();
  readonly error = this._error.asReadonly();
  readonly lastRefreshed = this._lastRefreshed.asReadonly();

  // convenience computed values for tiles
  readonly totalOriginators = computed(() => this._stats()?.originators ?? 0);
  readonly totalLenders = computed(() => this._stats()?.lenders ?? 0);
  readonly totalLoans = computed(() => this._stats()?.loans ?? 0);
  readonly activePromotions = computed(
    () => this._stats()?.activePromotions ?? 0
  );
  readonly recentActivity = computed(() => this._stats()?.recentActivity ?? []);

  // combined view (useful for debugging)
  readonly state = computed<AdminState>(() => ({
    isAuthenticated: this._isAuthenticated(),
    isLoading: this._isLoading(),
    stats: this._stats(),
    error: this._error(),
    lastRefreshed: this._lastRefreshed(),
  }));

  // ---- auth helpers ----
  setAuthenticated(value: boolean): void {
    this._isAuthenticated.set(value);
    if (!value) {
      this._stats.set(null);
      this._lastRefreshed.set(null);
    }
  }

  async checkAuthStatus(): Promise<boolean> {
    try {
      const user = this.auth.currentUser;
      if (!user) {
        this.setAuthenticated(false);
        return false;
      }
      const snap = await getDoc(doc(this.db, `admins/${user.uid}`));
      const ok = snap.exists();
      this.setAuthenticated(ok);
      return ok;
    } catch {
      this.setAuthenticated(false);
      return false;
    }
  }

  // ---- dashboard data ----
  
  /**
   * Hybrid approach: Use direct Firestore for collections we can read,
   * and services/Cloud Functions for restricted collections
   */
  async loadDashboardStats(): Promise<void> {
    if (!this._isAuthenticated()) {
      this._error.set('Not authenticated');
      return;
    }

    this._isLoading.set(true);
    this._error.set(null);

    try {
      // Parallel fetch: Direct Firestore for readable collections,
      // Service call for promotions (which has restricted read access)
      const [originatorsSnap, lendersSnap, loansSnap, promotionsResponse] = 
        await Promise.all([
          // These work with current security rules
          getDocs(collection(this.db, 'originators')),
          getDocs(collection(this.db, 'lenders')),
          getDocs(collection(this.db, 'loans')),
          
          // Use the service that already works in AdminBillingComponent
          firstValueFrom(this.adminPromotionService.getAllPromotionCodes())
        ]);

      const stats: DashboardStats = {
        originators: originatorsSnap.size,
        lenders: lendersSnap.size,
        loans: loansSnap.size,
        activePromotions: promotionsResponse?.codes?.length ?? 0,
        recentActivity: [],
      };

      // Debug logging
      console.log('[AdminState] Dashboard stats loaded:', stats);

      this._stats.set(stats);
      this._lastRefreshed.set(new Date());
    } catch (err) {
      console.error('[AdminState] Failed to load dashboard stats:', err);
      this._error.set('Failed to load dashboard data. Please try again.');
      this._stats.set(null);
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Alternative: Use Cloud Function for ALL stats (more consistent)
   * Uncomment this method if you create the Cloud Function
   */
  /*
  async loadDashboardStatsViaFunction(): Promise<void> {
    if (!this._isAuthenticated()) {
      this._error.set('Not authenticated');
      return;
    }

    this._isLoading.set(true);
    this._error.set(null);

    try {
      // First, check if the function exists
      const getAdminStats = httpsCallable<void, DashboardStats>(
        this.functions, 
        'getAdminStats'
      );
      
      const result = await getAdminStats();
      const stats = result.data;
      
      console.log('[AdminState] Stats from Cloud Function:', stats);
      
      this._stats.set(stats);
      this._lastRefreshed.set(new Date());
    } catch (err: any) {
      // If function doesn't exist, fall back to hybrid approach
      if (err?.code === 'functions/not-found') {
        console.warn('[AdminState] Cloud Function not found, using hybrid approach');
        return this.loadDashboardStats(); // Fall back to hybrid
      }
      
      console.error('[AdminState] Failed to load stats via function:', err);
      this._error.set('Failed to load dashboard data');
      this._stats.set(null);
    } finally {
      this._isLoading.set(false);
    }
  }
  */

  async refresh(): Promise<void> {
    await this.loadDashboardStats();
  }


  // Optional code-exchange flow (kept for compatibility)
  async login(code: string): Promise<{ success: boolean; error?: string }> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const result = await this.adminAuth.exchangeCodeForToken(code).toPromise();
      if (!result?.ok) {
        const msg = 'Invalid admin code';
        this._error.set(msg);
        return { success: false, error: msg };
      }

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

  async logout(): Promise<void> {
    try {
      await this.adminApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.setAuthenticated(false);
    }
  }

  clearError(): void {
    this._error.set(null);
  }

  setLoading(value: boolean): void {
    this._isLoading.set(value);
  }
}
