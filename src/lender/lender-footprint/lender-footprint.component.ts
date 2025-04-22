// lender-footprint.component.ts
import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { LocationService } from '../../services/location.service';
import {
  FootprintLocation,
  FootprintSubcategory,
} from '../../models/footprint-location.model';

interface SelectionState {
  stateValue: string;
  stateName: string;
  counties: Array<{
    value: string;
    name: string;
    selected: boolean;
  }>;
  allCountiesSelected: boolean;
}

@Component({
  selector: 'app-lender-footprint',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './lender-footprint.component.html',
  styleUrls: ['./lender-footprint.component.css'],
  providers: [LocationService],
})
export class LenderFootprintComponent implements OnInit {
  @Input() lenderForm!: FormGroup;

  // States data
  footprintLocation: FootprintLocation[] = [];

  // Track selected states and counties
  selectedStates: SelectionState[] = [];

  // Track which states dropdown is expanded
  expandedState: string | null = null;

  constructor(
    private fb: FormBuilder,
    private locationService: LocationService
  ) {}

  ngOnInit(): void {
    // Get states and counties data
    this.footprintLocation = this.locationService.getFootprintLocations();

    // Make sure we have the lendingFootprint control
    if (!this.lenderForm.get('lendingFootprint')) {
      this.lenderForm.addControl('lendingFootprint', this.fb.control([]));
    }

    // Initialize states form group if it doesn't exist
    if (!this.lenderForm.get('states')) {
      // Create states form group
      const statesGroup = this.fb.group({});

      // Add controls for each state
      this.footprintLocation.forEach((state) => {
        statesGroup.addControl(state.value, this.fb.control(false));

        // Add a nested form group for counties
        const countiesGroup = this.fb.group({});
        state.subcategories.forEach((county) => {
          countiesGroup.addControl(county.value, this.fb.control(false));
        });

        statesGroup.addControl(`${state.value}_counties`, countiesGroup);
      });

      // Add the states group to the main form
      this.lenderForm.addControl('states', statesGroup);
    }

    // Apply the validator to the form
    this.lenderForm.setValidators(this.atLeastOneStateValidator());

    // Initialize the selected states array from form values
    this.initializeSelectedStates();

    // Log initial state
    console.log('Footprint form initialized:', this.lenderForm);
    console.log('Footprint form valid:', this.lenderForm.valid);
    console.log(
      'lendingFootprint value:',
      this.lenderForm.get('lendingFootprint')?.value
    );

    // Force validation check immediately
    this.lenderForm.updateValueAndValidity();
  }

  // Initialize selected states from form values
  private initializeSelectedStates(): void {
    const statesGroup = this.lenderForm.get('states') as FormGroup;
    if (!statesGroup) return;

    // Clear the array
    this.selectedStates = [];

    // Get all state keys (excluding county groups)
    const stateControls = Object.keys(statesGroup.controls).filter(
      (key) => !key.includes('_counties')
    );

    // For each selected state, add to our tracking array
    stateControls.forEach((stateKey) => {
      if (statesGroup.get(stateKey)?.value === true) {
        const state = this.footprintLocation.find((s) => s.value === stateKey);
        if (state) {
          const countiesGroup = statesGroup.get(
            `${stateKey}_counties`
          ) as FormGroup;

          // Map counties with their selected state
          const counties = state.subcategories.map((county) => ({
            value: county.value,
            name: county.name,
            selected: countiesGroup?.get(county.value)?.value === true || false,
          }));

          // Check if all counties are selected
          const allCountiesSelected =
            counties.length > 0 && counties.every((county) => county.selected);

          // Add to our tracking array
          this.selectedStates.push({
            stateValue: stateKey,
            stateName: state.name,
            counties,
            allCountiesSelected,
          });
        }
      }
    });
  }

  /**
   * Custom validator to ensure at least one state is selected
   */
  private atLeastOneStateValidator(): ValidatorFn {
    return (formGroup: AbstractControl): ValidationErrors | null => {
      const statesGroup = formGroup.get('states') as FormGroup;
      if (!statesGroup) return { noStateSelected: true };

      const anyStateSelected = Object.keys(statesGroup.controls)
        .filter((key) => !key.includes('_counties'))
        .some((key) => statesGroup.get(key)?.value === true);

      return anyStateSelected ? null : { noStateSelected: true };
    };
  }

