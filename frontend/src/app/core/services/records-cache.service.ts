import { Injectable, signal } from '@angular/core';
import {
  CacheEntry, PagedResult, PageRequest, RecordItem,
  CACHE_TTL_MS, MAX_CACHE_PAGES
} from '../models/records.model';

/**
 * LRU Page Cache
 *
 * Stores up to MAX_CACHE_PAGES pages in memory keyed by a deterministic
 * string derived from the full PageRequest (page + size + sort + filters).
 *
 * Eviction:
 *   - Entries older than CACHE_TTL_MS (1 min) are treated as stale.
 *   - When the cache exceeds MAX_CACHE_PAGES, the least-recently-used
 *     entry is evicted (Map insertion-order makes this O(1)).
 *
 * The `cacheSize` signal lets components react to cache state for debugging
 * or cache-size display without polling.
 */
@Injectable({ providedIn: 'root' })
export class RecordsCacheService {
  /** Reactive cache-size indicator – useful for dev/debug overlays. */
  readonly cacheSize = signal<number>(0);

  private readonly store = new Map<string, CacheEntry<PagedResult<RecordItem>>>();

  // ── Public API ──────────────────────────────────────────────────────────────

  get(request: PageRequest): PagedResult<RecordItem> | null {
    const key = this.buildKey(request);
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.cacheSize.set(this.store.size);
      return null;
    }

    // LRU: re-insert to move to end (most-recently-used position)
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.data;
  }

  set(request: PageRequest, data: PagedResult<RecordItem>): void {
    const key = this.buildKey(request);

    // Evict LRU entry if at capacity (Map.keys() is insertion-ordered)
    if (this.store.size >= MAX_CACHE_PAGES && !this.store.has(key)) {
      const lruKey = this.store.keys().next().value;
      if (lruKey) this.store.delete(lruKey);
    }

    this.store.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    this.cacheSize.set(this.store.size);
  }

  /** Invalidate a single page. */
  invalidatePage(request: PageRequest): void {
    this.store.delete(this.buildKey(request));
    this.cacheSize.set(this.store.size);
  }

  /** Invalidate all cached pages that share the same filters / sort
   *  (i.e., when a filter changes, stale pages from the old query are gone). */
  invalidateQuery(request: Omit<PageRequest, 'page'>): void {
    const prefix = this.buildQueryPrefix(request);
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
    this.cacheSize.set(this.store.size);
  }

  /** Full cache clear – e.g., after a write mutation. */
  clear(): void {
    this.store.clear();
    this.cacheSize.set(0);
  }

  // ── Key construction ────────────────────────────────────────────────────────

  private buildKey(req: PageRequest): string {
    return `${this.buildQueryPrefix(req)}|p${req.page}`;
  }

  private buildQueryPrefix(req: Omit<PageRequest, 'page'>): string {
    const sort    = req.sort
      ? `${req.sort.field}:${req.sort.direction}`
      : 'nosort';
    const filters = req.filters
      ? JSON.stringify(req.filters, Object.keys(req.filters).sort())
      : 'nofilter';
    return `sz${req.pageSize}|${sort}|${filters}`;
  }
}

// Made with Bob
