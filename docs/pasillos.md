# El pasillo: plano

Decisión de Alex (21 de noviembre de 2026): las salas ya no se abren desde las paredes de la portería. La portería se queda como entrada (mural de sellos, reloj, casillero, intercomunicador, escritorio del celador y puerta de salida) y de ella sale un **pasillo en U** con las cinco puertas reales, numeradas, repartidas entre siete puertas falsas cerradas. Las falsas no llevan a ninguna parte: al tocarlas suena el picaporte y sale una frase corta; cuatro de esas frases las dice La Voz. Ninguna da pistas, ni verdaderas ni falsas.

Este documento es el plano: forma, medidas, cada puerta, carteles, flechas, luces y presupuesto. Los números son los de `src/content/salas.json` (sesión B); si cambian allá, se cambian aquí.

## Cómo encaja en el juego

- **El pasillo es parte de la portería.** Para la partida, la red y el guardado sigue habiendo un solo lugar, `porteria`: la portería y el pasillo comparten el mismo sistema de coordenadas, se arman juntos y se quedan en la GPU todo el juego, como antes la portería sola. No hay lugar nuevo en `game/partida.ts` ni en el protocolo del cooperativo, así que una partida guardada vieja (con `lugar: "porteria"`) carga igual y las poses de los compañeros siguen sirviendo.
- **Forma.** `salas.json` le agrega a la portería `tramos`: rectángulos de piso que se suman al de la portería. El motor dibuja piso y techo en cada uno y levanta las paredes solo en el borde de la unión, así que donde un tramo toca a otro (o a la portería) queda abierto.
- **Puertas reales.** Las cinco conservan su id (`porteria-puerta-1` a `-5`) y su `puerta: <sala>`; solo cambian de pared. Las luces del mural que marcan la siguiente sala las siguen.
- **Volver de una sala.** El jugador aparece en el pasillo, un metro delante de la puerta de esa sala y de espaldas a ella (`puntoDeEntrada`, sin cambios: busca la puerta por su `puerta`).
- **Puertas falsas.** Plano de 1,1 × 2,2 m con el mismo modelo `puerta`, `accion: "usar"` y el campo `falsa` con el id de su frase en `src/content/puertas-falsas.json`. Cada frase es un texto corto o una línea de La Voz (`voz`, momento `puerta_falsa` en `guion.json`). El toque, el aviso en pantalla, el sonido del picaporte y la voz los hace la sesión C.

## Forma y medidas

Metros. El piso en y = 0; −Z es el norte (donde está la puerta de salida) y +X el este. Alto de techo: 3,2 m en todo (el de la portería). Ancho del pasillo: 2,4 m.

| Pieza | x | z | Largo |
| --- | --- | --- | --- |
| Portería (sin cambios de tamaño) | −3 a 3 | −5 a 5 | 6 × 10 |
| Tramo 1 · brazo de entrada (oeste) | −13 a −3 | −1,2 a 1,2 | 10 |
| Tramo 2 · fondo (norte a sur) | −15,4 a −13 | −1,2 a 8,4 | 9,6 |
| Tramo 3 · brazo del final (este) | −13 a −3 | 6 a 8,4 | 10 |

```
          x = −15,4   −13                                         −3           3
                                                                   ┌───────────┐ z = −5
                                                                   │  salida   │
            ┌──────────────────────────────────────────────────────┤  mural    │
 z = −1,2   │      profesores ↑(−6,6)       10-A ↑(−10)             │           │
            │ F2 ←        TRAMO 1  (se camina hacia el oeste)  F1 ═ │ PORTERÍA  │
 z = 1,2    │    ┌──↓ 2 (−11,6)──↓ baños (−8,3)──↓ 1 (−5)───────────┤           │
            │    │                                                 │  inicio   │
            │ 3 →│← 10-B (z 4,4)                                    └───────────┘ z = 5
            │(3,6)                                                    
            │    │                                                 
 z = 6      │11-B└──↑ 11-A (−11)────────↑ 4 (−7,4)───────────────────┐
            │(6,8)   TRAMO 3  (se camina hacia el este)              ← 5 (z 7,2)
 z = 8,4    └ F3 ─────────────↓ aseo (−9,4)────────────────────────────┘
       TRAMO 2 (de norte a sur)
   ↑ ↓ → ←: hacia dónde mira la puerta · F1 a F3: carteles con flecha · ═: dintel
```

