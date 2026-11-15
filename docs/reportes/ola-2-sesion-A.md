# Reporte de la ola 2 · Sesión A · 14 de noviembre de 2026

Esta sesión es dueña de `src/engine/` y `src/input/`. En esta ola hizo además los paneles 2D de sus máquinas en `src/ui/mecanismos/`. Hizo cuatro tareas, todas fusionadas en `main`:

- T05b · pruebas e2e confiables con varias sesiones ([#49](https://github.com/Jssosaa1024/la-ultima-prueba/pull/49))
- T45 · sala 1, la etiquetadora ([#52](https://github.com/Jssosaa1024/la-ultima-prueba/pull/52))
- T52 · sala 2, los tanques y el graficador ([#54](https://github.com/Jssosaa1024/la-ultima-prueba/pull/54))
- T75 · las tres grabaciones ([#56](https://github.com/Jssosaa1024/la-ultima-prueba/pull/56))

La tarea 2 de la lista (comprobar que T31d y T37 estuvieran en `main`) se cumplió sin esperar: la sesión C las fusionó mientras yo terminaba T05b (#47 y #48). **La tarea 6 (T10b, prueba de assets) no se hizo:** la carpeta `art/prueba-assets/originales/` no existe, y la lista decía saltarla en ese caso.

Resumen honesto: **nada de esto se probó en un celular real ni en un iPhone.** Lo comprobé con pruebas de unidad (Vitest), con pruebas e2e (Playwright: Pixel 5 emulado y Chrome de escritorio, con WebGL por software) y mirando capturas de esas pruebas. De las vistas previas de Cloudflare solo comprobé que el build pasó y que `/jugar/` responde. La sección 3 dice qué debe revisar una persona.

Lo más importante para quien sigue: **las salas 1 y 2 ya se resuelven jugando y dan su sello, y las tres grabaciones se pueden recoger.** Con el reflector de la sala 3 (T58, de otra sesión) ya se llega jugando hasta la biblioteca. La máquina de la biblioteca (T64, los carritos) todavía no existe, así que hoy nadie puede conseguir el sello 4 ni llegar jugando a la sala 5.

## 1. Qué hice

### T05b · Pruebas e2e confiables con varias sesiones (#49)

- **Playwright ya no usa el servidor de otra carpeta.** `reuseExistingServer` quedó en `false`: si el puerto está ocupado, la corrida falla y lo dice. Cada sesión usa su `PUERTO_E2E`.
- **Más tiempo:** 4 minutos para que arranque el servidor, 90 s por prueba y 15 s por espera (antes 30 s y 5 s). Los dos últimos no estaban en la tarea; los agregué porque casi todos los fallos eran pantallas que tardaban 6 o 7 segundos en aparecer.
- **Arreglé «tocar la puerta de salida…» (T18, celular).** La causa era la que describió la sesión C: un toque solo cuenta si dura menos de 350 ms, y la prueba enviaba «bajar» y «subir» en dos mensajes que, con el equipo ocupado, llegaban más separados. Ahora cada mensaje lleva su hora y el toque dura siempre 50 ms (`tests/e2e/toque.ts`). Lo comprobé aparte: con 800 ms de espera entre los dos mensajes, el navegador reporta 50 ms.
- **Encontré una segunda causa que nadie había reportado:** el motor nunca avanza más de 0,1 s por cuadro. Con el equipo ocupado, el jugador camina más despacio que el reloj, y las pruebas que caminaban «6,5 segundos» no llegaban. Ahora caminan hasta llegar.
- La función `tocar` de `partida.spec.ts` (sesión C) usa la misma ayuda.

Con tres sesiones probando a la vez, la primera corrida tuvo 19 fallos; con los arreglos, 3; con el equipo libre, ninguno.

### T45 · Sala 1: la etiquetadora en tres etapas (#52)

- **Panel** (`src/ui/mecanismos/etiquetadora/`): la etiqueta del producto, el precio de la pizarra, la caja con cinco rodillos (se ponen hasta dos) y las ranuras en el orden en que se pusieron.
- **La máquina muestra lo que pasó:** «Con el rodillo +20 %, la etiqueta pasó de $1.600 a $1.920: subió $320» y, al lado, lo que dice la pizarra. Nunca dice «incorrecto».
- **Animación 3D** (`src/engine/mecanismos/etiquetadora.ts`): la palanca baja y sube, sale una etiqueta blanca y, con el sello, se abre el cajón de la registradora con una moneda. Si se vuelve a la sala ya resuelta, el cajón sigue abierto.
- El motor tiene ahora un registro de animaciones por sala (`src/engine/mecanismos/index.ts`). Las sesiones que hicieron el reflector (T58) y la urna (T70) ya lo usaron.
- Ayudas compartidas para las e2e que juegan dentro de una sala: `tests/e2e/escena.ts`.

**Sobre las reglas:** la tarea pedía usar `evaluar()`, `intentoAlAccionar()`, `registrarIntento()` y la orden de resolver etapa. Desde T31d eso lo hace el controlador de la sesión C al recibir `ajustar` y `accionar`. Mis paneles solo envían esas dos órdenes y dibujan el signal `resultado`.

### T52 · Sala 2: los tanques y el graficador (#54)

- **Panel** (`src/ui/mecanismos/tanques/`): los tanques vistos de lado con su nivel en centímetros, el graficador y la perilla verde (caudal de A, de 0 a 6 cm/s).
- **La corrida dura `duracionCorridaS(etapa)`**: 10, 8 y 12 segundos, en tiempo real. Mientras corre no se puede mover la perilla ni volver a bajar la palanca. Lo que pasó se dice al sonar la campana; después los niveles se quedan quietos 2 segundos y los tanques vuelven a como estaban.
- **El graficador va dentro del panel:** eje fijo de 0 a 15 s y de 0 a 60 cm, la línea roja de la etapa 1, la marca de la campana y el trazo de la corrida anterior, más tenue. A es verde y continuo; B, morado y cortado.
- **Etapa 3:** el tanque B se ve tapado, no se dibuja y su nivel no se dice. Si el jugador recogió la hoja de ayer, sus dos marcas salen en el graficador.
- **Animación 3D** (`src/engine/mecanismos/tanques.ts`): los tanques son de vidrio y dejan ver el líquido, que corre a la par del panel. La campana se sacude y, con el sello, sale la bandeja de la incubadora con una gota azul.

**Decisión: qué objeto abre el panel.** `s2-tanques` es el puzzle, no un objeto. Hice interactivo el **tablero de los tanques** (`s2-panel`), el mueble de las perillas y la palanca, porque es grande y fácil de tocar. La palanca mide 6 cm de ancho: mi primera prueba e2e la tocaba y falló por no acertarle. La perilla verde, la palanca y la incubadora también abren el panel, por la regla general del controlador.

### T75 · Las tres grabaciones (#56)

- **Sala 2:** con la linterna de la portería en el inventario se ven cinco flechas moradas en el piso, de la entrada al gabinete. Usar el gabinete entrega la grabación 1.
- **Sala 3:** cuatro balones sobre el carro (naranja, azul, verde y blanco). Al usarlos rebotan tres veces; el verde apenas se aplasta y entrega la grabación 2.
- **Sala 4:** un libro rojo sobresale del estante M. Usarlo entrega la grabación 3.
- Al recogerlas se aplica `recoger_grabacion`, se abre un panel con el texto y queda en la sección «Grabaciones» del cuaderno. Solo texto: el audio llega en la Ola 3.
- Forma nueva `esfera` en las salas por código (para los balones).
- Al traer `main` hubo dos cruces en el registro de animaciones, con T58 y con T70. Los resolví dejando en la sala 3 el reflector junto a los balones y conservando la urna de la sala 5.

### Archivos de otras sesiones que toqué

| Archivo | Dueña | Cambio | PR |
| --- | --- | --- | --- |
| `playwright.config.ts` | compartido | `reuseExistingServer: false`, 4 min, 90 s y 15 s | #49 |
| `tests/e2e/partida.spec.ts` | C | Su `tocar` ahora es el de `tests/e2e/toque.ts` | #49 |
| `src/ui/mecanismos/etiquetadora/Panel.tsx` y `tanques/Panel.tsx` | C (los dejó para estas tareas) | Reemplazan el panel de relleno | #52, #54 |
| `src/content/salas.json` | contenido | `s2-panel` se puede usar; cuatro balones y el libro nuevos; el carro y el estante M ya no se «usan» | #54, #56 |
| `src/content/esquema-salas.ts` | contenido | Forma `esfera` | #56 |
| `src/signals/controlador.ts` | C | 11 líneas: 10 en `usar()` y un `import`. Los escondites entregan su grabación y los balones no abren ningún panel | #56 |
| `src/signals/interfaz.ts` | C | Un panel más: `grabacion` | #56 |
| `src/ui/Partida.tsx` y `src/ui/cuaderno/Cuaderno.tsx` | C | 2 líneas cada uno: montar el panel y la sección del cuaderno | #56 |
| `docs/especificacion-tecnica.md` | compartido | T05b (nueva), T45, T52 y T75 | los cuatro |

En T45 y T52 no toqué `src/signals/controlador.ts`.

### Resultado de las pruebas

| PR | `npm run verify` | E2E completas (`--workers=1`, puerto 4521) |
| --- | --- | --- |
| #49 T05b | verde, 374 de unidad | 98 pasan, 6 saltadas, ninguna falla |
| #52 T45 | verde, 443 de unidad | 114 pasan, 6 saltadas, ninguna falla |
| #54 T52 | verde, 463 de unidad | 118 pasan, 6 saltadas, ninguna falla |
| #56 T75 | verde, 536 de unidad | 132 pasan, 6 saltadas, ninguna falla |

Las cuatro corridas finales se hicieron con cada rama ya al día con `main`. La de T75 incluye el reflector (T58) y la urna (T70) de otras sesiones.

**No todas las corridas salieron en verde a la primera.** En T75, antes de la corrida final:

- una tuvo 1 fallo en la prueba de las puertas (escritorio): leía la posición un instante antes de que el motor la publicara al cambiar de sala. Era un error de mi prueba y lo corregí en el mismo PR;
- otra tuvo 1 fallo en `accesibilidad.spec.ts` (escritorio, modo `?ejemplo=1`): un clic se quedó colgado hasta agotar los 90 s. No usa nada de mis tareas y en la corrida siguiente pasó. Ya había pasado dos veces en T05b, siempre con el equipo cargado. **No encontré la causa**;
- dos veces la corrida ni arrancó, porque el build no terminó en los 4 minutos con las sesiones B y C probando a la vez.

## 2. Qué quedó incompleto o con riesgo

1. **T10b (prueba de assets) no se hizo.** No existe `art/prueba-assets/originales/`. Cuando Alex ponga un modelo ahí, la tarea se puede hacer tal como está escrita.
2. **Nada tiene sonido.** La imprenta de la etiquetadora, la campana de los tanques, los balones y las grabaciones son mudos. Todo eso es de la Ola 3.
3. **Las animaciones 3D casi no se ven mientras se juega en celular.** El panel tapa la pantalla; la etiqueta, los tanques y el cajón se ven al cerrarlo. Es lo que pide el diseño («el objeto 3D solo anima»), pero conviene mirarlo en un teléfono.
4. **La corrida de los tanques dura 10, 8 y 12 segundos reales**, más 2 de pausa. La sesión B dejó a Alex la decisión de si 12 segundos está bien y si el eje fijo de 0 a 15 s se lee en un celular. Con el panel hecho ya se puede mirar.
5. **El gabinete se abre sin la linterna.** Las flechas son una ayuda para encontrarlo, no una llave. Si Alex prefiere que solo abra con la linterna, es un cambio pequeño.
6. **La hoja de ayer no necesita la linterna** para encontrarse (en el diseño está bajo un mesón, en penumbra) y sus marcas salen en el graficador con solo recogerla.
7. **Si se cierra el panel de los tanques a mitad de una corrida**, al abrirlo se ve el resultado ya quieto. El intento ya se contó al bajar la palanca, como pide T27b.
8. **La etiqueta impresa no se guarda:** al salir de la sala 1 y volver, ya no está (el cajón abierto sí).
9. **Las e2e siguen siendo lentas con varias sesiones a la vez.** El equipo tiene 4 núcleos. Con tres corridas simultáneas, una vez el build tardó 15 minutos y ni los 4 minutos de espera alcanzaron; otras veces la corrida completa tardó 16, 20 y hasta 31 minutos en vez de 9. Lo más confiable es no correr las e2e al mismo tiempo.
10. **Queda un archivo de pruebas inestable que no es mío y cuya causa no encontré:** `accesibilidad.spec.ts` falló por tiempo en tres de mis corridas completas (dos en T05b y una en T75), siempre con el equipo cargado. En dos de ellas se ve un clic sobre «Cerrar» o «Cuaderno» que se queda colgado hasta agotar el tiempo.
11. **No medí rendimiento.** El panel `?debug=1` no existe todavía, y no usé throttling de CPU. Las cuatro tareas agregan pocas mallas (3 en la sala 1, 5 en la sala 2, 4 esferas en la sala 3 y un libro en la sala 4) y dos materiales transparentes (los tanques).
12. **Hay dos ayudas parecidas para las e2e:** `tests/e2e/escena.ts` (mía) y `tests/e2e/maquinas.ts` (de la sesión del reflector). Conviene juntarlas.
13. **Siguen pendientes de reportes anteriores:** la escala dinámica de resolución (T13), el modo zurdo (T39) y que con un panel abierto el motor sigue dibujando.

### Errores míos en esta ola

- **En T05b mi primer arreglo no alcanzaba.** Reintentar el toque no servía si cada reintento también tardaba más de 350 ms; lo vi en la primera corrida (19 fallos) y lo cambié por el toque con duración fija.
- **En T05b hice que la prueba de las puertas dependiera del reloj de otra forma** (soltar el joystick «a tiempo») y falló con el equipo cargado: el jugador llegaba a la puerta y seguía de largo. La cambié para que la pared lo detenga.
- **En T52 mi primera prueba e2e tocaba la palanca**, de 6 cm, y falló en escritorio. Sirvió para ver que el blanco también era malo para un jugador, y de ahí salió la decisión del tablero.
- **En T75 la prueba del gimnasio falló en celular** porque el balón quedaba por debajo de la pantalla al acercarse. Faltaba que la ayuda de las pruebas bajara la mirada, como haría un jugador.
- **Corrí mis e2e mientras la sesión C corría las suyas** y las hice más lentas. Alex me preguntó si estaba ocupando algo. Al final de la ola dejé mis corridas en cola, esperando a que las otras sesiones terminaran las suyas.
- **La prueba de las puertas quedó con una carrera** que no vi en T05b: leía la posición justo después de cambiar de sala, un cuadro antes de que el motor la publicara. Falló una vez en T75 y ahí la corregí.

## 3. Qué debe probar una persona en el celular

Todo con **producción**, que es igual a `main`: `https://la-ultima-prueba-duz.pages.dev/jugar/`. Anota el modelo del celular y el navegador. Hazlo en el Android de referencia y en un iPhone con Safari. Ninguna de estas pruebas la hice en un dispositivo real.

### 3.1 Sala 1 · La etiquetadora (T45)

1. Toca **Jugar solo**.
2. Gira a la izquierda, camina hasta la **puerta 1** (la primera de la pared izquierda), tócala y toca **Usar**.
3. Al frente está el mostrador. Toca la caja oscura (la **etiquetadora**) y toca **Usar**.
4. Etapa 1: toca **−20 %** y luego **Bajar la palanca**. Toca **Seguir**.
5. Etapa 2: toca **+20 %** y **Bajar la palanca**. Luego quita el +20 %, pon **+25 %** y baja la palanca. Toca **Seguir**.
6. Etapa 3: toca **−50 %** y **+50 %** y baja la palanca. Toca **Volver a la sala**.

- **Se espera:**
  - en la etapa 1, «$1.600» y «Es el precio de la pizarra»;
  - en la etapa 2 con +20 %, «$1.920… subió $320» y «La pizarra dice $2.000», sin la palabra «incorrecto»;
  - en la etapa 3, «$3.000» y «La registradora se abrió»;
  - al volver a la sala, una etiqueta blanca saliendo de la máquina, el cajón de la registradora abierto con una moneda dorada y el sello 1 encendido arriba.
- **Anota:** si los botones de los rodillos se tocan bien con el pulgar, si la respuesta de la máquina queda a la vista sin bajar con el dedo, y si la etiqueta y el cajón se distinguen en la escena.

### 3.2 Sala 2 · Los tanques (T52)

1. Con el sello 1, entra por la **puerta 2** (la primera de la pared derecha).
2. Camina unos pasos de frente. A la izquierda hay un mueble gris con dos perillas y una palanca roja: tócalo y toca **Usar**.
3. Etapa 1: sube el caudal a **2 cm/s** con **+** y toca **Bajar la palanca**. Espera 10 segundos.
4. Sube a **3 cm/s** y baja la palanca. Toca **Seguir**.
5. Etapa 2: pon **3 cm/s** y baja la palanca (8 segundos). Toca **Seguir**.
6. Etapa 3: pon **2 cm/s** y baja la palanca (12 segundos). Toca **Volver a la sala**.

- **Se espera:**
  - durante la corrida, el tanque sube, la línea verde se dibuja y los botones **+**, **−** y **Bajar la palanca** no se pueden usar;
  - con 2 cm/s, «el tanque A estaba en 20 cm. La línea roja está en 30 cm», y la línea verde queda dibujada, más clara;
  - en la etapa 2, la línea morada (cortada) baja y la verde sube hasta cruzarse;
  - en la etapa 3, el tanque B sale tapado y sin línea, y al final dice «La incubadora se abrió»;
  - al volver a la sala, los tanques son transparentes y de la incubadora (al fondo, a la derecha) sale una bandeja con una gota azul. El sello 2 queda encendido.
- **Anota:**
  - si los números del graficador se leen (son pequeños);
  - si 10 o 12 segundos de espera se sienten largos;
  - si se entiende que hay que esperar la campana;
  - si en la escena se nota que los tanques son de vidrio.

### 3.3 La hoja de ayer en el graficador (T52)

1. En la sala 2, antes de la etapa 3, cierra el panel.
2. En el piso, a la izquierda de la entrada, hay una hoja blanca. Tócala y toca **Recoger**.
3. Abre otra vez el tablero de los tanques.

- **Se espera:** en la etapa 3, dos cuadritos morados que dicen «ayer» en el graficador, y la frase «Las marcas «ayer» del graficador son las de la hoja que recogiste».
- **Anota:** si la hoja se ve en el piso y se deja tocar (es pequeña y está pegada al suelo).

### 3.4 Grabación 1 · Las flechas de la linterna (T75)

1. Al empezar la partida, gira a la derecha y recoge la **linterna** amarilla del escritorio. A la izquierda, en la silla, recoge el **cuaderno** azul.
2. Con el sello 1, entra por la **puerta 2**.
3. Sigue las flechas moradas del piso hasta el mueble gris oscuro y alto de la esquina del fondo, a la izquierda. Tócalo y toca **Usar**.
4. Toca **Seguir** y luego **Cuaderno**.

- **Se espera:**
  - cinco flechas moradas en el piso, de la entrada al gabinete;
  - «Encontraste una grabación · Grabación 1 de 3», con el texto de La Voz y «Llevas 1 de 3 grabaciones»;
  - en el cuaderno, la sección «Grabaciones» con el mismo texto.
- **Sin linterna:** empieza otra partida, no la recojas y entra a la sala 2. No debe haber flechas.
- **Anota:** si las flechas se ven sobre el piso gris y si se entiende hacia dónde llevan.

### 3.5 Grabación 2 · El balón que no rebota (T75)

Necesita los sellos 1 y 2.

1. Entra por la **puerta 3** (gimnasio). A la izquierda, lejos, hay un carro azul con cuatro balones.
2. Acércate, toca un balón y toca **Usar**. Prueba los cuatro.

- **Se espera:** tres balones rebotan tres veces sobre el carro. El **verde** apenas se aplasta, no rebota y abre «Grabación 2 de 3».
- **Anota:** si los balones se tocan con facilidad (miden 24 cm) y si se nota la diferencia entre el que rebota y el que no.

### 3.6 Grabación 3 · El libro del estante M (T75)

Necesita los sellos 1, 2 y 3 (la sala 3 es de otra sesión: reflector a 45°; luego 27° con el poste de 3 m a 6 m del sensor; luego la polea en 8 m).

1. Entra por la **puerta 4** (biblioteca). En la pared izquierda hay un estante café con un libro rojo que sobresale.
2. Tócalo y toca **Usar**.

- **Se espera:** «Grabación 3 de 3» y, si ya tienes las otras dos, «Ya tienes las tres grabaciones».
- **Anota:** si el libro se ve desde la entrada y si se deja tocar (su lomo mide 10 cm).

### 3.7 Guardar y continuar con sellos y grabaciones

1. Con al menos un sello y una grabación, recarga la página.
2. Toca **Continuar partida**.

- **Se espera:** los sellos siguen encendidos, la grabación sigue en el cuaderno y, al entrar a la sala 1, el cajón de la registradora está abierto.

### 3.8 Lo que no hay que probar

- T05b no cambia nada del juego: solo las pruebas automáticas.
- El audio de las máquinas y de las grabaciones: no existe todavía.

## 4. Para las otras sesiones

- **Animaciones 3D de las máquinas:** van en `src/engine/mecanismos/` y se registran en `index.ts`. Cada una devuelve `actualizar(dt)`, `estado` (sale en `data-maquina` del canvas, para las e2e) y `liberar()`. `conDetalle(maquina, extra)` junta la máquina de una sala con otra cosa que se anima en ella; el estado de lo extra sale en `data-detalle`.
- **Pruebas e2e dentro de una sala:** `tests/e2e/escena.ts` tiene `continuarEn` (empieza en cualquier sala con una partida guardada), `caminarHasta`, `mirarHacia`, `inclinarHacia` y `tocarObjeto`. No camines un tiempo fijo ni uses `page.mouse.click` sobre la escena: usa `tocar` de `tests/e2e/toque.ts`.
- **Objetos que no son de la máquina** (escondites y balones): están en `src/content/grabaciones.ts`. El controlador los consulta antes de abrir el panel del mecanismo.
- **Sesión C:** revisa los 11 renglones de `usar()` en `src/signals/controlador.ts` y el panel `grabacion` en `interfaz.ts`.
- **Quien haga el audio (Ola 3):** las grabaciones tienen su id (`grab-1` a `grab-3`) y su texto en `src/content/grabaciones.ts`; el panel está en `src/ui/grabaciones/PanelGrabacion.tsx`.
