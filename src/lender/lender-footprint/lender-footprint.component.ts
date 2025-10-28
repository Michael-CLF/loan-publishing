import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  AbstractControl,
  ValidationErrors,
  FormArray,
  FormControl,
} from '@angular/forms';
import { LocationService } from '../../services/location.service';
import {
  FootprintLocation,
} from '../../models/footprint-location.model';

interface SelectionCounty {
  value: string;
  name: string;
  selected: boolean;
}

interface SelectionState {
  stateValue: string;
  stateName: string;
  counties: SelectionCounty[];
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
  // Parent passes footprintInfoGroup here
  @Input() lenderForm!: FormGroup;

  // Parent passes states list here
  @Input() footprintLocation: {
    value: string;
    name: string;
    subcategories: { value: string; name: string }[];
  }[] = [];

  // local UI model of what the user has checked
  selectedStates: SelectionState[] = [];
  expandedState: string | null = null;

  constructor(
    private fb: FormBuilder,
    private locationService: LocationService
  ) {}

  ngOnInit(): void {
    // make sure lenderForm has the structure footprintInfo needs:
    // { lendingFootprint: string[], states: { [abbr]: boolean, [abbr]_counties: {...} } }
    this.ensureFootprintControls();

    // create state + county controls under states group where missing
    this.initializeFormStructure();

    // hydrate selectedStates[] from the form values
    this.initializeSelectedStates();

    // push validity up so parent Next button can read lenderForm.get('footprintInfo')?.invalid
    this.lenderForm.updateValueAndValidity({ onlySelf: false, emitEvent: true });
  }

  // Ensure baseline shape:
  // lenderForm.lendingFootprint: FormArray<string> OR string[] stored in a FormControl
  // lenderForm.states: FormGroup containing per-state booleans and nested county groups
  private ensureFootprintControls(): void {
    // lendingFootprint
    if (!this.lenderForm.get('lendingFootprint')) {
      // final shape in Firestore is an array of state codes
      this.lenderForm.addControl('lendingFootprint', this.fb.control([]));
    }

    // states
    let statesCtrl = this.lenderForm.get('states');
    if (!statesCtrl) {
      this.lenderForm.addControl('states', this.fb.group({}));
      statesCtrl = this.lenderForm.get('states');
    } else if (!(statesCtrl instanceof FormGroup)) {
      // If something weird got in here, normalize it
      const rawVal: any = statesCtrl.value;
      const newStatesGroup = this.fb.group({});
      if (rawVal && typeof rawVal === 'object') {
        Object.keys(rawVal).forEach(key => {
          if (typeof rawVal[key] === 'boolean') {
            newStatesGroup.addControl(key, this.fb.control(!!rawVal[key]));
          }
        });
      }
      this.lenderForm.removeControl('states');
      this.lenderForm.addControl('states', newStatesGroup);
    }
  }

  // Build per-state checkbox controls and per-county checkbox controls
  private initializeFormStructure(): void {
    const statesGroup = this.lenderForm.get('states') as FormGroup;

    this.footprintLocation.forEach((state) => {
      // top-level state toggle boolean
      if (!statesGroup.get(state.value)) {
        statesGroup.addControl(state.value, this.fb.control(false));
      }

      // nested counties group for this state
      const countiesGroupName = `${state.value}_counties`;
      if (!statesGroup.get(countiesGroupName)) {
        const countiesGroup = this.fb.group({});
        state.subcategories.forEach((county) => {
          countiesGroup.addControl(county.value, this.fb.control(false));
        });
        statesGroup.addControl(countiesGroupName, countiesGroup);
      }
    });

    // attach validator for "at least one state"
    statesGroup.setValidators(this.atLeastOneStateValidator());
    statesGroup.updateValueAndValidity({ emitEvent: true });
  }

