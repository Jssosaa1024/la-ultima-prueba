# Reporte de la sesión B · 12 de noviembre de 2026

Esta sesión fue dueña de `src/game/`, `src/content/` y `docs/`. Hizo un PR de documentos y las tareas T21, T22, T24, T25, T26, T27, T28 y T30 de la especificación v1.2, todas fusionadas en `main`. T23 y T29 se omitieron por instrucción.

Resumen honesto: **todo lo de esta sesión es lógica y datos sin pantalla, y todavía nada de eso está conectado al juego.** Ningún archivo de `src/engine/`, `src/ui/` ni `src/signals/` importa `src/game/` ni `src/content/puzzles.ts` (lo comprobé con `grep` al escribir este reporte). El juego que se ve en el celular sigue funcionando con el controlador provisional de `src/signals/provisional.ts`.

Las 113 pruebas de unidad de esta sesión pasan en local (`npx vitest run`), y `npm run verify` pasó antes de cada fusión. No corrí `npm run test:e2e` en ningún PR, porque ninguno tocó páginas. **No abrí el juego en un navegador ni en un celular en ningún momento.**

## 1. Estado técnico

### Docs · AGENTS, diseño y especificación v1.2 ([#15](https://github.com/Jssosaa1024/la-ultima-prueba/pull/15))

**Qué quedó**
- `AGENTS.md`:
  - público de grado 9 en adelante, con foco en 10, y sin relación con el ICFES ni con el Saber 11;
  - la sección «Contenido» describe el esquema de puzzle.
- `docs/diseno.md`: reescrito con la premisa de la memoria USB, las cinco máquinas, el reparto A–D y los finales.
- `docs/especificacion-tecnica.md` pasó a la v1.2:
  - la sección 2 es ahora «Esquema JSON de un puzzle»;
  - `competencia` se reemplazó por `proceso` (Estándares del MEN) y se agregó `grado`;
  - cambiaron las descripciones de T21–T23, T26, T27, T34, T37, T38, T45, T52, T58, T64, T70, T75 y T100;
  - la tabla del protocolo cooperativo pasó de `pregunta`/`opcion` a `puzzle`/`etapa`/`estado`;
  - cambió la fila de riesgos del Saber 11.
- `README.md`: una línea (el público).
- `docs/salas-y-puzzles.md`: solo la casilla del checklist.

**Decisiones que no estaban en ningún documento**
- La colección de Astro 7 va en `src/content.config.ts`, porque Astro 7 da error con `src/content/config.ts`. El esquema vive en `src/content/esquema.ts`.

**Incompleto o pendiente**
- `CLAUDE.md` todavía dice, en «Contexto que manda sobre los docs viejos», que los docs mencionan el Saber 11. Ya no es cierto, pero no lo toqué.
- Las tareas T37, T38, T45, T52, T58, T64 y T70 (de otras sesiones) cambiaron de descripción en la v1.2. Quien las tome debe leer la versión nueva.

**Paso 1 (subir `docs/salas-y-puzzles.md`)**: no necesitó PR. El archivo ya estaba en `main`, idéntico, dentro del PR de T35 de otra sesión.

### T21 · Esquema de puzzle ([#18](https://github.com/Jssosaa1024/la-ultima-prueba/pull/18))

**Qué quedó**
- `src/content/esquema.ts`: esquema zod con campos comunes, cinco variantes por mecanismo (`etiquetadora`, `tanques`, `reflector`, `carritos`, `urna`) y validaciones cruzadas en `problemasDelPuzzle()`.
- `src/content.config.ts`: la colección `puzzles` sobre `src/content/puzzles/*.json`. Comprobé, con un JSON malo puesto a propósito, que `astro sync` falla con exit 1.
- Pruebas: `tests/unit/esquema-puzzle.test.ts`. El fixture `tests/unit/fixtures/puzzle-s4.json` es copia del ejemplo de la especificación y no se sincroniza solo con `src/content/puzzles/s4-carritos.json`.

**Decisiones que no estaban en la especificación**
- Cada puzzle se separa en `estado_inicial`, `controles`, `exito` y `solucion` por etapa. La forma de cada uno depende del mecanismo (tabla en la sección 2 de la especificación).
- `pistas` es una sola lista de 3 por puzzle (no por etapa), con `tras_segundos` y `tras_intentos` opcional.
- `cuaderno` es `{ concepto, texto }`.

