import { Injectable } from '@angular/core';
import {
  AbstractControl,
  AsyncValidator,
  ValidationErrors,
} from '@angular/forms';
import { Observable, of } from 'rxjs';
import {
  map,
  tap,
  catchError,
  debounceTime,
  switchMap,
  first,
} from 'rxjs/operators';
import { FirestoreService } from './firestore.service'; // Adjust path as needed

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
      switchMap((emailToCheck) =>
        this.firestoreService.checkIfEmailExists(emailToCheck.toLowerCase())
      ),
      map((exists) => (exists ? { emailExists: true } : null)),
      catchError(() => of(null))
    );
  }
}
