# La Última Prueba · Narrativa, niveles y puzzles

Exportado el 12 de noviembre de 2026 desde el documento de diseño. Fuente viva: https://claude.ai/artifact/Hn9TmAGSY66YaFW49vN1Wh

## Resumen y decisiones

Este documento define quién es La Voz, cómo es cada sala y cómo funciona cada puzzle. Mantiene las cinco salas, la portería, las grabaciones y los cuatro finales de `docs/diseno.md`, pero cambia la idea de puzzle: en lugar de un problema escrito con cuatro opciones, cada sala es una máquina con una regla matemática que el jugador descubre jugando. La matemática no se esconde dentro del juego: es lo que lo hace divertido.

**Público y alcance (12 de noviembre):** el juego no tiene relación con el ICFES ni con el Saber 11. Es para estudiantes de 9° en adelante, con el foco en 10°. Los puzzles apelan a la intuición matemática y al ingenio, no a la capacidad de cálculo: un estudiante de 9° puede resolverlos experimentando, y uno de 10° reconoce al final el concepto que ve en clase. El motivo para volver al colegio es la memoria USB con el proyecto de la feria de ciencias.

Decisiones nuevas que propongo:

- **La matemática es una regla del mundo, no un enunciado.** Nadie pregunta «¿cuánto es…?». El jugador mueve, inclina, llena o reparte algo, y el mundo responde.
- **Experimentar siempre informa.** No hay mensaje de «incorrecto»: la máquina muestra lo que pasó (el precio impreso, la sombra, la lámpara que se apaga) y eso es la pista.
- **Cada sala tiene un momento «ajá» diseñado.** Se elige una intuición común que es falsa y se construye la etapa donde el jugador la ve fallar con sus propios ojos.
- **El concepto se nombra después.** Al terminar, el cuaderno le pone nombre a lo que el jugador ya entendió.
- **Poco cálculo, mucha idea.** Las cuentas son de una o dos operaciones; lo difícil es ver qué hacer. Probar al azar funciona en la etapa fácil y deja de funcionar en la difícil, así que entender compensa.
- **Accesibilidad:** en la sala 5 las fichas azules son círculos y las amarillas triángulos, para que el color no sea el único dato.

## Narrativa

La historia es un misterio amable: nadie está en peligro, el colegio no es una amenaza y La Voz no es un villano. El tono es el de un profe exigente con humor seco que quiere que aprendas a pensar con calma cuando el tiempo apremia.

### Mundo

Institución Educativa Los Almendros, un colegio público ficticio de una ciudad intermedia colombiana. Es miércoles a las 23:59 y la feria de ciencias empieza mañana a las 7:00. El jugador, estudiante de grado 10, olvidó en el colegio la memoria USB con su proyecto y entra justo cuando la puerta automática de la portería se cierra.

### Personajes

| Personaje | Quién es | Cómo aparece |
| --- | --- | --- |
| La Voz / profe Tobías Rincón | Docente de matemáticas jubilado hace un año, 34 años en el colegio. Programó el sistema de parlantes como despedida antes de irse. | Solo voz por parlantes y subtítulos. Se revela al final con las tres grabaciones. |
| Don Efraín | Celador del turno de noche. Tenía la llave desde el principio. | Por el intercomunicador de la portería; aparece en persona solo en el final «También vale pedir ayuda». |
| Profe Marta (geometría), profe Julián (estadística), profe Inés (español) | Sospechosos del misterio y cameos de los créditos. | Solo por objetos: una taza, una firma, una letra manuscrita. |
| El jugador | Estudiante de grado 10 sin nombre ni género definido. | Primera persona; en cooperativo, avatares de bajo polígono con alias de lista. |

### El misterio

El servidor del colegio tiene programada una migración automática a las 00:40 que borrará la carpeta `ULTIMA_PRUEBA`, donde el profe Tobías guardó mensajes de voz para cada promoción futura. Nadie sabe quién la dejó. Cada sala deja una señal que descarta a un sospechoso; las grabaciones confirman quién es.

