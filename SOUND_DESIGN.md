# 🔊 Balitopia — Sound Effects to Generate (ElevenLabs)

These are the one-shot sound effects that would lift the game from "synth placeholder"
to "juicy." The game is **already wired for every file below** — enable a sound and it's
used the instant it's present, falling back to the built-in WebAudio synth until then. So
you can generate them in any order and they just work.

## How to add them

1. In **ElevenLabs → Sound Effects**, paste the prompt, set the duration, generate, pick the best take.
2. Export as **MP3**, name it **exactly** as the "File" column says.
3. Drop it into **`assets/audio/sfx/`**.
4. Add its name (without `.mp3`) to the array in **`assets/audio/sfx/manifest.json`**, e.g.
   ```json
   ["powershot", "power_ready", "tierup"]
   ```
5. Reload — done. (No code edit; the manifest keeps the console free of 404s for sounds you haven't made yet.)

Keep them **short, dry (no reverb tail), and punchy** — they fire fast and often. Mono is fine.
A hair of headroom (don't max the loudness) keeps them from clipping when several stack up.

---

## Core gameplay SFX (highest impact first)

| # | File | Used when | Duration | ElevenLabs prompt |
|---|------|-----------|----------|-------------------|
| 1 | `powershot.mp3` | You unleash a Guardian's charged powershot (the big screen-clearing blast) | 1.2s | *Powerful magical super-attack blast unleashing — deep bass whoomph, bright energy burst and shimmering sparkle sweep, cartoon video-game special move, punchy and satisfying, no reverb tail* |
| 2 | `power_ready.mp3` | Your active Guardian's powershot finishes charging (card starts glowing) | 0.7s | *Short rising magical charge-up chime that completes with a bright sparkle ping, power-up ready notification, clean and hopeful, arcade UI, no reverb* |
| 3 | `tierup.mp3` | A Guardian ranks up a mastery level (Basic→Expert→…→Super Saiyan) | 1.0s | *Triumphant power-level-up surge — a rising energy whoosh into a bright heroic chime stinger, anime power boost, celebratory, crisp* |
| 4 | `levelup.mp3` | You gain a character level (the 3-card upgrade screen appears) | 0.9s | *Cheerful video-game level-up jingle, ascending bell arpeggio with a soft magical sparkle, bright and rewarding, short and clean* |
| 5 | `hurt.mp3` | The player takes a hit | 0.4s | *Short cartoon character taking damage — a soft painful grunt-thud with a low impact, retro game hurt sound, not gross, punchy, dry* |
| 6 | `gem.mp3` | You collect an XP gem | 0.25s | *Tiny bright crystal pickup blip, quick glassy coin-collect ping, clean arcade UI, very short, no tail* |
| 7 | `heal.mp3` | You pick up a heart / heal | 0.5s | *Gentle warm healing chime, soft magical restorative shimmer rising slightly, cozy and positive, short* |
| 8 | `shoot.mp3` | Generic projectile fires (throttled) | 0.15s | *Very short cartoon projectile launch — a soft "pew" whoosh with a light magical zip, clean, dry, arcade, no reverb* |
| 9 | `hit.mp3` | A projectile connects with an enemy | 0.15s | *Short soft impact — a squishy cartoon "thwack" hitting a slime creature, light and punchy, dry, no tail* |
| 10 | `kill.mp3` | A common enemy (Minyar) is destroyed | 0.35s | *Short comedic monster defeat — a squishy pop with a quick descending cartoon "wah", goofy slime splat, dry, punchy* |

## UI / menu SFX (pure polish — silent today, no fallback)

| # | File | Used when | Duration | ElevenLabs prompt |
|---|------|-----------|----------|-------------------|
| 11 | `ui_click.mp3` | Any confirm/forward button (START, FIGHT, upgrade pick, retry) | 0.2s | *Crisp bright UI confirm click — a wooden tiki tap with a soft tropical mallet tone, clean mobile-game button press, short and snappy, dry* |
| 12 | `ui_back.mp3` | A back button | 0.2s | *Soft low UI back/cancel tap — a muted wooden knock with a gentle downward tone, mobile menu navigation, short, dry* |
| 13 | `ui_select.mp3` | Tapping a Guardian on the select grid | 0.15s | *Very short light selection tick — a soft marimba/tiki blip, subtle and pleasant, mobile UI highlight, tiny, dry* |

---

## Optional upgrades to what already exists

These already play from files, but they were quick placeholders — regenerate any you want to
improve and overwrite the file at the listed path (same name).

| Replace | Path | Prompt |
|---------|------|--------|
| Cage shatter | `assets/audio/sfx/shatter.wav` | *Bamboo cage cracking and bursting apart — sharp wooden splinter snap with a bright magical release shimmer, satisfying break, short* |
| Guardian freed magic | `assets/audio/sfx/spell_break.wav` | *A curse breaking — a reverse-swell into a bright liberating magical chime, hopeful release, medium-short* |
| Heart catch | `assets/audio/sfx/catch.wav` | *Soft warm pickup pop, gentle positive collect, very short, dry* |
| Boss crown cracks | `assets/audio/sfx/crown_crack.wav` | *Heavy golden crown cracking and shattering, metallic crack with a deep ominous crunch, dramatic, medium* |

## Voice / one-shots you might add later (nice-to-have, not yet wired)

If you generate these I'll wire them in — tell me and I'll hook them up:

- `assets/audio/enemies/glob_slam.wav` — *King Glob rears up and slams the ground: a huge gelatinous whump with a heavy bass boom and a wet slap, boss attack telegraph payoff*
- `assets/audio/ui/whoosh.mp3` — *screen/panel transition whoosh, soft airy sweep* (for menu transitions)
- Per-element shoot variants (`shoot_fire.mp3`, `shoot_ice.mp3`, `shoot_lightning.mp3`, `shoot_water.mp3`) if you want each Guardian's element to sound distinct — say the word and I'll route weapons to them.

---

### Reference: where each core sound is triggered in code

`js/game.js` calls `Sound.sfx.<name>()`; `js/audio.js` maps each to `assets/audio/sfx/<name>.mp3`
with a synth fallback (the `fileOr` helper), gated by `assets/audio/sfx/manifest.json`.
Filenames in this doc are the source of truth — match them exactly, list them in the manifest,
and the game picks them up automatically.
