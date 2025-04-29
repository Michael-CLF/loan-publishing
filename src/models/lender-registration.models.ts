export interface PropertyCategory {
  name: string;
  value: string;
  subcategories: { name: string; value: string }[];
}

export interface StateOption {
  value: string;
  name: string;
}

export interface CityOption {
  value: string;
  name: string;
}

export interface LenderTypeOption {
  value: string;
  name: string;
}

export interface SubCategory {
  value: string;
  name: string;
}

export interface PropertyTypes {
  value: string;
  name: string;
  subCategories: SubCategory[];
}

export interface LoanTypes {
  value: string;
  name: string;
}
