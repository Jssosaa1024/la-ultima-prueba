# Reporte de la sesión A

Fecha: 12 de noviembre de 2026. Estado de `main` al escribir: `dbf731e` (fusión de T20).
Producción (`https://la-ultima-prueba-duz.pages.dev`) ya publica ese estado: lo comprobé abriendo `/jugar` y cada `?sala=`.

Esta sesión hizo el pipeline de assets (T07–T10) y el motor con sus controles (T12, T14, T15, T17, T18, T19, salas por código y T20). La interfaz (HUD, menús, paneles), el contenido de los puzzles y `game/` son de otra sesión y no se reportan aquí.

**Ninguna prueba de esta sesión se hizo en un celular real ni en un iPhone.** Todo lo que dice «probado» se probó con Vitest, con Playwright (Chromium con emulación de Pixel 5 y de escritorio, WebGL por software) o en el navegador de escritorio. La sección 2 lista lo que falta comprobar a mano.

---

## 1. Estado técnico

### T07 · KTX2 en el pipeline (PR #1)

- **Qué quedó:** `optimize-models` convierte cada textura PNG o JPEG a KTX2 con `ktx create` (KTX-Software). Los mapas normales van en UASTC + Zstandard; todo lo demás (color, lightmap, rugosidad) va en ETC1S. Ningún lado pasa de 1024 px.
- **Archivos:** `scripts/modelos/ktx2.ts`, `scripts/modelos/etapa-comun.ts`, `scripts/optimize-models.ts`, `tests/unit/ktx2.test.ts`.
- **Decisiones que no están en la especificación:**
  - Cada lado se lleva a la potencia de 2 más cercana (1500 → 1024, 600 → 512).
  - El alfa solo se conserva en el color base de un material que no sea `OPAQUE`.
  - UASTC usa `--uastc-quality 2 --uastc-rdo-l 0.5 --zstd 18`; ETC1S usa `--clevel 1 --qlevel 128`. Son valores por defecto razonables, no calibrados.
  - El script exige KTX-Software 4.4.0 o superior.
- **Incompleto o con riesgo:**
  - En el equipo de build está instalada **KTX-Software v5.0.0-rc2, una versión preliminar**. Funciona y `ktx validate` acepta la salida, pero conviene pasar a la 4.4.x estable.
  - WebP no está soportado: el script se detiene y pide PNG o JPEG.
  - El lightmap de 2048² en calidad alta no tiene opción en la línea de comandos (`tamanoMaximo` solo existe en la API).

### T08 · `build-manifest` (PR #2)

- **Qué quedó:** `npm run build-manifest` pone el hash del contenido en los nombres de `public/assets/salas/<sala>/` (`escena.<hash8>.glb`), borra las versiones anteriores y escribe `public/assets/manifest.json` con hash, bytes, triángulos y draw calls por sala, y el audio de `audio/<idioma>/<sala>/`. Con `--comprobar` no cambia nada y falla si el manifiesto quedó viejo.
- **Archivos:** `scripts/build-manifest.ts`, `scripts/manifiesto/construir.ts`, `public/assets/manifest.json`, `tests/unit/build-manifest.test.ts`.
- **Decisiones:**
  - Solo se renombran los archivos de `salas/`, porque solo esa carpeta tiene caché inmutable en `public/_headers`. El audio no se renombra.
  - El manifiesto no lleva fechas, así que solo cambia cuando cambian los archivos.
- **Estado real:** `public/assets/salas/` está **vacío**, porque las salas se arman por código (ver abajo). Hoy el manifiesto es `{"version": 1, "salas": {}}`. El script queda listo para cuando lleguen los GLB.

### T09 · `check-budget` (PR #3)

- **Qué quedó:** `npm run check-budget` mide `public/assets/` y falla si una sala pasa de 90.000 triángulos, 40 draw calls, 2 MB de descarga, 0,6 MB de audio o 16 MB de texturas en GPU, o si una textura mide más de 1024 px. También falla si el manifiesto está viejo. Corre dentro de `npm run build` y `npm run verify`.
- **Archivos:** `scripts/check-budget.ts`, `scripts/presupuesto/evaluar.ts`, `scripts/manifiesto/texturas.ts` (lee el formato y el alfa de la cabecera KTX2), `package.json`, `tests/unit/check-budget.test.ts` y tres KTX2 reales de prueba en `tests/unit/fixtures/`.
- **Decisiones:**
  - Los MB son decimales, la lectura más estricta.
  - La memoria de texturas usa la fórmula del panel de métricas: ancho × alto × bytes por píxel × 1,33.
  - Las draw calls se suman por sala; en una sala cerrada, el total es el máximo de lo visible.
