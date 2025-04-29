import { Injectable } from '@angular/core';
import {
  AbstractControl,
  AsyncValidator,
  ValidationErrors,
} from '@angular/forms';
import {
  Observable,
  of,
  map,
  catchError,
  debounceTime,
  switchMap,
  take,
} from 'rxjs';
import { FirestoreService } from './firestore.service';
import { where } from '@angular/fire/firestore';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Auth, authState } from '@angular/fire/auth';

@Injectable({
  providedIn: 'root',
})
export class EmailExistsValidator implements AsyncValidator {
  constructor(private firestoreService: FirestoreService) {}

  validate(control: AbstractControl): Observable<ValidationErrors | null> {
    return this.checkEmailExists(control.value);
  }

  private checkEmailExists(email: string): Observable<ValidationErrors | null> {
    if (!email) {
      return of(null);
    }

    return of(email).pipe(
      debounceTime(500),
      switchMap((emailToCheck) => {
        // First check the lenders collection
        return this.firestoreService
          .queryCollection(
            'lenders',
            where('contactInfo.contactEmail', '==', emailToCheck.toLowerCase())
          )
          .pipe(
            map((results) => results.length > 0),
            catchError(() => of(false))
          );
      }),
      map((exists) => (exists ? { emailExists: true } : null)),
      catchError(() => of(null))
    );
  }
}

// Modern functional route guard for Angular 18
export const AuthGuard = () => {
  const router = inject(Router);
  const authService = inject(AuthService);

  return authService.isLoggedIn$.pipe(
    take(1),
    map((isLoggedIn) => {
      if (isLoggedIn) {
        return true;
      }

      // Redirect to login page if not authenticated
      return router.createUrlTree(['/login']);
    })
  );
};
