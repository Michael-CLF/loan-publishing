// auth.guard.ts
import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree
} from '@angular/router';
import { Observable, of, from, combineLatest } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';
import { User } from '@angular/fire/auth';
import { AuthService } from '../../services/auth.service';
import { FirestoreService } from '../../services/firestore.service';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Observable<boolean | UrlTree> => {

  const url = state.url || '';
  const router = inject(Router);
  const auth = inject(AuthService);
  const fsService = inject(FirestoreService);
  const firestore: Firestore = fsService.firestore;

  // 1. Always allow Firebase internal auth callback URLs
  if (url.includes('/__/auth/action')) {
    return of(true);
  }

  // 2. Always allow registration-processing screen
  //    We use that page during post-Stripe and OTP.
  if (url.includes('/registration-processing')) {
    return of(true);
  }

 // 3. Check Firebase auth first
return auth.getCurrentFirebaseUser().pipe(
  take(1),
  switchMap((user: User | null) => {
    // Not logged in at all -> go to /login
    if (!user?.uid) {
      localStorage.setItem('redirectUrl', url);
      return of(router.parseUrl('/login'));
    }

    const uid = user.uid;
    const adminRef = doc(firestore, `admins/${uid}`);
    const lenderRef = doc(firestore, `lenders/${uid}`);
    const originatorRef = doc(firestore, `originators/${uid}`);

    return combineLatest([
      from(getDoc(lenderRef)),
      from(getDoc(originatorRef)),
      from(getDoc(adminRef)),
    ]).pipe(
      take(1),
      map(([lenderSnap, originatorSnap, adminSnap]) => {
        // Admin found: allow access and skip subscription checks
        if (adminSnap.exists()) return true;

        const profile: any =
          lenderSnap.exists() ? lenderSnap.data() :
          originatorSnap.exists() ? originatorSnap.data() :
          null;

        if (!profile) return router.parseUrl('/pricing');

        const status = profile.subscriptionStatus;
        const allowedStatuses = ['active', 'grandfathered', 'trial'];

        // Allowed -> let them in; otherwise -> pricing
        return allowedStatuses.includes(status)
          ? true
          : router.parseUrl('/pricing');
      })
    );
  })
);
}
  