#!/bin/bash
# 고슴이 홈페이지 전체 빌드: 페이지 → 글꼴(쓰인 글자만) → 공유 미리보기 그림 → 올릴 파일 목록
#   bash _tools/site/make.sh           앱(www/index.html) 데이터로 다시 만든다
#   bash _tools/site/make.sh --shots   앱 화면이 바뀌었을 때: 랜딩의 폰 화면 사진까지 다시 찍는다
# 결과는 $OUT(기본 /tmp/goseumi-site-out)에만 생긴다 — 저장소는 건드리지 않는다. 올리는 법은 README.md
set -euo pipefail
TOOLS="$(cd "$(dirname "$0")" && pwd)"
export REPO="${REPO:-$(cd "$TOOLS/../.." && pwd)}"
export OUT="${OUT:-/tmp/goseumi-site-out}"
export APP_DIR="${APP_DIR:-$REPO/www}"
export WORK="${WORK:-/tmp/goseumi-site-work}"
case "$OUT" in /|"$REPO"|"$REPO"/*|"$HOME") echo "OUT이 위험한 위치예요: $OUT"; exit 1;; esac

# 준비물 — 한 번만 설치된다
[ -d "$TOOLS/node_modules/playwright" ] && [ -d "$TOOLS/node_modules/pretendard" ] || (cd "$TOOLS" && npm install --no-audit --no-fund)
python3 -c "import fontTools, brotli, PIL" 2>/dev/null || pip install -q --break-system-packages fonttools brotli pillow

rm -rf "$OUT"; mkdir -p "$OUT" "$WORK"
node "$TOOLS/src/build.mjs" "$APP_DIR/index.html" "$OUT"
python3 "$TOOLS/src/subset_font.py" "$OUT"
if [ "${1:-}" = "--shots" ]; then
  node "$TOOLS/src/shots.mjs"
  python3 "$TOOLS/src/shots_webp.py"
fi
node "$TOOLS/src/og.mjs"
python3 "$TOOLS/src/changed.py"
echo; echo "만든 곳: $OUT   ·   검사: node $TOOLS/src/sitetest.mjs"
