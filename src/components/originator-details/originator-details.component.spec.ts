import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OriginatorDetailsComponent } from './originator-details.component';

describe('OriginatorDetailsComponent', () => {
  let component: OriginatorDetailsComponent;
  let fixture: ComponentFixture<OriginatorDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OriginatorDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OriginatorDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
