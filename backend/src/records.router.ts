import { Router, Request, Response, NextFunction } from 'express';
import { db } from './db';

export const recordsRouter = Router();

// ── Types that mirror the Angular frontend models ────────────────────────────

interface RecordRow {
  id: number;
  name: string;
  category: string;
  status: 'active' | 'inactive' | 'pending';
  amount: number;
  created_at: string;
  updated_at: string;
}

interface RecordItem {
  id: number;
  name: string;
  category: string;
  status: 'active' | 'inactive' | 'pending';
  amount: number;
  createdAt: string;
  updatedAt: string;
}

function toItem(row: RecordRow): RecordItem {
  return {
    id:        row.id,
    name:      row.name,
    category:  row.category,
    status:    row.status,
    amount:    row.amount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Allowed sort columns (whitelist to prevent SQL injection) ────────────────
const SORT_COLUMN_MAP: Record<string, string> = {
  id:        'id',
  name:      'name',
  category:  'category',
  status:    'status',
  amount:    'amount',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

// ── GET /api/records ─────────────────────────────────────────────────────────
//
//  Query params (all optional):
//    page        integer, 0-based        default 0
//    pageSize    integer                 default 50
//    sortField   RecordItem key          default "name"
//    sortDir     "asc" | "desc"          default "asc"
//    search      substring (id/name/category)
//    category    exact match
//    status      exact match
//    amountMin   number (inclusive)
//    amountMax   number (inclusive)
//    dateFrom    ISO-8601 (inclusive)
//    dateTo      ISO-8601 (inclusive)
//
//  Response: PagedResult<RecordItem>
//    { data, totalItems, page, pageSize, totalPages }

recordsRouter.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const page      = Math.max(0, parseInt(req.query['page']     as string) || 0);
    const pageSize  = Math.min(500, Math.max(1, parseInt(req.query['pageSize'] as string) || 50));
    const sortField = SORT_COLUMN_MAP[req.query['sortField'] as string] ?? 'name';
    const sortDir   = req.query['sortDir'] === 'desc' ? 'DESC' : 'ASC';

    // ── Build WHERE clause ──────────────────────────────────────────────────
    const conditions: string[] = [];
    const params: unknown[]    = [];

    const search = (req.query['search'] as string | undefined)?.trim();
    if (search) {
      conditions.push(`(name LIKE ? OR category LIKE ? OR CAST(id AS TEXT) LIKE ?)`);
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    const category = req.query['category'] as string | undefined;
    if (category) {
      conditions.push(`category = ?`);
      params.push(category);
    }

    const status = req.query['status'] as string | undefined;
    if (status) {
      conditions.push(`status = ?`);
      params.push(status);
    }

    const amountMin = parseFloat(req.query['amountMin'] as string);
    if (!isNaN(amountMin)) {
      conditions.push(`amount >= ?`);
      params.push(amountMin);
    }

    const amountMax = parseFloat(req.query['amountMax'] as string);
    if (!isNaN(amountMax)) {
      conditions.push(`amount <= ?`);
      params.push(amountMax);
    }

    const dateFrom = req.query['dateFrom'] as string | undefined;
    if (dateFrom) {
      conditions.push(`created_at >= ?`);
      params.push(dateFrom);
    }

    const dateTo = req.query['dateTo'] as string | undefined;
    if (dateTo) {
      conditions.push(`created_at <= ?`);
      params.push(dateTo);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // ── Count total matching rows ───────────────────────────────────────────
    const totalItems = (
      db.prepare(`SELECT COUNT(*) as c FROM records ${where}`).get(...params) as { c: number }
    ).c;

    const totalPages = Math.ceil(totalItems / pageSize);
    const offset     = page * pageSize;

    // ── Fetch page ─────────────────────────────────────────────────────────
    const rows = db
      .prepare(`SELECT * FROM records ${where} ORDER BY ${sortField} ${sortDir} LIMIT ? OFFSET ?`)
      .all(...params, pageSize, offset) as RecordRow[];

    res.json({
      data:       rows.map(toItem),
      totalItems,
      page,
      pageSize,
      totalPages,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/records/:id ─────────────────────────────────────────────────────

recordsRouter.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = db.prepare('SELECT * FROM records WHERE id = ?').get(req.params['id']) as RecordRow | undefined;
    if (!row) return void res.status(404).json({ error: 'Record not found' });
    res.json(toItem(row));
  } catch (err) {
    next(err);
  }
});

// ── POST /api/records ────────────────────────────────────────────────────────
//
//  Body (all required except id):
//    name, category, status, amount

recordsRouter.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, category, status, amount } = req.body as Partial<RecordItem>;

    if (!name || !category || !status || amount == null) {
      return void res.status(400).json({ error: 'name, category, status and amount are required' });
    }

    if (!['active', 'inactive', 'pending'].includes(status)) {
      return void res.status(400).json({ error: 'status must be active | inactive | pending' });
    }

    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO records (name, category, status, amount, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, category, status, amount, now, now);

    const created = db.prepare('SELECT * FROM records WHERE id = ?').get(result.lastInsertRowid) as RecordRow;
    res.status(201).json(toItem(created));
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/records/:id ─────────────────────────────────────────────────────
//
//  Body: any subset of { name, category, status, amount }
//  Partial update — only supplied fields are changed.

recordsRouter.put('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = db.prepare('SELECT * FROM records WHERE id = ?').get(req.params['id']) as RecordRow | undefined;
    if (!existing) return void res.status(404).json({ error: 'Record not found' });

    const body = req.body as Partial<RecordItem>;

    if (body.status && !['active', 'inactive', 'pending'].includes(body.status)) {
      return void res.status(400).json({ error: 'status must be active | inactive | pending' });
    }

    const name     = body.name     ?? existing.name;
    const category = body.category ?? existing.category;
    const status   = body.status   ?? existing.status;
    const amount   = body.amount   ?? existing.amount;
    const now      = new Date().toISOString();

    db.prepare(`
      UPDATE records SET name = ?, category = ?, status = ?, amount = ?, updated_at = ?
      WHERE id = ?
    `).run(name, category, status, amount, now, req.params['id']);

    const updated = db.prepare('SELECT * FROM records WHERE id = ?').get(req.params['id']) as RecordRow;
    res.json(toItem(updated));
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/records/:id ──────────────────────────────────────────────────

recordsRouter.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = db.prepare('DELETE FROM records WHERE id = ?').run(req.params['id']);
    if (result.changes === 0) return void res.status(404).json({ error: 'Record not found' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
