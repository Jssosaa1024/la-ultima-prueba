# Reporte de la ola 6 · Menús con personalidad · Sesión C · 17 de noviembre de 2026

Alex eligió el estilo **«Archivo del colegio de noche»**: el jugador revisa el archivo de la I. E. Los Almendros antes de que se borre a las 00:40. Fichas y carpetas de cartón, papel envejecido, sellos de goma, letra de máquina de escribir en títulos y etiquetas, el reloj ámbar de las 00:40 y luz cálida de linterna sobre fondo oscuro.

| Tarea | Qué es | PR |
| --- | --- | --- |
| **T41c** | Tema compartido, ficha y sello; menú de inicio, crear y unirse, sala de espera y aviso de carga | [#142](https://github.com/Jssosaa1024/la-ultima-prueba/pull/142) |
| **T41d** | Pausa y confirmar salir (nuevo panel), ajustes y barra del grupo | [#143](https://github.com/Jssosaa1024/la-ultima-prueba/pull/143) |
| **T41e** | Finales, créditos, poscréditos, resumen de aprendizaje y elección de final; este reporte | este PR |

Resumen honesto:

- **No probé en un celular real.** Todo se revisó con Playwright en 740 × 360 (celular en horizontal), 802 × 293 (Pixel 5, el perfil de las e2e), 667 × 375 (iPhone SE) y 360 × 740 (vertical).
- **Las fuentes todavía no están.** Mientras Alex no las guarde, se ve la letra del sistema (Courier New y la normal del celular). Los pasos están en el punto 3.
- Las capturas de antes y después están en cada PR y en `docs/capturas/ola-6-menus/`.

## 1. Qué hice

### El tema (`src/ui/tema.css`)

- **Variables** `--tema-*` en `:root`: noche (fondo), papel y papel viejo, tinta y tinta suave, cartón, ámbar del reloj, tres tintas de sello (rojo, azul y verde), bordes, sombras, el grano del papel y la luz de linterna.
- **Texturas sin imágenes**: el grano del papel es un SVG propio dentro del CSS (ruido de 160 px en mosaico); el envejecido, los renglones de la ficha y la linterna son degradados.
- **Clases**, todas con el prefijo `tema-` para no chocar con otras pantallas (la inspección ya usaba `.ficha`):
  - `.tema-archivo`: letra de texto y botones del tema dentro de una pantalla.
  - `.tema-fondo`: la noche con la linterna (pantallas completas).
  - `.tema-etiqueta`, `.tema-titulo`, `.tema-reloj`: rótulos a máquina, título ámbar y el motivo «00:40».
  - `.tema-ficha` (+ `-renglones`, `-carpeta`, `-pestana`, `-entra`) y `.tema-sello` (+ color, `-grande`, `-recto`, `-golpe`).
- **Componentes**: `src/ui/tema/Ficha.tsx` (papel, ficha con renglones o carpeta, con pestaña) y `src/ui/tema/Sello.tsx` (texto real, que se lee; `decorativo` lo esconde del lector de pantalla cuando repite algo ya dicho).
- **Movimiento**: la ficha entra deslizándose (240 ms) y el sello golpea (320 ms). Con `prefers-reduced-motion` no se mueve nada.

### Pantallas

- **Menú de inicio**: en horizontal, a la izquierda el título, el reloj «00:40» y la historia; a la derecha la ficha con los botones de a dos. Todo cabe en 740 × 360 sin deslizar.
- **Crear, unirse y sala de espera**: en la misma ficha, más ancha. La sala de espera va en dos columnas (código a la izquierda; jugadores, «Iniciar» y «Salir» a la derecha) y el sello verde **LISTO** golpea la fila de quien está listo.
- **Aviso de carga**: una ficha pequeña con un reloj ámbar cuya aguja gira.
- **Pausa (nueva)**: el botón del HUD se llama «Pausa» y abre una ficha con el sello **EN PAUSA**; el reloj se detiene. Desde ahí: «Seguir jugando», «Ajustes» y «Salir de la partida», que pide confirmar; al confirmar golpea el sello **EXPEDIENTE CERRADO**. Reemplaza al `window.confirm` del navegador, que no se podía leer bien en el celular. En grupo, el botón sigue llamándose «Salir» y abre solo la confirmación, porque la pausa en grupo se vota en la barra.
- **Ajustes**: la misma ficha de papel, con los controles en tinta.
- **Barra del grupo**: avisos y votos como notas de papel; las señales de los compañeros, etiquetas ámbar.
- **Finales**: el final es un expediente cerrado con su sello (SALIDA AUTORIZADA, ARCHIVO RESTAURADO, AYUDA RECIBIDA o TIEMPO CUMPLIDO), los números a máquina y, en el resumen de aprendizaje, una ficha por sala con un sello de cómo terminó (sin pistas, con pistas o sin resolver). Créditos en ficha con renglones; la hoja de la fotocopiadora con el sello COPIA. La elección de final frente a la puerta usa la misma ficha.

### Accesibilidad y seguridad

- Contraste AA de todos los pares de texto y fondo del tema: lo revisa `tests/unit/tema.test.ts`, que lee los colores de `tema.css` (así no se desactualiza).
- Ningún texto menor de 14 px en las hojas del tema (también en esa prueba) ni en las pantallas (e2e `tema-archivo.spec.ts`).
- Botones de 48 px (mínimo 44). En la sala de espera, «Ya no estoy listo» puede ocupar dos líneas; el botón sigue midiendo más de 44 px.
- Sin `innerHTML`, sin estilos en línea nuevos y sin nada cargado de fuera: las fuentes se autoalojan y las texturas van dentro del CSS (la CSP ya permite `img-src data:`).

## 2. Qué decidí (Alex puede cambiarlo)

- **Botones en letra legible, no de máquina de escribir.** En máquina de escribir, «Crear partida» y «Unirse con código» no cabían en una línea en 740 px. La máquina de escribir queda para títulos, rótulos, códigos, números y sellos.
- **El título de los paneles va en tinta, no en ámbar.** El ámbar sobre papel no da contraste AA; el ámbar queda para la noche (título del menú y reloj).
- **En la sala de espera en horizontal no se ve la historia** del menú (ya se leyó) para que la lista y «Iniciar» quepan sin deslizar.
- **Pausa en grupo**: no se agregó una pausa individual en grupo (la regla del cooperativo pide unanimidad); el botón dice «Salir» y explica cómo votar la pausa.

## 3. Lo que necesita Alex

### Fuentes (licencia SIL OFL 1.1)

Propuesta:

- **Courier Prime** (máquina de escribir, para títulos y etiquetas). Hecha para leerse bien en pantalla, con tildes y eñes.
- **Atkinson Hyperlegible** (textos y botones). Del Braille Institute, pensada para lectores con baja visión: distingue bien 1, l e I, y 0 y O, útil para los códigos de partida.

Pasos:

1. Abre cada enlace; el navegador descarga el archivo.
2. Guárdalo en la carpeta `public/fonts/` del repositorio con **este nombre exacto**:

| Enlace | Nombre del archivo |
| --- | --- |
| https://cdn.jsdelivr.net/fontsource/fonts/courier-prime@latest/latin-400-normal.woff2 | `courier-prime-latin-400-normal.woff2` |
| https://cdn.jsdelivr.net/fontsource/fonts/courier-prime@latest/latin-700-normal.woff2 | `courier-prime-latin-700-normal.woff2` |
| https://cdn.jsdelivr.net/fontsource/fonts/atkinson-hyperlegible@latest/latin-400-normal.woff2 | `atkinson-hyperlegible-latin-400-normal.woff2` |
| https://cdn.jsdelivr.net/fontsource/fonts/atkinson-hyperlegible@latest/latin-700-normal.woff2 | `atkinson-hyperlegible-latin-700-normal.woff2` |
| https://raw.githubusercontent.com/google/fonts/main/ofl/courierprime/OFL.txt | `OFL-courier-prime.txt` |
| https://raw.githubusercontent.com/google/fonts/main/ofl/atkinsonhyperlegible/OFL.txt | `OFL-atkinson-hyperlegible.txt` |

3. Guarda una captura de cada página de licencia en `art/evidencia/` (como con los modelos).
4. Pídele a una sesión que haga el PR: no hay que cambiar código, el tema ya busca esos nombres. Son unos 73 KB en total y solo se descargan cuando una pantalla los usa.

Mientras no estén, cada página pide esos archivos y recibe un 404 (no rompe nada; se ve la letra del sistema).

Pendiente para esa sesión: decidir si las fuentes van también en `/creditos` (hoy `check-credits` solo revisa modelos y audio).

### Celular real

Mirar en el Android de referencia y en un iPhone: menú, sala de espera con dos celulares, pausa, ajustes y un final. Lo que más conviene revisar: que el grano del papel no se vea pixelado y que las animaciones se sientan cortas.

## 4. Para la sesión B: usar el mismo tema en `/` y `/docentes`

Las dos páginas son Astro (sin Preact), así que se usan las clases directamente:

```astro
---
import '../ui/tema.css';
---
<main class="tema-archivo tema-fondo">
  <p class="tema-etiqueta">Archivo de la I. E. Los Almendros</p>
  <h1 class="tema-titulo">La Última Prueba</h1>
  <p class="tema-reloj"><span>El archivo se borra a las</span> <strong>00:40</strong></p>
  <div class="tema-ficha tema-ficha-renglones">
    <p class="tema-ficha-pestana tema-etiqueta">Expediente 00:40</p>
    …
  </div>
  <span class="tema-sello tema-sello-rojo" aria-hidden="true">Por revisar</span>
</main>
```

Tener en cuenta:

- **Sobre papel**, el texto va en `var(--tema-tinta)` o `var(--tema-tinta-suave)`; **sobre la noche**, en `var(--tema-claro)` o `var(--tema-claro-suave)`. El ámbar solo sobre la noche. Los pares con contraste AA están anotados en `tema.css` y probados en `tests/unit/tema.test.ts`; si se agrega un color, agregar su par ahí.
- Los botones `.boton .boton-principal` y `.boton-secundario` toman el tema dentro de `.tema-archivo`; dentro de una `.tema-ficha`, el secundario pasa solo a tinta.
- Para `/docentes`, que es texto largo, conviene una `.tema-ficha` lisa (sin renglones) para cada sección y la máquina de escribir solo en los títulos.
- `body` en `Base.astro` tiene fondo `#111418`; si la portada usa `.tema-fondo` en un contenedor de alto completo, no hace falta tocar el layout.
- Si se agrega `prefers-reduced-motion` o animaciones nuevas, seguir la regla de `tema.css`: cortas y sin movimiento cuando se pide.

## 5. Pruebas

- `format:check`, `lint`, `test`, `check-credits`, `check-budget`, `check-audio` y el build (con `astro check`) en verde en cada PR, en local y con el candado de pruebas.
- E2e de cada PR en celular y escritorio, solo las que tocan estas pantallas (en cada PR está la lista y el resultado).
- Nuevas: `tests/unit/tema.test.ts` (contraste y tamaño de letra) y `tests/e2e/tema-archivo.spec.ts` (menú, crear, pausa y final en 740 × 360; animaciones quietas con menos movimiento).
- Cambiaron por la pausa: `hud`, `humo`, `partida`, `orientacion` y `depuracion` ya no esperan el `window.confirm`; usan `salirDeLaPartida()` de `tests/e2e/escena.ts`.

## 6. Notas para otras sesiones

- Los servidores de Astro que lancé quedaron vivos al detenerlos con `TaskStop` (lo mismo que dice la memoria de la ola 6); los cerré yo con su PID después de revisar que eran míos.
