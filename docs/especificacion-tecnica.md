# La Última Prueba — Especificación técnica

12 de noviembre de 2026 · Versión 1.2 · Documento vivo: https://claude.ai/artifact/HqKa6YbWbcB8g8ryk55ixB

**Versión 1.1** (enmienda del 5 de noviembre de 2026): agrega el laboratorio de assets, el modo `?lab=1`, el panel de métricas y la prueba de estrés, el registro de créditos, las reglas de audio y los riesgos de licencia, con base en `docs/investigacion-assets.md`. El diseño, las salas, el presupuesto, el protocolo y la numeración T01–T102 no cambian; las tareas nuevas son T11a–T11z.

**Versión 1.2** (enmienda del 12 de noviembre de 2026, con base en `docs/salas-y-puzzles.md`): el juego no tiene relación con el ICFES ni con el Saber 11; el público es grado 9 en adelante, con foco en grado 10; la premisa es recuperar la memoria USB con el proyecto de la feria de ciencias; cada sala es un puzzle de tres etapas en lugar de una pregunta con cuatro opciones (sección 2), con `proceso` de los Estándares del MEN y `grado` en lugar de `competencia`. Cambian las descripciones de T21–T23, T26, T27, T34, T37, T38, T45, T52, T58, T64, T70, T75 y T100; la numeración y el orden de las fases no cambian.

## Alcance y decisiones de arquitectura

El juego es un sitio estático en Astro con una sola isla de juego a pantalla completa: Three.js dibuja el mundo, Preact con Signals dibuja HUD y menús, y Supabase Realtime solo entra en el modo cooperativo. La meta es 30 fps estables en un Android de gama baja con 2 GB de RAM y 60 fps en gama alta.

| Decisión | Elección | Motivo |
| --- | --- | --- |
| Páginas | Astro estático: `/`, `/jugar`, `/creditos`, `/docentes` | Cloudflare Pages sin servidor; el juego es una isla `client:only` |
| Unirse a partida | `/jugar?codigo=K7MP` (parámetro, no ruta dinámica) | Un sitio estático no puede pre-generar rutas para códigos arbitrarios |
| Lógica de juego | Módulo TypeScript puro, sin DOM ni Three | Se prueba con tests unitarios y la usan igual el modo individual y el anfitrión del cooperativo |
| Puente motor ↔ interfaz | Signals de Preact como único estado observable | El HUD y la escena reaccionan al mismo estado sin acoplarse |
| Render | Three.js con WebGL2 obligatorio | Three.js actual ya no soporta WebGL1; se muestra aviso en equipos sin WebGL2 |
| Contenido | Salas, puzzles, diálogos y finales en JSON validado en build | El equipo pedagógico edita datos sin tocar código |
| Lectura de datos | Al inspeccionar un objeto con datos, se abre una vista 2D nítida en el HUD | Texto legible en pantallas pequeñas, compatible con lector de pantalla y sin texturas grandes |
| Mecanismos de respuesta | Entrada en un panel 2D (Preact); el objeto 3D solo anima | Tocar ruedas o teclas 3D pequeñas es impreciso en celular |
| Cooperativo | Anfitrión autoritativo sobre Broadcast + Presence; sin servidor de juego | Encaja con hosting estático y con partidas de 2 a 4 jugadores |
| Comunicación entre jugadores | Señalar (ping) y frases rápidas; sin chat libre ni voz | Usuarios menores de edad, normalmente en la misma aula |

Controles táctiles: joystick virtual en la mitad izquierda, arrastre para mirar en la mitad derecha, toque sobre un objeto para seleccionarlo y un botón contextual «Usar». Hay modo zurdo que invierte los lados. Teclado y ratón (WASD + bloqueo de puntero) quedan como soporte secundario en escritorio.

Supuesto clave: el dispositivo de referencia es un Android de 2 GB de RAM (a menudo con Android Go), GPU de la clase Mali-G52 MC2 / PowerVR GE8320 y Chrome actualizado. Con tan poca memoria, el límite de memoria manda sobre la calidad visual.

## 0) Presupuesto 3D para celular

Cada sala cabe en 60.000 triángulos visibles, 40 draw calls, 16 MB de texturas en GPU y 2 MB descargados; la primera sala jugable llega con menos de 3 MB en total. Un script de build rechaza cualquier sala que se pase (tarea T09).

### Por cuadro (lo que se dibuja a la vez)

| Métrica | Límite | Objetivo | Cómo se logra |
| --- | --- | --- | --- |
| Triángulos visibles | 60.000 | 40.000 | Salas cerradas, LOD en props, sin geometría fuera de cámara |
| Draw calls | 40 | 30 | Atlas de materiales, `InstancedMesh` para sillas, libros y fichas |
| Luces dinámicas | 2 | 2 | Hemisférica + linterna (`SpotLight`); el resto, horneado en lightmap |
| Sombras en tiempo real | 0 | 0 | Sombras horneadas; las «sombras misteriosas» son planos con textura alfa animada |
| Materiales | Lambert + lightmap en entorno; Standard solo en objetos interactivos | — | Menos costo de shader en GPU móvil |
| Resolución interna | DPR máx. 1,25; escala dinámica 0,5–1,0 | 30 fps sostenidos | Se ajusta según los fps medidos cada 2 s |
| Post-proceso | Ninguno en calidad baja y media | — | FXAA solo en calidad alta |

### Por sala

| Recurso | Límite | Notas |
| --- | --- | --- |
| Triángulos en escena | 90.000 | Arquitectura 15k · ambientación 35k · objetos interactivos 20k (máx. 6k c/u) · avatares 4 × 2k · margen 12k |
| Texturas (cantidad) | 1 lightmap 1024² + hasta 2 atlas 1024² + texturas de objetos 512² | Lightmap de 2048² solo en calidad alta |
| Texturas en GPU | 16 MB con mipmaps | KTX2: ETC1S para color y lightmap; UASTC solo para mapas normales de objetos clave, que se omiten en calidad baja |
| Peso descargado | 2 MB | GLB con `EXT_meshopt_compression` + KTX2; audio aparte |
| Audio de la sala | 0,6 MB | AAC mono 48 kbps para voz, 64 kbps para ambiente en bucle |

### Carga total

| Paquete | Límite (gzip/brotli) | Cuándo se descarga |
| --- | --- | --- |
| Página de inicio y menús (Astro + Preact + Signals) | 100 KB | Al abrir el sitio |
| Núcleo de juego (Three.js recortado, cargadores, lógica) | 250 KB | Al tocar «Jugar» |
| Decodificadores meshopt y Basis (wasm) | 300 KB | Junto con el núcleo; caché inmutable |
| Portería + sala 1 + audio inicial | 2,3 MB | Antes del primer control |
| **Primera sala jugable, total** | **3 MB** | Unos 5 s en 4G de 5 Mbps |
| Salas 2 a 5 | 4 × 2,6 MB | La siguiente se descarga a la caché mientras se juega la actual; no sube a la GPU hasta entrar |
| **Juego completo** | **14 MB** | Queda en caché del service worker para volver a salas anteriores |

Memoria: la pestaña no debe superar unos 180 MB entre JavaScript y GPU. En GPU solo quedan la portería y la sala actual; la siguiente espera descargada en la caché, sin decodificar. Al volver a una sala anterior se recarga desde la caché local, sin red.

Pipeline de compresión (glTF-Transform + meshoptimizer), ajustado en v1.1: perfil de limpieza por fuente, con `simplify` si hace falta → rehorneado en Blender → `dedup` → `prune` → `weld` → `quantize` → `meshopt` → `ktx2` (requiere KTX-Software 4.4.0 o superior en la máquina de build) → `asset.copyright` → informe de triángulos, draw calls estimados y bytes por sala. `instance` y el LOD al 50 % se aplican solo a props instanciados, que no usan lightmap. El detalle está en «Laboratorio de assets».

## Laboratorio de assets (v1.1)

Cada sala prueba una fuente de modelos distinta. Todas terminan en el mismo GLB con meshopt y KTX2 de 1024 px y cumplen el mismo presupuesto; lo que cambia es la limpieza previa y el registro de licencia. Paredes, piso y techo usan las mismas texturas CC0 de ambientCG en todas las salas, como control: cualquier diferencia entre salas viene de los modelos.

| Sala | Fuente | Qué aporta | Qué medimos sobre todo |
| --- | --- | --- | --- |
| 1 · Cooperativa | Kenney (CC0) | Mostrador, estanterías, cajas, registradora modular | Draw calls antes y después de `join`, `instance` y `palette` |
| 2 · Laboratorio | Meshy, plan gratis (CC BY 4.0 con crédito a Meshy) | Termómetro, mesones, instrumentos | Triángulos tras el límite de caras; luz horneada que choca con la de la sala |
| 3 · Gimnasio | Sketchfab, solo CC BY | Graderas, maqueta, tablero | Cuánto hay que simplificar; tiempo de carga |
| 4 · Biblioteca | Poly Haven (CC0), descarga manual en la web; nunca su API | Muebles, lámpara, globo terráqueo | Memoria de texturas: varios mapas por material |
| 5 · Rectoría | Geometría por código + imágenes de IA + audio | Urna, fichas y ruedas generadas en Three.js; cuadros y carteles generados con IA; efectos con Web Audio | Costo cero de descarga en geometría; calidad de imágenes de IA tras KTX2 |

El presupuesto de la sección 0 manda sobre las cifras de la investigación (100.000 triángulos, 15 MB, \~100 draw calls), que quedan descartadas para este juego.

### Limpieza por fuente en `optimize-models`

