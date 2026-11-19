# Arte CC0: qué modelo reemplaza a cada objeto

Decisión de Alex del 16 de noviembre de 2026: el arte final usa solo modelos CC0 ya hechos, en un solo estilo low-poly. Solo Kenney (Quaternius quedó fuera, ver «Quaternius, fuera»); piso, paredes y techo llevan texturas de ambientCG. No se usan Blender, luz horneada, Meshy ni Sketchfab.

Este documento es la lista de compras. Dice qué bajar, dónde guardarlo y qué objeto de `src/content/salas.json` reemplaza cada modelo, y estima si cada sala cabe en el presupuesto. Nada de esto está descargado todavía.

## Qué se bajó

Son **3 paquetes de Kenney y 5 texturas de ambientCG**, ya descargados (ver «Ya descargado», abajo). De Quaternius no se baja nada (ver «Quaternius, fuera»).

| # | Qué | Página de descarga | Botón | Carpeta en el repo |
| --- | --- | --- | --- | --- |
| 1 | Kenney · Furniture Kit | <https://kenney.nl/assets/furniture-kit> | «Download» (gratis; Kenney pide una donación opcional) | `art/compartido/originales/kenney-furniture-kit/` |
| 2 | Kenney · Mini Shop | <https://kenney.nl/assets/mini-shop> | «Download» | `art/compartido/originales/kenney-mini-shop/` |
| 3 | Kenney · Factory Kit | <https://kenney.nl/assets/factory-kit> | «Download» | `art/compartido/originales/kenney-factory-kit/` |
| 4 | ambientCG · Tiles040 | <https://ambientcg.com/view?id=Tiles040> | «1K-JPG» (6,5 MB) | `art/compartido/originales/ambientcg/` |
| 5 | ambientCG · WoodFloor051 | <https://ambientcg.com/view?id=WoodFloor051> | «1K-JPG» (5,1 MB) | `art/compartido/originales/ambientcg/` |
| 6 | ambientCG · WoodFloor071 | <https://ambientcg.com/view?id=WoodFloor071> | «1K-JPG» (4,3 MB) | `art/compartido/originales/ambientcg/` |
| 7 | ambientCG · PaintedPlaster017 | <https://ambientcg.com/view?id=PaintedPlaster017> | «1K-JPG» (4,7 MB) | `art/compartido/originales/ambientcg/` |
| 8 | ambientCG · OfficeCeiling001 | <https://ambientcg.com/view?id=OfficeCeiling001> | «1K-JPG» (7,2 MB) | `art/compartido/originales/ambientcg/` |

**Por qué `compartido/` y no `art/<sala>/originales/`:** cada paquete sirve a varias salas. El Furniture Kit, por ejemplo, se usa en todas. Si se guardara una copia por sala, el mismo zip quedaría varias veces en Git LFS. `compartido` es el mismo nombre que ya usan `art/credits.json` (campo `sala`) y la sesión A para las texturas.

**Cómo guardarlo:**

1. Deja el zip tal como llega, sin abrir ni renombrar, dentro de su carpeta. El script de optimización lo lee desde ahí.
2. Antes de subirlo, revisa que Git LFS esté instalado (`git lfs install`, una sola vez por computador). `.gitattributes` ya manda por LFS todo zip, modelo e imagen bajo `art/`.

**Capturas de licencia** (en `art/evidencia/`, con la fecha visible en la barra de tareas o en el nombre):

| Archivo | Qué debe verse |
| --- | --- |
| `kenney-furniture-kit.png` | La página del paquete con la línea «License: Creative Commons CC0» |
| `kenney-mini-shop.png` | Lo mismo para Mini Shop |
| `kenney-factory-kit.png` | Lo mismo para Factory Kit |
| `ambientcg-licencia.png` | <https://docs.ambientcg.com/license/> con la frase «All ambientCG assets are provided under the Creative Commons CC0 1.0 Universal License» |
| `ambientcg-<Id>.png` (una por textura) | La página de la textura, con su nombre y la licencia CC0 |

Cada zip de Kenney trae además un `License.txt` con la licencia CC0. Queda dentro del zip; no hay que copiarlo aparte.

### Ya descargado (16 de noviembre de 2026, T11sa)

Los 8 zips están en `art/compartido/originales/` (Git LFS) y las 9 capturas en `art/evidencia/`, cada una con una franja amarilla que dice la fecha y la URL. Llegaron con estos nombres:

| Carpeta | Zip | Versión | Tamaño |
| --- | --- | --- | --- |
| `kenney-furniture-kit/` | `kenney_furniture-kit.zip` | 1.0 (2018) | 5,1 MB |
| `kenney-mini-shop/` | `kenney_mini-shop_2.1.zip` | 2.1 | 3,7 MB |
| `kenney-factory-kit/` | `kenney_factory-kit_3.0.zip` | 3.0 | 4,5 MB |
| `ambientcg/` | `<Id>_1K-JPG.zip` (las 5 texturas) | — | 27,8 MB en total |

Los tres `License.txt` dicen «Creative Commons Zero, CC0». Los 33 modelos que nombran las tablas de abajo están en los zips.

**Lo que mostraron las vistas previas de los zips:**

