import Database from 'better-sqlite3';
import path from 'path';

// ── Open / create the SQLite file ────────────────────────────────────────────
const DB_PATH = process.env['DB_PATH'] ?? path.join(__dirname, '..', 'records.db');
export const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ───────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS records (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    category   TEXT    NOT NULL,
    status     TEXT    NOT NULL CHECK(status IN ('active','inactive','pending')),
    amount     REAL    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE INDEX IF NOT EXISTS idx_records_category  ON records(category);
  CREATE INDEX IF NOT EXISTS idx_records_status    ON records(status);
  CREATE INDEX IF NOT EXISTS idx_records_amount    ON records(amount);
  CREATE INDEX IF NOT EXISTS idx_records_created   ON records(created_at);
`);

// ── Seed if empty ─────────────────────────────────────────────────────────────
const SEED_COUNT = 10_000;

function seed(n: number): number {
  return ((n * 1664525 + 1013904223) >>> 0) / 4294967296;
}

const rowCount = (db.prepare('SELECT COUNT(*) as c FROM records').get() as { c: number }).c;

if (rowCount === 0) {
  console.log(`[db] Seeding ${SEED_COUNT.toLocaleString()} records…`);

  const CATEGORIES  = ['Finance', 'HR', 'Operations', 'Legal', 'IT'];
  const STATUSES    = ['active', 'inactive', 'pending'] as const;
  const FIRST_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Hank'];
  const LAST_NAMES  = ['Smith', 'Jones', 'Brown', 'Wilson', 'Taylor', 'Davis', 'Clark'];

  const insert = db.prepare(`
    INSERT INTO records (name, category, status, amount, created_at, updated_at)
    VALUES (@name, @category, @status, @amount, @created_at, @updated_at)
  `);

  const insertMany = db.transaction((rows: object[]) => {
    for (const row of rows) insert.run(row);
  });

  const rows = Array.from({ length: SEED_COUNT }, (_, i) => {
    const s          = seed(i);
    const s2         = seed(i + 99999);
    const dayOffset  = Math.floor(seed(i + 500000) * 730);
    const created    = new Date(Date.now() - dayOffset * 86_400_000).toISOString();
    return {
      name:       `${FIRST_NAMES[Math.floor(s  * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(s2 * LAST_NAMES.length)]} #${i + 1}`,
      category:   CATEGORIES[Math.floor(seed(i + 1000) * CATEGORIES.length)],
      status:     STATUSES[Math.floor(seed(i + 2000) * STATUSES.length)],
      amount:     Math.round(seed(i + 3000) * 99000 + 1000) / 100,
      created_at: created,
      updated_at: created,
    };
  });

  insertMany(rows);
  console.log('[db] Seed complete.');
}
