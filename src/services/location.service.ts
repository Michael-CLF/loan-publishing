import { Injectable } from '@angular/core';
import { usaStatesWithCounties } from 'typed-usa-states/dist/states-with-counties';
import { FootprintLocation } from '../models/footprint-location.model';

@Injectable({
  providedIn: 'root',
})
export class LocationService {
  
  private stateAbbreviations: Record<string, string> = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
    'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
    'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
    'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
    'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
    'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
    'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
    'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
    'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
    'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
    'Wisconsin': 'WI', 'Wyoming': 'WY'
  };

  /**
   * Formats a value for display, capitalizing each word and replacing hyphens with spaces
   * @param formattedValue The lowercase hyphenated value (e.g., "rhode-island")
   * @returns The properly formatted display text (e.g., "Rhode Island")
   */
  formatValueForDisplay(formattedValue: string): string {
    if (!formattedValue) return '';

    return formattedValue
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Retrieves states and counties data formatted for footprint location
   */
  getFootprintLocations(): FootprintLocation[] {
    // Define territories to exclude (Filtered States)
    const excludedTerritories = ['AS', 'DC', 'GU', 'MP', 'PR', 'VI'];

    return usaStatesWithCounties
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
          value: this.stateAbbreviations[state.name] || state.name,
          name: state.name,
          subcategories: counties.map((county) => ({
            value: this.formatValue(county),
            name: county,
          })),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Formats a string to be used as a value in the dropdown
   * Converts to lowercase and replaces spaces with hyphens
   */
  public formatValue(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/\./g, '') // Remove periods
      .replace(/[^a-z0-9-]/g, ''); // Remove special characters
  }
}