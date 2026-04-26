import { Routes } from '@angular/router';

export const PROFILE_ROUTES: Routes = [
  {
    path: 'profile',
    loadComponent: () => import('./pages/overview/profile.component').then(m => m.ProfileComponent)
  }
];