- `doorway.glb` y `doorwayFront.glb` del Furniture Kit **traen la hoja de la puerta** (`doorwayOpen.glb` es solo el marco).
- `cash-register.glb` de Mini Shop es la registradora sobre una base baja, no un mostrador.
- **Los estilos sí se notan distintos.** Furniture Kit es delgado, de colores planos y claros (madera naranja, rojo, blanco). Mini Shop y Factory Kit son gruesos, con bordes redondeados, en azul y morado con detalles naranja, más de juguete. `palette` puede igualar los colores, pero no las formas. Se mezclan en la cooperativa (4 + 4 + 2 modelos), el laboratorio (4 de Furniture y 3 de Factory), la rectoría (4 + 1 + 2), el gimnasio (3 + 1) y la portería (5 + 1); la biblioteca es solo Furniture Kit. Alex decide, al ver la primera sala armada, si se queda así o se buscan reemplazos dentro de un solo kit.

## Licencias verificadas

| Fuente | Licencia | Dónde se lee | Notas |
| --- | --- | --- | --- |
| Kenney | CC0 1.0 | Cada página de paquete dice «License: Creative Commons CC0» (revisado el 16-11-2026 en las tres); `License.txt` en el zip | Crédito opcional. En `art/credits.json`: `fuente: "kenney"`, `licencia: "CC0-1.0"`, `autor: "Kenney"` |
| ambientCG | CC0 1.0 | <https://docs.ambientcg.com/license/> | Permite incluir los archivos en un juego. No pide crédito, pero no se puede dar a entender que ambientCG respalda el juego. La descarga es a mano, sin API: la API está permitida, pero no hace falta |
| Quaternius | **No se usa** | Las páginas de los paquetes dicen CC0; <https://quaternius.com/license.html> dice otra cosa | Ver la sección siguiente |

### Quaternius, fuera

Desde el 28 de agosto de 2026, la página de licencia de quaternius.com publica la **Quaternius Asset License (QAL) v1.0**. Esa licencia no es CC0:

- deja usar los assets gratis en juegos comerciales y sin crédito;
- prohíbe redistribuir los assets como assets, «regardless of the specific site or platform through which they were obtained»;
- Quaternius conserva los derechos.

Las páginas de los paquetes viejos siguen diciendo «License: CC0», y poly.pizza e itch.io también. Este repositorio es público y `art/` guarda los originales, así que subir allí un zip de Quaternius podría contar como redistribuirlo. Además, QAL no está en la lista de licencias que acepta `check-credits`.

Por otro lado, Quaternius casi no aporta. No tiene nada para el gimnasio (graderías, red, balones, marcador), ni caja fuerte, taza, registradora, casilleros, reloj, polea o linterna. Lo poco que tiene (un frasco, una palanca, una consola) ya lo cubren Kenney o una primitiva.

**Decisión de Alex (16 de noviembre de 2026):** no se usa Quaternius. Lo que Kenney no tiene se queda como primitiva, y `check-credits` rechaza la fuente `quaternius`.

## KayKit (T19i)

Alex vio la portería y la sala 1 con Kenney y dijo que se veían muy simples. Se agregó **KayKit** de Kay Lousberg, que tiene el mismo estilo low-poly pero más pulido, también CC0:

| Paquete | Página | Zip (versión Free) | Captura |
| --- | --- | --- | --- |
| Furniture Bits | <https://kaylousberg.itch.io/furniture-bits> | `art/compartido/originales/kaykit-furniture-bits/KayKit_Furniture_Bits_1.0_FREE.zip` (3,6 MB) | `art/evidencia/kaykit-furniture-bits.png` |
| Restaurant Bits | <https://kaylousberg.itch.io/restaurant-bits> | `art/compartido/originales/kaykit-restaurant-bits/KayKit_Restaurant_Bits_1.0_FREE.zip` (10 MB) | `art/evidencia/kaykit-restaurant-bits.png` |

- Los `License.txt` dicen «Creative Commons Zero, CC0». La página pide no revender copias sin modificar; no es parte de la licencia, y aquí no se venden.
- Cada modelo trae una textura de degradado de 1024 px: el perfil la baja a 256 (`TEXTURA_PAQUETE`), como permite KayKit.
- **Portería:** puertas `door_A` y `door_B` (salida), casillero `kitchencabinet`, escritorio `cabinet_medium`, silla `chair_A`. De ambiente: alfombra, lámpara de pie, cactus, dos cuadros y libros sobre el escritorio. El intercomunicador vuelve a ser primitiva.
- **Sala 1:** estantes = `cabinet_medium` + `shelf_B_large_decorated`, mostrador = 3 × `kitchencounter_straight_A`, etiquetadora `oven`, caja `crate`, mesa `table_medium_long`. La registradora sigue siendo la de Kenney Mini Shop. De ambiente: dos huacales con verduras, frascos, menú, cactus, lámpara y dos cuadros.
- **Medidas:** portería 2.616 triángulos, 151 KB; sala 1, 8.426 triángulos, 305 KB. Cada modelo, una draw call.

## Acabados por código (T19j)

Con KayKit los muebles ya se veían bien, pero las salas seguían siendo cajas: paredes lisas, luz pareja y nada en el techo. Sin paquetes nuevos, el motor agrega (`src/engine/salas/acabados.ts`) a las salas que tienen `acabados` en `salas.json`:

- **Zócalo pintado** hasta 1,05 m con su franja, rodapié y cornisa. Portería: azul `#35618c` con franja amarilla; sala 1: terracota `#b4573a` con franja crema.
- **Marcos** de madera en las puertas y en los tableros grandes sin modelo (pizarra, corcho, mural).
- **Lámparas de techo** en fila por el centro de la sala, con un halo en el techo y un charco de luz en el piso (textura de 64 × 64 hecha por código, aditiva).
- **Rincones oscurecidos**: franjas de sombra junto a las paredes y en las esquinas, en la misma malla de las sombras de contacto.
- **Viñeta** suave en los bordes de la pantalla (CSS, sin costo en la GPU del juego).

