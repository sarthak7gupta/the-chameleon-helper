import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { act, createRoom, joinRoom, view, GameError, requireThat } from './game/engine.js';

const assets = new Map([['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']],
  ['/web/app.js', ['web/app.js', 'text/javascript']], ['/web/style.css', ['web/style.css', 'text/css']],
  ['/helper.html', ['helper.html', 'text/html']]]);
export function lanUrls(port) {
  return Object.entries(networkInterfaces()).sort(([a], [b]) => (a === 'en0' ? -1 : b === 'en0' ? 1 : 0))
    .flatMap(([, nets]) => (nets || []).filter(n => n.family === 'IPv4' && !n.internal && /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(n.address)).map(n => `http://${n.address}:${port}`));
}
export function createApp() {
  const rooms = new Map();
  const sessions = new Map();
  const limits = new Map();
  const expiry = 24 * 60 * 60 * 1000;
  function prune() {
    const now = Date.now();
    for (const [key, room] of rooms) if (now - room.updatedAt > expiry) rooms.delete(key);
    for (const [key, session] of sessions) if (now - session.createdAt > expiry * 7) sessions.delete(key);
    for (const [key, limit] of limits) if (now > limit.until) limits.delete(key);
  }
  const timer = setInterval(prune, 60_000).unref();
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && assets.has(url.pathname)) {
        const [file, type] = assets.get(url.pathname);
        // The legacy helper has inline code; the multiplayer client does not.
        if (file === 'helper.html') res.removeHeader('Content-Security-Policy');
        const data = await readFile(new URL(file, import.meta.url));
        res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` }); res.end(data); return;
      }
      if (url.pathname === '/health' && req.method === 'GET') { send(200, { ok: true }); return; }
      requireThat(url.pathname.startsWith('/api/'), 'Not found.', 404);
      const origin = req.headers.origin;
      requireThat(!origin || origin === `http://${req.headers.host}`, 'Open the game on its own address.', 403);
      const cookie = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('chameleon='))?.slice(10);
      let session = sessions.get(cookie);
      if (!session) {
        requireThat(sessions.size < 10_000, 'Server busy. Try later.', 503);
        const token = randomBytes(32).toString('hex');
        session = { id: randomUUID(), createdAt: Date.now() }; sessions.set(token, session);
        res.setHeader('Set-Cookie', `chameleon=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800`);
      }
      if (req.method === 'GET' && url.pathname === '/api/config') { send(200, { mode: 'lan', lanUrls: lanUrls(server.address().port) }); return; }
      let body;
      if (req.method === 'POST') {
        requireThat(req.headers['content-type']?.split(';')[0] === 'application/json', 'Send JSON.', 415);
        const ip = req.socket.remoteAddress;
        let limit = limits.get(ip);
        if (!limit || Date.now() > limit.until) { limit = { count: 0, until: Date.now() + 60_000 }; limits.set(ip, limit); }
        requireThat(++limit.count <= 240, 'Too many actions. Wait a minute.', 429);
        let text = '';
        for await (const chunk of req) { text += chunk; requireThat(Buffer.byteLength(text) <= 4096, 'Request too large.', 413); }
        try { body = JSON.parse(text); } catch { throw new GameError('Invalid JSON.'); }
        requireThat(body && typeof body === 'object' && !Array.isArray(body), 'Invalid request.');
      }
      if (req.method === 'POST' && url.pathname === '/api/rooms') {
        prune(); requireThat(rooms.size < 500, 'Too many rooms. Try later.', 503);
        requireThat([...rooms.values()].filter(r => r.players.some(p => p.session === session.id)).length < 3, 'Leave an existing room before creating another.');
        let code; do { code = randomBytes(4).toString('hex').toUpperCase(); } while (rooms.has(code));
        const room = createRoom(code, session.id, body.name); rooms.set(code, room);
        send(201, view(room, session.id)); return;
      }
      const match = /^\/api\/rooms\/([A-F0-9]{8})(?:\/(join|actions))?$/.exec(url.pathname);
      requireThat(match, 'Not found.', 404);
      const room = rooms.get(match[1]); requireThat(room && Date.now() - room.updatedAt <= expiry, 'Room expired or not found. Ask the host for a new link.', 404);
      if (req.method === 'GET' && !match[2]) { send(200, view(room, session.id)); return; }
      requireThat(req.method === 'POST', 'Method not allowed.', 405);
      // Mutate a copy; a rejected command cannot leave partially changed state.
      const next = structuredClone(room);
      if (match[2] === 'join') joinRoom(next, session.id, body.name);
      else if (match[2] === 'actions') act(next, session.id, body);
      else throw new GameError('Not found.', 404);
      next.revision++; next.updatedAt = Date.now();
      if (next.players.length) rooms.set(next.code, next); else rooms.delete(next.code);
      send(200, next.players.some(p => p.session === session.id) ? view(next, session.id) : { left: true });
    } catch (error) {
      if (!(error instanceof GameError)) console.error(error);
      if (!res.headersSent) send(error.status || 500, { error: error instanceof GameError ? error.message : 'Server error. Try again.' });
      else res.end();
    }
  });
  server.on('close', () => clearInterval(timer));
  return { server, rooms, sessions };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const { server } = createApp();
  server.listen(port, '0.0.0.0', () => {
    console.log(`The Chameleon: http://localhost:${port}`);
    for (const nets of Object.values(networkInterfaces())) for (const net of nets || [])
      if (net.family === 'IPv4' && !net.internal) console.log(`Same Wi-Fi? Join at http://${net.address}:${port}`);
    console.log('Keep this launcher running. Rooms are in memory and end when it stops.');
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}
