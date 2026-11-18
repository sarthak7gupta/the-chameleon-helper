import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, state TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, state TEXT NOT NULL);`);
  const putRoom = db.prepare('INSERT INTO rooms VALUES (?, ?) ON CONFLICT(code) DO UPDATE SET state=excluded.state');
  const putSession = db.prepare('INSERT INTO sessions VALUES (?, ?) ON CONFLICT(token_hash) DO UPDATE SET state=excluded.state');
  return {
    rooms: new Map(db.prepare('SELECT * FROM rooms').all().map(row => [row.code, JSON.parse(row.state)])),
    sessions: new Map(db.prepare('SELECT * FROM sessions').all().map(row => [row.token_hash, JSON.parse(row.state)])),
    saveRoom: room => putRoom.run(room.code, JSON.stringify(room)),
    deleteRoom: code => db.prepare('DELETE FROM rooms WHERE code = ?').run(code),
    saveSession: (key, session) => putSession.run(key, JSON.stringify(session)),
    deleteSession: key => db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(key),
    close: () => db.close()
  };
}