Costo: hasta 3 draw calls más por sala (difusores, brillos y, si no existía, la malla fija) y menos de 2.000 triángulos. La sala 1 cambia la baldosa por parqué (ambientCG WoodFloor071, ya descargado en T11sa: 145 KB). Las salas 2 a 5 los recibirán con su arte.

## Medianoche (T19k)

Alex vio los acabados y pidió más. De las sugerencias revisadas, el primer paquete fue la luz: la historia pasa a las 23:59 con el colegio cerrado, y las salas se veían de día. Sin paquetes nuevos y sin draw calls nuevas:

- **Luz por sala** (`luz` en `salas.json`): las mismas dos luces de siempre (hemisférica y direccional), con otros colores y otra fuerza, y la exposición del tono. Portería: cielo azul grisáceo, luz de luna fría y penumbra. Sala 1: luz cálida, como un refugio. Las salas sin `luz` quedan con la de T19i.
- **Brillo de la imagen**: un ajuste nuevo con tres pasos (más oscuro, normal y más claro) que multiplica la exposición, por si la penumbra no se ve en una pantalla barata o con sol.
- **Paredes con color propio** (`texturas.tinte`): antes el motor ponía la textura en blanco y las dos salas tenían el mismo yeso gris. Portería, crema frío; cooperativa, verde menta. La textura de pared (1.024 × 512) ya no sale estirada a lo alto.
- **Lámparas con estado** (`acabados.lamparas`): en la portería la del fondo titila de vez en cuando, la del medio está apagada y la de la entrada encendida. La que titila nunca llega a negro, baja a lo sumo dos veces en un segundo y se queda quieta con «reducir movimiento».
- **Ventanas de noche** (`acabados.ventanas`): dos ventanas altas en la pared del fondo de cada sala, con cielo degradado, cerros, casitas encendidas y la luna, todo con geometría y colores por vértice (sin textura). El marco va con lo fijo y el cielo con los difusores.
- **Viñeta** con el tono de cada sala: azul noche en la portería, café en la cooperativa.

Pendiente para Alex: verlo en su celular con el brillo de la pantalla a la mitad y decir si quedó muy oscuro. Las puertas siguen turquesa (decisión aparte) y la puerta de salida sigue con los vidrios celestes del modelo.

## Portería y sala 1: cómo quedaron (T19h)

Ya se ven en el juego. Lo que cambió frente a las tablas de abajo, al verlo armado:

- **Intercomunicador:** `speakerSmall.glb` de Furniture Kit. `screen-panel-small.glb` de Factory Kit es un panel de piso de 1 m.
- **Etiquetadora:** `kitchenMicrowave.glb` de Furniture Kit, que tiene el tamaño justo (0,45 × 0,3 × 0,35 m). `machine.glb` de Factory Kit es una máquina de piso de 1,3 m.
- **Palanca y productos:** siguen como primitivas. La palanca de Factory Kit trae una base ancha que no cabe en un palo de 6 cm; los productos son tres piezas que se examinan.
- **Mostrador:** tres tramos de `kitchenBar.glb`, sin el remate. **Estante de bolsas:** `shelf-bags.glb` solo, sin `shelf-end.glb`.
- **Estantes de Mini Shop:** son de isla (dos caras); contra la pared quedan delgados de fondo. De frente no se nota.
- Cada modelo se estira para calzar justo en el `tam` de su objeto (`caja` en `art/modelos.json`): lo que va encima, como la linterna o la registradora, no flota.
- **Medidas:** portería 1.902 triángulos y 8 draw calls de modelos; sala 1, 2.928 y 9. Descarga: 44 KB y 108 KB de modelos, más 284 KB de texturas compartidas.
- **Estilo:** en la sala 1 se nota la diferencia entre Mini Shop (azul y morado, formas gruesas) y Furniture Kit (colores claros). Alex decide antes de las salas 2 a 5.

## Cómo leer las tablas

- **Objeto:** el `id` de `src/content/salas.json` y lo que es.
- **Modelo:** paquete y nombre exacto del archivo dentro del zip.
  - Furniture Kit: `Models/GLTF format/<nombre>.glb`, en camelCase.
  - Mini Shop y Factory Kit: `Models/GLB format/<nombre>.glb`, en minúsculas con guiones, más `Textures/colormap.png`.
  - Los nombres se comprobaron en los zips descargados. Cada zip trae vistas previas por modelo (`Side/` e `Isometric/` en Furniture Kit; `Previews/` en Mini Shop y Factory Kit).
- **Tris:** triángulos del modelo según poly.pizza (paquetes de 2022). «s/d» quiere decir sin dato; ahí va el peso del GLB original como guía.
- **`modelo`:** id propuesto para el campo `modelo` de `salas.json` (T19d). Es el nombre del GLB optimizado en `public/assets/salas/<sala>/`.
- **Primitiva** quiere decir que el objeto sigue como está, creado por código. Pasa en tres casos:
  - Kenney no tiene nada que sirva.
  - Es un plano cuyo contenido se lee en la vista 2D (pizarras, carteles, marcador).
  - Una máquina de `src/engine/mecanismos/` lo anima con su forma actual: tanques, caja fuerte, urna, carritos y balones.

Los objetos con mecanismo que sí reciben modelo deben caber en la caja de `salas.json`, porque la animación se cuelga de esa caja.

## Portería

