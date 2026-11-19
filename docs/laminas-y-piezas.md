# Láminas y piezas por código

Para que ningún objeto se vea como una caja gris (pulir las salas, sesión C). Son dos campos opcionales de cada objeto en `src/content/salas.json`. Ninguno descarga nada ni agrega draw calls.

## Láminas: planos legibles

Una pizarra, un corcho, una planilla, una hoja, una gráfica, un marcador o un cartel se dibujan por código en un lienzo 2D, con marco, título de letra clara y renglones. La textura va en la cara que se ve (el frente de un plano, o la cara de arriba de una hoja acostada) y los cantos toman el color del marco.

```json
{
  "id": "s1-pizarra",
  "nombre": "Pizarra de precios",
  "forma": "plano",
  "tam": [1.8, 1, 0],
  "pos": [1.3, 1.2, -2.48],
  "color": "#1e3d32",
  "accion": "examinar",
  "lamina": { "tipo": "pizarra", "titulo": "PRECIOS" }
}
```

- **`color`** del objeto es el de la superficie: el verde de la pizarra, el corcho, el papel o la carcasa del marcador.
- **`titulo`** (opcional, hasta 28 caracteres): grande, en Atkinson Hyperlegible. Si no cabe, se achica y, en último caso, se corta con «…».
- **`lineas`** (opcional, de 1 a 8, hasta 32 caracteres cada una): en Courier Prime. Sin ellas se dibujan garabatos que se ven como escritura sin decir nada.

| `tipo` | Qué dibuja | `lineas` |
| --- | --- | --- |
| `pizarra` | Marco de aluminio, tiza con borrones y repisa con tiza y borrador. Si el color es claro, es una pizarra blanca con marcador azul | Renglones |
| `corcho` | Marco de madera, grano del corcho, notas de colores con chinches y, con título, una tarjeta arriba | Una nota por línea |
| `planilla` | Tablilla con pinza de metal y una hoja con tabla | Una fila por línea; `\|` separa columnas |
| `papel` | Hoja, ficha o carta con borde, título subrayado y renglones | Renglones |
| `cuadricula` | Papel de gráfica con cuadrícula fina y gruesa y ejes con flecha | La primera es el eje horizontal y la segunda, el vertical |
| `marcador` | Carcasa oscura con dígitos de siete segmentos ámbar | Un tablero por línea: «LOCAL 12» (rótulo y número) o «12» |
| `cartel` | Fondo de color con borde interior y texto centrado | Renglones bajo el título |

**Reglas:**

- Lo que hace falta para resolver un puzzle se lee en la vista 2D de inspección, no en la lámina (AGENTS.md). La lámina da el título y el aspecto; no copies ahí los datos del puzzle.
- La letra se escoge por contraste con el fondo (al menos 4,5:1).
- Una lámina va en un `plano` o en una `caja`, sin `modelo` ni `pieza` (el esquema lo revisa).
- Tamaño: 320 px por metro, con el lado corto de al menos 128 px y ninguno mayor de 1024. Una pizarra de 1,8 × 1 m pesa unos 0,9 MB en la GPU con sus mipmaps; se libera con la sala.
- De noche las láminas brillan un poco solas para leerse en la penumbra; el marcador, más (sus dígitos).
- Las salas que ya tienen marco de madera por `acabados` (tableros grandes sin modelo) lo conservan: la lámina queda adentro.

Código: `src/engine/salas/laminas.ts`. Pruebas: `tests/unit/laminas.test.ts`.

## Piezas: objetos rehechos con más detalle

Una pieza es un objeto que el motor arma con varias formas simples, en el estilo de KayKit y Kenney (cantos biselados, colores planos), unidas en una sola malla con colores por vértice: una draw call, igual que la primitiva. Si no se toca y no lleva dibujo, se une además con lo fijo de la sala.

```json
{ "id": "porteria-linterna", "forma": "cilindro", "tam": [0.07, 0.24, 0], "pieza": "linterna", ... }
```

- La pieza se registra por nombre en `src/engine/salas/piezas/`: un archivo por sala (por ejemplo, `porteria.ts`) que exporta sus constructores, sumado en `piezas/index.ts`.
- Cabe en el `tam` del objeto, centrada en x y z, con la base en y = 0. Así no cambian la colisión, la sombra de contacto ni el resaltado. Una prueba de unidad revisa que cada `pieza` de `salas.json` exista y quepa.
- Si una máquina la anima (la palanca de la etiquetadora), el pivote sigue en el origen y se conservan el `id` y la `forma`.
- La `forma` queda de respaldo: si la pieza no está registrada, se ve la primitiva.
- Para etiquetas o caras de reloj, la pieza trae un `dibujo` (un lienzo propio) y sus partes con textura usan `enRegion`; las demás leen el blanco de la esquina del lienzo.

Ayudas en `piezas/comunes.ts`: `cajaBiselada`, `cilindro`, `parte` (geometría, color, posición, giro y escala), `enRegion` y `unirPartes`.
