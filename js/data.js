// ============================================================
// BALITOPIA — game data: story, heroes, enemies, upgrades
// ============================================================
'use strict';

const STORY = {
  intro: [
    `Far across the warm seas lies <em>Balitopia</em> — an island where the volcano sleeps politely, the surf is always up, and twenty-four <em>Guardians</em> keep the Balance of sun, sea, jungle and stone.`,
    `Then the mountain burped. From a crack beneath Mount Karang crawled <em>King Glob</em>, the Hungry King — a wailing tyrant fused to a golden throne, who devours color, music, and everything in between. His horde spilled out ahead of him: the shuffling <em>Minyar</em> swarming the beaches in every cursed color, the horned <em>Demonders</em> stalking the jungle, and the colossal <em>Clubbos</em> flattening whole villages with one lazy swing.`,
    `One by one the Guardians fell, sealed inside cursed bamboo cages and scattered across the island — their trapped magic drip-feeding the King's bottomless appetite.`,
    `But cursed cages have one flaw the King never noticed: <em>they break from the outside.</em>`,
    `One Guardian slipped the ambush. You. Break every cage. Every Guardian you free fights at your side — and their body is yours to possess with a touch. Gather your kin, drown the horde, and when the ground begins to shake... make the Hunger go hungry.`
  ],
  victory: `King Glob's crown cracked first, then his throne, then his temper. The Hungry King wailed once and burst into a monsoon of stolen color that rained back over the island. The Guardians stood together on the black sand as the surf rolled in, gold again. Balitopia breathes. The Balance holds. (The volcano has promised to chew with its mouth closed from now on.)`,
  defeat: `The tide took you gently, as it takes all things. But deep in the jungle, bamboo creaks... a cage strains... and somewhere a Guardian opens their eyes. Balitopia is not finished. Neither are you.`
};

