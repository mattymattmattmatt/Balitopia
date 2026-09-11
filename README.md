# 🏝 BALITOPIA — Guardians of the Broken Cages

A Vampire-Survivors-style horde survival game built for **mobile phones in landscape mode**.
No engine, no dependencies, no build step — pure HTML5 canvas. Open `index.html` and play.

## Gore and smoother explosions

Enemy kills now burst into six pieces of their own artwork amid bright red spray.
Larger scarlet splashes and bouncing body chunks coat the battlefield. Explosions launch debris
away from the blast; blood and landed remains stain the scenery. **Monster gore**
in Settings offers Carnage (default), Light and Off. Reduced motion keeps ground
stains and removes airborne debris.

The renderer uses simpler blasts, beams and particles, fewer scenery props,
and bounded visual pools. Full-screen lighting and projectile trails are removed.
Ordinary hits and screen-clearing powershots no longer freeze or slow combat.
Floating damage, combo, ward, healing and charge text, centre-screen announcements
and automatic coaching are gone; recent notices
can be read in **Pause → Recent action**.

Tide pushes, projectile wind drift, the closing arena and the Ebb Tide curse
are removed. Enemy waves, bosses and combat encounters still supply the horde.
See [GORE_PERFORMANCE.md](GORE_PERFORMANCE.md) for budgets and verification.

## Expedition overhaul

The game now opens into a redesigned Guardian and expedition flow:

- **Expedition:** King Glob arrives at 6:00. Defeat him to finish and bank the win.
- **Blitz:** King Glob arrives at 3:00, encounters advance twice as quickly and gems grant 65% more XP. Score multiplier: 0.8×.
- **Endless:** the original escalating boss / curse loop, with no fixed finish.
- Choose **Emerald Wilds**, **Sapphire Coast** or **Sunspire Heights**, then a **Tidekeeper**, **Stormcaller** or **Pathfinder** blessing. Daily Challenges keep their fixed setup and ignore blessings and Shrine perks.
- Three run objectives reward 30 shells each: rescue three Guardians, defeat 120 enemies, and fire three powershots. A non-daily victory adds 60 shells. Earn all three objectives and win for an S grade.
- Every third rescue triggers an **8-second Squad Rally**: +30% Guardian weapon damage, a nearby gem vacuum, and +35% powershot charge. Each rescue restores one Soul and gives the rescued Guardian at least 65% powershot charge.
- All eight relics can **evolve** at level IV with a matching squad upgrade. Recipes are printed on draft cards, and the matching upgrade is highlighted when a relic is owned.
- **Run it back** immediately replays the same loadout; **Change Guardian** opens the full setup. Old saves migrate without removing unlocks, records, perks or shells.

See [STUDIO_OVERHAUL.md](STUDIO_OVERHAUL.md) for the complete evolution table, validation and playtest limits.

## 📖 The Story

Far across the warm seas lies **Balitopia** — an island where the volcano sleeps politely,
the surf is always up, and twenty-four **Guardians** keep the Balance of sun, sea, jungle and stone.

Then the mountain burped. From a crack beneath Mount Karang oozed **King Glob**, the Hunger
That Walks — a grinning mountain of living slime that eats color, music, and everything in
between. His spawn poured out with him: the cackling **Minyar** swarming the beaches, the horned
**Demonders** stalking the jungle, and the colossal **Clubbos** flattening whole villages with
one lazy swing.

One by one the Guardians fell, sealed inside cursed bamboo cages and scattered across the
island — their trapped magic drip-feeding the King's bottomless appetite.

But cursed cages have one flaw the King never noticed: **they break from the outside.**

One Guardian slipped the ambush. You. Break every cage. Every Guardian you free fights at your
side — and their body is yours to possess with a touch. Gather your kin, drown the horde, and
when the ground begins to shake... make the Hunger go hungry.

## 🎮 How to Play

