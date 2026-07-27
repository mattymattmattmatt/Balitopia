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
