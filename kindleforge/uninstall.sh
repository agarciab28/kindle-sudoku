#!/bin/sh
# KindleForge package: removes Sudoku, its registration and its saved game.
set -e

ID=com.alexgar.sudoku
sqlite3 /var/local/appreg.db "DELETE FROM associations WHERE handlerId='$ID'; DELETE FROM properties WHERE handlerId='$ID'; DELETE FROM handlerIds WHERE handlerId='$ID';" || true
rm -rf /var/local/mesquite/sudoku /var/local/mesquite/$ID
rm -rf /mnt/us/.active_content_sandbox/sudoku
rm -rf /mnt/us/documents/sudoku /mnt/us/documents/Sudoku.sh /mnt/us/documents/Sudoku.sh.sdr

exit 0
