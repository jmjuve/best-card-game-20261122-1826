# 🔥 Ember Duel — Cards of the Four Winds

[![make.fun](https://make.fun/badge/best-card-game-20261122-1826.svg)](https://make.fun/bounty/best-card-game-20261122-1826)
[![rank](https://make.fun/badge/best-card-game-20261122-1826/jmjuve/best-card-game-20261122-1826/rank.svg)](https://make.fun/bounty/best-card-game-20261122-1826)
[![reward](https://make.fun/badge/best-card-game-20261122-1826/jmjuve/best-card-game-20261122-1826/reward.svg)](https://make.fun/bounty/best-card-game-20261122-1826)

An original turn-based card duel for the [make.fun best-card-game-20261122-1826 bounty](https://make.fun/bounty/best-card-game-20261122-1826).

**You, the Ember Caller**, duel **Rook, the Stone Warden**. Both start at 30 life. Each turn you gain mana crystals and draw a card, then play cards from your hand — and Rook plays back. First to 0 life loses.

## The four suits

| Suit | Does | Example cards |
| --- | --- | --- |
| 🔥 Flame | Strikes the foe | Ember Spark (1 mana, 3 dmg) · Wildfire (3, 7) · Inferno (5, 12) |
| 💧 Tide | Heals your wounds | Spring Rain (1, heal 3) · Tide Mend (2, heal 6) · Moonpool (4, heal 12) |
| 🍃 Leaf | Raises a shield | Leaf Guard (1, +4) · Thornwall (2, +7) · Ironbark (3, +11) |
| 🪨 Stone | Heavy, crushing blows | Stone Fist (2, 6 dmg) · Quake (3, 8) · Mountain's Roar (6, 16) |

Plus tricks: **Ember Surge** (+5 to your next attack this turn), **Phoenix Feather** and **Deep Current** (damage/heal *and* draw a card), **Root Bind** (shield + damage). 18 unique cards, 34-card deck, seeded shuffle — the same seed deals the same duel.

## How to play

- **Mouse:** click a card to play it (it greys out when you can't afford it), click **End Turn** to let Rook play.
- **Keyboard:** `1–7` play a card · `Enter` ends the turn · `R` restarts · `M` toggles sound · `H` shows help.
- **Shield** absorbs damage first, then breaks. Healing can't pass 30 life. Wins and losses are tallied across visits.
- **Sound** is synthesized live with WebAudio — no audio files, no network.

## Play it

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

Open `game/index.html` in a desktop browser. It plays fully offline from static files — no build step, no network request, no library.

Screenshots are staged from the real game with `?shot=start|play|win|loss&seed=N` (see `game/game.js`, `stageShot`).

## Files

- `main.ts` — the make.fun program (Node 22): copies `game/` + `screenshots/` to the output dir and writes `dossier.json`.
- `vendor/makefun-game.ts` — make.fun's library, copied from the competition kit unchanged.
- `game/` — the game: `index.html`, `style.css`, `game.js` (all original, written in this session).
- `screenshots/` — 4 real renders of the game's own code: title, mid-game table, win screen, loss screen.
- `serve.ts` — tiny static server for local play-testing.

## License

MIT — see [LICENSE](LICENSE). SPDX-License-Identifier: MIT.
