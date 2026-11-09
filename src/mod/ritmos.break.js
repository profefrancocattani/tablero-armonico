// node ritmos.break.js  → pruebas de borde para ritmos.js. Sale 0 si todas las
// pruebas duras pasan; los "probe" sólo imprimen WARN (observaciones de borde
// que no rompen la API acordada pero conviene conocer al integrar).
'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const R = require(path.join(__dirname, 'ritmos.js'));
const SRC = fs.readFileSync(path.join(__dirname, 'ritmos.js'), 'utf8');

let passed = 0, failed = 0, warns = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok    ' + name); }
  catch (e) { failed++; console.log('FAIL  ' + name + '\n      ' + (e && e.message)); }
}
function probe(name, fn) {
  try { fn(); console.log('ok    (probe) ' + name); }
  catch (e) { warns++; console.log('WARN  (probe) ' + name + '\n      ' + (e && e.message)); }
}
const sortLetters = (code) => String(code || '').split('').sort().join('');
const ALPHA = new Set(R.ALPHABET.split(''));
const ALL_DIVS = [2, 3, 4, 6];

/* ------------------------------------------------------ meters / divs */
test('divsFor: todas las combinaciones meter × div y metros desconocidos', () => {
  const want = { '4/4': [2, 4], '3/4': [2, 4], '6/8': [3, 6], '2/4': [2, 4] };
  R.meters.forEach((m) => {
    assert.deepStrictEqual(R.divsFor(m), want[m], m);
    R.divsFor(m).forEach((d) => assert.ok(ALL_DIVS.indexOf(d) >= 0, m + ' div ' + d + ' fuera de {2,3,4,6}'));
  });
  ['5/4', '', undefined, null, 44, '4/4 ', 'x'].forEach((m) => assert.deepStrictEqual(R.divsFor(m), [], 'divsFor(' + m + ')'));
  // devuelve copia: mutar el resultado no toca el siguiente llamado
  const a = R.divsFor('4/4'); a.push(99); a[0] = 0;
  assert.deepStrictEqual(R.divsFor('4/4'), [2, 4], 'divsFor comparte el array interno');
});

test('beatsPerBar y lengthFor para cada meter × div', () => {
  const beats = { '4/4': 4, '3/4': 3, '6/8': 2, '2/4': 2 };
  R.meters.forEach((m) => {
    assert.strictEqual(R.beatsPerBar(m), beats[m], m);
    R.divsFor(m).forEach((d) => assert.strictEqual(R.lengthFor(m, d), beats[m] * d, m + ' div ' + d));
  });
  assert.strictEqual(R.beatsPerBar('7/8'), 0);
  assert.strictEqual(R.beatsPerBar(undefined), 0);
  assert.strictEqual(R.lengthFor('7/8', 2), 0);
  assert.strictEqual(R.lengthFor(undefined, 2), 0);
});

/* ----------------------------------------------------------- metrónomo */
test('countIn: largo exacto, C sólo en 0, c en cada pulso, nada en subdivisiones', () => {
  R.meters.forEach((m) => R.divsFor(m).forEach((d) => {
    const ci = R.countIn(m, d);
    const n = R.lengthFor(m, d);
    assert.strictEqual(ci.length, n, m + ' div ' + d + ': largo');
    ci.forEach((c, i) => {
      assert.ok(['C', 'c', ''].indexOf(c) >= 0, m + ' div ' + d + ' paso ' + i + ': valor ' + c);
      if (i === 0) assert.strictEqual(c, 'C', m + ' div ' + d + ': C en 0');
      else if (i % d === 0) assert.strictEqual(c, 'c', m + ' div ' + d + ' paso ' + i + ': c en pulso');
      else assert.strictEqual(c, '', m + ' div ' + d + ' paso ' + i + ': subdivisión');
    });
    assert.strictEqual(ci.filter((c) => c === 'C').length, 1, m + ' div ' + d + ': una sola C');
    assert.strictEqual(ci.filter((c) => c === 'c').length, R.beatsPerBar(m) - 1, m + ' div ' + d + ': c por pulso');
  }));
  assert.deepStrictEqual(R.countIn('6/8', 6), ['C', '', '', '', '', '', 'c', '', '', '', '', '']);
  assert.deepStrictEqual(R.countIn('5/4', 2), []);
  assert.deepStrictEqual(R.countIn(undefined, undefined), []);
  assert.deepStrictEqual(R.countIn('4/4', undefined), []);
  assert.deepStrictEqual(R.countIn('4/4', 0), []);
});

