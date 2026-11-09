# Tablero Armónico

App web de una sola página para tocar acordes con un sintetizador y acompañar canciones acústicas en vivo, desde el celular o la compu. Sin dependencias, sin instalación: un solo archivo `index.html`.

## Qué hace

- **Pads por función armónica.** Elegís tonalidad y modo; aparecen los siete acordes de la escala (tónica en verde, subdominante en ámbar, dominante en rojo) más cinco acordes prestados y dominantes secundarias. Modificadores 7, sus4, sus2, add9 y mayor↔menor. Conducción de voces para que los cambios suenen ligados.
- **Cancionero.** Pegás la letra con los acordes arriba (como en los sitios de acordes) o en formato `[C]ChordPro`. Reconoce cifrado americano y latino (también en mayúsculas), deduce la tonalidad, arma pads con los acordes de la canción y muestra la letra con cada acorde como botón. El botón **Siguiente** (o las flechas, o un pedal Bluetooth con AvPág/RePág) recorre la vuelta. Transportar de a un semitono. Canciones guardadas en el dispositivo.
- **Ritmo.** 25 patrones (pop, balada, arpegios, fingerpicking, vals, chacarera, zamba, chamamé, cueca, bossa nova, reggae, cumbia, huayno, milonga, bolero, vals criollo, country, polca, ska…), rellenos de fin de compás, finales, metrónomo con cuenta de entrada, tap tempo y un editor de patrones propios sobre una grilla.
- **Visual.** Fondo que toma el color de la función del acorde y sigue el volumen, osciloscopio, chispas desde las teclas, pulso de compás y modo escenario. Tema claro y oscuro; respeta «reducir movimiento».

## Uso

Abrí `index.html` en el navegador, o publicalo en cualquier hosting estático (GitHub Pages sirve). El sonido se enciende con el primer toque; en iPhone, desactivá el modo silencio.

Teclado: `A`–`J` acordes de la tonalidad, `Z`–`B` prestados, `1`–`0` acordes de la canción, `Q W E R T` modificadores, `→`/`←` siguiente y anterior, `N` relleno, `M` final, `Espacio` silencia.

## Estructura

```
index.html              archivo final, generado (no editar a mano)
src/app.template.html   interfaz y lógica de la app
src/mod/parser.js       ChordSheet: símbolos, letra con acordes, tonalidad, transposición
src/mod/ritmos.js       Ritmos: patrones, rellenos, finales, metrónomo, grilla del editor
src/mod/visuals.js      Visuals: fondo reactivo, osciloscopio, chispas, ripple, pulso
src/mod/visuals.css     estilos de los efectos
src/mod/*.test.js       pruebas de cada módulo (Node, sin dependencias)
src/mod/*.break.js      entradas adversarias
src/build.js            arma index.html a partir de la plantilla y los módulos
src/smoke.js            prueba de la app completa en Chromium (requiere Playwright)
```

## Desarrollo

```sh
node src/mod/parser.test.js
node src/mod/ritmos.test.js
node src/build.js          # regenera index.html
node src/smoke.js          # opcional, con Playwright instalado
```

Los módulos son JavaScript puro sin `import`/`export`; cada uno define un objeto global y se pega inline en el HTML al construir.
