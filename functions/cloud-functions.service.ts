import {
  Injectable,
  inject,
  Injector,
  runInInjectionContext,
} from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Observable, from } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class CloudFunctionsService {
  private functions = inject(Functions);
  private injector = inject(Injector);

  getUserByEmail(email: string): Observable<any> {
    return from(
      runInInjectionContext(this.injector, () => {
        const callable = httpsCallable(this.functions, 'getUserByEmail');
        return callable({ email });
      })
    ).pipe(
      map((result) => result.data),
      catchError((error) => {
        console.error('Error fetching user by email:', error);
        throw error;
      })
    );
  }
}
