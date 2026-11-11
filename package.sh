#!/bin/sh
# Builds what goes on the Kindle, in build/:
#   Sudoku.sh    the launcher, with the library cover embedded as its "# Icon:" line
#   sudoku/      the app (and its uninstall script)
#   sudoku.zip   both, ready to unzip into the Kindle's "documents" folder
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
OUT="$HERE/build"

node "$HERE/test/engine.test.js" >/dev/null

rm -rf "$OUT"
mkdir -p "$OUT/sudoku"
cp "$HERE"/waf/config.xml "$HERE"/waf/index.html "$HERE"/waf/app.css "$HERE"/waf/app.js "$HERE"/waf/sudoku.js "$OUT/sudoku/"
cp "$HERE/kindle/uninstall" "$HERE/LICENSE" "$OUT/sudoku/"
awk -v icon="# Icon: data:image/png;base64,$(base64 < "$HERE/kindle/cover.png" | tr -d '\n')" \
  '{ print } /^# Author:/ { print icon }' "$HERE/kindle/Sudoku.sh" > "$OUT/Sudoku.sh"
chmod +x "$OUT/Sudoku.sh"
# Fixed timestamps and order, so the same sources give the same zip.
find "$OUT" -exec touch -t 202601010000 {} +
(cd "$OUT" && zip -q -X -r sudoku.zip Sudoku.sh sudoku)
echo "built: $OUT/sudoku.zip ($(shasum -a 256 "$OUT/sudoku.zip" | cut -d' ' -f1))"
