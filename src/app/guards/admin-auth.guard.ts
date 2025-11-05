// admin-auth.guard.ts
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

/**
 * Helper function to redirect non-admin users to appropriate location
 * Following Angular best practice of clear, reusable utility functions
 */
function redirectNonAdmin(router: Router, state?: RouterStateSnapshot): UrlTree {
  // Store the attempted URL for redirecting after successful admin auth
  if (state?.url) {
    localStorage.setItem('adminRedirectUrl', state.url);
  }
  
  // Redirect to regular dashboard, not admin dashboard (fixes infinite loop)
  return router.parseUrl('/dashboard');
}

/**
 * Main admin authentication guard
 * Protects admin routes by verifying both Firebase admin claim and server validation
 */
export const adminAuthGuard: CanActivateFn = async (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Promise<boolean | UrlTree> => {
  const router = inject(Router);
  const adminState = inject(AdminStateService);

  try {
    const auth = getAuth();
    const user = auth.currentUser;
    
    // No user logged in - redirect to regular dashboard
    if (!user) {
      console.log('[Admin Guard] No authenticated user found');
      adminState.setAuthenticated(false);
      return redirectNonAdmin(router, state);
    }

    // Force token refresh to get latest claims
    const token = await user.getIdTokenResult(true);
    const hasAdminClaim = token?.claims?.['admin'] === true;
    
    // Log for debugging (remove in production)
    console.log('[Admin Guard] User:', user.email, 'Admin claim:', hasAdminClaim);
    
    if (!hasAdminClaim) {
      console.log('[Admin Guard] User lacks admin claim');
      adminState.setAuthenticated(false);
      return redirectNonAdmin(router, state);
    }

    // Server-side validation (optional but recommended for security)
    // Consider making this configurable or adding retry logic
    const serverOk = await adminState.checkAuthStatus().catch((error) => {
      console.error('[Admin Guard] Server validation failed:', error);
      // You might want to allow access if only server check fails
      // but client claim is present (depending on security requirements)
      return false;
    });

    const isFullyAuthenticated = hasAdminClaim && serverOk;
    adminState.setAuthenticated(isFullyAuthenticated);
    
    if (isFullyAuthenticated) {
      console.log('[Admin Guard] Access granted');
      return true;
    } else {
      console.log('[Admin Guard] Server validation failed despite valid claim');
      return redirectNonAdmin(router, state);
    }
    
  } catch (error) {
    console.error('[Admin Guard] Unexpected error:', error);
    adminState.setAuthenticated(false);
    return redirectNonAdmin(router, state);
  }
};

/**
 * Dashboard-specific guard for the admin dashboard route
 * This should actually protect the route, not just set state
 */
export const adminDashboardGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const router = inject(Router);
  const adminState = inject(AdminStateService);
  
  try {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      adminState.setAuthenticated(false);
      // Redirect to login if accessing dashboard directly without auth
      return router.parseUrl('/login');
    }

    const token = await user.getIdTokenResult(true);
    const isAdmin = token?.claims?.['admin'] === true;
    
    adminState.setAuthenticated(isAdmin);
    
    // Actually protect the route - don't always return true
    if (isAdmin) {
      return true;
    } else {
      // Non-admin users go to regular dashboard
      return router.parseUrl('/dashboard');
    }
    
  } catch (error) {
    console.error('[Admin Dashboard Guard] Error:', error);
    adminState.setAuthenticated(false);
    return router.parseUrl('/dashboard');
  }
};

/**
 * Prevents authenticated admins from visiting pages meant for unauthenticated users
 * (e.g., admin login page). Redirects admins to their dashboard.
 */
export const adminNoAuthGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const router = inject(Router);
  
  try {
    const auth = getAuth();
    const user = auth.currentUser;

    // No user - allow access to the page (e.g., login page)
    if (!user) {
      return true;
    }

    const token = await user.getIdTokenResult(true);
    
    // If user is admin, redirect them to admin dashboard
    if (token?.claims?.['admin'] === true) {
      return router.parseUrl('/admin/dashboard');
    }
    
    // Non-admin logged-in users can access the page
    return true;
    
  } catch (error) {
    console.error('[Admin NoAuth Guard] Error:', error);
    // On error, allow access to the page
    return true;
  }
};

/**
 * Role-based guard for future expansion
 * Currently treats 'admin' as having all roles
 */
export const adminRoleGuard: (requiredRole: string) => CanActivateFn =
  (requiredRole: string) => {
    return async (_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean | UrlTree> => {
      const router = inject(Router);
      
      try {
        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
          console.log(`[Role Guard] No user for role: ${requiredRole}`);
          return redirectNonAdmin(router, state);
        }

        const token = await user.getIdTokenResult(true);
        const isAdmin = token?.claims?.['admin'] === true;
        
        // For now, admin has all roles
        // In future, check: token?.claims?.['roles']?.includes(requiredRole)
        if (isAdmin) {
          return true;
        } else {
          console.log(`[Role Guard] User lacks required role: ${requiredRole}`);
          return redirectNonAdmin(router, state);
        }
        
      } catch (error) {
        console.error(`[Role Guard] Error checking role ${requiredRole}:`, error);
        return redirectNonAdmin(router, state);
      }
    };
  };