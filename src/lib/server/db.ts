import fs from 'node:fs';
import Database from 'better-sqlite3';
import { getConfig } from './config';

const globalForDb = globalThis as unknown as {
  __handdrawnDb?: Database.Database;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('source', 'generated')),
  storage_key TEXT NOT NULL,
  mime TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_assets_session ON assets(session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  source_asset_id TEXT NOT NULL REFERENCES assets(id),
  style_id TEXT NOT NULL,
  style_version TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt TEXT NOT NULL,
  fidelity TEXT NOT NULL,
  composition TEXT NOT NULL DEFAULT 'full',
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'succeeded', 'failed', 'cancelled')),
  error_code TEXT,
  error_message TEXT,
  error_retryable INTEGER NOT NULL DEFAULT 0,
  result_asset_id TEXT REFERENCES assets(id),
  provider_request_id TEXT,
  provider_usage_json TEXT,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  quota_reserved INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  UNIQUE (session_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_tasks_session ON tasks(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, updated_at);

CREATE TABLE IF NOT EXISTS works (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  doc_json TEXT NOT NULL,
  source_asset_id TEXT REFERENCES assets(id),
  result_asset_id TEXT REFERENCES assets(id),
  style_id TEXT,
  template_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_works_session ON works(session_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS usage (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id, day)
);

CREATE TABLE IF NOT EXISTS global_usage (
  day TEXT PRIMARY KEY,
  used INTEGER NOT NULL DEFAULT 0
);
`;

function migrate(db: Database.Database) {
  db.exec(SCHEMA);

  // 兼容已经存在的数据库：CREATE TABLE IF NOT EXISTS 不会补新列。
  const taskColumns = db.prepare('PRAGMA table_info(tasks)').all() as Array<{
    name: string;
  }>;
  if (!taskColumns.some((column) => column.name === 'composition')) {
    db.exec(
      "ALTER TABLE tasks ADD COLUMN composition TEXT NOT NULL DEFAULT 'full'",
    );
  }
}

export function getDb(): Database.Database {
  if (globalForDb.__handdrawnDb) return globalForDb.__handdrawnDb;

  const config = getConfig();
  fs.mkdirSync(config.dataDir, { recursive: true });

  const db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrate(db);

  globalForDb.__handdrawnDb = db;
  return db;
}

export function closeDbForTests() {
  globalForDb.__handdrawnDb?.close();
  delete globalForDb.__handdrawnDb;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** 以中国时区计算“今天”，避免服务器 UTC 时区导致额度跨日错位。 */
export function todayInShanghai(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
