import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MortgageResultsComponent } from './mortgage-results.component';

describe('MortgageResultsComponent', () => {
  let component: MortgageResultsComponent;
  let fixture: ComponentFixture<MortgageResultsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MortgageResultsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MortgageResultsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
