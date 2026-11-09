// Arma ../index.html a partir de app.template.html y los módulos de mod/.
// Uso: node src/build.js
const fs = require('fs'), path = require('path');
const dir = __dirname, mod = path.join(dir, 'mod');
let body = fs.readFileSync(path.join(dir, 'app.template.html'), 'utf8');
const parts = {
  '/*MOD:visuals-css*/': fs.readFileSync(path.join(mod, 'visuals.css'), 'utf8'),
  '/*MOD:parser*/': fs.readFileSync(path.join(mod, 'parser.js'), 'utf8'),
  '/*MOD:ritmos*/': fs.readFileSync(path.join(mod, 'ritmos.js'), 'utf8'),
  '/*MOD:visuals*/': fs.readFileSync(path.join(mod, 'visuals.js'), 'utf8'),
};
for (const [k, v] of Object.entries(parts)) {
  if (!body.includes(k)) throw new Error('Falta el marcador ' + k);
  if (/<\/script>/i.test(v)) throw new Error('El módulo de ' + k + ' contiene </script>');
  body = body.replace(k, () => v);
}
body = body.replace(/<meta name="claude:viewport-fit-sides"[^>]*>\n?/, '');
const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Tablero Armónico: acordes de cada tonalidad en pads con sonido de sintetizador, cancionero con letra y acordes, ritmos latinoamericanos y editor de patrones.">
<style>html{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
${body}
</body>
</html>
`;
const out = path.join(dir, '..', 'index.html');
fs.writeFileSync(out, html);
console.log('OK', out, (html.length / 1024).toFixed(0) + ' KB');
