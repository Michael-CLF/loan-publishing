import { Injectable, inject } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { map, switchMap, take } from 'rxjs/operators';
import { of } from 'rxjs';
import { AuthService } from '../../services/auth.service';

interface UserProfile { role?: 'lender' | 'originator' | 'admin' | string; }

@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {
  private router = inject(Router);
  private authService = inject(AuthService);

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    const requiredRole = route.data?.['role'] as string | undefined;

    const ready$ = this.authService.authReady$ ?? of(true);
    return ready$.pipe(
      switchMap(ready => (ready ? this.authService.getUserProfile() : of(null))), // <- correct method name
      take(1),
      map((userProfile: UserProfile | null) => {
        // allow if no specific role required
        if (!requiredRole) return true;

        if (userProfile?.role === requiredRole) return true;

        // has a role but not the required one → send to that role’s dashboard if known
        if (userProfile?.role) {
          this.router.navigate([`/${userProfile.role}-dashboard`]);
        } else {
          this.router.navigate(['/dashboard']);
        }
        return false;
      })
    );
  }
}
