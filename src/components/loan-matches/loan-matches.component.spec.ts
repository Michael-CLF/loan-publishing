import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoanMatchesComponent } from './loan-matches.component';

describe('LoanMatchesComponent', () => {
  let component: LoanMatchesComponent;
  let fixture: ComponentFixture<LoanMatchesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoanMatchesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoanMatchesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
