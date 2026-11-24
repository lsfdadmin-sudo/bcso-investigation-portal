import "./sqlite-warning";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import { dataDir, uploadDir } from "./paths";
import { backfillCaseClosures, backfillEvidenceEvents, seedPortal } from "./seed";

const globalForDb = globalThis as unknown as { bcso?: DatabaseSync };

function openDatabase() {
  fs.mkdirSync(uploadDir(), { recursive: true });
  const database = new DatabaseSync(path.join(dataDir(), "bcso.sqlite"));
  database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA busy_timeout = 5000");
  return database;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  seeded INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  badge TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  case_number TEXT NOT NULL UNIQUE,
  incident_type TEXT NOT NULL,
  location TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  narrative TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT,
  closed_by TEXT
);

CREATE TABLE IF NOT EXISTS responders (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  badge TEXT NOT NULL,
  callsign TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  occurred_at TEXT NOT NULL,
  badge TEXT NOT NULL,
  unit TEXT NOT NULL,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL,
  findings TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('case', 'suspect', 'evidence', 'related')),
  pos_x REAL NOT NULL,
  pos_y REAL NOT NULL,
  payload TEXT NOT NULL,
  event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  source_handle TEXT,
  target_handle TEXT,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS case_closures (
  case_id TEXT PRIMARY KEY REFERENCES cases(id) ON DELETE CASCADE,
  anyone_charged INTEGER NOT NULL CHECK (anyone_charged IN (0, 1)),
  notes TEXT NOT NULL DEFAULT '',
  closed_at TEXT NOT NULL,
  closed_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS case_charges (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  suspect_node_id TEXT,
  name TEXT NOT NULL,
  charges TEXT NOT NULL,
  arrest_report TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status, occurred_at);
CREATE INDEX IF NOT EXISTS idx_events_case ON events(case_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_nodes_case ON nodes(case_id);
CREATE INDEX IF NOT EXISTS idx_edges_case ON edges(case_id);
CREATE INDEX IF NOT EXISTS idx_photos_node ON photos(node_id);
CREATE INDEX IF NOT EXISTS idx_sessions_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_case_charges_case ON case_charges(case_id, sort_order);
`;

function ensurePasswords(database: DatabaseSync) {
  const defaults: Record<string, string> = {
    "password:patrol": process.env.BCSO_PATROL_PASSWORD || "patrol412",
    "password:detective": process.env.BCSO_DETECTIVE_PASSWORD || "detective08",
    "password:admin": process.env.BCSO_ADMIN_PASSWORD || "sheriff01",
  };
  const read = database.prepare("SELECT value FROM settings WHERE key = ?");
  const write = database.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
  for (const [key, plain] of Object.entries(defaults)) {
    if (!read.get(key)) write.run(key, bcrypt.hashSync(plain, 10));
  }
}

function ensureEventColumn(database: DatabaseSync) {
  const columns = database.prepare("PRAGMA table_info(nodes)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "event_id")) {
    database.exec("ALTER TABLE nodes ADD COLUMN event_id TEXT REFERENCES events(id) ON DELETE SET NULL");
  }
  database.exec("CREATE INDEX IF NOT EXISTS idx_nodes_event ON nodes(event_id)");
}

function columnNames(database: DatabaseSync, table: string) {
  const rows = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return new Set(rows.map((column) => column.name));
}

function ensureClosureColumns(database: DatabaseSync) {
  const closure = columnNames(database, "case_closures");
  if (closure.size > 0) {
    if (!closure.has("notes")) database.exec("ALTER TABLE case_closures ADD COLUMN notes TEXT NOT NULL DEFAULT ''");
    if (!closure.has("closed_at")) database.exec("ALTER TABLE case_closures ADD COLUMN closed_at TEXT NOT NULL DEFAULT ''");
    if (!closure.has("closed_by")) database.exec("ALTER TABLE case_closures ADD COLUMN closed_by TEXT NOT NULL DEFAULT ''");
    if (!closure.has("updated_at")) database.exec("ALTER TABLE case_closures ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''");
    if (!closure.has("anyone_charged")) {
      database.exec("ALTER TABLE case_closures ADD COLUMN anyone_charged INTEGER NOT NULL DEFAULT 0");
    }
  }
  const charges = columnNames(database, "case_charges");
  if (charges.size > 0) {
    if (!charges.has("suspect_node_id")) database.exec("ALTER TABLE case_charges ADD COLUMN suspect_node_id TEXT");
    if (!charges.has("sort_order")) database.exec("ALTER TABLE case_charges ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0");
    if (!charges.has("arrest_report")) database.exec("ALTER TABLE case_charges ADD COLUMN arrest_report TEXT NOT NULL DEFAULT ''");
    if (!charges.has("charges")) database.exec("ALTER TABLE case_charges ADD COLUMN charges TEXT NOT NULL DEFAULT ''");
    if (!charges.has("name")) database.exec("ALTER TABLE case_charges ADD COLUMN name TEXT NOT NULL DEFAULT ''");
  }
  database.exec("CREATE INDEX IF NOT EXISTS idx_case_charges_case ON case_charges(case_id, sort_order)");
}

function init(database: DatabaseSync) {
  database.exec(SCHEMA);
  ensureEventColumn(database);
  ensureClosureColumns(database);
  database.exec("BEGIN IMMEDIATE");
  try {
    ensurePasswords(database);
    const meta = database.prepare("SELECT seeded FROM meta WHERE id = 1").get() as
      | { seeded?: number }
      | undefined;
    if (!meta) {
      seedPortal(database);
      database.prepare("INSERT INTO meta (id, seeded) VALUES (1, 1)").run();
    }
    backfillEvidenceEvents(database);
    backfillCaseClosures(database);
    database.exec("COMMIT");
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      /* already closed */
    }
    throw error;
  }
}

export function getDb() {
  if (globalForDb.bcso) return globalForDb.bcso;
  const database = openDatabase();
  try {
    init(database);
  } catch (error) {
    database.close();
    throw error;
  }
  globalForDb.bcso = database;
  return database;
}

export function transaction<T>(fn: (database: DatabaseSync) => T): T {
  const database = getDb();
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = fn(database);
    database.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw error;
  }
}
