# Reporte de la ola 3 · Sesión A · 15 de noviembre de 2026

Esta sesión es dueña de `src/engine/`, `src/input/` y `scripts/`. Hizo las siete tareas de la lista, todas fusionadas en `main`:

| Tarea | PR |
| --- | --- |
| T41b · en celular se juega solo en horizontal | [#70](https://github.com/Jssosaa1024/la-ultima-prueba/pull/70) |
| Hito 1, punto 21 · con un panel abierto se dibuja a 10 cuadros por segundo | [#71](https://github.com/Jssosaa1024/la-ultima-prueba/pull/71) |
| Hito 1, punto 16 · el mural muestra los sellos y se enciende la luz de la puerta siguiente | [#75](https://github.com/Jssosaa1024/la-ultima-prueba/pull/75) |
| Hito 1, punto 17 · la caja fuerte de la sala 5 se abre en 3D | [#77](https://github.com/Jssosaa1024/la-ultima-prueba/pull/77) |
| T13 · escala dinámica de resolución | [#79](https://github.com/Jssosaa1024/la-ultima-prueba/pull/79) |
| T42 y T11j · scripts `optimize-audio` y `check-audio` | [#81](https://github.com/Jssosaa1024/la-ultima-prueba/pull/81) |
| T43 · módulo de audio del motor | [#83](https://github.com/Jssosaa1024/la-ultima-prueba/pull/83) |

Resumen honesto: **nada de esto se probó en un celular real ni en un iPhone, y nadie ha oído el audio.** Lo comprobé con pruebas de unidad (Vitest), con la suite e2e completa antes de cada PR (Playwright: Pixel 5 emulado en horizontal y Chrome de escritorio, con WebGL por software) y con capturas de pantalla de esas pruebas. De las vistas previas de Cloudflare solo comprobé que el build pasó y que `/jugar/` responde. La sección 4 dice qué debe revisar una persona.

Lo más importante para quien sigue: **el juego ya suena** (con sonidos hechos por código, sin archivos) **y se juega en horizontal.** Cuando llegue la voz grabada de La Voz, ya existe el camino completo: `art/audio/` → `npm run optimize-audio` → `check-audio`. Falta conectar el archivo al módulo de audio (sección 3).

## 1. Qué hice

### T41b · En celular el juego se juega solo en horizontal (#70)

- En vertical, durante la partida, un aviso a pantalla completa dice «Gira el teléfono». Mientras se ve, el reloj está en pausa y la escena no se dibuja.
- En Android, el aviso trae un botón **Pantalla completa** que fija el teléfono en horizontal (`screen.orientation.lock`, que Chrome solo permite en pantalla completa). En iPhone basta el aviso: Safari no deja fijar la orientación.
- **Arreglé un error que apareció al pasar a horizontal:** con unos 300 px de alto, el pie de los paneles (con la palanca, la manija y «Cerrar») se salía de la pantalla y no se podía tocar. Ahora siempre queda a la vista y lo que se desplaza es el cuerpo.
- El perfil celular de las e2e pasó a **Pixel 5 horizontal (802 × 293)**. Pruebas nuevas del aviso en `tests/e2e/orientacion.spec.ts`.
- Agregué T41b a la especificación, marcada como hecha.

### Punto 21 · Con un panel abierto, 10 cuadros por segundo (#71)

- El bucle acepta un intervalo mínimo entre cuadros. Con un panel abierto, el motor dibuja cada 100 ms; al cerrarlo vuelve a la velocidad normal. Las animaciones reciben el tiempo real, así que la máquina termina de moverse detrás.
- En las pruebas, deja el procesador libre para los clics dentro de los paneles, que era la causa más probable de las pruebas colgadas con el equipo cargado.

### Punto 16 · El mural y las luces de las puertas (#75)

- Cinco huecos con la silueta de cada sello (moneda, gota, balón, libro, llave). Cada sello ganado aparece como una pieza que se enciende en su hueco; si se ganó en otra sala, se enciende al volver a la portería.
- Sobre la puerta que toca abrir, una luz ámbar que late; sobre las salas resueltas, verde tenue; con los cinco sellos, dos luces en la puerta de salida. Las siete luces son una sola draw call.

### Punto 17 · La caja fuerte se abre en 3D (#77)

- Al resolver la sala 5, la puerta de la caja gira hacia afuera y deja ver una llave dorada. Espera a que se cierre el panel de la urna, como la mano mecánica.

### T13 · Escala dinámica de resolución (#79)

- Cada 2 s se miden los fps. Por debajo de 27 se dibuja con menos píxeles (de 0,15 en 0,15); por encima de 50 se vuelve a subir despacio (de 0,05 en 0,05). Va de 0,5 a 1,0 sobre el DPR, que sigue limitado a 1,25.
- No cuenta los cuadros con un panel abierto ni los de la carga de una sala. La escala queda en `data-escala` del canvas.

### T42 y T11j · `optimize-audio` y `check-audio` (#81)

- `npm run optimize-audio`: `art/audio/<sala>/<nombre>.wav` → `public/assets/audio/es-CO/<sala>/<nombre>.m4a`, en AAC mono a 48 kHz, −16 LUFS y pico de −1,5 dBTP (dos pasadas de `loudnorm` de ffmpeg). Voz a 48 kbps; ambientes (`amb-*.wav`) a 64 kbps.
- `npm run check-audio`: falla con un `.ogg` en `public/` o con un `.m4a` a más de 1 LU de −16 LUFS. Corre en `build` y en `verify`.
- Probados con WAV generados por ffmpeg (un tono bajito, estéreo, a 44,1 kHz), sin descargar audio.

### T43 · Módulo de audio (#83)

- **Desbloqueo en iPhone:** nada suena hasta el primer toque; ahí se crea el contexto de audio y se toca un búfer en silencio. Si iOS lo vuelve a dormir, el siguiente toque lo despierta. Con la pestaña oculta se suspende.
- **Mezcla:** voz, ambiente y efectos en canales separados. Los volúmenes de voz y ambiente son los de la pantalla de **Ajustes** (T39, de la sesión C). Mientras habla La Voz, el ambiente baja a la mitad.
- **Todo generado por código:** un ambiente distinto en cada sala; palanca, campana, polea, clic y el arpegio del sello. En la rectoría: el trinquete de la manija, las fichas, el zumbido de la mano mecánica y el cerrojo y la bisagra de la caja fuerte.
- **Voz provisional:** cada subtítulo de La Voz (T34, de la sesión C) y cada grabación suenan con un murmullo sin palabras de la misma duración del guion.

## 2. Qué decidí (Alex estaba dormido)

1. **El aviso de girar sale solo durante la partida.** El menú y los finales se leen bien en vertical y en ellos no corre el reloj.
2. **Qué es un celular:** pantalla táctil, más alta que ancha y con el lado corto de menos de 600 px. Una tableta en vertical sigue jugando.
3. **10 cuadros por segundo con un panel abierto**, no cero: así la animación termina detrás sin tener que ponerse al día al cerrar.
4. **El mural se hizo ya, con piezas de colores** (opción «ahora» del punto 16), sin esperar a los modelos de T44. Los sellos siguen poniéndose solos (punto 1 del hito, sin decidir).
5. **Umbrales de la escala: 27 y 50 fps.** El hueco entre los dos evita que suba y baje sin parar. Son constantes en `src/engine/escala.ts`; hay que ajustarlas cuando se mida en el celular de referencia.
6. **Cloudflare Pages no trae ffmpeg:** `check-audio` revisa siempre los Ogg, pero en Cloudflare solo avisa si no puede medir el volumen. El volumen se mide en local antes de subir.
7. **Volúmenes:** el ambiente al 100 % de los ajustes suena a la mitad de la voz (con el 70 % inicial, 0,35). Los efectos no tienen ajuste propio y van fijos a 0,7.
8. **Los sonidos los piden las animaciones** (`sonar()`), para que suenen cuando se ven: la campana al final de la corrida, la mano y la caja al cerrar el panel. En los tanques, el sello suena con la campana y no con la palanca.

## 3. Qué quedó incompleto

- **La voz grabada no está conectada.** Cuando llegue, cada `.m4a` se llamará como el id del guion (`voz-intro-1.m4a`). Falta que el módulo de audio lo cargue y lo toque en lugar del murmullo, y que el subtítulo siga al audio. Es poco trabajo en `src/engine/audio/audio.ts` (la función `hablar`).
- **Los ambientes también son provisionales** (ruido filtrado y un zumbido). Con ambientes grabados (Kenney o Freesound CC0), pasan por `optimize-audio` y se cambia `ambiente.ts`.
- **Paneles altos en horizontal:** los de los tanques y los carritos se desplazan bastante con 300 px de alto. Un diseño en dos columnas para horizontal sería mejor, pero cambia cada panel y es de `src/ui/`.
- **Nada se midió en el celular de referencia:** ni la escala, ni los fps, ni el consumo de batería con los paneles. El panel `?debug=1` (T11n) todavía no existe; la escala se puede leer en el atributo `data-escala` del canvas.

### Problemas de la noche con las pruebas

- **El equipo se saturó.** Al principio corrí la suite con dos navegadores mientras corría pruebas de unidad en otra carpeta y las otras sesiones también probaban. Hubo navegadores que se cerraron solos y fallas por tiempo que no eran del juego. Desde entonces: un solo navegador, prioridad baja para los procesos de prueba, un solo build por corrida (formato, lint y unidades; después la e2e, que construye) y el candado también para las e2e sueltas (medidas acordadas con la sesión C y aprobadas por Alex).
- **Choque de candados:** mis corridas duraban más de 30 minutos y la sesión C vio mi candado vencido. A las 9:34 mi script borró el suyo al terminar. Lo restauré y las dos sesiones cambiamos el script: el candado se renueva cada 5 minutos mientras corren las pruebas y solo lo borra quien lo creó.
- **Dos arreglos a pruebas de otros:** la prueba de «Tiempo cumplido» exigía exactamente «1 minuto» después de adelantar 39 minutos (con el equipo ocupado pasan unos segundos más), y la ayuda que reparte los libros en los carritos se quedaba esperando un carrito que el panel ya había soltado al cambiar de etapa. Ninguno era un error del juego.

## 4. Qué debe probar Alex en el celular

Enlace: `https://la-ultima-prueba-duz.pages.dev/jugar/` (producción, igual a `main`). Primero en el Android de referencia con Chrome; después en un iPhone con Safari, **sin el modo silencio** (el interruptor del costado) y con el volumen arriba.

**Horizontal (T41b)**

1. Abre el enlace con el teléfono en vertical y toca **Jugar solo**.
   - **Se espera:** «Gira el teléfono», con un teléfono que gira y «El reloj está en pausa».
2. En Android, toca **Pantalla completa**. En iPhone, gira el teléfono a mano.
   - **Se espera:** el aviso desaparece, el reloj sigue desde donde iba y el juego ocupa la pantalla en horizontal.
3. Abre el cuaderno, escribe algo sin guardar, gira a vertical y vuelve a horizontal.
   - **Se espera:** el cuaderno sigue abierto, con lo que escribiste.
- **Anota:** si el joystick, la mira y el botón de acción se alcanzan con los pulgares; si los paneles dejan ver lo suficiente sin desplazar demasiado (sobre todo los tanques y los carritos).

**Audio (T43)**

4. Desde el primer toque, escucha.
   - **Se espera:** un rumor suave de fondo, distinto en cada sala; un murmullo sin palabras cada vez que aparece un subtítulo de La Voz, y el fondo baja mientras suena.
5. Sala 1: baja la palanca y resuelve. Sala 2: espera la campana. Sala 5: tira de la manija y resuelve.
   - **Se espera:** golpe de palanca; campana al acabar la corrida; trinquete y fichas; zumbido de la mano al cerrar el panel; cerrojo y chirrido de la caja fuerte; arpegio con cada sello.
6. Abre **Ajustes** y baja la voz y el ambiente a 0.
   - **Se espera:** se callan el murmullo y el fondo; los efectos siguen.
7. Bloquea el teléfono y vuelve.
   - **Se espera:** el audio vuelve (si no, con el siguiente toque).
- **Anota:** si algún sonido molesta o suena muy fuerte frente a los demás, y **si en iPhone sonó desde el primer toque**.

**Portería y rectoría (puntos 16 y 17)**

8. Al empezar, mira las puertas. Resuelve la sala 1 y vuelve.
   - **Se espera:** una luz ámbar que late sobre la puerta 1; al volver, la 1 queda verde, la ámbar pasa a la 2 y en el mural (al fondo, a la izquierda de la salida) se enciende una moneda dorada.
9. Al resolver la sala 5, cierra el panel y mira a la derecha, al fondo.
   - **Se espera:** la caja fuerte se abre hacia ti y adentro brilla una llave dorada.
- **Anota:** si las luces se notan desde la entrada y si se entiende que la ámbar marca la puerta que toca.

**Rendimiento (punto 21 y T13)**

10. Juega diez minutos seguidos.
- **Anota:** si el teléfono se calienta; si la imagen se ve borrosa (la escala bajó) y si eso molesta; si el movimiento es fluido. Si puedes, conecta el teléfono a Chrome del PC (`chrome://inspect`) y anota el valor de `data-escala` del canvas.
