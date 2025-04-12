import { Injectable, inject, NgZone } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  collectionData,
  docData,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  DocumentReference,
  DocumentData,
} from '@angular/fire/firestore';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class FirestoreService {
  private firestore: Firestore = inject(Firestore);
  private ngZone = inject(NgZone); // Inject NgZone for Firebase operations

  // Get a collection with optional query constraints
  getCollection<T extends DocumentData>(
    path: string
  ): Observable<Array<T & { id: string }>> {
    return this.ngZone.run(() => {
      console.log('Getting collection:', path);
      const collectionRef = collection(this.firestore, path);
      return collectionData(collectionRef, { idField: 'id' }) as Observable<
        Array<T & { id: string }>
      >;
    });
  }

  // Get a single document
  getDocument<T extends DocumentData>(
    path: string
  ): Observable<(T & { id: string }) | null> {
    return this.ngZone.run(() => {
      console.log('Getting document:', path);
      const docRef = doc(this.firestore, path);
      return docData(docRef, { idField: 'id' }).pipe(
        map((data) => (data ? (data as T & { id: string }) : null)),
        catchError((error) => {
          console.error('Error getting document:', error);
          return of(null); // Return null instead of throwing to prevent UI crashes
        })
      );
    });
  }

  // Add a document to a collection
  addDocument(path: string, data: any): Promise<DocumentReference> {
    return this.ngZone.run(() => {
      console.log('Adding document to:', path);
      const collectionRef = collection(this.firestore, path);
      return addDoc(collectionRef, data);
    });
  }

  // Update a document
  updateDocument(path: string, data: any): Promise<void> {
    return this.ngZone.run(() => {
      console.log('Updating document:', path);
      const docRef = doc(this.firestore, path);
      return updateDoc(docRef, data);
    });
  }

  // Delete a document
  deleteDocument(path: string): Promise<void> {
    return this.ngZone.run(() => {
      console.log('Deleting document:', path);
      const docRef = doc(this.firestore, path);
      return deleteDoc(docRef);
    });
  }

  // Query a collection
  queryCollection<T>(path: string, queryFn: any[]): Observable<T[]> {
    return this.ngZone.run(() => {
      console.log('Querying collection:', path);
      const collectionRef = collection(this.firestore, path);
      const queryRef = query(collectionRef, ...queryFn);
      return collectionData(queryRef, { idField: 'id' }) as Observable<T[]>;
    });
  }
}
