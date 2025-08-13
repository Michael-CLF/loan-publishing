// ✅ Auth Guard — UID-first, Stripe-friendly
import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, of, from, combineLatest } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { User } from '@angular/fire/auth';
import { AuthService } from './auth.service';
import { FirestoreService } from './firestore.service';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Observable<boolean> | Promise<boolean> => {

  const url = state.url || '';
  
  // Allow Firebase auth action handler to work without interference
  const isFirebaseAuthAction = url.includes('/__/auth/action');
  if (isFirebaseAuthAction) {
    // Firebase will handle this URL directly - no guard needed
    return of(true);
  }
  
  // Allow ALL registration-processing routes
  // This page handles its own authentication flow and polling
  const isRegProcessing = url.includes('/registration-processing');
  if (isRegProcessing) {
    // Let the component handle all states:
    // - Magic link returns (ml=1)
    // - Payment success/cancel
    // - Account setup polling for new users
    return of(true);
  }
  const router = inject(Router);
  const auth = inject(AuthService);
  const fsService = inject(FirestoreService);
  const firestore: Firestore = fsService.firestore;

  return auth.getCurrentFirebaseUser().pipe(
    switchMap((user: User | null) => {
      // If not authenticated, send to login
      if (!user?.uid) {
        localStorage.setItem('redirectUrl', url);
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

          // Active/grandfathered users can access everything
          if (status === 'active' || status === 'grandfathered') {
            return true;
          }

          // Inactive subscription - send to pricing
          if (status === 'inactive' || !status) {
            router.navigate(['/pricing']);
            return false;
          }

          // Handle other statuses (trial, cancelled, etc.) if needed
          if (status === 'trial') {
            // Allow trial users for now
            return true;
          }

          // Default: deny access for unknown statuses
          router.navigate(['/pricing']);
          return false;
        })
      );
    })
  );
};