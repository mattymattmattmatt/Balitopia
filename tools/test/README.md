# Browser test harness

Both scripts drive the real page in headless Chromium against a local server,
so start one first:

```bash
python3 -m http.server 8811     # from the repo root
npm test                        # correctness checks
npm run bench                   # frame-rate comparison across quality presets
```

`npm test` asserts the things that have actually broken before: every quality
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
- **`spawnEnemy` bypasses the cap.** The limiter lives in `spawnWave`, so
  injecting entities directly measures an uncapped field. Spawn at most
  `getQL().maxEnemies` to model what a player actually meets.

Run-to-run variance is roughly ±3 fps, so the scripts take a median of three
and single-digit differences between presets should not be read as signal.
