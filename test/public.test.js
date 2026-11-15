import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers.js';

test('public discovery excludes private, full, started, and hostless rooms; summaries contain no secrets', async t => {
  const { client, rooms } = await setup(t, { mode: 'online', publicOrigin: 'https://game.example', databasePath: ':memory:' });
  const clients = Array.from({ length: 10 }, client);
  const request = (i, path, body) => clients[i](path, body, { Host: 'game.example', Origin: 'https://game.example' });
  const privateRoom = (await request(0, '/api/rooms', { name: 'Private host' })).data;
  const publicRoom = (await request(1, '/api/rooms', { name: 'Public host', visibility: 'public' })).data;
  let list = (await request(2, '/api/rooms')).data.rooms;
  assert.equal(list.length, 1); assert.equal(list[0].code, publicRoom.code);
  assert.deepEqual(Object.keys(list[0]).sort(), ['code', 'playerCount', 'title']);
  assert.equal(JSON.stringify(list).includes(privateRoom.code), false);
  const path = `/api/rooms/${publicRoom.code}`;
  let r;
  for (let i = 2; i < 9; i++) { const response = await request(i, path + '/join', { name: 'Guest ' + i }); assert.equal(response.status, 200); r = response.data; }
  assert.deepEqual((await request(9, '/api/rooms')).data.rooms, []);
  assert.equal((await request(9, path + '/join', { name: 'Overflow' })).status, 409);
  r = (await request(1, path + '/actions', { type: 'remove', target: r.players[1].id, revision: r.revision })).data;
  assert.equal((await request(2, path + '/join', { name: 'Return' })).status, 403);
  assert.equal((await request(9, '/api/rooms')).data.rooms.length, 1);
  r = (await request(1, path + '/actions', { type: 'start', revision: r.revision })).data;
  assert.equal(r.phase, 'reveal'); assert.deepEqual((await request(9, '/api/rooms')).data.rooms, []);
  const second = (await request(0, '/api/rooms', { name: 'Second host', visibility: 'public' })).data;
  rooms.get(second.code).updatedAt = Date.now() - 25 * 60 * 60 * 1000;
  assert.deepEqual((await request(9, '/api/rooms')).data.rooms, []);
});
test('LAN cannot publish public rooms, unknown visibility rejected', async t => {
  const { client } = await setup(t); const c = client();
  assert.equal((await c('/api/rooms', { name: 'Host', visibility: 'public' })).status, 400);
  assert.equal((await c('/api/rooms', { name: 'Host', visibility: 'oops' })).status, 400);
  assert.equal((await c('/api/rooms')).status, 404);
});
