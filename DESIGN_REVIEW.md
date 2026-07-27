# BALITOPIA — Creative Director's Design Review & Polish Plan

**Reviewed build:** `b8d7fd9` (main) · 4,455 lines of source · 214 MB of assets
**Review method:** full source read (`game.js` 2,758 · `data.js` 283 · `sprites.js` 423 · `audio.js` 242 · `style.css` 560 · `index.html` 189), plus live instrumented play sessions in headless Chromium at 844×390 @ DPR 2 (iPhone 14 landscape), with frame-time, network and hitch profiling.
**Reviewer posture:** incoming Creative Director. Nothing is assumed good enough.

---

## 1. Executive Summary

Balitopia is a **remarkably complete** browser survivor-roguelite with one genuinely original mechanic and an art package most indie studios would envy — sitting on top of a combat loop that does not yet ask the player to do anything.

The good news first, because it is real and it is unusual: the **cage/possession system is a legitimately new idea in this genre**. Every other survivor game gives you a static map and a fixed avatar. Balitopia gives you 23 rescuable Guardians scattered across the island, each of whom joins your squad *and* becomes a body you can jump into mid-fight. That is a structural innovation, not a reskin, and it is the thing this game should be famous for. It is also currently underexploited by roughly 80%.

The bad news is structural and it is fixable, but it is not cosmetic:

