'use strict';
const assert = require('assert');
const CS = require('/tmp/claude-0/-home-user/123e89d8-f3f6-50b3-b087-b2b8b6b09c19/scratchpad/acordes/mod/parser.js');

let ran = 0, failed = 0;
function t(label, fn) {
  ran++;
  try { fn(); }
  catch (e) { failed++; console.error('FALLA: ' + label + '\n  ' + (e.message || e).split('\n').slice(0, 6).join('\n  ')); }
}
const iv = s => { const p = CS.parseSymbol(s); assert.ok(p, 'no parsea ' + s); return CS.intervals(p); };
const nm = (s, n) => { const p = CS.parseSymbol(s); assert.ok(p, 'no parsea ' + s); return CS.name(p, n || 'us'); };

/* ---------- Símbolos: intervalos ---------- */
const INTERVALS = {
  'C': [0, 4, 7], 'C#': [0, 4, 7], 'Db': [0, 4, 7], 'Cm': [0, 3, 7], 'Cmin': [0, 3, 7], 'C-': [0, 3, 7],
  'Cmaj7': [0, 4, 7, 11], 'CM7': [0, 4, 7, 11], 'CΔ7': [0, 4, 7, 11], 'CΔ': [0, 4, 7, 11],
  'C7': [0, 4, 7, 10], 'Cm7': [0, 3, 7, 10], 'Cdim': [0, 3, 6], 'C°': [0, 3, 6],
  'Cø': [0, 3, 6, 10], 'Cø7': [0, 3, 6, 10], 'Cm7b5': [0, 3, 6, 10], 'Cm7(b5)': [0, 3, 6, 10],
  'Caug': [0, 4, 8], 'C+': [0, 4, 8], 'Csus4': [0, 5, 7], 'Csus2': [0, 2, 7], 'Csus': [0, 5, 7],
  'Cadd9': [0, 4, 7, 14], 'C(add9)': [0, 4, 7, 14], 'C9': [0, 4, 7, 10, 14], 'C11': [0, 7, 10, 14, 17],
  'C13': [0, 4, 7, 10, 14, 21], 'C6': [0, 4, 7, 9], 'Cm6': [0, 3, 7, 9], 'C69': [0, 4, 7, 9, 14], 'C6/9': [0, 4, 7, 9, 14],
  'C7sus4': [0, 5, 7, 10], 'C5': [0, 7], 'C/E': [0, 4, 7], 'C#m7/G#': [0, 3, 7, 10], 'Cmaj9': [0, 4, 7, 11, 14],
  'Cm(maj7)': [0, 3, 7, 11], 'CmMaj7': [0, 3, 7, 11], 'CmM7': [0, 3, 7, 11],
  'C7b9': [0, 4, 7, 10, 13], 'C7#9': [0, 4, 7, 10, 15], 'C7(#5)': [0, 4, 8, 10], 'C7b5': [0, 4, 6, 10],
  'Cmaj7#11': [0, 4, 7, 11, 18], 'Cm9': [0, 3, 7, 10, 14], 'Cm11': [0, 3, 7, 10, 14, 17],
  'Cadd2': [0, 4, 7, 14], 'Cadd4': [0, 4, 7, 17], 'C2': [0, 4, 7, 14], 'C4': [0, 4, 7, 17],
  'Cdim7': [0, 3, 6, 9], 'C°7': [0, 3, 6, 9], 'C7(b9,#11)': [0, 4, 7, 10, 13, 18], 'Cmaj13': [0, 4, 7, 11, 14, 21],
  'C7+5': [0, 4, 8, 10], 'C7-9': [0, 4, 7, 10, 13], 'C9sus4': [0, 5, 7, 10, 14], 'C13b9': [0, 4, 7, 10, 13, 21],
  // latino
  'Do': [0, 4, 7], 'Rem': [0, 3, 7], 'Solm7': [0, 3, 7, 10], 'Do7M': [0, 4, 7, 11], 'DoM7': [0, 4, 7, 11],
  'Mi7': [0, 4, 7, 10], 'La/Do#': [0, 4, 7], 'Si♭': [0, 4, 7], 'Fa#m': [0, 3, 7], 'Lam7': [0, 3, 7, 10],
  'Sol7': [0, 4, 7, 10], 'Re7M': [0, 4, 7, 11], 'Mim': [0, 3, 7], 'Do#m': [0, 3, 7], 'Si♭maj7': [0, 4, 7, 11], 'Fa♯m7♭5': [0, 3, 6, 10]
};
Object.keys(INTERVALS).forEach(sym => t('intervalos ' + sym, () => assert.deepStrictEqual(iv(sym), INTERVALS[sym])));

/* ---------- Símbolos: raíces, bajos, notación ---------- */
t('raíz y pc', () => {
  const p = CS.parseSymbol('F#m7');
  assert.deepStrictEqual(p.root, { letter: 3, acc: 1, pc: 6 });
  assert.strictEqual(p.quality, 'min'); assert.strictEqual(p.seventh, '7'); assert.strictEqual(p.notation, 'us');
  assert.strictEqual(p.bass, null);
});
t('bajo', () => {
  const p = CS.parseSymbol('C#m7/G#');
  assert.deepStrictEqual(p.bass, { letter: 4, acc: 1, pc: 8 });
  assert.deepStrictEqual(CS.parseSymbol('La/Do#').bass, { letter: 0, acc: 1, pc: 1 });
  assert.strictEqual(CS.parseSymbol('La/Do#').notation, 'latin');
});
t('Si♭ es latino, Bb es americano, acc negativo', () => {
  assert.strictEqual(CS.parseSymbol('Si♭').notation, 'latin');
  assert.deepStrictEqual(CS.parseSymbol('Si♭').root, { letter: 6, acc: -1, pc: 10 });
  assert.deepStrictEqual(CS.parseSymbol('Bb').root, { letter: 6, acc: -1, pc: 10 });
});
t('campos add/ext/alt', () => {
  assert.deepStrictEqual(CS.parseSymbol('Cadd9').ext, [9]); assert.strictEqual(CS.parseSymbol('Cadd9').add, true);
  assert.strictEqual(CS.parseSymbol('C9').add, false); assert.strictEqual(CS.parseSymbol('C9').seventh, '7');
  assert.deepStrictEqual(CS.parseSymbol('C7(b9,#11)').alt, ['b9', '#11']);
  assert.strictEqual(CS.parseSymbol('C5').quality, 'power');
  assert.strictEqual(CS.parseSymbol('Cdim7').seventh, 'dim7');
  assert.strictEqual(CS.parseSymbol('Cø').quality, 'min');
});
t('texto que no es símbolo completo → null', () => {
  ['', 'H', 'c', 'Cx7', 'C maj7', 'Cmajor', 'SI', 'si', 'DO', 'Sol.', 'La,', 'A.', 'Cmsus4', 'C57', 'Hola', 'x2', 'N.C.', 'Si7?', 'Am I', 'Do/Si/La']
    .forEach(s => assert.strictEqual(CS.parseSymbol(s), null, 'debería ser null: ' + JSON.stringify(s)));
});
t('trampas sueltas sí parsean como símbolo (la línea decide)', () => {
  ['A', 'La', 'Si', 'Mi', 'Re', 'Do', 'Sol', 'Fa'].forEach(s => assert.ok(CS.parseSymbol(s), s));
});

