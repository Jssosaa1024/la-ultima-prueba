# El pasillo: plano

Decisión de Alex (21 de noviembre de 2026): las salas ya no se abren desde las paredes de la portería. La portería se queda como entrada (mural de sellos, reloj, casillero, intercomunicador, escritorio del celador y puerta de salida) y de ella sale un **pasillo en U** con las cinco puertas reales, numeradas, repartidas entre siete puertas falsas cerradas. Las falsas no llevan a ninguna parte: al tocarlas suena el picaporte y sale una frase corta; cuatro de esas frases las dice La Voz. Ninguna da pistas, ni verdaderas ni falsas.

Este documento es el plano: forma, medidas, cada puerta, carteles, flechas, luces y presupuesto. Los números son los de `src/content/salas.json` (sesión B); si cambian allá, se cambian aquí.

## Cómo encaja en el juego

- **El pasillo es parte de la portería.** Para la partida, la red y el guardado sigue habiendo un solo lugar, `porteria`: la portería y el pasillo comparten el mismo sistema de coordenadas, se arman juntos y se quedan en la GPU todo el juego, como antes la portería sola. No hay lugar nuevo en `game/partida.ts` ni en el protocolo del cooperativo, así que una partida guardada vieja (con `lugar: "porteria"`) carga igual y las poses de los compañeros siguen sirviendo.
- **Forma.** `salas.json` le agrega a la portería `tramos`: rectángulos de piso que se suman al de la portería. El motor dibuja piso y techo en cada uno y levanta las paredes solo en el borde de la unión, así que donde un tramo toca a otro (o a la portería) queda abierto.
- **Puertas reales.** Las cinco conservan su id (`porteria-puerta-1` a `-5`) y su `puerta: <sala>`; solo cambian de pared. Las luces del mural que marcan la siguiente sala las siguen.
- **Volver de una sala.** El jugador aparece en el pasillo, un metro delante de la puerta de esa sala y de espaldas a ella (`puntoDeEntrada`, sin cambios: busca la puerta por su `puerta`).
- **Puertas falsas.** Plano de 1,1 × 2,2 m con el mismo modelo `puerta`, `accion: "usar"` y el campo `falsa` con el id de su frase en `src/content/puertas-falsas.json`. Cada frase es un texto corto o una línea de La Voz (`voz`, momento `puerta_falsa` en `guion.json`). El toque, el aviso en pantalla, el sonido del picaporte y la voz los hace la sesión C.
- **Plano revisado al armarlo.** La primera versión (PR #169) abría el pasillo en todo su ancho y seguía derecho hacia el oeste. Al medirlo, desde la portería se veía todo el pasillo y la peor mirada pasaba de 40 draw calls. Esta versión entra por un vano y gira al norte (ver «Por qué gira apenas se entra»).

## Forma y medidas

Metros. El piso en y = 0; −Z es el norte (donde está la puerta de salida) y +X el este. Alto de techo: 3,2 m en todo (el de la portería). Ancho del pasillo: 2,4 m.

| Pieza | x | z | Largo |
| --- | --- | --- | --- |
| Portería (sin cambios de tamaño) | −3 a 3 | −5 a 5 | 6 × 10 |
| Vano de entrada, en la pared oeste | −3,4 a −3 | −0,8 a 0,8 | 1,6 de ancho |
| Tramo 1 · de sur a norte, detrás de la pared oeste | −5,8 a −3,4 | −9,6 a 0,8 | 10,4 |
| Tramo 2 · de este a oeste | −15,8 a −5,8 | −9,6 a −7,2 | 10 |
| Tramo 3 · de norte a sur | −15,8 a −13,4 | −7,2 a 1,2 | 8,4 |

```
     x = −15,8     −13,4                 −5,8   −3,4  −3               3
z = −9,6  ┌──────────────────────────────────────┐
          │ F3   ↓ 3 gimnasio      ↓ 10-A    F2  │
          │        TRAMO 2  (hacia el oeste)     │
z = −7,2  │      ┌──↑ 10-B ──── ↑ baños ───┐ T   │← 2 laboratorio
          │ 11-A→│                         │ R   │
          │      │← aseo     (adentro      │ A   │← profesores
          │ 11-B→│            de la U)     │ M   │           ┌────────────┐ z = −5
          │  T3  │                         │ O   │← 1        │ salida     │
          │      │← 4 biblioteca           │ 1 ↑ │           │            │
z = 0,8   │      │                         └─────┤ vano ═ F1 │ PORTERÍA   │
z = 1,2   └ ↑ 5 ─┘                                           │            │
          rectoría                                           └────────────┘ z = 5
   ↑ ↓ → ←: hacia dónde mira la puerta · F1 a F3: carteles con flecha · ═: dintel
```

- **Entrada.** Un vano de 1,6 m en la pared oeste de la portería (donde antes estaban las puertas 3 y 5), con un **dintel** de 60 cm encima (`pasillo-dintel`, de y = 2,6 al techo, con el color de las paredes) y el cartel «SALAS 1 A 5» mirando a la portería. Detrás del vano está la pared del tramo 1 con dos casilleros: el pasillo sigue a la derecha, hacia el norte.
- **Por qué gira apenas se entra.** Si el pasillo siguiera derecho desde el vano, desde la portería se verían a lo largo todas sus puertas y carteles, y Three.js los dibujaría con la portería en la misma mirada. Con el giro, desde la portería solo se ve la pared de los casilleros. Una prueba lo revisa (`tests/unit/pasillo.test.ts`: «desde la portería no se ve ninguna puerta del pasillo»).
- **La portería pierde sus cinco puertas laterales.** Lo demás queda donde está: el jugador empieza en (0; 4,2) mirando a la salida, el intercomunicador sigue en la pared oeste (z = −3,9) y el cuadro de la izquierda en z = 4.
- **Recorrido.** Del vano a la esquina norte del tramo 1, unos 10 m; por el tramo 2, 10 m; por el tramo 3 hasta la puerta 5, 8,6 m. En total unos **28 m: 14 s** con el joystick a fondo (2 m/s), más unos 3 s en las dos esquinas: **unos 17 s de punta a punta**, por debajo de los 20 a 25 s pedidos. Desde el punto de inicio de la portería se suman 5 m (2,5 s).

## Puertas

Todas son planos de 1,1 × 2,2 m pegados 2 cm a su pared, con el modelo `puerta` (KayKit `door_A`) y su marco de madera (`acabados`). El giro dice hacia dónde mira la cara: 0 hacia +Z (sur), 180 hacia −Z (norte), 90 hacia +X (este), −90 hacia −X (oeste). En orden de recorrido:

| # | Id | Qué es | Pared | Posición (x; z) | Giro |
| --- | --- | --- | --- | --- | --- |
| 1 | `porteria-puerta-1` | **Sala 1 · La cooperativa** | tramo 1, este | (−3,42; −2,6) | −90 |
| 2 | `pasillo-puerta-profesores` | Sala de profesores | tramo 1, este | (−3,42; −5,6) | −90 |
| 3 | `porteria-puerta-2` | **Sala 2 · El laboratorio** | tramo 1, este | (−3,42; −8,4) | −90 |
| 4 | `pasillo-puerta-10a` | Aula 10-A | tramo 2, norte | (−7,4; −9,58) | 0 |
| 5 | `pasillo-puerta-banos` | Baños | tramo 2, sur | (−9; −7,22) | 180 |
| 6 | `porteria-puerta-3` | **Sala 3 · El gimnasio** | tramo 2, norte | (−10,6; −9,58) | 0 |
| 7 | `pasillo-puerta-10b` | Aula 10-B | tramo 2, sur | (−12,2; −7,22) | 180 |
| 8 | `pasillo-puerta-11a` | Aula 11-A | tramo 3, oeste | (−15,78; −5,8) | 90 |
| 9 | `pasillo-puerta-aseo` | Cuarto del aseo | tramo 3, este | (−13,42; −4,4) | −90 |
| 10 | `pasillo-puerta-11b` | Aula 11-B | tramo 3, oeste | (−15,78; −2,6) | 90 |
| 11 | `porteria-puerta-4` | **Sala 4 · La biblioteca** | tramo 3, este | (−13,42; −1) | −90 |
| 12 | `porteria-puerta-5` | **Sala 5 · La rectoría** | fondo del tramo 3 | (−14,6; 1,18) | 180 |

- Cinco reales y siete falsas. Las salas quedan en orden a lo largo del recorrido; la rectoría, la última, cierra el pasillo de frente.
- Entre dos puertas de la misma pared hay al menos 1,7 m de centro a centro (el marco mide 1,26 m) y ninguna queda a menos de 0,95 m de una esquina.
- **Frases** (`src/content/puertas-falsas.json`). Tres son textos cortos: baños («Cerrado. Un letrero dice: «Fuera de servicio».»), 10-B y 11-A. Cuatro las dice La Voz, con su humor seco (momento `puerta_falsa` en `guion.json`): profesores, 10-A, 11-B y aseo. La de 11-B («Esa no es. Las salas que buscas tienen cartel con número.») es la única que orienta, y dice algo cierto. La sesión A las graba con `npm run voz -- --solo voz-pasillo-profesores,voz-pasillo-10a,voz-pasillo-11b,voz-pasillo-aseo`; mientras tanto se ve el subtítulo.
- **Nada de pistas falsas.** Las puertas falsas se ven igual que las reales, pero su cartel no tiene número de sala ni flecha que lleve a ellas, y su frase no habla de los puzzles.

## Carteles y flechas

Planos con `lamina: { tipo: "cartel" }` (dibujo de la sesión C). Lo que dicen es corto: se lee desde el centro del pasillo.

| Id | Dónde | Medidas | Texto |
| --- | --- | --- | --- |
| `pasillo-cartel-s1` … `-s5` | Encima de cada puerta real, de y = 2,44 a 2,78 (la luz de la puerta llega a 2,40) | 1,0 × 0,34 | «SALA 1» y el nombre («COOPERATIVA», «LABORATORIO», «GIMNASIO», «BIBLIOTECA», «RECTORÍA»). La sesión C le agrega el sello cuando la sala lo gana |
| `pasillo-cartel-10a`, `-10b`, `-11a`, `-11b`, `-banos`, `-profesores`, `-aseo` | Encima de cada puerta falsa, de y = 2,44 a 2,68 | 0,7 × 0,24 | «10-A», «10-B», «11-A», «11-B», «BAÑOS», «PROFESORES», «ASEO» |
| `pasillo-flecha-1` | En el dintel del vano, mirando a la portería | 1,6 × 0,4 | «SALAS 1 A 5» |
| `pasillo-flecha-2` | Al fondo del tramo 1, en la pared norte (x = −4,6), a la altura de los ojos | 1,2 × 0,5 | «SALAS 3 A 5» con flecha a la izquierda |
| `pasillo-flecha-3` | Al fondo del tramo 2, en la pared oeste (z = −8,4) | 1,2 × 0,5 | «SALAS 4 Y 5» con flecha a la izquierda |

La flecha 2 queda de frente al caminar por el tramo 1 y la 3 al caminar por el tramo 2: en cada esquina se ve hacia dónde seguir.

**Sello en el cartel (sesión C).** El cartel de una sala que ya tiene su sello lo lleva estampado a la derecha, con la figura y el color de su pieza en el mural (`docs/laminas-y-piezas.md`). Es la misma malla con su lienzo vuelto a pintar: no suma draw calls ni memoria.

**Puertas falsas (sesión C).** Al tocarla, el picaporte traquetea (`efecto-puerta-cerrada`, el mismo de una puerta de sala todavía cerrada) y su frase sale abajo, en una tirita de papel del archivo con el rótulo de la puerta, sin tapar el centro; se va sola en 3,5 a 6 s según el largo. El lector de pantalla la oye con el rótulo delante («Aula 10-B: …»). Si la frase es de La Voz, la dice la primera vez en la partida, con su subtítulo, y las veces siguientes sale escrita. En el cooperativo no viaja por la red ni abre voto: cada jugador oye su puerta.

## Luces

Las mismas dos luces de la portería (hemisférica y direccional, luz de noche fría) sirven para todo el pasillo: no hay luces nuevas. Lo que da ambiente son las **lámparas de techo** de `acabados`: una cada 3,4 m por el centro de cada tramo, con su halo y su charco de luz (el vano no lleva). Su estado sigue el orden de la lista `acabados.lamparas`: primero las tres de la portería, luego las de cada tramo.

| Tramo | Lámparas (de norte a sur, o de oeste a este) |
| --- | --- |
| Portería | titila · apagada · encendida (como antes) |
| Tramo 1 | encendida · titila · encendida |
| Tramo 2 | apagada · encendida · titila |
| Tramo 3 | apagada · titila |

Tres lámparas titilan en el pasillo (una por tramo), lejos unas de otras; con «reducir movimiento» no titila ninguna. Dos están apagadas: el pasillo tiene rincones en penumbra, nunca a oscuras.

## Lo que se arma por código y lo que es modelo

- **Una sola malla fija** con lo que no lleva textura: zócalo azul con su franja amarilla, rodapié, cornisa, marcos, dintel y carcasas de las lámparas. Piso, paredes y techo de todos los tramos van en las tres mallas con textura de la portería (baldosa, yeso con el tinte crema y techo de oficina de ambientCG), con las UV en metros, así que no se nota la junta. Las paredes son sólidas: una caja de colisión por cada tramo de pared, más las esquinas de afuera (`src/engine/salas/planta.ts`).
- **Modelos ya descargados** (KayKit, los mismos de la portería, carpeta `salas/porteria/`): las doce puertas (`puerta`), cuatro casilleros (`casillero`, instanciados: una draw call para los cuatro) y dos matas en las esquinas (`cactus`, instanciadas con la de la portería).
- **Sin paquetes nuevos** y sin Blender.

## Lo que se ve desde dónde

Three.js no dibuja lo que queda fuera del encuadre, pero sí lo que está detrás de una pared. Como las paredes van del piso al techo, el motor parte el piso en celdas de 2 m y calcula una vez, en la planta, qué objetos se ven desde cada celda (`src/engine/salas/visibilidad.ts`). Al pasar de una celda a otra, lo que no se ve deja de dibujarse (`vista-por-celdas.ts`, con capas de la cámara: no toca `visible`, que ya usan la interacción y las animaciones). Calcularlo toma unos 25 ms en un PC, una sola vez, al entrar a la portería.

## Presupuesto (AGENTS.md)

La portería y el pasillo se miden juntos, porque son un solo lugar. Límites por cuadro: 60.000 triángulos y 40 draw calls; texturas en GPU: 16 MB.

| | Portería antes | Portería con su pasillo |
| --- | --- | --- |
| Draw calls de la peor mirada, calculada en las pruebas de unidad (contando las 5 piezas del mural y sin instanciar) | 33 | 34 |
| Draw calls medidos con `?debug=1` (vistas de `docs/capturas/pasillos-B/`) | 22 a 24 | 12 a 23 |
| Triángulos medidos con `?debug=1` | 5.000 a 5.700 | 4.500 a 8.000 |
| Texturas en GPU | 3,9 MB | 7,7 MB (los quince carteles) |
| Descarga nueva | — | 0 KB (los modelos y texturas ya estaban en la portería) |

Con 4 jugadores el cooperativo suma 5 draw calls: la peor mirada queda en 39 de 40. Cada cartel cuesta una draw call y una textura; si hace falta margen, lo primero es juntarlos en un atlas (sesión C). Falta la medida en el celular de referencia (Alex).