| Objeto | Modelo | Tris | `modelo` | Nota |
| --- | --- | --- | --- | --- |
| `porteria-salida` · puerta de salida 1,6 × 2,4 | Furniture · `doorwayFront.glb` | 184 | `puerta-salida` | Escalar a 1,6 × 2,4; dos luces encima (mecanismo de la portería) |
| `porteria-puerta-1` a `-5` · puertas 1,1 × 2,2 | Furniture · `doorway.glb` | 216 | `puerta` | Un solo GLB para las cinco; revisar si trae la hoja |
| `porteria-reloj` · reloj de pared | Primitiva | — | — | Kenney no tiene reloj |
| `porteria-mural` · mural de sellos | Primitiva | — | — | Plano con los huecos de los sellos (mecanismo de la portería) |
| `porteria-casillero` · casillero 1 × 1,8 × 0,5 | Furniture · `bookcaseClosedDoors.glb` | 536 | `casillero` | Estante con puertas como casillero |
| `porteria-intercomunicador` · intercomunicador | Factory · `screen-panel-small.glb` | s/d (13 KB) | `intercomunicador` | Panel de pared pequeño |
| `porteria-escritorio` · escritorio 1,2 × 0,75 × 0,6 | Furniture · `desk.glb` | 352 | `escritorio` | — |
| `porteria-silla` · silla | Furniture · `chairDesk.glb` | 656 | `silla` | La primitiva es un grupo; el modelo la reemplaza entera |
| `porteria-linterna` · linterna | Primitiva | — | — | Kenney no tiene linterna; es pequeña y se recoge |
| `porteria-cuaderno` · cuaderno | Primitiva | — | — | `books.glb` es una pila; un cuaderno solo es una caja |

## Sala 1 · La cooperativa

| Objeto | Modelo | Tris | `modelo` | Nota |
| --- | --- | --- | --- | --- |
| `s1-puerta` · puerta | Furniture · `doorway.glb` | 216 | `puerta` | El mismo de la portería |
| `s1-estante-1`, `s1-estante-2` · estantes 0,5 × 1,8 × 1,4 | Mini Shop · `shelf-boxes.glb` | s/d (76 KB) | `estante-cajas` | Ya trae productos |
| `s1-estante-3` · estante 1,6 × 1,8 × 0,5 | Mini Shop · `shelf-bags.glb` + `shelf-end.glb` | s/d (95 + 53 KB) | `estante-bolsas` | El remate cierra la punta |
| `s1-productos` · productos con etiqueta | Mini Shop · `display-cans.glb` | s/d (120 KB) | `productos` | Se examinan: el dato va en la vista 2D |
| `s1-mostrador` · mostrador 2,6 × 1 × 0,7 | Furniture · `kitchenBar.glb` + `kitchenBarEnd.glb` | 152 + s/d | `mostrador` | Tramos unidos con `join` |
| `s1-etiquetadora` · etiquetadora | Factory · `machine.glb` | s/d (25 KB) | `etiquetadora` | Debe caber en 0,45 × 0,3 × 0,35; la etiqueta que sale es del mecanismo |
| `s1-palanca` · palanca | Factory · `lever-single.glb` | s/d (17 KB) | `palanca` | La anima `etiquetadora.ts` |
| `s1-caja-rodillos` · caja de rodillos | Furniture · `cardboardBoxOpen.glb` | 120 | `caja-abierta` | — |
| `s1-registradora` · registradora | Mini Shop · `cash-register.glb` | s/d (31 KB) | `registradora` | El cajón que se abre sigue siendo del mecanismo |
| `s1-pizarra` · pizarra de precios | Primitiva | — | — | Plano; los precios se leen en 2D |
| `s1-corcho` · tablero de corcho | Primitiva | — | — | Plano |
| `s1-mesa` · mesa 1 × 0,75 × 0,7 | Furniture · `table.glb` | 240 | `mesa` | — |

## Sala 2 · El laboratorio

Hecha en T19l, con KayKit Restaurant Bits (todo de un solo paquete) y la medianoche de T19k. Los tanques, perillas, palanca, campana, taza, hoja y graficador siguen como primitivas: su máquina los anima o su texto se lee en 2D.

| Objeto | Modelo | Tris | `modelo` | Nota |
| --- | --- | --- | --- | --- |
| `s2-puerta` · puerta | Restaurant · `door_A` | 188 | `puerta` | La misma de la portería y la sala 1 |
| `s2-panel` · tablero 2 × 0,9 × 0,3 | Restaurant · `kitchencounter_straight_B` | 168 | `tablero` | Mueble bajo blanco con cubierta naranja; perillas y palanca encima |
| `s2-incubadora` · 1 × 1,2 × 0,8 | Restaurant · `fridge_B` | 426 | `incubadora` | Nevera turquesa de una puerta; la campana va encima |
| `s2-gabinete` · 0,6 × 1,8 × 0,8 | Restaurant · `kitchencabinet` × 2 | 312 | `gabinete` | Dos alacenas apiladas, de lado (`giro` 90 en `modelos.json`) |
| `s2-meson-1`, `s2-meson-2` · 2,4 × 0,9 × 0,8 | Restaurant · `kitchentable_A_large` | 236 | `meson` | Un solo GLB instanciado; el mesón 2 creció 40 cm hacia el oeste para compartirlo |
| `s2-poceta` (nuevo) | Restaurant · `kitchentable_sink` | 742 | `poceta` | Mesa de acero con poceta y grifo, en la esquina sureste |
| `s2-repisa-frascos` (nuevo) | Restaurant · `shelf_papertowel` + 3 frascos | 828 | `repisa-frascos` | Encima de la poceta |
| `s2-taburete-1`, `-2` (nuevos) | Restaurant · `chair_stool` | 272 | `taburete` | Junto al mesón 1 |

