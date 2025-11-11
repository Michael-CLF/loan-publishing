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

  // Public routes that must bypass auth/subscription checks
  const PUBLIC_WHITELIST: string[] = [
    '/login',
    '/register',
    '/pricing',
    // Registration wizard steps
    '/lender-registration',
    '/lender-contact',
    '/lender-product',
    '/lender-footprint',
    '/lender-review',
    // Post-Stripe / processing screens
    '/registration-processing',
    '/complete-payment',
    // Firebase internal auth callback
    '/__/auth/action'
  ];

  // Early exit for public/registration routes
  if (PUBLIC_WHITELIST.some(prefix => url.startsWith(prefix))) {
    return of(true);
  }

  // 1. Always allow Firebase internal auth callback URLs
  if (url.includes('/__/auth/action')) {
    return of(true);
  }

  // 3. Check Firebase auth first
  return auth.getCurrentFirebaseUser().pipe(
    take(1),
    switchMap((user: User | null) => {
      // Not logged in at all -> go to /login
      // Not logged in at all -> go to /login with ?next= and mirror to postLoginNext
      if (!user?.uid) {
        try { localStorage.setItem('postLoginNext', url); } catch { }
        return of(router.createUrlTree(['/login'], { queryParams: { next: url } }));
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
        // Located inside the pipe(map(...))
        map(([lenderSnap, originatorSnap, adminSnap]) => {
          // Admin found: BLOCK access and redirect to Admin Dashboard
          if (adminSnap.exists()) return router.parseUrl('/admin/dashboard'); // <-- FIXED


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
