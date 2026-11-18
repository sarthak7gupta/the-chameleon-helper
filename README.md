# The Chameleon

A social deduction game for 3–8 friends on separate devices. One secret word. One Chameleon. Find the player who is bluffing.

## Play on your Wi-Fi

Install Node.js 24+, clone this repository, then:

```sh
npm start
```

The host creates a room and shares the Wi-Fi address printed in the terminal (`http://192.168.x.x:3000`) with friends on the same network. Keep the launcher running. Each player needs their own device or browser profile.

The [deployed frontend](https://sarthak7gupta.github.io/the-chameleon-helper/) provides setup and opens the local game. A browser alone cannot host a listening LAN service; the launcher coordinates play without a hosted backend. LAN rooms are in memory and disappear on restart.

[Multiplayer architecture, rules, release stack and testing](docs/MULTIPLAYER.md)

## Private rooms over the internet

Deploy the included Docker service behind HTTPS with a durable volume:

```sh
MODE=online PUBLIC_ORIGIN=https://game.example.com DATABASE_PATH=/persistent/chameleon.sqlite npm start
```

Friends open that public address and join with a private room code. No local link or account is needed. See the deployment constraints in [the multiplayer guide](docs/MULTIPLAYER.md).

## Original helpers

The original dice/topic web helper is preserved at [helper.html](helper.html). The Python CLI is unchanged:

```sh
uv sync --all-groups
uv run main.py
uv run main.py roll
uv run main.py shuffle
uv run main.py stats
```

## Develop

```sh
npm ci
npm test
npx playwright install chromium webkit
npm run test:browser
npm run build
uv run task check
```

No browser framework or runtime npm dependency. MIT license. Unofficial adaptation; [original game rules](https://www.crownandandrews.com/wp-content/uploads/2017/10/Chameleon-The-Rules.pdf).
