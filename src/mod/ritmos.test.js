// node ritmos.test.js  → sale 0 si todo pasa
'use strict';
const assert = require('assert');
const path = require('path');
const R = require(path.join(__dirname, 'ritmos.js'));

let n = 0;
function test(name, fn) { fn(); n++; console.log('ok  ' + name); }

const ALPHA = new Set(R.ALPHABET.split(''));
const ROW_ONLY = new Set(R.rows.flatMap((r) => (r.soft ? [r.code, r.soft] : [r.code])));
const FORBIDDEN_WORDS = /habitar|sostener|intenci[oó]n|genuin|aut[eé]ntic|\bchuck/i;
const FORBIDDEN_FORMS = [/\bno es \w+, es\b/i, /\bmientras .* hace\b/i, /\bpoco \w+, mucho\b/i, /\bes \w+, pero también\b/i, /\bdonde hay .*, no hay\b/i];

function checkCodes(list, where) {
  list.forEach((code, i) => {
    assert.strictEqual(typeof code, 'string', where + ' paso ' + i + ' no es string');
    const seen = new Set();
    for (const ch of code) {
      assert.ok(ALPHA.has(ch), where + ' paso ' + i + ': código fuera del alfabeto "' + ch + '"');
      assert.ok(!seen.has(ch), where + ' paso ' + i + ': letra repetida "' + ch + '"');
      seen.add(ch);
    }
  });
}
function checkRoundTrip(list, where) {
  const back = R.fromGrid(R.toGrid(list));
  assert.strictEqual(back.length, list.length, where + ': cambia el largo');
  if (R.usesOnlyRowCodes(list)) {
    assert.deepStrictEqual(back, list.map(R.canon), where + ': round-trip inexacto');
    assert.deepStrictEqual(back, list, where + ': los códigos no están en orden canónico');
  } else {
    assert.deepStrictEqual(R.normalize(back), back, where + ': normalize no es idempotente');
    list.forEach((c, i) => assert.strictEqual(!!back[i], !!c, where + ': cambia qué pasos suenan'));
  }
}

test('metros y divisiones', () => {
  assert.deepStrictEqual(R.meters, ['4/4', '3/4', '6/8', '2/4']);
  assert.strictEqual(R.beatsPerBar('4/4'), 4);
  assert.strictEqual(R.beatsPerBar('3/4'), 3);
  assert.strictEqual(R.beatsPerBar('6/8'), 2);
  assert.strictEqual(R.beatsPerBar('2/4'), 2);
  assert.deepStrictEqual(R.divsFor('6/8'), [3, 6]);
  ['4/4', '3/4', '2/4'].forEach((m) => assert.deepStrictEqual(R.divsFor(m), [2, 4]));
  const want = { '4/4': { 2: 8, 4: 16 }, '3/4': { 2: 6, 4: 12 }, '6/8': { 3: 6, 6: 12 }, '2/4': { 2: 4, 4: 8 } };
  Object.keys(want).forEach((m) => Object.keys(want[m]).forEach((d) => assert.strictEqual(R.lengthFor(m, +d), want[m][d], m + ' div ' + d)));
  assert.ok(Math.abs(R.stepSeconds(120, 2) - 0.25) < 1e-9);
});

test('patrones: ids únicos, grupos en orden, validación y longitudes', () => {
  assert.ok(R.patterns.length >= 20, 'hay ' + R.patterns.length + ' patrones, se pedían al menos 20');
  const ids = new Set();
  let lastGroup = -1;
  R.patterns.forEach((p) => {
    assert.ok(!ids.has(p.id), 'id repetido ' + p.id); ids.add(p.id);
    assert.strictEqual(R.byId[p.id], p);
    const g = R.groups.indexOf(p.group);
    assert.ok(g >= 0, p.id + ': grupo desconocido ' + p.group);
    assert.ok(g >= lastGroup, p.id + ': los grupos tienen que venir ordenados'); lastGroup = g;
    const v = R.validate(p);
    assert.ok(v.ok, p.id + ': ' + v.errors.join(' | '));
    assert.strictEqual(p.steps.length, R.lengthFor(p.meter, p.div), p.id + ': largo');
    assert.ok(p.desc && p.desc.length > 20, p.id + ': falta desc');
    assert.ok(!FORBIDDEN_WORDS.test(p.desc), p.id + ': palabra prohibida en desc');
    FORBIDDEN_FORMS.forEach((re) => assert.ok(!re.test(p.desc), p.id + ': fórmula prohibida en desc'));
    checkCodes(p.steps, p.id);
  });
  ['pop', 'balada', 'arpegio', 'folk', 'vals', 'rock'].forEach((id) => assert.ok(R.byId[id], 'falta el patrón original ' + id));
  ['chacarera', 'zamba', 'chamame', 'cueca', 'bossa', 'reggae', 'cumbia', 'huayno', 'milonga', 'bolero', 'balada68', 'pop16', 'valscriollo']
    .forEach((id) => assert.ok(R.byId[id], 'falta el patrón pedido ' + id));
  assert.strictEqual(R.byId.chacarera.meter, '6/8');
  assert.strictEqual(R.byId.huayno.meter, '2/4');
  assert.strictEqual(R.byId.bossa.div, 4);
  // chacarera: bajo en la 1.ª corchea y quinta (bordoneo) en la 4.ª
  const ch = R.byId.chacarera, per = ch.div / 3;
  assert.ok(ch.steps[0].indexOf('B') >= 0 && ch.steps[3 * per].indexOf('F') >= 0, 'chacarera: bajo en 1 y quinta en 4');
});

