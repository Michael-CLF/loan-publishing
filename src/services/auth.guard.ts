// auth.guard.ts
import { Injectable, inject } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { map, take, tap, switchMap, catchError } from 'rxjs/operators';

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
    console.log('AuthGuard: Checking authentication for route:', state.url);
    console.log('Route params:', route.params);

    // First, check for email sign-in links
    return this.authService.isEmailSignInLink().pipe(
      take(1),
      switchMap((isEmailLink) => {
        if (isEmailLink) {
          console.log(
            'AuthGuard: Email sign-in link detected, allowing access'
          );
          return of(true);
        }

        console.log('AuthGuard: Checking current auth status');
        return this.authService.getAuthStatus().pipe(
          take(1),
          map((isLoggedIn) => {
            console.log('AuthGuard: Auth status =', isLoggedIn);

            if (!isLoggedIn) {
              console.log('AuthGuard: Not authenticated, redirecting to login');
              if (state.url !== '/login' && state.url !== '/') {
                localStorage.setItem('redirectUrl', state.url);
              }
              this.router.navigate(['/login']);
              return false;
            }

            console.log(
              'AuthGuard: User is authenticated, allowing access to',
              state.url
            );
            return true;
          }),
          catchError((error) => {
            console.error('AuthGuard: Error checking authentication', error);
            this.router.navigate(['/login']);
            return of(false);
          })
        );
      })
    );
  }
}
