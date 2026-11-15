# Reporte del hito 1 · Partida individual completa · 15 de noviembre de 2026

Una sola sesión, sin otras corriendo en el equipo. Hizo tres cosas:

- **T77 · elección de final y prueba individual de punta a punta** ([#63](https://github.com/Jssosaa1024/la-ultima-prueba/pull/63), fusionado).
- **Prueba total sobre `main`**, con T77 ya fusionada.
- **Este reporte.**

Lo más importante: **la partida individual se juega completa, del menú a cualquiera de los cuatro finales**, y ahora hay pruebas automáticas que la juegan entera en cada corrida. La elección de final ya funcionaba desde T31b, T40 y T76: en T77 no hubo que cambiar nada del juego (`src/`), solo agregar las pruebas.

Resumen honesto: **nada de esto se probó en un celular real.** Todo se comprobó con pruebas de unidad y con pruebas e2e (Playwright: Pixel 5 emulado y Chrome de escritorio, con WebGL por software). La sección 2 es lo que tiene que hacer una persona.

## 1. Resultado de la corrida completa

Comando: `PUERTO_E2E=4521 npx playwright test --workers=1`, con el equipo libre. La suite tiene 150 pruebas (75 por perfil).

| Corrida | Pasan | Saltadas | Fallan | Duración |
| --- | --- | --- | --- | --- |
| Rama de T77, primera | 142 | 7 | **1** | 22,4 min |
| Rama de T77, con el arreglo | 143 | 7 | 0 | 21,7 min |
| **`main`, con T77 fusionada** | **143** | **7** | **0** | **18,2 min** |

`npm run verify` quedó en verde, con 557 pruebas de unidad.

- **Las 7 saltadas son a propósito:** seis son pruebas que solo valen en un perfil (teclado y ratón en celular, dedos en escritorio) y la séptima es la partida completa hasta «El legado» en escritorio, que se juega solo en el perfil celular para no alargar más la suite.
- **La única falla fue de mi prueba nueva, no del juego.** En la primera corrida, en escritorio, un clic sobre un carrito de la sala 4 no «terminó» en 5 segundos. El libro sí se había movido (los cinco carritos quedaron con 4): fue Playwright el que no recibió a tiempo la confirmación del navegador. Lo corregí en la ayuda (`tests/e2e/recorrido.ts`) dentro del mismo PR, y las dos corridas completas siguientes salieron limpias. No hubo errores reales del juego, así que no hizo falta un PR aparte.
- **Inestables en las corridas con el equipo libre: ninguna.** Ninguna prueba de las otras sesiones falló en las tres corridas.
- **La suite ahora tarda entre 18 y 22 minutos** (antes, unos 10). Las dos partidas completas suman casi 9 minutos.

### La prueba inestable de `accesibilidad.spec.ts`

Le dediqué 25 minutos. Esto es lo que encontré:

- **La prueba que le falló a la sesión A ya no existe tal cual.** Fallaba la versión con `?ejemplo=1`; la sesión C la reescribió en T35d (#57) con objetos reales. La sesión A la vio fallar antes de ese cambio.
- **La versión de ahora pasa con el equipo libre:** pasó en las tres corridas completas de este hito.
- **Con el equipo cargado a propósito, la falla se repite.** Corrí el archivo 10 veces en escritorio con 4 navegadores a la vez: la prueba «HUD, inspección, cuaderno y panel de la máquina» se quedó sin tiempo en 6 de 10. Las otras cuatro pruebas del archivo pasaron las 10 veces.
- **La causa no es un botón tapado ni un error del juego: el navegador se queda sin procesador.** En las trazas no hay ningún clic rechazado. Lo que hay son acciones simples que tardan muchísimo: un clic en «Guardar nota» que tardó 50 segundos en confirmarse, una espera del canvas de 106 segundos, un movimiento del ratón que nunca terminó y una página que no terminó de cargar. Es el mismo síntoma de mi falla de los carritos.
- **Por qué en escritorio y por qué esa prueba:** el WebGL de las pruebas se dibuja con el procesador, y en escritorio el canvas mide 1280 × 720, mucho más que en el perfil celular. Además, **con un panel abierto el motor sigue dibujando** (pendiente que ya viene de reportes anteriores), así que los clics dentro de la inspección y del cuaderno compiten con el dibujo de la escena. Esa prueba es la que más paneles abre.
- **Qué no hice:** no cambié la prueba ni el motor. Lo que queda por decidir va en la sección 3 (punto 21).

**Conclusión práctica:** con una sola corrida de e2e a la vez, la suite es confiable. Con varias a la vez en este equipo de 4 núcleos, no lo es, y esta prueba es la primera que cae.

## 2. Qué debe probar Alex en el celular

Es una sola lista, pensada para **jugar una partida completa** y revisar todo de paso. Junta la sección 3 de los tres reportes de la ola 2; entre corchetes va de cuál viene cada revisión (A, B o C y su número).

**Antes de empezar**

- Enlace: `https://la-ultima-prueba-duz.pages.dev/jugar/` (producción, que es igual a `main`).
- Primero en el Android de referencia con Chrome. Después, en un iPhone con Safari.
- Anota el modelo del celular y el navegador.
- La partida dura 40 minutos y esta lista pide detenerse a mirar. **Si necesitas tiempo para anotar, abre el Cuaderno:** en modo individual el reloj se detiene mientras está abierto.
- Si el reloj se acaba, verás el final «Tiempo cumplido». No es un error: empieza otra partida y sigue desde la parte donde ibas (las respuestas están en cada paso).

### Partida A · completa, hasta «El legado» (unos 40 minutos)

**Parte 1 · La portería**

1. Toca **Jugar solo**.
2. Gira a la derecha. En el escritorio hay una linterna amarilla: tócala y toca **Recoger**.
3. Gira a la izquierda. En la silla hay un cuaderno azul: tócalo y toca **Recoger**.
4. Camina al fondo. A la izquierda de la puerta de salida está el **mural**: tócalo y toca **Examinar**. Cierra.
5. A la derecha está el **casillero** gris: **Examinar**. Cierra.
6. Toca **Cuaderno** y despliega los dos datos.

- **Se espera:**
  - el mural abre una hoja clara con la tabla «Huecos del mural» (moneda, gota, balón, libro, llave);
  - el texto ocupa todo el ancho de la hoja, no una columna angosta;
  - en el cuaderno, los dos datos se despliegan con el mismo contenido.
- **Anota:** si la tabla de tres columnas cabe sin desplazar a los lados. [C 3.1]

**Parte 2 · Sala 1, la etiquetadora**

7. Vuelve hacia la entrada. La **puerta 1** es la más cercana a la entrada en la pared de la silla: tócala y toca **Usar**.
8. Al frente está el mostrador. Toca la caja oscura (la **etiquetadora**) y toca **Usar**. Lee el encabezado y la situación.
9. Sin poner rodillos, toca **Bajar la palanca** tres veces. Mira el final del panel.
10. Cierra el panel. Toca el botón naranja **Pista nueva** de arriba, toca **Ver pista** y cierra.
11. Abre otra vez la etiquetadora. Etapa 1: toca **−20 %** y **Bajar la palanca**. Toca **Seguir**.
12. Etapa 2: toca **+20 %** y **Bajar la palanca**. Luego quita el +20 %, pon **+25 %** y baja la palanca. Toca **Seguir**.
13. Etapa 3: toca **−50 %** y **+50 %** y baja la palanca. Toca **Volver a la sala**.
14. Mira la escena. Luego toca **Cuaderno** y lee «Lo que descubriste».
15. Toca otra vez la etiquetadora y **Usar**.

- **Se espera:**
  - arriba del panel dice «Sala 1 · Etapa 1 de 3» y el texto del jugo y la pizarra;
  - al bajar la palanca sin resolver, la máquina muestra lo que hizo y la etapa no cambia; a la tercera aparece «Pistas (0 de 3 abiertas)» con el botón **Ver pista**;
  - la pista dice algo para mirar («Mira cuántos pesos quita o pone cada rodillo…»), no una cuenta. Después de abrirla, el botón de arriba dice **Pistas**, sin naranja;
  - en la etapa 1, «$1.600», «Es el precio de la pizarra», «La máquina aceptó los ajustes» y «Tu cuaderno anotó»;
  - en la etapa 2 con +20 %, «$1.920… subió $320» y «La pizarra dice $2.000», sin la palabra «incorrecto»;
  - en la etapa 3, «$3.000», «La registradora se abrió» y «Lo que acabas de descubrir se llama: El porcentaje como multiplicador»;
  - en la escena, una etiqueta blanca saliendo de la máquina, el cajón de la registradora abierto con una moneda dorada y el sello 1 encendido arriba;
  - en el cuaderno, «Lo que descubriste» con los tres renglones y el concepto;
  - en el paso 15, «Esta máquina ya quedó resuelta: su sello está en el mural de la portería», sin botón de palanca y sin «Pista nueva».
- **Anota:**
  - si los rodillos y los botones de abajo se tocan bien con el pulgar;
  - si la respuesta de la máquina queda a la vista sin bajar con el dedo;
  - si el botón naranja se nota sin estorbar;
  - si el panel deja ver algo de la escena, y si la etiqueta y el cajón se distinguen. [A 3.1, C 3.2, C 3.3, C 3.4 y C 3.5]

**Parte 3 · Sala 2, los tanques y la primera grabación**

16. Da media vuelta, usa la puerta para volver a la portería y entra por la **puerta 2** (la de enfrente, en la pared del escritorio).
17. Sigue las flechas moradas del piso hasta el mueble gris oscuro y alto de la esquina del fondo, a la izquierda (el **gabinete**). Tócalo y toca **Usar**. Toca **Seguir** y luego **Cuaderno**.
18. Vuelve hacia la entrada y camina unos pasos de frente. A la izquierda hay un mueble gris con dos perillas y una palanca roja (el **tablero**): tócalo y toca **Usar**.
19. Etapa 1: sube el caudal a **2 cm/s** con **+** y toca **Bajar la palanca**. Espera 10 segundos. Luego sube a **3 cm/s** y baja la palanca. Toca **Seguir**.
20. Etapa 2: pon **3 cm/s** y baja la palanca (8 segundos). Toca **Seguir**.
21. Antes de la etapa 3, cierra el panel. En el piso, a la izquierda de la entrada, hay una hoja blanca: tócala y toca **Recoger**. Abre otra vez el tablero.
22. Etapa 3: pon **2 cm/s** y baja la palanca (12 segundos). Toca **Volver a la sala**.

- **Se espera:**
  - cinco flechas moradas en el piso, de la entrada al gabinete;
  - «Encontraste una grabación · Grabación 1 de 3», con el texto de La Voz y «Llevas 1 de 3 grabaciones»; en el cuaderno, la sección «Grabaciones» con el mismo texto;
  - durante cada corrida, el tanque sube, la línea verde se dibuja y los botones **+**, **−** y **Bajar la palanca** no se pueden usar;
  - con 2 cm/s, «el tanque A estaba en 20 cm. La línea roja está en 30 cm», y la línea verde queda dibujada, más clara;
  - en la etapa 2, la línea morada (cortada) baja y la verde sube hasta cruzarse;
  - en la etapa 3, el tanque B sale tapado y sin línea; hay dos cuadritos morados que dicen «ayer» y la frase «Las marcas «ayer» del graficador son las de la hoja que recogiste»; al final dice «La incubadora se abrió»;
  - al volver a la sala, los tanques son transparentes y de la incubadora (al fondo, a la derecha) sale una bandeja con una gota azul. El sello 2 queda encendido.
- **Anota:**
  - si las flechas se ven sobre el piso gris y si se entiende hacia dónde llevan;
  - si los números del graficador se leen (son pequeños);
  - si 10 o 12 segundos de espera se sienten largos, y si se entiende que hay que esperar la campana;
  - si la hoja se ve en el piso y se deja tocar (es pequeña y está pegada al suelo);
  - si en la escena se nota que los tanques son de vidrio. [A 3.2, A 3.3 y A 3.4]

**Parte 4 · Recargar y continuar**

23. Recarga la página (o cierra la pestaña y vuelve a abrir el enlace).
24. Toca **Continuar partida**.
25. Entra un momento a la sala 1 y vuelve.

- **Se espera:** los dos sellos siguen encendidos, el reloj sigue desde donde iba, la grabación sigue en el cuaderno y, en la sala 1, el cajón de la registradora está abierto. [A 3.7]
- **Anota:** cómo se ve la etiquetadora en la escena al volver. [C 3.5]

**Parte 5 · Sala 3, el reflector y la segunda grabación**

26. Entra por la **puerta 3** (la segunda de la pared de la silla). Camina hasta la cancha, toca un poste y toca **Usar**.
27. Etapa 1: toca las muescas una por una y mira el dibujo y la frase. Deja **45°** y espera 5 segundos sin tocar nada. Toca **Seguir**.
28. Etapa 2: toca **27°** y sube la distancia del poste de 3 m hasta **6 m**. Espera 5 segundos y toca **Seguir**.
29. Etapa 3: sube la cuerda de la polea a **5 m** y toca **Soltar la polea**. Luego súbela a **8 m** y suéltala otra vez. Toca **Volver a la sala**.
30. A la izquierda, lejos, hay un carro azul con cuatro balones. Acércate, toca un balón y toca **Usar**. Prueba los cuatro.

- **Se espera:**
  - las cinco muescas caben en una fila y se tocan sin fallar; el dibujo cambia con cada toque y se entiende sin leer;
  - con 5 m dice que el gancho quedó por debajo; con 8 m sale el sello 3;
  - tres balones rebotan tres veces sobre el carro. El **verde** apenas se aplasta, no rebota y abre «Grabación 2 de 3».
- **Anota:**
  - si los 5 segundos de espera se sienten largos o si parece que la máquina se trabó;
  - si el dibujo se alcanza a leer (los números de la regla son pequeños);
  - si te dan ganas de cerrar el panel para mirar las sombras en la cancha, o si nunca las miras;
  - si los balones se tocan con facilidad (miden 24 cm) y si se nota la diferencia entre el que rebota y el que no. [B 3.1 y A 3.5]

**Parte 6 · Sala 4, los carritos**

Es la que más necesita un celular pequeño de verdad.

31. Entra por la **puerta 4** (la segunda de la pared del escritorio). Camina hasta los carritos, toca uno y toca **Usar**.
32. Etapa 1: con una sola mano, reparte los 20 libros tocando los carritos, **4 en cada uno**. Espera 5 segundos y toca **Seguir**.
33. Etapa 2: toca un carrito con libros y luego otro, varias veces, hasta dejar **1, 2, 3, 3 y 11**. Espera y toca **Seguir**.
34. Etapa 3: prueba una vez **Devolver todo a la pila**. Luego deja **2, 2, 3, 4 y 9**. Espera y toca **Volver a la sala**.
35. **No recojas todavía el libro rojo del estante.** Se usa en la parte 8.

- **Se espera:**
  - cada toque en un carrito deja un libro, sin tener que elegir la pila primero;
  - al tocar un carrito con libros y luego otro, pasa un libro por toque;
  - las lámparas se ven arriba todo el tiempo, sin subir ni bajar la pantalla;
  - con el último reparto se encienden las cuatro lámparas y sale el sello 4.
- **Anota:**
  - si se entiende solo lo de «de dónde sale» y «a dónde va», o si te quedas tocando sin que pase nada;
  - si fallas toques entre carritos vecinos, y si intentas arrastrar los libros;
  - si se nota que mover un libro de un día a otro no apaga la MEDIA;
  - si al pasar de etapa confunde que los libros «salten» a otro reparto. [B 3.2]

**Parte 7 · Sala 5, la urna**

36. Entra por la **puerta 5** (la tercera de la pared de la silla, cerca del fondo). Toca la **urna** (el cilindro translúcido sobre la mesa) y toca **Usar**.
37. Etapa 1: tira de la manija con la urna vacía y lee lo que dice la caja. Pon 3 azules, toca **Simular 100 extracciones** y tira de la manija. Toca **Seguir**.
38. Cierra el panel y mira la escena. Vuelve a abrir la urna.
39. Etapa 2: deja 2 azules y 2 amarillas y tira de la manija. Luego deja **3 azules y 1 amarilla**, toca **Ver parejas** y tira de la manija. Toca **Seguir**.
40. Etapa 3: deja **6 azules y 3 amarillas** y tira de la manija. Toca **Volver a la sala**.

- **Se espera:**
  - con la urna vacía, la caja dice cuántas fichas contó y cuántas pide la placa, sin decir «incorrecto»;
  - con 3 azules, el simulador da 100 de 100;
  - al cerrar el panel se ven las fichas dentro de la urna y la mano mecánica baja, saca dos y las muestra;
  - con 2 y 2 la caja dice que La Voz gana más veces; con 3 y 1, «ver parejas» da 3 y 3;
  - al final dice «Conseguiste el último sello», hay 5 sellos arriba y en la urna quedan las 9 fichas.
- **Anota:** si las fichas se distinguen dentro de la urna y si la mano atraviesa algo. Es lo que menos se pudo comprobar. [C 3.6, ya sin pegar nada en la consola]

**Parte 8 · La elección de final**

41. Vuelve a la portería, camina al fondo, toca la **puerta de salida** y toca **Usar**.
42. Lee las dos opciones y toca **Volver**.
43. Vuelve a la biblioteca por la **puerta 4**. En la pared izquierda hay un estante café con un libro rojo que sobresale: tócalo y toca **Usar**.
44. Regresa a la puerta de salida y toca **Usar**. Toca **Restaurar archivo**.
45. Toca **Ver créditos**, **Continuar** y **Volver al menú**.

- **Se espera:**
  - en el paso 41, «Los cinco sellos están en el mural y la puerta ya puede abrirse», el botón **Salir** y, debajo, **Restaurar archivo** desactivado con «Falta 1 grabación para restaurar el archivo. Sigue escondida en: La biblioteca»;
  - al volver a la biblioteca, las cuatro lámparas siguen encendidas y los sellos no cambian;
  - el libro abre «Grabación 3 de 3» y «Ya tienes las tres grabaciones»;
  - en el paso 44, «Con las tres grabaciones puedes restaurar el archivo antes de salir»;
  - el final «El legado», con el resumen: 5 de 5 sellos, 3 de 3 grabaciones y el tiempo usado;
  - los créditos, la escena de la fotocopiadora y, al volver al menú, que ya no ofrezca continuar.
- **Anota:**
  - si el libro se ve desde la entrada y si se deja tocar (su lomo mide 10 cm);
  - si se entiende que «Salir» y «Restaurar archivo» son dos finales distintos y que se podía volver por la grabación. [A 3.6 y C 3.7]

### Partida B · corta, hasta «También vale pedir ayuda» (unos 8 minutos)

1. Toca **Jugar solo**. **No recojas la linterna.**
2. Resuelve la sala 1 sin detenerte: **−20 %**; **+25 %**; **−50 %** y **+50 %**.
3. Entra por la **puerta 2** y mira el piso. Sal otra vez.
4. Camina al fondo de la portería, toca la puerta de salida y **Usar**. Toca **Volver**.
5. En la pared izquierda, cerca del fondo, toca el **intercomunicador** (un recuadro rojo pequeño) y **Usar**. Toca **Pedir ayuda**.

- **Se espera:**
  - en la sala 2 no hay flechas en el piso;
  - la puerta de salida dice «La puerta no abre todavía. En el mural faltan 4 sellos.»;
  - el final «También vale pedir ayuda», con 1 de 5 sellos en el resumen. [A 3.4 y C 3.7]

### Los otros dos finales

- **«Justo a tiempo»:** es tocar **Salir** en el paso 42 de la partida A. Para verlo hay que jugar otra partida completa; las pruebas automáticas ya lo juegan entero en cada corrida, así que en el celular es opcional.
- **«Tiempo cumplido»:** aparece solo cuando el reloj llega a cero. Para verlo, deja una partida abierta con la pantalla encendida. Ojo: con el celular bloqueado o en otra app el reloj se detiene. [C 3.7]

### Con lector de pantalla (TalkBack en Android y VoiceOver en iPhone)

1. Activa el lector y entra con **Jugar solo**.
2. Examina el mural del fondo y cierra la ficha.
3. Entra a la sala 1, abre la etiquetadora y baja la palanca tres veces.

- **Se espera:**
  - al cerrar la ficha, el foco vuelve a «Examinar, Mural de sellos, botón»;
  - el panel de la máquina lee el título, la etapa y la situación;
  - al bajar la palanca lee lo que hizo la máquina;
  - a la tercera dice «Hay una pista nueva». [C 3.8]

### Lo que no hay que probar

- El sonido de las máquinas y de las grabaciones: no existe todavía (Ola 3).
- Los cambios de T05b: solo tocan las pruebas automáticas.
- Pegar partidas en la consola (pasos 3.6 y 3.7 del reporte de la sesión C): ya no hace falta, porque a la sala 5 y a los finales se llega jugando.

## 3. Decisiones que le tocan a Alex

Son las que dejaron anotadas las tres sesiones de la ola 2, más las que salieron en este hito. En cada una va lo que hace el juego hoy. Ninguna bloquea la partida completa.

### Cómo se juega

1. **Los sellos se ponen solos.** Hoy, al resolver una sala, su sello queda en el mural sin que el jugador haga nada. El diseño habla de «colocar» cada sello en el mural. ¿Se deja automático o el jugador debe llevarlo hasta el mural? Lo segundo cambia las reglas y el guardado. *(Hito 1)*
2. **«Salir» termina la partida con un toque**, aunque falten grabaciones. El intercomunicador sí pide confirmar. ¿La puerta de salida también debería preguntar «¿seguro?» cuando faltan grabaciones? *(Hito 1)*
3. **Los 5 segundos de reposo** de las máquinas que responden solas (salas 3 y 4). Nadie los ha sentido con el dedo: puede parecer que la máquina no responde. Es un número en los JSON de los puzzles. *(B 3.4 y C, riesgo 4)*
4. **La corrida de los tanques dura 10, 8 y 12 segundos reales**, más 2 de pausa, y el eje del graficador va fijo de 0 a 15 s. ¿Está bien la espera y se lee en un celular? *(A, riesgo 4)*
5. **El gabinete de la grabación 1 se abre sin la linterna.** Las flechas son una ayuda para encontrarlo, no una llave. ¿Debe abrir solo con la linterna? *(A, riesgo 5)*
6. **La hoja de ayer no necesita la linterna** para encontrarse (en el diseño está bajo un mesón, en penumbra) y sus marcas salen en el graficador con solo recogerla. *(A, riesgo 6)*
7. **La polea dice de qué lado quedó el gancho** («por debajo» o «pasó de largo»). Así la altura se encuentra en pocos intentos sin mirar las sombras. ¿Se deja así o solo dice que no enganchó? *(B 3.4)*
8. **Al pasar de etapa en la biblioteca, los libros «saltan»** al reparto inicial de la etapa siguiente, aunque el jugador hubiera dejado otro. ¿Deben quedarse como los dejó? *(B 3.4)*
9. **Los libros se mueven con dos toques** (de dónde sale y a dónde va), no arrastrando. No se comparó con estudiantes. *(B)*
10. **Todos los objetos con «Usar» de la rectoría abren el mismo panel** (urna, dispensadores, simulador, botón «ver parejas» y caja fuerte). *(C, riesgo 8)*
11. **Después de recargar, una sala resuelta muestra la solución de ejemplo**, no los ajustes con los que el jugador la resolvió (si usó 3 azules y 6 amarillas, aparecen 6 y 3). Arreglarlo pide cambiar el guardado. *(C, riesgo 9)*

### El tono de los textos

12. **Lo que el cuaderno anota de cada etapa** sale del campo `aja` de los puzzles, que se escribió pensando en el docente. ¿El tono sirve para un estudiante? Se cambia en `src/content/puzzles/`. *(C)*
13. **Lo que la sesión B inventó para las fichas** (`src/content/fichas.json`): la carta de jubilación, el borrador con «horden» que Inés corrige, la planilla del torneo («Tiza y Tablero», «Los del Recreo»), los turnos del corcho y la etiqueta de mantenimiento del reloj. *(B 3.3)*
14. **Las frases de las máquinas:** el reflector (`src/ui/mecanismos/reflector/textos.ts`) y las instrucciones de los carritos (`src/ui/mecanismos/carritos/textos.ts`). *(B 3.3)*

### Lo que el diseño pide y todavía no existe

15. **El resumen de aprendizaje de los finales.** El diseño dice que todo final muestra los cinco temas, cuáles se resolvieron sin pistas y cómo funcionaba cada máquina, y que dos finales ofrecen el «modo práctica». Hoy el final muestra sellos, grabaciones y tiempo, y el texto menciona un modo práctica que no existe. Hay que decidir si entra antes de la prueba con estudiantes y qué se muestra de las salas que no se resolvieron. *(C, riesgo 13, y pendiente desde T40)*
16. **El mural no cambia al ganar sellos** y no se enciende ninguna luz sobre la puerta siguiente. Los sellos se ven en el HUD. ¿Se hace ahora, con cajas de colores, o se espera a los modelos de la portería (T44)? *(Hito 1)*
17. **La caja fuerte de la sala 5 no se abre en 3D** al resolverla. *(C, riesgo 7)*
18. **En la etapa 2 del gimnasio el poste de 2 m desaparece** de la cancha. Con modelos de verdad convendría dejarlo a un lado. *(B, riesgo 5)*

### Lo que necesita a Alex para poder hacerse

19. **T10b (prueba de assets):** falta poner un modelo en `art/prueba-assets/originales/`. Sin eso la tarea no se puede hacer. *(A)*
20. **Medir en el celular de referencia:** nadie ha medido el rendimiento. El panel `?debug=1` todavía no existe. *(A, riesgo 11)*

### Las pruebas automáticas

21. **Que el motor deje de dibujar con un panel abierto.** Es la causa más probable de los clics que se quedan colgados en las e2e de escritorio con el equipo cargado, y en un celular es batería y calor. Hoy sigue dibujando a propósito, para que la animación de la máquina termine detrás del panel. Hay que decidir si se detiene (y la animación se pone al día al cerrar) o se deja así. *(Hito 1; pendiente desde reportes anteriores)*
22. **«El legado» completo se prueba solo en el perfil celular.** En escritorio está saltada para ahorrar casi 4 minutos por corrida. Si se prefiere tenerla en los dos perfiles, es quitar una línea. *(Hito 1)*
23. **Una sola corrida de e2e a la vez.** Con varias sesiones en este equipo las pruebas fallan por falta de procesador, no por errores. Si vuelve a haber sesiones en paralelo, conviene que se turnen para correr la suite. *(A, B y C)*
