import {
  ChangeDetectionStrategy, Component, NgZone,
  OnDestroy, OnInit, inject, input, output, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { RecordItem, SortParams, SortDirection, WorkerRequest, WorkerResponse } from '../models/records.model';

/**
 * Records Virtual-Scroll Table
 *
 * Renders potentially millions of rows inside a CDK `cdk-virtual-scroll-viewport`
 * so only the ~10–15 rows visible in the viewport are actually in the DOM at any
 * given time.
 *
 * Performance techniques used here:
 *   ChangeDetectionStrategy.OnPush   – re-renders only on input reference changes
 *   trackBy                          – tells Angular how to identity-match rows,
 *                                      preventing unnecessary DOM destruction
 *   CDK Virtual Scroll               – only renders visible rows + small buffer
 *   Web Worker                       – client-side sort/filter (when used without
 *                                      backend filtering) is delegated to a Worker
 *                                      so the main thread never freezes
 */
@Component({
  selector: 'app-records-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ScrollingModule],
  template: `
    <div class="table-wrapper">

      <!-- Header row -->
      <div class="table-header" role="row">
        @for (col of columns; track col.field) {
          <div class="th" role="columnheader"
               [style.flex]="col.flex"
               [class.sortable]="col.sortable"
               (click)="col.sortable && onSortClick(col.field)">
            {{ col.label }}
            @if (currentSort()?.field === col.field) {
              <span class="sort-arrow">
                {{ currentSort()!.direction === 'asc' ? '↑' : '↓' }}
              </span>
            }
          </div>
        }
        <!-- Actions column -->
        <div class="th" role="columnheader" style="flex: 0 0 80px;">Actions</div>
      </div>

      <!-- Virtual scroll body -->
      <cdk-virtual-scroll-viewport
        [itemSize]="ROW_HEIGHT"
        [minBufferPx]="MIN_BUFFER"
        [maxBufferPx]="MAX_BUFFER"
        class="viewport"
        role="rowgroup">

        @if (loading()) {
          <div class="loading-row">Loading…</div>
        } @else if (displayRows().length === 0) {
          <div class="empty-row">No records match your filters.</div>
        } @else {
          <div *cdkVirtualFor="let row of displayRows();
                               trackBy: trackById;
                               templateCacheSize: 30"
               class="tr" role="row"
               [class.row--inactive]="row.status === 'inactive'"
               [class.row--pending]="row.status === 'pending'">

            <div class="td id-col" role="cell">{{ row.id }}</div>
            <div class="td name-col" role="cell" [title]="row.name">{{ row.name }}</div>
            <div class="td" style="flex: 1" role="cell">{{ row.category }}</div>
            <div class="td" role="cell">
              <span class="status-badge status--{{ row.status }}">
                {{ row.status }}
              </span>
            </div>
            <div class="td amount-col" role="cell">
              {{ row.amount | currency:'USD':'symbol':'1.2-2' }}
            </div>
            <div class="td date-col" role="cell">
              {{ row.createdAt | date:'mediumDate' }}
            </div>
            <div class="td" style="flex: 0 0 80px" role="cell">
              <button class="action-btn" (click)="onEdit(row)" title="Edit">✏</button>
              <button class="action-btn action-btn--del" (click)="onDelete(row)" title="Delete">✕</button>
            </div>
          </div>
        }
      </cdk-virtual-scroll-viewport>

      <!-- Worker stats (dev-only hint) -->
      @if (workerStats()) {
        <div class="worker-stats">
          Worker processed {{ workerStats()!.count | number }} rows
          in {{ workerStats()!.durationMs.toFixed(1) }}ms
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; flex: 1 1 auto; overflow: hidden; }
    .table-wrapper { display: flex; flex-direction: column; height: 100%; }
    .table-header {
      display: flex; align-items: center;
      background: #f7f8fa; border-bottom: 2px solid #e5e7eb;
      padding: 0 .5rem; font-size: .78rem; font-weight: 700;
      color: #57606a; text-transform: uppercase; letter-spacing: .04em;
      flex-shrink: 0;
    }
    .th {
      padding: .55rem .5rem; user-select: none;
    }
    .th.sortable { cursor: pointer; }
    .th.sortable:hover { color: #3b82d4; }
    .sort-arrow { margin-left: .2rem; color: #3b82d4; }
    .viewport { flex: 1 1 auto; }
    .tr {
      display: flex; align-items: center;
      padding: 0 .5rem; border-bottom: 1px solid #f0f1f3;
      background: #fff; font-size: .85rem; color: #1f2328;
      transition: background .1s;
    }
    .tr:hover { background: #f7f8fa; }
    .tr.row--inactive { opacity: .55; }
    .tr.row--pending  { background: #fffbeb; }
    .td { padding: .45rem .5rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .id-col     { flex: 0 0 70px;  color: #57606a; }
    .name-col   { flex: 2; }
    .amount-col { flex: 0 0 110px; text-align: right; font-variant-numeric: tabular-nums; }
    .date-col   { flex: 0 0 110px; color: #57606a; }
    .status-badge {
      display: inline-block; padding: .1rem .45rem;
      border-radius: 10px; font-size: .72rem; font-weight: 600;
    }
    .status--active   { background: #d1fae5; color: #065f46; }
    .status--inactive { background: #f3f4f6; color: #57606a; }
    .status--pending  { background: #fef9c3; color: #713f12; }
    .loading-row, .empty-row {
      display: flex; align-items: center; justify-content: center;
      height: 120px; color: #57606a; font-size: .9rem;
    }
    .action-btn {
      padding: .2rem .4rem; font-size: .78rem;
      border: 1px solid #e5e7eb; border-radius: 4px;
      background: transparent; cursor: pointer; color: #57606a;
      margin-right: .2rem;
    }
    .action-btn:hover { background: #f3f4f6; }
    .action-btn--del:hover { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
    .worker-stats {
      font-size: .72rem; color: #57606a; padding: .3rem .75rem;
      border-top: 1px solid #e5e7eb; background: #f7f8fa;
    }
  `]
})
export class RecordsTableComponent implements OnInit, OnDestroy {
  // ── Inputs ────────────────────────────────────────────────────────────────
  /** Full page of records delivered by the shell. */
  readonly rows       = input.required<RecordItem[]>();
  readonly loading    = input<boolean>(false);
  readonly initialSort = input<SortParams>({ field: 'name', direction: 'asc' });

