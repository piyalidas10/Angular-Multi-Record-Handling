import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';

export interface Customer {
  id: number;
  name: string;
  email: string;
}

@Component({
  selector: 'app-virtual-scrolling',
  standalone: true,
  imports: [
    CommonModule,
    ScrollingModule
  ],
  templateUrl: './virtual-scrolling.component.html',
  styleUrls: ['./virtual-scrolling.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VirtualScrollingComponent implements OnInit {

  customers = signal<Customer[]>([]);

  // Add this method to track items by their unique ID
  trackById(index: number, item: any): number {
    return item.id; // Replace 'id' with your unique identifier property
  }

  ngOnInit(): void {
    this.loadCustomers();
  }

  private loadCustomers(): void {

    const data: Customer[] = [];

    for (let i = 1; i <= 100000; i++) {

      data.push({
        id: i,
        name: `Customer ${i}`,
        email: `customer${i}@demo.com`
      });

    }

    this.customers.set(data);
  }

  trackByCustomerId(
    index: number,
    customer: Customer
  ): number {
    return customer.id;
  }
}