Objetos nuevos hechos con primitivas (van en la malla fija): computador, tuberías de los tanques al techo, microscopio, gradilla con tubos de ensayo, tabla periódica (solo colores, sin texto) y extintor.

- **Superficies:** baldosa (Tiles040), pañete y techo de oficina, con tinte gris verdoso en el piso y celeste grisáceo en las paredes.
- **Acabados:** zócalo verde petróleo con franja blanca; lámparas apagada (oeste, el rincón de la linterna), encendida (centro) y titilando (este, sobre el mesón 1); dos ventanas de noche en la pared del fondo, con luna en la del oeste.
- **Luz:** noche fría, verde agua, con la direccional entrando desde el pasillo.
- **Medidas:** 8 GLB, 3.172 triángulos, 138 KB. Prueba del cooperativo: 36 de 40.

### Pulido por código (pulir salas, sesión A)

Para que ningún objeto se vea como caja gris, lo que la máquina anima se rehizo por código en el estilo de KayKit (bordes biselados, colores planos), sin cambiar su malla, su id, su pivote ni su caja de choque (`src/engine/mecanismos/laboratorio-piezas.ts`, con las ayudas de `piezas-por-codigo.ts`):

- **Perillas:** base negra con dial de 7 marcas, perilla de color con raya blanca; la morada lleva un candado de latón.
- **Palanca:** rótula, varilla cromada y mango rojo, girando desde su base dentro de una caja con ranura.
- **Campana:** cúpula de latón con botón, sobre una base de madera con un temporizador de cocina.
- **Tanques:** vidrio de 32 lados casi incoloro (el color lo da el líquido), líquido con la superficie más clara, base, collares con tornillos, tapa en domo, varillas a los lados y atrás, y una regla pintada por dentro que se lee a través del vidrio. La bandeja de la incubadora tiene bordes y asa.
- **Lo fijo nuevo** va unido a la malla fija (sin draw calls nuevas): tuberías con bridas, codos y manómetro; la válvula que une los tanques; los pilotos del tablero; el microscopio, la gradilla con tubos de ensayo, el computador con una gráfica en la pantalla y el extintor. Reemplazan a las primitivas `s2-tuberias`, `s2-microscopio`, `s2-gradilla`, `s2-computador` y `s2-extintor`, que salieron de `salas.json`.
- La taza («T. R.», con café y oreja) se viste igual. El graficador y la hoja de ayer son láminas de papel cuadriculado de la sesión C (`lamina` en `salas.json`), solo con título y ejes: los datos siguen en la vista 2D.
- **Medidas:** de 1.640 a 10.954 triángulos por código (más los 3.172 de los GLB), con las mismas 26 mallas.

## Sala 3 · El gimnasio

Hecha en T19m, con KayKit y los conos de Kenney Factory Kit (KayKit no tiene). Gradas, reflector, postes, sensores, cinta métrica, marcador, polea, planilla y balones siguen como primitivas: el reflector y los balones los animan sus máquinas y lo demás se lee en 2D.

| Objeto | Modelo | Tris | `modelo` | Nota |
| --- | --- | --- | --- | --- |
| `s3-puerta` · 1,4 × 2,4 | Restaurant · `door_A` | 188 | `puerta` | GLB propio: es más grande que las puertas de las otras salas |
| `s3-banca` · 3 × 0,45 × 0,5 | Furniture · `table_low` | 276 | `banca` | Mesa baja estirada; la planilla va encima |
| `s3-carro-balones` · 1 × 0,9 × 0,7 | Restaurant · `crate` + `crate_lid` | 296 | `carro-balones` | Cajón con tapa: los balones descansan encima a 0,9 m |
| `s3-sillas` (nuevo) | Furniture · `chair_A_wood` × 3 | 924 | `sillas` | En fila contra la pared oeste |
| `s3-conos` (nuevo) | Factory · `cone` × 3 | 198 | `conos` | Conos de entrenamiento en la esquina noreste |

Objetos nuevos hechos con primitivas (van en la malla fija): tablero y aro de baloncesto, tablas de sentarse en las gradas, cinco vigas en el techo, colchonetas, extintor y la cuerda de la polea.

- **Superficies:** piso de tablas (WoodFloor051, textura nueva `compartido/piso-gimnasio`, 150 KB) y pañete con tinte claro; el techo, sin textura, de color gris azulado.
- **Acabados:** zócalo verde cancha con franja crema; seis lámparas, solo tres dan luz (una titila) para que el coliseo se vea apagado; seis ventanas altas (cuatro al norte, dos al sur), con luna en una.
- **Luz:** luna azul fría desde el suroeste alto; los charcos de las lámparas dan el contraste cálido.
- **Medidas:** 5 GLB, 1.882 triángulos, 93 KB. Prueba del cooperativo: 37 de 40.

### Pulido por código (pulir salas, sesión A)

Igual que en el laboratorio (`src/engine/mecanismos/gimnasio-piezas.ts`): lo que anima una máquina conserva su malla, su id, su pivote y su caja de choque.

