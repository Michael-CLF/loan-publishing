// user.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Firestore, doc, collection, updateDoc, deleteDoc, getDoc, where, query, getDocs, serverTimestamp } from '@angular/fire/firestore';
import {
  Auth,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
  updateEmail,
  User,
} from '@angular/fire/auth';
import { Observable, from, throwError, switchMap, of, map } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { AuthService } from './auth.service';
import { firstValueFrom } from 'rxjs';

export interface RegistrationData {
  email: string;
  role: 'originator' | 'lender';
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  state: string;
  company?: string;
  contactInfo?: any;
  lenderData?: any;
  promotionCode?: string;
  interval?: 'monthly' | 'annually';
}

export interface RegistrationResponse {
  success: boolean;
  message: string;
  userId?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private firestore = inject(Firestore);
  private functions = inject(Functions); 
  private authService = inject(AuthService);
  private get db() {
  return this.firestore;
}

/**
 * Registers user via createPendingUser Cloud Function
 * Sends locked billing interval and normalized promo metadata
 */
registerUser(
  userData: RegistrationData,
  validatedPromo: any | null // PromotionValidationResponse from PromotionService.validatePromotionCode()
): Observable<any> {
  const createPendingUserCallable = httpsCallable(
    this.functions,
    'createPendingUser'
  );

  // Extract promo info safely
  const promoValid = validatedPromo?.valid === true && validatedPromo?.promo;

  const promoPayload = promoValid
    ? {
        promotionCodeStatus: 'validated',
        promotionCodeType: validatedPromo.promo.promoType || 'none',
        promotionCodeTerms: {
          percentOff: validatedPromo.promo.percentOff ?? null,
          durationInMonths: validatedPromo.promo.durationInMonths ?? null,
          durationType: validatedPromo.promo.durationType ?? null,
          trialDays: validatedPromo.promo.trialDays ?? null,
          onboardingFeeCents: validatedPromo.promo.onboardingFeeCents ?? null,
          promoExpiresAt: validatedPromo.promo.promoExpiresAt ?? null,
        },
        promoInternalId: validatedPromo.promo.promoInternalId ?? null,
      }
    : {
        promotionCodeStatus: userData.promotionCode ? 'invalid' : 'none',
        promotionCodeType: 'none',
        promotionCodeTerms: {
          percentOff: null,
          durationInMonths: null,
          durationType: null,
          trialDays: null,
          onboardingFeeCents: null,
          promoExpiresAt: null,
        },
        promoInternalId: null,
      };

    const payload = {
    email: userData.email,
    role: userData.role,
    firstName: userData.firstName,
    lastName: userData.lastName,
    phone: userData.phone,
    city: userData.city,
    state: userData.state,
    company: userData.company || '',
    interval: userData.interval || 'monthly',

    // what they typed
    promotionCode: userData.promotionCode || null,

    // normalized promo metadata
    promotionCodeApplied: promoValid === true,
    promotionCodeStatus: promoPayload.promotionCodeStatus,
    promotionCodeType: promoPayload.promotionCodeType,
    promotionCodeTerms: promoPayload.promotionCodeTerms,
    promoInternalId: promoPayload.promoInternalId,
  };


  
return from(createPendingUserCallable(payload)).pipe(
  switchMap(async (result: any) => {
    const data = result.data;
    if (data?.success && data?.customToken) {
      console.log('✅ Minted custom token, signing in before Stripe...');
      await firstValueFrom(this.authService.signInWithCustomToken(data.customToken));
      console.log('✅ Firebase Auth session established, UID:', this.authService.currentUserUid);
    } else {
      console.warn('⚠️ No custom token returned from createPendingUser');
    }
    return data;
  }),
  catchError((error) => {
    console.error('❌ Registration error:', error);
    throw error;
  })
);
}
  /**
   * Persist a validated promotion on the pending user document.
   * Backend checks these keys before honoring promotion_code at checkout.
   */
  async applyPromoToPendingUser(
    userId: string,
    role: 'lender' | 'originator',
    validatedPromo: {
      code: string;
      promoInternalId: string;
      promoType: 'percentage' | 'trial';
      percentOff?: number | null;
      durationType?: 'once' | 'repeating' | 'forever' | null;
      durationInMonths?: number | null;
      trialDays?: number | null;
      onboardingFeeCents?: number | null;
      promoExpiresAt?: string | null;
    }
  ): Promise<void> {
    const coll = role === 'lender' ? 'lenders' : 'originators';
    const ref = doc(this.db, `${coll}/${userId}`);

    const terms: any = {
      percentOff: validatedPromo.percentOff ?? null,
      durationInMonths: validatedPromo.durationInMonths ?? null,
      durationType: validatedPromo.durationType ?? null,
      trialDays: validatedPromo.trialDays ?? null,
      onboardingFeeCents: validatedPromo.onboardingFeeCents ?? null,
      promoExpiresAt: validatedPromo.promoExpiresAt ?? null,
    };

    await updateDoc(ref, {
      promotionCodeRequested: validatedPromo.code,
      promotionCodeApplied: true,
      promotionCodeStatus: 'validated',
      promotionCodeType: validatedPromo.promoType,
      promotionCodeTerms: terms,
      promoInternalId: validatedPromo.promoInternalId,
      updatedAt: serverTimestamp(),
    });
  }


