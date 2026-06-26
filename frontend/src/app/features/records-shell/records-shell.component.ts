import {
  ChangeDetectionStrategy, Component, OnInit,
  inject, signal, computed, DestroyRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, switchMap, tap, startWith, debounceTime } from 'rxjs';
import { RecordsFilterBarComponent, FilterChangeEvent } from './records-filter-bar.component';
import { RecordsTableComponent } from './records-table.component';
import { RecordsApiService } from '../services/records-api.service';
import { RecordsCacheService } from '../services/records-cache.service';
import {
  RecordItem, PageRequest, RecordsState,
  SortParams, FilterParams, DEFAULT_PAGE_SIZE
} from '../models/records.model';

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
  template: `
    <div class="shell">

      <!-- ── Header ──────────────────────────────────────────────── -->
      <div class="shell-header">
        <h1 class="shell-title">Records
          @if (state().loading) {
            <span class="loading-badge">Loading…</span>
          }
        </h1>
        <div class="header-meta">
          <span class="cache-hint">Cache: {{ cacheSize() }} pages</span>
          <button class="new-btn" (click)="onNewRecord()">+ New</button>
        </div>
      </div>

      <!-- ── Filter bar ───────────────────────────────────────────── -->
      <app-records-filter-bar
        [totalItems]="state().totalItems"
        (filterChange)="onFilterChange($event)"/>

      <!-- ── Error banner ─────────────────────────────────────────── -->
      @if (state().error) {
        <div class="error-banner" role="alert">
          ⚠ {{ state().error }}
          <button (click)="retryLoad()">Retry</button>
        </div>
      }

      <!-- ── Virtual-scroll table ─────────────────────────────────── -->
      <app-records-table
        [rows]="currentRows()"
        [loading]="state().loading"
        [initialSort]="sort()"
        (sortChange)="onSortChange($event)"
        (editRow)="onEditRow($event)"
        (deleteRow)="onDeleteRow($event)"/>

      <!-- ── Pagination bar ───────────────────────────────────────── -->
      <div class="pagination" aria-label="Pagination">
        <button class="page-btn"
                [disabled]="state().currentPage === 0"
                (click)="goToPage(0)">«</button>
        <button class="page-btn"
                [disabled]="state().currentPage === 0"
                (click)="prevPage()">‹ Prev</button>

        <span class="page-info">
          Page {{ state().currentPage + 1 }} / {{ state().totalPages || 1 }}
          ({{ state().totalItems | number }} total)
        </span>

        <button class="page-btn"
                [disabled]="state().currentPage >= state().totalPages - 1"
                (click)="nextPage()">Next ›</button>
        <button class="page-btn"
                [disabled]="state().currentPage >= state().totalPages - 1"
                (click)="goToPage(state().totalPages - 1)">»</button>

        <!-- Page size selector -->
        <select class="page-size" [value]="pageSize()"
                (change)="onPageSizeChange($event)">
          @for (sz of pageSizes; track sz) {
            <option [value]="sz">{{ sz }} / page</option>
          }
        </select>
      </div>

    </div>

    <!-- ── Edit modal (inline demo) ─────────────────────────────────── -->
    @if (editTarget()) {
      <div class="modal-overlay" (click)="editTarget.set(null)">
        <div class="modal" (click)="$event.stopPropagation()" role="dialog"
             aria-modal="true" aria-label="Edit record">
          <h3>Edit Record #{{ editTarget()!.id }}</h3>
          <p class="modal-name">{{ editTarget()!.name }}</p>
          <div class="modal-actions">
            <button class="page-btn" (click)="saveEdit()">Save</button>
            <button class="page-btn" (click)="editTarget.set(null)">Cancel</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100vh; overflow: hidden;
            font-family: -apple-system, "Segoe UI", system-ui, sans-serif; }
    .shell { display: flex; flex-direction: column; height: 100%; background: #fff; }
    .shell-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: .75rem 1rem; border-bottom: 1px solid #e5e7eb;
      background: #fff; flex-shrink: 0;
    }
    .shell-title { margin: 0; font-size: 1.15rem; font-weight: 700; display: flex; align-items: center; gap: .5rem; }
    .loading-badge {
      font-size: .72rem; font-weight: 600;
      background: #dbeafe; color: #1e40af;
      padding: .15rem .5rem; border-radius: 10px;
    }
    .header-meta { display: flex; align-items: center; gap: .75rem; }
    .cache-hint { font-size: .75rem; color: #57606a; }
    .new-btn {
      padding: .4rem .85rem; font-size: .85rem;
      background: #3b82d4; color: #fff;
      border: none; border-radius: 5px; cursor: pointer;
    }
    .new-btn:hover { background: #2563eb; }
    .error-banner {
      display: flex; align-items: center; gap: .75rem;
      background: #fee2e2; color: #991b1b;
      padding: .6rem 1rem; font-size: .85rem; flex-shrink: 0;
    }
    .error-banner button {
      padding: .2rem .6rem; border: 1px solid #fca5a5;
      border-radius: 4px; background: #fff; color: #991b1b; cursor: pointer;
    }
    app-records-table { flex: 1 1 auto; overflow: hidden; min-height: 0; }
    .pagination {
      display: flex; align-items: center; gap: .5rem;
      padding: .55rem 1rem; border-top: 1px solid #e5e7eb;
      background: #f7f8fa; flex-shrink: 0; flex-wrap: wrap;
    }
    .page-btn {
      padding: .3rem .65rem; font-size: .83rem;
      border: 1px solid #d1d5db; border-radius: 4px;
      background: #fff; cursor: pointer; color: #1f2328;
    }
    .page-btn:hover:not(:disabled) { background: #f3f4f6; }
    .page-btn:disabled { opacity: .4; cursor: not-allowed; }
    .page-info { font-size: .83rem; color: #57606a; padding: 0 .25rem; }
    .page-size {
      padding: .3rem .5rem; font-size: .83rem;
      border: 1px solid #d1d5db; border-radius: 4px;
      background: #fff; margin-left: auto;
    }
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.4);
      display: flex; align-items: center; justify-content: center; z-index: 100;
    }
    .modal {
      background: #fff; border-radius: 8px;
      padding: 1.5rem 2rem; min-width: 320px;
      box-shadow: 0 8px 32px rgba(0,0,0,.15);
    }
    .modal h3 { margin: 0 0 .5rem; }
    .modal-name { color: #57606a; margin: 0 0 1.25rem; }
    .modal-actions { display: flex; gap: .5rem; }
  `]
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
    this.load$.pipe(
      debounceTime(0),       // coalesce rapid signal changes in the same tick
      tap(() => this.state.update(s => ({ ...s, loading: true, error: null }))),
      switchMap(() => {
        const req = this.buildRequest();
        return this.api.getPage(req);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: result => {
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

  private triggerLoad(): void { this.load$.next(); }
}

// Made with Bob
