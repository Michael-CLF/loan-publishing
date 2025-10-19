import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BridgeLoanComponent } from './bridge-loan.component';

describe('BridgeLoanComponent', () => {
  let component: BridgeLoanComponent;
  let fixture: ComponentFixture<BridgeLoanComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BridgeLoanComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BridgeLoanComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
