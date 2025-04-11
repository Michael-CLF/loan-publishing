import { Injectable, inject } from '@angular/core';
import {
  Auth,
  ActionCodeSettings,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from '@angular/fire/auth';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../environments/environment';

const redirectUrl = environment.redirectUrl || 'default-url'; // fallback if not set

@Injectable({
  providedIn: 'root',
})
export class EmailAuthService {
  private auth = inject(Auth);
  private emailForSignInKey = 'emailForSignIn';
  private actionCodeSettings: ActionCodeSettings;

  constructor() {
    this.actionCodeSettings = {
      url: environment.redirectUrl,
      handleCodeInApp: true,
    };
  }

  sendSignInLink(email: string): Observable<boolean> {
    return from(
      sendSignInLinkToEmail(this.auth, email, this.actionCodeSettings)
    ).pipe(
      tap(() => {
        localStorage.setItem(this.emailForSignInKey, email);
      }),
      map(() => true),
      catchError((error) => {
        console.error('Error sending sign-in link:', error);
        return of(false);
      })
    );
  }

  signInWithEmailLink(email?: string): Observable<any> {
    const storedEmail = localStorage.getItem(this.emailForSignInKey);
    const emailToUse = email || storedEmail;

    if (
      !emailToUse ||
      !isSignInWithEmailLink(this.auth, window.location.href)
    ) {
      return of(null);
    }

    return from(
      signInWithEmailLink(this.auth, emailToUse, window.location.href)
    ).pipe(
      tap(() => {
        localStorage.removeItem(this.emailForSignInKey);
      }),
      map((userCredential) => userCredential.user),
      catchError((error) => {
        console.error('Error signing in with email link:', error);
        return of(null);
      })
    );
  }
}
