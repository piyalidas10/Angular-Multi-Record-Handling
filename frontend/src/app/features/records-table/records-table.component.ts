import {
  ChangeDetectionStrategy, Component, NgZone,
  OnDestroy, OnInit, inject, input, output, signal, computed,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { RecordItem, SortParams, SortDirection, WorkerRequest, WorkerResponse } from '../../core/models/records.model';

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
  templateUrl: './records-table.component.html',
  styleUrls: ['./records-table.component.scss']
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


  constructor() {
    effect(() => {
      const rows = this.rows();

      console.log('Rows changed:', rows.length);

      if (rows.length) {
        this.processRows();
      } else {
        this.displayRows.set([]);
      }
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.currentSort.set(this.initialSort());
    this.initWorker();
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
      new URL('../../core/workers/records.worker', import.meta.url),
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
    console.log('rows received', this.rows().length);
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