El script lee la `fuente` de cada archivo en `art/credits.json` y aplica su perfil antes de la etapa común. Ningún perfil sube un límite: si un asset no cabe, se simplifica o se cambia.

| Perfil | Pasos específicos | Trampa principal |
| --- | --- | --- |
| `kenney` | Factor de escala por pack a metros; `join` de piezas que comparten material; `instance` de repetidos; `palette` para fundir materiales planos en una textura | Muchas piezas sueltas = muchas draw calls |
| `meshy` | Límite de caras pedido al generar (6k por objeto); pivote en el centro de la base; escala a metros; `simplify` si aún se pasa; texturas 2048 → 1024; revisar luz horneada y regenerar con PBR si la trae | Geometría densa y desordenada; iluminación falsa en la textura |
| `sketchfab` | Descargar el GLB con texturas de 1k; quitar cámaras, luces y nodos vacíos (`prune`, `flatten`); corregir eje +Y, escala y pivote; `simplify` hasta 6k por objeto | Modelos sobredimensionados; materiales que glTF no soporta se pierden |
| `polyhaven` | Versión glTF de 1k bajada a mano; en el entorno solo se conserva el color (Lambert + lightmap); normal y rugosidad solo en objetos interactivos | Peso de texturas: 4 o más mapas por material |
| `ambientcg` | Material a 1K; solo color para paredes y piso; `repeat` ajustado en Three.js | Repetición visible de la textura |
| `ia-imagen` | Redimensionar a potencia de 2 (1024² máx.); KTX2 ETC1S | Logos, texto o caras que no deben aparecer |
| `codigo` | Sin archivo: la geometría se crea al cargar la sala y se mide en el panel de métricas | Triángulos que no ve `check-budget` |

Después del perfil, la etapa común es la misma para todos: `dedup` → `prune` → `weld` → `quantize` → `meshopt` → `ktx2` → escribir `asset.copyright` → informe.

### Rehorneado en Blender con el lightmap de la sala

Los modelos externos traen iluminación propia o ninguna; para que encajen, se rehornean con la luz de su sala. El orden importa: simplificar después de hornear deforma las UV del lightmap.

1. `optimize-models --etapa limpieza` produce un GLB limpio sin comprimir en `art/<sala>/limpios/`.
2. La plantilla `art/plantilla-horneado.blend` lo importa como colección enlazada dentro de `escena.blend` de la sala.
3. Se genera una segunda capa de UV (Lightmap Pack) y se ubica en el atlas de lightmap de la sala (1024²).
4. Se hornea con Cycles la luz difusa (directa + indirecta, sin color) de toda la sala en un solo lightmap.
5. Se exporta el GLB de la sala con las dos capas de UV y se pasa por la etapa común, sin `simplify`.

Los objetos que se recogen o se mueven (linterna, fichas, lupa) y los props instanciados (sillas, libros) no van en el lightmap: usan luz hemisférica, la linterna y una sombra falsa bajo su base. Las tareas de lightmap ya existentes (T48, T55, T61, T67, T73) hornean con los assets externos incluidos.

### Modo `?lab=1`

Carga el asset original y su versión optimizada en la misma escena y con la misma cámara, para compararlos. Es la única parte del proyecto donde se permite pasar el presupuesto.

- **Dónde existe:** en `astro dev` y en la rama `lab` de Cloudflare Pages (`npm run build:lab`, con cabecera `X-Robots-Tag: noindex`). En el build de producción, `PUBLIC_LAB` es falso, el módulo se elimina del bundle y `?lab=1` no hace nada.
- **Originales:** solo el build de lab copia a `lab-originales/` los archivos de `art/` que se van a comparar. Producción nunca los publica.
- **Presupuesto:** en lab, `check-budget` informa sobre los originales sin fallar; los optimizados deben cumplir igual que en producción. El build de `main` falla ante cualquier exceso.
- **Interfaz:** botón A/B para alternar original y optimizado (pantalla dividida en escritorio), modo alambre y una tabla de diferencias: triángulos, draw calls, MB descargados, MB de texturas en GPU, tiempo de carga y p95 del tiempo de cuadro.
- **Acceso:** el enlace de la rama `lab` se comparte solo con el equipo; si hace falta, se protege con Cloudflare Access, que es un servicio gestionado y no un servidor propio.

## Panel de métricas y prueba de estrés (v1.1)

Un panel oculto mide cada sala contra el presupuesto, y una prueba de estrés sube la carga en un solo eje por corrida hasta encontrar el límite de cada teléfono. Los resultados se exportan en JSON; no se guardan en Supabase por ahora.

### Panel `?debug=1`

Se abre con `?debug=1` o con 3 toques en la esquina superior izquierda. Es un componente Preact sobre el canvas que solo captura toques en sus botones. Las métricas viven en signals de `src/debug/metricas.ts` y el bucle de render las escribe como máximo cada 500 ms.

| Métrica | Cómo se mide | Verde hasta |
| --- | --- | --- |
| Tiempo de cuadro | Mediana, p95 y 1 % más lento en ventana de 5 s, desde `setAnimationLoop` | p95 33 ms |
| Triángulos | `renderer.info.render.triangles` con `info.autoReset = false` y `info.reset()` una vez por cuadro | 60.000 |
| Draw calls | `renderer.info.render.calls`, igual que arriba | 40 |
| Memoria de texturas | Ancho × alto × bytes por píxel × 1,33 con mipmaps: 0,5 B en ETC2 RGB, 1 B en ASTC 4×4 o ETC2 RGBA, 4 B sin comprimir | 16 MB |
| Geometrías y texturas activas | `renderer.info.memory`; si crecen al cambiar de sala, falta un `dispose()` | Igual al volver |
| MB descargados | `PerformanceObserver` de tipo `resource`, suma de `transferSize` bajo `/assets/salas/<sala>/`; cuenta aparte lo que vino de caché | 2,6 MB |
| Tiempo de carga | `performance.measure` entre `sala:inicio` y `sala:primer-cuadro` | 5 s en 4G |
| Contexto | Perfil de calidad, `devicePixelRatio`, pixel ratio usado, `userAgent` | — |

Cada valor se pinta en verde, ámbar (más del 85 % del límite) o rojo. Con el panel cerrado no hay asignaciones por cuadro; con el panel abierto, la mediana del tiempo de cuadro no sube más de 1 ms.

### Prueba de estrés por ejes

| Eje | Cada escalón agrega | Qué aísla |
| --- | --- | --- |
| Triángulos | +10.000 con un `InstancedMesh` del asset más pesado de la sala | Geometría, en una sola draw call |
| Draw calls | +10 mallas pequeñas con material propio | Costo de CPU por llamada |
| Texturas | +4 texturas KTX2 de 1024 px en planos visibles | Memoria, el límite que hace recargar Safari |
| Píxeles | Pixel ratio de 0,5 a `devicePixelRatio` en pasos de 0,25; luego +1 plano transparente a pantalla completa | Costo por píxel, el que más pesa en teléfonos baratos |

Los escalones son más finos que los de la investigación porque el presupuesto aquí es de 60.000 triángulos y 40 draw calls. No hay eje de sombras: el juego no usa sombras en tiempo real.

Cada escalón sigue el mismo ciclo:

1. **Guardar antes de subir:** escribir `{ eje, escalon, estado: "en-curso" }` en `localStorage` (dentro de `try/catch`). Safari en iPhone recarga la pestaña sin aviso cuando se queda sin memoria; la marca es lo único que sobrevive.
2. **Calentar 1 s** sin medir: compilación de shaders y subida de texturas.
3. **Medir 5 s:** mediana, p95 y 1 % más lento, más triángulos, draw calls y MB de texturas.
4. **Decidir:** parar si el p95 pasa de 33 ms dos escalones seguidos o si llega `webglcontextlost`; si no, siguiente escalón.
5. **Al terminar:** borrar la marca, liberar todo con `dispose()` y comprobar que `renderer.info.memory` vuelve a los valores previos.

Si al abrir la página existe una marca «en-curso», ese escalón se registra como «recarga por memoria» y el panel lo muestra. Después de hallar el límite, la sala real se deja 3 minutos al 70 % de la carga límite para medir el efecto del calor (p95 del primer minuto frente al último). Los límites alimentan los perfiles de calidad bajo, medio y alto. Dispositivos mínimos: un Android de 2 GB real y un iPhone real; el simulador de iOS no reproduce el límite de memoria.

### Exportación en JSON

El botón «Exportar JSON» descarga un archivo (o abre el menú de compartir en iPhone) con este formato:

```json
{
  "version": 1,
  "fecha": "2026-11-05T15:00:00-05:00",
  "dispositivo": { "userAgent": "…", "devicePixelRatio": 2, "pantalla": [720, 1600], "perfil": "bajo", "ahorro_energia": null },
  "sala": "s1-cooperativa",
  "metricas": { "mediana_ms": 24.1, "p95_ms": 31.0, "p1_ms": 38.2, "triangulos": 52000, "draw_calls": 34, "mb_texturas": 12.4, "mb_descargados": 2.3, "carga_ms": 4100 },
  "estres": {
    "eje": "texturas",
    "escalones": [
      { "escalon": 1, "carga": "+4 texturas", "mediana_ms": 24.5, "p95_ms": 31.8, "mb_texturas": 15.2, "estado": "estable" },
      { "escalon": 2, "carga": "+8 texturas", "estado": "recarga-por-memoria" }
    ],
    "ultimo_estable": 1
  }
}
```

Los números del ejemplo son ilustrativos, no medidos. `estado` puede ser `estable`, `lento`, `recarga-por-memoria` o `contexto-perdido`.

## Créditos y licencias (v1.1)