  /**
   * Update the form values based on our tracking array
   */
  private updateFormValues(): void {
    const statesGroup = this.lenderForm.get('states') as FormGroup;
    if (!statesGroup) return;

    // Reset all states to unselected
    Object.keys(statesGroup.controls)
      .filter((key) => !key.includes('_counties'))
      .forEach((key) => {
        statesGroup.get(key)?.setValue(false);
      });

    // Update with current selections
    this.selectedStates.forEach((state) => {
      // Set state as selected
      statesGroup.get(state.stateValue)?.setValue(true);

      // Get counties group
      const countiesGroup = statesGroup.get(
        `${state.stateValue}_counties`
      ) as FormGroup;

      if (countiesGroup) {
        // Update each county
        state.counties.forEach((county) => {
          countiesGroup.get(county.value)?.setValue(county.selected);
        });
      }
    });

    // Update lendingFootprint value - store state names
    const selectedStateNames = this.selectedStates.map(
      (state) => state.stateName
    );
    const lendingFootprint = this.lenderForm.get('lendingFootprint');
    if (lendingFootprint) {
      lendingFootprint.setValue(selectedStateNames);
      console.log('Updated lendingFootprint value:', selectedStateNames);
    }

    // Update form state
    this.lenderForm.markAsDirty();
    this.lenderForm.markAsTouched();
    this.lenderForm.updateValueAndValidity();
  }

  // Toggle state selection
  toggleState(stateValue: string): void {
    // Check if state is already selected
    const stateIndex = this.selectedStates.findIndex(
      (s) => s.stateValue === stateValue
    );

    // If state is already selected, remove it
    if (stateIndex !== -1) {
      this.selectedStates.splice(stateIndex, 1);
    }
    // Otherwise, add it
    else {
      const state = this.footprintLocation.find((s) => s.value === stateValue);
      if (state) {
        // Add with all counties unselected initially
        this.selectedStates.push({
          stateValue,
          stateName: state.name,
          counties: state.subcategories.map((county) => ({
            value: county.value,
            name: county.name,
            selected: false,
          })),
          allCountiesSelected: false,
        });

        // Expand this state's dropdown
        this.expandedState = stateValue;
      }
    }

    // Update form
    this.updateFormValues();
  }

  // Toggle county selection
  toggleCounty(stateValue: string, countyValue: string): void {
    // Find the state
    const state = this.selectedStates.find((s) => s.stateValue === stateValue);
    if (!state) return;

    // Find the county
    const county = state.counties.find((c) => c.value === countyValue);
    if (!county) return;

    // Toggle selection
    county.selected = !county.selected;

    // Update the "allCountiesSelected" flag
    state.allCountiesSelected = state.counties.every((c) => c.selected);

    // Update form
    this.updateFormValues();
  }

  // Toggle all counties for a state
  toggleAllCounties(stateValue: string): void {
    // Find the state
    const state = this.selectedStates.find((s) => s.stateValue === stateValue);
    if (!state) return;

    // Toggle the "allCountiesSelected" flag
    state.allCountiesSelected = !state.allCountiesSelected;

    // Update all counties
    state.counties.forEach((county) => {
      county.selected = state.allCountiesSelected;
    });

    // Update form
    this.updateFormValues();
  }

  // Toggle dropdown expanded/collapsed state
  toggleDropdown(stateValue: string): void {
    if (this.expandedState === stateValue) {
      this.expandedState = null;
    } else {
      this.expandedState = stateValue;
    }
  }

  // Check if a state is selected
  isStateSelected(stateValue: string): boolean {
    return this.selectedStates.some((s) => s.stateValue === stateValue);
  }

  // Check if a county is selected
  isCountySelected(stateValue: string, countyValue: string): boolean {
    const state = this.selectedStates.find((s) => s.stateValue === stateValue);
    if (!state) return false;

    const county = state.counties.find((c) => c.value === countyValue);
    return county?.selected || false;
  }

  // Get total selected counties for a state
  getSelectedCountiesCount(stateValue: string): number {
    const state = this.selectedStates.find((s) => s.stateValue === stateValue);
    if (!state) return 0;

    return state.counties.filter((c) => c.selected).length;
  }

  // Format state display text
  getStateDisplayText(state: FootprintLocation): string {
    const selectedCount = this.getSelectedCountiesCount(state.value);
    const totalCount = state.subcategories.length;

    if (this.isStateSelected(state.value)) {
      if (selectedCount === 0) {
        return `${state.name} (All counties)`;
      } else if (selectedCount === totalCount) {
        return `${state.name} (All counties)`;
      } else {
        return `${state.name} (${selectedCount} of ${totalCount} counties)`;
      }
    }

    return state.name;
  }

  // Check if the form has any validation errors
  hasFormError(errorName: string): boolean {
    return (
      this.lenderForm.hasError(errorName) &&
      (this.lenderForm.touched || this.lenderForm.dirty)
    );
  }
}