  // Hydrate UI state (selectedStates[]) from FormGroup values
  private initializeSelectedStates(): void {
    const statesGroup = this.lenderForm.get('states') as FormGroup;
    const lendingFootprint: string[] =
      this.lenderForm.get('lendingFootprint')?.value || [];

    this.selectedStates = [];

    const addStateFromValue = (abbr: string) => {
      const def = this.footprintLocation.find((s) => s.value === abbr);
      if (!def) return;

      const countiesFormGroup = statesGroup.get(
        `${abbr}_counties`
      ) as FormGroup;

      const counties: SelectionCounty[] = def.subcategories.map((county) => ({
        value: county.value,
        name: county.name,
        selected: !!countiesFormGroup?.get(county.value)?.value,
      }));

      const allSelected =
        counties.length > 0 && counties.every((c) => c.selected);

      this.selectedStates.push({
        stateValue: abbr,
        stateName: def.name,
        counties,
        allCountiesSelected: allSelected,
      });
    };

    // from boolean map
    Object.keys(statesGroup.controls)
      .filter((key) => !key.includes('_counties'))
      .forEach((stateKey) => {
        const picked = statesGroup.get(stateKey)?.value === true;
        if (picked) {
          addStateFromValue(stateKey);
        }
      });

    // from lendingFootprint array, fill any missing
    lendingFootprint.forEach((abbr) => {
      if (!this.selectedStates.some((s) => s.stateValue === abbr)) {
        addStateFromValue(abbr);
      }
    });
  }

  // validator for statesGroup
  private atLeastOneStateValidator(): ValidatorFn {
    return (ctrl: AbstractControl): ValidationErrors | null => {
      const group = ctrl as FormGroup;
      if (!group) return { noStateSelected: true };

      const anyStateSelected = Object.keys(group.controls)
        .filter((key) => !key.includes('_counties'))
        .some((key) => group.get(key)?.value === true);

      return anyStateSelected ? null : { noStateSelected: true };
    };
  }

  // sync selectedStates[] back into the form
  private updateFormValues(): void {
    const statesGroup = this.lenderForm.get('states') as FormGroup;
    if (!statesGroup) return;

    // clear all state booleans
    Object.keys(statesGroup.controls)
      .filter((key) => !key.includes('_counties'))
      .forEach((abbr) => {
        statesGroup.get(abbr)?.setValue(false, { emitEvent: false });
      });

    // clear all county booleans
    Object.keys(statesGroup.controls)
      .filter((key) => key.endsWith('_counties'))
      .forEach((countiesKey) => {
        const countiesGroup = statesGroup.get(countiesKey) as FormGroup;
        Object.keys(countiesGroup.controls).forEach((cKey) => {
          countiesGroup
            .get(cKey)
            ?.setValue(false, { emitEvent: false });
        });
      });

    // set all currently selected back into form
    this.selectedStates.forEach((stateSel) => {
      // state toggle
      statesGroup
        .get(stateSel.stateValue)
        ?.setValue(true, { emitEvent: false });

      // counties
      const countiesGroup = statesGroup.get(
        `${stateSel.stateValue}_counties`
      ) as FormGroup;

      stateSel.counties.forEach((county) => {
        countiesGroup
          ?.get(county.value)
          ?.setValue(county.selected, { emitEvent: false });
      });
    });

    // update lendingFootprint array of state abbreviations
    const abbreviations = this.selectedStates.map((s) => s.stateValue);
    this.lenderForm
      .get('lendingFootprint')
      ?.setValue(abbreviations, { emitEvent: false });

    // mark dirty/touched so validation bubbles to parent
    this.lenderForm.markAsDirty();
    this.lenderForm.markAsTouched();

    // force validation
    statesGroup.updateValueAndValidity({ onlySelf: false, emitEvent: true });
    this.lenderForm.updateValueAndValidity({ onlySelf: false, emitEvent: true });

    console.log('🌎 Selected states:', abbreviations);
    console.log('✅ footprint valid:', this.lenderForm.valid);
    console.log('ℹ️ statesGroup errors:', statesGroup.errors);
  }

  // -----------------------------
  // UI helpers used in template
  // -----------------------------