/* ---------- Nombres normalizados ---------- */
const NAMES = {
  'C': 'C', 'Cm': 'Cm', 'Cmin': 'Cm', 'C-': 'Cm', 'Cdim': 'C°', 'Caug': 'C+', 'Csus4': 'Csus4', 'Csus2': 'Csus2', 'Csus': 'Csus4', 'C5': 'C5',
  'C7': 'C7', 'Cmaj7': 'Cmaj7', 'CM7': 'Cmaj7', 'CΔ7': 'Cmaj7', 'Cm7': 'Cm7', 'Cm(maj7)': 'Cm(maj7)', 'CmMaj7': 'Cm(maj7)',
  'Cdim7': 'C°7', 'Cm7b5': 'Cm7♭5', 'Cø': 'Cm7♭5', 'C7sus4': 'C7sus4', 'Cadd9': 'Cadd9', 'C(add9)': 'Cadd9', 'C2': 'Cadd9',
  'C6': 'C6', 'Cm6': 'Cm6', 'C69': 'C6/9', 'C9': 'C9', 'Cmaj9': 'Cmaj9', 'Cm9': 'Cm9', 'C11': 'C11', 'C13': 'C13',
  'C7b9': 'C7(♭9)', 'C7#9': 'C7(♯9)', 'C7(#5)': 'C+7', 'Cmaj7#11': 'Cmaj7(♯11)', 'C7b5': 'C7(♭5)',
  'G/B': 'G/B', 'C#m7/G#': 'C♯m7/G♯', 'Db': 'D♭', 'Bbm7': 'B♭m7', 'F#m': 'F♯m', 'Cmadd9': 'Cm(add9)'
};
Object.keys(NAMES).forEach(s => t('nombre ' + s, () => assert.strictEqual(nm(s), NAMES[s])));
t('nombres latinos', () => {
  assert.strictEqual(nm('Rem7', 'latin'), 'Rem7');
  assert.strictEqual(nm('Gmaj7', 'latin'), 'Sol7M');
  assert.strictEqual(nm('Do7M', 'latin'), 'Do7M');
  assert.strictEqual(nm('Do7', 'latin'), 'Do7');
  assert.strictEqual(nm('G/B', 'latin'), 'Sol/Si');
  assert.strictEqual(nm('Si♭', 'latin'), 'Si♭');
  assert.strictEqual(nm('Si♭', 'us'), 'B♭');
  assert.strictEqual(nm('Fa#m', 'us'), 'F♯m');
  assert.strictEqual(nm('La/Do#', 'us'), 'A/C♯');
});

/* ---------- Líneas de acordes vs letra ---------- */
t('líneas que SÍ son de acordes', () => {
  ['La   Mi   Si7   La', 'A  E  B7  A', 'C  G  Am  F', 'Do Sol Lam Fa', '| C | G | Am | F |', 'Am', 'G', 'C/E  G/B',
    'Em  Am  B7  Em  x2', 'Dm  A7  Dm  |  Gm  Bb  A7', 'Sol Re/Fa# Mim', 'C - G - Am', 'Do Re Mi', 'Cmaj7 N.C. Dm7']
    .forEach(l => assert.ok(CS.isChordLine(l), 'debería ser acordes: ' + l));
});
t('líneas que NO son de acordes', () => {
  ['A mi me gusta', 'La noche está serena', 'Si vos querés', 'Sol de mi vida', 'Mi corazón', 'Fa la la la',
    'Am I the one', 'Re contenta', 'Do you know', 'La', 'A', 'Si.', 'Quiero verte', 'CORO', 'Estrofa 2:']
    .forEach(l => assert.ok(!CS.isChordLine(l), 'debería ser letra/otro: ' + l));
});
t("'A' sola cuenta como acorde si la línea siguiente parece letra", () => {
  assert.ok(CS.isChordLine('A', 'y la vida sigue igual'));
  assert.ok(CS.isChordLine('La', 'cantando bajito'));
  assert.ok(!CS.isChordLine('La', ''));
  assert.ok(!CS.isChordLine('A', 'D'));
  assert.ok(!CS.isChordLine('Si', '[Coro]'));
});
t('mezcla de notaciones en una línea: todos cuentan', () => {
  const r = CS.parseSheet('La  Mi  A  Si7\nletra de la canción');
  assert.strictEqual(r.lines[0].type, 'pair');
  assert.strictEqual(r.lines[0].chords.length, 4);
  assert.strictEqual(r.notation, 'latin');
});

/* ---------- Emparejamiento por columna ---------- */
t('pos con espacios múltiples', () => {
  const r = CS.parseSheet('C        G           Am      F\nHola que tal como andan todos');
  const ch = r.lines[0].chords;
  assert.deepStrictEqual(ch.map(c => c.text), ['C', 'G', 'Am', 'F']);
  assert.deepStrictEqual(ch.map(c => c.pos), [0, 9, 21, 29]);
  assert.strictEqual(r.lines[0].lyric, 'Hola que tal como andan todos');
});
t('pos con tabs (tab = 8 espacios)', () => {
  const r = CS.parseSheet('C\tG\t\tAm\nletra letra letra letra');
  assert.deepStrictEqual(r.lines[0].chords.map(c => c.pos), [0, 9, 26]);
});
t('pos con sangría inicial y barras', () => {
  const r = CS.parseSheet('    Am      F   | G\nletra con sangría');
  assert.deepStrictEqual(r.lines[0].chords.map(c => c.pos), [4, 12, 18]);
});
t('línea de acordes sin letra debajo → chords', () => {
  const r = CS.parseSheet('C  G  Am  F\n\nC  G\nletra');
  assert.strictEqual(r.lines[0].type, 'chords');
  assert.strictEqual(r.lines[1].type, 'blank');
  assert.strictEqual(r.lines[2].type, 'pair');
  assert.strictEqual(r.lines.length, 3);
});
t('dos líneas de acordes seguidas no se emparejan entre sí', () => {
  const r = CS.parseSheet('C  G\nAm  F\nletra');
  assert.strictEqual(r.lines[0].type, 'chords');
  assert.strictEqual(r.lines[1].type, 'pair');
});
t('Intro: con acordes en la misma línea', () => {
  const r = CS.parseSheet('Intro: G  D  G\n\nG\nletra');
  assert.strictEqual(r.lines[0].type, 'chords');
  assert.strictEqual(r.lines[0].label, 'Intro');
  assert.deepStrictEqual(r.lines[0].chords.map(c => c.text), ['G', 'D', 'G']);
  assert.strictEqual(r.lines[0].chords[0].pos, 7);
});

/* ---------- ChordPro ---------- */
t('ChordPro: directivas y acordes inline', () => {
  const txt = '{title: Canción de prueba}\n{st: Alguien}\n{comment: despacio}\n{soc}\n[C]Hola [G]mundo [Am]querido [F]\n{eoc}\n{x_unknown: 1}';
  const r = CS.parseSheet(txt);
  assert.strictEqual(r.title, 'Canción de prueba');
  assert.strictEqual(r.subtitle, 'Alguien');
  assert.strictEqual(r.lines[0].type, 'title');
  assert.strictEqual(r.lines[1].type, 'subtitle');
  assert.strictEqual(r.lines[2].type, 'comment'); assert.strictEqual(r.lines[2].text, 'despacio');
  assert.strictEqual(r.lines[3].type, 'section'); assert.strictEqual(r.lines[3].kind, 'chorus');
  const p = r.lines[4];
  assert.strictEqual(p.type, 'pair');
  assert.strictEqual(p.lyric, 'Hola mundo querido');
  assert.deepStrictEqual(p.chords.map(c => c.text), ['C', 'G', 'Am', 'F']);
  assert.deepStrictEqual(p.chords.map(c => c.pos), [0, 5, 11, 19]);
  assert.strictEqual(r.lines[5].type, 'directive');
  assert.strictEqual(r.lines[6].type, 'directive');
  assert.strictEqual(r.chords.length, 4);
});
t('ChordPro: línea sólo con corchetes → chords; corchetes que no son acordes quedan en la letra', () => {
  const r = CS.parseSheet('[Am] [G] [F]\n[C]Hola [risas] amigos');
  assert.strictEqual(r.lines[0].type, 'chords');
  assert.deepStrictEqual(r.lines[0].chords.map(c => c.pos), [0, 1, 2]);
  assert.strictEqual(r.lines[1].type, 'pair');
  assert.strictEqual(r.lines[1].lyric, 'Hola [risas] amigos');
});
t('mezcla: línea de acordes arriba + ChordPro abajo no se emparejan', () => {
  const r = CS.parseSheet('C  G\n[Am]letra [F]inline');
  assert.strictEqual(r.lines[0].type, 'chords');
  assert.strictEqual(r.lines[1].type, 'pair');
  assert.strictEqual(r.sequence.length, 4);
});

