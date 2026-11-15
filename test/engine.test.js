import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, joinRoom, act, view } from '../game/engine.js';
export function table(n = 3) {
  const room = createRoom('ABCDEF12', 's0', 'Player 0');
  for (let i = 1; i < n; i++) joinRoom(room, `s${i}`, `Player ${i}`);
  return room;
}
export function command(r, id, type, extra = {}) { act(r, r.players.find(p => p.id === id).session, { revision: r.revision, type, ...extra }); r.revision++; }
export function begin(r) {
  command(r, r.hostId, 'start');
  r.players.forEach(p => command(r, p.id, 'ready'));
  r.order.forEach(id => command(r, id, 'clue', { text: 'subtle' }));
  command(r, r.hostId, 'vote-open');
}
test('membership, minimum/maximum players, host authorization and stale actions', () => {
  const r = table();
  assert.throws(() => act(r, 'stranger', { type: 'start', revision: 0 }), /Join/);
  assert.throws(() => command(r, r.players[1].id, 'start'), /host/);
  assert.throws(() => act(r, 's0', { type: 'start', revision: -1 }), /changed/);
  const few = createRoom('12345678', 's', 'Host');
  assert.throws(() => command(few, few.hostId, 'start'), /3 players/);
  assert.throws(() => joinRoom(table(8), 'new', 'New'), /full/);
  assert.throws(() => joinRoom(r, 's4', 'player 0'), /taken/);
});
test('exactly one private chameleon, no credentials, no role/secret leaks in serialized views', () => {
  const r = table(8); command(r, r.hostId, 'start');
  assert.equal(r.words.length, 16); assert.equal(new Set(r.words).size, 16);
  let chameleons = 0;
  for (const p of r.players) {
    const v = view(r, p.session);
    assert.equal(JSON.stringify(v).includes('session'), false);
    assert.equal('secretIndex' in v, false); assert.equal(v.chameleonId, null);
    if (p.id === r.chameleonId) { chameleons++; assert.equal(v.role, 'chameleon'); assert.equal(v.secret, null); }
    else assert.equal(v.secret, r.words[r.secretIndex]);
  }
  assert.equal(chameleons, 1);
  assert.throws(() => joinRoom(r, 'new', 'New'), /started/);
  assert.throws(() => view(r, 'stranger'), /member/);
});
test('clue ordering, one word validation, ready gate and duplicated actions', () => {
  const r = table(); command(r, r.hostId, 'start');
  assert.throws(() => command(r, r.hostId, 'clue', { text: 'early' }), /stage/);
  r.players.forEach(p => command(r, p.id, 'ready'));
  assert.throws(() => command(r, r.order[1], 'clue', { text: 'early' }), /turn/);
  assert.throws(() => command(r, r.order[0], 'clue', { text: 'two words' }), /one word/);
  command(r, r.order[0], 'clue', { text: 'same' });
  assert.throws(() => command(r, r.order[0], 'clue', { text: 'again' }), /turn/);
  command(r, r.order[1], 'clue', { text: 'same' });
});
test('incorrect accusation scores once and next dealer is former chameleon', () => {
  const r = table(); begin(r); const former = r.chameleonId;
  const target = r.players.find(p => p.id !== former).id;
  command(r, r.players[0].id, 'vote', { target });
  assert.deepEqual(view(r, 's0').votes, {});
  assert.throws(() => command(r, r.players[0].id, 'vote', { target }), /locked/);
  r.players.slice(1).forEach(p => command(r, p.id, 'vote', { target }));
  assert.equal(r.outcome, 'escaped'); assert.equal(r.players.find(p => p.id === former).score, 2);
  assert.throws(() => command(r, r.players[2].id, 'vote', { target }), /stage/);
  command(r, r.hostId, 'next'); assert.equal(r.dealerId, former); assert.equal(r.order[0], former);
});
test('three-player caught chameleon gets two guesses; failed guess scores others', () => {
  const r = table(); begin(r);
  r.players.forEach(p => command(r, p.id, 'vote', { target: r.chameleonId }));
  assert.equal(r.phase, 'guess'); assert.equal(r.guessesLeft, 2);
  const detective = r.players.find(p => p.id !== r.chameleonId);
  assert.throws(() => command(r, detective.id, 'guess', { text: 'x' }), /Only/);
  command(r, r.chameleonId, 'guess', { text: 'wrong1' }); assert.equal(r.phase, 'guess');
  command(r, r.chameleonId, 'guess', { text: 'wrong2' }); assert.equal(r.outcome, 'caught');
  r.players.forEach(p => assert.equal(p.score, p.id === r.chameleonId ? 0 : 2));
});
test('4–8-player guess, correct guess scores +1 and face-down rule', () => {
  for (const n of [4, 6, 7, 8]) {
    const r = table(n); begin(r);
    assert.equal(view(r, 's0').words.length, n >= 7 ? 0 : 16);
    r.players.forEach(p => command(r, p.id, 'vote', { target: r.chameleonId }));
    assert.equal(r.guessesLeft, 1);
    assert.equal(view(r, r.players.find(p => p.id === r.chameleonId).session).secret, null);
    command(r, r.chameleonId, 'guess', { text: r.words[r.secretIndex].toUpperCase() });
    assert.equal(r.outcome, 'guessed'); assert.equal(r.players.find(p => p.id === r.chameleonId).score, 1);
    assert.equal(view(r, 's0').words.length, 16);
  }
});
test('dealer can only decide a tied leader; first to 5 ends match; reset clears scores', () => {
  const r = table(); begin(r);
  r.players.forEach((p, i) => command(r, p.id, 'vote', { target: r.players[i].id }));
  assert.equal(r.phase, 'tie');
  assert.throws(() => command(r, r.players[1].id, 'tie', { target: r.chameleonId }), /dealer/);
  assert.throws(() => command(r, r.dealerId, 'tie', { target: 'fake' }), /tied/);
  r.players.find(p => p.id === r.chameleonId).score = 4;
  command(r, r.dealerId, 'tie', { target: r.chameleonId });
  command(r, r.chameleonId, 'guess', { text: r.words[r.secretIndex] });
  assert.deepEqual(r.winnerIds, [r.chameleonId]);
  assert.throws(() => command(r, r.hostId, 'next'), /match is over/);
  command(r, r.hostId, 'reset'); assert.equal(r.phase, 'lobby'); assert.equal(r.players[0].score, 0);
});
test('abandon and leave prevent stuck rooms; host transfer and removal work', () => {
  const r = table(); command(r, r.hostId, 'start');
  assert.throws(() => command(r, r.players[1].id, 'leave'), /Finish/);
  command(r, r.hostId, 'abandon'); assert.equal(r.players[0].score, 0);
  const next = r.players[1].id; command(r, r.hostId, 'leave'); assert.equal(r.hostId, next);
  command(r, next, 'remove', { target: r.players[1].id }); assert.equal(r.players.length, 1);
});