| Sala | Señal (opcional, en la vista de inspección) | Qué descarta o revela |
| --- | --- | --- |
| 1. Cooperativa | Lista de turnos del tablero: «profe Marta, incapacidad desde octubre». | Marta no pudo programar nada. |
| 2. Laboratorio | Taza con iniciales «T. R.» junto al computador del termostato. | Primera pista hacia Tobías. |
| 3. Gimnasio | Planilla del torneo de profes firmada por Julián: «no sé ni prender el parlante». | Descarta a Julián. |
| 4. Biblioteca | Ficha de préstamo con letra de Inés y una corrección en rojo de otra mano a un texto de La Voz. | Inés corrigió los textos, pero no los grabó. |
| 5. Rectoría | Carta de jubilación de Tobías en el escritorio del rector. | Confirma la identidad si se tienen las grabaciones. |

### Guion de La Voz

Reglas: cada línea dura menos de 6 segundos (unas 15 palabras), nunca dice la respuesta ni el procedimiento y siempre tiene subtítulo. Todas son ids de diálogo en `src/content/` para que el cooperativo envíe solo el id.

| Id | Momento | Línea |
| --- | --- | --- |
| `voz-intro-1` | Se cierra la puerta | «Buenas noches. Llegas tarde, como siempre a lo importante.» |
| `voz-intro-2` | Primer paso en la portería | «Cinco salas, cinco sellos. Con ellos se abre esta puerta.» |
| `voz-intro-3` | Mira el reloj de la portería | «A las 00:40 algo se borra. Tú decides si te importa.» |
| `voz-s1-entrar` | Entra a la cooperativa | «La cooperativa. Aquí aprendieron a pagar de más varias generaciones.» |
| `voz-s1-sello` | Abre la registradora | «Cuentas claras. El descuento no se le aplica a la paciencia.» |
| `voz-s2-entrar` | Entra al laboratorio | «Aquí todo cambia a ritmo constante. Casi como yo esperando respuestas.» |
| `voz-s2-sello` | Abre el compartimento | «Una línea recta. Lo más honesto que hay en un laboratorio.» |
| `voz-s3-entrar` | Entra al gimnasio | «El gimnasio. Lo que está alto no siempre es inalcanzable.» |
| `voz-s3-sello` | Baja el sello | «Un ángulo y una distancia. Con eso se mide lo que no se alcanza.» |
| `voz-s4-entrar` | Entra a la biblioteca | «Silencio, por favor. Y orden, sobre todo orden.» |
| `voz-s4-sello` | Abre el casillero | «Cuatro números y una sola semana posible. Eso es deducir.» |
| `voz-s5-entrar` | Entra a la rectoría | «La última. Aquí nada vuelve a donde estaba.» |
| `voz-s5-sello` | Abre la caja fuerte | «Ya no me necesitas. Eso era lo que quería oír.» |
| `voz-espera` | 90 s sin interactuar en una sala | «El cuaderno también sirve para pensar, no solo para copiar.» |
| `voz-fallo` | Tercer intento fallido | «Equivocarse aquí es gratis. Y enseña más que acertar de suerte.» |
| `voz-final` | Cinco sellos en la portería | «Salir o salvar el archivo. No hay respuesta incorrecta esta vez.» |

## Estructura de la partida

La portería es el centro: las cinco salas se abren en orden desde ella, cada sello se coloca en su mural y desde allí se elige el final. Un jugador promedio debe terminar las cinco salas en unos 32 minutos, lo que deja 8 minutos para buscar las grabaciones o equivocarse.

Flujo: Portería (tutorial) → Sala 1 → Sala 2 → Sala 3 → Sala 4 → Sala 5 → con los 5 sellos, en la portería se elige final: «Restaurar» lleva a «El legado» (5 sellos y 3 grabaciones); «Salir» lleva a «Justo a tiempo». En cualquier momento, aunque falten salas: el intercomunicador lleva a «Pedir ayuda» y el reloj a 00:40 lleva a «Tiempo cumplido».

### La portería (hub)

Un pasillo de 6 × 10 m con la puerta de salida al fondo y cinco puertas laterales numeradas. Contiene:

