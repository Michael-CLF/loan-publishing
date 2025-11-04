import { inject } from '@angular/core';
import {
  CanActivateFn,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
  UrlTree
} from '@angular/router';
import { getAuth } from 'firebase/auth';
import { AdminStateService } from '../../services/admin-state.service';

// Helper to build a redirect to the dashboard with returnUrl
function toDashboard(router: Router, state?: RouterStateSnapshot): UrlTree {
  const returnUrl = state ? `?returnUrl=${encodeURIComponent(state.url)}` : '';
  return router.parseUrl(`/admin/dashboard${returnUrl}`);
}

/**
 * Guard for sensitive admin pages.
 * Allows navigation only if:
 *  1) Firebase user exists, and
 *  2) user has the 'admin' claim, and
 *  3) server-side session check passes.
 * Otherwise redirect to the (unguarded) dashboard where the login UI lives.
 */
export const adminAuthGuard: CanActivateFn = async (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Promise<boolean | UrlTree> => {
  const router = inject(Router);
  const adminState = inject(AdminStateService);

  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    adminState.setAuthenticated(false);
    return toDashboard(router, state);
  }

  // Server check (cookie/session) – avoids trusting only the client claim
  const serverOk = await adminState.checkAuthStatus().catch(() => false);

  try {
    const token = await user.getIdTokenResult(true);
    const isAdmin = token?.claims?.['admin'] === true;

    adminState.setAuthenticated(Boolean(isAdmin && serverOk));
    return isAdmin && serverOk ? true : toDashboard(router, state);
  } catch {
    adminState.setAuthenticated(false);
    return toDashboard(router, state);
  }
};

/**
 * Guard for the dashboard shell (the page that shows the code-entry UI).
 * Never blocks navigation. It just updates state to keep the header/UI in sync.
 * Keep /admin/dashboard UNGUARDED in your routes.
 */
export const adminDashboardGuard: CanActivateFn = async (): Promise<boolean> => {
  const adminState = inject(AdminStateService);
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    adminState.setAuthenticated(false);
    return true;
  }

  try {
    const token = await user.getIdTokenResult(true);
    adminState.setAuthenticated(token?.claims?.['admin'] === true);
  } catch {
    adminState.setAuthenticated(false);
  }
  return true;
};

/**
 * Prevents authenticated admins from visiting pages meant for unauthenticated users
 * (e.g., a separate admin login page). If already admin, send them to the dashboard.
 * Not needed for the code-entry dashboard itself.
 */
export const adminNoAuthGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const router = inject(Router);
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) return true;

  try {
    const token = await user.getIdTokenResult(true);
    if (token?.claims?.['admin'] === true) {
      return router.parseUrl('/admin/dashboard');
    }
  } catch {
    // ignore and allow
  }
  return true;
};

/**
 * Optional role-based guard. Today 'admin' implies all roles.
 * Keep for future expansion.
 */
export const adminRoleGuard: (requiredRole: string) => CanActivateFn =
  (_requiredRole: string) => {
    return async (_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean | UrlTree> => {
      const router = inject(Router);
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) return toDashboard(router, state);

      try {
        const token = await user.getIdTokenResult(true);
        const isAdmin = token?.claims?.['admin'] === true;
        return isAdmin ? true : toDashboard(router, state);
      } catch {
        return toDashboard(router, state);
      }
    };
  };
