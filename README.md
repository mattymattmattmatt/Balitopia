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
| Move | Touch & drag anywhere (virtual joystick) — or WASD/arrows on desktop |
| Attack | Automatic — every Guardian's power auto-aims |
| Free a Guardian | Shoot their bamboo cage until it breaks (gold arrow points to the nearest one) |
| Possess a Guardian | Tap their face card at the bottom of the screen (or ☰ for the full roster) |
| Level up | Collect the gems enemies drop, pick 1 of 3 upgrades |

- **Minyar** — endless, easy to squish, but they come in every size and color. Color = danger:
  green < blue < purple < pink < magma < gold.
- **Demonder** — rarer, tough, hits hard.
- **Clubbo** — very rare, very large, very rude.
- **KING GLOB** — arrives at **8:00**. Kill him to free Balitopia. Free as many Guardians as
  you can first — you'll need the army.

## 🦸 The 24 Guardians

Every hero has a unique auto-power: piercing waves, exploding fire, chain lightning, orbiting
moons, poison seeds, quake rings, boomerang gales, slowing ice, petal storms, giant hammers,
homing spirits, solar beams, crush auras, splitting bolts, thunder novas, sniper arrows, dagger
flurries, burning trails, door-sized waves, junk storms, stolen stars, spear sweeps, and one
blade nobody has ever seen.

## 🛠 Running It

Any static file server works:

```bash
npx serve .          # or
python3 -m http.server 8000
```

Then open it on your phone (same Wi-Fi → `http://<your-ip>:8000`) and rotate to landscape.
Opening `index.html` directly also works in most browsers (the game is fully self-contained;
custom art via `assets/manifest.json` just won't load over `file://`).

## 🎨 Custom Art

All art is procedurally drawn in code, so the game needs zero asset files — but every sprite
can be replaced with your own PNGs. See **[ASSETS.md](ASSETS.md)** for the full design list
(filenames, sizes, and style notes). Drop files into `assets/img/` and list them in
`assets/manifest.json`.
