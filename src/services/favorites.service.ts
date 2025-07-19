import { Injectable, inject } from '@angular/core';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  collectionData
} from '@angular/fire/firestore';
import {
  BehaviorSubject,
  Observable,
  of,
  switchMap,
  map,
  catchError
} from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { FirestoreService } from './firestore.service';

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
  constructor(private firestoreService: FirestoreService) {
    this.loadFavoritesFromFirestore();
    this.authService.isLoggedIn$.subscribe((isLoggedIn) => {
      if (isLoggedIn) {
        this.loadFavoritesFromFirestore();
      } else {
        this.favoritesSubject.next([]);
      }
    });
  }

  private get db() {
    return this.firestoreService.firestore;
  }

  private favoritesSubject = new BehaviorSubject<string[]>([]);
  public favorites$ = this.favoritesSubject.asObservable();

  private showModalSubject = new BehaviorSubject<boolean>(false);
  public showModal$ = this.showModalSubject.asObservable();

  private processingLenderIds = new Set<string>();
  private authService = inject(AuthService);

  private favoritesCollection = collection(this.db, 'originatorLenderFavorites');

  private loadFavoritesFromFirestore(): void {
    this.authService.getCurrentFirebaseUser().subscribe((user) => {
      if (!user?.uid) {
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
          const lenderIds = favorites.map((fav) => fav.lenderId);
          this.favoritesSubject.next(lenderIds);
        },
        error: (error) => {
          console.error('Error loading favorites from Firestore:', error);
          this.favoritesSubject.next([]);
        }
      });
    });
  }

  async toggleFavorite(lenderId: string): Promise<void> {
    if (this.processingLenderIds.has(lenderId)) return;

    this.processingLenderIds.add(lenderId);

    try {
      const user = await firstValueFrom(this.authService.getCurrentFirebaseUser());
      if (!user?.uid) {
        console.error('User must be logged in to manage favorites');
        return;
      }

      const userId = user.uid;
      const isFavorited = await this.checkFavoriteInFirestore(userId, lenderId);

      if (isFavorited.exists) {
        await deleteDoc(doc(this.db, `originatorLenderFavorites/${isFavorited.id}`));
      } else {
        await addDoc(this.favoritesCollection, {
          originatorId: userId,
          lenderId,
          createdAt: new Date(),
        });

        this.showModalSubject.next(true);
        setTimeout(() => this.showModalSubject.next(false), 3000);
      }

      this.loadFavoritesFromFirestore();
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      this.processingLenderIds.delete(lenderId);
    }
  }

  async isFavorite(lenderId: string): Promise<boolean> {
    const user = await firstValueFrom(this.authService.getCurrentFirebaseUser());
    if (!user?.uid) return false;

    const result = await this.checkFavoriteInFirestore(user.uid, lenderId);
    return result.exists;
  }

  private async checkFavoriteInFirestore(userId: string, lenderId: string): Promise<{ exists: boolean, id?: string }> {
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
        id: querySnapshot.docs[0].id
      };
    }
  }

  getFavorites(): Observable<string[]> {
    return this.favorites$;
  }

  getFullFavorites(): Observable<LenderFavorite[]> {
    return this.authService.getCurrentFirebaseUser().pipe(
      switchMap((user) => {
        if (!user?.uid) return of([]);

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

  closeModal(): void {
    this.showModalSubject.next(false);
  }
}
