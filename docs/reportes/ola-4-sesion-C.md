# Reporte de las olas 4 y 5 · Sesión C · 15 de noviembre de 2026

La sesión C es dueña de `src/ui` y `src/signals`. En estas olas hizo el juego instalable y sin conexión, y puso en pantalla todo el cooperativo que la sesión B dejó listo por dentro. Todo está fusionado en `main`:

| Tarea | Qué es | PR |
| --- | --- | --- |
| **T95** | Manifiesto PWA, iconos hechos por código y aviso «Agregar a inicio» en iPhone | [#92](https://github.com/Jssosaa1024/la-ultima-prueba/pull/92) |
| **T94** | Service worker propio: el juego abre sin conexión y guarda las salas visitadas | [#93](https://github.com/Jssosaa1024/la-ultima-prueba/pull/93) |
| **T32 y T81** | «Crear partida», «Unirse con código» y la sala de espera | [#94](https://github.com/Jssosaa1024/la-ultima-prueba/pull/94) |
| **T84b** (nueva) | El controlador del cooperativo: aplica lo que decide el anfitrión y envía intenciones | [#95](https://github.com/Jssosaa1024/la-ultima-prueba/pull/95) |
| **T85 y T87** | Pantallas de propuesta en las máquinas, votos y espera de quien tiene D | [#96](https://github.com/Jssosaa1024/la-ultima-prueba/pull/96) |
| **T86** | Pista de cada encargo y cuaderno compartido | [#97](https://github.com/Jssosaa1024/la-ultima-prueba/pull/97) |
| **T91** | Frases rápidas, señalar y la sala 1 en cooperativo de punta a punta (e2e) | [#98](https://github.com/Jssosaa1024/la-ultima-prueba/pull/98) |
| Corrección | En grupo, el reloj se quedaba quieto entre fotos del anfitrión | [#99](https://github.com/Jssosaa1024/la-ultima-prueba/pull/99) |

Resumen honesto: **nada se probó en un celular real ni con dos celulares.** El cooperativo se probó entre dos pestañas del mismo navegador (el transporte de prueba con BroadcastChannel): una e2e juega la sala 1 completa en grupo. Con dos celulares de verdad hace falta Supabase (`docs/supabase.md`, de Alex).

## 1. Qué hice

### T95 · App instalable

- El juego instalado abre `/jugar/` a pantalla completa y en horizontal (Android).
- Icono propio: la esfera del reloj en ámbar con una cerradura, dibujado por un script (`npm run iconos-pwa`). Una prueba falla si los PNG publicados no coinciden con el dibujo.
- En iPhone, Safari no tiene pantalla completa: el menú dice «toca Compartir y luego "Agregar a inicio"». Abierto desde ese icono, el juego se ve sin las barras de Safari.

### T94 · Sin conexión

- Al abrir el juego se guarda el núcleo: las páginas, todo el JavaScript (con el decodificador de texturas), el manifiesto y los iconos. Las salas quedan guardadas al visitarlas.
- **Una versión nueva nunca queda tapada:** las páginas siempre se piden primero a la red y solo sin red salen de la copia.
- **Una partida abierta no se rompe con una actualización:** la versión nueva espera a que se cierren las pestañas; al activarse borra lo viejo.
- **La partida guardada sobrevive:** el service worker nunca toca `localStorage`.

### T32 y T81 · Entrar a una partida en grupo

- Menú: **Jugar solo**, **Crear partida**, **Unirse con código**. El alias es un animal de una lista y el color, uno de cuatro; nadie escribe su nombre.
- `/jugar?codigo=K7MP` abre «Unirse» con el código ya escrito (validado: 4 caracteres, sin 0, O, 1, I ni L).
- Sala de espera: código grande, lista de jugadores, «Estoy listo» e **Iniciar** (solo quien creó la partida, con todos listos).
- Avisos si la partida está llena, es de otra versión, ya empezó, no existe o no hay conexión.

### T84b · El cooperativo por dentro de la interfaz

- En grupo, la interfaz usa los mismos signals que el modo individual; los llena lo que decide el anfitrión. El modo individual no cambió.
- Examinar anota el dato para todos. La pizarra de la sala 1, en penumbra, solo se lee si quien la examina lleva la linterna (o alguien ya la alumbró).
- Cruzar una puerta, la puerta de salida y el intercomunicador abren una votación.

### T85, T87 y T86 · Pantallas del grupo

- **Máquinas:** solo quien tiene D mueve los controles y propone (la palanca o «Proponer al grupo»). Los demás ven la propuesta y tocan **Aceptar** o **Rechazar**; el panel dice quién falta.
- **Barra del grupo** (arriba al centro): tus encargos, Frases, Pausar, Reanudar y cada votación abierta con quién la propuso, cuántos aceptaron y «Aceptar» o «Retirar mi voto».
- **Si se desconecta quien tiene D:** «Esperando a Búho… quedan 00:42», y nadie acciona la máquina.
- **Cuaderno en grupo:** «Tu encargo en esta sala» con la pista de cada encargo propio; datos encontrados y pistas abiertas son de todo el grupo; las notas son solo de cada uno («no se envían al grupo»).

### T91 · Frases y señales

- Seis frases de una lista («¡Aquí!», «Mira esto», «Ven», «Listo», «Espera», «No sé») y **Señalar** el objeto enfocado. Por la red viaja el id, nunca texto. Los demás ven «Búho: ¡Aquí!».

## 2. Qué decidí (Alex puede cambiarlo)

1. **Iniciar es marcarse listo.** La especificación dice que la partida empieza sola con todos listos; el botón del anfitrión respeta eso sin cambiar las reglas de la sesión B.
2. **El id del jugador va por pestaña** (`sessionStorage`). Sobrevive a recargar (reconexión), pero cerrar la pestaña y abrir otra cuenta como jugador nuevo. Así se puede probar con dos pestañas.
3. **10 segundos** sin respuesta = «No encontramos esa partida».
4. **En grupo cada uno tiene su cuaderno desde el principio** (no se recoge) y abrirlo no pausa el reloj: en grupo solo se pausa por votación.
5. **No hay «rechazar» una votación:** el protocolo no lo tiene; basta con no aceptar, y cada uno puede retirar su voto. Las propuestas de la máquina sí se rechazan.
6. **Quien tiene D prueba los ajustes en su panel sin que viajen** y los propone con la palanca o con «Proponer al grupo».
7. **La señal apunta al objeto enfocado.** Sin objeto, va «sin punto» hasta que el motor publique la posición del jugador.
8. **El service worker no usa `skipWaiting`:** más seguro para una partida abierta; las páginas igual se piden primero a la red.
9. Dos jugadores pueden elegir el mismo alias o color: no se bloquea.

## 3. Qué quedó incompleto

- **Sesión A (motor):**
  - dibujar el punto de cada señal (signal `senales`) y escribir `miPosicion` (posición del jugador) con las poses de T82;
  - en grupo, los objetos que lleva otro jugador siguen viéndose en la escena.
- **Pasar un objeto a otro jugador** no tiene botón todavía (el anfitrión ya lo acepta).
- **Una pista nueva se avisa con hasta 15 s de retraso** en los que no son anfitrión: llega con la foto periódica (lo advirtió la sesión B).
- **Que una versión nueva del service worker reemplace a la vieja** se probó con pruebas de unidad, no en un navegador: Playwright no deja cambiar el `sw.js`.
- **Cooperativo entre celulares:** necesita el proyecto de Supabase (Alex).

## 4. Qué debe probar Alex en el celular

Todo en horizontal. Los enlaces son de producción (`main`).

**A. Instalar y jugar sin conexión (un celular)**

1. Android: abre https://la-ultima-prueba-duz.pages.dev/jugar, menú ⋮ → «Instalar app». iPhone: el menú dice cómo agregarlo a inicio; hazlo.
2. Abre el juego desde el icono (reloj ámbar con cerradura).
   - **Se espera:** sin barras del navegador. En iPhone ya no sale el aviso.
3. Toca **Jugar solo**, juega un minuto y cierra la app.
4. Pon **modo avión** y abre el juego desde el icono.
   - **Se espera:** abre el menú con **Continuar partida**, y se puede seguir.
   - **Anota:** si algo no carga sin conexión.

**B. Cooperativo en un solo celular (dos pestañas)**

1. Abre https://la-ultima-prueba-duz.pages.dev/jugar?red=pestanas y toca **Crear partida** → un alias → **Crear**. Anota el código.
2. Abre otra pestaña con `…/jugar?red=pestanas&codigo=` y tu código → otro alias → **Unirse** → **Estoy listo**.
3. En la primera pestaña toca **Iniciar**.
4. En una pestaña toca **Pausar**; en la otra, **Aceptar**.
   - **Se espera:** el reloj de las dos dice «en pausa».
5. Reanuda igual. Cruza la puerta 1 en una pestaña y acepta en la otra.
6. En cada pestaña toca el botón «Tus encargos…».
   - **Se espera:** una con A y B, la otra con C y D, cada una con su pista.
7. Con la pestaña que tiene D, abre la etiquetadora, pon un rodillo y baja la palanca. En la otra, **Ver propuesta** → **Aceptar**.
   - **Anota:** si la barra del grupo tapa algo importante en la pantalla del celular, y si los textos se leen.

**C. Con dos celulares** (cuando Supabase esté listo): lo mismo que B, cada uno en su celular y sin `?red=pestanas`.

## 5. Pruebas y equipo

- Cada PR pasó formato, lint, pruebas de unidad, el build completo y las e2e de lo que tocó, más la vista previa de Cloudflare. Las tareas 3 a 7 se probaron juntas, encadenadas, sobre `main`.
- Pruebas nuevas de unidad en cinco archivos (ahora son 800 en total): iconos y manifiesto, service worker, sala de espera, juego en grupo (con señales y reloj) y textos del grupo. E2e nuevas: `pwa`, `coop-espera`, `coop-votos` y `coop-sala1` (dos pestañas juegan la sala 1 completa en cooperativo).
- **Suite completa sobre `main`** (una vez, al final, con el candado): formato, lint y **799 pruebas de unidad** en verde; e2e **202 pasaron, 13 se saltaron (las de siempre) y 3 fallaron**, en 54 minutos.
- Lo que encontré en la suite: 
  - **Un error real, ya corregido (#99):** en grupo, el reloj se reescribía cada segundo con el valor de la última foto del anfitrión, así que se veía quieto y saltaba cada 15 s. Lo destapó la prueba de votos en escritorio. Tiene su prueba de unidad.
  - Las otras dos fallas fueron de `tanques.spec.ts` (modo individual): el toque al tablero no encontró el botón «Usar» con el equipo cargado. Ninguna tarea de esta ola toca la sala 2 ni el motor.
  - Al repetir solas las tres (ya con la corrección del reloj), **pasaron todas**, junto con `coop-sala1` en celular.
- Me pasó que el candado desapareció mientras yo lo tenía (otra sesión lo borró al terminar). Mi script ahora lo vuelve a escribir si falta.
