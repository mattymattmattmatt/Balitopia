# Gore and explosion performance

Kills should leave a mess while the player keeps moving. This update replaces
the disappearing-body animation with blood spray, flesh, bone and hide chunks.
Explosions and powershots throw fragments away from the blast centre. Chunks
bounce once, settle and leave small splashes; the larger death splatter remains
on the ground.

## Rendering and limits

`js/gore.js` creates a 512×128 atlas containing eight puddle variants and
pre-rotated chunks. It uses its own seeded cosmetic random generator; gore
does not consume the game's random stream or change rewards. No new art files,
network requests or runtime dependencies are required.

Blood and settled chunks are baked into sparse ground textures: 512 world
units per tile at 128×128 pixels. Each occupied visible tile needs one draw,
regardless of how many enemies died there. Stamps crossing seams are written
to all intersected tiles. Distant tiles are reused when the cache fills;
stains otherwise persist until a new run. A bounded queue spreads texture
painting across frames rather than writing every splatter during a mass kill.

| Preset | Airborne fragment cap | New fragments per update | Ground tile cap | Cosmetic effect cap | Ground + atlas RGBA bytes |
|---|---:|---:|---:|---:|---:|
| High | 320 | 128 | 64 | 80 | 4.25 MiB |
| Balanced | 240 | 96 | 48 | 56 | 3.25 MiB |
| Battery saver | 160 | 64 | 32 | 36 | 2.25 MiB |
| High performance | 120 | 48 | 24 | 24 | 1.75 MiB |

The byte figures describe pixel storage, excluding browser/driver overhead.
The paint queue holds at most 256 stamps; Full mode paints at most 24 per update,
Light at most 12. Reduced motion uses ground stains without flying chunks.
Off immediately clears both. Quality changes trim existing pools immediately.

General particles now have a 160-slot pool and a per-update spawn budget.
Cosmetic effects have a separate hard cap; new blasts take priority over muzzle
flashes and impacts. Damage, blast radius, enemy kills and XP are resolved even
when a visual pool is full. Important enemy attack telegraphs remain separate
from the cosmetic effects budget.

The full-screen light composite, animated ambient darkening and projectile
trails are removed. Blasts use one small cached core and a thin ring; chains and
beams have fewer drawing passes, and puffs use plain alpha instead of additive
glow. Rainbow projectile colours are quantized into twelve cacheable hues.
Scenery density and default render resolution are reduced. Auto quality tops
out at Balanced so a quiet opening does not enable heavier graphics before
the next crowded fight. High remains available manually.

Repeated critical/heavy hits no longer invoke hit-stop. Powershots no longer
freeze combat or force slow motion after a mass kill. Audio and restrained
shake still provide impact feedback. Setting Screen flash to zero now also
disables the powershot flash completely.

## Fewer interruptions

The centre-screen banner and coaching elements and their timer machinery are
removed. Important run progress remains in the HUD and recap. Six recent
announcements can be read in the collapsed **Recent action** section in Pause.
Tutorial controls remain available in How to Play.

Sea pushes, wind drift, jungle cover slowdown, the rising damage tide and
shrinking arena are removed. Ebb Tide is removed from the curse pool. Cataclysm
uses an elite-focused rule. Existing combat waves, surges, siege cages,
minibosses and bosses remain: these provide enemies and progression rewards.

The service worker cache is bumped and includes the gore script. Existing
saves, unlocks and currency retain their identity. Monster gore defaults to
Full and is stored with the other settings.

## Verification

- All 27 rules/simulation regressions pass, including the existing 24-Guardian
  smoke test with render-path calls.
- Stress coverage includes 9,000 synthetic deaths against the gore budget,
  repeated batches of 120 actual enemies killed by explosions on every quality
  preset, identical combat outcomes across gore settings, tile seams, settings,
  retry cleanup, environmental-rule removal and pooled splitting-elite deaths.
- The production build and JavaScript syntax checks pass; the new script is
  present in the app shell and offline precache.
- Native Canvas renders of the real atlas, airborne fragments and settled
  stains over the existing scenery were inspected. These are renderer samples,
  not screenshots of browser gameplay.

Phone FPS, browser touch input and offline updating still need device testing.
The limits above bound work and memory; they do not establish a measured FPS
gain. Playtest a large explosion build with a full squad and compare frame
times on the same phone before releasing.

## Technical reference

W. T. Reeves (1983), *Particle Systems—a Technique for Modeling a Class of
Fuzzy Objects*, ACM Transactions on Graphics 2(2), 91–108,
[DOI 10.1145/357318.357320](https://doi.org/10.1145/357318.357320).
Peer reviewed. **Credibility: 9/10** for the foundational particle-lifecycle
model. The pooling, tile cache and budgets here are implementation decisions;
this paper is not evidence of performance on modern phones or in Balitopia.
