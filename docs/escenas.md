# Escenas · intro y finales

Guion de texto y de cámara para la escena de entrada y los dos finales de «El caso de Don Efraín» (`docs/historia.md`). Es un guion para quien implemente las escenas: hoy el juego empieza directo en la portería y los finales son pantallas de texto (`src/ui/finales/textos.ts`, que ya dicen lo mismo).

Reglas para las tres escenas:

- Se pueden saltar con un botón «Saltar» de al menos 44 px, siempre visible, y con la tecla Escape.
- Con `prefers-reduced-motion`, la cámara no se desliza: cortes secos entre planos fijos.
- Todo lo que se oye tiene subtítulo. Lo que no dice La Voz va como texto en pantalla, con la letra de máquina de escribir del tema del archivo.
- El audio ya está desbloqueado: la intro empieza después del toque en «Jugar» y los finales, después de un toque en la puerta de salida.
- Se arma con la portería que ya existe (misma cámara, mismas luces). Lo único nuevo es una pantalla plana junto a la puerta de salida, hecha con una primitiva. Don Efraín se ve a contraluz o con un estudiante low-poly de Kenney con gorra; si hace falta un modelo nuevo, se decide con Alex.
- En el cooperativo cada jugador ve la escena en su pantalla; el grupo entra a la portería cuando todos la terminan o la saltan.

## Intro · por qué estás ahí (unos 40 s)

| Tiempo | Plano y movimiento | Texto en pantalla o voz | Sonido |
| --- | --- | --- | --- |
| 0:00–0:05 | Negro. | «Institución Educativa Los Almendros. Miércoles, 23:58.» | Grillos. Un reloj de pared. |
| 0:05–0:12 | Exterior de noche, plano general de la fachada. La cámara avanza despacio hacia la portería. En la reja, un cartel: «Feria de ciencias · mañana, 7:00 a. m.». | «Mañana presentas tu proyecto en la feria de ciencias. Tu memoria USB se quedó adentro.» | Pasos en el andén. |
| 0:12–0:18 | Primera persona. Cruzas la puerta automática. Al fondo, el casillero de objetos perdidos: la cámara se acerca y enfoca la memoria USB detrás del vidrio. | — | El zumbido de las lámparas. |
| 0:18–0:22 | La cámara gira hacia atrás: la puerta automática se cierra. Las luces del pasillo parpadean una vez. | — | `efecto-puerta-cerrada`. |
| 0:22–0:30 | Plano detalle del reloj de pared: 23:59. Baja a la etiqueta de mantenimiento pegada al borde: «Servidor del colegio: migración automática a las 00:40». | «A las 00:40 el servidor borra una carpeta: ULTIMA_PRUEBA. Es lo último que queda de un caso de 1991.» | El tic del reloj, más fuerte. |
| 0:30–0:36 | Un parlante en la esquina del techo. Se enciende su luz. | La Voz: «Buenas noches. Llegas tarde, como siempre a lo importante.» (`voz-intro-1`) | Un clic de parlante y un poco de estática. |
| 0:36–0:40 | La cámara baja a la altura de los ojos y queda donde empieza la partida. Aparecen el HUD y el reloj 00:40:00. | — | — |

Al dar el primer paso suena `voz-intro-2` («Cinco salas, cinco sellos. Cada sello guarda una prueba de un caso de 1991.») y al mirar el reloj, `voz-intro-3`, como hoy. La intro no necesita grabaciones nuevas: usa `voz-intro-1`, que ya está grabada, y tres textos en pantalla.

## Final bueno · «El legado» (unos 30 s)

| Tiempo | Plano y movimiento | Texto o voz | Sonido |
| --- | --- | --- | --- |
| 0:00–0:06 | Primera persona frente a la puerta de salida. Junto a ella, la pantalla de la portería: «Copiando ULTIMA_PRUEBA… 100 %». Un pendrive sale de la ranura. | — | Un pitido corto de computador. |
| 0:06–0:10 | Ruido de llaves. La puerta se abre: a contraluz, Don Efraín con gorra y linterna. | — | Llaves, cerradura, puerta. |
| 0:10–0:16 | Contraplano por encima del hombro de Don Efraín hacia la pantalla: una foto en blanco y negro de la feria de 1991, un filtro de agua y un cartel escrito a mano, «Efraín Cárdenas, 10-B». La cámara se acerca despacio al cartel. | La Voz: «Efraín, nunca fue copia. Perdóname por tardar treinta y cuatro años en probarlo.» (`voz-fin-legado`) | Solo la voz. |
| 0:16–0:22 | Plano medio de Don Efraín. Se quita la gorra y mira la pantalla un largo rato. | «Ese era yo.» | Silencio. |
| 0:22–0:30 | Se hace a un lado. Plano de la puerta abierta a la calle de noche. | «Mañana llegue temprano a su feria. Yo le abro.» | Grillos. Fundido a la pantalla del final. |

## Final malo · el archivo se borra (unos 25 s)

Sirve para «Tiempo cumplido» y, con el primer plano cambiado, para «Justo a tiempo».

| Tiempo | Plano y movimiento | Texto o voz | Sonido |
| --- | --- | --- | --- |
| 0:00–0:05 | Plano detalle del reloj de pared: 00:39:58, 00:39:59, 00:40. En «Justo a tiempo», en cambio, primera persona caminando hacia la salida con la memoria USB en la mano. | — | El tic del reloj. |
| 0:05–0:10 | La pantalla de la portería: «Migración completa. ULTIMA_PRUEBA: 0 archivos». Se apaga. | La Voz: `voz-fin-tiempo` o `voz-fin-justo`, según el final. | Un zumbido que se corta. |
| 0:10–0:14 | Las cerraduras ceden. | — | `efecto-clac`. Después, silencio. |
| 0:14–0:20 | La puerta se abre: Don Efraín, sin decir nada. Plano medio: mira la pantalla oscura. | — | Solo las lámparas. |
| 0:20–0:25 | Plano detalle: su mano guarda en el bolsillo de la camisa una foto en blanco y negro, la misma de la prueba 3. Se hace a un lado para dejarte salir. | — | Grillos. Fundido a la pantalla del final. |

El final malo no reprocha nada al jugador: no hay voz que lo culpe ni música triste exagerada. La emoción está en el silencio y en la foto.

## Créditos

Ya están en el juego (`src/ui/finales/PantallaFinal.tsx`): el expediente 1991-14, con cada personaje y su papel, y su estado al final de la noche. Si se animan, el expediente entra como una carpeta de cartón que se abre; con «El legado» recibe el sello azul «Reabierto», y con los demás finales, el rojo «Cerrado».
