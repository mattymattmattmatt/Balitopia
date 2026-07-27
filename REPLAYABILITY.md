# 🔁 Balitopia — Replayability

A one-and-done survival run gets old fast. This is what now makes a *second* (and tenth) run
worth starting, plus ideas parked for later.

## Shipped in this pass

### 1. Difficulty / Ascension ladder
Four tiers — **Guardian → Warden → Nightmare → Cataclysm** — each scaling enemy HP & damage,
boss HP, spawn rate, **and your score multiplier** (1.0× → 1.6× → 2.4× → 3.5×). You start with
only Guardian; **clearing a tier unlocks the next**, so there's always a concrete "beat this,
unlock that" carrot. Higher tiers aren't just harder, they're the only way to a top score.

### 2. A run **score**, so runs are comparable
Every run resolves to a number built from kills, time survived, Guardians freed, level, damage
dealt to King Glob, a big victory bonus — all multiplied by difficulty. One clean figure to beat.

### 3. Detailed post-run stats screen
Replaces the old four-number game-over. Shows the score (with all-time rank + NEW BEST flash),
the difficulty, a summary row (time / kills / freed / level / King Glob %), and a **per-Guardian
performance table**: portrait, mastery tier badge, a damage bar, damage %, kills, and time spent
controlling them. It answers "who actually carried that run?" — which shapes who you pick next.

### 4. Local leaderboard + Guardian Codex (Hall of Records)
- **Best Runs** — top 12 runs saved to `localStorage`, medals for the top 3, reachable from the
  title menu (**RECORDS**) and the stats screen.
- **Guardian Codex** — a 24-slot collection that remembers the **highest mastery tier** you've
  ever pushed each Guardian to, across all runs. Long-horizon goal: take all 24 to Super Saiyan.
  Freed-but-never-mastered Guardians nag at you from the grid.

Everything persists in one `balitopia` localStorage object (`records`, `mastery`, `maxDiff`,
`bestScore`, `lastHero`, `lastDiff`). No account, no server — it just remembers you.

### 5. A meaner King Glob
Base boss HP nearly doubled (16k → 30k) and it scales up to 4× on Cataclysm, so the finale is a
real damage check that rewards freeing more Guardians and leaning on powershots.

## Why this drives repeat runs

- **Mastery loop:** pick a hero → the run's stats show who performed → chase their Codex tier next time.
- **Ladder loop:** win → unlock a harder tier → higher ceiling on score.
- **Score loop:** the leaderboard turns every run into an attempt to beat your own #1.

### 6. Endless mode (shipped)
Killing King Glob no longer ends the run — it starts the next **round**: enemies gain +45% HP
and +30% damage per round, and Glob returns every 2:30 with +60% HP, arriving pre-enraged.
Each kill banks 8,000 score (×difficulty); the run ends only at death, and any run with at
least one Glob kill counts as a win (crowns ×N on the leaderboard).

### 7. Daily Challenge (shipped)
A date-seeded run from the title menu — fixed Guardian, difficulty, region and cage rotation,
identical for everyone that day, with its own dated best-score board in Records.

### 8. Shell Shrine — meta-currency & permanent perks (shipped)
Every run banks **shells** (1 per 500 score). Spend them in the **🐚 Shell Shrine** on stacking
starting perks: **Sturdy Shell** (+HP), **Sharpened Kin** (+damage), **Fleet Footed** (+speed),
**Old Wisdom** (+XP), **Gem Sense** (+pickup range), **Head Start** (pre-broken cages), and
**Fortune** (+level-up rerolls). Perks never apply to daily runs, keeping that board fair.

### 9. Achievements (shipped)
Ten unlockables tracked across runs — Regicide, Jailbreak (free all 24), Transcendent (a Super
Saiyan), endless-round milestones, Lone Guardian (Glob solo), Island Saviour (Cataclysm), Full
Codex, and lifetime kill/damage marks. Newly earned ones flash on the stats screen and fill a
grid in Records.

