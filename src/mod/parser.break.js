'use strict';
/* parser.break.js — entradas adversarias para ChordSheet (rol: rompedor).
 * Cada caso declara entrada, qué se obtiene y qué se esperaba; `ok` marca si el resultado es aceptable.
 * Corre con: node parser.break.js   (imprime sólo los casos que fallan o quedan dudosos, y un resumen).
 */
const CS = require('/tmp/claude-0/-home-user/123e89d8-f3f6-50b3-b087-b2b8b6b09c19/scratchpad/acordes/mod/parser.js');

const cases = [];
function caso(id, sev, input, run, expect, judge) {
  cases.push({ id, sev, input, run, expect, judge });
}
const J = x => JSON.stringify(x);
const types = r => r.lines.map(l => l.type + (l.chords ? '[' + l.chords.map(c => c.text).join(' ') + ']' : '') + (l.label ? '{' + l.label + '}' : ''));
const seqNames = r => r.sequence.map(s => s.name);
const sym = s => { const p = CS.parseSymbol(s); return p ? CS.name(p, 'us') + ' ' + J(CS.intervals(p)) : null; };

/* ---------- 1. Letra en español con palabras que parecen acordes ---------- */
caso('lyric-si-me-queres', 'media', 'Si me querés\nno me dejes', r => types(CS.parseSheet(r)),
  'ambas lyric', out => out.every(t => t === 'lyric'));
caso('lyric-si-me-queres-sin-tilde', 'media', 'Si me queres\nno me dejes', r => types(CS.parseSheet(r)),
  'ambas lyric', out => out.every(t => t === 'lyric'));
caso('lyric-la-luna', 'media', 'La luna llena\nse asoma', r => types(CS.parseSheet(r)),
  'lyric', out => out[0] === 'lyric');
caso('lyric-mi-corazon', 'media', 'Mi corazón\nlate', r => types(CS.parseSheet(r)),
  'lyric', out => out[0] === 'lyric');
caso('lyric-sol-y-lluvia', 'media', 'Sol y lluvia\ncaen', r => types(CS.parseSheet(r)),
  'lyric', out => out[0] === 'lyric');
caso('lyric-re-loco', 'media', 'Re loco\nme tenés', r => types(CS.parseSheet(r)),
  'lyric', out => out[0] === 'lyric');
caso('lyric-do-re-mi-minusc', 'media', 'Do re mi fa sol\nla si do', r => types(CS.parseSheet(r)),
  'lyric', out => out[0] === 'lyric');
caso('lyric-Do-Re-Mi-Fa-Sol-La-Si', 'baja', 'Do Re Mi Fa Sol La Si\nla escala cantada', r => types(CS.parseSheet(r)),
  'dudoso: una escala cantada en Title Case se toma como 7 acordes (regla de trampas sólo con 1 válido)',
  out => out[0] === 'lyric');
caso('lyric-A-VECES', 'media', 'A VECES\nme olvido', r => types(CS.parseSheet(r)),
  'lyric', out => out[0] === 'lyric');
caso('lyric-la-la-la', 'media', 'La la la\nOh oh oh', r => types(CS.parseSheet(r)),
  'lyric lyric', out => out.every(t => t === 'lyric'));
caso('lyric-La-La-La', 'media', 'La La La\nla la la', r => types(CS.parseSheet(r)),
  'lyric (coro en Title Case); se obtiene pair con 3 acordes A', out => out[0] === 'lyric');
caso('lyric-Oh-Oh', 'baja', 'Oh Oh Oh\nuh uh', r => types(CS.parseSheet(r)), 'lyric', out => out[0] === 'lyric');
caso('title-A-Mi-Manera', 'media', 'A Mi Manera\n\nC  G  Am  F\nletra', r => { const x = CS.parseSheet(r); return { title: x.title, l0: types(x)[0], seq: seqNames(x) }; },
  'title "A Mi Manera"; se obtiene chordline [A Mi] (2 trampas válidas de 3 tokens = 66 %) y A/E entran en la secuencia',
  out => out.title === 'A Mi Manera');
caso('title-A-La-Deriva', 'media', 'A La Deriva\n\nAm  Dm  E7\nletra', r => { const x = CS.parseSheet(r); return { title: x.title, l0: types(x)[0] }; },
  'title "A La Deriva"', out => out.title === 'A La Deriva');
