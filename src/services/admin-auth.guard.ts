import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, combineLatest, of } from 'rxjs';
import { filter, map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AdminAuthGuard implements CanActivate {
  private router = inject(Router);
  private authService = inject(AuthService);

  private readonly adminCode = 'gk#1uykG&R%pH*2L10UW1';

 canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
  const ready$ = this.authService.authReady$ ?? of(true);

  return combineLatest([ready$, this.authService.isLoggedIn$]).pipe(
    // wait until auth is ready (or pass-through if you don't have authReady$)
    filter(([ready]) => !!ready),
    take(1),
    map(([_, isLoggedIn]) => {
      if (!isLoggedIn) {
        this.router.navigate(['/login'], { queryParams: { r: state.url } });
        return false;
      }

      // Local admin flag
      const hasAdminAccess = localStorage.getItem('adminAccess') === 'true';
      if (hasAdminAccess) return true;

      // One-time code via query param
      const codeParam = route.queryParamMap.get('code');
      if (codeParam && this.verifyAdminCode(codeParam)) return true;

      // No admin proof → bounce
      this.router.navigate(['/dashboard']);
      return false;
    })
  );
}


  

  private verifyAdminCode(code: string): boolean {
    const isValid = code === this.adminCode;
    if (isValid) localStorage.setItem('adminAccess', 'true');
    return isValid;
  }
}
