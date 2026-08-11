#!/usr/bin/env node
// ============================================================
// Balitopia — music generation via the ElevenLabs Music API.
// SFX live in generate-sfx.js; this script never touches them.
//
//   node scripts/generate-music.js            # only missing/placeholder tracks
//   node scripts/generate-music.js --force    # regenerate everything
//   node scripts/generate-music.js title victory   # named tracks only
// ============================================================
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const https = require('https');

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error('❌ ELEVENLABS_API_KEY not found in .env');
  process.exit(1);
}

const AUDIO = path.join(__dirname, '../assets/audio');

// Every prompt is written as a *loop*: the game crossfades these under
// gameplay for minutes at a time, so a track with a big intro or a hard
// ending draws attention to the seam every time it wraps.
const STYLE = 'chiptune arcade game music, 8-bit and 16-bit synth leads, punchy square-wave bass, driving drum machine, no vocals, seamless loop';

const TRACKS = {
  'music/title': {
    ms: 40000,
    prompt: `Title screen theme for a tropical island arcade game. ${STYLE}. Bright and inviting, heroic major-key hook, mid tempo around 110 BPM, hopeful and adventurous, hints of steel drum and marimba over the synths.`,
  },
  'music/region-land': {
    ms: 60000,
    prompt: `Jungle battle stage loop. ${STYLE}. Fast 140 BPM, relentless driving groove, tribal percussion and marimba doubling the synth lead, humid overgrown jungle energy, urgent but fun to fight to.`,
  },
  'music/region-sea': {
    ms: 60000,
    prompt: `Ocean battle stage loop. ${STYLE}. 135 BPM, rolling wave-like arpeggios, watery chorused lead, deep sub bass swells, blue and open and buoyant, surging forward momentum.`,
  },
  'music/region-sky': {
    ms: 60000,
    prompt: `Sky battle stage loop. ${STYLE}. 145 BPM, soaring high-register lead, airy shimmering arpeggios, weightless floating feel with a fast propulsive drum pattern, bright crystalline tone.`,
  },
  'enemies/demonder': {
    ms: 45000,
    prompt: `Mid-boss battle loop. ${STYLE}. 150 BPM, dark minor key, ominous descending bassline, dissonant stabs, tense and threatening, builds dread without letting the groove drop.`,
  },
  'enemies/glob': {
    ms: 45000,
    prompt: `Final boss battle loop against a giant hungry king. ${STYLE}. 160 BPM, epic and overwhelming, huge chromatic bass riff, screaming lead, orchestral hits layered over the chiptune, climactic and desperate.`,
  },
  'music/victory': {
    ms: 12000,
    prompt: `Short victory fanfare. ${STYLE}. Triumphant ascending major-key fanfare, celebratory bells and sparkle, resolves cleanly on a big final chord. Not a loop — a complete flourish.`,
  },
  'music/bgm_gameover': {
    ms: 18000,
    prompt: `Game over theme. ${STYLE}. Slow 70 BPM, melancholy minor key, descending resigned melody, sparse and quiet, wistful rather than harsh. Not a loop — resolves and ends.`,
  },
};

// The API has moved around; try the documented shape first and fall back
// through the older ones so a rename doesn't cost another round trip.
const ATTEMPTS = [
  { path: '/v1/music', body: (t) => ({ prompt: t.prompt, music_length_ms: t.ms }) },
  { path: '/v1/music/compose', body: (t) => ({ prompt: t.prompt, music_length_ms: t.ms }) },
  { path: '/v1/music-generation', body: (t) => ({ prompt: t.prompt, music_length_ms: t.ms }) },
];

function post(apiPath, payload) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(payload));
    const req = https.request({
      hostname: 'api.elevenlabs.io',
      path: apiPath,
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
      timeout: 300000,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
    });
    req.on('timeout', () => req.destroy(new Error('timed out')));
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Remembered across tracks: once one endpoint answers, stop probing.
let liveEndpoint = null;

async function generate(name, track) {
  const candidates = liveEndpoint ? [liveEndpoint] : ATTEMPTS;
  let lastErr = '';
  for (const attempt of candidates) {
    const res = await post(attempt.path, attempt.body(track));
    if (res.status === 200) {
      liveEndpoint = attempt;
      const out = path.join(AUDIO, `${name}.mp3`);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, res.body);
      const kb = (res.body.length / 1024).toFixed(0);
      console.log(`✓ ${name}.mp3  (${kb} KB, ${(track.ms / 1000).toFixed(0)}s)`);
      return;
    }
    lastErr = `${res.status} ${res.body.toString().slice(0, 300)}`;
    // 404 means wrong URL — keep probing. Anything else is a real answer
    // from the right endpoint, so stop and report it.
    if (res.status !== 404) {
      liveEndpoint = attempt;
      break;
    }
  }
  throw new Error(lastErr);
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const only = args.filter((a) => !a.startsWith('--'));

  let names = Object.keys(TRACKS);
  if (only.length) names = names.filter((n) => only.some((o) => n.includes(o)));

  if (!force) {
    names = names.filter((n) => !fs.existsSync(path.join(AUDIO, `${n}.mp3`)));
    if (!names.length) {
      console.log('All music already present. Use --force to regenerate.');
      return;
    }
  }

  console.log(`🎵 Generating ${names.length} music track(s)…\n`);
  const failed = [];
  for (const name of names) {
    try {
      await generate(name, TRACKS[name]);
    } catch (e) {
      console.error(`✗ ${name}: ${e.message}`);
      failed.push(name);
    }
  }

  console.log(`\n✅ ${names.length - failed.length}/${names.length} generated`);
  if (failed.length) {
    console.log(`❌ failed: ${failed.join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