test('round-trip toGrid/fromGrid sobre patrones y rellenos', () => {
  R.patterns.forEach((p) => checkRoundTrip(p.steps, p.id));
  R.fills.forEach((f) => Object.keys(f.byDiv).forEach((d) => checkRoundTrip(f.byDiv[d], 'fill ' + f.id + ' div ' + d)));
  R.endings.forEach((e) => checkRoundTrip(e.steps, 'ending ' + e.id));
  // forma de la grilla
  const g = R.toGrid(R.byId.pop.steps);
  assert.strictEqual(g.length, R.rows.length);
  g.forEach((row) => assert.strictEqual(row.length, 8));
  // proyecciones documentadas
  assert.deepStrictEqual(R.normalize(['S', 'b', 'T', '5', '6', 'bS']), ['d', 'B', '4', '1', '2', 'Bd']);
  // fuerte gana sobre suave en la misma celda
  assert.deepStrictEqual(R.normalize(['Dd', 'dS']), ['D', 'd']);
  // valores sólo 0/1/2 y 2 sólo en filas con soft
  R.patterns.forEach((p) => R.toGrid(p.steps).forEach((row, i) => row.forEach((v) => {
    assert.ok([0, 1, 2].indexOf(v) >= 0);
    if (v === 2) assert.ok(R.rows[i].soft, 'valor suave en fila sin soft');
  })));
});

test('rellenos: ids pedidos, un pulso por división', () => {
  ['redoble', 'subida', 'corte', 'vuelta', 'bajo'].forEach((id) => assert.ok(R.fillById[id], 'falta fill ' + id));
  R.fills.forEach((f) => {
    [2, 3, 4, 6].forEach((d) => {
      assert.ok(Array.isArray(f.byDiv[d]), f.id + ': falta div ' + d);
      assert.strictEqual(f.byDiv[d].length, d, f.id + ' div ' + d + ': tiene que durar un pulso');
      checkCodes(f.byDiv[d], 'fill ' + f.id + ' div ' + d);
      assert.ok(f.byDiv[d].some((c) => c), f.id + ' div ' + d + ': relleno vacío');
    });
  });
  R.patterns.forEach((p) => R.fills.forEach((f) => {
    const s = R.applyFill(p, f.id);
    assert.strictEqual(s.length, p.steps.length);
    assert.deepStrictEqual(s.slice(0, s.length - p.div), p.steps.slice(0, s.length - p.div));
    assert.deepStrictEqual(s.slice(-p.div), f.byDiv[p.div]);
  }));
  assert.deepStrictEqual(R.applyFill(R.byId.pop, 'inexistente'), R.byId.pop.steps);
});

test('finales', () => {
  ['largo', 'doble', 'subida', 'seco'].forEach((id) => assert.ok(R.endingById[id], 'falta ending ' + id));
  R.endings.forEach((e) => {
    assert.ok([2, 3, 4, 6].indexOf(e.div) >= 0, e.id + ': div');
    assert.ok(e.steps.length > 0 && e.steps.length % e.div === 0, e.id + ': largo múltiplo de div');
    assert.ok(typeof e.holdBeats === 'number' && e.holdBeats >= 0, e.id + ': holdBeats');
    checkCodes(e.steps, 'ending ' + e.id);
  });
  assert.strictEqual(R.endingById.seco.holdBeats, 0);
});

test('metrónomo: countIn y clickFor para cada meter/div', () => {
  R.meters.forEach((m) => R.divsFor(m).forEach((d) => {
    const ci = R.countIn(m, d);
    assert.strictEqual(ci.length, R.lengthFor(m, d), m + ' div ' + d + ': largo');
    ci.forEach((c, i) => {
      const want = i % d !== 0 ? '' : i === 0 ? 'C' : 'c';
      assert.strictEqual(c, want, m + ' div ' + d + ' paso ' + i);
      assert.strictEqual(R.clickFor(m, d, i), want);
      assert.strictEqual(R.clickFor(m, d, i + ci.length), want, 'clickFor cíclico');
    });
    assert.strictEqual(ci.filter((c) => c === 'C').length, 1);
    assert.strictEqual(ci.filter((c) => c === 'c').length, R.beatsPerBar(m) - 1);
  }));
  assert.deepStrictEqual(R.countIn('6/8', 3), ['C', '', '', 'c', '', '']);
  assert.deepStrictEqual(R.countIn('2/4', 2), ['C', '', 'c', '']);
  assert.strictEqual(R.clickFor('5/4', 2, 0), '');
});

