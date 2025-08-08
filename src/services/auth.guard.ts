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

  // 1) Allow the payment callback / processing route to load
  //    (we still check subscription right after page renders)
  if (state.url.includes('/registration-processing')) {
    return of(true);
  }

return auth.getCurrentFirebaseUser().pipe(
  filter((u): u is User => !!u),
  take(1),
  switchMap((user: User) => {
    const uid = user.uid;
    if (!uid) {
      router.navigate(['/login']);
      return of(false);
    }

      // Remember where we were trying to go
      localStorage.setItem('redirectUrl', state.url);

      // Post-payment leniency: if we’re coming right back from Stripe,
      // let the spinner/processing page catch up for 2s before hard-blocking.
      const isPostPayment = !!localStorage.getItem('showRegistrationModal');

      const lenderRef = doc(firestore, `lenders/${uid}`);
      const originatorRef = doc(firestore, `originators/${uid}`);

      const checks$ = combineLatest([
        from(getDoc(lenderRef)),
        from(getDoc(originatorRef))
      ]).pipe(
        map(([lenderSnap, originatorSnap]) => {
          const profile: any =
            lenderSnap.exists() ? lenderSnap.data() :
              originatorSnap.exists() ? originatorSnap.data() : null;

          // If no profile, allow (registration flow will create it)
          if (!profile) return true;

          const status = profile.subscriptionStatus;
          const pending = profile.paymentPending;

          // Active/grandfathered = allow
          if (status === 'active' || status === 'grandfathered') return true;

          // During payment handoff we allow a brief window if pending just flipped
          if (isPostPayment && (pending === true || status === 'pending' || !status)) {
            return true;
          }

          // Registration not completed yet?
          if (profile.registrationCompleted === false) {
            router.navigate(['/complete-registration']);
            return false;
          }

          // Otherwise, send to pricing
          router.navigate(['/pricing']);
          return false;
        })
      );

      // If we just returned from Stripe, give webhook a moment to flip flags
      return isPostPayment ? checks$.pipe(delay(2000)) : checks$;
    }),
    catchError(err => {
      console.error('authGuard error:', err);
      router.navigate(['/login']);
      return of(false);
    })
  );
};