### 10. Biome runs + deeper hero builds (shipped)
Runs play out on **jungle / sea / sky** biomes with their own ground and music. Each Guardian
now brings **two signature upgrades** into the level-up pool once freed, weapons **evolve** at
Super Saiyan, and three new enemy archetypes (spitter, runner, warden) plus a two-phase boss
(enrage → final frenzy) keep the horde reading fresh deep into a run.

### 11. Reroll / Skip + shareable recap (shipped)
The level-up screen has **Reroll** (limited, extendable via Fortune) and **Skip for +15% HP**.
Every game-over screen can export a **1080×1080 run-recap poster** via the native share sheet
(PNG-download fallback) — a built-in "beat my score" hook.

## Parked ideas (say the word and I'll build them)
- **Run modifiers / mutators** — opt-in challenges (glass cannon, no possession, double horde)
  for bonus score multipliers.
- **Weekly rotating boss modifiers** or a second, distinct boss.
- **Online/global leaderboards** (not just local) — needs a tiny backend; I can spec one.

---

# Polish pass — what the design review changed

The [design review](DESIGN_REVIEW.md) scored the previous build **57/100** and identified the
core problem as *content-rich, systems-poor*: 24 characters, 6 enemy types, a boss, 3 biomes
and a meta-shop sitting on top of a combat loop where the player held a thumb down and watched.
This pass rebuilt the systems layer.

## The four things that changed what kind of game this is

### 1. The level-up draft is face-up
Cards used to be dealt **face-down** — you picked one of three unknowns. That converts the
genre's central decision (repeated 30–60× per run) into a slot-machine pull and makes every
system underneath it invisible at the moment of choosing. The flip animation is kept as an
*entrance*; the hidden information is gone. A build strip under the cards shows what you've
already taken.

### 2. Relics — a real build layer
Hero weapons are fixed for the whole run, and all 15 old upgrades were flat multipliers, so
"a build" didn't exist. Eight **Relics** now occupy a second weapon slot (2 slots, 4 levels
each), drafted from the same pool. They're hero-agnostic on purpose: the same relic plays
differently on 24 kits. The generic pool also grew from 15 scalars to 24 entries including
seven **rule-changers** (Ricochet, Bloom, Undertow, Kindred, Riptide, Low Tide, Echo) and a
defensive axis that didn't exist at all (lifesteal, ward, armour, crit).

### 3. The player has something to do
Positioning was the only continuously-expressed skill, and the only ability fired roughly once
a minute. Added: a universal **dash** (6s, i-frames, double-tap), **critical hits**, a
**combo multiplier** that rewards aggression, and **squad formations** (Ring / Vanguard /
Focus) so the allies are commanded rather than watched.

### 4. Possession costs something
The signature mechanic was free, instant and unlimited, so it carried no decision. It now
costs **✦ Soul** (3 charges, one per 25s) and pays out **Soulburn** — +40% damage for 3s —
plus **Resonance** stacking for swapping into mastered Guardians. Chain-swapping through a
horde is now a skill expression.

## Verified bugs the review found, and fixed

| Bug | Effect |
|---|---|
| `Sound.sfx.hit()` defined but never called | Every hit in the game landed in **silence**; `hit.mp3` shipped unused |
| Orbit/aura visuals ignored hero mods + evolution | Yelp's *Fourth Orb* and Skyjumper's *Constellation* added an **invisible damaging orb**; Gus's *+40% radius* grew a hitbox that never changed on screen |
| Poison ticks bypassed `addDamage()` | Chocker's DoT — his primary damage — never charged his own mastery or powershot |
| Cage auto-targeting overrode all targets within 250px | Fighting Glob beside a cage poured your entire DPS into a 70 HP wooden box |
| Enemy hitboxes were foot-anchored circles under 2–4× taller sprites | Shots visibly passed through torsos and connected with bare ground. The boss had the fix; regular enemies never did |
| Warden armour was omnidirectional | The shield arc promised a flanking solution the code never implemented |
| Runner death-burst resolved in the same frame it died | Unavoidable damage. Now fused and telegraphed |
| `#banner` was `white-space:nowrap` at up to 28px | The game's most exciting announcements clipped off both edges |
| `bigKill()` (a *reward* cue) played on the boss slam | Reward audio on a damage event |

