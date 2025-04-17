import { Injectable } from '@angular/core';
import { usaStatesWithCounties } from 'typed-usa-states/dist/states-with-counties';
import { FootprintLocation } from '../models/footprint-location.model';

@Injectable({
  providedIn: 'root',
})
export class LocationService {
  /**
   * Retrieves states and counties data formatted for footprint location
   */
  getFootprintLocations(): FootprintLocation[] {
    // Define territories to exclude
    const excludedTerritories = ['AS', 'GU', 'MP', 'PR', 'VI'];

    return (
      usaStatesWithCounties
        // Filter out unwanted territories based on their abbreviation or name
        .filter((state) => {
          // Check if the state name or abbreviation is in the excluded list
          return !excludedTerritories.some(
            (code) =>
              state.abbreviation === code ||
              state.name.includes('American Samoa') ||
              state.name.includes('Guam') ||
              state.name.includes('Northern Mariana') ||
              state.name.includes('Puerto Rico') ||
              state.name.includes('Virgin Islands')
          );
        })
        .map((state) => {
          // Handle the possibly undefined counties property
          const counties = state.counties ?? [];

          return {
            value: this.formatValue(state.name),
            name: state.name,
            subcategories: counties.map((county) => ({
              value: this.formatValue(county),
              name: county,
            })),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name))
    );
  }
  /**
   * Formats a string to be used as a value in the dropdown
   * Converts to lowercase and replaces spaces with hyphens
   */
  private formatValue(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/\./g, '') // Remove periods
      .replace(/[^a-z0-9-]/g, ''); // Remove special characters
  }
}
