import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FirebaseVideoComponent } from './firebase-video.component';

describe('FirebaseVideoComponent', () => {
  let component: FirebaseVideoComponent;
  let fixture: ComponentFixture<FirebaseVideoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FirebaseVideoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FirebaseVideoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