- **Mural de sellos:** cinco huecos con la silueta de cada sello (moneda, gota, balón, libro, llave). Al colocar uno se enciende la luz sobre la siguiente puerta.
- **Reloj de pared:** marca la hora del juego, de 23:59 a 00:39. Es el mismo reloj del HUD, pero diegético.
- **Intercomunicador de emergencia:** botón rojo con tapa. Abrir la tapa pide confirmación; usarlo lleva al final «También vale pedir ayuda».
- **Casillero de objetos perdidos:** detrás del vidrio se ve la memoria USB del jugador. Se abre con los cinco sellos. Es la motivación visible desde el minuto 0.
- **Tutorial implícito:** la linterna está en el escritorio del celador y el cuaderno en una silla. Recogerlos enseña el botón «Usar» y la vista de inspección antes de la sala 1.

### Tiempos objetivo

| Tramo | Minutos objetivo | Minuto acumulado | Dificultad |
| --- | --- | --- | --- |
| Portería y tutorial | 2 | 2 | — |
| Sala 1 · Cooperativa | 5 | 7 | 1 básica |
| Sala 2 · Laboratorio | 6 | 13 | 2 media |
| Sala 3 · Gimnasio | 6 | 19 | 2 media (sombras) |
| Sala 4 · Biblioteca | 6 | 25 | 3 alta |
| Sala 5 · Rectoría | 7 | 32 | 3 alta |
| Grabaciones opcionales | 5 | 37 | — |
| Elección de final | 1 | 38 | — |

La curva sube suave: la sala 1 enseña que las máquinas responden a cada intento, y la sala 5 guarda la intuición más difícil de romper. Consultar el cuaderno pausa el reloj en modo individual, así que estos tiempos son de reloj activo.

### Reglas de progreso

- Las salas se abren en orden 1 → 5. Una sala resuelta queda abierta para volver a buscar grabaciones (T76).
- Los mecanismos conservan sus ajustes al salir y volver.
- Intentos ilimitados. Cada fallo cuenta para las pistas graduales, nunca resta tiempo.
- Si el reloj llega a 00:40, se dispara «Tiempo cumplido» aunque falten salas.

## Las cinco salas

Ninguna sala hace una pregunta. Cada una es una máquina o un espacio con una regla matemática que el jugador descubre manipulándolo, y el mundo responde a cada intento. Cada sala tiene tres etapas: **presentar** la regla con un caso fácil, **torcerla** con un caso donde la intuición falla (el momento «ajá») y **dominarla** combinándola. Al resolver, el cuaderno escribe «Lo que acabas de descubrir se llama…»: el concepto se nombra después de vivirlo, nunca antes.

Las pistas no dan pasos de cálculo: invitan a mirar algo («mueve un libro y observa la lámpara»). Se ofrecen tras 120, 240 y 360 segundos en la misma etapa.

### Sala 1 · La cooperativa: la etiquetadora

**Lo que se descubre:** un porcentaje es un multiplicador. Bajar 20 % y luego subir 20 % no te devuelve al precio original, y dos cambios seguidos se combinan multiplicando, no sumando.

**Intuición que se pone a prueba:** «si quito 20 % y pongo 20 %, quedo igual». Es falsa, y la máquina lo demuestra en el primer intento.

**Espacio:** tienda escolar de 7 × 5 m con tres estantes de productos. En el mostrador hay una etiquetadora antigua con dos ranuras para rodillos. Una caja de rodillos trae: −20 %, +20 %, +25 %, −50 % y +50 %. La pizarra del menú tiene los precios correctos de hoy; las etiquetas de los productos están mal. La registradora se abre cuando los tres productos tienen la etiqueta correcta.

**La mecánica:** pones una etiqueta en blanco con el precio actual, eliges hasta dos rodillos y bajas la palanca. La máquina imprime el precio nuevo con un sonido de imprenta. Las etiquetas son ilimitadas: probar no cuesta nada y cada intento informa.