  private auth = inject(Auth);
  private http = inject(HttpClient);

  private readonly registerUserUrl = `${environment.apiUrl}/registerUser`;

getUserProfileByUid(uid: string): Observable<any | null> {
  const userRef = doc(this.db, `users/${uid}`);
  
  return from(getDoc(userRef)).pipe(
    map(snapshot => snapshot.exists() ? { id: uid, ...snapshot.data() } : null),
    catchError(error => {
      console.error('❌ Error fetching user profile:', error);
      return of(null);
    })
  );
}

checkUserByEmail(email: string): Observable<any | null> {
  const normalizedEmail = email.toLowerCase().trim();
  const usersRef = collection(this.db, 'users');
  
  const emailQuery = query(
    usersRef,
    where('email', '==', normalizedEmail)
  );

  return from(getDocs(emailQuery)).pipe(
    map(snapshot => {
      if (snapshot.empty) return null;
      return { data: snapshot.docs[0].data(), id: snapshot.docs[0].id };
    }),
    catchError(error => {
      console.error('❌ Error checking user by email:', error);
      return of(null);
    })
  );
}
  /**
   * 🔁 Updates existing Firestore user document
   */
  updateUser(
    userId: string,
    userData: any,
    userRole: 'lender' | 'originator' | null
  ): Observable<void> {
    const collection = userRole === 'lender' ? 'lenders' : 'originators';
    const userDocRef = doc(this.db, `${collection}/${userId}`);

    return from(
      updateDoc(userDocRef, {
        ...userData,
        updatedAt: serverTimestamp(),
      })
    ).pipe(
      catchError((error) => {
        console.error('UserService: Error updating user:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * 🗑️ Deletes user document from Firestore
   */
  deleteUserWithRole(userId: string, userRole: 'lender' | 'originator' | null): Observable<void> {
    const collection = userRole === 'lender' ? 'lenders' : 'originators';
    const userDocRef = doc(this.db, `${collection}/${userId}`);
    return from(deleteDoc(userDocRef));
  }

  /**
   * 🔐 Initiates secure email change flow
   */
  initiateEmailChange(
    currentEmail: string,
    newEmail: string,
    password: string
  ): Observable<void> {
    const user = this.auth.currentUser;

    if (!user) {
      return throwError(() => new Error('User not authenticated'));
    }

    const credential = EmailAuthProvider.credential(currentEmail, password);

    return from(reauthenticateWithCredential(user, credential)).pipe(
      switchMap(() => {
        const userDocRef = doc(this.firestore, `users/${user.uid}`);
        return from(
          updateDoc(userDocRef, {
            pendingEmail: newEmail,
            emailChangeRequestedAt: new Date(),
          })
        );
      }),
      switchMap(() => this.sendEmailChangeVerification(user, newEmail)),
      catchError((error) => {
        console.error('Email change initiation error:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * 📧 Sends verification email to new address
   */
  private sendEmailChangeVerification(
    user: User,
    newEmail: string
  ): Observable<void> {
    const actionCodeSettings = {
      url: `${window.location.origin}/verify-email-change?newEmail=${encodeURIComponent(newEmail)}`,
      handleCodeInApp: true,
    };

    return from(sendEmailVerification(user, actionCodeSettings)).pipe(
      catchError((error) => {
        console.error('Verification email error:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * ✅ Completes email change after verification
   */
  completeEmailChange(
    userId: string,
    newEmail: string,
    verificationCode: string
  ): Observable<void> {
    const user = this.auth.currentUser;

    if (!user) {
      return throwError(() => new Error('User not authenticated'));
    }

    return from(updateEmail(user, newEmail)).pipe(
      switchMap(() => {
        const userDocRef = doc(this.firestore, `originators/${userId}`);
        return from(
          updateDoc(userDocRef, {
            email: newEmail,
            pendingEmail: null,
            emailChangeVerifiedAt: serverTimestamp(),
          })
        );
      }),
      catchError((error) => {
        console.error('Email change completion error:', error);
        return throwError(() => error);
      })
    );
  }
}
