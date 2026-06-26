// ── Domain entity ─────────────────────────────────────────────────────────────
export interface RecordItem {
  id: number;
  name: string;
  category: string;
  status: 'active' | 'inactive' | 'pending';
  amount: number;
  createdAt: string; // ISO-8601
  updatedAt: string;
  [key: string]: unknown; // allow extra fields from backend
}

// ── Filter & Sort ─────────────────────────────────────────────────────────────
export type SortDirection = 'asc' | 'desc';

export interface SortParams {
  field: keyof RecordItem;
  direction: SortDirection;
}

export interface FilterParams {
  search?: string;
  category?: string;
  status?: RecordItem['status'];
  amountMin?: number;
  amountMax?: number;
  dateFrom?: string;
  dateTo?: string;
}

// ── Pagination ────────────────────────────────────────────────────────────────
export interface PageRequest {
  page: number;      // 0-based
  pageSize: number;
  sort?: SortParams;
  filters?: FilterParams;
}

export interface PagedResult<T> {
  data: T[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ── Cache ─────────────────────────────────────────────────────────────────────
export interface CacheEntry<T> {
  data: T;
  expiresAt: number; // epoch ms
}

export interface RecordsState {
  totalItems: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
}

export const DEFAULT_PAGE_SIZE = 50;
export const CACHE_TTL_MS      = 60_000; // 1 minute per page
export const MAX_CACHE_PAGES   = 20;     // LRU cap

// ── Worker messages ───────────────────────────────────────────────────────────
export type WorkerCommand = 'SORT' | 'FILTER' | 'TRANSFORM';

export interface WorkerRequest {
  id: string;
  command: WorkerCommand;
  payload: {
    records: RecordItem[];
    sort?: SortParams;
    filters?: FilterParams;
  };
}

export interface WorkerResponse {
  id: string;
  records: RecordItem[];
  durationMs: number;
}

// Made with Bob
