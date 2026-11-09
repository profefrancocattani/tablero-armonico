/* ============================================================================
   Visuals — efectos visuales para Tablero Armónico.

   Objeto global sin dependencias. Un solo bucle de requestAnimationFrame que
   se detiene solo cuando no hay nada que animar (sin sonido, sin partículas,
   sin crossfade de color pendiente). Pausa con document.hidden.

   Qué dibuja
     1. Fondo reactivo (<canvas id="bgfx">, fijo detrás de .app): aurora lenta
        del color de la función armónica actual; su intensidad sigue el RMS del
        AnalyserNode. Visuals.hit(x,y) lanza una onda circular desde ese punto.
     2. Osciloscopio (<canvas id="oscfx"> dentro de .readout, debajo de
        #chordNotes): forma de onda del analyser en el color actual.
     3. Chispas (<canvas id="kbfx"> dentro de .kbwrap, sobre .kb): partículas
        que suben desde las teclas encendidas.
     4. Ripple en pads (custom props --rx --ry --rd + .pad::after animado) y
        animación de cambio de nombre en #chordName.
     5. Pulso de compás: flash en el borde de .screen (.vfx-beat / .vfx-down)
        y pulso de escala en el .dot.lit activo (.vfx-pulse).
     6. Modo escenario: body.stage (sólo CSS).

   Con reduced=true: fondo estático en el color actual, sin chispas ni ondas,
   ripple sin escala, sin pulso en los puntos; el osciloscopio sigue vivo.

   API
     Visuals.init({ getAnalyser, colorFor, reduced })  idempotente
     Visuals.setFunction(fn|null)   'T' | 'S' | 'D' | 'B' | null
     Visuals.setActive(bool)
     Visuals.hit(clientX, clientY)
     Visuals.sparks(keyEls, color?)
     Visuals.ripple(el, clientX, clientY)
     Visuals.chordName(el)
     Visuals.beat(isDownbeat)
     Visuals.resize()
     Visuals.css                     texto CSS (igual a visuals.css)
   ============================================================================ */