test('clickFor consistente con countIn en todos los índices (3 vueltas) y negativos', () => {
  R.meters.forEach((m) => R.divsFor(m).forEach((d) => {
    const ci = R.countIn(m, d), n = ci.length;
    for (let i = 0; i < n * 3; i++) assert.strictEqual(R.clickFor(m, d, i), ci[i % n], m + ' div ' + d + ' i=' + i);
    for (let i = -n * 2; i < 0; i++) assert.strictEqual(R.clickFor(m, d, i), ci[((i % n) + n) % n], m + ' div ' + d + ' i=' + i);
  }));
  assert.strictEqual(R.clickFor('4/4', 2, undefined), '');
  assert.strictEqual(R.clickFor('4/4', 2, NaN), '');
  assert.strictEqual(R.clickFor('4/4', 2, 1.5), '');
  assert.strictEqual(R.clickFor('4/4', undefined, 0), '');
  assert.strictEqual(R.clickFor('4/4', 0, 0), '');
  assert.strictEqual(R.clickFor(undefined, 2, 0), '');
});

test('stepSeconds = 60/bpm/div', () => {
  [[60, 2, 0.5], [120, 4, 0.125], [90, 3, 60 / 90 / 3], [100, 6, 0.1]].forEach(([bpm, d, want]) =>
    assert.ok(Math.abs(R.stepSeconds(bpm, d) - want) < 1e-12, bpm + '/' + d));
});

/* ------------------------------------------------------ datos: ids etc. */
test('ids únicos en patrones, fills y endings; índices byId consistentes', () => {
  [['patterns', 'byId'], ['fills', 'fillById'], ['endings', 'endingById']].forEach(([list, idx]) => {
    const seen = new Set();
    R[list].forEach((x) => {
      assert.ok(typeof x.id === 'string' && /^[a-z0-9_-]+$/i.test(x.id), list + ': id inválido ' + x.id);
      assert.ok(!seen.has(x.id), list + ': id repetido ' + x.id); seen.add(x.id);
      assert.strictEqual(R[idx][x.id], x, list + ': ' + idx + ' no apunta al mismo objeto');
    });
    assert.strictEqual(Object.keys(R[idx]).length, R[list].length, idx + ' tiene claves de más');
  });
});

test('patrones: 25, largo correcto, códigos en orden canónico y sin repetir, validate ok', () => {
  assert.strictEqual(R.patterns.length, 25);
  R.patterns.forEach((p) => {
    assert.ok(R.meters.indexOf(p.meter) >= 0, p.id + ': meter');
    assert.ok(R.divsFor(p.meter).indexOf(p.div) >= 0, p.id + ': div ' + p.div + ' no vale en ' + p.meter);
    assert.strictEqual(p.steps.length, R.lengthFor(p.meter, p.div), p.id + ': largo');
    p.steps.forEach((c, i) => {
      assert.strictEqual(R.canon(c), c, p.id + ' paso ' + i + ': "' + c + '" no está en orden canónico');
      for (const ch of c) assert.ok(ALPHA.has(ch), p.id + ' paso ' + i + ': "' + ch + '" fuera del alfabeto');
      assert.strictEqual(new Set(c).size, c.length, p.id + ' paso ' + i + ': letra repetida');
    });
    assert.ok(p.steps.some((c) => c), p.id + ': vacío');
    const v = R.validate(p); assert.ok(v.ok, p.id + ': ' + v.errors.join(' | '));
    assert.ok(R.groups.indexOf(p.group) >= 0, p.id + ': grupo');
  });
  // la grilla del editor cubre lo que los patrones usan, salvo proyecciones documentadas
  const rowCodes = new Set(R.rows.flatMap((r) => (r.soft ? [r.code, r.soft] : [r.code])));
  R.patterns.forEach((p) => p.steps.forEach((c) => { for (const ch of c) assert.ok(rowCodes.has(ch) || 'STb56'.indexOf(ch) >= 0, p.id + ': "' + ch + '" sin fila ni proyección'); }));
});

