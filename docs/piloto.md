# Piloto con un grupo de grado 10 · guía para correrlo

15 de noviembre de 2026 · prepara T100 (el piloto) y T101 (convertir lo visto en tareas)

El piloto es una clase de una hora en la que un grupo de grado 10 (y, si se puede, algunos estudiantes de grado 9) juega La Última Prueba mientras dos o tres adultos observan. No es una evaluación de los estudiantes: se evalúa el juego.

**Qué queremos saber:**

1. Si entienden los controles y cada máquina **sin que nadie les explique**.
2. En qué sala y en qué momento se atascan, y si las pistas los ayudan a mirar lo correcto.
3. Si el juego corre bien en **sus** celulares (sobre todo los Android económicos) y con la red del colegio.
4. Si el cooperativo funciona en el salón: entrar con el código, ponerse de acuerdo y avanzar juntos.
5. Si al final pueden decir con sus palabras la regla de al menos una máquina.

**Qué no vamos a guardar:** nombres, fotos o videos de caras, voces, correos, teléfonos, cursos exactos ni datos de los celulares (marca, modelo o número). Las hojas usan códigos (G1, G2… para los grupos; E1, E2… para quien juega solo) que no se pueden unir a una persona.

## Antes

### Dos semanas antes

- [ ] **Permiso del colegio.** Rector o coordinación académica, por escrito (un correo basta), con la fecha, el curso y qué se hará. Si el colegio lo pide, aviso a las familias: «Los estudiantes probarán un juego educativo de matemáticas en el celular. No se recogen nombres, fotos ni datos personales».
- [ ] **Docente del curso.** Que sepa que no tiene que explicar nada antes. Pídale que no dé pistas durante el juego (ver «Durante»).
- [ ] **Supabase configurado** (`docs/supabase.md`), con el límite de sesiones anónimas por hora subido a 150. Sin esto el cooperativo no funciona entre celulares.
- [ ] **Contadores de T98** creados (paso 9 de `docs/supabase.md`), para comparar al final cuántas partidas empezaron y terminaron.

### La semana antes

- [ ] Juegue una partida completa en un **Android económico** y en un **iPhone**, en horizontal, en la red del colegio si puede ir (o con datos móviles).
- [ ] Pruebe el cooperativo con dos celulares: uno crea la partida, el otro entra con el código.
- [ ] Revise que la página abra en la red Wi-Fi del colegio (algunas bloquean sitios nuevos). Si la bloquea, pida que la habiliten o planee usar datos móviles.
- [ ] Imprima las **hojas de observación** (una por observador, más dos de repuesto) y las **preguntas de cierre** (una por estudiante, en media hoja).
- [ ] Prepare un **código QR** con la dirección del juego (`/jugar`) para proyectarlo o pegarlo en el tablero.

### El día, 30 minutos antes

- [ ] Abra el juego en el celular del facilitador para que quede en la caché del colegio.
- [ ] Decida los grupos del cooperativo (de 2 a 4) y quién juega solo. Sugerencia para un curso de 30: unos 6 grupos de 3 y 6 estudiantes solos, para ver los dos modos.
- [ ] Reparta los códigos de observación: cada observador sigue de 2 a 3 grupos o estudiantes, siempre los mismos.
- [ ] Tenga a mano: cargador o batería externa, dos celulares de repuesto con el juego abierto y audífonos (el juego tiene voz y sonido).

## Durante (una hora de clase)

| Minuto | Qué pasa | Quién |
| --- | --- | --- |
| 0–5 | Bienvenida y QR. Que abran el juego en horizontal y suban el volumen o se pongan audífonos. | Facilitador |
| 5–45 | Juego: 40 minutos de reloj. | Estudiantes |
| 5–45 | Observación en las hojas. | Observadores |
| 45–55 | Preguntas de cierre en papel, sin nombre. | Estudiantes |
| 55–60 | Conversación corta: «¿Qué hacía la máquina de la sala que más les costó?». | Docente o facilitador |

### Qué decir al empezar (guion corto)

> «Vamos a probar un juego que todavía estamos haciendo. No es una evaluación: si algo no se entiende, el problema es del juego, no de ustedes. Jueguen como jugarían en su casa. No les vamos a explicar cómo se juega, porque queremos ver si el juego se explica solo. Si algo se traba o se cierra, levanten la mano.»

No explique la matemática ni los controles. Si alguien pregunta cómo se mueve, espere un minuto antes de ayudar y anótelo en la hoja.

### Si un estudiante pide ayuda

- Responda con una pregunta que invite a mirar: «¿Qué hizo la máquina la última vez?», «¿Qué cambió cuando moviste eso?».
- No dé pasos de cálculo ni la respuesta. Si después de dos preguntas sigue atascado, recuérdele el botón de pistas.
- Anote en la hoja qué preguntó y en qué sala.