caso('title-Mi-Sol', 'media', 'Mi Sol\n\nD  A  Bm  G\nletra', r => { const x = CS.parseSheet(r); return { title: x.title, l0: types(x)[0] }; },
  'title "Mi Sol" (dos trampas solas → acordes E y G)', out => out.title === 'Mi Sol');
caso('lyric-Sol-Mi-Amor', 'media', 'C        G\nSol Mi Amor\nF        C\nla la la', r => types(CS.parseSheet(r)),
  'pair pair; se obtiene chords + chordline [Sol Mi] emparejada con la letra siguiente',
  out => out.length === 2 && out[0].startsWith('pair') && out[1].startsWith('pair'));

/* ---------- 2. Símbolos: unicode, raros, latinos ---------- */
caso('sym-unicode', 'alta', ['B♭', 'F♯m7', 'E♭maj7', 'C♯m7♭5', 'A♭/C', 'Si♭', 'Fa♯m', 'Mi♭7'], r => r.map(sym),
  'todos parsean', out => out.every(Boolean));
caso('sym-null-raros', 'alta', ['H', 'C#b', 'Sol!', 'E-mail', 'Hola', 'x2', 'N.C.', 'Si7?', 'Am I', 'Do/Si/La', 'C/', 'C/H', 'Cx7', 'Cmajor', 'SI', 'si'], r => r.map(sym),
  'todos null', out => out.every(x => x === null));
caso('sym-Cmaj-solo', 'baja', ['Cmaj', 'CM', 'Dom'], r => r.map(sym),
  'la consigna los lista como "deberían dar null"; el constructor decidió Cmaj/CM = tríada mayor y Dom = Do menor (coherente con Rem). Dudoso pero defendible',
  out => out.every(x => x === null));
caso('sym-palabras-que-parsean', 'baja', ['Remi', 'Emi', 'Ami', 'Mimi', 'Domi', 'Simi', 'Lam', 'Sim', 'Dim', 'Doma', 'Lamento', 'Sola', 'Solo', 'Dos', 'Mis', 'Sin', 'Don'], r => r.map(sym),
  'sólo Lam y Sim deberían parsear; "Remi", "Emi", "Ami", "Mimi", "Domi", "Simi" parsean como menores por el sufijo "mi" (abreviatura de min)',
  out => out.filter(Boolean).length === 2);
// Expectativa corregida tras la decisión 2: la raíz pelada en mayúsculas ('SOL') no parsea sola (sería 'SOL' de 'Sol y lluvia'
// o 'LA' de 'LA LA LA'); la acepta la línea cuando todos los tokens son acordes y alguno trae sufijo o alteración.
caso('sym-latino-mayusculas', 'alta', ['LAm', 'REm', 'MI7', 'SOL', 'DO#m', 'FA#', 'SIb', 'LA7', 'DOm7', 'SOL/SI'], r => ({ syms: r.map(sym), linea: CS.isChordLine('DO SOL LAm FA'), pelada: CS.isChordLine('DO SOL FA') }),
  'notación latina en mayúsculas (muy usada en sitios argentinos: "LAm REm MI7 SOL"): parsean todos salvo la raíz pelada "SOL"; la línea "DO SOL LAm FA" sí es de acordes y "DO SOL FA" sola no',
  out => out.syms.every((x, i) => (i === 3 ? x === null : !!x)) && out.linea === true && out.pelada === false);
caso('sheet-latino-mayusculas', 'alta', 'LAm        REm\nTantas veces me mataron\nMI7              LAm\ntantas veces me morí', r => { const x = CS.parseSheet(r); return { tipos: types(x), key: x.key && x.key.name }; },
  'pair pair con Am Dm E7 Am y key Am; se obtiene todo lyric y key null', out => out.key === 'Am');
caso('sym-7-barra-9', 'media', ['C7/9', 'Am7/9', 'G7/13', 'D7/4'], r => r.map(sym),
  'notación de cifrado brasileño/latino (C7/9 = C9, D7/4 = D7sus4); se obtiene null', out => out.every(Boolean));
caso('sym-C(9)', 'media', ['C(9)', 'Am(9)', 'G(11)'], r => r.map(sym),
  'en cifrado latino/brasileño C(9) es add9 (sin séptima): se esperaba [0,4,7,14]; se obtiene C9 [0,4,7,10,14]',
  out => out[0] && out[0].indexOf('10') < 0);
