import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormGroup,
  ReactiveFormsModule,
  AbstractControl,
  FormArray,
  FormControl,
} from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { LoanTypes } from '../lender-registration/lender-registration.component';

@Component({
  selector: 'app-lender-product',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  providers: [CurrencyPipe],
  templateUrl: './lender-product.component.html',
  styleUrls: ['./lender-product.component.css'],
})
export class LenderProductComponent implements OnInit {
  @Input() lenderForm!: FormGroup;
  @Input() lenderTypes!: { value: string; name: string }[];
  @Input() propertyCategories!: {
    value: string;
    name: string;
    subcategories: { name: string; value: string }[];
  }[];
  @Input() propertyTypes!: {
    value: string;
    name: string;
    subCategories: { value: string; name: string }[];
  }[];
  @Input() states!: { value: string; name: string }[];
  @Input() loanTypes: LoanTypes[] = [];

  // Track expanded state for subcategories
  expandedCategory: string | null = null;

  constructor(private currencyPipe: CurrencyPipe) {}

  ngOnInit(): void {
    // Validate inputs
    if (!this.lenderForm) {
      console.error('LenderProductComponent: lenderForm input is missing');
      return;
    }

    // Initialize form arrays if they don't exist
    this.initializeFormArrays();

    // Check initial form validity
    setTimeout(() => {
      this.lenderForm.updateValueAndValidity();
    });
  }

  formatCurrency(event: Event, controlName: string): void {
    const input = event.target as HTMLInputElement;
    let value = input.value;

    // First remove all formatting (dollar signs, commas)
    const numericString = value.replace(/[^0-9.]/g, '');

    // Store the numeric value in the form (this is key)
    const numericValue = parseFloat(numericString);

    // Update the form with the numeric value (but don't trigger another event)
    this.lenderForm
      .get(controlName)
      ?.setValue(numericValue, { emitEvent: false });

    // Format for display only
    const formattedValue = this.currencyPipe.transform(
      numericValue,
      'USD',
      'symbol',
      '1.0-0'
    );

    // Update the display without changing the form value again
    input.value = formattedValue || '';

    console.log(
      `${controlName} stored value:`,
      numericValue,
      typeof numericValue
    );
  }
  private initializeFormArrays(): void {
    // Only check if arrays exist, don't create them if they don't
    if (!this.lenderForm.get('lenderTypes')) {
      console.error('LenderTypes FormArray is missing from parent form');
    }
    if (!this.lenderForm.get('propertyCategories')) {
      console.error('PropertyCategories FormArray is missing from parent form');
    }
    if (!this.lenderForm.get('loanTypes')) {
      console.error('LoanTypes FormArray is missing from parent form');
    }
    if (!this.lenderForm.get('subcategorySelections')) {
      console.error(
        'SubcategorySelections FormArray is missing from parent form'
      );
    }
  }

  // Getters for form arrays
  get lenderTypesArray(): FormArray {
    return this.lenderForm.get('lenderTypes') as FormArray;
  }

  get propertyCategoriesArray(): FormArray {
    return this.lenderForm.get('propertyCategories') as FormArray;
  }

  get subcategorySelectionsArray(): FormArray {
    return this.lenderForm.get('subcategorySelections') as FormArray;
  }

  get loanTypesArray(): FormArray {
    return this.lenderForm.get('loanTypes') as FormArray;
  }

  // Form control helpers
  getControl(name: string): AbstractControl | null {
    return this.lenderForm.get(name);
  }

