import { Routes } from '@angular/router';

// Loaded under `path: 'help'` in app.routes.ts — `path: ''` maps to /help.
export const HELP_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/help-center-user/help-center-user.component').then(m => m.HelpCenterUserComponent)
  }
];
