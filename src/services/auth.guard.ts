import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { Observable, from, of } from 'rxjs';
import { filter, map, take, switchMap, catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Observable<boolean> => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const firestore = inject(Firestore);

  // Store the attempted URL for redirecting
  localStorage.setItem('redirectUrl', state.url);

  return authService.authReady$.pipe(
    filter(ready => ready),
    take(1),
    switchMap(() => authService.isLoggedIn$),
    take(1),
    switchMap(isLoggedIn => {
      if (!isLoggedIn) {
        router.navigate(['/login']);
        return of(false);
      }
      
      return checkSubscriptionStatus(authService, firestore, router);
    }),
    catchError(error => {
      console.error('Auth guard error:', error);
      router.navigate(['/login']);
      return of(false);
    })
  );
};

function checkSubscriptionStatus(
  authService: AuthService, 
  firestore: Firestore, 
  router: Router
): Observable<boolean> {
  return authService.getCurrentUser().pipe(
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
  
  for (const collection of collections) {
    try {
      const userRef = doc(firestore, `${collection}/${uid}`);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        
        const subscriptionStatus = userData['subscriptionStatus'];
        const registrationCompleted = userData['registrationCompleted'];
        const paymentPending = userData['paymentPending'];
        
        console.log('Subscription check:', {
          subscriptionStatus,
          registrationCompleted,
          paymentPending,
          collection
        });
        
        // FIXED LOGIC: Active subscription grants access regardless of other flags
        if (subscriptionStatus === 'active') {
          console.log('Access granted - active subscription');
          return true;
        }
        
        // Check registration completion
        if (registrationCompleted === false) {
          console.log('Blocking access - registration not completed');
          router.navigate(['/complete-registration']);
          return false;
        }
        
        // Check for pending or missing subscription
        if (subscriptionStatus === 'pending' || !subscriptionStatus) {
          console.log('Blocking access - subscription pending or missing');
          router.navigate(['/pricing']);
          return false;
        }
        
        // Handle cancelled/past due subscriptions
        if (subscriptionStatus === 'cancelled' || subscriptionStatus === 'past_due') {
          console.log('Blocking access - subscription issues');
          router.navigate(['/pricing']);
          return false;
        }
        
        // Default allow if we reach here
        return true;
      }
    } catch (error) {
      console.error(`Error checking user in ${collection}:`, error);
    }
  }
  
  // User document not found - allow access with warning
  console.warn('User document not found in Firestore, allowing access');
  return true;
}