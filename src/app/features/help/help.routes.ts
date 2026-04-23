import { Routes } from '@angular/router';

export const HELP_ROUTES: Routes = [
  {
    path: 'help',
    loadComponent: () =>
      import('./pages/help-center-user/help-center-user.component').then(m => m.HelpCenterUserComponent)
  },
  { path: 'help-me', redirectTo: 'help', pathMatch: 'full' }
];
