// src/app/guards/admin-auth.guard.ts  (FULL FILE - Firestore-based, no custom claims)

import { inject } from '@angular/core';
import {
  CanActivateFn,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
  UrlTree
} from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';

function redirectNonAdmin(router: Router, state?: RouterStateSnapshot): UrlTree {
  // preserve intent so we can return after login
  const next = state?.url ?? '/admin/dashboard';
  return router.createUrlTree(['/login'], { queryParams: { next } });
}


/** Core check: signed-in AND admins/{uid} exists */
async function isAdminByDoc(auth: Auth, db: Firestore): Promise<boolean> {
  const user = await firstValueFrom(authState(auth)); // wait for initial resolve
  if (!user) return false;
  const snap = await getDoc(doc(db, `admins/${user.uid}`));
  return snap.exists();
}

export const adminAuthGuard: CanActivateFn = async (_r, state) => {
  const router = inject(Router);
  const auth = inject(Auth);
  const db = inject(Firestore);

  // wait for auth state once
  const user = await firstValueFrom(authState(auth));
  if (!user) return redirectNonAdmin(router, state);

  const snap = await getDoc(doc(db, `admins/${user.uid}`));
  return snap.exists() ? true : redirectNonAdmin(router, state);
};

/** Guard for pages that should be accessible only when NOT an admin (e.g., admin login) */
export const adminNoAuthGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const router = inject(Router);
  const auth = inject(Auth);
  const db = inject(Firestore);

  const ok = await isAdminByDoc(auth, db);
  return ok ? router.parseUrl('/admin/dashboard') : true;
};

/** Role guard wrapper. For now: admin has all roles. */
export const adminRoleGuard: (requiredRole: string) => CanActivateFn =
  (_requiredRole: string) => {
    return async (_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean | UrlTree> => {
      const router = inject(Router);
      const auth = inject(Auth);
      const db = inject(Firestore);

      const ok = await isAdminByDoc(auth, db);
      return ok ? true : redirectNonAdmin(router, state);
    };
  };
