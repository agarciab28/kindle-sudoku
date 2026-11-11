/* Sudoku: Kindle WAF. ES5 only (the Kindle web engine is old).
   Everything is local: no network, no service. The game is saved in localStorage.
   The interface is in English or Spanish (see TEXT); English is the default. */
(function () {
  var APP_ID = 'com.alexgar.sudoku';
  var S = window.Sudoku;
  var app = document.getElementById('app');
  var LEVELS = ['facil', 'medio', 'dificil'];
  var LABEL = { facil: 1, medio: 1, dificil: 1 }; // the valid level ids; their names are in TEXT
  var IDLE_CAP = 120000; // a pause longer than this does not count as playing time
  var MAX_UNDO = 60;

  // ---- storage --------------------------------------------------------------
  var store = (function () {
    var ok = false, mem = {};
    try {
      window.localStorage.setItem('sudoku.test', '1');
      ok = window.localStorage.getItem('sudoku.test') === '1';
      window.localStorage.removeItem('sudoku.test');
    } catch (e) { ok = false; }
    return {
      persistent: ok,
      get: function (k) {
        try {
          var s = ok ? window.localStorage.getItem(k) : mem[k];
          return s ? JSON.parse(s) : null;
        } catch (e) { return null; }
      },
      set: function (k, v) {
        var s = JSON.stringify(v);
        if (ok) { try { window.localStorage.setItem(k, s); return; } catch (e) { /* full: keep in memory */ } }
        mem[k] = s;
      }
    };
  })();

  // ---- language -------------------------------------------------------------
  // {0}, {1} are filled in by t(). Level ids stay 'facil' / 'medio' / 'dificil' in
  // saved games whatever the language.
  var TEXT = {
    en: {
      'name.en': 'English', 'name.es': 'Español', language: 'Language', settings: 'Settings', back: 'Back',
      'level.facil': 'Easy', 'level.medio': 'Medium', 'level.dificil': 'Hard',
      'continue': 'Continue', continueSub: '{0} · {1} cells left', newGame: 'New game',
      unfinished: 'You have an unfinished game. Starting another one discards it.',
      startNew: 'Start a new {0} one', solved: 'Solved', colLevel: 'Level', colSolved: 'Solved', colBest: 'Best time',
      noSave: 'This Kindle cannot save your progress: if you close the app, the game is lost.',
      preparing: 'Preparing a new {0} sudoku…',
      won: 'Solved!', hint1: '1 hint', hintN: '{0} hints', another: 'Another {0} one', menu: 'Menu',
      keyLeft: '{0} left', keyDone: 'done', keyOver: 'too many',
      notes: 'Notes', erase: 'Erase', undo: 'Undo', hint: 'Hint', check: 'Check', status: '{0} · {1} left',
      msgPick: 'Tap a cell first', msgGiven: 'That cell is part of the puzzle', msgNotes: 'Erase the number to add notes',
      msgNoUndo: 'Nothing to undo', msgRight: 'That cell is already right',
      chkOk: 'All good so far', chk1: '1 wrong cell', chkN: '{0} wrong cells', msgFull: 'Full, but with mistakes: tap Check'
    },
    es: {
      'name.en': 'English', 'name.es': 'Español', language: 'Idioma', settings: 'Ajustes', back: 'Volver',
      'level.facil': 'Fácil', 'level.medio': 'Medio', 'level.dificil': 'Difícil',
      'continue': 'Continuar', continueSub: '{0} · faltan {1} casillas', newGame: 'Juego nuevo',
      unfinished: 'Tienes un juego sin terminar. Si empiezas otro, ese se pierde.',
      startNew: 'Empezar uno {0}', solved: 'Resueltos', colLevel: 'Nivel', colSolved: 'Resueltos', colBest: 'Mejor tiempo',
      noSave: 'Este Kindle no deja guardar el avance: si cierras la app, el juego se pierde.',
      preparing: 'Preparando un sudoku {0}…',
      won: '¡Resuelto!', hint1: '1 pista', hintN: '{0} pistas', another: 'Otro {0}', menu: 'Menú',
      keyLeft: 'faltan {0}', keyDone: 'listo', keyOver: 'de más',
      notes: 'Notas', erase: 'Borrar', undo: 'Deshacer', hint: 'Pista', check: 'Comprobar', status: '{0} · faltan {1}',
      msgPick: 'Toca una casilla primero', msgGiven: 'Esa casilla es del sudoku', msgNotes: 'Borra el número para poner notas',
      msgNoUndo: 'No hay nada que deshacer', msgRight: 'Esa casilla ya está bien',
      chkOk: 'Todo bien hasta aquí', chk1: '1 casilla con error', chkN: '{0} casillas con error', msgFull: 'Lleno, pero hay errores: toca Comprobar'
    }
  };
  var lang = 'en';
  function setLang(l, save) {
    lang = TEXT[l] ? l : 'en';
    document.documentElement.lang = lang;
    if (save) { store.set('sudoku.lang', lang); }
  }
  function t(key, a, b) {
    var s = TEXT[lang][key];
    if (s === undefined) { s = TEXT.en[key]; }
    return String(s).replace('{0}', a === undefined ? '' : a).replace('{1}', b === undefined ? '' : b);
  }
  function L(level) { return t('level.' + level); }      // "Easy"
  function l(level) { return L(level).toLowerCase(); }   // "easy", inside a sentence

  // ---- state ----------------------------------------------------------------
  var game = null;       // { level, puzzle[], solution[], val[], notes[], elapsed, hints, undo[], done }
  var stats = {};        // { facil: { won, best }, ... }
  var screen = 'menu';   // menu | busy | game | settings
  var beforeSettings = 'menu'; // where "Back" on the settings screen returns to
  var sel = -1, noteMode = false, errs = {}, message = '';
  var cells = [], keys = [], drawn = [], drawnKeys = [];
  var lastTick = 0;

  function toDigits(s) {
    var a = [];
    for (var i = 0; i < s.length; i++) { a.push(+s.charAt(i)); }
    return a;
  }
  function snapshot() { return game.val.join('') + '|' + game.notes.join(','); }
  function restore(snap) {
    var parts = snap.split('|'), n = parts[1].split(',');
    game.val = toDigits(parts[0]);
    for (var i = 0; i < 81; i++) { game.notes[i] = +n[i] || 0; }
  }
  function saveGame() {
    store.set('sudoku.game', game ? {
      level: game.level, puzzle: game.puzzle.join(''), solution: game.solution.join(''),
      state: snapshot(), elapsed: game.elapsed, hints: game.hints, undo: game.undo, done: game.done
    } : null);
  }
  function loadGame() {
    var o = store.get('sudoku.game');
    if (!o || !LABEL[o.level] || !/^[0-9]{81}$/.test(o.puzzle || '') || !/^[1-9]{81}$/.test(o.solution || '') ||
        !/^[0-9]{81}\|[0-9]+(,[0-9]+){80}$/.test(o.state || '')) { return null; }
    game = {
      level: o.level, puzzle: toDigits(o.puzzle), solution: toDigits(o.solution), val: [], notes: [],
      elapsed: +o.elapsed || 0, hints: +o.hints || 0, undo: (o.undo && o.undo.slice) ? o.undo.slice(-MAX_UNDO) : [],
      done: !!o.done
    };
    restore(o.state);
    return game;
  }
  function loadStats() {
    var o = store.get('sudoku.stats') || {};
    for (var i = 0; i < LEVELS.length; i++) {
      var s = o[LEVELS[i]] || {};
      stats[LEVELS[i]] = { won: +s.won || 0, best: +s.best || 0 };
    }
  }

  function missing() {
    var n = 0;
    for (var i = 0; i < 81; i++) { if (!game.val[i]) { n++; } }
    return n;
  }
  function fmtTime(ms) {
    var s = Math.round(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
    if (h) { return h + ' h ' + (m % 60) + ' min'; }
    if (m) { return m + ' min ' + (s % 60) + ' s'; }
    return s + ' s';
  }
  function tick() { // adds the time since the last action to the game clock
    var now = Date.now();
    if (game && !game.done && lastTick) { game.elapsed += Math.min(now - lastTick, IDLE_CAP); }
    lastTick = now;
  }

  // ---- layout ---------------------------------------------------------------
  // One "em" inside #app is one board cell: the board is 9 wide and the game
  // screen needs about 12.9 of height.
  function layout() {
    var w = window.innerWidth || document.documentElement.clientWidth || 1000;
    var h = window.innerHeight || document.documentElement.clientHeight || 1300;
    var c = Math.floor(Math.min((w * 0.94) / 9, h / 12.9));
    app.style.fontSize = Math.max(c, 24) + 'px';
  }

  function btn(action, attrs, title, sub, cls) {
    return '<a class="big' + (cls ? ' ' + cls : '') + '" href="javascript:void(0)" data-a="' + action + '"' + (attrs || '') + '>' +
      '<span class="bt1">' + title + '</span>' + (sub ? '<span class="bt2">' + sub + '</span>' : '') + '</a>';
  }

  // ---- menu -----------------------------------------------------------------
  function renderMenu(confirmLevel) {
    screen = 'menu';
    setupChrome('Sudoku');
    var h = '<div class="menu">' + GEAR + '<div class="logo">Sudoku</div>', i, lv;
    var playing = game && !game.done;
    if (playing) {
      h += btn('continue', '', t('continue'), t('continueSub', L(game.level), missing()), 'dark');
    }
    h += '<div class="label">' + t('newGame') + '</div><table class="three"><tr>';
    for (i = 0; i < LEVELS.length; i++) {
      lv = LEVELS[i];
      h += '<td>' + btn('new', ' data-l="' + lv + '"', L(lv)) + '</td>';
    }
    h += '</tr></table>';
    if (confirmLevel) {
      h += '<div class="box"><div class="note">' + t('unfinished') + '</div>' +
        btn('newok', ' data-l="' + confirmLevel + '"', t('startNew', l(confirmLevel))) + '</div>';
    }
    h += '<div class="label">' + t('solved') + '</div><table class="stats"><tr><th>' + t('colLevel') + '</th><th class="num">' +
      t('colSolved') + '</th><th class="num">' + t('colBest') + '</th></tr>';
    for (i = 0; i < LEVELS.length; i++) {
      lv = LEVELS[i];
      h += '<tr><td>' + L(lv) + '</td><td class="num">' + stats[lv].won + '</td><td class="num">' +
        (stats[lv].best ? fmtTime(stats[lv].best) : '—') + '</td></tr>';
    }
    h += '</table>';
    if (!store.persistent) {
      h += '<div class="box"><div class="note">' + t('noSave') + '</div></div>';
    }
    app.innerHTML = h + '</div>';
    window.scrollTo(0, 0);
  }

  // ---- settings (the gear at the top right of the menu and of the game) ------
  var GEAR = '<a class="gear" href="javascript:void(0)" data-a="settings"></a>';
  function openSettings() {
    if (screen === 'settings' || screen === 'busy') { return; }
    if (screen === 'game') { tick(); saveGame(); lastTick = 0; }
    beforeSettings = screen;
    renderSettings();
  }
  function renderSettings() {
    screen = 'settings';
    setupChrome('Sudoku · ' + t('settings'));
    var h = '<div class="menu"><div class="logo">' + t('settings') + '</div><div class="label">' + t('language') +
      '</div><table class="three"><tr>', code;
    for (code in TEXT) {
      if (TEXT.hasOwnProperty(code)) {
        h += '<td>' + btn('lang', ' data-v="' + code + '"', t('name.' + code), '', code === lang ? 'dark' : '') + '</td>';
      }
    }
    app.innerHTML = h + '</tr></table><div class="label">&nbsp;</div>' + btn('settingsback', '', t('back')) + '</div>';
    window.scrollTo(0, 0);
  }
  function closeSettings() {
    if (beforeSettings === 'game' && game) { renderGame(); } else { renderMenu(); }
  }

  // ---- new game -------------------------------------------------------------
  function startNew(level) {
    screen = 'busy';
    app.innerHTML = '<div class="menu"><div class="logo">Sudoku</div><div class="busy">' + t('preparing', l(level)) + '</div></div>';
    var best = null, tries = 0;
    // In short slices, so the "Preparando" text gets painted first.
    function step() {
      var t0 = Date.now();
      do {
        var g = S.generateOnce(level, Math.random);
        tries++;
        if (!best || S.score(level, g) > S.score(level, best)) { best = g; }
      } while (!S.accept(level, best) && tries < 120 && Date.now() - t0 < 300);
      if (S.accept(level, best) || tries >= 120) { begin(level, best); } else { setTimeout(step, 20); }
    }
    setTimeout(step, 80);
  }
  function begin(level, g) {
    var notes = [];
    for (var i = 0; i < 81; i++) { notes.push(0); }
    game = { level: level, puzzle: g.puzzle, solution: g.solution, val: g.puzzle.slice(0), notes: notes,
      elapsed: 0, hints: 0, undo: [], done: false };
    saveGame();
    renderGame();
  }

  // ---- game screen ----------------------------------------------------------
  function renderGame() {
    screen = 'game';
    setupChrome('Sudoku · ' + L(game.level));
    sel = -1; noteMode = false; errs = {}; message = ''; drawn = []; cells = [];
    lastTick = Date.now();
    var h = '<div class="status"><span id="st"></span>' + GEAR + '<span id="msg"></span></div><table class="board">', r, c;
    for (r = 0; r < 9; r++) {
      h += '<tr>';
      for (c = 0; c < 9; c++) {
        h += '<td class="' + (r % 3 === 0 ? 'bt ' : '') + (c % 3 === 0 ? 'bl ' : '') + (r === 8 ? 'bb ' : '') + (c === 8 ? 'br' : '') +
          '"><a class="cell" href="javascript:void(0)" data-a="cell" data-i="' + (r * 9 + c) + '"></a></td>';
      }
      h += '</tr>';
    }
    app.innerHTML = h + '</table><div id="controls"></div>';
    var as = app.getElementsByTagName('a');
    for (var i = 0; i < as.length; i++) {
      if (as[i].getAttribute('data-a') === 'cell') { cells[+as[i].getAttribute('data-i')] = as[i]; }
    }
    renderControls();
    refresh();
    window.scrollTo(0, 0);
  }

  function act(action, label, attrs) {
    return '<td><a class="act" href="javascript:void(0)" data-a="' + action + '"' + (attrs || '') +
      '><span>' + label + '</span></a></td>';
  }
  function renderControls() {
    var box = document.getElementById('controls'), h, d;
    keys = []; drawnKeys = [];
    if (game.done) {
      h = '<div class="win"><div class="wt">' + t('won') + '</div><div class="wd">' + L(game.level) + ' · ' + fmtTime(game.elapsed) +
        (game.hints ? ' · ' + (game.hints === 1 ? t('hint1') : t('hintN', game.hints)) : '') + '</div><table><tr>' +
        act('newok', t('another', l(game.level)), ' data-l="' + game.level + '"') + act('menu', t('menu')) + '</tr></table></div>';
      box.innerHTML = h;
      return;
    }
    h = '<table class="pad"><tr>';
    for (d = 1; d <= 9; d++) {
      h += '<td><a class="key" href="javascript:void(0)" data-a="digit" data-d="' + d + '"><span class="kd">' + d +
        '</span><span class="kc"></span></a></td>';
    }
    // "Menú" is also the title bar's back arrow; the button is there in case the arrow fails.
    h += '</tr></table><table class="acts"><tr>' + act('menu', t('menu')) + act('notes', t('notes'), ' id="a-notes"') +
      act('erase', t('erase')) + act('undo', t('undo')) + act('hint', t('hint')) + act('check', t('check')) + '</tr></table>';
    box.innerHTML = h;
    var as = box.getElementsByTagName('a');
    for (var i = 0; i < as.length; i++) {
      if (as[i].getAttribute('data-a') === 'digit') { keys[+as[i].getAttribute('data-d')] = as[i]; }
    }
  }

  // Repaints only what changed: on e-ink every repaint is visible.
  function drawCell(i) {
    var v = game.val[i], given = game.puzzle[i] !== 0, selv = sel >= 0 ? game.val[sel] : 0;
    var cls = 'cell' + (given ? ' given' : '') + (i === sel ? ' sel' : (v && v === selv ? ' same' : '')) + (errs[i] ? ' err' : '');
    var body = '', d;
    if (v) {
      body = '<span class="v">' + v + '</span>';
    } else if (game.notes[i]) {
      for (d = 1; d <= 9; d++) { body += '<span class="n">' + ((game.notes[i] >> (d - 1)) & 1 ? d : '&nbsp;') + '</span>'; }
    }
    var sig = cls + '|' + body;
    if (drawn[i] === sig) { return; }
    if (!drawn[i] || drawn[i].split('|')[1] !== body) { cells[i].innerHTML = body; }
    cells[i].className = cls;
    drawn[i] = sig;
  }
  function refresh() {
    var i, d, count = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (i = 0; i < 81; i++) { drawCell(i); count[game.val[i]]++; }
    for (d = 1; d <= 9; d++) {
      if (!keys[d]) { continue; }
      var left = 9 - count[d], sig = String(left);
      if (drawnKeys[d] === sig) { continue; }
      drawnKeys[d] = sig;
      keys[d].className = 'key' + (left <= 0 ? ' out' : '');
      keys[d].getElementsByTagName('span')[1].innerHTML = left > 0 ? t('keyLeft', left) : (left === 0 ? t('keyDone') : t('keyOver'));
    }
    var nb = document.getElementById('a-notes');
    if (nb) { nb.className = 'act' + (noteMode ? ' on' : ''); }
    setText('st', game.done ? L(game.level) : t('status', L(game.level), count[0]));
    setText('msg', message);
  }
  function setText(id, text) {
    var el = document.getElementById(id);
    if (el && el.getAttribute('data-t') !== text) { el.setAttribute('data-t', text); el.innerHTML = text; }
  }

  // ---- moves ----------------------------------------------------------------
  function remember() {
    game.undo.push(snapshot());
    if (game.undo.length > MAX_UNDO) { game.undo.shift(); }
  }
  function editable() { // the selected cell, if the player may change it
    if (sel < 0) { message = t('msgPick'); return false; }
    if (game.puzzle[sel]) { message = t('msgGiven'); return false; }
    return true;
  }
  function putDigit(d) {
    if (!editable()) { return; }
    var bit = 1 << (d - 1), i;
    if (noteMode) {
      if (game.val[sel]) { message = t('msgNotes'); return; }
      remember();
      game.notes[sel] ^= bit;
      return;
    }
    remember();
    delete errs[sel];
    if (game.val[sel] === d) { game.val[sel] = 0; return; } // same digit again: take it out
    game.val[sel] = d;
    game.notes[sel] = 0;
    for (i = 0; i < 20; i++) { game.notes[S.PEERS[sel][i]] &= ~bit; } // that note no longer fits there
    checkEnd();
  }
  function erase() {
    if (!editable()) { return; }
    if (!game.val[sel] && !game.notes[sel]) { return; }
    remember();
    game.val[sel] = 0; game.notes[sel] = 0; delete errs[sel];
  }
  function undo() {
    if (!game.undo.length) { message = t('msgNoUndo'); return; }
    restore(game.undo.pop());
    errs = {};
  }
  function hint() {
    if (!editable()) { return; }
    if (game.val[sel] === game.solution[sel]) { message = t('msgRight'); return; }
    remember();
    var d = game.solution[sel], bit = 1 << (d - 1);
    game.val[sel] = d; game.notes[sel] = 0; game.hints++; delete errs[sel];
    for (var i = 0; i < 20; i++) { game.notes[S.PEERS[sel][i]] &= ~bit; }
    checkEnd();
  }
  function check() {
    var n = 0;
    errs = {};
    for (var i = 0; i < 81; i++) {
      if (game.val[i] && game.val[i] !== game.solution[i]) { errs[i] = true; n++; }
    }
    message = n === 0 ? t('chkOk') : (n === 1 ? t('chk1') : t('chkN', n));
  }
  function checkEnd() {
    for (var i = 0; i < 81; i++) {
      if (!game.val[i]) { return; }
    }
    for (i = 0; i < 81; i++) {
      if (game.val[i] !== game.solution[i]) { message = t('msgFull'); return; }
    }
    game.done = true; game.undo = []; sel = -1; noteMode = false;
    var s = stats[game.level];
    s.won++;
    if (!s.best || game.elapsed < s.best) { s.best = game.elapsed; }
    store.set('sudoku.stats', stats);
    renderControls();
  }

  function onGameAction(a, el) {
    message = '';
    tick();
    if (a === 'cell') {
      var i = +el.getAttribute('data-i');
      sel = (sel === i) ? -1 : i;
    } else if (a === 'digit') { putDigit(+el.getAttribute('data-d')); }
    else if (a === 'notes') { noteMode = !noteMode; }
    else if (a === 'erase') { erase(); }
    else if (a === 'undo') { undo(); }
    else if (a === 'hint') { hint(); }
    else if (a === 'check') { check(); }
    else { return; }
    refresh();
    saveGame();
  }

  // ---- input ----------------------------------------------------------------
  function onAction(a, el) {
    var level = el.getAttribute('data-l');
    if (a === 'menu') { leaveGame(); }
    else if (a === 'continue' && game) { renderGame(); }
    else if (a === 'new') {
      if (game && !game.done && game.undo.length) { renderMenu(level); } else { startNew(level); }
    }
    else if (a === 'newok') { startNew(level); }
    else if (a === 'settings') { openSettings(); }
    else if (a === 'settingsback') { closeSettings(); }
    else if (a === 'lang' && screen === 'settings') { setLang(el.getAttribute('data-v'), true); renderSettings(); }
    else if (screen === 'game' && game && !game.done) { onGameAction(a, el); }
  }
  function leaveGame() {
    if (screen === 'game') { tick(); saveGame(); }
    lastTick = 0;
    renderMenu();
  }
  document.addEventListener('click', function (e) {
    var el = e.target;
    while (el && el !== document && !(el.getAttribute && el.getAttribute('data-a'))) { el = el.parentNode; }
    if (!el || el === document) { return; }
    if (e.preventDefault) { e.preventDefault(); }
    if (LABEL[el.getAttribute('data-l')] || !el.getAttribute('data-l')) { onAction(el.getAttribute('data-a'), el); }
  }, false);
  // A keyboard, when there is one (testing on a computer).
  document.addEventListener('keydown', function (e) {
    if (screen !== 'game' || !game || game.done) { return; }
    var k = e.keyCode, fake = { getAttribute: function () { return String(k - 48); } };
    if (k >= 49 && k <= 57) { onGameAction('digit', fake); }
    else if (k === 8 || k === 46) { onGameAction('erase'); }
    else if (k >= 37 && k <= 40 && sel >= 0) {
      var r = Math.floor(sel / 9), c = sel % 9;
      if (k === 37) { c = (c + 8) % 9; } else if (k === 39) { c = (c + 1) % 9; }
      else if (k === 38) { r = (r + 8) % 9; } else { r = (r + 1) % 9; }
      sel = r * 9 + c; message = ''; refresh();
    } else { return; }
    if (e.preventDefault) { e.preventDefault(); }
  }, false);

  // ---- Kindle title bar (same setup as Vault, kindle-vault) --------------------------------
  function setupChrome(title) {
    try {
      if (window.kindle && kindle.messaging) {
        kindle.messaging.sendMessage('com.lab126.chromebar', 'configureChrome', {
          appId: APP_ID,
          searchBar: { clientParams: { profile: { name: 'default', buttons: [
            { id: 'back', state: 'enabled', handling: 'notifyapp' }
          ] } } },
          topNavBar: { template: 'title', title: title, buttons: [
            { id: 'KPP_BACK', state: 'enabled', handling: 'notifyApp' },
            { id: 'KPP_CLOSE', state: 'enabled', handling: 'system' }
          ] }
        });
      }
    } catch (e) { /* not on a Kindle */ }
  }
  function onBarButton(property, id) {
    var s = typeof id === 'object' ? JSON.stringify(id) : String(id);
    if (!/back/i.test(s)) { return; }
    if (screen === 'settings') { closeSettings(); return; }
    if (screen === 'game') { leaveGame(); return; }
    // On the menu, back leaves the app.
    try { kindle.appmgr.back(); } catch (e) { /* the X in the title bar always works */ }
  }
  function initKindle() {
    try {
      if (window.kindle && kindle.messaging) {
        // New firmware (KPPChrome) sets the LIPC property "invokeAction" = KPP_BACK on
        // the app; older chrome uses "searchBarButtonSelected" = back.
        kindle.messaging.receiveMessage('invokeAction', onBarButton);
        kindle.messaging.receiveMessage('searchBarButtonSelected', onBarButton);
      }
    } catch (e) { /* not on a Kindle */ }
  }

  // ---- start ----------------------------------------------------------------
  window.onresize = function () { layout(); };
  layout();
  setLang(store.get('sudoku.lang'), false);
  loadStats();
  loadGame();
  initKindle();
  // Straight back into an unfinished game: the Kindle unloads the app when it sleeps.
  if (game && !game.done) { renderGame(); } else { renderMenu(); }
})();
