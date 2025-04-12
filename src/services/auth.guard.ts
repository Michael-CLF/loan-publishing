import { Injectable, inject } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { map, take, tap, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  private authService = inject(AuthService);
  private router = inject(Router);

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    console.log('AuthGuard: Checking authentication status...');

    // Store the URL the user is trying to access
    localStorage.setItem('redirectUrl', state.url);

    // First, check for email link sign-in
    return this.authService.isEmailSignInLink().pipe(
      take(1),
      switchMap((isEmailLink) => {
        // If it's an email sign-in link, let the user through (auth will happen in the component)
        if (isEmailLink) {
          console.log(
            'AuthGuard: Email sign-in link detected, allowing access'
          );
          return of(true);
        }

        // Otherwise, proceed with normal auth check
        console.log('AuthGuard: Normal auth check');
        return this.checkAuthentication(state);
      })
    );
  }

  private checkAuthentication(state: RouterStateSnapshot): Observable<boolean> {
    // Check the auth status with Firebase (with a timeout so we don't block forever)
    return this.authService.authReady$.pipe(
      take(1),
      switchMap(() => this.authService.isLoggedIn$),
      take(1),
      tap((isLoggedIn) => {
        console.log('AuthGuard: Auth status =', isLoggedIn);

        if (!isLoggedIn) {
          console.log('AuthGuard: Not authenticated, redirecting to login');
          // Don't overwrite redirectUrl if we're already going to login page
          if (state.url !== '/login') {
            localStorage.setItem('redirectUrl', state.url);
          }
          this.router.navigate(['/login']);
        } else {
          console.log('AuthGuard: Authentication confirmed');
        }
      })
    );
  }
}
