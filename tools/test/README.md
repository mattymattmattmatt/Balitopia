# Tests

`npm test` runs the dependency-free expedition rules and game-simulation regression suite. It loads the real `data.js`, `expedition.js` and `game.js` inside a deterministic Node VM with no-op DOM, canvas and audio ports. This checks mechanics, save migration, UI event wiring, reward races and all 24 Guardian weapon paths. It does **not** render pixels, measure phone frame rates, or validate browser touch behaviour.

## Browser regression and performance tests

The original browser suites remain available separately:

Both scripts drive the real page in headless Chromium against a local server,
so start one first:

```bash
python3 -m http.server 8811     # from the repo root
npm run test:browser            # browser correctness checks
npm run bench                   # frame-rate comparison across quality presets
```

`npm run test:browser` asserts the things that have actually broken before: every quality
preset applies without throwing, the camera widens as the roster grows, the
field music rotates per Glob kill without moving the biome, the performance
preset's enemy cap holds, and the Guardian unlock cascade still fires.

`npm run bench` reports median fps per preset under 4x CPU throttling with a
saturated horde and an 18-strong squad. Throttle with `THROTTLE=6 npm run
bench` to model a slower phone.

Two traps worth knowing, both of which produced false results while this
harness was being written:

- **Pin the quality preset.** With `prefs.quality` on `auto`, the adaptive
  ladder climbs back up mid-measurement on a fast machine and takes
  `maxEnemies` with it. Set `B.prefs().quality` before measuring.
- **Every spawn path now observes the cap.** `spawnEnemy` enforces the selected quality preset for normal waves and scripted encounters.

Run-to-run variance is roughly ±3 fps, so the scripts take a median of three
and single-digit differences between presets should not be read as signal.

Install the existing Playwright dependency and its Chromium browser before running these browser suites. They use Playwright’s installed Chromium by default; set `CHROMIUM_PATH` only to use a custom browser executable.