const Visuals = (() => {
  'use strict';

  /* ---------------------------------------------------------------- CSS */
  // Se inserta solo si el HTML no incluye ya visuals.css (sentinela --vfx-css).
  const CSS = `/* visuals.css — efectos visuales de Tablero Armónico (generado desde visuals.js) */
:root{--vfx-css:1}

/* Fondo reactivo detrás de toda la página */
.vfx-bg{position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;display:block}
.app{position:relative;z-index:1}

/* Osciloscopio en la pantalla, debajo de las notas */
.vfx-osc{display:block;width:100%;height:44px;margin-top:10px;pointer-events:none}

/* Chispas sobre el teclado: viaja con el scroll horizontal de .kbwrap */
.kbwrap{position:relative}
.vfx-kb{position:absolute;left:0;top:0;z-index:2;pointer-events:none;display:block}

/* Ripple en pads */
.pad{overflow:hidden}
.pad::after{content:"";position:absolute;left:var(--rx,50%);top:var(--ry,50%);
  width:var(--rd,240px);height:var(--rd,240px);margin-left:calc(var(--rd,240px) / -2);margin-top:calc(var(--rd,240px) / -2);
  border-radius:50%;background:color-mix(in oklab,#fff 62%,var(--fn));opacity:0;transform:scale(0);pointer-events:none}
.pad.vfx-rip::after{animation:vfx-ripple .6s cubic-bezier(.2,.7,.2,1) forwards}
@keyframes vfx-ripple{0%{opacity:.6;transform:scale(0)}100%{opacity:0;transform:scale(1)}}

/* Pulso de compás en el borde de la pantalla */
.screen.vfx-beat{animation:vfx-flash .34s ease-out}
.screen.vfx-down{animation:vfx-flash-down .5s ease-out}
@keyframes vfx-flash{
  0%{box-shadow:0 0 0 1px var(--cur),0 0 18px color-mix(in oklab,var(--cur) 55%,transparent)}
  100%{box-shadow:0 0 0 0 transparent,0 0 0 transparent}}
@keyframes vfx-flash-down{
  0%{box-shadow:0 0 0 3px var(--cur),0 0 42px color-mix(in oklab,var(--cur) 80%,transparent)}
  100%{box-shadow:0 0 0 0 transparent,0 0 0 transparent}}
.dot.lit.vfx-pulse{animation:vfx-dot .3s ease-out}
@keyframes vfx-dot{0%{transform:scale(2.1)}100%{transform:scale(1)}}

/* Modo escenario: todo atenuado salvo pantalla y pads */
body.stage .top,body.stage .sechead,body.stage .play,body.stage .help{opacity:.28;filter:saturate(.4);transition:opacity .4s,filter .4s}
body.stage .mods{opacity:.5;transition:opacity .4s}
body.stage .top:hover,body.stage .top:focus-within,body.stage .play:hover,body.stage .play:focus-within,
body.stage .mods:hover,body.stage .mods:focus-within,body.stage .help:hover{opacity:1;filter:none}
body.stage .screen{box-shadow:0 0 0 1px color-mix(in oklab,var(--cur) 40%,transparent),0 0 36px color-mix(in oklab,var(--cur) 22%,transparent)}

/* Movimiento reducido: ripple sin escala, puntos sin pulso */
.vfx-reduced .pad.vfx-rip::after{animation:vfx-ripple-flat .22s ease-out forwards}
.vfx-reduced .dot.lit.vfx-pulse{animation:none}
@keyframes vfx-ripple-flat{0%{opacity:.35;transform:scale(1)}100%{opacity:0;transform:scale(1)}}
@media (prefers-reduced-motion: reduce){
  .pad.vfx-rip::after{animation:vfx-ripple-flat .22s ease-out forwards}
  .dot.lit.vfx-pulse{animation:none}
}
`;

  /* ---------------------------------------------------------------- Base */
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const MAX_SPARKS = 160, MAX_WAVES = 8;
  // Manchas de la aurora: centro base, amplitud de vaivén, frecuencias (rad/s), fase, tamaño, peso
  const BLOBS = [
    { bx: .22, by: .22, ax: .16, ay: .12, fx: .11, fy: .09, ph: 0.0, sz: .62, k: .9 },
    { bx: .80, by: .30, ax: .14, ay: .16, fx: .08, fy: .12, ph: 2.1, sz: .55, k: .8 },
    { bx: .50, by: .82, ax: .20, ay: .10, fx: .07, fy: .10, ph: 4.0, sz: .70, k: .7 },
    { bx: .12, by: .85, ax: .12, ay: .14, fx: .13, fy: .07, ph: 1.2, sz: .48, k: .6 }
  ];

  const st = {
    inited: false,
    cfg: { getAnalyser: null, colorFor: null, reduced: false },
    dark: true, dpr: 1,
    bg: { el: null, ctx: null, cssW: 1, cssH: 1, s: 1 },
    osc: { el: null, ctx: null, cssW: 1, cssH: 44, s: 1 },
    kb: { el: null, ctx: null, kbEl: null, wrap: null, cssW: 1, cssH: 1, s: 1 },
    screen: null, probe: null, pix: null, sprite: null,
    fn: null, hasColor: false,
    col: { r: 236, g: 235, b: 230 }, from: { r: 0, g: 0, b: 0 }, to: { r: 236, g: 235, b: 230 },
    neutral: { r: 236, g: 235, b: 230 }, lerp: 1,
    colStr: 'rgb(236,235,230)', sparkStr: 'rgb(255,255,255)', colKey: '',
    an: null, buf: null, bbuf: null, haveBuf: false,
    rms: 0, kick: 0, active: false,
    raf: 0, last: 0, t: 0, bgDirty: true,
    waves: [], nWaves: 0, sparks: [], nSparks: 0, sparkCursor: 0,
    rects: null, scrollT: 0, lastDot: null, nameAnim: null
  };
  for (let i = 0; i < MAX_WAVES; i++) st.waves.push({ alive: false, x: 0, y: 0, age: 0, life: 1, rmax: 100 });
  for (let i = 0; i < MAX_SPARKS; i++) st.sparks.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, g: 0, age: 0, life: 1, sz: 1, col: '' });

  /* ------------------------------------------------------------- Colores */
  function parseColor(str) {
    if (!str || !st.probe) return null;
    const p = st.probe;
    p.style.color = '';
    p.style.color = String(str).trim();
    if (!p.style.color) return null;
    const cs = getComputedStyle(p).color;
    const m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(cs);
    if (m) return { r: +m[1], g: +m[2], b: +m[3] };
    try {
      const px = st.pix;
      px.clearRect(0, 0, 1, 1); px.fillStyle = '#000'; px.fillStyle = cs; px.fillRect(0, 0, 1, 1);
      const d = px.getImageData(0, 0, 1, 1).data;
      if (!d[3]) return null;
      return { r: d[0], g: d[1], b: d[2] };
    } catch (e) { return null; }
  }
  const lum = (c) => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
  function tintStr(c) {
    // Chispas: el teclado vive dentro de .screen, que es oscuro en los dos temas,
    // así que siempre se aclaran hacia blanco para despegarse de las teclas encendidas
    const t = .5;
    const r = Math.round(c.r + (255 - c.r) * t), g = Math.round(c.g + (255 - c.g) * t), b = Math.round(c.b + (255 - c.b) * t);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  function updateColStr() {
    const r = Math.round(st.col.r), g = Math.round(st.col.g), b = Math.round(st.col.b);
    const key = r + ',' + g + ',' + b;
    if (key === st.colKey) return;
    st.colKey = key;
    st.colStr = 'rgb(' + key + ')';
    st.sparkStr = tintStr({ r, g, b });
  }
  function readTheme() {
    const bg = parseColor('var(--bg)');
    st.dark = bg ? lum(bg) < .5 : true;
    let n = null;
    try { n = parseColor(st.cfg.colorFor ? st.cfg.colorFor(null) : null); } catch (e) { n = null; }
    if (!n) n = parseColor('var(--screen-fg)') || parseColor('var(--fg)') || { r: 236, g: 235, b: 230 };
    st.neutral = n;
  }
  function retarget(instant) {
    let c = null;
    try { c = parseColor(st.cfg.colorFor ? st.cfg.colorFor(st.fn) : null); } catch (e) { c = null; }
    if (!c) c = st.neutral;
    st.to.r = c.r; st.to.g = c.g; st.to.b = c.b;
    if (instant || st.cfg.reduced || !st.hasColor) {
      st.col.r = c.r; st.col.g = c.g; st.col.b = c.b; st.lerp = 1; st.hasColor = true;
    } else {
      st.from.r = st.col.r; st.from.g = st.col.g; st.from.b = st.col.b; st.lerp = 0;
    }
    updateColStr();
    st.bgDirty = true;
    start();
  }
  function stepColor(dt) {
    if (st.lerp >= 1) return;
    st.lerp = Math.min(1, st.lerp + dt / .55);
    const e = st.lerp * st.lerp * (3 - 2 * st.lerp);
    st.col.r = st.from.r + (st.to.r - st.from.r) * e;
    st.col.g = st.from.g + (st.to.g - st.from.g) * e;
    st.col.b = st.from.b + (st.to.b - st.from.b) * e;
    updateColStr();
  }

  /* ------------------------------------------------------------- Audio */
  function sample(dt) {
    let an = null;
    try { an = st.cfg.getAnalyser ? st.cfg.getAnalyser() : null; } catch (e) { an = null; }
    st.an = an;
    let raw = 0;
    st.haveBuf = false;
    if (an && an.fftSize) {
      try {
        const n = an.fftSize;
        if (!st.buf || st.buf.length !== n) { st.buf = new Float32Array(n); st.bbuf = null; }
        if (an.getFloatTimeDomainData) an.getFloatTimeDomainData(st.buf);
        else {
          if (!st.bbuf || st.bbuf.length !== n) st.bbuf = new Uint8Array(n);
          an.getByteTimeDomainData(st.bbuf);
          for (let i = 0; i < n; i++) st.buf[i] = (st.bbuf[i] - 128) / 128;
        }
        let s = 0;
        for (let i = 0; i < n; i++) { const v = st.buf[i]; s += v * v; }
        raw = Math.sqrt(s / n);
        if (raw !== raw) raw = 0;
        st.haveBuf = true;
      } catch (e) { raw = 0; st.haveBuf = false; }
    }
    const tau = raw > st.rms ? .035 : .22;
    st.rms += (raw - st.rms) * (1 - Math.exp(-dt / tau));
    if (st.rms < 1e-4) st.rms = 0;
  }

  /* ------------------------------------------------------------- Dibujo */
  function makeSprite() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(.3, 'rgba(255,255,255,.6)');
    g.addColorStop(.65, 'rgba(255,255,255,.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    st.sprite = c;
  }

  function drawBg(dt, animated) {
    const b = st.bg, c = b.ctx;
    if (!c) return;
    const W = b.cssW, H = b.cssH, t = animated ? st.t : 0;
    c.setTransform(b.s, 0, 0, b.s, 0, 0);
    c.clearRect(0, 0, W, H);
    const level = animated ? clamp(st.rms * 3.2, 0, 1) : 0;
    const kick = animated ? st.kick : 0;
    const base = st.dark ? .22 : .13, gain = st.dark ? .40 : .17, cap = st.dark ? .72 : .36;
    const alpha = Math.min(cap, base + level * gain + kick * (st.dark ? .22 : .10)) * (st.fn ? 1 : .55);
    const R = Math.max(W, H) * .5;
    c.globalCompositeOperation = 'source-over';
    for (let i = 0; i < BLOBS.length; i++) {
      const o = BLOBS[i];
      const x = W * (o.bx + o.ax * Math.sin(t * o.fx + o.ph));
      const y = H * (o.by + o.ay * Math.cos(t * o.fy + o.ph * 1.3));
      const r = R * (o.sz + .08 * Math.sin(t * .6 + i)) * (1 + level * .22 + kick * .1);
      c.globalAlpha = alpha * o.k;
      c.drawImage(st.sprite, x - r, y - r, r * 2, r * 2);
    }
    // Destello en el punto de cada onda
    if (animated && st.nWaves) {
      for (let i = 0; i < MAX_WAVES; i++) {
        const w = st.waves[i]; if (!w.alive) continue;
        const p = w.age / w.life, rr = 90 + 260 * p;
        c.globalAlpha = (1 - p) * (1 - p) * (st.dark ? .55 : .35);
        c.drawImage(st.sprite, w.x - rr, w.y - rr, rr * 2, rr * 2);
      }
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = st.colStr; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'source-over';
    // Anillos
    if (animated && st.nWaves) {
      c.strokeStyle = st.colStr; c.lineCap = 'round';
      for (let i = 0; i < MAX_WAVES; i++) {
        const w = st.waves[i]; if (!w.alive) continue;
        w.age += dt;
        if (w.age >= w.life) { w.alive = false; st.nWaves--; continue; }
        const p = w.age / w.life, e = 1 - (1 - p) * (1 - p);
        const r = 8 + (w.rmax - 8) * e;
        c.globalAlpha = Math.pow(1 - p, 1.4) * (st.dark ? .85 : .6);
        c.lineWidth = 1.5 + 7 * (1 - p);
        c.beginPath(); c.arc(w.x, w.y, r, 0, TAU); c.stroke();
      }
      c.globalAlpha = 1;
    }
    st.bgDirty = false;
  }

  function drawOsc() {
    const o = st.osc, c = o.ctx;
    if (!c) return;
    const W = o.cssW, H = o.cssH, mid = H / 2;
    c.setTransform(o.s, 0, 0, o.s, 0, 0);
    c.clearRect(0, 0, W, H);
    c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = st.colStr;
    if (!st.haveBuf || st.rms < .0015) {
      c.globalAlpha = .35; c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, mid + .5); c.lineTo(W, mid + .5); c.stroke();
      c.globalAlpha = 1;
      return;
    }
    const buf = st.buf, n = buf.length;
    // Disparo en un cruce por cero ascendente dentro del primer tercio, para que la onda no "corra"
    let start0 = 0;
    const lim = Math.floor(n / 3);
    for (let i = 1; i < lim; i++) { if (buf[i - 1] < 0 && buf[i] >= 0) { start0 = i; break; } }
    const span = n - lim, amp = H / 2 - 2, gain = 1.8;
    c.beginPath();
    for (let px = 0; px <= W; px++) {
      const v = clamp(buf[start0 + Math.floor(px / W * (span - 1))] * gain, -1, 1);
      const y = mid - v * amp;
      if (px === 0) c.moveTo(0, y); else c.lineTo(px, y);
    }
    c.globalAlpha = .22; c.lineWidth = 5; c.stroke();
    c.globalAlpha = 1; c.lineWidth = 1.5; c.stroke();
  }

  function drawKb(dt) {
    const k = st.kb, c = k.ctx;
    if (!c) return;
    c.setTransform(k.s, 0, 0, k.s, 0, 0);
    c.clearRect(0, 0, k.cssW, k.cssH);
    if (!st.nSparks) return;
    for (let i = 0; i < MAX_SPARKS; i++) {
      const p = st.sparks[i]; if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.life) { p.alive = false; st.nSparks--; continue; }
      p.vy += p.g * dt; p.vx *= 1 - 1.6 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const t = p.age / p.life, a = t < .12 ? t / .12 : 1 - (t - .12) / .88;
      c.fillStyle = p.col;
      c.globalAlpha = a * .3;
      c.beginPath(); c.arc(p.x, p.y, p.sz * 2.4, 0, TAU); c.fill();
      c.globalAlpha = a;
      c.beginPath(); c.arc(p.x, p.y, p.sz, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
  }

  /* -------------------------------------------------------------- Bucle */
  function keepGoing() {
    return st.active || st.nSparks > 0 || st.nWaves > 0 || st.rms > .0015 || st.lerp < 1 || st.kick > .01 || st.bgDirty;
  }
  function frame(now) {
    st.raf = 0;
    const dt = st.last ? Math.min(.05, (now - st.last) / 1000) : 1 / 60;
    st.last = now; st.t += dt;
    sample(dt);
    stepColor(dt);
    if (st.kick > 0) st.kick = Math.max(0, st.kick - dt * 2.2);
    if (!st.cfg.reduced) drawBg(dt, true);
    else if (st.bgDirty) drawBg(dt, false);
    drawOsc();
    drawKb(dt);
    if (keepGoing()) st.raf = requestAnimationFrame(frame);
    else st.last = 0;
  }
  function start() {
    if (!st.inited || st.raf) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    st.last = 0;
    st.raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (st.raf) cancelAnimationFrame(st.raf);
    st.raf = 0; st.last = 0;
  }

  /* ------------------------------------------------------- Rects y DOM */
  function rectOf(el) {
    if (!st.rects) st.rects = new WeakMap();
    let r = st.rects.get(el);
    if (!r) { r = el.getBoundingClientRect(); st.rects.set(el, r); }
    return r;
  }
  function onScroll() {
    if (st.scrollT) return;
    st.scrollT = setTimeout(() => { st.scrollT = 0; st.rects = null; }, 120);
  }
  function onVis() { if (document.hidden) stop(); else start(); }
  function onTheme() { readTheme(); retarget(false); }
  function onResize() {
    resize();
    setTimeout(resize, 300); // tras orientationchange el layout tarda en asentarse
  }
  function onAnimEnd(e) {
    const n = e.animationName, el = e.target;
    if (!el || !el.classList) return;
    if (n === 'vfx-dot') el.classList.remove('vfx-pulse');
    else if (n === 'vfx-ripple' || n === 'vfx-ripple-flat') el.classList.remove('vfx-rip');
    else if (n === 'vfx-flash' || n === 'vfx-flash-down') el.classList.remove('vfx-beat', 'vfx-down');
  }
  function mkCanvas(id, cls) {
    let c = document.getElementById(id);
    if (!c || c.tagName !== 'CANVAS') { c = document.createElement('canvas'); c.id = id; }
    c.className = cls; c.setAttribute('aria-hidden', 'true');
    return c;
  }
  function ensureCSS() {
    if (document.getElementById('vfx-style')) return;
    if (getComputedStyle(document.documentElement).getPropertyValue('--vfx-css').trim() === '1') return;
    const s = document.createElement('style'); s.id = 'vfx-style'; s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ----------------------------------------------------------------- API */
  function init(opts) {
    opts = opts || {};
    if (typeof opts.getAnalyser === 'function') st.cfg.getAnalyser = opts.getAnalyser;
    if (typeof opts.colorFor === 'function') st.cfg.colorFor = opts.colorFor;
    if (typeof opts.reduced === 'boolean') st.cfg.reduced = opts.reduced;
    else if (!st.inited) st.cfg.reduced = !!(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (typeof document === 'undefined') return api;
    if (!document.body) { document.addEventListener('DOMContentLoaded', () => init({}), { once: true }); return api; }

    ensureCSS();
    document.documentElement.classList.toggle('vfx-reduced', st.cfg.reduced);
    if (!st.probe || !st.probe.isConnected) {
      const p = document.createElement('span'); p.id = 'vfx-probe'; p.setAttribute('aria-hidden', 'true');
      p.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none';
      document.body.appendChild(p); st.probe = p;
    }
    if (!st.pix) { const c = document.createElement('canvas'); c.width = c.height = 1; st.pix = c.getContext('2d', { willReadFrequently: true }) || c.getContext('2d'); }
    if (!st.sprite) makeSprite();

    if (!st.bg.el || !st.bg.el.isConnected) {
      const c = mkCanvas('bgfx', 'vfx-bg');
      document.body.insertBefore(c, document.body.firstChild);
      st.bg.el = c; st.bg.ctx = c.getContext('2d');
    }
    if (!st.osc.el || !st.osc.el.isConnected) {
      const notes = document.getElementById('chordNotes');
      const ro = notes ? notes.parentNode : document.querySelector('.readout');
      if (ro) {
        const c = mkCanvas('oscfx', 'vfx-osc');
        if (notes) ro.insertBefore(c, notes.nextSibling); else ro.appendChild(c);
        st.osc.el = c; st.osc.ctx = c.getContext('2d');
        if (typeof ResizeObserver === 'function' && !st.ro) { st.ro = new ResizeObserver(() => resize()); st.ro.observe(c); }
      }
    }
    if (!st.kb.el || !st.kb.el.isConnected) {
      const wrap = document.getElementById('kbwrap') || document.querySelector('.kbwrap');
      const kbEl = document.getElementById('kb') || (wrap && wrap.querySelector('.kb'));
      if (wrap && kbEl) {
        const c = mkCanvas('kbfx', 'vfx-kb');
        wrap.appendChild(c);
        st.kb.el = c; st.kb.ctx = c.getContext('2d'); st.kb.wrap = wrap; st.kb.kbEl = kbEl;
      }
    }
    st.screen = document.getElementById('screen') || document.querySelector('.screen');

    if (!st.inited) {
      window.addEventListener('resize', onResize);
      window.addEventListener('orientationchange', onResize);
      window.addEventListener('scroll', onScroll, { passive: true });
      document.addEventListener('visibilitychange', onVis);
      document.addEventListener('animationend', onAnimEnd);
      if (typeof matchMedia === 'function') {
        const mq = matchMedia('(prefers-color-scheme: dark)');
        if (mq.addEventListener) mq.addEventListener('change', onTheme);
        else if (mq.addListener) mq.addListener(onTheme);
      }
      if (typeof MutationObserver === 'function') {
        new MutationObserver(onTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      }
    }
    st.inited = true;
    readTheme();
    retarget(true);
    resize();
    return api;
  }

  function setFunction(fn) {
    st.fn = (fn === 'T' || fn === 'S' || fn === 'D' || fn === 'B') ? fn : null;
    if (st.inited) retarget(false);
  }

  function setActive(b) {
    st.active = !!b;
    if (st.active) start();
  }

  function hit(x, y) {
    if (!st.inited || st.cfg.reduced || !st.bg.ctx) return;
    if (typeof x !== 'number' || typeof y !== 'number' || x !== x || y !== y) return;
    let w = null, oldest = null;
    for (let i = 0; i < MAX_WAVES; i++) {
      const c = st.waves[i];
      if (!c.alive) { w = c; break; }
      if (!oldest || c.age > oldest.age) oldest = c;
    }
    if (w) st.nWaves++; else w = oldest;
    w.alive = true; w.x = x; w.y = y; w.age = 0; w.life = .95;
    w.rmax = Math.max(st.bg.cssW, st.bg.cssH) * .6;
    start();
  }

  function spawnSpark(x, y, col, strong) {
    let p = null;
    for (let n = 0; n < MAX_SPARKS; n++) {
      const c = st.sparks[st.sparkCursor]; st.sparkCursor = (st.sparkCursor + 1) % MAX_SPARKS;
      if (!c.alive) { p = c; break; }
    }
    if (!p) return;
    p.alive = true; st.nSparks++;
    p.x = x; p.y = y;
    p.vx = (Math.random() - .5) * 26;
    p.vy = -(55 + Math.random() * 50) * (strong ? 1.15 : 1);
    p.g = 28;
    p.age = 0; p.life = .55 + Math.random() * .45;
    p.sz = (strong ? 1.6 : 1.2) + Math.random() * 1.3;
    p.col = col;
  }
  function sparks(keyEls, color) {
    if (!st.inited || st.cfg.reduced || !st.kb.ctx || !keyEls) return;
    const n = keyEls.length; if (!n) return;
    let col = st.sparkStr;
    if (color) { const c = parseColor(color); if (c) col = tintStr(c); }
    const per = n > 8 ? 2 : n > 4 ? 3 : 4;
    for (let i = 0; i < n; i++) {
      const el = keyEls[i];
      if (!el || !el.offsetWidth) continue;
      const x0 = el.offsetLeft, w = el.offsetWidth, h = el.offsetHeight, y0 = el.offsetTop;
      const strong = !!(el.classList && el.classList.contains('bass'));
      for (let j = 0; j < per; j++) spawnSpark(x0 + 2 + Math.random() * Math.max(1, w - 4), y0 + h * (.5 + Math.random() * .4), col, strong);
    }
    start();
  }

  function ripple(el, x, y) {
    if (!st.inited || !el || !el.style || !el.classList) return;
    const r = rectOf(el);
    const lx = typeof x === 'number' ? x - r.left : r.width / 2;
    const ly = typeof y === 'number' ? y - r.top : r.height / 2;
    const d = Math.ceil(Math.hypot(Math.max(lx, r.width - lx), Math.max(ly, r.height - ly)) * 2) + 6;
    el.style.setProperty('--rx', lx.toFixed(1) + 'px');
    el.style.setProperty('--ry', ly.toFixed(1) + 'px');
    el.style.setProperty('--rd', d + 'px');
    el.classList.remove('vfx-rip');
    void el.offsetWidth;
    el.classList.add('vfx-rip');
  }

  function chordName(el) {
    if (!el || typeof el.animate !== 'function') return;
    if (st.nameAnim) { try { st.nameAnim.cancel(); } catch (e) {} }
    const frames = st.cfg.reduced
      ? [{ opacity: .35 }, { opacity: 1 }]
      : [{ opacity: .08, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }];
    try {
      st.nameAnim = el.animate(frames, { duration: st.cfg.reduced ? 160 : 280, easing: 'cubic-bezier(.2,.7,.2,1)' });
    } catch (e) { st.nameAnim = null; }
  }

  function beat(down) {
    if (!st.inited) return;
    if (!st.screen || !st.screen.isConnected) st.screen = document.getElementById('screen') || document.querySelector('.screen');
    const sc = st.screen;
    if (sc) {
      sc.classList.remove('vfx-beat', 'vfx-down');
      void sc.offsetWidth;
      sc.classList.add(down ? 'vfx-down' : 'vfx-beat');
    }
    if (st.cfg.reduced) return;
    const d = document.querySelector('.dot.lit');
    if (st.lastDot && st.lastDot !== d) st.lastDot.classList.remove('vfx-pulse');
    if (d) { d.classList.remove('vfx-pulse'); void d.offsetWidth; d.classList.add('vfx-pulse'); st.lastDot = d; }
    st.kick = Math.max(st.kick, down ? .6 : .3);
    start();
  }

  function resize() {
    if (!st.inited) return;
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2); st.dpr = dpr;
    const b = st.bg;
    if (b.el) {
      b.cssW = Math.max(1, window.innerWidth); b.cssH = Math.max(1, window.innerHeight);
      b.s = dpr * .5; // el fondo se dibuja a media resolución y se escala
      b.el.width = Math.max(1, Math.round(b.cssW * b.s)); b.el.height = Math.max(1, Math.round(b.cssH * b.s));
    }
    const o = st.osc;
    if (o.el) {
      o.cssW = o.el.clientWidth || o.cssW || 1; o.cssH = o.el.clientHeight || 44; o.s = dpr;
      const w = Math.max(1, Math.round(o.cssW * dpr)), h = Math.max(1, Math.round(o.cssH * dpr));
      if (o.el.width !== w) o.el.width = w;
      if (o.el.height !== h) o.el.height = h;
    }
    const k = st.kb;
    if (k.el && k.kbEl) {
      k.cssW = k.kbEl.offsetWidth || 1; k.cssH = k.kbEl.offsetHeight || 1; k.s = dpr;
      k.el.style.width = k.cssW + 'px'; k.el.style.height = k.cssH + 'px';
      k.el.width = Math.max(1, Math.round(k.cssW * dpr)); k.el.height = Math.max(1, Math.round(k.cssH * dpr));
    }
    st.rects = null;
    st.bgDirty = true;
    start();
  }

  const api = { init, setFunction, setActive, hit, sparks, ripple, chordName, beat, resize, css: CSS };
  return api;
})();
if (typeof module !== 'undefined') module.exports = Visuals;
