// admin-api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';

export interface AdminOverview {
  ok: boolean;
  originators: number;
  lenders: number;
  loans: number;
  activePromotions: number;
  recentActivity?: any[];
  timestamp?: string;
}

export interface AdminLoginResponse {
  ok: boolean;
  message?: string;
  error?: string;
  expiresIn?: number;
}

export interface AdminAuthStatus {
  ok: boolean;
  authenticated: boolean;
  session?: {
    createdAt: number;
    expiresAt: number;
  };
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private endpoint(path: string) {
    return `/admin/${path.replace(/^\/+/, '')}`;
  }


  constructor(private readonly http: HttpClient) { }

  async login(code: string): Promise<AdminLoginResponse> {
    try {
      const resp = await firstValueFrom(
        this.http.post<AdminLoginResponse>(
          this.endpoint('exchange-code'),
          { code },
          { withCredentials: true }
        )
      );
      return resp;
    } catch (err: any) {
      console.error('[Admin login] exchange failed', err);
      return { ok: false, error: err?.error?.error || 'Login failed' };
    }
  }

  /** Check cookie-based auth */
  async checkAuth(): Promise<AdminAuthStatus> {
    try {
      const resp = await firstValueFrom(
        this.http.get<AdminAuthStatus>(
          this.endpoint('me'),
          { withCredentials: true }   // IMPORTANT: send cookie
        )
      );
      return resp;
    } catch {
      return { ok: false, authenticated: false };
    }
  }

  /** Logout: clears cookie */
  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.get(
          this.endpoint('logout'),
          { withCredentials: true }   // IMPORTANT: clear cookie
        )
      );
    } catch (e) {
      console.warn('Logout error (ignored):', e);
    }
  }

  /** Dashboard overview */
  async getOverview(): Promise<AdminOverview> {
    const resp = await firstValueFrom(
      this.http.get<AdminOverview>(
        this.endpoint('overview'),
        { withCredentials: true }     // IMPORTANT: admin-only
      )
    );
    if (!resp.ok) throw new Error('Failed to fetch overview data');
    return resp;
  }

  // Optional: if you still use these pages, keep them but make them cookie-based.
  async getDetailedStats(startDate?: string, endDate?: string): Promise<any> {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    return firstValueFrom(
      this.http.get(
        this.endpoint('overview/detailed'),
        { params, withCredentials: true }
      )
    );
  }
   async getActivityLogs(limit = 50): Promise<any> {
    return firstValueFrom(
      this.http.get(
        this.endpoint('logs'),
        { params: { limit: String(limit) }, withCredentials: true }
      )
    );
  }

  async getUsers(page = 1, limit = 20): Promise<any> {
    return firstValueFrom(
      this.http.get(
        this.endpoint('users'),
        {
          params: { page: String(page), limit: String(limit) },
          withCredentials: true
        }
      )
    );
  }

  async getLenders(page = 1, limit = 20): Promise<any> {
    return firstValueFrom(
      this.http.get(
        this.endpoint('lenders'),
        {
          params: { page: String(page), limit: String(limit) },
          withCredentials: true
        }
      )
    );
  }

  async getLoans(page = 1, limit = 20, status?: string): Promise<any> {
    const params: any = { page: String(page), limit: String(limit) };
    if (status) params.status = status;

    return firstValueFrom(
      this.http.get(
        this.endpoint('loans'),
        { params, withCredentials: true }
      )
    );
  }
  async getPromotions(): Promise<any> {
    return firstValueFrom(
      this.http.get(this.endpoint('promotions'), { withCredentials: true })
    );
  }

  async createPromotion(promo: any): Promise<any> {
    return firstValueFrom(
      this.http.post(this.endpoint('promotions'), promo, { withCredentials: true })
    );
  }

  async deletePromotion(id: string): Promise<any> {
    return firstValueFrom(
      this.http.delete(this.endpoint(`promotions/${id}`), { withCredentials: true })
    );
  }

  async exportData(type: 'users' | 'lenders' | 'loans'): Promise<Blob> {
    return firstValueFrom(
      this.http.post(
        this.endpoint(`export/${type}`),
        {},
        { responseType: 'blob' as const, withCredentials: true }
      )
    );
  }
}
