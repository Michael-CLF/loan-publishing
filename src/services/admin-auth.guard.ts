// src/app/guards/admin-auth.guard.ts
import { Injectable, inject } from '@angular/core';
import {
  CanActivate,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root',
})
export class AdminAuthGuard implements CanActivate {
  private router = inject(Router);
  private authService = inject(AuthService);

  // Your secure admin code - change this to something only you know
  private readonly adminCode: string = 'gk#1uykG&R%pH*2L10UW1';

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    // Check if user is logged in
    return this.authService.isLoggedIn$.pipe(
      take(1),
      map((isLoggedIn: boolean) => {
        if (!isLoggedIn) {
          this.router.navigate(['/login']);
          return false;
        }

        // Check if admin code is verified in localStorage
        const hasAdminAccess = localStorage.getItem('adminAccess') === 'true';

        if (hasAdminAccess) {
          return true;
        }

        // If code is in the URL query params, verify it
        const codeParam = route.queryParamMap.get('code');
        if (codeParam && this.verifyAdminCode(codeParam)) {
          return true;
        }

        // If no valid code, redirect to dashboard
        this.router.navigate(['/dashboard']);
        return false;
      })
    );
  }

  // Verify the admin code
  private verifyAdminCode(code: string): boolean {
    const isValid = code === this.adminCode;

    if (isValid) {
      // Store admin access in localStorage
      localStorage.setItem('adminAccess', 'true');
    }

    return isValid;
  }
}
