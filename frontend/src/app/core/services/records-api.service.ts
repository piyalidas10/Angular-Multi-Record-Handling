import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { PageRequest, PagedResult, RecordItem } from '../models/records.model';
import { RecordsCacheService } from './records-cache.service';

/**
 * Records API Service
 *
 * Delegates all pagination, filtering, and sorting to the **backend**.
 * The client only describes *what* it wants; the server does the work.
 *
 * Cache layer:
 *   Each unique (page × pageSize × sort × filters) combination is cached
 *   for CACHE_TTL_MS (1 min) via RecordsCacheService.  Cache hits skip the
 *   HTTP call entirely, returning an `of()` observable synchronously.
 *
 * Backend contract (GET /api/records):
 *   Query params: page, pageSize, sortField, sortDir, search,
 *                 category, status, amountMin, amountMax, dateFrom, dateTo
 *   Response:     PagedResult<RecordItem>
 */
@Injectable({ providedIn: 'root' })
export class RecordsApiService {
  private readonly API = '/api/records';
  private readonly http  = inject(HttpClient);
  private readonly cache = inject(RecordsCacheService);

  // ── Paginated fetch ─────────────────────────────────────────────────────────

  getPage(request: PageRequest): Observable<PagedResult<RecordItem>> {
    // 1. Cache hit – return immediately, no network round-trip
    const cached = this.cache.get(request);
    if (cached) return of(cached);

    // 2. Build query params
    const params = this.buildParams(request);

    // 3. HTTP GET → cache the result
    return this.http
      .get<PagedResult<RecordItem>>(this.API, { params })
      .pipe(
        tap(result => this.cache.set(request, result)),
        catchError(err => {
          console.error('[RecordsApiService] getPage failed:', err);
          throw err;
        })
      );
  }

  /** Prefetch the next page in the background (fire-and-forget). */
  prefetchPage(request: PageRequest): void {
    const next = { ...request, page: request.page + 1 };
    if (this.cache.get(next)) return; // already cached
    this.getPage(next).subscribe({ error: () => {} });
  }

  // ── Mutations ───────────────────────────────────────────────────────────────

  createRecord(payload: Partial<RecordItem>): Observable<RecordItem> {
    return this.http.post<RecordItem>(this.API, payload).pipe(
      tap(() => this.cache.clear())  // any write invalidates the full cache
    );
  }

  updateRecord(id: number, payload: Partial<RecordItem>): Observable<RecordItem> {
    return this.http.put<RecordItem>(`${this.API}/${id}`, payload).pipe(
      tap(() => this.cache.clear())
    );
  }

  deleteRecord(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`).pipe(
      tap(() => this.cache.clear())
    );
  }

  // ── Params builder ──────────────────────────────────────────────────────────

  private buildParams(req: PageRequest): HttpParams {
    let p = new HttpParams()
      .set('page',     req.page)
      .set('pageSize', req.pageSize);

    if (req.sort) {
      p = p.set('sortField', req.sort.field as string)
           .set('sortDir',   req.sort.direction);
    }

    const f = req.filters ?? {};
    if (f.search)    p = p.set('search',    f.search);
    if (f.category)  p = p.set('category',  f.category);
    if (f.status)    p = p.set('status',    f.status);
    if (f.amountMin != null) p = p.set('amountMin', f.amountMin);
    if (f.amountMax != null) p = p.set('amountMax', f.amountMax);
    if (f.dateFrom)  p = p.set('dateFrom',  f.dateFrom);
    if (f.dateTo)    p = p.set('dateTo',    f.dateTo);

    return p;
  }
}

// Made with Bob
