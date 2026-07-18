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

## Parked ideas (say the word and I'll build them)
- **Daily seeded run** — same map/cages/spawns for everyone that day; a dated high-score board.
- **Meta-currency + permanent upgrades** — earn shells per run, spend on small starting perks
  (roguelite meta-progression — the strongest long-term hook, but the biggest build).
- **Run modifiers / mutators** — opt-in challenges (glass cannon, no possession, double horde)
  for bonus score multipliers.
- **Achievements** — "free all 24 in one run", "beat Cataclysm solo", "no damage to the boss".
- **Weekly rotating boss modifiers** or a second boss.
- **Biome runs** — the land/sea/sky region music already hints at distinct themed maps.

If you want online/global leaderboards (not just local), that needs a tiny backend — I can spec one.
