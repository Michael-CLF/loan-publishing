// src/app/models/user.model.ts
export interface User {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  phone: string;
  city: string;
  state: string;
  createdAt: Date;
}
