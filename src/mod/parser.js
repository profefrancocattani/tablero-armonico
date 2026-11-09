/* ChordSheet — convierte una canción pegada (letra con acordes) en datos tocables.
 * JavaScript puro, sin dependencias ni import/export, pensado para pegarse inline en un <script>.
 * Compatible con Safari iOS y Chrome Android (sin lookbehind ni APIs nuevas).
 *
 * API pública
 *   ChordSheet.parseSymbol(text)                               → parsed | null
 *   ChordSheet.intervals(parsed)                               → [semitonos desde la raíz]  ([] si parsed es null)
 *   ChordSheet.name(parsed, notation?)                         → 'G/B' | 'Sol/Si' …        ('' si parsed es null)
 *   ChordSheet.bassInterval(parsed)                            → semitonos del bajo respecto de la raíz (0..11) | null
 *   ChordSheet.parseSheet(text)                                → sheet
 *   ChordSheet.transpose(parsed, semitones, notation?, key?)   → parsed nuevo (null si parsed es null)
 *   ChordSheet.transposeSheet(sheet, semitones, notation?)     → sheet nuevo; no muta el original
 *   ChordSheet.keyName(key, notation?)                         → 'Sol mayor' | 'Em' …       ('' si key es null)
 *   ChordSheet.isChordLine(line, nextLine?)                    → bool (heurística expuesta; false si line no es string)
 *
 * parsed = { text, notation: 'us'|'latin', root: {letter 0..6 (C..B), acc -2..2, pc 0..11},
 *            quality: 'maj'|'min'|'dim'|'aug'|'sus2'|'sus4'|'power', seventh: null|'7'|'maj7'|'dim7',
 *            ext: [6|9|11|13], alt: ['b5','#5','b9','#9','#11','b13'], add: bool, bass: nota|null }
 *   Forma canónica: maj+#5 → aug; min+b5 sin séptima → dim; 6 y 9 juntos → add=false (C6/9).
 *   'C(9)' y 'C/9' son add9 (sin séptima); 'C7(9)' y 'C7/9' son C9; 'C7/13' → C13; 'D7/4' → D7sus4.
 *   C11 / Cmaj11 (sin add) omiten la tercera en intervals(); Cadd11 / C4 la conservan.
 *   'mi' vale como menor sólo seguido de dígito, paréntesis o barra (Cmi7 sí; 'Emi' no). CMAJ7 / CMIN en mayúsculas valen.
 *   Notación latina: 'Lam', 'Sol7', 'Si♭' y también en MAYÚSCULAS ('LAm', 'MI7', 'SIb', 'SOL/SI'). La raíz pelada en
 *   mayúsculas ('SOL', 'DO') nunca parsea sola: la acepta la línea (ver abajo).
 *   name(p,'latin'): maj7 → '7M' (Do7M, Dom7M), maj9 → '9M', m7♭5 → 'm7(♭5)'. En 'us' queda Cmaj7, Cm7♭5.
 *
 * sheet = { title, subtitle, lines, chords, sequence, key, keyCandidates, notation }
 *   lines[]: { type, src } + según type:
 *     'blank' (también separadores '-----', '=====' y líneas de sólo x2/bis/barras)
 *     'title' {text}, 'subtitle' {text}, 'comment' {text}, 'directive' {name, value}
 *     'section' {label, kind: intro|verse|chorus|prechorus|bridge|solo|interlude|outro|coda|other}
 *     'meta' {name, value}  (Tono:, Artista:, Letra y música:, Ritmo:, Capo 2, Cejilla en 2º traste, Tempo:, BPM: …)
 *     'chords' {chords, label?, kind?}  línea de acordes sin letra debajo
 *     'pair'   {chords, lyric, label?, kind?}  acordes + letra (por columna o ChordPro)
 *     'lyric'  {text}
 *   chord = { text, pos, parsed }  (pos = columna en la línea original, tab = 8 espacios)
 *   chords[]: acordes únicos {name (us), parsed, count}; sequence[]: {name (us), parsed, line, pos} en orden.
 *   key = { pc, mode: 'maj'|'min', letter, acc, name } | null;  keyCandidates: 3 mejores con score.
 *   notation: 'latin' si la mayoría de los acordes está en latino, si no 'us'.
 *
 * Línea de acordes (heurística): ≥ 60 % de los tokens no ignorados parsean; sin tildes en los inválidos; el último
 *   token no termina en . , ; ! ?; se aceptan comas ('Am, Dm, E7, Am' con ≥ 2 acordes), barras pegadas ('|C|G|Am|F|'),
 *   guiones pegados ('Do-Sol-Lam-Fa') y texto entre paréntesis sin acordes ('G (rasgueo suave)', 'Am (bis)', 'C G (x 2)').
 *   Trampas (A, La, Si, Mi, Re, Do, Sol, Fa): si todos los acordes válidos son trampas, la línea sólo cuenta si no hay
 *   ningún token inválido, no son todas la misma palabra ('La La La') y la línea siguiente parece letra (con una sola
 *   trampa siempre; con varias, sólo si se conoce la línea siguiente). Latino en mayúsculas pelado ('DO SOL LAm FA'):
 *   sólo si todos los tokens son acordes y alguno trae sufijo o alteración; en una hoja que ya tiene acordes latinos en
 *   mayúsculas, también las líneas de ≥ 2 raíces peladas distintas ('FA SOL DO').
 *   Etiquetas: '[Intro] G D', 'Intro: G D', 'Intro (x2): Am G', 'Intro G D Em C' y 'Acordes: C, G, Am, F' (etiqueta
 *   genérica, sólo con ≥ 2 acordes). Título: primera línea de texto seguida de blanco/sección/acordes/meta; si las dos
 *   primeras líneas son texto corto sin puntuación final y la tercera es blanco/sección/meta → title + subtitle.
 *
 * Tonalidad (detectKey) — pesos finales:
 *   por acorde: diatónico +2, préstamo habitual +1, raíz en la escala con calidad ajena +0.5, fuera −1
 *               (sus/power: +2 en escala, +1 préstamo, −1 fuera);
 *   primer acorde tónica +3; último acorde tónica +2; cada tónica que abre una línea de acordes (salvo la primera) +1;
 *   cadencia V→I +1 y IV→I +0.5 sobre cada tónica que NO sea el último acorde.
 *   Desempate: más tónicas, luego último acorde tónica, luego modo mayor.
 *
 * transpose(parsed, semitones, notation?, key?): con key ({pc, mode, letter, acc} de parseSheet) deletrea raíz y bajo
 *   desplazando letras según la tonalidad destino (sin ♭♭, ♯♯, E♯, B♯, C♭, F♭; si haría falta, usa la tabla usual).
 *   Sin key: tabla usual por calidad (mayores → D♭ E♭ F♯ A♭ B♭; menores/disminuidos → C♯ E♭ F♯ G♯ B♭) y bajo a
 *   distancia de letras. Con semitones ≡ 0 (mod 12) conserva la ortografía original. Semitonos no enteros o NaN →
 *   Math.round(Number(x) || 0).
 */