// ---------- Heroes ----------
// weapon types: shot, nova, orbit, aura, chain, beam, trail, slash
// shot flags: homing, boomerang, explode(r), split, slow(s), poison(dps), knock(px/s), rainbow
// id = asset key: assets/img/portraits/<id>.webp, assets/img/heroes/<id>.png,
//                 assets/audio/heroes/<id>.mp3 + <id>_entrance.wav
const HEROES = [
  { id:'bo',           name:'Bo',           title:'Prism Songbird',  accent:'#ff5252',
    desc:'A blackbird who swallowed a rainbow and refuses to give it back. Sings in colors, argues in feathers.',
    hp:90,  spd:196, power:'Prism Feathers — fanned rainbow volley',
    weapons:[{ type:'shot', interval:.5, dmg:7, count:3, speed:470, spread:.38, pierce:0, size:5, life:1.1, rainbow:true, color:'#ff5252' }] },
  { id:'chocker',      name:'Chocker',      title:'Stink Serpent',   accent:'#69f0ae',
    desc:'Half trunk, half snake, all fumes. His breath has been classified as a weather event.',
    hp:95,  spd:190, power:'Gag Cloud — poison that keeps eating',
    weapons:[{ type:'shot', interval:.7, dmg:6, count:1, speed:380, spread:0, pierce:1, size:6, life:1.3, poison:9, poisonT:2.5, color:'#69f0ae' }] },
  { id:'chomper',      name:'Chomper',      title:'Thunder Jaws',    accent:'#40c4ff',
    desc:'A storm-blue wolf who bit a lightning bolt and liked it. Everything within reach is technically food.',
    hp:96,  spd:198, power:'CHOMP — long lethal bite arcs',
    weapons:[{ type:'slash', interval:.62, dmg:27, radius:135, arc:1.5, color:'#40c4ff' }] },
  { id:'chunky',       name:'Chunky',       title:'Barrel of Chaos', accent:'#ffd740',
    desc:'A monkey with rainbow hands and zero impulse control. Throws whatever he grabs. He grabs everything.',
    hp:95,  spd:204, power:'Junk Storm — chaotic rapid flinging',
    weapons:[{ type:'shot', interval:.18, dmg:6, count:1, speed:540, spread:.55, pierce:0, size:4, life:.9, color:'#ffd740' }] },
  { id:'cliggy',       name:'Cliggy',       title:'Egg Artillery',   accent:'#aed581',
    desc:'A rooster who lays eggs at Mach 2. Nobody knows how. Cliggy will not be taking questions.',
    hp:120, spd:176, power:'Yolk Bombs — colossal egg mortars',
    weapons:[{ type:'shot', interval:1.3, dmg:36, count:1, speed:300, spread:0, pierce:1, size:12, life:1.4, knock:280, color:'#fff8e1' }] },
  { id:'creeper',      name:'Creeper',      title:'Laser Owl',       accent:'#f06292',
    desc:'Sees everything, judges everything, incinerates most of it. Blinks once per week to stay intimidating.',
    hp:92,  spd:190, power:'Death Stare — piercing eye beam',
    weapons:[{ type:'beam', interval:.9, dmg:14, length:540, width:15, color:'#ff80ab' }] },
  { id:'diver',        name:'Diver',        title:'Sky Torpedo',     accent:'#e1f5fe',
    desc:'A butterfly built like a dart. Climbs to the sun, folds her wings, and arrives before the sound does.',
    hp:88,  spd:196, power:'Skewer Dive — long piercing strikes',
    weapons:[{ type:'shot', interval:1.0, dmg:28, count:1, speed:640, spread:0, pierce:4, size:5, life:1.5, color:'#e1f5fe' }] },
  { id:'fertle',       name:'Fertle',       title:'Furnace Turtle',  accent:'#ff7043',
    desc:'Slow of foot, fast of flame. Carries her house on her back and keeps the pilot light on.',
    hp:110, spd:180, power:'Shellfire — exploding fireballs',
    weapons:[{ type:'shot', interval:.8, dmg:15, count:1, speed:340, spread:0, pierce:0, size:8, life:1.3, explode:62, color:'#ff7043' }] },
  { id:'fixie',        name:'Fixie',        title:'Blizzard Penguin', accent:'#81d4fa',
    desc:'Waddles at a temperature ten degrees below reasonable. His shrug once froze a lagoon.',
    hp:95,  spd:185, power:'Chillspike — slowing icicles',
    weapons:[{ type:'shot', interval:.65, dmg:8, count:2, speed:410, spread:.22, pierce:0, size:6, life:1.2, slow:2, color:'#81d4fa' }] },
  { id:'flick',        name:'Flick',        title:'Match-Stick Phoenix', accent:'#ffab40',
    desc:'Carries a burning branch everywhere "for emergencies." Behind Flick, everything is an emergency.',
    hp:100, spd:192, power:'Cinder Wake — burning trail',
    weapons:[{ type:'trail', interval:.16, dmg:13, radius:36, patchLife:2.3, color:'#ffab40' },
             { type:'shot', interval:.95, dmg:7, count:1, speed:380, spread:0, pierce:0, size:6, life:1.1, color:'#ffab40' }] },
  { id:'fygar',        name:'Fygar',        title:'Blade Tiger',     accent:'#ff9800',
    desc:'Runs on ice like it owes him money. Two fangs, forty throws a blink, no patience whatsoever.',
    hp:88,  spd:206, power:'Fang Flurry — rapid twin fangs',
    weapons:[{ type:'shot', interval:.27, dmg:5, count:2, speed:520, spread:.1, pierce:0, size:4, life:.9, color:'#ffb74d' }] },
  { id:'gus',          name:'Gus',          title:'The Long Squeeze', accent:'#66bb6a',
    desc:'A serpent of considerable length and opinion. Doesn\'t chase anyone — the coils are already everywhere.',
    hp:140, spd:178, power:'Constrictor Field — grinding crush aura',
    weapons:[{ type:'aura', interval:.45, dmg:9, radius:112, color:'#66bb6a' }] },
  { id:'peeta-heater', name:'Peeta-Heater', title:'Boiling Dolphin', accent:'#ff8a65',
    desc:'The only dolphin who swims in his own hot spring. His clicks come out pre-scalded.',
    hp:100, spd:190, power:'Scalding Jets — piercing steam blades',
    weapons:[{ type:'shot', interval:.55, dmg:11, count:1, speed:430, spread:0, pierce:2, size:6, life:1.2, color:'#ff8a65' }] },
  { id:'roger-dodger', name:'Roger-Dodger', title:'The Unhittable',  accent:'#4dd0e1',
    desc:'A dragonfly who has never been touched, tagged, or told what to do. His wings come back. So does he.',
    hp:92,  spd:200, power:'Returning Wings — boomerang blades',
    weapons:[{ type:'shot', interval:.9, dmg:11, count:1, speed:390, spread:0, pierce:99, size:8, life:1.6, boomerang:true, color:'#4dd0e1' }] },
  { id:'sixter',       name:'Sixter',       title:'Grudge Star',     accent:'#ba68c8',
    desc:'A starfish with five arms and six grievances. Radiates hostility. Literally.',
    hp:90,  spd:188, power:'Star Shrapnel — 360° razor burst',
    weapons:[{ type:'nova', interval:1.1, dmg:5, count:14, speed:310, size:5, life:.85, color:'#ba68c8' }] },
  { id:'skyjumper',    name:'Skyjumper',    title:'Cloud Dancer',    accent:'#f8bbd0',
    desc:'A unicorn who uses clouds as trampolines. Five stolen stars orbit her out of pure admiration.',
    hp:95,  spd:190, power:'Stolen Stars — fast orbiting ring',
    weapons:[{ type:'orbit', interval:0, dmg:7, count:5, radius:108, rot:3.5, size:7, rainbow:true, color:'#fff59d' }] },
  { id:'snapper',      name:'Snapper',      title:'Shockwave Crab',  accent:'#ff8a65',
    desc:'Claps his claws and the beach rearranges itself. Walks sideways, fights in every direction at once.',
    hp:130, spd:174, power:'Clap Quake — radial knockback burst',
    weapons:[{ type:'nova', interval:1.5, dmg:10, count:10, speed:270, size:7, life:.55, knock:230, color:'#ffab91' }] },
  { id:'stinger',      name:'Stinger',      title:'Lance Corporal',  accent:'#ffee58',
    desc:'A wasp with a lightning lance and a military bearing. Sweeps the field like it\'s parade inspection.',
    hp:105, spd:186, power:'Lance Sweep — wide skewering arcs',
    weapons:[{ type:'slash', interval:.8, dmg:19, radius:98, arc:2.4, color:'#ffee58' }] },
  { id:'swack',        name:'Swack',        title:'The Wet Slap',    accent:'#ef5350',
    desc:'A shark who throws waves the size of doors and catches them like frisbees. The ocean finds this hilarious.',
    hp:112, spd:182, power:'Doorwave — giant returning wave',
    weapons:[{ type:'shot', interval:1.2, dmg:19, count:1, speed:310, spread:0, pierce:99, size:15, life:1.7, boomerang:true, color:'#4dd0e1' }] },
  { id:'waterwolf',    name:'Waterwolf',    title:'Tide Howler',     accent:'#26a69a',
    desc:'Made of muscle and undertow. When he howls, eight slabs of sea go looking for trouble.',
    hp:128, spd:174, power:'Tidal Howl — heavy 8-way nova',
    weapons:[{ type:'nova', interval:1.6, dmg:17, count:8, speed:230, size:9, life:.9, knock:160, color:'#4db6ac' }] },
  { id:'whipper',      name:'Whipper',      title:'Echo Bat',        accent:'#7c4dff',
    desc:'A rainbow bat whose screeches take corners. They lock on, they follow through, they apologize to no one.',
    hp:90,  spd:192, power:'Hunting Echoes — homing shrieks',
    weapons:[{ type:'shot', interval:.8, dmg:9, count:2, speed:290, spread:1.2, pierce:0, size:7, life:2.2, homing:true, rainbow:true, color:'#b388ff' }] },
  { id:'yellogen',     name:'Yellogen',     title:'The Living Alarm', accent:'#ffee58',
    desc:'A red bird whose scream is a physics problem. Each screech shatters into silver shards on arrival.',
    hp:90,  spd:190, power:'Shatter Screech — splitting bolts',
    weapons:[{ type:'shot', interval:.85, dmg:10, count:1, speed:400, spread:0, pierce:0, size:7, life:1.2, split:true, color:'#ffee58' }] },
  { id:'yelp',         name:'Yelp',         title:'Sonic Seal',      accent:'#b39ddb',
    desc:'A seal with a voice like a foghorn falling downstairs. Three orbs of pure YELP circle her at all times.',
    hp:105, spd:184, power:'Echo Orbs — orbiting crushers',
    weapons:[{ type:'orbit', interval:0, dmg:10, count:3, radius:82, rot:2.7, size:10, color:'#b39ddb' }] },
  { id:'zappo',        name:'Zappo',        title:'Jellyvolt',       accent:'#9ccc65',
    desc:'A jellyfish carrying one (1) spark, indefinitely on loan from a storm. It arcs to whoever\'s rudest.',
    hp:92,  spd:194, power:'Arc Kiss — chain lightning',
    weapons:[{ type:'chain', interval:.75, dmg:16, jumps:4, range:250, color:'#d4e157' }] },
];


