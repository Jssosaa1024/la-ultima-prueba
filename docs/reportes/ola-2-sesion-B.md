# Reporte de la ola 2 · Sesión B · 14 de noviembre de 2026

Esta sesión es dueña de `src/game/`, `src/content/` y `docs/`. En esta ola, además, hizo los paneles 2D de sus dos máquinas (`src/ui/mecanismos/`) y su animación 3D en el motor. Hizo tres tareas, las tres fusionadas en `main`:

- T35c · contenido de las fichas de inspección ([#51](https://github.com/Jssosaa1024/la-ultima-prueba/pull/51))
- T58 · sala 3, el reflector en tres etapas ([#55](https://github.com/Jssosaa1024/la-ultima-prueba/pull/55))
- T64 · sala 4, los carritos en tres etapas ([#59](https://github.com/Jssosaa1024/la-ultima-prueba/pull/59))

Resumen honesto: **nada de esto se probó en un celular real ni con un estudiante.** Los dos paneles los vi en un navegador con tamaño de celular (360 × 640 y 375 × 812) y en capturas de las pruebas e2e (Pixel 5 emulado). La animación 3D la vi en una captura por sala. **Ninguna corrida completa de e2e salió limpia a la primera**: el equipo tuvo tres sesiones probando a la vez casi todo el tiempo (detalle en la sección 2). Las fichas de T35c ya se ven en el juego: la sesión C las conectó en T35d ([#57](https://github.com/Jssosaa1024/la-ultima-prueba/pull/57)); yo no revisé cómo se ven en un celular.

## 1. Qué hice

### T35c · Fichas de inspección (#51)

- `src/content/fichas.json`: 23 fichas. Los 21 objetos con acción «Examinar» de la portería y las cinco salas, y los dos papeles que se recogen (la hoja de ayer del laboratorio y la ficha rota de la biblioteca).
- Usan los bloques de `src/signals/contenido.ts`: texto, tabla, lista y nota.
- Algunas fichas cambian con el avance de la sala (`por_etapa`): la etiqueta de cada producto, el nivel de los tanques, el temporizador de la campana, los sensores y las lámparas destapadas.
- `fichaDeObjeto(id, etapa)` y `fichasDeLugar(lugar, etapa)` en `src/content/fichas.ts`. `etapa` es lo que devuelve `etapaActual()`: 0, 1, 2 o `null` si la sala ya tiene sello.
- El JSON se valida en cada build (colección `fichas`). Comprobé que el build falla con una ficha cuyo id no existe.
- Las pruebas fallan si un objeto examinable no tiene ficha, si una ficha usa las palabras del cuaderno o trae una cuenta hecha, o si un número de una ficha deja de coincidir con su puzzle.

**Decisiones mías:**

- El título de la ficha es el `nombre` del objeto en `salas.json`.
- Inventé lo que el diseño no trae: los demás turnos del corcho, los equipos del torneo («Tiza y Tablero», «Los del Recreo»), el texto de la carta de jubilación, la etiqueta de mantenimiento del reloj y el borrador con «horden» que Inés corrige en rojo.
- En la tercera etapa del laboratorio, la perilla morada tiene los números tapados con la cinta del tanque. Si mostrara «2 cm por segundo», la hoja de ayer sobraría.
- Las lámparas de la biblioteca se describen como «destapadas» o «tapadas». Si están en verde lo muestra el panel, no la ficha.

### T58 · Sala 3, el reflector (#55)

- **Panel 2D** (`src/ui/mecanismos/reflector/`): la muesca del reflector (cinco botones en una fila), la distancia del poste que se desliza y la cuerda de la polea.
- Un dibujo de lado, a escala, con cada poste, su sombra, el rayo y el sensor. En la segunda etapa se ven dos triángulos con la misma forma.
- La máquina cuenta lo que pasó, sin calificar: «Poste de 2 m: su sombra mide 4 m. La punta pasa de largo del sensor, que está a 2 m». Con la polea: «el gancho subió 5 m. Quedó colgando por debajo del marcador».
- **Reglas** en `src/game/puzzles/reflector.ts`: `lecturaPostes`, `sombraMarcador` y `lecturaPolea`.
- **Animación 3D** (`src/engine/mecanismos/reflector.ts`): el reflector se inclina, aparecen los postes de la etapa, el poste móvil se desliza, las sombras se estiran, los sensores se encienden y el gancho sube. Son 8 mallas más.
- 17 pruebas de unidad y 2 e2e por perfil (etapas 1 y 3, hasta el sello).

**Decisiones mías:**

- La polea dice si el gancho quedó por debajo o pasó de largo, como pide el diseño. Con eso la altura se encuentra en pocos intentos sin mirar las sombras.
- El marcador no se dibuja a escala en el panel: si se dibujara, la altura se podría medir en la pantalla.
- La cinta del piso mide 16 m en el panel. En 37° las sombras no dan metros enteros y se muestran con un decimal (2,7 m; 10,7 m).

### T64 · Sala 4, los carritos (#59)

- **Panel 2D** (`src/ui/mecanismos/carritos/`): la pila y los cinco carritos son botones grandes. Un libro se mueve con dos toques: de dónde sale y a dónde va. El origen se queda elegido, así que repartir es un toque por libro. Al llegar ya está elegida la pila.
- **Pasar un libro de un carrito a otro es un solo cambio** (`moverLibro` en `src/game/puzzles/carritos.ts`). El libro no pasa por la pila, y por eso la lámpara de la media no se apaga a medio camino: es lo que la primera etapa quiere que se note.
- **Lámparas en vivo**, pegadas arriba del panel mientras se mueven los libros. Las que no cuentan en la etapa se ven «tapadas». El panel no muestra cuánto dan la media ni la mediana: solo si cada lámpara se enciende.
- «Devolver todo a la pila» deja los 20 libros para repartir otra vez.
- **Animación 3D** (`src/engine/mecanismos/carritos.ts`): un montón de libros sobre cada carrito, la pila que baja y cuatro lámparas en la pared. Son 9 mallas más.
- 16 pruebas de unidad y 2 e2e por perfil (etapas 1 y 3, hasta el sello).

**Decisiones mías:**

- **Dos toques por libro, con origen fijo**, en lugar de arrastrar. Arrastrar con el pulgar dentro de un panel que también hace scroll falla con facilidad en celulares pequeños. No lo comparé con estudiantes.
- Cada carrito mide unos 50 px de ancho en un celular de 320 px y 150 px de alto.
- Las clases CSS del panel llevan el prefijo `carritos-`, para que no choquen con otras pantallas (a la urna le pasó con `.ficha`).
- El último movimiento («Pasaste un libro del lunes al viernes») solo lo oye el lector de pantalla; a la vista quedan los números.

### Archivos de otras sesiones que toqué

| Archivo | De quién | Qué cambié |
| --- | --- | --- |
| `src/engine/mecanismos/index.ts` | A | 4 líneas: registrar las animaciones del gimnasio y de la biblioteca. Chocó tres veces con otros PR que registraban la suya en el mismo archivo. |
| `src/engine/mecanismos/reflector.ts`, `carritos.ts` y `comunes.ts` | A (carpeta) | Archivos nuevos |
| `src/ui/mecanismos/reflector/` y `carritos/` | C (carpeta) | El panel de cada máquina, en el archivo que el marco de T37 dejó para eso |
| `src/content.config.ts` | compartido | La colección `fichas` |
| `tests/e2e/maquinas.ts` | nuevo | `caminarHasta`, para las e2e de las salas grandes |
| `docs/especificacion-tecnica.md` | compartido | T35c (nueva), T58 y T64 marcadas como hechas, y tres apartados nuevos |

No toqué `src/signals/` ni `src/engine/motor.ts`. En T58 hice primero mi propio enganche de animaciones en el motor; cuando la sesión A fusionó el suyo (T45), pasé mi animación al de ella y retiré el mío antes de subir.

## 2. Qué quedó incompleto o con riesgo

1. **No revisé las fichas dentro del juego.** La sesión C las conectó después (T35d): los textos los escribí sin verlos en la vista de inspección de un celular. Puede haber fichas largas o tablas que no se lean bien.
2. **Nada probado en un celular real.** Ni los toques con el pulgar, ni el tamaño de los botones con dedos de verdad, ni el rendimiento de las mallas nuevas.
3. **La tabla de razones por muesca en el cuaderno** (sala 3) no está: el cuaderno es de la sesión C.
4. **En la escena, lo que no cabe se corta.** Una sombra de 16 m termina en la pared, y el poste móvil no se aleja más de 4,5 m del riel. Lo exacto está en el panel.
5. **En la etapa 2 del gimnasio el poste de 2 m desaparece** (el diseño usa los de 1 y 3 m). Con modelos de verdad convendría dejarlo a un lado.
6. **Al pasar de etapa en la biblioteca, los libros «saltan»** al estado inicial de la etapa siguiente (4, 4, 4, 4, 4 y luego 1, 2, 3, 3, 11), aunque el jugador hubiera dejado otro reparto. Así lo define el controlador (T31d) con los JSON. Puede confundir: conviene mirarlo con un estudiante.
7. **Las mallas de las animaciones se crean al entrar a la sala**, después de compilar los shaders. Puede haber un tirón pequeño la primera vez. No lo medí.
8. **El reloj de pared de la portería** no muestra la hora del juego: su ficha solo dice que es casi medianoche. Viene de reportes anteriores.
9. Siguen pendientes de olas anteriores: el reto extra de 16 fichas, la variante de 10° de la biblioteca, y que las soluciones (`solucion`) siguen viajando en el bundle.

### Las pruebas e2e, con sinceridad

| PR | `npm run verify` | E2E |
| --- | --- | --- |
| T35c (#51) | verde, 422 de unidad | **Sin corrida limpia.** Cinco corridas: entre 89 y 91 pasan y entre 7 y 9 fallan por tiempo, distintas cada vez. Alex autorizó fusionar. |
| T58 (#55) | verde, 480 de unidad | Completa: 117 pasan, 6 saltadas y **1 falla** (bloqueo del ratón, T19), que pasó sola. Después de traer T52: solo las tres máquinas, 12 de 12. |
| T64 (#59) | verde, 549 de unidad | Completa: 130 pasan, 6 saltadas y **2 fallan** (dos pruebas de la portería, perfil celular, de la sesión C), que pasaron solas. Antes, una corrida falló por un error de mi propia prueba (abajo) y tres no arrancaron. |

- **Por qué T35c se fusionó sin e2e en verde:** construí `main` aparte y comparé su sitio con el de la rama. Los 15 archivos de `_astro` eran idénticos byte por byte y las páginas solo cambiaban en un identificador aleatorio de cada build. El juego no importa las fichas todavía.
- **El equipo no da abasto con tres sesiones probando a la vez.** Las corridas completas tardaron entre 23 y 35 minutos (con el equipo libre, unos 10) y tres veces el build pasó de los 4 minutos que espera Playwright. Lo que me funcionó: esperar a que no hubiera navegadores de prueba de otras sesiones antes de correr.
- **Dos errores míos en las e2e:**
  - La primera versión caminaba «hasta cruzar una línea» y, con el equipo lento, el jugador seguía de largo y quedaba pegado a la máquina, fuera de la vista. Perdí tiempo creyendo que era el juego. Ahora las e2e caminan hasta que algo sólido detiene al jugador.
  - La prueba de la primera etapa de los carritos tenía que mover un libro antes de que pasaran los 5 segundos de reposo. Con el equipo lento no alcanzó, la etapa se resolvió y la prueba falló. Ahora empieza con los libros ya repartidos: el reposo solo cuenta desde el primer cambio.
- Para iterar usé `astro dev` y `astro preview` en el puerto 4533 (libre) y un archivo de Playwright local que no se subió. Los cerré al terminar.

## 3. Qué debe revisar una persona

Las cinco máquinas ya están en `main`, así que a las salas 3 y 4 se llega jugando: hay que resolver antes las salas anteriores. Todo con **producción**: `https://la-ultima-prueba-duz.pages.dev/jugar/`. Anota el modelo del celular y el navegador.

### 3.1 El reflector en el celular (T58)

- **Pasos:**
  1. Resuelve las salas 1 y 2 y entra por la puerta 3.
  2. Camina hasta la cancha, toca un poste y toca **Usar**.
  3. Toca las muescas una por una y mira el dibujo y la frase.
  4. Deja **45°** y espera 5 segundos sin tocar nada. Toca **Seguir**.
  5. Etapa 2: toca **27°** y sube la distancia del poste de 3 m hasta **6 m**. Espera y toca **Seguir**.
  6. Etapa 3: prueba la polea con 5 m y luego con **8 m**.
- **Qué se espera:**
  - las cinco muescas caben en una fila y se tocan sin fallar;
  - el dibujo cambia con cada toque y se entiende sin leer;
  - con 5 m dice que el gancho quedó por debajo; con 8 m sale el sello.
- **Anota:**
  - si los 5 segundos de espera se sienten largos o si el estudiante cree que la máquina se trabó;
  - si el dibujo se alcanza a leer (los números de la regla son pequeños);
  - si cierra el panel para mirar las sombras en la cancha, o si nunca las mira.

### 3.2 Los carritos con el pulgar (T64)

Es la que más necesita un celular pequeño de verdad.

- **Pasos:**
  1. Con el sello de la sala 3, entra por la puerta 4.
  2. Camina hasta los carritos, toca uno y toca **Usar**.
  3. Con una sola mano, reparte los 20 libros tocando los carritos.
  4. Toca un carrito con libros y luego otro, varias veces.
  5. Toca **Devolver todo a la pila**.
- **Qué se espera:**
  - cada toque en un carrito deja un libro, sin tener que elegir la pila primero;
  - al tocar un carrito con libros y luego otro, pasa un libro por toque;
  - las lámparas se ven arriba todo el tiempo, sin subir ni bajar la pantalla.
- **Anota:**
  - si el estudiante entiende solo lo de «de dónde sale» y «a dónde va», o si se queda tocando sin que pase nada;
  - si falla toques entre carritos vecinos;
  - si intenta arrastrar los libros;
  - si se nota que mover un libro de un día a otro no apaga la MEDIA.

### 3.3 El tono de los textos (Alex)

- **Fichas:** `src/content/fichas.json`. Lo que inventé está en la sección 1. Sobre todo: la carta de jubilación, el borrador con «horden» y la planilla del torneo.
- **Paneles:** las frases del reflector (`src/ui/mecanismos/reflector/textos.ts`) y las instrucciones de los carritos (`src/ui/mecanismos/carritos/textos.ts`).

### 3.4 Decisiones que conviene tomar

- Si la polea debe decir de qué lado quedó el gancho (hoy sí) o solo que no enganchó.
- Si al pasar de etapa en la biblioteca los libros deben quedarse como los dejó el jugador.
- Si los 5 segundos de reposo de las máquinas que responden solas son los correctos. Es un número en los JSON de los puzzles.

## 4. Para las sesiones A y C

- **Sesión C (interfaz):**
  - Gracias por conectar las fichas (T35d). Si una ficha se ve mal en la inspección, el texto está en `src/content/fichas.json` y el tope de tamaño en `src/content/esquema-fichas.ts`.
  - Los paneles del reflector y de los carritos solo usan las props del marco. El de los carritos guarda en su propio estado «de dónde se está sacando»; no viaja al controlador.
- **Sesión A (motor):**
  - `src/engine/mecanismos/comunes.ts` tiene `acercar` (avance suave hacia una meta) y `sinRayo` (mallas de adorno que el toque atraviesa). Las usan el reflector y los carritos.
  - Las animaciones del gimnasio y de la biblioteca dependen del orden de las piezas en `salas.json`: en `s3-postes`, el riel y luego los postes de 1, 2 y 3 m; en `s4-carritos`, los cinco carritos. Hay pruebas de unidad que fallan si ese orden cambia.
  - `data-maquina` vale `sombras`, `gancho-arriba` o `sin-luz` en el gimnasio, y `lamparas-N` en la biblioteca.
- **Para las e2e de salas grandes:** `tests/e2e/maquinas.ts` tiene `caminarHasta`. Hay que caminar hasta algo sólido que detenga al jugador, no hasta una línea.
