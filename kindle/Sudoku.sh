#!/bin/sh
# Name: Sudoku
# Author: agarciab28
# Sudoku for Kindle. This launcher installs the app the first time (and after an
# update) and then opens it. It only touches its own files and its own rows in
# the Kindle's app registry.
SRC=/mnt/us/documents/sudoku
WAF=/var/local/mesquite/sudoku
DB=/var/local/appreg.db
ID=com.alexgar.sudoku
CMD="/usr/bin/mesquite -l $ID -c file://$WAF/"

if [ ! -f "$SRC/index.html" ]; then
  echo "Sudoku: falta la carpeta 'sudoku' junto a este archivo (documents/sudoku)."
  echo "Sudoku: the 'sudoku' folder must be next to this file (documents/sudoku)."
  exit 1
fi

# 1. The app's files, next to the Kindle's own web apps. Copied only when they change.
mkdir -p "$WAF" || exit 1
for f in config.xml index.html app.css app.js sudoku.js; do
  cmp -s "$SRC/$f" "$WAF/$f" 2>/dev/null || cp "$SRC/$f" "$WAF/$f" || exit 1
done

# 2. Register the app the way Amazon's own web apps are (only if it is not there yet).
if [ "$(sqlite3 "$DB" "SELECT value FROM properties WHERE handlerId='$ID' AND name='command'")" != "$CMD" ]; then
  sqlite3 "$DB" <<SQL || exit 1
BEGIN;
INSERT OR IGNORE INTO interfaces(interface) VALUES ('application');
INSERT OR IGNORE INTO handlerIds(handlerId) VALUES ('$ID');
INSERT OR REPLACE INTO properties(handlerId, name, value) VALUES ('$ID', 'command', '$CMD');
INSERT OR REPLACE INTO properties(handlerId, name, value) VALUES ('$ID', 'framework', '');
INSERT OR REPLACE INTO properties(handlerId, name, value) VALUES ('$ID', 'unloadPolicy', 'unloadOnPause');
INSERT OR REPLACE INTO associations(handlerId, interface, contentId, defaultAssoc) VALUES ('$ID', 'application', 'none', 'false');
COMMIT;
SQL
  sleep 1
fi

# 3. Open it.
lipc-set-prop com.lab126.appmgrd start "app://$ID"