**Riesgos conocidos**
- `esquema.ts` importa zod. Si alguien lo importa desde código del cliente, zod entra al bundle del juego. El juego debe usar `src/content/puzzles.ts` y `import type`.

### T22 · Los cinco puzzles en JSON ([#19](https://github.com/Jssosaa1024/la-ultima-prueba/pull/19))

**Qué quedó**
- Los cinco JSON en `src/content/puzzles/`: `s1-etiquetadora`, `s2-tanques`, `s3-reflector`, `s4-carritos` y `s5-urna`.
- `src/content/puzzles.ts`: `PUZZLES` y `puzzleDeSala(n)`, con un cast `as unknown as Puzzle[]`. La validación real la hacen el build y `tests/unit/puzzles.test.ts`.

**Decisiones mías, no del diseño**

| Puzzle | Decisión |
| --- | --- |
| Todos | `proceso` y `grado`: s1 procedimientos, 9° · s2 modelar, 9° · s3 formular y resolver, 10° · s4 razonar, 9° · s5 modelar, 10°. Es criterio mío, sin revisión pedagógica. |
| Todos | Pistas por intentos tras 3, 6 y 9 intentos fallidos. El diseño solo decía 120, 240 y 360 s. |
| s2 tanques | Perilla de 0 a 6 cm/s y tanques de 60 cm de alto. |
| s3 reflector | El poste de 3 m empieza a 4 m de su sensor, la polea empieza en 3 m y su rango es de 1 a 9 m. Las muescas usan razones idealizadas (sombra ÷ altura: 27° → 2, 37° → 4/3, 45° → 1, 53° → 3/4, 63° → 1/2). |
| s4 carritos | La etapa «torcer» empieza en 4, 4, 4, 4, 4 y la «dominar» en 1, 2, 3, 3, 11. |
| s5 urna | Cada etapa empieza con las fichas de la solución anterior. Máximo 10 fichas por color. |
| Todos | Los ids de objeto de `pista_por_jugador` los inventé yo (`s1-pizarra`, `s2-hoja-ayer`, `s3-polea`…). |
| Todos | Los textos de `situacion`, `aja` y pistas por rol son míos, a partir de `docs/salas-y-puzzles.md`. |

**Incompleto**
- No están en el JSON el reto extra de 16 fichas (sala 5) ni la variante de 10° de la biblioteca.
- No están las líneas de La Voz ni las transcripciones de las grabaciones: eran T34 y T75, que no eran mías.

### T24 · Máquina de estados de la partida ([#20](https://github.com/Jssosaa1024/la-ultima-prueba/pull/20))

**Qué quedó**
- `src/game/partida.ts`: `crearPartida()`, `aplicar(partida, acción)` y ayudas como `salaAbierta`, `etapaActual`, `salasResueltas`, `numeroDeSala` y `salaPorNumero`.
- Pruebas: `tests/unit/partida.test.ts`.

**Decisiones**
- `aplicar` devuelve **el mismo objeto** si la acción no está permitida, para que el controlador sepa que no pasó nada.
- Se entra y se sale de las salas solo pasando por la portería.
- Una sala resuelta sigue abierta.

### T25 · Reloj ([#21](https://github.com/Jssosaa1024/la-ultima-prueba/pull/21))

**Qué quedó**
- `src/game/reloj.ts`, con la misma forma `{ restanteMs, pausado, desde }` que el signal `reloj`.
- `formatoRestante()` devuelve `mm:ss` redondeando hacia arriba.
- Pruebas: `tests/unit/reloj.test.ts`.

**Incompleto**
- No hay función de «hora del juego» (23:59 → 00:40). La portería del diseño tiene un reloj de pared con esa hora.

### T26 · Una función pura por puzzle ([#22](https://github.com/Jssosaa1024/la-ultima-prueba/pull/22))

**Qué quedó**
- `src/game/puzzles/`, un archivo por máquina más `index.ts` con `evaluar(puzzle, etapa, estado)`:
  - devuelve `{ condiciones, resuelta }`, o `null` si el estado no es válido para esa etapa;
  - incluye ayudas para los paneles: `precioImpreso`, `nivelEn`, `sombra`, `RAZON_SOMBRA`, `estadisticas`, `librosEnPila`, `parejas` y `probabilidadMismoColor`.
- El esquema usa estas funciones en el build: cada solución debe resolver su etapa, ningún estado inicial puede venir resuelto, las muescas deben existir y la hoja de ayer debe cuadrar con el tanque B.
- Pruebas: `tests/unit/reglas-puzzles.test.ts`. Con búsqueda exhaustiva comprueban que cada etapa tiene solo las salidas del diseño.