- **Reflector:** cuerpo amarillo con aletas oscuras, aro negro y lente claro; gira en su bisagra sobre una base con un cuadrante de muescas (una cada 10°) y su cable a la pared.
- **Riel y postes:** placa con dos rieles, topes amarillos y la marca de cada poste; postes con base de peso, franjas blancas y rojas de medio metro (contadas desde el piso) y tapa amarilla. Miden 1, 2 y 3 m, como el puzzle.
- **Sensores:** tapete negro con bordes verdes, una base por sensor, caja de conexión con piloto; cada sensor que se enciende es un lente sobre un aro.
- **Cinta métrica:** marcas cada 10 cm (más largas cada 50 cm y cada metro) y el carrete al sur. **Polea:** malacate en la pared con tambor de cuerda y manivela roja; el gancho que sube es un gancho con grillete.
- **Balones:** cada uno con su color y sus costuras (baloncesto, voleibol de franjas, gajos y voleibol).
- **Lo fijo nuevo** va unido a la malla fija (sin draw calls nuevas): tablas de madera, narices de aluminio, franja, costados y barandas de las gradas (que pasan a azul); tablero de baloncesto con borde y cuadro, aro con red; guías de la cuerda; cerchas de acero; colchonetas biseladas y extintor. Reemplazan a `s3-tablas-gradas`, `s3-tablero-aro`, `s3-aro`, `s3-cerchas` y `s3-extintor`; `s3-colchonetas` queda como una caja de choque escondida dentro de las colchonetas.
- El marcador y la planilla son láminas de la sesión C. El marcador suma una draw call (ya no va en lo fijo).
- **Medidas:** de 2.410 a unos 15.000 triángulos por código (más los 1.882 de los GLB); 24 mallas más la del marcador.

## Sala 4 · La biblioteca

Hecha en T19n, toda con KayKit (Furniture Bits y Restaurant Bits). El resumen semanal (con sus cuatro focos), los carritos, la pila de libros, la ficha rota y la alfombra no tienen modelo: desde «Pulir las salas» (sesión B) se arman por código, ver abajo.

| Objeto | Modelo | Tris | `modelo` | Nota |
| --- | --- | --- | --- | --- |
| `s4-puerta` | Restaurant · `door_A` | 188 | `puerta` | La misma de las otras salas |
| `s4-estante-1` · 0,5 × 2,2 × 2,5 | Furniture · 2 `cabinet_medium`, 6 repisas `shelf_B`, 8 `book_set` | 4.236 | `estante-a` | Mueble bajo con repisas llenas de libros, de lado contra la pared oeste |
| `s4-estante-m` · 0,5 × 2,2 × 2 | Furniture · `cabinet_medium` + `cabinet_small`, repisas y libros | 3.744 | `estante-m` | Con el hueco del libro M en la fila 2 |
| `s4-libro-m` | Furniture · `book_single` | 68 | `libro` | Sobresale 18 cm de su fila, con el lomo hacia la sala |
| `s4-casilleros` · 4 × 2 × 0,5 | Restaurant · `kitchencabinet` × 6 | 936 | `casilleros` | |
| `s4-mostrador` · 2,4 × 1 × 0,7 | Furniture · `cabinet_medium` × 2 | 856 | `mostrador` | |
| `s4-caja-devoluciones` | Restaurant · `crate` | 132 | `caja-devoluciones` | |
| `s4-pila-libros` | Por código | — | — | 20 libros de colores sobre una tarima (pulir las salas, sesión B): se cuentan los 20 del puzzle |
| `s4-mesa-lectura` · 1,8 × 1,52 × 1,9 | Furniture · `table_medium_long`, 4 sillas, `book_set` y `lamp_table` | 2.140 | `mesa-lectura` | Las sillas quedaron metidas bajo la mesa |
| `s4-estanteria-este` (nuevo) | Como `estante-a`, con otra disposición | 4.236 | `estante-b` | Pared este |
| `s4-rincon-lectura` (nuevo) | Furniture · `armchair`, `table_small`, `book_set`, `lamp_standing` | 1.212 | `rincon-lectura` | Rincón sureste |

Nuevo: una alfombra vinotinto bajo el rincón de lectura (va en la malla fija; desde la sesión B es una pieza por código, ver abajo).

- **Superficies:** parqué (WoodFloor071) con tinte claro, pañete crema y techo de oficina.
- **Acabados:** zócalo verde con franja ocre; la lámpara del oeste titila (alumbra el estante M y el libro), la del centro está encendida (carritos y pila) y la del mostrador, apagada; dos ventanas de noche en la pared norte, con luna en la del este.
- **Luz:** cielo azul de luna y relleno neutro; la direccional entra desde el sureste.
- **Medidas:** 10 GLB, 17.748 triángulos, 0,44 MB. Prueba del cooperativo: 39 de 40. Cada estante se armó con 16 piezas como máximo (el límite de `optimize-models`), solo con las repisas de adelante.

### Pulido por código (sesión B)

Para que ningún objeto se vea como caja gris, lo que anima la máquina de los carritos se rehizo por código en el estilo de KayKit (bordes biselados, colores planos), sin cambiar su id, su caja de choque ni su animación (`src/engine/mecanismos/biblioteca-piezas.ts`, con las ayudas de `piezas-por-codigo.ts` de la sesión A):

