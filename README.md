# Coach Board

Pizarra de rotaciones de voleibol para entrenadores. Pegás la lista de
jugadores, arrastrás seis a la cancha para armar la formación inicial y la app
dibuja las seis rotaciones como tarjetas. Las listas y sus formaciones se
guardan en el navegador para volver a abrirlas.

Estética de pantalla E-Ink: alto contraste, tipografía monoespaciada y cero
animaciones.

## Uso

Abrí `index.html` en el navegador (doble clic). No hace falta instalar nada: no
hay build, ni npm, ni servidor.

1. Pegá o escribí la lista, un nombre por línea (ver `data/team.txt`).
2. **Generar jugadores**: cada jugador es una ficha con su nombre truncado a 4
   letras. Las etiquetas se pueden editar a mano.
3. Llevá seis fichas a la cancha arrastrando, o tocando la ficha y después la
   posición (funciona en tablet).
4. **Generar rotaciones**.

Todo se guarda en el `localStorage` del navegador; nada sale de tu equipo.

> Algunos navegadores no cargan fuentes desde `file://`. Si la tipografía no se
> ve como Fira Mono, serví la carpeta con `python3 -m http.server`.

## Tests

```
node test/logic.test.js     # sin dependencias
npm install && npm test     # incluye el flujo completo en jsdom
```

`package.json` existe solo para los tests; la app no usa npm.

## Créditos

- [Fira Mono](https://github.com/mozilla/Fira) — SIL Open Font License 1.1
  (`assets/fira/OFL.txt`).
- Textura de fondo (`assets/groovepaper.png`) descargada de
  [Transparent Textures](https://www.transparenttextures.com/).

Los nombres de `data/team.txt` y de los tests son ficticios.

## Licencia

[MIT](LICENSE)
