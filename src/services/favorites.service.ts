// Create a new file: src/app/services/favorites.service.ts
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FavoritesService {
  private favoritesSubject = new BehaviorSubject<string[]>([]);
  public favorites$ = this.favoritesSubject.asObservable();

  constructor() {
    this.loadFavoritesFromStorage();
  }

  private loadFavoritesFromStorage(): void {
    const favorites: string[] = [];

    // Scan localStorage for favorite items
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        key.includes('-favorite') &&
        localStorage.getItem(key) === 'true'
      ) {
        const lenderId = key.split('-')[1]; // Extract lender ID from the key
        favorites.push(lenderId);
      }
    }

    this.favoritesSubject.next(favorites);
  }

  toggleFavorite(lenderId: string): void {
    const currentFavorites = this.favoritesSubject.value;
    const index = currentFavorites.indexOf(lenderId);

    if (index === -1) {
      // Add to favorites
      localStorage.setItem(`lender-${lenderId}-favorite`, 'true');
      this.favoritesSubject.next([...currentFavorites, lenderId]);
    } else {
      // Remove from favorites
      localStorage.removeItem(`lender-${lenderId}-favorite`);
      this.favoritesSubject.next(
        currentFavorites.filter((id) => id !== lenderId)
      );
    }
  }

  isFavorite(lenderId: string): boolean {
    return localStorage.getItem(`lender-${lenderId}-favorite`) === 'true';
  }

  getFavorites(): string[] {
    return this.favoritesSubject.value;
  }
}