| Etapa | Producto | Etiqueta actual → precio en la pizarra | Solución | Lo que pasa si sigues la intuición |
| --- | --- | --- | --- | --- |
| Presentar | Jugo | $2.000 → $1.600 | Rodillo −20 % | Funciona a la primera: aprende la máquina. |
| Torcer | Empanada | $1.600 → $2.000 (alguien le aplicó la promo por error) | Rodillo +25 % | Con +20 % imprime $1.920. «Ajá»: deshacer un −20 % pide más del 20 %, porque se calcula sobre un precio menor. |
| Dominar | Combo | $4.000 → $3.000, sin rodillo de −25 % | Rodillos −50 % y +50 %, en cualquier orden | Muchos esperan que −50 % y +50 % se anulen; dan $3.000. Al cambiar el orden el resultado no cambia: los rodillos se multiplican. |

En la etapa 3, la única pareja de rodillos que da $3.000 es −50 % con +50 % (0,5 × 1,5 = 0,75); ninguna otra combinación de la caja llega.

**Pistas:** 1) «Mira cuántos pesos quita o pone cada rodillo. ¿Siempre es la misma cantidad?» 2) «+20 % sobre $1.600 no es lo mismo que +20 % sobre $2.000.» 3) «Piensa en cada rodillo como un multiplicador: −20 % es ×0,8.»

**Al resolver, el cuaderno escribe:** «Un cambio de p % multiplica por (1 + p/100). Dos cambios seguidos se multiplican. Por eso −20 % y +25 % se anulan: 0,8 × 1,25 = 1.»

**Cooperativo:** A tiene los productos con sus etiquetas; B lee la pizarra de precios, que está en penumbra y necesita la linterna; C tiene la caja de rodillos; D maneja la palanca.

**Secretos:** en el corcho, la lista de turnos con «profe Marta, incapacidad desde octubre». Sin grabación.

### Sala 2 · El laboratorio: los tanques y el graficador

**Lo que se descubre:** algo que cambia a ritmo constante dibuja una recta; el ritmo es su inclinación, el punto de partida es donde corta el eje, y donde dos rectas se cruzan las dos cosas valen lo mismo al mismo tiempo.

**Intuición que se pone a prueba:** «para que se encuentren, el que va más abajo tiene que subir más rápido». Es cierto, pero ¿cuánto más? La gráfica lo responde mejor que cualquier cuenta.

**Espacio:** laboratorio de 9 × 6 m en penumbra. Dos cilindros de vidrio con líquido de colores, A (verde) y B (morado), cada uno con una perilla de caudal que se ajusta de 1 en 1 cm por segundo. En la pared, un graficador de tinta dibuja en tiempo real la altura de cada tanque contra el tiempo, con su color. Sobre la incubadora, una campana suena a los segundos que indica su temporizador.

**La mecánica:** ajustas las perillas, bajas la palanca y el líquido corre mientras el graficador dibuja. La incubadora se abre si los dos niveles son iguales justo cuando suena la campana. Cada corrida dura unos 10 segundos y luego los tanques se vacían solos: probar es posible, pero pensar antes ahorra tiempo.

| Etapa | Situación | Solución | El «ajá» |
| --- | --- | --- | --- |
| Presentar | Solo el tanque A, que empieza vacío. Debe llegar a la línea roja de 30 cm cuando suene la campana, a los 10 s. | Caudal de A: 3 cm/s | Cada caudal dibuja una recta más o menos inclinada. |
| Torcer | A empieza en 10 cm. B empieza en 50 cm y se vacía a 2 cm/s (perilla bloqueada). La campana suena a los 8 s. | Caudal de A: 3 cm/s (se cruzan en 34 cm) | Tras una corrida de prueba, basta prolongar con el dedo la recta morada hasta el segundo 8 para ver dónde tiene que llegar la verde. |
| Dominar | B está tapado con cinta: no se ve su nivel. En el piso hay una hoja del graficador de ayer con dos marcas moradas: (2 s, 44 cm) y (6 s, 36 cm). A empieza vacío. La campana suena a los 12 s. | Caudal de A: 2 cm/s (se cruzan en 24 cm) | De dos puntos sale toda la recta: B baja 2 cm/s y empezó en 48 cm. |