Anotar la licencia sigue siendo manual, un minuto por asset al descargarlo; lo automático es impedir que algo se publique sin ella y generar los créditos. Nada llega a `public/assets/` sin una entrada válida en `art/credits.json`.

### Manifiesto `art/credits.json`

Una entrada por archivo publicado, más una captura de la página de licencia del día de la descarga en `art/evidencia/`:

```json
{
  "archivo": "public/assets/salas/s3-gimnasio/graderia.glb",
  "sala": "s3-gimnasio",
  "tipo": "modelo",
  "titulo": "Bleachers",
  "autor": "nombre_del_autor",
  "fuente": "sketchfab",
  "url": "https://sketchfab.com/3d-models/…",
  "licencia": "CC-BY-4.0",
  "licencia_url": "https://creativecommons.org/licenses/by/4.0/",
  "cambios": "simplificado a 6k triángulos, rehorneado con la luz de la sala, texturas KTX2 1024, meshopt",
  "fecha": "2026-11-05",
  "plan": null,
  "evidencia": "art/evidencia/graderia.png"
}
```

- `tipo`: `modelo`, `textura`, `imagen`, `audio` o `voz`.
- `fuente`: `kenney`, `meshy`, `sketchfab`, `polyhaven`, `ambientcg`, `ia-imagen`, `freesound`, `elevenlabs`, `codigo` o `propio`. Elige el perfil de limpieza de `optimize-models`.
- `plan`: obligatorio (`gratis` o `pago`) para Meshy, Tripo y ElevenLabs, porque la licencia depende del plan activo el día de la generación, no del plan actual. Para la IA se anota también el prompt.
- `evidencia`: obligatoria para Sketchfab, Meshy y ElevenLabs. Sketchfab cambió de dueño este año; la captura prueba la licencia que tenía el modelo al bajarlo.

### `check-credits` en cada build

`scripts/check-credits.ts` corre antes de `astro build`, también en la rama `lab`. El build falla si:

- Un archivo bajo `public/assets/salas/` o `public/assets/audio/` no tiene entrada en el manifiesto.
- La licencia no está en la lista permitida: `CC0-1.0`, `CC-BY-4.0`, `CC-BY-3.0`, `propio`, `meshy-pago`, `tripo-pago`, `elevenlabs-pago`, `openai`.
- La licencia contiene `NC` o `ND`, o es un Freesound con Sampling+.
- Es Tripo o ElevenLabs con `plan: "gratis"`.
- Es CC BY sin `autor`, `url` o `cambios`: CC BY 4.0 exige indicar las modificaciones.
- Falta `evidencia` donde es obligatoria.

Meshy con plan gratis pasa como `CC-BY-4.0`, pero el script exige `autor: "Meshy"` para que el crédito aparezca.

### Dónde se publican los créditos

- **Página `/creditos`**, generada en build desde el manifiesto y agrupada por sala: título, autor, enlace a la fuente, licencia con enlace y cambios. Se enlaza desde el menú y desde la pantalla de créditos del juego (T40).
- **Dentro de cada GLB**, en `asset.copyright`, escrito por la etapa común de `optimize-models` (por ejemplo, «“Bleachers”, autor, CC BY 4.0, modificado»). Así el crédito viaja con el archivo aunque alguien lo descargue suelto.

Los metadatos de Poly Haven se anotan a mano desde la web: su API requiere una licencia aparte para uso comercial.

## Audio (v1.1)

Todo el audio publicado es AAC en `.m4a`, normalizado a −16 LUFS; nunca Ogg, porque Safari en iPhone no lo reproduce. Las tasas de la sección 0 no cambian: voz mono a 48 kbps y ambiente a 64 kbps.

| Fuente | Regla |
| --- | --- |
| Kenney (CC0) | Llega en OGG o WAV: se convierte siempre desde el WAV a AAC |
| Freesound | Solo CC0 y CC BY; nada NC ni Sampling+. Se descarga el original (WAV o FLAC), no la vista previa |
| Web Audio por código | Efectos de la rectoría generados al vuelo: no pesan ni tienen licencia; `AudioContext` se reanuda en el primer toque (T43) |
| ElevenLabs | Voz final de La Voz solo con plan de pago activo el día de la generación; todo lo generado en plan gratis se regenera. Se descarga en WAV y se comprime con el pipeline propio |

`optimize-audio` normaliza con EBU R128 a −16 LUFS integrados y pico real de −1,5 dBTP, a 48 kHz, y luego codifica a AAC. El build falla si encuentra un `.ogg` en `public/` o si un archivo se desvía más de 1 LU del objetivo. El −16 LUFS es una convención habitual en móviles, no una norma de juegos; lo importante es que todas las fuentes suenen parejas.

La clave de ElevenLabs nunca va en el repositorio ni en el sitio: la voz se genera desde su web o con un script local que lee la clave de una variable de entorno, y solo el `.m4a` resultante entra al proyecto.

## 1) Estructura de carpetas

El código se separa en cuatro capas que no se importan en círculo: `game/` (reglas puras) ← `engine/` (Three.js) y `ui/` (Preact), unidas por `signals/`; `net/` solo habla con `game/`. Las fuentes de arte viven fuera de `public/` y solo el pipeline escribe en `public/assets/`.

```
la-ultima-prueba/
├─ astro.config.mjs
├─ package.json
├─ tsconfig.json
├─ AGENTS.md  CLAUDE.md          # reglas para agentes de código
├─ docs/
│  ├─ diseno.md                  # documento de diseño (fuente)
│  ├─ investigacion-assets.md    # base de la enmienda v1.1
│  └─ especificacion-tecnica.md  # este documento, exportado
├─ art/                          # fuentes de arte (Git LFS), nunca se publican
│  ├─ credits.json               # v1.1: una entrada por archivo publicado
│  ├─ evidencia/                 # v1.1: capturas de licencia del día de descarga
│  ├─ plantilla-horneado.blend   # v1.1: rehorneado de assets externos
│  ├─ porteria/
│  ├─ s1-cooperativa/  s2-laboratorio/  s3-gimnasio/  s4-biblioteca/  s5-rectoria/
│  │  ├─ originales/              # v1.1: descargas sin tocar (Kenney, Meshy, Sketchfab, Poly Haven)
│  │  ├─ limpios/                 # v1.1: salida de la etapa de limpieza, sin comprimir
│  │  ├─ escena.blend
│  │  ├─ colliders.blend          # cajas de colisión exportadas aparte
│  │  └─ texturas/
│  ├─ props-compartidos/         # sillas, puertas, linterna, avatares
│  └─ audio/                     # WAV originales de La Voz y ambientes
├─ scripts/
│  ├─ optimize-models.ts         # limpieza por fuente + etapa común + asset.copyright
│  ├─ perfiles/                  # v1.1: kenney, meshy, sketchfab, polyhaven, ambientcg, ia-imagen
│  ├─ optimize-audio.ts          # WAV → AAC mono a −16 LUFS
│  ├─ build-manifest.ts          # hash, bytes y triángulos por sala
│  ├─ check-budget.ts            # falla el build si se excede el presupuesto (informa en lab)
│  ├─ check-credits.ts           # v1.1: falla el build sin licencia válida
│  ├─ check-audio.ts             # v1.1: sin .ogg y −16 LUFS ± 1 LU
│  └─ hash-answers.ts            # T23: hash del estado resuelto de cada etapa
├─ public/
│  ├─ _headers                   # Cloudflare Pages: caché inmutable en /assets y /decoders
│  ├─ manifest.webmanifest       # PWA: pantalla completa en iPhone vía «Añadir a inicio»
│  ├─ decoders/                  # meshopt_decoder, basis_transcoder (.js + .wasm)
│  └─ assets/                    # SALIDA del pipeline, no se edita a mano
│     ├─ salas/<sala>/escena.<hash>.glb
│     ├─ audio/es-CO/<sala>/*.m4a
│     └─ manifest.json
├─ supabase/
│  ├─ config.toml
│  └─ migrations/                # políticas RLS de canales privados en realtime.messages
├─ src/
│  ├─ pages/                     # index, jugar, creditos (generada desde credits.json), docentes
│  ├─ layouts/
│  ├─ content.config.ts          # v1.2: colecciones de Astro 7 (usa los esquemas de content/)
│  ├─ content/                   # datos validados en build (Astro content collections)
│  │  ├─ esquema.ts               # v1.2: esquemas zod de puzzles (y luego salas, diálogos, finales)
│  │  ├─ puzzles/                 # v1.2: s1-etiquetadora.json … s5-urna.json
│  │  ├─ respuestas.json          # T23: hashes del estado resuelto; lo escribe hash-answers
│  │  ├─ salas/                   # objetos por rol A–D y escondite de la grabación
│  │  ├─ dialogos/                # líneas de La Voz con tiempos de subtítulo
│  │  └─ finales/
│  ├─ game/                      # REGLAS PURAS: sin DOM, sin Three, sin red
│  │  ├─ partida.ts               # máquina de estados: portería → salas → final
│  │  ├─ reloj.ts                 # 40 min activos, pausa
│  │  ├─ puzzles/                 # v1.2: una función pura por puzzle: estado → condiciones cumplidas
│  │  ├─ pistas.ts                # pistas graduales por tiempo en la etapa o intentos
│  │  ├─ intentos.ts              # T27b: qué cuenta como intento en cada etapa
│  │  ├─ reparto.ts               # roles A–D por número de jugadores y rotación
│  │  ├─ finales.ts
│  │  └─ tipos.ts
│  ├─ engine/                    # Three.js
│  │  ├─ renderer.ts  loop.ts  calidad.ts
│  │  ├─ carga/                   # GLTFLoader + Meshopt + KTX2, caché, dispose, precarga
│  │  ├─ jugador/                 # cámara primera persona y colisiones
│  │  ├─ interaccion/             # raycast, resaltado, inspección
│  │  ├─ avatares/                # otros jugadores interpolados
│  │  ├─ audio/                   # incluye efectos Web Audio por código (rectoría)
│  │  └─ salas/                   # un módulo por sala; s5 crea urna, fichas y mano mecánica por código
│  ├─ debug/                     # v1.1: solo se carga con ?debug=1 o ?lab=1
│  │  ├─ metricas.ts              # signals de métricas, escritas cada 500 ms
│  │  ├─ panel/                   # panel Preact y exportación JSON
│  │  ├─ estres/                  # ejes, escalones, marca en localStorage
│  │  └─ lab/                     # comparación original/optimizado (eliminado en producción)
│  ├─ input/                     # táctil (joystick, mirada, toque), teclado y ratón
│  ├─ ui/                        # Preact
│  │  ├─ hud/                     # reloj, sellos, subtítulos, inventario, botón Usar
│  │  ├─ menus/                   # inicio, pausa, ajustes, sala de espera cooperativa
│  │  ├─ cuaderno/
│  │  ├─ inspeccion/              # vista 2D de objetos con datos
│  │  ├─ mecanismos/              # v1.2: etiquetadora, tanques, reflector, carritos, urna
│  │  └─ finales/                 # pantallas de final y créditos
│  ├─ signals/                   # estado observable compartido por engine/ y ui/
│  ├─ net/                       # Supabase: cliente, canal, protocolo, anfitrión, reconexión
│  ├─ i18n/es-CO.ts
│  └─ styles/
└─ tests/
   ├─ unit/                      # game/, net/protocolo y scripts/check-*
   └─ e2e/                       # Playwright con emulación de celular
```

