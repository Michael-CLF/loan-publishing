// ✅ Auth Guard — UID-first, Stripe-friendly
import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, of, from, combineLatest } from 'rxjs';
import { catchError, filter, map, switchMap, take, delay } from 'rxjs/operators';
import { User } from '@angular/fire/auth';
import { AuthService } from './auth.service';
import { FirestoreService } from './firestore.service';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Observable<boolean> | Promise<boolean> => {

  const router = inject(Router);
  const auth = inject(AuthService);
  const fsService = inject(FirestoreService);
  const firestore: Firestore = fsService.firestore;

  // Allow registration-processing route to load without authentication
  if (state.url.includes('/registration-processing')) {
    return of(true);
  }

  return auth.getCurrentFirebaseUser().pipe(
    switchMap((user: User | null) => {
      // If not authenticated, send to login
      if (!user?.uid) {
        localStorage.setItem('redirectUrl', state.url);
        router.navigate(['/login']);
        return of(false);
      }

      const uid = user.uid;
      const lenderRef = doc(firestore, `lenders/${uid}`);
      const originatorRef = doc(firestore, `originators/${uid}`);

      return combineLatest([
        from(getDoc(lenderRef)),
        from(getDoc(originatorRef))
      ]).pipe(
        map(([lenderSnap, originatorSnap]) => {
          const profile: any =
            lenderSnap.exists() ? lenderSnap.data() :
              originatorSnap.exists() ? originatorSnap.data() : null;

          // If no profile found, send to pricing
          if (!profile) {
            router.navigate(['/pricing']);
            return false;
          }

          const status = profile.subscriptionStatus;
          const pending = profile.paymentPending;

          // Active/grandfathered users can access everything
          if (status === 'active' || status === 'grandfathered') {
            return true;
          }

          // Payment pending - send to pricing
          if (pending === true || status === 'inactive') {
            router.navigate(['/pricing']);
            return false;
          }

          // Default: allow access
          return true;
        })
      );
    }),
    take(1),
    catchError(err => {
      console.error('authGuard error:', err);
      router.navigate(['/login']);
      return of(false);
    })
  );
};