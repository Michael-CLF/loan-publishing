import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoanFilterComponent } from './loan-filter.component';

describe('LoanFilterComponent', () => {
  let component: LoanFilterComponent;
  let fixture: ComponentFixture<LoanFilterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoanFilterComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoanFilterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