/* ---------- Secciones y título ---------- */
t('secciones en varias formas', () => {
  const forms = ['Intro', '[Verse 1]', '(Coro)', 'Estribillo:', 'Pre-coro', 'Precoro 2', 'PUENTE', 'Bridge:', 'Solo', 'Interludio', 'Final', 'Outro', 'Coda', 'Estrofa 3:', 'Coro x2'];
  const r = CS.parseSheet(forms.join('\n'));
  r.lines.forEach((l, i) => assert.strictEqual(l.type, 'section', 'no es sección: ' + forms[i]));
  assert.strictEqual(r.lines[1].label, 'Verse 1'); assert.strictEqual(r.lines[1].kind, 'verse');
  assert.strictEqual(r.lines[2].label, 'Coro'); assert.strictEqual(r.lines[2].kind, 'chorus');
  assert.strictEqual(r.lines[4].kind, 'prechorus');
  assert.strictEqual(r.lines[13].label, 'Estrofa 3');
});
t('título por heurística: primera línea de texto seguida de blanco/acordes', () => {
  const r = CS.parseSheet('Zamba del tablero\n\nG  Em\nletra');
  assert.strictEqual(r.title, 'Zamba del tablero');
  assert.strictEqual(r.lines[0].type, 'title');
  const r2 = CS.parseSheet('Zamba del tablero\nG  Em\nletra');
  assert.strictEqual(r2.title, 'Zamba del tablero');
});
t('sin título: primera línea seguida de otra línea de letra, o sin acordes en todo el texto', () => {
  const r = CS.parseSheet('Primera línea de letra\nsegunda línea de letra\nC  G\nmás letra');
  assert.strictEqual(r.title, null);
  assert.strictEqual(r.lines[0].type, 'lyric');
  const r2 = CS.parseSheet('Sólo un poema\n\nsin acordes');
  assert.strictEqual(r2.title, null);
});
t('Título: explícito', () => {
  const r = CS.parseSheet('Título: La zamba\nTono: Sol\nG\nletra');
  assert.strictEqual(r.title, 'La zamba');
  assert.strictEqual(r.lines[1].type, 'meta'); assert.strictEqual(r.lines[1].name, 'tono');
});

/* ---------- chords / sequence ---------- */
t('chords únicos con count y sequence con line/pos', () => {
  const r = CS.parseSheet('C  G  Am  F\nletra\nC  G\nletra');
  assert.deepStrictEqual(r.chords.map(c => [c.name, c.count]), [['C', 2], ['G', 2], ['Am', 1], ['F', 1]]);
  assert.strictEqual(r.sequence.length, 6);
  assert.deepStrictEqual(r.sequence[4], { name: 'C', parsed: r.sequence[4].parsed, line: 1, pos: 0 });
  assert.strictEqual(r.sequence[1].pos, 3);
});
t('clave de chords en notación us aunque el texto sea latino', () => {
  const r = CS.parseSheet('Do  Sol  Lam  Fa\nletra');
  assert.deepStrictEqual(r.chords.map(c => c.name), ['C', 'G', 'Am', 'F']);
  assert.strictEqual(r.notation, 'latin');
});
t('texto vacío / sin acordes', () => {
  const r = CS.parseSheet('');
  assert.strictEqual(r.key, null); assert.deepStrictEqual(r.keyCandidates, []); assert.deepStrictEqual(r.chords, []);
  const r2 = CS.parseSheet('La noche está serena\nSi vos querés');
  assert.strictEqual(r2.key, null); assert.strictEqual(r2.sequence.length, 0);
  assert.ok(r2.lines.every(l => l.type === 'lyric'));
});

/* ---------- Tonalidad: seis canciones ---------- */
const SONG_G = [
  'Zamba del tablero', '', 'Intro: G  D  G', '',
  'G        Em       C       D', 'Cuando la tarde se va cayendo',
  'G        Em       C   D   G', 'vuelve la zamba por el sendero', '',
  'Coro', 'C        D        G      Em', 'y el cielo se pone naranja',
  'C        D        G', 'sobre la loma lejana'
].join('\n');
t('tonalidad Sol mayor (G Em C D)', () => {
  const r = CS.parseSheet(SONG_G);
  assert.strictEqual(r.title, 'Zamba del tablero');
  assert.strictEqual(r.key.name, 'G'); assert.strictEqual(r.key.mode, 'maj'); assert.strictEqual(r.key.pc, 7);
  assert.strictEqual(r.keyCandidates.length, 3);
  assert.strictEqual(r.keyCandidates[0].name, 'G');
  assert.ok(r.keyCandidates[0].score > r.keyCandidates[1].score);
});

const SONG_EM = [
  'Em        Am        B7        Em', 'Sombra que viene bajando el cerro',
  'Em        Am        B7        Em', 'noche cerrada sobre el estero', '',
  'Am        Em        B7        Em', 'y el viento trae la voz del río',
  'Am        B7        Em', 'y se la lleva despacio'
].join('\n');
t('tonalidad Mi menor (Em Am B7), no Sol mayor', () => {
  const r = CS.parseSheet(SONG_EM);
  assert.strictEqual(r.key.mode, 'min'); assert.strictEqual(r.key.pc, 4); assert.strictEqual(r.key.name, 'Em');
  assert.strictEqual(CS.keyName(r.key, 'latin'), 'Mi menor');
});

const SONG_AM = [
  'Am       Dm       E7       Am', 'Cuando la luna sale temprano',
  'F        G        Am', 'yo te espero en el llano',
  'Am       Dm       E7       Am', 'y la guitarra suena bajito',
  'F        G        E7       Am', 'hasta que pase el frío'
].join('\n');
t('tonalidad La menor (Am Dm E7 F G)', () => {
  const r = CS.parseSheet(SONG_AM);
  assert.strictEqual(r.key.name, 'Am'); assert.strictEqual(r.key.mode, 'min'); assert.strictEqual(r.key.pc, 9);
});

const SONG_DM = [
  'Zamba del cardón', '',
  'Dm        A7        Dm', 'Por el camino del cardón',
  'Gm        A7        Dm', 'va mi caballo despacio',
  'Bb        A7        Dm', 'y en la alforja un corazón',
  'Gm        A7        Dm', 'que ya se cansó de andar', '',
  'Estribillo', 'Dm       Gm       A7       Dm', 'zamba, zamba de mi tierra',
  'Bb       Gm       A7       Dm', 'zamba que no se va'
].join('\n');
t('tonalidad Re menor (zamba: Dm A7 Gm Bb)', () => {
  const r = CS.parseSheet(SONG_DM);
  assert.strictEqual(r.key.name, 'Dm'); assert.strictEqual(r.key.mode, 'min'); assert.strictEqual(r.key.pc, 2);
  assert.strictEqual(r.title, 'Zamba del cardón');
});

const SONG_C = [
  'Am       F        G        C', 'Empieza en la sombra y sale al sol',
  'Am       F        G        C', 'camina la tarde sin apuro',
  'F        G        Am       F', 'y cuando parece que se va',
  'F        G        C', 'vuelve a la casa'
].join('\n');
t('tonalidad Do mayor (empieza en Am, termina en C)', () => {
  const r = CS.parseSheet(SONG_C);
  assert.strictEqual(r.key.name, 'C'); assert.strictEqual(r.key.mode, 'maj');
  assert.strictEqual(r.keyCandidates[1].name, 'Am');
});

