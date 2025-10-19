import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RentVsBuyComponent } from './rent-vs-buy.component';

describe('RentVsBuyComponent', () => {
  let component: RentVsBuyComponent;
  let fixture: ComponentFixture<RentVsBuyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RentVsBuyComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RentVsBuyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
