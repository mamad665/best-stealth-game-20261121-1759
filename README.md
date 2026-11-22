[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/mamad665/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/mamad665/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

# Shadow Vault — a stealth game

A top-down 2D stealth game. You are **the thief** breaking into a guarded museum at night: steal every intel file, then reach the exit unseen. Guards patrol with vision cones — walls block their sight, shadows hide you, and walking makes noise. Get caught three times and the night is over.

Entry for [make.fun's "Make the best stealth game" bounty](https://make.fun/bounty/best-stealth-game-20261121-1759).

## Play

Serve `game/` with any static server and open `game/index.html` in a desktop browser (or `node serve.ts` from the repo root, then open http://localhost:8080).

- **WASD / arrows** — move
- **Hold Shift** — sneak: slow, quiet, harder to spot
- **P** — pause · **Space / click** — start / restart

Three levels — Gallery Wing, Vault Corridor, The Grand Vault — each with more guards, more intel, and tighter patrols. Finish a level without ever raising the alarm for a **Ghost bonus** (+300).

## How it plays

- **Vision cones**: a guard sees you only inside its cone, with a clear line of sight. Detection fills faster up close and in the open; shadows slow it down; sneaking shrinks how far you can be seen.
- **Suspicion and alarm**: partial detection makes guards investigate the spot where they saw you. Full detection raises the alarm and every guard chases you until you break line of sight long enough.
- **Noise**: walking close to a guard draws it over to listen. Sneak past instead.
- **Cover**: walls block both sight and movement — learn the patrol routes (drawn faintly on the floor) and time your crossing.

## Build

`main.ts` (Node 22) generates the entry dossier:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

Screenshots are real renders of the game's own code, staged with `?shot=start|play|end&seed=1`.