caso('sym-MAJ-mayusculas', 'baja', ['CMAJ7', 'CMIN', 'Cmaj7', 'CMaj7'], r => r.map(sym),
  'CMAJ7 y CMIN en mayúsculas → null (raro, baja)', out => out.every(Boolean));
caso('sym-add-con-espacio', 'baja', ['C(add 9)', 'C add9'], r => r.map(sym),
  'null por el espacio interno (aceptable)', out => true);
caso('sym-doble-sostenido-x', 'baja', ['Fx', 'Cx'], r => r.map(sym), 'null (decisión documentada: x reservada para x2)', out => out.every(x => x === null));

/* ---------- 3. Formato: tabs, espacios, CRLF, barras, paréntesis, repeticiones ---------- */
caso('fmt-tabs-pos', 'media', 'Am\tDm\t\tE7\nletra larga para que entren todos los acordes', r => CS.parseSheet(r).lines[0].chords.map(c => c.pos),
  '[0, 10, 28] (tab = 8 espacios literales, decisión documentada)', out => J(out) === J([0, 10, 28]));
caso('fmt-crlf-cr', 'media', 'C  G\r\nletra\rAm\rotra', r => types(CS.parseSheet(r)),
  'pair pair (CRLF y CR solos)', out => out.length === 2 && out.every(t => t.startsWith('pair')));
caso('fmt-dos-lineas-acordes', 'media', 'C  G  Am  F\nAm  F  C  G\nletra', r => types(CS.parseSheet(r)),
  'chords, pair', out => out[0].startsWith('chords') && out[1].startsWith('pair'));
caso('fmt-barras-pegadas', 'media', '|C|G|Am|F|\nletra\nC|G|Am|F\nletra', r => types(CS.parseSheet(r)),
  'pair pair con 4 acordes cada una; se obtiene lyric (un solo token "C|G|Am|F" no se separa por barras)',
  out => out.filter(t => t.startsWith('pair')).length === 2);
caso('fmt-guiones-pegados', 'media', 'Do-Sol-Lam-Fa\nletra', r => types(CS.parseSheet(r)),
  'pair con 4 acordes; se obtiene lyric (no se separa por guiones; "Do-" se lee como Do menor y falla)',
  out => out[0].startsWith('pair'));
caso('fmt-comas', 'alta', 'Intro: Am, Dm, E7, Am\n\nAcordes: C, G, Am, F\n\nAm  Dm\nletra', r => types(CS.parseSheet(r)),
  'chords{Intro}[Am Dm E7 Am], blank, chords[C G Am F], blank, pair; se obtiene lyric en las dos listas con comas (forma muy común de intros) y, peor, la primera pasa a ser el título',
  out => out[0].startsWith('chords') && out[2].startsWith('chords'));
caso('fmt-parentesis-texto', 'media', 'G (rasgueo suave)\nletra de la estrofa\nAm (bis)\notra letra\nAm Dm (más suave)\nmás letra', r => types(CS.parseSheet(r)),
  'tres pair (G / Am / Am Dm); se obtiene lyric en las tres: el texto entre paréntesis baja el 60 % o trae tilde',
  out => out.filter(t => t.startsWith('pair')).length === 3);
caso('fmt-x2-variantes', 'media', 'Em  Am  B7  Em  x2\nEm  Am  B7  Em  (x2)\nEm  Am  B7  Em (2 veces)\nC  G  (x 2)\nAm (bis)\nAm 2x', r => types(CS.parseSheet(r)),
  'todas chords; fallan "C G (x 2)" (50 %), "Am (bis)" y "Am 2x"',
  out => out.every(t => t.startsWith('chords')));
caso('fmt-NC', 'baja', 'C  N.C.  G\nletra\nC  NC  G\nletra\nC  n.c.  G\nletra', r => types(CS.parseSheet(r)),
  'tres pair con [C G]; "n.c." minúscula no se ignora pero igual pasa el 60 %', out => out.every(t => t.startsWith('pair[C G]')));
