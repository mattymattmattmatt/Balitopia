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

const OUTPUT_DIR = path.join(__dirname, '../assets/audio/sfx');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Arcade/chiptune sound effects to generate
const SOUNDS = {
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

async function generateSound(name, description) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      text: description,
      duration_seconds: 4,
      prompt_influence: 0.3,
    });

    const options = {
      hostname: 'api.elevenlabs.io',
      path: '/v1/sound-generation',
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
          const outputPath = path.join(OUTPUT_DIR, `${name}.mp3`);
          fs.writeFileSync(outputPath, responseData);
          console.log(`✓ ${name}.mp3`);
          resolve();
        } else {
          const error = responseData.toString();
          console.error(`✗ ${name}: ${res.statusCode} - ${error}`);
          reject(new Error(`Failed to generate ${name}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🎵 Generating Balitopia arcade sound effects...\n');

  let successful = 0;
  let failed = 0;

  for (const [name, description] of Object.entries(SOUNDS)) {
    try {
      await generateSound(name, description);
      successful++;
      // Rate limit: 100ms between requests
      await new Promise(r => setTimeout(r, 100));
    } catch (error) {
      console.error(`Error generating ${name}:`, error.message);
      failed++;
    }
  }

  console.log(`\n✅ Generated ${successful} sounds`);
  if (failed > 0) console.log(`❌ Failed ${failed} sounds`);
}

main().catch(console.error);
