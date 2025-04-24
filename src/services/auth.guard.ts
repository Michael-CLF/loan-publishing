// auth.guard.ts
import { Injectable, inject } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
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
    return this.authService.isLoggedIn$.pipe(
      take(1),
      map((isLoggedIn) => {
        console.log('AuthGuard: isLoggedIn =', isLoggedIn);

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
  }
}