## 2) Esquema JSON de un puzzle

v1.2: reemplaza el esquema de «pregunta» con cuatro opciones. Cada sala tiene un puzzle: una máquina con una regla matemática que el jugador descubre manipulándola (ver `docs/salas-y-puzzles.md`). No hay opciones ni distractores, y la máquina nunca dice «incorrecto»: muestra lo que pasó.

Cada puzzle es un archivo JSON en `src/content/puzzles/` validado en build con el esquema zod de `src/content/esquema.ts` (la colección se declara en `src/content.config.ts`, como pide Astro 7). Todos los controles son discretos (rodillos, perillas de 1 en 1, muescas, metros enteros, libros, fichas), así que cada estado se compara de forma exacta.

### Campos comunes

| Campo | Tipo | Qué es |
| --- | --- | --- |
| `id` | `s1-etiquetadora` … `s5-urna` | `^s[1-5]-[a-z0-9-]+$`; el número coincide con `sala` |
| `version` | entero ≥ 1 | Sube al cambiar el contenido (`version_contenido` del cooperativo) |
| `sala` | 1 a 5 | Cada sala tiene un mecanismo fijo: 1 etiquetadora, 2 tanques, 3 reflector, 4 carritos, 5 urna |
| `titulo` | texto ≤ 60 | Nombre de la máquina en el juego |
| `tema` | `porcentajes`, `funciones_lineales`, `semejanza_tangente`, `medidas_estadisticas`, `probabilidad_sin_reemplazo` | Concepto que nombra el cuaderno |
| `proceso` | `formular_resolver`, `modelar`, `comunicar`, `razonar`, `procedimientos` | Proceso general principal de los Estándares Básicos de Competencias en Matemáticas del MEN (2006): formular y resolver problemas; modelar procesos y fenómenos de la realidad; comunicar; razonar; formular, comparar y ejercitar procedimientos |
| `grado` | 9, 10 u 11 | Grado en que se estudia el concepto que nombra el cuaderno |
| `dificultad` | 1 a 3 | 1 básica, 2 media, 3 alta |
| `concepto` | texto ≤ 200 | Lo que se descubre |
| `intuicion` | texto ≤ 160 | La intuición común que la etapa «torcer» pone a prueba |
| `mecanismo` | `etiquetadora`, `tanques`, `reflector`, `carritos`, `urna` | Decide la forma de `estado_inicial`, `controles`, `exito` y `solucion` |
| `etapas` | exactamente 3 | `presentar`, `torcer` y `dominar`, en ese orden |
| `pistas` | exactamente 3 | `{ nivel: 1 \| 2 \| 3, tras_segundos, tras_intentos?, texto ≤ 160 }`; se ofrecen por tiempo en la etapa actual o por intentos fallidos en ella |
| `cuaderno` | `{ concepto ≤ 80, texto ≤ 300 }` | Lo que el cuaderno escribe al resolver la sala: «Lo que acabas de descubrir se llama…» |
| `pista_por_jugador` | `{ A, B, C, D }` | `{ objeto, texto ≤ 160 }`; el objeto empieza por `s<sala>-`. En individual el jugador las reúne todas; en cooperativo cada una llega a su rol |

Cada etapa tiene:

| Campo | Qué es |
| --- | --- |
| `id` | `presentar`, `torcer` o `dominar` |
| `situacion` | Lo que el jugador ve al empezar la etapa (≤ 280) |
| `aja` | El momento «ajá» de la etapa, para el docente y el modo práctica (≤ 200) |
| `estado_inicial` | Estado completo de la máquina al empezar la etapa |
| `controles` | Lo que el jugador puede cambiar en esa etapa y con qué valores |
| `exito` | La condición de éxito; se descompone en condiciones con id |
| `solucion` | Un estado que resuelve la etapa, con la misma forma de `estado_inicial` |
| `intento` | Qué cuenta como «intento» en la etapa, para las pistas por intentos (T27b): `{ tipo: "accionar", objeto }` o `{ tipo: "reposo", segundos }` |

### Por mecanismo

| Mecanismo | `estado_inicial` y `solucion` | `controles` | `exito` → condiciones |
| --- | --- | --- | --- |
| `etiquetadora` | `{ producto, precio, rodillos: [] }` | `{ rodillos: [-20, 20, 25, -50, 50], max_rodillos: 2 }` | `{ precio }` → `precio`: el precio impreso, `precio × Π(1 + p/100)`, es el de la pizarra |
| `tanques` | `{ a, b \| null }`, cada tanque `{ nivel, caudal, visible, registro? }` en cm y cm/s | `{ perillas: ["a"], caudal_min, caudal_max, altura_cm }` | `{ campana_s, objetivo: { tipo: "linea", nivel } \| { tipo: "cruce" } }` → `nivel`: al sonar la campana, A está en la línea o A y B tienen la misma altura |
| `reflector` | `{ muesca, postes: [{ id, altura, distancia \| null }], polea \| null }` en grados y metros | `{ muescas, girar, postes_moviles, distancia_min, distancia_max, polea: { min, max } \| null }` | `{ sensores: [ids de poste], marcador: { altura } \| null }` → una condición por poste (su sombra toca su sensor) y `polea` (la longitud es la altura del marcador) |
| `carritos` | `{ carritos: [5 enteros] }` | `{ carritos: 5, libros: 20 }` | `{ lamparas: { media?, mediana?, moda?, rango? } }` → una condición por lámpara encendida |
| `urna` | `{ azules, amarillas }` | `{ max_por_color }` | `{ fichas, juego: "siempre_gana" \| "justo" }` → `fichas` (total pedido) y `juego` (parejas iguales = parejas distintas, o solo iguales) |

En el reflector, la sombra usa razones idealizadas por muesca (sombra ÷ altura: 27° → 2, 37° → 4/3, 45° → 1, 53° → 3/4, 63° → 1/2) para que todo dé en metros enteros o medios. Los tanques se llenan hasta `altura_cm` y no bajan de 0.

### Qué cuenta como intento (T27b)

Las pistas se ofrecen por tiempo o por intentos fallidos en la etapa (`tras_intentos`). Un intento es el momento en que la máquina le muestra al jugador un resultado que no es el buscado. Cada etapa lo declara en `intento`, y `src/game/intentos.ts` lo aplica:

| Sala | Etapas | Regla | Cuenta un intento cuando… |
| --- | --- | --- | --- |
| 1 · Etiquetadora | las tres | `accionar` `s1-palanca` | se baja la palanca y el precio impreso no es el de la pizarra (también sin rodillos) |
| 2 · Tanques | las tres | `accionar` `s2-palanca` | se arranca una corrida que no abre la incubadora; cuenta al arrancar, no al sonar la campana |
| 3 · Reflector | presentar y torcer | `reposo` 5 s | tras mover la muesca o un poste, todo queda quieto 5 s y algún sensor no suena |
| 3 · Reflector | dominar | `accionar` `s3-polea` | se suelta la polea con una longitud que no es la altura del marcador |
| 4 · Carritos | las tres | `reposo` 5 s | con la pila vacía, los libros quedan quietos 5 s y falta alguna lámpara |
| 5 · Urna | las tres | `accionar` `s5-caja-fuerte` | se tira de la manija y la urna no cumple la placa; el simulador y «ver parejas» no cuentan |

Reglas comunes:

- Solo cuenta un estado válido que no resuelve la etapa. Resolver nunca es un intento.
- **`accionar`:** cuenta cada vez que se acciona el objeto, aunque el estado sea el mismo de la vez anterior.
- **`reposo`** (máquinas que responden en vivo y no tienen nada que accionar): el panel avisa cada cambio del mecanismo (`alCambiarEstado`) y suma el tiempo de reloj activo (`avanzarReposo`). Al cumplirse los segundos sin cambios se cuenta un intento, una sola vez; el mismo estado no vuelve a contar hasta que el jugador mueva algo. Con el reloj en pausa (cuaderno abierto) el reposo no avanza.
- **Sala 4:** además, la pila debe estar vacía. Con libros sin repartir el jugador todavía está armando el reparto, y ninguna etapa se puede resolver así (la media 4 exige los 20 libros).
- El contador vuelve a cero al cambiar de etapa (`nuevaEtapa` en `pistas.ts`).
- **Cooperativo:** un intento es cada `resultado` con `resuelta: false`, es decir, cada propuesta aceptada por todos que no resuelve. Lo cuenta el anfitrión; la regla `intento` del JSON vale para el modo individual.

### Sala 2: la corrida dura hasta la campana (T27b)

Una corrida dura exactamente `exito.campana_s` segundos (10, 8 y 12 en las tres etapas); no existe otra duración. Para quien haga el panel (T52):

1. Al bajar la palanca, el panel anima de 0 a `duracionCorridaS(etapa)` en tiempo real: 1 s de juego es 1 s de reloj. Las perillas quedan bloqueadas durante la corrida.
2. La campana suena al final, en el segundo `campana_s`, y en ese instante se evalúa la etapa. El resultado ya se conoce al arrancar (`evaluar`), pero se muestra al sonar la campana.
3. Los niveles quedan quietos unos 2 s para que se vea dónde quedó cada tanque. Luego los tanques se vacían y vuelven al `estado_inicial`, con la perilla donde la dejó el jugador.
4. El eje de tiempo del graficador llega al menos hasta `campana_s`. Se recomienda un eje fijo de 0 a 15 s en las tres etapas, que es el máximo que acepta el esquema.
5. El trazo de la corrida anterior queda dibujado, más tenue, hasta la siguiente: es lo que permite «prolongar la recta».

### Validaciones cruzadas

`esquema.ts` revisa en build lo que zod no expresa por campo:

- el número del `id` coincide con `sala` y el `mecanismo` es el de esa sala;
- las etapas van en orden `presentar`, `torcer`, `dominar`; las pistas en niveles 1, 2, 3 con `tras_segundos` creciente (y `tras_intentos` creciente si existe);
- `estado_inicial` y `solucion` respetan los `controles` (rodillos de la caja y sin repetir, caudales en rango, muescas existentes, libros que alcanzan, fichas por color), y `solucion` solo cambia lo que los controles permiten cambiar;
- `solucion` cumple todas las condiciones de éxito y `estado_inicial` no (con las funciones de `src/game/puzzles/`, T26);
- los objetos de `pista_por_jugador` son de la sala;
- `intento` es `accionar` con un objeto de la sala en la etiquetadora, los tanques, la urna y la etapa del reflector que tiene polea, y `reposo` (de 2 a 30 s) en los carritos y en las etapas del reflector sin polea;
- en los tanques, `campana_s` no pasa de 15.

Las funciones de `src/game/puzzles/` son puras: reciben la etapa y el estado, y devuelven qué condiciones se cumplen. Las usan el panel de cada mecanismo (por ejemplo, para encender las lámparas de la biblioteca en vivo), el modo individual y el anfitrión del cooperativo.

### Hash del estado resuelto (T23)

`npm run hash-answers` recorre todos los estados que se pueden armar en cada etapa (`src/game/puzzles/estados.ts`), se queda con los que la resuelven y guarda el hash de cada uno en `src/content/respuestas.json`. Ese archivo se genera; no se edita a mano.

- **Hash:** los primeros 16 caracteres hexadecimales del SHA-256 de `<id>@<version>#<etapa>|<estado canónico>`. El estado canónico es el JSON del estado con las claves ordenadas; en la etiquetadora los rodillos van ordenados y en los carritos los libros por día van de menor a mayor, porque la máquina no distingue esos órdenes.
- **Validador:** `estaResuelta(RESPUESTAS, puzzle, etapa, estado)` en `src/game/respuestas.ts` devuelve `true` o `false` comparando hashes, sin leer `exito` ni `solucion`. Devuelve `null` si el estado no es válido para la etapa o si los hashes son de otra `version` del puzzle.
- **Cuándo correrlo:** cada vez que cambie un puzzle (y suba su `version`). Un test de unidad falla si `respuestas.json` quedó viejo, y otro comprueba, estado por estado, que el validador y las reglas de `src/game/puzzles/` dicen lo mismo.
- **Qué no hace todavía:** los JSON de los puzzles siguen llevando `solucion` y `exito`, y entran al bundle si el juego importa `src/content/puzzles.ts`. Los paneles necesitan `exito` para las lámparas y sensores en vivo. Quitar `solucion` del bundle es un paso aparte, que este validador ya permite.

Ejemplo con la sala 4. La etapa «torcer» empieza con los libros repartidos parejos (la media ya está verde) y la «dominar» con la solución de la anterior, para que el jugador vea qué lámparas se apagan.

```json
{
  "id": "s4-carritos",
  "version": 1,
  "sala": 4,
  "titulo": "Los carritos de préstamo",
  "tema": "medidas_estadisticas",
  "proceso": "razonar",
  "grado": 9,
  "dificultad": 3,
  "concepto": "Media, mediana, moda y rango miran cosas distintas de un conjunto de datos; juntas pueden determinarlo por completo.",
  "intuicion": "La media y la mediana son más o menos lo mismo.",
  "mecanismo": "carritos",
  "etapas": [
    {
      "id": "presentar",
      "situacion": "Solo está encendida la lámpara MEDIA 4. Reparte los 20 libros en los cinco carritos.",
      "aja": "Hay muchas respuestas: mover un libro de un carrito a otro no apaga la media.",
      "estado_inicial": { "carritos": [0, 0, 0, 0, 0] },
      "controles": { "carritos": 5, "libros": 20 },
      "exito": { "lamparas": { "media": 4 } },
      "solucion": { "carritos": [4, 4, 4, 4, 4] },
      "intento": { "tipo": "reposo", "segundos": 5 }
    },
    {
      "id": "torcer",
      "situacion": "Se encendió la lámpara MEDIANA 3.",
      "aja": "Puedes poner 11 libros en un día y la mediana no se entera: solo mira el del medio.",
      "estado_inicial": { "carritos": [4, 4, 4, 4, 4] },
      "controles": { "carritos": 5, "libros": 20 },
      "exito": { "lamparas": { "media": 4, "mediana": 3 } },
      "solucion": { "carritos": [1, 2, 3, 3, 11] },
      "intento": { "tipo": "reposo", "segundos": 5 }
    },
    {
      "id": "dominar",
      "situacion": "Las cuatro lámparas están encendidas: MEDIA 4, MEDIANA 3, MODA 2 y RANGO 7.",
      "aja": "Con cuatro pistas solo hay una semana posible, salvo el orden de los días.",
      "estado_inicial": { "carritos": [1, 2, 3, 3, 11] },
      "controles": { "carritos": 5, "libros": 20 },
      "exito": { "lamparas": { "media": 4, "mediana": 3, "moda": 2, "rango": 7 } },
      "solucion": { "carritos": [2, 2, 3, 4, 9] },
      "intento": { "tipo": "reposo", "segundos": 5 }
    }
  ],
  "pistas": [
    { "nivel": 1, "tras_segundos": 120, "tras_intentos": 3, "texto": "Mueve un libro de un carrito a otro. ¿Se apagó la lámpara de la media?" },
    { "nivel": 2, "tras_segundos": 240, "tras_intentos": 6, "texto": "Ordena los carritos de menor a mayor. ¿Cuál mira la mediana?" },
    { "nivel": 3, "tras_segundos": 360, "tras_intentos": 9, "texto": "Si la moda es 2, al menos dos días tuvieron 2 libros. ¿Y dónde queda el mayor si el rango es 7?" }
  ],
  "cuaderno": {
    "concepto": "Medidas de tendencia central y de dispersión",
    "texto": "Media, mediana, moda y rango miran cosas distintas. El rango es una medida de dispersión: dice qué tan separados están los datos. En 10° conocerás otra, la desviación estándar."
  },
  "pista_por_jugador": {
    "A": { "objeto": "s4-pila-libros", "texto": "La pila tiene exactamente 20 libros: ni uno más ni uno menos." },
    "B": { "objeto": "s4-mostrador", "texto": "Desde el mostrador se ven las cuatro lámparas del resumen semanal." },
    "C": { "objeto": "s4-ficha-rota", "texto": "En el pedazo de ficha se lee «moda» subrayada dos veces." },
    "D": { "objeto": "s4-carritos", "texto": "Los carritos van de lunes a viernes; el orden de los días no importa." }
  }
}
```

## 3) Protocolo del modo cooperativo

Cada partida usa un canal privado de Supabase Realtime (`partida:K7MP`) y un anfitrión autoritativo: quien crea la partida decide reloj, objetos, etapas resueltas y finales; los demás envían intenciones y reciben eventos numerados. Los mensajes llevan identificadores, nunca textos, porque cada cliente ya tiene el contenido.

```mermaid
flowchart LR
    A["D propone un estado<br/>int: proponer"] --> B["Se difunde<br/>evt: propuesta"]
    B --> C["Todos confirman<br/>int: confirmar"]
    C --> D{"¿Todos aceptan?"}
    D -- "no: la propuesta se anula" --> A
    D -- "sí" --> E["Anfitrión evalúa<br/>condiciones del puzzle"]
    E --> F{"¿Correcta?"}
    F -- "sí" --> G["Sello obtenido<br/>se abre la puerta"]
    F -- "no" --> H["La máquina muestra<br/>lo que pasó"]
    H -- "otra propuesta" --> A
```