test('fills: cada byDiv[d] tiene exactamente d pasos, sólo divs 2/3/4/6, códigos válidos', () => {
  assert.strictEqual(R.fills.length, 5);
  R.fills.forEach((f) => {
    assert.deepStrictEqual(Object.keys(f.byDiv).map(Number).sort((a, b) => a - b), ALL_DIVS, f.id + ': claves byDiv');
    ALL_DIVS.forEach((d) => {
      const piece = f.byDiv[d];
      assert.ok(Array.isArray(piece), f.id + ' div ' + d);
      assert.strictEqual(piece.length, d, f.id + ' div ' + d + ': largo ' + piece.length);
      assert.ok(piece.some((c) => c), f.id + ' div ' + d + ': relleno vacío');
      piece.forEach((c, i) => {
        assert.strictEqual(R.canon(c), c, f.id + ' div ' + d + ' paso ' + i + ': orden canónico');
        for (const ch of c) assert.ok(ALPHA.has(ch), f.id + ' div ' + d + ': "' + ch + '" fuera del alfabeto');
      });
    });
  });
});

test('applyFill: copia, sólo cambia el último pulso, el resultado sigue validando', () => {
  R.patterns.forEach((p) => R.fills.forEach((f) => {
    const before = p.steps.slice();
    const out = R.applyFill(p, f.id);
    assert.notStrictEqual(out, p.steps, p.id + '/' + f.id + ': devuelve el mismo array');
    assert.deepStrictEqual(p.steps, before, p.id + '/' + f.id + ': mutó el patrón original');
    assert.strictEqual(out.length, p.steps.length);
    assert.deepStrictEqual(out.slice(0, -p.div), p.steps.slice(0, -p.div));
    assert.deepStrictEqual(out.slice(-p.div), f.byDiv[p.div]);
    const v = R.validate(Object.assign({}, p, { steps: out }));
    assert.ok(v.ok, p.id + '/' + f.id + ': ' + v.errors.join(' | '));
  }));
  // fill inexistente o undefined → copia sin cambios
  assert.deepStrictEqual(R.applyFill(R.byId.pop, 'nada'), R.byId.pop.steps);
  assert.deepStrictEqual(R.applyFill(R.byId.pop, undefined), R.byId.pop.steps);
  assert.notStrictEqual(R.applyFill(R.byId.pop, undefined), R.byId.pop.steps);
});

test('endings: div válido, largo múltiplo de div, holdBeats numérico, códigos válidos', () => {
  assert.strictEqual(R.endings.length, 6);
  ['largo', 'doble', 'subida', 'seco', 'bajo', 'triple'].forEach((id) => assert.ok(R.endingById[id], 'falta ' + id));
  R.endings.forEach((e) => {
    assert.ok(ALL_DIVS.indexOf(e.div) >= 0, e.id + ': div ' + e.div);
    assert.ok(e.steps.length > 0 && e.steps.length % e.div === 0, e.id + ': largo ' + e.steps.length + ' no es múltiplo de ' + e.div);
    assert.ok(Number.isInteger(e.holdBeats) && e.holdBeats >= 0, e.id + ': holdBeats');
    assert.ok(e.steps.some((c) => c), e.id + ': vacío');
    e.steps.forEach((c, i) => {
      assert.strictEqual(R.canon(c), c, e.id + ' paso ' + i + ': orden canónico');
      for (const ch of c) assert.ok(ALPHA.has(ch), e.id + ': "' + ch + '" fuera del alfabeto');
    });
  });
  assert.strictEqual(R.endingById.seco.holdBeats, 0);
  assert.strictEqual(R.endingById.largo.steps.length, 2);
  assert.strictEqual(R.endingById.subida.steps.length, 6);
});

/* ------------------------------------------------------- toGrid/fromGrid */
// Proyección independiente del módulo, según la documentación: S→d, b→B,
// T→4, 5→1, 6→2; si en una celda coinciden fuerte y suave gana el fuerte.
function projectCode(code) {
  const PROJ = { S: 'd', b: 'B', T: '4', 5: '1', 6: '2' };
  const SOFT = { d: 'D', u: 'U' };
  const strong = new Set(), soft = new Set();
  for (const ch0 of code) {
    const ch = PROJ[ch0] || ch0;
    if (SOFT[ch]) soft.add(SOFT[ch]); else strong.add(ch);
  }
  let out = '';
  strong.forEach((ch) => { out += ch; });
  soft.forEach((ch) => { if (!strong.has(ch)) out += ch.toLowerCase(); });
  return out;
}

