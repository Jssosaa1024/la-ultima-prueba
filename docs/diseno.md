# La Última Prueba

**Diseño de escape room 3D en primera persona · Grado 9 en adelante, con foco en grado 10 · Colombia**  
**Versiones:** individual (1 jugador) y cooperativa (2 a 4 jugadores). **Duración:** 40 minutos.

Actualizado el 12 de noviembre de 2026 según `docs/salas-y-puzzles.md`, que tiene el detalle de la narrativa, el guion de La Voz, las etapas de cada puzzle, las pistas y los escondites de las grabaciones. El juego no tiene relación con el ICFES ni con el Saber 11.

## Premisa

Es miércoles a las 23:59 y la feria de ciencias empieza mañana a las 7:00. Eres estudiante de grado 10 en la Institución Educativa Los Almendros, un colegio público ficticio, y olvidaste allí la memoria USB con tu proyecto. Entras justo cuando la puerta automática de la portería se cierra. Detrás del vidrio del casillero de objetos perdidos ves tu memoria. Por los parlantes despierta **La Voz**: cinco salas, cinco sellos, y con ellos se abre la puerta. A las 00:40 una migración automática borrará la carpeta `ULTIMA_PRUEBA` del servidor del colegio, y nadie sabe quién la dejó.

El tono es un misterio amable: nadie está en peligro y La Voz no es un villano, sino un profe exigente con humor seco.

## Cómo son los puzzles

Ninguna sala hace una pregunta. Cada sala es una máquina con una regla matemática que el jugador descubre manipulándola: mueve, inclina, llena o reparte algo, y el mundo responde.

- **Experimentar siempre informa.** No hay mensaje de «incorrecto»: la máquina muestra lo que pasó (el precio impreso, la sombra, la lámpara que se apaga).
- **Tres etapas por sala:** _presentar_ la regla con un caso fácil, _torcerla_ con un caso donde la intuición falla (el momento «ajá») y _dominarla_ combinándola.
- **El concepto se nombra después.** Al resolver, el cuaderno escribe «Lo que acabas de descubrir se llama…».
- **Poco cálculo, mucha idea.** Las cuentas son de una o dos operaciones. Un estudiante de 9° puede resolverlas experimentando; uno de 10° reconoce el concepto que ve en clase.
- **Pistas que invitan a mirar**, nunca pasos de cálculo, tras 120, 240 y 360 segundos en la misma etapa o tras varios intentos fallidos.

## Las cinco salas

| Sala | Máquina | Lo que se descubre | Intuición que se pone a prueba | Grado del concepto |
| --- | --- | --- | --- | --- |
| 1. La cooperativa | La etiquetadora: rodillos de porcentaje y una palanca que imprime el precio nuevo | Un porcentaje es un multiplicador; dos cambios seguidos se multiplican | «Si quito 20 % y pongo 20 %, quedo igual» | 9° |
| 2. El laboratorio | Dos tanques con perillas de caudal y un graficador que dibuja su altura contra el tiempo | Un ritmo constante dibuja una recta; el cruce de dos rectas es cuando valen lo mismo | «El de abajo tiene que subir más rápido», pero ¿cuánto más? | 9° |
| 3. El gimnasio | Un reflector con cinco muescas, postes que se deslizan y una polea | Con la misma luz, altura ÷ sombra es constante: semejanza y tangente | «Lo que está muy alto no se puede medir sin subir» | 10° |
| 4. La biblioteca | Cinco carritos, 20 libros y cuatro lámparas: MEDIA, MEDIANA, MODA y RANGO | Qué mide cada estadístico; juntos pueden fijar un conjunto | «La media y la mediana son más o menos lo mismo» | 9° |
| 5. La rectoría | Una urna con fichas azules (círculos) y amarillas (triángulos), un simulador y «ver parejas» | Sin devolver, la segunda extracción depende de la primera; contar parejas da la probabilidad | «Con 2 y 2, sacar dos iguales es 50 y 50» | 10° |

Las soluciones de cada etapa están en `docs/salas-y-puzzles.md` y en `src/content/puzzles/`.

## Versión individual: 1 jugador

Comienzas en la portería. La linterna está en el escritorio del celador y el cuaderno en una silla: recogerlos enseña el botón «Usar» y la vista de inspección antes de la sala 1. Las salas se abren en orden y cada mecanismo conserva sus ajustes al salir y volver. El cuaderno guarda los datos encontrados, tus notas y los conceptos que vas descubriendo. Consultarlo pausa el reloj. Puedes volver a salas resueltas para buscar grabaciones antes de elegir el final.

## Versión cooperativa: 2 a 4 jugadores

En cada sala hay cuatro encargos, **A**, **B**, **C** y **D**. En general, A y C tienen piezas o datos del mecanismo, B tiene la herramienta de lectura (linterna, luz UV) o la vista que los demás no ven, y D acciona la máquina cuando todos confirman. El reparto de cada sala está en `docs/salas-y-puzzles.md`.

| Jugadores | Reparto de encargos |
| --- | --- |
| 2 | Jugador 1: A y B. Jugador 2: C y D. |
| 3 | Jugador 1: A. Jugador 2: B y C. Jugador 3: D. |
| 4 | Un encargo por integrante: A, B, C y D. |

Los encargos rotan entre salas y los objetos pueden pasarse. Accionar el mecanismo que confirma una etapa requiere el acuerdo de todos. El cuaderno es compartido; pausar el reloj requiere acuerdo del grupo. Se puede regresar a buscar grabaciones.

## Grabaciones y finales

Las salas 2, 3 y 4 esconden tres grabaciones opcionales. Juntas revelan que La Voz es el profe Tobías Rincón, docente de matemáticas jubilado, que programó los parlantes como despedida y dejó en `ULTIMA_PRUEBA` mensajes para cada promoción futura. El final se elige en la portería después de colocar los cinco sellos.

- **«Justo a tiempo»:** cinco sellos y elegir salir. Se abre el casillero, recuperas la memoria USB y el archivo se borra a las 00:40.
- **«El legado»:** cinco sellos, tres grabaciones y elegir restaurar el archivo. La carpeta se copia a un pendrive y La Voz se despide con su nombre.
- **«También vale pedir ayuda»:** usar el intercomunicador en cualquier momento. Don Efraín, el celador, abre con su llave y ofrece repasar las salas pendientes en modo práctica.
- **«Tiempo cumplido»:** el reloj llega a 00:40. La puerta se libera y los puzzles pendientes quedan en modo práctica sin reloj.

Ningún final castiga: todos muestran el resumen de aprendizaje con los cinco conceptos, cuáles se resolvieron sin pistas y cómo funcionaba cada máquina.

## Créditos con humor

**Cameos ficticios:** la profe Marta, de geometría, revisó todos los ángulos de cámara; el profe Julián, de estadística, exige una muestra mayor de aplausos; la profe Inés, de español, corrigió los mensajes de La Voz.  
**Gracias a don Efraín:** tenía la llave desde el principio.  
**Poscréditos:** la fotocopiadora imprime: «Etapa 4: justifique dejar la memoria USB para última hora».
