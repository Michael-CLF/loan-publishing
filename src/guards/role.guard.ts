// src/app/guards/role.guard.ts
import { Injectable, inject } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root',
})
export class RoleGuard implements CanActivate {
  private authService = inject(AuthService);
  private router = inject(Router);

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    const requiredRole = route.data['role'] as string;

    return this.authService.authReady$.pipe(
      switchMap((ready) => {
        if (!ready) {
          return of(false);
        }

        return this.authService.getCurrentUserProfile().pipe(
          take(1),
          map((userProfile) => {
            // If no specific role is required, or user has the required role
            if (!requiredRole || userProfile?.role === requiredRole) {
              return true;
            }

            // Handle case where user has a role but it's not the required one
            if (userProfile?.role) {
              // Redirect to appropriate dashboard based on actual role
              this.router.navigate([`/${userProfile.role}-dashboard`]);
            } else {
              // User has no role, redirect to generic dashboard
              this.router.navigate(['/dashboard']);
            }

            return false;
          })
        );
      })
    );
  }
}
