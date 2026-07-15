// ============================================================
// BALITOPIA — game data: story, heroes, enemies, upgrades
// ============================================================
'use strict';

const STORY = {
  intro: [
    `Far across the warm seas lies <em>Balitopia</em> — an island where the volcano sleeps politely, the surf is always up, and twenty-four <em>Guardians</em> keep the Balance of sun, sea, jungle and stone.`,
    `Then the mountain burped. From a crack beneath Mount Karang oozed <em>King Glob</em>, the Hunger That Walks — a grinning mountain of living slime that eats color, music, and everything in between. His spawn poured out with him: the cackling <em>Minyar</em> swarming the beaches, the horned <em>Demonders</em> stalking the jungle, and the colossal <em>Clubbos</em> flattening whole villages with one lazy swing.`,
    `One by one the Guardians fell, sealed inside cursed bamboo cages and scattered across the island — their trapped magic drip-feeding the King's bottomless appetite.`,
    `But cursed cages have one flaw the King never noticed: <em>they break from the outside.</em>`,
    `One Guardian slipped the ambush. You. Break every cage. Every Guardian you free fights at your side — and their body is yours to possess with a touch. Gather your kin, drown the horde, and when the ground begins to shake... make the Hunger go hungry.`
  ],
  victory: `King Glob wobbled, whimpered, and popped like a monsoon bubble — raining stolen color back over the island. The Guardians stood together on the black sand as the surf rolled in, gold again. Balitopia breathes. The Balance holds. (The volcano has promised to chew with its mouth closed from now on.)`,
  defeat: `The tide took you gently, as it takes all things. But deep in the jungle, bamboo creaks... a cage strains... and somewhere a Guardian opens their eyes. Balitopia is not finished. Neither are you.`
};

