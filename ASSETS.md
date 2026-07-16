# 🎨 Balitopia — Asset Guide

The art dump has been organized into this structure. **The game loads from `assets/img/` and
`assets/audio/` directly** — drop-in replacements just need the same filename.

```
assets/
├── art/        Original 1024px+ source art (NOT loaded by the game)
│   ├── hero_<id>.png      23 full-body character renders (transparent)
│   ├── enemy_*.png        minyar / demonder / clubbo / kingglob (transparent)
│   └── poster_*.png       painted promo pieces (used to generate title/story art)
├── img/        Game-ready images (generated from art/, small & fast)
│   ├── portraits/<id>.webp   88×88 face cards (hero select, possession strip, cages)
│   ├── heroes/<id>.png       ~96px world sprites, autocropped
│   ├── enemies/{minyar,demonder,clubbo,kingglob}.png
│   ├── title_bg.jpg          King Glob poster (title backdrop)
│   └── poster_*.jpg          story-screen enemy posters
├── audio/
│   ├── music/     title, victory, bgm_intro, bgm_gameover, region-{land,sea,sky}
│   ├── heroes/    <id>.mp3 theme + <id>_entrance.wav (24 of each)
│   ├── enemies/   themes + entrance/defeat stingers; glob_{entrance,enrage,laugh,defeat}
│   └── sfx/       catch, captured, crown_crack, fire_crackle, shatter, spell_break
├── video/      <id>.mp4 character/enemy animations (27) — not yet used in-game
└── 3d/         <id>.glb models (28) — not yet used in-game
```

Hero `<id>`s: `bo chocker chomper chunky cliggy creeper diver fertle fixie flick fygar gus
peeta-heater roger-dodger sixter skyjumper snapper stinger swack waterwolf whipper yellogen
yelp zappo`

## How the game uses it

- **Portraits** (`img/portraits/`) — hero select grid, face-card possession strip, roster,
  and drawn inside bamboo cages.
- **World sprites** (`img/heroes/`, `img/enemies/`) — pre-baked at load time. Enemies get
  **6 power-tier tints** (natural → sea blue → dusk purple → hot pink → magma → gold) plus
  random per-enemy scale, so one sprite becomes hundreds of variants.
- **Audio** — `title.mp3` on menus (tapping a hero previews their theme `<id>.mp3`); a random
  `region-*.mp3` per run; `glob.mp3` when King Glob arrives; `<id>_entrance.wav` on cage
  breaks/possession/run start; `shatter` on cage break; `demonder/clubbo_defeat.wav` on elite
  kills; `glob_entrance/laugh/enrage/defeat` + `crown_crack` through the boss fight;
  `victory.mp3` / `captured` + `bgm_gameover.mp3` on run end; `catch.wav` on heart pickup.
- Anything missing at runtime falls back to the original procedural (code-drawn) art and
  synthesized sound, so the game never breaks.

## Still wanted (art TODO list)

| Item | Spec | Why |
|---|---|---|
| **`assets/art/hero_bo.png`** | ~1024px full-body Bo (rainbow blackbird), transparent PNG | The dump has Bo's portrait, theme, entrance & 3D model — but no full-body render. Bo currently uses a code-drawn stand-in on the battlefield. (Regenerate `img/heroes/bo.png` at 96px tall from it, or supply both.) |
| Ground tile | 256×256 seamless tropical ground PNG | Still procedural |
| Bamboo cage | 76×88 PNG, see-through between bars | Still procedural |
| Palm / rock / bush props | ~96×120 / 60×44 / 56×44 transparent PNGs | Still procedural |
| XP gem + heart | 20×20 / 22×20 PNGs | Still procedural |
| App icon | 512×512 | For home-screen installs |

Unused-but-organized: the 27 `assets/video/*.mp4` animations (headless tooling couldn't decode
their codec here; they can become animated cage-break/possession flourishes later) and the 28
`assets/3d/*.glb` models (a future 3D remake says hi). `bgm_intro.mp3`, `spell_break.wav`,
`fire_crackle.mp3` and the minyar/demonder/clubbo theme mp3s are also still on the bench.