1. **The level-up choice — the single most important decision in the entire genre — is face-down.** The player picks one of three unknown cards. This is not a decision; it is a slot machine pull. It removes the evaluate→commit→build loop that Vampire Survivors, Brotato and Halls of Torment are entirely constructed around, and it is the reason no two runs can feel *strategically* different no matter how much content is added underneath.
2. **There is no build.** Each Guardian has one fixed weapon for the whole run. The 15 generic upgrades are all flat multipliers (`dmg×1.2`, `rate×0.88`, `spd×1.1`). There is no weapon acquisition, no passive that changes a rule, no evolution you can steer toward. Every run converges on the same numbers going up.
3. **The player stops mattering around minute six.** By then you have 12–18 allies, each auto-firing at 0.55× damage / 1.25× interval. Twenty-three allies produce roughly **10× the player's own DPS**, entirely on autopilot. The player becomes a magnet on legs, walking a crowd of NPCs around a field.
4. **The mobile experience is the weakest pillar and it is the one that will decide commercial success.** The game ships **100.8 MB of audio**. Tapping four heroes on the select screen downloaded **13.5 MB** in my instrumented session; browsing all 24 would pull ~55 MB before the player has fought anything. There is no `manifest.json`, no service worker, no `apple-touch-icon` — meaning no install prompt on Android, no offline play, and **no path to fullscreen on iPhone at all** (iOS Safari does not implement `requestFullscreen`; the only route is Add to Home Screen, which requires the manifest this game doesn't have).
5. **Combat has almost no feel.** There is no impact sound on hitting an enemy — `Sound.sfx.hit()` is defined in `audio.js:96` and `hit.mp3` ships in `assets/audio/sfx/`, but the function is **never called anywhere in the codebase**. There are no critical hits. Enemy hitboxes are small circles at the sprite's feet while the sprite is 2–4× taller, so projectiles visually pass through enemy torsos without connecting.

**The verdict:** this is a *content-rich, systems-poor* game. It has 24 characters, 6 enemy archetypes, a boss, 3 biomes, achievements, a meta-shop, a daily challenge, a codex and a share card — and beneath all of it, a combat loop where the player holds a thumb down and watches. The next development phase should add **almost no new content** and instead rebuild the three systems that convert that content into decisions: the level-up draft, the weapon/build layer, and the possession economy.

Do that and this is an 85. Ship it as-is and it is a beautiful 57 that players will bounce off in run four.

---

## 2. Overall Assessment

### What kind of game is this right now?

Balitopia is currently an **idle-adjacent horde game with an excellent presentation layer**. The moment-to-moment inputs available to a player are:

- Move (drag left half of screen)
- Fire powershot (tap right half, when charged — roughly every 30–60s)
- Possess a different Guardian (tap a face card)
- Pick one of three unknown cards on level-up

That is the complete verb set. Of those four, one is on a long cooldown, one is optional and unpriced, and one is randomized. **The only continuously-expressed skill is positioning**, and positioning is only tested by contact damage and a single telegraphed boss slam. Nothing else in the game punishes standing still.

Compare the genre leaders on the same axis:

| Game | Continuous skill demand |
|---|---|
| **Vampire Survivors** | Positioning + a genuinely load-bearing 8-weapon/6-passive draft with 20+ evolution paths |
| **Brotato** | Positioning + a per-wave shop with real economy math and 20 item slots |
| **Halls of Torment** | Positioning + *facing direction* matters for most weapons |
| **20 Minutes Till Dawn** | Manual aiming — the whole game is aim + dodge |
| **Survivor.io** | Positioning + a tight 6+6 draft and evolution pairs surfaced explicitly |
| **Balitopia** | Positioning |

This is the gap. Every other section of this review is downstream of it.

### What is the game's identity?

Right now the *stated* identity (cages, possession, 24 Guardians, island mythology) is much stronger than the *played* identity. A player who finishes their first run will remember: nice art, cute characters, I ran around collecting things, King Glob showed up.

They will **not** remember a build they made, a decision they agonized over, a Guardian they mastered on purpose, or a moment where a swap saved them. All four of those are one design pass away.

The identity to lean into hard is: **"You are a soul, not a body."** Balitopia is the survivor game where you *are* the roster. That is a pitch. Everything below serves it.

### First hour vs. hundredth hour

**First hour:** Solid. Title screen is genuinely striking, the story screen is well-composed, the character grid is a strong "ooh, 24 of them" moment, and the first cage break is a real beat. The first 60 seconds of *gameplay*, however, are near-empty — spawn rate starts at 1.4 enemies/sec (`game.js:268`) in a 5,200×5,200 world with a 48px-tall hero. My capture at 0:01 shows an empty green field.

**Hundredth hour:** There isn't one. Once you've seen 24 Guardians and killed King Glob on Cataclysm, the only remaining goals are Codex completion (grind the same run 24 times) and endless round count (the same fight with bigger numbers via `conv()` at `game.js:230`). Nothing is unlocked by playing — **all 24 characters are available from run one**, which throws away the single most powerful retention engine the genre has.

---

## 3. Biggest Strengths

Protect these. They are why the game is worth fixing.

### 3.1 The cage system is structurally better than a static map ★★★★★
`game.js:1986-1997` lays 23 cages on a golden-angle spiral (2.39996 rad, 460 + 82·n px). This gives every run a **moving objective that pulls the player across the map against the horde's pressure gradient** — a thing Vampire Survivors, Brotato and Survivor.io all lack. It creates natural risk/reward tension (do I push out for that cage now or wait for a powershot?) and a gold edge-arrow (`game.js:1518`) makes it legible. **Do not touch the core of this.** Add stakes to it (see #14), don't redesign it.

### 3.2 Possession is a genuinely novel verb ★★★★★
`possess()` at `game.js:1715` swaps souls: your control moves to the ally's body, your old body keeps fighting as an ally, HP carries as a *fraction*. That last detail is elegant — it means swapping into a 140 HP Gus from a 88 HP Diver is a real heal in absolute terms without being exploitable. The fantasy is clear and it is unique. It just needs an economy around it.

### 3.3 Mastery-from-damage-dealt is a smart, quiet system ★★★★☆
`addDamage()` at `game.js:113` levels each Guardian from the damage *they personally* deal, gated at 3,200 / 9,500 / 22,000 / 45,000, with the tier shown as the face-card border colour and a weapon evolution at Super Saiyan. This is excellent because it rewards *use*, reads at a glance in the HUD, and creates a natural pull toward specializing rather than swapping randomly. It also feeds the powershot charge from the same source, so "your busiest fighter becomes your biggest bomb" — a genuinely satisfying emergent rule. Keep this exactly as it is.

### 3.4 The art and character package is commercial-grade ★★★★★
24 distinct, memorable, well-drawn Guardians with names, titles and one-line personalities that actually land ("A starfish with five arms and six grievances"). Painted enemy art. Composited VS-style key art. This is the most expensive part of a game to get right and it's already right.

### 3.5 Convergent endless scaling ★★★★☆
`conv(perStep, decay, round)` at `game.js:230` uses a geometric decay so each round adds less than the last, plateauing near ~4× HP instead of exploding. This is a mathematically correct answer to the endless-mode wall problem and most shipped games in this genre get it wrong. Excellent instinct.

### 3.6 Pooled allocation and a generation-stamped spatial hash ★★★★☆
`buildHash()` at `game.js:176` reuses cell arrays across frames with a generation stamp, so rebuilding 60×/sec allocates nothing. Enemies, projectiles, gems and particles are all fixed-size pools. This is the right architecture and it's why the game holds 60fps at 150 enemies.

### 3.7 The run-recap share card ★★★★☆
`buildRecapCanvas()` at `game.js:2186` composes a 1080×1080 poster and routes it through the Web Share API with a PNG-download fallback. This is a real growth loop most browser games skip. It just needs a reason to *want* to share (see #71).

### 3.8 Accessibility groundwork already exists ★★★☆☆
Colorblind danger pips (`game.js:1322`), a reduced-motion toggle that *softens* rather than kills screenshake (`game.js:1178` — the right call), UI text scaling, and a haptics toggle. Most indie games ship none of this.

### 3.9 The stats screen answers "who carried?" ★★★★☆
`buildStatsScreen()` at `game.js:2130` gives a per-Guardian damage bar, damage %, kills and control time. This directly shapes who the player picks next run. Strong retention design.

---

## 4. Biggest Weaknesses

### 4.1 The level-up draft is face-down — the genre's core decision is randomized 🔴 CRITICAL
`showLevelUp()` at `game.js:1847` renders three `.mystery` cards with a `?` face, flipping only after commit. The player is not choosing between three known options; they are picking a random one of three randoms. Every strategic layer built underneath — hero signature upgrades, evolution, synergies — is invisible at the moment of decision, and therefore does not exist as a decision.

### 4.2 No build layer 🔴 CRITICAL
Each Guardian's weapon is fixed in `HEROES[].weapons` and never changes. The 15 entries in `UPGRADES` (`data.js:177`) are all scalar multipliers. There is no weapon acquisition, no second weapon slot, no passive that changes behaviour, no synergy between choices. **A level-40 run and a level-10 run play identically, just with bigger numbers.**

### 4.3 Allies erase player agency 🔴 CRITICAL
`updateAllies()` at `game.js:977` runs every freed Guardian's full weapon loop at `0.55 × m.ally` damage and `1.25 ×` interval. At 23 allies that's ≈10× the player's own throughput, uncontrollable and unaimed. The lategame plays itself.

### 4.4 100.8 MB of audio and no delivery strategy 🔴 CRITICAL
Measured: 24 hero themes at 2.27 MB average (54.6 MB total), 24 entrance stingers as **uncompressed WAV** (13.3 MB), 16 MB of music, 13 MB of enemy audio. My session downloaded **13.5 MB from tapping four heroes** on the select screen and another 3.8 MB on run start. On a metered mobile connection this is a bounce.

### 4.5 No PWA shell 🔴 CRITICAL
No `manifest.json`, no service worker, no icons. Consequences: Android shows no install prompt; there is **no way to reach fullscreen on iPhone** (iOS Safari has never implemented the Fullscreen API on iPhone — Add to Home Screen is the only route and it requires a manifest); nothing works offline; a second visit re-downloads everything.

### 4.6 Combat has no impact 🔴 CRITICAL
No hit sound (verified — `Sound.sfx.hit()` is dead code). No critical hits anywhere in the codebase. No hit-stop on normal kills (only on boss death, `game.js:408`). Enemy hitboxes are foot-anchored circles under 2–4× taller sprites. Damage numbers are only shown for `dmg >= 18` or non-minyar (`game.js:387`), so most of the screen's killing is silent and invisible.

### 4.7 Eight minutes to the first boss; the first minute is empty 🟠 HIGH
`BOSS_TIME = 480` (`data.js:148`). Spawn rate opens at 1.4/sec. The shortest complete narrative arc in this game is ~9 minutes; mobile sessions are 3–8. Brotato's first wave is 20 seconds.

### 4.8 Nothing unlocks 🟠 HIGH
24 characters, all available immediately. Difficulty tiers and achievements are the only progression gates. The genre's most reliable retention mechanic — "one more run to unlock the next character" — is sitting completely unused on top of a 24-character roster.

### 4.9 One boss, forever 🟠 HIGH
King Glob is the entire boss content of the game. Endless mode re-fights him with `roundBossMul()` applied. There is no second boss, no elite enemy, no miniboss, no rare encounter.

### 4.10 Difficulty tiers are pure arithmetic 🟠 HIGH
`DIFFICULTIES` (`data.js:158`) scales `ehp / edmg / bhp / menace / score`. Cataclysm plays exactly like Guardian with bigger numbers. No new enemy behaviours, no new rules, no new pressure.

### 4.11 Frame rate is already marginal 🟠 HIGH
Measured on **desktop-class hardware**: 60.2 fps baseline → 53.7 fps at 300 enemies. A mid-range Android (Snapdragon 6-series) runs 3–5× slower on canvas fill. Breaking all 23 cages costs a 48.5 ms hitch. The per-enemy render path does 4–8 separate `beginPath`/`fill` calls for status effects, health bars and archetype markers.

### 4.12 No return hook 🟠 HIGH
The Daily Challenge exists (`startDaily()`, `game.js:1934`) but has no streak, no reward, no completion badge, no reason to come back tomorrow specifically. Day-2 retention has nothing pulling on it.

---
## 5. Top 100 Improvements, Ranked by Impact

Ranked by *return on development time against fun, retention and launch readiness*. Items 1–15 are the ones that change what kind of game this is.

---

### TIER A — Change the game (1–15)

#### 1. Turn the level-up cards face-up
**Issue.** `showLevelUp()` (`game.js:1847`) renders three `.mystery` cards showing `?`, revealing content only after the player commits.
**Why it matters.** The draft is the beating heart of this genre. Hiding it converts the single most-repeated decision in the game (30–60× per run) from a strategic choice into a coin flip.
**Player enjoyment.** It removes anticipation, planning, regret and mastery in one stroke. A player cannot say "I'm going for a poison build" because they cannot see poison being offered. It also silently wastes the excellent `HERO_UP` signature system — players never learn those upgrades exist because they never see one they *didn't* take.
**Solution.** Keep the beautiful flip animation — make it an *entrance*, not a concealment. On screen open, deal all three cards face-down and auto-flip them in a 120 ms-staggered cascade, then wait for input. Add a "highlight" state for signature cards (the violet frame already exists at `style.css:320`). Optionally keep one deliberately face-down "wildcard" slot with a bonus (a free reroll if you take it) — that preserves the gambling thrill *as an opt-in* instead of forcing it.
**Effort:** Low (≈40 lines) · **Impact:** High · **Priority:** Critical

#### 2. Give the player a build to make
**Issue.** Each Guardian carries a fixed `weapons[]` array for the entire run. All 15 `UPGRADES` (`data.js:177`) are scalar multipliers.
**Why it matters.** With no acquisition and no rule-changing modifiers, run variance is purely which multipliers arrived in what order. There is no such thing as "a build" in Balitopia today.
**Player enjoyment.** Build-crafting is where the hundredth hour lives. Without it, content additions (more heroes, more enemies) produce diminishing returns immediately.
**Solution.** Add a **second weapon slot** filled by *Relics* — 12–16 run-long secondary weapons drawn from the same level-up pool, independent of hero identity (e.g. *Tide Totem*: a slow expanding ring; *Coconut Mine*: drops proximity bombs behind you; *Sunbeam*: a rotating sweeping laser; *Ancestor Mask*: revives one dead ally as a ghost that mirrors your attacks). Cap at 2 relics. Each relic has 4 upgrade levels that also come through the draft. This alone multiplies build space from ~1 to ~120 combinations per hero without touching hero balance.
**Effort:** High · **Impact:** High · **Priority:** Critical

#### 3. Demote allies from DPS engine to tactical resource
**Issue.** `updateAllies()` (`game.js:977`) runs each freed Guardian's full weapon loop at `0.55 × m.ally` damage. At 23 allies that is ≈10× the player's own DPS, unaimed and uncontrollable.
**Why it matters.** The player's actions stop mattering somewhere around minute 6. Freeing more Guardians makes the game *easier and less interactive simultaneously* — the worst possible progression shape.
**Player enjoyment.** Late-run play becomes spectating. Deaths feel arbitrary because you weren't the one doing the work.
**Solution.** Three changes, in order of importance: **(a)** Apply a squad-size falloff — total ally damage scales as `0.55 × count^0.62` rather than linearly, so ally 20 adds ~2% not ~4%. **(b)** Only the **6 nearest allies** fire; the rest follow as a visual entourage. This also recovers ~15 fps. **(c)** Introduce **Formation** as a tactical verb: a swipe on the right half sets allies to *Ring* (defensive, orbit you), *Vanguard* (push toward the horde) or *Focus* (converge on your current target). Now the squad is something you *command*, not something that plays for you.
**Effort:** Medium · **Impact:** High · **Priority:** Critical

#### 4. Fix audio delivery — it is the biggest single mobile risk
**Issue.** Measured: 100.8 MB total audio. 24 hero themes averaging 2.27 MB (54.6 MB). 24 entrance stingers as **uncompressed WAV** (13.3 MB, ~550 KB each). Tapping four heroes on the select screen pulled **13.5 MB**; run start pulled another 3.8 MB.
**Why it matters.** This is a browser game. There is no install step to hide the download behind. A player on 4G browsing the roster burns tens of megabytes before their first fight.
**Player enjoyment.** Silence-then-stutter on hero preview, audible delay when a cage breaks (the entrance WAV is fetched on demand at `game.js:446`), and on metered connections, an outright bounce.
**Solution.** **(a)** Re-encode all hero themes to 96 kbps mono Opus with an AAC fallback and **truncate previews to a 12-second hook** — a `<id>_preview.opus` at ~140 KB replaces a 2.3 MB full song, a **94% cut**. **(b)** Convert all `_entrance.wav` to 64 kbps Opus (~35 KB each; 13.3 MB → 0.85 MB). **(c)** Decode entrance stingers and SFX into `AudioBuffer`s at boot via the existing `AudioContext` instead of `new Audio()` per path — this also fixes the retrigger cut-off in #85. **(d)** Preload only: title music, the *selected* hero's stinger, and the current region track. Everything else on demand. Target: **< 4 MB for a complete first session.**
**Effort:** Medium · **Impact:** High · **Priority:** Critical

#### 5. Ship a real PWA shell
**Issue.** No `manifest.json`, no service worker, no `apple-touch-icon`, no maskable icons. `index.html` sets `mobile-web-app-capable` but nothing consumes it.
**Why it matters.** Three hard consequences: Android never offers "Install app"; **iPhone has no fullscreen path at all** (iOS Safari does not implement the Fullscreen API — `enterApp()`'s `requestFullscreen` call at `game.js:2534` is a silent no-op on iOS, so the address bar and home indicator stay on screen permanently); and every visit re-downloads every asset.
**Player enjoyment.** The brief demands "indistinguishable from a native mobile application." Without this, on iPhone it is unambiguously a web page.
**Solution.** Add `manifest.json` with `display: "fullscreen"`, `orientation: "landscape"`, `background_color`/`theme_color`, and 192/512 px maskable icons plus `apple-touch-icon` link tags. Add a service worker with a **cache-first** strategy for the app shell (HTML/CSS/JS/sprites, ~1.3 MB) and **stale-while-revalidate** for audio. Add a one-time "Add to Home Screen for fullscreen" coach card on iOS after the player's first completed run — not before, so it lands when they're already invested.
**Effort:** Medium · **Impact:** High · **Priority:** Critical

#### 6. Build a hit-feedback system — there isn't one
**Issue.** Four verified defects compound here: (a) `Sound.sfx.hit()` is defined at `audio.js:96` and `hit.mp3` ships in the manifest, but the function is **never called from anywhere in the codebase** — enemies take damage in total silence. (b) There are **no critical hits** anywhere. (c) `hitStop()` only fires on boss death (`game.js:408`) and powershot (`game.js:1768`). (d) Damage numbers are suppressed for `dmg < 18` on minyar (`game.js:387`), which is most of the screen.
**Why it matters.** "Game feel" in this genre is 90% hit confirmation. Right now killing 40 enemies feels identical to killing 0.
**Player enjoyment.** This is the difference between a satisfying game and a screensaver. It is also the cheapest big win in this document.
**Solution.** (a) Call `Sound.sfx.hit()` in `damageEnemy()`, pitch-varied ±15% and throttled to ~55 ms. (b) Add crits: a `G.mods.crit` (base 5%, +10% per *Keen Eye* upgrade) dealing 2× with a distinct larger gold floater, a white radial flash, 25 ms hit-stop and a haptic tick. (c) Add a 2-frame (~35 ms) hit-stop on any single hit ≥ 12% of the target's max HP. (d) Show *all* damage numbers, but pool them: aggregate hits on the same enemy within 200 ms into one accumulating number. (e) Add a 3-frame white-flash + 8px directional knockback smear on every kill.
**Effort:** Medium · **Impact:** High · **Priority:** Critical

#### 7. Restructure the run into acts; compress time-to-boss
**Issue.** `BOSS_TIME = 480` (`data.js:148`). Spawn rate opens at 1.4/sec (`game.js:268`). The first complete arc takes ~9 minutes.
**Why it matters.** Median mobile session length is 4–6 minutes. A game whose shortest satisfying unit exceeds the session is a game people stop starting.
**Player enjoyment.** Long unstructured stretches with no landmark between 0:00 and 8:00 make the middle of every run feel like the same minute repeated.
**Solution.** Restructure to a **three-act, 6-minute core run** with landmarks every ~45 seconds: `0:00` open at 3 enemies/sec (not 1.4); `0:45` first Elite; `1:30` **Cage Siege** event (a cage guarded by a ring of wardens, big reward); `2:15` Horde Surge (a wall from one direction — forces movement); `3:00` **miniboss**; `3:45` treasure chest run; `4:30` second surge; `5:15` boss warning; `6:00` King Glob. Endless rounds then run on a 3-minute cadence with a rotating modifier (#24). Keep an "Extended" toggle for players who want the current 8-minute pacing.
**Effort:** Medium · **Impact:** High · **Priority:** Critical

#### 8. Build the character unlock cascade
**Issue.** All 24 Guardians are selectable from the first run (`buildSelect()`, `game.js:2614`).
**Why it matters.** In Vampire Survivors the unlock cascade — where finishing a run reveals a new character, which reveals a new stage, which reveals a new weapon — is the primary retention engine. Balitopia has a 24-character roster and gates none of it.
**Player enjoyment.** "One more run" needs a *specific* carrot. "I'm 2 cages from unlocking Zappo" is a carrot. "I might get a higher number" is not.
**Solution.** Start with **4** Guardians (one per archetype: a shooter, an area, an orbit, a melee). Unlock the rest through legible, run-visible conditions that teach the game: *Free 8 Guardians in one run* → Fixie. *Reach Master with any Guardian* → Creeper. *Kill 400 enemies with a single Guardian* → Fygar. *Survive 3 minutes without taking damage* → Roger-Dodger. Show the **next 3 unlock conditions with live progress bars on the select screen and the death screen.** Existing saves grant everything (respect players who already played).
**Effort:** Medium · **Impact:** High · **Priority:** Critical

#### 9. Price possession — make the signature mechanic a real system
**Issue.** `possess()` (`game.js:1715`) is free, instant, unlimited and has no cooldown. HP carries as a fraction, and the body you leave keeps fighting.
**Why it matters.** A mechanic with no cost has no decision attached. Right now the optimal play is "swap to whoever has a charged powershot, constantly," and the only friction is UI.
**Player enjoyment.** This is the game's identity. It should be the deepest system, not the loosest.
**Solution.** Give possession a **Soul** resource. You start with 3 Soul; possession costs 1; Soul regenerates one charge per 25 s and on cage break. Then layer rewards on top: **(a) Soulburn** — for 3 s after a swap, the newly possessed Guardian deals +40% damage and is invulnerable for 0.4 s (turns swapping into an offensive/defensive *tool*, and makes chain-swapping through a horde a genuine skill expression). **(b) Resonance** — possessing a Guardian who is already at Master or above grants a stacking team-wide buff. **(c)** Show Soul charges as pips next to the HP bar. This converts a menu action into the most interesting verb in the game.
**Effort:** Medium · **Impact:** High · **Priority:** Critical

#### 10. Add upgrades that change rules, not numbers
**Issue.** All 15 generic upgrades multiply a scalar. `HERO_UP` (`data.js:249`) is 90% `{dmg:1.4}` or `{countAdd:2}`.
**Why it matters.** Numbers going up is progression; rules changing is *design*. Players remember the upgrade that made their projectiles bounce off walls, not the one that gave +20% damage.
**Player enjoyment.** Rule-changers are what people screenshot and talk about.
**Solution.** Replace 6 of the 15 generic upgrades with rule-changers, keeping ~9 scalars as reliable filler: **Ricochet** (projectiles that kill bounce to a new target once), **Bloom** (every 8th attack fires a free full-power volley in all directions), **Undertow** (enemies killed within 100 px of you drop a slow field), **Kindred** (your two nearest allies mirror your powershot at 40%), **Riptide** (knockback deals damage proportional to distance travelled), **Low Tide** (below 35% HP: +60% damage, +20% speed — a real risk/reward lever). Also rewrite the weakest third of `HERO_UP` entries so each hero has one *identity* upgrade, not two stat bumps.
**Effort:** Medium · **Impact:** High · **Priority:** Critical

#### 11. Add elite enemies and rare encounters
**Issue.** Six enemy types, all of which spawn as identical anonymous units. No elites, no champions, no rare spawns, no reward-bearing enemies.
**Why it matters.** A horde with no standouts is visual noise. Elites give the eye something to track, the brain something to prioritise, and the run something to remember.
**Player enjoyment.** "Kill the glowing one" is one of the most reliably satisfying instructions in game design.
**Solution.** Add an **Elite** flag applicable to any enemy type: 6× HP, a visible aura, a name tag, and **one random affix** — *Gilded* (drops 10× XP and a guaranteed heart), *Splitting* (spawns 4 tier-down copies on death), *Warded* (immune to knockback, projects a slow field), *Volatile* (leaves a lingering damage pool), *Swift* (2× speed, telegraphed charge). Spawn one every ~40 s, escalating. Add a **Golden Minyar** that flees at high speed and drops a chest if caught — a genuine chase moment, and the single most-shared thing in games that have one.
**Effort:** Medium · **Impact:** High · **Priority:** Critical

#### 12. Second boss + boss modifiers
**Issue.** King Glob is the entire boss content. Endless mode re-fights him with `roundBossMul()` applied.
**Why it matters.** The boss is the payoff for 6–8 minutes of play. Seeing the same payoff every single run caps the game's ceiling hard.
**Player enjoyment.** New bosses are the clearest possible "the game still has things to show me" signal.
**Solution.** **(a)** Add a **miniboss** at the mid-run landmark (#7) — reuse `clubbo` art at 2.2× scale with a ground-pound telegraph and a charge attack. Cheap, high value. **(b)** Add a genuine second boss with a *different verb* — **The Reef Mother**, a stationary arena boss with rotating damage beams and adds, forcing the player to circle-strafe rather than kite. Alternates with Glob on odd/even endless rounds. **(c)** From endless round 3, apply a random **boss modifier** (*Split Crown*: two half-HP Globs; *Famine*: no gems drop while he lives; *Tide Lock*: the arena shrinks).
**Effort:** High · **Impact:** High · **Priority:** High

#### 13. Align enemy hitboxes with their sprites (verified bug)
**Issue.** Enemies are drawn from `e.y - dh·scale` up to `e.y` (`game.js:1273`), but every collision test measures distance from `e.y` — the *feet* — with radius `e.r`. A demonder is 88 px tall with a 20 px foot circle. Notably, the boss **has** the fix (`b.y - 70` at `game.js:775`) — regular enemies were never given it.
**Why it matters.** Projectiles visibly pass through enemy torsos without connecting, and connect on apparently empty ground below them. The flash effect even renders at the body centre (`e.y - h/2 + 6`), so the game draws the hit in a different place than it computed it.
**Player enjoyment.** This is a constant low-grade "the game is lying to me" signal. It's a major contributor to combat feeling mushy.
**Solution.** Introduce `e.cy = e.y - (e.dh · e.scale) × 0.45` computed once per frame in `updateEnemies()`, and use it for **all** collision tests (projectiles, aura, beam, slash, nova, orbit, chain, explosions) and for `nearestTarget()`. Keep `e.y` as the ground anchor for rendering, shadows and separation. Widen `e.r` to ~0.42× sprite width so the hitbox actually covers the body.
**Effort:** Medium · **Impact:** High · **Priority:** Critical

#### 14. Give cages stakes
**Issue.** Cages have flat `CAGE_HP = 70` (`data.js:153`), no defenders and no failure state. Weapons auto-retarget them at 250 px (`game.js:593`). Breaking one is a formality.
**Why it matters.** The cage system is the game's best structural idea and it currently carries zero tension.
**Player enjoyment.** A rescue with no risk isn't a rescue. This is free drama the game is leaving on the table.
**Solution.** **(a)** Cages spawn with a **guard pack** scaled to run time (3 minyar at 0:30, a warden + 6 at 4:00). **(b)** Cage HP scales with time so late cages are a real commitment. **(c)** Add a **Cage Siege** variant every third cage: touching it starts a 20-second hold-the-line wave; survive and the Guardian joins *plus* drops a relic. **(d)** Add **Cursed Cages** (visually distinct, purple bindings) that free a Guardian *and* apply a run-long drawback for a much larger reward — the game's first real risk/reward decision.
**Effort:** Medium · **Impact:** High · **Priority:** High

#### 15. Reclaim the frame budget
**Issue.** Measured on desktop-class hardware: 60.2 fps baseline → **53.7 fps at 300 enemies**. Mid-range Android canvas fill is 3–5× slower. Breaking all 23 cages costs a **48.5 ms hitch** (three dropped frames). Per enemy the render path can issue 8+ separate `beginPath`/`fill` calls (shadow, sprite, shield arc, muzzle dot, flash circle, poison miasma + 3 blips, frost rime + 4 spikes, HP bar, colorblind pips).
**Why it matters.** The brief requires smooth play on mid-range devices and good battery life. 53 fps on a laptop means ~25 fps on a Redmi Note.
**Player enjoyment.** Frame drops during the exact moments the game is most exciting (peak horde, boss frenzy) is the worst possible distribution of jank.
**Solution.** **(a)** Pre-bake status-effect overlays (poison miasma, frost rime, shield arc, muzzle glow) into **sprite variants at load time** in `sprites.js` — 6 tiers × 3 states is 18 extra small canvases and removes ~6 draw calls per affected enemy. **(b)** Cap simultaneous status VFX to the nearest 40 enemies. **(c)** Sort the enemy draw loop by sprite key to eliminate texture thrash. **(d)** Render the shadow layer as one batched pass. **(e)** Move HP bars and colorblind pips to a single `fillRect` batch with one `fillStyle` set. **(f)** Fix the cage hitch by deferring `rebuildStrip()` to a `requestAnimationFrame` coalescing flag rather than calling it synchronously per break (`game.js:449`). **Target: 60 fps at 300 enemies with 24 allies on a 2021 mid-range Android.**
**Effort:** Medium · **Impact:** High · **Priority:** Critical

---

### TIER B — High priority (16–45)

#### 16. Ground tiles have visible seams
**Issue.** `groundTile()` (`sprites.js:306`) draws ellipses at `rnd()*w, rnd()*h` inside a 256×256 canvas; shapes are clipped at the edges, so the tile does not wrap. The 256 px grid is clearly visible in play (confirmed in capture).
**Why it matters.** This is the largest surface in every frame. A visible grid across the entire playfield undermines every other piece of art in the game.
**Player enjoyment.** It reads as "unfinished prototype" in the first two seconds of gameplay — precisely when first impressions are formed.
**Solution.** Make the tile seamless: draw every feature **nine times** at `(dx, dy) ∈ {-w, 0, w} × {-h, 0, h}` so anything crossing an edge reappears on the opposite side. Additionally overlay a second, larger-scale tile (768 px) at low opacity with a different offset to break the repeat rhythm, and scatter non-tiled world-space detail (rock clusters, wet-sand patches) as `decor` entries.
**Effort:** Low · **Impact:** High · **Priority:** High

#### 17. Aura and orbit visuals lie about their real hitbox (verified bug)
**Issue.** The aura ring renders at `w.radius * G.mods.area` (`game.js:1336`) and orbit bodies at `w2.radius * G.mods.area` with `w2.count` iterations (`game.js:1372-1373`). Both ignore `heroMods[].area` / `heroMods[].countAdd` **and** the Super Saiyan evolution bonuses that `fireWeapon()` applies (`game.js:503-508`).
**Why it matters.** Gus's *Wider Coils* (+40% radius) and Yelp's *Bigger Orbs* (+40%) enlarge the damage zone with **no visual change**. Yelp's *Fourth Orb* and Skyjumper's *Stolen Constellation* add an orbiting body that damages enemies but **is invisible**. The Super Saiyan `+2 orbiting bodies` evolution is likewise invisible.
**Player enjoyment.** Players cannot see their upgrades working — the single most demoralising thing an upgrade can do. It also makes positioning around an aura guesswork.
**Solution.** Extract the effective-parameter computation from `fireWeapon()` into a shared `effectiveWeapon(heroIdx, w)` helper returning `{count, radius, area, ...}`, and call it from **both** the fire path and the render path. This is a ~30-line refactor that fixes four upgrades and one evolution at once.
**Effort:** Low · **Impact:** High · **Priority:** Critical

#### 18. Poison damage doesn't credit mastery or powershot charge (verified bug)
**Issue.** The poison tick at `game.js:821` does `e.hp -= e.poisonDps * 0.4` directly, bypassing `damageEnemy()` and therefore `addDamage()`.
**Why it matters.** Chocker's entire identity is poison DoT. His damage-over-time — the majority of his output — **never counts toward his own mastery tier or his powershot charge.** He is structurally the worst Guardian in the game for reasons no player can diagnose.
**Player enjoyment.** A player who picks the poison character and finds their card never levels up will conclude the character is bad and never touch them again.
**Solution.** Route poison ticks through `damageEnemy(e, dps*0.4, {src: e.poisonSrc})`, storing the applying hero's index on the enemy when poison is applied. Audit the same class of bug in `patches` (trail damage does correctly pass `src`) and in runner death-bursts (`game.js:358`).
**Effort:** Low · **Impact:** High · **Priority:** Critical

#### 19. Cage auto-targeting hijacks the boss fight (verified bug)
**Issue.** `game.js:593-594` unconditionally overrides the chosen target with any unbroken cage within 250 px — including while King Glob is standing on top of you.
**Why it matters.** A player who fights the boss near an unbroken cage watches their entire DPS pour into a 70 HP wooden box while the boss eats them.
**Player enjoyment.** Auto-aim that targets the wrong thing at the worst moment is one of the most frustrating failure modes possible, and the player has no way to correct it.
**Solution.** Only prefer cages when no hostile is within the weapon's range, or gate it behind an explicit "Rescue Priority" toggle. Better: **never auto-target cages while `G.boss.alive`**, and instead let the powershot always damage cages (it already does, `game.js:1759`) so freeing mid-boss remains possible but deliberate.
**Effort:** Low · **Impact:** Medium · **Priority:** High

#### 20. Uncharged powershot is a silent no-op
**Issue.** `powershot()` (`game.js:1741`) returns `false` with zero feedback if `hs.charge < 1`.
**Why it matters.** Tapping the right half of the screen is one of only four verbs. Most of the time it does nothing and says nothing.
**Player enjoyment.** Players conclude the button is broken or the game is unresponsive — directly contradicting "exceptionally responsive."
**Solution.** On a failed powershot: shake the active face card, flash its charge bar, play a soft "not ready" click, and show a brief radial charge indicator around the player showing current %. Additionally, add a **persistent on-screen powershot button** in the bottom-right thumb zone with a radial fill — the current "tap anywhere on the right half" is invisible affordance.
**Effort:** Low · **Impact:** Medium · **Priority:** High

#### 21. No control-layout options — left-handed players cannot play
**Issue.** `canvas.pointerdown` (`game.js:55`) hard-codes: `clientX >= cw/2` → powershot, otherwise → move stick. There is no swap option.
**Why it matters.** Left-handed players and anyone who holds a phone with movement on the right simply cannot control the game. There's also no fixed-stick option for players who prefer a static thumbstick.
**Player enjoyment.** Complete exclusion for a meaningful slice of the audience.
**Solution.** Add a Settings group: **Stick side** (Left / Right), **Stick type** (Floating / Fixed), **Stick size** (the `max = 58` at `game.js:63` should be user-scalable), and **Dead zone**. All are ~5-line changes against the existing `joyMove` object.
**Effort:** Low · **Impact:** Medium · **Priority:** High

#### 22. Spitter projectiles are invisible against the ground
**Issue.** Enemy bullets render as `#7cb342` (`game.js:1414`) on a land biome ground of `#2f6b3d` — a luminance contrast ratio near 2:1.
**Why it matters.** Ranged attacks that can't be seen can't be dodged, which converts the spitter from a positioning test into random chip damage.
**Player enjoyment.** Unavoidable damage feels unfair, and unfairness is the fastest route to a rage-quit.
**Solution.** Establish a **threat colour law** and apply it globally: everything that can hurt the player is magenta/white-hot with a dark outline, never green. Give enemy bullets a bright `#ff4081` core, a white inner dot, a 2 px dark outline and a short motion trail. Add a faint ground shadow under each so their position reads on any biome. Apply the same law to boss volleys and telegraph rings.
**Effort:** Low · **Impact:** High · **Priority:** High

#### 23. Difficulty tiers need mechanics, not multipliers
**Issue.** `DIFFICULTIES` (`data.js:158`) varies only `ehp / edmg / bhp / menace / score`.
**Why it matters.** Cataclysm is Guardian with a bigger sponge. The ladder tests patience, not skill.
**Player enjoyment.** Higher difficulty should feel like a *different game*, which is what makes climbing it exciting rather than tedious.
**Solution.** Layer a mechanic per tier on top of the existing multipliers: **Warden** — enemies drop 25% fewer gems (economy pressure). **Nightmare** — hearts no longer drop; healing comes only from cages and level-up choices (resource pressure). **Cataclysm** — the horde gains a slow-moving "tide line" that sweeps the map and must be outrun (spatial pressure), and elites spawn twice as often. Each tier should teach a distinct competence.
**Effort:** Medium · **Impact:** High · **Priority:** High

#### 24. Endless rounds need modifiers, not just bigger numbers
**Issue.** Endless applies `roundHpMul()` / `roundDmgMul()` / `roundBossMul()` and rotates flavour text (`data.js:213`). Round 9 plays exactly like round 2.
**Why it matters.** Endless is the long-tail retention mode. Right now its content is a multiplier.
**Player enjoyment.** Escalating *strangeness* is far more compelling than escalating HP.
**Solution.** From round 2, deal each round **one random Mutator**, announced on the round banner (which already exists): *Blood Moon* (enemies 40% faster, 30% less HP), *Famine* (no hearts, +50% XP), *Static* (your allies fire 2× but you take 2× damage), *Ebb Tide* (the world shrinks by 15%), *Swarm* (double spawn rate, quarter HP), *Mirror* (an enemy copy of your Guardian hunts you). Let the player **choose 1 of 2 mutators** between rounds, with the harder one paying a bigger score multiplier — that's a real risk/reward decision at exactly the right cadence.
**Effort:** Medium · **Impact:** High · **Priority:** High

#### 25. Shell Shrine perks are all flat stats
**Issue.** All 7 `PERKS` (`data.js:199`) are scalar boosts capped at 3–5 levels. Total cost to max everything is 2,605 shells ≈ 1.3 M lifetime score ≈ 26 runs.
**Why it matters.** A meta-shop where every purchase is "+4% damage" gives the player nothing to look forward to and nothing to plan toward. It also finishes in ~26 runs, at which point the shop is dead content.
**Player enjoyment.** Meta-progression should unlock *possibilities*, not percentages.
**Solution.** Keep the 7 stat perks as the early tier, then add a **second shrine tier** of one-time unlocks that change runs: *Ancestral Echo* (start each run with 1 relic slot pre-filled from a random pool), *Tide Charm* (level-up offers 4 cards instead of 3), *Broken Chain* (one random cage starts pre-broken, and it's always a Guardian you haven't mastered), *Deep Roots* (allies you leave behind keep your possession buffs), *Second Moon* (unlocks the daily challenge's hard variant). Price these at 400–1,200 shells so the shop has a 100-run horizon.
**Effort:** Medium · **Impact:** High · **Priority:** High

#### 26. The Daily Challenge has no reason to be daily
**Issue.** `startDaily()` (`game.js:1934`) produces a date-seeded run and stores a per-day best (`game.js:2092`). There is no reward, no streak, no completion state, no comparison.
**Why it matters.** Daily content is the most reliable Day-2/Day-7 retention structure in mobile. Balitopia built the hard part (deterministic seeding) and skipped the motivating part.
**Player enjoyment.** A daily with no stake is a menu item people stop pressing.
**Solution.** **(a)** A **streak counter** with escalating shell rewards (day 1: 25, day 7: 200, day 30: 1,000 + a cosmetic). **(b)** Three **daily objectives** ("free 12 Guardians", "kill 500 enemies", "reach round 2") with individual shell payouts — objectives, not just score, so weaker players also finish. **(c)** A **weekly challenge** with a fixed mutator set and a 7-day board. **(d)** Show yesterday's result and your best-ever daily rank on the title screen so the mode has presence.
**Effort:** Medium · **Impact:** High · **Priority:** High

#### 27. Banners clip on narrow screens and sit over the playfield
**Issue.** `#banner` is `white-space:nowrap` at up to 28 px (`style.css:522-525`), positioned at `top:22%`. Strings like `🌟 WHIPPER IS SUPER SAIYAN — WEAPON EVOLVED!` overflow horizontally; on a 667 px-wide landscape (iPhone SE) they clip off both edges.
**Why it matters.** The game's most exciting announcements are the ones most likely to be unreadable.
**Player enjoyment.** Truncated celebration text turns a reward moment into a glitch.
**Solution.** Allow two lines (`white-space:normal`, `max-width:80vw`, `text-wrap:balance`), auto-shrink font to fit, and move the banner to `top:14%` so it clears the action. Split the two-part Super Saiyan message (`game.js:124-125`) into a headline + subtitle in one card rather than two queued banners.
**Effort:** Low · **Impact:** Medium · **Priority:** High

#### 28. `alert()` and `confirm()` break the native illusion
**Issue.** Native browser dialogs at `game.js:2450` (import), `2452` (import error), `2459` (wipe) and `2701` (forfeit run).
**Why it matters.** A system dialog with the site's URL in it is the single loudest possible "this is a web page" signal. The brief explicitly demands the opposite.
**Player enjoyment.** Breaks immersion at exactly the emotionally-loaded moments (ending a run, erasing progress).
**Solution.** Build one reusable in-game `<dialog>`-style modal component styled to match `.menu-btn2` and use it for all four cases. ~50 lines, reusable for the coach cards in #29 and the unlock notifications in #8.
**Effort:** Low · **Impact:** Medium · **Priority:** High

#### 29. Onboarding is two banners that scroll past in 5 seconds
**Issue.** New players get two queued banners (`game.js:2041-2042`) then nothing. Cages, possession, mastery tiers, the colour-danger system, powershots and the enemy archetypes are all explained only in the How To Play screen, which nobody opens.
**Why it matters.** "Fun within seconds, easy to understand" is a stated pillar. Right now understanding is opt-in reading.
**Player enjoyment.** Players who never discover possession — the game's best mechanic — will rate this a generic clone.
**Solution.** A **contextual, non-blocking coach system**: the first time each situation arises, freeze for 1.5 s with a dimmed spotlight and one short line. Trigger on: first cage in range, first ally freed ("tap their card to become them"), first powershot charge, first gold-tier enemy ("gold = deadly"), first elite, first boss warning. Each fires once, ever, and is skippable. Store flags in the existing `save.seenHints` slot as a bitfield.
**Effort:** Medium · **Impact:** High · **Priority:** High

#### 30. Death gives no diagnosis
**Issue.** `endGame()` (`game.js:2271`) shows score and per-Guardian stats but never says what killed the player.
**Why it matters.** "Every death should motivate another attempt" requires the player to learn something from it. Right now death is opaque.
**Player enjoyment.** Deaths that teach create determination; deaths that don't create resentment.
**Solution.** Track the last 5 damage sources and show a **cause-of-death line** on the stats screen ("Killed by a gold Clubbo · you took 62% of your damage in the last 8 seconds · you had 2 rerolls unused"). Add one actionable tip drawn from the run's actual data ("You never possessed anyone — try swapping to a fresh Guardian when low"). This is cheap and it directly drives the retry.
**Effort:** Low · **Impact:** High · **Priority:** High

#### 31. The score formula rewards idling
**Issue.** `computeScore()` (`game.js:2059`) = `kills×10 + seconds×4 + freed×300 + level×50 + bossPct×3000 + bossKills×8000`, ×difficulty.
**Why it matters.** `seconds × 4` means surviving passively in a corner scores. Meanwhile there is no reward for aggression, efficiency, no-hit play, or build quality.
**Player enjoyment.** Leaderboards that reward patience over skill make the leaderboard uninteresting to climb.
**Solution.** Rebalance toward *rate* and *risk*: add a **combo multiplier** (kills within 2 s of each other build a ×1.0→×3.0 multiplier that decays, applied to kill score — this alone makes aggressive play feel great and gives moment-to-moment score feedback), a no-damage-taken time bonus, an elite/miniboss bonus, and a mastery bonus (sum of tiers × 400). Reduce raw time to ×1. Show the live combo multiplier in the HUD.
**Effort:** Medium · **Impact:** High · **Priority:** High

#### 32. Wider phones see ~30% more of the world
**Issue.** `VIEW_H` is fixed at 540 and `viewW = cw / viewScale` (`game.js:21-29`). A 4:3 tablet sees ~960 world-px across; a 21:9 phone sees ~1,250.
**Why it matters.** Screen aspect materially changes reaction time and threat awareness, which matters for a shared daily-challenge leaderboard.
**Player enjoyment.** It also means the framing (how big the hero feels) is inconsistent across devices — the hero looks tiny on wide phones.
**Solution.** Fit to **area, not height**: compute `viewScale` so that `viewW × viewH` is approximately constant (`scale = sqrt(cw*ch / TARGET_AREA)`), clamped to sensible min/max. Every device then sees the same amount of world, with aspect only changing its shape. Also increase the hero's on-screen size — 48 px in a 540-px view is very small for a 5-inch screen.
**Effort:** Low · **Impact:** Medium · **Priority:** High

#### 33. The boss fight is a stat check, not an encounter
**Issue.** `updateBoss()` (`game.js:894`) is: walk toward the player, fire a spread volley, summon adds, telegraph a slam. Phases at 50% and 20% change only speed and cooldowns.
**Why it matters.** The boss is the run's climax and the reward for 6–8 minutes. It currently asks the player to keep walking backwards.
**Player enjoyment.** Memorable bosses have *verbs* you learn to counter. Glob has none.
**Solution.** Give Glob a mechanic per phase that demands a specific response: **P1 — Gorge**: he periodically inhales, pulling the player toward him; you must move away or take heavy damage. **P2 — Crown Split**: he sheds four crown fragments that must be destroyed within 12 s or he heals 15%; forces target-switching and rewards AoE builds. **P3 — Famine Field**: expanding rings of safe/unsafe ground that force constant repositioning while the arena floods. Keep the slam. Also stop him standing on top of the player: add a minimum standoff distance and a lunge.
**Effort:** High · **Impact:** High · **Priority:** High

#### 34. Music never reacts to what's happening
**Issue.** `playMusic()` (`audio.js:178`) plays one looping file per state and hard-cuts on transitions (`stopMusic()` then a new `Audio`).
**Why it matters.** Adaptive audio is the cheapest way to make a game feel expensive. Hard cuts feel amateur.
**Player enjoyment.** The boss arrival — the biggest moment in a run — currently has the emotional shape of changing a radio station.
**Solution.** **(a)** Crossfade all music transitions over 1.2 s using two `GainNode`-routed elements. **(b)** Add an intensity layer: duck the region track and raise a percussion stem when enemy count is high or player HP is low. **(c)** Duck music by 6 dB for 1.5 s under banners and boss stingers. **(d)** Play the possessed Guardian's own theme as a brief 6-second flourish over the battle music on possession — the game already ships 24 themes that are never heard in-game.
**Effort:** Medium · **Impact:** High · **Priority:** High

#### 35. Viewport handling is incomplete for real phones
**Issue.** `resize()` (`game.js:23`) listens only to `window.resize`, has no debounce, and reallocates the canvas backing store on every event. There is no `orientationchange` handler, no `visualViewport` listener, and no re-layout after iOS address-bar collapse.
**Why it matters.** On iOS Safari, `innerHeight` changes as the URL bar hides/shows, sometimes without a `resize` event; on Android, rotation can fire `resize` before the new dimensions settle.
**Player enjoyment.** Letterboxing, stretched rendering or a mis-sized canvas after rotating — exactly the "browser game" tells the brief wants eliminated.
**Solution.** Listen to `resize`, `orientationchange` and `visualViewport.resize`; debounce to the next animation frame; only reallocate `canvas.width/height` when the pixel dimensions actually changed; re-run once more 250 ms after an orientation change to catch the settle.
**Effort:** Low · **Impact:** Medium · **Priority:** High

#### 36. The player cannot see their own build
**Issue.** There is no UI anywhere during a run that lists the upgrades you've taken. The roster screen (`openRoster()`, `game.js:1889`) shows Guardians and mastery tiers only.
**Why it matters.** Players cannot plan a draft they cannot audit. It also makes the level-up decision harder in the worst way (memory load, not strategy).
**Player enjoyment.** Reviewing "what I've built" mid-run is one of the quiet pleasures of the genre.
**Solution.** Add a **Build** tab to the roster/pause screen: taken upgrades with stack counts, current effective stats (DPS, move speed, area, pickup range, crit), active relics with their levels, and the current Guardian's evolution status. Also show a compact build strip (icons only) on the level-up screen so choices are made in context.
**Effort:** Medium · **Impact:** High · **Priority:** High

#### 37. Level-ups arrive too fast early and stall late
**Issue.** `G.xpNext = 8 · level^1.42 + 6` (`game.js:1087`). Levels 1–8 arrive within the first ~40 seconds, each hard-pausing the game.
**Why it matters.** Six full-screen modal interruptions in the first minute destroy the opening's flow — precisely the "fun within seconds" window.
**Player enjoyment.** Being interrupted repeatedly before you've understood the controls is a bad first impression, and it also burns the whole generic upgrade pool before the player knows what any of it means.
**Solution.** Flatten the early curve (start `xpNext` at 16, exponent ~1.30) so levels 1–5 land at ~15 s intervals; then let it steepen. Batch simultaneous level-ups into one card selection with a "×2" badge rather than sequential modals. Consider a **non-blocking** level-up for the first three levels: cards slide in from the bottom while the game continues at 35% speed — the player keeps their thumb on the stick, which preserves flow and teaches the UI without stopping the fun.
**Effort:** Medium · **Impact:** Medium · **Priority:** High

#### 38. Healing is a coin flip, and sustain builds don't exist
**Issue.** Hearts drop at 40% from clubbos and 14% from demonders (`game.js:364-367`) — nowhere else. `regen` and `vital` are the only sustain upgrades; there is no lifesteal, no on-kill heal, no shield.
**Why it matters.** Survivability is almost entirely determined by "did a clubbo spawn near me," which is out of the player's control.
**Player enjoyment.** Defensive play has no build to express itself through, so the only survival strategy is running away.
**Solution.** Add a defensive axis: **Bloodtide** (heal 0.6% max HP per kill within 120 px), **Coral Ward** (a shield that absorbs one hit and recharges after 12 s without damage), **Kelp Armour** (−12% damage taken, stacking), **Reef Bloom** (allies heal you 1 HP/s each while you stand within their formation ring). Make hearts drop from elites and every third cage. Give the player a reason to *engage* rather than only to flee.
**Effort:** Medium · **Impact:** High · **Priority:** High

#### 39. There are no treasure moments
**Issue.** The only pickups are XP gems (`dropGem`) and hearts. There are no chests, no rare drops, no jackpots.
**Why it matters.** "Rewards should consistently generate excitement" and "players should regularly experience moments of surprise" are stated goals. A gem that grants +1 XP does neither.
**Player enjoyment.** The dopamine architecture of this genre is built on variable-ratio jackpots. Balitopia has a fixed, flat reward curve.
**Solution.** Add **Chests**, dropped by elites, minibosses and Cage Sieges. Opening plays a 2-second slot-machine reel with an escalating chime and awards 1–5 upgrades at once (the classic VS moment, and the most-shared thing in that game). Add **Shell Caches** (bonus meta-currency) and a rare **Ancestor Idol** that offers a choice of three *relics* rather than upgrades.
**Effort:** Medium · **Impact:** High · **Priority:** High

#### 40. The minimap is unreadable
**Issue.** `drawMinimap()` (`game.js:1554`) maps the entire 5,200 px world into ~78 px. Cages become 3 px dots crowded near centre; the player is a 2.6 px circle; the visible viewport (~1,169 × 540) is 1.5% of the map area and isn't drawn.
**Why it matters.** It occupies prime bottom-left screen space and conveys almost nothing.
**Player enjoyment.** Wasted screen real estate that also fails at its one job (route planning).
**Solution.** Make it a **local radar** rather than a world map: show a 2,400 px radius around the player, drawn with a soft circular vignette, with off-radar cages clamped to the rim as small chevrons. Draw the current view rectangle. Increase marker sizes and add the boss, elites and chests. Move it to the top-left under the HP bar so it doesn't compete with the thumb zone.
**Effort:** Low · **Impact:** Medium · **Priority:** Medium

#### 41. Allies clump into a single blob
**Issue.** `updateAllies()` (`game.js:981-983`) places ally *i* at angle `(i / max(6,n)) · 2π + time·0.1`, radius `70 + (i%3)·34`. With 20+ allies the angular spacing collapses and there is no inter-ally separation.
**Why it matters.** Twenty characters occupying the same 100 px is visual mush and hides the player.
**Player enjoyment.** The player's own avatar becomes hard to find in their own squad — a serious readability failure.
**Solution.** Distribute allies on concentric rings sized to the count (`ring = floor(i/8)`, radius `80 + ring·46`), add light mutual separation reusing the enemy separation code, and **fade non-firing allies to 55% opacity and 80% scale** so the player and the active fighters stay dominant. Always draw the player last with a stronger marker ring.
**Effort:** Low · **Impact:** Medium · **Priority:** High

#### 42. The endless boss gap is 150 seconds of nothing
**Issue.** `BOSS_RESPAWN = 150` (`data.js:149`) — after each Glob kill there's a 2.5-minute stretch of ordinary horde before the next.
**Why it matters.** The endless mode's rhythm is 30 s of climax followed by 150 s of filler.
**Player enjoyment.** Dead time immediately after the biggest high in the game is the worst possible pacing.
**Solution.** Compress to 90 s, and fill it with structure: a guaranteed chest immediately on boss death (celebration), a mutator choice at +15 s (decision), an elite wave at +40 s (action), the warning at +75 s. Also make the post-kill `healPct(0.5)` (`game.js:419`) into a visible, celebrated moment rather than a silent number change.
**Effort:** Low · **Impact:** Medium · **Priority:** High

#### 43. The first 45 seconds are empty
**Issue.** Spawn rate starts at 1.4/sec (`game.js:268`) into a 5,200² world; the nearest cage is 460 px away. My 0:01 capture shows an empty field.
**Why it matters.** The opening 30 seconds determine whether a player takes a second run. Genre leaders put pressure on immediately.
**Player enjoyment.** "Fun within seconds" is failing at the literal first seconds.
**Solution.** Open at 3.5 enemies/sec. Start the player 200 px from the first cage so the first rescue lands inside 15 seconds. Add a scripted opening beat: a small ring of minyar closes in at 0:03 so the player's first act is *winning a fight*. Play the chosen Guardian's entrance stinger over a 1-second cinematic zoom-out from the hero — the assets exist and are currently used only as a background sound.
**Effort:** Low · **Impact:** High · **Priority:** High

#### 44. Face cards occupy the primary thumb zone
**Issue.** `#facecard-strip` is anchored bottom-centre, wrapping upward into two rows (`style.css:480`). With 24 freed Guardians at 38 px each plus gaps that's ~1,030 px of card — it spans the full width and eats the bottom ~90 px of a 390 px-tall landscape screen.
**Why it matters.** In landscape, the bottom-left is the movement thumb and the bottom-right is where a powershot button belongs. The strip sits in both.
**Player enjoyment.** Accidental possession while trying to move, and a permanently occluded lower quarter of the playfield.
**Solution.** Replace the always-on 24-card strip with a **quick-swap ribbon of 4** (your current Guardian plus the 3 with the highest charge/mastery), centred and small, with the full roster one tap away in the existing pause screen. Add a radial swap gesture: long-press the ribbon to fan out all freed Guardians around the thumb. This frees the entire bottom third of the screen.
**Effort:** Medium · **Impact:** High · **Priority:** High

#### 45. The camera never looks ahead
**Issue.** `G.cam` lerps toward the player at `8·dt` (`game.js:1147`) with no velocity lead, no aim bias and no dynamic zoom.
**Why it matters.** The player is always dead-centre, so half the visible screen is behind them — where nothing matters.
**Player enjoyment.** Reduces reaction time in the direction they're actually travelling.
**Solution.** Offset the camera target by `moveVector × 90` (smoothed) so the player sits behind centre when moving. Add a subtle zoom-out (up to 12%) when enemy density is high or the boss is on screen, and a brief punch-in on powershot. All three are a handful of lines against the existing lerp.
**Effort:** Low · **Impact:** Medium · **Priority:** High

---
### TIER C — Medium priority (46–80)

#### 46. One shoot sound for twenty-four weapons
**Issue.** `Sound.sfx.shoot()` (`audio.js:95`) plays the same sample for every player weapon regardless of archetype. **Why it matters.** Twenty-four Guardians with distinct visual identities all sound identical. **Enjoyment.** Weapons feel interchangeable; swapping bodies loses half its sensory payoff. **Solution.** Map one sound per archetype (shot / nova / orbit / aura / chain / beam / trail / slash) with ±12% pitch variance, and give the six most-distinctive heroes a bespoke layer. Eight new short samples covers 90% of the gain. **Effort:** Low · **Impact:** Medium · **Priority:** High

#### 47. The 24 hero themes are never heard during gameplay
**Issue.** `assets/audio/heroes/<id>.mp3` (54.6 MB, 24 tracks) is used only for select-screen previews. **Why it matters.** The single most expensive asset class in the project is used for ~8 seconds per session. **Enjoyment.** A huge missed identity beat — hearing *your* Guardian's theme swell should be the reward for mastering them. **Solution.** After the audio re-encode (#4), play a 6-second hook of the possessed Guardian's theme layered over battle music on possession, and the full theme during the Super Saiyan transformation. **Effort:** Low · **Impact:** Medium · **Priority:** Medium

#### 48. Projectiles are flat circles with no trails
**Issue.** `render()` (`game.js:1403-1409`) draws each projectile as a filled arc plus one faded ghost arc. **Why it matters.** Every weapon in the game looks like the same coloured dot. **Enjoyment.** Weapon fantasy ("rainbow feather fan", "scalding steam blade", "star shrapnel") is written in the data but never drawn. **Solution.** Add a per-archetype projectile renderer: elongated capsules oriented to velocity for shots, 3-segment fading trails, rotating shards for nova, soft additive glow for beams. Cache each as a small pre-rendered sprite tinted per hero to keep it cheap. **Effort:** Medium · **Impact:** High · **Priority:** High

#### 49. Particles are untextured squares
**Issue.** `spawnParts` / render (`game.js:313`, `1470-1475`) emit axis-aligned `fillRect` squares with linear velocity and 0.92/frame drag. **Why it matters.** All VFX in the game — kills, tier-ups, cage breaks, explosions — resolve to the same square confetti. **Enjoyment.** Impacts read as generic; no VFX language distinguishes a crit from a cage break. **Solution.** Add particle *kinds* (spark: stretched to velocity; puff: soft radial, additive; shard: rotating triangle; ring: expanding annulus), gravity and rotation, plus additive blending for energy effects. Give each hero accent-tinted variants. **Effort:** Medium · **Impact:** High · **Priority:** High

#### 50. Enemies vanish instead of dying
**Issue.** `killEnemy()` (`game.js:346`) sets `alive = false` and emits 6–12 particles. There is no death animation, squash, or corpse. **Why it matters.** Killing is the game's core output and it has no visual punctuation. **Enjoyment.** The horde thins without any felt sense of *you* having done it. **Solution.** Add a 180 ms death state: squash-and-stretch to 1.4× wide / 0.5× tall, flash to white, spin off with the killing blow's momentum, then dissolve. Add a short-lived ground splat decal (pooled, capped at 40) for weight. **Effort:** Medium · **Impact:** High · **Priority:** High

#### 51. Screen shake is one uniform noise function
**Issue.** `G.shake` is a scalar producing symmetric random offsets (`game.js:1179-1180`). **Why it matters.** A powershot, a boss slam, a hurt and a clubbo death all shake identically. **Enjoyment.** Shake stops meaning anything when it always means the same thing. **Solution.** Replace with a directional trauma model: store a direction and a frequency; use a decaying sine along the impact axis for hits, and rotational trauma for explosions. Cap total displacement and respect the reduced-motion multiplier that already exists. **Effort:** Low · **Impact:** Medium · **Priority:** Medium

#### 52. No slow-motion at dramatic beats
**Issue.** `hitStop()` exists but is a full freeze at only two call sites. **Why it matters.** Time dilation is the most reliable tool for making a moment feel important. **Enjoyment.** The near-death save, the last hit on a boss, the powershot that clears the screen — all pass at normal speed. **Solution.** Add a `G.timeScale` applied to `dt` in `update()`. Ramp to 0.25× for 450 ms on: dropping below 15% HP for the first time in 10 s, killing the boss (replacing the hard freeze), and a powershot that kills 15+ enemies. Ease back over 250 ms. Gate behind reduced-motion. **Effort:** Low · **Impact:** High · **Priority:** High

#### 53. No enemy spawn telegraph
**Issue.** `spawnWave()` (`game.js:266`) places enemies just off-screen with no warning. **Why it matters.** Threats materialise at the screen edge with no anticipation. **Enjoyment.** Removes the pleasure of *seeing it coming* and reacting. **Solution.** For elites, clubbos and surges, show a 1.2 s ground-crack/shadow telegraph at the spawn point with an edge-of-screen directional indicator. Keep trash spawns silent. **Effort:** Low · **Impact:** Medium · **Priority:** Medium

#### 54. Roster screen is a pause menu with no information
**Issue.** `openRoster()` (`game.js:1889`) renders 24 cards with a name and one of three states. **Why it matters.** It's the only pause screen, shown constantly, and it tells the player almost nothing. **Enjoyment.** A missed chance to make mastery legible and possession deliberate. **Solution.** Show per-Guardian: mastery tier + XP-to-next bar, powershot charge %, damage dealt this run, weapon type icon, and which signature upgrades are taken. Sort by charge so the best swap target is first. Add the Build tab from #36. **Effort:** Medium · **Impact:** Medium · **Priority:** Medium

#### 55. Settings is missing the options that matter most on mobile
**Issue.** Settings covers volume, haptics, motion, colorblind, minimap, UI scale (`index.html:63-69`). **Why it matters.** No graphics quality, no FPS cap, no control layout, no battery mode, no damage-number toggle, no screen-shake intensity. **Enjoyment.** Players on weak devices have no lever to make the game playable. **Solution.** Add: **Quality** (High/Balanced/Battery — scales particle cap, status VFX, DPR and shadow rendering), **Frame cap** (60/45/30), **Screen shake** (0–150%), **Damage numbers** (All/Big only/Off), plus the control options from #21. Auto-select Balanced if the first 300 frames average under 50 fps. **Effort:** Medium · **Impact:** High · **Priority:** High

#### 56. No battery or thermal strategy
**Issue.** `requestAnimationFrame(frame)` runs unconditionally (`game.js:1097`), rendering full-rate even on menus and during the game-over screen. **Why it matters.** The brief explicitly requires high battery optimisation; a canvas game pushing 1688×780 at 60 fps behind a full-screen DOM overlay is pure waste. **Enjoyment.** Phone heat and battery drain end sessions early. **Solution.** Skip rendering entirely when any full-screen `.screen` overlay is visible; drop to 30 fps when the game is paused or the level-up modal is open; halt the loop on `visibilitychange` and restart on return. Combined with #55's frame cap this is a large, cheap battery win. **Effort:** Low · **Impact:** High · **Priority:** High

#### 57. Saves are written synchronously on hot paths with no integrity guard
**Issue.** `saveGame()` (`game.js:2501`) does a synchronous `JSON.stringify` + `localStorage.setItem` and is called from `newGame()`, `addDamage()` (first Super Saiyan), the mute toggle, every settings change and the shop. There's no write throttle, no checksum, and a failed write is swallowed (`catch(e){}`). **Why it matters.** `localStorage` writes are synchronous and block the main thread; a quota failure or a partial write silently loses all progress with no user-visible signal. **Enjoyment.** "Save player progress reliably" is a stated requirement, and silent loss of 26 runs of shells is the worst possible outcome. **Solution.** Debounce writes to ≥500 ms, keep an in-memory authoritative object, write a **dual-slot rotating save** (`balitopia` + `balitopia_bak`) with a version + checksum, validate on load and fall back to the backup on corruption, and surface a visible warning if a write fails. Flush on `visibilitychange` and `pagehide`. **Effort:** Low · **Impact:** High · **Priority:** Critical

#### 58. Achievements and the Codex award nothing
**Issue.** `ACHIEVEMENTS` (`data.js:230`) sets a timestamp; the Codex (`game.js:2336`) tracks best mastery per hero. Neither pays out. **Why it matters.** A completion system with no reward is a checklist, and checklists don't retain. **Enjoyment.** "Full Codex — master all 24 to Super Saiyan" is a 100-hour goal with literally no payoff. **Solution.** Attach shell payouts scaled to difficulty (50–800), and gate genuine content behind the big ones: Full Codex unlocks a **Prestige** mode; Regicide on Cataclysm unlocks the second boss's arena as a standalone challenge; endless round 10 unlocks a cosmetic Guardian palette. Show a toast with a shell count on unlock rather than only a badge on the stats screen. **Effort:** Low · **Impact:** High · **Priority:** High

#### 59. Nothing shows the player what's next
**Issue.** There is no "next unlock" indicator anywhere. **Why it matters.** Retention is driven by a visible near-term goal at the moment the player decides whether to play again. **Enjoyment.** The death screen currently offers a number and a button. **Solution.** Put a **Next Goals** panel on the death screen and the title: the 3 nearest unlocks/achievements with live progress bars ("Free 8 Guardians in one run — 6/8"). This is the highest-leverage 40 lines in the whole retention section. **Effort:** Low · **Impact:** High · **Priority:** High

#### 60. The share card has nothing worth sharing
**Issue.** `buildRecapCanvas()` (`game.js:2186`) renders portrait, score, time, kills, cages, level. **Why it matters.** People share *stories and flexes*, not stat tables. **Enjoyment.** The growth loop exists but doesn't fire. **Solution.** Make the card narrative: the run's **defining moment** ("Took Zappo to Super Saiyan at 4:12"), the build (relic icons), the death cause, a rank badge, and — the big one — a **short seed/replay code** so a friend can play the exact same run. "Beat my score on this seed" is a genuine share hook. Auto-offer the share sheet after a new personal best rather than requiring a button press. **Effort:** Medium · **Impact:** Medium · **Priority:** Medium

#### 61. Hero select doesn't help the player choose
**Issue.** `buildSelect()` (`game.js:2614`) shows a 24-card grid with a name; the detail panel adds three normalised stat bars. **Why it matters.** With 24 options and no filter, sort, favourite, or "last used" grouping, choosing is arbitrary. **Enjoyment.** New players pick by picture; returning players scroll to find their main. **Solution.** Add archetype filter chips (Ranged / Area / Orbit / Melee / Support), sort by mastery, a Favourites row, "recently played," per-hero lifetime stats (best score, runs, mastery), and — critically — show the hero's **two signature upgrades** on the detail panel so the choice previews a playstyle. **Effort:** Medium · **Impact:** Medium · **Priority:** Medium

#### 62. Difficulty selection is buried
**Issue.** `#diff-select` sits inside the hero detail panel as four small chips (`style.css:440`), which on short landscape shrink to 8.5 px text (`style.css:230`). **Why it matters.** The most consequential pre-run decision is the smallest UI element on the screen. **Enjoyment.** Players don't notice the ladder exists, so the primary progression gate goes unused. **Solution.** Promote difficulty to its own step after hero select — a full-width card per tier showing multipliers, unlock state, best score, and the mechanic it adds (#23). **Effort:** Low · **Impact:** Medium · **Priority:** Medium

#### 63. No seeded/shareable runs outside the daily
**Issue.** `mulberry32` + `dailyRng` exist (`game.js:1920-1932`) but only the daily uses them; normal runs use `Math.random()` throughout. **Why it matters.** Seeds enable sharing, competition, practice and bug reproduction. **Enjoyment.** "Play my seed" is a strong social hook and it's 90% built already. **Solution.** Route all run randomness through a seeded PRNG stored on `G`. Show the seed on the death screen; allow entering one from the select screen. **Effort:** Medium · **Impact:** Medium · **Priority:** Medium

#### 64. Records are capped at 12 with no context
**Issue.** `save.records = records.slice(0,12)` (`game.js:2079`) with no per-hero or per-difficulty breakdown. **Why it matters.** A 12-row all-time list means a good Cataclysm run and a good Guardian run compete for the same slots, so the board stops being informative fast. **Enjoyment.** Personal-best chasing needs *many* records to chase. **Solution.** Keep best-per-(hero × difficulty) and best-per-difficulty in addition to a global top 20, with tabs. Storage cost is trivial (current save is 317 bytes). **Effort:** Low · **Impact:** Medium · **Priority:** Medium

#### 65. Colorblind support is partial
**Issue.** Danger pips (`game.js:1322`) cover enemy power tier only. Mastery tiers, difficulty chips, HP/XP bars, gem values and the threat/friendly distinction remain colour-only. **Why it matters.** Roughly 8% of male players have some colour vision deficiency, and this game's core threat-reading rule is *literally* "colour = danger." **Enjoyment.** Without full coverage, those players cannot read the game's primary information channel. **Solution.** Extend the redundant-cue pass: tier numerals on mastery borders, shape differentiation on gems (already partially present via size), icons on difficulty chips, and a deuteranopia/protanopia/tritanopia palette option for enemy tints. Verify all UI text against WCAG AA. **Effort:** Medium · **Impact:** Medium · **Priority:** High

#### 66. UI text scaling covers only six elements
**Issue.** `--ui-scale` is applied to `#hp-text, #lvl-text, #timer, #kills, #freed, #boss-eta` and `#banner` only (`style.css:559-560`). **Why it matters.** Menus, upgrade cards, stats screens, settings rows and the shop — all the text-heavy screens — ignore the setting entirely. **Enjoyment.** Players who need larger text get it in the six places they need it least. **Solution.** Move to a root `font-size` scale with `rem`-based sizing across all screens, or apply `--ui-scale` to the `clamp()` maxima throughout. Test at 130% that nothing overflows on a 667×375 landscape. **Effort:** Medium · **Impact:** Medium · **Priority:** Medium

#### 67. Reduced motion doesn't cover everything
**Issue.** `body.reduce-motion` disables five CSS animations (`style.css:551-555`) and softens shake to 0.25× (`game.js:1178`), but the canvas still runs full particle counts, the mystery-card 3D flip, the tier-up rings, screen flashes and the `bannerPop` scale animation. **Why it matters.** Users who enable it are often doing so for vestibular reasons; partial coverage doesn't help. **Solution.** Under reduced motion: cut particles by 70%, disable camera zoom/lead, replace the card flip with a cross-fade, cap screen flash alpha at 0.15, disable hit-stop and time dilation, and stop the bob/squash oscillations. **Effort:** Low · **Impact:** Medium · **Priority:** Medium

#### 68. No audio ducking or mix hierarchy
**Issue.** Music, SFX, hero themes and entrance stingers all play at fixed volumes into two gain nodes. **Why it matters.** During a busy fight the mix is a wall; important cues (powershot ready, boss enrage, low HP) don't cut through. **Solution.** Add a third "cue" bus above SFX; duck music −6 dB and SFX −3 dB for 800 ms under any cue. Add a low-HP heartbeat layer and a subtle high-pass on music during the boss frenzy. **Effort:** Medium · **Impact:** Medium · **Priority:** Medium

#### 69. Several touch targets are under 44 px
**Issue.** `.diff-chip` compresses to ~18 px tall on short landscape (`style.css:230`); `.facecard` is 34–38 px in dense mode (`style.css:225`); `#btn-roster`/`#btn-mute` are 38 px (`style.css:473`); `.shop-buy` is ~30 px tall. **Why it matters.** Apple's HIG and Material both specify 44 px / 48 dp minimums. Sub-44 px targets in a game where mis-taps cause possession swaps mid-fight are a real problem. **Solution.** Keep visual sizes but expand hit areas with transparent padding or `::before` overlays to ≥44 px. **Effort:** Low · **Impact:** Medium · **Priority:** High

#### 70. There is no ambient audio layer
**Issue.** Music and SFX only. No surf, wind, jungle, crowd. **Why it matters.** Ambience is what makes a world feel inhabited rather than a canvas with sprites on it. **Solution.** One 20-second seamless ambient loop per biome at very low volume (surf for sea, insects for jungle, wind for sky), ~60 KB each in Opus. Duck under the boss. **Effort:** Low · **Impact:** Medium · **Priority:** Medium

#### 71. Signature upgrades are 90% flat stats
**Issue.** Of the 48 entries in `HERO_UP` (`data.js:249`), the overwhelming majority are `{dmg: 1.4}` or `{countAdd: n}`. **Why it matters.** These should be the moments where each Guardian becomes *themselves*, and instead they are the same six modifiers with different emoji. **Enjoyment.** No reason to feel excited about a Guardian's signature card versus a generic one. **Solution.** Give every Guardian **one identity upgrade** that changes behaviour: Bo's feathers seek the lowest-HP enemy; Fixie's icicles shatter into a frost field on kill; Zappo's chain arcs back through the chain on the return; Snapper's clap creates a lingering shockwave ring; Swack's doorwave carries enemies with it; Roger-Dodger's boomerangs orbit him for 2 s before returning. Keep the second slot as the reliable stat bump. **Effort:** Medium · **Impact:** High · **Priority:** High

#### 72. The world edge is a stroked rectangle
**Issue.** `ctx.strokeRect(-10,-10,WORLD+20,WORLD+20)` with a 20 px line (`game.js:1193`). **Why it matters.** The island's boundary is a blue line. **Solution.** Draw a proper coastline band: sand gradient, animated surf line, a darker deep-water zone, and soften the hard movement clamp into a resistance zone. Reuse per biome (cloud edge for sky, reef for sea). **Effort:** Low · **Impact:** Medium · **Priority:** Medium

#### 73. Decor is 150 static props across 27 million square pixels
**Issue.** `newGame()` scatters 150 decor items over a 5,200² world (`game.js:2003-2010`) — roughly one prop per 180,000 px². **Why it matters.** The world reads as empty green, which is exactly what the capture shows. **Solution.** Raise density to ~900 props, cluster them (groves, rock fields, ruins) rather than uniform-random, add a parallax canopy layer, and generate them from the run seed so the island feels authored. Cull by the existing `onScreen` check — cost is negligible. **Effort:** Low · **Impact:** High · **Priority:** High

#### 74. Biomes are a palette swap
**Issue.** The three biomes change `groundTile` colours (`sprites.js:301-305`) and the music track. Nothing mechanical differs. **Why it matters.** "Every run should feel different" — three identical runs with different green. **Solution.** Give each biome one rule: **Jungle** — dense decor blocks line of sight and slows enemies. **Sea** — periodic tide surges push everything in one direction. **Sky** — wind drift affects projectiles; gaps in the cloud floor deal damage. Add biome-flavoured enemy variants using the existing tint system. **Effort:** Medium · **Impact:** High · **Priority:** Medium

#### 75. Gems have only three visual tiers and no juice
**Issue.** `gemS/gemM/gemL` at thresholds 4 and 15 (`game.js:1246`). Collection plays one throttled blip. **Why it matters.** Pickup is the most frequent positive event in the game and it's nearly silent. **Solution.** Add a 5th/6th tier for elite and boss gems with a glow and a rising pitch, a short attract-arc animation, a running "+XP" combo counter near the XP bar, and a satisfying chord when a level fills. Batch the sound when many gems arrive at once. **Effort:** Low · **Impact:** Medium · **Priority:** Medium

#### 76. No pause that isn't the roster
**Issue.** Escape/P and the ☰ button both open the roster (`game.js:40-45`, `2694`); there is no plain pause. **Why it matters.** Players want to pause without a menu wall of 24 cards. **Solution.** Make ☰ a true pause overlay with Resume / Build / Roster / Settings / End Run, dimmed with the game visible behind it. **Effort:** Low · **Impact:** Low · **Priority:** Medium

#### 77. `visibilitychange` handling is incomplete
**Issue.** Backgrounding opens the roster (`game.js:2727`) and the audio context resumes on return (`audio.js:116`), but the `<audio>` music element isn't paused, the rAF loop keeps running, and if the level-up modal is open the roster stacks on top of it. **Why it matters.** "Recover gracefully from interruptions" is a stated requirement; background audio and a running loop drain battery during a phone call. **Solution.** On hide: pause music and preview elements, stop the rAF loop, flush the save. On show: resume the loop, resume audio context, restore music with a fade-in, and never open the roster over an active modal. **Effort:** Low · **Impact:** Medium · **Priority:** High

#### 78. The game keeps running for 1.1 s after death
**Issue.** `endGame()` (`game.js:2271`) sets `G.over = true` but leaves `G.running = true` until a 1,100 ms `setTimeout`. **Why it matters.** Input and simulation continue through the death moment. **Solution.** Freeze the sim immediately, then run the delay as a *presentation* beat: time dilation to 0.15×, desaturate, zoom in on the player, then transition. Turns a bug into a cinematic. **Effort:** Low · **Impact:** Medium · **Priority:** Medium

#### 79. Retriggered sounds cut themselves off
**Issue.** `playFile()` (`audio.js:200`) caches exactly one `Audio` element per path and does `currentTime = 0` on replay. **Why it matters.** Breaking two cages within a second silences the first stinger; the shatter sound clips constantly. **Solution.** Superseded by the WebAudio buffer approach in #4 — decoded buffers allow unlimited overlapping voices with per-voice gain and pitch. Until then, use a small round-robin pool as `playSample()` already does (`audio.js:70`). **Effort:** Low · **Impact:** Medium · **Priority:** Medium

#### 80. The boss slam plays a "kill" sound at the player
**Issue.** The telegraph detonation calls `Sound.sfx.bigKill()` (`game.js:1056`) — a descending sawtooth designed as a *reward* cue — when the player is being hit. **Why it matters.** Reward audio on a damage event is a direct semantic contradiction. **Solution.** Give the slam its own impact sound (the shipped `glob_slam.wav` already plays on the *telegraph*; add a distinct heavy impact on detonation) and reserve `bigKill` for large kills. **Effort:** Low · **Impact:** Low · **Priority:** Medium

---

### TIER D — Lower priority, but do them before launch (81–100)

#### 81. 110 MB of unused assets ship in the repository
**Issue.** `assets/3d` (50 MB, 28 `.glb` files) and `assets/art` (60 MB of 1024px+ source PNGs) are referenced only by the `tools/compose_*.js` build scripts. `assets/video` (1.5 MB) is used only for face-card idle loops. **Why it matters.** Clone time, hosting cost, deploy weight, and a real risk of them being served if the deploy is a naive folder copy. **Enjoyment.** Indirect — but a bloated deploy is a slow first load. **Solution.** Move `3d/` and `art/` to a separate `source-assets` repo or Git LFS, and add an explicit build/deploy manifest that copies only `img/`, `audio/` (post-encode) and `video/`. **Effort:** Low · **Impact:** Medium · **Priority:** High

#### 82. `.gitattributes` sets `* text=auto` over a binary-heavy repo
**Issue.** The only rule is `* text=auto`. Git's heuristic normally protects binaries, but a mis-detected audio or image file would be corrupted by line-ending normalisation on checkout. **Solution.** Add explicit `-text` rules: `*.mp3 *.wav *.png *.webp *.jpg *.mp4 *.glb binary`. **Effort:** Low · **Impact:** Low · **Priority:** High

#### 83. Unused shipped audio
**Issue.** `fire_crackle.mp3`, `spell_break.wav` and `music/bgm_intro.mp3` are never referenced from any source file; `img/title_bg.jpg` is likewise unused (the story screen uses `story_bg.jpg`). **Solution.** Either wire them (fire_crackle is an obvious fit for Flick's trail; bgm_intro for the story screen) or remove them from the deploy manifest. **Effort:** Low · **Impact:** Low · **Priority:** Medium

#### 84. Dead code
**Issue.** `banner ? null : null;` in `exportSave()` (`game.js:2429`); `Sprites.get('ground')` legacy alias (`sprites.js:416`); `S.hit` and `S.cageHit`-adjacent unused paths; the synth music fallback (`audio.js:124-171`) is unreachable now that real music always exists. **Solution.** Remove or wire. Keep the synth fallback — it's genuinely useful for `file://` runs — but document it. **Effort:** Low · **Impact:** Low · **Priority:** Low

#### 85. No crash recovery
**Issue.** An exception inside `frame()` kills the `requestAnimationFrame` chain permanently — the game freezes with no message. **Why it matters.** One edge-case bug becomes a hard lock with no recourse but a page reload, losing the run. **Solution.** Wrap `update()` and `render()` in a try/catch that logs, increments an error counter, and attempts to continue; after 3 consecutive failures, save the run, show a friendly "something went wrong" modal, and offer a restart. **Effort:** Low · **Impact:** Medium · **Priority:** High

#### 86. No telemetry hooks
**Issue.** Nothing records where players die, which heroes are picked, which upgrades are taken, or where sessions end. **Why it matters.** Post-launch balancing without data is guesswork, and this game has 24 heroes × 4 difficulties to balance. **Solution.** Add a privacy-respecting local event buffer (no PII, opt-in upload) capturing: run start (hero, difficulty), death (time, cause, level, freed), upgrade picks, session length. Even purely local, surfacing it to the player as "Your Stats" is a retention feature. **Effort:** Medium · **Impact:** Medium · **Priority:** Medium

#### 87. No build version surfaced
**Issue.** `SAVE_VERSION = 2` exists internally; nothing shows a build number to the player. **Why it matters.** Support and bug reports are impossible without it. **Solution.** Show a version string on the title screen and include it in exported saves and the share card. **Effort:** Low · **Impact:** Low · **Priority:** Medium

#### 88. Hero balance has unpriced outliers
**Issue.** Using the game's own `heroPower()` estimator (`game.js:2667`): Chunky fires every 0.18 s for 6 damage (≈33 DPS single-target) while Cliggy fires every 1.3 s for 36 (≈28 DPS but with a 62-radius knockback and 12 px projectile). Gus has 140 HP *and* a 112-radius always-on aura at 178 speed; Fygar has 88 HP at 206 speed. Speed differences (174–206) are only a 18% spread — far too small to feel like a real trade-off. **Solution.** Widen the speed spread to 160–230 so "fast and fragile" vs "slow and armoured" is felt. Retune so every Guardian's `heroPower` lands within ±20% of the mean *at equal investment*, and let identity come from the shape of the damage, not the amount. Publish a balance sheet and re-check after the relic system (#2) lands. **Effort:** Medium · **Impact:** Medium · **Priority:** Medium

#### 89. Weapon evolution is announced in text only
**Issue.** Super Saiyan fires two banners describing the change (`game.js:124-125`) and applies modifiers inside `fireWeapon()`. The weapon does not visually transform. **Why it matters.** The biggest per-Guardian milestone in the game has no visual payoff. **Solution.** Give each archetype an evolved visual: gold-cored projectiles with trails, a second aura ring, orbiting bodies that leave arcs, a wider brighter beam. Add a 1.5 s transformation sequence (time dilation, radial burst, the Guardian's theme hook, a golden aura that persists). **Effort:** Medium · **Impact:** High · **Priority:** High

#### 90. "Saiyan" / "Super Saiyan" is a trademark risk
**Issue.** `TIER_NAMES` (`data.js:168`) uses SAIYAN and SUPER SAIYAN. **Why it matters.** For a commercial release these are strongly associated with an actively-enforced IP. It's also tonally off-brand for an island mythology. **Solution.** Rename to fit the game's own fiction: BASIC → **AWOKEN** → **KEEPER** → **ELDER** → **ASCENDANT** (or island-flavoured: Sprout / Tide / Storm / Ancestor / Sun). Keep the colour progression. **Effort:** Low · **Impact:** Low · **Priority:** High

#### 91. No credits or attribution screen
**Issue.** No credits anywhere. The hero theme MP3s carry Suno.com URLs in their ID3 tags. **Why it matters.** Commercial release requires clear rights documentation for AI-generated and third-party assets. **Solution.** Add a Credits screen; audit and document the licence status of every audio and art asset before launch. **Effort:** Low · **Impact:** Low · **Priority:** High

#### 92. No localisation scaffolding
**Issue.** All strings are inline in `data.js`, `game.js` and `index.html`. **Why it matters.** Mobile browser games get most of their reach outside English-speaking markets; retrofitting i18n after launch is painful. **Solution.** Extract user-facing strings into a single `strings.js` keyed object with an `en` default and a `t(key)` helper. Do it before the content grows further. **Effort:** Medium · **Impact:** Medium · **Priority:** Medium

#### 93. Boss HP bar has no phase markers
**Issue.** `#boss-hp-wrap` is a plain bar; enrage (50%) and frenzy (20%) arrive unannounced on the bar itself. **Solution.** Add tick marks at 50% and 20%, segment the bar, and flash the segment as it's crossed. **Effort:** Low · **Impact:** Low · **Priority:** Medium

#### 94. Hearts expire silently after 25 seconds
**Issue.** `h.t > 25` removes hearts with no warning (`game.js:1021`). **Solution.** Blink for the last 4 seconds and play a soft fade sound so the player can prioritise. **Effort:** Low · **Impact:** Low · **Priority:** Low

#### 95. Runner death-bursts damage the player with no telegraph
**Issue.** `killEnemy()` (`game.js:354-359`) detonates a 62 px burst on runner death, dealing `e.dmg × 1.4` — resolved in the same frame the enemy dies. **Why it matters.** The player is punished for killing an enemy with no window to react. **Solution.** Add a 0.5 s fuse with a visible expanding ring before detonation, so it becomes a positioning test rather than a tax. **Effort:** Low · **Impact:** Medium · **Priority:** High

#### 96. Wardens are a damage sponge, not a puzzle
**Issue.** The `shielded` AI halves all damage from every angle (`game.js:376`) despite the shield arc being drawn facing the player (`game.js:1275-1281`) — the visual promises a flanking mechanic the code doesn't implement. **Why it matters.** The game shows the player a solution ("get behind it") that does nothing. **Solution.** Actually implement it: full damage from behind the arc, 0.35× from the front. This turns wardens into the game's first genuine positioning enemy and makes the existing art meaningful. **Effort:** Low · **Impact:** High · **Priority:** High

#### 97. Spitters are trivially ignorable
**Issue.** Spitters fire one 210 px/s bullet every 1.8–2.6 s from ≤520 px, strafing at 250 px (`game.js:828-838`). At player speed ~195 they're barely a threat. **Solution.** Make them fire a 3-shot leading spread, and give them a "suppression" behaviour where several spitters coordinate to zone an area. Threat should scale with count. **Effort:** Low · **Impact:** Medium · **Priority:** Medium

#### 98. Enemy separation checks only 4 neighbours in one cell
**Issue.** `updateEnemies()` (`game.js:849-863`) checks at most 4 same-cell neighbours. **Why it matters.** At 300 enemies the horde overlaps into a solid mat, which hurts both readability and the sense of a *crowd* with mass. **Solution.** Check the 3×3 cell neighbourhood with a per-frame budget (round-robin across enemies so each is fully resolved every 3 frames), and add a light flow-field push so the horde parts around obstacles. **Effort:** Medium · **Impact:** Medium · **Priority:** Medium

#### 99. No cosmetic layer at all
**Issue.** No skins, palettes, trails, titles or profile customisation. **Why it matters.** Cosmetics are the ethical monetisation and long-tail reward path — pure reward with no power creep, which fits the "addictive without manipulative mechanics" pillar exactly. **Solution.** Add Guardian palette variants (the tint pipeline in `sprites.js:145` already exists — reuse it), powershot colour trails, and earned player titles shown on the share card and records. Award them from achievements and Codex milestones. **Effort:** Medium · **Impact:** Medium · **Priority:** Medium

#### 100. No global leaderboard
**Issue.** Records are `localStorage` only. **Why it matters.** The daily challenge is deterministic and identical for everyone — it is *built* for a shared board and doesn't have one. **Solution.** A minimal serverless endpoint (score + hero + difficulty + a signed run hash) with daily/weekly/all-time boards and friend codes. Keep it optional and anonymous by default. Ship after the core fixes — it amplifies a good game and does nothing for a mediocre one. **Effort:** High · **Impact:** Medium · **Priority:** Low

---
## 6. Immediate Quick Wins

Every item here is **Low effort** and can land in the first sprint. Several are verified defects.

| # | Change | Why it's a win |
|---|---|---|
| 1 | Flip level-up cards face-up | The single highest-value 40 lines in the project |
| 6a | Call `Sound.sfx.hit()` in `damageEnemy()` | The sound already ships; combat is currently silent on impact |
| 17 | Share `effectiveWeapon()` between fire and render | Fixes 4 broken upgrades + 1 evolution in one refactor |
| 18 | Route poison ticks through `damageEnemy()` | Un-breaks Chocker's entire kit |
| 19 | Stop cage auto-targeting during the boss fight | Removes the game's most infuriating failure mode |
| 16 | Make the ground tile seamless (9× draw) | Removes the most visible "prototype" tell in the game |
| 20 | Feedback on an uncharged powershot | Stops one of four verbs from feeling broken |
| 27 | Two-line, auto-shrinking banners | Stops celebration text clipping off-screen |
| 28 | Replace `alert()`/`confirm()` with in-game modals | Removes the loudest "this is a web page" signal |
| 43 | Open at 3.5 enemies/sec, first cage at 200 px | Fixes the empty first 45 seconds |
| 51/52 | Directional shake + `G.timeScale` slow-mo | Enormous felt-quality gain for very little code |
| 55/56 | Quality presets + skip rendering behind overlays | Big battery and low-end-device win |
| 57 | Debounced, dual-slot, checksummed saves | Closes a silent data-loss risk |
| 69 | Expand sub-44 px touch targets | Removes mis-taps that swap your character mid-fight |
| 81/82 | Deploy manifest + binary `.gitattributes` | Removes 110 MB from the deploy and a corruption risk |
| 90 | Rename the "Saiyan" tiers | Removes a commercial IP risk for one string change |
| 95 | Fuse + telegraph on runner death-bursts | Turns an unfair tax into a skill test |
| 96 | Implement warden flanking properly | Makes existing art meaningful; adds the first positioning enemy |

**Estimated total: 5–8 developer-days for all of it.** This block alone moves the overall score from ~57 to ~68.

---

## 7. Medium-Term Improvements

Weeks 2–6. These change how the game *plays*.

1. **The relic/second-weapon system** (#2) — the biggest single addition. Build it before adding any more heroes or enemies.
2. **Rule-changing upgrades** (#10) and **identity signature upgrades** (#71) — populate the draft with things worth reading.
3. **Ally rebalance + Formation command** (#3) — restore player agency to the lategame.
4. **Possession economy: Soul, Soulburn, Resonance** (#9) — make the signature mechanic the deepest system.
5. **Audio re-encode and lazy loading** (#4) + **PWA shell** (#5) — the two changes that make this feel like an app.
6. **Act structure and pacing rework** (#7, #42, #43) — a 6-minute core run with a landmark every 45 seconds.
7. **Elite enemies, chests and the Golden Minyar** (#11, #39) — the surprise/jackpot layer.
8. **Character unlock cascade** (#8) + **Next Goals panel** (#59) — the retention engine.
9. **Hit feedback suite: crits, hit-stop, death animations, particle kinds, projectile rendering** (#6, #48, #49, #50) — the "juice" pass.
10. **Frame-budget reclamation** (#15) — pre-baked status sprites, batched draws, deferred strip rebuild.
11. **Enemy hitbox alignment** (#13) — foundational for everything above feeling good.
12. **Cage stakes: guards, sieges, cursed cages** (#14) — put tension on the best structural idea.
13. **Adaptive music and the mix hierarchy** (#34, #68) — cheap perceived-quality multiplier.
14. **Build inspection UI** (#36) and **roster rework** (#54).
15. **Daily streaks, objectives and weekly challenges** (#26).

---

## 8. Long-Term Features

Months 2–6. Build these only after the medium-term block ships and holds.

1. **Second boss + boss modifiers** (#12, #33) — the Reef Mother and the Glob mechanic rework.
2. **Endless mutator drafts** (#24) — the long-tail replay engine.
3. **Difficulty-tier mechanics** (#23) — make the ladder a skill curriculum.
4. **Biome mechanics** (#74) — jungle line-of-sight, sea tides, sky wind.
5. **Second Shrine tier** (#25) — a 100-run meta horizon.
6. **Seeded runs and seed sharing** (#63) + **narrative share cards** (#60).
7. **Prestige mode** — unlocked by Full Codex; resets meta perks for a permanent score multiplier and a new draft pool. This is the answer to "what do I do at hour 100."
8. **Cosmetics layer** (#99) — palettes, trails, titles; the ethical long-tail reward.
9. **Global/daily leaderboards** (#100) — after, not before, the game is worth competing at.
10. **Localisation** (#92) and **telemetry-driven balance** (#86).
11. **A co-op or async "ghost" mode** — an ally-shaped ghost of a friend's best run fights alongside you. High effort, but it is the most natural multiplayer fit for a game literally about a squad of allies, and it would be a genuine differentiator in the genre.

---

## 9. Systems That Should Be Redesigned

| System | Verdict | Redesign |
|---|---|---|
| **Level-up draft** | Fundamentally broken as a decision | Face-up cards, build strip in context, 4th card via Shrine, opt-in wildcard (#1, #36) |
| **Upgrade pool** | Pure scalars; no design space | 9 scalars + 6 rule-changers + relics + 4-level relic upgrades (#2, #10) |
| **Ally system** | Removes agency, costs frames | Sub-linear falloff, 6 active firers, Formation command (#3) |
| **Possession** | Great verb, no economy | Soul cost, Soulburn window, Resonance stacking (#9) |
| **Difficulty ladder** | Multipliers only | One new mechanic per tier (#23) |
| **Endless mode** | Multipliers only | Drafted mutators every round (#24) |
| **Shell Shrine** | Finishes in ~26 runs, all flat stats | Keep tier 1; add a tier 2 of possibility-unlocks (#25) |
| **Score formula** | Rewards idling | Combo multiplier, no-hit bonus, mastery bonus, time ×1 (#31) |
| **Enemy collision** | Foot-anchored under 2–4× taller sprites | Body-centre `e.cy` + width-derived radius (#13) |
| **Face-card strip** | Occupies both thumb zones | 4-card ribbon + radial long-press fan (#44) |
| **Audio delivery** | 100 MB, eagerly fetched | Opus, preview hooks, WebAudio buffers, lazy (#4) |
| **Minimap** | Unreadable at world scale | Local radar with rim chevrons (#40) |
| **Save system** | Sync writes, no integrity guard | Debounced dual-slot with checksum (#57) |

---

## 10. Systems That Should Be Removed

Genuinely short — the game has very little fat, which is a credit to it.

1. **The face-down card mechanic itself** — not the cards, the concealment (#1). Remove it as a default; keep it as an opt-in wildcard.
2. **The always-visible 24-card face strip** — replaced by a 4-card ribbon (#44). Keep the full roster in the pause screen.
3. **`assets/3d` (50 MB) and `assets/art` (60 MB) from the runtime deploy** (#81) — move to a source repo. Don't delete; they're valuable production sources.
4. **`Sprites.get('ground')` legacy alias, `banner ? null : null`, and other dead code** (#84).
5. **`alert()` / `confirm()`** (#28).
6. **Raw survival-time score weighting** (#31) — reduce from ×4 to ×1 rather than removing entirely.
7. **The 150-second endless boss gap as dead time** (#42) — compress and fill, don't delete.

Nothing else. Notably, do **not** remove: the cage system, possession, mastery-from-damage, convergent endless scaling, the biome system, or the share card. All are good ideas that need development, not deletion.

---

## 11. Missing Features

Ordered by what a player would notice first.

- **Critical hits** — no crit system exists anywhere in the codebase.
- **Weapon acquisition** — the genre's defining mechanic is absent (#2).
- **Elite enemies, minibosses, rare spawns, chests** (#11, #12, #39).
- **Character unlocks** (#8) — 24 characters, zero gated.
- **A second boss** (#12).
- **Defensive build options** — no lifesteal, shields, damage reduction or on-kill sustain (#38).
- **Build inspection** — you cannot see what you've taken (#36).
- **A combo/multiplier system** — no moment-to-moment score feedback (#31).
- **PWA install, offline play, iOS fullscreen** (#5).
- **Quality settings, frame cap, battery mode** (#55, #56).
- **Control layout options** (#21) — left-handed players are excluded.
- **Contextual onboarding** (#29).
- **Cause of death** (#30).
- **Next-goal visibility** (#59).
- **Daily streaks and objectives; weekly content** (#26).
- **Cosmetics** (#99).
- **Seeded runs outside the daily** (#63).
- **Global leaderboards** (#100).
- **Ambient audio** (#70), **adaptive music** (#34), **audio ducking** (#68).
- **Credits and asset licensing documentation** (#91).
- **Localisation scaffolding** (#92).
- **Crash recovery** (#85) and **telemetry** (#86).

---

## 12. Balance Improvements

**Immediate corrections**
- **Poison must credit its source** (#18) — Chocker is currently structurally broken.
- **Warden armour should be directional** (#96) — currently 0.55× from all angles despite a front-facing shield arc.
- **Runner death-bursts need a fuse** (#95) — currently unavoidable damage.
- **Ally damage must scale sub-linearly** (#3) — `count^0.62` instead of linear.

**Curve corrections**
- **XP curve:** flatten early (`xpNext` start 16, exponent 1.30) so levels 1–5 arrive at ~15 s intervals rather than six modals in 40 s (#37).
- **Hero speed spread:** widen from 174–206 (18%) to 160–230 (44%) so mobility is a real trade-off (#88).
- **Enemy time-scaling:** `timeMult = 1 + (time/60)·0.18` reaches 2.44× at 8:00 and compounds with tier (up to 10.5×), difficulty (up to 3.1×) and round (up to ~4×) — a theoretical 320× ceiling. Recheck the compound curve after the act restructure (#7) shortens runs; it likely needs the tier multiplier softened at the top end.
- **Boss HP:** `BOSS.hp = 48000` × up to 4.0 difficulty × up to ~5 round = 960k. Against a 24-ally squad this is a ~90-second fight; against a solo run on Cataclysm it may be mathematically unwinnable. Balance the boss against a *median* squad size, not a maximal one, once #3 lands.
- **Shell economy:** `SHELLS_PER_SCORE = 500` with a 2,605-shell total cost = ~26 runs to max. Correct for tier 1; add tier 2 at 400–1,200 each for a 100-run horizon (#25).
- **`GEM_CAP = 400`** is a good fix for the mega-gem bug — keep it, but surface capped gems visually so players understand why a huge gem gave less than expected.

**Structural balance**
- **Difficulty tiers need mechanics** (#23), not just `ehp`/`edmg`.
- **The generic upgrade pool is too small** — 15 entries minus `once` items means the pool is nearly exhausted by level 15, after which the draft repeats. The relic system (#2) and rule-changers (#10) should roughly triple it.
- **`heroPower()` should become a real balance tool** — extend it to account for pierce, area, knockback and DoT, then use it as an automated regression check that no Guardian sits outside ±20% of the mean.

---

## 13. Combat Improvements

The single biggest gap: **combat currently has no input during combat.** Everything below is in service of changing that.

1. **Hit confirmation** (#6): hit sound, crits, hit-stop, aggregated damage numbers, kill flash. *This is the foundation — do it first.*
2. **Hitbox truth** (#13): body-centred collision so shots land where they look like they land.
3. **Give the player something to do**: the powershot is the only active ability and it's on a ~40-second cycle. Add a **second, short-cooldown ability** per Guardian — a 6-second dash/dodge with brief invulnerability, universal across the roster, mapped to a double-tap on the movement side. This single addition creates continuous skill expression, enables dodge-based counterplay against telegraphs, and makes positioning an *active* verb rather than a passive one. **This is arguably the most important gameplay addition in the entire document after the draft fix.**
4. **Enemy pressure variety** (#96, #97): flanking wardens, coordinated spitters, telegraphed elite charges.
5. **Crowd management tools**: knockback currently exists (`m.knockMul`) but only 3 weapons use it. Every archetype should have a crowd-control expression — a pull, a push, a slow, a stun.
6. **Directional trauma and slow-motion** (#51, #52) so impacts have weight and drama.
7. **Boss encounters that teach counterplay** (#33).
8. **Combo multiplier** (#31) so aggression is rewarded moment-to-moment.

---

## 14. Weapon Improvements

**Per-archetype assessment**

| Archetype | Heroes | Verdict | Action |
|---|---|---|---|
| `shot` | 11 of 24 | **Over-represented.** Half the roster fires a projectile at the nearest enemy. Flags (homing/boomerang/split/explode/poison/slow) differentiate them mechanically but not *visually*. | Give each flag a distinct projectile renderer (#48). Convert 2–3 shot heroes to new archetypes. |
| `nova` | Sixter, Snapper, Waterwolf | Good — reads clearly, feels powerful | Add a charge-up telegraph so the burst is anticipated |
| `orbit` | Skyjumper, Yelp | Excellent — best-feeling archetype in the game | **Fix the invisible-upgrade bug (#17).** Add orbit trails. |
| `aura` | Gus only | Underused and its ring lies about its size (#17) | Fix the visual; add a second aura hero; make aura pulse rather than tick silently |
| `chain` | Zappo only | Great fantasy, thin execution — one polyline for 0.18 s | Add branch forks, arc-flash at each node, a satisfying crackle, and let jumps ricochet back |
| `beam` | Creeper only | Best-in-class concept; visually the weakest (two stroked lines) | Additive glow, a charge tell, scorch decals, a sustained variant |
| `trail` | Flick only | Strong idea, invisible payoff (35% alpha circles) | Animated fire with heat shimmer; `fire_crackle.mp3` already ships unused (#83) |
| `slash` | Chomper, Stinger | Good weight, needs a proper swing arc sprite | Motion-blurred arc, edge spark on contact |

**New weapons worth adding** (as relics, per #2, so they don't disturb hero balance):
- **Tide Totem** — a deployable that pulses an expanding damaging ring; rewards standing ground.
- **Coconut Mine** — drops proximity charges behind you; rewards kiting.
- **Ancestor Mask** — resurrects the last-freed Guardian as a ghost mirroring your attacks at 50%; ties into the possession fantasy.
- **Reef Spire** — a stationary turret that inherits your current Guardian's weapon; changes when you possess.
- **Sunbeam** — a slow rotating laser sweep; forces the player to think about angles.
- **Undertow Net** — a cone that pulls and slows; the game's first real crowd-control tool.

**Cross-cutting weapon work:** per-archetype audio (#46), per-archetype projectile art (#48), visible evolution transforms (#89), and the shared `effectiveWeapon()` refactor (#17) so upgrades are always visible.

---

## 15. Enemy Improvements

**Current roster assessment**

| Enemy | Purpose | Verdict |
|---|---|---|
| Minyar | Trash / XP economy | Works. The 6-tier colour system is a genuinely good scaling idea. |
| Spitter | Ranged pressure | **Fails.** Too slow, too rare, and its projectiles are invisible (#22, #97). |
| Runner | Positioning tax | **Fails as designed.** No fuse on the death burst = unavoidable damage (#95). |
| Warden | Flanking puzzle | **Fails.** Armour is omnidirectional despite a directional shield visual (#96). |
| Demonder | Mid-tier bruiser | Works, but indistinguishable from a big minyar in behaviour. |
| Clubbo | Rare heavy | Works — the rarity + heart drop makes it a genuine event. Best-tuned enemy in the game. |
| King Glob | Boss | Stat check, not encounter (#33). |

**Every enemy should have a clear gameplay purpose.** Currently three of six don't deliver theirs. Fix those three (#95, #96, #97) before adding any new types.

**Then add:**
- **Elites with affixes** (#11) — the highest-value enemy work in the document.
- **Golden Minyar** — a fleeing treasure enemy; the game's best "chase it!" moment.
- **Burrower** — emerges under the player after a telegraph; punishes standing still, which nothing currently does.
- **Siren** — buffs and heals nearby enemies; the game's first *priority target*, teaching threat assessment.
- **Bulwark** — a slow wall-former that segments space and forces route decisions.
- **Miniboss** at the mid-run landmark (#12).

**Behaviour work:** better separation so the horde reads as a crowd with mass (#98), spawn telegraphs for heavy units (#53), and death animations so kills punctuate (#50).

---

## 16. Character Improvements

The roster's *personality* is already excellent — the writing in `data.js` is genuinely charming and the art is strong. The gaps are mechanical.

1. **Unlock them** (#8) — 24 free characters is the most valuable unused retention asset in the project.
2. **One identity signature upgrade each** (#71) — replace half the `{dmg:1.4}` entries with behaviour changes.
3. **Widen the stat spread** (#88) — an 18% speed range across 24 characters means nobody feels fast or slow.
4. **Give each Guardian a passive trait**, not just a weapon: Fygar moves 15% faster after a kill; Gus takes 10% less damage while an enemy is in his aura; Diver takes no damage during the first 0.3 s after a possession swap; Bo's allies within 100 px gain +10% damage. Small, always-on identity beats.
5. **Play their themes in-game** (#47) — 54 MB of character music currently heard for 8 seconds per session.
6. **Show signature upgrades on the select screen** (#61) so the choice previews a playstyle.
7. **Per-hero lifetime stats and titles** — "You've played 47 runs as Zappo. Best score 184,320." Deepens attachment.
8. **Mastery should unlock something visible** — a palette variant at Elder, a cosmetic trail at Ascendant (#99). Right now Super Saiyan grants a stat evolution announced in text.
9. **Rename the tier ladder** (#90).

---

## 17. Progression Improvements

Balitopia has **five** progression systems — run level, hero mastery, difficulty ladder, Shell Shrine, Codex/achievements — and none of them gates content. That's a lot of machinery producing very little pull.

**Restructure into three clear loops:**

**Loop 1 — Within the run (seconds to minutes).** Level → draft → build. *Fix:* face-up cards (#1), relics (#2), rule-changers (#10), build UI (#36), flatter early curve (#37).

**Loop 2 — Across runs (hours).** Unlock characters and relics. *Fix:* the unlock cascade (#8) with visible next-goal progress (#59). This is the loop the game is completely missing and it is the most important one for Day-2 through Day-30.

**Loop 3 — The long horizon (tens of hours).** Codex mastery, difficulty ladder, Shrine tier 2, Prestige. *Fix:* attach real rewards to achievements and Codex (#58), add Shrine tier 2 (#25), add Prestige.

**Eliminate the grind that exists:** the Codex's "master all 24 to Super Saiyan" requires 45,000 damage per Guardian across separate runs with no in-run way to steer mastery. Add a **Focus** option — mark a Guardian at run start and they gain +25% mastery XP — so the goal is pursuable rather than incidental.

---

## 18. Reward Improvements

**The current reward curve is flat.** Gems give +1 XP. Levels give a random multiplier. Cage breaks give an ally and 25% healing. That's the whole variable-reward architecture, and none of it produces a spike.

1. **Chests with a slot-machine reveal** (#39) — the genre's signature dopamine moment, entirely absent here.
2. **Critical hits** (#6) — moment-to-moment micro-rewards, 30× per minute.
3. **Combo multiplier** (#31) — continuous positive feedback for aggression, visible in the HUD.
4. **Golden Minyar chase** (#11) — a rare, high-arousal event.
5. **Achievement and Codex payouts** (#58) — currently zero.
6. **Daily streak escalation** (#26).
7. **Celebrate the cage break properly** — it's the game's signature moment and currently gets particles, a banner and a stinger. Add: a brief time dilation, the Guardian's portrait bursting from the cage, their theme hook, a screen-wide light sweep, and a haptic pulse.
8. **Escalate the Super Saiyan moment** (#89) — the biggest per-Guardian milestone deserves a 1.5-second sequence, not two lines of text.
9. **Level-up should feel like a reward, not an interruption** — currently it's a modal that stops the game. Non-blocking early levels (#37) plus a satisfying chord and a portrait flourish would change its emotional register entirely.

---

## 19. Economy Improvements

**Current state:** one currency (shells, 1 per 500 score), one sink (7 flat perks, 2,605 shells total, ~26 runs to exhaust). No secondary currency, no in-run economy, no choices with opportunity cost.

**Recommendations**

1. **Add an in-run economy.** Gold dropped by elites and chests, spent at a **Trader** who appears once per run offering three items: a relic, a heal + upgrade, or a reroll bundle. Opportunity cost inside a run is where roguelite economies get interesting, and Balitopia has none.
2. **Extend the shell sink** (#25) — tier 2 at 400–1,200 shells takes the horizon from 26 runs to ~100.
3. **Add a prestige currency** (Ancestor Tokens) earned only from Codex mastery and Cataclysm wins, spending on the deepest unlocks. Gives the top 5% of players something to chase.
4. **Rebalance shell earn rate against the new score formula** (#31) — the combo multiplier will inflate scores; re-derive `SHELLS_PER_SCORE` so the earn curve is unchanged.
5. **Never sell power for money.** If this monetises, sell cosmetics and character bundles only (#99). The brief's "addictive without relying on manipulative mechanics" pillar is a genuine competitive advantage in this genre — VS's premium-with-DLC model is the right template, not a gacha.
6. **Make Shrine purchases feel like decisions** — currently every perk is strictly good and you buy them in cost order. Add mutually exclusive branches (e.g. *Sturdy Shell* OR *Fleet Footed* at max rank, not both) so the meta build is a build.

---

## 20. UI & UX Improvements

**Screen-by-screen**

**Title** — Genuinely strong. The gradient logo, neon menu buttons and VS key art are commercial quality. *Add:* next-goal progress, daily streak status, version string, an install/A2HS prompt on iOS after the first run.

**Story** — Well composed (filigree corners, drop cap, threat cards, mask-gradient scroll). *Issue:* five paragraphs of text before the player has touched the game. *Fix:* make it skippable by default after the first view, and consider showing it *after* the first run instead — the story lands harder when you know who King Glob is.

**Hero Select** — The best screen in the game visually, but functionally thin (#61, #62). *Fix:* filters, sorting, favourites, signature-upgrade preview, lifetime stats, and promote difficulty to its own step.

**HUD** — Clean and well-organised; the safe-area padding (`style.css:452`) is correctly done. *Issues:* the face-card strip occupies both thumb zones (#44); the minimap is unreadable (#40); banners clip (#27); there's no combo display, no Soul pips, no ability cooldown. *Fix:* 4-card ribbon, radar minimap, two-line banners, and a bottom-right powershot button with a radial fill.

**Level-up** — Beautiful cards, broken information design (#1). *Fix:* face-up, plus a build strip for context and a 4th card option.

**Roster/Pause** — Functional but information-free (#54, #76). *Fix:* a true pause overlay with Build / Roster / Settings tabs.

**Settings** — Good accessibility coverage, missing the mobile-critical options (#55). *Fix:* quality, frame cap, control layout, shake intensity, damage numbers.

**Shell Shrine** — Clean layout. Needs tier 2 and mutually exclusive branches (#25, #19).

**Death/Stats** — Genuinely excellent; the per-Guardian damage table is a standout. *Fix:* add cause of death (#30), next goals (#59), and a narrative share card (#60).

**Records** — Good structure. *Fix:* per-hero/per-difficulty tabs (#64), Codex completion rewards (#58).

**Cross-cutting**
- Replace `alert()`/`confirm()` (#28).
- Expand sub-44 px touch targets (#69).
- Extend UI scaling to all screens (#66).
- Add screen-transition polish — currently screens hard-swap via `classList.toggle('hidden')` (`game.js:2543`) with only a whoosh sound. A 180 ms cross-fade would cost nothing and read as much more expensive.
- Add a real loading screen — `Sprites.init()` awaits ~50 images while the title sits interactive but with unrendered portraits.

---

## 21. Visual Improvements

**Art direction verdict:** the *character* art is commercial-grade. The *world* and *effects* art is prototype-grade. That contrast is currently the game's biggest visual problem — the beautiful heroes make the plain ground look worse.

1. **Seamless, layered, denser world** (#16, #72, #73) — the highest-impact visual change in the document. Fix the tile seams, build a real coastline, and raise decor density from 150 to ~900 clustered props.
2. **Projectile and particle systems** (#48, #49) — every weapon currently looks like a coloured dot; every effect looks like square confetti.
3. **Death animations and impact language** (#50) — kills need punctuation.
4. **Lighting.** There is none. Add a cheap composited light layer: an additive radial glow under the player, per-projectile glows for energy weapons, a warm rim on the boss, and a subtle vignette. On canvas this is one `globalCompositeOperation = 'lighter'` pass on a half-res offscreen buffer — cheap, and it would transform the game's look.
5. **Colour discipline.** Establish and enforce a threat law (#22): player/allies = warm gold-cyan; enemies = tier-hued but always desaturated relative to VFX; anything that damages the player = magenta/white-hot; anything that rewards = gold. Right now enemy bullets, ground and foliage share a hue family.
6. **Depth.** Everything renders in one plane. Add a parallax canopy layer above the action at low opacity and a distant horizon band; sort draws by `y` for proper overlap (currently enemies draw in pool order, so a far enemy can occlude a near one).
7. **Boss presence.** King Glob is a static sprite with a squash oscillation. He should have: a distortion aura, ground scorch beneath him, screen-edge darkening while he's alive, and a proper arrival cinematic.
8. **Evolution visuals** (#89).
9. **Biome identity beyond palette** (#74) — sky needs clouds below, sea needs surf and caustics, jungle needs canopy shadow.

---

## 22. Audio Improvements

The *asset library* is a strength — 24 hero themes, region tracks, a full boss voice set, entrance stingers. The *implementation* is the weakness.

1. **Delivery** (#4) — the single most important audio task. Opus re-encode, 12-second preview hooks, WebAudio buffers, lazy loading. 100 MB → under 8 MB.
2. **Wire the hit sound** (#6) — `hit.mp3` ships and is never played.
3. **Per-archetype weapon audio** (#46) — one sound for 24 weapons is the biggest felt audio gap after #2.
4. **Adaptive music** (#34) — crossfades, intensity layers, ducking under cues.
5. **Play the hero themes in-game** (#47).
6. **Mix hierarchy and ducking** (#68) — a cue bus above SFX so important information cuts through.
7. **Ambient beds** (#70).
8. **Fix the semantic errors** — `bigKill()` on player damage (#80), retrigger cut-offs (#79).
9. **Add the missing UI sounds** — many interactions (difficulty chip, shop purchase confirm, achievement unlock, cage-break celebration, chest open) have no dedicated cue.
10. **Boss audio arc** — Glob has entrance, laugh, enrage and defeat samples. Add a phase-3 layer and a distinct "he's about to slam" cue that's audible over the mix.
11. **Haptics as an audio partner** — `buzz()` is currently used at 7 call sites with arbitrary durations. Design a haptic vocabulary: 8 ms tick on crit, 15 ms on level-up, 25 ms on hurt, 60 ms pattern on powershot, and a double-pulse on cage break.

---

## 23. Performance Optimisations

**Measured baseline** (desktop-class CPU, headless Chromium, 844×390 @ DPR 2 — a *best case* relative to a mid-range phone):

| Scenario | FPS | Median frame | p95 frame |
|---|---|---|---|
| Early run (8 enemies) | 60.2 | 16.7 ms | 17.0 ms |
| 150 enemies | 59.7 | 16.7 ms | 18.4 ms |
| 300 enemies | **53.7** | 18.1 ms | 21.9 ms |
| 300 enemies + 23 allies | 54.1 | 18.3 ms | 20.4 ms |
| Breaking all 23 cages | — | — | **48.5 ms hitch** |

Boot: 1,012 ms to ready, 62 requests, 1.3 MB. Save size: 317 bytes.

**Interpretation.** 53.7 fps on hardware roughly 3–5× faster than a Snapdragon 6-series implies **~20–30 fps at peak horde on the target device.** This fails the "smooth on mid-range" requirement. The good news: the architecture (pooled entities, generation-stamped spatial hash, HUD write caching, portrait caching) is sound — the cost is in the render loop, not the simulation.

**Optimisations, ranked**

1. **Pre-bake status-effect overlays into sprite variants** (#15a) — removes up to 6 `beginPath`/`fill` pairs per affected enemy per frame. Biggest single win.
2. **Cap status VFX to the nearest ~40 enemies** — off-screen and distant enemies don't need frost spikes.
3. **Batch by state**: sort the enemy loop by sprite key; draw all shadows in one pass; draw all HP bars and pips in one `fillStyle` block. Canvas state changes are the dominant cost in this loop.
4. **Defer `rebuildStrip()`** to a coalescing rAF flag (#15f) — fixes the 48.5 ms cage hitch.
5. **Skip rendering entirely behind full-screen overlays** (#56) — currently the game renders at 60 fps behind an opaque level-up modal.
6. **Half-resolution effects buffer** — render particles, glows and the light layer to an offscreen canvas at 0.5× and composite up. Roughly quarters their fill cost.
7. **Quality presets with auto-detection** (#55) — measure the first 300 frames and drop to Balanced automatically.
8. **DPR cap is already correct** (`Math.min(2, dpr)`, `game.js:24`) — good. Consider 1.5 on the Battery preset.
9. **Avoid per-frame array iteration over dead pool slots** — `updatePickups` walks all 500 gem slots and `render` walks all 400 projectile slots every frame regardless of occupancy. Maintain an active-count high-water mark.
10. **`nearestTarget()` is called per projectile per frame for homing** (`game.js:723`) — throttle homing retargeting to every 3rd frame; it's imperceptible and cuts a hash query per homing projectile.
11. **Cache `moveVector()`** — it's called inside `fireWeapon()` for every weapon of every fighter every frame (`game.js:595`). Compute once per frame into `G.moveVec`.
12. **Halt the rAF loop when hidden** (#77) — significant battery.

---

## 24. Mobile Experience Improvements

This is the pillar with the largest gap between the brief's requirements and the current build.

| Requirement | Status | Fix |
|---|---|---|
| Feels like a native app | ❌ Browser dialogs, no install, no offline | #5, #28 |
| Launches quickly | ⚠️ 1.0 s to ready, 1.3 MB — good, but no caching | #5 (service worker) |
| Always responsive | ⚠️ 53 fps at peak on fast hardware | #15, #55, #56 |
| Fullscreen where possible | ❌ **Impossible on iPhone without a manifest** | #5 |
| Android + iPhone | ⚠️ Works, but iOS gets a materially worse experience | #5 |
| Modern aspect ratios | ⚠️ Wide phones see 30% more world | #32 |
| Safe areas / cutouts | ✅ **Correctly implemented** — `viewport-fit=cover` plus `env(safe-area-inset-*)` on HUD, screens and back buttons | — |
| Scales across sizes | ✅ Good — `clamp()` throughout plus a dedicated short-landscape media query | — |
| Smooth on mid-range | ❌ Projected ~20–30 fps at peak | #15, #55 |
| Battery optimised | ❌ Renders at 60 fps behind menus and while paused | #56, #77 |
| Recovers from interruptions | ⚠️ Audio context resumes; music, loop and saves don't | #77 |
| Saves reliably | ⚠️ Sync writes, no integrity guard, silent failures | #57 |

**Additional mobile work**
- **Control layout options** (#21) — left-handed exclusion is the most serious usability gap.
- **Thumb-zone reclamation** (#44) — the bottom third is currently unusable.
- **A2HS coaching on iOS** after the first completed run (#5).
- **Network resilience** — the game currently assumes every asset fetch succeeds. Add graceful degradation (the sprite fallbacks already do this well; audio should too).
- **Test matrix before launch:** iPhone SE (667×375 — the tightest landscape), iPhone 15 Pro (Dynamic Island cutout), a 20:9 Android mid-ranger, a foldable, and an iPad. The short-landscape media query at `max-height:520px` is a good start but SE-class devices need explicit verification.

---

## 25. Accessibility Improvements

Balitopia starts from an unusually good place — colorblind pips, reduced motion, UI scaling and haptics toggles are all present. The work is completing the coverage.

1. **Complete colorblind support** (#65) — "colour = danger" is the game's *primary* information channel; tier pips alone don't cover mastery borders, gems, difficulty chips or the friend/foe distinction. Add per-deficiency palettes and shape/numeral redundancy everywhere.
2. **Complete reduced-motion coverage** (#67) — currently five CSS animations and softened shake; particles, card flips, camera moves, flashes and hit-stop are unaffected.
3. **Extend text scaling to every screen** (#66) — it currently covers 7 elements.
4. **Control options** (#21) — handedness, stick type, size, dead zone.
5. **Touch target minimums** (#69).
6. **Add a difficulty-independent assist mode** — separate from the difficulty ladder (which is a *score* system): optional damage reduction, slower enemies, extra revives, and an aim assist. Gate leaderboards for assisted runs but never gate *content*. This is standard practice now and it materially widens the audience.
7. **Add audio accessibility** — a visual indicator for the powershot-ready cue and the boss slam warning, so critical audio information has a visual channel. Subtitle the boss's vocal cues.
8. **Add a photosensitivity option** — the powershot sets a full-screen white flash at 0.4 alpha (`game.js:1767`) and the hurt vignette pulses; both should be reducible independently of the motion setting.
9. **Verify contrast** — several UI colours (`#9fd6c9` on dark, 8 px labels at `#80cbc4`) are likely below WCAG AA at their smallest sizes.
10. **Add a one-handed / simplified mode** — auto-move toward gems with manual override, for players with limited dexterity.

---

## 26. Replayability Improvements

**Current replay drivers:** difficulty ladder (4), hero variety (24, all unlocked), score chasing, Codex (24 mastery slots), achievements (10), endless rounds, daily challenge, 3 biomes.

**Why it doesn't add up to replayability:** all eight are *content* axes, none is a *decision* axis. Twenty-four heroes with one fixed weapon and a scalar-only draft produce twenty-four variations of the same run. Replayability comes from combinatorial decision space, not from a bigger catalogue.

**The multipliers, in order:**
1. **Relics** (#2) — turns 24 runs into ~24 × 120.
2. **Rule-changing upgrades** (#10) and **identity signatures** (#71) — makes the draft worth reading.
3. **Endless mutator drafts** (#24) — every round becomes a different game.
4. **Elites, chests, Golden Minyar** (#11, #39) — run-to-run surprise.
5. **Cage sieges and cursed cages** (#14) — risk/reward moments.
6. **Difficulty mechanics** (#23) and **biome mechanics** (#74) — the existing axes start actually varying play.
7. **Character unlocks** (#8) — paces the content so it lasts.
8. **Seeded runs** (#63) — competitive and social replay.
9. **Weekly challenges** (#26) and **Prestige** (#8 long-term) — the outer loop.
10. **Secrets** — the game has none. Add a handful: a hidden cage that always contains a rare relic, an easter-egg boss on a specific seed, a Guardian unlocked by an obscure condition. Secrets are the single most-shared content type in this genre.

---

## 27. Player Retention Improvements

| Window | Current state | Fix |
|---|---|---|
| **First 60 seconds** | Empty field, 1.4 enemies/sec, no pressure | #43 — open at 3.5/sec, cage at 200 px, scripted opening beat |
| **First session** | Story wall, then a 9-minute run, six level-up modals in 40 s | #7 (6-min acts), #37 (curve), #29 (contextual coaching) |
| **First hour** | ~6 runs; sees most content; nothing unlocks | #8 — unlock cascade with 3 visible next goals |
| **Day 1 return** | Nothing pulls | #59 next goals on the death screen, #26 daily streak |
| **Day 7** | Difficulty ladder + Codex grind | #23 tier mechanics, #58 achievement rewards, #26 weekly challenge |
| **Day 30** | Shrine exhausted (~26 runs), Codex grind remains | #25 Shrine tier 2, Prestige, #99 cosmetics, #100 leaderboards |
| **Long term** | Endless round count | #24 mutators, #12 second boss, secrets |

**Ethical retention principles to hold to** (and they *are* a competitive advantage):
- No energy systems, no timers, no ads interrupting play, no pay-for-power.
- Daily rewards should be *bonuses for playing*, never *penalties for not playing* — no streak-loss anxiety; let streaks bank a grace day.
- Progress must always be visible and always be earned by playing well, not by playing long.
- The share card should celebrate the player, not nag them.

**The single highest-leverage retention change:** the **Next Goals panel on the death screen** (#59). At the exact moment a player decides whether to press Play Again, show them three specific things they are close to. It is roughly 40 lines of code and it is worth more than any content addition in this document.

---

## 28. Browser-Specific Improvements

1. **PWA shell** (#5) — manifest, service worker, maskable icons, `apple-touch-icon`. Without it there is no fullscreen on iPhone, period.
2. **iOS Safari specifics:**
   - `requestFullscreen` is a no-op on iPhone — the A2HS path is the only option.
   - `screen.orientation.lock` is unsupported — the rotate overlay is the correct fallback and is already implemented well.
   - Audio requires a user gesture to start; `Sound.ensure()` is correctly called from button handlers. Verify after A2HS launch, where the gesture context differs.
   - `visualViewport` changes as the URL bar collapses — handle it (#35).
   - WebAudio suspends on lock; the `visibilitychange` resume at `audio.js:116` is correct and important.
3. **Android Chrome:** `screen.orientation.lock('landscape')` works but **only in fullscreen** — call it *after* the fullscreen promise resolves, not in parallel as `enterApp()` currently does (`game.js:2532-2536`).
4. **Storage:** `localStorage` can be evicted under pressure and is unavailable in some private modes. Detect failure explicitly, warn the player, and offer export (#57). Consider IndexedDB as the primary store with localStorage as a mirror.
5. **Codec strategy:** ship Opus with an AAC/MP4 fallback (Safari's Opus-in-MP4 support is recent). Feature-detect via `canPlayType`.
6. **Memory:** iOS Safari terminates tabs aggressively over ~200 MB. Decoded audio buffers are the main risk after #4 — keep decoded hero themes to a small LRU of 3.
7. **Wake lock:** request `navigator.wakeLock` during runs so the screen doesn't dim mid-boss. Release on pause.
8. **`pagehide` / `freeze` events** — flush saves on both; iOS uses `pagehide`, not `beforeunload`.
9. **Serve with correct caching headers** — long `max-age` + content hashing for assets, short for `index.html`.
10. **Test in-app browsers** — a large share of mobile traffic arrives via Instagram/Facebook/TikTok webviews, which have restricted APIs (no fullscreen, sometimes no localStorage). Detect and degrade gracefully with a "open in browser" prompt.

---

## 29. Technical Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Silent save loss** — sync writes, no checksum, swallowed exceptions, localStorage eviction | 🔴 Critical | #57: debounced dual-slot writes with checksums, IndexedDB primary, visible failure warning, export prompt |
| **Performance on target hardware** — projected 20–30 fps at peak on mid-range Android | 🔴 Critical | #15, #55, #56: pre-baked overlays, batching, quality presets with auto-detection |
| **Audio payload** — 100 MB, eagerly fetched on interaction | 🔴 Critical | #4: Opus, preview hooks, lazy loading, WebAudio buffers |
| **No iOS fullscreen path** | 🔴 Critical | #5: PWA manifest + A2HS coaching |
| **Crash = hard lock** — an exception in `frame()` permanently kills the rAF chain | 🟠 High | #85: try/catch with recovery and a friendly modal |
| **Single 2,758-line `game.js`** — no modules, no tests, no build step | 🟠 High | Split into ES modules (input / sim / render / ui / audio / save) with a light bundler. Add unit tests for damage math, save migration, score computation and the `conv()` scaling. The `window.__balitopia` debug handle is already an excellent test surface — build on it. |
| **No automated testing at all** | 🟠 High | Start with the pure functions (`computeScore`, `conv`, `heroPower`, `loadSave` migration) and a Playwright smoke test that boots, plays 60 s and asserts no errors. Cheap, high value. |
| **AI-generated audio licensing** — hero themes carry Suno URLs in ID3 | 🟠 High | #91: audit and document commercial rights for every asset before launch |
| **"Saiyan" trademark exposure** | 🟠 High | #90: rename |
| **`.gitattributes` `text=auto` over binaries** | 🟡 Medium | #82: explicit binary rules |
| **110 MB of unused assets in the deploy path** | 🟡 Medium | #81: deploy manifest |
| **No error reporting or telemetry** — post-launch issues are invisible | 🟡 Medium | #86: opt-in local buffer, optional upload |
| **Balance is untestable at scale** — 24 heroes × 4 difficulties × future relics | 🟡 Medium | Build a headless simulation harness on `window.__balitopia` that runs 1,000 automated runs and reports win rates per hero/difficulty. This is very achievable given the existing debug surface. |
| **No version pinning between save format and build** | 🟡 Medium | `SAVE_VERSION` exists and migration is handled — extend it as the schema grows, and always write forward-compatible defaults |

---

## 30. Launch Readiness Assessment

**Verdict: NOT READY. Approximately 6–10 weeks from a confident commercial launch.**

### Blocking (must fix before any public launch)
1. Audio payload — 100 MB is not shippable (#4)
2. PWA shell — no install, no offline, no iOS fullscreen (#5)
3. Save integrity — silent data-loss risk (#57)
4. Performance on mid-range devices (#15, #55, #56)
5. The four verified gameplay bugs: dead hit SFX (#6a), invisible orbit/aura upgrades (#17), poison not crediting mastery (#18), cage targeting during boss (#19)
6. Enemy hitbox misalignment (#13)
7. Crash recovery (#85)
8. Asset licensing audit + credits (#91)
9. "Saiyan" trademark rename (#90)
10. Control layout options — left-handed players currently cannot play (#21)

### Strongly recommended before launch (the difference between "shipped" and "successful")
11. Face-up level-up cards (#1)
12. Relic system (#2) — or at minimum, rule-changing upgrades (#10)
13. Ally rebalance (#3)
14. Character unlock cascade (#8) + Next Goals (#59)
15. Hit feedback suite (#6)
16. Act structure and opening pacing (#7, #43)
17. Ground tile seams and world density (#16, #73)
18. Contextual onboarding (#29)
19. Elites and chests (#11, #39)
20. Quality settings (#55)

### Launch checklist
- [ ] Device matrix verified: iPhone SE, iPhone 15 Pro, 20:9 Android mid-ranger, foldable, iPad
- [ ] 60 fps sustained at 300 enemies + 24 allies on the target mid-range device
- [ ] Complete first session under 8 MB transferred
- [ ] Cold start to playable under 2 s on 4G
- [ ] Offline play verified after first visit
- [ ] Save survives: force-quit, private browsing, storage pressure, import/export round-trip
- [ ] Interruption recovery verified: incoming call, lock screen, app switch, low battery mode
- [ ] Accessibility audit: colorblind (3 types), reduced motion, 130% text, one-handed play
- [ ] Asset licensing documented for every audio and image file
- [ ] Automated smoke test in CI
- [ ] Crash reporting live before public traffic

---

## Scores

Scored against **commercially released mobile roguelites**, not against browser games. A 50 is a competent free web game; a 75 is a solid paid mobile release; a 90 is a genre leader.

| Category | Score | Note |
|---|---:|---|
| **Fun** | **62** | Genuinely pleasant, never demanding. Ceiling is capped by having one meaningful verb. |
| **Core Gameplay** | **60** | Strong structural ideas (cages, possession) around a loop with almost no continuous input. |
| **Combat** | **55** | No hit sound, no crits, misaligned hitboxes, no dodge. The systems work; the *feel* isn't built. |
| **Controls** | **68** | The floating stick with a dragging base is well implemented. Loses heavily for no handedness option and thumb-zone occlusion. |
| **Difficulty** | **54** | Four tiers of the same arithmetic. Fair, but tests patience rather than skill. |
| **Build Variety** | **38** | The lowest score here and the most important. One fixed weapon, fifteen scalars, face-down draft. |
| **Progression** | **58** | Five systems, none gating content. Excellent mastery design undercut by nothing to unlock. |
| **Reward Systems** | **55** | Flat curve. No chests, no crits, no jackpots. Achievements and Codex pay nothing. |
| **Replayability** | **52** | Rich catalogue, thin decision space. Content ≠ replayability. |
| **Visual Presentation** | **66** | Character art and menus are 85; world, effects and lighting are 45. |
| **Game Feel** | **48** | Hit-stop and reduced-motion softening show good instincts, but the fundamentals (hit sound, crits, death animation, impact) are missing. |
| **UI & UX** | **70** | Best-executed pillar. Clean, well-structured, safe-area-correct, genuinely premium menus. Held back by the face-down draft, browser dialogs and small touch targets. |
| **Audio** | **61** | Outstanding asset library, weak implementation. One shoot sound for 24 weapons; the hit sound is never played; 54 MB of hero themes heard for 8 seconds. |
| **Mobile Experience** | **47** | Safe areas and responsive layout are excellent. The 100 MB payload, absent PWA shell and no iOS fullscreen path drag this down hard. |
| **Performance** | **55** | Sound architecture, unoptimised render loop. 53 fps on fast hardware projects to ~25 on target. |
| **Accessibility** | **64** | Well above average for an indie title, with real gaps in coverage completeness. |
| **Technical Quality** | **63** | Clean, well-commented, thoughtfully pooled code. No modules, no tests, no build step, no crash recovery. |
| **Overall Polish** | **60** | Menus are polished; the playfield is not. The gap between them is the defining polish issue. |
| **Long-Term Retention** | **42** | The weakest pillar after build variety. Nothing unlocks; the meta shop finishes in 26 runs; no return hook. |
| **Commercial Potential** | **58** | High *ceiling* — the art, the roster and the possession hook are genuinely marketable. Low *current* readiness. |
| **Launch Readiness** | **41** | Ten blocking issues, four of them verified bugs. |
| | | |
| **OVERALL** | **57 / 100** | *A beautiful, content-rich game with an unbuilt core loop. Every point of the gap to 85 is recoverable in the systems layer.* |

**Projected scores after the roadmap:**
- After Sprint 1 (quick wins): **~68**
- After Phase 2 (core systems): **~79**
- After Phase 3 (content & retention): **~85**

---

## Prioritised Development Roadmap

Ordered strictly by **return on development time**. Ship in this order.

### 🔥 Sprint 1 — Week 1: "Stop the bleeding" (5–8 dev-days)
*Every item Low effort. This is the highest ROI week in the project.*

1. `Sound.sfx.hit()` wired into `damageEnemy()` (#6a) — **1 hour, transforms combat feel**
2. Face-up level-up cards (#1) — **half a day, fixes the core loop**
3. `effectiveWeapon()` shared refactor — fixes 4 upgrades + 1 evolution (#17)
4. Poison credits its source (#18)
5. No cage auto-targeting during the boss (#19)
6. Seamless ground tile — 9× draw (#16)
7. Uncharged-powershot feedback + a real on-screen powershot button (#20)
8. Two-line auto-shrinking banners (#27)
9. Opening pacing: 3.5/sec, first cage at 200 px (#43)
10. Directional shake + `G.timeScale` slow-motion (#51, #52)
11. Debounced dual-slot checksummed saves (#57)
12. Skip rendering behind overlays; halt rAF when hidden (#56, #77)
13. Touch-target expansion (#69)
14. `.gitattributes` binary rules + deploy manifest (#81, #82)
15. Rename the Saiyan tiers (#90)
16. Runner fuse (#95) + warden flanking (#96)
17. In-game modals replacing `alert()`/`confirm()` (#28)
18. Crash recovery wrapper (#85)

### 🚀 Sprint 2 — Weeks 2–3: "Make it feel like a game" 
19. **Hit feedback suite**: crits, hit-stop, aggregated damage numbers, kill flash (#6)
20. **Enemy hitbox alignment** (#13)
21. **Death animations + particle kinds + projectile rendering** (#48, #49, #50)
22. **Frame-budget reclamation**: pre-baked status sprites, batched draws, deferred strip rebuild (#15)
23. **Quality presets with auto-detection** (#55)
24. **Control layout options** (#21)
25. **Camera lead and dynamic zoom** (#45)
26. **World density and coastline** (#72, #73)
27. **Threat colour law** — enemy bullets, telegraphs, all hostile VFX (#22)

### 📱 Sprint 3 — Week 4: "Make it an app"
28. **Audio re-encode + preview hooks + WebAudio buffers + lazy loading** (#4)
29. **PWA shell**: manifest, service worker, icons, A2HS coaching (#5)
30. **Viewport fixes**: area-based scaling, orientationchange, visualViewport (#32, #35)
31. **Wake lock, pagehide flush, in-app-browser detection** (#28 browser section)
32. **Per-archetype weapon audio + adaptive music + ducking** (#46, #34, #68)

### 🎮 Phase 2 — Weeks 5–8: "Build the game underneath"
33. **Relic system — second weapon slot** (#2) ← *the single biggest design addition*
34. **Rule-changing upgrades** (#10) + **identity signature upgrades** (#71)
35. **Universal dash ability** (#13 combat section) ← *the single biggest gameplay addition*
36. **Ally rebalance + Formation command** (#3)
37. **Possession economy: Soul, Soulburn, Resonance** (#9)
38. **Act structure**: landmarks every 45 s, 6-minute core run (#7, #42)
39. **Elites with affixes + Golden Minyar + chests** (#11, #39)
40. **Cage stakes: guards, sieges, cursed cages** (#14)
41. **Build inspection UI** (#36) + **roster rework** (#54)
42. **Defensive build axis** (#38)
43. **Combo multiplier + score rebalance** (#31)

### 🎯 Phase 3 — Weeks 9–12: "Make them come back"
44. **Character unlock cascade** (#8)
45. **Next Goals panel** (#59) ← *highest retention ROI in the document*
46. **Cause of death + run diagnosis** (#30)
47. **Contextual onboarding** (#29)
48. **Achievement and Codex rewards** (#58)
49. **Daily streaks, objectives, weekly challenges** (#26)
50. **Shell Shrine tier 2** (#25)
51. **Difficulty tier mechanics** (#23) + **endless mutator drafts** (#24)
52. **Narrative share card + seeded runs** (#60, #63)
53. **Accessibility completion pass** (#65, #66, #67, assist mode)

### 🏝 Phase 4 — Months 4–6: "Make it last"
54. **Second boss + Glob mechanic rework + boss modifiers** (#12, #33)
55. **Biome mechanics** (#74)
56. **Prestige mode**
57. **Cosmetics layer** (#99)
58. **Lighting pass** (#21 visual section)
59. **Secrets and hidden content** (#26 replayability section)
60. **Global leaderboards** (#100)
61. **Localisation** (#92) + **telemetry-driven balance** (#86)
62. **Module split, test suite, simulation harness** (#29 technical risks)
63. **Async ghost co-op** — the differentiator, if the foundation holds

---

## Closing Note from the Creative Director

I want to be clear about what this document is saying, because a 57 with a hundred criticisms can read as dismissive and it is not.

Balitopia has the two things that cannot be added later: **a distinctive world with characters people will remember, and one genuinely original mechanic.** Twenty-four Guardians with real personality, a rescue-and-possess loop nobody else in this genre has, and a presentation layer that is already better than most shipped competitors. Those took real work and real taste, and they are done.

What is missing is the layer in between — the part that turns content into decisions. Right now a player holds their thumb down and beautiful things happen. The entire gap between this build and a genre-leading one is: **give the player a build to make, something to do with their other thumb, a reason to swap bodies, and a reason to press Play Again.** Four systems. None of them require new art, new music, or new characters.

The order matters enormously. Sprint 1 is a week of work and it is worth more than three months of new content, because right now the game does not confirm its own hits. Do the feel work first, the systems work second, and the content work last — and do not add a twenty-fifth Guardian until the twenty-four you have each play differently.

Get the draft face-up, put a relic in the second slot, price the possession, and give them a dash. Everything else in this document is refinement on top of a game that would already be very, very good.

*— Creative Director review, Balitopia build `b8d7fd9`*
