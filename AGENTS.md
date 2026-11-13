# AGENTS.md — La Última Prueba

Escape room 3D en primera persona para estudiantes de grado 9 en adelante, con foco en grado 10 (Colombia). Modo individual y cooperativo (2 a 4 jugadores), 40 minutos, 5 salas. Cada sala es una máquina con una regla matemática que se descubre jugando, no un problema con opciones. El juego no tiene relación con el ICFES ni con el Saber 11.
Especificación técnica completa: `docs/especificacion-tecnica.md` · Diseño: `docs/diseno.md` · Salas y puzzles: `docs/salas-y-puzzles.md`.

## Reglas no negociables

1. **Sin servidores propios.** El sitio es estático en Cloudflare Pages. Nada de Pages Functions, Workers, Supabase Edge Functions ni backend propio. Supabase se usa solo para Auth anónima y Realtime (Broadcast + Presence), más las políticas RLS de `supabase/migrations/`.
2. **Celular primero.** Dispositivo de referencia: Android de 2 GB de RAM (Mali-G52 MC2 / PowerVR GE8320), Chrome actualizado, 30 fps sostenidos. Todo se diseña y se prueba primero con controles táctiles; teclado y ratón son secundarios.
3. **El presupuesto 3D se respeta.** `scripts/check-budget.ts` rompe el build si una sala se pasa. No subas límites para que pase: optimiza el asset. La única excepción es el modo `?lab=1`, y solo para los originales que se comparan (ver «Laboratorio de assets y licencias»).
4. **Sin secretos en el repositorio.** Solo la URL y la anon key pública de Supabase, vía variables `PUBLIC_*`. Ninguna otra clave de API va en el código, en el contenido ni en la documentación.
5. **Datos de menores.** Sesión anónima, alias elegidos de una lista, sin chat libre ni voz, analítica sin cookies ni datos personales.

## Stack

- Astro (TypeScript estricto) con páginas estáticas: `/`, `/jugar`, `/creditos`, `/docentes`. El juego es una isla `client:only`.
- Three.js con WebGL2 obligatorio. Carga con GLTFLoader + Meshopt + KTX2.
- Preact + Signals para HUD, menús, cuaderno, inspección y mecanismos de respuesta.
- glTF-Transform + meshoptimizer + KTX2 (ETC1S/UASTC) en `scripts/optimize-models.ts`.
- Supabase Realtime para el cooperativo; Vitest para unidades y Playwright con emulación de celular para e2e.
- Unirse a una partida es `/jugar?codigo=XXXX`, nunca una ruta dinámica.

## Carpetas y capas

```
src/game/      reglas puras: sin DOM, sin Three, sin red. Todo aquí tiene tests.
src/engine/    Three.js: render, carga, jugador, interacción, salas.
src/ui/        Preact: hud, menus, cuaderno, inspeccion, mecanismos, finales.
src/signals/   único estado observable compartido entre engine/ y ui/.
src/net/       Supabase: canal, protocolo, anfitrión, reconexión. Solo habla con game/.
src/input/     táctil (joystick, mirada, toque), teclado y ratón.
src/content/   puzzles, salas, diálogos y finales en JSON validado en build (colecciones en src/content.config.ts).
src/debug/     métricas, panel ?debug=1, prueba de estrés y modo ?lab=1. Fuera del bundle de producción salvo el panel.
art/           fuentes .blend, originales descargados y WAV (Git LFS). Nunca se publican.
art/credits.json  una entrada por archivo publicado; capturas de licencia en art/evidencia/.
public/assets/ SALIDA del pipeline. No se edita a mano.
scripts/       optimize-models (+ perfiles/), optimize-audio, build-manifest, check-budget,
               check-credits, check-audio, hash-answers.
supabase/      config y migraciones de políticas RLS.
```

- `game/` no importa de `engine/`, `ui/` ni `net/`. `engine/` y `ui/` se comunican solo a través de `signals/`.
- Los textos legibles (facturas, fichas, gráficas) se muestran en la vista 2D de inspección, no como texturas.
- Los mecanismos de respuesta se operan en paneles 2D; el objeto 3D solo anima.

## Presupuesto en celular

| Recurso | Límite |
| --- | --- |
| Triángulos visibles por cuadro | 60.000 |
| Draw calls | 40 |
| Triángulos por sala | 90.000 (objetos interactivos máx. 6k c/u) |
| Texturas en GPU por sala | 16 MB; nada mayor de 1024², salvo lightmap 2048² en calidad alta |
| Descarga por sala | 2 MB de modelos + 0,6 MB de audio |
| Primera sala jugable | 3 MB en total |
| Memoria de la pestaña | 180 MB |
| Luces dinámicas | 2; sin sombras en tiempo real (todo horneado) |
| DPR | máx. 1,25 con escala dinámica 0,5–1,0 |

En GPU solo están la portería y la sala actual. La siguiente se descarga a la caché sin decodificar.

## Cooperativo

- Un canal privado `partida:{codigo}` por partida. Quien la crea es el anfitrión autoritativo.
- Eventos Broadcast: `int` (intenciones al anfitrión), `evt` (eventos numerados del anfitrión), `dir` (poses y señales).
- Los mensajes llevan ids, nunca textos de contenido. Máximo 1 KB; `estado`, 8 KB.
- El grupo avanza junto. Accionar el mecanismo que confirma una etapa, pausar, cambiar de sala, elegir final y pedir ayuda requieren unanimidad.
- Poses a 4 Hz solo en movimiento. Por ahora el límite es 2 partidas simultáneas en el plan Free.
- Si cambias el protocolo, sube `v` y actualiza los tests de `net/`.