**Decisiones**
- Validar el estado dentro de `evaluar` (`esEstado…`), porque llegará de la red y de `localStorage`.
- Comparar con fracciones exactas, sin decimales.

**Incidente**
- La vista previa de Cloudflare de este PR se quedó «Building» más de 20 minutos. La relancé al subir una fusión con `main` y pasó en unos 3 minutos. No sé la causa.

### T27 · Pistas graduales ([#23](https://github.com/Jssosaa1024/la-ultima-prueba/pull/23))

**Qué quedó**
- `src/game/pistas.ts`: `EstadoPistas { msEnEtapa, intentosEnEtapa, ofrecidas, vistas }` y las funciones `avanzarTiempo`, `registrarIntento`, `nuevaEtapa`, `verPista`, `hayPistaNueva`, `pistasVistas` y `segundosParaSiguiente`.
- Pruebas: `tests/unit/pistas.test.ts`.

**Decisiones**
- Una pista ofrecida sigue disponible en las etapas siguientes del mismo puzzle.
- El jugador abre las pistas en orden, y `vistas` sirve para el «sin pistas» del final.

**Falta decidir: qué cuenta como «intento»**
- No está definido. En la biblioteca no hay palanca (las lámparas son en vivo), así que ahí, si nadie lo define, las pistas solo llegan por tiempo.
- Propuesta: un intento es bajar la palanca (s1), arrancar una corrida (s2), soltar la polea (s3) o girar la manija de la caja (s5) sin resolver.

### T28 · Sellos, grabaciones y finales ([#24](https://github.com/Jssosaa1024/la-ultima-prueba/pull/24))

**Qué quedó**
- En `src/game/partida.ts`:
  - `sellos()` y `tieneCincoSellos()`;
  - las grabaciones, con `GRABACION_EN_SALA`;
  - las acciones `recoger_grabacion`, `elegir_final`, `pedir_ayuda` y `tiempo_agotado`;
  - `opcionesDeFinal()`, que dice si se puede salir o restaurar y cuántas grabaciones faltan y dónde.
- Reemplacé la acción provisional `terminar` de T24; nadie la usaba.
- Pruebas: `tests/unit/reglas-finales.test.ts`.

**Decisiones**
- Elegir final exige estar en la portería.
- Pedir ayuda se permite desde cualquier lugar, porque el diseño dice «en cualquier momento», aunque el intercomunicador está en la portería.

**Error conocido (mío)**
- `game/partida.ts` usa los ids de grabación `g1`, `g2` y `g3`, pero `src/signals/partida.ts` usa `grab-1`, `grab-2` y `grab-3` desde T40.
- En el PR #24 escribí que los ids eran los mismos de signals. **Era falso**: me basé en una lectura anterior a T40.
- Hay que unificarlos antes de conectar: cambiar `GRABACIONES` y `GRABACION_EN_SALA` en `game/`, y `guardado.ts`, que los reutiliza.

### T30 · Guardar y reanudar ([#25](https://github.com/Jssosaa1024/la-ultima-prueba/pull/25))

**Qué quedó**
- `src/game/guardado.ts`: `guardar(almacén, g)`, `cargar(almacén, PUZZLES)` y `borrarGuardado`, sobre la clave `la-ultima-prueba:partida`.
- `leerGuardado()` revisa todo campo por campo:
  - estructura, rangos y coherencia de la partida;
  - pistas, notas (≤ 280 caracteres, ids `n` + número) y datos (ids en minúsculas con guiones);
  - descarta los ajustes de mecanismo que ya no sean válidos.
- Pruebas: `tests/unit/guardado.test.ts`.

**Decisiones**
- Al reanudar, el reloj arranca en pausa y el tiempo con la pestaña cerrada no cuenta.
- Solo se guarda mientras se juega; un final borra el guardado.

**Incompleto**
- Nadie llama a `guardar()` ni a `cargar()`, y no existe el botón «Continuar partida».
- No está decidido cada cuánto se guarda. Sugerencia: en cada acción aceptada, al pausar y en `visibilitychange`.

### Lo que otra sesión necesita para conectar con esta parte

No hay signals ni eventos de esta sesión: todo son funciones puras. Las tiene que llamar un controlador que reemplace a `src/signals/provisional.ts` (carpeta de otra sesión).