  // ── Outputs ───────────────────────────────────────────────────────────────
  readonly sortChange  = output<SortParams>();
  readonly editRow     = output<RecordItem>();
  readonly deleteRow   = output<RecordItem>();

  // ── Constants ─────────────────────────────────────────────────────────────
  readonly ROW_HEIGHT = 42;  // px  (must match .tr height in CSS)
  readonly MIN_BUFFER = 200; // px rendered above/below the visible area
  readonly MAX_BUFFER = 400;

  readonly columns = [
    { field: 'id',        label: 'ID',       flex: '0 0 70px',  sortable: true  },
    { field: 'name',      label: 'Name',      flex: '2',         sortable: true  },
    { field: 'category',  label: 'Category',  flex: '1',         sortable: true  },
    { field: 'status',    label: 'Status',    flex: '0 0 100px', sortable: true  },
    { field: 'amount',    label: 'Amount',    flex: '0 0 110px', sortable: true  },
    { field: 'createdAt', label: 'Created',   flex: '0 0 110px', sortable: true  },
  ];

  // ── State ─────────────────────────────────────────────────────────────────
  readonly currentSort  = signal<SortParams | null>(null);
  readonly displayRows  = signal<RecordItem[]>([]);
  readonly workerStats  = signal<{ count: number; durationMs: number } | null>(null);

  private worker: Worker | null = null;
  private readonly zone = inject(NgZone);

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.currentSort.set(this.initialSort());
    this.initWorker();
    this.processRows();
  }

  ngOnDestroy(): void {
    this.worker?.terminate();
  }

  // ── TrackBy ────────────────────────────────────────────────────────────────
  trackById(_index: number, row: RecordItem): number {
    return row.id;
  }

  // ── Sort click ─────────────────────────────────────────────────────────────
  onSortClick(field: string): void {
    const current = this.currentSort();
    const direction: SortDirection =
      current?.field === field && current.direction === 'asc' ? 'desc' : 'asc';
    const sort: SortParams = { field: field as keyof RecordItem, direction };
    this.currentSort.set(sort);
    // Notify shell for backend re-fetch
    this.sortChange.emit(sort);
    // Also sort client-side instantly via Worker for perceived speed
    this.processRows(sort);
  }

  onEdit(row: RecordItem): void   { this.editRow.emit(row); }
  onDelete(row: RecordItem): void { this.deleteRow.emit(row); }

  // ── Worker ─────────────────────────────────────────────────────────────────
  private initWorker(): void {
    if (typeof Worker === 'undefined') {
      // Workers not available (SSR / old browser) – run synchronously
      this.displayRows.set(this.rows());
      return;
    }

    this.worker = new Worker(
      new URL('../workers/records.worker', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
      // Re-enter Angular's zone so signal updates trigger change detection
      this.zone.run(() => {
        this.displayRows.set(data.records);
        this.workerStats.set({ count: data.records.length, durationMs: data.durationMs });
      });
    };
  }

  private processRows(sort?: SortParams): void {
    const records = this.rows();
    if (!records?.length) {
      this.displayRows.set([]);
      return;
    }

    if (!this.worker) {
      // Fallback: synchronous sort on main thread
      this.displayRows.set([...records]);
      return;
    }

    const request: WorkerRequest = {
      id:      crypto.randomUUID(),
      command: 'SORT',
      payload: { records, sort: sort ?? this.currentSort() ?? undefined }
    };
    this.worker.postMessage(request);
  }
}

// Made with Bob
