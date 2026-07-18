# 🏝 BALITOPIA — Guardians of the Broken Cages

A Vampire-Survivors-style horde survival game built for **mobile phones in landscape mode**.
No engine, no dependencies, no build step — pure HTML5 canvas. Open `index.html` and play.

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
| Move | **Left thumb** — touch & drag the left half of the screen (or WASD/arrows on desktop) |
| Attack | Automatic — every Guardian's power auto-aims at the horde |
| **Powershot** | When your Guardian's card glows with a ⚡, **tap the right half of the screen** (or Space) — a screen-clearing blast in their signature style |
| Free a Guardian | Shoot their bamboo cage until it breaks (gold arrow points to the nearest one) |
| Possess a Guardian | Tap their face card — first 12 line the bottom of the screen, the rest line the top (or ☰ for the full roster) |
| Level up | Collect gems, then pick one of **three face-down mystery cards** — 15 possible powers, revealed on the flip |

**Guardian mastery:** every Guardian levels up from the damage *they* deal, shown by their
face-card border: 🟩 Basic → 🟦 Expert → 🟥 Master → 🟧 Saiyan → 🟨 Super Saiyan. Each level
adds +10% to that Guardian's damage, and powershots charge from damage dealt too — so your
busiest fighters become your biggest bombs.

**Difficulty & score:** choose a difficulty on the select screen — **Guardian → Warden →
Nightmare → Cataclysm** — each scales the horde, the boss, and your **score multiplier**; clear
one to unlock the next. Every run ends on a detailed stats screen (score, all-time rank, and a
per-Guardian breakdown), saves to a local **Hall of Records** leaderboard, and fills in the
**Guardian Codex** (your best mastery tier for each of the 24, across all runs). See
**[REPLAYABILITY.md](REPLAYABILITY.md)** for the full design and what's planned next.

- **Minyar** — endless, easy to squish, but they come in every size and color. Color = danger:
  green < blue < purple < pink < magma < gold.
- **Demonder** — rarer, tough, hits hard.
- **Clubbo** — very rare, very large, very rude.
- **KING GLOB** — arrives at **8:00**. Kill him and Balitopia is free… for about two minutes.
  **Endless mode**: every kill starts a new round — the horde toughens, and the Hungry King
  crawls back out of the mountain bigger and angrier each time. Survive as many rounds as you
  can; the run ends only when the tide takes you.

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
Opening `index.html` directly also works in most browsers (the game is fully self-contained;
custom art via `assets/manifest.json` just won't load over `file://`).

## 🎨 Art & Sound

The game runs on the real Balitopia art set: hand-made portraits and full-body renders for
all 24 Guardians, painted enemy art with 6 runtime power-tier tints, per-hero theme songs and
entrance stingers, region battle music, a full King Glob voice set, and a composited VS-style
title screen plus a cinematic story backdrop (both built by `tools/compose_*.js`). See
**[ASSETS.md](ASSETS.md)** for the asset layout and the short list of art still wanted.
Anything missing falls back to procedural code-drawn art, so the game always runs.

**Sound effects:** the punchy one-shots (powershot, level/tier-up, pickups, UI clicks…) are
wired to drop-in ElevenLabs samples with synth fallbacks — see **[SOUND_DESIGN.md](SOUND_DESIGN.md)**
for the full list, generation prompts, and how to enable each one.

### Getting around

Title → **START** plays the story, then hero select; **CONTINUE** (after your first run) jumps
straight to select with your last Guardian preselected. Every menu screen has a **‹ BACK**
button, and the title music hushes on the select screen so you can preview each Guardian's theme.
