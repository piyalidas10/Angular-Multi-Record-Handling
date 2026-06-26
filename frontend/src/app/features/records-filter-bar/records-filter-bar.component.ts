import {
  ChangeDetectionStrategy, Component, inject,
  input, output, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FilterParams, SortParams, SortDirection } from '../models/records.model';

export interface FilterChangeEvent {
  filters: FilterParams;
  sort: SortParams;
}

const SORT_FIELDS = [
  { value: 'name',      label: 'Name' },
  { value: 'category',  label: 'Category' },
  { value: 'status',    label: 'Status' },
  { value: 'amount',    label: 'Amount' },
  { value: 'createdAt', label: 'Created' },
] as const;

const STATUSES = ['active', 'inactive', 'pending'] as const;
const CATEGORIES = ['Finance', 'HR', 'Operations', 'Legal', 'IT'] as const;

/**
 * Filter & Sort Bar Component
 *
 * ChangeDetectionStrategy.OnPush — only re-renders when:
 *   - An input signal reference changes.
 *   - A signal used inside the template is mutated.
 *   - An event the component itself triggers.
 *
 * Emits a single `filterChange` output whenever any field changes
 * (debounced 300 ms for the free-text search field).
 */
@Component({
  selector: 'app-records-filter-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <form [formGroup]="form" class="filter-bar">

      <!-- Free-text search -->
      <div class="field">
        <label for="search">Search</label>
        <input id="search" type="text" formControlName="search"
               placeholder="ID, name, category…" autocomplete="off"/>
      </div>

      <!-- Category -->
      <div class="field">
        <label for="category">Category</label>
        <select id="category" formControlName="category">
          <option value="">All</option>
          @for (c of categories; track c) {
            <option [value]="c">{{ c }}</option>
          }
        </select>
      </div>

      <!-- Status -->
      <div class="field">
        <label for="status">Status</label>
        <select id="status" formControlName="status">
          <option value="">All</option>
          @for (s of statuses; track s) {
            <option [value]="s">{{ s | titlecase }}</option>
          }
        </select>
      </div>

      <!-- Amount range -->
      <div class="field field--range">
        <label>Amount</label>
        <input type="number" formControlName="amountMin" placeholder="Min"/>
        <span>–</span>
        <input type="number" formControlName="amountMax" placeholder="Max"/>
      </div>

      <!-- Sort field -->
      <div class="field">
        <label for="sortField">Sort by</label>
        <select id="sortField" formControlName="sortField">
          @for (sf of sortFields; track sf.value) {
            <option [value]="sf.value">{{ sf.label }}</option>
          }
        </select>
      </div>

      <!-- Sort direction -->
      <div class="field field--dir">
        <button type="button"
                class="dir-btn"
                [class.active]="form.value.sortDir === 'asc'"
                (click)="setDir('asc')"
                title="Ascending">↑ Asc</button>
        <button type="button"
                class="dir-btn"
                [class.active]="form.value.sortDir === 'desc'"
                (click)="setDir('desc')"
                title="Descending">↓ Desc</button>
      </div>

      <!-- Reset -->
      <button type="button" class="reset-btn" (click)="reset()">Reset</button>

      <!-- Result count -->
      @if (totalItems() > 0) {
        <span class="result-count">
          {{ totalItems() | number }} records
        </span>
      }
    </form>
  `,
  styles: [`
    .filter-bar {
      display: flex; flex-wrap: wrap; align-items: flex-end;
      gap: .6rem .75rem; padding: .75rem 1rem;
      background: #f7f8fa; border-bottom: 1px solid #e5e7eb;
    }
    .field { display: flex; flex-direction: column; gap: .2rem; }
    .field label { font-size: .75rem; font-weight: 600; color: #57606a; }
    input, select {
      padding: .35rem .6rem; font-size: .85rem;
      border: 1px solid #d1d5db; border-radius: 4px;
      background: #fff; color: #1f2328; min-width: 120px;
    }
    input:focus, select:focus {
      outline: 2px solid #3b82d4; outline-offset: 1px;
    }
    .field--range { flex-direction: row; align-items: flex-end; gap: .3rem; }
    .field--range input { min-width: 70px; }
    .field--range label { position: absolute; opacity: 0; pointer-events: none; }
    .field--dir { flex-direction: row; gap: .3rem; align-items: flex-end; }
    .dir-btn {
      padding: .35rem .65rem; font-size: .82rem;
      border: 1px solid #d1d5db; border-radius: 4px;
      background: #fff; cursor: pointer; color: #1f2328;
    }
    .dir-btn.active { background: #3b82d4; color: #fff; border-color: #3b82d4; }
    .reset-btn {
      padding: .35rem .85rem; font-size: .82rem;
      border: 1px solid #e5e7eb; border-radius: 4px;
      background: #fff; cursor: pointer; color: #57606a;
      align-self: flex-end;
    }
    .reset-btn:hover { background: #f3f4f6; }
    .result-count {
      align-self: flex-end; font-size: .8rem;
      color: #57606a; padding-bottom: .35rem;
    }
  `]
})
export class RecordsFilterBarComponent implements OnInit {
  readonly totalItems = input<number>(0);
  readonly filterChange = output<FilterChangeEvent>();

  readonly sortFields  = SORT_FIELDS;
  readonly statuses    = STATUSES;
  readonly categories  = CATEGORIES;

  private readonly fb = inject(FormBuilder);

  form!: FormGroup;

  private readonly DEFAULTS = {
    search:    '',
    category:  '',
    status:    '',
    amountMin: null as number | null,
    amountMax: null as number | null,
    sortField: 'name',
    sortDir:   'asc' as SortDirection
  };

  ngOnInit(): void {
    this.form = this.fb.group({ ...this.DEFAULTS });

    // Debounce only the search field; all others emit immediately
    const search$ = this.form.get('search')!.valueChanges.pipe(
      debounceTime(300), distinctUntilChanged()
    );

    // Re-subscribe after reset so we always get a fresh merge
    this.form.valueChanges.pipe(
      debounceTime(0),          // one tick – batch same-frame changes
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      takeUntilDestroyed()
    ).subscribe(() => this.emit());
  }

  setDir(dir: SortDirection): void {
    this.form.patchValue({ sortDir: dir });
  }

  reset(): void {
    this.form.reset(this.DEFAULTS);
  }

  private emit(): void {
    const v = this.form.value;
    const filters: FilterParams = {
      ...(v.search    ? { search:    v.search }    : {}),
      ...(v.category  ? { category:  v.category }  : {}),
      ...(v.status    ? { status:    v.status }    : {}),
      ...(v.amountMin != null ? { amountMin: +v.amountMin } : {}),
      ...(v.amountMax != null ? { amountMax: +v.amountMax } : {})
    };
    const sort: SortParams = {
      field: v.sortField,
      direction: v.sortDir
    };
    this.filterChange.emit({ filters, sort });
  }
}

// Made with Bob