1. **Datos:** `import { PUZZLES, puzzleDeSala } from '../content/puzzles'`. Nunca importes `content/esquema` en el cliente; para tipos, usa `import type`.
2. **Partida:** guarda un `Partida` (de `crearPartida()`) y pasa cada orden por `aplicar()`. Para saber si se aplicó, compara con `===`. Luego copia a los signals:
   - `sala` ← `p.lugar`
   - `sellos` ← `sellos(p)` (mismos ids de sala)
   - `grabaciones` ← `p.grabaciones` **convirtiendo `g1` → `grab-1`, mientras no se unifiquen**
   - `final` ← `p.final`
   - `fase` ← `'final'` cuando `p.fase === 'final'`
3. **Reloj:** `game/reloj.ts` tiene la misma forma que el signal `reloj`, así que se puede asignar directo. Cuando `agotado(r, ahora)`, aplica `{ t: 'tiempo_agotado' }`.
4. **Mecanismos:** cada panel arma el estado con la forma de `solucion` de su etapa y llama a `evaluar(puzzle, etapa, estado)`.
   - Si `resuelta`: `aplicar({ t: 'resolver_etapa', sala, etapa })`, `nuevaEtapa(pistas)` y cargar el `estado_inicial` de la siguiente etapa.
   - Si no, y fue un «intento»: `registrarIntento(pistas, puzzle.pistas)`.
   - Las lámparas y sensores en vivo se leen de `condiciones`.
5. **Pistas:** un `EstadoPistas` por sala (empieza en `PISTAS_INICIALES`). Llama a `avanzarTiempo` con los ms de reloj activo; el reloj en pausa no cuenta.
6. **Finales:** los botones de la puerta usan `opcionesDeFinal(p)`.
7. **Guardado:** `guardar(localStorage, {...})` y `cargar(localStorage, PUZZLES)`.
   - Ojo: el controlador provisional numera las notas `n1`, `n2`… desde cero. Al reanudar, hay que seguir desde el mayor id guardado, o se repiten.
8. **Faltan signals nuevos** para el estado de cada mecanismo y para las pistas (no existen en `src/signals/`).

### Riesgos para la integración del sábado

1. **Nada de `game/` está conectado.** El controlador, los paneles de las cinco máquinas (T45, T52, T58, T64, T70) y el panel de pistas (T38) no existen en `main`. Es el riesgo más grande.
2. **Ids de grabación distintos** (`g1` contra `grab-1`), explicado arriba.
3. **Ids de objetos distintos.** El motor y `signals/ejemplo.ts` usan objetos del diseño viejo de la sala 1 (`s1-factura`, `s1-menu`, `s1-tarjeta`). Los JSON usan `s1-productos`, `s1-pizarra`, `s1-caja-rodillos` y `s1-palanca`. Hay que alinear unos con otros.
4. **Campana y duración de la corrida (sala 2).** El diseño dice que cada corrida dura unos 10 s, pero en la etapa «dominar» la campana suena a los 12 s. La animación debe durar al menos `exito.campana_s`.
5. **Intentos sin definir:** sin esa decisión, las pistas por intentos no funcionan igual en todas las salas.
6. **Contenido sin revisión humana:** textos, proceso, grado y razones idealizadas de las sombras.

## 2. Pruebas humanas

Lo de esta sesión no tiene nada visible todavía. Por eso varias de estas pruebas son de lectura o en papel, y la de celular solo sirve para descartar que algo se haya roto. Los enlaces respondieron con código 200 el 12 de noviembre por la noche (comprobado con `curl`), pero **no abrí ninguno en un navegador**.

### 2.1 El juego no se rompió (Android de gama baja)

- **Enlace:** https://la-ultima-prueba-duz.pages.dev/jugar/ (producción, con todo lo de `main`).
- **Pasos:**
  1. Abre el enlace en Chrome del Android de referencia.
  2. Toca «Jugar solo».
  3. Camina con el joystick y mira arrastrando.
  4. Abre y cierra el cuaderno.
- **Qué se espera:** lo mismo que antes de esta sesión. Mis cambios no tocan pantallas, así que cualquier diferencia viene de otra parte. No lo probé en un celular.

### 2.2 El juego no se rompió (iPhone, Safari)

- **Enlace:** https://la-ultima-prueba-duz.pages.dev/jugar/
- **Pasos:** los mismos de 2.1, en Safari.
- **Qué se espera:** lo mismo que en Android. No lo probé.