- **Incompleto:**
  - **No mide las salas por código**, que no tienen archivos. Su presupuesto lo revisa `tests/unit/salas.test.ts` (menos de 90.000 triángulos y como máximo 40 mallas por sala).
  - No revisa los triángulos visibles por cuadro, el máximo de 6.000 por objeto interactivo, los 3 MB de la primera sala ni la excepción del lightmap de 2048².
  - No tiene el modo de solo informar para `?lab=1` (T11k).
  - **No verifiqué** que Cloudflare construya con `npm run build`; si usa `astro build` directo, `check-budget` no corre allá. Se ve en los registros del build en Cloudflare.

### T10 · Decodificadores y GLB de prueba (PR #4)

- **Qué quedó:** cargador GLTFLoader + KTX2Loader + MeshoptDecoder, liberación de memoria y la página de prueba `/jugar?prueba=glb`, que carga un cubo de 7 KB con color ETC1S y normal UASTC, y muestra el tiempo de carga, los triángulos y el formato de GPU de cada textura.
- **Archivos:** `src/engine/carga/cargador.ts`, `src/engine/carga/liberar.ts`, `src/engine/carga/prueba.ts`, `src/signals/prueba-carga.ts`, `scripts/modelo-prueba.ts`, `scripts/modelos/png.ts`, `public/assets/pruebas/cubo.glb`. Dependencias nuevas: `three` 0.187.0 y `@types/three` 0.187.0, con versión exacta.
- **Decisión que se aparta de la especificación:** el transcodificador Basis **no** está en `public/decoders/`. Three.js r187 lo referencia con `import.meta.url`, y Vite lo publica con hash en `/_astro/`, con caché inmutable. Copiarlo a mano duplicaba 585 KB. Así, `/decoders/*` en `public/_headers` quedó sin uso. El decodificador de meshopt va dentro del bundle.
- **Incompleto:**
  - **Nunca se vio qué formato elige un teléfono real.** En el navegador de escritorio sale BC7.
  - `?prueba=glb` y `cubo.glb` también están en producción. Son inofensivos, pero visibles.
  - Peso medido con gzip: Three.js + la prueba, 180 KB; transcodificador, unos 257 KB.

### T12 · Renderer y bucle (PR #5)

- **Qué quedó:** renderer WebGL2 sin antialias ni stencil, en sRGB, sobre el búfer que ya ajusta `ajustarCanvas` (DPR máximo 1,25). El bucle usa `setAnimationLoop`, limita el paso a 0,1 s y **se detiene del todo con `visibilitychange`**. `iniciarMotor(canvas)` devuelve la función que libera todo.
- **Archivos:** `src/engine/renderer.ts`, `src/engine/loop.ts`, `src/engine/motor.ts`, `src/signals/motor.ts`, `tests/unit/loop.test.ts`. En `src/ui/IslaJuego.tsx` cambié lo mínimo para montar el motor con import dinámico y borré el patrón 2D de T03.
- **Incompleto:** la escala dinámica de resolución (T13) no está hecha.

### T14 · Cámara y mirada (PR #9)

- **Qué quedó:** cámara en primera persona con yaw y pitch, pitch limitado a ±80°. Arrastrar en la mitad derecha mira; cada dedo se sigue por su `pointerId`.
- **Archivos:** `src/engine/jugador/camara.ts`, `src/input/entrada.ts`, `src/input/tactil.ts`, `tests/unit/camara.test.ts`, `tests/e2e/controles.spec.ts`, `playwright.config.ts` (variable `PUERTO_E2E`).
- **Decisiones:**
  - Sensibilidad de 0,0045 rad por píxel CSS: un arrastre de 360 px gira unos 93°. **Nadie la ha probado con el dedo.**
  - Al entrar a una sala la cámara mira un poco hacia abajo (−0,12 rad).
- **Incompleto:** el modo zurdo y la sensibilidad ajustable (T39).

### T15 · Joystick (PR #12)

