# Reporte de la ola 6 · Más efectos de sonido (T42c) · Sesión A · 17 de noviembre de 2026

Una tarea: **T42c**, a pedido de Alex: «agregar más efectos de sonido, por ejemplo cuando se abren las puertas, y se usan objetos importantes, tipo la máquina registradora». No estaba en la especificación: la agregué en la fase 5 (Audio), después de T42b, y quedó marcada como hecha en este PR.

Resumen honesto: **nada se probó en un celular real** y los sonidos solo se revisaron en el código y en las pruebas, no con audífonos. Son sonidos hechos con código: si alguno suena feo, se cambian unos números en `src/engine/audio/sintesis.ts`.

## Qué hice

- **13 sonidos nuevos con Web Audio** (`sintesis.ts`): no son archivos, no pesan nada y no necesitan créditos.
- **Puertas:** al cambiar de sala suena la puerta que se abre (pestillo y bisagra). Si la puerta sigue cerrada, el pomo traquetea.
- **Objetos importantes:** al empezar a usar una máquina suena su pestillo. La **registradora** suena con sus teclas y una campanita, y el **intercomunicador** con un zumbido.
- **Lo que se abre con cada sello:** la campanita y el cajón de la registradora (sala 1), la incubadora (sala 2) y la pared de casilleros (sala 4). La caja fuerte (sala 5) y la polea (sala 3) ya sonaban.
- **Controles:** al mover un rodillo, una perilla, la muesca del reflector o un poste suena un clic. En los carritos suena un libro y en la urna, una ficha.
- **Sensores y lámparas:** en las etapas que responden solas (los sensores del gimnasio y las lámparas de la biblioteca) suena un bip cuando algo se enciende.
- **Otros:** la etiquetadora suena como imprenta al sacar la etiqueta, y recoger algo (linterna, cuaderno, grabación) tiene su sonido.
- **Nuevo ajuste «Volumen de los efectos»** (de 0 a 100 %, empieza en 100 %). Antes los efectos sonaban a un volumen fijo. Al 100 % suenan igual que antes.

## Cómo funciona

- Todos los sonidos van por el canal de efectos de la mezcla, así que los controla el volumen de los efectos. Nada suena antes del primer toque.
- Las reglas están en `src/engine/audio/momentos.ts`, que escucha los signals que ya existían: la sala, el panel abierto, el objeto enfocado, los ajustes de la máquina, sus condiciones, el inventario y los avisos. Por eso suenan igual en la partida individual y en la cooperativa.
- Lo que se abre con un sello suena desde su animación (`etiquetadora.ts`, `tanques.ts`), como ya hacía la caja fuerte.
- Empezar, continuar o salir de una partida no suena como una puerta. Pasar de etapa no suena como un clic: eso lo anuncia el sello.

## Qué decidí (Alex puede cambiarlo)

1. **En la etiquetadora, los tanques y la urna no suena el bip** cuando los ajustes ya están bien: delataría la respuesta antes de bajar la palanca. Solo suena donde el jugador ya lo ve en la sala (sensores y lámparas).
2. **En cooperativo, todos oyen los controles que mueve cualquiera.** Así se nota que el compañero está haciendo algo.
3. **Los casilleros de la biblioteca suenan con el sello, aunque todavía no tienen animación.** La historia dice que se abren.

## Pruebas

- Unidades: `audio-momentos.test.ts` (nueva: puertas, objetos, controles, bip y que la lista de etapas en vivo coincide con los puzzles), `audio-motor.test.ts` (imprenta, casilleros, volumen de efectos y que cada efecto arma sus nodos) y `ajustes.test.ts` (el ajuste nuevo).
- E2e: `audio.spec.ts` (usar la etiquetadora y la registradora, imprenta, sello y registradora), `partida.spec.ts` (puerta cerrada), `controles.spec.ts` (puerta que se abre) y `ajustes.spec.ts` (el volumen de los efectos se cambia y se recuerda). El motor deja los últimos 12 sonidos en `data-sonidos` del canvas para estas pruebas.
- Resultados (con el equipo compartido por varias sesiones, un solo navegador y prioridad baja):
  - Formato, lint y unidades: en verde (94 archivos, 1092 pruebas).
  - Suite e2e completa, ya combinada con main hasta el PR 152: 264 pasaron, 9 fallaron y 21 se saltaron (son de otro perfil). Al repetir solo esas 9, pasaron 8.
  - La que siguió fallando es «a mitad de partida, con un sello, el intercomunicador lleva a "También vale pedir ayuda"» (escritorio). Después de la puerta 1, la partida ya está en la sala 1 (suenan la puerta y La Voz), pero el motor no termina de mostrarla en 15 s.
  - **Ese fallo no viene de esta rama:** la misma prueba sobre `main`, sin estos cambios, falló 1 de 3 veces con el mismo síntoma. Lo mismo pasó en otras corridas con 2 o 3 pruebas que cruzan la puerta 1, siempre con el equipo muy cargado. Queda anotado como pendiente aparte.
  - Después de combinar el PR 153 (fuentes) corrí otra vez formato, lint, unidades y los cuatro archivos e2e que toqué. Pasaron 57 y falló 1: «en escritorio, un clic en el piso bloquea el ratón».
  - **Ese fallo tampoco viene de esta rama.** Lo repetí 4 veces aquí y 4 en `main`. Falló 3 veces aquí y 2 en `main`, siempre en el mismo punto: el clic selecciona la puerta de salida en vez de bloquear el ratón. Queda anotado como pendiente aparte.

## Qué necesita Alex

1. **Escuchar los sonidos en el celular** y decir cuáles cambiar (más suave, más corto, otro).
2. **Fusionar primero el PR 145 (la voz).** Esta rama parte de él: hasta que se fusione, este PR también muestra sus cambios.
3. **Decidir si se abre una tarea para las dos pruebas inestables de `main`**: la sala que no termina de mostrarse después de la puerta 1 y el clic que no bloquea el ratón. No son de esta tarea y no las toqué.

## Cómo probarlo en el celular

1. Abre la vista previa del PR en `/jugar` con el volumen del teléfono arriba y toca **Jugar solo**.
2. Recoge la linterna del escritorio.
   - **Se espera:** un sonido corto de recoger.
3. Toca la **puerta 2** y luego «Usar».
   - **Se espera:** el pomo traquetea y sale el aviso de que está cerrada.
4. Toca la **puerta 1** y luego «Usar».
   - **Se espera:** suena la puerta al abrirse y entras a la cooperativa.
5. Toca la **registradora** y luego «Usar».
   - **Se espera:** suenan tres teclas y una campanita, y se abre el panel de la etiquetadora.
6. En el panel, pon un rodillo y baja la palanca.
   - **Se espera:** un clic al poner el rodillo y, al bajar la palanca, el golpe y la imprenta.
7. Resuelve la sala.
   - **Se espera:** el arpegio del sello y, cuando termina la impresión, la campanita del cajón de la registradora.
8. Abre **Pausa → Ajustes**, baja **Volumen de los efectos** a 0 % y vuelve a tocar la puerta.
   - **Se espera:** la puerta ya no suena, pero La Voz sí.
9. **Anota:** qué sonido te gusta, cuál sobra y cuál suena raro en el parlante del teléfono.
