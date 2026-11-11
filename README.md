# Sudoku — a native app for a jailbroken Kindle

A sudoku made for e-ink: black on white, no animation, big tap targets, and
only the cells that change are repainted. It is a Kindle WAF (like the Kindle
Store or Help) and runs entirely on the device: no network, no service.

Built for a Kindle Paperwhite 12th gen (firmware 5.20.2, jailbroken); the layout
adapts to the screen size.

## What it does

- Three levels. **Fácil** and **Medio** need only singles; **Difícil** always
  needs more (locked candidates or pairs) but never guessing. Every puzzle has
  exactly one solution.
- Notes (pencil marks), erase, undo, hint, and a check that marks wrong cells.
- The game is saved after every move (`localStorage`), so it survives sleep and
  closing the app. Solved counts and best times per level.

## Layout

| Path | What |
|---|---|
| `waf/sudoku.js` | The engine: generator, logical solver (grades the level) and brute-force uniqueness check. No DOM. |
| `waf/app.js`, `app.css`, `index.html`, `config.xml` | The app. ES5 only; `#app`'s font size is one board cell, so all CSS lengths are in cells. |
| `kindle/` | `Sudoku.sh` (library launcher), `install.sh` / `uninstall.sh`, and the library cover (`cover.svg`, rendered to `cover.png`). |
| `deploy.sh` | Runs the tests and installs over Wi-Fi (KOReader's SSH server, port 2222, key auth). |
| `test/engine.test.js` | `node test/engine.test.js` (set `N=400` for more puzzles). |

## Install

1. On the Kindle, start KOReader's SSH server (key auth).
2. On the Mac: `./deploy.sh <kindle-ip>`.
3. Open **Sudoku** from the Kindle library.

Uninstall: `ssh -p 2222 root@<kindle-ip> 'sh /mnt/us/sudoku-app/uninstall.sh'`.

## Notes

- The app is registered in `/var/local/appreg.db` the same way as Bóveda
  (`kindle-vault`); `install.sh` backs the DB up once to
  `/mnt/us/sudoku-app/appreg.db.orig`.
- It asks for no permissions: no `local-port-access`, no network.
- Library cover: `deploy.sh` embeds `kindle/cover.png` in the launcher as its `# Icon: data:image/png;base64,…` header (600×900). To change it, edit `kindle/cover.svg`, render it at 600×900 (e.g. headless Chrome `--screenshot --window-size=600,900`) and deploy.
- The saved game and the stats live in the app's `localStorage`, which the Kindle
  keeps in `/mnt/us/.active_content_sandbox/sudoku/` (verified on the device: the
  game survives closing the app). `uninstall.sh` removes it.
- Screen: 1272×1696; the board ends up about 1060 px wide below the title bar.
- To try the UI on a computer, serve `waf/` over HTTP and open it at about
  1264×1580.
