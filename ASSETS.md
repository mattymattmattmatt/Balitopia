# 🎨 Balitopia — Art & Asset Design List

The game ships with **procedural art** (everything is drawn in code), so it runs with zero
asset files. Every sprite can be overridden with a hand-made PNG:

1. Put PNG files in `assets/img/`
2. List their filenames in `assets/manifest.json`, e.g.

```json
["minyar.png", "clubbo.png", "portrait_00.png", "ground.png"]
```

Any file listed replaces the code-drawn version; anything not listed keeps the procedural art.
All PNGs should have **transparent backgrounds** (except `ground.png`).

---

## Enemies

| File | Size (px) | Description |
|---|---|---|
| `minyar.png` | 56×56 | The swarm grunt. A round, gremlin-ish slime imp: blob body, two stubby horns, big angry eyes, wide toothy grin, tiny feet. **Draw it in neutral/grey tones** if possible — the game tints and scales it at runtime (color = power tier, size = HP), so a single sprite becomes hundreds of variants. |
| `demonder.png` | 84×96 | The elite. A horned demon brute: muscular torso, small bat wings, white claws and fangs, glowing yellow eyes. Menacing but still cartoonish. |
| `clubbo.png` | 120×128 | The mini-boss. A huge one-eyed ogre: giant belly, heavy brow, underbite tusks, loincloth, and a massive studded wooden club raised over one shoulder. |
| `kingglob.png` | 220×200 | The final boss. A mountain of grinning slime wearing a golden crown: one huge eye and one small one, a vast mouth of jagged teeth, drips at the base, junk suspended inside the goo. Should read as *hungry royalty*. |

## Heroes (24 total)

Two sprites per hero. `XX` is the two-digit hero index `00`–`23` in this order:

`00 Kai · 01 Ember · 02 Tika · 03 Volt · 04 Luna · 05 Thorn · 06 Baruk · 07 Zephyr ·
08 Frostine · 09 Blossom · 10 Rex · 11 Nia · 12 Surya · 13 Koda · 14 Mirah · 15 Tembo ·
16 Anjani · 17 Gado · 18 Rani · 19 Oto · 20 Pip · 21 Wulan · 22 Grum · 23 Sena`

| File | Size (px) | Description |
|---|---|---|
| `portrait_XX.png` | 128×128 | Face card: bust/head shot on a colored gradient background. Used in hero select, the possession strip, the roster, and inside cages. Needs to read clearly at 44×44. |
| `hero_XX.png` | 72×84 | Full-body chibi battle sprite, facing **right** (the game mirrors it for left). Feet at the bottom edge. |

Per-hero look reference (skin/hair/outfit/accent colors and headgear are defined in
`js/data.js` — match them or reinvent them, your call):

| # | Hero | Vibe | Signature |
|---|---|---|---|
| 00 | Kai — Wave Rider | Surfer, blue headband | Water blades |
| 01 | Ember — Flame Dancer | Fire dancer, flower in hair | Exploding fireballs |
| 02 | Tika — Dart Sister | Jungle scout, leaf hat | Triple blowdarts |
| 03 | Volt — Storm Child | Spiky yellow hair | Chain lightning |
| 04 | Luna — Moon Guardian | Pale, crescent hairpin | Orbiting moons |
| 05 | Thorn — Jungle Witch | Purple hood, green magic | Poison seeds |
| 06 | Baruk — Stone Fist | Big brawler, bare-headed | Quake ring |
| 07 | Zephyr — Wind Whisper | Teal headband, serene | Boomerang blades |
| 08 | Frostine — Ice Maiden | Ice-white hair, small crown | Slowing icicles |
| 09 | Blossom — Petal Priestess | Pink, flower crown | 360° petal storm |
| 10 | Rex — Hammer King | Orange, big crown | Giant hammer throw |
| 11 | Nia — Spirit Caller | Violet hood, mystical | Homing ghosts |
| 12 | Surya — Sun Blade | Golden, radiant, spiked hair | Solar beam |
| 13 | Koda — Bear Heart | Bear ears, huge and warm | Crush aura |
| 14 | Mirah — Mirror Mage | Silver hair, crescent pin | Splitting bolts |
| 15 | Tembo — Thunder Hoof | Buffalo horns, heavy | 8-way thunder nova |
| 16 | Anjani — Sky Archer | Green band, bow | Sniper arrows |
| 17 | Gado — Twin Fang | Red eye-mask, rogue | Rapid twin daggers |
| 18 | Rani — Royal Flame | Crowned, regal, fiery | Burning trail |
| 19 | Oto — Tide Turner | Broad, calm, bare-headed | Giant boomerang wave |
| 20 | Pip — Pocket Rogue | Tiny, brown hood | Chaotic rapid fire |
| 21 | Wulan — Star Weaver | Night-blue hair, crescent | 5 orbiting stars |
| 22 | Grum — Old Guard | Grey-haired veteran | Wide spear sweeps |
| 23 | Sena — Ghost Blade | White hair, dark mask | Long unseen slashes |

## World & Props

| File | Size (px) | Description |
|---|---|---|
| `ground.png` | 256×256 | Seamlessly tiling tropical ground: lush grass, mottled shade, sandy patches, tiny flowers. **Must tile in both directions.** |
| `cage.png` | 76×88 | Cursed bamboo prison: vertical bamboo bars, dark bound top/bottom bands, a purple curse-knot glowing on top. The game draws the trapped hero's portrait *behind* it, so the middle must stay see-through between bars. |
| `palm.png` | 96×120 | Decorative palm tree with coconuts, base shadow baked in. |
| `rock.png` | 60×44 | Decorative boulder. |
| `bush.png` | 56×44 | Decorative flowering bush. |
| `gem.png` | 20×20 | XP gem (diamond). Game also tints/scales it for small/medium/large values. |
| `heart.png` | 22×20 | Health pickup. |

## Style Notes

- Bright, saturated, tropical, **cartoonish with bold dark outlines** (2–4px) — it must stay
  readable when 300 enemies are on a phone screen.
- Feet/base of every character at the bottom edge of its canvas (sprites are anchored there,
  with a soft shadow drawn underneath at runtime).
- Enemies squash-and-stretch slightly in code, so avoid baked-in motion blur.
- Nice-to-have later (not yet hooked up, tell me if you make them and I'll wire them in):
  hero attack animations (2–3 frames), cage break animation, King Glob hurt face, title
  splash illustration (1920×1080), app icon (512×512).