**Pistas:** 1) «Haz una corrida y mira lo que dibuja el graficador.» 2) «Donde se cruzan las dos líneas, los tanques tienen la misma altura.» 3) «En la hoja de ayer, B bajó 8 cm en 4 segundos. ¿Dónde estaría a los 12?»

**Al resolver, el cuaderno escribe:** «Una función lineal: altura = inicio + caudal × tiempo. El caudal es la pendiente. El cruce de dos rectas es la solución de un sistema de ecuaciones.»

**Cooperativo:** A maneja la perilla verde; B tiene la linterna y encuentra la hoja de ayer bajo un mesón; C lee el temporizador de la campana; D baja la palanca cuando todos confirman.

**Secretos:** la taza «T. R.» en un mesón. Con la luz UV aparecen flechas en el piso hacia el gabinete con la **grabación 1**.

### Sala 3 · El gimnasio: el reflector y las sombras

**Lo que se descubre:** con la misma luz, todas las sombras guardan la misma proporción con la altura de lo que las proyecta, y esa proporción depende solo del ángulo de la luz. Es la idea de la semejanza y la puerta de entrada a la tangente.

**Intuición que se pone a prueba:** «lo que está muy alto no se puede medir sin subir». Al final, el jugador mide el marcador sin tocarlo.

**Espacio:** gimnasio de 20 × 12 m y 9 m de alto, apagado. Un reflector de escenario en una gradería emite luz paralela; su perilla de inclinación tiene cinco muescas: 27°, 37°, 45°, 53° y 63°. En la cancha hay postes de voleibol de 1, 2 y 3 m que se deslizan por rieles marcados cada metro, y sensores de luz en el piso. Muy arriba, en la pared, cuelga el marcador con el sello.

**La mecánica:** inclinas el reflector y mueves los postes; las sombras cambian en vivo. Un sensor suena cuando la punta de una sombra lo toca. Probar es inmediato y no cuesta nada.

| Etapa | Situación | Solución | El «ajá» |
| --- | --- | --- | --- |
| Presentar | Poste de 2 m con un sensor a 2 m de su base. | Reflector a 45° | A 45° la sombra mide lo mismo que el poste. |
| Torcer | Poste de 1 m con un sensor a 2 m de su base, y poste de 3 m que debe tocar con su sombra un segundo sensor, con la misma luz. | Reflector a 27°; el poste de 3 m va a 6 m del segundo sensor | Si el poste pequeño da una sombra del doble de su altura, el grande también: las sombras son proporcionales. |
| Dominar | Bajar el sello del marcador con la polea de la pared, que se gradúa en metros. La sombra del marcador cae en una cinta métrica pintada en el piso. | El marcador está a 8 m. Con el reflector a 45° la sombra marca 8 m; con 53°, el poste de 2 m da 1,5 m y el marcador 6 m. | Una sombra medible y un poste conocido bastan para medir lo inalcanzable. Quien recuerda la etapa 1 pone 45° y lee la altura directamente. |

Si la polea se suelta con una longitud corta, el gancho queda colgando lejos del marcador; si es demasiado larga, choca con el piso. Cualquiera de las dos respuestas da información para el siguiente intento.

**Pistas:** 1) «Mueve el reflector y mira las sombras de dos postes a la vez.» 2) «Con la misma luz, ¿cuántas veces cabe la altura de un poste en su sombra? ¿Y la del otro?» 3) «Recuerda qué pasaba a 45°.»

**Al resolver, el cuaderno escribe:** «Con el mismo ángulo, altura ÷ sombra es siempre igual: son triángulos semejantes. A esa razón se le llama tangente del ángulo. Ya la usaste: tan 45° = 1.» El cuaderno guarda también una tabla con las razones que el jugador vio en cada muesca.

**Cooperativo:** A mueve los postes; B maneja el reflector; C lee la cinta métrica del piso y los sensores; D suelta la polea.

**Secretos:** la planilla del torneo de profes firmada por Julián («no sé ni prender el parlante») en la banca. La **grabación 2** está en el único balón del carro que no rebota.