- **Entrada.** El tramo 1 toca la pared oeste de la portería en todo su ancho (z de −1,2 a 1,2), donde antes estaban las puertas 3 y 5. Encima del vano, un **dintel** de 60 cm (`pasillo-dintel`, de y = 2,6 al techo, con el color de las paredes) para que se lea como una entrada y no como una pared que falta.
- **La portería pierde sus cinco puertas laterales.** Lo demás queda donde está: el jugador empieza en (0; 4,2) mirando a la salida, el intercomunicador sigue en la pared oeste (z = −3,9) y el cuadro de la izquierda en z = 4.
- **Recorrido.** De la entrada (x = −3) al fondo del tramo 1 (x ≈ −14,2), 11,2 m; por el tramo 2 hasta z ≈ 7,2, 7,2 m; por el tramo 3 hasta la puerta 5, 10,2 m. En total unos **29 m: 14,5 s** con el joystick a fondo (2 m/s) más unos 3 s en las dos esquinas. Queda en **unos 18 s de punta a punta**, por debajo de los 20 a 25 s pedidos. Desde el punto de inicio de la portería se suman 5 m (2,5 s).

## Puertas

Todas son planos de 1,1 × 2,2 m pegados 2 cm a su pared, con el modelo `puerta` (KayKit `door_A`) y su marco de madera (`acabados`). El giro dice hacia dónde mira la cara: 0 hacia +Z (sur), 180 hacia −Z (norte), 90 hacia +X (este), −90 hacia −X (oeste). En orden de recorrido:

| # | Id | Qué es | Pared | Posición (x; z) | Giro |
| --- | --- | --- | --- | --- | --- |
| 1 | `porteria-puerta-1` | **Sala 1 · La cooperativa** | tramo 1, sur | (−5; 1,18) | 180 |
| 2 | `pasillo-puerta-profesores` | Sala de profesores | tramo 1, norte | (−6,6; −1,18) | 0 |
| 3 | `pasillo-puerta-banos` | Baños | tramo 1, sur | (−8,3; 1,18) | 180 |
| 4 | `pasillo-puerta-10a` | Aula 10-A | tramo 1, norte | (−10; −1,18) | 0 |
| 5 | `porteria-puerta-2` | **Sala 2 · El laboratorio** | tramo 1, sur | (−11,6; 1,18) | 180 |
| 6 | `porteria-puerta-3` | **Sala 3 · El gimnasio** | tramo 2, oeste | (−15,38; 3,6) | 90 |
| 7 | `pasillo-puerta-10b` | Aula 10-B | tramo 2, este | (−13,02; 4,4) | −90 |
| 8 | `pasillo-puerta-11b` | Aula 11-B | tramo 2, oeste | (−15,38; 6,8) | 90 |
| 9 | `pasillo-puerta-11a` | Aula 11-A | tramo 3, norte | (−11; 6,02) | 0 |
| 10 | `porteria-puerta-4` | **Sala 4 · La biblioteca** | tramo 3, norte | (−7,4; 6,02) | 0 |
| 11 | `pasillo-puerta-aseo` | Cuarto del aseo | tramo 3, sur | (−9,4; 8,38) | 180 |
| 12 | `porteria-puerta-5` | **Sala 5 · La rectoría** | fondo del tramo 3 | (−3,02; 7,2) | −90 |

- Cinco reales y siete falsas. Las salas quedan en orden a lo largo del recorrido; la rectoría, la última, cierra el pasillo de frente.
- Entre dos puertas de la misma pared hay al menos 1,7 m de centro a centro (el marco mide 1,26 m) y ninguna queda a menos de 0,95 m de una esquina.
- **Nada de pistas falsas.** Las puertas falsas se ven igual que las reales, pero su cartel no tiene número de sala ni flecha que lleve a ellas, y su frase no habla de los puzzles.

## Carteles y flechas

Planos con `lamina: { tipo: "cartel" }` (dibujo de la sesión C). Lo que dicen es corto: se lee desde el centro del pasillo.

