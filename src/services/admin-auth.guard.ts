// src/app/guards/admin-auth.guard.ts
import { Injectable, inject } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { from, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AdminAuthGuard implements CanActivate {
  private router = inject(Router);

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    // Call the HTTPS function GET /admin/me (cookie-based check)
    const url = '/admin/me'; // served via Functions; ensure your proxy or absolute URL if needed

    return from(fetch(url, { method: 'GET', credentials: 'include' })).pipe(
      map(resp => {
        const ok = resp.ok;
        console.log('[AdminAuthGuard] /admin/me', { url: state.url, ok });
        if (ok) return true;
        this.router.navigate(['/admin/dashboard'], { queryParams: { r: state.url } });
        return false;
      }),
      catchError(() => {
        this.router.navigate(['/admin/dashboard'], { queryParams: { r: state.url } });
        return of(false);
      })
    );
  }
}
