#!/bin/sh
# Quita la app Sudoku del Kindle (también borra la partida guardada).
ID=com.alexgar.sudoku
DB=/var/local/appreg.db
sqlite3 "$DB" <<SQL
DELETE FROM associations WHERE handlerId='$ID';
DELETE FROM properties WHERE handlerId='$ID';
DELETE FROM handlerIds WHERE handlerId='$ID';
SQL
rm -rf /var/local/mesquite/sudoku
rm -rf /var/local/mesquite/com.alexgar.sudoku
# La partida guardada y las estadísticas (localStorage de la app).
rm -rf /mnt/us/.active_content_sandbox/sudoku
rm -f /mnt/us/documents/Sudoku.sh
echo "Sudoku desinstalado."