### Sala 4 · La biblioteca: los carritos de préstamo

**Lo que se descubre:** qué mide realmente cada estadístico. La media es el reparto parejo y no cambia si mueves libros de un día a otro; la mediana solo mira al del medio; la moda, al que se repite; el rango, a los extremos. Juntos describen un conjunto, y a veces lo determinan por completo.

**Intuición que se pone a prueba:** «la media y la mediana son más o menos lo mismo». El jugador verá que puede amontonar libros en un día sin que la mediana se mueva.

**Espacio:** biblioteca de 10 × 8 m con cinco carritos de préstamo rotulados de lunes a viernes y una pila de exactamente 20 libros. En la pared, el «resumen semanal» de la bibliotecaria: cuatro lámparas con un valor cada una, MEDIA 4, MEDIANA 3, MODA 2 y RANGO 7. La ficha de la semana, la que decía cuántos libros había en cada carrito, está rota.

**La mecánica:** arrastras libros entre la pila y los carritos. Cada lámpara se pone verde en el instante en que su condición se cumple y se apaga cuando deja de cumplirse. Es como un sudoku que te dice en vivo qué reglas cumples. La pared de casilleros se abre cuando las cuatro lámparas están verdes.

| Etapa | Lámparas activas | Solución | El «ajá» |
| --- | --- | --- | --- |
| Presentar | Solo MEDIA 4 | Cualquier reparto de los 20 libros en los 5 carritos | Hay muchas respuestas; mover un libro de un carrito a otro no apaga la media. La media es el reparto parejo. |
| Torcer | MEDIA 4 y MEDIANA 3 | Por ejemplo 1, 2, 3, 3, 11 | Puedes poner 11 libros en un día y la mediana no se entera: solo mira el del medio. |
| Dominar | Las cuatro | 2, 2, 3, 4, 9, en cualquier orden de días | Con cuatro pistas solo hay una semana posible: la moda obliga a dos días con 2, el rango lleva el mayor a 9 y la media fija el que falta en 4. |

La solución de la etapa 3 es única (salvo el orden de los días), lo que se verifica así: con los datos ordenados, el del centro es 3; para que 2 sea la moda, los dos primeros son 2; el rango 7 hace que el último sea 9; y como la suma debe ser 20, el cuarto es 4.

**Pistas:** 1) «Mueve un libro de un carrito a otro. ¿Se apagó la lámpara de la media?» 2) «Ordena los carritos de menor a mayor. ¿Cuál mira la mediana?» 3) «Si la moda es 2, al menos dos días tuvieron 2 libros. ¿Y dónde queda el mayor si el rango es 7?»

**Al resolver, el cuaderno escribe:** «Media, mediana, moda y rango miran cosas distintas. El rango es una medida de dispersión: dice qué tan separados están los datos. En 10° conocerás otra, la desviación estándar.»

**Variante para 10° (opcional):** una quinta lámpara, «LA SEMANA MÁS PAREJA», que se enciende si con media 4 y mediana 3 los libros quedan lo más juntos posible. Sirve como reto extra en el modo práctica.

**Cooperativo:** A tiene la pila de libros; B lee las lámparas, que solo se ven desde el mostrador; C tiene el pedazo de ficha rota con la palabra «moda» subrayada; D mueve los carritos y confirma.

**Secretos:** en la caja de devoluciones, una ficha con letra de Inés: «Devolver a T. R.: cuaderno de grabaciones, estante M». En el estante M un libro sobresale y guarda la **grabación 3**.

### Sala 5 · La rectoría: el juego justo de La Voz

**Lo que se descubre:** cuando sacas dos fichas sin devolver la primera, la segunda extracción depende de la primera. Contar las parejas posibles es una forma clara de ver probabilidades, y la intuición de «mitad y mitad» falla.

**Intuición que se pone a prueba:** «con 2 azules y 2 amarillas, sacar dos del mismo color es 50 y 50». Es falso: solo pasa 1 de cada 3 veces. Es el momento «ajá» más fuerte del juego.

