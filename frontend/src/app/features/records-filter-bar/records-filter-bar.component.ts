import {
  ChangeDetectionStrategy, Component, inject,
  input, output, OnInit,
  DestroyRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FilterParams, SortDirection, SortParams } from '../../core/models/records.model';

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
  templateUrl: './records-filter-bar.component.html',
  styleUrls: ['./records-filter-bar.component.scss']
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

  private destroyRef = inject(DestroyRef);

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
      takeUntilDestroyed(this.destroyRef)
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

