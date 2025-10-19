import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CashOnCashComponent } from './cash-on-cash.component';

describe('CashOnCashComponent', () => {
  let component: CashOnCashComponent;
  let fixture: ComponentFixture<CashOnCashComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CashOnCashComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CashOnCashComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