*Un estado del mecanismo solo se acciona cuando todo el grupo lo acepta. int = intención al anfitrión · evt = evento para todos.*

Un rechazo anula la propuesta y el rol D vuelve a proponer. Si la etapa no queda resuelta, la máquina muestra lo que pasó (sin mensaje de «incorrecto») y el intento cuenta para las pistas. v1.2: `estado` es el estado discreto del mecanismo (solo números e ids, nunca texto), con la forma de `solucion` en la sección 2.

### Canal y presencia

- Sesión anónima de Supabase; el alias se elige de una lista, sin nombres reales.
- Código de 4 caracteres de un alfabeto sin símbolos confusos (sin 0, O, 1, I, L). Máximo 4 jugadores; el quinto recibe `rechazo { motivo: "llena" }`.
- Tres nombres de evento Broadcast: `int` (intenciones, con `ack`), `evt` (eventos del anfitrión) y `dir` (poses y señales, sin `ack`). `self: true` para que el anfitrión procese sus propias intenciones por la misma ruta.
- Presence guarda solo identidad: `{ jugador, alias, color, unido_en, version_contenido }`. Se escribe una vez al unirse, porque Supabase permite 5 llamadas de Presence por cliente cada 30 s; el estado «listo» va por Broadcast.

### Sobre de cada mensaje

```json
{ "v": 1, "t": "proponer", "de": "j_3f9a", "cid": "j_3f9a-12", "n": null, "p": { } }
```

`v` versión del protocolo · `t` tipo · `de` emisor · `cid` id de la intención, para descartar duplicados · `n` número de secuencia (solo en eventos del anfitrión) · `p` contenido. Máximo 1 KB por mensaje; el `estado` completo, máximo 8 KB.

### Intenciones: jugador → anfitrión (`int`)

| `t` | `p` | El anfitrión acepta si… |
| --- | --- | --- |
| `listo` | `{ listo }` | La partida no ha empezado |
| `recoger` | `{ objeto }` | El objeto está libre y en la sala del jugador |
| `pasar` | `{ objeto, a }` | El emisor lo tiene y el destino está en la misma sala |
| `usar` | `{ herramienta, objetivo }` | El emisor tiene la herramienta; entonces emite `revelado` |
| `proponer` | `{ puzzle, etapa, estado }` | El emisor tiene el rol D en esa sala |
| `confirmar` | `{ propuesta, acepta }` | La propuesta sigue abierta; un voto por jugador |
| `pedir_pista` | `{ puzzle }` | El siguiente nivel ya está habilitado por intentos o tiempo |
| `nota` | `{ op: agregar \| editar \| borrar, id, texto }` | Texto de 280 caracteres o menos |
| `votar` | `{ asunto: pausa \| reanudar \| sala \| final \| ayuda, opcion? }` | Siempre; se resuelve por unanimidad |
| `pedir_estado` | `{ desde_n }` | Siempre; responde con `estado` |

### Eventos: anfitrión → todos (`evt`)

| `t` | `p` | Cuándo |
| --- | --- | --- |
| `estado` | Foto completa: fase, reloj, sellos, grabaciones, portadores, roles, propuesta abierta, pistas, cuaderno | Al unirse alguien, tras un hueco de secuencia, cada 15 s y al cambiar de anfitrión |
| `inicio` | `{ roles }` | Al empezar |
| `roles` | `{ sala, A, B, C, D }` | Al entrar el grupo a una sala; rotan según la tabla del diseño |
| `objeto` | `{ objeto, portador \| null, sala }` | Tras recoger, pasar o soltar |
| `revelado` | `{ objeto, por }` | Tras usar una herramienta sobre un objeto con datos |
| `propuesta` | `{ id, puzzle, etapa, por, estado }` | Tras `proponer`; anula la propuesta anterior |
| `confirmacion` | `{ propuesta, jugador, acepta }` | Tras cada `confirmar` |
| `resultado` | `{ puzzle, etapa, condiciones, resuelta, sello? }` | Cuando todos los conectados aceptaron |
| `pista` | `{ puzzle, nivel }` | Tras `pedir_pista` aceptada |
| `nota` | `{ op, id, texto, autor }` | Tras cada `nota` |
| `voto` | `{ asunto, votos, resuelto }` | Tras cada `votar` |
| `reloj` | `{ restante_ms, pausado }` | Solo al pausar o reanudar; no hay ticks |
| `grabacion` | `{ fragmento, por }` | Al encontrar un fragmento |
| `final` | `{ final }` | Al resolverse el voto de final, la ayuda o el tiempo |
| `anfitrion` | `{ jugador }` | Al migrar el anfitrión |

### Directos: jugador → todos, sin autoridad (`dir`)

| `t` | `p` | Frecuencia |
| --- | --- | --- |
| `pose` | `{ s: sala, x, y, z: cm enteros, yaw: centésimas de grado }` | 4 Hz solo en movimiento, más una al detenerse; los demás interpolan con 150 ms de retraso |
| `senal` | `{ s, x, y, z, frase? }` | Máximo 1 por segundo; frases rápidas predefinidas |

### Reglas de consistencia

- **Orden:** los eventos llevan `n` creciente. Si un cliente detecta un hueco, envía `pedir_estado` y aplica la foto completa. Las intenciones repetidas con el mismo `cid` se ignoran.
- **Reloj:** el anfitrión guarda el tiempo restante; cada cliente descuenta con su reloj local desde que recibe `reloj` o `estado`, y cada `estado` corrige la deriva. La pausa exige que todos voten a favor.
- **Avance en grupo:** todo el grupo está siempre en la misma sala. Para pasar a la siguiente, o volver a una anterior a buscar grabaciones, se vota `sala` por unanimidad; el anfitrión emite `roles` de la nueva sala y todos los clientes la cargan.
- **Confirmar una etapa:** una propuesta solo se acciona cuando todos los conectados aceptan; un rechazo o una propuesta nueva la anula. Elegir final y usar el intercomunicador siguen la misma unanimidad, para que nadie termine la partida por los demás.
- **Desconexión:** al salir de Presence, los objetos del jugador quedan reservados 60 s y luego quedan en el piso de la sala; si tenía el rol D, se reasigna. Al volver con el mismo `jugador` (guardado en el navegador), recupera rol y objetos.
- **Migración de anfitrión:** si el anfitrión falta 5 s, asume el jugador con `unido_en` más antiguo; pausa el reloj, emite `anfitrion` y `estado` desde su última copia, y reanuda a los 3 s.
- **Versiones:** si `v` o `version_contenido` no coinciden, se rechaza la unión con el mensaje «Actualiza la página».

### Reparto y rotación de encargos (T29)

`src/game/reparto.ts` calcula quién tiene cada encargo. Es una función pura de la lista de jugadores, en el orden en que se unieron (`unido_en`), y del número de la sala: el anfitrión la usa para emitir `inicio` y `roles`, y cualquier cliente puede recalcularla.

| Jugadores | Sala 1 | Sala 2 | Sala 3 | Sala 4 | Sala 5 |
| --- | --- | --- | --- | --- | --- |
| 1 (individual) | ABCD | ABCD | ABCD | ABCD | ABCD |
| 2 | AB · CD | CD · AB | AB · CD | CD · AB | AB · CD |
| 3 | A · BC · D | BC · D · A | D · A · BC | A · BC · D | BC · D · A |
| 4 | A · B · C · D | B · C · D · A | C · D · A · B | D · A · B · C | A · B · C · D |

Cada celda lista los encargos del jugador 1, del 2, y así en orden. La sala 1 es la tabla de `docs/diseno.md`. En cada sala siguiente, cada jugador recibe el grupo de encargos que tenía el jugador siguiente, así que D (quien acciona la máquina) pasa por todo el grupo y nadie lo repite en dos salas seguidas. Los grupos no se parten: con 3 jugadores, B y C siempre van juntos.

- El reparto depende de la sala, no de cuántas veces se entró: volver a una sala anterior devuelve el mismo reparto.
- El orden de los jugadores queda fijo al empezar la partida, aunque alguien se desconecte.
- **Suplente de D** (`repartirConectados`): si quien tiene D está desconectado, D pasa al siguiente jugador conectado en ese orden; A, B y C no se mueven. Cuando el ausente vuelve, recupera D.
- Con 4 jugadores y 5 salas, la sala 5 repite el reparto de la sala 1.

### Costo frente a los límites de Supabase

Supabase cuenta un evento por cada mensaje enviado o entregado, así que una pose que reciben tres compañeros cuesta 4 eventos. Con la mitad del grupo moviéndose a 4 Hz, una partida de 4 gasta unos 32 eventos/s y un salón de 10 grupos, unos 320/s.

| Plan | Eventos por segundo | Conexiones simultáneas | Partidas de 4 a la vez (aprox.) |
| --- | --- | --- | --- |
| Free | 100 | 200 | 3 |
| Pro | 500 | 500 | 15 |
| Pro sin tope de gasto | 2.500 | 10.000 | 75 |

