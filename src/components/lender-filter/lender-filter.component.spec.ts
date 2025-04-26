import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LenderFilterComponent } from './lender-filter.component';

describe('LenderFilterComponent', () => {
  let component: LenderFilterComponent;
  let fixture: ComponentFixture<LenderFilterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LenderFilterComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LenderFilterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
