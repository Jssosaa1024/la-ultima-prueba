# Reporte de la sesión C · Interfaz y signals

12 de noviembre de 2026. Esta sesión era dueña de `src/ui/` y `src/signals/` e hizo T31, T32 (solo «Jugar solo»), T33, T35, T36, T40 y T41 (PR #6, #7, #8, #10, #11, #14 y #17, todos fusionados). Este reporte cubre solo ese trabajo.

**Estado comprobado sobre `main` (`dbf731e`), el 12 de noviembre, después de fusionar también lo de las otras sesiones:**

- `npm run verify` en verde: 258 tests de unidad.
- `npx playwright test --workers=1`: 85 pasan y 5 se saltan a propósito (pruebas de teclado en el perfil celular y de dos dedos en escritorio). Tarda unos 7 minutos.
- Producción (`https://la-ultima-prueba-duz.pages.dev`) sirve exactamente ese build: el archivo de la isla tiene el mismo hash (`IslaJuego.BlyyRLNB.js`) en local y en producción.
- **Nada de esto se ha probado en un celular real.** Todo lo verificado fue en Playwright (Pixel 5 emulado y Chrome de escritorio) y a mano en el navegador de la app con 375 × 812 px.

---

## 1. Estado técnico

### T31 · Store de signals y puente con el motor

**Qué quedó**

- `src/signals/partida.ts`: `fase` (`inicio`, `cargando`, `jugando`, `final`), `modo`, `sala`, `reloj`, `sellos`, `grabaciones`, `inventario`, `final`, más el valor derivado `totalSellos` y las funciones `restanteEn()` y `reiniciarPartida()`.
- `src/signals/interfaz.ts`: `panel`, `enfocado`, `inspeccionando`, `carga` y el valor derivado `controlesActivos`, más `abrirInspeccion()`, `abrirCuaderno()` (T36), `cerrarPanel()` y `reiniciarInterfaz()`.
- `src/signals/puente.ts`: el tipo `Comando` y las funciones `enviar()` y `escuchar()`.
- Tests: `tests/unit/signals.test.ts`.

**Decisiones que no están en la especificación**

- **Reloj sin ticks:** guarda `{ restanteMs, pausado, desde }`, con `desde` en `performance.now()`, igual que el evento `reloj` del protocolo. El signal solo cambia al pausar o reanudar, y cada pantalla calcula el resto. `src/game/reloj.ts` (T25, otra sesión) usa la misma forma.
- **El puente es una lista de oyentes, no un signal.** Así, dos órdenes en el mismo instante no se pierden. Las órdenes llegan en el orden de suscripción. Si un oyente falla, los demás la reciben igual y el error se relanza aparte.
- Solo hay un panel abierto a la vez: `panel` es `'cuaderno' | 'inspeccion' | 'pausa' | null`.
- `SALAS` de los signals incluye `'porteria'`; `src/game/partida.ts` la separa como `Lugar`. Los ids de las cinco salas coinciden.

**Incompleto o provisional**

- El valor `'pausa'` de `Panel` no lo usa ninguna pantalla: no hay menú de pausa.
- `carga` la escribe el motor (T20), pero **la interfaz no la muestra**: al cambiar de sala no hay indicador de carga.

### T32 · Menú de inicio (solo «Jugar solo»)

**Qué quedó**

- Menú dentro de la isla de `/jugar` (`src/ui/menus/MenuInicio.tsx` y `menus.css`): título, un párrafo de historia, «Jugar solo» y «Volver a la portada».
- Crear partida y unirse con código **no existen en el código**: no están ocultos con CSS, simplemente no se dibujan. El parámetro `?codigo=` se ignora.
- `src/signals/provisional.ts`: el controlador provisional de la partida (ver «Cómo conectar con mi parte»).
- Tests: `tests/e2e/menu.spec.ts` y `tests/unit/provisional.test.ts`.
- `src/ui/IslaJuego.tsx`, compartido con la sesión del motor: monta el menú y arranca el controlador.

**Decisiones que no están en la especificación**

- El menú vive en `/jugar`, no en la portada `/`.
- `/jugar?prueba=glb` salta el menú.
- El texto del menú no menciona el Saber 11.

**Incompleto o provisional**

- **Todo `provisional.ts` es temporal.** `src/game/` (T24, T25, T28 y T30) ya está en `main`, pero nadie lo conecta todavía: el provisional sigue manejando la partida.
- El texto del menú es anterior a `docs/salas-y-puzzles.md` y no menciona la memoria USB.
- «Volver a la portada» lleva a `/`, que todavía muestra la demo de T01 (el contador de toques). La portada no es parte de mi trabajo.

### T33 · HUD: reloj, sellos, inventario y botón «Usar»

**Qué quedó**

- `src/ui/hud/Hud.tsx`, `hud.css` y `formato.ts`: reloj, cinco sellos, inventario, botón contextual, «Salir» y, desde T36, «Cuaderno».
- `src/signals/ejemplo.ts`: datos de ejemplo.
- Tests: `tests/e2e/hud.spec.ts` y `tests/unit/formato-hud.test.ts`.

**Decisiones que no están en la especificación**

- El reloj se redibuja una vez por segundo y se pone rojizo (`#ffb4a8`) en los últimos 5 minutos.
- El lector de pantalla lee el reloj en palabras («38 minutos y 5 segundos»).
- «Salir» pide confirmación con el diálogo nativo `window.confirm`.
- La partida empieza con la «Linterna» en el inventario. El cuaderno es un botón del HUD, no un objeto.
- El botón contextual va abajo a la derecha, con al menos 64 px de alto.
- El inventario es solo una lista de nombres: no se puede tocar ni elegir un objeto para usarlo sobre otro.

**Incompleto, provisional o con errores**

- **Datos de ejemplo** con `?ejemplo=1`: un sello ya ganado y tres objetos de la sala 1 que se enfocan en orden circular (`s1-factura`, `s1-menu`, `s1-tarjeta`).
  - Son del diseño viejo (refrigerios con 15 % de descuento) y **no coinciden con la etiquetadora de `docs/salas-y-puzzles.md`**.
  - Funcionan también en producción.
- **El reloj sigue corriendo con la pestaña oculta o el celular bloqueado.** El motor deja de dibujar, pero el controlador provisional no escucha `visibilitychange`. Lo sé por el código; no lo medí en un teléfono. Contradice los «40 minutos activos».
- Con 375 px de ancho, «Cuaderno» baja a una segunda línea debajo de «Salir». Lo vi en la captura; no es un error, pero ocupa espacio.
- No probé el HUD con un inventario de muchos objetos.
- No hay modo zurdo (T39 no estaba en mi lista).

### T35 · Vista de inspección 2D

**Qué quedó**

- `src/ui/paneles/Dialogo.tsx` y `dialogo.css`: panel modal reutilizable. Lleva el foco al panel, Escape lo cierra, Tab no se sale y, si puede, devuelve el foco a donde estaba.
- `src/ui/inspeccion/Inspeccion.tsx`, `inspeccion.css` y `ContenidoFicha.tsx` (este último de T36).
- `src/signals/contenido.ts`: el signal `fichas` y los tipos `Ficha` y `BloqueFicha` (`texto`, `tabla`, `lista` y `nota`).
- `src/ui/Partida.tsx`: junta el HUD y los paneles, para no tocar más `IslaJuego.tsx`.
- `src/ui/botones.css`: estilos de botones compartidos.
- Tests: `tests/e2e/inspeccion.spec.ts`.

**Decisiones que no están en la especificación**

- El formato de la ficha (bloques de texto, tabla, lista y nota) es mío.
- Mientras hay un panel abierto, el HUD queda con `inert` y `aria-hidden`.

**Incompleto, provisional o con errores**

- **Nadie llena `fichas` con contenido real.** Solo lo hace el modo de ejemplo. Por el código, «Examinar» sobre un objeto real de la escena abre «No hay nada escrito en este objeto». Eso no lo probé con un objeto real.
- **Error conocido:** al cerrar la ficha, el foco queda en `body`. El botón «Examinar» desaparece mientras el panel está abierto y ya no se puede devolver el foco a él. Lo comprobé en producción el 12 de noviembre. Afecta a quien usa teclado o lector de pantalla.
- Falta un bloque «gráfica» para el graficador de la sala 2.
- **Error de proceso:** `docs/salas-y-puzzles.md` entró a `main` por mi commit de T35, porque usé `git add -A`. Alex confirmó después que es el documento de diseño vigente. Desde T40 agrego solo rutas explícitas.

### T36 · Cuaderno

**Qué quedó**

- `src/ui/cuaderno/Cuaderno.tsx` y `cuaderno.css`.
- `src/signals/cuaderno.ts`: `datosEncontrados`, `notas`, `MAX_NOTA`, `limpiarNota()` y `reiniciarCuaderno()`.
- Orden nueva `nota` (agregar o borrar) en `puente.ts`.
- Tests: `tests/e2e/cuaderno.spec.ts` y `tests/unit/cuaderno.test.ts`.

**Decisiones que no están en la especificación**

- El propio componente del cuaderno envía `pausar` al abrirse y `reanudar` al cerrarse, solo en modo individual.
- Cada objeto examinado se guarda en `datosEncontrados` cuando se envía la acción «examinar».
- Las notas se pueden agregar y borrar, pero no editar (el protocolo prevé `editar`).
- El máximo de 280 caracteres se cuenta por caracteres reales (puntos de código), no por unidades de JavaScript.
- **La orden `nota` lleva texto libre.** Sigue la intención `nota { texto }` del protocolo, pero choca con la regla de `CLAUDE.md` «por la red solo viajan ids, nunca texto libre». En individual no sale nada a la red; **hay que decidirlo antes de T86** (cuaderno compartido).

**Incompleto o provisional**

- Notas y datos **se pierden al recargar**. `src/game/guardado.ts` (T30) ya existe en `main`, pero no está conectado a estos signals.
- El cuaderno no muestra pistas (T38) ni las transcripciones de las grabaciones, que `salas-y-puzzles.md` pide guardar ahí.
- No probé el teclado de iPhone sobre el campo de nota.

### T40 · Pantallas de final, créditos y poscréditos

**Qué quedó**

- `src/ui/finales/PantallaFinal.tsx`, `finales.css` y `textos.ts`. El recorrido es: final → créditos → poscréditos → «Volver al menú».
- En `provisional.ts`, `vigilarTiempo()`: al llegar a 0, la partida termina en «Tiempo cumplido».
- En `ejemplo.ts`: el parámetro `&final=<id>`, validado contra la lista `FINALES`, y `cargarEjemploDeFinal()`, que pone 5 sellos y 3 grabaciones.
- Tests: `tests/e2e/finales.spec.ts` y `tests/unit/finales.test.ts`.

**Decisiones que no están en la especificación**

- Los textos siguen `docs/salas-y-puzzles.md`: la memoria USB, el profe Tobías Rincón, don Efraín y los cameos de Marta, Julián e Inés.
- «Tiempo usado» es 40 minutos menos `restanteMs`. Es correcto porque el controlador pausa el reloj al terminar.
- **Cambié los ids de las grabaciones a `grab-1`, `grab-2` y `grab-3`**, como en `salas-y-puzzles.md`. **Pero `src/game/partida.ts` (T28, otra sesión) usa `g1`, `g2` y `g3`.** Hoy no falla porque nadie conecta las dos partes, pero hay que unificarlos.

**Incompleto o provisional**

- Faltan el resumen de aprendizaje y el modo práctica que pide «Ningún final castiga».
- Solo se llega a un final cuando se acaba el tiempo o con `?ejemplo=1&final=…`. Elegir el final en la portería es T77.
- No hay enlace a `/creditos`, porque esa página no existe (T11i).
- La pantalla de final es opaca, pero **el motor sigue dibujando la escena 3D detrás**. Pasa lo mismo detrás del menú de inicio: el motor solo se pausa al ocultar la pestaña.
- Arreglé `tests/e2e/controles.spec.ts` (de otra sesión), que fallaba porque el menú tapa la escena.

### T41 · Accesibilidad

**Qué quedó**

- Foco visible (borde blanco de 3 px) en `src/ui/botones.css`, junto con la clase `.solo-lector`.
- `src/ui/Anunciador.tsx`: una región `aria-live` que anuncia «Recogiste: …» y «Sello obtenido».
- Encabezado oculto «Partida en curso» en el HUD.
- `tests/e2e/accesibilidad.spec.ts`: revisa que todo lo tocable mida al menos 44 × 44 px y tenga nombre.
- `tests/unit/contraste.test.ts`: 11 pares de texto y fondo con contraste de 4,5:1 o más.

**Decisiones que no están en la especificación**

- No agregué `axe-core` para no sumar dependencias.
- Los colores del test de contraste están copiados a mano del CSS: **si alguien cambia un color en el CSS, el test no se entera.**
- El anunciador no usa `role="status"`, para no chocar con la prueba de `/jugar?prueba=glb`.

**Incompleto o no verificado**

- No se probó con TalkBack ni con VoiceOver reales.
- El anuncio de sello nunca se ejercita, porque nada otorga sellos durante el juego.
- La revisión de 44 px cubre mis pantallas (menú, HUD, inspección, cuaderno y final), no el joystick del motor.
- El cambio de color del reloj en los últimos minutos es solo visual.
- No probé el tamaño de letra grande del sistema.
- El error de foco de T35 sigue abierto.
- En el PR también quité un clic duplicado en `controles.spec.ts` que dejó la fusión con T15 y T17.

---

### Cómo conectar con mi parte

**Signals:** quién escribe y quién lee cada uno.

| Signal (archivo) | Lo escribe | Lo lee |
| --- | --- | --- |
| `fase`, `modo`, `sala`, `reloj`, `sellos`, `grabaciones`, `inventario`, `final` (`partida.ts`) | El controlador de la partida. Hoy es `provisional.ts`. | `ui/`; `engine/` lee `sala` e `inventario` |
| `enfocado` (`interfaz.ts`) | `engine/` (T18) y el modo de ejemplo | El HUD (botón contextual) |
| `panel`, `inspeccionando` (`interfaz.ts`) | `ui/` y el controlador (al examinar) | `ui/`; `engine/` mediante `controlesActivos` |
| `carga` (`interfaz.ts`) | `engine/` (T20) | Nadie todavía |
| `fichas` (`contenido.ts`) | Solo el modo de ejemplo. Debería llenarlo el contenido de cada sala | Inspección y cuaderno |
| `datosEncontrados`, `notas` (`cuaderno.ts`) | El controlador | El cuaderno |

**Órdenes del puente:** qué envía cada parte.

| Orden | La envía |
| --- | --- |
| `iniciar` | El menú |
| `salir` | El HUD y la pantalla de final |
| `accion` | El botón del HUD y el teclado de escritorio (`engine/motor.ts`, T19) |
| `pausar`, `reanudar`, `nota` | El cuaderno |
| `elegir_final` | Solo el modo de ejemplo |

Hoy escuchan las órdenes el controlador provisional y el motor: `motor.ts` cambia de sala cuando una puerta recibe «usar».

**Para cambiar el provisional por `src/game/`:**

1. Escribe un controlador que se suscriba con `escuchar()`, aplique `game/partida.ts` y `game/reloj.ts`, y escriba los signals de la tabla.
2. Quita la llamada a `iniciarControladorProvisional()` en `src/ui/IslaJuego.tsx` y borra `provisional.ts`. **No dejes los dos activos:** ambos responderían a la misma orden.
3. El controlador nuevo debe suscribirse **antes** que el motor. El motor compara `destinoDePuerta(objeto) === sala.value` justo después de que el controlador cambió `sala`. Hoy funciona porque el motor se importa de forma dinámica y se suscribe más tarde.
4. Unifica los ids de las grabaciones (`g1` contra `grab-1`).
5. Pausa el reloj con `visibilitychange`.
6. Conecta `game/guardado.ts` a `notas`, `datosEncontrados` y `reloj`.
7. Llena `fichas` desde el contenido de cada sala.
8. Cuando todo eso funcione, borra `ejemplo.ts` y los usos de `?ejemplo=1` en `MenuInicio.tsx`.

### Riesgos para la integración del sábado

1. **Dos fuentes de verdad.** Si se conecta `game/` sin quitar `provisional.ts`, cada orden se atiende dos veces.
2. **Orden de los oyentes del puente.** El cambio de sala por puertas depende de que el controlador escuche antes que el motor.
3. **Ids de grabaciones distintos** entre `signals/partida.ts` y `game/partida.ts`.
4. **El reloj corre con el celular bloqueado o en otra app.** Un estudiante que cambia de app pierde minutos.
5. **El motor dibuja detrás del menú y de los finales.** En el Android de 2 GB eso es batería y calor sin necesidad. `fase` ya está disponible para que el motor se detenga.
6. **«Examinar» sobre objetos reales muestra una ficha vacía** mientras nadie llene `fichas`.
7. **Si en la demo alguien abre `?ejemplo=1`**, verá datos del diseño viejo (la factura de refrigerios), no la etiquetadora.
8. **La portada `/` sigue siendo la demo de T01.** Es lo primero que se ve.
9. **Foco perdido al cerrar paneles** (teclado y lector de pantalla).
10. **Las pruebas e2e se vencen por tiempo en paralelo** en este equipo. Usa `npx playwright test --workers=1` antes de fusionar.

---

## 2. Pruebas humanas

Todas usan **producción**, que hoy es igual a `main`: `https://la-ultima-prueba-duz.pages.dev`. Si `main` cambia, producción cambia con él.

Las vistas previas de mis PR siguen respondiendo, pero son fotos viejas, sin el trabajo posterior de las otras sesiones. Por ejemplo, `https://t41-accesibilidad.la-ultima-prueba-duz.pages.dev/jugar/`. Úsalas solo para comparar.

Anota en cada prueba el modelo del celular y el navegador. Ninguna de estas pruebas la hice yo en un dispositivo real.

### H1 · Menú de inicio en el Android de referencia

- **Enlace:** `https://la-ultima-prueba-duz.pages.dev/jugar/`
- **Pasos:**
  1. Abre el enlace en Chrome.
  2. Espera a que cargue.
  3. Gira el celular a horizontal y vuelve a vertical.
- **Qué se espera:**
  - «La Última Prueba» en naranja, un párrafo y dos botones grandes: «Jugar solo» y «Volver a la portada».
  - No hay botones de crear partida ni de unirse.
  - En horizontal, si el texto no cabe, el menú se desplaza con el dedo y la página de atrás no se mueve.
- **Anota:** si el texto se lee sin hacer zoom y cuántos segundos tarda en aparecer el menú.

### H2 · Lo mismo en iPhone (Safari)

- **Enlace:** el mismo de H1.
- **Pasos:** los de H1.
- **Qué se espera:** lo mismo que en H1, y además que nada quede debajo del notch ni de la barra inferior de Safari.

### H3 · HUD y botón contextual (sensación con el pulgar)

- **Enlace:** `https://la-ultima-prueba-duz.pages.dev/jugar/?ejemplo=1`
- **Pasos:**
  1. Toca «Jugar solo».
  2. Sostén el celular con las dos manos.
  3. Mira alrededor arrastrando en la mitad derecha, cerca del botón naranja.
  4. Toca «Examinar».
- **Qué se espera:**
  - Arriba: «Salir», «Cuaderno» (en un celular angosto, debajo de «Salir»), el reloj bajando desde 40:00 y cinco círculos con el primero en naranja.
  - Abajo a la izquierda: «Linterna».
  - Abajo a la derecha: «Examinar · Factura de la caja».
- **Anota:**
  - Si al arrastrar para mirar tocas el botón sin querer.
  - Si el botón queda cómodo para el pulgar derecho.
  - Si el reloj y los sellos se leen sobre la escena y en exteriores.

### H4 · «Salir» con confirmación

- **Enlace:** `https://la-ultima-prueba-duz.pages.dev/jugar/`
- **Pasos:**
  1. Toca «Jugar solo».
  2. Toca «Salir» y luego «Cancelar».
  3. Toca «Salir» otra vez y luego «Aceptar».
- **Qué se espera:** con «Cancelar» sigue la partida; con «Aceptar» vuelves al menú. En iPhone, el diálogo nativo de Safari se ve distinto; anota si se entiende.

### H5 · Legibilidad de la ficha de inspección

- **Enlace:** `https://la-ultima-prueba-duz.pages.dev/jugar/?ejemplo=1`
- **Pasos:**
  1. Toca «Jugar solo».
  2. Toca «Examinar · Factura de la caja».
  3. Desplaza el texto con el dedo dentro de la ventana.
  4. Toca «Cerrar».
  5. Toca «Examinar · Menú de la cooperativa».
- **Qué se espera:**
  - Una hoja clara con la tabla «Refrigerio · 4 · $5.000». En la segunda ficha, una lista de precios y una nota azul «Descuento de 15 %…».
  - La tabla cabe en el ancho sin hacer zoom.
  - La escena de atrás no se mueve.
- **Recuerda:** estos datos son de ejemplo y del diseño viejo. Aquí se prueba la lectura, no el contenido.

### H6 · Cuaderno, teclado y pausa del reloj

- **Enlace:** `https://la-ultima-prueba-duz.pages.dev/jugar/?ejemplo=1`
- **Pasos:**
  1. Toca «Jugar solo».
  2. Anota el reloj y toca «Cuaderno».
  3. Espera 15 segundos y toca «Cerrar».
  4. Abre el cuaderno otra vez, toca «Nueva nota» y escribe `4 × $5.000 = $20.000`.
  5. Toca «Guardar nota» y luego «Borrar».
- **Qué se espera:**
  - Con el cuaderno abierto aparece «El reloj está en pausa…» y, al cerrar, el reloj sigue donde estaba, sin restar esos 15 segundos.
  - Al tocar el campo **no hay zoom** y el teclado no tapa lo que escribes. Esto es lo más importante en iPhone.
  - La nota aparece en la lista y desaparece al borrarla.

### H7 · Reloj con el celular bloqueado o en otra app

- **Enlace:** `https://la-ultima-prueba-duz.pages.dev/jugar/`
- **Pasos:**
  1. Toca «Jugar solo» y anota el reloj.
  2. Bloquea la pantalla 1 minuto y vuelve.
  3. Repite cambiando a otra app durante 1 minuto.
- **Qué se espera, según el código:** el reloj **sí** descuenta ese minuto. Es un error conocido (riesgo 4). Anota cuánto bajó en Android y en iPhone; en iPhone el resultado puede ser distinto y no lo sé.

### H8 · Los cuatro finales, créditos y poscréditos

- **Enlaces** (toca «Jugar solo» en cada uno):
  - `https://la-ultima-prueba-duz.pages.dev/jugar/?ejemplo=1&final=justo_a_tiempo`
  - `https://la-ultima-prueba-duz.pages.dev/jugar/?ejemplo=1&final=el_legado`
  - `https://la-ultima-prueba-duz.pages.dev/jugar/?ejemplo=1&final=pedir_ayuda`
  - `https://la-ultima-prueba-duz.pages.dev/jugar/?ejemplo=1&final=tiempo_cumplido`
- **Pasos:**
  1. Lee el final.
  2. Toca «Ver créditos», luego «Continuar» y luego «Volver al menú».
- **Qué se espera:**
  - El título del final, dos párrafos y tres recuadros: Sellos 5 de 5, Grabaciones 3 de 3 y Tiempo usado (00:00 o 00:01, porque con `final=` la partida termina apenas empieza).
  - Luego los créditos (Marta, Julián, Inés y don Efraín), la hoja de la fotocopiadora y el menú.
- **Para Alex:** revisa el tono y el contenido de los textos; los escribí a partir de `salas-y-puzzles.md`.

### H9 · «Tiempo cumplido» de verdad (opcional, 40 minutos)

- **Enlace:** `https://la-ultima-prueba-duz.pages.dev/jugar/`
- **Pasos:**
  1. Toca «Jugar solo».
  2. Deja el celular conectado al cargador y con la pantalla encendida durante 40 minutos.
- **Qué se espera:** al llegar a 00:00 aparece «Tiempo cumplido».
- **Anota:** si el celular se calentó. El motor dibuja todo el tiempo (riesgo 5).

### H10 · TalkBack en Android

- **Enlace:** `https://la-ultima-prueba-duz.pages.dev/jugar/?ejemplo=1`
- **Pasos:**
  1. Activa TalkBack (Ajustes → Accesibilidad → TalkBack).
  2. Desliza a la derecha para recorrer el menú y toca dos veces «Jugar solo».
  3. Recorre el HUD.
  4. Examina la factura y ciérrala; examina el menú y ciérralo.
  5. Recoge la tarjeta.
- **Qué se espera:**
  - En el HUD lee: «Partida en curso», «Salir», «Cuaderno», «Tiempo restante: 39 minutos y …», «Sellos: 1 de 5», «Inventario» y el botón «Examinar Factura de la caja».
  - Al abrir una ficha, lee su título y la tabla con encabezados.
  - Al recoger la tarjeta dice «Recogiste: Tarjeta de porcentajes».
  - **Error esperado:** al cerrar una ficha, el foco vuelve al principio de la página. Anota cuánto estorba.

### H11 · VoiceOver en iPhone

- **Enlace y pasos:** los de H10, con VoiceOver (Ajustes → Accesibilidad → VoiceOver).
- **Qué se espera:** lo mismo que en H10. Anota además si el panel abierto deja leer el HUD de atrás; no debería.

### H12 · Letra grande del sistema

- **Enlace:** `https://la-ultima-prueba-duz.pages.dev/jugar/?ejemplo=1`
- **Pasos:**
  1. Pon el tamaño de letra del sistema al máximo: en Android, Ajustes → Pantalla → Tamaño de fuente; en iPhone, Accesibilidad → Pantalla y tamaño de texto → Texto más grande.
  2. Recorre el menú, el HUD, una ficha, el cuaderno y un final (H8).
- **Qué se espera:** el menú, los paneles y los finales se desplazan y nada queda cortado. No lo probé; **el HUD podría encimarse** con letra muy grande.

### H13 · Escritorio con teclado (secundario)

- **Enlace:** `https://la-ultima-prueba-duz.pages.dev/jugar/?ejemplo=1`, en un PC.
- **Pasos:**
  1. Recorre el menú con Tab y presiona Enter en «Jugar solo».
  2. Presiona Tab hasta «Examinar» y Enter.
  3. Presiona Escape.
- **Qué se espera:** un borde blanco grueso alrededor del elemento con foco; la ficha se abre con Enter y se cierra con Escape. Error conocido: después de cerrar, el foco vuelve al principio.

### Audio

Mi parte no tiene audio: no reproduce sonidos ni subtítulos. Lo único sonoro son los anuncios del lector de pantalla de H10 y H11. El audio y los subtítulos de La Voz (T34 y T43) no eran parte de esta sesión.
