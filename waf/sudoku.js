/* Sudoku engine: generator, logical solver (grading) and brute-force checker.
   ES5 only (the Kindle web engine is old). No DOM here, so it also runs in Node
   for the tests: `node test/engine.test.js`. */
(function (root) {
  var ALL = 511; // candidates 1..9 as bits 0..8

  // --- board geometry -------------------------------------------------------
  var UNITS = [];      // 27 units (9 rows, 9 columns, 9 boxes), each with 9 cell indexes
  var PEERS = [];      // for each cell, its 20 peers
  var CELL_UNITS = []; // for each cell, the 3 unit indexes it belongs to
  (function () {
    var i, j, r, c, u;
    for (r = 0; r < 9; r++) { u = []; for (c = 0; c < 9; c++) { u.push(r * 9 + c); } UNITS.push(u); }
    for (c = 0; c < 9; c++) { u = []; for (r = 0; r < 9; r++) { u.push(r * 9 + c); } UNITS.push(u); }
    for (i = 0; i < 9; i++) {
      u = [];
      for (j = 0; j < 9; j++) { u.push((Math.floor(i / 3) * 3 + Math.floor(j / 3)) * 9 + (i % 3) * 3 + (j % 3)); }
      UNITS.push(u);
    }
    for (i = 0; i < 81; i++) {
      r = Math.floor(i / 9); c = i % 9;
      CELL_UNITS.push([r, 9 + c, 18 + Math.floor(r / 3) * 3 + Math.floor(c / 3)]);
      var seen = {}, list = [];
      for (j = 0; j < 3; j++) {
        u = UNITS[CELL_UNITS[i][j]];
        for (var k = 0; k < 9; k++) {
          if (u[k] !== i && !seen[u[k]]) { seen[u[k]] = true; list.push(u[k]); }
        }
      }
      PEERS.push(list);
    }
  })();

  var BITCOUNT = [];
  (function () {
    for (var m = 0; m < 512; m++) {
      var n = 0, x = m;
      while (x) { n += x & 1; x >>= 1; }
      BITCOUNT.push(n);
    }
  })();

  function bitToDigit(bit) { // single-bit mask -> 1..9
    var d = 1;
    while (bit > 1) { bit >>= 1; d++; }
    return d;
  }

  // --- random ----------------------------------------------------------------
  // Small seedable generator (mulberry32) so tests are reproducible.
  function makeRng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul ? Math.imul(t ^ (t >>> 15), t | 1) : mul32(t ^ (t >>> 15), t | 1);
      t ^= t + (Math.imul ? Math.imul(t ^ (t >>> 7), t | 61) : mul32(t ^ (t >>> 7), t | 61));
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function mul32(a, b) { // Math.imul for engines without it
    var ah = (a >>> 16) & 0xffff, al = a & 0xffff, bh = (b >>> 16) & 0xffff, bl = b & 0xffff;
    return ((al * bl) + (((ah * bl + al * bh) << 16) >>> 0)) | 0;
  }
  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1)), t = arr[i];
      arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // --- brute force -----------------------------------------------------------
  // Counts solutions up to `limit` (backtracking, most-constrained cell first).
  // If `out` is given, the first solution found is copied into it.
  function countSolutions(grid, limit, out) {
    var val = grid.slice(0), cand = [], i, j, count = 0;
    for (i = 0; i < 81; i++) { cand.push(ALL); }
    for (i = 0; i < 81; i++) {
      if (val[i]) {
        var b = 1 << (val[i] - 1);
        if (!(cand[i] & b)) { return 0; } // the givens already clash
        for (j = 0; j < 20; j++) { cand[PEERS[i][j]] &= ~b; }
      }
    }
    function search() {
      var best = -1, bestN = 10, i, n;
      for (i = 0; i < 81; i++) {
        if (!val[i]) {
          n = BITCOUNT[cand[i]];
          if (n === 0) { return; }
          if (n < bestN) { bestN = n; best = i; if (n === 1) { break; } }
        }
      }
      if (best < 0) {
        count++;
        if (out && count === 1) { for (i = 0; i < 81; i++) { out[i] = val[i]; } }
        return;
      }
      var mask = cand[best], peers = PEERS[best];
      for (var d = 1; d <= 9 && count < limit; d++) {
        var bit = 1 << (d - 1);
        if (!(mask & bit)) { continue; }
        var changed = [];
        val[best] = d;
        for (i = 0; i < 20; i++) {
          var p = peers[i];
          if (!val[p] && (cand[p] & bit)) { cand[p] &= ~bit; changed.push(p); }
        }
        search();
        for (i = 0; i < changed.length; i++) { cand[changed[i]] |= bit; }
        val[best] = 0;
      }
    }
    search();
    return count;
  }

  // A full random valid grid.
  function solvedGrid(rng) {
    var val = [], i;
    for (i = 0; i < 81; i++) { val.push(0); }
    function ok(i, d) {
      for (var j = 0; j < 20; j++) { if (val[PEERS[i][j]] === d) { return false; } }
      return true;
    }
    function fill(i) {
      if (i === 81) { return true; }
      var ds = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
      for (var k = 0; k < 9; k++) {
        if (ok(i, ds[k])) {
          val[i] = ds[k];
          if (fill(i + 1)) { return true; }
          val[i] = 0;
        }
      }
      return false;
    }
    fill(0);
    return val;
  }

  // --- logical solver --------------------------------------------------------
  // Solves the way a person does. Level 1: singles (a cell with one candidate, or
  // a digit with one place in a row/column/box). Level 2 adds locked candidates
  // and naked/hidden pairs. Returns { solved, level, grid }.
  // Every step is a sound deduction, so "solved" also proves the solution is unique.
  function solveLogic(grid, maxLevel) {
    var val = grid.slice(0), cand = [], left = 0, level = 1, i, j;
    for (i = 0; i < 81; i++) { cand.push(val[i] ? 0 : ALL); if (!val[i]) { left++; } }
    for (i = 0; i < 81; i++) {
      if (val[i]) { for (j = 0; j < 20; j++) { cand[PEERS[i][j]] &= ~(1 << (val[i] - 1)); } }
    }
    function place(i, bit) {
      val[i] = bitToDigit(bit); cand[i] = 0; left--;
      for (var j = 0; j < 20; j++) { cand[PEERS[i][j]] &= ~bit; }
    }
    function singles() {
      var found = false, i, u, d, bit, where, n, k;
      for (i = 0; i < 81; i++) {
        if (!val[i] && BITCOUNT[cand[i]] === 1) { place(i, cand[i]); found = true; }
      }
      for (u = 0; u < 27; u++) {
        for (d = 0; d < 9; d++) {
          bit = 1 << d; n = 0; where = -1;
          for (k = 0; k < 9; k++) {
            if (cand[UNITS[u][k]] & bit) { n++; where = UNITS[u][k]; }
          }
          if (n === 1) { place(where, bit); found = true; }
        }
      }
      return found;
    }
    function remove(i, mask) {
      if (cand[i] & mask) { cand[i] &= ~mask; return true; }
      return false;
    }
    function lockedCandidates() {
      var found = false, u, d, bit, k, c, cells, other, v, same;
      for (u = 0; u < 27; u++) {
        for (d = 0; d < 9; d++) {
          bit = 1 << d; cells = [];
          for (k = 0; k < 9; k++) { if (cand[UNITS[u][k]] & bit) { cells.push(UNITS[u][k]); } }
          if (cells.length < 2 || cells.length > 3) { continue; }
          // Do all the places for this digit also share another unit?
          for (v = 0; v < 3; v++) {
            other = CELL_UNITS[cells[0]][v];
            if (other === u) { continue; }
            same = true;
            for (k = 1; k < cells.length; k++) {
              if (CELL_UNITS[cells[k]][v] !== other) { same = false; break; }
            }
            if (!same) { continue; }
            for (k = 0; k < 9; k++) {
              c = UNITS[other][k];
              if (cells.indexOf(c) < 0 && remove(c, bit)) { found = true; }
            }
          }
        }
      }
      return found;
    }
    function pairs() {
      var found = false, u, a, b, k, ca, cb, d1, d2, m, cells;
      for (u = 0; u < 27; u++) {
        // Naked pair: two cells with the same two candidates.
        for (a = 0; a < 9; a++) {
          ca = UNITS[u][a];
          if (BITCOUNT[cand[ca]] !== 2) { continue; }
          for (b = a + 1; b < 9; b++) {
            cb = UNITS[u][b];
            if (cand[cb] !== cand[ca]) { continue; }
            for (k = 0; k < 9; k++) {
              if (k !== a && k !== b && remove(UNITS[u][k], cand[ca])) { found = true; }
            }
          }
        }
        // Hidden pair: two digits that only fit in the same two cells.
        for (d1 = 0; d1 < 9; d1++) {
          for (d2 = d1 + 1; d2 < 9; d2++) {
            m = (1 << d1) | (1 << d2); cells = [];
            var n1 = 0, n2 = 0;
            for (k = 0; k < 9; k++) {
              var cc = cand[UNITS[u][k]];
              if (cc & m) { cells.push(UNITS[u][k]); }
              if (cc & (1 << d1)) { n1++; }
              if (cc & (1 << d2)) { n2++; }
            }
            if (cells.length === 2 && n1 === 2 && n2 === 2) {
              if (remove(cells[0], ALL & ~m)) { found = true; }
              if (remove(cells[1], ALL & ~m)) { found = true; }
            }
          }
        }
      }
      return found;
    }
    var guard = 0;
    while (left > 0 && guard++ < 400) {
      if (singles()) { continue; }
      if (maxLevel >= 2 && (lockedCandidates() || pairs())) { level = 2; continue; }
      break;
    }
    return { solved: left === 0, level: level, grid: val };
  }

  // --- generator -------------------------------------------------------------
  var LEVELS = {
    // clues: stop digging at this many givens. logic: hardest technique allowed.
    // mirror: remove givens in mirrored pairs (prettier, but leaves more givens).
    facil:   { clues: 40, logic: 1, mirror: true },
    medio:   { clues: 31, logic: 1, mirror: true },
    dificil: { clues: 22, logic: 2, mirror: false }
  };

  // Removes givens while the puzzle can still be solved by logic with the
  // level's techniques. Returns { puzzle, solution, clues, level }.
  function generateOnce(levelName, rng) {
    var cfg = LEVELS[levelName] || LEVELS.medio;
    var solution = solvedGrid(rng), puzzle = solution.slice(0), clues = 81;
    var order = [], i;
    for (i = 0; i < (cfg.mirror ? 41 : 81); i++) { order.push(i); }
    shuffle(order, rng);
    for (var k = 0; k < order.length && clues > cfg.clues; k++) {
      var a = order[k], b = cfg.mirror ? 80 - a : a, va = puzzle[a], vb = puzzle[b];
      puzzle[a] = 0; puzzle[b] = 0;
      if (solveLogic(puzzle, cfg.logic).solved) {
        clues -= (a === b) ? 1 : 2;
      } else {
        puzzle[a] = va; puzzle[b] = vb;
      }
    }
    return { puzzle: puzzle, solution: solution, clues: clues, level: solveLogic(puzzle, cfg.logic).level };
  }

  // How good a candidate is for the level (higher is better).
  function score(levelName, g) {
    if (levelName === 'dificil') { return (g.level === 2 ? 100 : 0) - g.clues; }
    return -Math.abs(g.clues - LEVELS[levelName].clues);
  }
  // Is it good enough to stop trying?
  function accept(levelName, g) {
    if (levelName === 'dificil') { return g.level === 2 && g.clues <= 28; }
    return g.clues <= LEVELS[levelName].clues + 2;
  }

  // Convenience for Node/tests: tries a few times and keeps the best.
  function generate(levelName, rng, attempts) {
    rng = rng || Math.random;
    var best = null;
    for (var n = 0; n < (attempts || 40); n++) {
      var g = generateOnce(levelName, rng);
      if (!best || score(levelName, g) > score(levelName, best)) { best = g; }
      if (accept(levelName, best)) { break; }
    }
    return best;
  }

  var api = {
    UNITS: UNITS, PEERS: PEERS, LEVELS: LEVELS,
    makeRng: makeRng, shuffle: shuffle,
    countSolutions: countSolutions, solvedGrid: solvedGrid, solveLogic: solveLogic,
    generateOnce: generateOnce, generate: generate, score: score, accept: accept
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.Sudoku = api; }
})(this);
