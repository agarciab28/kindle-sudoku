// Tests for the engine: node test/engine.test.js
'use strict';
const assert = require('assert');
const S = require('../waf/sudoku.js');

function validSolution(g) {
  for (const u of S.UNITS) {
    const seen = new Set(u.map((i) => g[i]));
    if (seen.size !== 9 || seen.has(0)) { return false; }
  }
  return true;
}

// Geometry
assert.strictEqual(S.UNITS.length, 27);
assert.ok(S.PEERS.every((p) => p.length === 20));
assert.deepStrictEqual(S.UNITS[18], [0, 1, 2, 9, 10, 11, 18, 19, 20]);
assert.deepStrictEqual(S.UNITS[26], [60, 61, 62, 69, 70, 71, 78, 79, 80]);

// A known puzzle (unique solution) and a broken one.
const known = '530070000600195000098000060800060003400803001700020006060000280000419005000080079'
  .split('').map(Number);
const out = [];
assert.strictEqual(S.countSolutions(known, 2, out), 1);
assert.ok(validSolution(out));
assert.strictEqual(S.solveLogic(known, 1).solved, true);
assert.deepStrictEqual(S.solveLogic(known, 1).grid, out);
assert.strictEqual(S.countSolutions(new Array(81).fill(0), 2), 2, 'empty grid has many solutions');
const clash = known.slice(); clash[1] = 5; // two 5s in the first row
assert.strictEqual(S.countSolutions(clash, 2), 0);

// Generator: every puzzle has exactly one solution, and it is the stored one.
const N = Number(process.env.N || 150);
for (const level of ['facil', 'medio', 'dificil']) {
  const rng = S.makeRng(20261110 + level.length);
  let clues = 0, min = 81, max = 0, needsL2 = 0, worst = 0;
  const t0 = Date.now();
  for (let n = 0; n < N; n++) {
    const t1 = Date.now();
    const g = S.generate(level, rng);
    worst = Math.max(worst, Date.now() - t1);
    assert.ok(validSolution(g.solution), 'solution is valid');
    const sol = [];
    assert.strictEqual(S.countSolutions(g.puzzle, 2, sol), 1, level + ': unique solution');
    assert.deepStrictEqual(sol, g.solution);
    g.puzzle.forEach((v, i) => assert.ok(v === 0 || v === g.solution[i]));
    assert.strictEqual(g.puzzle.filter(Boolean).length, g.clues);
    if (S.LEVELS[level].mirror) { // a given and its mirror go together
      g.puzzle.forEach((v, i) => assert.strictEqual(!!v, !!g.puzzle[80 - i]));
    }
    // The level's techniques are enough: no guessing needed.
    const logic = S.solveLogic(g.puzzle, S.LEVELS[level].logic);
    assert.ok(logic.solved, level + ': solvable by logic');
    assert.deepStrictEqual(logic.grid, g.solution);
    if (level !== 'dificil') {
      assert.strictEqual(S.solveLogic(g.puzzle, 1).solved, true, level + ': singles only');
    } else if (!S.solveLogic(g.puzzle, 1).solved) {
      needsL2++;
    }
    clues += g.clues; min = Math.min(min, g.clues); max = Math.max(max, g.clues);
  }
  const ms = (Date.now() - t0) / N;
  console.log(level.padEnd(8), 'clues avg', (clues / N).toFixed(1), 'min', min, 'max', max,
    level === 'dificil' ? '| need pairs/locked: ' + needsL2 + '/' + N : '',
    '|', ms.toFixed(1), 'ms avg,', worst, 'ms worst');
  if (level === 'dificil') { assert.strictEqual(needsL2, N, 'hard puzzles need more than singles'); }
}

// Same seed, same puzzle.
assert.deepStrictEqual(S.generate('medio', S.makeRng(7)).puzzle, S.generate('medio', S.makeRng(7)).puzzle);
console.log('ok');
