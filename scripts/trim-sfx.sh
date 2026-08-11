#!/usr/bin/env bash
# ============================================================
# Balitopia — trim generated SFX down to their first take.
#
# The ElevenLabs sound-generation endpoint fills the whole requested
# duration with several variations of the effect separated by silence, so
# a 20s request comes back as roughly four takes of a 0.6s sound. Shipped
# as-is, every hit spawns a 20-second element and overlapping hits stack
# 20-second tails — and the encoded set balloons from 8 KB per cue to 168 KB.
#
# This keeps take one, fades it out, normalises the level and drops the rest.
# Idempotent: a file already under its cap is left alone, so re-running after
# generating a single new sound is safe.
#
# USAGE:  scripts/trim-sfx.sh [name ...]     (default: every cue listed below)
# ============================================================
set -eu
# NOTE: deliberately no `pipefail`. Every probe below ends in `head -1`, which
# closes the pipe early and leaves ffmpeg with a SIGPIPE status; under pipefail
# that propagates through the assignment and `set -e` kills the run before the
# first file is touched.
cd "$(dirname "$0")/.."

FF="$(command -v ffmpeg || true)"
[ -z "$FF" ] && [ -x node_modules/ffmpeg-static/ffmpeg ] && FF=node_modules/ffmpeg-static/ffmpeg
[ -n "$FF" ] || { echo "ffmpeg not found. npm i ffmpeg-static"; exit 1; }

SFX=assets/audio/sfx

# Per-cue ceiling in seconds. Anything that reads as an impact stays short so
# it can retrigger cleanly; the charge and arrival cues are allowed to breathe.
cap_for() {
  case "$1" in
    powershot-charge|boss-appear) echo 2.5 ;;
    guardian-freed|levelup|death) echo 2.0 ;;
    cage-break|shield-break|possession|powershot-fire) echo 1.5 ;;
    *) echo 1.0 ;;
  esac
}

NAMES=("$@")
if [ ${#NAMES[@]} -eq 0 ]; then
  NAMES=(enemy-hit-1 enemy-hit-2 enemy-hit-3 player-damage levelup cage-break \
         guardian-freed dash powershot-charge powershot-fire combo-hit \
         boss-appear button-click shield-break death possession)
fi

for name in "${NAMES[@]}"; do
  f="$SFX/$name.mp3"
  [ -f "$f" ] || { printf '  %-18s (missing, skipped)\n' "$name"; continue; }

  dur=$("$FF" -hide_banner -i "$f" 2>&1 | sed -n 's/.*Duration: \([0-9:.]*\).*/\1/p' | head -1 \
        | awk -F: '{print ($1*3600)+($2*60)+$3}')
  cap=$(cap_for "$name")

  # already short enough — nothing to do
  if awk "BEGIN{exit !($dur <= $cap + 0.05)}"; then
    printf '  %-18s %ss (already trimmed)\n' "$name" "$dur"
    continue
  fi

  # Several of these files open with up to two seconds of silence before the
  # first take, so the cut has to find where the sound *starts* as well as
  # where it ends — trimming from zero would have shipped silent cues.
  ev=$("$FF" -hide_banner -i "$f" -af silencedetect=noise=-45dB:d=0.12 -f null - 2>&1 \
       | sed -n 's/.*silence_\(start\|end\): \([0-9.]*\).*/\1 \2/p') || true

  read -r start len <<EOF
$(printf '%s\n' "$ev" | awk -v cap="$cap" -v dur="$dur" '
    $1 == "start" { n++; s[n] = $2 }
    $1 == "end"   { e[n] = $2 }
    END {
      # a silence starting at (or within a frame of) zero is lead-in
      begin = (n > 0 && s[1] <= 0.05 && e[1] != "") ? e[1] : 0
      # the take ends at the first silence that begins after the sound does
      stop = dur
      for (i = 1; i <= n; i++) if (s[i] > begin + 0.02) { stop = s[i]; break }
      L = stop - begin
      if (L > cap) L = cap
      if (L < 0.15) L = 0.15
      printf "%.3f %.3f", begin, L
    }')
EOF

  fade=$(awk "BEGIN{f=0.06; s=$len-f; if(s<0)s=0; printf \"%.3f\", s}")
  tmp="$SFX/.$name.trim.mp3"
  "$FF" -hide_banner -loglevel error -y -ss "$start" -t "$len" -i "$f" \
        -af "afade=t=out:st=$fade:d=0.06,loudnorm=I=-16:TP=-1.5:LRA=11" \
        -c:a libmp3lame -q:a 4 "$tmp"
  mv "$tmp" "$f"
  printf '  %-18s %ss -> %ss (from %ss)\n' "$name" "$dur" "$len" "$start"
done

echo
echo "Re-run tools/encode_audio.sh to refresh the shipped .opus/.m4a set."