  isControlInvalid(controlName: string): boolean {
    const control = this.lenderForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  controlHasError(controlName: string, errorName: string): boolean {
    const control = this.lenderForm.get(controlName);
    return !!control && control.hasError(errorName);
  }

  markControlAsTouched(name: string): void {
    const control = this.getControl(name);
    if (control) {
      control.markAsTouched();
    }
  }

  // Check if an option is selected in a form array
  isOptionSelected(formArrayName: string, value: string): boolean {
    const formArray = this.lenderForm.get(formArrayName) as FormArray;
    if (!formArray) return false;

    return formArray.controls.some((control) => {
      const controlValue = control.value;
      // Handle both object values and string values
      if (typeof controlValue === 'object' && controlValue !== null) {
        return controlValue.value === value;
      }
      return controlValue === value;
    });
  }

  isLoanTypeSelected(loanTypeValue: string): boolean {
    return this.isOptionSelected('loanTypes', loanTypeValue);
  }

  // Get selected loan types count
  getSelectedLoanTypesCount(): number {
    return this.loanTypesArray.length;
  }

  // Check if a subcategory is selected
  isSubOptionSelected(category: string, subValue: string): boolean {
    const formArray = this.lenderForm.get('subcategorySelections') as FormArray;
    return (
      formArray?.controls.some(
        (control) => control.value === `${category}:${subValue}`
      ) || false
    );
  }
  onLenderTypeChange(event: Event, value: string): void {
    event.stopPropagation(); // Prevent event bubbling
    const formArray = this.lenderTypesArray;

    // First, clear the array to ensure only one selection
    while (formArray.length) {
      formArray.removeAt(0);
    }

    // Find the full lender type object
    const lenderTypeObject = this.lenderTypes.find((t) => t.value === value);

    // Add the new selection
    if (lenderTypeObject) {
      formArray.push(new FormControl(lenderTypeObject));
    }

    // Update validation
    formArray.updateValueAndValidity();
    this.lenderForm.updateValueAndValidity();
  }
  // Toggle category selection
  toggleCategory(categoryValue: string): void {
    // Check if category is already selected
    const isSelected = this.isOptionSelected(
      'propertyCategories',
      categoryValue
    );
    const formArray = this.propertyCategoriesArray;

    // Toggle selection
    if (!isSelected) {
      // Add the category to the form array
      formArray.push(new FormControl(categoryValue));

      // Expand this category's dropdown to show subcategories
      this.expandedCategory = categoryValue;
    } else {
      // Remove the category from the form array
      const index = formArray.controls.findIndex(
        (control) => control.value === categoryValue
      );
      if (index !== -1) {
        formArray.removeAt(index);
      }

      // Also remove all subcategories for this category
      this.removeAllSubcategories(categoryValue);

      // Collapse dropdown
      if (this.expandedCategory === categoryValue) {
        this.expandedCategory = null;
      }
    }

    // Update validation
    formArray.updateValueAndValidity();
    this.lenderForm.updateValueAndValidity();
  }
  isAnyLenderTypeSelected(): boolean {
    return this.lenderTypesArray.length > 0;
  }

  // Add this method to check if an option is disabled
  isLenderTypeDisabled(value: string): boolean {
    // Return true if any lender type is selected AND it's not this one
    return (
      this.isAnyLenderTypeSelected() &&
      !this.isOptionSelected('lenderTypes', value)
    );
  }

  toggleLoanType(event: Event, loanTypeValue: string): void {
    event.stopPropagation(); // Prevent event bubbling
    const formArray = this.loanTypesArray;

    if (!formArray) {
      console.error('loanTypesArray is not initialized');
      return;
    }

    const isSelected = this.isLoanTypeSelected(loanTypeValue);

    // Find the full loan type object from the available types
    const loanTypeObject = this.loanTypes.find(
      (lt) => lt.value === loanTypeValue
    );

    if (!isSelected && loanTypeObject) {
      // Add the full loan type object to match parent's expected format
      formArray.push(new FormControl(loanTypeObject));
    } else {
      // Remove the loan type
      const index = formArray.controls.findIndex((control) =>
        typeof control.value === 'object'
          ? control.value.value === loanTypeValue
          : control.value === loanTypeValue
      );
      if (index !== -1) {
        formArray.removeAt(index);
      }
    }

    // Update validation
    formArray.updateValueAndValidity();
    this.lenderForm.updateValueAndValidity();
  }

  // Toggle subcategory selection
  toggleSubcategory(
    event: Event,
    categoryValue: string,
    subcategoryValue: string
  ): void {
    const combinedValue = `${categoryValue}:${subcategoryValue}`;
    const isSelected = this.isSubOptionSelected(
      categoryValue,
      subcategoryValue
    );
    const formArray = this.subcategorySelectionsArray;

    if (!isSelected) {
      // Add subcategory
      formArray.push(new FormControl(combinedValue));
    } else {
      // Remove subcategory
      const index = formArray.controls.findIndex(
        (control) => control.value === combinedValue
      );
      if (index !== -1) {
        formArray.removeAt(index);
      }
    }

    // Update form validation
    formArray.updateValueAndValidity();
    this.lenderForm.updateValueAndValidity();
  }

  // Toggle all subcategories for a category
  toggleAllSubcategories(categoryValue: string): void {
    const category = this.propertyCategories.find(
      (c) => c.value === categoryValue
    );
    if (!category || !category.subcategories) return;

    const shouldSelect = !this.allSubcategoriesSelected(categoryValue);

    // First, remove all existing subcategories for this category
    this.removeAllSubcategories(categoryValue);

    // If we should select all, add all subcategories
    if (shouldSelect) {
      const formArray = this.subcategorySelectionsArray;
      category.subcategories.forEach((subcategory) => {
        formArray.push(
          new FormControl(`${categoryValue}:${subcategory.value}`)
        );
      });
    }

    // Update form validation
    this.subcategorySelectionsArray.updateValueAndValidity();
    this.lenderForm.updateValueAndValidity();
  }

  // Check if all subcategories of a category are selected
  allSubcategoriesSelected(categoryValue: string): boolean {
    const category = this.propertyCategories.find(
      (c) => c.value === categoryValue
    );
    if (
      !category ||
      !category.subcategories ||
      category.subcategories.length === 0
    )
      return false;

    return (
      this.getSelectedSubcategoriesCount(categoryValue) ===
      category.subcategories.length
    );
  }

  // Remove all subcategories for a category
  removeAllSubcategories(categoryValue: string): void {
    const formArray = this.subcategorySelectionsArray;
    const toRemove: number[] = [];

    // Find all subcategories to remove
    formArray.controls.forEach((control, index) => {
      if (control.value.startsWith(`${categoryValue}:`)) {
        toRemove.push(index);
      }
    });

    // Remove in reverse order to avoid index shifting
    for (let i = toRemove.length - 1; i >= 0; i--) {
      formArray.removeAt(toRemove[i]);
    }
  }

  // Toggle dropdown expanded/collapsed state
  toggleDropdown(categoryValue: string): void {
    if (this.expandedCategory === categoryValue) {
      this.expandedCategory = null;
    } else {
      this.expandedCategory = categoryValue;
    }

    // Prevent event propagation to the category click handler
    event?.stopPropagation();
  }

  // Get the count of selected subcategories for a category
  getSelectedSubcategoriesCount(categoryValue: string): number {
    const formArray = this.subcategorySelectionsArray;
    return formArray.controls.filter((control) =>
      control.value.startsWith(`${categoryValue}:`)
    ).length;
  }
}