- **Qué quedó:** joystick flotante en la mitad izquierda (la base aparece donde toca el dedo), con radio de 56 px y zona muerta del 12 %. Se camina a 2 m/s en la dirección de la mirada, sin ir más rápido en diagonal. Se puede caminar y mirar a la vez con dos dedos. El motor usa `controlesActivos`: sin partida en marcha o con un panel abierto, no hay movimiento.
- **Archivos:** `src/input/joystick.ts`, `src/engine/jugador/movimiento.ts`, `src/signals/controles.ts`, `tests/unit/joystick.test.ts`.
- **Incompleto:** **el joystick no se dibuja.** La signal `joystick` publica la base, la perilla y el radio, pero ningún componente de `ui/` la usa todavía.

### T17 · Colisiones (PR #13)

- **Qué quedó:** el jugador es una cápsula de 30 cm de radio y 1,7 m de alto contra cajas alineadas a los ejes. Se desliza por las paredes, sale bien de las esquinas y no atraviesa paredes delgadas, porque avanza en pasos de medio radio. Lo que mide menos de 5 cm no estorba.
- **Archivos:** `src/engine/jugador/colision.ts`, `src/engine/salas/colisiones.ts` (`marcarSolido`, `cajasDeColision`), `tests/unit/colision.test.ts`, `tests/unit/colisiones-sala.test.ts`.
- **Decisión:** como pediste, las cajas se **generan por código** con la caja envolvente de cada objeto marcado como sólido. T16 (Blender) sigue pendiente.
- **Limitación:** un objeto girado en un ángulo que no sea múltiplo de 90° tendría una caja más grande que el objeto. Hoy ningún objeto está así.

### T18 · Tocar objetos (PR #16)

- **Qué quedó:**
  - Un toque corto (menos de 350 ms y menos de 12 px) hace un raycast de hasta 3 m. Una pared delante tapa lo que hay detrás.
  - El objeto tocado brilla y el motor escribe `enfocado`, que el HUD de la otra sesión convierte en el botón «Usar», «Recoger» o «Examinar».
  - Al alejarse más de 3,5 m, el objeto deja de estar enfocado.
  - Lo que entra al `inventario` se oculta.
- **Archivos:** `src/input/toque.ts`, `src/engine/interaccion/interaccion.ts`, `tests/unit/interaccion.test.ts`, `tests/unit/toque.test.ts`.
- **Decisión:** `marcarInteractivo` copia los materiales de cada objeto, para que el brillo no se contagie a otros objetos que compartían el material.
- **Limitación:** un objeto recogido solo se oculta; se libera al salir de la sala. Si en el futuro un objeto «recogible» fuera además sólido, dejaría un obstáculo invisible. Hoy ninguno lo es, pero el esquema no lo impide.

### T19 · Teclado y ratón (PR #26)

- **Qué quedó:**
  - WASD o flechas, con la tecla física (`KeyboardEvent.code`); no se roban teclas cuando el foco está en un botón.
  - Un clic corto en una zona vacía bloquea el puntero. Con el puntero bloqueado, el ratón mira y la mira del centro enfoca unas 10 veces por segundo, sin reescribir `enfocado` si no cambia. `E` o clic usan el objeto. Al abrir un panel, el puntero se suelta.
- **Archivos:** `src/input/teclas.ts`, `src/input/escritorio.ts`, `src/signals/controles.ts` (`punteroBloqueado`), `tests/unit/teclas.test.ts`.
- **Decisiones:**
  - Un clic sobre un objeto lo selecciona y **no** bloquea, para que el botón del HUD siga clicable.
  - Soltar el botón después de arrastrar no bloquea.
  - En pantallas táctiles nunca se pide el bloqueo.
  - El ratón usa la mitad de la sensibilidad táctil (`ESCALA_RATON = 0.5`).
- **Arreglo de paso:** al juntar T15 y T40 (de la otra sesión) en `main`, `tests/e2e/controles.spec.ts` tocaba «Jugar solo» dos veces y todas las pruebas de controles fallaban. Lo corregí aquí.
- **Incompleto:**
  - **La mira no se dibuja** (la signal `punteroBloqueado` existe).
  - Mientras el ratón está bloqueado, los botones del HUD no se pueden tocar hasta apretar Esc.
  - Esc no se puede simular en las pruebas: **no está probado.**
  - Solo probé en Chromium.

### Salas por código (T19b, PR #27)