Con el máximo previsto de 2 partidas simultáneas (unos 64 eventos/s), el plan Free alcanza con margen. Si Supabase desconecta por exceso (`tenant_events`), el cliente baja las poses a 2 Hz al reconectar. Fuente: [Realtime Limits, Supabase](https://supabase.com/docs/guides/realtime/limits), consultada el 5 de noviembre de 2026.

## 4) Lista de tareas en orden

Son 128 tareas de 20 a 55 minutos, unas 99 horas en total: las 102 originales (79 h) más 26 de la enmienda v1.1 (T11a–T11z, 20 h). El orden prioriza un recorte vertical jugable en celular (portería + sala 1, modo individual) antes de producir las otras salas y el cooperativo. Cada tarea termina con algo verificable: un test, una medición o una prueba en el celular de referencia.

### Fase 0 · Base del proyecto

- [ ] **T01** Crear el repositorio con Astro, TypeScript estricto, Preact, Signals, ESLint y Prettier — 40 min
- [ ] **T02** Conectar Cloudflare Pages con vistas previas por rama y `_headers` de caché — 30 min
- [ ] **T03** Página `/jugar` con isla `client:only`, canvas a pantalla completa, viewport y safe-area — 45 min
- [ ] **T04** Detectar WebGL2 y mostrar la pantalla de equipo no compatible — 20 min
- [ ] **T05** Configurar Vitest y Playwright con perfiles de celular y una prueba de humo — 45 min

### Fase 1 · Pipeline de modelos, presupuesto y laboratorio de assets (v1.1: T11a–T11z)

- [ ] **T06** Script `optimize-models`: dedup, prune, weld, instance, quantize y meshopt — 50 min
- [x] **T07** Añadir KTX2 (ETC1S y UASTC) y el límite de 1024² al pipeline — 50 min
- [x] **T08** Script `build-manifest`: hash, bytes y triángulos por sala — 40 min
- [x] **T09** Script `check-budget`: falla el build si una sala excede el presupuesto — 40 min
- [x] **T10** Servir los decodificadores y cargar un GLB de prueba con Meshopt + KTX2 — 40 min
- [ ] **T11** Medir una escena de estrés (60k triángulos, 40 draw calls) en el celular de referencia — 45 min
- [ ] **T11a** (v1.1) `optimize-models` lee la `fuente` en `art/credits.json` y aplica su perfil de limpieza — 45 min
- [ ] **T11b** (v1.1) Perfil Kenney: escala por pack, `join`, `instance` y `palette` — 45 min
- [ ] **T11c** (v1.1) Perfil Sketchfab: quitar cámaras, luces y nodos vacíos; eje +Y, escala, pivote y `simplify` a 6k — 50 min
- [ ] **T11d** (v1.1) Perfil Meshy: pivote en la base, escala a metros, `simplify` y revisión de luz horneada — 40 min
- [ ] **T11e** (v1.1) Perfiles Poly Haven, ambientCG e imágenes de IA: 1024 px, solo color en entorno, mapas extra solo en interactivos — 45 min
- [ ] **T11f** (v1.1) Plantilla de Blender para rehornear assets externos con el lightmap de la sala (UV2, Cycles, exportación) — 55 min
- [ ] **T11g** (v1.1) Esquema de `art/credits.json`, carpeta de evidencias y escritura de `asset.copyright` en cada GLB — 50 min
- [ ] **T11h** (v1.1) Script `check-credits` con todas las reglas de licencia y sus tests — 50 min
- [ ] **T11i** (v1.1) Página `/creditos` generada desde el manifiesto y agrupada por sala — 45 min
- [ ] **T11j** (v1.1) Script `check-audio`: sin `.ogg` en `public/` y −16 LUFS ± 1 LU — 35 min
- [ ] **T11k** (v1.1) Bandera `PUBLIC_LAB`, `build:lab` con originales y `noindex`, y exclusión total en producción — 45 min
- [ ] **T11l** (v1.1) Modo `?lab=1`: alternar original y optimizado con la misma cámara, alambre y tabla de diferencias — 55 min
- [ ] **T11m** (v1.1) Módulo `debug/metricas.ts`: tiempo de cuadro, `renderer.info`, memoria estimada, `transferSize` y carga — 55 min
- [ ] **T11n** (v1.1) Panel `?debug=1` y 3 toques: colores contra el presupuesto y exportación JSON — 50 min
- [ ] **T11o** (v1.1) Motor de estrés: marca en `localStorage`, calentamiento, medición de 5 s y criterio de parada — 55 min
- [ ] **T11p** (v1.1) Ejes de estrés: triángulos y draw calls — 45 min
- [ ] **T11q** (v1.1) Ejes de estrés: texturas y píxeles — 45 min
- [ ] **T11r** (v1.1) Detección de recarga por memoria, `dispose()` al detener y verificación de `renderer.info.memory` — 40 min
- [ ] **T11s** (v1.1) Cooperativa: elegir packs de Kenney y registrarlos en el manifiesto — 30 min
- [ ] **T11t** (v1.1) Laboratorio: generar instrumentos en Meshy (plan gratis, límite de caras) y registrarlos con evidencia — 50 min
- [ ] **T11u** (v1.1) Gimnasio: elegir modelos CC BY de Sketchfab y guardar captura de su licencia — 45 min
- [ ] **T11v** (v1.1) Biblioteca: descargar a mano modelos de Poly Haven en 1k y registrarlos — 40 min
- [ ] **T11w** (v1.1) Rectoría: urna, fichas y mano mecánica generadas por código dentro del presupuesto — 50 min
- [ ] **T11x** (v1.1) Rectoría: imágenes de IA a KTX2 y efectos con Web Audio, registrados en el manifiesto — 45 min
- [ ] **T11y** (v1.1) Correr el estrés en un Android de 2 GB y un iPhone reales; fijar perfiles bajo, medio y alto — 55 min
- [ ] **T11z** (v1.1) Tabla comparativa por fuente y dispositivo; decidir qué fuentes siguen en las salas definitivas — 40 min

### Fase 2 · Motor y controles táctiles

- [x] **T12** Renderer y bucle con DPR limitado; pausa al ocultar la pestaña — 40 min
- [ ] **T13** Escala dinámica de resolución según los fps medidos — 45 min
- [x] **T14** Cámara en primera persona y mirada por arrastre en la mitad derecha — 50 min
- [x] **T15** Joystick virtual multitáctil en la mitad izquierda — 50 min
- [ ] **T16** Exportar cajas de colisión desde Blender y cargarlas — 30 min
- [x] **T17** Colisión de cápsula contra cajas, sin atravesar paredes — 50 min
- [x] **T18** Toque sobre objetos: raycast, resaltado y botón «Usar» — 50 min
- [x] **T19** Teclado y ratón con bloqueo de puntero en escritorio — 30 min
- [x] **T19b** (nueva) Salas por código: portería y 5 salas con primitivas de Three.js según `docs/salas-y-puzzles.md`, con su distribución en `src/content/salas.json` — 55 min
- [x] **T19c** (nueva) Ids de objetos únicos: los objetos de `src/content/salas.json` son la fuente de verdad, y un test falla si un puzzle o el código de `src/` nombra un objeto que no existe en su sala — 30 min
- [x] **T20** Cargador de salas: `compileAsync`, liberación de memoria y precarga de la siguiente — 55 min

### Fase 3 · Lógica de juego (sin gráficos)

- [x] **T21** (v1.2) Tipos y esquema de puzzle en content collections: etapas, estado inicial, controles, condición de éxito, pistas, cuaderno y pistas por rol, con validaciones cruzadas — 45 min
- [x] **T22** (v1.2) Escribir los 5 puzzles en JSON con sus tres etapas, soluciones, pistas y pistas por rol — 50 min
- [x] **T23** (v1.2) Script `hash-answers`: hash del estado resuelto de cada etapa y validador que compara hashes — 45 min
- [x] **T24** Máquina de estados de la partida: portería, salas y final — 50 min
- [x] **T25** Reloj de 40 minutos activos con pausa, con tests — 40 min
- [x] **T26** (v1.2) Una función pura por puzzle en `src/game/puzzles/` que recibe el estado y dice qué condiciones se cumplen, con tests — 50 min
- [x] **T27** Pistas graduales por intentos o tiempo en la etapa — 35 min
- [x] **T27b** (nueva) Qué cuenta como «intento» en cada puzzle (`intento` por etapa y `src/game/intentos.ts`) y duración de la corrida de la sala 2 atada a la campana — 45 min
- [x] **T28** Sellos, grabaciones y reglas de los cuatro finales, con un test por final — 50 min
- [x] **T29** Reparto de roles A–D por número de jugadores y rotación entre salas, con tests — 40 min
- [x] **T30** Guardar y reanudar la partida individual tras recargar — 40 min

### Fase 4 · HUD y menús (Preact + Signals)

- [x] **T31** Store de signals y puente con el motor — 40 min
- [x] **T32** Menú de inicio: jugar solo, crear partida, unirse con código — 45 min
- [x] **T33** HUD: reloj, sellos, inventario y botón «Usar» — 50 min
- [ ] **T34** Subtítulos de La Voz sincronizados con el audio (guion de `docs/salas-y-puzzles.md`) — 45 min
- [x] **T35** Vista de inspección 2D para objetos con datos — 50 min
- [x] **T36** Cuaderno: datos encontrados, notas y pausa del reloj — 55 min
- [ ] **T37** (v1.2) Marco común de los paneles de mecanismo: controles discretos, botón de accionar y respuesta visible de la máquina — 50 min
- [ ] **T38** (v1.2) Panel de pistas graduales y texto del cuaderno al resolver — 35 min
- [ ] **T39** Ajustes: sensibilidad, modo zurdo, tamaño de texto y volumen — 45 min
- [x] **T40** Pantallas de final, créditos y poscréditos — 45 min
- [x] **T41** Accesibilidad: objetivos táctiles de 44 px, contraste, foco y lector de pantalla — 50 min

### Fase 5 · Audio

- [ ] **T42** Script `optimize-audio`: WAV a AAC mono normalizado a −16 LUFS (v1.1) — 40 min
- [ ] **T43** Desbloqueo de audio en iOS tras el primer toque y mezcla de voz y ambiente — 40 min

### Fase 6 · Recorte vertical: portería y sala 1

- [ ] **T44** Blockout de portería y sala 1 con cajas de colisión — 55 min
- [ ] **T45** (v1.2) Sala 1: etiquetadora con rodillos y palanca, pizarra de precios y registradora, en tres etapas — 50 min
- [ ] **T46** Props de la sala 1, lote 1: caja, registradora, menú — 55 min
- [ ] **T47** Props de la sala 1, lote 2: estanterías y ambientación — 55 min
- [ ] **T48** Hornear el lightmap de la sala 1 y exportar — 45 min
- [ ] **T49** Pasar el pipeline, verificar presupuesto y probar en el celular de referencia — 40 min
- [ ] **T50** Prueba de juego de portería + sala 1 con dos estudiantes — 45 min

### Fase 7 · Salas 2 a 5

- [ ] **T51** Sala 2: blockout del laboratorio con colisiones — 55 min
- [ ] **T52** (v1.2) Sala 2: tanques con perillas, graficador, campana y hoja de ayer, en tres etapas — 50 min
- [ ] **T53** Sala 2: props, lote 1 — 55 min
- [ ] **T54** Sala 2: props, lote 2 — 55 min
- [ ] **T55** Sala 2: lightmap y exportación — 45 min
- [ ] **T56** Sala 2: presupuesto y prueba en celular — 40 min
- [ ] **T57** Sala 3: blockout del gimnasio con colisiones — 55 min
- [ ] **T58** (v1.2) Sala 3: reflector con muescas, postes, sensores y polea, en tres etapas — 50 min
- [ ] **T59** Sala 3: props, lote 1 — 55 min
- [ ] **T60** Sala 3: props, lote 2 — 55 min
- [ ] **T61** Sala 3: lightmap y exportación — 45 min
- [ ] **T62** Sala 3: presupuesto y prueba en celular — 40 min
- [ ] **T63** Sala 4: blockout de la biblioteca con colisiones — 55 min
- [ ] **T64** (v1.2) Sala 4: carritos, pila de 20 libros y lámparas en vivo, en tres etapas — 50 min
- [ ] **T65** Sala 4: props, lote 1 — 55 min
- [ ] **T66** Sala 4: props, lote 2 — 55 min
- [ ] **T67** Sala 4: lightmap y exportación — 45 min
- [ ] **T68** Sala 4: presupuesto y prueba en celular — 40 min
- [ ] **T69** Sala 5: blockout de la rectoría con colisiones — 55 min
- [ ] **T70** (v1.2) Sala 5: urna, simulador de 100 extracciones y «ver parejas», en tres etapas — 50 min
- [ ] **T71** Sala 5: props, lote 1 — 55 min
- [ ] **T72** Sala 5: props, lote 2 — 55 min
- [ ] **T73** Sala 5: lightmap y exportación — 45 min
- [ ] **T74** Sala 5: presupuesto y prueba en celular — 40 min
- [ ] **T75** Esconder las tres grabaciones en las salas 2, 3 y 4 con su audio (escondites de `docs/salas-y-puzzles.md`) — 45 min
- [ ] **T76** Volver a salas anteriores: recarga desde caché y estado conservado — 45 min
- [ ] **T77** Elección de final en la portería y prueba individual de punta a punta — 40 min

### Fase 8 · Cooperativo

- [ ] **T78** Proyecto Supabase: sesión anónima y canal privado con políticas RLS — 45 min
- [ ] **T79** Módulo `net`: conexión, canal y Presence — 50 min
- [ ] **T80** Sobre de mensajes y validación de versión, tipo y tamaño — 40 min
- [ ] **T81** Sala de espera: código, lista de jugadores, «listo» e iniciar — 50 min
- [ ] **T82** Poses a 4 Hz e interpolación de los demás jugadores — 55 min
- [ ] **T83** Avatares de bajo polígono con color y alias — 45 min
- [ ] **T84** Anfitrión: recoger, pasar y usar objetos — 55 min
- [ ] **T85** Flujo de propuesta, confirmación y resultado — 55 min
- [ ] **T86** Pistas por rol y cuaderno compartido — 50 min
- [ ] **T87** Votos de pausa, cambio de sala, final y ayuda, con reloj sincronizado — 45 min
- [ ] **T88** Secuencia, foto periódica y resincronización — 50 min
- [ ] **T89** Reconexión del mismo jugador con rol y objetos — 45 min
- [ ] **T90** Migración de anfitrión — 55 min
- [ ] **T91** Señalar y frases rápidas — 40 min
- [ ] **T92** Prueba de carga con partidas simuladas para medir eventos por segundo — 50 min
- [ ] **T93** Prueba con cuatro celulares reales en datos móviles — 45 min

### Fase 9 · Rendimiento y lanzamiento

- [ ] **T94** Service worker: precarga del núcleo y caché de salas visitadas — 50 min
- [ ] **T95** Manifiesto PWA para pantalla completa en iPhone — 30 min
- [ ] **T96** Pruebas en Safari de iOS: memoria, audio y gestos — 50 min
- [ ] **T97** Perfilar en el celular de referencia y corregir el mayor cuello de botella — 55 min
- [ ] **T98** Analítica sin cookies ni datos personales — 30 min
- [ ] **T99** Página de guía para docentes — 45 min
- [ ] **T100** Piloto con un grupo de grado 10 (y algunos de grado 9) — 55 min
- [ ] **T101** Convertir los hallazgos del piloto en tareas de menos de una hora — 40 min
- [ ] **T102** Publicación: dominio, versión de contenido y etiqueta en git — 30 min

## Riesgos y decisiones abiertas

| Riesgo | Efecto | Mitigación |
| --- | --- | --- |
| Crecer a más de 3 partidas simultáneas en el plan Free de Supabase | Desconexiones por exceso de eventos a partir de unas 3 partidas | Por ahora el límite es 2 partidas: el plan Free basta. Pasar a Pro antes de crecer; poses a 2 Hz como respaldo; medir en T92 |
| iPhone no admite la API de pantalla completa en Safari | Barras del navegador ocupan pantalla y gestos chocan con el joystick | PWA instalada (T95) y márgenes de gestos en el HUD |
| Las soluciones viajan en el cliente | Un estudiante puede leerlas con herramientas del navegador | Hash del estado resuelto en el bundle (T23); como los puzzles se resuelven experimentando, se acepta el riesgo restante |
| El arte supera el presupuesto | Bajan los fps en gama baja | `check-budget` rompe el build (T09) y prueba en celular al cerrar cada sala |
| Datos de menores de edad | Obligaciones de la Ley 1581 de 2012 | Sesión anónima, alias de lista, sin chat libre ni voz, analítica sin datos personales |
| Guion y voz de La Voz | Sin audio final no se cierran subtítulos ni tiempos | Producción de contenido fuera de esta lista; usar voz temporal desde T34 |
| Tripo en plan gratis (v1.1) | Su página de precios habla de CC BY 4.0, pero su ayuda oficial dice que Tripo conserva los derechos de lo generado en plan gratis | No usar Tripo en plan gratis; check-credits lo rechaza (T11h) |
| ElevenLabs en plan gratis (v1.1) | Sin licencia comercial; exige mencionar elevenlabs.io en el título, y la licencia sigue al archivo aunque se suba de plan después | Voz solo con plan de pago activo; regenerar todo lo hecho en plan gratis |
| Meshy en plan gratis (v1.1) | CC BY 4.0: uso comercial solo con crédito a Meshy | Crédito obligatorio vía check-credits; plan de pago para la versión final |
| Sketchfab: licencia por modelo (v1.1) | Conviven CC BY, NC y ND; KitBash compró Sketchfab en agosto de 2026 y los términos pueden cambiar | Solo CC BY; captura de la licencia al descargar (art/evidencia/) |
| API de Poly Haven (v1.1) | Los assets son CC0, pero la API es solo para uso no comercial salvo licencia aparte | Descarga manual desde la web; ningún script llama a la API |
| Freesound con licencias mezcladas (v1.1) | Conviven CC0, CC BY, CC BY-NC y Sampling+ antiguo | Solo CC0 y CC BY; Sampling+ se trata como no comercial |
| Salidas de IA sin copyright (v1.1) | En EE. UU., el material generado totalmente por IA no tiene copyright: otros pueden copiarlo | Lo protegible es la selección, la edición y el juego completo; no depender de la exclusividad de esos assets |
| Marcas dentro de modelos o imágenes (v1.1) | Un modelo CC0 o CC BY puede mostrar logos o productos; esas licencias no cubren marcas (sin confirmar) | Revisar texturas y quitar logos, productos y personajes reconocibles |
| Nombres «Saber 11» e ICFES (v1.2) | El juego no tiene relación con ellos y podría parecer un aval oficial | No usar esos nombres ni sus logos en el juego, el sitio ni los assets |
| Parecido con personajes o personas (v1.1) | Una imagen o modelo de IA puede imitar personajes protegidos o la imagen de alguien | Prompts genéricos; revisar cada resultado antes de publicarlo |
| Safari en iPhone recarga la pestaña por memoria (v1.1) | Se pierde la partida sin aviso y el límite no se ve en las métricas | Marca en localStorage antes de cada escalón de estrés (T11o) y guardado local de la partida (T30) |

Decisiones abiertas:

- [ ] Conseguir un Android de 2 GB de un colegio objetivo para las pruebas de rendimiento.
- [x] Decidido: el grupo avanza junto de sala en sala.
- [x] Decidido: plan Free de Supabase, con un máximo de 2 partidas simultáneas por ahora.
