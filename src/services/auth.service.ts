import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { switchMap, tap, catchError } from 'rxjs/operators';
import {
  Auth,
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  authState,
} from '@angular/fire/auth';
import { FirestoreService } from './firestore.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private auth = inject(Auth);
  private firestoreService = inject(FirestoreService);

  private isLoggedInSubject = new BehaviorSubject<boolean>(false);
  public isLoggedIn$ = this.isLoggedInSubject.asObservable();

  // User data observable
  private userSubject = new BehaviorSubject<User | null>(null);
  public user$ = this.userSubject.asObservable();

  constructor() {
    // Subscribe to Firebase auth state changes
    authState(this.auth).subscribe((user) => {
      this.userSubject.next(user);
      this.isLoggedInSubject.next(!!user);

      if (user) {
        localStorage.setItem('isLoggedIn', 'true');
      } else {
        localStorage.removeItem('isLoggedIn');
      }
    });
  }

  // Register a new user
  registerUser(
    email: string,
    password: string,
    userData: any
  ): Observable<User> {
    return from(
      createUserWithEmailAndPassword(this.auth, email, password)
    ).pipe(
      switchMap((userCredential) => {
        const user = userCredential.user;

        // Store additional user data in Firestore (NOT the password)
        return from(
          this.firestoreService.addDocument('users', {
            uid: user.uid,
            firstName: userData.firstName,
            lastName: userData.lastName,
            email: userData.email,
            company: userData.company,
            phone: userData.phone,
            city: userData.city,
            state: userData.state,
            createdAt: new Date(),
          })
        ).pipe(
          // Return the user object after saving to Firestore
          switchMap(() => of(user))
        );
      })
    );
  }

  // Login a user
  login(email: string, password: string): Observable<boolean> {
    return from(signInWithEmailAndPassword(this.auth, email, password)).pipe(
      // Map the user credential to a success boolean
      switchMap(() => of(true)),
      catchError((error) => {
        console.error('Login error:', error);
        return of(false);
      })
    );
  }

  // Logout the user
  logout(): Observable<void> {
    return from(signOut(this.auth)).pipe(
      tap(() => {
        localStorage.removeItem('isLoggedIn');
      })
    );
  }

  getAuthStatus(): Observable<boolean> {
    return this.isLoggedIn$;
  }

  // Get the current user
  getCurrentUser(): Observable<User | null> {
    return this.user$;
  }

  // Get user profile data from Firestore
  getUserProfile(uid: string): Observable<any> {
    return this.firestoreService.getDocument<any>(`users/${uid}`);
  }
}