- **Qué quedó:**
  - La portería y las 5 salas de `docs/salas-y-puzzles.md`, en `src/content/salas.json`, con medidas, colores, punto de inicio y objetos (caja, cilindro, plano o grupo).
  - Los objetos tocables usan **los mismos ids que `pista_por_jugador` de los puzzles**.
  - El JSON se valida en el build: una colección en `src/content.config.ts` aplica `esquemaSalaValidada`.
  - El motor arma la sala de la signal `sala`, y `/jugar?sala=<id>` abre directamente una sala.
- **Archivos:** `src/content/salas.json`, `src/content/esquema-salas.ts`, `src/content/salas.ts`, `src/content.config.ts` (archivo compartido; solo agregué la colección), `src/engine/salas/construir.ts`, `src/engine/salas/url.ts`, `tests/unit/salas.test.ts`, `tests/e2e/salas.spec.ts`. Se borró `src/engine/salas/provisional.ts`.
- **Decisiones:**
  - Coordenadas: el centro de la sala está en x = 0, z = 0; el fondo es −Z y la entrada +Z. `pos` es la base del objeto.
  - Todo lo fijo que no se toca se une en **una sola malla con colores por vértice**. Mallas medidas en producción: portería 13, cooperativa 11, laboratorio 13, gimnasio 12, biblioteca 14 y rectoría 10. En el PR #27 escribí «12 a 15», y era impreciso.
  - Dos luces: hemisférica, con el tono de suelo aclarado para que el techo no salga negro, y una direccional.
  - El marcador del gimnasio, a 7,4 m de altura, no se puede tocar porque queda fuera del alcance de 3 m.
- **Provisional:**
  - Todo son bloques de colores, sin texturas ni lightmaps; el arte de cada fuente llega en las tareas de cada sala.
  - Las puertas son planos.
  - Las reglas de «dentro de la sala» no revisan los objetos tipo grupo.
- **Historial:** el commit `810f7f7` borra la escena provisional antes de que el motor deje de usarla. El estado final de la rama está bien, pero ese commit intermedio no compila.

### T20 · Cargador de salas (PR #29)

- **Qué quedó:**
  - Antes de mostrar una sala se llama a `renderer.compileAsync`.
  - En memoria solo quedan la portería y la sala actual; las demás se liberan con `dispose()`.
  - 1,5 s después de entrar, se arma en la CPU la primera sala sin sello. Hay como máximo una precargada.
  - Si se piden dos salas seguidas, gana la última.
  - La signal `carga` pasa a `cargando` y luego a `lista`.
- **Puertas:** cambié lo mínimo en `src/signals/provisional.ts` (de la otra sesión): al «usar» un objeto con `puerta` en el JSON, pone `sala` en el destino.
- **Archivos:** `src/engine/salas/cargador.ts`, `src/engine/salas/recorrido.ts`, `src/engine/motor.ts`, `src/signals/provisional.ts`, `tests/unit/cargador-salas.test.ts` y la prueba de puertas en `tests/e2e/controles.spec.ts`.
- **Decisiones:**
  - Al entrar a una sala se aparece 1 m adentro de su puerta. Al volver a la portería, frente a la puerta de esa sala y mirando al pasillo.
  - Con `?sala=`, el motor también escucha el puente para que la puerta de vuelta lleve a la portería.
- **Probado:**
  - La prueba e2e va de la portería al laboratorio y vuelve, en los dos perfiles.
  - Para validar la comprobación de memoria provoqué una fuga a propósito, y la prueba falló (24 geometrías con un máximo de 13).
  - En la vista previa de Cloudflare hice el viaje laboratorio → portería.
- **No probado:** si `compileAsync` evita de verdad los tirones en un celular de gama baja.
- **Incompleto:**
  - **Todas las puertas están abiertas desde el principio**; no hay orden 1 → 5.
  - La puerta de salida y el intercomunicador no hacen nada al usarlos.

### Documentación (PR #28, abierto)

Bloque «Ahorro de builds en Cloudflare» en `CLAUDE.md`. Está **abierto, sin fusionar**, porque se pidió solo abrirlo.

### Datos y escenas provisionales que quedan en producción

- `/jugar?prueba=glb` y `public/assets/pruebas/cubo.glb` (T10).
- `/jugar?sala=<id>`, que solo cambia la sala que se dibuja, no el estado de la partida.
- Atributos de depuración en el canvas: `data-motor`, `data-sala`, `data-posicion`, `data-mirada`, `data-geometrias` y `data-mallas`. Los usan las pruebas e2e; se escriben solo cuando cambian.
- El manejo de puertas vive en el **controlador provisional** (`src/signals/provisional.ts`).

