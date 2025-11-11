// admin-api.service.ts (COMPLETE AND CORRECTED FILE - Firestore admins/{uid} logic)

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Auth, GoogleAuthProvider, signInWithPopup, UserCredential, signOut } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
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
  success?: boolean;
  message?: string;
  error?: string;
}

export interface AdminAuthStatus {
  ok: boolean;
  authenticated: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);

 private endpoint(path: string) {
  const cleanPath = path.replace(/^\/+/, '');
  return `${environment.adminApiBase}/${cleanPath}`;
}

  // Google login + Firestore admin check
  async login(): Promise<AdminLoginResponse> {
    try {
      const provider = new GoogleAuthProvider();
      const userCredential: UserCredential = await signInWithPopup(this.auth, provider);
      const user = userCredential.user;
      if (!user) throw new Error('Google Sign-in failed: No user object received.');

      // Firestore-based admin authorization
      const snap = await getDoc(doc(this.firestore, `admins/${user.uid}`));
      if (snap.exists()) {
        return { ok: true, success: true, message: 'Admin login successful.' };
      }

      // Not an admin -> sign out and deny
      await signOut(this.auth);
      throw new Error('Access Denied. User lacks Admin privileges. Contact support to grant access.');
    } catch (err: any) {
      console.error('[Admin login] authentication failed:', err);
      const errorMessage =
        err?.code === 'auth/popup-closed-by-user'
          ? 'Sign-in window closed.'
          : err?.message || 'Login failed.';
      return { ok: false, success: false, error: errorMessage };
    }
  }

  // Auth status via Firestore admins/{uid}
  async checkAuth(): Promise<AdminAuthStatus> {
    const user = this.auth.currentUser;
    if (!user) return { ok: false, authenticated: false };

    try {
      const snap = await getDoc(doc(this.firestore, `admins/${user.uid}`));
      const isAdmin = snap.exists();
      if (!isAdmin) await signOut(this.auth);
      return { ok: true, authenticated: isAdmin };
    } catch {
      return { ok: false, authenticated: false };
    }
  }

  /** Logout: client-side only */
  async logout(): Promise<void> {
    await signOut(this.auth);
  }

  /** Dashboard overview */
  async getOverview(): Promise<AdminOverview> {
    const resp = await firstValueFrom(
      this.http.get<AdminOverview>(this.endpoint('overview'))
    );
    if (!resp.ok) throw new Error('Failed to fetch overview data');
    return resp;
  }

  async getDetailedStats(startDate?: string, endDate?: string): Promise<any> {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return firstValueFrom(this.http.get(this.endpoint('overview/detailed'), { params }));
  }

  async getActivityLogs(limit = 50): Promise<any> {
    return firstValueFrom(this.http.get(this.endpoint('logs'), { params: { limit: String(limit) } }));
  }

  async getUsers(page = 1, limit = 20): Promise<any> {
    return firstValueFrom(
      this.http.get(this.endpoint('users'), { params: { page: String(page), limit: String(limit) } })
    );
  }

  async getLenders(page = 1, limit = 20): Promise<any> {
    return firstValueFrom(
      this.http.get(this.endpoint('lenders'), { params: { page: String(page), limit: String(limit) } })
    );
  }

  async getLoans(page = 1, limit = 20, status?: string): Promise<any> {
    const params: any = { page: String(page), limit: String(limit) };
    if (status) params.status = status;
    return firstValueFrom(this.http.get(this.endpoint('loans'), { params }));
  }

  async getPromotions(): Promise<any> {
    return firstValueFrom(this.http.get(this.endpoint('promotions')));
  }

  async createPromotion(promo: any): Promise<any> {
    return firstValueFrom(this.http.post(this.endpoint('promotions'), promo));
  }

  async deletePromotion(id: string): Promise<any> {
    return firstValueFrom(this.http.delete(this.endpoint(`promotions/${id}`)));
  }

  async exportData(type: 'users' | 'lenders' | 'loans'): Promise<Blob> {
    return firstValueFrom(
      this.http.post(this.endpoint(`export/${type}`), {}, { responseType: 'blob' as const })
    );
  }
}
