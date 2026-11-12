# La Última Prueba — Investigación técnica de assets

Nov 5, 2026 · @Alex Echeverry

Si algo choca con AGENTS.md o con la especificación, mandan ellos

## Resumen

La mayor parte del proceso es igual para todas las fuentes: todo termina en un GLB con geometría meshopt y texturas KTX2 de 1024 px, cargado con `GLTFLoader` + `KTX2Loader` + `MeshoptDecoder`. Lo que cambia por fuente es la limpieza previa (escala, pivote, materiales, exceso de triángulos) y, sobre todo, la licencia.

- **Sin riesgo de licencia:** Kenney, Poly Haven y ambientCG son CC0, uso comercial sin atribución.
- **Con atribución obligatoria:** Sketchfab (solo modelos CC BY) y Meshy en plan gratuito (CC BY 4.0).
- **Evitar en plan gratuito:** Tripo (la información oficial se contradice) y ElevenLabs (prohíbe el uso comercial).
- **Cambio reciente:** KitBash compró Sketchfab a Epic en agosto de 2026; las descargas siguen, pero los términos pueden cambiar.
- **Mayor riesgo técnico:** Safari en iPhone recarga la pestaña sin aviso cuando se pasa de memoria; la prueba de estrés debe guardar su progreso antes de cada paso.

No pude verificar los detalles de halloween.dev (The Last Deploy): uso tu descripción como referencia. Cada punto sin confirmar está marcado con **(sin confirmar)**.

## Tabla comparativa de fuentes

Las tres fuentes CC0 son las más seguras para una muestra comercial; Sketchfab y la IA exigen revisar la licencia asset por asset.

