import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function createJobRepository(filename) {
  mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, url TEXT NOT NULL, status TEXT NOT NULL, phase TEXT, pct INTEGER DEFAULT 0, output TEXT, checkpoint TEXT, error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL, phase TEXT, pct INTEGER, message TEXT, payload TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS artifacts (id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL, path TEXT NOT NULL, sha256 TEXT, size INTEGER, kind TEXT, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS events_job_idx ON events(job_id, id);
    CREATE INDEX IF NOT EXISTS artifacts_job_idx ON artifacts(job_id, id);`);
  const now = () => new Date().toISOString();
  const get = db.prepare('SELECT * FROM jobs WHERE id = ?');
  return {
    db,
    create(input) { const t = now(); db.prepare('INSERT INTO jobs (id,url,status,phase,pct,output,checkpoint,error,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(input.id, input.url, input.status || 'queued', input.phase || 'queued', input.pct || 0, input.output || null, input.checkpoint || null, null, t, t); return this.get(input.id); },
    get(id) { return get.get(id) || null; },
    update(id, patch = {}) { const current = this.get(id); if (!current) throw new Error('Job tidak ditemukan: ' + id); const next = { ...current, ...patch, updated_at: now() }; db.prepare('UPDATE jobs SET status=?,phase=?,pct=?,output=?,checkpoint=?,error=?,updated_at=? WHERE id=?').run(next.status, next.phase, next.pct, next.output, next.checkpoint, next.error, next.updated_at, id); return this.get(id); },
    event(id, event = {}) { const t = now(); db.prepare('INSERT INTO events (job_id,phase,pct,message,payload,created_at) VALUES (?,?,?,?,?,?)').run(id, event.phase || null, event.pct ?? null, event.message || null, JSON.stringify(event.payload ?? event), t); return { ...event, job_id: id, created_at: t }; },
    events(id, limit = 1000) { return db.prepare('SELECT * FROM events WHERE job_id = ? ORDER BY id DESC LIMIT ?').all(id, limit).reverse(); },
    addArtifact(id, item) { db.prepare('INSERT INTO artifacts (job_id,path,sha256,size,kind,created_at) VALUES (?,?,?,?,?,?)').run(id, item.path, item.sha256 || null, item.size || 0, item.kind || 'zip', now()); },
    artifacts(id) { return db.prepare('SELECT * FROM artifacts WHERE job_id = ? ORDER BY id').all(id); },
    list(limit = 100) { return db.prepare('SELECT * FROM jobs ORDER BY updated_at DESC LIMIT ?').all(limit); },
    resume(id) { const job = this.get(id); if (!job) throw new Error('Job tidak ditemukan: ' + id); if (!['paused', 'error', 'cancelled'].includes(job.status)) throw new Error('Job belum dapat di-resume dari status ' + job.status); return this.update(id, { status: 'queued', phase: 'resume' }); },
    close() { db.close(); }
  };
}
