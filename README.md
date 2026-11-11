# Sudoku for Kindle

A sudoku made for e-ink, for jailbroken Kindles. It opens from the library like
a book and runs entirely on the device: no network, no account, no permissions.

<img src="docs/screenshot.png" alt="Sudoku on a Kindle Paperwhite" width="320">

- **Three levels.** *Fácil* and *Medio* need only singles. *Difícil* always needs
  more (locked candidates or pairs) but never guessing. Every puzzle has exactly
  one solution and is generated on the Kindle.
- **Notes** (pencil marks), erase, undo, hint, and a check that marks wrong cells.
- **Your game is saved** after every move, so it survives sleep and closing the app.
- **Built for e-ink:** black on white, no animation, big tap targets, and only the
  cells that change are repainted.

The interface is in Spanish.

## Requirements

- A **jailbroken Kindle** with the KindleModding hotfix, which lets `.sh` files in
  the library run as apps ("scriptlets"). If KOReader or kTerm open from your
  library, you have it.
- Tested on a **Kindle Paperwhite 12th gen, firmware 5.20.2**. The layout adapts
  to the screen, so other touch Kindles should work, but they are untested.

## Install

1. Download `sudoku.zip` from the [latest release](https://github.com/agarciab28/kindle-sudoku/releases/latest) and unzip it.
   You get a file, `Sudoku.sh`, and a folder, `sudoku`.
2. Connect the Kindle by USB and copy **both** into its `documents` folder.
3. Eject the Kindle and open **Sudoku** from the library.

The first time it opens, the launcher installs the app; after that it just opens it.

**Update:** copy the new `Sudoku.sh` and `sudoku` over the old ones. Your saved
game and stats are kept.

**Uninstall:** delete `Sudoku.sh` and the `sudoku` folder from `documents`. That
leaves a small registration and the saved game behind; to remove those too, run
this on the Kindle (kTerm or SSH) *before* deleting the folder:

```sh
sh /mnt/us/documents/sudoku/uninstall
```

### En español

1. Descarga `sudoku.zip` de la [última versión](https://github.com/agarciab28/kindle-sudoku/releases/latest) y descomprímelo.
2. Conecta el Kindle por USB y copia el archivo `Sudoku.sh` y la carpeta `sudoku` a la carpeta `documents`.
3. Expulsa el Kindle y abre **Sudoku** desde la biblioteca.

## What it does to your Kindle

Nothing outside its own files. The launcher (`Sudoku.sh`, a short script you can read):

- copies the app's five files to `/var/local/mesquite/sudoku/`, where the Kindle
  keeps its own web apps;
- adds the app's own rows to the Kindle's app registry (`/var/local/appreg.db`),
  the same way Amazon's web apps are registered, and never touches other rows;
- opens the app.

The app asks for no permissions (see `waf/config.xml`): it cannot use the network
or talk to local services. The saved game and the stats live in the app's
`localStorage`, which the Kindle keeps in `/mnt/us/.active_content_sandbox/sudoku/`.

Jailbreaking and installing unofficial software is at your own risk; this
project is not affiliated with Amazon.

## How the levels work

Difficulty is the hardest technique a puzzle needs, not how many numbers it shows.

| Level | Needs | Givens |
|---|---|---|
| Fácil | Singles only | 39–40 |
| Medio | Singles only | 30–32 |
| Difícil | Locked candidates or pairs, never guessing | 22–28 |

The generator removes givens while a logical solver, limited to the level's
techniques, can still finish the puzzle. A deduction-only solve also proves the
solution is unique.

## Development

| Path | What |
|---|---|
| `waf/sudoku.js` | The engine: generator, logical solver (grades the level) and a brute-force uniqueness check. No DOM. |
| `waf/app.js`, `app.css`, `index.html`, `config.xml` | The app, a Kindle WAF. ES5 only (the Kindle's web engine is old); `#app`'s font size is one board cell, so all CSS lengths are in cells. |
| `kindle/Sudoku.sh` | The launcher: installs on first run, then opens the app. |
| `kindle/uninstall` | Full removal. No `.sh` extension on purpose: the Kindle lists every `.sh` under `documents` as a book. |
| `kindle/cover.svg`, `cover.png` | The library cover (600×900). `package.sh` embeds the PNG in the launcher as its `# Icon:` line. |
| `package.sh` | Runs the tests and builds `build/sudoku.zip`. The zip is reproducible: same sources, same checksum. |
| `deploy.sh` | Builds and copies to a Kindle over Wi-Fi (KOReader's SSH server, port 2222, key auth). |
| `kindleforge/` | Install and uninstall scripts in the format of the KindleForge package repository. |
| `test/engine.test.js` | `node test/engine.test.js` (set `N=400` for more puzzles). |

To try the interface on a computer, serve `waf/` over HTTP and open it at about
1264×1580. To change the cover, edit `kindle/cover.svg` and render it at 600×900
(for example, headless Chrome with `--screenshot --window-size=600,900`).

Device notes: the screen is 1272×1696 and the board ends up about 1060 px wide
below the title bar. The title bar's back arrow reaches the app as the LIPC
property `invokeAction = KPP_BACK`.

## License

[MIT](LICENSE)
