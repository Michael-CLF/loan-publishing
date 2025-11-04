// admin-api.service.ts (NEW COMPLETE FILE)

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth'; 

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
    // We keep 'ok' for legacy client code, but use 'success' for the new server response
    ok: boolean; 
    success?: boolean; 
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
    
    // This helper should point to your local Firebase Emulator (e.g., http://localhost:5001/loanpub/us-central1/adminHttp)
    // or rely on the Angular proxy for local development.
    private endpoint(path: string) {
        // This is primarily for routes other than login, using the Angular proxy path `/admin/`
        return `/admin/${path.replace(/^\/+/, '')}`; 
    }

    constructor(private readonly http: HttpClient) { }


    /**
     * 🔑 NEW LOGIN: Signs in with Google Pop-up and exchanges the ID Token for a Session Cookie.
     */
    async login(): Promise<AdminLoginResponse> { // 🔑 NO credentials required here
        try {
            // 1. INITIATE GOOGLE SIGN-IN
            const provider = new firebase.auth.GoogleAuthProvider();
            const userCredential = await firebase.auth().signInWithPopup(provider);
            const user = userCredential.user;

            if (!user) {
                throw new Error('Google Sign-in failed: No user object received.');
            }

            // 2. GET ID TOKEN (forcing refresh is crucial to pick up the 'admin' custom claim)
            const idToken = await user.getIdToken(true); 

            // 3. EXCHANGE TOKEN for Session Cookie on the backend (sends token to /auth-admin)
            const exchangeUrl = environment.adminExchangeCodeUrl; 
            
            const resp = await firstValueFrom(
                this.http.post<AdminLoginResponse>(
                    exchangeUrl,
                    { idToken }, // Send the Firebase ID Token
                    { withCredentials: true }
                )
            );

            if (resp.success) {
                return { ok: true, success: true, message: 'Admin login successful.' };
            } else {
                // Backend rejected the token (e.g., missing admin claim)
                await firebase.auth().signOut(); // Log out non-admin users client-side
                throw new Error(resp.message || 'Access denied by server: Missing Admin claim.');
            }

        } catch (err: any) {
            console.error('[Admin login] authentication failed:', err);
            // Check if error is related to popup being closed
            const errorMessage = (err.code === 'auth/popup-closed-by-user') 
                ? 'Sign-in window closed.'
                : err.message || 'Login failed.';
            
            return { ok: false, success: false, error: errorMessage };
        }
    }


    /** Check cookie-based auth */
    async checkAuth(): Promise<AdminAuthStatus> {
        try {
            const resp = await firstValueFrom(
                this.http.get<AdminAuthStatus>(
                    this.endpoint('check-auth'), // Maps to GET /admin/check-auth on the router
                    { withCredentials: true }   
                )
            );
            return resp;
        } catch {
            return { ok: false, authenticated: false };
        }
    }

    /** Logout: clears cookie and signs out of Firebase client-side */
    async logout(): Promise<void> {
        try {
            await firstValueFrom(
                this.http.post( // Changed to POST for logout
                    this.endpoint('logout'),
                    {},
                    { withCredentials: true }   
                )
            );
            // Also sign out client-side for completeness
            await firebase.auth().signOut(); 

        } catch (e) {
            console.warn('Logout error (ignored):', e);
        }
    }

    /** Dashboard overview */
    async getOverview(): Promise<AdminOverview> {
        const resp = await firstValueFrom(
            this.http.get<AdminOverview>(
                this.endpoint('overview'),
                { withCredentials: true }     
            )
        );
        if (!resp.ok) throw new Error('Failed to fetch overview data');
        return resp;
    }

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