test('resize', () => {
  const s = ['B', 'D', 'U', ''];
  assert.deepStrictEqual(R.resize(s, 4), s);
  assert.notStrictEqual(R.resize(s, 4), s, 'devuelve copia');
  assert.deepStrictEqual(R.resize(s, 2), ['B', 'D']);
  assert.deepStrictEqual(R.resize(s, 8), ['B', 'D', 'U', '', 'B', 'D', 'U', '']);
  assert.deepStrictEqual(R.resize(s, 12), ['B', 'D', 'U', '', 'B', 'D', 'U', '', 'B', 'D', 'U', '']);
  assert.deepStrictEqual(R.resize(s, 6), ['B', 'D', 'U', '', '', '']);
  assert.deepStrictEqual(R.resize(s, 0), []);
  assert.deepStrictEqual(R.resize([], 3), ['', '', '']);
  // 6/8 div 3 → div 6: se duplica el largo, el patrón se repite
  assert.strictEqual(R.resize(R.byId.zamba.steps, R.lengthFor('6/8', 6)).length, 12);
});

test('validate detecta errores', () => {
  const bad = R.validate({ id: 'x y', name: '', meter: '5/4', div: 2, steps: ['Q', 'DD', ''] });
  assert.ok(!bad.ok && bad.errors.length >= 5, bad.errors.join(' | '));
  assert.ok(!R.validate({ id: 'a', name: 'A', meter: '6/8', div: 2, steps: ['B', '', '', '', '', ''] }).ok, 'div 2 no vale en 6/8');
  assert.ok(!R.validate({ id: 'a', name: 'A', meter: '4/4', div: 2, steps: ['B', ''] }).ok, 'largo');
  assert.ok(!R.validate({ id: 'a', name: 'A', meter: '4/4', div: 2, steps: ['', '', '', '', '', '', '', ''] }).ok, 'vacío');
  assert.ok(!R.validate(null).ok);
  const b = R.blank('3/4', 4);
  assert.strictEqual(b.steps.length, 12);
  b.steps[0] = 'B';
  assert.ok(R.validate(b).ok, R.validate(b).errors.join(' | '));
  assert.strictEqual(R.blank('9/8', 9).meter, '4/4');
});