### Errores conocidos

1. **Linterna duplicada:** el controlador provisional empieza la partida con `{ id: 'linterna' }` en el inventario, pero la linterna del escritorio de la portería se llama `porteria-linterna`. Por eso sigue visible, y al recogerla aparece una segunda «Linterna». Se arregla usando el mismo id en los dos lados, o quitando la linterna inicial para que el jugador la recoja (como dice el diseño).
2. **El cuaderno de la portería** (`porteria-cuaderno`, «Recoger») entra al inventario como un objeto más, aunque el HUD ya tiene su botón de cuaderno. Falta decidir si recogerlo debe «activar» el cuaderno.
3. **Pruebas e2e con dos sesiones a la vez:** si otra sesión corre Playwright en el mismo equipo, las pruebas fallan por tiempo, porque el WebGL de las pruebas usa la CPU. Hay que correrlas en serie (`--workers=1`) y con otro puerto (`PUERTO_E2E=4521`). Las pruebas de controles llevan `test.slow()`.

### Para conectar con mi parte

**Signals que escribe el motor:**

| Signal | Archivo | Qué es |
| --- | --- | --- |
| `estadoMotor` | `signals/motor.ts` | `cargando`, `activo`, `pausado` o `detenido` |
| `enfocado` | `signals/interfaz.ts` | objeto tocado `{ id, nombre, accion }`, o `null` |
| `carga` | `signals/interfaz.ts` | `{ estado, progreso }` al cambiar de sala |
| `joystick` | `signals/controles.ts` | `{ baseX, baseY, perillaX, perillaY, radio }` en px CSS del canvas, o `null`. **Falta dibujarlo.** |
| `punteroBloqueado` | `signals/controles.ts` | `true` con el ratón bloqueado. **Falta dibujar la mira** y el aviso «Esc para soltar el ratón». |
| `pruebaCarga` | `signals/prueba-carga.ts` | solo en `?prueba=glb` |

**Signals que lee el motor:** `controlesActivos` (que depende de `fase` y `panel`), `sala` (qué sala mostrar), `sellos` (qué sala precargar), `inventario` (qué objetos ocultar) y `enfocado` (si la lógica lo vacía, se apaga el brillo).

**Órdenes:** en escritorio, `E` o el clic con el ratón bloqueado envían `enviar({ t: 'accion', objeto, accion })`, igual que el botón del HUD. El motor solo escucha el puente para el caso de `?sala=`.

**Funciones de contenido** (`src/content/salas.ts`): `SALAS_3D`, `salaPorId(lugar)`, `destinoDePuerta(idObjeto)` y `nombreDeObjeto(idObjeto)`. El tipo `Lugar` está en `src/content/esquema-salas.ts`.

**Ids que el controlador real debe atender** (al pasar de `signals/provisional.ts` a `game/partida.ts`):

| Objeto | Acción | Debería pasar a |
| --- | --- | --- |
| `porteria-puerta-1` … `porteria-puerta-5` | `usar` | `{ t: 'entrar', sala: 's1-…' … 's5-…' }`, respetando el orden de apertura |
| `s1-puerta` … `s5-puerta` | `usar` | `{ t: 'volver_porteria' }` |
| `porteria-salida` | `usar` | abrir la elección de final (con los 5 sellos) |
| `porteria-intercomunicador` | `usar` | `{ t: 'pedir_ayuda' }` con confirmación |
| los ids de `pista_por_jugador` de cada puzzle | según el JSON | abrir el panel del mecanismo |

Después de cualquier cambio de `sala`, el motor hace el resto: carga, libera memoria y coloca al jugador frente a la puerta por la que llegó.

**Montaje:** `iniciarMotor(canvas)` desde `src/ui/IslaJuego.tsx` (import dinámico); devuelve la función que libera todo.

### Riesgos para la integración del sábado

