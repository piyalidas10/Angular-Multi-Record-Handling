import {
  ChangeDetectionStrategy,
  Component,
  signal
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import {
  debounceTime,
  distinctUntilChanged,
  switchMap
} from 'rxjs/operators';

import { CustomerService } from '../../core/services/customer.service';

import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

@Component({
  selector: 'app-customer-select',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatInputModule,
    MatAutocompleteModule
  ],
  templateUrl: './customer-select.component.html',
  styleUrls: ['./customer-select.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerSelectComponent {

  searchControl = new FormControl('');

  customers = signal<any[]>([]);

  constructor(
    private customerService: CustomerService
  ) {

    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(term =>
          this.customerService.searchCustomers(
            term ?? ''
          )
        )
      )
      .subscribe((data: any) => {
        this.customers.set(data);
      });
  }

  trackById(index: number, item: any) {
    return item.id;
  }
}