/* ===================== Regresión: revisión musical (r3) ===================== */
test('r3: steps corregidos de huayno, chamamé, bossa, bolero, chacarera, cueca, zamba, vals criollo', () => {
  const want = {
    huayno: ['B', '', 'D', 'u', 'F', '', 'D', 'u'],
    chamame: ['B', 'D', 'M', 'F', 'D', 'M'],
    bossa: ['B', '', '', 'S', '', '', 'FS', '', 'F', '', 'S', '', '', 'S', 'B', ''],
    bolero: ['B', '', '', '', 'S', '', '', '', 'FS', '', 'S', '', '', '', 'S', ''],
    bolerotrio: ['B', '', '2', '3', '4', '', '3', '2', 'F', '', '2', '3', 'T', '', '3', '2'],
    chacarera: ['BD', '', 'M', 'u', 'D', '', 'FM', 'u', 'D', '', 'M', 'u'],
    cueca: ['BD', 'u', 'D', 'Fu', 'D', 'u'],
    zamba: ['B', '', 'D', 'u', 'D', 'u'],
    valscriollo: ['B', '', 'D', 'u', 'FD', 'u']
  };
  Object.keys(want).forEach((id) => {
    const p = R.byId[id];
    assert.ok(p, 'falta ' + id);
    assert.deepStrictEqual(p.steps, want[id], id + ': steps');
    assert.strictEqual(p.steps.length, R.lengthFor(p.meter, p.div), id + ': largo');
    assert.ok(R.validate(p).ok, id + ': ' + R.validate(p).errors.join(' | '));
    p.steps.forEach((c, i) => assert.strictEqual(R.canon(c), c, id + ' paso ' + i + ': orden canónico'));
  });
  // huayno: bajo en cada pulso (tónica, quinta) con hueco de corchea después
  assert.strictEqual(R.byId.huayno.meter, '2/4'); assert.strictEqual(R.byId.huayno.div, 4);
  assert.strictEqual(R.byId.huayno.steps[1], ''); assert.strictEqual(R.byId.huayno.steps[5], '');
  // chamamé: chasquido en las corcheas 3 y 6
  assert.strictEqual(R.byId.chamame.steps[2], 'M'); assert.strictEqual(R.byId.chamame.steps[5], 'M');
  // bossa: la anticipación del tres es la quinta y la del uno la tónica grave
  assert.ok(R.byId.bossa.steps[6].indexOf('F') >= 0 && R.byId.bossa.steps[6].indexOf('b') < 0);
  assert.strictEqual(R.byId.bossa.steps[14], 'B');
  // bolero rítmico: acorde anticipado en el cuatro y medio; el arpegio quedó en bolerotrio
  assert.strictEqual(R.byId.bolero.steps[14], 'S');
  assert.strictEqual(R.byId.bolero.name, 'Bolero 4/4');
  assert.strictEqual(R.byId.bolerotrio.name, 'Bolero arpegiado');
  assert.strictEqual(R.byId.bolerotrio.group, 'Latinoamérica');
  assert.strictEqual(R.byId.bolerotrio.meter, '4/4'); assert.strictEqual(R.byId.bolerotrio.div, 4);
  assert.strictEqual(R.patterns.indexOf(R.byId.bolerotrio), R.patterns.indexOf(R.byId.bolero) + 1, 'bolerotrio va junto a bolero');
  // zamba: ningún arriba fuerte
  assert.ok(R.byId.zamba.steps.every((c) => c.indexOf('U') < 0), 'zamba sin U');
  // vals criollo: aire después del uno y quinta en el tres
  assert.strictEqual(R.byId.valscriollo.steps[1], ''); assert.ok(R.byId.valscriollo.steps[4].indexOf('F') >= 0);
  // los 6 originales siguen con sus ids y sus steps
  assert.deepStrictEqual(R.byId.pop.steps, ['BD', '', 'D', 'U', '', 'U', 'D', 'U']);
  assert.deepStrictEqual(R.byId.balada.steps, ['B', '', 'S', '', 'bS', '', 'S', 'u']);
  assert.deepStrictEqual(R.byId.arpegio.steps, ['B', '1', '2', '3', '4', '3', '2', '1']);
  assert.deepStrictEqual(R.byId.folk.steps, ['B', '2', 'F', '3', 'B', '2', 'F', '4']);
  assert.deepStrictEqual(R.byId.vals.steps, ['B', '', 'S', '', 'S', 'u']);
  assert.deepStrictEqual(R.byId.rock.steps, ['BD', 'd', 'D', 'd', 'BD', 'd', 'D', 'd']);
  assert.strictEqual(R.patterns.length, 25);
});

test('r3: fill corte frena (chasquido + golpe + silencio) y los fills en 6/8 llevan la quinta', () => {
  assert.deepStrictEqual(R.fillById.corte.byDiv, { 2: ['M', 'X'], 3: ['M', '', 'X'], 4: ['M', '', 'X', ''], 6: ['M', '', '', 'X', '', ''] });
  [2, 3, 4, 6].forEach((d) => assert.ok(R.fillById.corte.byDiv[d][d - 1].indexOf('D') < 0, 'corte div ' + d + ' termina en rasgueo fuerte'));
  assert.deepStrictEqual(R.fillById.redoble.byDiv[3], ['Fd', 'D', 'U']);
  assert.deepStrictEqual(R.fillById.redoble.byDiv[6], ['F', 'u', 'd', 'u', 'D', 'U']);
  assert.deepStrictEqual(R.fillById.vuelta.byDiv[3], ['FD', 'U', 'D']);
  assert.deepStrictEqual(R.fillById.vuelta.byDiv[6], ['FD', '', '', 'U', '', 'D']);
  assert.deepStrictEqual(R.fillById.subida.byDiv[3], ['F2', '3', '4']);
  assert.deepStrictEqual(R.fillById.subida.byDiv[6], ['F1', '2', '3', '4', '5', '6']);
  ['redoble', 'vuelta', 'subida', 'bajo'].forEach((id) => [3, 6].forEach((d) =>
    assert.ok(/[BF]/.test(R.fillById[id].byDiv[d][0]), id + ' div ' + d + ': el primer paso tiene que llevar bordón')));
  // los de 4/4 y 2/4 no cambian
  assert.deepStrictEqual(R.fillById.redoble.byDiv[2], ['D', 'U']);
  assert.deepStrictEqual(R.fillById.redoble.byDiv[4], ['d', 'u', 'D', 'U']);
  assert.deepStrictEqual(R.fillById.vuelta.byDiv[4], ['D', '', 'U', 'D']);
  // sobre chacarera, el relleno conserva un bordón en la cuarta corchea
  ['redoble', 'vuelta', 'subida', 'bajo'].forEach((id) => {
    const s = R.applyFill(R.byId.chacarera, id);
    assert.ok(/[BF]/.test(s[6]), id + ' sobre chacarera: paso 6 = "' + s[6] + '"');
    assert.ok(R.validate(Object.assign({}, R.byId.chacarera, { steps: s })).ok);
  });
});

