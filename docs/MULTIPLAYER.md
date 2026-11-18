# Multiplayer release stack

Merge in order: **v1 LAN → v2 private online rooms → v3 public guest rooms → v4 accounts**. Each PR targets the preceding branch. Retarget the next PR to `main` after its base merges; preserve commit ancestry (merge commits rather than squash, or restack the remaining branches).

## v1: same Wi-Fi

Requires Node.js 24+. No runtime dependencies, cloud service, or account:

```sh
npm start
```

Open `http://localhost:3000` on the host computer, create a room, and share the invite using the **Wi-Fi address** printed in the terminal, for example `http://192.168.1.10:3000/?room=AB12CD34`. Invites created at localhost use the detected Wi-Fi address automatically; verify it matches the launcher output if multiple adapters/VPNs are active. Guests open it in their phone browsers. The launcher must keep running; firewall permission may be needed. Guest Wi-Fi/client isolation can prevent connections. `PORT=4000 npm start` changes the port.

A web page cannot bind a listening TCP port or serve itself from a LAN IP. The local launcher is therefore required; “no backend” here means **no hosted backend**. The host computer is the authority and serves the deployed frontend's same static files. The HTTPS GitHub Pages frontend shows launcher setup and can navigate to the HTTP Wi-Fi address. It never tries mixed-content API calls to a local network.

Rooms expire after 24 hours without an action; launcher restart discards rooms. Each device has an HttpOnly session cookie for seven days; refreshing resumes membership. Use distinct browser profiles/devices for different players. Clearing cookies loses a guest seat; the host can abandon a round and remove the seat. This LAN traffic is HTTP: play on a trusted network.

## Rules and product decisions

Based on the [official rules](https://www.crownandandrews.com/wp-content/uploads/2017/10/Chameleon-The-Rules.pdf). Roles and a secret word replace physical code cards/dice. One shared 4×4 topic is randomly selected from the existing repository's topics. The original dice helper remains at `/helper.html` (including its existing language/theme controls).

3–8 players. Reveal privately; all players ready before clues. Ordered one-word clues start with the dealer. Repeated clues and self-voting are allowed. Discuss in person or via a separate voice call, then the host opens sealed voting. Dealer chooses only among tied leaders. Chameleon guesses once, twice with 3 players. The topic hides after clues with 7–8 players. Escape +2, correct guess +1, failed guess everyone else +2. First to 5 wins; simultaneous winners share the win. Previous Chameleon deals next.

Host may abandon a stalled round without awarding points. Seats remain until leaving/removal; a temporary network loss never deletes players. Host transfer happens on leaving in the lobby. Leaving after a result reopens the lobby and resets the match so changed rosters cannot carry unfair scores.

## Trust boundary

The authority validates membership, host/dealer permissions, phase, turn, target, lengths, and revision on every command. Commands run against a copy and commit only on success. Stale/duplicate commands get 409; the client refreshes and retries once only if the round and phase are unchanged. It never retries after an uncertain network outcome. Votes stay sealed until complete. Chameleon responses contain no secret index, selected word, or identities of other roles before accusation/reveal. All topic words are public until the face-down rule. The host process itself is trusted; it can inspect memory. Client rendering escapes player content. Same-origin JSON-only writes, rate limits, request caps, static-file allowlist and a strict CSP protect the multiplayer surface. No passwords/secrets belong in URLs.

## Verification

```sh
npm ci
npm test
npx playwright install --with-deps chromium webkit
npm run test:browser
npm run test:online
npm run build
uv sync --all-groups
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run ty check
```

Node tests exercise all game outcomes, 3/4/6/7/8 players, role projection, sealed voting, ties, scoring, turn/phase/host guards, capacity, stale actions, malformed HTTP, origins, and static-file protection. Playwright uses three isolated browser contexts at phone dimensions for a full round and refresh, plus keyboard modal dismissal and overflow. Real phones on a shared Wi-Fi still need a manual smoke test (network routing/firewalls are environment-specific).

## v2: online private rooms

Run the same frontend and API on **one** Node.js 24 process behind an HTTPS reverse proxy:

```sh
MODE=online PUBLIC_ORIGIN=https://game.example.com DATABASE_PATH=/persistent/chameleon.sqlite npm start
```

Or set `PUBLIC_ORIGIN` and run `docker compose up --build -d`. The container runs as a non-root user, listens behind the host's reverse proxy at `127.0.0.1:3000`, and mounts a named persistent volume. Configure the proxy to preserve `Host`, terminate TLS, and forward all paths. There is no cross-origin API deployment. Open the backend's public HTTPS address directly, create a room, and share its code/link. Private codes are not listed anywhere.

`PUBLIC_ORIGIN` is required and must match the public origin exactly, without a trailing slash/path. Cookies use Secure over HTTPS. Never expose the HTTP upstream directly to the internet. Online local development can use `PUBLIC_ORIGIN=http://localhost:3000`. Online startup rejects arbitrary HTTP public origins. `GET /health` supports health checks. Node's native SQLite module avoids a runtime dependency.

Room and session updates are written durably before acknowledgment. SQLite uses WAL/FULL synchronous mode. Tokens are stored only as SHA-256 hashes; cookie secrets never enter URLs or room views. A restart restores rooms, scores, and guest seats; expiry still applies. LAN mode remains memory-only. **Do not run multiple replicas** against separate files: the in-memory authority requires a single writer. Mount durable storage and back it up (use SQLite's online backup tooling or stop the service before copying the database/WAL). Restore the complete backup before restarting. Database files contain hidden roles and must remain private. Deployments that discard their filesystem do not meet persistence requirements.

GitHub Pages remains the LAN setup frontend, independent of the online service. No online hosting account or paid resource is provisioned by these PRs. Backend deployment requires a chosen HTTPS host with durable storage; the Docker configuration is ready for it.

## v3: public rooms without login

On the online service, hosts choose **Private (default)** or **Public** when creating a room. The home screen lists up to 50 public tables; players enter a display name and choose Join table. No account, email, or local link is needed. Discovery returns only room code, host-chosen display-name title, and player count. It never returns player lists, roles, words, scores, or private room identifiers.

Only lobbies with fewer than eight seats, an unexpired room, and a host seen within the last minute are discoverable. A restarted service lists a room after its host reconnects. Polling refreshes listings every 10 seconds. Active/full rooms disappear; direct joins still validate phase/capacity atomically. A removed guest session cannot rejoin the same room, although clearing cookies can evade guest-only removal. Public guest play provides no verified identity. Hosts can abandon a round and remove disruptive/stale seats. Talk remains in-person or on a separate call; this version does not add public text/voice chat.

Each guest may occupy at most three rooms. Read/write limits and room/session/request caps bound abuse; a reverse proxy may apply additional per-IP limits. Public discovery is unavailable in LAN mode.
