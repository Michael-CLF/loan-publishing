// ✅ FIXED: auth.guard.ts - Updated to handle Stripe callback flow and UID-based checks
import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { Observable, of, from, combineLatest } from 'rxjs';
import { take, switchMap, map, catchError, delay } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { FirestoreService } from './firestore.service';

// -----------------------------------------------------
// GUARD
// -----------------------------------------------------
export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Observable<boolean> | Promise<boolean> => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const firestoreService = inject(FirestoreService);
  const firestore: Firestore = firestoreService.firestore;

  // ✅ Allow Stripe callback route
  if (state.url.includes('/payment-callback')) {
    return of(true);
  }

  // ✅ Post-payment leniency (webhook race)
  const isPostPayment = localStorage.getItem('showRegistrationModal') === 'true';
  if (isPostPayment) {
    return of(true).pipe(
      delay(2000),
      switchMap(() => performLenientAuthCheck(authService, firestore, router))
    );
  }

  // ✅ Store attempted URL for later redirect
  localStorage.setItem('redirectUrl', state.url);

  return authService.isLoggedIn$.pipe(
    take(1),
    switchMap(isLoggedIn => {
      if (!isLoggedIn) {
        router.navigate(['/login']);
        return of(false);
      }
      return checkSubscriptionStatus(authService, firestore, router);
    }),
    catchError(err => {
      console.error('Auth guard error:', err);
      router.navigate(['/login']);
      return of(false);
    })
  );
};

// -----------------------------------------------------
// HELPERS
// -----------------------------------------------------
function performLenientAuthCheck(
  authService: AuthService,
  firestore: Firestore,
  router: Router
): Observable<boolean> {
  return authService.isLoggedIn$.pipe(
    take(1),
    switchMap(isLoggedIn => {
      if (!isLoggedIn) {
        router.navigate(['/login']);
        return of(false);
      }

      return authService.getCurrentFirebaseUser().pipe(
        take(1),
        switchMap(user => {
          if (!user?.uid) {
            router.navigate(['/login']);
            return of(false);
          }

          const uid = user.uid;
          const lenderRef = doc(firestore, 'lenders', uid);
          const originatorRef = doc(firestore, 'originators', uid);

          return combineLatest([
            from(getDoc(lenderRef)),
            from(getDoc(originatorRef))
          ]).pipe(
            map(([lenderSnap, originatorSnap]) => {
              const profile: any =
                lenderSnap.exists() ? lenderSnap.data() :
                originatorSnap.exists() ? originatorSnap.data() : null;

              if (profile?.subscriptionStatus === 'active' || profile?.paymentPending === false) {
                return true;
              }

              router.navigate(['/payment-pending']);
              return false;
            })
          );
        })
      );
    })
  );
}

function checkSubscriptionStatus(
  authService: AuthService,
  firestore: Firestore,
  router: Router
): Observable<boolean> {
  return authService.getCurrentFirebaseUser().pipe(
    take(1),
    switchMap(user => {
      if (!user?.uid) {
        router.navigate(['/login']);
        return of(false);
      }
      return from(checkUserSubscription(user.uid, firestore, router));
    })
  );
}

async function checkUserSubscription(
  uid: string,
  firestore: Firestore,
  router: Router
): Promise<boolean> {
  const collections = ['originators', 'lenders'];

  for (const collectionName of collections) {
    try {
      const ref = doc(firestore, `${collectionName}/${uid}`);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data: any = snap.data();
        const status = data?.subscriptionStatus;
        const registrationCompleted = data?.registrationCompleted;

        if (status === 'active' || status === 'grandfathered') return true;

        if (registrationCompleted === false) {
          router.navigate(['/complete-registration']);
          return false;
        }

        if (status === 'pending' || !status) {
          router.navigate(['/pricing']);
          return false;
        }

        if (status === 'cancelled' || status === 'past_due') {
          router.navigate(['/pricing']);
          return false;
        }

        // Default allow if none of the above matched
        return true;
      }
    } catch (err) {
      console.error(`Auth Guard: error checking ${collectionName}`, err);
    }
  }

  // If no document found, allow with warning (can be tightened later)
  console.warn('Auth Guard: user document not found; allowing access');
  return true;
}