test('r3: ending bajo va 5→1 y existe el final triple para 6/8', () => {
  assert.deepStrictEqual(R.endingById.bajo.steps, ['F', 'b', 'BD', '']);
  assert.strictEqual(R.endingById.bajo.div, 2); assert.strictEqual(R.endingById.bajo.holdBeats, 4);
  const t = R.endingById.triple;
  assert.ok(t, 'falta ending triple');
  assert.strictEqual(t.name, 'Final triple');
  assert.strictEqual(t.div, 3);
  assert.deepStrictEqual(t.steps, ['D', 'D', 'BD', '', '', '']);
  assert.strictEqual(t.steps.length % t.div, 0);
  assert.strictEqual(t.holdBeats, 4);
  assert.strictEqual(R.endings.length, 6);
  assert.strictEqual(R.endings[R.endings.length - 1], t);
  checkCodes(t.steps, 'ending triple');
  checkRoundTrip(t.steps, 'ending triple');
});

test('r3: textos visibles (desc del pop, Chasquido, sin chuck ni fórmulas prohibidas)', () => {
  assert.ok(/abajo-arriba en el dos/.test(R.byId.pop.desc), 'pop: ' + R.byId.pop.desc);
  assert.ok(!/dos y medio/.test(R.byId.pop.desc), 'pop: sigue ubicando mal el abajo-arriba');
  assert.strictEqual(R.rows.filter((r) => r.code === 'M')[0].label, 'Chasquido');
  const texts = [];
  R.patterns.forEach((p) => { texts.push([p.id + '.desc', p.desc]); texts.push([p.id + '.name', p.name]); });
  R.fills.forEach((f) => texts.push(['fill ' + f.id, f.name]));
  R.endings.forEach((e) => texts.push(['ending ' + e.id, e.name]));
  R.rows.forEach((r) => texts.push(['row ' + r.code, r.label]));
  const all = R.validate({ id: 'x y', name: '', meter: '5/4', div: 2, steps: ['Q', 'DD', 7] }).errors;
  all.forEach((e, i) => texts.push(['validate ' + i, e]));
  texts.forEach(([where, t]) => {
    assert.ok(!/chuck/i.test(t), where + ': dice chuck');
    assert.ok(!FORBIDDEN_WORDS.test(t), where + ': palabra prohibida en "' + t + '"');
    FORBIDDEN_FORMS.forEach((re) => assert.ok(!re.test(t), where + ': fórmula prohibida en "' + t + '"'));
  });
  ['chacarera', 'reggae', 'cumbia', 'chamame'].forEach((id) => assert.ok(/chasquido/i.test(R.byId[id].desc), id + ': la desc tiene que decir chasquido'));
  assert.ok(!/cruzado/.test(R.byId.zamba.desc), 'zamba: "rasgueo cruzado" no existe');
  assert.ok(/quinta/.test(R.byId.cueca.desc) && /quinta/.test(R.byId.chacarera.desc), 'cueca/chacarera: la desc tiene que mencionar la quinta');
});

/* ===================== Regresión: robustez (r5) ===================== */
test('r5: clone copia profundo los steps y devuelve un objeto editable', () => {
  const c = R.clone(R.byId.pop);
  assert.deepStrictEqual(c, R.byId.pop);
  assert.notStrictEqual(c, R.byId.pop);
  assert.notStrictEqual(c.steps, R.byId.pop.steps);
  assert.ok(!Object.isFrozen(c) && !Object.isFrozen(c.steps));
  c.steps[0] = ''; c.id = 'otro'; c.steps.push('D');
  assert.strictEqual(R.byId.pop.steps[0], 'BD'); assert.strictEqual(R.byId.pop.id, 'pop'); assert.strictEqual(R.byId.pop.steps.length, 8);
  assert.ok(R.validate(R.clone(R.byId.chacarera)).ok);
  // sin steps → steps []; sin objeto → null
  assert.deepStrictEqual(R.clone({ id: 'x' }).steps, []);
  assert.strictEqual(R.clone(undefined), null);
  assert.strictEqual(R.clone(null), null);
  assert.strictEqual(R.clone('pop'), null);
});

