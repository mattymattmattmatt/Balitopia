#!/usr/bin/env bash
# ============================================================
# Balitopia — deploy build.
#
# WHY: the repository carries ~110 MB the GAME never loads —
#   assets/3d/   (50 MB, 28 .glb models)  — referenced by nothing
#   assets/art/  (60 MB, 1024px+ sources) — referenced only by tools/compose_*.js
# A naive folder copy ships all of it. This produces a dist/ containing exactly
# what index.html, the service worker and the sprite/audio loaders ask for.
#
# USAGE: tools/build.sh [outdir]        (default: dist)
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-dist}"

rm -rf "$OUT"
mkdir -p "$OUT"

# --- app shell ---
cp index.html manifest.json sw.js "$OUT/"
mkdir -p "$OUT/css" "$OUT/js"
cp css/*.css "$OUT/css/"
cp js/*.js "$OUT/js/"

# --- images the game actually loads ---
mkdir -p "$OUT/assets/img/portraits" "$OUT/assets/img/heroes" "$OUT/assets/img/enemies"
cp assets/img/portraits/*.webp   "$OUT/assets/img/portraits/"
cp assets/img/heroes/*.png       "$OUT/assets/img/heroes/"
cp assets/img/enemies/*.png      "$OUT/assets/img/enemies/"
cp assets/img/title_vs.jpg assets/img/story_bg.jpg "$OUT/assets/img/"
cp assets/img/poster_*.jpg       "$OUT/assets/img/"
cp assets/img/icon-*.png         "$OUT/assets/img/"

# --- audio: prefer encoded (.opus/.m4a) if tools/encode_audio.sh has been run ---
mkdir -p "$OUT/assets/audio/heroes" "$OUT/assets/audio/enemies" "$OUT/assets/audio/music" "$OUT/assets/audio/sfx"
copy_audio() {                       # copy_audio <subdir>
  local d="$1" n=0
  for ext in opus m4a; do
    if compgen -G "assets/audio/$d/*.$ext" >/dev/null; then
      cp assets/audio/"$d"/*."$ext" "$OUT/assets/audio/$d/"; n=1
    fi
  done
  if [ "$n" = 0 ]; then
    echo "  ! $d: no encoded audio — shipping raw sources (much larger)."
    echo "    Run tools/encode_audio.sh first."
    cp assets/audio/"$d"/* "$OUT/assets/audio/$d/" 2>/dev/null || true
  fi
}
# The full hero songs are masters only: the game plays the 14s _preview cut for
# both the select screen and the possession flourish, so a 2.3 MB track per
# Guardian never needs to reach a player.
for d in heroes enemies music sfx; do copy_audio "$d"; done
cp assets/audio/sfx/manifest.json "$OUT/assets/audio/sfx/" 2>/dev/null || true

# --- face-card idle videos (small, and actually used) ---
if [ -d assets/video ]; then mkdir -p "$OUT/assets/video"; cp assets/video/*.mp4 "$OUT/assets/video/"; fi

echo
echo "Built $OUT"
du -sh "$OUT"
echo "(repo total: $(du -sh --exclude=.git --exclude=dist . | cut -f1))"
echo
echo "Excluded on purpose: assets/3d, assets/art, tools/, docs."
