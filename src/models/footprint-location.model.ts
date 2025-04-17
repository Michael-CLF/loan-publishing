export interface FootprintSubcategory {
  value: string;
  name: string;
}

export interface FootprintLocation {
  value: string;
  name: string;
  subcategories: FootprintSubcategory[];
}