test('r5: datos congelados (patterns, byId, fills, endings, rows) y las copias siguen siendo mutables', () => {
  assert.ok(Object.isFrozen(R.patterns) && Object.isFrozen(R.byId));
  R.patterns.forEach((p) => assert.ok(Object.isFrozen(p) && Object.isFrozen(p.steps), p.id + ' mutable'));
  assert.ok(Object.isFrozen(R.fills) && Object.isFrozen(R.fillById));
  R.fills.forEach((f) => { assert.ok(Object.isFrozen(f) && Object.isFrozen(f.byDiv), f.id); Object.keys(f.byDiv).forEach((d) => assert.ok(Object.isFrozen(f.byDiv[d]), f.id + ' div ' + d)); });
  assert.ok(Object.isFrozen(R.endings) && Object.isFrozen(R.endingById));
  R.endings.forEach((e) => assert.ok(Object.isFrozen(e) && Object.isFrozen(e.steps), e.id));
  assert.ok(Object.isFrozen(R.rows)); R.rows.forEach((r) => assert.ok(Object.isFrozen(r), r.code));
  assert.ok(Object.isFrozen(R.meters) && Object.isFrozen(R.groups));
  // en modo estricto escribir lanza; el dato no cambia
  assert.throws(() => { R.patterns.push({}); }, TypeError);
  assert.throws(() => { R.byId.pop.steps[0] = ''; }, TypeError);
  assert.throws(() => { R.byId.pop.name = 'x'; }, TypeError);
  assert.throws(() => { R.byId.nuevo = {}; }, TypeError);
  assert.throws(() => { R.fillById.redoble.byDiv[2][0] = ''; }, TypeError);
  assert.throws(() => { R.endingById.largo.steps[0] = ''; }, TypeError);
  assert.throws(() => { R.rows[4].label = 'Chuck'; }, TypeError);
  assert.strictEqual(R.byId.pop.steps[0], 'BD'); assert.strictEqual(R.patterns.length, 25);
  // slice() / applyFill / resize / normalize / divsFor / blank / patternsByGroup devuelven copias mutables
  [R.byId.pop.steps.slice(), R.applyFill(R.byId.pop, 'redoble'), R.resize(R.byId.pop.steps, 16), R.normalize(R.byId.pop.steps), R.divsFor('4/4'), R.blank('4/4', 2).steps, R.patternsByGroup()[0].patterns]
    .forEach((a) => { assert.ok(!Object.isFrozen(a)); a.push('x'); });
  assert.strictEqual(R.byId.pop.steps.length, 8);
});

test('r5: validate y blank aceptan div como string y no muestran undefined', () => {
  const okStr = R.validate({ id: 'x', name: 'X', meter: '4/4', div: '2', steps: ['B', '', '', '', '', '', '', ''] });
  assert.ok(okStr.ok, okStr.errors.join(' | '));
  assert.ok(R.validate({ id: 'x', name: 'X', meter: '6/8', div: '6', steps: R.resize(['B', '', '', '', '', ''], 12) }).ok);
  const len = R.validate({ id: 'x', name: 'X', meter: '4/4', div: '4', steps: ['B', '', '', '', '', '', '', ''] });
  assert.ok(!len.ok && /8 pasos y 4\/4 con div 4 pide 16/.test(len.errors[0]), len.errors.join(' | '));
  assert.ok(!R.validate({ id: 'x', name: 'X', meter: '4/4', div: ' ', steps: ['B'] }).ok);
  assert.ok(!R.validate({ id: 'x', name: 'X', meter: '4/4', div: 'dos', steps: ['B'] }).ok);
  assert.strictEqual(R.blank('4/4', '4').div, 4);
  assert.strictEqual(R.blank('4/4', '4').steps.length, 16);
  assert.strictEqual(R.blank('6/8', '6').div, 6);
  assert.strictEqual(R.blank('6/8', '2').div, 3);
  assert.strictEqual(R.blank('4/4', '').div, 2);
  assert.strictEqual(typeof R.blank('3/4', '4').div, 'number');
  // mensajes sin "undefined"/"null", con el motivo
  [{}, { meter: undefined, div: undefined }, { meter: null, div: null }, { meter: '', div: '' }, { meter: '4/4' }, { meter: '4/4', div: null }].forEach((patch) => {
    const v = R.validate(Object.assign({ id: 'x', name: 'X', steps: ['B'] }, patch));
    assert.ok(!v.ok);
    v.errors.forEach((e) => assert.ok(!/undefined|null/.test(e), JSON.stringify(patch) + ': ' + e));
  });
  assert.ok(/Falta el compás/.test(R.validate({ id: 'x', name: 'X', steps: ['B'] }).errors.join(' ')));
  assert.ok(/Falta la división.*4\/4.*2, 4/.test(R.validate({ id: 'x', name: 'X', meter: '4/4', steps: ['B'] }).errors.join(' ')));
  assert.ok(/Compás inválido: 5\/4/.test(R.validate({ id: 'x', name: 'X', meter: '5/4', div: 2, steps: ['B'] }).errors.join(' ')));
  assert.ok(/División inválida para 6\/8: 2/.test(R.validate({ id: 'x', name: 'X', meter: '6/8', div: 2, steps: ['B'] }).errors.join(' ')));
  // validate no muta ni convierte el div del patrón
  const p = { id: 'x', name: 'X', meter: '4/4', div: '2', steps: ['B', '', '', '', '', '', '', ''] };
  R.validate(p); assert.strictEqual(p.div, '2');
  // patrón vacío aunque tenga letras inválidas
  const q = R.validate({ id: 'x', name: 'X', meter: '2/4', div: 2, steps: ['Q', '', '', ''] });
  assert.ok(q.errors.some((e) => /vacío/.test(e)) && q.errors.some((e) => /desconocido/.test(e)), q.errors.join(' | '));
  assert.ok(R.validate({ id: 'x', name: 'X', meter: '2/4', div: 2, steps: ['', '', '', 'u'] }).ok);
  assert.ok(!R.validate([]).ok);
});