test('round-trip toGrid/fromGrid: todos los patrones, fills y endings (letras normalizadas)', () => {
  const lists = [];
  R.patterns.forEach((p) => lists.push([p.id, p.steps]));
  R.fills.forEach((f) => ALL_DIVS.forEach((d) => lists.push(['fill ' + f.id + '/' + d, f.byDiv[d]])));
  R.endings.forEach((e) => lists.push(['ending ' + e.id, e.steps]));
  lists.forEach(([where, list]) => {
    const copy = list.slice();
    const grid = R.toGrid(list);
    assert.deepStrictEqual(list, copy, where + ': toGrid mutó steps');
    assert.strictEqual(grid.length, R.rows.length, where + ': filas');
    grid.forEach((row, r) => {
      assert.strictEqual(row.length, list.length, where + ': columnas fila ' + r);
      row.forEach((v, s) => {
        assert.ok(v === 0 || v === 1 || v === 2, where + ': valor ' + v);
        if (v === 2) assert.ok(R.rows[r].soft, where + ' paso ' + s + ': suave en fila sin soft');
      });
    });
    const back = R.fromGrid(grid);
    assert.strictEqual(back.length, list.length, where + ': largo');
    list.forEach((c, i) => {
      assert.strictEqual(sortLetters(back[i]), sortLetters(projectCode(c)), where + ' paso ' + i + ': "' + c + '" → "' + back[i] + '"');
      assert.strictEqual(R.canon(back[i]), back[i], where + ' paso ' + i + ': fromGrid no devolvió orden canónico');
    });
    if (R.usesOnlyRowCodes(list)) assert.deepStrictEqual(back, list, where + ': round-trip exacto esperado');
    assert.deepStrictEqual(R.normalize(back), back, where + ': normalize no idempotente');
    assert.deepStrictEqual(R.normalize(list), back, where + ': normalize ≠ fromGrid(toGrid)');
  });
});

test('toGrid/fromGrid: bordes (vacío, undefined en celdas, letras fuera del alfabeto, grilla rala)', () => {
  assert.deepStrictEqual(R.fromGrid([]), []);
  assert.deepStrictEqual(R.toGrid([]).map((r) => r.length), R.rows.map(() => 0));
  assert.deepStrictEqual(R.normalize([]), []);
  assert.deepStrictEqual(R.normalize([undefined, null, '', 0]), ['', '', '', '']);
  // letras fuera del alfabeto se descartan sin romper
  assert.deepStrictEqual(R.normalize(['QB', 'C', 'c']), ['B', '', '']);
  // grilla con filas faltantes o cortas
  assert.deepStrictEqual(R.fromGrid([[1, 0, 1]]), ['B', '', 'B']);
  assert.deepStrictEqual(R.fromGrid([[1], undefined, [2]]), ['Bd']);
  // valores que no son 0/1/2 se ignoran
  assert.deepStrictEqual(R.fromGrid([[3, true, '1']]), ['', '', '']);
  // mismo paso: fuerte gana, duplicados colapsan
  assert.deepStrictEqual(R.normalize(['DdS', 'Uu', '4T', '15', '26', 'bB']), ['D', 'U', '4', '1', '2', 'B']);
  // canon
  assert.strictEqual(R.canon('UDB'), 'BDU');
  assert.strictEqual(R.canon('XMuUdDST654321bFB'), R.CANON);
  assert.strictEqual(R.canon(''), '');
  assert.strictEqual(R.canon(undefined), '');
  assert.strictEqual(R.canon(null), '');
  assert.strictEqual(R.canon('BB'), 'B');
  assert.strictEqual(R.canon('Q'), '');
  // usesOnlyRowCodes
  assert.strictEqual(R.usesOnlyRowCodes([]), true);
  assert.strictEqual(R.usesOnlyRowCodes(['', 'BDdUuMX1234']), true);
  ['S', 'T', 'b', '5', '6'].forEach((ch) => assert.strictEqual(R.usesOnlyRowCodes([ch]), false, ch));
  assert.strictEqual(R.usesOnlyRowCodes(['Q']), false);
  assert.strictEqual(R.usesOnlyRowCodes([undefined, null]), true);
});

