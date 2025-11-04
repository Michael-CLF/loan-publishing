// src/services/admin-auth.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, from, of, throwError, BehaviorSubject } from 'rxjs';
import { switchMap, map, tap, catchError, shareReplay } from 'rxjs/operators';
import { 
  Auth, 
  signInWithCustomToken, 
  signOut,
  authState,
  User
} from '@angular/fire/auth';
import { environment } from '../environments/environment';

/**
 * Admin Authentication Service
 * Handles admin-specific authentication flows using Firebase custom tokens
 * Angular 18 best practices with inject() and functional patterns
 */
@Injectable({
  providedIn: 'root'
})
export class AdminAuthService {
  // Angular 18 inject pattern for dependencies
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  // Admin user state management
  private readonly adminUserSubject = new BehaviorSubject<User | null>(null);
  public readonly adminUser$ = this.adminUserSubject.asObservable();

  // Check if user is admin (reactive)
  public readonly isAdmin$: Observable<boolean> = authState(this.auth).pipe(
    map(user => !!user?.uid),
    tap(isAdmin => console.log('Admin auth state:', isAdmin)),
    shareReplay(1)
  );

  constructor() {
    // Subscribe to auth state changes
    authState(this.auth).subscribe(user => {
      this.adminUserSubject.next(user);
      console.log('Admin auth state updated:', user?.email || 'No user');
    });
  }

  /**
   * Exchange authorization code for Firebase custom token
   * This is called after admin enters the admin code
   * 
   * @param code The admin authorization code
   * @returns Observable with the authentication result
   */
exchangeCodeForToken(code: string): Observable<{ ok: boolean }> {
  return this.http.post<{ ok: boolean }>(
    '/admin/exchange-code',
    { code },
    { withCredentials: true } // receive Set-Cookie
  );
}
  /**
   * Verify if current session is still valid
   * Calls the check-auth endpoint
   */
  checkAuthStatus(): Observable<boolean> {
    const checkUrl = environment.adminCheckAuthUrl;
    
    return from(this.auth.currentUser?.getIdToken() || Promise.resolve(null)).pipe(
      switchMap(token => {
        if (!token) {
          return of(false);
        }

        const headers = new HttpHeaders({
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        });

        return this.http.get<{ authenticated: boolean }>(
          checkUrl,
          { 
            headers,
            withCredentials: false  // No cookies needed
          }
        ).pipe(
          map(response => response.authenticated),
          catchError(() => of(false))
        );
      })
    );
  }

  /**
   * Admin logout
   * Signs out from Firebase and clears local state
   */
  logout(): Observable<void> {
    console.log('Admin logging out...');
    
    return from(signOut(this.auth)).pipe(
      tap(() => {
        this.adminUserSubject.next(null);
        console.log('Admin logged out successfully');
        this.router.navigate(['/admin/login']);
      }),
      catchError(error => {
        console.error('Logout error:', error);
        // Even if logout fails, clear local state
        this.adminUserSubject.next(null);
        this.router.navigate(['/admin/login']);
        return of(void 0);
      })
    );
  }

  /**
   * Get current admin user synchronously
   */
  getCurrentAdmin(): User | null {
    return this.auth.currentUser;
  }

  /**
   * Get admin user ID
   */
  getAdminUid(): string | null {
    return this.auth.currentUser?.uid || null;
  }

  /**
   * Refresh the current user's ID token
   * Useful for keeping sessions alive
   */
  refreshToken(): Observable<string | null> {
    const currentUser = this.auth.currentUser;
    
    if (!currentUser) {
      return of(null);
    }

    return from(currentUser.getIdToken(true)).pipe(
      tap(token => console.log('Token refreshed')),
      catchError(error => {
        console.error('Token refresh failed:', error);
        return of(null);
      })
    );
  }

  /**
   * Check if user has admin claims
   * This checks the custom claims on the ID token
   */
  hasAdminClaim(): Observable<boolean> {
    const currentUser = this.auth.currentUser;
    
    if (!currentUser) {
      return of(false);
    }

    return from(currentUser.getIdTokenResult()).pipe(
      map(idTokenResult => {
        const claims = idTokenResult.claims;
        // Check for admin claim (adjust based on your setup)
        return claims['admin'] === true || claims['role'] === 'admin';
      }),
      catchError(() => of(false))
    );
  }
}