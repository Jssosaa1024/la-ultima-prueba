# Reporte de la ola 3 · Sesión C · 15 de noviembre de 2026

La sesión C es dueña de `src/ui` y `src/signals`. En esta ola hizo cinco cosas, todas fusionadas en `main`:

| Tarea | Qué es | PR |
| --- | --- | --- |
| Hito 1, punto 2 | La puerta de salida pide confirmar «Salir» si faltan grabaciones | [#65](https://github.com/Jssosaa1024/la-ultima-prueba/pull/65) |
| **T39** | Ajustes: sensibilidad de la mirada, modo zurdo, tamaño del texto y volumen | [#74](https://github.com/Jssosaa1024/la-ultima-prueba/pull/74) |
| **T40c** (nueva) | Los finales muestran el resumen de aprendizaje de las cinco salas (punto 15 del hito 1, la pantalla) | [#76](https://github.com/Jssosaa1024/la-ultima-prueba/pull/76) |
| **T34** | Subtítulos de La Voz con el guion de T34a | [#78](https://github.com/Jssosaa1024/la-ultima-prueba/pull/78) |
| Hito 1, decisión 11 | Al recargar, una sala resuelta conserva los ajustes del jugador | [#80](https://github.com/Jssosaa1024/la-ultima-prueba/pull/80) |

Resumen honesto: **nada se probó en un celular real.** Todo se comprobó con pruebas de unidad y e2e (Pixel 5 emulado en horizontal y Chrome de escritorio). La sección 4 dice qué mirar.

El orden cambió respecto al pedido: la tarea 3 (resumen) dependía de T40b de la sesión B, que llegó a `main` cuando yo estaba en T39. Lo mismo con el guion de T34a. Por eso quedaron T39 → T40c → T34 → decisión 11, sin bloqueos al final.

## 1. Qué hice

### Punto 2 del hito 1 · Confirmar «Salir»

- Con los cinco sellos y grabaciones pendientes, «Salir» ya no termina la partida de un toque. El panel pregunta: «Todavía faltan N grabaciones. Si sales ahora, el archivo de La Voz se borra a las 00:40 y ya no podrás restaurarlo».
- Los botones son **Seguir buscando** (el principal, vuelve a las dos opciones) y **Salir de todos modos**.
- Con las tres grabaciones, «Salir» sigue siendo un solo toque.

### T39 · Ajustes

- Botón **Ajustes** en el menú de inicio y en el HUD. Tiene cinco niveles de sensibilidad de la mirada, el joystick a la izquierda o a la derecha (modo zurdo), tres tamaños de texto (100 %, 112,5 % y 125 %), el volumen de la voz y el del ambiente por separado, y «Restablecer».
- Se guarda en el acto en `localStorage` (`la-ultima-prueba:ajustes`), aparte de la partida. Cada campo se revisa contra una lista cerrada; uno malo vuelve a su valor inicial sin tocar los otros.
- En la partida individual, el reloj se detiene mientras los ajustes están abiertos.
- **Los volúmenes todavía no suenan:** no hay audio. Quedan listos para T43.

### T40c · Resumen de aprendizaje en los finales

- Todo final muestra «Lo que aprendiste esta noche»: el total («Resolviste 4 de 5 salas, 2 sin pistas.») y una tarjeta por sala con el tema, cómo terminó **en texto** («Resuelta sin pistas», «Resuelta con 2 pistas» o «Sin resolver»), la máquina, el concepto y cómo funcionaba.
- Usa `resumenDeAprendizaje()` y `textoResumen()` de la sesión B (T40b). Agregué T40c a la especificación, marcada como hecha.
- Quité el «modo práctica» de los textos de dos finales. Una prueba falla si vuelve a aparecer.

### T34 · Subtítulos de La Voz

- El subtítulo va abajo y al centro, con «La Voz:» delante. Cada línea dura su `duracion_s` estimada y luego sigue la siguiente.
- La Voz habla en estos momentos:
  - al empezar una partida;
  - al examinar el reloj de la portería;
  - al entrar a cada sala por primera vez y al ganar su sello;
  - al tercer intento fallido de una etapa;
  - tras 90 s sin tocar nada en una sala (una vez por etapa);
  - al volver a la portería con los cinco sellos;
  - y en la pantalla de cada final.
- Al continuar una partida no repite lo que ya dijo de las salas con avance.

### Decisión 11 del hito 1 · Ajustes de una sala resuelta tras recargar

- El guardado tiene un campo nuevo, `resueltas`, revisado igual que el resto. Los guardados de antes siguen sirviendo: sin ese campo se leen como vacíos. No cambié la versión del guardado.

## 2. Qué decidí (Alex puede cambiarlo)

1. **La confirmación de «Salir» es el mismo panel**, con el mismo título, no una ventana nueva.
2. **Valores iniciales del volumen:** voz 100 % y ambiente 70 %.
3. **Ajustes con botones − y + y opciones**, no deslizadores, como los paneles de las máquinas. Sin botón «Guardar».
4. **Textos nuevos de dos finales**, en lugar del modo práctica. Están en `src/ui/finales/textos.ts`:
   - «También vale pedir ayuda»: «Mientras caminan hacia la salida, te cuenta cómo funcionaba cada máquina, también las que faltaron.»
   - «Tiempo cumplido»: «Abajo está cómo funcionaba cada máquina, también las que no alcanzaste a resolver.»
5. **Con un panel abierto, el subtítulo espera** y aparece al volver a la escena. El sello se gana dentro del panel, así que su línea sale al tocar «Volver a la sala». Con audio (T43) habrá que decidir si la voz suena encima del panel.
6. **`voz-intro-2` («Cinco salas, cinco sellos…») sale justo después de la primera**, sin esperar al primer paso del jugador: el motor no avisa ese momento.
7. **Las grabaciones no llevan subtítulo aparte:** su panel ya muestra el texto completo.
8. **«Espera» cuenta solo reloj activo** en una sala con etapa pendiente. Cualquier acción, ajuste, palanca, pista o nota vuelve a empezar la cuenta.

## 3. Decisiones 3 y 8 del hito 1 (solo anotadas, como se pidió)

- **Decisión 3 · Los 5 segundos de reposo (salas 3 y 4).** Hoy siguen en 5 s, en `"intento": { "tipo": "reposo", "segundos": 5 }` de `s3-reflector.json` (etapas 1 y 2) y `s4-carritos.json` (las tres). Las pruebas e2e los esperan sin problema; con el equipo muy cargado, una prueba del reflector tardó más de 30 s en aceptar los ajustes, una sola vez. Lo que falta es sentirlos con el dedo. Si parecen lentos, bajar a 3 s es cambiar ese número en los dos JSON; las pistas por tiempo no cambian.
- **Decisión 8 · Los libros «saltan» al pasar de etapa en la biblioteca.** Cada etapa empieza en su `estado_inicial`, que es la solución de ejemplo de la anterior: la etapa 2 empieza en 4, 4, 4, 4, 4 y la 3 en 1, 2, 3, 3, 11. Si el jugador resolvió la etapa 2 con otro reparto, por ejemplo 0, 3, 3, 3, 11, al pasar a la 3 los libros se reordenan. Para que se queden como los dejó, el controlador tendría que arrancar la etapa siguiente con los ajustes del jugador cuando sean válidos para ella. Es un cambio pequeño en `responder()` de `src/signals/controlador.ts`, pero toca las reglas de todas las salas (la sala 1 también cambia de producto entre etapas), así que no lo hice sin que Alex decida.

## 4. Qué debe probar Alex en el celular

Todo cabe dentro de una partida completa (la partida A de `docs/reportes/hito-1.md`), en horizontal.

**Antes de empezar (menú)**

1. Toca **Ajustes**. Elige **Muy grande**, **A la derecha (zurdo)** y sube la sensibilidad a **Rápida**. Cierra.
   - **Se espera:** el texto del menú crece y la nota dice «joystick de la derecha».
2. Recarga la página.
   - **Se espera:** sigue igual.
3. Toca **Jugar solo**.
   - **Se espera:** abajo, «La Voz: Buenas noches…» y luego «Cinco salas, cinco sellos…».
   - Camina con el pulgar **derecho** y mira con el **izquierdo**.
   - **Anota:** si con «Muy grande» algo del HUD se corta o se monta, y qué sensibilidad se siente bien. Después vuelve a **Ajustes** y deja lo que te guste.
4. Examina el **reloj** de la pared del fondo.
   - **Se espera:** al cerrar la ficha, «A las 00:40 algo se borra…».

**Sala 1**

5. Al entrar: «La cooperativa…».
6. Baja la palanca tres veces sin rodillos y cierra el panel: «Equivocarse aquí es gratis…».
7. Al resolver y volver a la sala: «Cuentas claras…».
   - **Anota:** si el subtítulo tapa el joystick o el botón «Usar», y si alcanzas a leer cada línea.

**Sala 4 (decisión 11)**

8. En la etapa 3, deja **9, 2, 3, 2 y 4** (también enciende las cuatro lámparas).
9. Recarga, toca **Continuar partida** y abre los carritos.
   - **Se espera:** los carritos siguen en 9, 2, 3, 2 y 4.

**Puerta de salida**

10. Con los cinco sellos y sin las tres grabaciones, toca **Salir**.
    - **Se espera:** la pregunta «Todavía faltan…», con **Seguir buscando** y **Salir de todos modos**.
11. Toca **Seguir buscando**: vuelven las dos opciones.

**Finales**

12. En cualquier final, mira debajo del texto:
    - la línea de La Voz de ese final;
    - «Lo que aprendiste esta noche», con las cinco salas.
    - **Anota:** si las tarjetas se leen cómodas en horizontal y cuánto hay que desplazar hasta «Ver créditos».
13. Partida corta, hasta «También vale pedir ayuda»: resuelve solo la sala 1 abriendo una pista.
    - **Se espera:** la sala 1 «Resuelta con 1 pista», las otras «Sin resolver», y nada sobre un modo práctica.

## 5. Qué quedó incompleto

- **Audio:** el volumen y el ritmo de los subtítulos esperan a T43 y a la voz grabada (ElevenLabs con plan de pago, de Alex).
- **Decisiones 3 y 8:** solo anotadas (sección 3).
- **Celular real:** nada de lo anterior se ha visto en uno.

## 6. Pruebas y equipo

- Cada PR pasó formato, lint, pruebas de unidad (de 624 a 674), presupuesto y la suite e2e completa (entre 166 y 178 pruebas que pasan), además de la vista previa de Cloudflare.
- Fallas en la suite, todas de pruebas y ninguna del juego:
  - una de `reflector.spec.ts`, inestable por falta de procesador; pasó al repetirla;
  - tres de mis propias pruebas, que encontraban textos o regiones `aria-live` repetidos. Las arreglé y repetí esos archivos.
- **El equipo se saturó** con tres sesiones probando a la vez. Desde la mitad de la ola, esta sesión:
  - toma el candado también para builds y e2e sueltas;
  - corre las pruebas con prioridad baja;
  - deja que la e2e haga el único build (`verify` sin su `astro build`, que es el mismo).

  Se revisa lo mismo con un build menos por PR. Si Alex quiere, se puede pedir lo mismo a las sesiones A y B.
