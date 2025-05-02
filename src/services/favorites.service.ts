// src/app/services/favorites.service.ts
import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  collectionData,
} from '@angular/fire/firestore';
import {
  BehaviorSubject,
  Observable,
  of,
  switchMap,
  map,
  catchError,
} from 'rxjs';
import { AuthService } from './auth.service';
import { firstValueFrom } from 'rxjs';

export interface LenderFavorite {
  id?: string;
  originatorId: string;
  lenderId: string;
  createdAt: Date;
}

@Injectable({
  providedIn: 'root',
})
export class FavoritesService {
  private favoritesSubject = new BehaviorSubject<string[]>([]);
  public favorites$ = this.favoritesSubject.asObservable();

  // Add BehaviorSubject for modal visibility
  private showModalSubject = new BehaviorSubject<boolean>(false);
  public showModal$ = this.showModalSubject.asObservable();

  // Dependency injection
  private firestore = inject(Firestore);
  private authService = inject(AuthService);

  // Collection reference
  private favoritesCollection = collection(
    this.firestore,
    'originatorLenderFavorites'
  );

  constructor() {
    // Load favorites when the service initializes
    this.loadFavoritesFromFirestore();

    // Listen to authentication changes to reload favorites
    this.authService.isLoggedIn$.subscribe((isLoggedIn) => {
      if (isLoggedIn) {
        this.loadFavoritesFromFirestore();
      } else {
        // Clear favorites when logged out
        this.favoritesSubject.next([]);
      }
    });
  }

  private loadFavoritesFromFirestore(): void {
    this.authService.getCurrentUser().subscribe((user) => {
      if (!user || !user.uid) {
        this.favoritesSubject.next([]);
        return;
      }

      const userId = user.uid;
      const favoritesQuery = query(
        this.favoritesCollection,
        where('originatorId', '==', userId)
      );

      collectionData(favoritesQuery, { idField: 'id' }).subscribe({
        next: (favorites: any[]) => {
          // Extract lender IDs from favorites documents
          const lenderIds = favorites.map((fav) => fav.lenderId);
          this.favoritesSubject.next(lenderIds);
        },
        error: (error) => {
          console.error('Error loading favorites from Firestore:', error);
          this.favoritesSubject.next([]);
        },
      });
    });
  }

  async toggleFavorite(lenderId: string): Promise<void> {
    const user = await firstValueFrom(this.authService.getCurrentUser());

    if (!user || !user.uid) {
      console.error('User must be logged in to manage favorites');
      return;
    }

    const userId = user.uid;
    const isFavorited = await this.checkFavoriteInFirestore(userId, lenderId);

    if (isFavorited.exists) {
      // Remove from favorites
      await deleteDoc(
        doc(this.firestore, `originatorLenderFavorites/${isFavorited.id}`)
      );
    } else {
      // Add to favorites
      await addDoc(this.favoritesCollection, {
        originatorId: userId,
        lenderId: lenderId,
        createdAt: new Date(),
      });

      // Show success modal
      this.showModalSubject.next(true);

      // Auto-hide after 3 seconds
      setTimeout(() => {
        this.showModalSubject.next(false);
      }, 3000);
    }

    // Reload favorites to update the subject
    this.loadFavoritesFromFirestore();
  }

  async isFavorite(lenderId: string): Promise<boolean> {
    const user = await firstValueFrom(this.authService.getCurrentUser());

    if (!user || !user.uid) {
      return false;
    }

    const result = await this.checkFavoriteInFirestore(user.uid, lenderId);
    return result.exists;
  }

  private async checkFavoriteInFirestore(
    userId: string,
    lenderId: string
  ): Promise<{ exists: boolean; id?: string }> {
    const favoritesQuery = query(
      this.favoritesCollection,
      where('originatorId', '==', userId),
      where('lenderId', '==', lenderId)
    );

    const querySnapshot = await getDocs(favoritesQuery);

    if (querySnapshot.empty) {
      return { exists: false };
    } else {
      return {
        exists: true,
        id: querySnapshot.docs[0].id,
      };
    }
  }

  getFavorites(): Observable<string[]> {
    return this.favorites$;
  }

  /**
   * Get full favorite objects with their document IDs
   */
  getFullFavorites(): Observable<LenderFavorite[]> {
    return this.authService.getCurrentUser().pipe(
      switchMap((user) => {
        if (!user || !user.uid) {
          return of([]);
        }

        const userId = user.uid;
        const favoritesQuery = query(
          this.favoritesCollection,
          where('originatorId', '==', userId)
        );

        return collectionData(favoritesQuery, { idField: 'id' }).pipe(
          map((docs) => docs as LenderFavorite[]),
          catchError((error) => {
            console.error('Error fetching favorites:', error);
            return of([]);
          })
        );
      })
    );
  }

  // Method to close the modal programmatically
  closeModal(): void {
    this.showModalSubject.next(false);
  }
}