// ---------- Enemies ----------
// Hue tiers: higher tier = stronger; unlocked over time. Color tells you the danger.
const TIERS = [
  { hue:150, mult:1.0 },   // jungle green
  { hue:200, mult:1.7 },   // sea blue
  { hue:265, mult:2.8 },   // dusk purple
  { hue:330, mult:4.4 },   // hot pink
  { hue:20,  mult:6.8 },   // magma orange
  { hue:55,  mult:10.5 },  // royal gold
];

// dh = on-screen display height at scale 1 (sprite files vary in resolution)
// ai: chase (default) | ranged (keeps distance, spits) | shielded (front armor) | runner (flees low, bursts)
const ENEMIES = {
  minyar:   { hp:9,   spd:62, dmg:8,  xp:1,  r:13, dh:52 },
  demonder: { hp:130, spd:46, dmg:18, xp:8,  r:20, dh:88 },
  clubbo:   { hp:640, spd:32, dmg:34, xp:30, r:30, dh:118 },
  // new archetypes (reuse the minyar/demonder art, tinted + marked)
  spitter:  { hp:55,  spd:40, dmg:14, xp:6,  r:16, dh:64,  ai:'ranged',   base:'minyar' },
  warden:   { hp:340, spd:38, dmg:24, xp:14, r:22, dh:92,  ai:'shielded', base:'demonder' },
  runner:   { hp:26,  spd:104,dmg:10, xp:5,  r:14, dh:56,  ai:'runner',   base:'minyar' },
};