| Fuente | Qué entrega | Licencia y atribución | Peso y triángulos típicos | Problemas comunes |
| --- | --- | --- | --- | --- |
| [Kenney](https://kenney.nl/support) | Packs con GLB/glTF, OBJ y FBX; audio en OGG o WAV | CC0, uso comercial; crédito opcional | Low-poly, texturas pequeñas tipo paleta **(cifras sin confirmar: medir con `inspect`)** | Muchas piezas sueltas = muchas llamadas de dibujo; escala distinta entre packs |
| [Poly Haven](https://polyhaven.com/license) | Modelos en glTF, Blend y FBX con texturas de 1k a 8k | CC0, uso comercial sin atribución; la [API](https://polyhaven.com/our-api) requiere licencia para uso comercial | Fotorrealista, texturas grandes; triángulos variables **(sin confirmar)** | Texturas de 2k–8k que hay que bajar a 1024; varios mapas por material |
| [Sketchfab](https://help.sketchfab.com/en/articles/16152669-gltf-glb-and-usdz) (solo CC BY) | Conversión automática a glTF, GLB y USDZ; GLB con texturas originales, 4k o 1k | Licencia por modelo; CC BY exige atribución; NC y ND no sirven para uso comercial | Muy variable: de cientos a millones de triángulos | Escala y orientación arbitrarias; materiales que glTF no soporta se pierden |
| [ambientCG](https://docs.ambientcg.com/license) | Materiales PBR (JPG/PNG) hasta 8K, más HDRI | CC0, uso comercial incluso redistribuyendo archivos | Solo texturas: 4–6 mapas por material | Hay que empaquetar ORM y repetir (tiling) bien la textura |
| [Meshy](https://docs.meshy.ai/en/webapp/pricing) | GLB, FBX, OBJ, USDZ, Blend, STL, 3MF | Gratis: CC BY 4.0 con crédito a Meshy; pago: privado y comercial | Remesh por defecto de 30.000 polígonos según su [API](https://docs.meshy.ai/api/remesh.md) | Iluminación horneada en la textura, pivote y escala sin normalizar |
| Tripo | GLB (triángulos) o FBX (quads) | Pago: comercial. Gratis: contradictorio **(ver Riesgos)** | Adaptativo hasta \~1,4 M de caras; Smart Low Poly de 500 a 20.000 ([ComfyUI](https://docs.comfy.org/built-in-nodes/TripoTextToModelNodeV2.md)) | Mismo que Meshy; texturas de 2K por defecto |

Sketchfab cambió de dueño: [KitBash la compró a Epic](https://80.lv/articles/artstation-and-sketchfab-have-been-acquired-by-kitbash) y anunció el 10 de agosto de 2026 que no habría cambios inmediatos.

## Proceso común paso a paso

Cada asset pasa por los mismos nueve pasos; solo el paso 3 (limpieza) cambia de forma importante según la fuente.

1. **Registrar antes de tocar.** Guarda el archivo original sin modificar en `assets-src/` y crea su entrada en el manifiesto de créditos (ver sección de créditos). La optimización es destructiva.
2. **Convertir a glTF.** Si llega en FBX u OBJ, ábrelo en Blender y expórtalo como glTF 2.0 binario (GLB).
3. **Normalizar (específico por fuente).** Unidades en metros, +Y arriba (la convención de glTF), transformaciones aplicadas, pivote en el centro de la base, materiales PBR estándar.
4. **Medir.** `npx @gltf-transform/cli inspect modelo.glb` muestra triángulos, mallas, materiales y tamaño de cada textura.
5. **Reducir llamadas de dibujo.** `join` une mallas que comparten material, `instance` convierte copias repetidas en instancias y `flatten` aplana la jerarquía.
6. **Reducir triángulos solo si hace falta.** `simplify --ratio 0.5 --error 0.001`, y revisar a ojo después.
7. **Comprimir en un solo paso.**

```bash
npx @gltf-transform/cli optimize in.glb out.glb \
  --compress meshopt \
  --texture-compress ktx2 \
  --texture-size 1024
```

Con `--texture-compress ktx2`, `optimize` [usa UASTC para normal, oclusión y metal-rugosidad, y ETC1S para el resto](https://tessl.io/registry/skills/github/CloudAI-X/threejs-skills/threejs-asset-pipeline). La salida KTX2 necesita el comando `ktx` de KTX-Software 4.4.0 o superior instalado aparte. El tamaño de textura por defecto es 2048, por eso hay que pasar 1024.

8. **Validar.** `validate` y `inspect` sobre el resultado; un script de presupuesto falla el build si la sala pasa de 100.000 triángulos o 15 MB.
9. **Cargar en Three.js.** Copia los archivos del transcodificador Basis a `public/basis/`:

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const ktx2 = new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer);
const loader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
const gltf = await loader.loadAsync('/salas/kenney/sala.glb');
```

`detectSupport(renderer)` es obligatorio: decide a qué formato de GPU transcodificar en cada teléfono. Basis Universal [transcodifica a ASTC, BC7 o ETC2](https://skia.googlesource.com/external/github.com/BinomialLLC/basis_universal/+/8bf012367213fb3668beadf2aa071d0d01443785) según el dispositivo, y la textura queda comprimida en la memoria de video.

**Hosting:** Cloudflare Pages acepta [archivos de hasta 25 MiB y 20.000 archivos por sitio](https://developers.cloudflare.com/pages/platform/limits) en el plan gratuito, holgado para salas de 15 MB. No pude confirmar si Cloudflare comprime los `.glb` al servirlos **(sin confirmar)**; meshopt ya reduce el archivo de todas formas.

## Variaciones por fuente

Sí, la implementación cambia, pero solo antes del paso 4: el cargador, la compresión y el presupuesto son idénticos. Lo específico es la limpieza y el registro de licencia.

| Fuente | Qué hacer distinto en la limpieza | Qué registrar | Trampa principal |
| --- | --- | --- | --- |
| Kenney | Unificar escala entre packs; fusionar piezas modulares con `join`; repetidos con `instance` | Pack, versión y `License.txt` incluido | Llamadas de dibujo, no triángulos |
| Poly Haven | Descargar a mano desde la web la versión glTF de 1k (no por API en un producto comercial); bajar mapas de 2k+ a 1024 | ID del asset y resolución | Peso de texturas, varios mapas por material |
| Sketchfab | Descargar el GLB con texturas de 1k; corregir escala, orientación y pivote; quitar cámaras, luces y nodos vacíos; `simplify` casi siempre | Autor, título, URL, licencia exacta y captura de la página | Licencia por modelo y modelos sobredimensionados |
| ambientCG | Bajar el material a 1K; empaquetar oclusión, rugosidad y metal en una sola textura ORM; ajustar `repeat` en Three.js | ID del material | Textura que se repite visiblemente |
| Meshy o Tripo | Pedir el límite de caras desde la generación (`target_polycount`, `face_limit` o Smart Low Poly); pedir PBR y origen en la base; revisar luz horneada | Herramienta, plan activo el día de generación, prompt e imagen de entrada | Plan gratuito con licencia limitada; geometría densa y desordenada |

En Meshy, la licencia [depende del plan activo cuando generas el modelo](https://intercom.help/meshy/en/articles/16102098-can-i-use-meshy-assets-commercially), no del plan actual: registra la fecha y el plan de cada generación.

## Audio e imágenes

Para audio, entrega Opus en WebM con respaldo AAC en `.m4a`; para imágenes de interfaz, WebP o AVIF; para texturas 3D, siempre KTX2.

### Formatos que funcionan en Chrome y Safari de iPhone

| Formato | Chrome (Android) | Safari iOS | Uso recomendado |
| --- | --- | --- | --- |
| Opus en WebM | Sí | Sí desde Safari 17.4, mono o estéreo ([WebKit](https://bugs.webkit.org/show_bug.cgi?id=238546)) | Formato principal: menor peso |
| Opus en Ogg | Sí | No ([caniuse](https://github.com/fyrd/caniuse/issues/6805)) | No usar |
| AAC en `.m4a` | Sí | Sí **(compatibilidad por conocimiento general, sin confirmar en esta búsqueda)** | Respaldo para iOS antiguo |
| WebP | Sí | Sí desde Safari 14 ([Appwrite](https://appwrite.io/blog/post/webp-support-for-safari.md)) | Imágenes de interfaz |
| AVIF | Sí | Desde iOS 16 o 16.4 según la fuente ([dev.to](https://dev.to/swapfileio/is-avif-ready-for-production-in-2026-browser-support-and-real-trade-offs-4ani)) | Fondos e ilustraciones grandes |
| KTX2 (Basis) | Sí | Sí | Toda textura que vaya a la GPU |

Safari tuvo fallos con `decodeAudioData` y Opus multicanal todavía en 2026 ([WebKit 327697](https://bugs.webkit.org/show_bug.cgi?id=327697)). Exporta todo en mono o estéreo.

### Por fuente de audio

- **Freesound:** licencia por sonido: [CC0, CC BY o CC BY-NC](https://en.wikipedia.org/wiki/Freesound); filtra por CC0 y CC BY. Los sonidos antiguos con Sampling+ se tratan como no comerciales. Descarga el original (WAV o FLAC), no la vista previa.
- **Kenney:** todo [CC0](https://kenney.nl/support); llega en OGG o WAV. Reconviértelo, porque Ogg no suena en Safari.
- **ElevenLabs:** solo con plan de pago ([ver Riesgos](https://help.elevenlabs.io/hc/en-us/articles/13313564601361)). Descarga en WAV o MP3 de alta calidad y comprime tú.
- **Web Audio generado por código:** no pesa nada ni tiene licencia. El `AudioContext` debe crearse o reanudarse dentro de un toque del jugador **(regla de autoplay conocida, sin confirmar en esta búsqueda)**.

### Compresión y normalización

```bash
# 1. normalizar volumen (EBU R128) y pasar a mono para efectos
ffmpeg -i in.wav -af loudnorm=I=-16:TP=-1.5:LRA=11 -ac 1 -ar 48000 norm.wav
# 2. Opus en WebM
ffmpeg -i norm.wav -c:a libopus -b:a 48k sfx.webm
# 3. respaldo AAC
ffmpeg -i norm.wav -c:a aac -b:a 96k sfx.m4a
```

El objetivo de −16 LUFS es una convención habitual para móviles, no una norma verificada para juegos **(sin confirmar)**. Usa el mismo valor para todas las fuentes, así un clic de Kenney y una voz de ElevenLabs suenan parejos.

### Imágenes generadas con IA

Si la imagen se usará como textura en 3D, conviértela a KTX2 y a potencia de 2 (1024×1024). Si es interfaz o fondo de menú, usa WebP o AVIF con calidad de 75–80. OpenAI [cede al usuario la propiedad del resultado](https://conductatlas.com/platform/openai/terms-of-use-row/ai-generated-output-ownership-and-assignment/) para uso comercial; revisa los términos de cualquier otro generador antes de usarlo.

## Métricas y cómo medirlas

Tres de las seis métricas salen gratis de `renderer.info`; la memoria de texturas y los MB descargados hay que calcularlos a mano.

| Métrica | Cómo medirla | Presupuesto |
| --- | --- | --- |
| MB descargados | `PerformanceObserver` de tipo `resource`, sumando `transferSize` ([MDN](https://developer.mozilla.org/docs/Web/API/PerformanceResourceTiming/transferSize)); da 0 si vino de caché | < 15 MB por sala |
| Triángulos | `renderer.info.render.triangles`, leído después de `render()` | < 100.000 |
| Llamadas de dibujo | `renderer.info.render.calls` (en `WebGPURenderer`, `info.render.drawCalls`, según la [documentación](https://threejs.org/docs/pages/Info.html)) | \~100 |
| Memoria de texturas | `renderer.info.memory.textures` solo cuenta texturas; los bytes se calculan recorriendo la escena | Ver fórmula abajo |
| FPS | Tiempo entre fotogramas en `setAnimationLoop`; reportar mediana, p95 y 1 % más lento | p95 < 33 ms (30 FPS) |
| Tiempo de carga | `performance.mark` al iniciar la sala y al primer fotograma con todo cargado; `LoadingManager.onProgress` para la barra | Meta propia **(sin confirmar)** |

Puntos que confunden al medir:

- Los contadores [se reinician en cada `render()`](https://tessl.io/registry/skills/github/CloudAI-X/threejs-skills/threejs-performance). Con varios pases (postproceso, sombras, minimapa) usa `info.autoReset = false` y `info.reset()` una vez por fotograma.
- Las sombras cuentan: cada luz con sombra vuelve a dibujar los objetos, y eso suma llamadas y triángulos.
- Si `memory.geometries` o `memory.textures` crece sin parar al cambiar de sala, falta un `dispose()`.
- `transferSize` da 0 en recursos de otro dominio sin la cabecera `Timing-Allow-Origin`. Sirve todo desde Cloudflare Pages en el mismo dominio.

**Memoria de texturas estimada.** Una textura sin comprimir ocupa ancho × alto × 4 bytes × 1,33 con mipmaps: una de 1024 px son unos 5,6 MB. En KTX2 transcodificado a ASTC 4×4 (8 bits por píxel) ocupa la cuarta parte, unos 1,4 MB **(cálculo propio con la tasa de bits de ASTC 4×4; verificar en dispositivo)**.

```js
function bytesTextura(t) {
  const img = t.image ?? t.mipmaps?.[0];
  const w = img?.width ?? 0, h = img?.height ?? 0;
  const bpp = t.isCompressedTexture ? 1 : 4; // ASTC/ETC2 RGBA ~1 byte/px
  return w * h * bpp * (t.generateMipmaps || t.mipmaps?.length > 1 ? 1.33 : 1);
}
```

La memoria de JavaScript (`performance.memory`) solo existe en Chrome, y Safari no expone ninguna medida **(sin confirmar)**. En iPhone, la única señal confiable del límite es que la pestaña se recargue.

## Prueba de estrés por dispositivo

La prueba sube la carga en un solo eje a la vez, en escalones, hasta que el p95 del tiempo de fotograma pasa de 33 ms o el navegador pierde el contexto. El último escalón estable es el límite de ese dispositivo en ese eje.

### Los cinco ejes, uno por corrida

| Eje | Cómo se aumenta | Qué aísla |
| --- | --- | --- |
| Triángulos | Un `InstancedMesh` del asset más pesado de la sala, +20.000 triángulos por escalón | Geometría, con una sola llamada de dibujo |
| Llamadas de dibujo | +25 mallas pequeñas con material propio por escalón | Costo de CPU por llamada |
| Memoria de texturas | +4 texturas KTX2 de 1024 px por escalón, usadas en planos visibles | Límite de memoria (el que mata Safari) |
| Píxeles (fill rate) | `setPixelRatio` de 1 a `devicePixelRatio`, y luego planos transparentes a pantalla completa | GPU por píxel; pesa mucho en teléfonos baratos |
| Sombras | Activar sombras y subir el mapa de 512 a 2048 | Pases extra de dibujo |

### Procedimiento de cada escalón

1. **Guardar antes de subir.** Escribir en `localStorage` el eje, el escalón y la marca "en curso". Safari en iPhone [mata y recarga la pestaña por presión de memoria](https://bugs.webkit.org/show_bug.cgi?id=300782) sin avisar; si al recargar se encuentra la marca, ese escalón fue el que reventó.
2. **Calentar 1 s** sin medir (compilación de shaders y subida de texturas).
3. **Medir 5 s:** mediana, p95 y 1 % más lento del tiempo de fotograma, además de triángulos, llamadas y memoria estimada.
4. **Decidir:** si el p95 pasa de 33 ms dos escalones seguidos, o se dispara `webglcontextlost`, parar. Si no, siguiente escalón.
5. **Al terminar:** borrar la marca, guardar el resultado y enviarlo (opcional) a una tabla de Supabase con el `userAgent` y la resolución.

&#91;embedded content: ciclo de la prueba de estrés · un eje por corrida\]

La línea punteada es el caso de iPhone: la marca guardada antes de cada escalón es lo único que sobrevive a la recarga.

### Detalles que cambian el resultado

- **Calor:** los teléfonos bajan su rendimiento al calentarse. Después de encontrar el límite, deja la sala real 3 minutos con la carga al 70 % del límite y compara el p95 del primer y el último minuto.
- **Modo ahorro y pantalla:** con el modo de bajo consumo, iOS puede limitar a 30 FPS **(sin confirmar)**. Registra si estaba activo.
- **Dispositivos mínimos:** un Android económico real y un iPhone real. El simulador de iOS no reproduce el límite de memoria.
- **De límite a calidad automática:** el resultado alimenta perfiles (bajo, medio, alto) que fijan `pixelRatio`, sombras y la distancia de cambio de detalle (LOD).

## Cuatro salas de prueba

Cada sala usa una fuente distinta de modelos y las mismas tres texturas de ambientCG en paredes, piso y techo. Así, ambientCG actúa como control: cualquier diferencia entre salas viene de los modelos.

Los resultados esperados son hipótesis para comprobar, no datos medidos.

| Sala | Fuente de modelos | Contenido sugerido | Qué medir sobre todo | Resultado esperado (hipótesis) |
| --- | --- | --- | --- | --- |
| 1. El Taller | Kenney | Mesas, estantes y cajas modulares; candado con dígitos | Llamadas de dibujo antes y después de `join` e `instance` | Pocos MB y triángulos; las llamadas bajan a menos de la mitad tras fusionar |
| 2. La Biblioteca | Poly Haven | Libros, lámpara, globo terráqueo y mueble antiguo | Memoria de texturas y MB; diferencia entre versión 1k original y KTX2 | El peso domina sobre los triángulos; KTX2 reduce mucho la memoria de video |
| 3. El Observatorio | Sketchfab CC BY | Telescopio, maqueta del sistema solar, pizarra | Triángulos y tiempo de carga; cuánto hay que simplificar | Al menos un modelo supera el presupuesto y necesita `simplify` |
| 4. El Laboratorio | Meshy o Tripo (plan de pago) | Instrumentos de medición y figuras geométricas | Triángulos tras el límite de caras; calidad visual tras KTX2 | Cumple el presupuesto si se pide bajo poligonaje al generar; la luz horneada choca con la de la escena |

### Criterio de aprobación igual para las cuatro

- [ ] Descarga de la sala < 15 MB, medida con `transferSize` en caché vacía
- [ ] < 100.000 triángulos y \~100 llamadas de dibujo, medidos en el peor ángulo de cámara
- [ ] Todas las texturas ≤ 1024 px y en KTX2
- [ ] p95 < 33 ms en el Android económico y en el iPhone, durante 3 minutos
- [ ] Ninguna recarga de pestaña en iPhone al entrar, salir y volver a entrar 3 veces
- [ ] Cada asset de la sala aparece en la página de créditos con su licencia

La comparación final es una tabla por dispositivo, con una fila por sala y una columna por métrica. Ese resultado dice qué fuente conviene para las salas definitivas del juego.

## Especificación para el agente de código

El bloque siguiente está listo para copiar y pegar como encargo. Describe qué construir y cómo saber que quedó bien, sin imponer la estructura interna.

```markdown
# Encargo: panel de métricas y control de estrés — La Última Prueba

## Contexto
Astro + Three.js (WebGLRenderer) + Preact con Signals. Salas en GLB con meshopt y KTX2.
Debe funcionar en Chrome Android (gama baja) y Safari iOS.

## 1. Panel de métricas
- Se activa con `?debug=1` o con 3 toques en la esquina superior izquierda. Oculto por defecto.
- Componente Preact superpuesto al canvas, que no capture toques salvo en sus botones.
- Las métricas viven en signals de un módulo `metrics.ts`; el bucle de render escribe en ellas
  como máximo cada 500 ms (nunca re-renderizar Preact por fotograma).
- Métricas y fuente de cada una:
  - FPS y tiempo de fotograma: mediana, p95 y 1 % más lento en ventana de 5 s.
  - Triángulos y llamadas: renderer.info.render.triangles y .calls, sumados en el fotograma
    (info.autoReset = false; info.reset() una vez por fotograma).
  - Geometrías y texturas activas: renderer.info.memory.
  - Memoria de texturas estimada en MB (ancho × alto × bytes por píxel × 1,33 si hay mipmaps;
    1 byte/px para texturas comprimidas, 4 para el resto).
  - MB descargados de la sala: PerformanceObserver tipo "resource", suma de transferSize
    de las URL bajo /salas/<id>/, más un indicador de cuántas vinieron de caché.
  - Tiempo de carga: performance.measure entre "sala:inicio" y "sala:primer-fotograma".
  - Perfil de calidad activo, devicePixelRatio, pixelRatio usado y userAgent.
- Cada valor se pinta en verde, ámbar o rojo contra el presupuesto: 100.000 triángulos,
  100 llamadas, 15 MB, p95 33 ms.
- Botón "Exportar JSON" que descarga todas las métricas y la sala actual.

## 2. Control de estrés
- Selector de eje: triángulos, llamadas, texturas, píxeles, sombras. Botones Iniciar y Detener.
- Escalones: triángulos +20.000 (InstancedMesh de un asset de la sala); llamadas +25 mallas
  con material propio; texturas +4 KTX2 de 1024 px en planos visibles; píxeles de 1 a
  devicePixelRatio en pasos de 0,25 y luego planos transparentes a pantalla completa;
  sombras activadas con mapa de 512, 1024 y 2048.
- Por escalón: guardar {eje, escalón, "en-curso"} en localStorage ANTES de aplicar la carga,
  calentar 1 s, medir 5 s, decidir.
- Parar cuando el p95 pase de 33 ms dos escalones seguidos o llegue webglcontextlost.
- Al cargar la página, si existe una marca "en-curso", registrar ese escalón como
  "recarga por memoria" y mostrarlo en el panel.
- Resultado: tabla por escalón (carga, mediana, p95, triángulos, llamadas, MB de texturas)
  y el último escalón estable. Exportable a JSON y, si hay sesión, insertable en la tabla
  `stress_results` de Supabase.
- Al detener, liberar todo lo creado con dispose() y comprobar que renderer.info.memory
  vuelve a los valores previos.

## Criterios de aceptación
- Con el panel cerrado, el costo en el bucle de render es despreciable (sin asignaciones por fotograma).
- Con el panel abierto, la mediana del tiempo de fotograma no sube más de 1 ms.
- Tras una recarga forzada a mitad de prueba, el panel muestra el escalón que la causó.
- Tras detener la prueba, geometrías y texturas activas vuelven al valor previo.
- Probado en un Android de gama baja real y en un iPhone real; adjuntar los dos JSON.
```

## Registro automático de créditos y licencias

Anotar la licencia sigue siendo manual (un minuto por asset, al descargarlo); lo automático es validar que nada se publique sin ella y generar la página de créditos.

### 1. Un manifiesto por asset

Un archivo `assets-src/credits.json` con una entrada por cada archivo publicado:

```json
{
  "archivo": "public/salas/observatorio/telescopio.glb",
  "sala": "observatorio",
  "tipo": "modelo",
  "titulo": "Old Telescope",
  "autor": "nombre_del_autor",
  "fuente": "sketchfab",
  "url": "https://sketchfab.com/3d-models/...",
  "licencia": "CC-BY-4.0",
  "licencia_url": "https://creativecommons.org/licenses/by/4.0/",
  "cambios": "simplificado 50 %, texturas KTX2 1024, meshopt",
  "descargado": "2026-11-05",
  "plan": null,
  "evidencia": "assets-src/evidencia/telescopio.png"
}
```

El campo `plan` es obligatorio para Meshy, Tripo y ElevenLabs ("pago" o "gratis"), y `evidencia` guarda una captura de la página de licencia del día de la descarga. Sketchfab cambió de dueño este año, y la captura prueba qué licencia tenía el modelo cuando lo bajaste.

### 2. Validación en cada build

Un script `scripts/check-credits.mjs` que corre antes de `astro build`:

- [ ] Todo archivo bajo `public/salas/` y `public/audio/` tiene entrada en el manifiesto; si falta una, el build falla.
- [ ] Licencia en la lista permitida: `CC0-1.0`, `CC-BY-4.0`, `CC-BY-3.0`, `propio`, `meshy-pago`, `tripo-pago`, `elevenlabs-pago`, `openai`.
- [ ] Cualquier licencia con `NC` o `ND`, o un plan gratuito de Tripo o ElevenLabs, hace fallar el build.
- [ ] `CC BY` sin `autor`, `url` o `cambios` hace fallar el build: CC BY 4.0 [exige indicar las modificaciones](https://www.tripo3d.ai/blog/commercial-use-ai-3d-models).
- [ ] Meshy con plan gratuito pasa, pero obliga a incluir el crédito a Meshy.

### 3. Créditos publicados en dos lugares

- **Página `/creditos` en Astro**, generada desde el manifiesto y agrupada por sala. Formato por línea: título, autor, enlace a la fuente, licencia con enlace y cambios realizados. Enlázala desde el menú y la pantalla final.
- **Dentro de cada GLB**, en el campo `asset.copyright` del glTF, escrito con un script de glTF-Transform. Así el crédito viaja con el archivo aunque alguien lo descargue suelto.

No uses la API de Poly Haven en el script para leer metadatos: su uso comercial [requiere una licencia aparte](https://polyhaven.com/our-api). Los assets de Poly Haven se anotan a mano desde la web.

## Riesgos de licencias y marcas para uso comercial

Los dos riesgos más serios son usar salidas de planes gratuitos de IA (Tripo y ElevenLabs) y publicar modelos de Sketchfab sin revisar su licencia exacta. Esto no es asesoría legal.

| Riesgo | Detalle verificado | Qué hacer |
| --- | --- | --- |
| Tripo gratis, licencia contradictoria | Su página de precios habla de modelos públicos CC BY 4.0, pero su [ayuda oficial](https://www.tripo3d.ai/help/privacy-policy/how-to-use-tripo-models-commercially) dice que Tripo conserva todos los derechos de lo generado por usuarios gratuitos (sección 5.2.1 de sus términos) | Usar Tripo solo con plan de pago, o no usarlo |
| ElevenLabs gratis | El plan gratuito [no tiene licencia comercial](https://help.elevenlabs.io/hc/en-us/articles/13313564601361) y exige poner "elevenlabs.io" o "11.ai" en el título; según terceros, la licencia sigue al archivo aunque subas de plan después | Generar todo el audio con un plan de pago activo; regenerar lo hecho en gratis |
| Meshy gratis | [CC BY 4.0: uso comercial con crédito a Meshy](https://docs.meshy.ai/en/webapp/pricing) | Aceptable con crédito; para la versión final, plan de pago |
| Sketchfab por modelo | Cada modelo tiene su licencia; CC BY-NC y ND no permiten este uso. KitBash compró Sketchfab en agosto de 2026 | Filtrar por CC BY o CC0, guardar captura de la licencia al descargar |
| API de Poly Haven | Assets CC0, pero la [API es solo para uso no comercial](https://polyhaven.com/our-api) salvo licencia | Descargar desde la web, no automatizar con la API |
| Freesound mezclado | Conviven CC0, CC BY, CC BY-NC y Sampling+ antiguo | Filtrar por CC0 y CC BY; tratar Sampling+ como no comercial |
| Salidas de IA sin protección | La Oficina de Copyright de EE. UU. concluyó que [el material generado totalmente por IA no tiene copyright](https://www.jonesday.com/en/insights/2025/02/copyrightability-of-ai-outputs-us-copyright-office-analyzes-human-authorship-requirement) | Otros pueden copiar esos assets; lo protegible es tu selección, edición y el juego completo |
| Marcas dentro de modelos | Un modelo CC0 o CC BY puede mostrar logos o productos de marca; esas licencias no cubren marcas **(regla general de Creative Commons, sin confirmar en esta búsqueda)** | Revisar texturas y quitar logos, nombres de productos y personajes reconocibles |
| Nombre "Saber 11" e ICFES | No verifiqué el registro de marca del ICFES **(sin confirmar)** | Usar "tipo Saber 11" solo como descripción; no usar logos ni dar a entender aval oficial |
| Parecido con personajes o personas | Una imagen o modelo de IA puede imitar personajes protegidos; OpenAI prohíbe reproducir la imagen de alguien sin su permiso | Prompts genéricos; revisar cada resultado antes de publicarlo |

glTF-Transform y meshoptimizer son de código abierto (glTF-Transform con licencia MIT). Su autor pide patrocinio a quien lo use con fines comerciales, pero no es obligatorio.

## Sin confirmar y fuentes

### Lo que no pude confirmar

- [ ] Detalles técnicos y créditos de halloween.dev (The Last Deploy): no encontré una fuente pública; uso tu descripción.
- [ ] Peso y triángulos típicos de Kenney, Poly Haven y Sketchfab: dependen de cada asset; mide los tuyos con `inspect`.
- [ ] Si Cloudflare Pages comprime los `.glb` al servirlos.
- [ ] Compatibilidad de AAC `.m4a` con `decodeAudioData` en todas las versiones de iOS.
- [ ] El límite exacto de memoria por pestaña en Safari iOS: Apple no lo publica.
- [ ] Que el modo de bajo consumo de iOS limite a 30 FPS.
- [ ] Registro de "Saber 11" o ICFES como marca.
- [ ] Que las licencias CC no cubran marcas (regla general, no verificada aquí).

### Fuentes consultadas

Licencias y fuentes de assets: [Kenney, soporte](https://kenney.nl/support) · [Poly Haven, licencia](https://polyhaven.com/license) · [Poly Haven, API](https://polyhaven.com/our-api) · [ambientCG, licencia](https://docs.ambientcg.com/license) · [Sketchfab, glTF/GLB/USDZ](https://help.sketchfab.com/en/articles/16152669-gltf-glb-and-usdz) · [Sketchfab, Download API](https://api.sketchfab.com/developers/download-api) · [Sketchfab, actualización tras Fab](https://sketchfab.com/blogs/community/sketchfab-update-what-you-need-to-know-now-that-fabs-live/) · [80.lv, compra de KitBash](https://80.lv/articles/artstation-and-sketchfab-have-been-acquired-by-kitbash) · [Meshy, precios y licencias](https://docs.meshy.ai/en/webapp/pricing) · [Meshy, uso comercial](https://intercom.help/meshy/en/articles/16102098-can-i-use-meshy-assets-commercially) · [Meshy, API Remesh](https://docs.meshy.ai/api/remesh.md) · [Tripo, uso comercial](https://www.tripo3d.ai/help/privacy-policy/how-to-use-tripo-models-commercially) · [ComfyUI, nodo Tripo](https://docs.comfy.org/built-in-nodes/TripoTextToModelNodeV2.md) · [Freesound, Wikipedia](https://en.wikipedia.org/wiki/Freesound) · [ElevenLabs, publicación de contenido](https://help.elevenlabs.io/hc/en-us/articles/13313564601361)

Técnicas: [Three.js, Info](https://threejs.org/docs/pages/Info.html) · [Guía de rendimiento de Three.js (tessl)](https://tessl.io/registry/skills/github/CloudAI-X/threejs-skills/threejs-performance) · [Guía de glTF-Transform (tessl)](https://tessl.io/registry/skills/github/CloudAI-X/threejs-skills/threejs-asset-pipeline) · [Basis Universal](https://skia.googlesource.com/external/github.com/BinomialLLC/basis_universal/+/8bf012367213fb3668beadf2aa071d0d01443785) · [MDN, transferSize](https://developer.mozilla.org/docs/Web/API/PerformanceResourceTiming/transferSize) · [Cloudflare Pages, límites](https://developers.cloudflare.com/pages/platform/limits) · [WebKit 238546, Opus en WebM](https://bugs.webkit.org/show_bug.cgi?id=238546) · [WebKit 327697, Opus multicanal](https://bugs.webkit.org/show_bug.cgi?id=327697) · [WebKit 300782, recargas por memoria](https://bugs.webkit.org/show_bug.cgi?id=300782) · [caniuse, Opus en Ogg](https://github.com/fyrd/caniuse/issues/6805) · [AVIF en 2026 (dev.to)](https://dev.to/swapfileio/is-avif-ready-for-production-in-2026-browser-support-and-real-trade-offs-4ani) · [WebP en Safari (Appwrite)](https://appwrite.io/blog/post/webp-support-for-safari.md)

Legales: [Jones Day, informe de la Oficina de Copyright](https://www.jonesday.com/en/insights/2025/02/copyrightability-of-ai-outputs-us-copyright-office-analyzes-human-authorship-requirement) · [ConductAtlas, términos de OpenAI](https://conductatlas.com/platform/openai/terms-of-use-row/ai-generated-output-ownership-and-assignment/) · [Tripo, licencias de IA](https://www.tripo3d.ai/blog/commercial-use-ai-3d-models)
