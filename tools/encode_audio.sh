#!/usr/bin/env bash
# ============================================================
# Balitopia — audio delivery pipeline
#
# WHY THIS EXISTS
# The source library is ~100 MB and the shapes are pathological for a browser
# game with no install step:
#   * 24 hero themes are full 3:50 songs at 182 kb/s stereo (~2.3 MB each,
#     54.6 MB total) — and they are only ever used as short previews.
#   * 24 entrance stingers are 3 seconds of UNCOMPRESSED PCM at 1536 kb/s
#     (~550 KB each for three seconds of audio).
# An instrumented session that tapped four heroes on the select screen pulled
# 13.5 MB before the player had fought anything.
#
# WHAT THIS PRODUCES  (both Opus and AAC — Safari's Opus support is recent,
# and audio.js feature-detects with canPlayType so only one is ever fetched)
#   heroes/<id>_preview.{opus,m4a}    14s hook, 96k mono   ~170 KB  (was 2.3 MB)
#   heroes/<id>_entrance.{opus,m4a}   stinger, 64k mono    ~25 KB   (was 550 KB)
#   enemies/<name>.{opus,m4a}         96k stereo
#   music/<name>.{opus,m4a}           80k stereo
#   sfx/<name>.{opus,m4a}             64k mono
#
# The full hero songs are NOT shipped: the 14s hook serves both the select
# screen preview and the possession flourish, which is every use the game has.
# The originals stay in the repo as masters; tools/build.sh excludes them.
#
# USAGE:  tools/encode_audio.sh [--dry-run]
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."
DRY="${1:-}"
SRC="assets/audio"

# ffmpeg from PATH, or the npm ffmpeg-static package if it's around
FF="$(command -v ffmpeg || true)"
for c in node_modules/ffmpeg-static/ffmpeg ../node_modules/ffmpeg-static/ffmpeg; do
  [ -z "$FF" ] && [ -x "$c" ] && FF="$c"
done
[ -n "$FF" ] || { echo "ffmpeg not found. Install it, or: npm i ffmpeg-static"; exit 1; }
echo "using: $FF"
"$FF" -hide_banner -encoders 2>/dev/null | grep -q libopus || { echo "this ffmpeg has no libopus"; exit 1; }

run() { if [ "$DRY" = "--dry-run" ]; then echo "    ffmpeg $*"; else "$FF" -hide_banner -loglevel error -y "$@"; fi; }

# encode <in> <out-base> <bitrate> <channels>
# PRE=(...) sets args that must precede -i (seeking); AF sets the audio filter.
# ffmpeg is position-sensitive: -ss/-t before the input, -af after it.
PRE=(); AF=""
encode() {
  local in="$1" out="$2" br="$3" ch="$4"
  [ -f "$in" ] || return 0
  local filt=(); [ -n "$AF" ] && filt=(-af "$AF")
  run "${PRE[@]}" -i "$in" -vn -map_metadata -1 "${filt[@]}" -ac "$ch" -c:a libopus -b:a "$br" -vbr on "$out.opus"
  run "${PRE[@]}" -i "$in" -vn -map_metadata -1 "${filt[@]}" -ac "$ch" -c:a aac -b:a "$br" -movflags +faststart "$out.m4a"
}

before=$(du -sm "$SRC" | cut -f1)

echo "== hero themes -> 14s preview hooks (the only form the game uses) =="
for f in "$SRC"/heroes/*.mp3; do
  [ -f "$f" ] || continue
  case "$f" in *_preview*) continue;; esac
  id=$(basename "$f" .mp3)
  printf '  %-16s' "$id"
  # start 18s in (past most intros), 14s long, gentle fades so it loops well
  PRE=(-ss 18 -t 14); AF="afade=t=in:st=0:d=0.5,afade=t=out:st=13:d=1.0,loudnorm=I=-16:TP=-1.5:LRA=11"
  encode "$f" "$SRC/heroes/${id}_preview" 96k 1
  PRE=(); AF=""
  [ "$DRY" = "--dry-run" ] || echo "$(du -k "$SRC/heroes/${id}_preview.opus" | cut -f1) KB"
done

echo "== entrance stingers (uncompressed PCM -> Opus: biggest win per file) =="
for f in "$SRC"/heroes/*_entrance.wav "$SRC"/enemies/*.wav; do
  [ -f "$f" ] || continue
  base="${f%.wav}"
  printf '  %-26s' "$(basename "$base")"
  encode "$f" "$base" 64k 1
  [ "$DRY" = "--dry-run" ] || echo "$(du -k "$base.opus" | cut -f1) KB"
done

echo "== enemy / boss themes =="
for f in "$SRC"/enemies/*.mp3; do
  [ -f "$f" ] || continue
  base="${f%.mp3}"
  printf '  %-20s' "$(basename "$base")"
  AF="loudnorm=I=-18:TP=-2:LRA=11"; encode "$f" "$base" 96k 2; AF=""
  [ "$DRY" = "--dry-run" ] || echo "$(du -k "$base.opus" | cut -f1) KB"
done

echo "== music =="
for f in "$SRC"/music/*.mp3; do
  [ -f "$f" ] || continue
  base="${f%.mp3}"
  printf '  %-20s' "$(basename "$base")"
  AF="loudnorm=I=-18:TP=-2:LRA=11"; encode "$f" "$base" 80k 2; AF=""
  [ "$DRY" = "--dry-run" ] || echo "$(du -k "$base.opus" | cut -f1) KB"
done

echo "== sfx =="
for f in "$SRC"/sfx/*.mp3 "$SRC"/sfx/*.wav; do
  [ -f "$f" ] || continue
  base="${f%.*}"
  printf '  %-20s' "$(basename "$base")"
  encode "$f" "$base" 64k 1
  [ "$DRY" = "--dry-run" ] || echo "$(du -k "$base.opus" | cut -f1) KB"
done

if [ "$DRY" != "--dry-run" ]; then
  enc=$(find "$SRC" \( -name '*.opus' -o -name '*.m4a' \) -printf '%s\n' | awk '{s+=$1} END {print int(s/1048576)}')
  echo
  echo "sources: ${before} MB   encoded: ${enc} MB (both formats; a browser fetches one)"
  echo "Run tools/build.sh — it ships only the encoded set."
fi
