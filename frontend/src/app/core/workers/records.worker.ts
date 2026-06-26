/// <reference lib="webworker" />
/**
 * Records Web Worker
 *
 * Offloads CPU-intensive sort/filter/transform operations from the main thread
 * so the UI stays responsive even when manipulating tens of thousands of rows.
 *
 * Communication model:
 *   Main → Worker : WorkerRequest  (command + payload)
 *   Worker → Main : WorkerResponse (processed records + wall-clock duration)
 */
import type {
  WorkerRequest, WorkerResponse,
  RecordItem, SortParams, FilterParams
} from '../models/records.model';

addEventListener('message', ({ data }: MessageEvent<WorkerRequest>) => {
  const start = performance.now();
  let records = data.payload.records as RecordItem[];

  switch (data.command) {
    case 'FILTER':
      records = applyFilters(records, data.payload.filters);
      break;
    case 'SORT':
      records = applySort(records, data.payload.sort);
      break;
    case 'TRANSFORM':
      records = applyFilters(records, data.payload.filters);
      records = applySort(records, data.payload.sort);
      break;
  }

  const response: WorkerResponse = {
    id: data.id,
    records,
    durationMs: performance.now() - start
  };
  postMessage(response);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyFilters(records: RecordItem[], filters?: FilterParams): RecordItem[] {
  if (!filters) return records;
  const {
    search, category, status,
    amountMin, amountMax, dateFrom, dateTo
  } = filters;

  const searchLC = search?.toLowerCase().trim();

  return records.filter(r => {
    if (searchLC) {
      const match =
        String(r.id).includes(searchLC) ||
        r.name.toLowerCase().includes(searchLC) ||
        r.category.toLowerCase().includes(searchLC);
      if (!match) return false;
    }
    if (category && r.category !== category) return false;
    if (status   && r.status   !== status)   return false;
    if (amountMin != null && r.amount < amountMin) return false;
    if (amountMax != null && r.amount > amountMax) return false;
    if (dateFrom  && r.createdAt < dateFrom)  return false;
    if (dateTo    && r.createdAt > dateTo)    return false;
    return true;
  });
}

function applySort(records: RecordItem[], sort?: SortParams): RecordItem[] {
  if (!sort) return records;
  const { field, direction } = sort;
  const dir = direction === 'asc' ? 1 : -1;

  return [...records].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (av == null && bv == null) return 0;
    if (av == null) return dir;
    if (bv == null) return -dir;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });
}

// Made with Bob