## Everything else

**Feel** — crits, hit-stop, directional trauma shake, time dilation on dramatic beats, death
animations, four particle kinds, per-archetype projectile art with trails, an additive light
layer, camera lead + dynamic zoom.

**Pacing** — run compressed 8:00 → 6:00 with a landmark roughly every 45s (scripted opening
fight, elites, cage siege, horde surge, miniboss, chest). Spawn rate opens at 3.5/sec instead
of 1.4 — the first 45 seconds used to be an empty field. Post-boss dead time cut 150s → 90s
and filled with a chest, a mutator draft and an elite wave.

**Content** — Burrower and Siren enemies, Elites with five affixes, the Golden One, chests,
cage sieges, a second boss (**Reef Mother**), boss modifiers, King Glob's Gorge and Crown
Split, and eight endless **mutators** drafted one-of-two per round.

**Retention** — the unlock cascade the game was missing: 4 starter Guardians, 20 earned, with
the next three goals always visible on the select and death screens. Cause-of-death diagnosis.
Achievement and Codex milestone **payouts**. Daily streaks with a grace day and three rotating
objectives. A Deep Shrine tier priced for a ~100-run horizon. **Prestige** at full Codex.

**Mobile** — PWA manifest, service worker (cache-first shell, SWR media), maskable icons, and
iOS Add-to-Home-Screen coaching, because `requestFullscreen` is a permanent no-op on iPhone
and there was previously **no path to fullscreen on iOS at all**. Area-based viewport scaling
so a 21:9 phone no longer sees 30% more world than a 4:3 tablet. Wake lock, `pagehide` flush,
proper interruption handling.

**Safety** — debounced dual-slot saves with checksums and visible failure warnings (a quota
error used to be swallowed entirely, silently losing everything), and crash recovery so one
exception can't permanently kill the frame loop.

**Accessibility** — control layout (stick side/type/size/dead zone), quality presets with an
adaptive safety net, frame cap, shake and flash intensity, damage-number density, per-deficiency
colour modes, assist mode, and text scaling that now covers every screen instead of seven
HUD elements.

## Performance

| Scenario | Before | After |
|---|---|---|
| Early run | 60 fps | 60 fps |
| 150 enemies | 60 fps | 60 fps |
| 300 enemies | 53.7 fps | ~50 fps *(with far more systems running)* |
| 300 + 23 allies + relics | — | ~48 fps high / **60 fps battery** |
| Cage-break hitch | 48.5 ms | coalesced |

Seamless ground tiling removed the visible 256px grid; the large-scale variation is baked into
a single 768px tile rather than drawn as a second full-screen layer. Status effects are
pre-baked sprites, shadows are bucketed for 1:1 blits, enemy draws are quantised and batched,
and decor is spatially bucketed so density could go 150 → 900 props.

---

# Audio, lighting & VFX pass

## Audio delivery — 100.8 MB → 17.9 MB

`tools/encode_audio.sh` now runs for real. The source library had two
pathological shapes:

| | Before | After | Cut |
|---|---|---|---|
| Hero themes (×24) | full 3:50 songs @ 182 kb/s stereo, 2.3 MB each | 14s hook @ 96k mono, ~170 KB | **93%** |
| Entrance stingers (×24) | 3 seconds of **uncompressed PCM** @ 1536 kb/s, 550 KB each | 64k mono Opus, ~22 KB | **96%** |
| Hero audio total | 67.9 MB | 4.5 MB | 93% |
| **Whole library** | **100.8 MB** | **17.9 MB** (Opus) | **82%** |

The full hero songs are never shipped — the 14s hook serves both the select
screen preview *and* the new possession flourish, which is every use the game
has. Both Opus and AAC are produced; `audio.js` feature-detects with
`canPlayType` so a browser fetches exactly one, and falls back to the raw
sources automatically on a plain source checkout.

**A complete first session now transfers 5.1 MB** (previously ~18.6 MB, and
that was with only four hero previews). Repeat visits are near-zero via the
service worker. `preview()` also *aborts* in-flight fetches instead of pausing
them — `pause()` alone keeps downloading, which was most of the original waste.