**Espacio:** oficina de 6 × 5 m. Sobre la mesa de juntas, una urna transparente y dos dispensadores: círculos azules y triángulos amarillos (forma y color, para que el color nunca sea el único dato). La caja fuerte tiene una placa: «Saco dos fichas sin devolver. Si son del mismo color, ganas tú; si son distintas, gano yo. Ábrela con un juego justo.» El computador muestra la cuenta regresiva del archivo.

**La mecánica:** llenas la urna con las fichas que quieras. Dos herramientas responden al instante:

- **El simulador:** una palanca hace que una mano mecánica saque dos fichas 100 veces muy rápido y anota en un contador cuántas veces salió «mismo color» y cuántas «distinto». Muestra la tendencia, nunca el valor exacto.
- **Ver parejas:** un botón dibuja una línea entre cada par de fichas de la urna. Las líneas entre fichas del mismo color se pintan de un tono y las mixtas de otro. Contar líneas es contar casos posibles.

La caja verifica la composición exacta, no el resultado del simulador, así que el azar no decide nada.

| Etapa | Pedido de la placa | Solución | El «ajá» |
| --- | --- | --- | --- |
| Presentar | «Con 3 fichas, que ganes siempre.» | 3 fichas del mismo color | Es fácil a propósito: sirve para aprender el simulador (100 de 100) y ver que con 3 fichas hay 3 parejas. |
| Torcer | «Con 4 fichas, un juego justo.» | 3 azules y 1 amarilla (o al revés): 3 parejas iguales y 3 distintas de 6 | Casi todos prueban 2 + 2 primero, y el simulador muestra que «mismo color» sale cerca de 33 de 100. Las líneas lo explican: solo 2 de 6 parejas son iguales. |
| Dominar | «Con 9 fichas, un juego justo.» | 6 y 3: 15 + 3 = 18 parejas iguales de 36 | Ya no se puede adivinar: hay que contar o razonar. Las otras divisiones (5 y 4, 7 y 2) no son justas. |

**Reto extra (opcional):** «Con 16 fichas.» La respuesta es 10 y 6. Quien ve el patrón (4 = 2², 9 = 3², 16 = 4², y la diferencia es 2, 3, 4) recibe una línea extra de La Voz en los créditos.

**Pistas:** 1) «Usa el simulador. ¿Qué sale más, mismo color o distinto?» 2) «Toca ‘ver parejas’. Cada línea es una forma de sacar dos fichas.» 3) «Con 4 fichas hay 6 parejas. Un juego justo necesita 3 del mismo color.»

**Al resolver, el cuaderno escribe:** «Sin devolver, la segunda ficha depende de la primera. Con 3 azules y 1 amarilla: P(dos azules) = 3/4 × 2/3 = 1/2. Contar parejas y multiplicar probabilidades dan lo mismo.»

**Cooperativo:** A llena la urna; B maneja el simulador; C activa «ver parejas» y cuenta las líneas; D gira la manija de la caja cuando todos confirman.

**Secretos:** la carta de jubilación de Tobías Rincón en el escritorio. Con la caja abierta, el computador ofrece «Salir» y «Restaurar archivo (requiere 3 grabaciones)», que se eligen en la portería.

## Grabaciones y finales

Las tres grabaciones son opcionales y están en las salas 2, 3 y 4. Juntas desbloquean «El legado» y revelan que La Voz es el profe Tobías. Cada una dura menos de 20 segundos, se escucha al recogerla y queda en el cuaderno con su transcripción.

### Las tres grabaciones

| Id | Sala y escondite | Cómo se encuentra | Transcripción |
| --- | --- | --- | --- |
| `grab-1` | 2 · Gabinete del laboratorio | Siguiendo las flechas que revela la luz UV | «Grabación uno. Treinta y cuatro años diciendo “revisa tus cuentas”. Esta vez quiero decir otra cosa.» |
| `grab-2` | 3 · Balón desinflado en el carro | Es el único balón que no rebota al tocarlo | «Grabación dos. Una nota mide una mañana, no a una persona. Eso no sale en ningún boletín.» |
| `grab-3` | 4 · Libro del estante M | La ficha de Inés en la caja de devoluciones dice dónde | «Grabación tres. Soy Tobías Rincón. Dejé un mensaje para cada promoción. Guárdalos. Y ve a dormir, que mañana madrugas.» |

