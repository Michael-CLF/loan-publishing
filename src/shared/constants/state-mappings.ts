// src/app/shared/constants/state-mappings.ts

// Complete US state and territory mappings
export const US_STATES: Record<string, string> = {
  // States
  AL: 'Alabama',
  AK: 'Alaska', 
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
  
  // Federal District
  DC: 'District of Columbia',
  
  // US Territories (if needed)
  AS: 'American Samoa',
  GU: 'Guam',
  MP: 'Northern Mariana Islands',
  PR: 'Puerto Rico',
  VI: 'US Virgin Islands',
  
  // Handle full names mapping back to themselves
  Alabama: 'Alabama',
  Alaska: 'Alaska',
  Arizona: 'Arizona',
  Arkansas: 'Arkansas',
  California: 'California',
  Colorado: 'Colorado',
  Connecticut: 'Connecticut',
  Delaware: 'Delaware',
  Florida: 'Florida',
  Georgia: 'Georgia',
  Hawaii: 'Hawaii',
  Idaho: 'Idaho',
  Illinois: 'Illinois',
  Indiana: 'Indiana',
  Iowa: 'Iowa',
  Kansas: 'Kansas',
  Kentucky: 'Kentucky',
  Louisiana: 'Louisiana',
  Maine: 'Maine',
  Maryland: 'Maryland',
  Massachusetts: 'Massachusetts',
  Michigan: 'Michigan',
  Minnesota: 'Minnesota',
  Mississippi: 'Mississippi',
  Missouri: 'Missouri',
  Montana: 'Montana',
  Nebraska: 'Nebraska',
  Nevada: 'Nevada',
  'New Hampshire': 'New Hampshire',
  'New Jersey': 'New Jersey',
  'New Mexico': 'New Mexico',
  'New York': 'New York',
  'North Carolina': 'North Carolina',
  'North Dakota': 'North Dakota',
  Ohio: 'Ohio',
  Oklahoma: 'Oklahoma',
  Oregon: 'Oregon',
  Pennsylvania: 'Pennsylvania',
  'Rhode Island': 'Rhode Island',
  'South Carolina': 'South Carolina',
  'South Dakota': 'South Dakota',
  Tennessee: 'Tennessee',
  Texas: 'Texas',
  Utah: 'Utah',
  Vermont: 'Vermont',
  Virginia: 'Virginia',
  Washington: 'Washington',
  'West Virginia': 'West Virginia',
  Wisconsin: 'Wisconsin',
  Wyoming: 'Wyoming',
  'District of Columbia': 'District of Columbia',
};

// Reverse mapping for getting abbreviations from full names
export const STATE_ABBREVIATIONS: Record<string, string> = {
  Alabama: 'AL',
  Alaska: 'AK',
  Arizona: 'AZ',
  Arkansas: 'AR',
  California: 'CA',
  Colorado: 'CO',
  Connecticut: 'CT',
  Delaware: 'DE',
  Florida: 'FL',
  Georgia: 'GA',
  Hawaii: 'HI',
  Idaho: 'ID',
  Illinois: 'IL',
  Indiana: 'IN',
  Iowa: 'IA',
  Kansas: 'KS',
  Kentucky: 'KY',
  Louisiana: 'LA',
  Maine: 'ME',
  Maryland: 'MD',
  Massachusetts: 'MA',
  Michigan: 'MI',
  Minnesota: 'MN',
  Mississippi: 'MS',
  Missouri: 'MO',
  Montana: 'MT',
  Nebraska: 'NE',
  Nevada: 'NV',
  'New Hampshire': 'NH',
  'New Jersey': 'NJ',
  'New Mexico': 'NM',
  'New York': 'NY',
  'North Carolina': 'NC',
  'North Dakota': 'ND',
  Ohio: 'OH',
  Oklahoma: 'OK',
  Oregon: 'OR',
  Pennsylvania: 'PA',
  'Rhode Island': 'RI',
  'South Carolina': 'SC',
  'South Dakota': 'SD',
  Tennessee: 'TN',
  Texas: 'TX',
  Utah: 'UT',
  Vermont: 'VT',
  Virginia: 'VA',
  Washington: 'WA',
  'West Virginia': 'WV',
  Wisconsin: 'WI',
  Wyoming: 'WY',
  'District of Columbia': 'DC',
};

// Utility functions
export function getStateName(value: string): string {
  if (!value) return '';
  
  // Try direct lookup first
  const stateName = US_STATES[value];
  if (stateName) return stateName;
  
  // Try case-insensitive lookup for abbreviations
  const upperValue = value.toUpperCase();
  const stateFromUpper = US_STATES[upperValue];
  if (stateFromUpper) return stateFromUpper;
  
  // Return original value if not found (might already be full name)
  return value;
}

export function getStateAbbreviation(stateName: string): string {
  if (!stateName) return '';
  
  // Try direct lookup
  const abbreviation = STATE_ABBREVIATIONS[stateName];
  if (abbreviation) return abbreviation;
  
  // If it's already an abbreviation, return it
  if (stateName.length === 2 && US_STATES[stateName.toUpperCase()]) {
    return stateName.toUpperCase();
  }
  
  return stateName;
}

// Get all states for dropdowns
export function getAllStates(): Array<{value: string, name: string}> {
  return Object.entries(US_STATES)
    .filter(([key]) => key.length === 2) // Only include abbreviations, not full names
    .map(([value, name]) => ({
      value,
      name
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Check if a value is a valid state
export function isValidState(value: string): boolean {
  if (!value) return false;
  return US_STATES.hasOwnProperty(value) || US_STATES.hasOwnProperty(value.toUpperCase());
}

// Format state for display (replaces your LocationService.formatValueForDisplay)
export function formatStateForDisplay(value: string): string {
  return getStateName(value);
}