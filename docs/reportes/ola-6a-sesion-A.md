# Reporte de la ola 6 · fase 1 · Sesión A · 16 de noviembre de 2026

Esta sesión hizo los cinco puntos de la lista, en tres PR, más un cuarto que arregla un error mío que destapó la suite completa. Todos están fusionados en `main`:

| Punto | Tarea | Qué es | PR |
| --- | --- | --- | --- |
| 5 | **T05d** | La e2e del presupuesto con señales ya no depende de que cuatro toques quepan en 5 s | [#127](https://github.com/Jssosaa1024/la-ultima-prueba/pull/127) |
| 2 y 3 | **T19f**, **T19g** | Luz sin horneado con sombras de contacto, y texturas opcionales de piso, paredes y techo | [#130](https://github.com/Jssosaa1024/la-ultima-prueba/pull/130) |
| 1 y 4 | **T19e**, **T10b** | El motor carga el `modelo` de cada objeto, y la prueba de la taza | [#131](https://github.com/Jssosaa1024/la-ultima-prueba/pull/131) |
| — | **T19g** (arreglo) | Sin zod en el bundle del motor: la CSP lo bloqueaba | [#132](https://github.com/Jssosaa1024/la-ultima-prueba/pull/132) |

Las tareas nuevas no tenían número: con la sesión B acordamos los ids para no repetirlos (B usó T19d para el campo `modelo`; A, T19e a T19g y T05d). T10b ya existía. Todas quedaron marcadas como hechas en la especificación dentro de su PR.

Resumen honesto: **nada se probó en un celular real.** Todo se comprobó con pruebas de unidad (Vitest), e2e (Playwright: Pixel 5 emulado en horizontal y Chrome de escritorio, con WebGL por software) y el sitio construido en local con `astro preview`, porque las vistas previas de Cloudflare están apagadas. Después de cada fusión revisé que el despliegue de `main` cargara `/jugar/`.

## 1. Qué hice

### T05d · La e2e del presupuesto con señales (#127)

- **Por qué fallaba:** con cuatro pestañas de WebGL por software, la pestaña de Jaguar dibuja un cuadro cada pocos segundos. Una señal dura 5 s desde que llega, y la prueba exigía ver las cuatro a la vez. En la corrida de diagnóstico solo se vieron **2 a la vez**.
- **Ahora:** cada jugador dice «¡Aquí!» por turno. Se espera a que la escena quede sin señales, aparece su marcador y el panel `?debug=1` se lee mientras se ve. Después los cuatro hablan a la vez y se anota cuántos se vieron juntos, sin exigir 4. Que 4 u 8 señales sean una sola draw call ya lo vigila `presupuesto-coop.test.ts`.
- El juego no cambió. Medidas: **10 a 13 draw calls con 3 avatares y 11 a 14 con señales** (límite 40), según hacia dónde quede mirando Jaguar.

### T19f y T19g · Luz, sombras y texturas (#130)

- **Luz:** una hemisférica y una direccional, sin sombras en tiempo real. Son las 2 luces dinámicas del presupuesto.
- **Sombras de contacto:** debajo de cada mueble sólido apoyado en el piso hay un plano oscuro de borde difuso. Todas las de una sala van en **una sola malla** (1 draw call) con una textura de 32 × 32 hecha por código. Cada sombra es un plano de 3 × 3 trozos, para que el borde difuso mida lo mismo en metros en una banca que en una estantería; la primera versión, estirada, casi no se veía fuera de los muebles grandes. No llevan sombra lo que se recoge, las puertas y carteles, ni los grupos que se usan (sus piezas se animan).
- **Texturas:** campo opcional `texturas` en cada sala de `salas.json`, con ids del manifiesto `<carpeta>/<nombre>` (la carpeta es un lugar o `compartido`) y `metros` por repetición (2 por defecto). Solo color, KTX2 de 1024. Cada superficie con textura va en su propia malla, con UV en metros: hasta **3 draw calls más** por sala; el peor caso, con las tres texturas y 4 jugadores, es 29 de 40. Mientras carga, o si el archivo no está, la sala se ve con sus colores de siempre.
- El motor pide `manifest.json` y el cargador KTX2 **solo si una sala los usa**, con import dinámico. La precarga de la siguiente sala deja sus archivos en la caché sin decodificar.
- **Arreglo de paso:** el panel `?debug=1` se marcaba «listo» con 0 cuadros medidos, y un JSON exportado enseguida decía `p95 = 0`. `depuracion.spec.ts` lo destapó (fallaba 5 de 6 veces con el equipo libre, que es más rápido). Ahora la primera medida sale después de medio segundo de cuadros.

### T19e y T10b · Modelos y la taza (#131)

- **Modelos:** si un objeto trae `modelo`, el motor descarga `public/assets/salas/<sala>/<modelo>.<hash>.glb` con el cargador de T10 (meshopt y KTX2). Lo ajusta a `tam` **sin deformarlo**: la escala que cabe en la caja, centrado y con la base en el piso del objeto. Sus materiales pasan a Lambert, como el resto de la sala.
- **La primitiva se queda invisible en su sitio:** sigue siendo la caja que choca y la que se toca, así que colisiones e interacción no cambian. Si el modelo no está o no carga, se ve la primitiva.
- **Repetidos:** los objetos fijos que comparten modelo van en una malla instanciada (una draw call). Lo que se toca lleva su propia copia, para que el resaltado no se contagie. Liberar una sala ahora también libera las mallas instanciadas.
- **La taza (T10b):** `npm run optimize-models -- art/prueba-assets/originales public/assets/salas/porteria` y `npm run build-manifest` llevaron `taza.glb` hasta `public/assets/` (5,5 KB, 256 triángulos, textura ETC1S), con su entrada en `art/credits.json`. `/jugar?prueba=asset` la pone sobre el escritorio de la portería y el canvas dice `data-modelos="porteria-taza-prueba"` cuando ya se ve. El original es una **taza hecha por código** (`npm run taza-prueba`) mientras no llegue la de Kenney; va en Git LFS como todo `art/`.
- Hoy ninguna sala usa `modelo` ni `texturas`: sin `?prueba=asset` el juego no descarga nada nuevo. Lo comprueba una e2e.

### Arreglo: zod en el bundle del motor (#132)

- La primera suite completa sobre `main` dio 4 fallas en `csp.spec.ts` («jugar solo en la sala 1» y «panel ?debug=1», en los dos perfiles): `script-src eval`.
- **La causa fue mía, de T19g:** `construir.ts` importaba un valor (`METROS_POR_REPETICION`) de `esquema-salas.ts`, y eso metió zod en el motor. Al cargar, zod prueba `Function('')` y la CSP lo bloquea. En producción no rompía el juego (zod atrapa el error), pero dejaba una violación de CSP en cada partida.
- La constante pasó a `construir.ts`, y una prueba de unidad nueva (`sin-zod-en-el-juego.test.ts`) falla si el código del navegador vuelve a importar valores de un esquema o de zod.
- **Lección:** en los PR de T19f/T19g corrí las e2e del render, pero no `csp.spec.ts`. Cualquier cambio en lo que importa el motor también toca la CSP.

## 2. Qué decidí (sin preguntarle a Alex)

1. **Ids de textura `<carpeta>/<nombre>` con carpeta `compartido`.** Las texturas de ambientCG sirven a todas las salas: una sola copia publicada. La sesión B usó el mismo formato en `docs/arte-cc0.md`.
2. **Ajuste sin deformar.** «Lo ajusta a `tam`» lo leí como escala uniforme: el modelo cabe en la caja y conserva sus proporciones. En un plano no cuenta el fondo.
3. **Materiales a Lambert.** Un solo estilo con el resto de la sala y menos cálculo por píxel en un celular de gama baja. Se conservan color y mapa.
4. **Primitiva invisible en vez de borrada.** Así tocar y chocar siguen usando la misma caja de siempre, y las animaciones que buscan el objeto por nombre lo siguen encontrando.
5. **Solo se instancia lo fijo.** Lo que se toca o se anima necesita su propia copia.
6. **La taza de `?prueba=asset` en `ids-objetos.test.ts`.** Esa prueba (T19c) no deja nombrar en `src/` un objeto que no esté en `salas.json`. La taza la agrega el motor por código, así que la prueba importa su id como conocido. Es la única excepción y está comentada.
7. **Archivos compartidos que toqué, lo mínimo:** `src/content/esquema-salas.ts` (campo `texturas` de la sala, sin valores que use el motor), `src/engine/motor.ts`, `src/engine/carga/liberar.ts`, `src/debug/medidor.ts`, `package.json` (script `taza-prueba`) y `tests/unit/ids-objetos.test.ts`.

## 3. Qué quedó incompleto o en duda

- **Las salas todavía no usan modelos ni texturas.** El motor ya los sabe cargar, pero faltan los archivos: los paquetes de Kenney y las texturas de ambientCG que lista `docs/arte-cc0.md` (sesión B). Cuando estén, otra tarea llena `modelo` y `texturas` en `salas.json`.
- **Luces y AGENTS.md:** la tarea pedía «hemisférica más una direccional», y así quedó. El AGENTS.md nuevo (sesión B, #128) dice «2 (hemisférica + linterna)». Hoy la linterna no es una luz, así que estamos en 2. Si un día la linterna alumbra de verdad, hay que quitar la direccional.
- **Presupuesto de las texturas compartidas:** `check-budget` cuenta por carpeta, así que las de `compartido/` suman en `compartido` y no en cada sala. Con 5 texturas de ~0,7 MB en GPU sobra espacio, pero no es lo que dice `docs/arte-cc0.md` («se cuentan en cada sala»). Si se quiere contarlas por sala, es un cambio en `check-budget`.
- **Ninguna medida en celular real.**

## Pruebas y equipo

- **Cada PR** pasó formato, lint, `astro check`, las pruebas de unidad (de 912 a 963), el build con los checks de créditos, presupuesto y audio, y las e2e de lo que tocaba, con el candado (`candado-pruebas.txt`, letra A), un solo navegador y prioridad baja. Ahora el candado usa el mismo formato que el de la sesión B (`A <pid> <segundos> <fecha>`). Antes de fusionar revisé cada cambio en el sitio construido con `astro preview`.
- **Suite e2e completa sobre `main`**, dos veces. La primera dio 235 pasaron y 4 fallaron: las de `csp.spec.ts` que arregló #132. La segunda, sobre `main` ya con #132: **239 pasaron, 0 fallaron y 21 se saltaron (23,6 min)**, más las 963 pruebas de unidad. Las saltadas son las que no corren en ese perfil (el cooperativo en escritorio, el teclado en celular, girar el teléfono en escritorio). En esa corrida, `coop-presupuesto` midió 10 draw calls con 3 avatares y 11 con señales, con las **4 señales a la vez**.

## 4. Qué debe probar Alex

### A. Las sombras (2 minutos, un celular)

1. Abre `https://la-ultima-prueba-duz.pages.dev/jugar/?sala=s2-laboratorio` en horizontal y toca **Jugar solo**.
2. Mira la base del mesón y de los tanques: hay una sombra suave en el piso alrededor, que se aclara hacia afuera.
3. Camina alrededor: la sombra no debe parpadear.

### B. La taza (2 minutos)

1. Abre `https://la-ultima-prueba-duz.pages.dev/jugar/?prueba=asset` y toca **Jugar solo**.
2. Arrastra el dedo en la mitad derecha para mirar a la derecha y un poco hacia abajo: el escritorio café está cerca de la entrada.
3. Sobre el escritorio hay una taza blanca con una franja azul y una línea naranja. Si ves un cilindro blanco liso, el modelo no cargó: avísame.

### C. Traer la taza de Kenney (10 minutos, en el computador)

1. Baja el **Food Kit** de Kenney desde kenney.nl (sección Assets). Es CC0.
2. Guarda una captura de su página, donde se vea el nombre del paquete y la licencia CC0 con la fecha, como `art/evidencia/kenney-food-kit.png`.
3. Del zip, copia `mug.glb` a `art/prueba-assets/originales/` con el nombre `taza.glb`, reemplazando la que hay.
4. Dile a una sesión «ya está la taza». Ella corre el pipeline, cambia el crédito a Kenney y lo revisa en `?prueba=asset`.
