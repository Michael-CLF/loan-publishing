import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LenderRegSuccessModalComponent } from './lender-reg-success-modal.component';

describe('LenderRegSuccessModalComponent', () => {
  let component: LenderRegSuccessModalComponent;
  let fixture: ComponentFixture<LenderRegSuccessModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LenderRegSuccessModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LenderRegSuccessModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
