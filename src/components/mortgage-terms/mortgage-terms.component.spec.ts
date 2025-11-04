import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MortgageTermsComponent } from './mortgage-terms.component';

describe('MortgageTermsComponent', () => {
  let component: MortgageTermsComponent;
  let fixture: ComponentFixture<MortgageTermsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MortgageTermsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MortgageTermsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