caso('fmt-acorde-entre-parentesis', 'media', '(Am)  (Dm)  (E7)\nletra\n(Am Dm) x2\nletra', r => CS.parseSheet(r).lines.map(l => l.chords && l.chords.map(c => c.text + '@' + c.pos)),
  'Am@1 Dm@7 E7@13 / Am@1 Dm@4', out => J(out) === J([['Am@1', 'Dm@7', 'E7@13'], ['Am@1', 'Dm@4']]));
caso('fmt-separadores-como-letra', 'media', 'C  G  Am  F\n-----------------\nAm  Dm\n=================\nC\n(x2)', r => types(CS.parseSheet(r)),
  'chords, (separador), chords, (separador), chords, (x2); se obtiene pair con lyric "-----", "=====" y "(x2)": líneas de sólo símbolos se toman como letra y se emparejan',
  out => out.every(t => !t.startsWith('pair')));
caso('fmt-slash-con-espacios', 'baja', 'G / B   C / E\nletra', r => CS.parseSheet(r).lines[0].chords.map(c => c.text),
  'dudoso: "G / B" son dos acordes (G, B) y no G/B. Raro, aceptable', out => true);
caso('fmt-tablatura', 'media', 'Intro\ne|-----0---2---|\nB|---1-----3---|\nG|-0-----------|\nD|-------------|\nA|-------------|\nE|-------------|\n\nAm  Dm\nletra', r => types(CS.parseSheet(r)),
  'tab como lyric (o un tipo propio), sin acordes falsos', out => out.slice(1, 7).every(t => t === 'lyric'));

/* ---------- 4. ChordPro ---------- */
caso('cp-directivas-desconocidas', 'media', '{title: Prueba}\n{subtitle: Alguien}\n{key: G}\n{capo: 2}\n{tempo: 120}\n{define: G base-fret 1 frets 3 2 0 0 0 3}\n{start_of_tab}\ne|---\n{end_of_tab}\n[G]Hola [D]mundo\n{x_foo}', r => types(CS.parseSheet(r)),
  'title subtitle directive×4 … pair directive; sin crash', out => out.filter(t => t === 'directive').length >= 5 && out.some(t => t.startsWith('pair')));
caso('cp-corchetes-vacios', 'baja', '[C]Hola [] mundo [G]\n[][]\n[C][G]Hola', r => { const x = CS.parseSheet(r); return x.lines.map(l => [l.type, l.lyric || l.text, l.chords && l.chords.map(c => c.pos)]); },
  '[] vacío debería descartarse de la letra ("Hola  mundo"); "[C][G]Hola" deja dos acordes en pos 0 (se pisan al dibujar)',
  out => out[0][1] === 'Hola mundo');
caso('cp-NC-inline', 'baja', '[N.C.]Hola [C]mundo', r => CS.parseSheet(r).lines[0].lyric,
  'letra "Hola mundo" (N.C. inline debería descartarse); se obtiene "[N.C.]Hola mundo"', out => out === 'Hola mundo');
caso('cp-title-vacio', 'baja', '{title:}\nZamba del tablero\n\nG  D\nletra', r => CS.parseSheet(r).title,
  '"Zamba del tablero" o null; se obtiene "" (cadena vacía anula la heurística)', out => out !== '');
caso('cp-seccion-corchete-sin-dos-puntos', 'media', '[Intro] G  D  Em  C\n[Coro] Am  F\nletra', r => CS.parseSheet(r).lines.map(l => [l.type, l.label || null]),
  'chords con label Intro / pair con label Coro; se pierde el label (sólo se detecta con ":")',
  out => out[0][1] === 'Intro' && out[1][1] === 'Coro');

/* ---------- 5. Secciones, títulos, metadatos ---------- */
caso('sec-formas', 'media', 'Estrofa 2\n[Verse 1]\nCORO:\nINTRO\nEstribillo (bis)\nPre Coro\nSolo de guitarra\nIntro (guitarra)\n2da estrofa\nEstrofa II\nPuente instrumental', r => CS.parseSheet(r).lines.map(l => l.type),
  'las 4 primeras section; las demás ("Estribillo (bis)", "Pre Coro", "Solo de guitarra", "Intro (guitarra)", "2da estrofa", "Estrofa II", "Puente instrumental") quedan como lyric',
  out => out.every(t => t === 'section'));
