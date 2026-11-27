# Videos · intro y finales

Guion de texto y de cámara de los videos de «El caso de Don Efraín» (`docs/historia.md`). Decisión de Alex del 26 de noviembre de 2026: el juego tiene **un trailer, un video de intro y un video por cada final** (cuatro). Los hace otro agente, después. Mientras no existan, el juego empieza directo en la portería y los finales son pantallas de texto (`src/ui/finales/textos.ts`, que dicen lo mismo que estos guiones).

El trailer no está en este documento: su guion se escribe aparte, cuando se haga.

## Reglas para todos los videos

- **Formato:** MP4 con video H.264 y audio AAC, para que funcione en iPhone. Dos tamaños: 720p y uno más liviano para el Android de referencia. Subtítulos en WebVTT, en español de Colombia; todo lo que se oye tiene subtítulo.
- **Peso y carga:** la regla de AGENTS.md es «Primera sala jugable: 3 MB en total», y un video de 45 s pesa entre 3 y 5 MB. El video se baja aparte, después del toque en «Jugar» o en la puerta de salida, sin frenar la carga de la portería. **Falta decidir con Alex** si los videos cuentan para ese límite.
- **Saltar:** un botón «Saltar» de al menos 44 px, siempre visible, y la tecla Escape. Si el video no carga a tiempo, el juego sigue sin él.
- **Audio:** ya está desbloqueado, porque el video empieza después de un toque. Las frases de La Voz las graba la sesión A con la voz de ElevenLabs de siempre (plan de pago).
- **Estilo:** se recomienda grabarlos desde el propio juego, con la portería en Three.js y una cámara guiada, y las fotos y documentos de 1991 como imágenes 2D. Así se ven igual que el juego. Un video hecho con IA necesitaría su licencia en `art/credits.json`, y hoy `check-credits` no contempla videos: decidirlo con Alex antes.
- **Personajes:** Don Efraín a contraluz o con un estudiante low-poly de Kenney con gorra. Sin caras realistas ni personas reconocibles.
- **El giro:** la intro nunca dice quién es el estudiante: es «E. C., 10-B». Su nombre completo solo aparece en el video de «El legado».
- **Cooperativo:** cada jugador ve el video en su pantalla; el grupo sigue cuando todos lo terminan o lo saltan.
- **Movimiento reducido:** con `prefers-reduced-motion` se ofrece la versión en cortes secos, o se salta directo al texto.

## Intro · el caso de 1991 (unos 45 s)

| Tiempo | Plano y movimiento | Texto en pantalla o voz | Sonido |
| --- | --- | --- | --- |
| 0:00–0:05 | Negro. | «Institución Educativa Los Almendros. Miércoles, 23:58.» | Grillos. Un reloj de pared. |
| 0:05–0:11 | Exterior de noche, la fachada. La cámara avanza despacio hacia la portería. En la reja, un cartel: «Feria de ciencias · mañana, 7:00 a. m.». | «Mañana presentas tu proyecto en la feria de ciencias. Tu memoria USB se quedó adentro.» | Pasos en el andén. |
| 0:11–0:17 | Una foto en blanco y negro del gimnasio en 1991: un puesto de feria con un filtro de agua que gotea. La cámara se acerca despacio. | La Voz: «En 1991, un estudiante presentó un filtro de agua para su vereda.» | Estática suave de parlante. |
| 0:17–0:24 | Dos hojas de datos una al lado de la otra; un círculo rojo marca el mismo número en las dos. | La Voz: «Dio el mismo dato que el filtro de otro colegio. El jurado dijo: copia.» | Una tiza que encierra algo. |
| 0:24–0:30 | Un acta. Un sello rojo «Sancionado» cae sobre «E. C., 10-B». Un pupitre vacío. | La Voz: «Decidieron en cuarenta minutos. Lo sancionaron, y dejó el colegio.» | El golpe del sello. Silencio. |
| 0:30–0:37 | Una pantalla de computador: la carpeta `ULTIMA_PRUEBA` y una cuenta regresiva hasta las 00:40. | La Voz: «Yo guardé las pruebas. Esta noche, a las 00:40, se borran.» | El tic del reloj, más fuerte. |
| 0:37–0:42 | Primera persona: cruzas la puerta automática; al fondo, la memoria USB detrás del vidrio del casillero. La cámara gira: la puerta se cierra. | — | `efecto-puerta-cerrada`. |
| 0:42–0:45 | Un parlante en el techo se enciende. Corte al juego. | La Voz: «Buenas noches. Llegas tarde, como siempre a lo importante.» (`voz-intro-1`, ya grabada) | Clic de parlante. |

**Frases nuevas por grabar para la intro (4):** las cuatro de La Voz entre 0:11 y 0:37. Cuando se haga el video, se agregan al guion con su id y pasan por las mismas reglas (menos de 6 s y 16 palabras).

Como la intro ya cuenta el caso, al empezar la partida `voz-intro-2` puede quedar como está: «Cinco salas, cinco sellos. Cada sello guarda una prueba de un caso de 1991».

## Final · «El legado» (bueno, unos 30 s)

