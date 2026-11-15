# Reporte de las olas 4 y 5 · Sesión A · 15 de noviembre de 2026

Esta sesión es dueña de `src/engine/`, `src/input/`, `src/debug/` y `scripts/`. Hizo las seis tareas de la lista, todas fusionadas en `main`:

| Tarea | Qué es | PR |
| --- | --- | --- |
| **T11m · T11n** | Métricas del motor y panel `?debug=1` con exportación JSON | [#101](https://github.com/Jssosaa1024/la-ultima-prueba/pull/101) |
| **T11o · T11p · T11q · T11r** | Prueba de estrés por ejes, recarga por memoria y verificación de memoria | [#102](https://github.com/Jssosaa1024/la-ultima-prueba/pull/102) |
| **T82** | Poses de los demás jugadores a 4 Hz, con interpolación | [#103](https://github.com/Jssosaa1024/la-ultima-prueba/pull/103) |
| **T83** | Avatares de bajo polígono con color y alias | [#104](https://github.com/Jssosaa1024/la-ultima-prueba/pull/104) |
| **T91** (parte 3D) | La señal se ve en la escena | [#105](https://github.com/Jssosaa1024/la-ultima-prueba/pull/105) |
| **T92** | Prueba de carga con partidas simuladas | [#106](https://github.com/Jssosaa1024/la-ultima-prueba/pull/106) |

Resumen honesto:

- **Nada se probó en un celular real ni en un iPhone.** Lo comprobé con pruebas de unidad (Vitest) y e2e (Playwright: Pixel 5 emulado en horizontal y Chrome de escritorio, con WebGL por software), más la vista previa de Cloudflare de cada PR (que construyera y que `/jugar/` cargara). El panel y la prueba de estrés existen justamente para que Alex mida en los teléfonos: los pasos están en la sección 4.
- **Hallazgo de T92 que pide una decisión:** con dos partidas de 4 jugadores a la vez, las poses a 4 Hz pasan en los picos del límite del plan Free de Supabase (sección 2, punto 1).

## 1. Qué hice

### T11m · T11n · Métricas y panel `?debug=1` (#101)

- **Qué mide** (`src/debug/metricas.ts` y `medidor.ts`):
  - tiempo de cuadro: mediana, p95 y el 1 % más lento de los últimos 5 s;
  - triángulos y draw calls (`renderer.info`);
  - memoria estimada de texturas, y geometrías y texturas en la GPU;
  - MB descargados de la sala (`transferSize`), aparte lo que vino de caché;
  - tiempo de carga de la sala (de `sala:inicio` al primer cuadro);
  - pixel ratio del equipo y el usado.
- **Sin costo con el panel cerrado:** el motor carga el medidor solo al abrir el panel. Abierto, guarda cada cuadro en un búfer fijo y escribe los números cada 500 ms.
- **El panel** se abre con `?debug=1` o con 3 toques en la esquina superior izquierda. Cada número sale en verde, ámbar (más del 85 % del límite) o rojo, contra el presupuesto de AGENTS.md. Solo sus botones reciben toques: el resto pasa al juego.
- **Exportar JSON** con el formato de la especificación. En iPhone abre el menú de compartir; en lo demás, descarga el archivo.

### T11o a T11r · Prueba de estrés (#102)

- Botón **Prueba de estrés** dentro del panel, con un botón por eje: **Triángulos** (+10.000 por escalón), **Draw calls** (+10 mallas), **Texturas** (+4 texturas KTX2 de 1024 px) y **Píxeles** (pixel ratio de 0,5 al del teléfono; luego planos transparentes a pantalla completa).
- Cada escalón: guarda la marca en `localStorage`, calienta 1 s, mide 5 s y decide. Para si el p95 pasa de 33 ms dos escalones seguidos o si el navegador quita el contexto de WebGL.
- **Recarga por memoria:** si Safari recarga la pestaña a mitad de un escalón, al volver a abrir la página el panel aparece solo con ese escalón marcado «recarga por memoria», listo para exportar.
- **Al terminar** se libera todo y el panel dice si `renderer.info.memory` volvió a lo de antes («liberada» o «falta liberar»).
- **Prueba de calor:** al terminar un eje, el botón **Calor 3 min** deja la sala al 70 % del último escalón estable y compara el p95 del primer minuto con el del último.

### T82 · Poses de los demás (#103)

- La pose propia sale a 4 Hz solo en movimiento, más una al detenerse. Los demás se dibujan 150 ms en el pasado, interpolando entre dos poses; después de la última se quedan quietos.
- El motor y la red no se conocen: se pasan las poses por `src/signals/poses.ts`. El motor también escribe `miPosicion`, que T91 usa para señalar sin objeto.

### T83 · Avatares ([#104](https://github.com/Jssosaa1024/la-ultima-prueba/pull/104))

- Cuerpo, cabeza y visera oscura hacia donde mira, hechos por código: unos 130 triángulos (el presupuesto es 2.000).
- Color del jugador y su alias encima («Búho», «Jaguar»…), escrito en un lienzo desde la lista cerrada de alias.
- **Presupuesto:** los 3 compañeros son un solo `InstancedMesh` y cada alias un `Sprite`: 4 draw calls como máximo con 4 jugadores. Un test lo comprueba.

### T91 · La señal en la escena ([#105](https://github.com/Jssosaa1024/la-ultima-prueba/pull/105))

- Cada señal con punto se ve 5 s como un aro y una flecha del color de quien señaló, latiendo. Todas son una sola draw call.
- Las frases sin objeto enfocado («¡Aquí!») ahora marcan dónde está quien la dijo, porque el motor ya escribe `miPosicion`.

### T92 · Prueba de carga ([#106](https://github.com/Jssosaa1024/la-ultima-prueba/pull/106))

- `npm run prueba-carga` simula partidas de 4 jugadores en la red en memoria, con el anfitrión, los clientes y el emisor de poses del juego. La mitad del tiempo caminan y dicen 2 frases por minuto. Cuenta los eventos que cobraría Supabase y los compara con cada plan. `--hz 2` mide el respaldo de 2 Hz.

**Poses a 4 Hz** (lo de hoy), 2 minutos por fila:

| Partidas de 4 | Conexiones | Eventos/s (promedio) | Eventos/s (pico) | Sin la entrega propia (pico) | Free (100/s) | Pro (500/s) | Pro sin tope (2.500/s) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 4 | 45,5 | 85 | 68 | cabe (85 %) | cabe (17 %) | cabe (3 %) |
| 2 | 8 | 77 | 140 | 112 | no cabe (140 %) | cabe (28 %) | cabe (6 %) |
| 3 | 12 | 114,9 | 200 | 160 | no cabe (200 %) | cabe (40 %) | cabe (8 %) |
| 5 | 20 | 198,5 | 315 | 252 | no cabe (315 %) | cabe (63 %) | cabe (13 %) |
| 10 | 40 | 410,2 | 535 | 428 | no cabe (535 %) | no cabe (107 %) | cabe (21 %) |

**Poses a 2 Hz** (el respaldo):

| Partidas de 4 | Conexiones | Eventos/s (promedio) | Eventos/s (pico) | Sin la entrega propia (pico) | Free (100/s) | Pro (500/s) | Pro sin tope (2.500/s) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 4 | 24,8 | 45 | 36 | cabe (45 %) | cabe (9 %) | cabe (2 %) |
| 2 | 8 | 41,8 | 75 | 60 | cabe (75 %) | cabe (15 %) | cabe (3 %) |
| 3 | 12 | 63,2 | 120 | 96 | no cabe (120 %) | cabe (24 %) | cabe (5 %) |
| 5 | 20 | 108,9 | 165 | 132 | no cabe (165 %) | cabe (33 %) | cabe (7 %) |
| 10 | 40 | 223,3 | 310 | 248 | no cabe (310 %) | cabe (62 %) | cabe (12 %) |

## 2. Qué decidí (sin preguntarle a Alex)

1. **Supabase plan Free y 2 partidas a la vez: no alcanza en los picos.** El canal usa `self: true`, así que cada mensaje también se le entrega a quien lo envía: con 4 jugadores, un mensaje cuesta 1 + 4 = 5 eventos (la especificación contaba 4). Además, la especificación calculó el promedio y el límite se cruza en los picos, cuando los 4 caminan a la vez. **No cambié nada del protocolo** (es de la sesión B). Opciones, de la más sencilla a la más cara:
   - poses a 2 Hz en el cooperativo: 2 partidas caben (pico de 75 eventos/s);
   - enviar `dir` sin entrega propia (quien envía ya ignora sus propias poses): baja los picos un 20 %;
   - plan Pro: hasta 10 partidas a 4 Hz.
2. **3 toques en la esquina:** los toques sobre un botón no cuentan, porque en esa esquina está «Salir», que pide confirmación. En la partida se toca justo **debajo** de «Salir».
3. **Durante la prueba de estrés** la prueba fija el pixel ratio y la escala dinámica (T13) no actúa. Fuera de la prueba, todo sigue igual.
4. **En la prueba de estrés, un cuadro de más de 1 s cuenta como lento**, no como pausa: es justamente el límite del teléfono.
5. **«Detenido» son 120 ms sin cambios**, no un solo cuadro, para que girar despacio no mande más de 4 poses por segundo.
6. **Un jugador quieto no reenvía su pose**, pero la propia sale otra vez cuando alguien llega al grupo, y la última de cada jugador queda guardada.
7. **El motor repite la tabla de alias** de `ui/coop/nombres.ts` (no puede importar de `ui/`); un test falla si las dos se separan.
8. **Dos arreglos a las pruebas compartidas:** 20 s por prueba de unidad (antes 5 s) en `vitest.config.ts`, porque con varias sesiones probando a la vez las de `check-credits` y `optimize-models` se pasaban del tiempo sin estar mal.

## 3. Qué quedó incompleto

- **Ninguna medida real:** T11 (escena de estrés en el celular de referencia) y T11y (estrés en Android de 2 GB e iPhone, y fijar los perfiles bajo, medio y alto) necesitan los teléfonos. Los pasos están en la sección 4. El campo `perfil` del JSON va en `null` hasta que T11y fije los perfiles.
- **La decisión del punto 2.1** (2 Hz, `dir` sin entrega propia o plan Pro) es de Alex con la sesión B.
- **Las memorias de texturas son estimadas** (ancho × alto × bytes por píxel × 1,33), como dice la especificación; no cuentan la portería guardada fuera de la escena.
- **Ahorro de energía:** ningún navegador lo dice; el JSON lo deja en `null` para anotarlo a mano.

## Pruebas y equipo

- **Cada PR** pasó formato, lint, tipos, las pruebas de unidad (de 814 a 855 durante la ola), los checks de créditos, presupuesto y audio, el build y las e2e de lo que tocaba, con el candado (`candado-pruebas.txt`, letra A), un solo navegador y prioridad baja. Cada PR con código esperó la vista previa de Cloudflare antes de fusionarlo.
- **La suite e2e completa** corrió una vez al final, sobre `main` con todo lo de esta ola: **217 pasaron, 2 fallaron y 15 se saltaron (47,6 min)**. Las dos fallas fueron en escritorio:
  - «eje píxeles» (mía): la prueba no contaba con que la escala dinámica baja la resolución cuando el equipo va lento. Arreglada en [#107](https://github.com/Jssosaa1024/la-ultima-prueba/pull/107); el juego estaba bien.
  - «las tres etapas de los tanques» (no es de esta ola): al repetirla sola pasó en celular y escritorio. Fue la carga del equipo.
- **Lo que costó tiempo:** las pruebas de unidad de `check-credits` y `optimize-models` se pasaban de 5 s con el equipo ocupado (lanzan un proceso o cargan wasm). Ahora tienen 20 s. Además, mi script de pruebas decía «verde» aunque algo fallara; lo corregí en la primera hora, antes de fusionar nada.

## 4. Qué debe hacer Alex en los teléfonos (T11 y T11y)

Necesitas: el Android de 2 GB con Chrome actualizado y un iPhone con Safari. Carga los dos al 100 % y desconéctalos del cargador. Quita el ahorro de energía y anota si lo tenías puesto. Cierra las demás apps.

### A. El panel de métricas (5 minutos por teléfono)

1. Abre `https://la-ultima-prueba-duz.pages.dev/jugar/?debug=1` con el teléfono **en horizontal**.
2. Toca **Jugar solo**. Arriba a la izquierda aparece un cuadro con números de colores.
3. Camina 1 minuto por la portería y entra a la sala 1. Mira los números: verde está bien, ámbar está cerca del límite y rojo lo pasa.
4. Toca **Exportar JSON**. En Android se descarga a la carpeta *Descargas*; en iPhone se abre el menú de compartir: elige *Guardar en Archivos* o mándatelo por WhatsApp o correo.

### B. La prueba de estrés (unos 15 minutos por teléfono)

1. En la sala 1, quédate quieto mirando el centro de la sala. No toques nada más que el cuadro.
2. Toca **Prueba de estrés** y luego **Draw calls**. Cada 6 segundos aparece un escalón con su p95. La prueba para sola.
3. Cuando diga «terminada», toca **Exportar JSON** y guárdalo.
4. Repite el paso 2 y 3 con **Triángulos**, **Texturas** y **Píxeles**. Recarga la página entre uno y otro (vuelve a tocar **Jugar solo** y entra a la sala 1).
5. **Si el teléfono recarga la página solo** (sobre todo el iPhone con Texturas): no pasa nada. Vuelve a abrir el enlace: el cuadro aparece solo y dice «recarga por memoria». Toca **Exportar JSON**. Ese es el dato más importante.
6. Al final, con **Triángulos** terminado y sin recargar, toca **Calor 3 min** y deja el teléfono quieto 3 minutos. Exporta el JSON.

### C. Qué me pasas

- Todos los archivos `metricas-….json` (son unos 10 por teléfono), con el nombre del teléfono: «Android» o «iPhone».
- Si el teléfono se calentó, si alguna prueba cerró el navegador y si tenías el ahorro de energía.

Con eso se cierran T11 y T11y y se fijan los perfiles bajo, medio y alto.

### D. El cooperativo (cuando esté Supabase, `docs/supabase.md`)

1. Dos teléfonos: uno toca **Crear partida**, el otro se une con el código.
2. Camina con uno: en el otro se ve un muñeco del color del jugador con su nombre encima, que se mueve con suavidad.
3. Toca **Frases** → **¡Aquí!**: en los dos teléfonos aparece un aro con una flecha donde estás, unos 5 segundos.
- **Anota:** si el movimiento del otro se ve a saltos, y si el nombre se lee.