1. **Si el controlador real reemplaza al provisional sin atender las puertas, nadie sale de la portería.** El manejo de puertas está hoy en `signals/provisional.ts`, y hay que llevarlo al controlador nuevo.
2. **Rendimiento en teléfonos reales desconocido:** nunca se midieron los fps, el tiempo de entrada a una sala ni la memoria en el Android de referencia ni en un iPhone.
3. **El joystick y la mira son invisibles.** Funcionan, pero un jugador nuevo no sabe dónde poner el pulgar; solo lo explica la nota del menú.
4. **Safari en iPhone sin probar:** eventos de puntero, `touch-action`, varios dedos y la recarga por memoria.
5. **En escritorio, con el ratón bloqueado, el HUD no se puede usar** hasta apretar Esc. Puede confundir si no hay mira ni aviso.
6. **La linterna duplicada** (error 1).
7. **Ids de grabaciones distintos entre capas** de la otra sesión: `g1` en `game/partida.ts` y `grab-1` en `signals/partida.ts`. No es mío, pero rompe los finales si se conectan así.
8. **Dos sesiones tocando `src/signals/provisional.ts` y `src/engine/motor.ts` a la vez** pueden chocar; yo cambié los dos.
9. **Builds de Cloudflare:** el plan gratis tiene 500 al mes y uno a la vez. Cada push genera un build, y con varias sesiones el cupo se gasta rápido.

---

## 2. Pruebas humanas

Todo esto **no lo probé**: necesita una persona y, casi siempre, un teléfono. Los enlaces son de producción, que hoy tiene `main` con T20.

### 2.1 Arranque y pantalla (Android de referencia e iPhone)

- **Enlace:** https://la-ultima-prueba-duz.pages.dev/jugar
- **Pasos:** abrir, tocar **Jugar solo**, girar el teléfono a horizontal y volver a vertical.
- **Se espera:**
  - el pasillo de la portería en 3D a pantalla completa;
  - al arrastrar, la página no hace scroll ni zoom;
  - al girar, la imagen se adapta sin deformarse;
  - nada queda tapado por el notch.

### 2.2 Mirar con el dedo

- **Enlace:** el mismo.
- **Pasos:** arrastrar en la **mitad derecha**, despacio y rápido, en horizontal y en vertical.
- **Se espera:**
  - la vista sigue al dedo;
  - un arrastre de media pantalla gira más o menos 90°;
  - hacia arriba y hacia abajo se detiene antes de dar la vuelta.
- **Anotar:** si la sensibilidad se siente lenta o rápida; el valor actual es 0,0045 rad/px.

### 2.3 Joystick y dos dedos

- **Enlace:** el mismo.
- **Pasos:**
  1. Poner el pulgar izquierdo en cualquier punto de la **mitad izquierda** y moverlo hacia arriba, poco y luego mucho.
  2. Caminar con la izquierda y, sin soltarla, mirar con la derecha.
- **Se espera:**
  - se camina hacia donde se mira, más rápido cuanto más lejos va el dedo (máximo 2 m/s);
  - un dedo quieto no hace caminar;
  - con dos dedos a la vez, se camina y se gira al mismo tiempo.
- **Ojo:** **el círculo del joystick no se ve**; es lo esperado por ahora.
- **Anotar:** si la zona muerta o el radio de 56 px se sienten bien.

### 2.4 Colisiones

- **Enlace:** el mismo.
- **Pasos:** caminar contra las paredes, en línea recta y en diagonal; contra el escritorio de la derecha (junto a la entrada) y contra el casillero gris del fondo.
- **Se espera:**
  - nunca se atraviesa nada;
  - en diagonal contra una pared, se desliza a lo largo de ella;
  - no hay temblor al quedar pegado.

### 2.5 Tocar y usar objetos

- **Enlace:** el mismo.
- **Pasos:**
  1. Caminar hasta el fondo y tocar la **puerta de salida**.
  2. Tocar el piso.
  3. Ir a la silla de la izquierda, junto a la entrada, tocar el **cuaderno** azul y luego **Recoger**.
- **Se espera:**
  - la puerta brilla y abajo aparece «Usar · Puerta de salida»; usarla todavía no hace nada;
  - al tocar el piso, el brillo y el botón desaparecen;
  - el cuaderno desaparece de la silla y aparece en el inventario.
- **Ojo:** la **linterna** del escritorio es el error conocido 1; recogerla duplica la del inventario.
- **Anotar:** si los nombres de los objetos se leen bien en el botón en una pantalla pequeña. Los más largos son «Intercomunicador de emergencia» y «Planilla del torneo de profes».

### 2.6 Puertas y cambio de sala

- **Enlace:** el mismo.
- **Pasos:** usar cada puerta del pasillo (1, 3 y 5 a la izquierda; 2 y 4 a la derecha). En cada sala, dar media vuelta, tocar **Puerta a la portería** y usarla.
- **Se espera:**
  - se entra a la sala frente a su puerta;
  - al volver, se aparece en el pasillo frente a la puerta de esa sala, mirando al pasillo;
  - entrar y salir no da tirones ni pantallas negras largas.