const BOSS = { hp:48000, spd:40, dmg:45, r:66, xp:0, dh:190 };   // the Hungry King is no pushover
const BOSS_TIME = 480;          // King Glob first arrives at 8:00
const BOSS_RESPAWN = 150;       // endless mode: he returns this many seconds after each kill
const ROUND_EHP = 0.45;         // endless: +45% enemy HP per round
const ROUND_EDMG = 0.30;        // endless: +30% enemy damage per round
const ROUND_BHP = 0.60;         // endless: +60% boss HP per round
const CAGE_HP = 70;

// ---------- Difficulty / Ascension ----------
// Higher tiers scale enemy HP/damage and boss HP, and multiply your score.
// Each is unlocked by clearing the one below it. `menace` = spawn-rate boost.
const DIFFICULTIES = [
  { id:0, name:'GUARDIAN',  sub:'find your footing',   ehp:1.00, edmg:1.00, bhp:1.00, menace:1.00, score:1.0, color:'#4caf50' },
  { id:1, name:'WARDEN',    sub:'the horde wises up',  ehp:1.45, edmg:1.30, bhp:1.7,  menace:1.15, score:1.6, color:'#2196f3' },
  { id:2, name:'NIGHTMARE', sub:'no mercy on the sand',ehp:2.10, edmg:1.65, bhp:2.6,  menace:1.30, score:2.4, color:'#f44336' },
  { id:3, name:'CATACLYSM', sub:'the island screams',  ehp:3.10, edmg:2.05, bhp:4.0,  menace:1.5,  score:3.5, color:'#ff9800' },
];

// ---------- Guardian mastery & powershots ----------
// Each Guardian levels up from damage THEY deal (shown as facecard border color)
// and charges a powershot the same way (glowing card when ready).
const TIER_NAMES  = ['BASIC', 'EXPERT', 'MASTER', 'SAIYAN', 'SUPER SAIYAN'];
const TIER_COLORS = ['#4caf50', '#2196f3', '#f44336', '#ff9800', '#ffee58'];
const TIER_DMG    = [0, 3200, 9500, 22000, 45000];  // damage-dealt thresholds (SS is a real journey)
const TIER_BONUS  = 0.10;                           // +10% damage per tier
const POWER_NEED  = 800;                            // damage per powershot charge (scales with tier)

