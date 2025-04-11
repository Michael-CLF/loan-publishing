import { Injectable, inject } from '@angular/core';
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
  where,
  orderBy,
  limit,
  DocumentReference,
  CollectionReference,
  DocumentData,
} from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';

interface WithId {
  id?: string;
}

@Injectable({
  providedIn: 'root',
})
export class FirestoreService {
  private firestore: Firestore = inject(Firestore);

  // Get a collection with optional query constraints
  getCollection<T extends DocumentData>(
    path: string
  ): Observable<Array<T & { id: string }>> {
    const collectionRef = collection(this.firestore, path);
    return collectionData(collectionRef, { idField: 'id' }) as Observable<
      Array<T & { id: string }>
    >;
  }

  // Get a single document
  getDocument<T extends DocumentData>(
    path: string
  ): Observable<(T & { id: string }) | null> {
    const docRef = doc(this.firestore, path);
    return docData(docRef, { idField: 'id' }).pipe(
      map((data) => (data ? (data as T & { id: string }) : null))
    );
  }
  // Add a document to a collection
  addDocument(path: string, data: any) {
    const collectionRef = collection(this.firestore, path);
    return addDoc(collectionRef, data);
  }

  // Update a document
  updateDocument(path: string, data: any) {
    const docRef = doc(this.firestore, path);
    return updateDoc(docRef, data);
  }

  // Delete a document
  deleteDocument(path: string) {
    const docRef = doc(this.firestore, path);
    return deleteDoc(docRef);
  }

  // Query a collection
  queryCollection<T>(path: string, queryFn: any): Observable<T[]> {
    const collectionRef = collection(this.firestore, path);
    const queryRef = query(collectionRef, ...queryFn);
    return collectionData(queryRef, { idField: 'id' }) as Observable<T[]>;
  }
}
