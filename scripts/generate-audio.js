#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const https = require('https');

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error('❌ ELEVENLABS_API_KEY not found in .env');
  process.exit(1);
}

const SFX_DIR = path.join(__dirname, '../assets/audio/sfx');
const MUSIC_DIR = path.join(__dirname, '../assets/audio/music');
const ENEMIES_DIR = path.join(__dirname, '../assets/audio/enemies');

[SFX_DIR, MUSIC_DIR, ENEMIES_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Sound effects for the SFX manifest
const SFX_LIST = [
  'enemy-hit-1', 'enemy-hit-2', 'enemy-hit-3',
  'player-damage', 'levelup', 'cage-break', 'guardian-freed',
  'dash', 'powershot-charge', 'powershot-fire',
  'combo-hit', 'boss-appear', 'button-click',
  'shield-break', 'death', 'possession'
];

// Music and longer audio tracks
const MUSIC_TRACKS = {
  'music/region-land.mp3': 'Arcade chiptune battle music, fast-paced upbeat dance rhythm, tropical island theme, loopable 30 second loop',
  'music/region-sea.mp3': 'Arcade chiptune battle music, oceanic waves theme, upbeat synth melody, maritime adventure, loopable 30 second loop',
  'music/region-sky.mp3': 'Arcade chiptune battle music, ethereal celestial theme, floating through clouds, epic synth, loopable 30 second loop',
  'music/title.mp3': 'Arcade chiptune title screen music, heroic fanfare, vibrant energetic tune, welcoming bright melody, 30 seconds',
  'music/bgm_gameover.mp3': 'Arcade sad game over music, minor key descending melody, melancholic chiptune, defeat theme, 25 seconds',
  'music/victory.mp3': 'Arcade victory fanfare, triumphant uplifting chime, celebratory notes, heroic synth, 20 seconds',
  'enemies/demonder.mp3': 'Arcade boss battle theme, dark ominous arcade synth, intense threatening music, scary enemy encounter, loopable 30 second',
  'enemies/glob.mp3': 'Arcade final boss theme, intense epic arcade music, powerful dramatic synth, climactic battle music, loopable 30 second',
};

async function generateAudio(outputPath, description, isMusic = false) {
  return new Promise((resolve, reject) => {
    // ElevenLabs max duration is 30 seconds
    let duration = 20;
    if (description.includes('30')) duration = 30;
    else if (description.includes('25')) duration = 25;

    const data = JSON.stringify({
      text: description,
      duration_seconds: duration,
      prompt_influence: 0.3,
    });

    const endpoint = isMusic ? '/v1/generate-music' : '/v1/sound-generation';
    const options = {
      hostname: 'api.elevenlabs.io',
      path: endpoint,
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = https.request(options, (res) => {
      let responseData = Buffer.alloc(0);

      res.on('data', (chunk) => {
        responseData = Buffer.concat([responseData, chunk]);
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          fs.writeFileSync(outputPath, responseData);
          const name = path.basename(outputPath);
          console.log(`✓ ${name}`);
          resolve();
        } else {
          const error = responseData.toString();
          console.error(`✗ ${path.basename(outputPath)}: ${res.statusCode} - ${error}`);
          reject(new Error(`Failed to generate ${outputPath}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🎵 Generating Balitopia audio (SFX + music)...\n');

  let successful = 0;
  let failed = 0;
  const allTracks = { ...MUSIC_TRACKS };

  // Add SFX descriptions
  const SFX_DESCRIPTIONS = {
    'enemy-hit-1': 'Arcade coin collect sound, bright cheerful ping',
    'enemy-hit-2': 'Arcade laser zap sound, crisp electronic beep',
    'enemy-hit-3': 'Retro video game pop sound, short bright burst',
    'player-damage': 'Arcade hurt sound, descending pitch electronic buzz',
    'levelup': 'Arcade fanfare chime, ascending musical notes, celebratory',
    'cage-break': 'Arcade glass shatter sound, metallic crashing arcade style',
    'guardian-freed': 'Arcade unlock sound, triumphant chime with sparkle',
    'dash': 'Arcade whoosh sound, fast electronic swish movement',
    'powershot-charge': 'Arcade charging sound, rising pitch electronic hum',
    'powershot-fire': 'Arcade explosion sound, loud bright arcade blaster shot',
    'combo-hit': 'Arcade combo multiplier sound, exciting digital ding',
    'boss-appear': 'Arcade boss theme dramatic sound, imposing arcade synth stab',
    'button-click': 'Arcade menu beep, light crisp electronic click',
    'shield-break': 'Arcade shield down sound, descending arcade beep cascade',
    'death': 'Arcade game over sound, sad descending electronic notes',
    'possession': 'Arcade power-up sound, magical ascending arcade chime',
  };

  for (const name of SFX_LIST) {
    allTracks[`sfx/${name}.mp3`] = SFX_DESCRIPTIONS[name];
  }

  console.log(`Generating ${Object.keys(allTracks).length} audio tracks...\n`);

  for (const [outputPath, description] of Object.entries(allTracks)) {
    try {
      const fullPath = path.join(__dirname, '../assets/audio', outputPath);
      const isMusic = outputPath.startsWith('music/') || outputPath.startsWith('enemies/');
      await generateAudio(fullPath, description, isMusic);
      successful++;
      await new Promise(r => setTimeout(r, 100));
    } catch (error) {
      console.error(`Error generating ${outputPath}:`, error.message);
      failed++;
    }
  }

  // Update SFX manifest
  console.log('\n📝 Updating SFX manifest...');
  const manifest = [
    'ui_click', 'ui_back', 'ui_select', 'shoot', 'hit', 'kill', 'gem', 'heal',
    'levelup', 'tierup', 'power_ready', 'powershot', 'hurt',
    ...SFX_LIST
  ];
  fs.writeFileSync(
    path.join(SFX_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  console.log('✓ manifest.json updated');

  console.log(`\n✅ Generated ${successful} audio files`);
  if (failed > 0) console.log(`❌ Failed ${failed} files`);
  console.log('\n🎮 Audio is ready to use!');
}

main().catch(console.error);
