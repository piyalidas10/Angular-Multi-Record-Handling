import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {

  private cache = new Map<string, any>();

  constructor(private http: HttpClient) {}

  searchCustomers(term: string): Observable<any> {

    if (this.cache.has(term)) {
      return of(this.cache.get(term));
    }

    return this.http
      .get(
        `http://localhost:3000/api/customers?search=${term}`
      )
      .pipe(
        tap(data => this.cache.set(term, data))
      );
  }
}