| Action | Control |
|---|---|
| Move | Touch & drag one half of the screen — **which half is a setting** (or WASD/arrows on desktop) |
| **Dash** | **Double-tap** the movement side, or press Shift / the ⟫ button — a short dodge with i-frames, 6s cooldown |
| Attack | Automatic — every Guardian's power auto-aims at the horde |
| **Powershot** | Tap the other half (or Space) when the ⚡ button glows — a screen-clearing blast in their signature style |
| Free a Guardian | Shoot their bamboo cage until it breaks (gold arrow points to the nearest one). Some cages are **guarded** |
| Possess a Guardian | Tap a card in the 4-slot ribbon (☰ for the full roster). Costs **✦ Soul** — 3 max, one recharges every 25s — and grants **Soulburn**: +40% damage for 3 seconds |
| Formation | Tap ⭕ to cycle your squad between **Ring**, **Vanguard** and **Focus** |
| Level up | Collect gems, then draft one of **three face-up cards** — 24 generic upgrades (including rule-changers like Ricochet, Bloom and Low Tide), each freed Guardian's two **signature upgrades**, and **Relics**. **Reroll** or **Skip** for +15% HP |
| Radar | A local radar shows cages, chests, elites and King Glob, with off-screen targets clamped to the rim |

**Relics — the second weapon slot.** Hero weapons are fixed, so build variety lives here.
Two slots, four levels each, drafted from the level-up pool: **Tide Totem**, **Coconut Mine**,
**Ancestor Mask** (a ghost that mirrors your attacks), **Reef Spire** (a turret that inherits
whoever you're currently possessing), **Sunbeam**, **Undertow Net**, **Storm Jar** and
**Bloom Petal**. They're hero-agnostic on purpose — the same relic plays completely
differently across the roster.

**Guardian mastery:** every Guardian levels up from the damage *they* deal, shown by their
face-card border: 🟩 SPROUT → 🟦 TIDE → 🟥 STORM → 🟧 ELDER → 🟨 ASCENDANT. Each level
adds +10% to that Guardian's damage, and powershots charge from damage dealt too — so your
busiest fighters become your biggest bombs. Every Guardian also has an always-on **passive
trait** and one **identity signature upgrade** that changes what their weapon *does*.

**Difficulty & score:** choose a difficulty on the select screen — **Guardian → Warden →
Nightmare → Cataclysm** — each scales the horde, the boss, and your **score multiplier**; clear
one to unlock the next. Every run ends on a detailed stats screen (score, all-time rank, and a
per-Guardian breakdown), saves to a local **Hall of Records** leaderboard, and fills in the
**Guardian Codex** (your best mastery tier for each of the 24, across all runs). Tap **📸 SHARE**
to export a poster of your run for friends. See **[REPLAYABILITY.md](REPLAYABILITY.md)** for the
full design and what's planned next.

**Beyond a single run:** the title menu also holds a **☀ Daily Challenge** (a date-seeded run —
fixed Guardian, difficulty, region and cage layout, the same for everyone that day), a
**🐚 Shell Shrine** where shells earned from every run buy permanent meta-perks (starting HP,
damage, move speed, XP, magnet, a head-start cage, and extra level-up rerolls), and **🏆 Achievements**
that unlock across runs. Every run also plays out on one of three **biomes** — jungle, sea or
sky — each with its own ground and battle music.

**Biomes set the scenery and music.** Environmental movement and damage hazards
are disabled, so your movement and projectile paths stay under your control.

**Difficulty adds rules too** — Warden thins gem drops, Nightmare removes heart drops
entirely, and Cataclysm doubles the elites in its scheduled elite encounters.

**⚙ Settings** cover music/SFX volume, vibration, reduced motion, colorblind pips and
per-deficiency colour modes, UI text size, radar toggle, **control layout** (stick side, type,
size, dead zone), **quality preset and frame cap**, screen shake and flash intensity, **monster gore**, **assist mode**, and save export/import/erase.

- **Minyar** — endless, easy to squish, but they come in every size and color. Color = danger:
  green < blue < purple < pink < magma < gold.
- **Spitter** — hangs back and leads a 3-shot spread at where you're *going*.
- **Runner** — fast, fragile, flees when wounded, and leaves a **fused** burst on death you can step out of.
- **Warden** — front-armored bruiser. The shield arc means what it looks like: **flank it for full damage**.
- **Burrower** — telegraphs, then erupts underneath you. The one enemy that punishes standing still.
- **Siren** — hangs back and strengthens everything near her. Kill her first.
- **Demonder** — rarer, tough, hits hard.
- **Clubbo** — very rare, very large, very rude.
- **Elites** — any enemy can spawn Elite: 6× HP, an aura, a name tag and one affix
  (*Gilded*, *Splitting*, *Warded*, *Volatile*, *Swift*). They drop chests.
- **The Golden One** — rare, sprints away, drops a treasure chest if you catch it.
- **KING GLOB** — arrives at **6:00** (3:00 in Blitz), with a Gorge that drags you in and a Crown Split you
  have to break before he heals. **Endless mode only**: every kill starts a new round — you draft
  one of two **curses** for bonus score, and the **Reef Mother** (a stationary arena boss with
  sweeping beams) alternates in. The run ends only when the tide takes you.

## 🦸 The 24 Guardians

Bo · Chocker · Chomper · Chunky · Cliggy · Creeper · Diver · Fertle · Fixie · Flick · Fygar ·
Gus · Peeta-Heater · Roger-Dodger · Sixter · Skyjumper · Snapper · Stinger · Swack · Waterwolf ·
Whipper · Yellogen · Yelp · Zappo

Every Guardian has a unique auto-power: rainbow feather fans, poison clouds, thunder bites,
junk storms, egg mortars, laser stares, sky dives, exploding shellfire, slowing icicles,
burning trails, fang flurries, crush coils, scalding jets, boomerang wings, star shrapnel,
orbiting stars, clap quakes, lance sweeps, door-sized waves, tidal howls, homing echoes,
shatter screeches, echo orbs, and chain lightning. Tap a hero on the select screen to hear
their theme song.

## 🛠 Running It

Any static file server works:

```bash
npx serve .          # or
python3 -m http.server 8000
```

Then open it on your phone (same Wi-Fi → `http://<your-ip>:8000`) and rotate to landscape.
On iPhone, use **Share → Add to Home Screen** for true fullscreen — iOS Safari has never
implemented the Fullscreen API, so that is the only route to a chrome-free game.

### Building for deploy

```bash
tools/encode_audio.sh    # 100.8 MB of MP3/WAV -> 17.9 MB of Opus (+AAC fallback)
tools/build.sh           # emits dist/ with only what the game actually loads
```

A complete first session transfers **5.1 MB**, and repeat visits are near-zero
thanks to the service worker. Hero themes ship only as a 14-second hook — it
serves both the select-screen preview and the in-game possession flourish.

`assets/3d/` (50 MB) and `assets/art/` (60 MB) are production sources and are **excluded
from the build** — a naive folder copy would ship 110 MB the game never requests.

## 🎨 Art & Sound

The game runs on the real Balitopia art set: hand-made portraits and full-body renders for
all 24 Guardians, painted enemy art with 6 runtime power-tier tints, per-hero theme songs and
entrance stingers, region battle music, a full King Glob voice set, and a composited VS-style
title screen plus a cinematic story backdrop (both built by `tools/compose_*.js`). See
**[ASSETS.md](ASSETS.md)** for the asset layout and the short list of art still wanted.
Anything missing falls back to procedural code-drawn art, so the game always runs.

**Impact audio — build 5:** blasts have a crack, bass body and pressure tail;
enemy deaths have wet splats and tearing sounds, followed by chunk impacts.
Mass kills share a bounded mixer, music ducks during blasts, and recorded
effects now obey the Effects slider and master mute. The 24 original combat
clips are generated once and reused. Hear the
[audio preview](docs/impact-audio-preview.mp3) and see
[AUDIO_IMPACT.md](AUDIO_IMPACT.md) for mixing, budgets and verification.
Other recorded effects retain synthesized fallbacks; the earlier recording
brief remains in [SOUND_DESIGN.md](SOUND_DESIGN.md).

### Getting around

Title → **PLAY** opens Guardian and expedition selection; **QUICK PLAY** (after your first run) starts with your last loadout. **THE STORY** is an optional menu entry. Every menu screen has a **‹ BACK**
button, and the title music hushes on the select screen so you can preview each Guardian's theme.