test('r5: applyFill con guardas (pattern inválido → [], steps cortos → copia, div string)', () => {
  assert.deepStrictEqual(R.applyFill(undefined, 'redoble'), []);
  assert.deepStrictEqual(R.applyFill(null, 'redoble'), []);
  assert.deepStrictEqual(R.applyFill({ div: 4 }, 'redoble'), []);
  assert.deepStrictEqual(R.applyFill({ div: 4, steps: 'BD' }, 'redoble'), []);
  const short = R.applyFill({ div: 4, steps: ['B', ''] }, 'redoble');
  assert.deepStrictEqual(short, ['B', '']);
  assert.deepStrictEqual(Object.keys(short), ['0', '1'], 'índices negativos');
  const s = R.applyFill({ div: '2', steps: R.byId.pop.steps }, 'redoble');
  assert.deepStrictEqual(s.slice(-2), ['D', 'U']);
  assert.deepStrictEqual(R.applyFill({ div: 5, steps: R.byId.pop.steps }, 'redoble'), R.byId.pop.steps);
  assert.deepStrictEqual(R.applyFill({ div: undefined, steps: R.byId.pop.steps }, 'redoble'), R.byId.pop.steps);
  assert.deepStrictEqual(R.applyFill(R.byId.pop, undefined), R.byId.pop.steps);
  // justo del largo del relleno: lo reemplaza entero
  assert.deepStrictEqual(R.applyFill({ div: 2, steps: ['B', 'D'] }, 'redoble'), ['D', 'U']);
});

test('r5: resize con tope MAX_STEPS y tolerante a Infinity/NaN/undefined', () => {
  assert.strictEqual(R.MAX_STEPS, 48);
  const s = ['B', 'D'];
  assert.strictEqual(R.resize(s, Infinity).length, 2);
  assert.deepStrictEqual(R.resize(s, Infinity), s);
  assert.deepStrictEqual(R.resize(s, -Infinity), s);
  assert.deepStrictEqual(R.resize(s, NaN), s);
  assert.deepStrictEqual(R.resize(s, undefined), s);
  assert.deepStrictEqual(R.resize(s, null), s);
  assert.deepStrictEqual(R.resize(s, 'ocho'), s);
  assert.deepStrictEqual(R.resize(s, ''), s);
  assert.deepStrictEqual(R.resize(s, '8'), ['B', 'D', 'B', 'D', 'B', 'D', 'B', 'D']);
  assert.strictEqual(R.resize(s, 1e8).length, 48);
  assert.strictEqual(R.resize(s, 49).length, 48);
  assert.strictEqual(R.resize(s, 48).length, 48);
  assert.strictEqual(R.resize(s, Number.MAX_SAFE_INTEGER).length, 48);
  assert.deepStrictEqual(R.resize(s, 48).slice(0, 2), s);
  assert.deepStrictEqual(R.resize(undefined, 4), ['', '', '', '']);
  assert.deepStrictEqual(R.resize(null, 2), ['', '']);
  assert.deepStrictEqual(R.resize(undefined, undefined), []);
  assert.notStrictEqual(R.resize(s, NaN), s, 'devuelve copia');
  assert.deepStrictEqual(s, ['B', 'D']);
});

