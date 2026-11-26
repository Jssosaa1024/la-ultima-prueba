# Correcciones del 25 de noviembre · sesión B

Alex jugó en el celular y encontró cuatro problemas para esta sesión. Cada grupo va en su PR. Las capturas de antes y después están en `docs/capturas/correcciones-25nov-B/` (celular en horizontal, 851 × 393). Las de antes son de `main`; las de después, de una rama con los tres PR juntos.

## PR de esta sesión

| PR | Qué arregla |
| --- | --- |
| [#184](https://github.com/Jssosaa1024/la-ultima-prueba/pull/184) | 1 · Portada sin «En el celular, sin instalar ni crear cuenta» ni «Para estudiantes de 9.° en adelante» |
| [#185](https://github.com/Jssosaa1024/la-ultima-prueba/pull/185) | 2 · Ninguna puerta del pasillo da a la portería ni a otro cuarto |
| este PR | 3 y 4 · Las pistas de la sala 4 sí salen; la grabación 3 pasa al cactus y se quita el libro M |

## 1 · Portada

Se quitaron las dos frases. Quedan «40 minutos», «Solo o en grupo de 2 a 4» y, abajo, «Colegio y personajes ficticios». La e2e de la portada revisa que ya no estén.

La descripción para compartir el enlace (la que muestran WhatsApp o Google, no la portada) todavía dice «en el celular y sin instalar nada». No la cambié porque no se ve en la página; si Alex quiere quitarla también, es una línea en `src/pages/index.astro`.

Capturas: `antes-portada.jpg`, `despues-portada.jpg`.

## 2 · Pasillo

**El error.** La puerta 1, la de la sala de profesores y la de la sala 2 estaban en la pared este del tramo 1. El otro lado de esa pared es la portería (o lo que se ve por sus ventanas y su salida): si las puertas existieran, llevarían a la portería.

**La regla nueva, con prueba.** `tests/unit/pasillo.test.ts` («detrás de cada puerta cabe su cuarto») arma detrás de cada puerta un cuarto del ancho del marco con el fondo real de la sala (5 m la cooperativa, 6 el laboratorio, 12 el gimnasio, 8 la biblioteca, 5 la rectoría) o un mínimo para las falsas (aulas 6 m, profesores 4, baños 3, aseo 2), y revisa que no pise la portería, el pasillo ni el cuarto de otra puerta. Con el plano viejo encontró, además de las tres de Alex:

- **La biblioteca:** con 8 m de fondo hacia adentro de la U (que mide 7,6 m), se metía al tramo 1.
- **El aula 10-B y el cuarto del aseo:** sus cuartos se pisaban.

**El plano nuevo.**

| Puerta | Antes | Ahora |
| --- | --- | --- |
| Sala 1 · cooperativa | pared este del tramo 1 (da a la portería) | fondo del tramo 1, de frente al caminar hacia el norte |
| Sala 2 · laboratorio | pared este del tramo 1 | tramo 2, pared norte, apenas se dobla la esquina |
| Sala de profesores | pared este del tramo 1 | tramo 2, pared norte, al final |
| Sala 4 · biblioteca | tramo 3, pared este (hacia adentro de la U) | tramo 3, pared oeste (da afuera) |
| Aulas 10-A, 10-B, 11-A, 11-B, baños, aseo | — | corridas para que sus cuartos no se pisen |

Las salas siguen en orden a lo largo del recorrido y la rectoría sigue cerrando el pasillo. La flecha del fondo del tramo 1 ahora dice «SALAS 2 A 5». Las paredes este y oeste del tramo 1 quedan sin puertas: la oeste se ve desde la portería por el vano.

**Presupuesto.** Desde la esquina noroeste del pasillo ahora se ve la puerta 1 al fondo, y la peor mirada subía de 34 a 36 draw calls (con los 5 del cooperativo, 41 de 40). Un casillero y una mata pasaron al tramo 1, donde esa mirada no llega, y quedó otra vez en 34.

**Lo que la prueba no cubre.** Las salas son más anchas que su puerta: el gimnasio mide 20 m de ancho, más que cualquier pared de la U. Para que las cinco salas quepan completas, una al lado de la otra, el pasillo tendría que ser bastante más largo. La regla revisa el fondo de cada cuarto, que es lo que se nota desde el pasillo. Está escrito en `docs/pasillos.md`.

Capturas: `antes-pasillo-tramo1.jpg` (las tres puertas en la pared de la portería) y `despues-pasillo-tramo1.jpg` (la misma pared, sin puertas); `despues-pasillo-fondo-tramo1.jpg` (la puerta 1 de frente y la flecha «SALAS 2 A 5»); y el tramo 2 y el tramo 3, antes y después.

## 3 · Sala 4 sin pistas

**Por qué no salían.** Había dos causas, y las dos se juntaban en la sala 4:

1. **Los intentos casi nunca se contaban.** En las máquinas que responden solas (los carritos y los sensores del reflector), un intento contaba solo si el jugador dejaba la máquina quieta 5 s con todos los libros repartidos y sin resolver. Jugando de verdad nadie espera tanto entre un libro y otro: una simulación con un libro cada 3 s no contó ningún intento en cuatro minutos, y la primera pista solo llegó por tiempo, a los dos minutos de la etapa (el tiempo vuelve a cero en cada etapa). Además, la primera etapa no puede fallar: con los 20 libros repartidos la media siempre es 4, así que allí la pista solo llega por tiempo.
2. **Cuando llegaba, no se veía.** Con el panel de los carritos abierto, el HUD (donde sale «Pista nueva») queda tapado, y la lista de pistas está al final del panel: en un celular en horizontal, fuera de la pantalla (`antes-sala4-panel-carritos.jpg`; el HUD sí la avisaba al cerrar el panel: `antes-sala4-hud-pista.jpg`).

**El arreglo.**

- El intento cuenta a los **3 s** de dejar la máquina quieta (`MS_MIRAR` en `src/game/intentos.ts`); la etapa se sigue resolviendo a los 5 s de la regla. Al tercer reparto que no sirve se ofrece la primera pista, como en las salas que tienen palanca. Aplica también a las etapas 1 y 2 del reflector.
- El panel de cualquier máquina muestra **«Pista nueva»** en su barra de abajo, que siempre está a la vista. Tocarlo abre la pista y lleva la vista a la lista (`despues-sala4-panel-carritos.jpg`).
- El sonido de error de la sesión A (`falloEnVivo`) suena justo cuando cuenta el intento, ahora a los 3 s.

**Pruebas.**

- e2e nueva en `tests/e2e/carritos.spec.ts`: en la etapa 2, tres libros del lunes al viernes, mirando 3,5 s cada vez; el aviso «Pista nueva» aparece dentro de la pantalla, se abre y se lee la pista.
- Unidad: el jugador que mueve un libro cada 3 s recibe la pista al tercer reparto; la primera etapa de la sala 4 no tiene repartos que fallen y su pista llega por tiempo; y **en cada una de las cinco salas**, tres intentos fallidos ofrecen la primera pista (`controlador.test.ts`).

## 4 · Grabación 3 en el cactus

El libro que sobresalía del estante M (`s4-libro-m`) se quitó, con su modelo (`libro.glb`), su crédito y sus textos. En su hueco, en la segunda fila del estante M, va un cactus (`s4-cactus`, «Cactus del estante M»), el mismo modelo KayKit de la sala 1 (CC0, con su entrada en `art/credits.json`), y se usa para recoger la grabación. La ficha de Inés en la caja de devoluciones («cuaderno de grabaciones, estante M») sigue llevando al lugar correcto.

La biblioteca suma 184 triángulos (de 17.748 a 17.932) y las mismas 10 draw calls de modelos.

Si el cactus que vio Alex era otro (en el estante M hay también una maceta de adorno que es parte del modelo del mueble), basta con mover `s4-cactus` en `src/content/salas.json`.

Capturas: `antes-estante-m-cerca.jpg` (el libro rojo que sobresale) y `despues-estante-m-cerca.jpg` (el cactus en su hueco).

## 5 · Coordinación con la sesión A

No toqué `s2-tanques.json` ni la sala 2: los cambia la sesión A (una máquina por etapa). Nos cruzamos en `src/signals/controlador.ts`: su PR #182 suena el error donde se cuenta el intento de una máquina en vivo; al traer `main`, ese sonido quedó dentro del nuevo conteo, como acordamos.

## Cómo se probó

- Pruebas de unidad: 1.246 en verde.
- Formato, lint, tipos, `check-credits`, `check-budget` y `check-audio` en verde.
- e2e con perfil de celular y de escritorio, en una rama con los tres PR juntos sobre `main`: `portada`, `carritos`, `grabaciones`, `pasillo-puertas`, `coop-pasillo`, `partida-completa`, `reflector`, `porteria`, `salas` y `controles`: 83 pasaron y 8 se saltan a propósito (son solo de celular). La partida completa en celular falló una vez por tiempo (un clic en un carrito que no terminó en 5 s, el mismo caso que ya comenta `recorrido.ts`); repetida dos veces sola, pasó las dos. La suite completa (320 pruebas, unas 2 horas con un navegador) no se corrió entera para no saturar el equipo.

## Pendiente para Alex

- Probar en el celular: caminar el pasillo y ver si el nuevo orden de las puertas se entiende; en la sala 4, mover libros y ver que aparezca «Pista nueva» abajo en el panel.
- Decir si el cactus es el que esperaba.
