// user.service.ts
import { Injectable, inject } from '@angular/core';
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

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  updateUser(
  userId: string,
  userData: any,
  userRole: 'lender' | 'originator' | null
): Observable<void> {
  console.log('UserService: Updating user', userId, 'with role', userRole);
  // CHANGE THIS LINE:
  const collection = userRole === 'lender' ? 'lenders' : 'originators'; // Changed 'users' to 'originators'
  console.log('UserService: Using collection', collection);
  const userDocRef = doc(this.firestore, `${collection}/${userId}`);

  return from(
    updateDoc(userDocRef, {
      ...userData,
      updatedAt: serverTimestamp(), // Use serverTimestamp() instead of new Date()
    })
  ).pipe(
    catchError((error) => {
      console.error('UserService: Error updating user:', error);
      return throwError(() => error);
    })
  );
}

 deleteUserWithRole(userId: string, userRole: 'lender' | 'originator' | null): Observable<void> {
  const collection = userRole === 'lender' ? 'lenders' : 'originators';
  const userDocRef = doc(this.firestore, `${collection}/${userId}`);
  return from(deleteDoc(userDocRef));
}

  // Initiate the email change flow
  initiateEmailChange(
    currentEmail: string,
    newEmail: string,
    password: string
  ): Observable<void> {
    const user = this.auth.currentUser;

    if (!user) {
      return throwError(() => new Error('User not authenticated'));
    }

    // First, reauthenticate the user for security
    const credential = EmailAuthProvider.credential(currentEmail, password);

    return from(reauthenticateWithCredential(user, credential)).pipe(
      switchMap(() => {
        // Store the new email in a temporary field for later verification
        const userDocRef = doc(this.firestore, `users/${user.uid}`);
        return from(
          updateDoc(userDocRef, {
            pendingEmail: newEmail,
            emailChangeRequestedAt: new Date(),
          })
        );
      }),
      switchMap(() => {
        // Send verification email to the new address
        // Note: This is a simplification. In a real app, you'd need additional logic to handle
        // custom email templates and verification links
        return this.sendEmailChangeVerification(user, newEmail);
      }),
      catchError((error) => {
        console.error('Email change initiation error:', error);
        return throwError(() => error);
      })
    );
  }

  // Send verification email for email change
  private sendEmailChangeVerification(
    user: User,
    newEmail: string
  ): Observable<void> {
    // In a real implementation, you would:
    // 1. Generate a secure token
    // 2. Store it in your database
    // 3. Create a custom verification URL
    // 4. Send an email with the verification link

    // For this example, we'll use Firebase's built-in verification,
    // but in a real app, you'd want more control over this process

    // This is a simplified version - actual implementation would need additional logic
    const actionCodeSettings = {
      url: `${
        window.location.origin
      }/verify-email-change?newEmail=${encodeURIComponent(newEmail)}`,
      handleCodeInApp: true,
    };

    return from(sendEmailVerification(user, actionCodeSettings)).pipe(
      catchError((error) => {
        console.error('Verification email error:', error);
        return throwError(() => error);
      })
    );
  }

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
      // Change this line:
      const userDocRef = doc(this.firestore, `originators/${userId}`); // Changed from 'users' to 'originators'
      return from(
        updateDoc(userDocRef, {
          email: newEmail,
          pendingEmail: null,
          emailChangeVerifiedAt: serverTimestamp(), // Use serverTimestamp instead of new Date
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