// ---------- Upgrades ----------
// Drawn as 3 face-down mystery cards on level-up. `once` upgrades leave the
// pool after being taken.
const UPGRADES = [
  { id:'power',      icon:'💥', name:'Guardian Power', desc:'+20% damage for you and every freed Guardian', apply:m=>m.dmg*=1.2 },
  { id:'haste',      icon:'⚡', name:'Battle Haste',   desc:'Attack 12% faster',                            apply:m=>m.rate*=0.88 },
  { id:'swift',      icon:'👟', name:'Swift Feet',     desc:'+10% move speed',                              apply:m=>m.spd*=1.1 },
  { id:'vital',      icon:'❤️', name:'Vitality',       desc:'+25 max HP and heal 50%',                      apply:(m,g)=>{ m.hpBonus+=25; g.healPct(.5); } },
  { id:'allies',     icon:'🤝', name:'War Chorus',     desc:'Freed Guardians deal +30% damage',             apply:m=>m.ally*=1.3 },
  { id:'magnet',     icon:'🧲', name:'Spirit Magnet',  desc:'+35% pickup range',                            apply:m=>m.magnet*=1.35 },
  { id:'regen',      icon:'🌿', name:'Island Blessing',desc:'Regenerate +1.2 HP per second',                apply:m=>m.regen+=1.2 },
  { id:'area',       icon:'🌀', name:'Wide Wrath',     desc:'+15% attack area & projectile size',           apply:m=>m.area*=1.15 },
  { id:'pierce',     icon:'🎯', name:'Skewer',         desc:'Projectiles pierce +1 extra enemy',            apply:m=>m.pierceBonus+=1 },
  { id:'velocity',   icon:'💨', name:'Swift Shots',    desc:'+20% projectile speed',                        apply:m=>m.pspd*=1.2 },
  { id:'longevity',  icon:'⏳', name:'Long Throw',     desc:'+20% projectile lifetime & reach',             apply:m=>m.plife*=1.2 },
  { id:'overcharge', icon:'🔋', name:'Overcharge',     desc:'Powershots charge 30% faster',                 apply:m=>m.chargeMul*=1.3 },
  { id:'wisdom',     icon:'📜', name:'Island Wisdom',  desc:'+20% XP from gems',                            apply:m=>m.xpGain*=1.2 },
  { id:'impact',     icon:'🥊', name:'Heavy Impact',   desc:'+50% knockback on all hits',                   apply:m=>m.knockMul*=1.5 },
  { id:'secondwind', icon:'🕯️', name:'Second Wind',    desc:'Cheat death once — revive at half HP',         once:true, apply:m=>m.revive+=1 },
];

// ---------- Meta-progression: the Shell Shrine ----------
// Earn Shells from runs, spend on modest PERMANENT boons. Kept deliberately
// small so the difficulty ladder still matters — these smooth the early game,
// they don't trivialize it. apply() folds into G.mods at run start.
const PERKS = [
  { id:'hp',    icon:'❤️', name:'Sturdy Shell',  desc:'+8 starting max HP',        max:5, cost:l=>40 + l * 30,  apply:(m,l)=>m.hpBonus += 8 * l },
  { id:'dmg',   icon:'💥', name:'Sharpened Kin', desc:'+4% damage',                max:5, cost:l=>50 + l * 40,  apply:(m,l)=>m.dmg *= 1 + 0.04 * l },
  { id:'spd',   icon:'👟', name:'Fleet Footed',  desc:'+3% move speed',            max:3, cost:l=>45 + l * 35,  apply:(m,l)=>m.spd *= 1 + 0.03 * l },
  { id:'xp',    icon:'📜', name:'Old Wisdom',     desc:'+6% XP gained',            max:3, cost:l=>45 + l * 35,  apply:(m,l)=>m.xpGain *= 1 + 0.06 * l },
  { id:'magnet',icon:'🧲', name:'Gem Sense',      desc:'+12% pickup range',        max:3, cost:l=>35 + l * 25,  apply:(m,l)=>m.magnet *= 1 + 0.12 * l },
  { id:'start', icon:'⛓', name:'Head Start',     desc:'Begin with 1 cage already broken', max:3, cost:l=>80 + l * 70, apply:()=>{} },
  { id:'fortune',icon:'🎲', name:'Fortune',        desc:'+1 level-up reroll per run', max:3, cost:l=>60 + l * 55, apply:()=>{} },
];
const SHELLS_PER_SCORE = 500;   // 1 shell per this much score

