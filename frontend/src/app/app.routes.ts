import { Routes } from '@angular/router';

export const routes: Routes = [
    { 
        path: '', 
        redirectTo: 'records', 
        pathMatch: 'full' 
    },
    {
        path: 'records',
        loadComponent: () =>
            import('./features/records-shell/records-shell.component').then(m => m.RecordsShellComponent)
    }
];
