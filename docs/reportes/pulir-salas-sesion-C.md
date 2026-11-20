# Pulir las salas · sesión C

Salas: **portería** y **s1-cooperativa**, más un componente compartido de planos legibles que usan A y B. Meta de Alex: que ningún objeto se vea como una caja gris, en el estilo de KayKit y Kenney (low-poly, bordes biselados, colores planos).

## Resultado

| PR | Qué trae | Triángulos por código | Mallas (draw calls de la sala) |
| --- | --- | --- | --- |
| [#156](https://github.com/Jssosaa1024/la-ultima-prueba/pull/156) | Componente: láminas dibujadas y registro de piezas | — (no cambia ninguna sala) | igual que antes |
| [#160](https://github.com/Jssosaa1024/la-ultima-prueba/pull/160) | Portería: reloj, mural, intercomunicador, linterna y cuaderno | 3.960 en toda la sala (reloj 836, intercomunicador 270, linterna 572, cuaderno 1.158) | 28, igual que antes |
| Sala 1 (este PR) | Pizarra, corcho, palanca con su base y productos | 2.380 en toda la sala (productos 596, palanca 296, base 452) | 28 |

Las dos salas quedan muy lejos del presupuesto de AGENTS.md (90.000 triángulos por sala, objetos interactivos de menos de 6.000) y no suman descarga: todo se dibuja y se arma por código. Las láminas de cada sala ocupan mucho menos de 4 MB de GPU, que es el tope que revisa una prueba.

## Cómo se hizo

- **Láminas** (`src/engine/salas/laminas.ts`): ocho tipos dibujados en un lienzo (pizarra, corcho, planilla, papel, cuadrícula, marcador, cartel y tablero), con marco, título en Atkinson Hyperlegible y renglones en Courier Prime. La tinta se escoge por contraste (4,5:1 o más). Se piden en `salas.json` con `"lamina"`. Solo llevan título y aspecto: los datos del puzzle siguen en la vista 2D. La guía está en `docs/laminas-y-piezas.md`.
- **Piezas** (`src/engine/salas/piezas/`): un registro por sala (`porteria.ts`, `s1.ts`) que arma cada objeto con cajas biseladas, cilindros y toros unidos en una sola geometría con colores por vértice, y, si hace falta, un dibujo pequeño (la esfera del reloj, las etiquetas de los productos). Se piden con `"pieza"`.
- **Lo que se toca o choca** conserva su id, su acción y su caja: la caja queda invisible y la pieza va dentro, como con un modelo GLB. Por eso las draw calls no cambian. La palanca gira desde su base como antes.
- **Lo nuevo y fijo** (la base de la palanca, `s1-palanca-base`) se une a la malla fija de la sala.
- **Capturas** con cámaras fijas desde la prueba e2e, en `docs/capturas/pulir-c/`.

## Pruebas

- `format:check`, `lint`, `test` (1.142 en verde) y `check-budget` en cada PR, con el candado C.
- e2e (celular y escritorio): 26 en el componente, 62 en la portería y 65 en la sala 1 (salas, portería, etiquetadora, cooperativo de la sala 1, inspección, partida, arte CC0).
- Pruebas de unidad nuevas en `tests/unit/laminas.test.ts` (unas 30): medidas, contraste, recorte del título, cada tipo en tres tamaños, UV, reglas del esquema, draw calls contadas igual que el juego, 4 MB por sala, la caja invisible de una pieza que se toca y que cada pieza registrada quepa en su caja.

## Lo que queda para Alex

1. **Celular de referencia:** abrir la portería y la sala 1 con `?debug=1` y mirar triángulos y draw calls. Ver sobre todo la linterna y el cuaderno con la luz de medianoche: son chicos y oscuros.
2. ~~Paquete CC0 que resolvería varias cajas~~ **Hecho en T19p (20 de noviembre de 2026):** Alex aprobó [Kenney Food Kit](https://kenney.nl/assets/food-kit). El jugo y el combo pasaron a modelos del paquete; la empanada y las etiquetas siguen por código porque el paquete no tiene empanada.
3. ~~Decidir si se unifican~~ las piezas por código de la sesión A (desde los mecanismos) con el registro `pieza` de la sesión C. **Decisión de Alex (20 de noviembre de 2026): no se unifican.** Cada sistema se queda donde está.

## Incidentes

- La sesión A borró por error el candado de pruebas mientras corría una prueba suya, y mi script lo tomó creyendo que estaba vencido. A ya lo corrigió.
- Al detener una corrida de capturas, quedó vivo un proceso hijo que tomó el candado y terminó las capturas. No hizo daño, pero ocupó el candado unos minutos más.
- Un script mío de medición se quedó esperando entrada y no midió nada; lo detuve y lo volví a correr.
