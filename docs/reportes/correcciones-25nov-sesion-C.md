# Correcciones del 25 de noviembre · sesión C

Alex jugó en el celular: los paneles de los ejercicios tapaban las máquinas y en las salas 2 a 5 ocupaban más de una pantalla; en la sala 4 el texto «sale» no se entendía; y faltaba el logo de Sinapsis. Esta sesión hizo los tres puntos en dos PR:

- **PR #188** (`correcciones-c-paneles-franja`, fusionado): paneles en franja (punto 1) y carritos con «−» y «+» (punto 2). Van juntos porque los dos rehacen los mismos paneles.
- **PR 2** (`correcciones-c-logo-sinapsis`): logo de Sinapsis (punto 3) y este reporte con las capturas.

## Resultado

| Punto | Antes | Ahora |
| --- | --- | --- |
| 1 · Paneles | El panel tapaba el 98 % del ancho y se desplazaba de 63 a 452 px en 740×360 | Columna a la derecha del 35 % del ancho, sin desplazarse en las cinco salas, tampoco al volver con la respuesta |
| 2 · Sala 4 | Dos toques: elegir de dónde «sale» el libro y luego a dónde va | Cada carrito tiene «+» (pone un libro de la pila) y «−» (lo devuelve). Un toque, un libro |
| 3 · Logo | No estaba | Portada (pequeño, al pie: «Un proyecto de»), pantalla de carga y final de los créditos |

Medidas de la e2e `capturas-franja.spec.ts` en 740×360 (cuánto del ancho tapa el panel y cuántos píxeles se desplaza):

| Sala | Antes | Ahora | Con la respuesta de la máquina |
| --- | --- | --- | --- |
| 1 · Etiquetadora | 98 % · 63 px | 35 % · 0 px | 0 px |
| 2 · Tanques | 98 % · 438 px | 35 % · 0 px | 0 px (y 0 px con la gráfica abierta) |
| 3 · Reflector | 98 % · 452 px | 35 % · 0 px | 0 px |
| 4 · Carritos | 98 % · 260 px | 35 % · 0 px | (responde en vivo) |
| 5 · Urna | 98 % · 148 px | 35 % · 0 px | 0 px (con el sello y la anotación del cuaderno) |

## Cómo funciona la franja

