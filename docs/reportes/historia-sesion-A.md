# Historia · sesión A · Voz y escenas del caso de Don Efraín

27 de noviembre de 2026. Parte de `main` con la historia ya fusionada ([#192](https://github.com/Jssosaa1024/la-ultima-prueba/pull/192) y [#193](https://github.com/Jssosaa1024/la-ultima-prueba/pull/193)). Rama `historia-a-escenas`.

## 1 · La Voz grabada

- `npm run voz` con el plan de pago grabó las **26 líneas de `POR_GRABAR`** (las que la sesión B cambió o agregó) y las **4 nuevas de la intro** (`voz-intro-caso-1` a `-4`, el texto exacto de `docs/escenas.md`). Total: 2.223 caracteres de ElevenLabs, contando las tres tomas de más de `voz-pasillo-11a`.
- `optimize-audio` las dejó a −16 LUFS; cada una tiene su crédito en `art/credits.json` (`check-credits` y `check-audio` en verde). `POR_GRABAR` queda vacía.
- `voz-pasillo-11a` («Él nunca llegó a este salón.», 2 s) quedaba a −17,3 LUFS: el pico de «Él» no dejaba subirla. Dos tomas más con el multilingüe tampoco llegaron; la cuarta, con `eleven_v3` en voz baja (`[softly]`), quedó a −16,0. El ajuste está en `art/audio/voz/voz.json` («lineas»).
- **Presupuesto de audio de la portería: 0,59 de 0,60 MB.** Cumple, pero queda casi sin margen. La portería guarda la intro, los pasillos y las líneas de los finales. Si se agregan más líneas allí, habrá que mover las de los finales a otra carpeta o bajar los kbps.

## 2 · Escenas dentro del juego

La intro y los tres finales con giro se ven **dentro del juego**, siguiendo el guion de cámara de `docs/escenas.md`, en lugar de videos:

| Escena | Dura | Qué se ve |
| --- | --- | --- |
| Intro | 43 s | Negro con el colegio y la hora → el cartel de la feria y la portería → la foto de 1991 → las dos hojas de datos con el mismo número encerrado → el acta con el sello «Sancionado» → la pantalla con `ULTIMA_PRUEBA` → la puerta que se cierra detrás y la cámara que vuelve a donde empieza la partida. |
| El legado | 27,5 s | La copia al pendrive → la puerta se abre y aparece Don Efraín a contraluz → la foto con «Efraín Cárdenas, 10-B» y La Voz → se quita la gorra: «Ese era yo» → se hace a un lado: «Mañana llegue temprano a su feria. Yo le abro». |
| Justo a tiempo | 25,5 s | El casillero con la USB → Don Efraín abre: «Suerte mañana en su feria» → la foto vieja en su mano → el reloj llega a 00:40, La Voz, y la pantalla se apaga → él, solo, frente a la pantalla oscura. |
| Tiempo cumplido | 26 s | El reloj de 00:39:58 a 00:40 → «Migración completa: 0 archivos» y La Voz → las cerraduras ceden → Don Efraín mira la pantalla oscura → guarda la foto en el bolsillo. |

- **No cargan nada pesado.** La portería ya está en la GPU. Don Efraín (silueta con gorra), un monitor sobre el casillero (la «pantalla de la portería» del guion; fuera de las escenas no está) y la luz de la puerta abierta son primitivas por código: 8 draw calls más y menos de 1.500 triángulos, que se liberan al terminar. Las fotos y documentos de 1991 son tarjetas 2D con texto real y SVG, sin imágenes.
- **Diferencias con el guion de cámara:** la portería no tiene exterior ni puerta de entrada visible, así que la intro empieza en negro y sigue adentro (el cartel de la feria es una tarjeta) y la puerta automática solo se oye. En «Justo a tiempo», el plano «desde la calle» se ve desde adentro, mirando el reloj y la pantalla.
- **Se saltan con un toque:** botón «Saltar» de 48 px, arriba a la derecha y con el foco, o Escape.
- **Movimiento reducido:** con `prefers-reduced-motion`, la cámara no se desplaza (un corte seco por plano), las fotos no se acercan y no hay fundidos.
- **Voz y subtítulos:** La Voz suena con el mismo sistema de los subtítulos del juego; el subtítulo sigue al audio aunque cambie el plano. Don Efraín habla solo con subtítulo («Don Efraín: …»).
- **Cuándo salen:** **siempre** (Alex lo decidió al revisar el PR). La intro sale al tocar «Jugar solo» en cada partida nueva (no al continuar una guardada); mientras se ve, el reloj de 40 minutos no corre. Al terminar, La Voz dice «Buenas noches…» como antes. Los finales salen antes de su pantalla. «También vale pedir ayuda» no tiene escena.
- **Las pruebas e2e las apagan** con `lup:sin-escenas` = `1` en `localStorage` (en `playwright.config.ts`), igual que usan `?sala=` o `?debug=1`: si no, cada prueba tendría que saltar la intro. Solo vale el `1` exacto.
- **Cooperativo:** cada jugador ve la escena del final en su pantalla. La intro no sale en grupo (haría falta esperar a todos por la red).
- **El giro se respeta:** la intro dice «E. C., 10-B» y nunca muestra a Don Efraín; el nombre completo solo sale en «El legado». Una prueba de unidad lo vigila.

Archivos: `src/content/escenas.ts` (los planos), `src/signals/escena.ts`, `src/engine/escenas/director.ts`, `src/ui/escenas/` (capa, tarjetas y estilos). Cambios mínimos en archivos compartidos: `src/ui/Partida.tsx` (muestra la escena), `src/engine/motor.ts` (dibuja con la cámara de la escena y el bucle sigue detrás de un final), `src/signals/controlador.ts` (la intro y el reloj detenido), `src/signals/interfaz.ts` (sin controles durante la escena) y `playwright.config.ts` (las e2e apagan las escenas).

## Coordinación con la sesión C

La sesión C rediseña la pantalla de final, los créditos y el menú (la carátula del expediente). Acordamos:

- Esta rama crea `src/signals/escena.ts`; C no lo importa, para que los PR no dependan uno del otro.
- `PantallaFinal` se ve cuando `escena.value === null`; esa condición está en `Partida.tsx` (esta rama). C no toca `Partida.tsx` ni `playwright.config.ts`.
- **Pendiente para quien llegue segundo a `main`:** `PantallaFinal` vuelve a decir la línea de La Voz del final al montarse, y la escena ya la dijo. La corrección es una línea: no decirla si `escenaTerminada.value?.id === final.value`.
- **Pendiente, cuando los dos estén en `main`:** C dibujó la foto de la feria como componente (`FotoFeria`, del PR [#194](https://github.com/Jssosaa1024/la-ultima-prueba/pull/194)). Las escenas tienen la suya en `src/ui/escenas/Tarjetas.tsx`; conviene que usen la de C para que sea la misma foto en todo el juego.

## Capturas

Celular en horizontal (Pixel 5), en `docs/capturas/historia-A/`: el cartel de la feria (1), las hojas de datos (2), el acta (3), Don Efraín a contraluz en «El legado» (4), la foto con su nombre (5) y Don Efraín mirando la pantalla apagada en «Tiempo cumplido» (6). Las capturas sirvieron para corregir cuatro cosas antes del PR: el letrero de la foto no se leía, la foto vieja salía aplastada, la intro giraba hacia una pared sin puerta y la pantalla tapaba una ventana.

## Pruebas

- `format:check`, `lint`, las 1.295 pruebas de unidad, `check-credits`, `check-audio`, `check-budget` y `astro build`: en verde.
- Pruebas de unidad nuevas en `tests/unit/escenas.test.ts` (19): duración de cada escena, que cada línea de La Voz esté grabada y le alcance el plano para sonar entera (lee la duración del `.m4a`), que los sonidos existan, que la intro no diga quién es el estudiante, el reloj de los planos, el movimiento reducido, la clave con que las pruebas apagan las escenas (solo el «1» exacto) y la intro en cada partida (reloj quieto, sin controles, La Voz después). `guion.test.ts` cuenta las 4 líneas nuevas y las compara con `docs/escenas.md`.
- E2E nueva `tests/e2e/escenas.spec.ts`: la intro se ve y se salta, avanza hasta la foto con La Voz, movimiento reducido con Escape (solo en escritorio) y la escena de «Tiempo cumplido» antes de su pantalla.
- E2E en celular y escritorio, con un solo navegador: `escenas`, `finales`, `csp`, `partida`, `subtitulos` y `accesibilidad` (68 pasan; la de Escape no aplica en celular) y antes `menu`, `audio`, `porteria`, `grabaciones` y `pasillo-puertas`. La primera corrida encontró dos fallos de verdad, ya corregidos: el manifiesto quedó viejo tras regenerar `voz-pasillo-11a`, y la prueba de la pestaña privada no esperaba la intro (sin almacenamiento sale cada vez).
- No corrí la suite e2e completa (más de 30 minutos en este equipo con otras sesiones): solo los archivos que tocan el arranque, los finales, la voz y la CSP.

## Lo que necesita a Alex

- Ver las escenas en el celular de verdad (pasos en el PR).
- Las frases de Don Efraín van sin voz; si las quiere con voz, hace falta otra voz en ElevenLabs.
- Medir con `?debug=1` en el Android de referencia durante una escena (las escenas usan la misma portería; lo nuevo son 7 draw calls).
