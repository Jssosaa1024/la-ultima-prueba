# Reporte de la ola 1 · Sesión B · 14 de noviembre de 2026

Esta sesión es dueña de `src/game/`, `src/content/` y `docs/`. En esta ola hizo tres tareas, las tres fusionadas en `main`: T27b ([#35](https://github.com/Jssosaa1024/la-ultima-prueba/pull/35)), T23 ([#36](https://github.com/Jssosaa1024/la-ultima-prueba/pull/36)) y T29 ([#38](https://github.com/Jssosaa1024/la-ultima-prueba/pull/38)).

Resumen honesto: **todo sigue siendo lógica y datos sin pantalla, y nada de esto está conectado al juego todavía.** Ningún archivo de `src/engine/`, `src/ui/` ni `src/signals/` llama a las funciones nuevas. No toqué esas tres carpetas. **No abrí el juego en un celular ni lo recorrí a mano en un navegador:** de las vistas previas solo comprobé que el build de Cloudflare pasó y que `/jugar/` responde.

## 1. Qué hice

### T27b · Qué cuenta como «intento» (#35)

Las pistas se ofrecen por tiempo o por intentos fallidos, pero «intento» no estaba definido. Ahora cada etapa de cada puzzle lo dice en el JSON (campo `intento`), y `src/game/intentos.ts` lo aplica.

| Sala | Etapas | Cuenta un intento cuando… |
| --- | --- | --- |
| 1 · Etiquetadora | las tres | se baja la palanca y el precio no es el de la pizarra |
| 2 · Tanques | las tres | se arranca una corrida que no abre la incubadora |
| 3 · Reflector | presentar y torcer | tras mover algo, todo queda quieto 5 s y algún sensor no suena |
| 3 · Reflector | dominar | se suelta la polea con una longitud que no es la del marcador |
| 4 · Carritos | las tres | con los 20 libros repartidos, quedan quietos 5 s y falta alguna lámpara |
| 5 · Urna | las tres | se tira de la manija de la caja y la urna no cumple la placa |

**Decisiones mías, no del diseño:**

- **Sala 4 (lámparas en vivo): regla de «reposo».** Como no hay palanca, el intento es el momento en que el jugador deja de mover libros y mira las lámparas: 5 segundos quieto, con la pila vacía y sin resolver. No cuenta cada libro movido (las pistas llegarían en segundos) ni un reparto a medias. El mismo reparto no cuenta dos veces.
- **Sala 3: la propuesta original («soltar la polea») solo servía para la última etapa.** En las dos primeras no hay polea, solo sensores en vivo. Les puse la misma regla de reposo de 5 s.
- **Sala 2: el intento cuenta al arrancar la corrida**, no al sonar la campana.
- **Cooperativo:** un intento es cada propuesta aceptada por todos que no resuelve. Quedó escrito en la especificación; no hay código de red todavía.

**Incoherencia de la sala 2, corregida.** El diseño decía que la corrida «dura unos 10 segundos», pero la campana de la tercera etapa suena a los 12. Ahora la corrida dura exactamente hasta la campana de cada etapa (10, 8 y 12 s): no existe otra duración. Quedó la función `duracionCorridaS`, los cinco pasos para quien haga el panel en la especificación («Sala 2: la corrida dura hasta la campana») y el texto corregido en `docs/salas-y-puzzles.md`. El esquema rechaza campanas de más de 15 s.

### T23 · Script `hash-answers` y validador (#36)

- `npm run hash-answers` recorre todos los estados que se pueden armar en cada etapa, se queda con los que la resuelven y guarda el hash de cada uno en `src/content/respuestas.json` (8 KB, solo hashes).
- `estaResuelta` (`src/game/respuestas.ts`) dice si un estado resuelve una etapa comparando hashes, sin leer la solución ni la condición de éxito.
- Los tests comprueban, estado por estado (unos 160.000), que el validador y las reglas de T26 dicen lo mismo.

**Decisiones mías:**

- SHA-256 propio en `src/game/sha256.ts`, para no agregar dependencias y para que sea síncrono. Los tests lo comparan con el de Node.
- Se guardan 16 caracteres de cada hash, no los 64, para que el archivo sea pequeño.
- El orden de los rodillos y el de los días no cambian el hash, porque las máquinas no los distinguen.
- Los imports de `src/game/puzzles/` ahora llevan `.ts`, para que Node pueda correr el script sin herramientas extra.
- En `package.json` (archivo compartido) agregué una sola línea: el script `hash-answers`.

### T29 · Reparto de roles A–D y rotación (#38)

`src/game/reparto.ts` dice quién tiene cada encargo según el número de jugadores y la sala.

| Jugadores | Sala 1 | Sala 2 | Sala 3 | Sala 4 | Sala 5 |
| --- | --- | --- | --- | --- | --- |
| 2 | AB · CD | CD · AB | AB · CD | CD · AB | AB · CD |
| 3 | A · BC · D | BC · D · A | D · A · BC | A · BC · D | BC · D · A |
| 4 | A · B · C · D | B · C · D · A | C · D · A · B | D · A · B · C | A · B · C · D |

**Decisiones mías:** el diseño dice que los encargos «rotan entre salas», pero no cómo.

- La sala 1 sigue la tabla del diseño. En cada sala siguiente, cada jugador recibe el grupo de encargos que tenía el jugador de al lado. Así todos accionan la máquina (D) en alguna sala y nadie lo hace dos salas seguidas.
- El reparto depende de la sala, no de cuántas veces se entró: volver a una sala da el mismo reparto.
- Si quien tiene D se desconecta, D pasa al siguiente jugador conectado, y lo recupera al volver (`repartirConectados`). La especificación solo decía «se reasigna».

En el mismo PR arreglé una prueba de T23 que yo había dejado frágil (ver «Errores míos»).

## 2. Qué quedó incompleto

1. **Nada está conectado.** Los paneles de las máquinas (T45, T52, T58, T64, T70), el panel de pistas (T38) y el controlador que reemplace a `src/signals/provisional.ts` no existen. Nadie llama a `intentoAlAccionar`, `avanzarReposo`, `estaResuelta` ni `repartir`.
2. **Las soluciones todavía viajan en el juego.** Los JSON de los puzzles siguen trayendo `solucion` y `exito`, y entrarán al bundle cuando el juego importe `src/content/puzzles.ts`. T23 dejó el validador que permite quitar `solucion`, pero no la quita: cambiaría el tipo `Puzzle` que ya usan otras partes, y los paneles necesitan `exito` para las lámparas y los sensores en vivo. Falta una tarea para eso.
3. **El hash no es un candado fuerte.** Con tan pocos estados por etapa, alguien con herramientas puede probarlos todos. La especificación ya acepta ese riesgo.
4. **`hash-answers --comprobar` no corre en el build.** Si alguien cambia un puzzle y no corre el script, lo detecta un test de unidad (`npm run verify`), no `npm run build`.
5. **El reparto no está en el protocolo de red.** `src/net/` no existe; T29 es solo la función.
6. **Con 4 jugadores, la sala 5 repite el reparto de la sala 1** (hay 5 salas y 4 personas).
7. **La especificación no cambió de número de versión.** Agregué T27b a la lista y tres apartados nuevos (intentos, hashes, reparto), pero el encabezado sigue en v1.2 y el total de «128 tareas» no cuenta T19b ni T27b.
8. Sigue pendiente de la sesión anterior: el reto extra de 16 fichas, la variante de 10° de la biblioteca y la «hora del juego» del reloj de pared.

### Errores míos en esta ola

- **Una prueba de T23 quedó frágil en `main` desde que se fusionó #36 hasta que se fusionó #38** (unos 10 minutos). Recorría los 160.000 estados calculando un hash por cada uno y, con el equipo ocupado por las otras sesiones, pasaba de los 5 s que da Vitest y fallaba. Lo vi al correr `npm run verify` para T29 y lo corregí en ese PR (un hash por forma canónica y 60 s de margen). Si alguna sesión vio fallar `hash-answers.test.ts` en ese rato, fue esto.
- **En T27b corrí `npm run verify` con un error de tipos** que mis propios cambios introdujeron; lo encontró la verificación y lo corregí antes del commit.
- **Subí las ramas de T27b y T23 antes de terminar las e2e.** Desde T29 hago un solo push por PR, cuando todo está en verde, como pidió Alex.

### Pruebas e2e: fallos intermitentes

Corrí `PUERTO_E2E=4522 npx playwright test --workers=1` en los tres PR. Ninguna corrida completa salió del todo en verde:

| PR | Corrida completa | Al repetir las que fallaron |
| --- | --- | --- |
| T27b (#35) | 83 pasan, 5 saltadas, **2 fallan** (HUD al empezar y `?sala=s3-gimnasio`, perfil celular) | `hud.spec.ts` y `salas.spec.ts` solos: 20 de 20 |
| T23 (#36) | 84 pasan, 5 saltadas, **1 falla** (puerta de salida, perfil celular) | `controles.spec.ts` solo: primero fallaron otras 2 (ratón y puertas, escritorio); a la segunda, 16 de 16 |
| T29 (#38) | 84 pasan, 5 saltadas, **1 falla** (puertas, perfil escritorio) | `controles.spec.ts` solo: 16 de 16 |

Las pruebas que fallaron fueron distintas cada vez, siempre por tiempos de espera de 5 s en pruebas del motor o del HUD, y pasaron al repetirlas solas. Mis PR no tocan `src/engine`, `src/ui` ni `src/signals`. Creo que es la carga del equipo (tres sesiones con WebGL por software), pero **no lo demostré**: conviene que alguien corra las e2e con el equipo libre.

## 3. Qué debe revisar una persona

### 3.1 La regla de intentos de las salas 3 y 4 (Alex)

- **Enlace:** https://github.com/Jssosaa1024/la-ultima-prueba/blob/main/docs/especificacion-tecnica.md (busca «Qué cuenta como intento»).
- **Para decidir:**
  - si 5 segundos quieto es buen momento para contar un intento en la biblioteca y en el gimnasio;
  - si 3, 6 y 9 intentos fallidos siguen siendo buenos umbrales con esta regla. Tres pausas de 5 s pueden pasar en menos de un minuto, así que la primera pista puede llegar antes de los 2 minutos.
- Cambiarlo es cambiar un número en los JSON de `src/content/puzzles/`.

### 3.2 La corrida de la sala 2 (Alex o quien haga el panel)

- **Enlace:** el mismo documento, apartado «Sala 2: la corrida dura hasta la campana».
- **Para decidir:** si está bien que la tercera etapa tenga corridas de 12 s (2 más que la primera), y si el eje fijo de 0 a 15 s del graficador se lee bien en un celular. Lo segundo solo se sabrá con el panel hecho.

### 3.3 La rotación de encargos (Alex o un docente)

- **Enlace:** el mismo documento, apartado «Reparto y rotación de encargos».
- **Para decidir:**
  - si con 3 jugadores está bien que B y C vayan siempre juntos (así lo dice la tabla del diseño);
  - si con 2 jugadores está bien que solo se alternen dos repartos;
  - si D debe pasar a un suplente cuando su dueño se desconecta, o si el grupo debería esperar.

### 3.4 Prueba en papel con estudiantes (pendiente desde la sesión anterior)

Sigue siendo la del reporte `docs/reportes/sesion-B.md`, sección 2.5. Ahora hay algo más que anotar: **cuántas veces se detiene el estudiante a mirar las lámparas** de la biblioteca antes de pedir ayuda. Con eso se ajustan los 5 segundos y los umbrales.

### 3.5 El juego no se rompió (celular)

- **Enlace:** https://la-ultima-prueba-duz.pages.dev/jugar/
- **Pasos:**
  1. Abre el enlace en el Android de referencia y en un iPhone.
  2. Toca «Jugar solo».
  3. Camina, entra a una sala y abre el cuaderno.
- **Qué se espera:** lo mismo que antes de esta ola. Mis cambios no tocan pantallas. No lo probé en un celular.

## 4. Para las sesiones A y C

Cómo usar lo nuevo desde un panel o desde el controlador:

1. **Intentos con palanca, polea o manija:** al accionar, si `intentoAlAccionar(puzzle, etapa, idObjeto, estado)` es verdadero, llama a `registrarIntento(pistas, puzzle.pistas)`.
2. **Intentos por reposo (sala 4 y dos etapas de la sala 3):** guarda un `Reposo` por etapa (empieza en `REPOSO_INICIAL`). En cada cambio del mecanismo, reemplázalo por `alCambiarEstado()`. Con cada avance del reloj activo, llama a `avanzarReposo(puzzle, etapa, estado, reposo, ms)`: guarda el `reposo` que devuelve y, si `intento` es verdadero, registra el intento.
3. **Sala 2:** la animación de la corrida dura `duracionCorridaS(etapa)` segundos, en tiempo real.
4. **¿Resuelta?:** `evaluar(puzzle, etapa, estado)` sigue siendo la forma normal y da las condiciones en vivo. `estaResuelta(RESPUESTAS, puzzle, etapa, estado)` da solo sí o no, con hashes.
5. **Roles:** `repartir(jugadores, numeroDeSala)` devuelve `{ A, B, C, D }` con el id del jugador de cada encargo. En individual, pásale una lista con un solo id.
6. **Si cambias un puzzle:** sube su `version` y corre `npm run hash-answers`; si no, falla `tests/unit/hash-answers.test.ts`.
