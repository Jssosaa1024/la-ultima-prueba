# Historia · sesión C · El caso de Don Efraín en el archivo

27 de noviembre de 2026. Parte de `docs/historia.md` (PR #192 y #193 de la sesión B, ya en `main`). La sesión B escribió los textos; esta sesión les da la forma del archivo: la carátula de la intro, el acta de cada final, los créditos como el expediente de 1991 y las fichas de evidencia del cuaderno. Los puzzles y los textos de la historia no cambian.

## Cómo encaja con las escenas de la sesión A

La sesión A hace las escenas de la intro y de los finales en Three.js (rama `historia-a-escenas`, con su propio PR). Lo acordamos así para que los dos PR no dependan uno del otro:

| Momento | Sesión A (escena) | Sesión C (pantalla «archivo») |
| --- | --- | --- |
| Antes de jugar | — | El menú es la carátula del expediente 1991-14. |
| Al tocar «Jugar solo» | La escena de la intro arranca sola, cada vez (decisión de Alex). Las e2e la apagan con `lup:sin-escenas`. | Nada en medio: «Jugar solo» sigue arrancando la partida como antes. |
| Al llegar a un final | La escena del final (no hay escena para «Pedir ayuda»). | Después de la escena: el acta de la noche, los créditos y la escena de la fotocopiadora. |

- No se agregó una pantalla extra entre «Jugar solo» y la escena: serían dos pantallas seguidas antes de jugar, y unas 20 pruebas e2e esperan que «Jugar solo» arranque directo.
- **Pendiente, de una línea:** hoy el acta del final hace que La Voz diga la línea del final. Si la escena de A ya la dijo, sonaría dos veces. Quien llegue segundo a `main` pone en `PantallaFinal.tsx` la condición «no decirla si `escenaTerminada.value?.id === final.value`» (el signal es de A). La voz se queda para cuando no hubo escena: «Pedir ayuda» o si la escena no cargó.

## 1 · La intro: el menú es la carátula del caso

- Antetítulo «Expediente 1991-14», la pestaña de la ficha dice «Caso: copia de proyecto» y el sello «Por revisar».
- El texto cuenta por qué estás ahí, sin nombres: «Mañana es tu feria de ciencias y tu memoria USB se quedó en el colegio. Entras por ella a las 23:59 y la puerta se cierra. La Voz te pide revisar un caso de 1991 antes de que se borre». Reemplaza al de antes («supera cinco salas y recupera la salida»), que ya no seguía la historia.
- Cabe sin desplazarse en el celular en horizontal (740 × 360): el texto quedó más corto que el anterior.

## 2 · Los finales: el acta de la noche

- La ficha del final es el «Expediente 1991-14 · Acta de la noche», con la hora de cierre: las 23:59 más el tiempo usado (con el tiempo cumplido, las 00:40).
- **«El legado»** muestra la foto de la feria de 1991 con el cartel escrito a mano «Efraín Cárdenas, 10-B». **«Justo a tiempo» y «Tiempo cumplido»** muestran la misma foto vieja, la que guarda Don Efraín, con el cartel borrado por los años y sin el nombre. **«Pedir ayuda»** no tiene foto: es la salida amable, sin giro.
- La foto es un dibujo SVG propio en sepia (`src/ui/tema/FotoFeria.tsx`): el puesto, el filtro que gotea, el poste de la canasta y su sombra larga. Sin imágenes ni assets que acreditar. El nombre del cartel se escribe encima en HTML, para que mida 14 px o más.
- El resumen de aprendizaje, el sello del final y los botones siguen igual.

## 3 · Créditos: el expediente 1991-14, con el logo de Sinapsis

- Es una carpeta de cartón con dos hojas. La primera es la carátula: «I. E. Los Almendros · Archivo de rectoría», el título, la apertura del caso y el sello «Reabierto» (azul, con «El legado») o «Cerrado» (rojo, con los demás).
- **Folios del expediente:** las cinco pruebas, cada una con su estado: «Revisado · en el pendrive» (El legado), «Revisado · se borró a las 00:40» o «Sin revisar».
- **Personas del caso:** Efraín Cárdenas, Tobías Rincón, el jurado y tú (los textos de la sesión B).
- La segunda hoja es el cierre: el agradecimiento a Don Efraín, la nota de que los personajes son ficticios y el membrete «Un proyecto de» con el logo de Sinapsis, centrado y más grande que antes (72 px de alto).

## 4 · Las fichas de evidencia en el cuaderno

En «Expediente 1991», cada prueba se ve como su documento. El texto es el mismo de `src/content/expediente.json`; solo cambia el papel:

| Sala | Prueba | Cómo se ve |
| --- | --- | --- |
| 1 | El recibo | Papel de caja registradora, angosto, a máquina y con el borde de abajo arrancado. |
| 2 | La bitácora | Hoja cuadriculada, con la gráfica de las dos rectas (la de E. C. continua y la del otro colegio punteada) y el único punto donde se cruzan: «Se cruzan una sola vez, en el minuto 15». |
| 3 | La foto de la feria | La foto (sin el nombre en el cartel) y, debajo, su respaldo con las medidas. |
| 4 | Las fichas de préstamo | Cartulina de biblioteca con renglones y margen rojo. |
| 5 | El acta | Hoja oficial con doble raya de membrete y el rótulo «Acta · Rectoría · 1991». |

- Cada prueba trae el sello «No se sostiene» junto a lo que dijo el jurado.
- Una prueba que todavía no llega es un folio vacío con borde punteado.
- La gráfica sale de la tabla de la bitácora (`src/ui/cuaderno/bitacora.ts`): si cambian los datos, cambia el dibujo.

## Capturas

En `docs/capturas/historia-c/`, tomadas con perfil de celular en horizontal (Pixel 5, 740 × 360). Los finales y los créditos están a página completa. `final-tiempo-cumplido` es de antes de borrar el cartel de la foto vieja, y `cuaderno-bitacora`, de antes de pasar la última frase del pie a su propio renglón.

- `menu-caratula.webp`: la intro en el menú.
- `final-legado.webp` y `final-tiempo-cumplido.webp`: el acta de la noche.
- `creditos-legado.webp` y `creditos-tiempo-cumplido.webp`: el expediente reabierto y cerrado.
- `cuaderno-recibo`, `cuaderno-bitacora`, `cuaderno-foto`, `cuaderno-fichas` y `cuaderno-acta`: las cinco fichas.

## Pruebas

- Nuevas de unidad (`tests/unit/historia-archivo.test.ts`): la hora de cierre del acta; que solo «El legado» muestre el nombre en la foto; que «Pedir ayuda» no tenga foto; el estado de los folios; y que la bitácora dé dos rectas con un solo cruce, en el minuto 15.
- E2E ampliadas: `finales.spec.ts` revisa la hora de cierre, la foto con y sin nombre y los cinco folios en el pendrive; `cuaderno.spec.ts` revisa la gráfica de la bitácora.
- Verificación en local, en verde: `format:check`, `lint`, `astro check` (0 errores), las 1.283 pruebas de unidad, `check-credits`, `check-budget` y `check-audio`.
- E2E en celular y escritorio, contra el sitio construido: `finales`, `cuaderno`, `menu`, `accesibilidad`, `humo`, `portada` y `ajustes`. La primera corrida encontró una falla real, ya corregida: en los créditos, «Expediente 1991-14» ahora sale en la pestaña y en el título, y la prueba lo busca por el título.

## Lo que necesita a Alex

- Mirar en la vista previa del celular el menú, un final y los créditos. Los pasos están en el PR.
- Nada de Blender, assets ni cuentas: la foto es un dibujo propio.
- En el equipo quedó una carpeta vacía `C:\c\Users\…\scratchpad\capturas` que una captura creó por error (una ruta mal escrita). No tiene nada; Alex puede borrar `C:\c` a mano. La regla de seguridad no me deja borrar carpetas en la raíz del disco.
