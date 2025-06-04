// src/app/shared/constants/property-mappings.ts

export interface PropertySubcategory {
  value: string;
  name: string;
}

export interface PropertyCategory {
  value: string;
  name: string;
  subcategories: PropertySubcategory[];
}

// Property category mappings
export const PROPERTY_CATEGORIES: Record<string, string> = {
  commercial: 'Commercial',
  healthcare: 'Healthcare', 
  hospitality: 'Hospitality',
  industrial: 'Industrial',
  land: 'Land',
  mixed_use: 'Mixed Use',
  multifamily: 'Multifamily',
  office: 'Office',
  residential: 'Residential',
  retail: 'Retail',
  special_purpose: 'Special Purpose',
};

// Complete property subcategory mappings
export const PROPERTY_SUBCATEGORIES: Record<string, string> = {
  // Commercial subcategories
  'commercial:auto_repair_shop': 'Auto Repair Shop',
  'commercial:bank_branch': 'Bank Branch',
  'commercial:business_center': 'Business Center',
  'commercial:call_center': 'Call Center',
  'commercial:car_wash': 'Car Wash',
  'commercial:dry_cleaner': 'Dry Cleaner',
  'commercial:funeral_home': 'Funeral Home',
  'commercial:general_commercial': 'General Commercial',
  'commercial:printing_facility': 'Printing Facility',
  'commercial:sales_office': 'Sales Office',
  'commercial:showroom': 'Showroom',
  'commercial:truck_terminal': 'Truck Terminal',

  // Healthcare subcategories
  'healthcare:assisted_living': 'Assisted Living',
  'healthcare:hospital': 'Hospital',
  'healthcare:independent_living': 'Independent Living',
  'healthcare:rehab_facility': 'Rehab Facility',
  'healthcare:urgent_care': 'Urgent Care',

  // Hospitality subcategories
  'hospitality:hotel': 'Hotel',
  'hospitality:long_term_rentals': 'Long Term Rentals',
  'hospitality:motel': 'Motel',
  'hospitality:short_term_rentals': 'Short Term Rentals',

  // Industrial subcategories
  'industrial:cold_storage': 'Cold Storage',
  'industrial:distribution_center': 'Distribution Center',
  'industrial:flex_space': 'Flex Space',
  'industrial:self_storage': 'Self Storage',
  'industrial:warehouse': 'Warehouse',

  // Land subcategories
  'land:energy_park': 'Energy Park',
  'land:entitled_land': 'Entitled Land',
  'land:farm': 'Farm',
  'land:golf_course': 'Golf Course',
  'land:industrial_land': 'Industrial Land',
  'land:raw_land': 'Raw Land',
  'land:retail_land': 'Retail Land',

  // Mixed Use subcategories
  'mixed_use:live_work': 'Live Work',
  'mixed_use:residential_office': 'Residential Office',
  'mixed_use:residential_retail': 'Residential Retail',
  'mixed_use:retail_office': 'Retail Office',

  // Multifamily subcategories
  'multifamily:affordable_housing': 'Affordable Housing',
  'multifamily:apartment_building': 'Apartment Building',
  'multifamily:market_rate': 'Market Rate',
  'multifamily:independent_living': 'Independent Living',
  'multifamily:manufactured': 'Manufactured',
  'multifamily:military_housing': 'Military Housing',
  'multifamily:senior_housing': 'Senior Housing',
  'multifamily:student_housing': 'Student Housing',

   // Office subcategories
  'office:corporate_office': 'Corporate Headquarters',
  'office:excecutive_suites': 'Executive Suites / Co-working Spaces',
  'office:medical_office': 'Medical Office',
  'office:professional_office': 'Professional Office Building',
  'office:flex': 'Office/industrial',

  // Residential subcategories
  'residential:1_4_units': '1-4 Units',
  'residential:co_op': 'Co-op',
  'residential:condominium': 'Condominium',
  'residential:quadplex': 'Quadplex',
  'residential:single_family': 'Single Family',
  'residential:triplex': 'Triplex',

  // Retail subcategories
  'retail:anchored_center': 'Anchored Center',
  'retail:mall': 'Mall',
  'retail:mixed_use_retail': 'Mixed Use Retail',
  'retail:nnn_retail': 'NNN Retail',
  'retail:restaurant': 'Restaurant',
  'retail:single_tenant': 'Single Tenant',
  'retail:strip_mall': 'Strip Mall',

  // Special purpose subcategories
  'special_purpose:auto_dealership': 'Auto Dealership',
  'special_purpose:church': 'Church',
  'special_purpose:data_center': 'Data Center',
  'special_purpose:daycare': 'Daycare',
  'special_purpose:energy_park': 'Energy Park',
  'special_purpose:farm': 'Farm',
  'special_purpose:gas_station': 'Gas Station',
  'special_purpose:golf_course': 'Golf Course',  
  'special_purpose:marina': 'Marina',
  'special_purpose:mobile_home_park': 'Mobile Home Park',
  'special_purpose:parking_garage': 'Parking Garage',
  'special_purpose:r_and_d': 'R&D',
  'special_purpose:resort_rv_park': 'Resort/RV Park',
  'special_purpose:service_station': 'Service Station',
  'special_purpose:sports_complex': 'Sports Complex',
  'special_purpose:stadium': 'Stadium',
};

// Utility functions
export function getPropertyCategoryName(value: string): string {
  return PROPERTY_CATEGORIES[value] || value;
}

export function getPropertySubcategoryName(value: string): string {
  return PROPERTY_SUBCATEGORIES[value] || formatFallbackSubcategory(value);
}

// Fallback formatter for unknown subcategories
function formatFallbackSubcategory(value: string): string {
  const parts = value.split(':');
  const subcategory = parts.length > 1 ? parts[1] : value;
  
  return subcategory
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Get category from subcategory value
export function getCategoryFromSubcategory(subcategoryValue: string): string {
  const categoryValue = subcategoryValue.split(':')[0];
  return getPropertyCategoryName(categoryValue);
}