// ---------- Endless round narrative beats ----------
// Shown when King Glob crawls back out for the next round. Index by round number
// (clamped); each is a short escalating taunt to give endless mode a story arc.
const ROUND_FLAVOR = [
  '',  // round 0/1 unused (first boss uses its own banner)
  '',
  'The mountain splits. He remembers dying — and hates you for it.',
  'Cracks race across the island. Glob returns wearing the dark like armor.',
  'The sea pulls back in fear. Something older wakes beneath the King.',
  'The sky bruises purple. Glob has stopped pretending to be alive.',
  'Reality thins. Each death only makes the Hungry King hungrier.',
  'The cages you broke rattle with laughter. He is legion now.',
  'The Balance screams. You are the only thing still holding the line.',
  'Time folds. Glob has been killing you in every world at once.',
  'There is no round after this that has a name. Only you, and the end of him.',
];
const roundFlavor = r => ROUND_FLAVOR[Math.min(r, ROUND_FLAVOR.length - 1)] || 'The horde thickens. Hold the line.';

// ---------- Achievements ----------
// Checked at run end against a run context + lifetime save stats.
const ACHIEVEMENTS = [
  { id:'firstwin',  icon:'👑', name:'Regicide',        desc:'Defeat King Glob',                  test:c=>c.bossKills>=1 },
  { id:'freeall',   icon:'⛓',  name:'Jailbreak',       desc:'Free all 24 Guardians in one run',  test:c=>c.freed>=24 },
  { id:'ss',        icon:'🌟', name:'Transcendent',    desc:'Take a Guardian to Super Saiyan',   test:c=>c.maxTier>=4 },
  { id:'endless5',  icon:'🌀', name:'Still Standing',  desc:'Reach endless round 5',             test:c=>c.round>=5 },
  { id:'endless10', icon:'🔥', name:'Unrelenting',     desc:'Reach endless round 10',            test:c=>c.round>=10 },
  { id:'solo',      icon:'🦸', name:'Lone Guardian',   desc:'Beat King Glob without possessing anyone', test:c=>c.bossKills>=1&&!c.possessed },
  { id:'cataclysm', icon:'☄️', name:'Island Saviour',  desc:'Defeat King Glob on Cataclysm',     test:c=>c.bossKills>=1&&c.diff>=3 },
  { id:'codex',     icon:'📖', name:'Full Codex',      desc:'Master all 24 Guardians to Super Saiyan', test:c=>c.codexComplete },
  { id:'reaper',    icon:'☠️', name:'Reaper',          desc:'Slay 10,000 enemies (lifetime)',    test:c=>c.lifeKills>=10000 },
  { id:'million',   icon:'💥', name:'Megaton',         desc:'Deal 1,000,000 damage (lifetime)',  test:c=>c.lifeDmg>=1000000 },
];

