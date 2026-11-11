#!/bin/sh
# KindleForge package: downloads the latest release, checks that the download
# is complete, and puts it in "documents". The saved game and the stats are kept.
set -e

TMPDIR=/mnt/us/KFPM-Temporary
BASE=https://github.com/agarciab28/kindle-sudoku/releases/latest/download
rm -rf "$TMPDIR"
mkdir -p "$TMPDIR"

curl -fSL --progress-bar -o "$TMPDIR/sudoku.zip" "$BASE/sudoku.zip"
curl -fsSL -o "$TMPDIR/sudoku.zip.sha256" "$BASE/sudoku.zip.sha256"
if ! (cd "$TMPDIR" && sha256sum -c sudoku.zip.sha256 >/dev/null); then
  echo "sudoku.zip does not match its checksum; nothing was installed."
  rm -rf "$TMPDIR"
  exit 1
fi
unzip -oq "$TMPDIR/sudoku.zip" -d "$TMPDIR"

mkdir -p /mnt/us/documents/sudoku
cp -r "$TMPDIR/sudoku"/* /mnt/us/documents/sudoku/
cp "$TMPDIR/Sudoku.sh" /mnt/us/documents/
chmod +x /mnt/us/documents/Sudoku.sh

rm -rf "$TMPDIR"

exit 0
