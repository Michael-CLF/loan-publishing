import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service'; // Adjust the import path
import { map, take, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    return this.authService.isLoggedIn$.pipe(
      take(1), // Take only the current value and complete
      map((isLoggedIn: boolean) => isLoggedIn), // Keep the boolean value
      tap((isLoggedIn: boolean) => {
        if (!isLoggedIn) {
          // Store the attempted URL for redirection after login
          localStorage.setItem('redirectUrl', state.url);
          this.router.navigate(['/login']);
        }
      })
    );
  }
}