/* --------------------------------------------------------------- resize */
test('resize en todos los sentidos: recorte, relleno, ×2, ×3, copia, no muta', () => {
  const s = ['B', 'D', 'U', ''];
  const before = s.slice();
  assert.deepStrictEqual(R.resize(s, 1), ['B']);
  assert.deepStrictEqual(R.resize(s, 3), ['B', 'D', 'U']);
  assert.deepStrictEqual(R.resize(s, 4), s);
  assert.notStrictEqual(R.resize(s, 4), s);
  assert.deepStrictEqual(R.resize(s, 5), ['B', 'D', 'U', '', '']);
  assert.deepStrictEqual(R.resize(s, 6), ['B', 'D', 'U', '', '', '']);
  assert.deepStrictEqual(R.resize(s, 8), s.concat(s));
  assert.deepStrictEqual(R.resize(s, 12), s.concat(s, s));
  assert.deepStrictEqual(R.resize(s, 16), s.concat(s, s, s));
  assert.deepStrictEqual(R.resize(s, 10), s.concat(['', '', '', '', '', '']));
  assert.deepStrictEqual(R.resize(s, 0), []);
  assert.deepStrictEqual(R.resize(s, -3), []);
  assert.deepStrictEqual(R.resize(s, 7.9), s.concat(['', '', ''])); // floor
  assert.deepStrictEqual(R.resize(s, '8'), s.concat(s));            // string numérica
  assert.deepStrictEqual(R.resize([], 3), ['', '', '']);
  assert.deepStrictEqual(R.resize([], 0), []);
  assert.deepStrictEqual(s, before, 'resize mutó el original');
  // todas las transiciones meter/div reales
  R.meters.forEach((m1) => R.divsFor(m1).forEach((d1) => R.meters.forEach((m2) => R.divsFor(m2).forEach((d2) => {
    const src = R.blank(m1, d1).steps.map((_, i) => (i % 2 ? '' : 'B'));
    const out = R.resize(src, R.lengthFor(m2, d2));
    assert.strictEqual(out.length, R.lengthFor(m2, d2), m1 + '/' + d1 + ' → ' + m2 + '/' + d2);
    if (out.length % src.length === 0 && out.length >= src.length) {
      for (let i = 0; i < out.length; i++) assert.strictEqual(out[i], src[i % src.length], 'repetición ' + m1 + '/' + d1 + ' → ' + m2 + '/' + d2);
    }
  }))));
});

/* ------------------------------------------------------------- validate */
test('validate: patrones inválidos (largo, código, div, campos faltantes, tipos)', () => {
  const ok = { id: 'x', name: 'X', meter: '4/4', div: 2, steps: ['B', '', '', '', '', '', '', ''] };
  assert.ok(R.validate(ok).ok);
  const bad = (patch, re) => {
    const v = R.validate(Object.assign({}, ok, patch));
    assert.ok(!v.ok, JSON.stringify(patch) + ' debería fallar');
    if (re) assert.ok(v.errors.some((e) => re.test(e)), JSON.stringify(patch) + ': mensaje no menciona el motivo: ' + v.errors.join(' | '));
    return v;
  };
  // largo
  bad({ steps: ['B'] }, /pasos/);
  bad({ steps: ok.steps.concat(['']) }, /pasos/);
  bad({ meter: '6/8', div: 3 }, /pasos/);          // 8 pasos en 6/8 div 3 (pide 6)
  // código desconocido / metrónomo / repetido / tipo
  bad({ steps: ['Q', '', '', '', '', '', '', ''] }, /desconocido/);
  bad({ steps: ['C', '', '', '', '', '', '', ''] }, /desconocido/);
  bad({ steps: ['c', '', '', '', '', '', '', ''] }, /desconocido/);
  bad({ steps: ['BB', '', '', '', '', '', '', ''] }, /repetida/);
  bad({ steps: [7, '', '', '', '', '', '', ''] }, /string/);
  bad({ steps: [null, '', '', '', '', '', '', ''] }, /string/);
  // div inválido para el meter
  bad({ meter: '6/8', div: 2, steps: ['B', '', '', '', '', ''] }, /inválida/);
  bad({ meter: '6/8', div: 4, steps: ['B', '', '', '', '', '', '', ''] }, /inválida/);
  bad({ meter: '4/4', div: 3, steps: ['B', '', '', '', '', '', '', '', '', '', '', ''] }, /inválida/);
  bad({ meter: '4/4', div: 6 }, /inválida/);
  bad({ div: 0 }, /inválida/);
  bad({ div: undefined }, /[Dd]ivisión/);   // 'Falta la división…' (ya no muestra undefined)
  // meter
  bad({ meter: '5/4' }, /Compás/);
  bad({ meter: undefined }, /[Cc]ompás/);   // 'Falta el compás…' (ya no muestra undefined)
  // campos faltantes
  bad({ id: undefined }, /id/);
  bad({ id: '' }, /id/);
  bad({ id: 'con espacio' }, /id/);
  bad({ id: 'ñandú' }, /id/);
  bad({ name: undefined }, /nombre/);
  bad({ name: '   ' }, /nombre/);
  bad({ steps: undefined }, /array/);
  bad({ steps: 'BDUD' }, /array/);
  bad({ steps: ['', '', '', '', '', '', '', ''] }, /vacío/);
  // tipos raros
  [null, undefined, 'pop', 42, [], true].forEach((x) => assert.ok(!R.validate(x).ok, 'validate(' + x + ')'));
  assert.ok(!R.validate({}).ok);
  assert.ok(R.validate({}).errors.length >= 4, 'objeto vacío: ' + R.validate({}).errors.join(' | '));
  // validate no muta
  const p = Object.assign({}, ok, { steps: ok.steps.slice() });
  const snap = JSON.stringify(p); R.validate(p); assert.strictEqual(JSON.stringify(p), snap);
  // fills y endings pasan la revisión de códigos (como pseudo-patrón del largo adecuado)
  R.endings.forEach((e) => {
    const v = R.validate({ id: e.id, name: e.name, meter: '4/4', div: 2, steps: R.resize(e.steps, 8) });
    assert.ok(v.ok, 'ending ' + e.id + ': ' + v.errors.join(' | '));
  });
  // mensajes en rioplatense, sin fórmulas ni palabras prohibidas
  const all = R.validate({ id: 'x y', name: '', meter: '5/4', div: 2, steps: ['Q', 'DD', 7] }).errors.join(' ');
  assert.ok(!/habitar|sostener|intenci[oó]n|genuin|autenticidad/i.test(all));
  assert.ok(/Elegí|poné/i.test(R.validate({ id: 'x', name: 'X', meter: '5/4', div: 2, steps: [''] }).errors.join(' ')));
});