### Los cuatro finales

El final se elige en la portería, frente a la puerta de salida, después de colocar los cinco sellos. En cooperativo, elegir final requiere unanimidad (T87).

| Final | Condición | Qué se ve |
| --- | --- | --- |
| «El legado» | 5 sellos + 3 grabaciones y elegir «Restaurar archivo» | La carpeta se copia a un pendrive que el jugador se lleva; La Voz se despide con su nombre; se abre la puerta. |
| «Justo a tiempo» | 5 sellos y elegir «Salir» (con o sin grabaciones) | El casillero de objetos perdidos se abre, se recupera la memoria USB y el archivo se borra a las 00:40 mientras el jugador sale. |
| «También vale pedir ayuda» | Usar el intercomunicador en cualquier momento y confirmar | Don Efraín abre con su llave y ofrece repasar las salas pendientes en modo práctica. |
| «Tiempo cumplido» | El reloj llega a 00:40 | La puerta se libera; los acertijos pendientes quedan en modo práctica sin reloj. |

Con cinco sellos y menos de tres grabaciones, el botón «Restaurar archivo» aparece desactivado con el texto «Faltan N grabaciones» y un mapa de las salas que aún esconden una. Así el jugador sabe que puede volver sin que se le diga dónde mirar.

### Ningún final castiga

Todos los finales muestran el resumen de aprendizaje: los cinco temas, cuáles resolvió sin pistas y el procedimiento de cada uno. Los dos finales sin sellos completos ofrecen el modo práctica, que es el mismo contenido sin reloj. Esto cumple el objetivo educativo aunque el jugador no termine.

## Siguientes pasos y tareas afectadas

Este diseño cambia el contrato de contenido de la especificación v1.1: el esquema de «pregunta» con cuatro opciones, distractores y respuesta en hash ya no describe los puzzles. Conviene actualizar la especificación antes de T21. El orden de las fases no cambia.

| Tarea | Qué cambia |
| --- | --- |
| T21 · Esquema de contenido | Un esquema de «puzzle» con etapas: estado inicial, controles disponibles, condición de éxito, tres pistas, texto del cuaderno y pistas por rol. Sin opciones ni distractores. |
| T22 · Escribir el contenido | Los cinco puzzles de este documento, con sus etapas y soluciones. |
| T23 · `hash-answers` | Se guarda el hash del estado resuelto (por ejemplo, los libros por carrito ordenados), no de una opción. Funciona porque todos los controles son discretos. |
| T26 · Validar respuestas | Una función pura por puzzle en `src/game/` que recibe el estado y dice qué condiciones se cumplen (sirve también para las lámparas de la sala 4). |
| T37, T38 · Panel de mecanismo y pistas | Ya no hay panel genérico de opciones: cada sala tiene su panel 2D (etiquetadora, perillas y graficador, reflector, carritos, urna). |
| T45, T52, T58, T64, T70 · Mecanismo por sala | La máquina de cada sala con sus tres etapas. Los tanques, las sombras y el simulador se calculan en 2D y el objeto 3D solo anima, como pide AGENTS.md. |
| T34 · Subtítulos | El guion de La Voz de este documento. |
| T75 · Grabaciones | Escondites y transcripciones de este documento. |

- [ ] Revisar este diseño y decidir si alguna sala necesita otra idea
- [ ] Actualizar `docs/diseno.md`, `AGENTS.md` y la especificación: quitar el Saber 11 y el ICFES, la nueva premisa, los cinco puzzles y el nuevo esquema de contenido
- [ ] Probar los cinco puzzles en papel con uno o dos estudiantes antes de T50: cartulina para la etiquetadora, vasos con agua, una linterna y palos para las sombras, 20 libros reales y una bolsa con fichas
- [ ] Grabar las líneas de La Voz y las grabaciones con ElevenLabs (plan de pago, como pide AGENTS.md)
