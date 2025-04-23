// property-filter.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Property {
  id: number;
  address: string;
  city: string;
  state: string;
  loanAmount: number;
  propertyType: string;
  // Other property fields
}

export interface PropertyFilters {
  minLoanAmount: number | null;
  maxLoanAmount: number | null;
  city: string;
  state: string;
  propertyType: string;
  // Other filter criteria
}

@Injectable({
  providedIn: 'root',
})
export class PropertyFilterService {
  private propertiesSubject = new BehaviorSubject<Property[]>([]);
  private allProperties: Property[] = [];

  constructor() {}

  // Method to load initial data
  loadProperties(properties: Property[]): void {
    this.allProperties = properties;
    this.propertiesSubject.next(properties);
  }

  // Get the observable for components to subscribe to
  get properties$(): Observable<Property[]> {
    return this.propertiesSubject.asObservable();
  }

  // Apply filters
  applyFilters(filters: PropertyFilters): void {
    const filteredProperties = this.allProperties.filter((property) => {
      // Filter by loan amount range
      if (
        filters.minLoanAmount &&
        property.loanAmount < filters.minLoanAmount
      ) {
        return false;
      }
      if (
        filters.maxLoanAmount &&
        property.loanAmount > filters.maxLoanAmount
      ) {
        return false;
      }

      // Filter by city (case-insensitive partial match)
      if (
        filters.city &&
        !property.city.toLowerCase().includes(filters.city.toLowerCase())
      ) {
        return false;
      }

      // Filter by state (exact match)
      if (filters.state && property.state !== filters.state) {
        return false;
      }

      // Filter by property type
      if (
        filters.propertyType &&
        property.propertyType !== filters.propertyType
      ) {
        return false;
      }

      return true;
    });

    this.propertiesSubject.next(filteredProperties);
  }

  // Reset to show all properties
  resetFilters(): void {
    this.propertiesSubject.next(this.allProperties);
  }
}
