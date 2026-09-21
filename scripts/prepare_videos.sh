#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MEDIA="$ROOT/media"
mkdir -p "$MEDIA"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "[ERROR] ffmpeg not found. Install with: sudo apt install ffmpeg"
  exit 1
fi

copy_as_mp4() {
  local src="$1"
  local dst="$2"
  if [[ ! -f "$src" ]]; then
    echo "[WARN] missing: $src"
    return 0
  fi
  echo "[VIDEO] $src -> $dst"
  ffmpeg -y -hide_banner -loglevel warning \
    -i "$src" -map 0:v:0 -map '0:a?' \
    -c copy -movflags +faststart "$dst"
}

copy_as_mp4 "/home/lee/FAST-LIO2_FULL_office_record.mkv" "$MEDIA/fastlio2.mp4"
copy_as_mp4 "/home/lee/LIO-SAM_OFF_FULL_office_record.mkv" "$MEDIA/liosam_off.mp4"
copy_as_mp4 "/home/lee/LIO-SAM_ON_FULL_office_record.mkv" "$MEDIA/liosam_on.mp4"

echo "[OK] Video preparation complete."
ls -lh "$MEDIA"/*.mp4 2>/dev/null || true
