# Reporte de la ola 4 · Sesión B · 15 de noviembre de 2026

En esta ola, la sesión B se quedó también con `src/net` y `supabase/`, y construyó todo el cooperativo por dentro: protocolo, transportes, anfitrión, resincronización, reconexión, migración y Supabase. Todo está fusionado en `main`:

| Tarea | Qué es | PR |
| --- | --- | --- |
| **T80** | Sobre de mensajes, validación estricta, interfaz `Transporte` y dos transportes de prueba | [#85](https://github.com/Jssosaa1024/la-ultima-prueba/pull/85) |
| **T80b** (nueva) | Las notas del cuaderno no viajan por la red | [#86](https://github.com/Jssosaa1024/la-ultima-prueba/pull/86) |
| **T84 · T85 · T87** | Anfitrión: objetos, propuestas, pistas, votos y reloj | [#87](https://github.com/Jssosaa1024/la-ultima-prueba/pull/87) |
| **T88** | Secuencia, foto cada 15 s y resincronización | [#88](https://github.com/Jssosaa1024/la-ultima-prueba/pull/88) |
| **T89 · T90** | Reconexión con rol y objetos, y migración de anfitrión | [#89](https://github.com/Jssosaa1024/la-ultima-prueba/pull/89) |
| **T79 · T78** | Transporte con Supabase Realtime, políticas RLS y guía para Alex | [#90](https://github.com/Jssosaa1024/la-ultima-prueba/pull/90) |

Resumen honesto:

- **El cooperativo funciona por dentro, pero todavía no se ve.** Ninguna pantalla lo usa: la sala de espera (T81), los avatares y la conexión con la interfaz son de otras sesiones.
- **Nada se probó con un Supabase real ni en un celular.** Todo se probó con pruebas de unidad: la red en memoria, con retraso y pérdida, simula de 2 a 4 jugadores.

## 1. Qué hice

### T80 · Protocolo y transportes

- **Sobre y validación** (`src/net/protocolo.ts`): cada mensaje lleva `{ v, t, de, cid, n, p }`. Todo lo que llega se revisa entero:
  - versión, canal y tipo;
  - tamaño: 1 KB por mensaje y 8 KB la foto;
  - cada campo, contra listas conocidas: ids de objetos, puzzles, lugares, grabaciones y finales;
  - el estado de una propuesta, con la forma exacta de los controles de la etapa.

  Si algo sobra, falta o no está en la lista, el mensaje se descarta completo. Nadie puede firmar por otro: el `cid` empieza con el id de quien envía.
- **Código de partida** de 4 caracteres, sin 0, O, 1, I ni L. **Alias y color** salen de listas cerradas.
- **Tipos de los mensajes** en `src/game/coop/mensajes.ts`, para que la lógica pura del anfitrión no dependa de `net/`.
- **Interfaz `Transporte`** (unirse, enviar, escuchar, presencia, salir) y dos transportes de prueba:
  - **Red en memoria** para Vitest: varios clientes, retraso, pérdida con semilla, caídas y reconexiones.
  - **BroadcastChannel** entre pestañas, para las e2e. Solo se usa sin variables de Supabase o con `?red=pestanas`.

### T80b · Sin notas en la red

La intención y el evento `nota` no existen. Se comparten los datos encontrados, las pistas, los resultados y las grabaciones. Las notas son de cada jugador.

### T84, T85 y T87 · El anfitrión

- **Dónde está:** las reglas, puras, en `src/game/coop/sesion.ts`. Usan las mismas funciones del modo individual (partida, pistas, reparto de T29 y `evaluar()`). `src/net/anfitrion.ts` las conecta al transporte y numera los eventos.
- **Cada jugador** (`src/net/cliente.ts`) guarda una copia de la partida (`src/game/coop/replica.ts`).
- **Qué cubre:**
  - «listo» e inicio;
  - recoger, pasar y usar objetos (la linterna sobre la pizarra, los datos, las grabaciones);
  - proponer, confirmar y resultado, con los intentos;
  - pedir pista;
  - votos de pausa, reanudar, sala, final y ayuda, con el reloj y el final por tiempo.
- **Prueba principal:** con 2, 3 y 4 jugadores simulados se juega la sala 1 completa. Al final todas las copias son iguales a la del anfitrión.

### T88 · Resincronización

- **Huecos:** cada cliente lleva el último número de evento. Si nota un hueco, pide la foto completa y no aplica nada hasta recibirla; si no llega en 2 s, la vuelve a pedir.
- **Foto periódica:** el anfitrión la difunde cada 15 s.
- **Límites:** responde un pedido por jugador por segundo y descarta intenciones repetidas (recuerda los últimos 512 `cid`).
- **Prueba:** un jugador que pierde la mitad de los mensajes termina la sala igual a los demás.

### T89 y T90 · Reconexión y migración

- **Reconexión:** quien vuelve antes de 60 s recupera sus objetos y su rol. A los 60 s, sus objetos quedan en el piso y D pasa al siguiente; al volver, recupera D.
- **Id de jugador:** se guarda en el navegador (`src/net/identidad.ts`).
- **Migración:** si el anfitrión falta 5 s, asume el jugador que llegó primero. Arranca desde su última foto con el reloj en pausa y lo reanuda a los 3 s.
- **Si vuelve el anfitrión anterior:** espera 2 s. Si otro asumió, pasa a ser jugador; si nadie asumió, sigue siendo el anfitrión.

### T79 y T78 · Supabase

- **Transporte real** (`src/net/supabase.ts`, con `@supabase/supabase-js` 2.118.0):
  - sesión anónima;
  - canal privado `partida:{codigo}`;
  - Broadcast con confirmación del servidor;
  - Presence una vez por unión.

  Se carga solo en el cooperativo: no pesa en el modo individual.
- **Políticas RLS** (`supabase/migrations/`): solo usuarios con sesión, solo canales `partida:` con un código válido y solo Broadcast y Presence. No hay tablas.
- **Guía paso a paso para Alex** en `docs/supabase.md`, y `.env.example` sin valores.

## 2. Qué decidí (Alex puede cambiarlo)

1. **Cambios a la especificación del protocolo:**
   - `usar` acepta «sin herramienta» (examinar un dato o abrir un escondite);
   - `votar` lleva `acepta` (falso retira el voto);
   - `inicio` lleva el orden de los jugadores en vez del reparto (cada uno lo recalcula con T29);
   - hay un evento `rechazo` (partida llena, otra versión o partida empezada).
2. **La partida empieza sola** cuando hay al menos 2 jugadores conectados y todos marcaron «listo». El grupo arranca en la portería.
3. **Quien propone (D) cuenta como que acepta.** Mientras el grupo espera a quien tiene D, nadie propone.
4. **Lo que lleva un jugador viaja con el grupo** al cambiar de lugar. A los 60 s de desconexión, queda en el piso del lugar donde está el grupo.
5. **Votar otra opción** del mismo asunto empieza la cuenta de nuevo. Si alguien se va, lo que ya tenían de acuerdo los demás se resuelve.
6. **El reparto no viaja en la foto:** cada jugador lo recalcula con el orden, el lugar y los ausentes.
7. **La numeración de los `cid` empieza al azar** en cada carga, para que el anfitrión no descarte intenciones de alguien que recargó la página.
8. **Las políticas RLS dejan entrar** a cualquier usuario con sesión que conozca el código. No hay forma de comprobar quién es «miembro» sin un servidor propio. El código es la llave: hay unos 923.000 posibles, el anfitrión rechaza al quinto y a quien llega con la partida empezada, y por la red solo viajan ids.
9. **Recomendación de subir a 150 por hora** el límite de sesiones anónimas por IP, porque todo un salón sale a internet con la misma IP.
10. **T89 y T90 fueron un solo PR**, como venían juntas en el pedido. Lo mismo T84, T85 y T87, y T79 y T78.

## 3. Qué quedó incompleto

- **Nada del cooperativo está en pantalla.** Para conectarlo, quien haga la interfaz necesita esto (todo exportado desde `src/net/index.ts`):
  - `elegirRed(entornoDelBuild(), location.search)` y `await crearTransporte(modo)`;
  - `new ClienteCoop(transporte, identidad)`, con `jugadorDelNavegador()` y un alias y un color de `ALIAS` y `COLORES`;
  - `crear(codigo)` o `unirse(codigo)`, con el código de `crearCodigo()` o de `leerCodigo(?codigo=)`;
  - llamar a `tick()` cada segundo;
  - leer `foto`, `roles` y `rechazo`, y suscribirse con `alCambiar`;
  - si el modo es `pestanas` sin el parámetro de prueba, mostrar `AVISO_SIN_SUPABASE`.
- **Pistas ofrecidas por tiempo:** el anfitrión las cuenta, pero a los demás solo les llegan con la foto de cada 15 s. La interfaz puede calcular el aviso localmente con `foto.pistas[i].ms` y los umbrales del puzzle, como el modo individual, o pedir que el anfitrión difunda la foto al ofrecer una pista.
- **No hay e2e del transporte entre pestañas**, porque ninguna página lo usa todavía. Hay pruebas de unidad con BroadcastChannel de Node.
- **No se hizo:** T92 (prueba de carga), T93 (cuatro celulares) ni bajar las poses a 2 Hz si Supabase corta por exceso.
- **Para la sesión C:** `src/signals/cuaderno.ts` tiene un comentario que dice que el cuaderno se compartirá con eventos `nota`. Ya no es así; no lo toqué porque es de esa sesión.

## 4. Qué debe hacer Alex

1. **Seguir `docs/supabase.md`** (unos 15 minutos):
   - crear el proyecto Free;
   - activar la sesión anónima y subir su límite por IP;
   - desactivar el acceso público de Realtime;
   - pegar el SQL;
   - poner `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY` en Cloudflare Pages (Production y Preview);
   - volver a desplegar `main`.
2. **No copiar nunca la clave `service_role`** en ningún lado.
3. **Probar en dos celulares** cuando la sala de espera esté en `main`. Hoy no hay nada que probar en el celular de esta ola.

## 5. Pruebas y equipo

- Cada PR pasó `npm run verify`: formato, lint, tipos, pruebas de unidad, créditos, presupuesto, audio y build. Las pruebas de unidad pasaron de 697 a 765, y todas las nuevas son del cooperativo.
- Cada PR con código esperó la vista previa de Cloudflare (todas cargaron) antes de fusionarlo. El de documentos usó `[skip ci]`.
- No corrí e2e por PR, porque ninguno cambió páginas, interfaz ni motor. La suite completa corrió una vez al final sobre `main`, con todo lo de esta ola: **182 pasaron, 6 fallaron y 12 se saltaron (38,8 min)**, con la CPU al 97 % por otras sesiones. Al repetir solo las 6 (con el candado):
  - 5 pasaron;
  - una siguió fallando en escritorio: `grabaciones.spec.ts`, «sala 3: los balones rebotan…». En celular pasó. El jugador no llega a su destino en 45 s (`caminarHasta` en `tests/e2e/escena.ts`).

  Esta ola no tocó ese archivo, ni el motor, ni la interfaz, y ninguna página importa `src/net` ni `src/game/coop`, así que el sitio construido no cambió por estos PR. Queda anotada para la sesión dueña de esa prueba: conviene caminar hasta algo sólido en vez de a un punto a mitad de camino.
- Todo lo pesado se corrió con el candado (`candado-pruebas.txt`, letra B) y con prioridad baja, uno a la vez.
