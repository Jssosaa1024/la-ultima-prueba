# Pasillos · sesión C

Decisión de Alex (21 de noviembre de 2026): las salas se conectan por un pasillo con puertas falsas. La sesión B hizo el plano, los datos, el motor y los textos (T77a a T77c, `docs/pasillos.md`). La sesión C hizo lo que pasa al tocar una puerta falsa, el diseño de los carteles y el sello en el cartel de cada sala resuelta (T77e a T77g), en un solo PR.

## Resultado

| Tarea | Qué hace | Costo |
| --- | --- | --- |
| T77e · Puertas falsas | Al tocarla traquetea el picaporte y sale su frase en una tirita de papel del archivo, con el rótulo de la puerta. Si es de La Voz, la dice la primera vez; después sale escrita | Nada en la escena; nada por la red |
| T77f · Carteles y flechas | Las flechas 2 y 3 se dibujan como figura (campo `flecha` de la lámina); el título de un cartel sin renglones llena el cartel | Igual que antes: una draw call por cartel |
| T77g · Sello en el cartel | El cartel de una sala con sello lo lleva estampado, con la figura y el color de su pieza en el mural | Ninguna malla ni draw call nueva: se repinta el mismo lienzo |

## Cómo se hizo

- **El toque** (`src/signals/puertas-falsas.ts`). La partida sola (`controlador.ts`) y la cooperativa (`juego-coop.ts`) llaman a la misma función cuando el objeto tiene `falsa`. Deja un aviso nuevo, `{ t: 'puerta_falsa', frase, hablada }`, que lleva el id de la frase y nunca su texto. En cooperativo no se envía nada por la red ni se abre voto: cada jugador oye su propia puerta (una prueba de unidad cuenta que no salen intenciones).
- **La Voz.** Las frases con `voz` (profesores, 10-A, 11-B y aseo) suenan la primera vez en la partida, con su subtítulo, y el aviso no repite el texto (`hablada: true`). Las veces siguientes la frase sale escrita, sin voz. Si la cola de La Voz está llena o la línea no existe, sale escrita.
- **El aviso** (`ui/hud/Hud.tsx`, `hud.css`). Mismo lugar que el aviso de puerta cerrada: abajo, sobre la fila de botones, sin tapar el centro y sin recibir toques. Papel, grano, tinta y letra de `ui/tema.css`, un poco torcido, con el rótulo a máquina delante de la frase en un solo renglón. Se va solo en 3,5 a 6 s según el largo (`duracionDeAviso`). Con «reducir movimiento» no se anima la entrada.
- **Lector de pantalla** (`Anunciador.tsx`). Oye «Sala de profesores: …», con el rótulo delante, porque quien no ve no sabe qué puerta tocó. Si La Voz la está diciendo, ya la anuncian los subtítulos y el anunciador no la repite.
- **Sonido** (`engine/audio/momentos.ts`). Se reutiliza `efecto-puerta-cerrada`, el picaporte que traquetea tres veces y no gira, grabado en T42c. **No hace falta un efecto nuevo de la sesión A.**
- **Flechas** (`laminas.ts`). La flecha es una figura y no el signo «←»: el subconjunto latino de Atkinson Hyperlegible que publicamos no lo trae, y el navegador lo dibujaría con otra letra. El esquema solo la deja en un cartel.
- **Sello** (`laminas.ts` y `engine/mecanismos/carteles-pasillo.ts`). `marcarLamina(textura, { sello: n })` vuelve a pintar el lienzo del cartel y lo sube otra vez a la GPU. Un disco de papel con doble anillo verde gastado y la figura del sello (moneda, gota, balón, libro o llave) a la derecha; el texto se corre a la izquierda. Se repinta solo cuando cambian los sellos: al ganar uno, al continuar una partida y al empezar otra (que lo quita).

## Capturas

En `docs/capturas/pasillos-c/`, sacadas por la e2e nueva (`tests/e2e/pasillo-puertas.spec.ts`, Pixel 5 en horizontal, con las salas 1 y 2 resueltas):

- `aviso-puerta-falsa.jpg`: la frase escrita de la sala de profesores, la segunda vez que se toca.
- `cartel-sala-1-con-sello.jpg`: el cartel de la sala 1 con su moneda.
- `tramo-1-hacia-el-norte.jpg`: el fondo del tramo 1, con la flecha 2.

## Pruebas

- `format:check`, `lint`, `astro check`, `test` (1.199 en verde) y `check-budget`, con el candado C y prioridad baja.
- Pruebas de unidad nuevas: `tests/unit/puertas-falsas-toque.test.ts` (frase escrita, frase de La Voz una sola vez, línea que no existe, frase que no existe, duración), `tests/unit/carteles-pasillo.test.ts` (flecha, sello por sala, marcas, portería armada sin mallas nuevas) y casos en `controlador.test.ts`, `coop-juego.test.ts` y `audio-momentos.test.ts`. `pasillo.test.ts` (de B) cambió solo en los títulos de las flechas, como acordamos.
- Las capturas sirvieron para corregir tres cosas antes del PR: el aviso subía un poco por encima del centro en un celular horizontal (ahora va en un renglón), el título de la flecha quedaba diminuto al lado de la figura (ahora la flecha es más baja y el título llena el cartel) y el sello tapaba el final de «COOPERATIVA» (ahora el texto termina antes del sello, y una prueba lo revisa).
- e2e: la nueva del pasillo, más portería, partida, HUD, accesibilidad, audio y votos del cooperativo, en celular y escritorio. Después de rebasar sobre `main`, otra vez la del pasillo y `coop-pasillo.spec.ts` de la sesión B (dos jugadores por el pasillo): en verde. Una falló una vez por tiempo («la puerta 2 sigue cerrada», escritorio) y pasó al repetirla sola, en los dos perfiles.

## Lo que queda para Alex

1. **Celular de referencia:** caminar el pasillo con `?debug=1` y tocar dos o tres puertas falsas. Revisar que la frase se lea bien y que no tape lo que se está mirando.
2. **Las cuatro frases de La Voz** (`voz-pasillo-*`) todavía no tienen audio: hasta que la sesión A las grabe con `npm run voz`, salen solo con su subtítulo.
3. **Si el picaporte suena demasiado igual** a una puerta de sala cerrada, se puede pedir a la sesión A un efecto propio de puerta falsa; hoy no hace falta.

## Incidentes

- Un `git add -p` se quedó esperando respuesta en un comando mío; lo detuve sin que se agregara nada y repetí el commit con rutas explícitas.
- La sesión B tenía el candado de pruebas cuando quise abrir el juego: esperé a que lo soltara.
