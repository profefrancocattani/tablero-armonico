// Prueba de humo de la app integrada con Playwright.
const { chromium } = require('playwright');
const path = require('path');
const file = 'file://' + path.join(__dirname, '..', 'index.html');
const shots = path.join(__dirname, '..', '.shots');
require('fs').mkdirSync(shots, { recursive: true });

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const errs = [];
  const problems = [];
  const check = (cond, msg) => { if (!cond) problems.push(msg); };

  async function run(width, scheme, label) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(label + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push(label + ' console: ' + m.text()); });
    await page.goto(file);
    await page.waitForTimeout(700);
    const t = await page.title();
    check(t === 'Tablero Armónico', 'título ' + t);
    // Ejemplo cargado
    const songPads = await page.locator('#songGrid .pad').count();
    check(songPads >= 4, label + ': pads de canción ' + songPads);
    const chips = await page.locator('#lyrics .chip:not(.ghost)').count();
    check(chips > 20, label + ': chips en la letra ' + chips);
    const key = await page.locator('#key').inputValue();
    check(key === '7', label + ': tonalidad detectada G (índice 7), se obtuvo ' + key);
    const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    check(sw[0] <= sw[1], label + ': scroll horizontal ' + sw.join('/'));
    // Tocar un pad
    const pad = page.locator('#diatonic .pad').nth(4);
    await pad.dispatchEvent('pointerdown', { pointerId: 1, clientX: 50, clientY: 50 });
    await page.waitForTimeout(250);
    const name = await page.locator('#chordName').textContent();
    check(name === 'D', label + ': acorde V en Sol es D, se obtuvo ' + name);
    const on = await pad.evaluate(el => el.classList.contains('on'));
    check(on, label + ': pad .on');
    const audio = await page.evaluate(() => !!document.getElementById('bgfx') && !!document.getElementById('oscfx'));
    check(audio, label + ': canvas de visuals');
    await page.screenshot({ path: path.join(shots, `${label}-pad.png`), fullPage: false });
    await pad.dispatchEvent('pointerup', { pointerId: 1 });
    // Siguiente x3
    await page.click('#nextBtn'); await page.waitForTimeout(120);
    await page.click('#nextBtn'); await page.waitForTimeout(120);
    await page.click('#nextBtn'); await page.waitForTimeout(200);
    const pos = await page.locator('#songPos').textContent();
    check(/^3 \//.test(pos), label + ': posición tras 3 siguientes ' + pos);
    const cur = await page.locator('#lyrics .chip.cur').count();
    check(cur === 1, label + ': chip actual ' + cur);
    const nm3 = await page.locator('#chordName').textContent();
    check(nm3 === 'Em', label + ': tercer acorde del intro es Em, se obtuvo ' + nm3);
    // Modo ritmo + metrónomo + cuenta
    await page.click('#playSeg button[data-v="rhythm"]');
    await page.click('#countTog');
    await page.click('#metroTog');
    await page.selectOption('#pattern', 'chacarera');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(900);
    const cnt = await page.locator('#count').textContent();
    check(/^[1-4]?$/.test(cnt), label + ': cuenta de entrada ' + cnt);
    await page.waitForTimeout(2400);
    const lit = await page.locator('.dot.lit').count();
    check(lit === 1, label + ': punto encendido ' + lit);
    await page.screenshot({ path: path.join(shots, `${label}-ritmo.png`), fullPage: false });
    // Relleno y final
    await page.keyboard.press('n'); await page.waitForTimeout(1500);
    await page.keyboard.press('m'); await page.waitForTimeout(4500);
    const activeAfter = await page.evaluate(() => document.querySelectorAll('.pad.on,.pad.latched').length);
    check(activeAfter === 0, label + ': tras el final no quedan pads activos (' + activeAfter + ')');
    // Transportar
    await page.click('#tpUp'); await page.waitForTimeout(200);
    const first = await page.locator('#songGrid .pad .nm').first().textContent();
    check(first === 'A♭' || first === 'G♯', label + ': transportar +1 desde G da A♭, se obtuvo ' + first);
    await page.click('#tpDown'); await page.waitForTimeout(200);
    // Editor
    await page.click('#editBtn'); await page.waitForTimeout(200);
    const cells = await page.locator('#pgrid .cell').count();
    check(cells > 0, label + ': celdas del editor ' + cells);
    await page.locator('#pgrid .cell').nth(0).click();
    await page.locator('#pgrid .cell').nth(2).click();
    await page.fill('#edName', 'Prueba');
    await page.click('#edSave'); await page.waitForTimeout(200);
    const patVal = await page.locator('#pattern').inputValue();
    check(/^propio-/.test(patVal), label + ': patrón guardado seleccionado ' + patVal);
    await page.click('#edTest'); await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(shots, `${label}-editor.png`), fullPage: false });
    await page.keyboard.press(' ');
    await page.click('#edDelete'); await page.waitForTimeout(100);
    // Pegar una canción en latino
    await page.click('#songSrc summary');
    await page.fill('#songText', 'Zamba del tablero\n\nLAm        REm\nUna zamba de prueba\nMI7              LAm\npara ver si anda bien\n');
    await page.click('#songLoad'); await page.waitForTimeout(300);
    const st = await page.locator('#songStatus').textContent();
    check(/acordes/.test(st), label + ': estado al cargar latino: ' + st);
    const modeMin = await page.locator('#modeSeg button[data-v="min"]').getAttribute('aria-pressed');
    const keyNow = await page.locator('#key').inputValue();
    check(modeMin === 'true' && keyNow === '9', label + ': tonalidad La menor (modo ' + modeMin + ', key ' + keyNow + ')');
    await page.screenshot({ path: path.join(shots, `${label}-latino.png`), fullPage: true });
    // Escenario
    await page.click('#stageBtn');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(shots, `${label}-stage.png`), fullPage: false });
    const sw2 = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    check(sw2[0] <= sw2[1], label + ': scroll horizontal al final ' + sw2.join('/'));
    await ctx.close();
  }

  await run(400, 'dark', '400-dark');
  await run(400, 'light', '400-light');
  await run(1100, 'dark', '1100-dark');
  await run(1100, 'light', '1100-light');
  await browser.close();
  console.log('errores de página:', errs.length ? errs : 'ninguno');
  console.log('problemas:', problems.length ? problems : 'ninguno');
  process.exit(errs.length || problems.length ? 1 : 0);
})();