// ---------- Heroes ----------
// weapon types: shot, nova, orbit, aura, chain, beam, trail, slash
// shot flags: homing, boomerang, explode(r), split, slow(s), poison(dps), knock(px/s)
const HEROES = [
  { name:'Kai',      title:'Wave Rider',      desc:'A surfer who never touched a board — the waves carry him. His water blades slice clean through the horde.',
    skin:'#c68958', hair:'#1b2a4a', outfit:'#0288d1', accent:'#4fc3f7', hat:'band', hp:100, spd:190,
    weapons:[{ type:'shot', interval:.55, dmg:11, count:1, speed:430, spread:0, pierce:2, size:6, life:1.2, color:'#4fc3f7' }],
    power:'Tide Cutters — piercing water blades' },
  { name:'Ember',    title:'Flame Dancer',    desc:'She learned to dance in the volcano\'s throat. Everywhere she points, something catches fire.',
    skin:'#8d5524', hair:'#e64a19', outfit:'#bf360c', accent:'#ff7043', hat:'flower', hp:95, spd:190,
    weapons:[{ type:'shot', interval:.8, dmg:15, count:1, speed:340, spread:0, pierce:0, size:8, life:1.3, explode:62, color:'#ff7043' }],
    power:'Bloomfire — exploding fireballs' },
  { name:'Tika',     title:'Dart Sister',     desc:'Three blowdarts at once, always. She refuses to explain how, and nobody has survived asking twice.',
    skin:'#e0ac69', hair:'#3e2723', outfit:'#558b2f', accent:'#9ccc65', hat:'leaf', hp:90, spd:195,
    weapons:[{ type:'shot', interval:.5, dmg:7, count:3, speed:470, spread:.38, pierce:0, size:5, life:1.1, color:'#9ccc65' }],
    power:'Triple Sting — fanned dart volley' },
  { name:'Volt',     title:'Storm Child',     desc:'Born during the hundred-year storm. Lightning thinks he\'s family and does whatever he asks.',
    skin:'#ffdbac', hair:'#fdd835', outfit:'#f9a825', accent:'#ffee58', hat:'spike', hp:90, spd:195,
    weapons:[{ type:'chain', interval:.75, dmg:16, jumps:4, range:250, color:'#ffee58' }],
    power:'Arc Kiss — chain lightning' },
  { name:'Luna',     title:'Moon Guardian',   desc:'Keeps three small moons as pets. They orbit her out of loyalty and crush things out of love.',
    skin:'#f1e0d6', hair:'#d1c4e9', outfit:'#5e35b1', accent:'#b39ddb', hat:'crescent', hp:100, spd:185,
    weapons:[{ type:'orbit', interval:0, dmg:10, count:3, radius:82, rot:2.7, size:10, color:'#b39ddb' }],
    power:'Little Moons — orbiting crushers' },
  { name:'Thorn',    title:'Jungle Witch',    desc:'The jungle owes her favors. Her seeds bloom inside whatever they hit, which is rude but effective.',
    skin:'#a1665e', hair:'#33691e', outfit:'#4a148c', accent:'#8bc34a', hat:'hood', hp:95, spd:190,
    weapons:[{ type:'shot', interval:.7, dmg:6, count:1, speed:380, spread:0, pierce:1, size:6, life:1.3, poison:9, poisonT:2.5, color:'#8bc34a' }],
    power:'Venom Seeds — poison that keeps eating' },
  { name:'Baruk',    title:'Stone Fist',      desc:'Punched a landslide once. The landslide apologized. His stomps ripple outward in rings of shattered rock.',
    skin:'#7a5230', hair:'#4e342e', outfit:'#6d4c41', accent:'#a1887f', hat:'none', hp:135, spd:175,
    weapons:[{ type:'nova', interval:1.5, dmg:10, count:10, speed:270, size:7, life:.55, knock:230, color:'#a1887f' }],
    power:'Quake Ring — radial stone burst' },
  { name:'Zephyr',   title:'Wind Whisper',    desc:'Talks to the wind in a language of sighs. His blades always come back — the wind hates littering.',
    skin:'#d9b38c', hair:'#b2dfdb', outfit:'#00695c', accent:'#80cbc4', hat:'band', hp:95, spd:200,
    weapons:[{ type:'shot', interval:.9, dmg:11, count:1, speed:390, spread:0, pierce:99, size:8, life:1.6, boomerang:true, color:'#80cbc4' }],
    power:'Returning Gale — boomerang wind blades' },
  { name:'Frostine', title:'Ice Maiden',      desc:'The only cold thing on a tropical island, and she\'s smug about it. Her icicles slow everything they touch.',
    skin:'#f8ede3', hair:'#e1f5fe', outfit:'#0277bd', accent:'#81d4fa', hat:'crown', hp:95, spd:185,
    weapons:[{ type:'shot', interval:.65, dmg:8, count:2, speed:410, spread:.22, pierce:0, size:6, life:1.2, slow:2, color:'#81d4fa' }],
    power:'Chillspike — slowing icicles' },
  { name:'Blossom',  title:'Petal Priestess', desc:'Every step she takes, flowers apologize for existing so beautifully. Her petals shred like razors.',
    skin:'#eac086', hair:'#f06292', outfit:'#ad1457', accent:'#f48fb1', hat:'flower', hp:90, spd:190,
    weapons:[{ type:'nova', interval:1.1, dmg:5, count:14, speed:310, size:5, life:.85, color:'#f48fb1' }],
    power:'Petal Storm — 360° razor bloom' },
  { name:'Rex',      title:'Hammer King',     desc:'His hammer has a name (Doris) and a kill count (yes). Slow swings, but the island feels each one.',
    skin:'#c68642', hair:'#bf360c', outfit:'#e65100', accent:'#ffb74d', hat:'crown', hp:125, spd:172,
    weapons:[{ type:'shot', interval:1.3, dmg:36, count:1, speed:300, spread:0, pierce:1, size:12, life:1.4, knock:280, color:'#ffb74d' }],
    power:'Doris — colossal hammer throws' },
  { name:'Nia',      title:'Spirit Caller',   desc:'Ghosts follow her home like stray cats. She sends them out to fetch, and they always find something to bite.',
    skin:'#8d5524', hair:'#7b1fa2', outfit:'#4a148c', accent:'#ce93d8', hat:'hood', hp:90, spd:190,
    weapons:[{ type:'shot', interval:.8, dmg:9, count:2, speed:290, spread:1.2, pierce:0, size:7, life:2.2, homing:true, color:'#ce93d8' }],
    power:'Hungry Spirits — homing ghosts' },
  { name:'Surya',    title:'Sun Blade',       desc:'Carries a shard of noon in his scabbard. Draws it, and a line of daylight burns through everything.',
    skin:'#b06f37', hair:'#ffca28', outfit:'#f57f17', accent:'#ffd54f', hat:'spike', hp:95, spd:190,
    weapons:[{ type:'beam', interval:.9, dmg:14, length:540, width:15, color:'#ffd54f' }],
    power:'Noonfall — piercing solar ray' },
  { name:'Koda',     title:'Bear Heart',      desc:'Half hug, half avalanche. Standing near Koda is fatal — ask any Minyar. Oh wait, you can\'t.',
    skin:'#7a5230', hair:'#5d4037', outfit:'#4e342e', accent:'#bcaaa4', hat:'ears', hp:145, spd:178,
    weapons:[{ type:'aura', interval:.45, dmg:9, radius:112, color:'#bcaaa4' }],
    power:'Crush Field — grinding damage aura' },
  { name:'Mirah',    title:'Mirror Mage',     desc:'Argues with her reflection and wins. Her bolts shatter into silver shards on impact.',
    skin:'#f1c27d', hair:'#eceff1', outfit:'#546e7a', accent:'#e0e0e0', hat:'crescent', hp:90, spd:190,
    weapons:[{ type:'shot', interval:.85, dmg:10, count:1, speed:400, spread:0, pierce:0, size:7, life:1.2, split:true, color:'#e0e0e0' }],
    power:'Shatterlight — splitting mirror bolts' },
  { name:'Tembo',    title:'Thunder Hoof',    desc:'Part buffalo on his mother\'s side. When he stamps, eight slabs of thunder go looking for trouble.',
    skin:'#6b4423', hair:'#37474f', outfit:'#455a64', accent:'#90a4ae', hat:'horns', hp:130, spd:172,
    weapons:[{ type:'nova', interval:1.6, dmg:17, count:8, speed:230, size:9, life:.9, knock:160, color:'#90a4ae' }],
    power:'Stampede Ring — heavy thunder slabs' },
  { name:'Anjani',   title:'Sky Archer',      desc:'Shot an apple off a cloud\'s head at two miles. Her arrows go through problems, plural.',
    skin:'#e0ac69', hair:'#1b5e20', outfit:'#2e7d32', accent:'#aed581', hat:'band', hp:88, spd:195,
    weapons:[{ type:'shot', interval:1.0, dmg:28, count:1, speed:640, spread:0, pierce:4, size:5, life:1.5, color:'#aed581' }],
    power:'Skewer Shot — long piercing arrows' },
  { name:'Gado',     title:'Twin Fang',       desc:'Two daggers, zero patience. Blink and you\'ll miss forty throws. His enemies usually do.',
    skin:'#c68642', hair:'#b71c1c', outfit:'#880e4f', accent:'#ef9a9a', hat:'mask', hp:85, spd:205,
    weapons:[{ type:'shot', interval:.27, dmg:5, count:2, speed:520, spread:.1, pierce:0, size:4, life:.9, color:'#ef9a9a' }],
    power:'Fang Flurry — rapid twin daggers' },
  { name:'Rani',     title:'Royal Flame',     desc:'Royalty never looks back — which is fine, because behind Rani everything is on fire.',
    skin:'#8d5524', hair:'#ff8f00', outfit:'#c62828', accent:'#ff9e40', hat:'crown', hp:100, spd:192,
    weapons:[{ type:'trail', interval:.16, dmg:13, radius:36, patchLife:2.3, color:'#ff9e40' },
             { type:'shot', interval:.95, dmg:7, count:1, speed:380, spread:0, pierce:0, size:6, life:1.1, color:'#ff9e40' }],
    power:'Queen\'s Wake — burning trail' },
  { name:'Oto',      title:'Tide Turner',     desc:'Throws a wave the size of a door and catches it like a frisbee. The ocean finds this hilarious.',
    skin:'#a1665e', hair:'#006064', outfit:'#00838f', accent:'#4dd0e1', hat:'none', hp:110, spd:182,
    weapons:[{ type:'shot', interval:1.2, dmg:19, count:1, speed:310, spread:0, pierce:99, size:15, life:1.7, boomerang:true, color:'#4dd0e1' }],
    power:'Doorwave — giant returning wave' },
  { name:'Pip',      title:'Pocket Rogue',    desc:'Knee-high, all elbows, throws anything not nailed down at incredible speed. Mostly knives. Sometimes soup.',
    skin:'#ffdbac', hair:'#795548', outfit:'#5d4037', accent:'#fff176', hat:'hood', hp:82, spd:208,
    weapons:[{ type:'shot', interval:.18, dmg:6, count:1, speed:540, spread:.55, pierce:0, size:4, life:.9, color:'#fff176' }],
    power:'Junk Storm — chaotic rapid fire' },
  { name:'Wulan',    title:'Star Weaver',     desc:'Pulled five stars down on a bet and never gave them back. They spin around her, still furious.',
    skin:'#f1e0d6', hair:'#283593', outfit:'#1a237e', accent:'#fff59d', hat:'crescent', hp:95, spd:188,
    weapons:[{ type:'orbit', interval:0, dmg:7, count:5, radius:108, rot:3.5, size:7, color:'#fff59d' }],
    power:'Stolen Stars — fast orbiting ring' },
  { name:'Grum',     title:'Old Guard',       desc:'Retired twice, un-retired three times. His spear sweep has ended more arguments than diplomacy.',
    skin:'#d9b38c', hair:'#cfd8dc', outfit:'#37474f', accent:'#b0bec5', hat:'none', hp:155, spd:168,
    weapons:[{ type:'slash', interval:.8, dmg:19, radius:98, arc:2.4, color:'#b0bec5' }],
    power:'Veteran Sweep — wide spear arcs' },
  { name:'Sena',     title:'Ghost Blade',     desc:'Nobody has seen the blade. They see the before, then the after. Sena bows politely in between.',
    skin:'#eac086', hair:'#eceff1', outfit:'#263238', accent:'#90caf9', hat:'mask', hp:92, spd:198,
    weapons:[{ type:'slash', interval:.62, dmg:27, radius:135, arc:1.5, color:'#90caf9' }],
    power:'Unseen Cut — long lethal slashes' },
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

const ENEMIES = {
  minyar:   { hp:9,   spd:62, dmg:8,  xp:1,  r:13, base:2.2 },
  demonder: { hp:130, spd:46, dmg:18, xp:8,  r:20, base:2.2 },
  clubbo:   { hp:640, spd:32, dmg:34, xp:30, r:30, base:2.4 },
};

const BOSS = { hp:16000, spd:40, dmg:45, r:66, xp:0 };
const BOSS_TIME = 480;          // King Glob arrives at 8:00
const CAGE_HP = 70;

// ---------- Upgrades ----------
const UPGRADES = [
  { id:'power',  icon:'💥', name:'Guardian Power', desc:'+20% damage for you and every freed Guardian', apply:m=>m.dmg*=1.2 },
  { id:'haste',  icon:'⚡', name:'Battle Haste',   desc:'Attack 12% faster',                            apply:m=>m.rate*=0.88 },
  { id:'swift',  icon:'👟', name:'Swift Feet',     desc:'+10% move speed',                              apply:m=>m.spd*=1.1 },
  { id:'vital',  icon:'❤️', name:'Vitality',       desc:'+25 max HP and heal 50%',                      apply:(m,g)=>{ m.hpBonus+=25; g.healPct(.5); } },
  { id:'allies', icon:'🤝', name:'War Chorus',     desc:'Freed Guardians deal +30% damage',             apply:m=>m.ally*=1.3 },
  { id:'magnet', icon:'🧲', name:'Spirit Magnet',  desc:'+35% pickup range',                            apply:m=>m.magnet*=1.35 },
  { id:'regen',  icon:'🌿', name:'Island Blessing',desc:'Regenerate +1.2 HP per second',                apply:m=>m.regen+=1.2 },
  { id:'area',   icon:'🌀', name:'Wide Wrath',     desc:'+15% attack area & projectile size',           apply:m=>m.area*=1.15 },
];
