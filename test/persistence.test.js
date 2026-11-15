import { request as httpRequest } from 'node:http';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../game/database.js';
import { createApp } from '../server.js';

test('online room and hashed-cookie session survive process restart', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'chameleon-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const databasePath = join(dir, 'game.sqlite');
  const origin = 'https://game.example';
  let app = createApp({ mode: 'online', publicOrigin: origin, databasePath });
  async function listen() { await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); }
  async function close() { await new Promise(resolve => { app.server.close(resolve); app.server.closeAllConnections(); }); }
  t.after(async () => { if (app.server.listening) await close(); });
  await listen();
  async function request(path, cookie, data) {
    return new Promise((resolve, reject) => {
      const req = httpRequest({ hostname: '127.0.0.1', port: app.server.address().port, path, method: data ? 'POST' : 'GET',
        headers: { Host: 'game.example', Origin: origin, Cookie: cookie || '', 'Content-Type': 'application/json' } }, res => {
        let text = ''; res.on('data', chunk => { text += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(text), cookie: res.headers['set-cookie']?.[0] }));
      });
      req.on('error', reject); req.end(data ? JSON.stringify(data) : undefined);
    });
  }
  const created = await request('/api/rooms', '', { name: 'Host' }); assert.equal(created.status, 201);
  assert.match(created.cookie, /HttpOnly/); assert.match(created.cookie, /Secure/); assert.match(created.cookie, /SameSite=Strict/);
  const code = created.data.code, cookie = created.cookie.split(';')[0];
  await close();
  const db = openDatabase(databasePath);
  assert.equal([...db.sessions.keys()].includes(cookie.split('=')[1]), false);
  db.close();
  app = createApp({ mode: 'online', publicOrigin: origin, databasePath }); await listen();

  const resumed = await request(`/api/rooms/${code}`, cookie);
  assert.equal(resumed.status, 200); assert.equal(resumed.data.me, created.data.me);
  assert.equal((await request(`/api/rooms/${code}`, '')).status, 403);
  assert.equal((await request('/api/rooms', cookie, { name: 'Another' })).status, 201);
});
test('online startup requires exact HTTPS origin; LAN remains ephemeral', () => {
  assert.throws(() => createApp({ mode: 'online' }), /PUBLIC_ORIGIN/);
  assert.throws(() => createApp({ mode: 'online', publicOrigin: 'http://game.example' }), /HTTPS/);
  assert.throws(() => createApp({ mode: 'online', publicOrigin: 'https://game.example/path' }), /origin/);
});