test('blank: patrón vacío válido salvo "vacío", arrays frescos, fallback de meter/div', () => {
  R.meters.forEach((m) => R.divsFor(m).forEach((d) => {
    const b = R.blank(m, d);
    assert.strictEqual(b.meter, m); assert.strictEqual(b.div, d);
    assert.strictEqual(b.steps.length, R.lengthFor(m, d));
    assert.ok(b.steps.every((c) => c === ''));
    const v = R.validate(b);
    assert.ok(!v.ok && v.errors.length === 1 && /vacío/.test(v.errors[0]), m + '/' + d + ': ' + v.errors.join(' | '));
    b.steps[0] = 'B'; assert.ok(R.validate(b).ok);
    assert.ok(R.groups.indexOf(b.group) >= 0);
  }));
  assert.notStrictEqual(R.blank('4/4', 2).steps, R.blank('4/4', 2).steps, 'blank comparte steps');
  assert.strictEqual(R.blank('9/8', 9).meter, '4/4');
  assert.strictEqual(R.blank('9/8', 9).div, 2);
  assert.strictEqual(R.blank('6/8', 2).div, 3, 'div inválido para 6/8 cae al primero válido');
  assert.strictEqual(R.blank().meter, '4/4');
  assert.strictEqual(R.blank().div, 2);
});

