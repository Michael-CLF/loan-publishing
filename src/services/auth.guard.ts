// Modify your AuthGuard to wait for auth state to stabilize
import { Injectable, inject } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, take, switchMap, filter, tap } from 'rxjs/operators';
import { AuthService } from './auth.service';

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
    console.log('AuthGuard: Checking auth for route:', state.url);

    // First, ensure auth is initialized before checking state
    return this.authService.authReady$.pipe(
      filter((ready) => ready), // Wait for auth to be ready
      take(1),
      switchMap(() => {
        // Now check the actual logged in state
        return this.authService.isLoggedIn$.pipe(
          take(1),
          tap((isLoggedIn) =>
            console.log(
              'AuthGuard: Auth check complete, isLoggedIn =',
              isLoggedIn
            )
          ),
          map((isLoggedIn) => {
            if (isLoggedIn) {
              return true;
            }

            // Store the attempted URL for redirecting
            localStorage.setItem('redirectUrl', state.url);

            // Navigate to the login page
            this.router.navigate(['/login']);
            return false;
          })
        );
      })
    );
  }
}
