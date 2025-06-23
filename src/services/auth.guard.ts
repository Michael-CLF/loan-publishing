import { Injectable, inject } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { Observable, of } from 'rxjs';
import { filter, map, take, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  private router = inject(Router);
  private authService = inject(AuthService);
  private firestore = inject(Firestore); // ADD THIS

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    // Store the attempted URL for redirecting
    localStorage.setItem('redirectUrl', state.url);

    // First check if user is already on the dashboard
    if (state.url === '/dashboard') {
      // Get the current URL from the router
      const currentUrl = this.router.url;

      // If we're already on the dashboard, don't trigger auth checks
      // This helps prevent the login flash when refreshing the dashboard
      if (currentUrl === '/dashboard') {
        // Skip the full auth check, assume valid (the full check will happen in app.component)
        return this.authService.isLoggedIn$.pipe(
          take(1),
          map((isLoggedIn) => {
            // Only redirect if we're sure the user is not logged in
            if (!isLoggedIn) {
              // Double check localStorage as a backup
              if (localStorage.getItem('isLoggedIn') !== 'true') {
                this.router.navigate(['/login']);
                return false;
              }
            }
            return true;
          })
        );
      }
    }

    // Normal auth check for all other routes
    return this.authService.authReady$.pipe(
      // Wait for auth to be ready
      filter((ready) => ready),
      take(1),
      // Then check if user is logged in
      switchMap(() => this.authService.isLoggedIn$),
      take(1),
      // ADD SUBSCRIPTION CHECK
      switchMap((isLoggedIn) => {
        if (!isLoggedIn) {
          // If user is not logged in, redirect to login
          this.router.navigate(['/login']);
          return of(false);
        }
        
        // User is logged in, now check subscription status
        return this.checkUserSubscriptionStatus();
      })
    );
  }

  // ADD THIS METHOD
  private checkUserSubscriptionStatus(): Observable<boolean> {
    return this.authService.getCurrentUser().pipe(
      take(1),
      switchMap(async (user) => {
        if (!user || !user.uid) {
          this.router.navigate(['/login']);
          return false;
        }

        // Check both collections for the user
        const collections = ['originators', 'lenders'];
        
        for (const collection of collections) {
          const userRef = doc(this.firestore, `${collection}/${user.uid}`);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            
            // Check if user has completed registration and payment
            if (userData['subscriptionStatus'] === 'pending' || 
                userData['registrationCompleted'] === false) {
              
              console.log('User has pending subscription, redirecting to complete payment');
              
              // Create checkout session and redirect
              // Note: You might want to store the user data and redirect to a payment page
              // For now, we'll just prevent access
              alert('Please complete your subscription payment to access this area.');
              this.router.navigate(['/pricing']);
              return false;
            }
            
            // User has active subscription
            return true;
          }
        }
        
        // User document not found in either collection
        console.error('User document not found in any collection');
        return true; // Allow access but user might need to complete profile
      })
    );
  }
}