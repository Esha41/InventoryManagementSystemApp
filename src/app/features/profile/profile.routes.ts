import { Routes } from '@angular/router';

// Loaded under `path: 'profile'` in app.routes.ts — `path: ''` maps to /profile.
export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/overview/profile.component').then(m => m.ProfileComponent)
  }
];
