/* ============================================================================
   Ritmos — patrones rítmicos, rellenos, finales, metrónomo y editor de pasos
   para Tablero Armónico.

   Módulo de DATOS y helpers puros: acá no suena nada. El motor de audio del
   HTML (función playStep) interpreta cada código. Sin dependencias, sin
   import/export: se pega inline en un <script>; en Node, module.exports.

   LENGUAJE DE PASOS (fijado)
   Un patrón: {id, name, desc, group, meter, div, steps}
     meter : '4/4' | '3/4' | '6/8' | '2/4'
     div   : pasos por pulso (2 corcheas, 3 tresillo o 6/8, 4 semicorcheas,
             6 semicorcheas en 6/8)
     steps : array de códigos; largo = pulsos por compás × div
   Cada código es un string con cero o más letras que suenan juntas:
     B bajo (fundamental grave)        F quinta grave
     b bajo una octava arriba
     D rasgueo abajo fuerte            d rasgueo abajo suave
     U rasgueo arriba fuerte           u rasgueo arriba suave
     S acorde en bloque suave          M chasquido (acorde corto, apagado)
     X golpe percusivo sin altura
     1 2 3 4 5 6 notas del arpegio (índice en el voicing, cíclico por octavas)
     T nota más aguda sola             '' silencio
   Metrónomo (sólo para countIn / clickFor, no se escribe en patrones):
     C clic acentuado (primer pulso)   c clic en los demás pulsos

   Longitudes: 4/4 div2→8, div4→16 · 3/4 div2→6, div4→12 ·
               6/8 div3→6, div6→12 (dos pulsos de negra con puntillo) ·
               2/4 div2→4, div4→8.  El BPM de la app es el pulso.

   API (Ritmos.*)
   Datos (congelados con Object.freeze; para editar un patrón, clone()):
     meters          ['4/4','3/4','6/8','2/4']
     groups          ['Base','Latinoamérica','Otros'] (orden del menú)
     patterns        [{id, name, desc, group, meter, div, steps}] en orden de menú
     byId            {id → patrón} (mismos objetos que patterns)
     fills           [{id, name, byDiv: {2:[…],3:[…],4:[…],6:[…]}}], un pulso cada uno
     fillById        {id → relleno}
     endings         [{id, name, div, steps, holdBeats}]
     endingById      {id → final}
     rows            filas del editor [{code, label, soft?}]
     ALPHABET        'BFbDdUuSMX123456T'   letras válidas en un código
     CANON           'BFb123456TSDdUuMX'   orden canónico dentro de un código
     MAX_STEPS       48                    tope de resize()
   Compás:
     beatsPerBar(meter) → pulsos por compás (0 si el compás no existe)
     divsFor(meter) → [div…] (copia; [] si el compás no existe)
     lengthFor(meter, div) → pasos por compás (0 si meter o div no valen; div
                             acepta string numérico)
   Metrónomo:
     countIn(meter, div) → ['C','',…,'c',…] un compás de clics ([] si no vale)
     clickFor(meter, div, stepIndex) → 'C' | 'c' | '' (cíclico, acepta negativos)
     stepSeconds(bpm, div) → segundos por paso; bpm inválido cae a 90 y div
                             inválido a 2 (nunca Infinity/NaN)
   Patrones:
     clone(pattern) → copia editable (objeto nuevo, steps nuevo); null si no es objeto
     patternsByGroup() → [{group, patterns:[…]}] en el orden de groups (arrays nuevos)
     applyFill(pattern, fillId) → copia de steps con el último pulso reemplazado;
                             [] si el patrón no tiene steps; copia sin cambios si
                             el relleno no existe o los steps son más cortos que él
     suggestedEnding(meter) → 'triple' en 6/8, 'largo' en el resto
   Editor:
     toGrid(steps) → grid[fila][paso] con 0 nada, 1 fuerte, 2 suave
     fromGrid(grid) → steps (códigos en orden canónico)
     canon(code) → code en orden canónico, sin duplicados ni letras ajenas
     normalize(steps) → fromGrid(toGrid(steps)): versión editable, idempotente
     usesOnlyRowCodes(steps) → true si el round-trip toGrid/fromGrid es exacto
     resize(steps, newLength) → copia recortada, rellenada con '' o repetida
                             (×2, ×3…); tope MAX_STEPS; largo no numérico o
                             infinito → copia sin cambios
     validate(pattern) → {ok, errors:[…]} (div acepta string numérico)
     blank(meter, div) → patrón vacío para empezar a editar (div acepta string)
   Todas las funciones toleran undefined/null en sus argumentos: devuelven
   vacío o la copia sin cambios en vez de lanzar.
   ============================================================================ */
