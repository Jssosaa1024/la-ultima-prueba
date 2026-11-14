# Reporte de la ola 1 · Sesión C · 14 de noviembre de 2026

Esta sesión es dueña de `src/ui/` y `src/signals/`. En esta ola hizo tres tareas, todas fusionadas en `main`:

- T31b · controlador real de la partida individual ([#43](https://github.com/Jssosaa1024/la-ultima-prueba/pull/43))
- T31c · guardar la partida y «Continuar partida» ([#44](https://github.com/Jssosaa1024/la-ultima-prueba/pull/44))
- T35b · el foco vuelve a un lugar útil al cerrar un panel ([#45](https://github.com/Jssosaa1024/la-ultima-prueba/pull/45))

Resumen honesto: **nada de esto se probó en un celular real ni en un iPhone, ni con TalkBack o VoiceOver.** Lo comprobé con las pruebas de unidad (Vitest), con las pruebas e2e (Playwright: Pixel 5 emulado y Chrome de escritorio, con WebGL por software) y con dos capturas de pantalla de esas pruebas. De las vistas previas de Cloudflare solo comprobé que el build pasó y que `/jugar/` responde. La sección 3 dice qué debe revisar una persona.

Lo más importante para quien sigue: **el juego ya usa las reglas de `src/game/`, pero todavía no se puede resolver ninguna sala**, porque no existen los paneles de las máquinas. Hoy solo se llega a los finales «También vale pedir ayuda» y «Tiempo cumplido».

## 1. Qué hice

### T31b · Controlador real de la partida individual (#43)

- `src/signals/controlador.ts` reemplaza a `src/signals/provisional.ts`, que se borró. Es el único que escribe los signals de la partida: recibe las órdenes del puente, las pasa por `game/partida.ts`, `game/reloj.ts` y `game/pistas.ts`, y copia el resultado a los signals.
- Se suscribe al puente antes que el motor (el efecto que lo arranca va primero en `src/ui/IslaJuego.tsx`, y hay una prueba de unidad del orden).
- **Puertas en orden.** Se usa `destinoDePuerta()`, no una lista de ids: la puerta 1 abre desde el principio y cada una de las demás, al tener el sello de la sala anterior. Una puerta cerrada muestra un aviso en el HUD («La puerta 2 está cerrada. Se abre cuando consigas el sello de la sala 1.»), que el lector de pantalla también anuncia.
- **Puerta de salida** (`porteria-salida`): abre un panel con `opcionesDeFinal()`. Sin los cinco sellos dice cuántos faltan. Con los cinco ofrece «Salir» y «Restaurar archivo»; este último queda desactivado, con cuántas grabaciones faltan y en qué salas, mientras no estén las tres.
- **Intercomunicador** (`porteria-intercomunicador`): pide confirmación en un panel propio. El botón principal es «Seguir intentando»; «Pedir ayuda» termina en ese final.
- **Reloj con la pestaña oculta:** se detiene con `visibilitychange` y sigue al volver. Los motivos de pausa se suman: con el cuaderno abierto y la pestaña oculta, el reloj espera a los dos.
- **Linterna duplicada, arreglada:** la partida empieza con el inventario vacío y la linterna se recoge del escritorio, una sola vez.
- **Cuaderno:** recogerlo de la silla activa el botón «Cuaderno» del HUD y no lo suma a la lista del inventario. Antes de recogerlo, el botón no aparece.
- **Signals para los paneles de mecanismo** (`src/signals/mecanismo.ts`): `etapa`, `mecanismo`, `condiciones` y `pistas`, más la orden `ver_pista`. Las pistas se ofrecen solas por tiempo activo en la etapa: no cuenta el tiempo en la portería, en pausa ni con la pestaña oculta.
- `?ejemplo=1` sigue vivo, porque lo usan las pruebas e2e. Ahora pasa por una orden del puente (`ejemplo`) y el controlador pone la sala 1 como resuelta.

**Error del motor que encontré y corregí en este PR** (`src/engine/renderer.ts`, 3 líneas, con prueba nueva): la cámara se quedaba con proporción 1:1 hasta el primer cambio de tamaño de la pantalla. La escena se dibujaba **estirada en escritorio y aplastada a lo ancho en celular** desde que cargaba. Lo vi en una captura de mis pruebas: las esquinas del escritorio de la portería estaban 1,78 veces más separadas de lo que debían (16:9). Nadie lo había notado porque las pruebas anteriores tocaban objetos grandes o el centro de la pantalla.

### T31c · Guardar la partida y «Continuar partida» (#44)

- El controlador guarda con `game/guardado.ts` después de cada orden que atiende, al pausar y al ocultar la pestaña.
- El menú muestra «Continuar partida», con el tiempo y los sellos guardados, cuando hay una partida válida. «Jugar solo» sigue ahí y empieza una nueva.
- Al continuar vuelven la sala, los sellos, las grabaciones, las pistas, los ajustes del mecanismo, el inventario y el cuaderno (notas y datos). El reloj sigue desde lo que quedaba.
- Las notas nuevas siguen la numeración guardada.
- Con el almacenamiento bloqueado (pestaña privada) se juega igual, sin guardar. Un guardado dañado o de otra versión se ignora.
- «Salir» y los finales borran lo guardado. Los datos de `?ejemplo=1` no se guardan.

**Decisiones mías:**

- Al tocar «Continuar partida» el reloj arranca de una vez. El reporte de T30 decía «arranca en pausa», pero no hay menú de pausa para soltarlo.
- El cuaderno acepta hasta 50 notas, que es el máximo del guardado. Con 50, el formulario se desactiva y lo dice. Sin ese tope, la nota 51 habría invalidado el guardado completo.
- No se guarda cada cierto tiempo, solo en los momentos pedidos.

### T35b · El foco al cerrar un panel (#45)

- El panel guardaba «el elemento que tenía el foco» para devolvérselo al cerrar. No servía: el botón «Examinar» desaparece con un panel abierto y el HUD queda inerte, así que al abrir el foco ya estaba en `body`.
- Ahora, al cerrar, el foco va al botón «Examinar» del mismo objeto (ficha), al botón «Cuaderno» (cuaderno) o al encabezado del HUD (puerta de salida e intercomunicador).
- Para que el botón «Examinar» esté ahí al cerrar, **examinar ya no suelta el objeto**. «Recoger» y «Usar» sí, como antes.

### Archivos de otras sesiones que toqué

| Archivo | De quién | Qué cambié |
| --- | --- | --- |
| `src/engine/renderer.ts` | A | La proporción de la cámara en el primer cuadro (3 líneas). Prueba nueva en `tests/unit/renderer.test.ts`. |
| `tests/e2e/controles.spec.ts` | A | La prueba de puertas entraba por la puerta 2, que ahora está cerrada al empezar. Usa la puerta 1. |
| `tests/unit/ids-objetos.test.ts` | A | Quité `provisional.ts` de la lista `PENDIENTES`. Queda `ejemplo.ts`. |
| `src/game/guardado.ts` | B | Campo `inventario` y versión 2 del guardado. Sin él, al continuar se perdían la linterna y el cuaderno. |
| `tests/unit/guardado.test.ts` | B | Actualizado a la versión 2, con una prueba del inventario. |
| `docs/especificacion-tecnica.md` | compartido | Agregué T31b, T31c y T35b, marcadas como hechas. |

No toqué `src/content/` ni `src/input/`.

### Resultado de las pruebas

| PR | `npm run verify` | E2E completas (`--workers=1`, puerto 4523) |
| --- | --- | --- |
| #43 | verde, 358 de unidad | 93 pasan, 6 saltadas a propósito y **1 falló**: «tocar la puerta de salida…» (T18, celular, de la sesión A). Repetida sola pasó 4 de 4. |
| #44 | verde, 370 de unidad | 98 pasan, 6 saltadas, ninguna falla |
| #45 | verde, 371 de unidad | 98 pasan, 6 saltadas, ninguna falla |

Después de fusionar los tres PR corrí todo otra vez sobre `main` (`a40bed8`, que ya incluye el #42 de la sesión B): `npm run verify` en verde con 374 pruebas de unidad, y las e2e completas con 98 que pasan, 6 saltadas y ninguna falla.

La primera corrida completa de #43 tuvo 6 fallos; la hice mientras había otras pruebas corriendo en el equipo. Uno era un error de mi prueba nueva de la linterna y lo corregí. Los otros cinco pasaron al repetirlos, sin cambiar nada; el de la puerta de salida (T18) es el único que volvió a fallar después.

**Cómo corrí las e2e:** no con `astro preview`. Astro se negó a arrancar porque ya había otro servidor de vista previa de esta misma carpeta (ver el punto 1 de la sección 2). Serví `dist/` con un servidor estático mínimo en el puerto 4523 y Playwright lo reutilizó. El sitio probado es el mismo build; solo cambia quién entrega los archivos.

## 2. Qué quedó incompleto o con riesgo

1. **Hay un servidor huérfano en el puerto 4522 que sirve la carpeta de esta sesión.** Es un `astro preview` lanzado a las 7:30 desde `la-ultima-prueba-c` (proceso 3388); el proceso que lo lanzó ya no existe. No lo inicié en esta ola y no lo detuve, porque no sé de quién es. El reporte de la sesión B dice que corrió sus e2e con el puerto 4522: si Playwright encontró ese servidor, **probó el build de esta carpeta y no el suyo**. Eso podría explicar parte de sus fallos intermitentes. Conviene cerrarlo antes de la próxima ola.
2. **Nada resuelve una sala.** Faltan los paneles de las máquinas (T37, T45, T52, T58, T64 y T70) y las órdenes para cambiar un ajuste y accionar. Los signals ya existen; el controlador publica el estado inicial de la etapa y sus condiciones, pero nadie los cambia. Por eso los sellos, el anuncio «Sello obtenido» y los finales «Justo a tiempo» y «El legado» solo se ven con `?ejemplo=1`.
3. **Las grabaciones no se pueden recoger.** `game/partida.ts` tiene la acción, pero ningún objeto de `salas.json` la entrega. Falta decidir qué objeto de las salas 2, 3 y 4 da cada una.
4. **«Examinar» sobre objetos reales muestra «No hay nada escrito en este objeto».** Nadie llena `fichas` con el contenido de cada sala. Lo más a la mano son los textos de `pista_por_jugador` de cada puzzle.
5. **El panel de pistas no existe (T38).** Las pistas se ofrecen y la orden `ver_pista` funciona, pero ninguna pantalla las muestra.
6. **`?ejemplo=1` sigue en producción**, con los datos del diseño viejo (la factura de refrigerios). Lo usan las e2e de HUD, inspección, cuaderno, finales y accesibilidad. Se puede borrar cuando esas pruebas usen objetos reales.
7. **La prueba «tocar la puerta de salida…» (T18, celular) es inestable.** Falló en 4 de mis corridas con el equipo cargado (una de ellas, sola) y después pasó 5 veces seguidas sola y en las corridas completas de #44 y #45. Un toque solo cuenta si dura menos de 350 ms, y con el WebGL por software a veces tarda más. No la cambié porque es de la sesión A.
8. **La proporción de la cámara** (el error del motor) solo la comprobé en escritorio, con una captura y con la prueba de unidad. En celular no tomé captura; lo deduzco del mismo código. Es lo primero que conviene mirar en un teléfono.
9. **Al continuar una partida dentro de una sala**, el jugador aparece frente a la puerta de esa sala, no donde estaba. La posición no se guarda.
10. **Si la pestaña se cierra sola** (Safari sin memoria) después de un rato sin acciones, al continuar el reloj vuelve al último guardado. El error siempre favorece al jugador.
11. **El guardado no tiene prueba e2e dentro de una sala**: la e2e recarga en la portería. Volver a una sala con sus sellos, pistas y ajustes está cubierto con pruebas de unidad.
12. **El cuaderno escondido puede confundir.** Quien no vea el cuaderno azul en la silla juega sin él. El diseño lo pide así («tutorial implícito»), pero nadie lo ha probado con un estudiante.
13. **El foco al cerrar la puerta de salida y el intercomunicador** va a un encabezado invisible. Sirve para el lector de pantalla; quien usa teclado no ve un borde hasta presionar Tab.
14. **El menú no explica la partida guardada más allá de una línea** y no hay botón para borrarla sin entrar a ella. El texto del menú sigue sin mencionar la memoria USB (viene del reporte anterior).

### Errores míos en esta ola

- En mi primera prueba e2e de la linterna, un clic en un sitio vacío bloqueaba el ratón en escritorio y el botón del cuaderno dejaba de responder. Era la prueba, no el juego.
- La primera versión del arreglo del foco no funcionaba: devolvía el foco a `body`. Lo detectaron las pruebas e2e antes de subir nada.

## 3. Qué debe probar una persona en el celular

Todo con **producción**, que es igual a `main`: `https://la-ultima-prueba-duz.pages.dev/jugar/`. Anota el modelo del celular y el navegador. Ninguna de estas pruebas la hice en un dispositivo real.

### 3.1 La forma de las cosas (error del motor corregido)

- **Enlace:** `https://la-ultima-prueba-duz.pages.dev/jugar/`
- **Pasos:**
  1. Toca **Jugar solo**.
  2. Mira las puertas del pasillo y el escritorio de la derecha, con el celular en vertical y luego en horizontal.
- **Qué se espera:** las puertas se ven el doble de altas que anchas (miden 1,1 × 2,2 m) y nada cambia de forma al girar el teléfono. Antes de este arreglo, en vertical se veían aplastadas a lo ancho hasta que se giraba el celular.
- **Anota:** si después de este cambio la sensibilidad al mirar o el tamaño de los objetos se sienten distintos. Ahora se ve menos pasillo a los lados que antes.

### 3.2 Linterna y cuaderno

- **Pasos:**
  1. Toca **Jugar solo**. Arriba solo debe estar «Salir»; no hay «Cuaderno» ni nada en el inventario.
  2. Gira a la izquierda. En la silla hay un cuaderno azul: tócalo y toca **Recoger**.
  3. Gira a la derecha. En el escritorio hay una linterna amarilla: tócala y toca **Recoger**.
- **Qué se espera:**
  - al recoger el cuaderno aparece el botón **Cuaderno** arriba, y no sale en el inventario;
  - aparece **una sola** «Linterna» abajo a la izquierda y desaparece del escritorio.
- **Anota:** si el cuaderno y la linterna se ven y se tocan con facilidad. Son pequeños: la linterna mide 7 cm de ancho.

### 3.3 Puertas en orden

- **Pasos:**
  1. Camina hasta la puerta 2 (la primera a la derecha), tócala y toca **Usar**.
  2. Repite con la puerta 3, 4 o 5.
  3. Usa la puerta 1 (la primera a la izquierda). Dentro, da media vuelta y usa la puerta para volver.
- **Qué se espera:**
  - en las puertas 2 a 5 sale el aviso «La puerta N está cerrada. Se abre cuando consigas el sello de la sala N−1.» durante unos 6 segundos, y sigues en el pasillo;
  - la puerta 1 lleva a la cooperativa y su puerta, de vuelta.
- **Anota:** si el aviso se lee bien sobre la escena y si tapa el botón «Usar» o el joystick.

### 3.4 Puerta de salida e intercomunicador

- **Pasos:**
  1. Camina al fondo, toca la puerta de salida y **Usar**.
  2. Toca **Volver**.
  3. En la pared izquierda, cerca del fondo, toca el intercomunicador (un recuadro pequeño a la altura del pecho) y **Usar**.
  4. Toca **Seguir intentando**.
  5. Repite el paso 3 y toca **Pedir ayuda**.
- **Qué se espera:**
  - la puerta de salida dice «La puerta no abre todavía. En el mural faltan 5 sellos.»;
  - con «Seguir intentando» la partida sigue igual;
  - con «Pedir ayuda» aparece el final «También vale pedir ayuda».
- **Para Alex:** revisa el tono de los dos textos nuevos; los escribí yo.

### 3.5 El reloj con el celular bloqueado o en otra app

Es la prueba H7 del reporte anterior, que antes fallaba a propósito.

- **Pasos:**
  1. Toca **Jugar solo** y anota el reloj.
  2. Bloquea la pantalla 1 minuto y vuelve.
  3. Cambia a otra app 1 minuto y vuelve.
- **Qué se espera:** el reloj sigue donde estaba, con uno o dos segundos de diferencia. No debe descontar el minuto.
- **Anota:** cuánto bajó en Android y en iPhone. En iPhone no sé si Safari avisa siempre al bloquear la pantalla.

### 3.6 Guardar y continuar (lo más importante en iPhone)

- **Pasos:**
  1. Toca **Jugar solo**, recoge el cuaderno y la linterna.
  2. Abre el cuaderno, escribe una nota, toca **Guardar nota** y **Cerrar**.
  3. Entra por la puerta 1 y anota el reloj.
  4. Recarga la página. Repite la prueba cerrando la pestaña y abriendo el enlace otra vez.
  5. En el menú, toca **Continuar partida**.
  6. Abre el cuaderno y escribe otra nota.
  7. Toca **Salir** y **Aceptar**.
- **Qué se espera:**
  - en el menú sale «Tienes una partida guardada: te quedan … y llevas 0 de 5 sellos»;
  - al continuar estás en la cooperativa, con «Linterna» en el inventario, el botón «Cuaderno» y el reloj corriendo desde lo que quedaba;
  - la primera nota sigue ahí y la segunda se suma;
  - después de «Salir», el menú ya no ofrece continuar.
- **Anota:** si al continuar hay una pantalla negra o un tirón largo antes de ver la sala.

### 3.7 Pestaña privada

- **Pasos:** abre el enlace en una pestaña privada (Safari) o de incógnito (Chrome), juega un minuto, recoge algo y recarga.
- **Qué se espera:** nada falla. Puede que ofrezca continuar o que no, según el navegador; las dos cosas están bien.

### 3.8 Lector de pantalla (TalkBack y VoiceOver)

Son las pruebas H10 y H11 del reporte anterior, con el error del foco corregido.

- **Enlace:** `https://la-ultima-prueba-duz.pages.dev/jugar/?ejemplo=1`
- **Pasos:**
  1. Activa el lector de pantalla y entra con **Jugar solo**.
  2. Examina la factura y cierra la ficha.
  3. Abre el cuaderno y ciérralo.
- **Qué se espera:**
  - al cerrar la ficha, el lector dice «Examinar, Menú de la cooperativa, botón» y no vuelve al principio;
  - al cerrar el cuaderno, dice «Cuaderno, botón».
- **Sin `?ejemplo=1`:** usa una puerta cerrada. El lector debe decir el aviso «La puerta 2 está cerrada…».

### 3.9 Lo que no hay que probar todavía

Resolver una sala, ganar un sello, recoger una grabación, ver una pista y los finales «Justo a tiempo» y «El legado» jugando de verdad: no se puede llegar a ninguno sin los paneles de las máquinas.

## 4. Para las sesiones A y B

**Signals nuevos** (los escribe solo el controlador):

| Signal (archivo) | Qué es |
| --- | --- |
| `etapa` (`mecanismo.ts`) | `{ sala, puzzle, etapa }` de la sala actual, o `null` en la portería o si la sala ya tiene sello |
| `mecanismo` (`mecanismo.ts`) | Ajustes del mecanismo en la etapa actual, con la forma de `estado_inicial` |
| `condiciones` (`mecanismo.ts`) | Lo que devuelve `evaluar()` con esos ajustes |
| `pistas` (`mecanismo.ts`) | `{ ofrecidas, vistas }` del puzzle de la sala actual |
| `opcionesFinal` (`partida.ts`) | `opcionesDeFinal()` de la partida |
| `guardada` (`partida.ts`) | `{ restanteMs, sellos }` de la partida guardada, o `null` |
| `cuadernoActivo` (`cuaderno.ts`) | El jugador ya recogió el cuaderno |
| `aviso` (`interfaz.ts`) | Aviso pasajero del HUD; hoy solo `puerta_cerrada` |

**Órdenes nuevas del puente:** `continuar`, `elegir_final` (ahora con `opcion: 'salir' | 'restaurar'`), `pedir_ayuda`, `ver_pista` y `ejemplo`.

**Sesión A (motor):**

- `inventario` puede traer objetos con `conBoton: true` (el cuaderno). El motor los sigue ocultando por id, como a los demás; solo el HUD los trata distinto.
- Después de «Examinar», `enfocado` ya no se vacía: el objeto sigue resaltado hasta que el jugador toque otra cosa o se aleje.
- Revisa el cambio en `seguirTamano()` de `src/engine/renderer.ts`. Ahora la primera llamada siempre ajusta el tamaño y la proporción.
- Si cambias los ids `porteria-salida`, `porteria-intercomunicador` o `porteria-cuaderno` en `salas.json`, cambia también las tres constantes de `src/signals/controlador.ts`. Una prueba de unidad falla si dejan de existir.

**Sesión B (reglas):**

- `Guardado` tiene el campo `inventario` y `VERSION_GUARDADO` es 2.
- El controlador todavía no llama a `intentoAlAccionar`, `avanzarReposo`, `registrarIntento`, `nuevaEtapa` ni `resolver_etapa`. Ese es el siguiente paso: dos órdenes del puente (cambiar un ajuste y accionar un objeto) que usen esas funciones. El controlador ya guarda los ajustes por sala y los publica.
- El tiempo de pistas que cuenta el controlador es reloj activo dentro de la sala, con una etapa pendiente.
