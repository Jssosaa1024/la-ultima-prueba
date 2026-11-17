# Reporte de la ola 6 · Voz de La Voz (T42b) · Sesión A · 17 de noviembre de 2026

Una tarea: **T42b**. La Voz ya habla con voz grabada en ElevenLabs. La tarea no estaba en la especificación: la agregué en la fase 5 (Audio), después de T43, y quedó marcada como hecha en este PR.

Resumen honesto: **nada se probó en un celular real** y **nadie ha escuchado todavía las 23 líneas completas** (Alex escogió la voz con una sola muestra). Se probó con pruebas de unidad y e2e (Pixel 5 emulado en horizontal y Chrome de escritorio).

## Qué hice

- **Script `npm run voz`** (`scripts/voz.ts`). Lee `src/content/guion.json` y la voz elegida en `art/audio/voz/voz.json`. Usa el modelo multilingüe `eleven_multilingual_v2` con una semilla fija y guarda `art/audio/voz/originales/<id>.mp3` (Git LFS). Antes de generar dice cuántos caracteres va a gastar. Las líneas que ya existen se saltan, salvo con `--forzar`. Además acepta `--solo <ids>`, `--muestras` y `--en-seco`.
- **La clave** se lee de la variable de entorno `ELEVENLABS_API_KEY`. Solo va en la cabecera del pedido. Nunca se imprime ni se guarda: de los errores se muestra solo el código HTTP y el mensaje de la API.
- **Muestras:** `voz-intro-1` con 3 voces de la biblioteca de ElevenLabs, en `art/audio/voz/muestras/`. Alex escogió la 2, **«Salvatore - Conversations & Storyteller»** (`wfTWLJ20rcMqvU8gIiAB`).
- **Las 23 líneas**, generadas con esa voz. Se gastaron **1.671 caracteres**: 174 en las muestras y 1.497 en las líneas.
- **`optimize-audio`** ahora también lee los mp3 de La Voz y los pasa a `public/assets/audio/es-CO/<sala>/<id>.m4a`: mono, 48 kHz, AAC a 48 kbps y −16 LUFS. Las líneas de cualquier sala (espera y fallo) van a `compartido/`. En total pesan 816 KB, y la sala que más carga es la portería, con 259 KB de 600 KB.
- **`art/credits.json`**: 23 entradas con fuente `elevenlabs`, licencia `elevenlabs-pago`, plan `pago`, el texto de cada línea como prompt y la captura `art/evidencia/elevenlabs-plan-2026-11-17.png`.
- **En el juego:** la línea que se ve suena por el canal de voz de la mezcla, así que respeta el volumen de voz de los ajustes. Puede ser un subtítulo, el panel de una grabación o la pantalla de un final. El subtítulo se quita cuando termina el audio. Si el audio no carga o el navegador no lo decodifica, el subtítulo se ve igual su duración estimada.

## Qué decidí (Alex puede cambiarlo)

1. **Originales en MP3, no en WAV.** Así lo pedía la tarea. La especificación decía WAV y ya quedó corregida. Igual se recomprime a AAC, así que la diferencia no se nota.
2. **Si se abre un panel en medio de una línea, la voz se calla.** La línea vuelve a empezar al cerrarlo, junto con su subtítulo, que ya funcionaba así desde T34.
3. **Una grabación suena mientras su panel está abierto.** Al tocar «Seguir», se calla.
4. **Se baja de antemano solo la voz de la sala donde está el jugador**, más la de espera y fallo. Se guarda el archivo comprimido, unos 30 KB por línea; el audio decodificado ocupa casi 1 MB por línea, así que se crea al sonar y se suelta al terminar. Los finales se bajan cuando llegan.
5. **Quité el «murmullo» provisional** (`sintesis.ts`), porque ya no se usa.

## Pruebas

- Formato, lint, tipos y pruebas de unidad: en verde. Las nuevas están en `voz-grabada.test.ts` (script, rutas, sincronía del subtítulo y reproducción) y en `audio-motor.test.ts`.
- `check-budget`: todas las salas cumplen. `check-audio`: las 23 líneas están a −16 ± 0,3 LUFS.
- E2e en `subtitulos.spec.ts`. Una prueba verifica que el audio de la primera línea se pide y que el subtítulo sabe si suena. Otra corta el audio y verifica que los subtítulos pasan igual.
- **Suite e2e completa** (celular y escritorio, un navegador, con el candado): pasaron 247 y fallaron 4. Una era mi prueba nueva, que tocaba «Jugar solo» antes de que el motor estuviera escuchando; ya la corregí. Las otras 3 (cruzar a la sala 1 en cooperativo, la señal «¡Aquí!» y un eje de la prueba de estrés) pasaron al repetirlas. `estres.spec.ts` también pasó 3 veces seguidas: 24 de 24. Fallaban por la carga del equipo, con otra sesión probando al mismo tiempo.
- `check-credits` **falla hasta que Alex suba la captura del plan**. Para correr la verificación en local usé un archivo provisional que no se sube.

## Qué necesita Alex

1. **La captura del plan de ElevenLabs.** Entra a elevenlabs.io → tu foto (arriba a la derecha) → **Subscription**. Toma una captura donde se vean el nombre del plan de pago y la fecha. Guárdala como `art/evidencia/elevenlabs-plan-2026-11-17.png` (en minúsculas, exactamente ese nombre). Si prefieres, pásamela y yo la pongo. Sin ella, el build de Cloudflare falla, por eso este PR no se sube hasta tenerla.
2. **(Opcional) Permiso de lectura en la clave.** Hoy la clave solo puede generar voz. Para que `npm run voz` lea el plan desde la API, en **Developers → API Keys**, edita la clave y activa **User → Read**. El valor de la clave no cambia.
3. **Escuchar las 23 líneas** en `art/audio/voz/originales/`. Revisa sobre todo cómo dice «00:40» (`voz-intro-3`) y las tres grabaciones. Para rehacer una: `npm run voz -- --solo voz-intro-3 --forzar`.

## Pendiente

- **Picos de las voces:** varios quedan entre −1,9 y +0,9 dBTP, y la especificación pide −1,5. La sonoridad sí cumple, y `check-audio` solo revisa la sonoridad. El AAC a 48 kbps sube los picos unos 3 dB después del limitador. Arreglarlo es cambiar `optimize-audio` (T42), que es de otra tarea.
- **Duraciones del guion:** `duracion_s` sigue siendo la estimada, y ahora solo se usa si el audio no carga. Las grabaciones duran de 1 a 2,3 s más que lo estimado.

## Cómo probarlo en el celular

1. Abre la vista previa del PR en `/jugar`, con el volumen del teléfono arriba.
2. Toca **Jugar solo**.
   - **Se espera:** oyes «Buenas noches. Llegas tarde…» con su subtítulo, y luego «Cinco salas, cinco sellos…». Cada subtítulo se quita cuando termina la voz.
3. Abre **Ajustes**, baja **Volumen de la voz** a 0 % y vuelve.
   - **Se espera:** los subtítulos siguen saliendo, pero la voz no se oye.
4. Entra a la sala 1.
   - **Se espera:** suena «La cooperativa…» sin demora.
5. **Anota:** si alguna línea suena cortada, demorada o mal pronunciada.
