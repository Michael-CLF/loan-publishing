// Firstore servive TS
import {
  Injectable,
  inject,
  NgZone,
  DestroyRef,
  Injector,
  runInInjectionContext,
} from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  collectionData,
  docData,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  DocumentReference,
  DocumentData,
} from '@angular/fire/firestore';
import { Observable, from, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class FirestoreService {
  private firestore = inject(Firestore);
  private ngZone = inject(NgZone);
  private injector = inject(Injector);
  private destroyRef = inject(DestroyRef);

  getCollection<T extends DocumentData>(
    path: string
  ): Observable<Array<T & { id: string }>> {
    return this.ngZone.run(() => {
      console.log('Getting collection:', path);
      return runInInjectionContext(this.injector, () => {
        const collectionRef = collection(this.firestore, path);
        return collectionData(collectionRef, { idField: 'id' }) as Observable<
          Array<T & { id: string }>
        >;
      });
    });
  }

  getDocument<T extends DocumentData>(
    path: string
  ): Observable<(T & { id: string }) | null> {
    return this.ngZone.run(() => {
      console.log('Getting document:', path);
      return runInInjectionContext(this.injector, () => {
        const docRef = doc(this.firestore, path);
        return docData(docRef, { idField: 'id' }).pipe(
          map((data) => (data ? (data as T & { id: string }) : null)),
          catchError((error) => {
            console.error('Error getting document:', error);
            return of(null);
          })
        );
      });
    });
  }

  getDocumentWithLogging<T extends DocumentData>(
    path: string
  ): Observable<(T & { id: string }) | null> {
    return this.ngZone.run(() => {
      console.log('Getting document with detailed logging:', path);
      return runInInjectionContext(this.injector, () => {
        const docRef = doc(this.firestore, path);
        return docData(docRef, { idField: 'id' }).pipe(
          tap((data) => console.log('Raw document data received:', data)),
          map((data) => {
            if (data) {
              console.log('Document exists with data keys:', Object.keys(data));
              return data as T & { id: string };
            } else {
              console.log('Document does not exist at path:', path);
              return null;
            }
          }),
          catchError((error) => {
            console.error('Error getting document:', error);
            console.error('Error details:', error.code, error.message);
            return of(null);
          })
        );
      });
    });
  }

  addDocument(path: string, data: any): Promise<DocumentReference> {
    return this.ngZone.run(() => {
      console.log('Adding document to:', path);
      return runInInjectionContext(this.injector, () => {
        const collectionRef = collection(this.firestore, path);
        return addDoc(collectionRef, data);
      });
    });
  }

  setDocument(path: string, data: any): Promise<void> {
    return this.ngZone.run(() => {
      console.log('Setting document at:', path);
      return runInInjectionContext(this.injector, () => {
        const docRef = doc(this.firestore, path);
        return setDoc(docRef, data);
      });
    });
  }

  updateDocument(path: string, data: any): Promise<void> {
    return this.ngZone.run(() => {
      console.log('Updating document:', path);
      return runInInjectionContext(this.injector, () => {
        const docRef = doc(this.firestore, path);
        return updateDoc(docRef, data);
      });
    });
  }

  deleteDocument(path: string): Promise<void> {
    return this.ngZone.run(() => {
      console.log('Deleting document:', path);
      return runInInjectionContext(this.injector, () => {
        const docRef = doc(this.firestore, path);
        return deleteDoc(docRef);
      });
    });
  }

  queryCollection<T>(path: string, queryFn: any[]): Observable<T[]> {
    return this.ngZone.run(() => {
      console.log('Querying collection:', path);
      return runInInjectionContext(this.injector, () => {
        const collectionRef = collection(this.firestore, path);
        const queryRef = query(collectionRef, ...queryFn);
        return collectionData(queryRef, { idField: 'id' }) as Observable<T[]>;
      });
    });
  }
}
