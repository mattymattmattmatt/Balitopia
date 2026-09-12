# Impact audio — build 5

Build 7 retains these systems and fixes crowded-combat performance. See [PERFORMANCE.md](PERFORMANCE.md) for current budgets and validation.

Build 6 retains this audio and adds the Crownfall raid, Fury and stolen powers. See [CROWNFALL.md](CROWNFALL.md). Settings now shows **CROWNFALL · BUILD 6**.

Ordinary explosions had no dedicated sound. Most common-enemy deaths were
silent, and the recorded effects bypassed the effects-volume slider. This
update gives every nearby explosion and death an audible contribution, with
mass kills combined into a few strong sounds instead of a separate playback
for every enemy.

## Audition

[Play the 10-second audio preview](docs/impact-audio-preview.mp3).

| Time | What to listen for |
|---|---|
| 0.25 s | A normal blast: crack, falling bass and a short pressure tail |
| 1.45–2.8 s | Individual wet splats, a heavier tear and chunk landings |
| 3.2–4.6 s | A powershot killing a crowd, followed by falling remains |
| 5.4–7.5 s | Repeated chain explosions with spatial splats and landings |
| 8.1–10.2 s | A final mass kill and its aftermath |

This is an **offline audition**, using the actual generated PCM buffers,
event aggregation, playback rates, panning and voice fades. FFmpeg approximates
the Web Audio compressor; it is not a browser or phone recording. Music is
omitted so the effects can be reviewed. The MP3 measures approximately
−18.3 LUFS integrated and −4.5 dBFS true peak in this sequence. It is not
normalized above the game's configured effects level.

Reproduce it with Node and FFmpeg on PATH:

```sh
node tools/test/render-audio.cjs
```

The preview and QA tools are excluded from the production build.

## The sounds and mix

`js/combat-audio.js` creates 24 original mono clips once when audio starts:
three normal blasts, three heavy blasts, three powershots, five splats, three
heavy tears, four landing impacts and three hit confirmations. No new audio
download, package, API key or generation service is needed at runtime.

Blasts layer a short crack, descending bass with upper harmonics, filtered
pressure and a rough rolling tail. Powershots have a second closely spaced
crack and a longer body. Splats combine chopped wet noise, irregular liquid
transients and a heavier tearing layer for larger kills. Chunks make a short
thud and slap on their first ground contact. Variants rotate; wet effects
have slight pitch variation using a private random stream.

Blasts briefly reduce music and suppress ordinary hit, weapon, gem and combo
chatter. Wet splats follow a coincident blast by 22 ms. Nearby left/right
events are positioned in stereo; distance reduces their level and distant
events are discarded. Browsers without stereo panning retain a mono path.
Existing enemy defeat recordings remain as restrained, rate-limited accents.
The Guardian entrance clip no longer plays over every powershot.

Recorded effects now decode into a shared cache and use the same effects bus
as the new sounds. The bus has compression followed by the master gain and a
soft ceiling. Music retains its existing streaming path with faster ducking
and smooth recovery. Master mute and Effects = 0 stop active effects and
cancel queued cues. Returning from a phone interruption, opening Pause,
retrying and returning to the title cannot replay an old combat queue.

Monster gore = Off disables splats and chunk sounds while retaining blasts.
Reduced motion retains death splats; landings follow the actual visible
fragment simulation. The existing red gore, simplified rendering and absence
of floating combat text continue unchanged.

## Work limits

| Resource | Limit |
|---|---:|
| Shared combat / recorded-effect voices | 24 |
| Extra voices fading after replacement | 4, for 8 ms each |
| Legacy synthesized effect voices | 12 |
| Blast starts | 1 per frame, at least 75 ms apart; powershots have a separate 120 ms gate |
| Spatial splat starts | 2 per eligible frame, at least 65 ms between groups |
| Spatial landing starts | 2 per eligible frame, at least 110 ms between groups |
| Pending combat data | 1 blast summary and 6 spatial buckets |
| Decoded recording cache | 64 entries / 8 MiB of retained decoded PCM |
| Original combat PCM | 1,148,160 bytes plus an equal AudioBuffer copy |

The original bank and playback copies occupy approximately 2.19 MiB; the
reusable legacy noise buffer adds about 94 KiB. Browser graph overhead and
recording buffers still referenced by active voices are additional. Combat
events do not generate samples, allocate AudioBuffers or launch audio fetches.
Rate-limited events are consumed immediately, with no backlog to replay later.
High-priority powershots can replace less important voices with a short fade.

## Verification

```sh
node --test tools/test/*.test.js
bash tools/build.sh
```

48 automated tests cover the existing game plus the new sound bank and
scheduling: real explosion/death/powershot/landing hooks; 43,200 simulated
explosion/death pairs over 360 frames; voice and allocation limits; priority
replacement; volume and mute; pause/retry; stale decodes; music ducking and
recovery; mono fallback; Gore Off; and gameplay randomness isolation.

Tests use a Web Audio graph and clock host. They verify scheduling and routing,
not browser DSP or subjective sound quality. No phone FPS or speaker listening
claim is made. Chromium was unavailable in the workspace, so browser audio
unlock and a physical iPhone/Android listening pass remain unverified.

The HTML and offline shell are versioned together as `5-impact-audio` and
precache the new module. After deployment, Settings identifies this version
as **IMPACT AUDIO · BUILD 5**.

## Design reference

The separation of transient, tonal and noise components, then variation of
reusable events, draws on Misra, Cook and Wang (2006),
[A New Paradigm for Sound Design](https://www.dafx.de/paper-archive/2006/papers/p_319.pdf),
DAFx-06. Credibility: **8/10** — a peer-reviewed technical conference paper
supporting this synthesis framework. Our sound choices and mixer limits are
design decisions; the paper does not establish their effectiveness in Balitopia.
