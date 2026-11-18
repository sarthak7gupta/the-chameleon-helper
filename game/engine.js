import { randomInt, randomUUID } from 'node:crypto';
import topics from './topics.json' with { type: 'json' };

export class GameError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function requireThat(condition, message, status = 400) {
  if (!condition) throw new GameError(message, status);
}
export function playerName(value) {
  requireThat(typeof value === 'string', 'Enter a display name.');
  const name = value.trim().normalize('NFKC');
  requireThat(name.length >= 1 && name.length <= 24 && !/[\p{C}<>]/u.test(name), 'Use 1–24 characters without control characters or angle brackets.');
  return name;
}
export function createRoom(code, session, name) {
  const player = { id: randomUUID(), session, name: playerName(name), score: 0, ready: false };
  return { code, revision: 0, updatedAt: Date.now(), phase: 'lobby', round: 0,
    hostId: player.id, dealerId: player.id, players: [player] };
}
export function joinRoom(room, session, name) {
  const existing = room.players.find(p => p.session === session);
  if (existing) return existing;
  requireThat(room.phase === 'lobby', 'This game has started. Join after the host opens a new game.', 409);
  requireThat(room.players.length < 8, 'This room is full.', 409);
  name = playerName(name);
  requireThat(!room.players.some(p => p.name.toLowerCase() === name.toLowerCase()), 'That name is taken in this room.');
  const p = { id: randomUUID(), session, name, score: 0, ready: false };
  room.players.push(p);
  return p;
}
function finish(room, outcome) {
  room.outcome = outcome;
  room.phase = 'result';
  for (const p of room.players) p.score += p.id === room.chameleonId ? (outcome === 'escaped' ? 2 : outcome === 'guessed' ? 1 : 0) : (outcome === 'caught' ? 2 : 0);
  room.winnerIds = room.players.filter(p => p.score >= 5).map(p => p.id);
}
function accuse(room, target) {
  room.accusedId = target;
  if (target === room.chameleonId) { room.phase = 'guess'; room.guessesLeft = room.players.length === 3 ? 2 : 1; }
  else finish(room, 'escaped');
}
function startRound(room) {
  const names = Object.keys(topics);
  room.topic = names[randomInt(names.length)];
  const shuffled = [...topics[room.topic]];
  for (let i = shuffled.length - 1; i > 0; i--) { const j = randomInt(i + 1); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
  room.words = shuffled.slice(0, 16);
  room.secretIndex = randomInt(16);
  if (room.chameleonId) room.dealerId = room.chameleonId;
  room.chameleonId = room.players[randomInt(room.players.length)].id;
  const index = room.players.findIndex(p => p.id === room.dealerId);
  room.order = [...room.players.slice(index), ...room.players.slice(0, index)].map(p => p.id);
  room.round++;
  room.clues = {}; room.votes = {}; room.tiedIds = []; room.guesses = [];
  room.outcome = null; room.accusedId = null; room.winnerIds = [];
  room.players.forEach(p => { p.ready = false; });
  room.phase = 'reveal';
}
export function act(room, session, action) {
  requireThat(action && typeof action === 'object' && !Array.isArray(action), 'Invalid action.');
  const p = room.players.find(p => p.session === session);
  requireThat(p, 'Join this room first.', 403);
  requireThat(action.revision === room.revision, 'The room changed. Check the latest state and try again.', 409);
  const host = () => requireThat(p.id === room.hostId, 'Only the host can do that.', 403);
  const phase = value => requireThat(room.phase === value, 'That action is unavailable at this stage.', 409);
  switch (action.type) {
    case 'start':
      host(); phase('lobby'); requireThat(room.players.length >= 3, 'Invite at least 3 players.'); startRound(room); break;
    case 'ready':
      phase('reveal'); p.ready = true;
      if (room.players.every(q => q.ready)) room.phase = 'clues';
      break;
    case 'clue': {
      phase('clues');
      requireThat(room.order[Object.keys(room.clues).length] === p.id, 'Wait for your clue turn.', 409);
      const clue = typeof action.text === 'string' ? action.text.trim().normalize('NFKC') : '';
      requireThat(clue.length > 0 && clue.length <= 40 && !/[\s\p{C}]/u.test(clue), 'Give one word, up to 40 characters.');
      room.clues[p.id] = clue;
      if (Object.keys(room.clues).length === room.players.length) room.phase = 'discussion';
      break;
    }
    case 'vote-open': host(); phase('discussion'); room.phase = 'vote'; break;
    case 'vote': {
      phase('vote'); requireThat(!room.votes[p.id], 'Your vote is already locked.', 409);
      requireThat(room.players.some(q => q.id === action.target), 'Choose a player.');
      room.votes[p.id] = action.target;
      if (Object.keys(room.votes).length === room.players.length) {
        const counts = {};
        Object.values(room.votes).forEach(id => { counts[id] = (counts[id] || 0) + 1; });
        const max = Math.max(...Object.values(counts));
        room.tiedIds = Object.keys(counts).filter(id => counts[id] === max);
        if (room.tiedIds.length > 1) room.phase = 'tie'; else accuse(room, room.tiedIds[0]);
      }
      break;
    }
    case 'tie':
      phase('tie'); requireThat(p.id === room.dealerId, 'The dealer decides the tie.', 403);
      requireThat(room.tiedIds.includes(action.target), 'Choose one of the tied players.'); accuse(room, action.target); break;
    case 'guess': {
      phase('guess'); requireThat(p.id === room.chameleonId, 'Only the Chameleon can guess.', 403);
      const guess = typeof action.text === 'string' ? action.text.trim().normalize('NFKC') : '';
      requireThat(guess.length > 0 && guess.length <= 80 && !/[\p{C}]/u.test(guess), 'Enter a word from the topic.');
      room.guesses.push(guess); room.guessesLeft--;
      if (guess.toLowerCase() === room.words[room.secretIndex].normalize('NFKC').toLowerCase()) finish(room, 'guessed');
      else if (!room.guessesLeft) finish(room, 'caught');
      break;
    }
    case 'next': host(); phase('result'); requireThat(!room.winnerIds.length, 'The match is over. Start a new game.'); startRound(room); break;
    case 'reset':
      host(); phase('result'); room.phase = 'lobby'; room.round = 0;
      room.players.forEach(q => { q.score = 0; q.ready = false; }); break;
    case 'remove':
      host(); phase('lobby'); requireThat(action.target !== p.id, 'Use Leave room to leave.');
      requireThat(room.players.some(q => q.id === action.target), 'Player not found.');
      room.players = room.players.filter(q => q.id !== action.target);
      if (!room.players.some(q => q.id === room.dealerId)) room.dealerId = room.hostId;
      break;
    case 'leave':
      requireThat(['lobby', 'result'].includes(room.phase), 'Finish or abandon this round before leaving.', 409);
      room.players = room.players.filter(q => q.id !== p.id);
      if (p.id === room.hostId) room.hostId = room.players[0]?.id;
      if (!room.players.some(q => q.id === room.dealerId)) room.dealerId = room.hostId;
      if (room.phase === 'result') { room.phase = 'lobby'; room.round = 0; room.players.forEach(q => { q.score = 0; }); }
      break;
    case 'abandon':
      host(); requireThat(!['lobby', 'result'].includes(room.phase), 'No active round to abandon.');
      room.phase = 'lobby'; room.players.forEach(q => { q.ready = false; }); break;
    default: throw new GameError('Unknown action.');
  }
}
// Explicit per-player projection: never serialize the authority's complete room.
export function view(room, session) {
  const me = room.players.find(p => p.session === session);
  requireThat(me, 'You are not a member of this room.', 403);
  const active = room.phase !== 'lobby';
  const ended = room.phase === 'result';
  const hidden = room.players.length >= 7 && ['discussion', 'vote', 'tie', 'guess'].includes(room.phase);
  return { code: room.code, revision: room.revision, phase: room.phase, round: room.round,
    me: me.id, hostId: room.hostId, dealerId: room.dealerId,
    players: room.players.map(p => ({ id: p.id, name: p.name, score: p.score, ready: p.ready })),
    topic: active ? room.topic : null, words: active && !hidden ? room.words : [], topicHidden: active && hidden,
    role: active ? (me.id === room.chameleonId ? 'chameleon' : 'detective') : null,
    secret: active && (ended || me.id !== room.chameleonId) ? room.words[room.secretIndex] : null,
    order: active ? room.order : [], clues: active ? room.clues : {},
    votedIds: active ? Object.keys(room.votes) : [],
    votes: active && !['reveal', 'clues', 'discussion', 'vote'].includes(room.phase) ? room.votes : {},
    tiedIds: room.phase === 'tie' ? room.tiedIds : [],
    chameleonId: ended || room.phase === 'guess' ? room.chameleonId : null,
    accusedId: ended || room.phase === 'guess' ? room.accusedId : null,
    guessesLeft: room.phase === 'guess' && me.id === room.chameleonId ? room.guessesLeft : null,
    outcome: ended ? room.outcome : null, winnerIds: ended ? room.winnerIds : [] };
}