| Tiempo | Plano y movimiento | Texto o voz | Sonido |
| --- | --- | --- | --- |
| 0:00–0:06 | Primera persona frente a la puerta de salida. Junto a ella, una pantalla: «Copiando ULTIMA_PRUEBA… 100 %». Sale un pendrive. | — | Un pitido corto. |
| 0:06–0:10 | Ruido de llaves. La puerta se abre: a contraluz, Don Efraín con gorra y linterna. | — | Llaves, cerradura, puerta. |
| 0:10–0:16 | Por encima del hombro de Don Efraín, hacia la pantalla: la foto de la feria de 1991, el filtro y un cartel escrito a mano, «Efraín Cárdenas, 10-B». La cámara se acerca al cartel. | La Voz: «Efraín, nunca fue copia. Perdóname por tardar treinta y cuatro años en probarlo.» (`voz-fin-legado`) | Solo la voz. |
| 0:16–0:22 | Plano medio de Don Efraín. Se quita la gorra y mira la pantalla un largo rato. | «Ese era yo.» | Silencio. |
| 0:22–0:30 | Se hace a un lado. La puerta abierta a la calle de noche. | «Mañana llegue temprano a su feria. Yo le abro.» | Grillos. Fundido al resumen. |

## Final · «Justo a tiempo» (malo, unos 25 s)

El final más amargo: el jugador tuvo la opción de restaurar el archivo y eligió salir.

| Tiempo | Plano y movimiento | Texto o voz | Sonido |
| --- | --- | --- | --- |
| 0:00–0:05 | Primera persona: el casillero se abre y la mano toma la memoria USB. | — | `efecto-casilleros`. |
| 0:05–0:11 | Don Efraín abre la puerta de salida y se hace a un lado. | «Suerte mañana en su feria.» | Llaves. |
| 0:11–0:15 | Plano detalle: en la otra mano tiene una foto vieja en blanco y negro, la misma de la prueba 3. | — | Silencio. |
| 0:15–0:21 | Desde la calle, mirando hacia atrás: por el vidrio de la portería, el reloj marca las 00:40 y la pantalla se apaga. | La Voz: «Ahí está tu memoria. Mañana, en tu feria, que nadie decida sin mirar dos veces.» (`voz-fin-justo`) | Un zumbido que se corta. |
| 0:21–0:25 | Don Efraín, solo en la portería, frente a la pantalla oscura. | — | Grillos. Fundido al resumen. |

## Final · «Tiempo cumplido» (malo, unos 25 s)

| Tiempo | Plano y movimiento | Texto o voz | Sonido |
| --- | --- | --- | --- |
| 0:00–0:05 | Plano detalle del reloj de pared: 00:39:58, 00:39:59, 00:40. | — | El tic del reloj. |
| 0:05–0:10 | La pantalla de la portería: «Migración completa. ULTIMA_PRUEBA: 0 archivos». Se apaga. | La Voz: «Las 00:40. El archivo se fue. Lo que entendiste esta noche, no.» (`voz-fin-tiempo`) | Un zumbido que se corta. |
| 0:10–0:14 | Las cerraduras ceden. | — | `efecto-clac`. Después, silencio. |
| 0:14–0:20 | La puerta se abre: Don Efraín, sin decir nada, mira la pantalla oscura. | — | Solo las lámparas. |
| 0:20–0:25 | Plano detalle: guarda en el bolsillo de la camisa una foto en blanco y negro, la misma de la prueba 3. Se hace a un lado para dejarte salir. | — | Grillos. Fundido al resumen. |

## Final · «También vale pedir ayuda» (salida amable, unos 20 s)

Sin giro: el jugador pidió ayuda, y eso también es pensar.

| Tiempo | Plano y movimiento | Texto o voz | Sonido |
| --- | --- | --- | --- |
| 0:00–0:05 | Primera persona: el dedo oprime el botón rojo del intercomunicador. | La Voz: «Pedir ayuda a tiempo también es pensar. Don Efraín tiene la llave.» (`voz-fin-ayuda`, ya grabada) | `efecto-interfono`. |
| 0:05–0:10 | Pasos en el pasillo. Don Efraín llega con su llave y abre. | — | Llaves, puerta. |
| 0:10–0:15 | Mira las máquinas encendidas detrás del jugador y sonríe. | «El profe Rincón y sus pruebas.» | — |
| 0:15–0:20 | Caminan juntos hacia la salida. | — | Pasos. Fundido al resumen. |

Las frases de Don Efraín («Ese era yo», «Mañana llegue temprano…», «Suerte mañana en su feria», «El profe Rincón y sus pruebas») van como subtítulo. Si se quieren con voz, hace falta otra voz en ElevenLabs: decidirlo con Alex.

## Créditos

Ya están en el juego (`src/ui/finales/PantallaFinal.tsx`): el expediente 1991-14, con cada personaje y su papel, y su estado al final de la noche. Si se animan, el expediente entra como una carpeta de cartón que se abre; con «El legado» recibe el sello azul «Reabierto», y con los demás finales, el rojo «Cerrado».
