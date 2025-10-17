import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NoiCalculatorComponent } from './noi-calculator.component';

describe('NoiCalculatorComponent', () => {
  let component: NoiCalculatorComponent;
  let fixture: ComponentFixture<NoiCalculatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NoiCalculatorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NoiCalculatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