- **Carritos de préstamo:** ruedas giratorias, costados y espaldar azules, tres repisas de madera con ceja, manija cromada y portaetiqueta de latón. El espaldar cubre la parte de atrás, así que el toque no atraviesa el carrito.
- **Montones y pila:** columnas de 20 libros de colores (tapas, lomo y hojas), en la misma malla de cada carrito y de la pila, de las que se dibujan solo los que tiene cada lugar (`setDrawRange`): los libros aparecen de a uno y se pueden contar, sin mallas aparte. La pila va sobre una tarima baja que se sigue viendo y tocando cuando queda vacía.
- **Resumen semanal:** lámina `tablero` de la sesión C con la placa «RESUMEN SEMANAL» y los rótulos MEDIA, MEDIANA, MODA y RANGO. Cada foco es un domo de vidrio en su carcasa (placa con tornillos y aro cromado), centrado sobre su rótulo. Las carcasas son una malla hija del tablero: tocarlas es examinar el resumen semanal.
- **Ficha rota y alfombra:** piezas del registro de la sesión C (`src/engine/salas/piezas/biblioteca.ts`): la ficha en dos pedazos con el borde roto, renglones y trazos de letra (lo que dice se lee en 2D); la alfombra con borde, filete dorado, medallón, esquineros y flecos, unida a lo fijo.
- **Medidas:** de 1.156 a 9.244 triángulos por código como mucho (la pila llena y 20 libros en un carrito), más los 17.748 de los GLB. De 34 a 30 mallas dibujadas: los montones ya no son mallas aparte y la carcasa de los focos suma una. El grupo de los carritos, con sus libros, queda bajo los 6.000 triángulos de un objeto que se toca.

## Sala 5 · La rectoría

Hecha en T19o, con KayKit y tres modelos de Kenney Furniture Kit que KayKit no tiene (televisor, computador y matera alta). La urna, los dispensadores, el botón de las parejas, la caja fuerte, la carta y el parlante no tienen modelo: desde «Pulir las salas» (sesión B) se arman por código, ver abajo.

| Objeto | Modelo | Tris | `modelo` | Nota |
| --- | --- | --- | --- | --- |
| `s5-puerta` | Restaurant · `door_A` | 188 | `puerta` | La misma de las otras salas |
| `s5-mesa` · 2 × 0,75 × 1 | Furniture · `table_medium_long` | 168 | `mesa` | Mesa de juntas |
| `s5-simulador` · 0,3 × 0,2 × 0,2 | Kenney Furniture · `televisionVintage` | 280 | `simulador` | El televisor viejo; su caja pasó de 0,25³ a la forma del aparato |
| `s5-escritorio` · 1,4 × 0,75 × 0,7 | Furniture · `cabinet_medium` | 428 | `escritorio` | Cajones hacia la sala |
| `s5-computador` · 0,5 × 0,375 × 0,3 | Kenney Furniture · `computerScreen` + `computerKeyboard` | 104 | `computador` | Pantalla y teclado sobre el escritorio |
| `s5-estante` (nuevo) | Furniture · `cabinet_medium_decorated` + `shelf_B_large_decorated` | 1.500 | `estante` | Aparador con adornos y repisa, contra la pared oeste |
| `s5-silla` (nueva) | Furniture · `chair_C` | 288 | `silla` | Silla del rector, arrimada al escritorio |
| `s5-sofa` (nuevo) | Furniture · `couch` | 636 | `sofa` | Sofá de visitas bajo la ventana del este |
| `s5-planta` (nueva) | Kenney Furniture · `pottedPlant` | 60 | `planta` | Matera alta junto a la ventana grande |
| `s5-diplomas` (nuevos) | Furniture · tres `pictureframe` | 180 | `diplomas` | Sin texto, sobre el escritorio |

Nuevo: el parlante de La Voz, alto en la esquina noreste (va en la malla fija; desde la sesión B es una pieza por código).

- **Superficies:** parqué (WoodFloor071, `compartido/piso-madera`) con tinte nogal, pañete color pergamino y techo de oficina.
- **Acabados:** zócalo verde salvia con franja dorada; la lámpara del oeste encendida (sobre la urna) y la del este titilando; una ventana grande en la pared norte, con la luna, y otra en la pared este, sobre el sofá.
- **Luz:** penumbra cálida de oficina con luz de luna fría desde el sureste.
- **Medidas:** 10 GLB, 3.832 triángulos, 145 KB. Prueba del cooperativo: 38 de 40.

### Pulido por código (sesión B)

Lo que anima la máquina de la urna se rehizo por código en el estilo de KayKit, sin cambiar su id, su caja de choque ni su animación (`src/engine/mecanismos/rectoria-piezas.ts`, con las ayudas de `piezas-por-codigo.ts` de la sesión A):

- **Urna:** vidrio de doble pared, abierto arriba para que entre la mano, sobre una base oscura con aro de latón, cuatro varillas y una placa. La base y la **manija** roja (que se jala cuando baja la mano y vuelve sola) son mallas hijas de la urna: tocarlas es tocar la urna y se resaltan con ella.
- **Mano mecánica:** brazo telescópico que sale de una carcasa en el techo (en la misma malla de la base de la urna) y pinza de dos mandíbulas, que ahora baja hasta justo encima de las fichas; las dos que saca se ven entre ellas.
- **Fichas:** azules redondas con el canto biselado y el centro hundido; amarillas cuadradas con bisel y un cuadro en relieve, como en el panel 2D.
- **Caja fuerte:** cuerpo hueco con forro oscuro y una repisa; la puerta lleva panel, bisagras, dial con 12 marcas, manija de tres rayos, cerradura y placa de latón. Al abrirse se ve la llave de pie sobre la repisa. La perilla va en la misma malla de la puerta y el fondo plano sobra: dos mallas menos.
- **Dispensadores, botón «ver parejas» y parlante:** piezas del registro de la sesión C (`src/engine/salas/piezas/rectoria.ts`): dos dispensadores de monedero con su columna de fichas a la vista, un botón de hongo rojo con aro cromado y un parlante con rejilla, woofer, tweeter y piloto verde. La **carta** es una lámina de papel con el membrete «I. E. Los Almendros» (lo que dice se lee en 2D).
- **Medidas:** de 1.538 a 7.784 triángulos por código, más los 3.832 de los GLB. Las geometrías van con índice y la malla fija no cambia: con el WebGL por software de las pruebas, una versión de 13.500 triángulos sin índice hacía fallar por tiempo la e2e de la caja fuerte en escritorio. De 35 a 34 mallas dibujadas: la base y la manija de la urna suman dos, y la perilla y el fondo de la caja fuerte, que ya no son mallas aparte, restan dos; los dispensadores pasan de dos mallas a una.