test('r5: toGrid/usesOnlyRowCodes/normalize/fromGrid/lengthFor/stepSeconds toleran undefined', () => {
  assert.deepStrictEqual(R.toGrid(undefined), R.rows.map(() => []));
  assert.deepStrictEqual(R.toGrid(null), R.rows.map(() => []));
  assert.strictEqual(R.usesOnlyRowCodes(undefined), true);
  assert.strictEqual(R.usesOnlyRowCodes(null), true);
  assert.deepStrictEqual(R.normalize(undefined), []);
  assert.deepStrictEqual(R.fromGrid(undefined), []);
  assert.deepStrictEqual(R.fromGrid(null), []);
  assert.deepStrictEqual(R.fromGrid([undefined]), []);
  assert.deepStrictEqual(R.fromGrid([undefined, [1, 0]]), ['F', '']);
  assert.deepStrictEqual(R.fromGrid([[1], undefined, [2]]), ['Bd']);
  assert.strictEqual(R.lengthFor('4/4', undefined), 0);
  assert.strictEqual(R.lengthFor('4/4', null), 0);
  assert.strictEqual(R.lengthFor('4/4', 'x'), 0);
  assert.strictEqual(R.lengthFor('4/4', 0), 0);
  assert.strictEqual(R.lengthFor('4/4', -2), 0);
  assert.strictEqual(R.lengthFor('4/4', '4'), 16);
  assert.strictEqual(R.lengthFor(undefined, undefined), 0);
  assert.deepStrictEqual(R.countIn('4/4', '2'), ['C', '', 'c', '', 'c', '', 'c', '']);
  assert.strictEqual(R.clickFor('4/4', '2', 2), 'c');
  const want = 60 / 90 / 2;
  [[0, 2], [undefined, 2], [NaN, 2], [-10, 2], ['', 2], [90, 0], [90, undefined], [90, NaN], [90, 'x'], [0, 0], [undefined, undefined]].forEach(([bpm, d]) => {
    const v = R.stepSeconds(bpm, d);
    assert.ok(Number.isFinite(v) && v > 0, bpm + '/' + d + ' → ' + v);
  });
  assert.ok(Math.abs(R.stepSeconds(0, 2) - want) < 1e-12);
  assert.ok(Math.abs(R.stepSeconds(undefined, undefined) - want) < 1e-12);
  assert.ok(Math.abs(R.stepSeconds(0, 4) - 60 / 90 / 4) < 1e-12, 'bpm inválido cae a 90 y respeta el div');
  assert.ok(Math.abs(R.stepSeconds(120, 0) - 60 / 120 / 2) < 1e-12, 'div inválido cae a 2 y respeta el bpm');
  assert.ok(Math.abs(R.stepSeconds('120', '4') - 0.125) < 1e-12, 'strings numéricos');
  assert.ok(Math.abs(R.stepSeconds(120, 4) - 0.125) < 1e-12);
});

test('suggestedEnding y patternsByGroup', () => {
  assert.strictEqual(R.suggestedEnding('6/8'), 'triple');
  ['4/4', '3/4', '2/4'].forEach((m) => assert.strictEqual(R.suggestedEnding(m), 'largo', m));
  assert.strictEqual(R.suggestedEnding(undefined), 'largo');
  assert.strictEqual(R.suggestedEnding('9/8'), 'largo');
  R.meters.forEach((m) => assert.ok(R.endingById[R.suggestedEnding(m)], m + ': el final sugerido existe'));
  R.patterns.forEach((p) => assert.ok(R.endingById[R.suggestedEnding(p.meter)], p.id));
  const g = R.patternsByGroup();
  assert.deepStrictEqual(g.map((x) => x.group), R.groups);
  g.forEach((x) => { assert.ok(Array.isArray(x.patterns) && x.patterns.length > 0, x.group + ' vacío'); x.patterns.forEach((p) => assert.strictEqual(p.group, x.group)); });
  const flat = [];
  g.forEach((x) => x.patterns.forEach((p) => flat.push(p)));
  assert.deepStrictEqual(flat, R.patterns.slice(), 'concatenar los grupos da patterns en el mismo orden');
  assert.strictEqual(g[0].patterns[0], R.byId.pop);
  assert.ok(g[1].patterns.indexOf(R.byId.bolerotrio) >= 0);
  assert.notStrictEqual(R.patternsByGroup(), g, 'arrays nuevos en cada llamada');
  assert.notStrictEqual(R.patternsByGroup()[0].patterns, g[0].patterns);
});

test('API completa exportada y sin APIs ajenas a Safari', () => {
  const api = ['meters', 'groups', 'patterns', 'byId', 'fills', 'fillById', 'endings', 'endingById', 'rows', 'ALPHABET', 'CANON', 'MAX_STEPS',
    'beatsPerBar', 'divsFor', 'lengthFor', 'countIn', 'clickFor', 'stepSeconds', 'clone', 'patternsByGroup', 'applyFill', 'suggestedEnding',
    'toGrid', 'fromGrid', 'canon', 'normalize', 'usesOnlyRowCodes', 'resize', 'validate', 'blank'];
  api.forEach((k) => assert.ok(k in R, 'falta Ritmos.' + k));
  assert.deepStrictEqual(Object.keys(R).sort(), api.slice().sort(), 'claves de más o de menos en la API');
  assert.strictEqual(R.ALPHABET, 'BFbDdUuSMX123456T');
  assert.strictEqual(R.CANON, 'BFb123456TSDdUuMX');
  const src = require('fs').readFileSync(path.join(__dirname, 'ritmos.js'), 'utf8');
  api.forEach((k) => assert.ok(new RegExp('^\\s+' + k + '\\b', 'm').test(src.slice(0, src.indexOf('const Ritmos'))), 'el encabezado no documenta ' + k));
  assert.ok(/module\.exports = Ritmos;/.test(src));
  assert.ok(!/\?\?|\?\.\w|\.at\(|structuredClone|\.flatMap\(|\bimport\b|\bexport\b/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')));
});

console.log('\n' + n + ' grupos de pruebas pasaron. Patrones: ' + R.patterns.length + ', rellenos: ' + R.fills.length + ', finales: ' + R.endings.length + '.');
