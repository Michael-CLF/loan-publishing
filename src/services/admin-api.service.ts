// admin-api.service.ts (COMPLETE AND CORRECTED FILE - New Custom Claims Logic)

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';

// 🔑 V9 AngularFire Imports
import { Auth, GoogleAuthProvider, signInWithPopup, UserCredential, signOut, authState } from '@angular/fire/auth'; 

// --- INTERFACES ---

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
    // We can no longer fetch a session cookie expiry, so we just check authentication status
    ok: boolean;
    authenticated: boolean;
}


@Injectable({ providedIn: 'root' })
export class AdminApiService {
    private readonly http = inject(HttpClient);
    private readonly auth = inject(Auth); 
    
    // ⚠️ WARNING: We must retain the endpoint function for data fetching (overview, users, etc.)
    // These still hit your deployed adminHttp function via the Angular proxy.
    private endpoint(path: string) {
        // e.g., converts 'overview' to '/admin/overview' for the Angular proxy
        return `/admin/${path.replace(/^\/+/, '')}`; 
    }

    /**
     * 🔑 NEW LOGIN: Signs in with Google Pop-up and checks the Custom Admin Claim.
     * REMOVES: All dependency on the failing backend exchange function.
     */
    async login(): Promise<AdminLoginResponse> {
        try {
            // 1. INITIATE GOOGLE SIGN-IN
            const provider = new GoogleAuthProvider(); 
            const userCredential: UserCredential = await signInWithPopup(this.auth, provider);
            const user = userCredential.user;

            if (!user) {
                throw new Error('Google Sign-in failed: No user object received.');
            }

            // 2. AUTHORIZATION CHECK: Get token result (forcing refresh) to check for the 'admin' custom claim.
            const tokenResult = await user.getIdTokenResult(true); 

            if (tokenResult.claims['admin'] === true) {
                // SUCCESS: User has the 'admin' claim set on their Firebase account.
                // The Angular Route Guard must now use this claim for protection.
                return { ok: true, success: true, message: 'Admin login successful.' };
            } else {
                // FAILURE: The token lacks the admin claim. Log them out and deny access.
                await signOut(this.auth);
                throw new Error('Access Denied. User lacks Admin privileges. Contact support to grant access.');
            }
        } catch (err: any) {
            console.error('[Admin login] authentication failed:', err);
            const errorMessage = (err.code === 'auth/popup-closed-by-user') 
                ? 'Sign-in window closed.'
                : err.message || 'Login failed.';
            
            return { ok: false, success: false, error: errorMessage };
        }
    }


    /** ⚠️ DEPRECATED: We no longer check a backend cookie. Use AngularFire state instead. */
    // This is now redundant since the login check handles admin status.
    async checkAuth(): Promise<AdminAuthStatus> {
        // The calling component or guard should use AngularFire's authState to check if a user is logged in.
        // For compatibility with the old interface, we check the current user's token for the admin claim.
        const user = this.auth.currentUser;
        if (user) {
            try {
                const tokenResult = await user.getIdTokenResult(false); // Don't force refresh
                const authenticated = tokenResult.claims['admin'] === true;

                if (!authenticated) {
                    await signOut(this.auth);
                }
                return { ok: true, authenticated: authenticated };

            } catch (e) {
                 return { ok: false, authenticated: false };
            }
        }
        return { ok: false, authenticated: false };
    }

    /** Logout: NO LONGER calls a backend function to clear cookie. Signs out of Firebase client-side only. */
    async logout(): Promise<void> {
        // We removed the failing HTTP POST call to 'logout'
        await signOut(this.auth); 
    }

    // --- All other data fetching methods remain the same ---

    /** Dashboard overview */
    async getOverview(): Promise<AdminOverview> {
        const resp = await firstValueFrom(
            this.http.get<AdminOverview>(
                this.endpoint('overview')
                // Removed { withCredentials: true } because we no longer rely on the session cookie
            )
        );
        if (!resp.ok) throw new Error('Failed to fetch overview data');
        return resp;
    }
    
    // ... all other data fetching methods (getDetailedStats, getActivityLogs, getUsers, etc.) ...
    // You should remove { withCredentials: true } from ALL http.get/post/delete calls 
    // in this service as they are no longer needed for the session cookie.
    
    // For brevity, I only fixed getOverview. Please apply the removal of { withCredentials: true }
    // to all your remaining data fetching methods in the actual file.

    async getDetailedStats(startDate?: string, endDate?: string): Promise<any> {
        const params: any = {};
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        return firstValueFrom(
            this.http.get(
                this.endpoint('overview/detailed'),
                { params } // Removed withCredentials
            )
        );
    }
    async getActivityLogs(limit = 50): Promise<any> {
        return firstValueFrom(
            this.http.get(
                this.endpoint('logs'),
                { params: { limit: String(limit) } } // Removed withCredentials
            )
        );
    }
    
    async getUsers(page = 1, limit = 20): Promise<any> {
        return firstValueFrom(
            this.http.get(
                this.endpoint('users'),
                {
                    params: { page: String(page), limit: String(limit) },
                } // Removed withCredentials
            )
        );
    }
    
    async getLenders(page = 1, limit = 20): Promise<any> {
        return firstValueFrom(
            this.http.get(
                this.endpoint('lenders'),
                {
                    params: { page: String(page), limit: String(limit) },
                } // Removed withCredentials
            )
        );
    }
    
    async getLoans(page = 1, limit = 20, status?: string): Promise<any> {
        const params: any = { page: String(page), limit: String(limit) };
        if (status) params.status = status;

        return firstValueFrom(
            this.http.get(
                this.endpoint('loans'),
                { params } // Removed withCredentials
            )
        );
    }
    async getPromotions(): Promise<any> {
        return firstValueFrom(
            this.http.get(this.endpoint('promotions')) // Removed withCredentials
        );
    }
    
    async createPromotion(promo: any): Promise<any> {
        return firstValueFrom(
            this.http.post(this.endpoint('promotions'), promo) // Removed withCredentials
        );
    }
    
    async deletePromotion(id: string): Promise<any> {
        return firstValueFrom(
            this.http.delete(this.endpoint(`promotions/${id}`)) // Removed withCredentials
        );
    }
    
    async exportData(type: 'users' | 'lenders' | 'loans'): Promise<Blob> {
        return firstValueFrom(
            this.http.post(
                this.endpoint(`export/${type}`),
                {},
                { responseType: 'blob' as const } // Removed withCredentials
            )
        );
    }
}