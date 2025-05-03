import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RemoveSavedLoanComponent } from './remove-saved-loan.component';

describe('RemoveSavedLoanComponent', () => {
  let component: RemoveSavedLoanComponent;
  let fixture: ComponentFixture<RemoveSavedLoanComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RemoveSavedLoanComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RemoveSavedLoanComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