## Laboratorio de assets y licencias

Base: `docs/investigacion-assets.md` y la sección v1.1 de la especificación.

**Una fuente por sala.** No mezcles fuentes de modelos en una sala sin decidirlo antes.

| Sala | Fuente | Regla clave |
| --- | --- | --- |
| s1-cooperativa | Kenney (CC0) | `join`, `instance` y `palette`: el problema son las draw calls |
| s2-laboratorio | Meshy, plan gratis (CC BY 4.0) | Crédito a Meshy obligatorio; límite de caras al generar; revisar luz horneada |
| s3-gimnasio | Sketchfab, solo CC BY | Nada NC ni ND; captura de licencia en `art/evidencia/`; casi siempre `simplify` |
| s4-biblioteca | Poly Haven (CC0) | Descarga manual en la web. **Nunca su API** (requiere licencia comercial) |
| s5-rectoria | Geometría por código + imágenes de IA + audio | Urna, fichas y mano mecánica creadas en Three.js; imágenes a KTX2 1024; efectos con Web Audio |

Paredes, piso y techo de todas las salas usan texturas CC0 de ambientCG, solo canal de color.

**Pipeline de modelos.**

1. El original va sin tocar a `art/<sala>/originales/` y se registra en `art/credits.json` antes de cualquier cambio.
2. `optimize-models --etapa limpieza` aplica el perfil de su `fuente` (`scripts/perfiles/`) y escribe en `art/<sala>/limpios/`. Aquí, y solo aquí, se usa `simplify`.
3. Se rehornea en Blender con `art/plantilla-horneado.blend`: segunda capa de UV, lightmap de la sala con Cycles y exportación. Los objetos que se mueven y los props instanciados no van en el lightmap.
4. La etapa común: `dedup` → `prune` → `weld` → `quantize` → `meshopt` → `ktx2` (1024 px) → `asset.copyright`. Nunca `simplify` después de hornear.

**Modo `?lab=1`.** Compara el original con el optimizado, con la misma cámara. Existe solo en `astro dev` y en la rama `lab` (`npm run build:lab`, `noindex`). En producción `PUBLIC_LAB` es falso, el módulo se elimina y los originales no se publican. En lab, `check-budget` solo informa sobre los originales; los optimizados cumplen igual que en producción.

**Panel `?debug=1` y prueba de estrés.** Las métricas se escriben en signals cada 500 ms como máximo, sin asignaciones por cuadro con el panel cerrado. La prueba de estrés recorre 4 ejes: triángulos, draw calls, texturas y píxeles. Antes de cada escalón guarda una marca en `localStorage` (con `try/catch`). Los resultados se exportan en JSON. **No crees tablas en Supabase para esto.**

**Créditos.** Cada archivo bajo `public/assets/salas/` y `public/assets/audio/` necesita una entrada con título, autor, fuente, URL, licencia, cambios, fecha, `plan` (obligatorio para Meshy, Tripo y ElevenLabs) y `evidencia`. `check-credits` hace fallar el build si:

- falta una entrada;
- la licencia es NC o ND, o es Freesound con Sampling+;
- es Tripo o ElevenLabs con plan gratis;
- es CC BY sin autor, URL o cambios.

`/creditos` y `asset.copyright` se generan desde el manifiesto: no los edites a mano.

**Audio.** Solo AAC (`.m4a`) normalizado a −16 LUFS (EBU R128, pico −1,5 dBTP). Nunca Ogg: `check-audio` falla si encuentra uno. Para Freesound, solo CC0 y CC BY. La voz final se hace con ElevenLabs y únicamente con plan de pago: su clave vive en una variable de entorno local, nunca en el repositorio.

**Antes de agregar un asset:** sin logos, productos ni personajes reconocibles. Si es de IA, usa prompts genéricos y revisa el resultado. No uses los nombres ni los logos del ICFES o del Saber 11: el juego no tiene relación con ellos.

## Contenido

- Cada sala tiene un **puzzle** (`src/content/puzzles/`) que cumple el esquema de `src/content/esquema.ts`: proceso (Estándares Básicos de Competencias del MEN), grado, 3 etapas (presentar, torcer, dominar) con estado inicial, controles, condición de éxito y una solución de ejemplo; 3 pistas graduales; el texto del cuaderno; y `pista_por_jugador` para los roles A–D. No hay opciones ni distractores.
- La máquina nunca dice «incorrecto»: muestra lo que pasó. Las pistas invitan a mirar algo, no dan pasos de cálculo. El concepto se nombra en el cuaderno después de resolver.
- Una función pura por puzzle en `src/game/puzzles/` recibe el estado y dice qué condiciones se cumplen.
- Español de Colombia: coma decimal (`0,75`), `$1.600`, `24 m²`.
- `hash-answers` (T23) guardará el hash del estado resuelto, no de una opción.

## Antes de dar una tarea por terminada

- Pasan los tests de unidad, la prueba e2e con perfil de celular y cada check que ya exista: `check-budget` llega en T09, `check-credits` en T11h y `check-audio` en T11j. Antes de esas tareas, ese check no se corre.
- Si tocaste render o assets, mídelo con el panel `?debug=1` en el celular de referencia (o con throttling de CPU 4×) y adjunta el JSON exportado.
- Las tareas se cierran en bloques de menos de una hora (T01–T102 y T11a–T11z en la especificación v1.1).
