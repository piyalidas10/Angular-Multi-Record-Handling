import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of, delay } from 'rxjs';
import { RecordItem, PagedResult } from '../models/records.model';

/**
 * Mock Backend Interceptor
 *
 * Intercepts requests to /api/records and returns synthetic paged data so the
 * entire records feature works standalone without a real backend.
 *
 * Wire it in main.ts (before the token interceptor):
 *   withInterceptors([mockRecordsInterceptor, …])
 *
 * Remove / comment out once you connect a real API.
 */

// ── Generate a realistic dataset ─────────────────────────────────────────────
const CATEGORIES  = ['Finance', 'HR', 'Operations', 'Legal', 'IT'];
const STATUSES    = ['active', 'inactive', 'pending'] as const;
const FIRST_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Hank'];
const LAST_NAMES  = ['Smith', 'Jones', 'Brown', 'Wilson', 'Taylor', 'Davis', 'Clark'];

function seed(n: number): number {
  // Simple deterministic pseudo-random based on index
  return ((n * 1664525 + 1013904223) >>> 0) / 4294967296;
}

function generateDataset(count: number): RecordItem[] {
  return Array.from({ length: count }, (_, i) => {
    const s = seed(i);
    const s2 = seed(i + 99999);
    const dayOffset = Math.floor(seed(i + 500000) * 730); // 0–2 years ago
    const created = new Date(Date.now() - dayOffset * 86400000).toISOString();
    return {
      id:        i + 1,
      name:      `${FIRST_NAMES[Math.floor(s * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(s2 * LAST_NAMES.length)]} #${i + 1}`,
      category:  CATEGORIES[Math.floor(seed(i + 1000) * CATEGORIES.length)],
      status:    STATUSES[Math.floor(seed(i + 2000) * STATUSES.length)],
      amount:    Math.round(seed(i + 3000) * 99000 + 1000) / 100,
      createdAt: created,
      updatedAt: created
    };
  });
}

// Pre-build once (5 million rows; adjust as needed)
const TOTAL_RECORDS = 5_000_000;
// We don't actually materialise 5M rows in memory for the mock;
// we synthesise them on-demand per page to keep memory bounded.

function getPage(
  page: number,
  pageSize: number,
  sortField: string,
  sortDir: string,
  filters: Record<string, string>
): PagedResult<RecordItem> {
  // For the mock, generate a window of rows around the requested page
  // so sorting/filtering can be applied without materialising the full set.
  const MOCK_WINDOW = Math.min(pageSize * 10, 5000);
  const windowStart = Math.max(0, page * pageSize - MOCK_WINDOW);
  const raw = generateDataset(MOCK_WINDOW).map((r, i) => ({
    ...r,
    id: windowStart + i + 1
  }));

  // Apply filters
  let filtered = raw.filter(r => {
    if (filters['search']) {
      const q = filters['search'].toLowerCase();
      if (!r.name.toLowerCase().includes(q) &&
          !r.category.toLowerCase().includes(q) &&
          !String(r.id).includes(q)) return false;
    }
    if (filters['category'] && r.category !== filters['category']) return false;
    if (filters['status']   && r.status   !== filters['status'])   return false;
    if (filters['amountMin'] && r.amount < +filters['amountMin']) return false;
    if (filters['amountMax'] && r.amount > +filters['amountMax']) return false;
    return true;
  });

  // Apply sort
  if (sortField) {
    const dir = sortDir === 'desc' ? -1 : 1;
    filtered = [...filtered].sort((a, b) => {
      const av = (a as any)[sortField];
      const bv = (b as any)[sortField];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }

  const totalItems = TOTAL_RECORDS; // report the full virtual count
  const totalPages = Math.ceil(totalItems / pageSize);
  const start      = 0;
  const end        = Math.min(pageSize, filtered.length);
  const data       = filtered.slice(start, end);

  return { data, totalItems, page, pageSize, totalPages };
}

// ── Interceptor function ─────────────────────────────────────────────────────
export const mockRecordsInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/records') || req.method !== 'GET') {
    return next(req);
  }

  const p        = req.params;
  const page     = +(p.get('page')     ?? 0);
  const pageSize = +(p.get('pageSize') ?? 50);
  const sortField = p.get('sortField') ?? 'name';
  const sortDir   = p.get('sortDir')   ?? 'asc';
  const filters: Record<string, string> = {};
  for (const key of ['search', 'category', 'status', 'amountMin', 'amountMax', 'dateFrom', 'dateTo']) {
    const v = p.get(key);
    if (v) filters[key] = v;
  }

  const result = getPage(page, pageSize, sortField, sortDir, filters);

  return of(new HttpResponse({ status: 200, body: result })).pipe(
    delay(80 + Math.random() * 60)  // simulate ~80–140 ms network latency
  );
};

// Made with Bob
