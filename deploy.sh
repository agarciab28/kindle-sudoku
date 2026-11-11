#!/bin/sh
# Instala Sudoku en el Kindle por Wi-Fi (servidor SSH de KOReader, puerto 2222).
# Uso: ./deploy.sh <IP del Kindle>   (KEY=~/.ssh/otra_llave ./deploy.sh … para otra llave)
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
IP="${1:?uso: ./deploy.sh IP_DEL_KINDLE}"
KEY="${KEY:-$HOME/.ssh/id_ed25519}"

node "$HERE/test/engine.test.js" >/dev/null

k() { ssh -p 2222 -o BatchMode=yes -o ConnectTimeout=10 -o IdentitiesOnly=yes -i "$KEY" "root@$IP" "$@"; }
put() { k "cat > '$2'" < "$1"; }
# Prints a launcher with its library cover embedded as the "# Icon:" header line.
launcher() {
  awk -v icon="# Icon: data:image/png;base64,$(base64 < "$2" | tr -d '\n')" '{ print } /^# Author:/ { print icon }' "$1"
}

k "mkdir -p /mnt/us/sudoku-app/waf"
for f in "$HERE"/waf/*; do put "$f" "/mnt/us/sudoku-app/waf/$(basename "$f")"; done
launcher "$HERE/kindle/Sudoku.sh" "$HERE/kindle/cover.png" | k "cat > /mnt/us/sudoku-app/Sudoku.sh"
put "$HERE/kindle/install.sh" /mnt/us/sudoku-app/install.sh
put "$HERE/kindle/uninstall.sh" /mnt/us/sudoku-app/uninstall.sh
k "sh /mnt/us/sudoku-app/install.sh"
