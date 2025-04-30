import {
  Injectable,
  inject,
  Injector,
  runInInjectionContext,
} from '@angular/core';
import {
  AbstractControl,
  AsyncValidator,
  ValidationErrors,
} from '@angular/forms';
import { Observable, of } from 'rxjs';
import { map, debounceTime, switchMap } from 'rxjs/operators';
import { FirestoreService } from './firestore.service';

@Injectable({
  providedIn: 'root',
})
export class EmailExistsValidator implements AsyncValidator {
  private firestoreService = inject(FirestoreService);
  private injector = inject(Injector);

  validate(control: AbstractControl): Observable<ValidationErrors | null> {
    return runInInjectionContext(this.injector, () => {
      return this.checkEmailExists(control.value);
    });
  }

  private checkEmailExists(email: string): Observable<ValidationErrors | null> {
    if (!email) {
      return of(null);
    }

    return of(email).pipe(
      debounceTime(500),
      switchMap((emailToCheck) =>
        runInInjectionContext(this.injector, () => {
          return this.firestoreService.checkIfEmailExists(
            emailToCheck.toLowerCase()
          );
        })
      ),
      map((exists) => (exists ? { emailExists: true } : null))
    );
  }
}
