// src/services/firestore.service.ts
import { Injectable, inject, DestroyRef } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  setDoc,
  deleteDoc,
  updateDoc,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root',
})
export class FirestoreService {
  private firestore = inject(Firestore);
  private destroyRef = inject(DestroyRef);

  getCollection<T>(path: string): Observable<T[]> {
    const collectionRef = collection(this.firestore, path);
    return collectionData(collectionRef, { idField: 'id' }).pipe(
      takeUntilDestroyed(this.destroyRef)
    ) as Observable<T[]>;
  }

  getDocument<T>(path: string): Observable<T | null> {
    const docRef = doc(this.firestore, path);
    return docData(docRef).pipe(
      takeUntilDestroyed(this.destroyRef)
    ) as Observable<T | null>;
  }

  addDocument(collectionPath: string, data: any): Promise<string> {
    const collectionRef = collection(this.firestore, collectionPath);
    const docRef = doc(collectionRef);
    const id = docRef.id;

    return setDoc(docRef, { ...data, id }).then(() => id);
  }

  updateDocument(path: string, data: any): Promise<void> {
    const docRef = doc(this.firestore, path);
    return updateDoc(docRef, data);
  }

  deleteDocument(path: string): Promise<void> {
    const docRef = doc(this.firestore, path);
    return deleteDoc(docRef);
  }
}