- **Anotar:** cuánto tarda cada cambio, a ojo, y si hay un salto visible.

### 2.7 Las seis salas una por una

- **Enlaces:**
  - https://la-ultima-prueba-duz.pages.dev/jugar?sala=s1-cooperativa
  - https://la-ultima-prueba-duz.pages.dev/jugar?sala=s2-laboratorio
  - https://la-ultima-prueba-duz.pages.dev/jugar?sala=s3-gimnasio
  - https://la-ultima-prueba-duz.pages.dev/jugar?sala=s4-biblioteca
  - https://la-ultima-prueba-duz.pages.dev/jugar?sala=s5-rectoria
- **Pasos:** abrir cada enlace, tocar **Jugar solo** y recorrer la sala.
- **Se espera:** que cada sala coincida con `docs/salas-y-puzzles.md` y que los objetos de cada puzzle se puedan tocar:
  - **cooperativa:** estantes, mostrador con la etiquetadora, la palanca y la caja de rodillos, y la pizarra;
  - **laboratorio:** tanques verde y morado con sus perillas, el graficador y la incubadora con la campana;
  - **gimnasio:** 20 × 12 m y 9 m de alto, con gradería, reflector, postes, sensores, cinta métrica, polea y carro de balones;
  - **biblioteca:** carritos, pila de libros, mostrador, casilleros y estante M;
  - **rectoría:** urna, dispensadores, simulador, botón «ver parejas» y caja fuerte.
- **Anotar:** si la escala se siente bien (alturas de mesas y puertas) y si algún objeto importante queda fuera de alcance.

### 2.8 Pausa al cambiar de app

- **Enlace:** https://la-ultima-prueba-duz.pages.dev/jugar
- **Pasos:** durante la partida, ir a otra app o bloquear la pantalla unos segundos y volver.
- **Se espera:** la escena sigue donde estaba, sin saltos de posición.

### 2.9 Rendimiento y memoria (lo más importante para el sábado)

- **Enlaces:** https://la-ultima-prueba-duz.pages.dev/jugar?sala=s3-gimnasio (la sala más grande) y https://la-ultima-prueba-duz.pages.dev/jugar
- **Pasos:**
  1. En el gimnasio, caminar y girar rápido durante un minuto.
  2. En la portería, entrar y salir de las 5 salas dos veces seguidas (unos 10 cambios).
- **Se espera:**
  - movimiento fluido, a unos 30 fps o más, sin tirones;
  - en el iPhone, **Safari no recarga la pestaña** después de los cambios de sala.
- **Nota:** el panel de métricas `?debug=1` (T11n) no está hecho, así que por ahora se juzga a ojo.

### 2.10 Formatos de textura KTX2 en el teléfono

- **Enlace:** https://la-ultima-prueba-duz.pages.dev/jugar?prueba=glb
- **Pasos:** abrir y leer la línea **«Texturas: …»**.
- **Se espera:** en Android, `ETC2 RGB` o `ASTC 4×4`; en iPhone, `ASTC 4×4`. **Si dice `RGBA sin comprimir`**, el teléfono no está usando texturas comprimidas y gastaría de 4 a 8 veces más memoria: avisar.
- **Anotar:** el tiempo «listo en … ms» de cada teléfono.

### 2.11 Escritorio: teclado y ratón

- **Enlace:** https://la-ultima-prueba-duz.pages.dev/jugar, en un computador, con Chrome, Firefox y Safari si se puede. **Solo lo probé en Chromium.**
- **Pasos:**
  1. Caminar con **W A S D** y con las flechas.
  2. Hacer clic en el piso y mover el ratón.
  3. Apuntar a la puerta de salida y apretar **E**.
  4. Apretar **Esc**.
  5. Hacer clic directo sobre un objeto y luego en su botón del HUD.
- **Se espera:**
  - la página no hace scroll con las flechas;
  - tras el clic en el piso, el cursor desaparece y el ratón gira la vista;
  - el objeto apuntado se resalta y E lo usa;
  - Esc devuelve el cursor;
  - un clic sobre un objeto no bloquea el ratón, y el botón del HUD se puede clicar.

### 2.12 Audio

Mi trabajo no incluye audio: no hay nada que probar de mi parte.
