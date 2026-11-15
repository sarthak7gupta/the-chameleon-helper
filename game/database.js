import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, state TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, state TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS accounts (name_key TEXT PRIMARY KEY, state TEXT NOT NULL);`);
  const putRoom = db.prepare('INSERT INTO rooms VALUES (?, ?) ON CONFLICT(code) DO UPDATE SET state=excluded.state');
  const putSession = db.prepare('INSERT INTO sessions VALUES (?, ?) ON CONFLICT(token_hash) DO UPDATE SET state=excluded.state');
  const putAccount = db.prepare('INSERT INTO accounts VALUES (?, ?) ON CONFLICT(name_key) DO UPDATE SET state=excluded.state');
  return {
    rooms: new Map(db.prepare('SELECT * FROM rooms').all().map(row => [row.code, JSON.parse(row.state)])),
    sessions: new Map(db.prepare('SELECT * FROM sessions').all().map(row => [row.token_hash, JSON.parse(row.state)])),
    accounts: new Map(db.prepare('SELECT * FROM accounts').all().map(row => [row.name_key, JSON.parse(row.state)])),
    saveRoom: room => putRoom.run(room.code, JSON.stringify(room)),
    deleteRoom: code => db.prepare('DELETE FROM rooms WHERE code = ?').run(code),
    saveSession: (key, session) => putSession.run(key, JSON.stringify(session)),
    deleteSession: key => db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(key),
    saveAccount: account => putAccount.run(account.key, JSON.stringify(account)),
    close: () => db.close()
  };
}