const ChordSheet = (() => {
  'use strict';

  /* ---------- Tablas ---------- */
  const NAT = [0, 2, 4, 5, 7, 9, 11];
  const LET = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const LAT = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
  const LAT_IDX = { Do: 0, Re: 1, Mi: 2, Fa: 3, Sol: 4, La: 5, Si: 6, DO: 0, RE: 1, MI: 2, FA: 3, SOL: 4, LA: 5, SI: 6 };
  const ACC_STR = { '-2': '♭♭', '-1': '♭', '0': '', '1': '♯', '2': '♯♯' };
  const ACC_NUM = { '#': 1, '♯': 1, 'b': -1, '♭': -1, '##': 2, '♯♯': 2, 'bb': -2, '♭♭': -2 };
  // Ortografías usuales de las 12 tonalidades (índice = pc). Las mismas tablas que usa el tablero.
  const KEY_SPELL = {
    maj: [[0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0], [3, 1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]],
    min: [[0, 0], [0, 1], [1, 0], [2, -1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [6, -1], [6, 0]]
  };
  const TRIAD = {
    maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8],
    sus2: [0, 2, 7], sus4: [0, 5, 7], power: [0, 7]
  };
  const SEVENTH = { '7': 10, 'maj7': 11, 'dim7': 9 };
  const EXT_SEMI = { 6: 9, 9: 14, 11: 17, 13: 21 };
  const ALT_SEMI = { 'b5': 6, '#5': 8, 'b9': 13, '#9': 15, '#11': 18, 'b13': 20 };
  const ALT_NUM = { 4: 11, 5: 5, 6: 13, 9: 9, 11: 11, 13: 13 };

  const ACC_RE = '(##|bb|♯♯|♭♭|[#♯b♭])?';
  const US_ROOT = new RegExp('^([A-G])' + ACC_RE);
  const LAT_ROOT = new RegExp('^(Do|Re|Mi|Fa|Sol|La|Si)' + ACC_RE);
  const LAT_ROOT_UP = new RegExp('^(DO|RE|MI|FA|SOL|LA|SI)' + ACC_RE);
  const US_BASS = new RegExp('\\/([A-G])' + ACC_RE + '$');
  const LAT_BASS = new RegExp('\\/(Do|Re|Mi|Fa|Sol|La|Si)' + ACC_RE + '$');
  const LAT_BASS_UP = new RegExp('\\/(DO|RE|MI|FA|SOL|LA|SI)' + ACC_RE + '$');
  const BARE_RE = /^(?:[A-G]|Do|Re|Mi|Fa|Sol|La|Si|DO|RE|MI|FA|SOL|LA|SI)$/;   // raíz sin sufijo ni alteración
  const UPPER_BARE_RE = /^(?:DO|RE|MI|FA|SOL|LA|SI)$/;

  function mod12(n) { return ((n % 12) + 12) % 12; }
  function mkNote(letter, acc) { return { letter, acc, pc: mod12(NAT[letter] + acc) }; }

  function parseRoot(text, notation) {
    const re = notation === 'latin' ? LAT_ROOT : notation === 'latinUp' ? LAT_ROOT_UP : US_ROOT;
    const m = re.exec(text);
    if (!m) return null;
    const letter = notation === 'us' ? LET.indexOf(m[1]) : LAT_IDX[m[1]];
    const acc = m[2] ? ACC_NUM[m[2]] : 0;
    return { note: mkNote(letter, acc), len: m[0].length };
  }

  /* ---------- Sufijo ---------- */
  function parseSuffix(s) {
    let quality = 'maj', seventh = null, majFlag = false, add = false, power = false;
    let numSeen = false, numSeenOut = false, qualSeen = false;
    const ext = new Set(), alt = new Set();
    let i = 0, depth = 0;
    while (i < s.length) {
      const r = s.slice(i);
      let m;
      if (r[0] === '(') { depth++; i++; continue; }
      if (r[0] === ')') { if (!depth) return null; depth--; i++; continue; }
      if (r[0] === ',') { if (!depth) return null; i++; continue; } // comas sólo dentro de paréntesis: 'La,' es letra
      if (power) return null; // C5 no admite nada más
      if ((m = /^(?:[Mm]aj|MAJ|ma(?=\d))/.exec(r))) {
        majFlag = true; if (seventh === '7') seventh = 'maj7';
        i += m[0].length; continue;
      }
      if ((m = /^[Δ△]/.exec(r))) { majFlag = true; if (!seventh || seventh === '7') seventh = 'maj7'; i += 1; continue; }
      if (/^MIN/.test(r)) { if (qualSeen) return null; quality = 'min'; qualSeen = true; i += 3; continue; } // CMIN, CMIN7
      if (r[0] === 'M') { majFlag = true; if (seventh === '7') seventh = 'maj7'; i += 1; continue; }
      // 'mi' sólo como abreviatura seguida de número, paréntesis o barra (Cmi7); 'Emi', 'Remi' no son acordes
      if ((m = /^(?:min|mi(?=[\d(\/])|m)/.exec(r))) {
        if (qualSeen) return null;
        quality = 'min'; qualSeen = true; i += m[0].length; continue;
      }
      if (r[0] === '-' && i === 0) { quality = 'min'; qualSeen = true; i += 1; continue; }
      if ((m = /^(?:dim|°|º)/.exec(r))) {
        if (qualSeen) return null;
        quality = 'dim'; qualSeen = true; if (seventh === '7') seventh = 'dim7';
        i += m[0].length; continue;
      }
      if ((m = /^[øØ]/.exec(r))) {
        if (qualSeen) return null;
        quality = 'min'; qualSeen = true; alt.add('b5'); if (!seventh) seventh = '7';
        i += 1; continue;
      }
      if ((m = /^aug/.exec(r))) { if (qualSeen && quality !== 'maj') return null; quality = 'aug'; qualSeen = true; i += 3; continue; }
      if (r[0] === '+') {
        const a = /^\+(13|11|9|5)(?!\d)/.exec(r);
        if (a && (numSeen || qualSeen)) { alt.add('#' + a[1]); i += a[0].length; }
        else { if (qualSeen && quality !== 'maj') return null; quality = 'aug'; qualSeen = true; i += 1; }
        continue;
      }
      if ((m = /^sus(4|2)?(?!\d)/.exec(r))) {
        if (qualSeen && quality !== 'maj') return null;
        quality = m[1] === '2' ? 'sus2' : 'sus4'; qualSeen = true; i += m[0].length; continue;
      }
      if ((m = /^add\s?(13|11|9|6|4|2)(?!\d)/.exec(r))) {
        const n = +m[1];
        ext.add(n === 2 ? 9 : n === 4 ? 11 : n); add = true; i += m[0].length; continue;
      }
      if ((m = /^(?:6\/9|69)(?!\d)/.exec(r))) { ext.add(6); ext.add(9); numSeen = true; if (!depth) numSeenOut = true; i += m[0].length; continue; }
      if ((m = /^(13|11|9|7|6|5|4|2)(?!\d)/.exec(r))) {
        const n = +m[1];
        if (n === 5) { if (qualSeen || numSeen || i !== 0) return null; quality = 'power'; power = true; }
        else if (n === 2 || n === 4) {
          if (numSeen || (quality !== 'maj' && quality !== 'min')) return null;
          ext.add(n === 2 ? 9 : 11); add = true;
        }
        else if (n === 7) { if (!seventh) seventh = majFlag ? 'maj7' : quality === 'dim' ? 'dim7' : '7'; }
        else if (n === 6) { ext.add(6); }
        else if (depth > 0 && !seventh && !numSeenOut && !majFlag) { ext.add(n); add = true; } // C(9) = Cadd9, Am(9) = Am(add9)
        else { // 9, 11, 13
          ext.add(n);
          if (!seventh && !ext.has(6)) seventh = majFlag ? 'maj7' : quality === 'dim' ? 'dim7' : '7';
        }
        numSeen = true; if (!depth) numSeenOut = true; i += m[0].length; continue;
      }
      // Cifrado con barra para extensiones (Brasil / Río de la Plata): C7/9 → C9, C7/13 → C13, D7/4 → D7sus4, C/9 → Cadd9
      if (r[0] === '/' && (m = /^\/(13|11|9|6|4|2)(?!\d)/.exec(r))) {
        const n = +m[1];
        if (n === 4) { if (quality !== 'maj') return null; quality = 'sus4'; qualSeen = true; }
        else if (n === 2) { ext.add(9); add = true; }
        else if (n === 6) { ext.add(6); }
        else if (!seventh && !numSeen) { ext.add(n); add = true; }
        else { ext.add(n); if (!seventh && !ext.has(6)) seventh = majFlag ? 'maj7' : quality === 'dim' ? 'dim7' : '7'; }
        numSeen = true; i += m[0].length; continue;
      }
      if ((m = /^([b♭#♯-])(13|11|9|6|5|4)(?!\d)/.exec(r))) {
        const flat = m[1] === 'b' || m[1] === '♭' || m[1] === '-';
        const n = ALT_NUM[+m[2]];
        const key = (flat ? 'b' : '#') + n;
        if (!(key in ALT_SEMI)) return null;
        alt.add(key); i += m[0].length; continue;
      }
      return null;
    }
    // Forma canónica: un solo nombre por sonido
    if (quality === 'maj' && alt.has('#5')) { quality = 'aug'; alt.delete('#5'); }     // C7#5 → C+7
    if (quality === 'min' && alt.has('b5') && !seventh) { quality = 'dim'; alt.delete('b5'); } // Cm(b5) → C°
    if (ext.has(6) && ext.has(9)) add = false;                                         // C6add9 → C6/9
    return {
      quality, seventh,
      ext: [...ext].sort((a, b) => a - b),
      alt: [...alt],
      add
    };
  }

  /* ---------- 1. parseSymbol ---------- */
  function parseWith(text, notation) {
    const root = parseRoot(text, notation);
    if (!root) return null;
    let rest = text.slice(root.len);
    let bass = null;
    const bassRe = notation === 'latin' ? LAT_BASS : notation === 'latinUp' ? LAT_BASS_UP : US_BASS;
    const bm = bassRe.exec(rest);
    if (bm) {
      const letter = notation === 'us' ? LET.indexOf(bm[1]) : LAT_IDX[bm[1]];
      bass = mkNote(letter, bm[2] ? ACC_NUM[bm[2]] : 0);
      rest = rest.slice(0, rest.length - bm[0].length);
    }
    const suf = parseSuffix(rest);
    if (!suf) return null;
    return {
      text, notation: notation === 'us' ? 'us' : 'latin', root: root.note,
      quality: suf.quality, seventh: suf.seventh, ext: suf.ext, alt: suf.alt, add: suf.add,
      bass
    };
  }
  function parseSymbol(text) {
    if (typeof text !== 'string') return null;
    text = text.trim();
    if (!text || /\s/.test(text)) return null;
    // Latino en mayúsculas sólo con sufijo, alteración o bajo (LAm, MI7, SIb, SOL/SI); 'SOL' pelado lo decide la línea
    return parseWith(text, 'us') || parseWith(text, 'latin') || (UPPER_BARE_RE.test(text) ? null : parseWith(text, 'latinUp'));
  }

  /* ---------- 2. intervals ---------- */
  function intervals(p) {
    if (!p || !p.root) return [];
    const set = new Set(TRIAD[p.quality] || TRIAD.maj);
    const ext = (p.ext || []).slice().sort((a, b) => a - b);
    const alt = p.alt || [];
    const has6 = ext.indexOf(6) >= 0;
    let seventh = p.seventh;
    if (!seventh && !p.add && !has6 && ext.some(e => e >= 9)) seventh = '7';
    if (seventh) set.add(SEVENTH[seventh]);
    if (p.add) {
      ext.forEach(e => set.add(EXT_SEMI[e]));
    } else {
      if (has6) set.add(9);
      if (ext.indexOf(9) >= 0 || ext.indexOf(11) >= 0 || ext.indexOf(13) >= 0) set.add(14);
      if (ext.indexOf(11) >= 0) set.add(17);
      if (ext.indexOf(13) >= 0) set.add(21);
      // C11 / Cmaj11: el dominante con 11ª natural se toca sin tercera (evita la 9ª menor entre 3ª y 11ª)
      if (p.quality === 'maj' && ext.indexOf(11) >= 0 && alt.indexOf('#11') < 0) set.delete(4);
    }
    alt.forEach(a => {
      if (a === 'b5' || a === '#5') set.delete(7);
      if (a === 'b9' || a === '#9') set.delete(14);
      if (a === '#11') set.delete(17);
      if (a === 'b13') set.delete(21);
      set.add(ALT_SEMI[a]);
    });
    return [...set].sort((a, b) => a - b);
  }

  /* ---------- 3. name ---------- */
  function spellNote(n, notation) {
    return (notation === 'latin' ? LAT : LET)[n.letter] + (ACC_STR[n.acc] || '');
  }
  function suffixName(p, notation) {
    const lat = notation === 'latin';
    const q = p.quality, ext = (p.ext || []).slice().sort((a, b) => a - b);
    const altSet = new Set(p.alt || []);
    const has6 = ext.indexOf(6) >= 0;
    const hi = ext.filter(e => e >= 9).reduce((a, b) => Math.max(a, b), 0);
    if (q === 'power') return '5';
    const MAJ7 = lat ? '7M' : 'maj7';
    let body = '';
    if (!p.add && hi && !has6) body = p.seventh === 'maj7' ? (lat ? hi + 'M' : 'maj' + hi) : String(hi);
    else if (p.seventh === 'maj7') body = MAJ7;
    else if (p.seventh) body = '7';
    let s;
    if (q === 'maj') s = body;
    else if (q === 'min') {
      if (p.seventh === 'maj7') s = lat ? 'm' + body : 'm(' + body + ')';
      else if (p.seventh === '7' && altSet.has('b5')) { s = 'm' + body + (lat ? '(♭5)' : '♭5'); altSet.delete('b5'); }
      else s = 'm' + body;
    }
    else if (q === 'dim') {
      if (p.seventh === 'dim7') s = '°' + (body || '7');
      else if (p.seventh === '7') s = 'ø' + body;
      else if (p.seventh === 'maj7') s = '°' + body;
      else s = '°';
    }
    else if (q === 'aug') { altSet.delete('#5'); s = '+' + body; }
    else s = body + q; // sus4 / sus2
    if (has6) s += (ext.indexOf(9) >= 0 && !p.add) ? '6/9' : '6';
    if (p.add) {
      const adds = ext.filter(e => e !== 6).map(e => 'add' + e).join('');
      if (q === 'min' && !p.seventh) s = 'm(' + adds + ')';
      else s += adds;
    }
    if (altSet.size) s += '(' + [...altSet].map(a => a.replace('b', '♭').replace('#', '♯')).join(',') + ')';
    return s;
  }
  function name(p, notation) {
    if (!p || !p.root) return '';
    notation = notation || p.notation || 'us';
    let s = spellNote(p.root, notation) + suffixName(p, notation);
    if (p.bass) s += '/' + spellNote(p.bass, notation);
    return s;
  }
  function bassInterval(p) {
    if (!p || !p.root || !p.bass) return null;
    return mod12(p.bass.pc - p.root.pc);
  }

  /* ---------- 5. transpose ---------- */
  // Deletreo por desplazamiento de letras según la tonalidad destino. null si saldría ♭♭/♯♯/E♯/B♯/C♭/F♭.
  function spellByKey(n, semitones, key) {
    const mode = key.mode === 'min' ? 'min' : 'maj';
    const kLetter = typeof key.letter === 'number' ? key.letter : KEY_SPELL[mode][mod12(key.pc)][0];
    const sp = KEY_SPELL[mode][mod12(key.pc + semitones)];
    const shift = (sp[0] - kLetter + 7) % 7;
    const letter = (n.letter + shift) % 7;
    const pc = mod12(n.pc + semitones);
    let acc = pc - NAT[letter]; if (acc > 6) acc -= 12; if (acc < -6) acc += 12;
    if (Math.abs(acc) > 1) return null;
    if (acc === 1 && (letter === 2 || letter === 6)) return null;   // E♯, B♯
    if (acc === -1 && (letter === 0 || letter === 3)) return null;  // C♭, F♭
    return mkNote(letter, acc);
  }
  function transpose(p, semitones, notation, key) {
    if (!p || !p.root) return null;
    semitones = Math.round(Number(semitones) || 0);
    const k = key && typeof key.pc === 'number' ? key : null;
    let root, bass = null;
    if (mod12(semitones) === 0) {
      root = mkNote(p.root.letter, p.root.acc);                       // transponer 0 conserva la ortografía
      if (p.bass) bass = mkNote(p.bass.letter, p.bass.acc);
    } else {
      if (k) root = spellByKey(p.root, semitones, k);
      if (!root) {
        const pc = mod12(p.root.pc + semitones);
        const table = (p.quality === 'min' || p.quality === 'dim') ? KEY_SPELL.min : KEY_SPELL.maj;
        root = mkNote(table[pc][0], table[pc][1]);
      }
      if (p.bass) {
        const bpc = mod12(p.bass.pc + semitones);
        if (k) bass = spellByKey(p.bass, semitones, k) || mkNote(KEY_SPELL.maj[bpc][0], KEY_SPELL.maj[bpc][1]); // D♭/B, no D♭/C♭
        else {
          // Sin key: mantener la distancia de letras entre raíz y bajo (G/B → A♭/C, D/F♯ → E♭/G)
          const letter = (root.letter + ((p.bass.letter - p.root.letter + 7) % 7)) % 7;
          let acc = bpc - NAT[letter]; if (acc > 6) acc -= 12; if (acc < -6) acc += 12;
          if (Math.abs(acc) <= 1) bass = mkNote(letter, acc);
          else bass = mkNote(KEY_SPELL.maj[bpc][0], KEY_SPELL.maj[bpc][1]);
        }
      }
    }
    const out = {
      text: '', notation: notation || p.notation || 'us', root,
      quality: p.quality, seventh: p.seventh, ext: (p.ext || []).slice(), alt: (p.alt || []).slice(), add: !!p.add,
      bass
    };
    out.text = name(out, out.notation);
    return out;
  }

  /* ---------- 6. keyName ---------- */
  function keyName(key, notation) {
    if (!key) return '';
    const sp = spellNote({ letter: key.letter, acc: key.acc }, notation);
    if (notation === 'latin') return sp + (key.mode === 'min' ? ' menor' : ' mayor');
    return sp + (key.mode === 'min' ? 'm' : '');
  }

  /* ---------- Heurística de líneas ---------- */
  const TRAP = new Set(['A', 'La', 'Si', 'Mi', 'Re', 'Do', 'Sol', 'Fa']);
  const IGNORE_RE = /^(?:\|+|\|\|:|:\|\||\|:|:\||\/|-+|–|—|=+|\.+|\(|\)|\[|\]|[xX×]\s?\d+|\d+\s?[xX×]|bis|[Nn]\.?[Cc]\.?|%|:|,)$/;
  const STRIP_L = /^[|(\[{:]+/, STRIP_R = /[|)\]}:,]+$/;
  const SECTION_WORDS = 'intro|introducci[oó]n|estrofa|verso|verse|estribillo|coro|chorus|pre[- ]?coro|pre[- ]?chorus|puente|bridge|solo|interludio|interlude|instrumental|final|outro|coda';
  const INSTR = 'guitarras?|piano|bajo|teclados?|voz|voces|viol[ií]n|acorde[óo]n|bandone[óo]n|charango|quena|flauta|arm[óo]nica|saxo|trompeta|bater[ií]a|percusi[óo]n|sikus?|bombo';
  const ORD = '(?:\\d+\\s*(?:ra|da|ta|va|ma|na|er|do|to|vo|mo|no|º|ª|°|\\.)?\\s+)?';          // '2da estrofa', '1er verso'
  const NUMERAL = '(?:\\s*(?:\\d+|I{1,3}|IV|V|VI{1,3}|IX|X))?';                                   // 'Estrofa 2', 'Estrofa II'
  const COMPL = '(?:\\s+(?:de\\s+(?:la\\s+|el\\s+)?)?(?:' + INSTR + '|' + SECTION_WORDS + '))?';   // 'Solo de guitarra', 'Puente instrumental'
  const PAREN = '(?:\\s*\\([^()]{1,30}\\))?';                                                      // '(bis)', '(guitarra)', '(x2)'
  const REP = '(?:\\s*\\(?\\s*(?:[x×]\\s*\\d+|\\d+\\s*[x×]|bis)\\s*\\)?)?';                         // 'x2', '(x2)', 'bis'
  const SECTION_CORE = ORD + '(?:' + SECTION_WORDS + ')' + NUMERAL + '(?:\\s+[A-D](?![\\wÀ-ÿ]))?' + COMPL + PAREN + REP;
  const SECTION_RE = new RegExp('^\\s*[\\[\\(]?\\s*(' + SECTION_CORE + ')\\s*[\\]\\)]?\\s*:?\\s*$', 'i');
  // '[Intro] G D Em C', '(Coro) Am F'
  const SECTION_BR_RE = new RegExp('^\\s*[\\[\\(]\\s*(' + SECTION_CORE + ')\\s*[\\]\\)]\\s*:?\\s*(\\S.*)$', 'i');
  // 'Intro: G D Em C', 'Intro (x2): Am G', 'INTRO:Mi Si'
  const SECTION_COLON_RE = new RegExp('^\\s*(' + SECTION_CORE + ')\\s*:\\s*(\\S.*)$', 'i');
  // 'Intro G D Em C' (sin dos puntos: sólo cuenta si el resto es una línea de acordes)
  const SECTION_BARE_RE = new RegExp('^\\s*((?:' + SECTION_WORDS + ')' + NUMERAL + ')\\s+(\\S.*)$', 'i');
  // 'Acordes: C, G, Am, F' (etiqueta genérica: sólo con ≥ 2 acordes en el resto)
  const LABEL_RE = /^\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 '.\-]{0,30}?)\s*:\s*(\S.*)$/;
  const LABEL_LIKE_RE = /^\s*[^:\n]{1,40}:\s*\S/;                                               // 'Palabra(s): …' no es título
  const SECTION_WORD_RE = new RegExp(SECTION_WORDS, 'i');
  const DIR_RE = /^\s*\{\s*([a-zA-Z_]+)\s*(?::\s*(.*?))?\s*\}\s*$/;
  const TITLE_RE = /^\s*(?:t[ií]tulo|title)\s*:\s*(.+?)\s*$/i;
  const META_WORDS = 'artista|autor(?:a|es|as)?|int[ée]rpretes?|artist|tono|tonalidad|key|capo|cejilla|[áa]lbum|album|disco|a[ñn]o|' +
    'letra(?:\\s+y\\s+m[úu]sica)?|m[úu]sica(?:\\s+y\\s+letra)?|compositor(?:a|es|as)?|ritmo|g[ée]nero|comp[áa]s|tempo|bpm|afinaci[óo]n|arreglos?|versi[óo]n|fuente|de|por';
  const META_RE = new RegExp('^\\s*(' + META_WORDS + ')\\s*:\\s*(.+?)\\s*$', 'i');
  const CAPO_RE = /^\s*(capo|cejilla)\s+(?:en\s+(?:el\s+|la\s+)?)?(\d+\S*(?:\s+traste)?)\s*$/i;   // 'Capo 2', 'Cejilla en 2º traste'
  const TAB_RE = /^\s*(?:[A-Ga-g][#b♯♭]?)?\s*\|[-\d\s|hpbrsxXt~^\/\\().,]*-{2,}[-\d\s|hpbrsxXt~^\/\\().,]*$/; // 'e|---0---2---|'
  const INLINE_RE = /\[([^\[\]]*)\]/g;
  const PAREN_GROUP_RE = /(^|\s)\(([^()]*)\)(?=\s|$)/g;

  function expandTabs(s) { return s.replace(/\t/g, '        '); }

  function sectionKind(label) {
    const m = SECTION_WORD_RE.exec(label);
    const w = (m ? m[0] : label).toLowerCase();
    if (/^intro/.test(w)) return 'intro';
    if (/^pre/.test(w)) return 'prechorus';
    if (/^(estrofa|verso|verse)/.test(w)) return 'verse';
    if (/^(estribillo|coro|chorus)/.test(w)) return 'chorus';
    if (/^(puente|bridge)/.test(w)) return 'bridge';
    if (/^solo/.test(w)) return 'solo';
    if (/^(interludio|interlude|instrumental)/.test(w)) return 'interlude';
    if (/^(final|outro)/.test(w)) return 'outro';
    if (/^coda/.test(w)) return 'coda';
    return 'other';
  }

  function pushTok(out, raw, start) {
    let s = raw;
    if (IGNORE_RE.test(raw)) { out.push({ raw, start, ignored: true }); return; }
    const l = STRIP_L.exec(s); if (l) { s = s.slice(l[0].length); start += l[0].length; }
    const comma = /,$/.test(s);
    const r = STRIP_R.exec(s);
    if (r) {
      let tail = r[0]; s = s.slice(0, s.length - tail.length);
      // 'C(add9)' → no perder el paréntesis de cierre propio del símbolo
      let open = (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length;
      while (open > 0 && tail.indexOf(')') >= 0) { s += ')'; tail = tail.replace(')', ''); open--; }
    }
    if (!s || IGNORE_RE.test(s)) { out.push({ raw, start, ignored: true }); return; }
    let parsed = parseSymbol(s);
    if (!parsed && s.indexOf('-') > 0) {
      // 'Do-Sol-Lam-Fa' → cuatro acordes; 'C-' solo y 'E-mail' siguen null
      const parts = s.split('-');
      if (parts.length >= 2 && parts.every(x => x && parseSymbol(x))) {
        let off = start;
        parts.forEach(x => { out.push({ raw: x, text: x, start: off, parsed: parseSymbol(x), ignored: false, comma: false }); off += x.length + 1; });
        if (comma) out[out.length - 1].comma = true;
        return;
      }
    }
    const tok = { raw, text: s, start, parsed, ignored: false, comma };
    if (!parsed && UPPER_BARE_RE.test(s)) tok.upper = parseWith(s, 'latinUp'); // 'SOL' pelado: lo decide la línea
    out.push(tok);
  }
  function tokenize(line) {
    const out = [], re = /\S+/g; let m;
    while ((m = re.exec(line))) {
      const raw = m[0], start = m.index;
      if (raw.indexOf('|') >= 0 && !IGNORE_RE.test(raw)) {
        // '|C|G|Am|F|' → C G Am F (cada pedazo conserva su columna)
        let off = start;
        raw.split('|').forEach((piece, idx) => { if (idx) off++; if (piece) pushTok(out, piece, off); off += piece.length; });
        continue;
      }
      pushTok(out, raw, start);
    }
    return out;
  }
  // Grupos '(…)' sueltos sin ningún acorde adentro → espacios (no mueven las columnas). '(Am Dm) x2' se deja.
  function blankParens(line) {
    return line.replace(PAREN_GROUP_RE, (m, pre, inner) => {
      if (tokenize(inner).some(t => !t.ignored && t.parsed)) return m;
      let sp = ''; for (let i = pre.length; i < m.length; i++) sp += ' ';
      return pre + sp;
    });
  }
  // Línea sin letras ni dígitos ('-----', '=====') o con todos los tokens ignorables ('(x2)', 'bis', '| |')
  function isSeparator(line) {
    if (!/[A-Za-zÀ-ÿ0-9]/.test(line)) return true;
    const toks = tokenize(line);
    return toks.length > 0 && toks.every(t => t.ignored);
  }

  // Devuelve {chords:[{text,pos,parsed}]} o null. nextLine: string | null (no hay) | undefined (no se conoce).
  // opts.upperLatin: la hoja ya tiene acordes latinos en mayúsculas (acepta 'FA SOL DO').
  function analyzeChordLine(line, nextLine, opts) {
    if (!line || !line.trim()) return null;
    const toks = tokenize(blankParens(line)).filter(t => !t.ignored);
    if (!toks.length) return null;
    let valid = toks.filter(t => t.parsed), invalid = toks.filter(t => !t.parsed);
    if (invalid.length && invalid.every(t => t.upper)) {
      // Latino en mayúsculas pelado: todos los tokens son acordes y alguno trae sufijo/alteración ('DO SOL LAm FA')
      const withSuffix = valid.some(t => !BARE_RE.test(t.text));
      const distinct = new Set(invalid.map(t => t.upper.root.pc)).size;
      if (withSuffix || (opts && opts.upperLatin && toks.length >= 2 && (distinct >= 2 || valid.length))) {
        invalid.forEach(t => { t.parsed = t.upper; }); valid = toks; invalid = [];
      }
    }
    if (!valid.length) return null;
    if (valid.length / toks.length < 0.6) return null;
    if (invalid.some(t => /[áéíóúÁÉÍÓÚñÑüÜ¿¡]/.test(t.text))) return null;
    if (/[.,;!?]$/.test(toks[toks.length - 1].raw)) return null;
    if (valid.length < 2 && valid.some(t => t.comma)) return null;          // 'Si, mi amor'
    if (valid.every(t => TRAP.has(t.text))) {
      if (invalid.length) return null;                                        // 'A Mi Manera', 'Sol Mi Amor'
      if (valid.length > 1 && valid.every(t => t.text === valid[0].text)) return null; // 'La La La'
      if ((valid.length === 1 || nextLine !== undefined) && !looksLikeLyric(nextLine)) return null;
    }
    return { chords: valid.map(t => ({ text: t.text, pos: t.start, parsed: t.parsed })) };
  }
  function isChordLine(line, nextLine) {
    if (typeof line !== 'string') return false;
    const nx = nextLine === undefined ? undefined : nextLine == null ? null : expandTabs(String(nextLine));
    return !!analyzeChordLine(expandTabs(line), nx);
  }

  function inlineChords(line) {
    INLINE_RE.lastIndex = 0;
    let m, found = false;
    while ((m = INLINE_RE.exec(line))) { if (parseSymbol(m[1])) { found = true; break; } }
    return found;
  }
  function looksLikeLyric(line) {
    if (line == null || !line.trim()) return false;
    if (SECTION_RE.test(line) || DIR_RE.test(line) || META_RE.test(line) || CAPO_RE.test(line)) return false;
    if (isSeparator(line)) return false;
    if (inlineChords(line)) return false;
    return !analyzeChordLine(line, null);
  }

  function parseInline(line) {
    const chords = []; let lyric = '', last = 0, m;
    INLINE_RE.lastIndex = 0;
    while ((m = INLINE_RE.exec(line))) {
      const inner = m[1].trim();
      const parsed = parseSymbol(inner);
      const drop = !parsed && (inner === '' || IGNORE_RE.test(inner));      // '[]', '[N.C.]', '[x2]' no van a la letra
      if (!parsed && !drop) continue;                                        // '[risas]' queda en la letra
      lyric += line.slice(last, m.index);
      last = m.index + m[0].length;
      if (parsed) {
        let pos = lyric.length;
        if (chords.length && chords[chords.length - 1].pos >= pos) pos = chords[chords.length - 1].pos + 1; // '[C][G]Hola'
        chords.push({ text: inner, pos, parsed });
      } else if (/\s$/.test(lyric) && line[last] === ' ') last++;             // 'Hola [] mundo' → 'Hola mundo'
    }
    lyric += line.slice(last);
    return { chords, lyric: lyric.replace(/\s+$/, '') };
  }

  function labelled(line, nextLine, opts, re, minChords, kindFn) {
    const m = re.exec(line);
    if (!m) return null;
    const head = m[1].replace(/\s+/g, ' ').trim();
    if (kindFn === null && parseSymbol(head)) return null;                     // 'C: G Am' no es una etiqueta
    const offset = line.length - m[2].length;
    const a = analyzeChordLine(line.slice(offset), nextLine, opts);
    if (!a || a.chords.length < minChords) return null;
    return { type: 'chordline', chords: a.chords.map(c => ({ text: c.text, pos: c.pos + offset, parsed: c.parsed })), label: head, kind: kindFn ? kindFn(head) : 'other' };
  }

  function classify(line, nextLine, opts) {
    if (!line.trim()) return { type: 'blank' };
    let m;
    if ((m = DIR_RE.exec(line))) {
      const nm = m[1].toLowerCase(), val = (m[2] || '').trim();
      if (nm === 'title' || nm === 't') return val ? { type: 'title', text: val, directive: true } : { type: 'directive', name: nm, value: '' };
      if (nm === 'subtitle' || nm === 'st' || nm === 'su') return val ? { type: 'subtitle', text: val } : { type: 'directive', name: nm, value: '' };
      if (nm === 'comment' || nm === 'c' || nm === 'ci' || nm === 'cb' || nm === 'comment_italic' || nm === 'comment_box') return { type: 'comment', text: val };
      if (nm === 'soc' || nm === 'start_of_chorus') return { type: 'section', label: val || 'Coro', kind: 'chorus' };
      if (nm === 'sov' || nm === 'start_of_verse') return { type: 'section', label: val || 'Estrofa', kind: 'verse' };
      if (nm === 'sob' || nm === 'start_of_bridge') return { type: 'section', label: val || 'Puente', kind: 'bridge' };
      return { type: 'directive', name: nm, value: val };
    }
    if ((m = SECTION_RE.exec(line))) {
      const label = m[1].replace(/\s+/g, ' ').trim();
      return { type: 'section', label, kind: sectionKind(label) };
    }
    if ((m = TITLE_RE.exec(line))) return { type: 'title', text: m[1] };
    if ((m = META_RE.exec(line))) return { type: 'meta', name: m[1].toLowerCase().replace(/\s+/g, ' '), value: m[2] };
    if ((m = CAPO_RE.exec(line))) return { type: 'meta', name: m[1].toLowerCase(), value: m[2] };
    if (isSeparator(line)) return { type: 'blank' };
    if (TAB_RE.test(line)) return { type: 'lyric', text: line.replace(/\s+$/, '') };
    if (inlineChords(line)) {
      const r = parseInline(line);
      return r.lyric.trim() ? { type: 'pair', chords: r.chords, lyric: r.lyric } : { type: 'chords', chords: r.chords };
    }
    const lab = labelled(line, nextLine, opts, SECTION_BR_RE, 1, sectionKind)
      || labelled(line, nextLine, opts, SECTION_COLON_RE, 1, sectionKind)
      || labelled(line, nextLine, opts, SECTION_BARE_RE, 1, sectionKind)
      || labelled(line, nextLine, opts, LABEL_RE, 2, null);
    if (lab) return lab;
    const a = analyzeChordLine(line, nextLine, opts);
    if (a) return { type: 'chordline', chords: a.chords };
    return { type: 'lyric', text: line.replace(/\s+$/, '') };
  }

  /* ---------- Tonalidad ---------- */
  const DIATONIC = {
    maj: [[0, 'maj'], [2, 'min'], [4, 'min'], [5, 'maj'], [7, 'maj'], [9, 'min'], [11, 'dim']],
    min: [[0, 'min'], [2, 'dim'], [3, 'maj'], [5, 'min'], [7, 'min'], [7, 'maj'], [8, 'maj'], [10, 'maj'], [11, 'dim']]
  };
  const SCALE = { maj: [0, 2, 4, 5, 7, 9, 11], min: [0, 2, 3, 5, 7, 8, 10, 11] };
  const BORROW = {
    maj: [[10, 'maj'], [5, 'min'], [8, 'maj'], [3, 'maj'], [2, 'maj'], [4, 'maj'], [9, 'maj'], [11, 'maj']],
    min: [[5, 'maj'], [1, 'maj'], [0, 'maj'], [2, 'maj']]
  };
  function triadQ(p) {
    let q = p.quality;
    if (q === 'min' && p.alt.indexOf('b5') >= 0) q = 'dim';
    if (q === 'maj' && p.alt.indexOf('#5') >= 0) q = 'aug';
    return q;
  }
  function isNeutral(q) { return q === 'sus2' || q === 'sus4' || q === 'power'; }
  function isTonic(p, key) {
    if (p.root.pc !== key.pc) return false;
    const q = triadQ(p);
    if (isNeutral(q)) return true;
    return key.mode === 'maj' ? q === 'maj' : q === 'min';
  }
  function chordScore(p, key) {
    const deg = mod12(p.root.pc - key.pc), q = triadQ(p);
    const inScale = SCALE[key.mode].indexOf(deg) >= 0;
    if (isNeutral(q)) return inScale ? 2 : BORROW[key.mode].some(b => b[0] === deg) ? 1 : -1;
    if (DIATONIC[key.mode].some(d => d[0] === deg && d[1] === q)) return 2;
    if (BORROW[key.mode].some(b => b[0] === deg && b[1] === q)) return 1;
    return inScale ? 0.5 : -1;
  }
  function isDominantOf(p, key) {
    if (p.root.pc !== mod12(key.pc + 7)) return false;
    const q = triadQ(p);
    return q === 'maj' || isNeutral(q);
  }
  // Pesos: ver encabezado. seq[i] = {parsed, line}.
  function detectKey(seq) {
    if (!seq.length) return { key: null, candidates: [] };
    const cands = [];
    const last = seq.length - 1;
    ['maj', 'min'].forEach(mode => {
      for (let pc = 0; pc < 12; pc++) {
        const key = { pc, mode };
        let score = 0, tonicCount = 0;
        seq.forEach((c, i) => {
          score += chordScore(c.parsed, key);
          if (isTonic(c.parsed, key)) {
            tonicCount++;
            if (i > 0) {
              if (c.line !== seq[i - 1].line) score += 1;                 // tónica que abre una línea de acordes
              if (i < last) {                                             // cadencias, no sobre el último acorde
                const prev = seq[i - 1].parsed;
                if (isDominantOf(prev, key)) score += 1;                  // V→I
                else if (prev.root.pc === mod12(key.pc + 5)) score += 0.5; // IV→I
              }
            }
          }
        });
        if (isTonic(seq[0].parsed, key)) score += 3;                      // primer acorde
        const lastTonic = isTonic(seq[last].parsed, key);
        if (lastTonic) score += 2;                                        // último acorde
        const sp = KEY_SPELL[mode][pc];
        cands.push({ pc, mode, letter: sp[0], acc: sp[1], score, tonicCount, lastTonic });
      }
    });
    cands.sort((a, b) => (b.score - a.score) || (b.tonicCount - a.tonicCount) || ((b.lastTonic ? 1 : 0) - (a.lastTonic ? 1 : 0)) || (a.mode === 'maj' ? -1 : b.mode === 'maj' ? 1 : 0));
    const top = cands[0];
    const key = { pc: top.pc, mode: top.mode, letter: top.letter, acc: top.acc };
    key.name = keyName(key, 'us');
    const candidates = cands.slice(0, 3).map(c => ({ pc: c.pc, mode: c.mode, letter: c.letter, acc: c.acc, name: keyName(c, 'us'), score: Math.round(c.score * 100) / 100 }));
    return { key, candidates };
  }

  /* ---------- 4. parseSheet ---------- */
  const TITLE_NEXT = { blank: 1, section: 1, chordline: 1, meta: 1, pair: 1, chords: 1 };
  const TITLE_SKIP = { blank: 1, meta: 1, directive: 1, comment: 1 };
  const SUBTITLE_THIRD = { blank: 1, section: 1, meta: 1, directive: 1 };
  function titleText(s) { return s.length <= 80 && !/[.,;!?]$/.test(s) && !LABEL_LIKE_RE.test(s) && !/^[(\[].*[)\]]$/.test(s); }

  // Agrupa los acordes de las líneas: sequence (en orden) y chords (únicos con count), ambos con nombre 'us'.
  function collectChords(lines) {
    const sequence = [], chords = [], byName = {};
    let us = 0, latin = 0;
    lines.forEach((ln, li) => {
      if (!ln.chords) return;
      ln.chords.forEach(ch => {
        const nm = name(ch.parsed, 'us');
        if (ch.parsed.notation === 'latin') latin++; else us++;
        sequence.push({ name: nm, parsed: ch.parsed, line: li, pos: ch.pos });
        if (!byName[nm]) { byName[nm] = { name: nm, parsed: ch.parsed, count: 0 }; chords.push(byName[nm]); }
        byName[nm].count++;
      });
    });
    return { sequence, chords, notation: latin > us ? 'latin' : 'us' };
  }

  function parseSheet(text) {
    const src = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n').map(expandTabs);
    const nextOf = i => (i + 1 < src.length ? src[i + 1] : null);
    const cls = src.map((l, i) => classify(l, nextOf(i)));

    // Hoja con acordes latinos en mayúsculas: las líneas de raíces peladas ('FA SOL DO') también son acordes
    if (cls.some(c => c.chords && c.chords.some(ch => LAT_ROOT_UP.test(ch.text)))) {
      cls.forEach((c, i) => {
        if (c.type !== 'lyric') return;
        const c2 = classify(src[i], nextOf(i), { upperLatin: true });
        if (c2.type === 'chordline') cls[i] = c2;
      });
    }

    let title = null, subtitle = null;
    // {title:} manda. Si no hay, se aplica la heurística de primeras líneas.
    cls.forEach(c => { if (c.type === 'title' && title == null) title = c.text; if (c.type === 'subtitle' && subtitle == null) subtitle = c.text; });
    if (title == null) {
      let first = 0;
      while (first < cls.length && TITLE_SKIP[cls[first].type]) first++;   // meta/blancos iniciales no impiden el título
      if (first < cls.length && cls[first].type === 'lyric') {
        const t = cls[first].text.trim(), next = cls[first + 1];
        const hasChordsBelow = cls.some(c => c.type === 'chordline' || c.type === 'pair' || c.type === 'chords');
        if (hasChordsBelow && titleText(t)) {
          if (next && TITLE_NEXT[next.type]) {
            title = t; cls[first] = { type: 'title', text: t };
          } else if (next && next.type === 'lyric' && subtitle == null) {
            // Título + autor en dos líneas, seguidos de blanco/sección/meta
            const t2 = next.text.trim(), third = cls[first + 2];
            if (third && SUBTITLE_THIRD[third.type] && titleText(t2)) {
              title = t; subtitle = t2;
              cls[first] = { type: 'title', text: t }; cls[first + 1] = { type: 'subtitle', text: t2 };
            }
          }
        }
      }
    }

    const lines = [];
    for (let i = 0; i < cls.length; i++) {
      const c = cls[i];
      if (c.type === 'chordline') {
        const nx = cls[i + 1];
        if (nx && nx.type === 'lyric') {
          const o = { type: 'pair', chords: c.chords, lyric: nx.text, src: i };
          if (c.label) { o.label = c.label; o.kind = c.kind; }
          lines.push(o); i++;
        } else {
          const o = { type: 'chords', chords: c.chords, src: i };
          if (c.label) { o.label = c.label; o.kind = c.kind; }
          lines.push(o);
        }
        continue;
      }
      lines.push(Object.assign({}, c, { src: i }));
    }

    const col = collectChords(lines);
    const det = detectKey(col.sequence);
    return { title, subtitle, lines, chords: col.chords, sequence: col.sequence, key: det.key, keyCandidates: det.candidates, notation: col.notation };
  }

  /* ---------- 7. transposeSheet ---------- */
  function transposeKey(k, semitones) {
    if (!k) return null;
    const pc = mod12(k.pc + semitones);
    const o = Object.assign({}, k, { pc });
    if (mod12(semitones) !== 0) { const sp = KEY_SPELL[k.mode === 'min' ? 'min' : 'maj'][pc]; o.letter = sp[0]; o.acc = sp[1]; }
    if (k.name != null) o.name = keyName(o, 'us');
    return o;
  }
  function transposeSheet(sheet, semitones, notation) {
    if (!sheet || typeof sheet !== 'object') return null;
    semitones = Math.round(Number(semitones) || 0);
    const nota = notation || sheet.notation || 'us';
    const key = sheet.key || null;
    const lines = (sheet.lines || []).map(ln => {
      const o = Object.assign({}, ln);
      if (ln.chords) o.chords = ln.chords.map(ch => {
        const q = transpose(ch.parsed, semitones, nota, key);
        return Object.assign({}, ch, { text: q ? q.text : ch.text, parsed: q || ch.parsed });
      });
      return o;
    });
    const col = collectChords(lines);
    return {
      title: sheet.title == null ? null : sheet.title, subtitle: sheet.subtitle == null ? null : sheet.subtitle,
      lines, chords: col.chords, sequence: col.sequence,
      key: transposeKey(key, semitones),
      keyCandidates: (sheet.keyCandidates || []).map(c => transposeKey(c, semitones)),
      notation: nota
    };
  }

  return { parseSymbol, intervals, name, bassInterval, parseSheet, transpose, transposeSheet, keyName, isChordLine };
})();
if (typeof module !== 'undefined') module.exports = ChordSheet;