- **En horizontal** (`orientation: landscape`), el panel de la máquina es una columna a la derecha de `35vw` (máximo 26 rem en un computador), de arriba abajo. El fondo no se oscurece: la máquina 3D se ve a la izquierda. En vertical queda el panel de siempre.
- **Lo que ya se ve en 3D no se repite**: los tanques y su nivel, las sombras y los sensores del gimnasio, los montones de libros y las fichas de la urna. Las ranuras de la etiquetadora tampoco: se ven en los rodillos marcados.
- **La gráfica de los tanques** no cabe con números legibles junto a la perilla, así que se abre con «Ver la gráfica» y ocupa la misma columna; «Volver a la perilla» la cierra.
- **Al accionar** (palanca, polea, manija) el panel se recoge a una pestaña «◀ Mirando…» mientras la máquina 3D se mueve y vuelve solo con lo que pasó, arriba. Los tiempos están en `src/ui/mecanismos/marco/recoger.ts`; los tanques avisan mientras dura la corrida. La mano de la urna y la caja fuerte ahora se mueven con el panel recogido: el jugador las ve.
- **«Ver»** recoge los controles cuando el jugador quiera; la pestaña «◀ Controles» los devuelve.
- **Texto de 14 px o más** (regla del tema, `tests/unit/tema.test.ts`): la cabecera dice «Sala 2 · 3/3» y el título y la etapa completos quedan para el lector de pantalla; la situación se recorta a dos renglones y la anotación del cuaderno a tres, con «… más ▾»: se tocan para leerlas completas. Con la respuesta de la máquina a la vista, la situación se esconde (ya se leyó). La primera versión usaba letra de 10 a 13 px y la prueba del tema la rechazó: se rehízo antes del PR.
- **Pistas**: el botón «Pista» va en la cabecera, junto a «Ver» y ✕, siempre a la vista. Con una pista nueva está resaltado y la abre de una vez en la misma columna; «Volver a la máquina» regresa. Reemplaza al aviso de la barra de abajo que la sesión B agregó el mismo día (#186): con la franja ya no cabía junto al botón de accionar.
- **Para la cámara** (sesión A): `franja` en `src/signals/interfaz.ts` dice qué fracción del ancho tapa la columna (0 sin panel, recogido o en vertical) y `panelRecogido` si está en su pestaña. La sesión A los conecta al encuadre en su próximo PR.

## Sala 4: carritos con «−» y «+»

- Cada carrito: «+», el día con su cuenta («Lun 2») y «−». El «+» se apaga si la pila está vacía; el «−», si el carrito no tiene libros.
- Abajo, «Pila: N» y «Devolver todo» (para empezar de nuevo).
- Pasar un libro de un día a otro ahora son dos toques (− y +): la lámpara de la media se apaga un momento y vuelve a encenderse. La pista 1 cambió a «Quita un libro de un carrito y ponlo en otro. ¿Cómo queda la lámpara de la media?» (también en `docs/salas-y-puzzles.md`).

## Logo de Sinapsis

- El archivo que dejó Alex (`public/marca/Logo trasnaprent.png`, 1080×607, 206 KB) se recortó y se pasó a WebP: `public/marca/sinapsis.webp`, 360×172, 18 KB. El original no se subió al repositorio.
- Portada: al pie, junto a la nota de personajes ficticios, «Un proyecto de» con el logo a 28 px de alto. La portada sigue cabiendo sin desplazarse en 851×393 y pesando menos de 250 KB.
- Pantalla de carga: el logo sobre «Cargando…» mientras baja el juego. Entra al núcleo sin conexión de la PWA.
- Créditos: al final de la ficha de créditos, después de la nota, «Un proyecto de» con el logo.

## Capturas

En `docs/capturas/correcciones-25nov-c/`, 740×360:

- `antes-s1-cooperativa.jpg` … `antes-s5-rectoria.jpg`: el panel de la última etapa de cada sala en `main`.
- `despues-s1-cooperativa.jpg` … `despues-s5-rectoria.jpg`: la misma etapa con la franja.
- `despues-s*-ver.jpg`: con «Ver», los controles recogidos en su pestaña «◀ Controles».
- `despues-s2-laboratorio-grafica.jpg`: la gráfica de los tanques abierta.
- `despues-s*-respuesta.jpg`: el panel al volver con lo que hizo la máquina (en la sala 5, con el sello y la anotación del cuaderno).

La cámara todavía no se acerca a la máquina (en la sala 4 los carritos quedan fuera de cuadro): eso llega con el encuadre de la sesión A conectado a `franja`.

## Pruebas

- PR #188: `format:check`, `lint`, `astro check`, `test` (1.264 en verde), `check-budget` y el build, con el candado C y prioridad baja; e2e 92 en verde en celular y escritorio (capturas, carritos, tanques, etiquetadora, reflector, caja fuerte, partida, accesibilidad, tema del archivo, coop sala 1, votos y pista, HUD).
- PR 2: lo mismo, más las e2e de portada, finales y PWA.
- Unidad nuevas o cambiadas: `panel-franja.test.ts` (tiempos de recogida y signals al cerrar), `carritos.test.ts` (textos de «+» y «−»), `urna-3d.test.ts` y `caja-fuerte.test.ts` (se mueven con el panel recogido).
- e2e nueva: `capturas-franja.spec.ts` (mide y captura las cinco máquinas, «Ver», la gráfica y la respuesta). Cambiadas: `carritos.spec.ts`, `recorrido.ts` (la partida completa usa «−» y «+»), `caja-fuerte.spec.ts` (la caja se abre con el panel recogido), `tanques.spec.ts`, `etiquetadora.spec.ts` y `partida.spec.ts` (lo que ya no se dibuja en la franja se revisa en el canvas 3D).

## Cruces con las otras sesiones

- **Sesión A**: acordamos que yo escribo `franja` y ella la lee en `src/engine/motor.ts` para encuadrar la máquina en el ancho libre (PR de una línea después de #188). Su #187 (estaciones de la sala 2) entró antes: lo integré con un merge de `main` y conservé su «Volver a la sala» por estación.
- **Sesión B**: su #186 agregó «Pista nueva» en la barra de abajo y una e2e de pistas con el mover libros viejo: el aviso pasó a la cabecera de la franja y la e2e usa «−» y «+». Su #184 quitó «Para estudiantes de 9.° en adelante» del pie de la portada: el logo quedó junto a la nota que sigue.

## Lo que queda para Alex

1. **En el celular**: abrir una máquina en cada sala y revisar que se vea a la izquierda, que la columna no se desplace y que «Ver», la pestaña y «Pista» se entiendan.
2. **Archivo original del logo**: `public/marca/Logo trasnaprent.png` sigue en la carpeta compartida sin subir. Se puede borrar o mover fuera de `public/` (si se queda, un `npm run build` local lo copia a `dist/`).
3. **Encuadre de la cámara**: la sesión A lo conecta con `franja` en su PR siguiente; hasta entonces usa los dos tercios izquierdos.

## Pendientes y decisiones

- **La gráfica en el graficador 3D**: la pared del laboratorio tiene el graficador, pero hoy es una lámina fija. Dibujar el trazo ahí en vivo es posible (repintar la lámina, como el sello del pasillo), pero queda lejos del tablero y habría que coordinar el encuadre. Por ahora la gráfica vive en la columna, con su botón.
- **El HUD** (Pausa, Ajustes, reloj) sigue a la vista y quieto con el panel abierto, como antes.
- **Cooperativo**: la franja funciona igual, pero con la frase de quién tiene el encargo D el panel puede desplazarse unos píxeles en 740×360; no se midió con cuatro jugadores.