const SONG_LAT = [
  'Canción en latino', '',
  'Do       Sol      Lam      Fa', 'Una canción sencilla para la ronda',
  'Do       Sol      Fa       Do', 'que todos puedan cantar', '',
  'Coro', 'Fa       Sol      Do      Lam', 'dale que dale la ronda',
  'Fa       Sol      Do', 'hasta que salga el sol'
].join('\n');
t('tonalidad en latino (Do Sol Lam Fa) → Do mayor', () => {
  const r = CS.parseSheet(SONG_LAT);
  assert.strictEqual(r.notation, 'latin');
  assert.strictEqual(r.key.name, 'C'); assert.strictEqual(r.key.mode, 'maj');
  assert.strictEqual(CS.keyName(r.key, 'latin'), 'Do mayor');
  assert.strictEqual(CS.keyName(r.key, 'us'), 'C');
  assert.deepStrictEqual(r.chords.map(c => c.name), ['C', 'G', 'Am', 'F']);
});
t('keyCandidates trae pc, mode, name, score', () => {
  const r = CS.parseSheet(SONG_G);
  r.keyCandidates.forEach(c => { assert.ok(typeof c.pc === 'number'); assert.ok(c.mode === 'maj' || c.mode === 'min'); assert.ok(typeof c.name === 'string'); assert.ok(typeof c.score === 'number'); });
});
t('tonalidad con sostenidos: F#m', () => {
  const r = CS.parseSheet('F#m  D  A  E\nletra\nF#m  D  E  F#m\nletra');
  assert.strictEqual(r.key.name, 'F♯m');
  assert.strictEqual(CS.keyName(r.key, 'latin'), 'Fa♯ menor');
});

/* ---------- keyName ---------- */
t('keyName en ambas notaciones', () => {
  assert.strictEqual(CS.keyName({ pc: 7, mode: 'maj', letter: 4, acc: 0 }, 'latin'), 'Sol mayor');
  assert.strictEqual(CS.keyName({ pc: 4, mode: 'min', letter: 2, acc: 0 }, 'latin'), 'Mi menor');
  assert.strictEqual(CS.keyName({ pc: 7, mode: 'maj', letter: 4, acc: 0 }, 'us'), 'G');
  assert.strictEqual(CS.keyName({ pc: 4, mode: 'min', letter: 2, acc: 0 }, 'us'), 'Em');
  assert.strictEqual(CS.keyName({ pc: 10, mode: 'maj', letter: 6, acc: -1 }, 'latin'), 'Si♭ mayor');
});

/* ---------- transpose ---------- */
t('transpose raíz y bajo con ortografía usual', () => {
  const up = (s, n, notation) => CS.name(CS.transpose(CS.parseSymbol(s), n), notation || 'us');
  assert.strictEqual(up('G/B', 1), 'A♭/C');
  assert.strictEqual(up('D/F#', 1), 'E♭/G');
  assert.strictEqual(up('C', 1), 'D♭');
  assert.strictEqual(up('Cm', 1), 'C♯m');
  assert.strictEqual(up('Am', -1), 'G♯m');
  assert.strictEqual(up('A', -1), 'A♭');
  assert.strictEqual(up('E7', 2), 'F♯7');
  assert.strictEqual(up('Bbmaj7', -1), 'Amaj7');
  assert.strictEqual(up('C#m7/G#', 3), 'Em7/B');
  assert.strictEqual(up('C', 12), 'C');
  assert.strictEqual(up('C', -12), 'C');
  assert.strictEqual(up('Sol/Si', 2, 'latin'), 'La/Do♯');
});
t('transpose no muta el original y conserva calidad', () => {
  const p = CS.parseSymbol('Dm7b5/Ab');
  const q = CS.transpose(p, 2);
  assert.strictEqual(p.root.pc, 2); assert.strictEqual(q.root.pc, 4);
  assert.deepStrictEqual(CS.intervals(q), CS.intervals(p));
  assert.strictEqual(q.text, 'Em7♭5/B♭');
  assert.strictEqual(q.bass.pc, 10);
});

/* ---------- Casos sueltos de robustez ---------- */
t('CRLF y líneas con espacios al final', () => {
  const r = CS.parseSheet('C  G   \r\nletra   \r\n\r\nAm');
  assert.strictEqual(r.lines[0].type, 'pair'); assert.strictEqual(r.lines[0].lyric, 'letra');
  assert.strictEqual(r.lines[2].type, 'chords');
});
t('línea de acordes con 60 % justo y con menos', () => {
  assert.ok(CS.isChordLine('C G Am riff bajo'));        // 3/5 = 60 %
  assert.ok(!CS.isChordLine('C G riff bajo tempo'));    // 2/5 = 40 %
});
t('acentos en tokens inválidos → letra', () => {
  assert.ok(!CS.isChordLine('Am Dm canción'));
});

/* =====================================================================================
 * Regresiones de la revisión r6 (rompedor) y r7 (músico). Un caso por hallazgo aplicado.
 * ===================================================================================== */
const TYPES = r => r.lines.map(l => l.type + (l.chords ? '[' + l.chords.map(c => c.text).join(' ') + ']' : ''));
const KEYOF = s => CS.parseSheet(s).key.name;

/* ---------- r6/r7: tonalidad (pesos: primero +3, último +2, tónica que abre línea +1, sin V→I / IV→I sobre el último) ---------- */
t('r6 alta: una vuelta de 4 acordes sola da la tonalidad del primer acorde', () => {
  assert.strictEqual(KEYOF('C  G  Am  F'), 'C');
  assert.strictEqual(KEYOF('Am  F  C  G'), 'Am');
  assert.strictEqual(KEYOF('Em  C  G  D'), 'Em');
  assert.strictEqual(KEYOF('G  D  Em  C'), 'G');
  assert.strictEqual(KEYOF('D  A  Bm  G'), 'D');
  assert.strictEqual(KEYOF('F  C  Dm  Bb'), 'F');
  assert.strictEqual(KEYOF('E  B  C#m  A'), 'E');
});
t('r6 alta: vuelta que termina en IV sigue siendo la tonalidad del primer acorde (G C D G / G C D C → G)', () => {
  const r = CS.parseSheet('G  C  D  G\nletra\nG  C  D  C');
  assert.strictEqual(r.key.name, 'G');
  assert.ok(r.keyCandidates[0].score > r.keyCandidates[1].score, 'ya no es empate');
});
t('r7 baja: ciclos vi–IV–I–V repetidos se nombran por el acorde inicial (Am F C G ×4 → Am)', () => {
  assert.strictEqual(KEYOF('Am F C G\nAm F C G\nAm F C G\nAm F C G'), 'Am');
  assert.strictEqual(KEYOF('Bm G D A\nBm G D A\nBm G D A\nBm G D A'), 'Bm');
  assert.strictEqual(KEYOF('Dm Bb F C\nDm Bb F C\nDm Bb F C\nDm Bb F C'), 'Dm');
  assert.strictEqual(KEYOF('Em C G D\nEm C G D\nEm C G D\nEm C G D'), 'Em');
});
t('r7 media: vamp mixolidio largo I–♭VII–IV (D C G C … D C G D → D, no G)', () => {
  assert.strictEqual(KEYOF('D C G C\nD C G C\nD C G D'), 'D');
  assert.strictEqual(KEYOF('D C G D\nD C G D\nD C G D\nD C G D'), 'D');
  assert.strictEqual(KEYOF('A G D A\nA G D A\nA G D A\nG D A'), 'A');
});
t('tonalidad: las canciones de arriba no cambian con los pesos nuevos', () => {
  assert.strictEqual(CS.parseSheet(SONG_G).key.name, 'G');
  assert.strictEqual(CS.parseSheet(SONG_EM).key.name, 'Em');
  assert.strictEqual(CS.parseSheet(SONG_AM).key.name, 'Am');
  assert.strictEqual(CS.parseSheet(SONG_DM).key.name, 'Dm');
  assert.strictEqual(CS.parseSheet(SONG_C).key.name, 'C');
  assert.strictEqual(CS.parseSheet(SONG_LAT).key.name, 'C');
  assert.strictEqual(KEYOF('A7  D7  A7  A7\nletra\nD7  D7  A7  A7\nletra\nE7  D7  A7  E7\nletra'), 'A');
  assert.strictEqual(KEYOF('Bm        F#7       Bm\nletra\nEm        F#7       Bm\nletra\nD         A7        D\nletra\nEm        F#7       Bm\nletra'), 'Bm');
});