  areAllStatesSelected(): boolean {
    return (
      this.selectedStates.length === this.footprintLocation.length &&
      this.footprintLocation.length > 0
    );
  }

  isStateSelected(stateValue: string): boolean {
    return this.selectedStates.some((s) => s.stateValue === stateValue);
  }

  isCountySelected(stateValue: string, countyValue: string): boolean {
    const st = this.selectedStates.find((s) => s.stateValue === stateValue);
    const c = st?.counties.find((cc) => cc.value === countyValue);
    return !!c?.selected;
  }

  getSelectedCountiesCount(stateValue: string): number {
    const st = this.selectedStates.find((s) => s.stateValue === stateValue);
    return st ? st.counties.filter((c) => c.selected).length : 0;
  }

  getStateDisplayText(state: FootprintLocation): string {
    const selCount = this.getSelectedCountiesCount(state.value);
    const total = state.subcategories.length;

    if (this.isStateSelected(state.value)) {
      if (selCount === 0 || selCount === total) {
        return `${state.name} (All counties)`;
      } else {
        return `${state.name} (${selCount} / ${total})`;
      }
    }

    return state.name;
  }

  hasFormError(errorName: string): boolean {
    // validator sets { noStateSelected: true } on states group
    const statesGroup = this.lenderForm.get('states') as FormGroup;
    return (
      !!statesGroup?.errors?.[errorName] &&
      (this.lenderForm.touched || this.lenderForm.dirty)
    );
  }

  // -----------------------------
  // click handlers wired in template
  // -----------------------------

  toggleAllStates(): void {
    const selectAll = !this.areAllStatesSelected();

    if (selectAll) {
      // select every state with all counties unselected initially
      this.selectedStates = this.footprintLocation.map((st) => ({
        stateValue: st.value,
        stateName: st.name,
        counties: st.subcategories.map((cty) => ({
          value: cty.value,
          name: cty.name,
          selected: false,
        })),
        allCountiesSelected: false,
      }));
    } else {
      // clear all
      this.selectedStates = [];
    }

    this.expandedState = null;
    this.updateFormValues();
  }

  toggleState(stateValue: string): void {
    const idx = this.selectedStates.findIndex(
      (s) => s.stateValue === stateValue
    );

    if (idx !== -1) {
      // deselect state
      this.selectedStates.splice(idx, 1);
      if (this.expandedState === stateValue) {
        this.expandedState = null;
      }
    } else {
      // select state
      const stDef = this.footprintLocation.find((s) => s.value === stateValue);
      if (stDef) {
        this.selectedStates.push({
          stateValue,
          stateName: stDef.name,
          counties: stDef.subcategories.map((cty) => ({
            value: cty.value,
            name: cty.name,
            selected: false,
          })),
          allCountiesSelected: false,
        });
        this.expandedState = stateValue;
      }
    }

    this.updateFormValues();
  }

  toggleDropdown(stateValue: string): void {
    this.expandedState = this.expandedState === stateValue ? null : stateValue;
    event?.stopPropagation();
  }

  toggleCounty(stateValue: string, countyValue: string): void {
    const st = this.selectedStates.find((s) => s.stateValue === stateValue);
    if (!st) return;

    const c = st.counties.find((cc) => cc.value === countyValue);
    if (!c) return;

    c.selected = !c.selected;
    st.allCountiesSelected = st.counties.every((cc) => cc.selected);

    this.updateFormValues();
  }

  toggleAllCounties(stateValue: string): void {
    const st = this.selectedStates.find((s) => s.stateValue === stateValue);
    if (!st) return;

    const newVal = !st.allCountiesSelected;
    st.allCountiesSelected = newVal;
    st.counties.forEach((cty) => {
      cty.selected = newVal;
    });

    this.updateFormValues();
  }
  // Returns true if that state's "all counties selected" flag is true
isAllCountiesSelected(stateValue: string): boolean {
  const st = this.selectedStates.find(s => s.stateValue === stateValue);
  return !!st && st.allCountiesSelected === true;
}

}