/* ------------------------------------------------- compatibilidad Safari */
test('fuente sin APIs que falten en Safari iOS / Chrome Android viejos', () => {
  const body = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const banned = [
    [/\?\?/, 'nullish coalescing ??'], [/\?\.\w/, 'optional chaining ?.'],
    [/\.at\(/, 'Array.prototype.at'], [/structuredClone/, 'structuredClone'],
    [/Object\.hasOwn\b/, 'Object.hasOwn'], [/\.flatMap\(/, 'flatMap'], [/\.flat\(/, 'flat'],
    [/\.replaceAll\(/, 'replaceAll'], [/\.matchAll\(/, 'matchAll'], [/findLast/, 'findLast'],
    [/\(\?<[=!]/, 'regex lookbehind'], [/\bBigInt\b/, 'BigInt'], [/\bglobalThis\b/, 'globalThis'],
    [/\.toSorted\(|\.toReversed\(|\.with\(/, 'change-array-by-copy'], [/\bimport\b|\bexport\b/, 'import/export'],
    [/\bclass\s+\w+\s*\{[\s\S]*?#\w/, 'campos privados #'], [/Array\.prototype\.group|Object\.groupBy/, 'groupBy']
  ];
  banned.forEach(([re, what]) => assert.ok(!re.test(body), 'usa ' + what));
  assert.ok(/if \(typeof module !== 'undefined'\) module\.exports = Ritmos;/.test(SRC), 'falta module.exports');
  assert.ok(!/<\/script/i.test(SRC), 'contiene </script, rompería al pegarlo inline');
});

/* ------------------------------------------------------- probes (WARN) */
probe('byId y patterns comparten referencias: el que edite un patrón del menú tiene que clonarlo', () => {
  assert.strictEqual(R.byId.pop, R.patterns[0]);
  assert.ok(typeof R.clone === 'function', 'no hay Ritmos.clone(pattern); el HTML tendría que copiar {…p, steps: p.steps.slice()} a mano');
});
probe('los arrays de datos no están congelados (un push/splice accidental los corrompe)', () => {
  assert.ok(Object.isFrozen(R.patterns) && Object.isFrozen(R.byId.pop.steps), 'Ritmos.patterns y cada steps son mutables');
});
probe('validate / blank aceptan div como string (lo que devuelve un <select>)', () => {
  const v = R.validate({ id: 'x', name: 'X', meter: '4/4', div: '2', steps: ['B', '', '', '', '', '', '', ''] });
  assert.ok(v.ok, 'div "2" → ' + v.errors.join(' | '));
});
probe('blank con div string cae silenciosamente al primer div', () => {
  assert.strictEqual(R.blank('4/4', '4').div, 4, 'blank("4/4","4").div = ' + R.blank('4/4', '4').div);
});
probe('lengthFor con div undefined devuelve 0 y no NaN', () => {
  assert.strictEqual(R.lengthFor('4/4', undefined), 0, 'devuelve ' + R.lengthFor('4/4', undefined));
});
probe('stepSeconds con bpm 0 / undefined devuelve finito', () => {
  assert.ok(Number.isFinite(R.stepSeconds(0, 2)) && Number.isFinite(R.stepSeconds(undefined, 2)), 'devuelve Infinity/NaN');
});
probe('applyFill con patrón más corto que div no escribe índices negativos', () => {
  const out = R.applyFill({ div: 4, steps: ['B', ''] }, 'redoble');
  assert.strictEqual(out.length, 2, 'largo ' + out.length);
  assert.ok(!Object.keys(out).some((k) => +k < 0), 'claves negativas: ' + Object.keys(out).filter((k) => +k < 0));
});
probe('applyFill con pattern undefined no lanza', () => {
  assert.doesNotThrow(() => R.applyFill(undefined, 'redoble'));
});
probe('toGrid / usesOnlyRowCodes / resize con steps undefined no lanzan', () => {
  assert.doesNotThrow(() => R.toGrid(undefined), 'toGrid(undefined)');
  assert.doesNotThrow(() => R.usesOnlyRowCodes(undefined), 'usesOnlyRowCodes(undefined)');
  assert.doesNotThrow(() => R.resize(undefined, 8), 'resize(undefined, 8)');
});
probe('fromGrid con grid[0] undefined no lanza', () => {
  assert.doesNotThrow(() => R.fromGrid([undefined]));
});
probe('resize con newLength no numérico devuelve copia del mismo largo', () => {
  const s = ['B', 'D'];
  assert.deepStrictEqual(R.resize(s, undefined), s);
  assert.deepStrictEqual(R.resize(s, NaN), s);
  assert.deepStrictEqual(R.resize(s, 'ocho'), s);
});
probe('validate: el mensaje de compás inválido no muestra "undefined"', () => {
  const v = R.validate({ id: 'x', name: 'X', steps: ['B'] });
  assert.ok(!v.errors.some((e) => /undefined/.test(e)), v.errors.join(' | '));
});
probe('validate: un paso con sólo códigos desconocidos no cuenta como "suena"', () => {
  const v = R.validate({ id: 'x', name: 'X', meter: '2/4', div: 2, steps: ['Q', '', '', ''] });
  assert.ok(v.errors.some((e) => /vacío/.test(e)), 'sólo reporta: ' + v.errors.join(' | '));
});

console.log('\n' + passed + ' pruebas ok, ' + failed + ' fallaron, ' + warns + ' avisos (probe).');
process.exit(failed ? 1 : 0);
