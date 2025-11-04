import {
  HttpInterceptor,
  HttpHandler,
  HttpRequest,
  HttpEvent,
  HTTP_INTERCEPTORS,
} from '@angular/common/http';
import { Injectable, Provider } from '@angular/core';
import { Router } from '@angular/router';
import { from, Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { getAuth } from 'firebase/auth';
import { environment } from '../../environments/environment';
import { AdminStateService } from '../../services/admin-state.service';

@Injectable()
export class AdminAuthInterceptor implements HttpInterceptor {
  constructor(
    private router: Router,
    private adminState: AdminStateService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Skip non-admin API, OPTIONS, and promo callable
    if (
      !req.url.startsWith(environment.adminApiBase) ||
      req.method === 'OPTIONS' ||
      req.url.includes('validatePromo')
    ) {
      return next.handle(req);
    }

    // Ensure JSON header
    const jsonReq = req.clone({ setHeaders: { 'Content-Type': 'application/json' } });

    // Get current Firebase ID token (or null)
    const tokenPromise = (async () => {
      const user = getAuth().currentUser;
      if (!user) return null;
      return await user.getIdToken();
    })();

    return from(tokenPromise).pipe(
      switchMap((token) => {
        const authReq = token
          ? jsonReq.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
          : jsonReq;
        return next.handle(authReq);
      }),
      catchError((err) => {
        if (err?.status === 401 || err?.status === 403) this.handleUnauthenticated();
        return throwError(() => err);
      })
    );
  }

  private handleUnauthenticated(): void {
    try {
      if (this.adminState?.logout) this.adminState.logout();
    } catch {}
    this.router.navigate(['/admin/login']);
  }
}

export const adminAuthInterceptorProvider: Provider = {
  provide: HTTP_INTERCEPTORS,
  useClass: AdminAuthInterceptor,
  multi: true,
};
