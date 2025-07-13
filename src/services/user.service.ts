// user.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Firestore, doc, updateDoc, deleteDoc, serverTimestamp } from '@angular/fire/firestore';
import {
  Auth,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
  updateEmail,
  User,
} from '@angular/fire/auth';
import { Observable, from, throwError, switchMap, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private http = inject(HttpClient);

  private readonly registerUserUrl = `${environment.apiUrl}/registerUser`;

  /**
   * ✅ Registers a new user by sending form data to backend Cloud Function
   */
  registerUserBackend(userData: any): Observable<any> {
    return this.http.post(this.registerUserUrl, userData).pipe(
      catchError((error) => {
        console.error('UserService: Error registering user via backend:', error);
        return throwError(() => error);
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
    const userDocRef = doc(this.firestore, `${collection}/${userId}`);

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
    const userDocRef = doc(this.firestore, `${collection}/${userId}`);
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
