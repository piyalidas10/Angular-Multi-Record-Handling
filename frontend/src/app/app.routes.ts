import { Routes } from '@angular/router';

export const routes: Routes = [
    // Default Route (Redirects to /customer-select)
    { 
        path: '', 
        redirectTo: 'customer-select', 
        pathMatch: 'full' 
    },
    {
        path: 'customer-select',
        loadComponent: () =>
            import('./features/customer-select/customer-select.component').then(m => m.CustomerSelectComponent)
    },
    {
        path: 'virtual-scrolling',
        loadComponent: () =>
            import('./features/virtual-scrolling/virtual-scrolling.component').then(m => m.VirtualScrollingComponent)
    }
];
