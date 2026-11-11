#!/bin/sh
# KindleForge package: downloads the latest release and puts it in "documents".
set -e

TMPDIR=/mnt/us/KFPM-Temporary
mkdir -p "$TMPDIR"

curl -fSL --progress-bar -o "$TMPDIR/sudoku.zip" https://github.com/agarciab28/kindle-sudoku/releases/latest/download/sudoku.zip
unzip -oq "$TMPDIR/sudoku.zip" -d "$TMPDIR"

mkdir -p /mnt/us/documents/sudoku
cp -r "$TMPDIR/sudoku"/* /mnt/us/documents/sudoku/
cp "$TMPDIR/Sudoku.sh" /mnt/us/documents/
chmod +x /mnt/us/documents/Sudoku.sh

rm -rf "$TMPDIR"

exit 0