/* ---------- r6 alta: notación latina en MAYÚSCULAS ---------- */
t('r6 alta: LAm REm MI7 DO#m FA# SIb LA7 DOm7 SOL/SI parsean (con sufijo, alteración o bajo)', () => {
  const exp = { 'LAm': 'Am', 'REm': 'Dm', 'MI7': 'E7', 'DO#m': 'C♯m', 'FA#': 'F♯', 'SIb': 'B♭', 'LA7': 'A7', 'DOm7': 'Cm7', 'SOL/SI': 'G/B', 'SOLm7': 'Gm7', 'MI7/SOL#': 'E7/G♯' };
  Object.keys(exp).forEach(s => { const p = CS.parseSymbol(s); assert.ok(p, 'no parsea ' + s); assert.strictEqual(CS.name(p, 'us'), exp[s]); assert.strictEqual(p.notation, 'latin'); });
  assert.strictEqual(CS.name(CS.parseSymbol('LAm'), 'latin'), 'Lam');
});
t('r6 alta: la raíz pelada en mayúsculas no parsea sola; la acepta la línea si todos son acordes y alguno trae sufijo', () => {
  ['SOL', 'DO', 'SI', 'LA', 'MI', 'SOLO', 'MIRA', 'LAS', 'DOMINGO', 'LAMINA'].forEach(s => assert.strictEqual(CS.parseSymbol(s), null, s));
  assert.ok(CS.isChordLine('DO SOL LAm FA'));
  assert.ok(CS.isChordLine('LAm REm MI7 SOL'));
  assert.ok(!CS.isChordLine('DO SOL FA'));
  assert.ok(!CS.isChordLine('LA LA LA'));
  assert.ok(!CS.isChordLine('SI ME QUERES', 'letra'));
  assert.ok(!CS.isChordLine('A VECES', 'letra'));
});
t('r6 alta: canción completa en latino mayúsculas → Am, y las líneas de raíces peladas (FA SOL DO) cuentan en esa hoja', () => {
  const r = CS.parseSheet(['LA CIGARRA', '', 'LAm        REm', 'Tantas veces me mataron,', 'MI7              LAm', 'tantas veces me morí,',
    'FA        SOL        DO', 'sin embargo estoy aquí', 'MI7             LAm', 'resucitando.', 'LA LA LA', 'SI ME QUERES', 'A VECES'].join('\n'));
  assert.strictEqual(r.title, 'LA CIGARRA');
  assert.strictEqual(r.key.name, 'Am'); assert.strictEqual(r.notation, 'latin');
  assert.deepStrictEqual(r.sequence.map(s => s.name), ['Am', 'Dm', 'E7', 'Am', 'F', 'G', 'C', 'E7', 'Am']);
  assert.deepStrictEqual(TYPES(r).slice(-3), ['lyric', 'lyric', 'lyric']);
  // sin otros acordes latinos en mayúsculas, 'FA SOL DO' sigue siendo letra
  assert.deepStrictEqual(TYPES(CS.parseSheet('FA SOL DO\nletra')), ['lyric', 'lyric']);
});

/* ---------- r6 alta: listas con comas ---------- */
t('r6 alta: listas de acordes con comas (Intro: Am, Dm, E7, Am) y etiqueta genérica (Acordes:)', () => {
  const r = CS.parseSheet('Intro: Am, Dm, E7, Am\n\nAcordes: C, G, Am, F\n\nAm  Dm\nletra');
  assert.strictEqual(r.title, null);
  assert.deepStrictEqual(TYPES(r), ['chords[Am Dm E7 Am]', 'blank', 'chords[C G Am F]', 'blank', 'pair[Am Dm]']);
  assert.strictEqual(r.lines[0].label, 'Intro'); assert.strictEqual(r.lines[0].kind, 'intro');
  assert.strictEqual(r.lines[2].label, 'Acordes'); assert.strictEqual(r.lines[2].kind, 'other');
  assert.deepStrictEqual(r.lines[0].chords.map(c => c.pos), [7, 11, 15, 19]);
  assert.deepStrictEqual(TYPES(CS.parseSheet('Am, Dm, E7, Am\nletra')), ['pair[Am Dm E7 Am]']);
  // la coma no abre la puerta a la letra
  assert.deepStrictEqual(TYPES(CS.parseSheet('La, la, la,\nSi, mi amor')), ['lyric', 'lyric']);
  assert.ok(!CS.isChordLine('La, la, la', 'letra'));
});

/* ---------- r6 media: Title Case con trampas ---------- */
t('r6 media: "A Mi Manera", "A La Deriva", "Mi Sol" son títulos; "Sol Mi Amor" es letra; "La La La" es letra', () => {
  const r = CS.parseSheet('A Mi Manera\n\nC  G  Am  F\nletra');
  assert.strictEqual(r.title, 'A Mi Manera');
  assert.deepStrictEqual(r.sequence.map(s => s.name), ['C', 'G', 'Am', 'F']);
  assert.strictEqual(CS.parseSheet('A La Deriva\n\nAm  Dm  E7\nletra').title, 'A La Deriva');
  assert.strictEqual(CS.parseSheet('Mi Sol\n\nD  A  Bm  G\nletra').title, 'Mi Sol');
  assert.deepStrictEqual(TYPES(CS.parseSheet('La La La\nla la la')), ['lyric', 'lyric']);
  const r2 = CS.parseSheet('C        G\nSol Mi Amor\nF        C\nla la la');
  assert.deepStrictEqual(TYPES(r2), ['pair[C G]', 'pair[F C]']);
  assert.strictEqual(r2.lines[0].lyric, 'Sol Mi Amor');
  // varias trampas con una no-trampa siguen siendo acordes; 'Do Re Mi' sin contexto también
  assert.ok(CS.isChordLine('La Mi Si7 La'));
  assert.ok(CS.isChordLine('Do Re Mi'));
  assert.ok(CS.isChordLine('Do Re Mi', 'letra de abajo'));
  assert.ok(!CS.isChordLine('Do Re Mi', ''));
});

/* ---------- r6 media: texto entre paréntesis, x2, bis ---------- */
t('r6 media: texto entre paréntesis sin acordes no convierte la línea en letra', () => {
  const r = CS.parseSheet('G (rasgueo suave)\nletra de la estrofa\nAm (bis)\notra letra\nAm Dm (más suave)\nmás letra');
  assert.deepStrictEqual(TYPES(r), ['pair[G]', 'pair[Am]', 'pair[Am Dm]']);
  const r2 = CS.parseSheet('Em  Am  B7  Em  x2\nEm  Am  B7  Em  (x2)\nEm  Am  B7  Em (2 veces)\nC  G  (x 2)\nAm (bis)\nAm 2x');
  assert.ok(r2.lines.every(l => l.type === 'chords'), JSON.stringify(TYPES(r2)));
  assert.deepStrictEqual(r2.lines[3].chords.map(c => c.text), ['C', 'G']);
  // un grupo con acordes adentro se conserva, con sus columnas
  const r3 = CS.parseSheet('(Am Dm) x2\nletra');
  assert.deepStrictEqual(r3.lines[0].chords.map(c => c.text + '@' + c.pos), ['Am@1', 'Dm@4']);
  // 'C(add9)' pegado no se toca
  assert.deepStrictEqual(CS.parseSheet('C(add9)  G\nletra').lines[0].chords.map(c => c.text), ['C(add9)', 'G']);
});

/* ---------- r6 media: barras y guiones pegados ---------- */
t('r6 media: acordes pegados con barras (|C|G|Am|F|) y con guiones (Do-Sol-Lam-Fa)', () => {
  const r = CS.parseSheet('|C|G|Am|F|\nletra\nC|G|Am|F\nletra');
  assert.deepStrictEqual(TYPES(r), ['pair[C G Am F]', 'pair[C G Am F]']);
  assert.deepStrictEqual(r.lines[0].chords.map(c => c.pos), [1, 3, 5, 8]);
  assert.deepStrictEqual(r.lines[1].chords.map(c => c.pos), [0, 2, 4, 7]);
  const r2 = CS.parseSheet('Do-Sol-Lam-Fa\nletra');
  assert.deepStrictEqual(TYPES(r2), ['pair[Do Sol Lam Fa]']);
  assert.deepStrictEqual(r2.lines[0].chords.map(c => c.pos), [0, 3, 7, 11]);
  assert.strictEqual(CS.name(CS.parseSymbol('C-')), 'Cm');
  assert.strictEqual(CS.parseSymbol('E-mail'), null);
  assert.ok(!CS.isChordLine('Re-cuerdo que te fuiste'));
});