caso('sec-intro-inline', 'media', 'Intro: G D Em C\nINTRO: Mi  Si  Do#m  La\nIntro:G D\nIntro (x2): Am G\nIntro G D Em C\n\nG\nletra', r => CS.parseSheet(r).lines.map(l => [l.type, l.label || null, l.chords ? l.chords.length : 0]),
  'todas chords con label que empieza por Intro (se conserva la forma escrita: "INTRO", "Intro (x2)")',
  out => out.slice(0, 5).every(x => x[0] === 'chords' && /^intro/i.test(x[1] || '')));
// Expectativa corregida: el label conserva el texto del usuario ('INTRO', 'Intro (x2)'); el kind ('intro') es el campo normalizado.
caso('title-autor-segunda-linea', 'media', 'Zamba de mi esperanza\nLuis Profili\n\nIntro: Am  Dm  E7  Am\n\n       Am                Dm\nZamba de mi esperanza,\n       E7            Am\namanecida como un querer,', r => { const x = CS.parseSheet(r); return { title: x.title, subtitle: x.subtitle, t0: types(x).slice(0, 2) }; },
  'title "Zamba de mi esperanza", subtitle "Luis Profili" (formato típico título+autor de sitios argentinos); se obtiene title null y ambas como lyric',
  out => out.title === 'Zamba de mi esperanza');
caso('title-con-guion-autor', 'baja', 'La cigarra - María Elena Walsh\n\nAm  Dm\nletra', r => CS.parseSheet(r).title,
  'title con autor adentro (aceptable, o separar en subtitle)', out => !!out);
caso('title-letra-y-musica', 'media', 'Letra y música: Atahualpa Yupanqui\nRitmo: zamba\nCapo 2\n\nAm  Dm\nletra', r => { const x = CS.parseSheet(r); return { title: x.title, tipos: types(x).slice(0, 3) }; },
  'title null + tres meta; se obtiene title "Letra y música: Atahualpa Yupanqui" (no está en META_RE) y "Ritmo:"/"Capo 2" como lyric',
  out => out.title === null && out.tipos[0] === 'meta');
caso('title-primera-meta', 'baja', 'Tono: Sol\nZamba del tablero\n\nG  D\nletra', r => CS.parseSheet(r).title,
  'dudoso: title "Zamba del tablero"; se obtiene null porque la primera línea no vacía es meta', out => out === 'Zamba del tablero');
caso('title-trampa-sola', 'baja', 'Sol\n\nG  D\nletra', r => CS.parseSheet(r).title, 'title "Sol"', out => out === 'Sol');

/* ---------- 6. Canciones completas ---------- */
const SONG_US = [
  'Zamba de mi esperanza', 'Luis Profili', '',
  'Intro: Am  Dm  E7  Am', '',
  '       Am                Dm', 'Zamba de mi esperanza,',
  '       E7            Am', 'amanecida como un querer,',
  '       Am                Dm', 'zamba de mi esperanza,',
  '       E7            Am', 'amanecida como un querer.', '',
  'Estribillo', '       Dm                Am', 'Zamba a ti te canto',
  '       E7              Am', 'porque tu canto derrama amor,',
  '       Dm                Am', 'caricia de tu pañuelo',
  '       E7              Am', 'que va envolviendo mi corazón.', '',
  '(se repite todo)'
].join('\n');
caso('song-us-completa', 'alta', SONG_US, r => { const x = CS.parseSheet(r); return { title: x.title, key: x.key && x.key.name, notation: x.notation, pairs: x.lines.filter(l => l.type === 'pair').length, chords: x.chords.map(c => c.name) }; },
  'key Am, notation us, 8 pair, chords Am Dm E7; title (ver caso aparte)',
  out => out.key === 'Am' && out.pairs === 8 && out.notation === 'us');
const SONG_LAT = [
  'LA CIGARRA', 'María Elena Walsh', '', 'Tono: Lam', '',
  '        Lam              Rem', 'Tantas veces me mataron,',
  '      Mi7              Lam', 'tantas veces me morí,',
  '        Fa        Sol        Do', 'sin embargo estoy aquí',
  '      Mi7             Lam', 'resucitando.', '',
  'Coro', '        Rem              Lam', 'Cantando al sol como la cigarra',
  '        Mi7              Lam', 'después de un año bajo la tierra', '',
  '(bis)'
].join('\n');
caso('song-latina-completa', 'alta', SONG_LAT, r => { const x = CS.parseSheet(r); return { key: x.key && x.key.name, keyLat: CS.keyName(x.key, 'latin'), notation: x.notation, pairs: x.lines.filter(l => l.type === 'pair').length, chords: x.chords.map(c => c.name) }; },
  'key Am (La menor), notation latin, 6 pair',
  out => out.key === 'Am' && out.notation === 'latin' && out.pairs === 6);