// ---------- Hero signature upgrades ----------
// Two per Guardian, each modifying only THAT hero's weapon (via per-hero mods).
// They appear in the level-up mystery pool once that Guardian is in play, and
// are one-time (leave the pool after being taken). Mods: dmg/rate/area/speed
// are multipliers; pierceAdd/countAdd/jumpsAdd are additive; exploadMul scales
// explosion radius. rate<1 = faster.
const HERO_UP = {
  bo:            [ ['🌈','Prism Fan','Two extra rainbow feathers',{countAdd:2}], ['🎯','Piercing Prism','Feathers pierce +2 enemies',{pierceAdd:2}] ],
  chocker:       [ ['☠️','Choking Cloud','+45% poison damage & area',{dmg:1.45,area:1.25}], ['💨','Wider Fumes','+35% reach & size',{area:1.35,speed:1.15}] ],
  chomper:       [ ['🦈','Wider Jaws','+35% bite arc & reach',{area:1.35}], ['⚡','Double Bite','Chomps 40% faster',{rate:0.6}] ],
  chunky:        [ ['🍌','Barrel Roll','+2 projectiles per throw',{countAdd:2}], ['🙌','Faster Hands','Throws 25% faster',{rate:0.75}] ],
  cliggy:        [ ['🥚','Colossal Yolk','+40% blast size & +25% damage',{area:1.4,dmg:1.25}], ['🍳','Double Clutch','Lays a second egg',{countAdd:1}] ],
  creeper:       [ ['👁️','Wide Stare','+45% beam width',{area:1.45}], ['🔴','Focused Stare','+45% beam damage',{dmg:1.45}] ],
  diver:         [ ['🗡️','Skewer Volley','Pierces +3 more enemies',{pierceAdd:3}], ['💨','Terminal Velocity','+30% speed & +20% damage',{speed:1.3,dmg:1.2}] ],
  fertle:        [ ['💥','Bigger Booms','+50% blast radius',{exploadMul:1.5,area:1.15}], ['🔥','Twin Shells','Fires a second shell',{countAdd:1}] ],
  fixie:         [ ['❄️','Icicle Storm','+2 icicles per volley',{countAdd:2}], ['🧊','Deep Freeze','+35% damage',{dmg:1.35}] ],
  flick:         [ ['🔥','Inferno Wake','+40% trail damage',{dmg:1.4}], ['🌋','Wider Blaze','+40% trail & shot area',{area:1.4}] ],
  fygar:         [ ['🗡️','Fang Barrage','+2 fangs per throw',{countAdd:2}], ['⚡','Blur Strike','Throws 30% faster',{rate:0.7}] ],
  gus:           [ ['🌀','Wider Coils','+40% crush radius',{area:1.4}], ['🐍','Crushing Grip','+50% crush damage',{dmg:1.5}] ],
  'peeta-heater':[ ['♨️','Steam Barrage','+1 jet & +2 pierce',{countAdd:1,pierceAdd:2}], ['🔥','Scalding','+40% damage',{dmg:1.4}] ],
  'roger-dodger':[ ['🪃','Twin Wings','Throws a second blade',{countAdd:1}], ['✨','Razor Wings','+45% damage',{dmg:1.45}] ],
  sixter:        [ ['⭐','Shrapnel Cloud','+6 shards per burst',{countAdd:6}], ['💢','Sharper Stars','+35% damage',{dmg:1.35}] ],
  skyjumper:     [ ['🌟','Stolen Constellation','+1 orbiting star',{countAdd:1}], ['💫','Wider Orbit','+30% orbit radius & size',{area:1.3}] ],
  snapper:       [ ['🦀','Thunderclap','+4 shockwave bolts',{countAdd:4}], ['💥','Harder Clap','+40% damage',{dmg:1.4}] ],
  stinger:       [ ['🔱','Longer Lance','+40% sweep reach',{area:1.4}], ['⚡','Rapid Drill','Sweeps 35% faster',{rate:0.65}] ],
  swack:         [ ['🌊','Twin Doorwave','Throws a second wave',{countAdd:1}], ['🏄','Tidal Wall','+40% wave size',{area:1.4}] ],
  waterwolf:     [ ['🌊','Full Tide','+4 tide slabs',{countAdd:4}], ['🐺','Heavier Tides','+40% damage',{dmg:1.4}] ],
  whipper:       [ ['🦇','Echo Swarm','+2 homing shrieks',{countAdd:2}], ['🔊','Piercing Echo','+40% damage',{dmg:1.4}] ],
  yellogen:      [ ['🔊','Double Screech','+1 bolt per screech',{countAdd:1}], ['💥','Shatterpoint','+40% damage',{dmg:1.4}] ],
  yelp:          [ ['🔵','Fourth Orb','+1 orbiting orb',{countAdd:1}], ['📢','Bigger Orbs','+40% orb size & reach',{area:1.4}] ],
  zappo:         [ ['⚡','Chain Reaction','Arc jumps to +2 more enemies',{jumpsAdd:2}], ['🌩️','Overvolt','+40% damage',{dmg:1.4}] ],
};

// Weapon evolution at Super Saiyan (tier 4): a permanent transform, applied by
// archetype in fireWeapon so it's one rule per weapon type, not per hero.
const EVO_NOTE = {
  shot:  'pierces more & fires an echo shot', nova: '+40% projectiles',
  orbit: '+2 orbiting bodies', aura: '+35% radius & damage',
  chain: '+2 chain jumps', beam: '+40% width', trail: 'bigger, longer-lasting patches',
  slash: 'wider, longer arc',
};