### Si algo falla

- **La página se recarga sola** (pasa en iPhone cuando se queda sin memoria): el juego guarda la partida; que pulse «Continuar». Anótelo como problema técnico.
- **El celular va lento** (se ve a saltos): anótelo con el minuto y la sala. No cambie de celular a menos que no se pueda jugar.
- **El cooperativo no conecta:** que el grupo revise que todos escribieron el mismo código. Si en 3 minutos no entran, que jueguen solos y anótelo.
- **Sin sonido:** que toque la pantalla una vez (el audio arranca con el primer toque) y revise el modo silencio del celular.

## Hoja de observación

Una hoja por observador. Una fila cada vez que un grupo o estudiante **entra a una sala**, **se atasca más de 2 minutos**, **pide ayuda** o **tiene un problema técnico**. Use el minuto del reloj del juego si lo ve, o la hora del salón.

Código: `G1`… para grupos (anote cuántos son: `G1 (3)`), `E1`… para quien juega solo. Celular: solo `A` (Android) o `i` (iPhone).

| Hora | Código | Cel. | Sala (0–5) | Qué pasó (ver lista) | Lo que dijeron (textual, sin nombres) | Pista abierta (0–3) |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |
| | | | | | | |
| | | | | | | |
| | | | | | | |
| | | | | | | |

Sala 0 es la portería. **Qué pasó**, con una letra:

- **E**: entró a la sala.
- **R**: resolvió la sala (ganó el sello).
- **A**: atascado más de 2 minutos (anote qué estaba mirando o tocando).
- **P**: pidió ayuda a un adulto (anote qué preguntó).
- **C**: problema con los controles (no sabe moverse, mirar o tocar algo).
- **T**: problema técnico (lento, se recargó, sin sonido, no conecta).
- **G**: en grupo, discusión o desacuerdo para aceptar una propuesta o un voto.
- **!**: momento de descubrimiento («¡ah, es que…!»).

Al final de la hoja, por cada código:

| Código | Salas resueltas | Final al que llegó | ¿Usó el cuaderno? | ¿Terminó antes de los 40 min? |
| --- | --- | --- | --- | --- |
| | | | | |
| | | | | |

## Preguntas de cierre (en papel, sin nombre)

Media hoja por estudiante. Arriba solo dice **«No escribas tu nombre»** y una casilla: ☐ grado 9 ☐ grado 10. Nada más que identifique.

1. ¿Jugaste solo o en grupo? ☐ solo ☐ en grupo
2. ¿Cuántas salas resolviste? ☐ 0 ☐ 1 ☐ 2 ☐ 3 ☐ 4 ☐ 5
3. De 1 a 5, ¿qué tan fácil fue entender cómo moverte y tocar las cosas? (1 = muy difícil, 5 = muy fácil) ☐1 ☐2 ☐3 ☐4 ☐5
4. De 1 a 5, ¿qué tanto te gustó? ☐1 ☐2 ☐3 ☐4 ☐5
5. ¿En qué sala te sentiste más perdido? ¿Qué no entendías?
6. Escoge una máquina y explica con tus palabras qué regla seguía.
7. Si un precio baja 20 % y después sube 20 %, ¿vuelve a ser el mismo? ¿Por qué?
8. ¿El juego se trabó, se puso lento o se cerró? ☐ no ☐ sí, ¿en qué sala?
9. En grupo: ¿pudieron ponerse de acuerdo? ¿Qué fue lo más difícil de jugar juntos?
10. ¿Lo jugarías otra vez o se lo recomendarías a alguien? ☐ sí ☐ no ☐ no sé

Las preguntas 6 y 7 no se califican: sirven para saber si la idea de la sala quedó.

## Después

- **El mismo día:** pasar las hojas a una tabla (por ejemplo, una hoja de cálculo) con los mismos códigos, sin agregar nombres. Destruir las hojas de papel cuando estén transcritas.
- **Contadores de T98:** en Supabase, revisar los del día del piloto (consulta en el paso 9 de `docs/supabase.md`) y compararlos con lo observado: partidas iniciadas, salas resueltas y rangos de duración.
- **T101:** cada hallazgo se vuelve una tarea de menos de una hora en la especificación, con la evidencia (código de la hoja y sala). Prioridad: primero lo que impidió jugar (técnico y controles), luego donde se atascaron más de la mitad, y al final lo de gusto.
- **Celulares:** si un Android económico fue lento, anotar la sala y el minuto para T97 (perfilar en el celular de referencia).

## Qué necesita Alex

- Conseguir el permiso del colegio y coordinar la fecha con el docente.
- Tener Supabase configurado antes (pasos 1 a 9 de `docs/supabase.md`).
- Dos o tres observadores adultos y las hojas impresas.
