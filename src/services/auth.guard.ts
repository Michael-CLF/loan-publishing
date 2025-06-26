// ✅ FIXED: auth.guard.ts - Updated to handle Stripe callback flow
import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { Observable, from, of } from 'rxjs';
import { filter, map, take, switchMap, catchError, delay } from 'rxjs/operators';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Observable<boolean> => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const firestore = inject(Firestore);

  // ✅ CRITICAL: Don't block Stripe callback routes
  if (state.url.includes('/payment-callback')) {
    console.log('🔓 Auth guard allowing Stripe callback route');
    return of(true);
  }

  // ✅ Check if this is right after a payment (user might be in transition)
  const isPostPayment = localStorage.getItem('showRegistrationModal') === 'true';
  
  if (isPostPayment) {
    console.log('💳 Post-payment flow detected, allowing dashboard access with delay');
    // ✅ Give Stripe callback time to update subscription status
    return of(true).pipe(
      delay(2000), // 2 second delay
      switchMap(() => {
        // ✅ Now check normally but be more lenient
        return performLenientAuthCheck(authService, firestore, router, state.url);
      })
    );
  }

  // ✅ Store the attempted URL for redirecting
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

/**
 * ✅ NEW: Lenient auth check for post-payment flows
 */
function performLenientAuthCheck(
  authService: AuthService,
  firestore: Firestore,
  router: Router,
  attemptedUrl: string
): Observable<boolean> {
  
  return authService.isLoggedIn$.pipe(
    take(1),
    switchMap(isLoggedIn => {
      if (!isLoggedIn) {
        console.log('🔒 User not logged in during lenient check, redirecting to login');
        router.navigate(['/login']);
        return of(false);
      }
      
      return authService.getCurrentUser().pipe(
        take(1),
        switchMap(user => {
          if (!user?.uid) {
            router.navigate(['/login']);
            return of(false);
          }

          // ✅ For post-payment, be more lenient with subscription checks
          return from(checkUserSubscriptionLenient(user.uid, firestore, router));
        })
      );
    })
  );
}

/**
 * ✅ NEW: More lenient subscription check that allows pending payments
 */
async function checkUserSubscriptionLenient(
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
        
        console.log('🔍 Lenient subscription check:', {
          subscriptionStatus,
          registrationCompleted,
          paymentPending,
          collection
        });
        
        // ✅ Allow active subscriptions
        if (subscriptionStatus === 'active') {
          console.log('✅ Access granted - active subscription');
          return true;
        }
        
        // ✅ LENIENT: Allow pending if payment was just made
        if (subscriptionStatus === 'pending' && localStorage.getItem('showRegistrationModal') === 'true') {
          console.log('✅ Access granted - payment just completed (pending status OK)');
          return true;
        }
        
        // ✅ Check registration completion
        if (registrationCompleted === false) {
          console.log('🔒 Blocking access - registration not completed');
          router.navigate(['/complete-registration']);
          return false;
        }
        
        // ✅ Check for missing subscription (but be lenient during payment flow)
        if (!subscriptionStatus && !localStorage.getItem('showRegistrationModal')) {
          console.log('🔒 Blocking access - no subscription');
          router.navigate(['/pricing']);
          return false;
        }
        
        // ✅ Handle cancelled/past due subscriptions
        if (subscriptionStatus === 'cancelled' || subscriptionStatus === 'past_due') {
          console.log('🔒 Blocking access - subscription issues');
          router.navigate(['/pricing']);
          return false;
        }
        
        // ✅ Default allow during payment transition
        console.log('✅ Access granted - payment transition period');
        return true;
      }
    } catch (error) {
      console.error(`Error checking user in ${collection}:`, error);
    }
  }
  
  // ✅ User document not found - allow access with warning
  console.warn('⚠️ User document not found in Firestore, allowing access');
  return true;
}

/**
 * ✅ UPDATED: Original function with better error handling
 */
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

/**
 * ✅ UPDATED: Original subscription check function
 */
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
        
        console.log('🔍 Subscription check:', {
          subscriptionStatus,
          registrationCompleted,
          collection
        });
        
        // ✅ Active subscription grants access
        if (subscriptionStatus === 'active') {
          console.log('✅ Access granted - active subscription');
          return true;
        }
        
        // ✅ Check registration completion
        if (registrationCompleted === false) {
          console.log('🔒 Blocking access - registration not completed');
          router.navigate(['/complete-registration']);
          return false;
        }
        
        // ✅ Check for pending or missing subscription
        if (subscriptionStatus === 'pending' || !subscriptionStatus) {
          console.log('🔒 Blocking access - subscription pending or missing');
          router.navigate(['/pricing']);
          return false;
        }
        
        // ✅ Handle cancelled/past due subscriptions
        if (subscriptionStatus === 'cancelled' || subscriptionStatus === 'past_due') {
          console.log('🔒 Blocking access - subscription issues');
          router.navigate(['/pricing']);
          return false;
        }
        
        // ✅ Default allow if we reach here
        return true;
      }
    } catch (error) {
      console.error(`Error checking user in ${collection}:`, error);
    }
  }
  
  // ✅ User document not found - allow access with warning
  console.warn('⚠️ User document not found in Firestore, allowing access');
  return true;
}