// dashboard.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  standalone: true,
  imports: [CommonModule],
})
export class DashboardComponent implements OnInit {
  userData$!: Observable<any>;

  constructor(
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore
  ) {}

  ngOnInit(): void {
    // Get current user's data from Firestore
    this.userData$ = this.afAuth.authState.pipe(
      switchMap((user) => {
        if (user) {
          // Assuming you store user data in a 'users' collection with document ID matching the user's UID
          return this.firestore
            .collection('users')
            .doc(user.uid)
            .valueChanges();
        } else {
          return [];
        }
      })
    );
  }
}
