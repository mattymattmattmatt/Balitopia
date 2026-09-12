# Crowded-combat performance — build 7

This addresses the reported collapse to roughly 2 FPS. The confirmed defects
are in texture retention, frame timing, enemy separation and overlapping gore.
The exact cause on the reporting phone has not been captured with a device trace.

## What changed

- **Bounded textures.** Skyjumper's continuously changing rainbow orbit colours
  previously produced a new gradient canvas per orb per frame. The cache retained
  those canvases across retries. Rainbow hues now reuse twelve colour buckets.
  Dynamic projectile/effect textures have a separate 256-entry, 8 MiB cache;
  eviction releases the canvas backing store. Permanent character art is separate.
- **Immediate quality response.** Auto used capped simulation time for FPS and
  waited for 300 frames before responding. At 2 FPS that startup period takes
  150 real seconds. The new controller samples actual rendered-frame intervals
  from the start; sustained 2 FPS selects High performance within one second.
  Smaller slowdowns step down the ladder; recovery requires 20 comfortable seconds.
  The selected 30/45/60 FPS target and manual quality preferences are respected.
- **Correct refresh cap.** The 60 FPS setting now also limits rendering on
  90/120/144 Hz displays. Simulation time still has a 50 ms safety cap. Impact
  pauses expire against wall time, and background/resume resets timing history.
- **Less crowd work.** The separation loop referenced an undefined `sepBudget`,
  so its intended staggered grid traversal never skipped a column. It now checks
  one of three columns per frame, rotating through all three. The 300-enemy test
  performs 900 separation cell lookups rather than 2,700 and still spreads crowds.
- **Less transparent overdraw.** Deaths inside the same 64-world-unit cell can
  share airborne spray. New deaths refresh it and can replace old animations at
  the cap. Flying chunks remain separately simulated; every death still requests
  a ground stain. Existing bounded queues, persistent tiled blood and blast damage
  remain in use. Lower presets also spread ground painting across more frames.
- **Cheaper fallback rendering.** Battery saver and High performance use smaller
  backing buffers, skip ordinary enemy shadows and stop animated HUD shadows.
  Threat outlines, elite markers and controls remain visible.
- Removed two obsolete lighting calls that could throw when rendering Sunbeam.
  The optional browser benchmark now pins quality, keeps the horde alive, avoids
  level-up pauses and counts actual game renders instead of unrelated rAF callbacks.

Depth sorting remains: changing the order of a few hundred sprites does not fix
retained textures or redundant transparent draws. No additional full-screen
canvas layer, worker, WebGL dependency or runtime library was added.

## Cosmetic budgets

| Preset | Canvas scale cap | Airborne spray animations | Flying fragments | New fragments/update | Ground stamps/update | Ground tiles |
|---|---:|---:|---:|---:|---:|---:|
| High | 1.15 | 128 | 320 | 128 | 24 | 64 |
| Balanced | 1.0 | 96 | 240 | 96 | 16 | 48 |
| Battery saver | 0.85 | 64 | 160 | 64 | 10 | 32 |
| High performance | 0.7 | 40 | 120 | 48 | 6 | 24 |

Ground stamps can cross tile boundaries, so one stamp may draw to multiple tiles.
The queue remains capped at 256; overload replaces old pending entries. Light
gore further caps painting at 12 stamps/update. Reduced motion and Off retain
their previous behaviour. Damage, kills and XP are independent of cosmetic caps.

## Measured comparisons

The checked-in [raw comparison](docs/performance-comparison.json) contains the
completed before/after runs. Both versions use the same scripted inputs and
quality settings. Baseline: main at `1a555bb5c90e893f1e07d0c353a3d8c9b3676293`.

| Check | Before | Build 7 |
|---|---:|---:|
| Extra canvases, 90-frame native rainbow scene | 560 | 7, then reused |
| Extra canvases, 180-frame native blast scene | 486 | 32 |
| Native blast scene median frame work | 229.794 ms | 152.889 ms |
| Native blast scene p95 frame work | 251.097 ms | 171.198 ms |
| Kills in each native blast scene | 4,458 | 4,458 |
| Active spray animations at blast-test end | 240 | 96 |
| Native horde scene median frame work | 148.853 ms | 152.961 ms |

Blast-frame work fell about 33% in this harness. The native horde-render timing
did not improve; the ~3% difference is not treated as meaningful. These are
single paired measurements, not a statistical study or a phone FPS promise.

Native tests run the real game, sprite pipeline and Canvas renderer through
`@napi-rs/canvas`, with fake DOM and sound. A tiny pixel readback fences each
render so deferred Canvas work cannot accumulate between measured frames.
This CPU renderer/readback differs from browser GPU rendering. Its times must
not be converted into predicted phone FPS. The stress scenes deliberately refill
up to 300 enemies, use all Guardians and large synthetic blast damage. They test
load, not human balance. Native visual inspection confirms abundant red spray,
body fragments and ground staining after the limits.

## Verification and reproduction

- **71 automated tests pass.** New coverage includes wall-clock adaptation,
  30/45/60 FPS caps on a 120 Hz clock, manual preferences, short impact pauses,
  10,000 rainbow hues, texture eviction, real render/retry cache stability,
  separation work, dense spray replacement, paint budgets and the Sunbeam path.
- Existing raid, audio, save, gore/reward and offline-update regressions pass.
- A scripted normal Bo raid completed all three engines and Glob in 120.7
  simulated seconds with 784 kills, 6 Rampages and 39 powershots.
- JavaScript syntax checks, diff checks and the **30 MiB production build** pass.
- Browser touch layout, GPU behaviour, audio under device load and physical-phone
  frame times remain unverified; no browser executable is available here.

```sh
npm test
bash tools/build.sh
node tools/test/bench-combat.cjs --frames=600
# Optional native Canvas installation on NODE_PATH:
node tools/test/bench-combat.cjs --native --case=mass-blasts --frames=180
# Existing Playwright + Chromium installation and a local server required:
npm run bench
```

The debug handle exposes `__balitopia.frameInfo()` for measured render FPS,
target, active quality and backing-buffer dimensions. `Sprites.stats()` reports
dynamic texture entries/bytes. These diagnostics do not add combat text.

After merge and Pages deployment, reopen the game and check **CROWNFALL · BUILD 7**
in Settings. The versioned entry, scripts and offline shell update together;
active runs defer the refresh. Existing saves and the selected gore setting stay.

## Technique references

- Teschner et al. (2003), *Optimized Spatial Hashing for Collision Detection of
  Deformable Objects*, VMV 2003, pp. 47–54.
  [Author-hosted paper](https://cgl.ethz.ch/Downloads/Publications/Papers/2003/Tes03/Tes03.pdf).
  Peer reviewed. **Credibility: 9/10** for spatial subdivision and avoiding
  unnecessary collision candidates; it does not validate these phone results.
- [MDN: Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas).
  Primary platform guidance, not peer-reviewed research. **Credibility: 9/10**
  for caching repeated graphics and limiting rendering work. The budgets and
  performance results above come from this implementation's tests.