/* ---------- r6 media: separadores ---------- */
t('r6 media: líneas de sólo separadores (-----, =====, (x2)) son blank y no se emparejan', () => {
  const r = CS.parseSheet('C  G  Am  F\n-----------------\nAm  Dm\n=================\nC\n(x2)\n~~~~\n(bis)\n| |');
  assert.deepStrictEqual(TYPES(r), ['chords[C G Am F]', 'blank', 'chords[Am Dm]', 'blank', 'chords[C]', 'blank', 'blank', 'blank', 'blank']);
  assert.ok(!CS.isChordLine('A', '-----'));
});

/* ---------- r6 media: título + autor ---------- */
t('r6 media: título + autor en dos líneas; meta primero no impide el título', () => {
  const r = CS.parseSheet('Zamba de mi esperanza\nLuis Profili\n\nIntro: Am  Dm  E7  Am\n\n       Am                Dm\nZamba de mi esperanza,');
  assert.strictEqual(r.title, 'Zamba de mi esperanza'); assert.strictEqual(r.subtitle, 'Luis Profili');
  assert.deepStrictEqual(TYPES(r).slice(0, 3), ['title', 'subtitle', 'blank']);
  assert.strictEqual(CS.parseSheet('Tono: Sol\nZamba del tablero\n\nG  D\nletra').title, 'Zamba del tablero');
  // dos líneas de letra seguidas de acordes NO son título + autor; una línea entre paréntesis tampoco es título
  assert.strictEqual(CS.parseSheet('Primera línea de letra\nsegunda línea de letra\nC  G\nmás letra').title, null);
  assert.strictEqual(CS.parseSheet('(se repite todo)\n\nC  G\nletra').title, null);
  assert.strictEqual(CS.parseSheet('Sol\n\nG  D\nletra').title, 'Sol');
});

/* ---------- r6 media: metadatos ---------- */
t('r6 media: Letra y música:, Ritmo:, Capo 2, Cejilla en 2º traste, Tempo:, BPM:, Compositor: son meta (y no título)', () => {
  const r = CS.parseSheet('Letra y música: Atahualpa Yupanqui\nRitmo: zamba\nCapo 2\nCejilla en 2º traste\nTempo: 120\nBPM: 90\nCompositor: Alguien\n\nAm  Dm\nletra');
  assert.strictEqual(r.title, null);
  assert.deepStrictEqual(r.lines.slice(0, 7).map(l => l.type), ['meta', 'meta', 'meta', 'meta', 'meta', 'meta', 'meta']);
  assert.deepStrictEqual(r.lines.slice(0, 7).map(l => l.name), ['letra y música', 'ritmo', 'capo', 'cejilla', 'tempo', 'bpm', 'compositor']);
  assert.strictEqual(r.lines[2].value, '2'); assert.strictEqual(r.lines[3].value, '2º traste');
  // una línea 'Palabra: …' desconocida no pasa a ser título
  assert.strictEqual(CS.parseSheet('Nota: tocar suave\n\nAm  Dm\nletra').title, null);
});

/* ---------- r6 media: secciones ---------- */
t('r6 media: etiquetas de sección en corchetes, con (x2), sin dos puntos, y formas con complemento', () => {
  const r = CS.parseSheet('[Intro] G  D  Em  C\n[Coro] Am  F\nletra\nIntro (x2): Am G\nIntro G D Em C\n(Puente) D  G');
  assert.deepStrictEqual(TYPES(r), ['chords[G D Em C]', 'pair[Am F]', 'chords[Am G]', 'chords[G D Em C]', 'chords[D G]']);
  assert.deepStrictEqual(r.lines.map(l => l.label), ['Intro', 'Coro', 'Intro (x2)', 'Intro', 'Puente']);
  assert.deepStrictEqual(r.lines.map(l => l.kind), ['intro', 'chorus', 'intro', 'intro', 'bridge']);
  assert.deepStrictEqual(r.lines[0].chords.map(c => c.pos), [8, 11, 14, 18]);
  const forms = ['Estribillo (bis)', 'Pre Coro', 'Solo de guitarra', 'Intro (guitarra)', '2da estrofa', 'Estrofa II', 'Puente instrumental', 'CORO:', 'Coro A', '1er verso'];
  const r2 = CS.parseSheet(forms.join('\n'));
  r2.lines.forEach((l, i) => assert.strictEqual(l.type, 'section', 'no es sección: ' + forms[i]));
  assert.deepStrictEqual(r2.lines.map(l => l.kind), ['chorus', 'prechorus', 'solo', 'intro', 'verse', 'verse', 'bridge', 'chorus', 'chorus', 'verse']);
  // letra que empieza con palabra de sección sigue siendo letra
  assert.deepStrictEqual(TYPES(CS.parseSheet('Solo quiero verte\nFinal de la noche\nCoro de ángeles cantando')), ['lyric', 'lyric', 'lyric']);
});

/* ---------- r6 media: C(9) ---------- */
t('r6 media: C(9), Am(9), G(11) son notas agregadas sin séptima; C7(9) sigue siendo C9', () => {
  assert.deepStrictEqual(iv('C(9)'), [0, 4, 7, 14]); assert.strictEqual(nm('C(9)'), 'Cadd9');
  assert.deepStrictEqual(iv('Am(9)'), [0, 3, 7, 14]); assert.strictEqual(nm('Am(9)'), 'Am(add9)');
  assert.deepStrictEqual(iv('G(11)'), [0, 4, 7, 17]); assert.strictEqual(nm('G(11)'), 'Gadd11');
  assert.deepStrictEqual(iv('C7(9)'), [0, 4, 7, 10, 14]); assert.strictEqual(nm('C7(9)'), 'C9');
  assert.strictEqual(nm('C6(9)'), 'C6/9'); assert.strictEqual(nm('C(maj9)'), 'Cmaj9'); assert.strictEqual(nm('Sol7(9)'), 'G9');
});

/* ---------- r6/r7 media: C7/9 ---------- */
t('r6/r7 media: cifrado con barra para extensiones: C7/9 → C9, Do7/9, Lam7/9 → Am9, C7/13 → C13, D7/4 → D7sus4', () => {
  assert.strictEqual(nm('C7/9'), 'C9'); assert.deepStrictEqual(iv('C7/9'), [0, 4, 7, 10, 14]);
  assert.strictEqual(nm('Do7/9'), 'C9'); assert.strictEqual(CS.parseSymbol('Do7/9').notation, 'latin');
  assert.strictEqual(nm('Lam7/9'), 'Am9'); assert.deepStrictEqual(iv('Lam7/9'), [0, 3, 7, 10, 14]);
  assert.strictEqual(nm('Am7/9'), 'Am9'); assert.strictEqual(nm('G7/13'), 'G13'); assert.strictEqual(nm('C7/13'), 'C13');
  assert.strictEqual(nm('D7/4'), 'D7sus4'); assert.deepStrictEqual(iv('D7/4'), [0, 5, 7, 10]);
  assert.strictEqual(nm('C/9'), 'Cadd9'); assert.strictEqual(nm('C7/9/11'), 'C11');
  assert.ok(CS.isChordLine('Do7/9 Fa Sol7/9', 'la letra'));
  assert.strictEqual(CS.parseSymbol('Do/Si/La'), null); assert.strictEqual(CS.parseSymbol('C/'), null);
});