| Id | Dónde | Medidas | Texto |
| --- | --- | --- | --- |
| `pasillo-cartel-s1` … `-s5` | Encima de cada puerta real, de y = 2,36 a 2,70 | 1,0 × 0,34 | «SALA 1» y el nombre («COOPERATIVA», «LABORATORIO», «GIMNASIO», «BIBLIOTECA», «RECTORÍA»). La sesión C le agrega el sello cuando la sala lo gana |
| `pasillo-cartel-10a`, `-10b`, `-11a`, `-11b`, `-banos`, `-profesores`, `-aseo` | Encima de cada puerta falsa, de y = 2,36 a 2,60 | 0,7 × 0,24 | «10-A», «10-B», «11-A», «11-B», «BAÑOS», «PROFESORES», «ASEO» |
| `pasillo-flecha-1` | En el dintel, mirando a la portería | 1,6 × 0,4 | «SALAS 1 A 5» |
| `pasillo-flecha-2` | Al fondo del tramo 1, en la pared oeste (z = 0), a la altura de los ojos | 1,2 × 0,5 | «← SALAS 3 A 5» |
| `pasillo-flecha-3` | Al fondo del tramo 2, en la pared sur (x = −14,2) | 1,2 × 0,5 | «← SALAS 4 Y 5» |

La flecha 2 queda de frente al caminar por el tramo 1 y la 3 al caminar por el tramo 2: en cada esquina se ve hacia dónde seguir.

## Luces

Las mismas dos luces de la portería (hemisférica y direccional, luz de noche fría) sirven para todo el pasillo: no hay luces nuevas. Lo que da ambiente son las **lámparas de techo** de `acabados`: una cada 3,4 m por el centro de cada tramo, con su halo y su charco de luz. Su estado sigue el orden de la lista `acabados.lamparas` (primero las tres de la portería, luego las de cada tramo):

| Tramo | Lámparas (de la entrada hacia el final) |
| --- | --- |
| Portería | titila · apagada · encendida (como ahora) |
| Tramo 1 | encendida · titila · encendida |
| Tramo 2 | apagada · encendida · titila |
| Tramo 3 | encendida · apagada · titila |

Tres lámparas titilan en el pasillo (una por tramo), lejos unas de otras para que nunca se vean dos bajando juntas en la misma mirada; con «reducir movimiento» no titila ninguna. Dos están apagadas: el pasillo tiene rincones en penumbra, nunca a oscuras.

## Lo que se arma por código y lo que es modelo

- **Una sola malla fija** con el piso, las paredes y el techo de todos los tramos (con las texturas de ambientCG de la portería: baldosa, yeso con el tinte crema y techo de oficina), el zócalo azul con su franja amarilla, rodapié, cornisa, marcos, dintel y carcasas de las lámparas. Las paredes del pasillo son sólidas, con una caja de colisión por cada tramo de pared.
- **Modelos ya descargados** (KayKit, los mismos de la portería, carpeta `salas/porteria/`): las doce puertas (`puerta`, la misma de siempre), casilleros contra las paredes largas (`casillero`, instanciados: una draw call para todos) y matas en las esquinas (`cactus`, instanciadas).
- **Sin paquetes nuevos** y sin Blender.

## Presupuesto (AGENTS.md)

La portería y el pasillo se miden juntos con `?debug=1`, porque son un solo lugar. Límites: 60.000 triángulos visibles y 40 draw calls por cuadro, 90.000 triángulos en la escena. Estimado antes de armarlo:

| | Portería sola (hoy) | Con el pasillo |
| --- | --- | --- |
| Triángulos en escena | unos 6.000 | unos 13.000 |
| Draw calls, peor mirada | unas 25 | unas 35 |
| Descarga nueva | — | 0 KB (los modelos y texturas ya están en la portería) |

El costo grande son las puertas y los carteles: cada puerta que se toca y cada cartel es una draw call. Three.js no dibuja lo que queda fuera de la cámara, así que en el pasillo solo cuentan las puertas que se ven. Las medidas reales van en el PR del motor y en `docs/reportes/pasillos-sesion-B.md`.
