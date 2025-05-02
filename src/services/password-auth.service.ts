import { Injectable, inject } from '@angular/core';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from '@angular/fire/auth';
import { Observable, from, throwError, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root',
})
export class PasswordAuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);

  registerUser(
    email: string,
    password: string,
    additionalData: any = {}
  ): Observable<any> {
    console.log('Starting user registration process:', {
      email,
      ...additionalData,
    });

    // Always use lowercase email for consistency
    const normalizedEmail = email.toLowerCase();

    return from(
      createUserWithEmailAndPassword(this.auth, normalizedEmail, password)
    ).pipe(
      switchMap((userCredential) => {
        const user = userCredential.user;

        // 1. Save user data to the main users collection first
        const userData = {
          email: normalizedEmail,
          firstName: additionalData.firstName || '',
          lastName: additionalData.lastName || '',
          company: additionalData.company || '',
          phone: additionalData.phone || '',
          city: additionalData.city || '',
          state: additionalData.state || '',
          role: additionalData.role || 'originator',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Create/update user document in the main users collection
        return from(
          setDoc(doc(this.firestore, `users/${user.uid}`), userData)
        ).pipe(
          switchMap(() => {
            // 2. For originators, also save to a dedicated originators collection
            if (additionalData.role === 'originator') {
              console.log(
                'Saving originator-specific data for user:',
                user.uid
              );

              // Save to originators collection with the SAME structure as lenders
              const originatorData = {
                userId: user.uid,
                contactInfo: {
                  firstName: additionalData.firstName || '',
                  lastName: additionalData.lastName || '',
                  contactEmail: normalizedEmail, // Store email in contactEmail field
                  contactPhone: additionalData.phone || '',
                  company: additionalData.company || '',
                  city: additionalData.city || '',
                  state: additionalData.state || '',
                },
                createdAt: new Date(),
                updatedAt: new Date(),
                role: 'originator',
              };

              // Create a new originators collection with same structure as lenders
              return from(
                setDoc(
                  doc(this.firestore, `originators/${user.uid}`),
                  originatorData
                )
              );
            }

            // If not an originator, just return the user
            return of(user);
          }),
          switchMap(() => of(user)) // Return the user after all operations
        );
      }),
      catchError((error) => {
        console.error('Error during user registration:', error);
        return throwError(() => error);
      })
    );
  }

  login(email: string, password: string): Observable<boolean> {
    return from(signInWithEmailAndPassword(this.auth, email, password)).pipe(
      switchMap(() => of(true)),
      catchError((error) => {
        console.error('Login error:', error);
        return of(false);
      })
    );
  }

  logout(): Observable<void> {
    return from(signOut(this.auth)).pipe(
      catchError((error) => {
        console.error('Logout error:', error);
        return of(undefined);
      })
    );
  }
}
