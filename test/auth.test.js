import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers.js';

const online = { mode: 'online', publicOrigin: 'https://game.example', databasePath: ':memory:' };
const headers = { Host: 'game.example', Origin: 'https://game.example' };
const wrap = client => (path, body) => client(path, body, headers);

test('register, login, logout and duplicate names behave; config carries the account', async t => {
  const { client } = await setup(t, online);
  const ada = wrap(client());
  assert.equal((await ada('/api/config')).data.account, null);
  assert.equal((await ada('/api/auth/register', { name: 'Ada', password: 'short' })).status, 400);
  assert.equal((await ada('/api/auth/register', { name: 'Ada', password: 'longenough8' })).status, 200);
  assert.equal((await ada('/api/config')).data.account, 'Ada');
  const other = wrap(client());
  assert.equal((await other('/api/auth/register', { name: 'ADA', password: 'longenough8' })).status, 400);
  assert.equal((await other('/api/auth/login', { name: 'Ada', password: 'wrongpassword' })).status, 400);
  assert.equal((await other('/api/auth/login', { name: 'Ada', password: 'longenough8' })).status, 200);
  assert.equal((await other('/api/auth/logout', {})).status, 200);
  assert.equal((await other('/api/config')).data.account, null);
  assert.equal((await other('/api/auth/login', { name: 'Nobody', password: 'longenough8' })).status, 400);
});

test('accounts persist only in online mode; LAN rejects auth endpoints', async t => {
  const { client } = await setup(t);
  const c = client();
  assert.equal((await c('/api/auth/login', { name: 'Ada', password: 'longenough8' })).status, 404);
  assert.equal((await c('/api/auth/register', { name: 'Ada', password: 'longenough8' })).status, 404);
  assert.equal((await c('/api/config')).data.publicRooms, false);
});

test('sign-in attempts are rate limited per address', async t => {
  const { client } = await setup(t, online);
  const c = wrap(client());
  for (let i = 0; i < 15; i++) assert.equal((await c('/api/auth/register', { name: `Player ${i}`, password: 'longenough8' })).status, 200);
  assert.equal((await c('/api/auth/register', { name: 'Player 15', password: 'longenough8' })).status, 429);
});