const SONG_LAT_UP = [
  'LA CIGARRA', '', 'LAm        REm', 'Tantas veces me mataron,', 'MI7              LAm', 'tantas veces me morí,',
  'FA        SOL        DO', 'sin embargo estoy aquí', 'MI7             LAm', 'resucitando.'
].join('\n');
caso('song-latina-mayusculas', 'alta', SONG_LAT_UP, r => { const x = CS.parseSheet(r); return { key: x.key && x.key.name, seq: seqNames(x) }; },
  'key Am, secuencia Am Dm E7 Am F G C E7 Am; se obtiene nada (null, [])', out => out.key === 'Am');

/* ---------- 7. Casos límite ---------- */
caso('edge-vacio', 'alta', ['', '   ', '\n\n', '\t', null, undefined, 42], r => r.map(x => { const o = CS.parseSheet(x); return [o.title, o.lines.length, o.key, o.chords.length]; }),
  'sin crash, key null', out => out.every(o => o[2] === null));
caso('edge-solo-acordes', 'media', 'C  G  Am  F', r => { const x = CS.parseSheet(r); return [types(x), x.key && x.key.name]; },
  'chords, key C', out => out[0][0].startsWith('chords') && out[1] === 'C');
caso('edge-solo-trampa', 'media', 'A', r => types(CS.parseSheet(r)), 'lyric (A sola sin siguiente)', out => out[0] === 'lyric');
caso('edge-solo-letra', 'media', 'La noche está serena\nSi vos querés\nMi corazón', r => { const x = CS.parseSheet(r); return [types(x), x.key, x.title]; },
  'todo lyric, key null, title null', out => out[0].every(t => t === 'lyric') && out[1] === null && out[2] === null);
caso('edge-isChordLine-null', 'baja', [null, undefined], r => r.map(x => { try { return CS.isChordLine(x); } catch (e) { return 'THROW ' + e.constructor.name; } }),
  'false sin excepción; se obtiene TypeError (expandTabs(null))', out => out.every(x => x === false));
caso('edge-api-con-null', 'baja', ['intervals', 'name', 'transpose'], r => r.map(f => { try { return CS[f](null, 1); } catch (e) { return 'THROW'; } }),
  'dudoso: intervals/name/transpose(null) lanzan TypeError (entrada inválida, baja)', out => true);
caso('edge-transpose-no-entero', 'baja', [0.5, NaN, '2'], r => r.map(n => { try { return CS.name(CS.transpose(CS.parseSymbol('C'), n)); } catch (e) { return 'THROW ' + e.constructor.name; } }),
  'semitonos no enteros/NaN deberían redondearse o devolver el mismo acorde; se obtiene TypeError (table[pc] undefined)', out => out.every(x => !/THROW/.test(x)));
caso('edge-transpose-0-respelling', 'baja', ['Gb', 'A#m', 'Cb', 'Db'], r => r.map(s => CS.name(CS.transpose(CS.parseSymbol(s), 0))),
  'transponer 0 debería devolver la misma ortografía; se obtiene F♯, B♭m, B (re-escribe aunque no se transponga)',
  out => J(out) === J(['G♭', 'A♯m', 'C♭', 'D♭']));
caso('edge-transpose-bajo', 'media', [['G/B', 1], ['D/F#', 1], ['C/Bb', 1], ['Am/G', 3], ['E/G#', 1], ['Bm/A', 1], ['Dm/C', 1], ['F/A', -1]], r => r.map(([s, n]) => CS.name(CS.transpose(CS.parseSymbol(s), n))),
  'A♭/C E♭/G D♭/C♭ Cm/B♭ F/A Cm/B♭ E♭m/D♭ E/G♯', out => J(out) === J(['A♭/C', 'E♭/G', 'D♭/C♭', 'Cm/B♭', 'F/A', 'Cm/B♭', 'E♭m/D♭', 'E/G♯']));