Newly audible: the 24 hero themes now play a 5-second flourish over the battle
music when you possess that Guardian. They were previously heard for about
eight seconds per session, on the select screen only.

## Lighting

There was no lighting at all; the first pass added a single additive white
glow, which washes out because additive light only reads if something darkens
the scene first. It is now a two-part model:

1. **Ambient shade** — a `multiply` tint keyed to biome (jungle / sea / sky each
   have day, dusk and night palettes) that also functions as a *clock*: the
   island dims as King Glob's arrival approaches, and deepens further while a
   boss is alive.
2. **Coloured emitters** — up to 90 per frame, composited from a half-resolution
   buffer, each tinted to its source: hero accent, weapon colour, elite affix,
   fire orange, frost blue, cage gold, boss green/magenta. Emitter brightness
   scales with the ambient darkness so the balance holds all run.

Ambient darkness is deliberately capped at 0.62, not 1.0 — "colour = danger" is
the game's primary information channel, so the world may get moody but enemy
tiers must stay readable. A wide soft fill light around the player guarantees
the area you're actually fighting in stays legible, and **Dynamic lighting** is
a 0–100% slider in Settings.

## VFX

| Effect | Before | After |
|---|---|---|
| Explosion | one filled circle | white-hot core + expanding shock ring + drifting smoke |
| Slash | uniform stroked arc | tapered swoosh sprite with a white-hot leading edge, swept through the arc |
| Beam | two stroked lines | soft outer glow + core + white centre + impact burst at the far end |
| Chain lightning | one thin polyline | jagged multi-segment bolt with random forks and a flash at every node |
| Shockwave | stroked circle | soft ring sprite with a bright leading edge |
| Tier-up | two ellipse strokes | ground rings + a rising column of motes + a halo |
| Muzzle | *nothing* — projectiles simply appeared | per-archetype flash cone at the firing point |
| Impact | *nothing* | directional spark burst oriented to the hit normal |

All new VFX sprites are colour-keyed and cached (the palette is bounded by hero
accents and weapon colours), and the impact/muzzle emitters are budgeted so a
300-enemy screen can't flood the effect list.

## Also fixed in this pass

- **Overlay stacking.** Level-up, chest reveal and mutator draft could all open
  on top of one another — a boss kill drops a chest, its gems trigger a
  level-up, and the round's mutator draft lands in the same second. They now
  queue and play in order.
- **RESUME scrolled off-screen.** The roster grid grows with every Guardian you
  free; with a full roster on a 390px-tall landscape screen the button flowed
  below the fold. The grid now scrolls inside the screen with the controls
  pinned.
- **Blind-picking during the reveal cascade.** A fast tap could select a
  level-up card before it had flipped. Cards are now unselectable until revealed.
- **Opening spawn rate re-tuned** from 3.5/sec back to 2.4/sec. Soak testing
  showed a *passive* player dying at 0:21 on the easiest difficulty; a kiting
  player now takes almost no damage early and dies around 2:20, which is the
  right shape — difficulty that rewards skill rather than punishing arrival.

Performance held throughout: 60 fps early, 57 at 150 enemies, 53 at 300, 53
with 300 + 23 allies + relics, and 60 on the battery preset.

---

# Performance, camera & controls pass

Driven by real device feedback: *"gets really laggy on my phone, a bit too
zoomed, and the controls don't feel as fluid as they used to."* All three were
real, and two of them were regressions I introduced.

## Performance — the frame was never JS-bound

Section-profiling the renderer (`__balitopia.prof(true)`) showed only 3–12 ms of
JavaScript per frame even at 300 enemies. The cost was **fill rate**, so the
optimisations that mattered were all about pixels, not code.

A micro-benchmark of the individual canvas operations at a real canvas size,
under 3× CPU throttling, found the culprit immediately:

