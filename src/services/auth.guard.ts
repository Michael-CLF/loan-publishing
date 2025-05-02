import { Injectable, inject } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { Observable } from 'rxjs';
import { filter, map, take, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  private router = inject(Router);
  private authService = inject(AuthService);

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    // Store the attempted URL for redirecting
    localStorage.setItem('redirectUrl', state.url);

    // First check if user is already on the dashboard
    if (state.url === '/dashboard') {
      // Get the current URL from the router
      const currentUrl = this.router.url;

      // If we're already on the dashboard, don't trigger auth checks
      // This helps prevent the login flash when refreshing the dashboard
      if (currentUrl === '/dashboard') {
        // Skip the full auth check, assume valid (the full check will happen in app.component)
        return this.authService.isLoggedIn$.pipe(
          take(1),
          map((isLoggedIn) => {
            // Only redirect if we're sure the user is not logged in
            if (!isLoggedIn) {
              // Double check localStorage as a backup
              if (localStorage.getItem('isLoggedIn') !== 'true') {
                this.router.navigate(['/login']);
                return false;
              }
            }
            return true;
          })
        );
      }
    }

    // Normal auth check for all other routes
    return this.authService.authReady$.pipe(
      // Wait for auth to be ready
      filter((ready) => ready),
      take(1),
      // Then check if user is logged in
      switchMap(() => this.authService.isLoggedIn$),
      take(1),
      map((isLoggedIn) => {
        if (isLoggedIn) {
          return true;
        }

        // If user is not logged in, redirect to login
        this.router.navigate(['/login']);
        return false;
      })
    );
  }
}