### 2.3 Leer los textos de los cinco puzzles (Alex o un docente, en el computador o el celular)

- **Enlaces:**
  - https://github.com/Jssosaa1024/la-ultima-prueba/blob/main/src/content/puzzles/s1-etiquetadora.json
  - https://github.com/Jssosaa1024/la-ultima-prueba/blob/main/src/content/puzzles/s2-tanques.json
  - https://github.com/Jssosaa1024/la-ultima-prueba/blob/main/src/content/puzzles/s3-reflector.json
  - https://github.com/Jssosaa1024/la-ultima-prueba/blob/main/src/content/puzzles/s4-carritos.json
  - https://github.com/Jssosaa1024/la-ultima-prueba/blob/main/src/content/puzzles/s5-urna.json
- **Pasos:** en cada archivo, lee `situacion`, `aja`, `pistas`, `cuaderno` y `pista_por_jugador`.
- **Qué se espera:**
  - español de Colombia natural (`$1.600`, `0,8`);
  - ninguna pista da pasos de cálculo, solo invita a mirar algo;
  - nada menciona el ICFES ni el Saber 11;
  - el tono de La Voz no se cuela en los textos del sistema.
- **Para decidir aquí mismo:** si el `proceso` y el `grado` de cada puzzle te parecen bien. Los elegí yo.

### 2.4 Las razones de las sombras (docente de matemáticas)

- **Enlace:** https://github.com/Jssosaa1024/la-ultima-prueba/blob/main/src/game/puzzles/reflector.ts
- **Pasos:** revisa la tabla `RAZON_SOMBRA`.
- **Qué se espera:** que las aproximaciones sean aceptables para enseñar tangente (tan 27° ≈ 0,51 se usa como 1/2; tan 63° ≈ 1,96 como 2; tan 37° ≈ 0,75 como 3/4; tan 53° ≈ 1,33 como 4/3). Si no, hay que cambiar la tabla, y quizá las muescas, en el JSON y en el código.

### 2.5 Prueba en papel de los cinco puzzles con uno o dos estudiantes de 9° o 10°

Es el checklist pendiente de `docs/salas-y-puzzles.md`, ahora con los números exactos de los JSON.

- **Enlace de referencia:** https://github.com/Jssosaa1024/la-ultima-prueba/blob/main/docs/salas-y-puzzles.md
- **Materiales:**
  - etiquetadora: tarjetas con −20 %, +20 %, +25 %, −50 % y +50 %, y precios $2.000 → $1.600, $1.600 → $2.000 y $4.000 → $3.000;
  - tanques: papel cuadriculado con tanques de 60 cm y caudales de 0 a 6;
  - reflector: linterna, palos de 1, 2 y 3 unidades y un transportador;
  - carritos: 20 libros u objetos y 5 cajas;
  - urna: una bolsa con hasta 10 fichas de cada color, con forma y color distintos.
- **Pasos:**
  1. Por cada sala, plantea las tres etapas en orden sin explicar el concepto.
  2. Cronometra.
  3. Ofrece la pista 1 a los 2 minutos, la 2 a los 4 y la 3 a los 6.
- **Qué se espera:**
  - la etapa «presentar» se resuelve probando;
  - en «torcer» aparece la sorpresa del diseño (+20 % no deshace −20 %; 2 y 2 no es justo);
  - cada sala se resuelve en 5 a 7 minutos;
  - anota si 3, 6 y 9 intentos fallidos son buen momento para ofrecer pistas.

### 2.6 Guardar y reanudar en un iPhone real

**Todavía no se puede probar**, porque nadie llama a `guardar()` ni a `cargar()`. Cuando esté conectado:

- **Enlace:** https://la-ultima-prueba-duz.pages.dev/jugar/
- **Pasos:**
  1. Juega hasta la mitad de la sala 2.
  2. Escribe una nota en el cuaderno.
  3. Recarga la pestaña en Safari.
- **Qué se espera:**
  - la partida sigue en la misma sala y etapa, con la perilla donde estaba;
  - la nota sigue ahí;
  - el reloj está en pausa con el tiempo que quedaba.

Repite la prueba en una pestaña privada: ahí no se guarda nada y el juego no debe fallar.

### Lo que no aplica a esta sesión

Sensación de los controles, legibilidad en pantalla y audio: esta sesión no hizo nada que se vea o se oiga, así que no hay nada de ella que comprobar en esos puntos.