## Texturas de piso, paredes y techo

Solo se usa el mapa de color de cada zip, por ejemplo `Tiles040_1K-JPG_Color.jpg`. ambientCG avisó en octubre de 2025 que reempaquetaría sus assets y que a veces cambiaría los nombres de archivo, así que hay que confirmar el nombre al abrir el zip. Los ids siguen el formato de la sesión A (T19g): `<carpeta>/<nombre>`. Cada una se publica como `public/assets/salas/compartido/<nombre>.<hash>.ktx2`, con su entrada en `art/credits.json` (`sala: "compartido"`, `fuente: "ambientcg"`), y en `salas.json` se pide así: `"texturas": { "piso": "compartido/piso-baldosa", "paredes": "compartido/paredes", "techo": "compartido/techo", "metros": 2 }`.

Así quedaron con el arte de las seis salas (T19h a T19o); el tinte de cada sala está en su `texturas.tinte`:

| Uso | Textura | Id | Salas |
| --- | --- | --- | --- |
| Piso de baldosa | Tiles040 (terrazo blanco) | `compartido/piso-baldosa` | Portería y laboratorio |
| Piso de parqué | WoodFloor071 (parqué claro) | `compartido/piso-madera` | Cooperativa, biblioteca y rectoría |
| Piso del gimnasio | WoodFloor051 (tablas claras) | `compartido/piso-gimnasio` | Gimnasio |
| Paredes | PaintedPlaster017 (pañete pintado blanco) | `compartido/paredes` | Todas; el color de cada sala se da con el tinte del material |
| Techo | OfficeCeiling001 (cielo raso de oficina) | `compartido/techo` | Todas menos el gimnasio, que tiene 9 m de alto (ahí basta un color) |

Las escogí por sus etiquetas y sus fichas; ya están bajadas y sus capturas muestran la esfera de muestra de cada una. Alternativas, si alguna no convence en la sala:

| Para | Alternativas |
| --- | --- |
| Baldosa | Tiles043 |
| Gimnasio | WoodFloor068 |
| Biblioteca | Carpet012 (alfombra azul) o Carpet016 (beige) |
| Paredes | Plaster001 |
| Techo | OfficeCeiling002 a 006 |

## Presupuesto estimado por sala

El límite por sala es de 2 MB descargados y 90.000 triángulos, y además 40 draw calls por cuadro. Las cifras salen de la tabla de arriba:

- **Triángulos:** donde no hay dato se estimaron unos 1.500 por cada 50 KB de GLB.
- **Peso:** los GLB de Kenney bajan a menos de la mitad con meshopt.
- **Texturas:** cada textura de ambientCG queda en unos 150–250 KB como KTX2 ETC1S de 1024 px. Se cuentan en cada sala, aunque la caché del service worker las baja una sola vez.

| Sala | Modelos | Triángulos (estimados) | Descarga (estimada) | ¿Cabe? |
| --- | --- | --- | --- | --- |
| Portería | 6 GLB | ~3.000 | ~0,1 MB de modelos + ~0,6 MB de texturas | Sí |
| Cooperativa | 9 GLB | ~12.000 | ~0,3 MB + ~0,6 MB | Sí |
| Laboratorio (medido, T19l) | 8 GLB | 3.172 | 0,14 MB + texturas compartidas | Sí |
| Gimnasio (medido, T19m) | 5 GLB | 1.882 | 0,09 MB + piso nuevo de 0,15 MB | Sí |
| Biblioteca (medido, T19n) | 10 GLB | 17.748 | 0,44 MB + texturas compartidas | Sí |
| Rectoría (medido, T19o) | 10 GLB | 3.832 | 0,15 MB + texturas compartidas | Sí |

Ninguna sala pasa de 1 MB; la biblioteca es la de más triángulos (unos 17.700), lejos del límite de 90.000. Lo que sí puede pasarse son las **draw calls**:

- Los modelos del Furniture Kit traen un material por color, de 2 a 5 cada uno. En una sala con 10 modelos son 20 a 50 llamadas, más las paredes y los mecanismos.
- Por eso el perfil `kenney` aplica `join`, `instance` y `palette` antes de la etapa común. `check-budget` lo comprueba con los archivos reales.

Estas cifras se miden de verdad cuando los paquetes estén en `art/` y pasen por `optimize-models` (T06, T11a, T11b).

## Lo que falta para usarlos

1. Alex baja los paquetes y las capturas (T11s).
2. `optimize-models` con los perfiles `kenney` y `ambientcg` (T06, T11a, T11b y T11e).
3. Se llena `art/credits.json`, uno por GLB publicado.
4. Se pone `modelo` en cada objeto de `salas.json`.
5. El motor carga los modelos (T19e, sesión A).
