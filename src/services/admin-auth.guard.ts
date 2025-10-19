import { Injectable, inject } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdminAuthGuard implements CanActivate {
  private router = inject(Router);

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    const ok = localStorage.getItem('adminAccess') === 'true';
    console.log('[AdminAuthGuard]', { url: state.url, ok });
    if (ok) return of(true);

    // send to your password screen
    this.router.navigate(['/admin/dashboard'], { queryParams: { r: state.url } });
    return of(false);
  }
}