caso('edge-nbsp-y-bom', 'media', '﻿Intro: G D\n\nG    D\nletra con nbsp', r => types(CS.parseSheet(r)),
  'chords{Intro} blank pair', out => out[0].startsWith('chords') && out[2].startsWith('pair'));
caso('edge-lineas-largas', 'baja', 'C'.padEnd(2000, ' ') + 'G\n' + 'x'.repeat(2000), r => { const t0 = Date.now(); const x = CS.parseSheet(r); return [types(x)[0].slice(0, 12), Date.now() - t0 + 'ms']; },
  'pair rápido', out => out[0].startsWith('pair'));

/* ---------- 8. Tonalidad ---------- */
caso('key-blues-A', 'media', 'A7  D7  A7  A7\nletra\nD7  D7  A7  A7\nletra\nE7  D7  A7  E7\nletra', r => CS.parseSheet(r).key.name,
  'A (blues: termina en E7, pero la tónica domina)', out => out === 'A');
caso('key-mim-latino', 'media', 'Mim   Lam   Si7   Mim\nletra\nSol   Re   Do   Si7\nletra\nLam   Si7   Mim\nletra', r => { const x = CS.parseSheet(r); return [x.key.name, CS.keyName(x.key, 'latin')]; },
  'Em / Mi menor', out => out[0] === 'Em');
caso('key-D-A-Bm-G', 'media', 'D  A  Bm  G\nletra\nD  A  G  A\nletra\nD  A  Bm  G  D\nletra', r => CS.parseSheet(r).key.name, 'D', out => out === 'D');
caso('key-chacarera-Bm', 'media', 'Bm        F#7       Bm\nletra\nEm        F#7       Bm\nletra\nD         A7        D\nletra\nEm        F#7       Bm\nletra', r => CS.parseSheet(r).key.name, 'Bm', out => out === 'Bm');
caso('key-loop-4-acordes', 'alta', ['C  G  Am  F', 'Am  F  C  G', 'G  D  Em  C', 'Em  C  G  D', 'D  A  Bm  G', 'F  C  Dm  Bb', 'E  B  C#m  A'], r => r.map(s => { const x = CS.parseSheet(s); return s.replace(/\s+/g, ' ') + ' → ' + x.key.name + ' ' + J(x.keyCandidates.map(c => c.name + ':' + c.score)); }),
  'C, Am (o C), G, Em (o G), D, F, E: una vuelta de 4 acordes pegada sola da la tonalidad del último acorde (F, G, C, D, G, B♭, A) por el +3 de "último acorde" más el bono V→I / IV→I; el primer acorde sólo suma +2',
  out => /→ C /.test(out[0]) && /→ (Am|C) /.test(out[1]) && /→ G /.test(out[2]) && /→ D /.test(out[4]) && /→ F /.test(out[5]) && /→ E /.test(out[6]));
caso('key-vuelta-que-termina-en-IV', 'alta', 'G  C  D  G\nletra\nG  C  D  C', r => { const x = CS.parseSheet(r); return x.key.name + ' ' + J(x.keyCandidates.map(c => c.name + ':' + c.score)); },
  'G (empieza en G, cadencia D→G); se obtiene C por empate 19-19 resuelto por "último acorde es tónica"', out => /^G /.test(out));
caso('key-solo-power', 'baja', 'E5  A5  B5  E5\nletra', r => CS.parseSheet(r).key.name, 'E (o Em)', out => /^E/.test(out));

/* ---------- Ejecutar ---------- */
let fails = 0, dudosos = 0;
cases.forEach(c => {
  let out, err = null;
  try { out = c.run(c.input); } catch (e) { err = e; }
  const ok = !err && (() => { try { return !!c.judge(out); } catch (e) { return false; } })();
  if (ok) return;
  if (c.sev === 'baja') dudosos++; else fails++;
  console.log('\n[' + c.sev.toUpperCase() + '] ' + c.id);
  console.log('  entrada : ' + (typeof c.input === 'string' ? J(c.input) : J(c.input)).slice(0, 400));
  console.log('  obtenido: ' + (err ? 'EXCEPCIÓN ' + err.message : J(out).slice(0, 400)));
  console.log('  esperado: ' + c.expect);
});
console.log('\nCasos: ' + cases.length + ' · con hallazgo alta/media: ' + fails + ' · baja/dudosos: ' + dudosos + ' · ok: ' + (cases.length - fails - dudosos));