/* ---------- r6 baja: 'mi' ---------- */
t("r6 baja: 'mi' vale como menor sólo seguido de dígito, paréntesis o barra (Emi, Remi, Ami no son acordes)", () => {
  ['Remi', 'Emi', 'Ami', 'Mimi', 'Domi', 'Simi'].forEach(s => assert.strictEqual(CS.parseSymbol(s), null, s));
  assert.strictEqual(nm('Cmi7'), 'Cm7'); assert.strictEqual(nm('Cmi(maj7)'), 'Cm(maj7)'); assert.strictEqual(nm('Cmin7'), 'Cm7');
  assert.strictEqual(nm('Lam'), 'Am'); assert.strictEqual(nm('Sim'), 'Bm');
});

/* ---------- r6 baja: robustez ---------- */
t('r6 baja: isChordLine(null) → false; parseSymbol/intervals/name/transpose/bassInterval con null no lanzan', () => {
  assert.strictEqual(CS.isChordLine(null), false); assert.strictEqual(CS.isChordLine(undefined), false); assert.strictEqual(CS.isChordLine(42), false);
  assert.strictEqual(CS.parseSymbol(null), null);
  assert.deepStrictEqual(CS.intervals(null), []); assert.strictEqual(CS.name(null), ''); assert.strictEqual(CS.transpose(null, 1), null);
  assert.strictEqual(CS.bassInterval(null), null); assert.strictEqual(CS.transposeSheet(null, 1), null); assert.strictEqual(CS.keyName(null), '');
});
t('r6 baja: transpose con semitonos no enteros / NaN / string → Math.round(Number(x) || 0)', () => {
  const up = (n) => CS.name(CS.transpose(CS.parseSymbol('C'), n));
  assert.strictEqual(up(0.5), 'D♭'); assert.strictEqual(up(1.6), 'D'); assert.strictEqual(up(NaN), 'C'); assert.strictEqual(up('2'), 'D'); assert.strictEqual(up(undefined), 'C');
});
t('r6 baja: transpose(p, 0) conserva la ortografía (Gb, A#m, Cb, C/Bb)', () => {
  assert.deepStrictEqual(['Gb', 'A#m', 'Cb', 'Db', 'C/Bb'].map(s => CS.name(CS.transpose(CS.parseSymbol(s), 0))), ['G♭', 'A♯m', 'C♭', 'D♭', 'C/B♭']);
  assert.strictEqual(CS.name(CS.transpose(CS.parseSymbol('Gb'), 12)), 'G♭');
  assert.strictEqual(CS.name(CS.transpose(CS.parseSymbol('Gb'), 0, 'latin')), 'Sol♭');
});
t('r6 baja: ChordPro: corchetes vacíos y [N.C.] fuera de la letra; dos acordes en la misma pos → pos+1; {title:} vacío → null', () => {
  const r = CS.parseSheet('[C]Hola [] mundo [G]\n[][]\n[C][G]Hola\n[N.C.]Hola [C]mundo\n[C]Hola [risas] amigos');
  assert.strictEqual(r.lines[0].lyric, 'Hola mundo'); assert.deepStrictEqual(r.lines[0].chords.map(c => c.pos), [0, 11]);
  assert.strictEqual(r.lines[1].type, 'blank');
  assert.deepStrictEqual(r.lines[2].chords.map(c => c.text + '@' + c.pos), ['C@0', 'G@1']);
  assert.strictEqual(r.lines[3].lyric, 'Hola mundo'); assert.deepStrictEqual(r.lines[3].chords.map(c => c.text + '@' + c.pos), ['C@5']);
  assert.strictEqual(r.lines[4].lyric, 'Hola [risas] amigos');
  assert.strictEqual(CS.parseSheet('{title:}\nZamba del tablero\n\nG  D\nletra').title, 'Zamba del tablero');
  assert.strictEqual(CS.parseSheet('{title:}\nsin acordes').title, null);
});
t('r6 baja (dudosos, decisión 8 confirmada): Cmaj, CM, Dom parsean; CMAJ7 y CMIN en mayúsculas también', () => {
  assert.strictEqual(nm('Cmaj'), 'C'); assert.strictEqual(nm('CM'), 'C'); assert.strictEqual(nm('Dom'), 'Cm');
  assert.strictEqual(nm('CMAJ7'), 'Cmaj7'); assert.strictEqual(nm('CMIN'), 'Cm'); assert.strictEqual(nm('CMIN7'), 'Cm7');
});

/* ---------- r7 alta: transpose con tonalidad destino ---------- */
const KEYS = { C: 'C', G: 'G', D: 'D', A: 'A', E: 'E', B: 'B', F: 'F', Bb: 'Bb', Eb: 'Eb', Am: 'Am', Em: 'Em', Dm: 'Dm', Bm: 'Bm', 'F#m': 'F#m' };
const keyOf = s => CS.parseSheet(s).key;   // {pc, mode, letter, acc, name}
const tk = (line, st, key) => line.split(' ').map(s => CS.transpose(CS.parseSymbol(s), st, 'us', key).text).join(' ');
t('r7 alta: transpose con key deletrea toda la tonalidad destino con una sola alteración', () => {
  assert.strictEqual(tk('Dm Gm A7 Bb', 4, keyOf('Dm')), 'F♯m Bm C♯7 D');
  assert.strictEqual(tk('E B C#m A G#m F#m', 2, keyOf('E')), 'F♯ C♯ D♯m B A♯m G♯m');
  assert.strictEqual(tk('B F# G#m E C#m D#m', 2, keyOf('B')), 'D♭ A♭ B♭m G♭ E♭m Fm');
  assert.strictEqual(tk('D A Bm G Em F#m C#dim', 2, keyOf('D')), 'E B C♯m A F♯m G♯m D♯°');
  assert.strictEqual(tk('Am Dm E7 F G C E G#dim7', 4, keyOf('Am')), 'C♯m F♯m G♯7 A B E G♯ C°7');
  assert.strictEqual(tk('C E+ Am', 4, keyOf('C')), 'E G♯+ C♯m');
  assert.strictEqual(tk('E B C#m A G#m F#m D#dim', 7, keyOf('E')), 'B F♯ G♯m E D♯m C♯m A♯°');
  assert.strictEqual(tk('C G Am F C/Bb C/E G/B', 1, keyOf('C')), 'D♭ A♭ B♭m G♭ D♭/B D♭/F A♭/C');
  // sin key, comportamiento de siempre (tabla por calidad + bajo a distancia de letras)
  assert.strictEqual(tk('Dm Gm A7 Bb', 4, null), 'F♯m Bm D♭7 D');
  assert.strictEqual(CS.name(CS.transpose(CS.parseSymbol('C/Bb'), 1)), 'D♭/C♭');
  // key sin letter/acc también sirve
  assert.strictEqual(tk('Dm Gm A7 Bb', 4, { pc: 2, mode: 'min' }), 'F♯m Bm C♯7 D');
});
t('r7 alta: con key nunca salen ♭♭, ♯♯, E♯, B♯, C♭ ni F♭ (14 tonalidades × 22 semitonos)', () => {
  const songs = {
    C: 'C G Am F Dm Em Bdim G7 C/E G/B C/G Am/G F/A Fmaj7 Cmaj7/E C/Bb D7/F#', G: 'G D Em C Am Bm F#dim D7 G/B D/F# Em/D C/E',
    D: 'D A Bm G Em F#m C#dim A7 D/F# A/C# G/B Bm/A', A: 'A E F#m D Bm C#m G#dim E7 A/C# E/G# D/F#', E: 'E B C#m A F#m G#m D#dim B7 E/G# B/D# A/C#',
    B: 'B F# G#m E C#m D#m A#dim F#7 B/D# F#/A#', F: 'F C Dm Bb Gm Am Edim C7 F/A C/E Bb/D', Bb: 'Bb F Gm Eb Cm Dm Adim F7 Bb/D F/A Eb/G',
    Eb: 'Eb Bb Cm Ab Fm Gm Ddim Bb7 Eb/G Bb/D Ab/C', Am: 'Am Dm E7 F G C E G#dim7 Am/C Am/G Dm/F E7/G#', Em: 'Em Am B7 C D G B F#dim Em/G Em/D B7/D#',
    Dm: 'Dm Gm A7 Bb C F A C#dim7 Dm/F Dm/A A7/C# Gm/Bb', Bm: 'Bm Em F#7 G A D F# A#dim Bm/D F#7/A#', 'F#m': 'F#m Bm C#7 D E A C# E#dim F#m/A'
  };
  const bad = /♭♭|♯♯|E♯|B♯|C♭|F♭/;
  Object.keys(songs).forEach(k => {
    const key = keyOf(KEYS[k]);
    for (let st = -11; st <= 11; st++) {
      if (!st) continue;   // 0 conserva la ortografía original (E♯° del set de F♯m es del original, no del transpositor)
      const out = tk(songs[k], st, key);
      assert.ok(!bad.test(out), k + ' ' + st + ': ' + out);
    }
  });
});

