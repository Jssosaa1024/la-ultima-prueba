# Reporte de la ola 1 · Sesión A · 14 de noviembre de 2026

Esta sesión es dueña de `src/engine/` y `src/input/`. En esta ola hizo tres tareas nuevas y cerró un PR de documentos que estaba abierto. Todo está fusionado en `main`:

- T19c · ids de objetos ([#34](https://github.com/Jssosaa1024/la-ultima-prueba/pull/34))
- T15b · joystick visible y mira ([#37](https://github.com/Jssosaa1024/la-ultima-prueba/pull/37))
- T20b · el motor solo dibuja durante la partida, y aviso de carga ([#40](https://github.com/Jssosaa1024/la-ultima-prueba/pull/40))
- Ahorro de builds en `CLAUDE.md` ([#28](https://github.com/Jssosaa1024/la-ultima-prueba/pull/28))

Resumen honesto: **nada de esto se probó en un celular real ni en un iPhone.** Lo comprobé con las pruebas de unidad (Vitest), con las pruebas e2e (Playwright: Pixel 5 emulado y Chrome de escritorio, con WebGL por software) y mirando capturas de pantalla de esas pruebas. De las vistas previas de Cloudflare solo comprobé que el build pasó. La sección 3 dice qué debe revisar una persona.

## 1. Qué hice

### T19c · Los mismos ids de objeto en salas, puzzles y código (#34)

- **Lo que encontré:** `src/content/salas.json` **ya usaba** los ids de los puzzles (`s1-productos`, `s1-pizarra`, `s1-caja-rodillos`, `s1-palanca`…) desde T19b. No hubo que cambiar ningún id en las 5 salas.
- **Dónde quedan los ids viejos:** `s1-factura`, `s1-menu` y `s1-tarjeta` solo están en `src/signals/ejemplo.ts` y en tres pruebas de la sesión C (`provisional.test.ts`, `cuaderno.test.ts`, `signals.test.ts`). No los toqué, porque la sesión C está reemplazando esos archivos.
- **Test nuevo** `tests/unit/ids-objetos.test.ts`:
  - falla si un puzzle nombra, en cualquier campo, un objeto que no existe en **su** sala (antes solo se revisaba `pista_por_jugador`);
  - comprueba que el propio test detecta un id viejo y uno de otra sala;
  - falla si un archivo de `src/` nombra entre comillas un objeto que no existe.
- `docs/salas-y-puzzles.md` nombra los objetos en prosa, sin ids. Revisé a mano que todos los que menciona existen en `salas.json`.
- No corrí la vista previa a mano: el PR solo tiene pruebas y documentos.

### T15b · Joystick visible, mira y aviso del ratón (#37)

- Componente nuevo `src/ui/controles/Controles.tsx`, montado en `src/ui/Partida.tsx` (dos líneas).
- **Joystick:** al tocar la mitad izquierda aparece un anillo donde cayó el dedo y una perilla que lo sigue sin salirse del anillo.
- **Guía en reposo (decisión mía):** en pantallas táctiles, un anillo tenue abajo a la izquierda muestra dónde poner el pulgar. Con ratón no se muestra. No estaba en la tarea; se quita con una regla de CSS si no gusta.
- **Mira y aviso:** con el ratón bloqueado se ve un punto blanco en el centro y, abajo, «Esc para soltar el ratón».
- Nada de esto recibe toques, y se oculta con un panel abierto.
- La prueba e2e del bloqueo del ratón ahora reintenta el clic: fallaba a veces cuando el equipo estaba ocupado.

### T20b · El motor solo dibuja durante la partida, y aviso «Cargando sala…» (#40)

- **Pausa:** detrás del menú y de las pantallas de final el bucle del motor se detiene del todo. Arranca al tocar «Jugar solo» y se detiene otra vez al salir o al llegar a un final. Antes dibujaba todo el tiempo algo que no se veía.
- Cuando una sala termina de cargar con el bucle detenido, el motor dibuja **un solo cuadro**, para que detrás del menú se vea la sala correcta.
- **Aviso** (`src/ui/carga/IndicadorCarga.tsx`): «Cargando sala…» en el centro si preparar una sala tarda más de un cuarto de segundo. Si la carga falla, dice «No se pudo cargar la sala. Recarga la página para seguir.».
- **Error que encontré y corregí:** al tocar «Jugar solo», `reiniciarInterfaz()` (en `src/signals/interfaz.ts`, de la sesión C) borraba el signal `carga` aunque el motor siguiera cargando. En un celular lento el aviso nunca habría salido. Quité esa línea: ahora ese signal solo lo escribe el motor.

### PR #28 · Ahorro de builds de Cloudflare

Seguía vigente (el bloque no estaba en `CLAUDE.md`). Lo actualicé con `main` y lo fusioné, las dos cosas con `[skip ci]`, así que no gastó builds.

### Archivos de otras sesiones que toqué

| Archivo | Dueña | Cambio |
| --- | --- | --- |
| `src/ui/Partida.tsx` | C | 4 líneas: los `import` y el montaje de `<Controles />` y `<IndicadorCarga />` |
| `src/signals/interfaz.ts` | C | 1 línea menos en `reiniciarInterfaz()` y su comentario |
| `docs/especificacion-tecnica.md` | B | 3 líneas: T19c, T15b y T20b, marcadas como hechas |

No toqué `src/signals/provisional.ts` ni `src/signals/ejemplo.ts`.

## 2. Qué quedó incompleto o con riesgo

1. **Lista `PENDIENTES` en `tests/unit/ids-objetos.test.ts`.** El test salta `src/signals/ejemplo.ts` y `src/signals/provisional.ts`. Cuando la sesión C los borre, hay que vaciar esa lista (si los archivos ya no existen, el test sigue pasando, pero la lista queda de adorno).
2. **`s2-tanques` no es un objeto.** En cuatro salas el id del puzzle es también el id de la máquina (`s1-etiquetadora`, `s3-reflector`, `s4-carritos`, `s5-urna`). En la sala 2 no: los objetos son `s2-tanque-a`, `s2-tanque-b`, `s2-palanca`… Quien conecte los paneles debe decidir qué objeto abre el panel de los tanques.
3. **Con un panel abierto el motor sigue dibujando.** La tarea pedía menú y finales. El cuaderno y la inspección dejan ver la escena por los bordes, así que no lo detuve.
4. **La pausa en la pantalla de final no tiene prueba e2e propia.** Usa el mismo camino que el menú (`fase` distinta de `jugando`), que sí está probado. Solo se llega a un final con `?ejemplo=1`, que la sesión C está reemplazando.
5. **Girar el teléfono con el menú abierto** deja negro el fondo detrás del menú hasta empezar la partida. El menú es 92 % opaco: apenas se nota.
6. **El aviso de carga casi nunca se verá por ahora.** Las salas son bloques de colores y cargan en milisegundos. Lo probé frenando a propósito la compilación de shaders. Se verá de verdad cuando lleguen los modelos GLB.
7. **`data-motor` cambió de significado en el menú:** ahora dice `pausado` (antes `activo`). Solo lo usaban mis pruebas e2e, que actualicé. Si otra sesión escribe una prueba nueva, debe esperar `activo` **después** de tocar «Jugar solo».
8. **Pruebas e2e inestables cuando hay otra sesión probando.** En esta ola fallaron, y pasaron al repetirlas sin cambiar nada:
   - tres pruebas de `controles.spec.ts` por tiempo (T18, T19 y T20);
   - dos veces el arranque del servidor de pruebas: el build tardó 1 min 22 s y Playwright espera 2 minutos. Lo resolví construyendo y arrancando `npm run preview` a mano antes de las pruebas.
   No cambié `playwright.config.ts` porque es compartido. Subir ese tiempo de espera a 4 minutos lo arreglaría.
9. **Siguen pendientes del reporte anterior** (`docs/reportes/sesion-A.md`): la linterna duplicada, el cuaderno de la portería que entra al inventario, todas las puertas abiertas desde el principio, la escala dinámica de resolución (T13) y el modo zurdo (T39). Ninguno era de esta ola.

## 3. Qué debe probar una persona en el celular

Enlace para todo: **https://la-ultima-prueba-duz.pages.dev/jugar/** (producción, que ya tiene estas tareas). Anota el modelo del celular y el navegador. Hazlo en el Android de referencia y en un iPhone con Safari.

### 3.1 La guía del joystick (T15b)

1. Toca **Jugar solo**.
2. Mira abajo a la izquierda, sin tocar nada.

- **Se espera:** un círculo tenue con un punto claro adentro, más o menos donde cae el pulgar izquierdo.
- **Anota:** si se ve sobre la escena (también afuera, con sol), si estorba y si tapa la lista del inventario.

### 3.2 El joystick bajo el dedo (T15b)

1. Pon el pulgar en cualquier parte de la mitad izquierda y arrástralo despacio hacia arriba.
2. Sin soltar, llévalo lejos, hasta el borde de la pantalla.
3. Suelta.
4. Repite tocando muy cerca del borde izquierdo y muy abajo.

- **Se espera:**
  - el círculo salta a donde tocaste y el punto sigue al dedo;
  - al alejar mucho el dedo, el punto se queda en el borde del círculo;
  - al soltar, el círculo vuelve a su sitio tenue;
  - cerca de los bordes el círculo se corta, pero se sigue caminando.
- **Anota:** si el dibujo va pegado al dedo o se atrasa, y si el tamaño (112 px) es cómodo.

### 3.3 Joystick con dos dedos y con paneles (T15b)

1. Camina con el pulgar izquierdo y, sin soltar, mira con el derecho.
2. Suelta y toca **Cuaderno**.

- **Se espera:** el círculo sigue al pulgar izquierdo mientras giras; con el cuaderno abierto no se ve ningún círculo encima.

### 3.4 El menú ya no gasta batería (T20b)

1. Abre el enlace y **no toques nada** durante 2 minutos.
2. Toca el celular por detrás.
3. Toca **Jugar solo**, juega 1 minuto, toca **Salir** → **Aceptar** y espera otros 2 minutos en el menú.

- **Se espera:** en el menú el celular no se calienta. Detrás del menú se alcanza a ver, muy oscura, la portería quieta.
- **Anota:** si notas diferencia de temperatura entre el menú y la partida.

### 3.5 Empezar, salir y volver a empezar (T20b)

1. Toca **Jugar solo**: fíjate cuánto tarda en verse la portería.
2. Camina unos pasos y gira.
3. Toca **Salir** → **Aceptar** y luego **Jugar solo** otra vez.
4. Durante la partida, cambia a otra app 10 segundos y vuelve.

- **Se espera:**
  - la portería aparece de inmediato, sin pantalla negra;
  - la segunda partida empieza otra vez en la entrada, y se camina y se mira normal;
  - al volver de la otra app, la escena sigue donde estaba, sin saltos.

### 3.6 Cambio de sala y aviso de carga (T20b)

1. Entra por cada una de las 5 puertas y vuelve a la portería.

- **Se espera:** el cambio es casi instantáneo. **Lo normal es no ver ningún aviso.** Si el celular es lento, puede salir un momento «Cargando sala…» en el centro, con un aro que gira, y quitarse solo.
- **Anota:** si el aviso sale, en qué sala y cuánto dura; y si alguna vez se queda pegado.

### 3.7 En un computador: mira y aviso del ratón (T15b)

Con Chrome, y si se puede con Firefox y Safari. **Solo lo probé en Chromium.**

1. Toca **Jugar solo** y haz clic en el piso.
2. Mueve el ratón y apunta a una puerta.
3. Aprieta **Esc**.

- **Se espera:**
  - tras el clic, un punto blanco en el centro y abajo el texto «Esc para soltar el ratón»;
  - con Esc desaparecen los dos y vuelve el cursor;
  - en el computador no se ve el círculo tenue del joystick.
- **Ojo:** Esc no se puede simular en las pruebas automáticas, así que **quitar la mira con Esc no está probado**.

### 3.8 Lo que no hay que probar

- T19c no cambia nada visible.
- Esta sesión no hizo nada de audio.
