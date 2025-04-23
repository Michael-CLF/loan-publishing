import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormArray, ReactiveFormsModule } from '@angular/forms';
import {
  PropertyCategory,
  StateOption,
  LenderTypeOption,
} from '../lender-registration/lender-registration.component';

interface CountyInfo {
  state: string;
  stateName: string;
  counties: string[];
}

interface PropertyTypeInfo {
  category: string;
  subcategory: string;
}

@Component({
  selector: 'app-lender-review',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './lender-review.component.html',
  styleUrls: ['./lender-review.component.css'],
})
export class LenderReviewComponent implements OnInit {
  @Input() lenderForm!: FormGroup;
  @Input() states: StateOption[] = [];
  @Input() lenderTypes: LenderTypeOption[] = [];
  @Input() propertyCategories: PropertyCategory[] = [];

  selectedCounties: CountyInfo[] = [];
  selectedPropertyTypes: PropertyTypeInfo[] = [];

  ngOnInit() {
    // Extract selected counties
    this.processSelectedCounties();

    // Process property subcategories
    this.processPropertySubcategories();
  }

  // Helper methods to get display values
  getStateName(stateCode: string): string {
    if (!stateCode) return 'Unknown';
    const state = this.states.find(
      (s) =>
        s.value === stateCode ||
        s.value.toLowerCase() === stateCode.toLowerCase()
    );
    return state ? state.name : stateCode;
  }

  getLenderTypeName(typeCode: string): string {
    if (!typeCode) return 'Unknown';
    const type = this.lenderTypes.find((t) => t.value === typeCode);
    return type ? type.name : typeCode;
  }

  getPropertyCategoryName(categoryCode: string): string {
    if (!categoryCode) return 'Unknown';
    const category = this.propertyCategories.find(
      (c) => c.value === categoryCode
    );
    return category ? category.name : categoryCode;
  }

  // Process property subcategories
  processPropertySubcategories() {
    const propertyCategories = this.lenderForm.get(
      'productInfo.propertyCategories'
    )?.value;
    const propertyTypes = this.lenderForm.get(
      'productInfo.propertyTypes'
    )?.value;

    if (!propertyCategories || !propertyTypes) return;

    // If we have property categories but no types specifically selected
    // Let's show all subcategories for the selected categories
    if (propertyCategories.length > 0 && propertyTypes.length === 0) {
      propertyCategories.forEach((categoryCode: string) => {
        const category = this.propertyCategories.find(
          (c) => c.value === categoryCode
        );
        if (category && category.subcategories) {
          category.subcategories.forEach((subcategory) => {
            this.selectedPropertyTypes.push({
              category: this.getPropertyCategoryName(categoryCode),
              subcategory: subcategory.name,
            });
          });
        }
      });
    } else {
      // Process selected property types if they exist
      propertyTypes.forEach((typeCode: string) => {
        // Find which category this subcategory belongs to
        for (const category of this.propertyCategories) {
          const foundSubcategory = category.subcategories.find(
            (sc) => sc.value === typeCode
          );
          if (foundSubcategory) {
            this.selectedPropertyTypes.push({
              category: category.name,
              subcategory: foundSubcategory.name,
            });
            break;
          }
        }
      });
    }
  }

  // Process selected counties from the complex form structure
  processSelectedCounties() {
    const statesData = this.lenderForm.get('footprintInfo.states')?.value;

    if (!statesData) return;

    // Loop through all state entries to find selected states and their counties
    Object.keys(statesData).forEach((key) => {
      // Skip the "_counties" entries, we'll process them with their parent state
      if (key.includes('_counties')) return;

      // If the state is selected (true)
      if (statesData[key] === true) {
        const stateCode = key;
        const stateName = this.getStateName(stateCode);
        const countiesKey = `${stateCode}_counties`;
        const countiesData = statesData[countiesKey];

        if (!countiesData) return;

        // Get all selected counties for this state
        const selectedCounties = Object.keys(countiesData)
          .filter((countyKey) => countiesData[countyKey] === true)
          .map((countyKey) => {
            // Convert kebab-case to Title Case for display
            return countyKey
              .split('-')
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
          });

        if (selectedCounties.length > 0) {
          this.selectedCounties.push({
            state: stateCode,
            stateName: stateName,
            counties: selectedCounties,
          });
        }
      }
    });
  }

  // Check if there are any property subcategories selected
  hasPropertySubcategories(): boolean {
    return this.selectedPropertyTypes.length > 0;
  }

  // Check if there are any counties selected
  hasCounties(): boolean {
    return this.selectedCounties.length > 0;
  }

  // Format currency properly
  formatCurrency(value: string): number {
    if (!value) return 0;
    // Remove all non-digit characters except for decimal point
    const cleanValue = value.toString().replace(/[^0-9.]/g, '');
    return parseFloat(cleanValue) || 0;
  }
}
