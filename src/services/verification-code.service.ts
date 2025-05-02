// verification-code.service.ts
import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
} from '@angular/fire/firestore';
import { Observable, from, throwError, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class VerificationCodeService {
  private firestore = inject(Firestore);

  // Generate a random 6-digit code
  generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Store the code in Firestore with the user's email
  storeVerificationCode(email: string, userData: any): Observable<string> {
    const code = this.generateCode();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Code expires in 1 hour

    return from(
      setDoc(doc(this.firestore, 'verificationCodes', email), {
        code,
        email,
        userData,
        expiresAt,
        verified: false,
      })
    ).pipe(
      map(() => code),
      catchError((error) => {
        console.error('Error storing verification code:', error);
        return throwError(
          () => new Error('Failed to generate verification code')
        );
      })
    );
  }

  // Verify the code entered by the user
  verifyCode(email: string, code: string): Observable<any> {
    const docRef = doc(this.firestore, 'verificationCodes', email);

    return from(getDoc(docRef)).pipe(
      switchMap((snapshot) => {
        if (!snapshot.exists()) {
          return throwError(() => new Error('No verification code found'));
        }

        const data = snapshot.data();
        const expiresAt = data['expiresAt'].toDate();

        if (new Date() > expiresAt) {
          return throwError(() => new Error('Verification code has expired'));
        }

        if (data['code'] !== code) {
          return throwError(() => new Error('Invalid verification code'));
        }

        // Code is valid, mark as verified
        return from(updateDoc(docRef, { verified: true })).pipe(
          map(() => data['userData'])
        );
      }),
      catchError((error) => {
        console.error('Error verifying code:', error);
        return throwError(() => error);
      })
    );
  }

  // Check if a verification code exists for an email
  checkVerificationExists(email: string): Observable<boolean> {
    const docRef = doc(this.firestore, 'verificationCodes', email);

    return from(getDoc(docRef)).pipe(
      map((snapshot) => snapshot.exists()),
      catchError((error) => {
        console.error('Error checking verification:', error);
        return of(false);
      })
    );
  }

  // Delete a verification code
  deleteVerificationCode(email: string): Observable<void> {
    const docRef = doc(this.firestore, 'verificationCodes', email);

    return from(updateDoc(docRef, { deleted: true })).pipe(
      catchError((error) => {
        console.error('Error deleting verification code:', error);
        return throwError(() => error);
      })
    );
  }
}
