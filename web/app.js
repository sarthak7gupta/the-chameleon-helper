const app = document.querySelector('#app');
const notice = document.querySelector('#notice');
const rules = document.querySelector('#rules');
document.querySelector('#rules-open').onclick = () => rules.showModal();
document.querySelector('#rules-close').onclick = () => rules.close();
let room = null, code = new URLSearchParams(location.search).get('room')?.toUpperCase() || '';
let config = null, busy = false, revealed = false, connected = true, failures = 0;
let revision = -1, noticeTimer;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function notify(message) { clearTimeout(noticeTimer); notice.textContent = message; noticeTimer = setTimeout(() => { notice.textContent = ''; }, 6500); }
async function api(path, data) {
  const response = await fetch(`./api/${path}`, { method: data ? 'POST' : 'GET', credentials: 'same-origin',
    headers: data ? { 'Content-Type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(8000) });
  const body = await response.json();
  if (!response.ok) { const error = new Error(body.error || 'Request failed.'); error.status = response.status; throw error; }
  return body;
}
function joinForm() {
  return `<form id="join-form" class="form-stack"><div><label for="join-code">Room code</label><input id="join-code" name="code" value="${esc(code)}" required pattern="[A-Fa-f0-9]{8}" maxlength="8" autocapitalize="characters" autocomplete="off" placeholder="8-character code"></div><button class="secondary">Join room</button></form>`;
}
function home() {
  app.innerHTML = `<div class="home"><section class="intro"><h1>Everyone’s in<br>on it.<br>Except one.</h1><p>A secret word. A suspicious clue. Find the Chameleon hiding among your friends.</p><div class="table-art" aria-hidden="true"><span class="mini-card">I know.</span><span class="mini-card">I know…</span><span class="mini-card">I know.</span></div><p class="muted">Play on your own devices. Talk around a table or on a voice call.</p></section><section class="panel" aria-label="Start playing"><h2>Gather your suspects.</h2><p class="muted">${config ? (config.mode === 'online' ? 'Invite friends anywhere. No account needed.' : 'Same Wi-Fi. Separate screens. No account needed.') : 'Host a game on your Wi-Fi to get started.'}</p><div class="form-stack"><div><label for="name">Your display name</label><input id="name" maxlength="24" autocomplete="nickname" placeholder="What should we call you?" value="${esc(localStorage.getItem('chameleon-name') || '')}"></div></div>${config ? `<form id="create-form">${config.publicRooms ? '<div class="visibility-field"><label for="visibility">Room visibility</label><select id="visibility"><option value="private">Private · invite only</option><option value="public">Public · anyone can join</option></select></div>' : ''}<button class="create-button">Create a room</button></form><div class="or">or join your friends</div>${joinForm()}` : `<p class="setup">The person hosting starts the local launcher. Everyone then opens the Wi-Fi link shown in their terminal.</p><label for="local-link">Host’s Wi-Fi link</label><form id="local-form" class="form-stack"><input id="local-link" type="url" placeholder="http://192.168.1.10:3000" required><button>Open local game</button></form>`}<details class="setup"><summary>Host on this Wi-Fi</summary><p>On a computer with Node.js 24+, download the project, then run:</p><p><code>npm start</code></p><p>Keep the terminal open. Share the <code>http://192.168.x.x:3000</code> address it prints. Everyone must be on the same Wi-Fi; guest-network isolation may block connections.</p><p><a href="https://github.com/sarthak7gupta/the-chameleon-helper">Get the launcher on GitHub</a></p></details></section></div>${config?.publicRooms ? '<section class="public-section" aria-labelledby="public-title"><h2 id="public-title">Find a table.</h2><p class="muted">Open rooms, no account needed. Talk with your group in person or on a voice call.</p><div id="public-rooms" class="public-list"><p>Finding open tables…</p></div></section>' : ''}`;
  refreshPublic();
  document.querySelector('#create-form')?.addEventListener('submit', async e => { e.preventDefault(); await enter('rooms'); });
  document.querySelector('#join-form')?.addEventListener('submit', async e => { e.preventDefault(); code = document.querySelector('#join-code').value.trim().toUpperCase(); await enter(`rooms/${code}/join`); });
  document.querySelector('#local-form')?.addEventListener('submit', e => {
    e.preventDefault();
    try { const url = new URL(document.querySelector('#local-link').value); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw Error(); location.assign(url.origin); }
    catch { notify('Enter the full http:// address printed by the launcher.'); }
  });
}
async function enter(path) {
  if (busy) return;
  const name = document.querySelector('#name').value.trim();
  if (!name) { notify('Enter your display name first.'); document.querySelector('#name').focus(); return; }
  busy = true;
  try { const data = await api(path, { name, ...(path === 'rooms' ? { visibility: document.querySelector('#visibility')?.value || 'private' } : {}) }); localStorage.setItem('chameleon-name', name); code = data.code; history.replaceState(null, '', `?room=${code}`); revision = -1; update(data); }
  catch (e) { notify(e.message); }
  finally { busy = false; }
}
async function refreshPublic() {
  const el = document.querySelector('#public-rooms');
  if (!el || !config?.publicRooms) return;
  try {
    const result = await api('rooms');
    if (!el.isConnected) return;
    el.innerHTML = result.rooms.length ? result.rooms.map(r => `<article class="public-table"><div><h3>${esc(r.title)}</h3><small>${r.playerCount}/8 players · waiting for friends</small></div><button data-public-code="${r.code}" class="secondary">Join table<span class="sr-only"> ${esc(r.title)}</span></button></article>`).join('') : '<p class="empty muted">No open tables yet. Create a public room and invite the first few players.</p>';
    el.querySelectorAll('[data-public-code]').forEach(button => button.onclick = async () => { code = button.dataset.publicCode; await enter(`rooms/${code}/join`); });
  } catch { if (el.isConnected) el.innerHTML = '<p class="muted">Couldn’t load tables. Retrying shortly…</p>'; }
}
setInterval(refreshPublic, 10_000);
function update(data) {
  if (room?.code === data.code && data.revision < revision) return;
  connected = true; failures = 0;
  if (data.round !== room?.round || data.phase !== room?.phase) revealed = false;
  room = data;
  if (revision !== data.revision) { revision = data.revision; render(); }
  connection();
}
function connection() { const el = document.querySelector('#connection'); if (el) { el.textContent = connected ? 'Connected · updates automatically' : 'Connection lost. Reconnecting… Keep this page open.'; el.className = `connection ${connected ? '' : 'offline'}`; } }
const nameOf = id => room.players.find(p => p.id === id)?.name || 'Player';
function button(type, text, extra = '') { return `<button data-action="${type}" ${extra}>${text}</button>`; }
function inviteUrl() {
  const origin = config?.mode === 'lan' && ['localhost', '127.0.0.1'].includes(location.hostname) ? config.lanUrls?.[0] || location.origin : location.origin;
  return `${origin}${location.pathname}?room=${code}`;
}
function stage() {
  const r = room, host = r.me === r.hostId;
  switch (r.phase) {
    case 'lobby': return `<h2>The table is open.</h2><p>Invite 3–8 players. Everyone needs their own screen.</p><div class="invite"><strong class="room-code">${r.code}</strong><br>${esc(inviteUrl())}</div><div class="actions">${button('copy', 'Copy invite link', 'class="secondary"')}${host ? button('start', 'Deal the cards', r.players.length < 3 ? 'disabled' : '') : '<p class="muted">Waiting for the host to deal.</p>'}</div><p class="muted status-text">${r.players.length}/8 joined${r.players.length < 3 ? ' · Need at least 3 to start' : ' · Ready when you are'}</p>`;
    case 'reveal': return `<h2>For your eyes only.</h2><p>Make sure nobody can see your screen.</p><button id="reveal-role" class="role-card" aria-expanded="${revealed}">${revealed ? `<small>Your role</small><strong>${r.role === 'chameleon' ? 'The Chameleon' : esc(r.secret)}</strong><small>${r.role === 'chameleon' ? 'You don’t know the word. Listen. Blend in.' : 'You know the word. Keep your clue subtle.'}</small>` : '<strong>Reveal your card</strong><small>Tap to peek. Tap again to hide.</small>'}</button>${r.players.find(p => p.id === r.me).ready ? '<p>Ready. Waiting for the others…</p>' : button('ready', 'I’m ready', !revealed ? 'disabled' : '')}<p class="muted">${r.players.filter(p => p.ready).length}/${r.players.length} ready</p>`;
    case 'clues': {
      const next = r.order[Object.keys(r.clues).length];
      return `<h2>${next === r.me ? 'Your clue. Play it cool.' : `${esc(nameOf(next))} is thinking.`}</h2><p>Give one word related to the secret. Repeated clues are allowed.</p>${next === r.me ? '<form id="clue-form" class="form-stack"><label for="clue">Your one-word clue</label><input id="clue" name="text" required maxlength="40" autocomplete="off" placeholder="Subtle, but not too subtle…"><button>Share clue</button></form>' : '<p class="muted">Your turn follows the player order below.</p>'}`;
    }
    case 'discussion': return `<h2>Someone’s blending in.</h2><p>Discuss the clues together, in person or on your voice call. Who’s pretending?</p>${host ? button('vote-open', 'Open voting') : '<p class="muted">The host opens voting when you’re ready.</p>'}`;
    case 'vote': return `<h2>Who’s the Chameleon?</h2><p>Your vote stays private until everyone has voted. Votes are final.</p>${r.votedIds.includes(r.me) ? '<p>Vote locked. Waiting for the others…</p>' : `<div class="vote-options">${r.players.map(p => button('vote', esc(p.name), `data-target="${p.id}"`)).join('')}</div>`}<p class="muted">${r.votedIds.length}/${r.players.length} votes in</p>`;
    case 'tie': return `<h2>Too close to call.</h2><p>${esc(nameOf(r.dealerId))}, the dealer, decides between the tied players.</p>${r.me === r.dealerId ? `<div class="vote-options">${r.tiedIds.map(id => button('tie', esc(nameOf(id)), `data-target="${id}"`)).join('')}</div>` : '<p class="muted">Waiting for the dealer’s decision.</p>'}`;
    case 'guess': return `<h2>Caught. But not beaten.</h2><p>${esc(nameOf(r.chameleonId))} is the Chameleon.</p>${r.me === r.chameleonId ? `<p>Guess the secret word. ${r.guessesLeft} ${r.guessesLeft === 1 ? 'guess' : 'guesses'} left.</p><form id="guess-form" class="form-stack"><label for="guess">The secret word</label><input id="guess" required maxlength="80" autocomplete="off"><button>Make my guess</button></form>` : '<p>Stay quiet while the Chameleon makes a final guess.</p>'}`;
    case 'result': {
      const result = { escaped: 'The Chameleon slipped away.', guessed: 'A very good guess.', caught: 'The table wins.' }[r.outcome];
      return `<h2>${result}</h2><p><strong>${esc(nameOf(r.chameleonId))}</strong> was the Chameleon. The secret was <strong>${esc(r.secret)}</strong>.</p><p>${r.outcome === 'escaped' ? 'Chameleon +2 points.' : r.outcome === 'guessed' ? 'Chameleon +1 point.' : 'Everyone else +2 points.'}</p>${r.winnerIds.length ? `<h3>${r.winnerIds.map(id => esc(nameOf(id))).join(' & ')} ${r.winnerIds.length === 1 ? 'wins' : 'win'} the match!</h3>` : '<p class="muted">First to 5 points wins.</p>'}${host ? `<div class="actions">${!r.winnerIds.length ? button('next', 'Next round') : ''}${button('reset', 'New game', 'class="secondary"')}</div>` : '<p class="muted">Waiting for the host.</p>'}`;
    }
  }
}
function render() {
  const r = room;
  app.innerHTML = `<div class="room-top"><div><h1 class="room-title">${r.phase === 'lobby' ? 'Your room' : `Round ${r.round}`}</h1><span class="pill">${r.visibility === 'public' ? 'Public room' : 'Private room'} ${r.code}</span></div><div class="actions"><span class="pill live">${r.players.length} at the table</span>${['lobby', 'result'].includes(r.phase) ? button('leave', 'Leave room', 'class="quiet"') : r.me === r.hostId ? button('abandon', 'Abandon round', 'class="quiet"') : ''}</div></div><p id="connection" class="connection"></p><div class="layout"><section><div class="stage">${stage()}</div>${r.phase !== 'lobby' ? `<section aria-label="Clues"><h3>The clues</h3><ol class="clue-list">${r.order.map(id => `<li><span>${esc(nameOf(id))}${id === r.me ? ' (you)' : ''}</span><strong>${esc(r.clues[id] || '…')}</strong></li>`).join('')}</ol></section><section aria-label="Topic card"><h3>${esc(r.topic)}</h3>${r.topicHidden ? '<p class="muted">Topic face down. With 7–8 players, it stays hidden after clues.</p>' : `<div class="board">${r.words.map(w => `<div class="word">${esc(w)}</div>`).join('')}</div>`}</section>` : ''}</section><aside class="panel players-panel"><h3>The suspects</h3><p class="muted">First to 5 points</p><ul class="player-list">${r.players.map(p => `<li><span class="avatar" aria-hidden="true">${esc(p.name[0])}</span><div class="player-info">${esc(p.name)}${p.id === r.me ? ' (you)' : ''}<small>${p.id === r.hostId ? 'Host' : ''}${p.id === r.dealerId ? ' · Dealer' : ''}${p.ready && r.phase === 'reveal' ? ' · Ready' : ''}</small></div><span class="score" aria-label="${p.score} points">${p.score}</span>${r.phase === 'lobby' && r.me === r.hostId && p.id !== r.me ? button('remove', 'Remove', `class="quiet" data-target="${p.id}" aria-label="Remove ${esc(p.name)}"`) : ''}</li>`).join('')}</ul>${r.role && r.phase !== 'reveal' && r.phase !== 'result' ? '<button id="peek" class="quiet">Peek at my card</button><p id="peek-value" class="muted"></p>' : ''}</aside></div>`;
  connection();
  document.querySelector('#reveal-role')?.addEventListener('click', () => { revealed = !revealed; render(); document.querySelector('#reveal-role').focus(); });
  document.querySelector('#peek')?.addEventListener('click', () => { const el = document.querySelector('#peek-value'); el.textContent = el.textContent ? '' : r.role === 'chameleon' ? 'You are the Chameleon.' : `Secret: ${r.secret}`; });
  document.querySelectorAll('[data-action]').forEach(el => el.onclick = () => command(el.dataset.action, el.dataset.target));
  for (const kind of ['clue', 'guess']) document.querySelector(`#${kind}-form`)?.addEventListener('submit', e => { e.preventDefault(); command(kind, null, document.querySelector(`#${kind}`).value); });
}
async function command(type, target, text) {
  if (type === 'copy') { try { await navigator.clipboard.writeText(inviteUrl()); notify('Invite link copied.'); } catch { notify('Copy the invite link shown above.'); } return; }
  if (['abandon', 'remove', 'reset', 'leave'].includes(type) && !confirm({ abandon: 'Abandon this round? No points will be awarded.', remove: 'Remove this player?', reset: 'Start a new game and reset all scores?', leave: 'Leave this room?' }[type])) return;
  if (busy || !connected) return;
  busy = true; document.querySelectorAll('[data-action], form button').forEach(el => { el.disabled = true; });
  try {
    const phase = room.phase, round = room.round;
    let result;
    try { result = await api(`rooms/${code}/actions`, { type, target, text, revision }); }
    catch (error) {
      if (error.status !== 409) throw error;
      const latest = await api(`rooms/${code}`); update(latest);
      if (latest.phase !== phase || latest.round !== round) throw error;
      // A rejected revision has no side effects. Retry once against fresh state;
      // the authority still validates turn, role, phase and duplicate votes.
      result = await api(`rooms/${code}/actions`, { type, target, text, revision });
    }
    if (result.left) { room = null; code = ''; revision = -1; history.replaceState(null, '', location.pathname); home(); }
    else update(result);
  } catch (e) { notify(e.message); try { update(await api(`rooms/${code}`)); } catch { /* Poll will retry. */ } }
  finally { busy = false; if (room) render(); }
}
async function poll() {
  if (code && room && !busy) {
    try { update(await api(`rooms/${code}`)); }
    catch (e) {
      if (e.status === 403 || e.status === 404) { room = null; revision = -1; home(); notify(e.message); }
      else { connected = false; failures++; connection(); }
    }
  }
  setTimeout(poll, Math.min(1000 * 2 ** failures, 8000));
}
// Hide private information when the screen loses visibility.
document.addEventListener('visibilitychange', () => { if (document.hidden && room) { revealed = false; render(); } });
try { config = await api('config'); } catch { /* Static site: show LAN setup instead. */ }
if (code && config) { try { update(await api(`rooms/${code}`)); } catch { home(); } } else home();
poll();
