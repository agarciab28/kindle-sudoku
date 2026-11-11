#!/bin/sh
# For development: builds the package and copies it to the Kindle over Wi-Fi
# (KOReader's SSH server, port 2222, key auth). Users do not need this: see README.
# Usage: ./deploy.sh <kindle-ip>      (KEY=~/.ssh/other_key ./deploy.sh … for another key)
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
IP="${1:?usage: ./deploy.sh KINDLE_IP}"
KEY="${KEY:-$HOME/.ssh/id_ed25519}"

"$HERE/package.sh"

k() { ssh -p 2222 -o BatchMode=yes -o ConnectTimeout=10 -o IdentitiesOnly=yes -i "$KEY" "root@$IP" "$@"; }
put() { k "cat > '$2'" < "$1"; }

k "mkdir -p /mnt/us/documents/sudoku"
for f in "$HERE"/build/sudoku/*; do put "$f" "/mnt/us/documents/sudoku/$(basename "$f")"; done
put "$HERE/build/Sudoku.sh" /mnt/us/documents/Sudoku.sh
echo "Copied. Open 'Sudoku' from the Kindle library."
