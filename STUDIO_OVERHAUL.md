# Balitopia — expedition overhaul

The subsequent [gore and performance update](GORE_PERFORMANCE.md) removes
environmental hazards and combat popups, and replaces the lighting-heavy
effects with bounded gore and simpler blasts. This document describes the
expedition and progression changes that preceded that update.

This update gives the existing Guardian-rescue game a clearer session structure,
a cohesive mobile interface, and deliberate build goals. It retains the existing
24 Guardians, painted art, music, enemy behaviours, accessibility controls,
Shrine, achievements, daily challenge and endless bosses.

## What changed

- New home screen with a Guardian spotlight, one primary Play action, quick
  replay, shell balance, island clears and objective progress.
- Guardian selection has a scrollable roster, readable character preview and
  pinned run controls. Unlocked starters appear first. Locked portraits explain
  their unlock requirement when selected.
- Expedition and Blitz end with a banked victory after King Glob is defeated.
  Endless retains the alternating bosses and escalating curses. Advertised
  lengths refer to boss arrival; the boss fight adds time.
- Choose a biome and a starting blessing. Tidekeeper grants 25 HP and 25% pickup
  range; Stormcaller grants 15% damage and 20% charge speed; Pathfinder grants
  15% XP and 8% movement speed. Daily runs exclude these bonuses.
- Three optional objectives provide 90 possible bonus shells per ordinary run;
  victory adds 60. Completion is idempotent. These rewards are banked on the
  result screen, so abandoning a tab mid-run does not bank a partial session.
- Every rescue refills one Soul and prepares the new Guardian's powershot.
  Every third rescue creates an eight-second rally and attracts nearby gems.
- The HUD shows the run phase, boss progress and next objective. The pause
  screen shows all objective progress. Dash and powershot controls have labels;
  Shift dashes on desktop, Space fires a powershot, Escape pauses.
- Full upgrade drafts offer a relic, an available signature for the controlled
  Guardian and a supporting power when those categories remain available. A
  needed evolution key can occupy the supporting slot. Cards are readable
  immediately and support keyboard activation.
- Chest rewards resolve sequentially against the updated pool. Duplicate taps,
  stale card handlers and stale chest callbacks cannot grant multiple rewards or
  apply rewards to the next run.
- The results screen includes a grade, objective medals, mode, island and
  evolved relics, with immediate replay and a separate change-Guardian action.
- Save version 4 adds expedition statistics while retaining the version 3
  unlocks, wallet, perks, records and mastery. Historical records are labelled
  Classic; new records identify their mode. The overall leaderboard still
  combines modes and is not a competitive cross-mode ranking.
- The offline cache version is bumped and includes the new stylesheet and rules
  script. Cache cleanup only removes Balitopia caches on the current origin.
- The mobile enemy cap now applies to scripted encounters as well as waves.

## Relic evolutions

Each requires relic level IV and at least one rank of its key upgrade. Acquisition
order does not matter. Evolutions are automatic and are applied once per relic.

| Relic | Key upgrade | Evolution | Behaviour |
|---|---|---|---|
| Tide Totem | Wide Wrath | Tidal Crown | Three totems; pulses 35% faster |
| Coconut Mine | Riptide | Volcanic Bloom | Three mines per drop; blasts 40% wider |
| Ancestor Mask | Echo | Ancestral Choir | Three ghosts; 85% attack strength |
| Reef Spire | War Chorus | Reef Citadel | Three turret cap; 35% more turret damage |
| Sunbeam | Battle Haste | Solar Halo | Three evenly spaced beams; 25% more reach |
| Undertow Net | Undertow | Maelstrom | 50% more reach; double damage |
| Storm Jar | Keen Eye | Tempest Heart | Four lightning strikes per cast |
| Bloom Petal | Bloom | Everblossom | Two extra petals; 40% more damage |

## Validation and limits

`npm test` runs deterministic rules and simulation regressions without additional
dependencies. The tests execute the real game logic with stubbed DOM, canvas and
audio ports; they are not browser rendering tests. Coverage includes all recipe
combinations in both acquisition orders, mode and blessing effects, save
migration, reward idempotence, stale callbacks, menu event wiring, all 24
Guardian weapon paths, and the performance preset's spawn cap.

The static production build and JavaScript syntax checks have passed. The cloud
browser could not reach the local preview in this environment, so browser
regressions, visual layout, real touch input, audio playback, offline reloads and
physical-device frame rates remain unverified. The original browser regression
and benchmark suites are retained under `npm run test:browser` and `npm run bench`.

Before merging, play an entire Expedition and Blitz on a phone; inspect the
short landscape layout, draft long descriptions, switch control sides, pause
and resume, upgrade the installed offline version, and finish an Endless boss.
Rally strength, Blitz pacing and the new shell economy are starting balance
values requiring human playtesting. No retention or enjoyment improvement has
been measured yet.

## Design basis

Sweetser & Wyeth (2005), *GameFlow: a model for evaluating player enjoyment in
games*, ACM Computers in Entertainment, DOI:
[10.1145/1077246.1077253](https://doi.org/10.1145/1077246.1077253).
Peer reviewed. **Credibility: 8/10** for a structured design and review model;
its original evaluation is limited and does not establish that this particular
game will be enjoyable or improve retention. The applicable principles are
clear goals, useful feedback, player control and escalating challenge. Applying
those principles here is a design judgment, not a measured outcome.
