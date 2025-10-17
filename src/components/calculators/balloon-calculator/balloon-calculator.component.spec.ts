import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BalloonCalculatorComponent } from './balloon-calculator.component';

describe('BalloonCalculatorComponent', () => {
  let component: BalloonCalculatorComponent;
  let fixture: ComponentFixture<BalloonCalculatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BalloonCalculatorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BalloonCalculatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