/* ---------- r7: transposeSheet y bassInterval ---------- */
t('r7: transposeSheet devuelve una hoja nueva con acordes, key y candidatas transpuestas, sin mutar el original', () => {
  const sh = CS.parseSheet('Zamba\n\nIntro: Dm  Gm  A7  Dm\n\nDm      Gm      A7      Dm\nletra de la zamba\nBb  A7  Dm/F\notra letra');
  const before = JSON.stringify(sh);
  const t4 = CS.transposeSheet(sh, 4);
  assert.strictEqual(JSON.stringify(sh), before, 'no muta');
  assert.strictEqual(t4.title, 'Zamba'); assert.strictEqual(t4.subtitle, null); assert.strictEqual(t4.notation, 'us');
  assert.deepStrictEqual(t4.lines.map(l => l.type), sh.lines.map(l => l.type));
  assert.deepStrictEqual(t4.lines[2].chords.map(c => c.text + '@' + c.pos), ['F♯m@7', 'Bm@11', 'C♯7@15', 'F♯m@19']);
  assert.strictEqual(t4.lines[2].label, 'Intro'); assert.strictEqual(t4.lines[4].lyric, 'letra de la zamba');
  assert.deepStrictEqual(t4.lines[5].chords.map(c => c.text), ['D', 'C♯7', 'F♯m/A']);
  assert.deepStrictEqual(t4.key, { pc: 6, mode: 'min', letter: 3, acc: 1, name: 'F♯m' });
  assert.deepStrictEqual(t4.keyCandidates.map(c => c.name), ['F♯m', 'D', 'Bm']);
  assert.deepStrictEqual(t4.keyCandidates.map(c => c.score), sh.keyCandidates.map(c => c.score));
  assert.deepStrictEqual(t4.chords.map(c => c.name + ':' + c.count), ['F♯m:4', 'Bm:2', 'C♯7:3', 'D:1', 'F♯m/A:1']);
  assert.deepStrictEqual(t4.sequence.map(s => s.name), ['F♯m', 'Bm', 'C♯7', 'F♯m', 'F♯m', 'Bm', 'C♯7', 'F♯m', 'D', 'C♯7', 'F♯m/A']);
  assert.deepStrictEqual(t4.sequence.map(s => s.line), sh.sequence.map(s => s.line));
  assert.deepStrictEqual(CS.intervals(t4.sequence[10].parsed), CS.intervals(sh.sequence[10].parsed));
  // 0 semitonos + notación latina: misma ortografía, nombres regenerados
  const tl = CS.transposeSheet(sh, 0, 'latin');
  assert.deepStrictEqual(tl.lines[5].chords.map(c => c.text), ['Si♭', 'La7', 'Rem/Fa']); assert.strictEqual(tl.key.name, 'Dm'); assert.strictEqual(tl.notation, 'latin');
  // hoja sin acordes
  const e = CS.transposeSheet(CS.parseSheet('sólo letra'), 3);
  assert.strictEqual(e.key, null); assert.deepStrictEqual(e.chords, []);
});
t('r7 baja: bassInterval', () => {
  assert.strictEqual(CS.bassInterval(CS.parseSymbol('C/D')), 2);
  assert.strictEqual(CS.bassInterval(CS.parseSymbol('Am/G')), 10);
  assert.strictEqual(CS.bassInterval(CS.parseSymbol('C/E')), 4);
  assert.strictEqual(CS.bassInterval(CS.parseSymbol('Sol/Si')), 4);
  assert.strictEqual(CS.bassInterval(CS.parseSymbol('C')), null);
});

/* ---------- r7 media/baja: intervalos y nombres ---------- */
t('r7 media: C11 y Cmaj11 omiten la tercera; Cadd11, C4 y Cm11 la conservan', () => {
  assert.deepStrictEqual(iv('C11'), [0, 7, 10, 14, 17]); assert.deepStrictEqual(iv('Cmaj11'), [0, 7, 11, 14, 17]);
  assert.deepStrictEqual(iv('Cadd11'), [0, 4, 7, 17]); assert.deepStrictEqual(iv('C4'), [0, 4, 7, 17]);
  assert.deepStrictEqual(iv('Cm11'), [0, 3, 7, 10, 14, 17]); assert.deepStrictEqual(iv('C9sus4'), [0, 5, 7, 10, 14]);
  assert.deepStrictEqual(iv('C7#11'), [0, 4, 7, 10, 18]); assert.deepStrictEqual(iv('C9#11'), [0, 4, 7, 10, 14, 18]);
});
t('r7 baja: forma canónica: un solo nombre por sonido (C7#5 = C+7, C6add9 = C6/9, Cm(b5) = C°)', () => {
  assert.strictEqual(nm('C7#5'), 'C+7'); assert.strictEqual(nm('C7+5'), 'C+7'); assert.strictEqual(nm('Caug7'), 'C+7'); assert.strictEqual(nm('C+7'), 'C+7');
  assert.strictEqual(nm('C6add9'), 'C6/9'); assert.strictEqual(nm('C69'), 'C6/9');
  assert.strictEqual(nm('Cm(b5)'), 'C°'); assert.strictEqual(nm('Cdim'), 'C°'); assert.strictEqual(nm('Cm7b5'), 'Cm7♭5');
  assert.deepStrictEqual(iv('C7#5'), [0, 4, 8, 10]); assert.deepStrictEqual(iv('Cm(b5)'), [0, 3, 6]);
  assert.strictEqual(CS.parseSheet('E7#5  E+7\nletra').chords.length, 1);
});
t("r7 baja: nombres latinos: maj7 → '7M', maj9 → '9M', m7♭5 → 'm7(♭5)'; americano sin cambios", () => {
  assert.strictEqual(nm('Do7M', 'latin'), 'Do7M'); assert.strictEqual(nm('Cmaj7', 'latin'), 'Do7M');
  assert.strictEqual(nm('Dom7M', 'latin'), 'Dom7M'); assert.strictEqual(nm('Cm(maj7)', 'latin'), 'Dom7M');
  assert.strictEqual(nm('Cmaj9', 'latin'), 'Do9M'); assert.strictEqual(nm('Cmaj13', 'latin'), 'Do13M');
  assert.strictEqual(nm('Cm7b5', 'latin'), 'Dom7(♭5)'); assert.strictEqual(nm('Fa♯m7♭5', 'latin'), 'Fa♯m7(♭5)');
  assert.strictEqual(nm('Cmaj7#11', 'latin'), 'Do7M(♯11)');
  assert.strictEqual(nm('Cmaj7'), 'Cmaj7'); assert.strictEqual(nm('Cm(maj7)'), 'Cm(maj7)'); assert.strictEqual(nm('Cm7b5'), 'Cm7♭5'); assert.strictEqual(nm('Cmaj9'), 'Cmaj9');
});

/* ---------- API ---------- */
t('API pública completa', () => {
  ['parseSymbol', 'intervals', 'name', 'bassInterval', 'parseSheet', 'transpose', 'transposeSheet', 'keyName', 'isChordLine'].forEach(f => assert.strictEqual(typeof CS[f], 'function', f));
});

console.log(`Casos: ${ran} corridos, ${ran - failed} pasaron, ${failed} fallaron`);
process.exit(failed ? 1 : 0);
