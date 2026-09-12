# Tests

`npm test` runs the dependency-free expedition and gore regression suites. They
load real game rules, gore physics and the update/render paths inside a
deterministic Node VM with no-op DOM, canvas and audio ports. Coverage includes
save migration, UI wiring, reward races, all 24 Guardian weapon/render paths,
mass explosions, particle and tile limits, stain seams, gore settings, retry
cleanup and removal of environmental hazards. Gore settings must produce
identical damage, kill credit and XP drops. These tests do **not** render pixels,
measure phone frame rates or validate browser touch behaviour.

The gore update was also inspected using native Canvas to draw the actual gore
atlas and particle physics over the game's existing scenery. This checks the
new art and compositing; it is separate from browser and device testing.

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

## Crowded-combat regression and comparison

`performance.test.js` covers wall-clock quality control, actual frame caps,
rainbow texture retention/eviction and enemy separation work. The gore suite
also checks coalesced spray and preset-specific ground-paint budgets.

`node tools/test/bench-combat.cjs --frames=600` runs deterministic stress scenes
with no-op drawing ports. Add `--native` with `@napi-rs/canvas` on `NODE_PATH` to
exercise real pixels, and `--case=rainbow`, `--case=horde` or `--case=mass-blasts`
to select one case. Native timing includes a pixel readback to fence deferred
work; it is not browser or phone FPS. `--snapshot=/absolute/path.png` optionally
captures frame 7 outside the timed sample. See `PERFORMANCE.md` for limits.
