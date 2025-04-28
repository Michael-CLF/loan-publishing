// src/app/utils/form-validation.ts

import { FormGroup, FormArray } from '@angular/forms';

/**
 * Gets detailed error message for contact form
 * @param contactForm The contact form group
 * @returns Error message string or null
 */
export function getContactFormErrorMessage(
  contactForm: FormGroup
): string | null {
  if (contactForm.valid) return null;

  if (contactForm.get('firstName')?.invalid) {
    return 'Please enter a valid first name';
  } else if (contactForm.get('lastName')?.invalid) {
    return 'Please enter a valid last name';
  } else if (contactForm.get('company')?.invalid) {
    return 'Please enter a valid company name';
  } else if (contactForm.get('contactEmail')?.invalid) {
    const emailErrors = contactForm.get('contactEmail')?.errors;
    if (emailErrors?.['emailTaken']) {
      return 'This email is already registered';
    } else {
      return 'Please enter a valid email address';
    }
  } else if (contactForm.get('contactPhone')?.invalid) {
    return 'Please enter a valid phone number';
  } else if (contactForm.get('city')?.invalid) {
    return 'Please enter a valid city';
  } else if (contactForm.get('state')?.invalid) {
    return 'Please select a state';
  }

  return 'Please complete all required fields in the contact section';
}

/**
 * Gets detailed error message for product form
 * @param productForm The product form group
 * @returns Error message string or null
 */
export function getProductFormErrorMessage(
  productForm: FormGroup
): string | null {
  if (productForm.valid) return null;

  const lenderTypesArray = productForm.get('lenderTypes') as FormArray;
  const propertyCategoriesArray = productForm.get(
    'propertyCategories'
  ) as FormArray;
  const loanTypesArray = productForm.get('loanTypes') as FormArray;

  if (!lenderTypesArray || lenderTypesArray.length === 0) {
    return 'Please select at least one lender type';
  } else if (!propertyCategoriesArray || propertyCategoriesArray.length === 0) {
    return 'Please select at least one property category';
  } else if (productForm.get('minLoanAmount')?.invalid) {
    return 'Please enter a valid minimum loan amount';
  } else if (productForm.get('maxLoanAmount')?.invalid) {
    return 'Please enter a valid maximum loan amount';
  } else if (!loanTypesArray || loanTypesArray.length === 0) {
    return 'Please select at least one loan type';
  }

  return 'Please complete all required fields in the product section';
}

/**
 * Gets detailed error message for footprint form
 * @param footprintForm The footprint form group
 * @returns Error message string or null
 */
export function getFootprintFormErrorMessage(
  footprintForm: FormGroup
): string | null {
  if (footprintForm.valid) return null;

  const lendingFootprint = footprintForm.get('lendingFootprint');
  if (
    !lendingFootprint ||
    !lendingFootprint.value ||
    lendingFootprint.value.length === 0
  ) {
    return 'Please select at least one state for your lending footprint';
  }

  return 'Please complete the lending footprint section';
}
