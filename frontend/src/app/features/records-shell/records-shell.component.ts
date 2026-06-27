import {
  ChangeDetectionStrategy, Component, OnInit,
  inject, signal, computed, DestroyRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, switchMap, tap, startWith, debounceTime } from 'rxjs';
import { FilterChangeEvent, RecordsFilterBarComponent } from '../records-filter-bar/records-filter-bar.component';
import { RecordsTableComponent } from '../records-table/records-table.component';
import { RecordsApiService } from '../../core/services/records-api.service';
import { RecordsCacheService } from '../../core/services/records-cache.service';
import { DEFAULT_PAGE_SIZE, FilterParams, PageRequest, RecordItem, RecordsState, SortParams } from '../../core/models/records.model';

/**
 * Records Shell Component — Orchestrator
 *
 * Responsibilities:
 *   1. Owns all pagination/filter/sort state as Signals.
 *   2. Derives a PageRequest from those signals and issues it to
 *      RecordsApiService whenever state changes.
 *   3. Prefetches the next page once the current page is returned.
 *   4. Passes data down to child components as inputs (OnPush-compatible).
 *   5. Handles edit / delete events from the table.
 *
 * Data flow:
 *   FilterBar emits → shell updates signals → reactive$ pipeline fires
 *   → API call (possibly cache hit) → page signal updated
 *   → table re-renders only the rows that changed (trackBy).
 */
@Component({
  selector: 'app-records-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RecordsFilterBarComponent, RecordsTableComponent],
  templateUrl: './records-shell.component.html',
  styleUrls: ['./records-shell.component.scss']
})
export class RecordsShellComponent implements OnInit {
  private readonly api       = inject(RecordsApiService);
  private readonly cache     = inject(RecordsCacheService);
  private readonly destroyRef = inject(DestroyRef);

  // ── Pagination / filter / sort signals ────────────────────────────────────
  readonly currentPage = signal<number>(0);
  readonly pageSize    = signal<number>(DEFAULT_PAGE_SIZE);
  readonly sort        = signal<SortParams>({ field: 'name', direction: 'asc' });
  readonly filters     = signal<FilterParams>({});

  // ── Page data ─────────────────────────────────────────────────────────────
  readonly currentRows = signal<RecordItem[]>([]);
  readonly state       = signal<RecordsState>({
    totalItems:  0,
    currentPage: 0,
    pageSize:    DEFAULT_PAGE_SIZE,
    totalPages:  0,
    loading:     false,
    error:       null
  });

  // ── Cache size (from service signal) ─────────────────────────────────────
  readonly cacheSize = this.cache.cacheSize;

  // ── UI state ─────────────────────────────────────────────────────────────
  readonly editTarget = signal<RecordItem | null>(null);

  readonly pageSizes = [25, 50, 100, 200];

  // ── Reactive load pipeline ────────────────────────────────────────────────
  private readonly load$ = new Subject<void>();

  ngOnInit(): void {
    console.log('RecordsShellComponent initialized');
    this.load$.pipe(
      tap(() => console.log('Subject emitted')),
      debounceTime(0),       // coalesce rapid signal changes in the same tick
      tap(() => this.state.update(s => ({ ...s, loading: true, error: null }))),
      switchMap(() => {
        const req = this.buildRequest();
        return this.api.getPage(req);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: result => {
        console.log('Results received', result);
        this.currentRows.set(result.data);
        this.state.set({
          totalItems:  result.totalItems,
          currentPage: result.page,
          pageSize:    result.pageSize,
          totalPages:  result.totalPages,
          loading:     false,
          error:       null
        });
        // Prefetch next page in the background
        this.api.prefetchPage(this.buildRequest());
      },
      error: err => {
        this.state.update(s => ({
          ...s,
          loading: false,
          error: err?.message ?? 'Failed to load records'
        }));
      }
    });

    // Kick off initial load
    this.triggerLoad();
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  onFilterChange(event: FilterChangeEvent): void {
    this.filters.set(event.filters);
    this.sort.set(event.sort);
    this.currentPage.set(0);                    // reset to page 1 on new query
    this.cache.invalidateQuery(this.buildRequest()); // stale pages gone
    this.triggerLoad();
  }

  onSortChange(sort: SortParams): void {
    this.sort.set(sort);
    this.currentPage.set(0);
    this.triggerLoad();
  }

  onPageSizeChange(event: Event): void {
    const sz = +(event.target as HTMLSelectElement).value;
    this.pageSize.set(sz);
    this.currentPage.set(0);
    this.triggerLoad();
  }

  nextPage(): void {
    if (this.state().currentPage < this.state().totalPages - 1) {
      this.currentPage.update(p => p + 1);
      this.triggerLoad();
    }
  }

  prevPage(): void {
    if (this.state().currentPage > 0) {
      this.currentPage.update(p => p - 1);
      this.triggerLoad();
    }
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.triggerLoad();
  }

  retryLoad(): void { this.triggerLoad(); }

  onNewRecord(): void {
    // In a real app, open a create form / modal
    console.log('Create new record');
  }

  onEditRow(row: RecordItem): void  { this.editTarget.set(row); }
  onDeleteRow(row: RecordItem): void {
    if (!confirm(`Delete record #${row.id}?`)) return;
    this.api.deleteRecord(row.id).subscribe({
      next: () => this.triggerLoad(),
      error: err => console.error('Delete failed', err)
    });
  }

  saveEdit(): void {
    const target = this.editTarget();
    if (!target) return;
    this.api.updateRecord(target.id, target).subscribe({
      next: () => { this.editTarget.set(null); this.triggerLoad(); },
      error: err => console.error('Update failed', err)
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private buildRequest(): PageRequest {
    return {
      page:     this.currentPage(),
      pageSize: this.pageSize(),
      sort:     this.sort(),
      filters:  this.filters()
    };
  }

  private triggerLoad(): void {
    console.log('triggerLoad');
    this.load$.next(); 
  }
}

