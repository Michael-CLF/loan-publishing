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
  @Input() footprintLocation: {
    value: string;
    name: string;
    subcategories: any[];
  }[] = [];

  selectedStates: SelectionState[] = [];
  expandedState: string | null = null;

  constructor(
    private fb: FormBuilder,
    private locationService: LocationService
  ) {}

  ngOnInit(): void {
    this.initializeFormStructure();
    this.initializeSelectedStates();
    this.lenderForm.updateValueAndValidity();
  }

  // In lender-footprint.component.ts:
  private initializeFormStructure(): void {
    // Don't look for footprintInfo, add controls directly to where they're expected
    if (!this.lenderForm.get('footprintInfo.lendingFootprint')) {
      const footprintForm = this.lenderForm.get('footprintInfo') as FormGroup;
      if (footprintForm) {
        footprintForm.addControl('lendingFootprint', this.fb.control([]));
      }
    }

    // Get the states group from where the validator is looking for it
    let statesGroup = this.lenderForm.get('footprintInfo.states') as FormGroup;

    if (!statesGroup) {
      // If it doesn't exist, create it in the right place
      statesGroup = this.fb.group({});
      const footprintForm = this.lenderForm.get('footprintInfo') as FormGroup;
      if (footprintForm) {
        footprintForm.addControl('states', statesGroup);
      }

      // Add the state controls
      this.footprintLocation.forEach((state) => {
        statesGroup.addControl(state.value, this.fb.control(false));

        const countiesGroup = this.fb.group({});
        state.subcategories.forEach((county) => {
          countiesGroup.addControl(county.value, this.fb.control(false));
        });

        statesGroup.addControl(`${state.value}_counties`, countiesGroup);
      });
    }

    // Set validators and update validity
    statesGroup.setValidators(this.atLeastOneStateValidator());
    statesGroup.updateValueAndValidity({ emitEvent: true });
  }

  private initializeSelectedStates(): void {
    const statesGroup = this.lenderForm.get(
      'footprintInfo.states'
    ) as FormGroup;
    if (!statesGroup) return;
    this.selectedStates = [];

    const stateControls = Object.keys(statesGroup.controls).filter(
      (key) => !key.includes('_counties')
    );

    stateControls.forEach((stateKey) => {
      if (statesGroup.get(stateKey)?.value === true) {
        const state = this.footprintLocation.find((s) => s.value === stateKey);
        if (state) {
          const countiesGroup = statesGroup.get(
            `${stateKey}_counties`
          ) as FormGroup;
          if (!countiesGroup) return;

          const counties = state.subcategories.map((county) => {
            const isSelected = countiesGroup.get(county.value)?.value === true;
            return {
              value: county.value,
              name: county.name,
              selected: isSelected,
            };
          });

          const allCountiesSelected =
            counties.length > 0 && counties.every((c) => c.selected);

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

  private atLeastOneStateValidator(): ValidatorFn {
    return (formGroup: AbstractControl): ValidationErrors | null => {
      const statesGroup = formGroup as FormGroup;
      if (!statesGroup) return { noStateSelected: true };

      const anyStateSelected = Object.keys(statesGroup.controls)
        .filter((key) => !key.includes('_counties'))
        .some((key) => statesGroup.get(key)?.value === true);

      return anyStateSelected ? null : { noStateSelected: true };
    };
  }

  private updateFormValues(): void {
    const statesGroup = this.lenderForm.get(
      'footprintInfo.states'
    ) as FormGroup;
    if (!statesGroup) return;

    // First clear state selections
    Object.keys(statesGroup.controls)
      .filter((key) => !key.includes('_counties'))
      .forEach((key) => {
        statesGroup.get(key)?.setValue(false);
      });

    // Then set selected states and counties
    this.selectedStates.forEach((state) => {
      statesGroup.get(state.stateValue)?.setValue(true);
      const countiesGroup = statesGroup.get(
        `${state.stateValue}_counties`
      ) as FormGroup;
      if (countiesGroup) {
        Object.keys(countiesGroup.controls).forEach((key) => {
          countiesGroup.get(key)?.setValue(false);
        });
        state.counties.forEach((county) => {
          if (county.selected) {
            countiesGroup.get(county.value)?.setValue(true);
          }
        });
      }
    });

    // Create the selectedStateAbbreviations array here, before using it
    const selectedStateAbbreviations = this.selectedStates.map(
      (state) => state.stateValue
    );

    // Now set the lendingFootprint value using the created array
    this.lenderForm
      .get('footprintInfo.lendingFootprint')
      ?.setValue(selectedStateAbbreviations);

    // Mark form as touched and dirty
    this.lenderForm.markAsDirty();
    this.lenderForm.markAsTouched();

    // Update validation status and emit change events
    statesGroup.updateValueAndValidity({ onlySelf: false, emitEvent: true });
    this.lenderForm
      .get('footprintInfo.lendingFootprint')
      ?.updateValueAndValidity({ onlySelf: false, emitEvent: true });
    this.lenderForm.updateValueAndValidity({
      onlySelf: false,
      emitEvent: true,
    });

    // Debug logging
    console.log(
      'Form values updated with states:',
      this.selectedStates.map((s) => s.stateValue)
    );
    console.log('Lending footprint updated:', selectedStateAbbreviations);
  }
  toggleAllStates(): void {
    const shouldSelectAll =
      this.footprintLocation.length > this.selectedStates.length;

    if (shouldSelectAll) {
      this.footprintLocation.forEach((state) => {
        if (!this.isStateSelected(state.value)) {
          this.selectedStates.push({
            stateValue: state.value,
            stateName: state.name,
            counties: state.subcategories.map((county) => ({
              value: county.value,
              name: county.name,
              selected: false,
            })),
            allCountiesSelected: false,
          });
        }
      });
    } else {
      this.selectedStates = [];
    }

    this.updateFormValues();
  }

  areAllStatesSelected(): boolean {
    return this.selectedStates.length === this.footprintLocation.length;
  }

  toggleState(stateValue: string): void {
    const stateIndex = this.selectedStates.findIndex(
      (s) => s.stateValue === stateValue
    );

    if (stateIndex !== -1) {
      this.selectedStates.splice(stateIndex, 1);
      const statesGroup = this.lenderForm.get(
        'footprintInfo.states'
      ) as FormGroup;
      if (statesGroup && statesGroup.get(stateValue)) {
        statesGroup.get(stateValue)?.setValue(false);
      }
    } else {
      const state = this.footprintLocation.find((s) => s.value === stateValue);
      if (state) {
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

        const statesGroup = this.lenderForm.get(
          'footprintInfo.states'
        ) as FormGroup;
        if (statesGroup && statesGroup.get(stateValue)) {
          statesGroup.get(stateValue)?.setValue(true);
        }

        this.expandedState = stateValue;
      }
    }

    this.updateFormValues();

    // Add debugging output
    console.log('State toggled:', stateValue);
    console.log(
      'Selected states:',
      this.selectedStates.map((s) => s.stateValue)
    );

    // Force validation on the parent form
    const statesGroup = this.lenderForm.get(
      'footprintInfo.states'
    ) as FormGroup;
    statesGroup.updateValueAndValidity({ onlySelf: false, emitEvent: true });

    // Important - we need to trigger validation at the parent form level
    this.lenderForm.updateValueAndValidity({
      onlySelf: false,
      emitEvent: true,
    });

    // Log validation state to debug
    console.log('Form valid after state toggle:', this.lenderForm.valid);
    console.log('States group valid:', statesGroup.valid);
    console.log('States group errors:', statesGroup.errors);
  }

  toggleCounty(stateValue: string, countyValue: string): void {
    const state = this.selectedStates.find((s) => s.stateValue === stateValue);
    if (!state) return;

    const county = state.counties.find((c) => c.value === countyValue);
    if (!county) return;

    county.selected = !county.selected;
    state.allCountiesSelected = state.counties.every((c) => c.selected);

    const statesGroup = this.lenderForm.get(
      'footprintInfo.states'
    ) as FormGroup;
    const countiesGroup = statesGroup.get(
      `${stateValue}_counties`
    ) as FormGroup;
    if (countiesGroup && countiesGroup.get(countyValue)) {
      countiesGroup.get(countyValue)?.setValue(county.selected);
    }

    this.updateFormValues();
  }

  toggleAllCounties(stateValue: string): void {
    const state = this.selectedStates.find((s) => s.stateValue === stateValue);
    if (!state) return;

    state.allCountiesSelected = !state.allCountiesSelected;
    state.counties.forEach((county) => {
      county.selected = state.allCountiesSelected;
    });

    const statesGroup = this.lenderForm.get(
      'footprintInfo.states'
    ) as FormGroup;
    const countiesGroup = statesGroup.get(
      `${stateValue}_counties`
    ) as FormGroup;
    if (countiesGroup) {
      state.counties.forEach((county) => {
        countiesGroup.get(county.value)?.setValue(county.selected);
      });
    }

    this.updateFormValues();
  }

  toggleDropdown(stateValue: string): void {
    this.expandedState = this.expandedState === stateValue ? null : stateValue;
    event?.stopPropagation();
  }

  isStateSelected(stateValue: string): boolean {
    return this.selectedStates.some((s) => s.stateValue === stateValue);
  }

  isCountySelected(stateValue: string, countyValue: string): boolean {
    const state = this.selectedStates.find((s) => s.stateValue === stateValue);
    const county = state?.counties.find((c) => c.value === countyValue);
    return county?.selected || false;
  }

  getSelectedCountiesCount(stateValue: string): number {
    const state = this.selectedStates.find((s) => s.stateValue === stateValue);
    return state ? state.counties.filter((c) => c.selected).length : 0;
  }

  getStateDisplayText(state: FootprintLocation): string {
    const selectedCount = this.getSelectedCountiesCount(state.value);
    const totalCount = state.subcategories.length;

    if (this.isStateSelected(state.value)) {
      if (selectedCount === 0 || selectedCount === totalCount) {
        return `${state.name} (All counties)`;
      } else {
        return `${state.name} (${selectedCount} of ${totalCount} counties)`;
      }
    }

    return state.name;
  }

  hasFormError(errorName: string): boolean {
    return (
      this.lenderForm.hasError(errorName) &&
      (this.lenderForm.touched || this.lenderForm.dirty)
    );
  }
}
