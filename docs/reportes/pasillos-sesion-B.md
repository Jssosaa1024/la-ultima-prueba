# Pasillos · reporte de la sesión B

21 de noviembre de 2026. Encargo de Alex: las salas dejan de abrirse desde la portería; de ella sale un pasillo en U con las cinco puertas reales entre puertas falsas (aulas, baños, sala de profesores, cuarto del aseo), con frases cortas y algunas de La Voz. La sesión B hizo el plano, los datos, el motor, los textos y las e2e; la sesión C, el toque de las puertas falsas y el dibujo de los carteles (T77e a T77g); la sesión A, los personajes del cooperativo.

## PR de esta sesión

| PR | Tarea | Qué trae |
| --- | --- | --- |
| [#169](https://github.com/Jssosaa1024/la-ultima-prueba/pull/169) | T77a · Plano | `docs/pasillos.md`, diseño y especificación |
| [#170](https://github.com/Jssosaa1024/la-ultima-prueba/pull/170) | T77b · Datos y motor | La U en `salas.json` (`tramos`), las 12 puertas, carteles y flechas; paredes, colisiones, lámparas y la vista por celdas en el motor; frases de las puertas falsas |
| [#171](https://github.com/Jssosaa1024/la-ultima-prueba/pull/171) | T77c · La Voz | Cuatro frases pasan a La Voz (`voz-pasillo-*`, momento `puerta_falsa`) |
| este | T77d · E2e y reporte | `coop-pasillo.spec.ts` y este reporte |

## Decisiones

- **El pasillo es parte de la portería.** Para la partida, el guardado y el cooperativo sigue habiendo un solo lugar, `porteria`. No cambian `game/partida.ts`, el guardado ni el protocolo: una partida guardada antes del pasillo carga igual (hay una prueba), y las poses de los compañeros sirven sin cambios.
- **El plano cambió al armarlo.** La primera versión (PR #169) abría el pasillo en todo su ancho y seguía derecho. Medido, desde la portería se veía el pasillo entero y la peor mirada daba 45 draw calls (límite 40). La versión final entra por un vano de 1,6 m y gira al norte: desde la portería solo se ven los casilleros. Una prueba revisa que desde la portería no se vea ninguna puerta del pasillo.
- **Dibujar solo lo que se ve.** Three.js no dibuja lo que queda fuera del encuadre, pero sí lo que está detrás de una pared. El motor parte el piso en celdas de 2 m, calcula una vez qué objetos se ven desde cada celda (las paredes van del piso al techo, así que basta la planta) y, al cambiar de celda, saca de la capa de la cámara lo que no se ve. Cuesta unos 25 ms al entrar a la portería, una sola vez.
- **Sin paquetes nuevos.** Puertas, casilleros y matas son los modelos KayKit que ya estaban en `salas/porteria/`. Descarga nueva: 0 KB.

## Medidas

| | Portería antes | Portería con su pasillo |
| --- | --- | --- |
| Draw calls con `?debug=1` (vistas de `docs/capturas/pasillos-B/`) | 22 a 24 | 12 a 23 |
| Peor mirada calculada (pruebas de unidad, con las 5 piezas del mural y sin instanciar) | 33 | 34 (+5 del cooperativo con 4 jugadores = 39 de 40) |
| Triángulos con `?debug=1` | 5.000 a 5.700 | 4.500 a 8.000 |
| Texturas en GPU | 3,9 MB | 7,7 MB (los quince carteles) |
| Carga de la portería (PC, sitio construido) | — | 0,5 a 0,9 s |
| De punta a punta del pasillo | — | unos 17 s con el joystick a fondo |

Las medidas son en PC con WebGL por software. Falta medir en el celular de referencia.

## Pruebas

- Unidad: 1.184 en verde. Nuevas en `tests/unit/pasillo.test.ts`: planta con tramos, puertas contra su pared, carteles, frases y La Voz, caminar por la U sin atravesar paredes, el tiempo de punta a punta, lámparas, lo que se ve desde la portería, la vista por celdas y la partida guardada vieja. Las pruebas que usaban la portería como sala rectangular la toman sin su pasillo (`sinPasillo`), y las de draw calls cuentan la peor mirada (`llamadasPorCuadro`).
- E2e: las ayudas de `tests/e2e/recorrido.ts` caminan por las esquinas del pasillo, así que la partida completa individual (`partida-completa.spec.ts`, tres finales) pasa por él. Nueva `coop-pasillo.spec.ts`: dos pestañas recorren el pasillo, entran por votación a las salas 1 y 2, las resuelven (D propone, el otro acepta), vuelven al pasillo frente a cada puerta y llegan a la puerta 3, que ya abre el voto.
- Una corrida larga con el equipo ocupado dio 13 fallos por tiempo; repetidas de a una, pasaron las 13. En `controles.spec.ts` las pruebas de caminar ahora esperan a que la portería cargue: antes de eso no hay paredes y caminar las atravesaba.

## Lo que encontré y no es del pasillo

**El reflector (sala 3) no se puede resolver en grupo.** En la e2e cooperativa, la etapa 1 del reflector sale bien, pero en la etapa 2 el panel de quien tiene D desaparece después de tocar «Proponer al grupo» y al otro nunca le llega la propuesta. La lógica del anfitrión está bien: en una prueba de unidad con la red en memoria resuelve las tres etapas. El fallo está del lado del cliente (`src/signals/juego-coop.ts` o el panel). Sospecha sin confirmar: el borrador de D no guarda a qué etapa pertenece, y el panel no dibuja nada si el estado de la máquina no vale para la etapa (`PanelMecanismo.tsx`). Por eso la e2e cooperativa juega solo las salas 1 y 2; cuando se arregle, se amplía a las cinco y al final por votación (está dicho en la prueba).

## Pendiente

- **Alex:** probar en el celular (vista previa de `main`) y decir si el pasillo se ve muy oscuro, muy largo o si alguna frase no va. Medir con `?debug=1` en el celular de referencia.
- **Sesión A:** grabar las cuatro líneas con `npm run voz -- --solo voz-pasillo-profesores,voz-pasillo-10a,voz-pasillo-11b,voz-pasillo-aseo` y quitarlas de `POR_GRABAR` en `tests/unit/voz-grabada.test.ts`.
- **Sesión C:** T77e a T77g (toque, aviso y sonido de las puertas falsas; carteles; sello en el cartel). Cada cartel es una draw call: si hace falta margen, juntarlos en un atlas.
- **Tarea aparte:** el reflector en grupo (arriba).
