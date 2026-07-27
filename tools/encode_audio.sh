#!/usr/bin/env bash
# ============================================================
# Balitopia — audio delivery pipeline
#
# WHY THIS EXISTS
# The source library is ~100 MB: 24 hero themes averaging 2.3 MB, 24 entrance
# stingers shipped as UNCOMPRESSED WAV (~550 KB each), plus region music. For a
# browser game with no install step that is a bounce risk: an instrumented
# session that tapped four heroes on the select screen pulled 13.5 MB.
#
# WHAT THIS PRODUCES
#   heroes/<id>.opus            96 kbps mono   full theme        ~0.5 MB  (was 2.3 MB)
#   heroes/<id>_preview.opus    96 kbps mono   12s hook          ~0.14 MB (used by the select screen)
#   heroes/<id>_entrance.opus   64 kbps mono   stinger           ~0.03 MB (was 0.55 MB WAV)
#   music/<name>.opus           112 kbps stereo                  ~1.2 MB
#   sfx/<name>.opus             64 kbps mono                     small
# plus .m4a (AAC) siblings, because Safari's Opus-in-MP4 support is recent and
# older iOS needs a fallback. audio.js feature-detects with canPlayType.
#
# EXPECTED RESULT: ~100 MB -> under 8 MB for a complete first session.
#
# USAGE:  tools/encode_audio.sh [--dry-run]
# Requires ffmpeg with libopus and aac.
# ============================================================
set -euo pipefail

cd "$(dirname "$0")/.."
SRC="assets/audio"
DRY=${1:-}

command -v ffmpeg >/dev/null || { echo "ffmpeg not found — install it first."; exit 1; }

run() {
  if [ "$DRY" = "--dry-run" ]; then echo "  would run: ffmpeg $*"; else
    ffmpeg -hide_banner -loglevel error -y "$@"
  fi
}

encode() {           # encode <in> <out-base> <bitrate> <channels>
  local in="$1" out="$2" br="$3" ch="$4"
  [ -f "$in" ] || return 0
  run -i "$in" -ac "$ch" -c:a libopus -b:a "$br" -vbr on "$out.opus"
  run -i "$in" -ac "$ch" -c:a aac    -b:a "$br" "$out.m4a"
}

echo "== hero themes (full + 12s preview hook) =="
for f in "$SRC"/heroes/*.mp3; do
  [ -f "$f" ] || continue
  case "$f" in *_preview*) continue;; esac
  id=$(basename "$f" .mp3)
  echo "  $id"
  encode "$f" "$SRC/heroes/$id" 96k 1
  # the hook: 12s from 20s in, with short fades so it loops pleasantly
  if [ "$DRY" != "--dry-run" ]; then
    ffmpeg -hide_banner -loglevel error -y -ss 20 -t 12 -i "$f" \
      -af "afade=t=in:st=0:d=0.4,afade=t=out:st=11.2:d=0.8" \
      -ac 1 -c:a libopus -b:a 96k "$SRC/heroes/${id}_preview.opus"
    ffmpeg -hide_banner -loglevel error -y -ss 20 -t 12 -i "$f" \
      -af "afade=t=in:st=0:d=0.4,afade=t=out:st=11.2:d=0.8" \
      -ac 1 -c:a aac -b:a 96k "$SRC/heroes/${id}_preview.m4a"
  fi
done

echo "== entrance stingers (WAV -> Opus: the single biggest win per file) =="
for f in "$SRC"/heroes/*_entrance.wav "$SRC"/enemies/*.wav; do
  [ -f "$f" ] || continue
  base="${f%.wav}"
  echo "  $(basename "$base")"
  encode "$f" "$base" 64k 1
done

echo "== region / menu music =="
for f in "$SRC"/music/*.mp3; do
  [ -f "$f" ] || continue
  base="${f%.mp3}"
  echo "  $(basename "$base")"
  encode "$f" "$base" 112k 2
done

echo "== sfx =="
for f in "$SRC"/sfx/*.mp3 "$SRC"/sfx/*.wav; do
  [ -f "$f" ] || continue
  base="${f%.*}"
  echo "  $(basename "$base")"
  encode "$f" "$base" 64k 1
done

echo
echo "Done. Original sizes vs encoded:"
du -sh "$SRC" 2>/dev/null || true
echo
echo "Next: point js/audio.js at the .opus/.m4a names, and make sure the deploy"
echo "manifest ships ONLY the encoded files (not the .mp3/.wav sources)."
