# Correcciones del 25 de noviembre · sesión A

Alex jugó en el celular y encontró cinco cosas. Esta sesión las corrigió en cinco PR, uno por grupo de cambios. Antes de empezar se marcó `main` con la etiqueta **`antes-correcciones-25nov`** (en GitHub), para poder volver a ese punto si hiciera falta.

## Resultado

| # | Corrección | PR | Estado |
| --- | --- | --- | --- |
| 1 | Pantalla corrida al volver al navegador | [#179](https://github.com/Jssosaa1024/la-ultima-prueba/pull/179) | Fusionado |
| 2 | Sonido de acierto y de error en cada etapa | [#182](https://github.com/Jssosaa1024/la-ultima-prueba/pull/182) | Fusionado |
| 3 | El reflector de la sala 3, sobre su poste | [#180](https://github.com/Jssosaa1024/la-ultima-prueba/pull/180) | Fusionado |
| 4 | Encuadre de la máquina y cuadros por segundo con el panel abierto | [#183](https://github.com/Jssosaa1024/la-ultima-prueba/pull/183) | Fusionado |
| 5 | Sala 2: una estación por etapa | [#187](https://github.com/Jssosaa1024/la-ultima-prueba/pull/187) | Fusionado |

Las capturas de antes y después están en `docs/capturas/correcciones-25nov-A/` y en el cuerpo de cada PR.

## 1 · Pantalla corrida

- **Causa:** el contenedor del juego estaba fijo a la ventana (`inset: 0`) y la página no tiene scroll. Al salir del navegador estando en pantalla completa (y más si el teléfono se giró), a veces el navegador se queda con las medidas viejas o con la vista corrida, y el jugador no puede corregirlo. Salir y volver a entrar a pantalla completa lo arreglaba porque obliga a medir de nuevo.
- **Arreglo:** al volver a la página, al girar, al cambiar la pantalla completa y cuando cambia lo visible, el contenedor toma el tamaño y la posición de `visualViewport` (lo que de verdad se ve), y se quita cualquier desplazamiento.
- **Por qué es seguro:** sin `visualViewport`, con zoom o con el teclado abierto no se pone nada y el CSS queda igual que antes. En un equipo donde todo funciona, `visualViewport` mide lo mismo que la ventana.
- **Límite:** en el emulador el error no sale solo. La prueba lo simula; la confirmación real es en el celular.

## 2 · Sonidos de acierto y de error

- Dos sonidos nuevos hechos con Web Audio (sin archivos ni licencias): acierto (dos tonos que suben) y error (dos tonos graves y suaves que bajan).
- Suenan cuando la animación de la máquina termina, más una pausa de 0,3 s. El arpegio del sello va 0,9 s después del acierto. La campana de la sala 2 sigue igual.
- Van por el canal de efectos: respetan el volumen de efectos.
- En las máquinas en vivo (sala 4 y las dos primeras etapas de la 3), el error suena cuando el jugador deja los controles quietos en un estado que no resuelve.

## 3 · Reflector de la sala 3

- El reflector pasó de x = −4 (encima de las gradas) a x = 2, sobre el poste del medio. Ahora tiene su propio poste con base, barra y collar.
- La solución del puzzle no cambia: solo depende de la altura del reflector y de los postes.

## 4 · Encuadre y cuadros por segundo

- Al abrir el panel de una máquina, la cámara se acerca en 0,6 s y deja la máquina en los dos tercios izquierdos. Al cerrar, vuelve. Con `prefers-reduced-motion`, el cambio es un corte directo.
- Se dibuja con una cámara aparte: la posición, los choques y la pose del jugador en el cooperativo no cambian.
- Signal `encuadre` en `src/signals/motor.ts` para la sesión C.
- Con un panel abierto solo se baja a 10 cuadros por segundo si nada se mueve.
- **Con el panel en franja de la sesión C** (#188): el encuadre usa el ancho que deja libre su signal `franja` (PR C25f). Si el panel se recoge («Ver» o mientras la máquina se mueve), la máquina se recentra en toda la pantalla sin mover la cámara; al volver a abrirlo, otra vez a la izquierda.

## 5 · Sala 2, una estación por etapa

- Tres estaciones contra la pared norte. Cada una tiene su tanque A, desde la 2 su tanque B, su tablero con perilla y su palanca. Cada tablero tiene 1, 2 o 3 pilotos amarillos.
- Cada etapa se resuelve solo con su estación. Una estación apagada o ya resuelta no abre el panel, y el HUD dice por qué.
- Al resolver una estación, el panel dice cuál se encendió y su botón es «Volver a la sala».
- **Fuera la incubadora:** no cumplía ningún papel. La campana pasó a una repisa en la pared y el graficador a la pared sur.
- `s2-tanques.json`: solo cambian ids de objetos (la palanca de cada etapa y dos pistas). Los números, los textos y las soluciones son iguales. Coordinado con la sesión B.

## Presupuesto

- Las cinco correcciones caben en el presupuesto de AGENTS.md sin subir ningún límite.
- Sala 2: la prueba del peor caso del cooperativo (todas las mallas a la vista y 4 jugadores) da **40 de 40 draw calls**. Con las tres estaciones daba 41. Se resolvió quitando la malla de líquido del tanque B de la estación 3, que siempre está tapado y no se ve.
- Las perillas y los pilotos van en la malla fija, sin draw calls nuevas.
- Ojo: la sala 2 quedó sin margen. Cualquier objeto animado nuevo en ella tendrá que unirse a otra malla.

## Pruebas

- Cada PR pasó `format:check`, `lint`, tipos y unidades, más las e2e de lo que tocaba, en celular y escritorio. Los números están en cada PR.
- **Una prueba que ya fallaba a veces en `main`:** «en escritorio, un clic en el piso bloquea el ratón» (`controles.spec.ts`). En #179 la corrí 3 veces en la rama y 3 en `main`: falló 2 y 1 veces, siempre igual (el clic selecciona la puerta de salida). Ya estaba en el reporte de la ola 6 y no tiene que ver con estas correcciones; en #183 pasó. No se saltó ni se desactivó.
- En #5 cambiaron dos expectativas de e2e por el cambio pedido: el laboratorio tiene ahora 8 objetos con modelo (antes 9: salieron la incubadora y el tablero de KayKit), y el aviso de estación sale dos veces en la página (el HUD y su copia para el lector de pantalla), así que la prueba mira el del HUD.

## Lo que queda para Alex

1. **Pantalla corrida:** jugar en el Android y en el iPhone, salir del navegador en pantalla completa, girar el teléfono y volver. El juego debe cubrir justo la pantalla, sin pedazos por fuera. Si vuelve a pasar, una captura de pantalla sirve para seguir.
2. **Sonidos:** oírlos en los dos teléfonos y decir si el volumen o el tono necesitan ajuste.
3. **Sala 2:** ver si las estaciones se distinguen (por las luces) y si el graficador en la pared sur se encuentra fácil.
4. **Encuadre:** abrir una máquina en cada sala y ver que queda a la vista a la izquierda del panel; tocar «Ver» y ver que queda centrada.
5. **Limpieza opcional:** los GLB `tablero` e `incubadora` siguen publicados y con crédito, pero ninguna sala los usa. Se pueden quitar en otra tarea.
