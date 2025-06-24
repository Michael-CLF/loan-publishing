import { Injectable, inject } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { Observable, from } from 'rxjs';
import { filter, map, take, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  private router = inject(Router);
  private authService = inject(AuthService);
  private firestore = inject(Firestore);

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    // Store the attempted URL for redirecting
    localStorage.setItem('redirectUrl', state.url);

    return this.authService.authReady$.pipe(
      filter((ready) => ready),
      take(1),
      switchMap(() => this.authService.isLoggedIn$),
      take(1),
      switchMap((isLoggedIn) => {
        if (!isLoggedIn) {
          this.router.navigate(['/login']);
          return from(Promise.resolve(false));
        }
        
        // User is logged in, check subscription status
        return this.checkSubscriptionStatus();
      })
    );
  }

  private checkSubscriptionStatus(): Observable<boolean> {
    return this.authService.getCurrentUser().pipe(
      take(1),
      switchMap((user) => {
        if (!user || !user.uid) {
          this.router.navigate(['/login']);
          return from(Promise.resolve(false));
        }

        return from(this.checkUserInFirestore(user.uid));
      })
    );
  }

  private async checkUserInFirestore(uid: string): Promise<boolean> {
    const collections = ['originators', 'lenders'];
    
    for (const collection of collections) {
      const userRef = doc(this.firestore, `${collection}/${uid}`);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        
        // Check subscription status
        const subscriptionStatus = userData['subscriptionStatus'];
        const registrationCompleted = userData['registrationCompleted'];
        const paymentPending = userData['paymentPending'];
        
        console.log('Subscription check:', {
          subscriptionStatus,
          registrationCompleted,
          paymentPending
        });
        
        // Block access if subscription is not active
        if (subscriptionStatus === 'pending' || 
            registrationCompleted === false ||
            paymentPending === true ||
            subscriptionStatus !== 'active') {
          
          console.log('Blocking access - subscription not active');
          this.router.navigate(['/pricing']);
          return false;
        }
        
        // User has active subscription
        console.log('Access granted - active subscription');
        return true;
      }
    }
    
    // User document not found - allow access with warning
    console.warn('User document not found in Firestore');
    return true;
  }
}