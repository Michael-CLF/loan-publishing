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

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private firestore = inject(Firestore);

private get db() {
  return this.firestore;
}


  private auth = inject(Auth);
  private http = inject(HttpClient);

  private readonly registerUserUrl = `${environment.apiUrl}/registerUser`;

  registerUserBackend(userData: any): Observable<any> {
  return this.http.post(this.registerUserUrl, userData).pipe(
    map((response: any) => {
      // ✅ Save user ID for status checking after payment
      if (response.success && response.uid) {
        localStorage.setItem('pendingUserId', response.uid);
        console.log('✅ Saved pending user ID:', response.uid);
      }
      return response;
    }),
    catchError((error) => {
      console.error('UserService: Error registering user via backend:', error);
      return throwError(() => error);
    })
  );
}
getUserProfileByUid(uid: string): Observable<any | null> {
  const lenderRef = doc(this.db, `lenders/${uid}`);
  const originatorRef = doc(this.db, `originators/${uid}`);

  return from(getDoc(lenderRef)).pipe(
    switchMap(lenderSnap => {
      if (lenderSnap.exists()) return of({ id: uid, ...lenderSnap.data() });
      return from(getDoc(originatorRef)).pipe(
        map(originatorSnap => originatorSnap.exists() ? { id: uid, ...originatorSnap.data() } : null)
      );
    }),
    catchError(error => {
      console.error('❌ Error fetching user profile by UID:', error);
      return of(null);
    })
  );
}

checkUserByEmail(email: string): Observable<any | null> {
  const collections = ['lenders', 'originators'];
  const normalizedEmail = email.toLowerCase().trim();

  return from(Promise.all(collections.map(async (collectionName) => {
    // Check both possible email locations
    const emailQuery = await getDocs(
      query(
        collection(this.db, collectionName),
        where('email', '==', normalizedEmail)
      )
    );
    
    if (!emailQuery.empty) {
      return { data: emailQuery.docs[0].data(), id: emailQuery.docs[0].id };
    }
    
    // Also check contactInfo.contactEmail
    const contactEmailQuery = await getDocs(
      query(
        collection(this.db, collectionName),
        where('contactInfo.contactEmail', '==', normalizedEmail)
      )
    );
    
    return contactEmailQuery.empty ? null : { data: contactEmailQuery.docs[0].data(), id: contactEmailQuery.docs[0].id };
  }))).pipe(
    map(results => results.find(result => result !== null) || null),
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
