import { Injectable } from '@angular/core';
import {
  AbstractControl,
  AsyncValidator,
  ValidationErrors,
} from '@angular/forms';
import { Observable, of } from 'rxjs';
import {
  map,
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
    const email = control.value;

    if (!email) {
      return of(null);
    }

    return of(email).pipe(
      debounceTime(500), // Prevents checking on every keystroke
      switchMap((email) => this.firestoreService.checkIfEmailExists(email)),
      map((exists) => (exists ? { emailExists: true } : null)),
      first(),
      catchError(() => of(null))
    );
  }
}
