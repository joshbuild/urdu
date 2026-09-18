#!/usr/bin/env bash
# f03 s02 — regenerate the served Nastaliq subset from the Google Fonts download.
#
# Input:  font/Noto_Nastaliq_Urdu.zip  (from fonts.google.com; not checked in)
# Output: public/fonts/noto-nastaliq-urdu-subset.woff2  (checked in)
#
# Needs Python with fonttools and brotli:  pip install "fonttools[woff]"
#
# Only the Regular weight is served — the reader renders one weight, and
# Nastaliq faces are large. The subset keeps the Arabic block and the joining
# controls and drops Latin entirely; @font-face declares a matching
# unicode-range, so Latin runs fall back to system-ui by design rather than by
# accident. Layout features are kept whole (--layout-features='*'): Nastaliq is
# almost entirely GSUB/GPOS, and dropping features destroys the script.
set -euo pipefail

cd "$(dirname "$0")/.."

ZIP=font/Noto_Nastaliq_Urdu.zip
TTF=font/static/NotoNastaliqUrdu-Regular.ttf
OUT=public/fonts/noto-nastaliq-urdu-subset.woff2

[ -f "$ZIP" ] || { echo "missing $ZIP — download Noto Nastaliq Urdu from fonts.google.com" >&2; exit 1; }

unzip -o -q "$ZIP" "static/NotoNastaliqUrdu-Regular.ttf" "OFL.txt" -d font/
cp font/OFL.txt public/fonts/OFL.txt

python -m fontTools.subset "$TTF" \
  --output-file="$OUT" \
  --flavor=woff2 \
  --layout-features='*' \
  --unicodes="U+0020,U+00A0,U+0600-06FF,U+200C-200D,U+2010-2014,U+2018-201D,U+2026"

ls -l "$OUT"