const Ritmos = (() => {
  'use strict';

  /* ------------------------------------------------------------------ Base */
  const meters = ['4/4', '3/4', '6/8', '2/4'];
  const BEATS = { '4/4': 4, '3/4': 3, '6/8': 2, '2/4': 2 };
  const DIVS = { '4/4': [2, 4], '3/4': [2, 4], '6/8': [3, 6], '2/4': [2, 4] };
  // Tope de pasos que acepta resize(): el máximo real es lengthFor('4/4', 4) = 16;
  // 48 deja margen para experimentar sin colgar el celular.
  const MAX_STEPS = 48;

  // Letras válidas dentro de un código de paso (sin C/c, que son del metrónomo).
  const ALPHABET = 'BFbDdUuSMX123456T';
  // Orden canónico para escribir un código: grave → agudo, luego percusión.
  const CANON = 'BFb123456TSDdUuMX';

  // Número positivo o NaN (acepta '4' de un <select>; rechaza '', null, true).
  function positive(x) {
    if (typeof x === 'string') x = x.trim() === '' ? NaN : Number(x);
    if (typeof x !== 'number' || !Number.isFinite(x) || x <= 0) return NaN;
    return x;
  }
  const asArray = (x) => (Array.isArray(x) ? x : []);

  const beatsPerBar = (meter) => BEATS[meter] || 0;
  const divsFor = (meter) => (DIVS[meter] || []).slice();
  const lengthFor = (meter, div) => {
    const d = positive(div);
    return Number.isNaN(d) ? 0 : beatsPerBar(meter) * d;
  };

  /* ----------------------------------------------------------- Patrones */
  // group: 'Base' | 'Latinoamérica' | 'Otros'. El array ya viene en el orden
  // del menú. Los códigos están escritos en orden canónico (ver canon()).
  const patterns = [
    /* ---- Base ---- */
    { id: 'pop', group: 'Base', name: 'Rasgueo pop 4/4', meter: '4/4', div: 2,
      desc: 'Bajo con rasgueo en el uno, abajo-arriba en el dos, y arriba-abajo-arriba desde el tres y medio: el D DU UDU de siempre.',
      steps: ['BD', '', 'D', 'U', '', 'U', 'D', 'U'] },
    { id: 'balada', group: 'Base', name: 'Balada 4/4', meter: '4/4', div: 2,
      desc: 'Bajo en el uno, acordes en bloque suaves en cada pulso y un arriba livianito antes de volver.',
      steps: ['B', '', 'S', '', 'bS', '', 'S', 'u'] },
    { id: 'arpegio', group: 'Base', name: 'Arpegio 4/4', meter: '4/4', div: 2,
      desc: 'Bajo en el uno y el arpegio que sube hasta la cuarta nota y vuelve a bajar en corcheas.',
      steps: ['B', '1', '2', '3', '4', '3', '2', '1'] },
    { id: 'folk', group: 'Base', name: 'Fingerpicking 4/4', meter: '4/4', div: 2,
      desc: 'Pulgar alternando bajo y quinta en cada pulso; índice y medio contestan en las corcheas de en medio.',
      steps: ['B', '2', 'F', '3', 'B', '2', 'F', '4'] },
    { id: 'vals', group: 'Base', name: 'Vals 3/4', meter: '3/4', div: 2,
      desc: 'Bajo en el uno, dos acordes suaves en el dos y el tres, un arriba liviano para dar la vuelta.',
      steps: ['B', '', 'S', '', 'S', 'u'] },
    { id: 'rock', group: 'Base', name: 'Corcheas firmes', meter: '4/4', div: 2,
      desc: 'Rasgueo abajo en todas las corcheas, bajo en el uno y el tres, acento en cada pulso y las de en medio más suaves.',
      steps: ['BD', 'd', 'D', 'd', 'BD', 'd', 'D', 'd'] },
    { id: 'pop16', group: 'Base', name: 'Pop 16', meter: '4/4', div: 4,
      desc: 'Semicorcheas con acento en el uno, el dos y medio y el cuatro; arribas suaves rellenan entre medio.',
      steps: ['BD', '', 'd', 'u', '', 'u', 'D', 'u', 'B', 'u', 'd', 'u', 'D', '', 'd', 'u'] },
    { id: 'arpegio16', group: 'Base', name: 'Arpegio 16', meter: '4/4', div: 4,
      desc: 'Bajo en el uno y quinta en el tres; el arpegio sube hasta la nota más aguda y baja en semicorcheas.',
      steps: ['B', '', '2', '3', '4', 'T', '4', '3', 'F', '', '2', '3', '4', 'T', '4', '3'] },
    { id: 'balada68', group: 'Base', name: 'Balada 6/8', meter: '6/8', div: 3,
      desc: 'Bajo en el uno y un arpegio ondulante que sube hasta la nota más aguda y baja; sirve para el 12/8 lento.',
      steps: ['B', '2', '3', 'T', '3', '2'] },

    /* ---- Latinoamérica ---- */
    { id: 'chacarera', group: 'Latinoamérica', name: 'Chacarera 6/8', meter: '6/8', div: 6,
      desc: 'Bajo en la primera corchea y quinta en la cuarta; el rasgueo acentúa 1, 3 y 5 (la hemiola de 3/4), con chasquidos en las corcheas pares y arrastres de semicorchea antes de cada acento.',
      // div 6 porque los arrastres (u de semicorchea) que empujan hacia los
      // acentos de la hemiola no entran en la grilla de corcheas.
      steps: ['BD', '', 'M', 'u', 'D', '', 'FM', 'u', 'D', '', 'M', 'u'] },
    { id: 'zamba', group: 'Latinoamérica', name: 'Zamba 6/8', meter: '6/8', div: 3,
      desc: 'Bajo en el uno, aire en la segunda corchea y después abajo-arriba-abajo-arriba, con los arriba livianos y el peso en los abajo. Lenta.',
      steps: ['B', '', 'D', 'u', 'D', 'u'] },
    { id: 'chamame', group: 'Latinoamérica', name: 'Chamamé 6/8', meter: '6/8', div: 3,
      desc: 'Bajo en el uno y quinta en el cuatro; rasgueo abajo y chasquido apagado que cierra cada mitad: el bom-cha-chás del chamamé.',
      steps: ['B', 'D', 'M', 'F', 'D', 'M'] },
    { id: 'cueca', group: 'Latinoamérica', name: 'Cueca 6/8', meter: '6/8', div: 3,
      desc: 'Rápida: bajo con rasgueo en el uno y quinta con arriba suave en el cuatro; los abajo en 1, 3 y 5 marcan la hemiola contra el seis por ocho.',
      steps: ['BD', 'u', 'D', 'Fu', 'D', 'u'] },
    { id: 'bossa', group: 'Latinoamérica', name: 'Bossa nova 4/4', meter: '4/4', div: 4,
      desc: 'Bajo en el uno y quinta en el tres, cada uno anticipado en la corchea anterior; los acordes caen sincopados entre los pulsos.',
      // Resumido en UN compás (16 pasos): el motor, los puntos y los rellenos
      // asumen un compás por patrón. La segunda mitad de la clave de dos
      // compases se insinúa con los acordes del cuatro. La anticipación del
      // tres (paso 6) es la quinta y la del uno siguiente (paso 14) la tónica.
      steps: ['B', '', '', 'S', '', '', 'FS', '', 'F', '', 'S', '', '', 'S', 'B', ''] },
    { id: 'reggae', group: 'Latinoamérica', name: 'Reggae 4/4', meter: '4/4', div: 2,
      desc: 'Chasquido seco en el dos y en el cuatro, un arriba suave en la "y" del cuatro, bajo en el uno y un bajito agudo en la "y" del tres.',
      steps: ['B', '', 'M', '', '', 'b', 'M', 'u'] },
    { id: 'cumbia', group: 'Latinoamérica', name: 'Cumbia 4/4', meter: '4/4', div: 4,
      desc: 'Bajo en el uno y quinta en el tres; chasquidos a contratiempo con su semicorchea arriba, como la guacharaca.',
      steps: ['B', '', 'M', 'u', '', '', 'M', 'u', 'F', '', 'M', 'u', '', '', 'M', 'u'] },
    { id: 'huayno', group: 'Latinoamérica', name: 'Huayno 2/4', meter: '2/4', div: 4,
      desc: 'Bajo en cada pulso y dos rasgueos cortos abajo-arriba que lo siguen: el bum-chaca del huayno, con tónica y quinta alternadas.',
      steps: ['B', '', 'D', 'u', 'F', '', 'D', 'u'] },
    { id: 'milonga', group: 'Latinoamérica', name: 'Milonga campera 3-3-2', meter: '4/4', div: 2,
      desc: 'Acentos en 3-3-2: bajo en el uno, bajo con rasgueo en el dos y medio, quinta con rasgueo en el cuatro; corcheas suaves entre medio.',
      steps: ['B', 'd', '', 'BD', '', 'd', 'FD', 'u'] },
    { id: 'bolero', group: 'Latinoamérica', name: 'Bolero 4/4', meter: '4/4', div: 4,
      desc: 'Bajo en el uno, acorde en el dos, quinta con acorde en el tres, otro acorde en el tres y medio y uno anticipado en el cuatro y medio: el patrón de bolero de la guitarra rítmica.',
      steps: ['B', '', '', '', 'S', '', '', '', 'FS', '', 'S', '', '', '', 'S', ''] },
    { id: 'bolerotrio', group: 'Latinoamérica', name: 'Bolero arpegiado', meter: '4/4', div: 4,
      desc: 'Bajo en el uno y quinta en el tres; el arpegio contesta en semicorcheas subiendo hasta la nota aguda y volviendo: la segunda guitarra del trío.',
      steps: ['B', '', '2', '3', '4', '', '3', '2', 'F', '', '2', '3', 'T', '', '3', '2'] },
    { id: 'valscriollo', group: 'Latinoamérica', name: 'Vals criollo 3/4', meter: '3/4', div: 2,
      desc: 'Bajo en el uno, rasgueo abajo-arriba en el dos y quinta con rasgueo abajo-arriba en el tres.',
      steps: ['B', '', 'D', 'u', 'FD', 'u'] },

    /* ---- Otros ---- */
    { id: 'country', group: 'Otros', name: 'Country alternado 4/4', meter: '4/4', div: 2,
      desc: 'Bajo en el uno, rasgueo en el dos, quinta en el tres, rasgueo en el cuatro: el boom-chick clásico.',
      steps: ['B', 'D', 'F', 'D', 'B', 'D', 'F', 'U'] },
    { id: 'polca', group: 'Otros', name: 'Polca 2/4', meter: '2/4', div: 2,
      desc: 'Bajo y rasgueo alternados a dos: bajo, abajo, quinta, abajo.',
      steps: ['B', 'D', 'F', 'D'] },
    { id: 'ska', group: 'Otros', name: 'Ska 4/4', meter: '4/4', div: 2,
      desc: 'Arriba corto en todas las contras, bajo en el uno y el tres, el pulso queda vacío.',
      steps: ['B', 'U', '', 'U', 'F', 'U', '', 'U'] },
    { id: 'bloques', group: 'Otros', name: 'Bloques 4/4', meter: '4/4', div: 2,
      desc: 'Un acorde en bloque suave por pulso, con el bajo debajo del uno; lo mínimo para acompañar sin rasgueo.',
      steps: ['BS', '', 'S', '', 'S', '', 'S', ''] }
  ];

  const byId = {};
  patterns.forEach((p) => { byId[p.id] = p; });
  const groups = ['Base', 'Latinoamérica', 'Otros'];

  // Copia editable de un patrón: objeto nuevo y steps nuevo (los datos del
  // módulo están congelados). Devuelve null si no recibe un objeto.
  function clone(pattern) {
    if (!pattern || typeof pattern !== 'object') return null;
    const out = Object.assign({}, pattern);
    out.steps = asArray(pattern.steps).slice();
    return out;
  }

  // [{group, patterns:[…]}] en el orden de groups, con arrays nuevos.
  const patternsByGroup = () => groups.map((g) => ({ group: g, patterns: patterns.filter((p) => p.group === g) }));

  /* ------------------------------------------------------------ Rellenos */
  // Cada lista dura exactamente UN pulso (div pasos) y reemplaza el último
  // pulso del compás. En 6/8 (div 3 y 6) el último pulso es la segunda mitad
  // del compás, así que el primer paso lleva la quinta para que el relleno no
  // se coma el bajo de la cuarta corchea.
  const fills = [
    { id: 'redoble', name: 'Redoble',
      byDiv: { 2: ['D', 'U'], 3: ['Fd', 'D', 'U'], 4: ['d', 'u', 'D', 'U'], 6: ['F', 'u', 'd', 'u', 'D', 'U'] } },
    { id: 'subida', name: 'Subida',
      byDiv: { 2: ['2', '4'], 3: ['F2', '3', '4'], 4: ['1', '2', '3', '4'], 6: ['F1', '2', '3', '4', '5', '6'] } },
    // Corte: chasquido en el pulso (apaga lo que venía sonando), golpe
    // percusivo en el medio y silencio hasta el uno siguiente.
    { id: 'corte', name: 'Corte',
      byDiv: { 2: ['M', 'X'], 3: ['M', '', 'X'], 4: ['M', '', 'X', ''], 6: ['M', '', '', 'X', '', ''] } },
    { id: 'vuelta', name: 'Vuelta',
      byDiv: { 2: ['U', 'D'], 3: ['FD', 'U', 'D'], 4: ['D', '', 'U', 'D'], 6: ['FD', '', '', 'U', '', 'D'] } },
    { id: 'bajo', name: 'Bajo',
      byDiv: { 2: ['B', 'b'], 3: ['B', 'F', 'b'], 4: ['B', 'F', 'b', 'B'], 6: ['B', '', 'F', 'b', '', 'B'] } }
  ];
  const fillById = {};
  fills.forEach((f) => { fillById[f.id] = f; });

  // Devuelve una copia de steps con el último pulso reemplazado por el relleno.
  // Sin steps → []. Relleno inexistente, div sin relleno o steps más cortos que
  // el relleno → copia sin cambios.
  function applyFill(pattern, fillId) {
    if (!pattern || typeof pattern !== 'object' || !Array.isArray(pattern.steps)) return [];
    const steps = pattern.steps.slice();
    const f = fillById[fillId];
    const piece = f && f.byDiv[pattern.div];
    if (!piece || steps.length < piece.length) return steps;
    const start = steps.length - piece.length;
    for (let i = 0; i < piece.length; i++) steps[start + i] = piece[i];
    return steps;
  }

  /* ------------------------------------------------------------- Finales */
  // Se tocan al llegar al próximo inicio de compás; steps.length es múltiplo
  // de div. Después el patrón se detiene y el último acorde queda sonando
  // holdBeats pulsos (lo maneja la app). holdBeats 0 = corte inmediato.
  const endings = [
    { id: 'largo', name: 'Final largo', div: 2, steps: ['BD', ''], holdBeats: 4 },
    { id: 'doble', name: 'Final doble', div: 2, steps: ['BD', '', 'BD', ''], holdBeats: 4 },
    { id: 'subida', name: 'Final con subida', div: 2, steps: ['1', '2', '3', '4', 'BD', ''], holdBeats: 4 },
    { id: 'seco', name: 'Final seco', div: 2, steps: ['BD', 'X'], holdBeats: 0 },
    // Quinta grave, tónica aguda de paso y la tónica grave con el acorde.
    { id: 'bajo', name: 'Final con bajo', div: 2, steps: ['F', 'b', 'BD', ''], holdBeats: 4 },
    // El chan-chan-CHÁN del folklore en 6/8: tres corcheas, la última con bajo.
    { id: 'triple', name: 'Final triple', div: 3, steps: ['D', 'D', 'BD', '', '', ''], holdBeats: 4 }
  ];
  const endingById = {};
  endings.forEach((e) => { endingById[e.id] = e; });

  // Final sugerido para un compás: el triple en 6/8, el largo en el resto.
  const suggestedEnding = (meter) => (meter === '6/8' ? 'triple' : 'largo');

  /* ----------------------------------------------------------- Metrónomo */
  // Un compás de clics para la entrada: 'C' en el primer pulso, 'c' en los
  // demás pulsos, '' en las subdivisiones.
  function countIn(meter, div) {
    const out = [];
    const n = lengthFor(meter, div);
    for (let i = 0; i < n; i++) out.push(clickFor(meter, div, i));
    return out;
  }
  // Clic para el paso stepIndex (cíclico) mientras suena el patrón.
  function clickFor(meter, div, stepIndex) {
    const n = lengthFor(meter, div);
    const d = positive(div);
    if (!n || Number.isNaN(d)) return '';
    const i = ((stepIndex % n) + n) % n;
    if (i % d !== 0) return '';
    return i === 0 ? 'C' : 'c';
  }
  // Duración de un paso en segundos (el BPM es el pulso). Un bpm inválido cae
  // a 90 y un div inválido a 2, así el scheduler nunca recibe Infinity/NaN.
  function stepSeconds(bpm, div) {
    const b = positive(bpm), d = positive(div);
    return 60 / (Number.isNaN(b) ? 90 : b) / (Number.isNaN(d) ? 2 : d);
  }

  /* -------------------------------------------------------------- Editor */
  // Filas de la grilla. Valor por celda: 0 nada, 1 fuerte/normal, 2 suave
  // (sólo filas con soft).
  const rows = [
    { code: 'B', label: 'Bajo' },
    { code: 'F', label: 'Quinta' },
    { code: 'D', label: 'Abajo', soft: 'd' },
    { code: 'U', label: 'Arriba', soft: 'u' },
    { code: 'M', label: 'Chasquido' },
    { code: 'X', label: 'Golpe' },
    { code: '1', label: 'Arp 1' },
    { code: '2', label: 'Arp 2' },
    { code: '3', label: 'Arp 3' },
    { code: '4', label: 'Arp 4' }
  ];
  // Códigos que el editor no tiene y cómo se proyectan sobre las filas:
  //   S → fila D, suave (2)    (vuelve como 'd')
  //   b → fila B (1)           (vuelve como 'B')
  //   T → fila Arp 4 (1)       (vuelve como '4')
  //   5 → fila Arp 1, 6 → fila Arp 2 (misma nota una octava arriba; vuelven
  //       como '1' y '2')
  // Por eso el round-trip toGrid/fromGrid es exacto sólo para patrones que
  // usen únicamente los códigos de rows; para los demás, normalize() da la
  // versión editable y es idempotente.
  const TO_ROW = {};
  rows.forEach((r, i) => {
    TO_ROW[r.code] = { row: i, val: 1 };
    if (r.soft) TO_ROW[r.soft] = { row: i, val: 2 };
  });
  const ROW_INDEX = {};
  rows.forEach((r, i) => { ROW_INDEX[r.code] = i; });
  TO_ROW.S = { row: ROW_INDEX.D, val: 2 };
  TO_ROW.b = { row: ROW_INDEX.B, val: 1 };
  TO_ROW.T = { row: ROW_INDEX['4'], val: 1 };
  TO_ROW['5'] = { row: ROW_INDEX['1'], val: 1 };
  TO_ROW['6'] = { row: ROW_INDEX['2'], val: 1 };

  // toGrid(steps) → grid[fila][paso]. Sin steps → grilla de cero columnas.
  function toGrid(steps) {
    steps = asArray(steps);
    const grid = rows.map(() => steps.map(() => 0));
    steps.forEach((code, s) => {
      for (const ch of String(code || '')) {
        const m = TO_ROW[ch];
        if (!m) continue;
        // Si ya hay algo en la celda, gana el fuerte.
        grid[m.row][s] = (grid[m.row][s] === 1 || m.val === 1) ? 1 : 2;
      }
    });
    return grid;
  }
  // fromGrid(grid) → steps (códigos en orden canónico). El largo es el de la
  // fila más larga; filas faltantes o cortas cuentan como vacías.
  function fromGrid(grid) {
    grid = asArray(grid);
    const n = grid.reduce((m, row) => (Array.isArray(row) ? Math.max(m, row.length) : m), 0);
    const steps = [];
    for (let s = 0; s < n; s++) {
      let code = '';
      rows.forEach((r, i) => {
        const v = Array.isArray(grid[i]) ? grid[i][s] : 0;
        if (v === 1) code += r.code;
        else if (v === 2) code += r.soft || r.code;
      });
      steps.push(canon(code));
    }
    return steps;
  }
  // Orden canónico de las letras de un código (sin duplicados).
  function canon(code) {
    const seen = new Set();
    let out = '';
    for (const ch of CANON) if (String(code || '').indexOf(ch) >= 0 && !seen.has(ch)) { seen.add(ch); out += ch; }
    return out;
  }
  const normalize = (steps) => fromGrid(toGrid(steps));
  const usesOnlyRowCodes = (steps) => asArray(steps).every((c) => [...String(c || '')].every((ch) => ch in TO_ROW && !('STb56'.indexOf(ch) >= 0)));

  // resize(steps, newLength): recorta, o rellena con ''. Si newLength es un
  // múltiplo exacto (×2, ×3…), repite el patrón. El largo se acota a
  // [0, MAX_STEPS]; si no es un número finito, devuelve la copia sin cambios.
  function resize(steps, newLength) {
    steps = asArray(steps);
    const n = steps.length;
    if (typeof newLength === 'string') newLength = newLength.trim() === '' ? NaN : Number(newLength);
    if (typeof newLength !== 'number' || !Number.isFinite(newLength)) return steps.slice();
    newLength = Math.min(MAX_STEPS, Math.max(0, Math.floor(newLength)));
    if (newLength === n) return steps.slice();
    if (newLength < n) return steps.slice(0, newLength);
    if (n > 0 && newLength % n === 0) {
      const out = [];
      while (out.length < newLength) out.push(...steps);
      return out;
    }
    const out = steps.slice();
    while (out.length < newLength) out.push('');
    return out;
  }

  /* ----------------------------------------------------------- Validación */
  // true si el código tiene al menos una letra del alfabeto (o sea, suena).
  function sounds(code) {
    if (typeof code !== 'string') return false;
    for (const ch of code) if (ALPHABET.indexOf(ch) >= 0) return true;
    return false;
  }
  const isMissing = (x) => x === undefined || x === null || x === '';

  function validate(pattern) {
    const errors = [];
    if (!pattern || typeof pattern !== 'object' || Array.isArray(pattern)) return { ok: false, errors: ['El patrón tiene que ser un objeto.'] };
    if (typeof pattern.id !== 'string' || !/^[a-z0-9_-]+$/i.test(pattern.id)) errors.push('Falta un id válido (letras, números, guiones).');
    if (typeof pattern.name !== 'string' || !pattern.name.trim()) errors.push('Falta el nombre.');
    const meterOk = meters.indexOf(pattern.meter) >= 0;
    const div = positive(pattern.div);
    const divOk = meterOk && divsFor(pattern.meter).indexOf(div) >= 0;
    if (isMissing(pattern.meter)) errors.push('Falta el compás. Elegí uno de ' + meters.join(', ') + '.');
    else if (!meterOk) errors.push('Compás inválido: ' + String(pattern.meter) + '. Elegí uno de ' + meters.join(', ') + '.');
    else if (isMissing(pattern.div)) errors.push('Falta la división (pasos por pulso) para ' + pattern.meter + '. Válidas: ' + divsFor(pattern.meter).join(', ') + '.');
    else if (!divOk) errors.push('División inválida para ' + pattern.meter + ': ' + String(pattern.div) + '. Válidas: ' + divsFor(pattern.meter).join(', ') + '.');
    if (!Array.isArray(pattern.steps)) errors.push('steps tiene que ser un array.');
    else {
      if (divOk) {
        const want = lengthFor(pattern.meter, div);
        if (pattern.steps.length !== want) errors.push('steps tiene ' + pattern.steps.length + ' pasos y ' + pattern.meter + ' con div ' + div + ' pide ' + want + '.');
      }
      pattern.steps.forEach((code, i) => {
        if (typeof code !== 'string') { errors.push('El paso ' + (i + 1) + ' tiene que ser un string.'); return; }
        const seen = new Set();
        for (const ch of code) {
          if (ALPHABET.indexOf(ch) < 0) errors.push('Código desconocido "' + ch + '" en el paso ' + (i + 1) + '.');
          else if (seen.has(ch)) errors.push('Letra repetida "' + ch + '" en el paso ' + (i + 1) + '.');
          seen.add(ch);
        }
      });
      if (!pattern.steps.some(sounds)) errors.push('El patrón está vacío: poné al menos un paso que suene.');
    }
    return { ok: errors.length === 0, errors };
  }

  // Un patrón vacío para empezar a editar. div acepta string numérico.
  function blank(meter, div) {
    meter = meters.indexOf(meter) >= 0 ? meter : '4/4';
    div = positive(div);
    div = divsFor(meter).indexOf(div) >= 0 ? div : divsFor(meter)[0];
    return { id: 'propio', name: 'Patrón propio', desc: 'Tu patrón, armado en el editor.', group: 'Otros', meter, div,
      steps: Array.from({ length: lengthFor(meter, div) }, () => '') };
  }

  /* ------------------------------------------------------------ Congelar */
  // Los datos del módulo son de sólo lectura: el editor trabaja sobre
  // clone(). slice() de un array congelado devuelve una copia mutable, así
  // que applyFill/resize/normalize siguen funcionando igual.
  patterns.forEach((p) => { Object.freeze(p.steps); Object.freeze(p); });
  Object.freeze(patterns); Object.freeze(byId);
  fills.forEach((f) => { Object.keys(f.byDiv).forEach((d) => Object.freeze(f.byDiv[d])); Object.freeze(f.byDiv); Object.freeze(f); });
  Object.freeze(fills); Object.freeze(fillById);
  endings.forEach((e) => { Object.freeze(e.steps); Object.freeze(e); });
  Object.freeze(endings); Object.freeze(endingById);
  rows.forEach((r) => Object.freeze(r));
  Object.freeze(rows); Object.freeze(meters); Object.freeze(groups);

  return {
    meters, groups, patterns, byId, fills, fillById, endings, endingById, rows,
    ALPHABET, CANON, MAX_STEPS,
    beatsPerBar, divsFor, lengthFor, countIn, clickFor, stepSeconds,
    clone, patternsByGroup, applyFill, suggestedEnding,
    toGrid, fromGrid, canon, normalize, usesOnlyRowCodes, resize, validate, blank
  };
})();
if (typeof module !== 'undefined') module.exports = Ritmos;
