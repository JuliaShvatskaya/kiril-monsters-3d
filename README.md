# DNA Monster Arena 3D

A playable browser MVP for a desktop 3D action arena game. Control a blue hero, defeat lizards and dragon bosses, collect Super DNA, buy weapons, and climb a local leaderboard.

## Run locally

```bash
npm install
npm run start
```

Open http://127.0.0.1:5173/ in your browser. The game uses a full-screen canvas and stores leaderboard results in `localStorage`.

## Controls

- `W`, `A`, `S`, `D`: move
- Left mouse click on the arena floor: move to that point
- `Space`: attack
- `Q` or the **SUPER** button: weapon super ability

## Implemented MVP mechanics

- 150-level arena progression with difficulty multiplier `Math.pow(2, Math.floor((level - 1) / 50))`.
- Normal levels spawn chasing lizards worth +1 Super DNA.
- Every 10th level spawns a Dragon boss worth +10 Super DNA.
- Dragon bosses shoot fireballs.
- Three weapons: Axe, Guitar, and Staff.
- Shop unlocks Guitar at 100 DNA and Staff at 1000 DNA.
- Axe melee attacks and shield super, Guitar ranged shots and heal super, Staff poison magic and freeze super.
- Game over and victory overlays.
- Local top-5 leaderboard sorted by highest level, then DNA.

## Known limitations

- Graphics are intentionally simple low-poly shapes with no external art assets.
- Leaderboard is local to the browser and can be cleared with site data.
- The MVP uses CDN-hosted Three.js from the browser; internet access is needed for the first load unless the dependency is vendored later.