| operation | cost |
|---|---:|
| full-screen `drawImage` of the light buffer, **smoothed** | **21.3 ms** |
| the same `drawImage`, **`imageSmoothingEnabled = false`** | **4.6 ms** |
| full-screen `multiply` fillRect | 3.4 ms |
| 90 individual additive lights drawn directly | 182 ms |

One flag on the light composite was a **4.6× win**. Bilinear-filtering a million
pixels was the entire cost, and a light map is nothing but smooth gradients, so
nearest-neighbour upscaling is visually indistinguishable. The same benchmark
also confirmed the light-*map* approach is correct: drawing lights directly to
the screen is catastrophically worse.

**What changed**

- **Light composite: smoothing off.** The single most important line in the renderer.
- **Single-pass light map.** Was two full-screen ops (an ambient `multiply` fill,
  then an additive composite). Now the buffer is cleared to the ambient colour,
  emitters are added into it, and it composites once with `multiply`. Half the
  fill, and lit areas return to their true colour instead of blowing out to white.
- **DPR cut** from 1.75 to 1.3 / 1.05 / 0.9 across the presets — it scales every
  full-screen fill quadratically and the art is soft and painted, not pixel art.
- **Redundant background clear removed** — the ground pass covers every pixel and
  the context is `alpha:false`.
- **Low-HP vignette cached.** It rebuilt a `createRadialGradient` *every frame*
  it was visible, which is every frame below 30% HP.
- **Face-card idle video** no longer runs during gameplay below the high preset —
  it was a per-frame video decode and composite for a 46 px card.
- **HUD bars animate `transform: scaleX` instead of `width`**, so a HUD tick
  composites instead of triggering layout and paint; HUD subtrees get `contain`.
- **Boss queries throttled.** The Gorge swept a 600 px radius (~200 hash cells)
  every frame; crown fragments scanned all 400 projectile slots each. Both now
  tick a few times a second against a much smaller radius.
- **Floaters** bucket their font size, cull off-screen, and drop the shadow pass
  under a heavy horde. **Particles** were drawn with no visibility test at all.
- **Phones start on a lower preset** from a device heuristic rather than
  benchmarking down from `high`, and adaptive quality can now step back *up*
  after a sustained comfortable stretch so a strong phone isn't stuck low.

**Result** — identical scenario (300 enemies + 20 allies, 3× CPU throttle):

| | before | after |
|---|---:|---:|
| high preset | 6.7 fps | 15.5 fps |
| balanced (auto-selected on most phones) | — | **18.6 fps** |
| battery | — | 22.5 fps |

Section timings for the worst case (300 enemies + boss + night) fell from
11.8 ms/frame of accounted JS to 4.3 ms: `update` 4.14 → 0.76, `light`
2.21 → 1.01, `floaters` 0.99 → 0.11.

## Camera — wider, and it opens up as the squad grows

The area-based fit was set tighter than the old fixed-height framing. Raised
from 540k to 760k px², which is ~19% wider than the previous pass and ~10%
wider than the game's original framing.

On top of that, **the view widens as you free Guardians** — +1.6% per Guardian
up to +30%, eased so a cage break opens the camera rather than snapping it. A
24-strong squad plus its projectiles simply needs more screen than a lone
Guardian does. Measured: 1282×593 world px at the start of a run, 1534×709 with
a full roster.

## Controls — undoing my own regressions

- **The dash button was sitting in the movement thumb zone.** Bottom-left is
  exactly where the left thumb rests, so a natural thumb-down hit the button
  instead of the stick and fired random dashes. Both action buttons now live on
  the action side, leaving the whole movement half clear.
- **Deadzone now defaults to 0** (was 8%). A touch stick has no spring and no
  drift, so a deadzone only adds a dead patch around the grip point — it made
  small corrections feel unresponsive.
- **A held touch is re-acquired.** A finger already down when an overlay closed
  (a level-up, a chest) was dead until you lifted and re-pressed. That is most
  of why movement felt sticky between level-ups.
- **Double-tap-to-dash now requires the taps to land near each other**, so
  re-gripping the stick somewhere else is not a dash.
- **`moveVector()` reads the live stick**, so the joystick never lags the thumb
  on frames where the simulation didn't step (hit-stop, time dilation).
