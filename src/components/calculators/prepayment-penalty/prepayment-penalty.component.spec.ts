import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrepaymentPenaltyComponent } from './prepayment-penalty.component';

describe('PrepaymentPenaltyComponent', () => {
  let component: PrepaymentPenaltyComponent;
  let fixture: ComponentFixture<PrepaymentPenaltyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrepaymentPenaltyComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrepaymentPenaltyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
