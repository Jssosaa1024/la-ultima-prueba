# Reporte de la ola 5b · Sesión A · 15 de noviembre de 2026

Esta sesión hizo las cuatro tareas de la lista. Todas están fusionadas en `main`:

| Tarea | Qué es | PR |
| --- | --- | --- |
| **T84c** | En grupo, la escena oculta lo que lleva otro jugador y lo muestra al soltarlo | [#109](https://github.com/Jssosaa1024/la-ultima-prueba/pull/109) |
| **T82b** | Poses del cooperativo a 2 Hz en una sola constante, con interpolación suave | [#110](https://github.com/Jssosaa1024/la-ultima-prueba/pull/110) |
| **T05c** | Dos e2e inestables: caminar hasta algo sólido y el toque a «Usar» de los tanques | [#111](https://github.com/Jssosaa1024/la-ultima-prueba/pull/111) |
| **T83b** | Draw calls con 4 jugadores y señales, medidos con `?debug=1` | [#112](https://github.com/Jssosaa1024/la-ultima-prueba/pull/112) |

Las cuatro tareas eran nuevas y no tenían número en la especificación: les puse uno con la letra siguiente libre (T84c, T82b, T05c, T83b) y quedaron marcadas como hechas dentro de cada PR.

Resumen honesto: **nada se probó en un celular real.** Todo se comprobó con pruebas de unidad (Vitest), e2e (Playwright: Pixel 5 emulado en horizontal y Chrome de escritorio, con WebGL por software, y `?red=pestanas` para el cooperativo) y la vista previa de Cloudflare de cada PR.

## 1. Qué hice

### T84c · Lo que lleva otro jugador no se ve en la escena (#109)

- Antes solo desaparecía lo que yo recogía. Si Búho recogía la linterna, Jaguar la seguía viendo en la mesa y podía tocarla.
- Ahora la escena oculta todo lo que lleva **cualquier** jugador y lo vuelve a mostrar en su sitio cuando queda sin portador. Si me lo pasan, va a mi inventario.
- Cómo: signal nuevo `objetosFuera` en `src/signals/coop.ts`, que el controlador cooperativo escribe con cada foto del anfitrión. El motor lo lee en `interaccion.ts`, y la marca de «oculto» va en el propio objeto, así una sala guardada en caché la recuerda al volver.
- E2e `coop-objetos.spec.ts`: Búho recoge la linterna y los dos dejan de verla; Búho cierra su pestaña y, al vencer los 60 s de reserva, Jaguar la ve otra vez en la mesa.

### T82b · Poses a 2 Hz (#110)

- Una sola constante, `POSES_POR_SEGUNDO = 2`, en `src/engine/coop/poses.ts`. De ella salen el intervalo, el retraso de la interpolación y el valor por defecto de `npm run prueba-carga`.
- **Interpolación ajustada**: el compañero se dibuja 620 ms en el pasado (un intervalo más 120 ms de margen para la red). Con los 150 ms de T82, a 2 Hz se quedaba quieto entre una pose y la siguiente.
- **Suavizado**: lo dibujado persigue la pose interpolada con una constante de 120 ms. Redondea las esquinas de la línea recta entre poses: en la prueba, el quiebre baja de más de 10° a menos de 3° por cuadro. Al detenerse llega exacto a la última pose; al cambiar de sala salta, sin cruzar paredes.
- **Prueba de carga** (`npm run prueba-carga -- --hz 2`, 2 minutos por fila):

| Partidas de 4 | Eventos/s (promedio) | Eventos/s (pico) | Free (100/s) | Pro (500/s) |
| --- | --- | --- | --- | --- |
| 1 | 24,8 | 45 | cabe (45 %) | cabe (9 %) |
| 2 | 41,8 | **75** | **cabe (75 %)** | cabe (15 %) |
| 3 | 63,2 | 120 | no cabe (120 %) | cabe (24 %) |
| 5 | 108,9 | 165 | no cabe (165 %) | cabe (33 %) |
| 10 | 223,3 | 310 | no cabe (310 %) | cabe (62 %) |

Con 2 partidas el pico es de 75 eventos/s, bajo los 100/s del plan Free. Un test de unidad lo comprueba.

### T05c · E2e estables (#111)

- **`caminarHasta`** (`tests/e2e/escena.ts`) lee la posición cada 50 ms. Antes usaba la espera creciente de `expect.poll`, que llega a leer una vez por segundo, y el jugador se pasaba hasta 2 m.
- **Termina cuando algo sólido lo detiene** 3 s. Esa era la falla de «sala 3: los balones rebotan» en escritorio: el carro de los balones detenía al jugador antes de 1,9 m y la prueba esperaba 45 s a una meta imposible.
- **Antes de tocar, espera a que la cámara quede quieta**, y `tocarObjeto` vuelve a apuntar y toca hasta 4 veces, también en escritorio (antes suelta el ratón bloqueado).
- **Tanques**: se camina mirando al tablero y, si el panel no abre, se repite el toque a «Usar».
- El juego no cambió: solo las ayudas de las pruebas. Ninguna prueba se saltó ni se desactivó.

### T83b · Draw calls con 4 jugadores (#112)

- Avatares, alias y señales suman **5 draw calls**: 1 malla instanciada para los 3 cuerpos, 3 alias y 1 malla para todas las señales.
- La sala más cargada tiene 23 mallas, aunque todo se viera a la vez: el peor caso son **28 de 40**. **No hizo falta agrupar más.**
- Prueba de unidad `presupuesto-coop.test.ts`: falla si alguna sala, con su animación y lo del cooperativo, pasa de 40.
- E2e `coop-presupuesto.spec.ts`: 4 pestañas en grupo, la primera con `?debug=1`; los cuatro dicen «¡Aquí!» y el panel debe seguir en 40 o menos. **Medida en la portería:** **11 draw calls con los 3 avatares a la vista y 12 con las 4 señales** (límite 40). Las señales sumaron 1, como se calculó.

## 2. Qué decidí (sin preguntarle a Alex)

1. **«Mostrarlos si los suelta o se los pasan»**: lo leí así: el objeto se ve en la escena solo si nadie lo lleva. Si me lo pasan, aparece en mi inventario, no en la escena.
2. **Un objeto que queda en el piso de otro lugar sigue oculto.** Pasa si alguien se va con un objeto después de cambiar de sala y vence su reserva: el objeto «queda» en esa sala, pero allá no tiene modelo y nadie lo puede recoger. Mostrarlo en otro lugar es una decisión de juego (sesión B).
3. **Suavizado en vez de curva.** Probé primero una curva de Hermite entre poses, pero se quiebra cuando la pose siguiente llega a mitad de tramo; para evitarlo había que dibujar al compañero 1,1 s en el pasado. El suavizado de 120 ms no necesita conocer el futuro: el retraso total queda en unos 0,7 s.
4. **2 Hz siempre, no solo como respaldo.** La especificación decía «bajar a 2 Hz si Supabase desconecta»; ahora es el valor normal, y `--hz 4` en la prueba de carga sirve para comparar.
5. **Archivos compartidos que toqué, lo mínimo:** `src/signals/coop.ts` (el signal nuevo), `src/signals/juego-coop.ts` (escribirlo), `AGENTS.md` (poses a 2 Hz), y comentarios que decían «4 Hz» en `src/net/supabase.ts`, `src/signals/controlador-coop.ts` y `src/signals/poses.ts`.
6. **Retraso de la red supuesto en la prueba de suavidad:** entre 40 y 160 ms. En datos móviles puede ser peor; ver T93.

## 3. Qué quedó incompleto

- **No hay botón para pasar ni soltar objetos.** La intención `pasar` existe en el protocolo, pero la interfaz no la ofrece. Por eso la e2e de T84c prueba «soltar» con la reserva de 60 s, y «pasar» va en la prueba de unidad. El botón es de la interfaz (sesión C).
- **Con 3 partidas a la vez ya no alcanza el plan Free**, ni a 2 Hz (pico de 120 eventos/s). Para crecer: enviar `dir` sin entrega propia (−20 %) o el plan Pro (decisión de Alex con la sesión B).
- **La e2e de T83b** corrió verde antes de poner la rama al día con `main` (que traía las ayudas nuevas de T05c). La suite completa de abajo la volvió a correr sobre `main`.
- **Ninguna medida en celular real**, igual que en la ola anterior (T11, T11y, T93).

## Pruebas y equipo

- **Cada PR** pasó formato, lint, las pruebas de unidad (de 855 a 874), el build con `astro check` y los checks de créditos, presupuesto y audio, y las e2e de lo que tocaba, con el candado (`candado-pruebas.txt`, letra A), un solo navegador y prioridad baja. Cada PR esperó su vista previa de Cloudflare antes de fusionarse.
- **Suite e2e completa sobre `main`**, una vez al final: **221 pasaron, 0 fallaron y 17 se saltaron (22,9 min)**. Las saltadas son las que no corren en ese perfil (el cooperativo en escritorio, el teclado en celular, girar el teléfono en escritorio). Las dos que fallaban a veces en la ola anterior («los balones rebotan» en escritorio y los tanques) pasaron.

## 4. Qué debe probar Alex

Necesitas dos celulares (o cuatro para el punto C) con Chrome o Safari, en horizontal, y Supabase configurado (`docs/supabase.md`). Sin Supabase se puede probar en un solo navegador con varias pestañas, agregando `?red=pestanas` al enlace.

### A. Objetos que lleva otro (T84c), 5 minutos

1. Abre `https://la-ultima-prueba-duz.pages.dev/jugar/` en los dos teléfonos. En uno toca **Crear partida**; en el otro, únete con el código. **Estoy listo** e **Iniciar**.
2. Con el teléfono 2, camina hasta la **linterna** de la portería y toca **Recoger**.
3. **Mira el teléfono 1:** la linterna ya no debe estar en la mesa.
4. Cierra el navegador del teléfono 2 y espera algo más de un minuto: en el teléfono 1, la linterna vuelve a la mesa.

### B. Movimiento de los compañeros a 2 Hz (T82b), 5 minutos

1. Con la partida del punto A, camina en círculos con un teléfono y mira el otro.
2. **Anota:** si el muñeco se mueve a saltos o en línea quebrada, y si el retraso (algo menos de un segundo) se nota o molesta.
3. Detente de golpe: el muñeco debe terminar justo donde paraste.

### C. Draw calls con cuatro (T83b), 5 minutos, cuando haya cuatro teléfonos (T93)

1. En el teléfono de referencia abre `https://la-ultima-prueba-duz.pages.dev/jugar/?debug=1` y crea la partida; los otros tres se unen.
2. Ponte de frente a los demás y toquen todos **Frases** → **¡Aquí!**.
3. En el cuadro de métricas, **Draw calls** debe seguir en verde. Toca **Exportar JSON** y pásame el archivo.
