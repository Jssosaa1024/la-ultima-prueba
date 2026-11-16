# Reporte de la ola 5b · Sesión B · 15 de noviembre de 2026

Esta sesión hizo las cinco tareas de la lista. Todas están fusionadas en `main`:

| Tarea | Qué es | PR |
| --- | --- | --- |
| **T92b** | Las poses y señales (`dir`) no vuelven a quien las envía | [#115](https://github.com/Jssosaa1024/la-ultima-prueba/pull/115) |
| **T88b** | La pista nueva llega a todos en el momento en que el anfitrión la ofrece | [#117](https://github.com/Jssosaa1024/la-ultima-prueba/pull/117) |
| **T02b** | CSP en `public/_headers`, sin `'unsafe-inline'` ni `'unsafe-eval'` | [#121](https://github.com/Jssosaa1024/la-ultima-prueba/pull/121) |
| **T98** | Contadores de uso sin cookies ni datos personales | [#122](https://github.com/Jssosaa1024/la-ultima-prueba/pull/122) |
| **T100a · T102a** | Guías del piloto y del lanzamiento (solo documentos) | [#123](https://github.com/Jssosaa1024/la-ultima-prueba/pull/123) |

Las tareas 1, 2, 3 y 5 eran nuevas y no tenían número: les puse uno con la letra siguiente libre y quedaron marcadas como hechas en la especificación. T100 (el piloto) y T102 (la publicación) siguen abiertas: las hace Alex.

Resumen honesto: **nada se probó en un celular real ni con un Supabase real** (todavía no hay proyecto). Todo se comprobó con pruebas de unidad, e2e (Pixel 5 emulado en horizontal y Chrome de escritorio) y la vista previa de Cloudflare de cada PR con código.

## 1. Qué hice

### T92b · Las poses no vuelven a quien las envía (#115)

- Supabase solo deja elegir `self` para todo el canal, no por tipo de mensaje. El canal pasa a `self: false`.
- `int` y `evt` siguen llegando a quien los envía: el transporte se los entrega a sí mismo en el navegador cuando el servidor confirma (`ack`). El anfitrión y las copias funcionan igual. Las redes de prueba (memoria y pestañas) hacen lo mismo.
- Como ya nada vuelve por Supabase, también `int` y `evt` cuestan una entrega menos.
- `npm run prueba-carga` cuenta sin eco y muestra la cuenta de antes:

| Partidas de 4 | Pico de eventos/s | Antes, con eco | Plan Free (100/s) |
| --- | --- | --- | --- |
| 1 | 36 | 45 | cabe (36 %) |
| 2 | 60 | 75 | cabe (60 %) |
| 3 | 96 | 120 | cabe, al borde (96 %) |
| 5 | 132 | 165 | no cabe |

El máximo sigue en 2 partidas simultáneas: con 3 queda muy al borde.

### T88b · La pista llega en el momento (#117)

- Cuando el anfitrión ofrece una pista nueva (por tiempo o por intentos), difunde la foto de la partida en ese instante. Antes, los demás la veían hasta con 15 s de retraso.
- Usa la foto que ya existe: el protocolo no cambia. Sin pista nueva no sale ninguna foto extra.
- Tres pruebas de unidad; comprobé que las dos principales fallan sin el cambio. La sesión C agregó después la e2e (T88c, #119).

### T02b · CSP (#121)

- **La política pedida**, en la sección `/*` de `public/_headers`. Agregué `style-src 'self'`, que no estaba en la lista: sin ella, `default-src 'self'` bloquea los estilos en línea que deja Astro.
- **Hashes en vez de `'unsafe-inline'`.** Astro deja en el HTML el registro del service worker, dos scripts de la isla del juego y el CSS pequeño de cada página. La integración `scripts/csp/` calcula sus hashes al terminar el build y los agrega a `dist/_headers`. Si una página tiene algo en línea que un hash no cubre (`onclick=`, `style="…"`, `javascript:`), el build falla.
- **`astro preview` envía la misma cabecera**, así toda la suite e2e corre con la CSP real.
- **Tres bloqueos que encontró la suite y arreglé:**
  1. El transcodificador de texturas KTX2 de three (Basis, compilado con Emscripten) crea funciones con `new Function`, que exige `'unsafe-eval'`. Con la CSP, las texturas no cargaban. Ahora se usa una copia sin eso, generada con `npm run basis-sin-eval`. Una prueba comprueba que transcodifica las texturas del cubo de prueba byte por byte igual que el original, y falla si la copia queda vieja al actualizar three.
  2. La prueba de estrés (eje Texturas) tenía su propio cargador KTX2. Ahora usa la misma copia, y una prueba revisa que todo `KTX2Loader` la use.
  3. Zod entraba al bundle del juego por un import de `LUGARES`, y su prueba de `Function('')` generaba un aviso de la CSP. La lista pasó a `src/content/lugares.ts`: el bundle ya no lleva zod.
- **Vista previa revisada en el navegador:** la cabecera llega con los hashes, la sala 1 arranca sin violaciones ni errores en la consola, el GLB de prueba carga sus texturas y el service worker se registra.

### T98 · Contadores de uso (#122)

- Una tabla de totales por día en Supabase y la función `contar_evento`, que solo suma 1. El juego no puede leer, borrar ni cambiar la tabla.
- **Lista cerrada**, la misma en el SQL y en `src/game/analitica.ts`:
  - `partida_iniciada`;
  - `sala_resuelta`, con la sala (`s1` a `s5`);
  - `partida_terminada`, con los minutos jugados en rangos de 10.

  Cada uno en modo `solo` o `grupo`. Sin id de jugador, código de partida, IP ni texto libre.
- **Cuándo cuenta:** al empezar una partida nueva (continuar una guardada no cuenta otro inicio), con cada sello nuevo y al llegar a un final. En grupo cuenta solo el anfitrión. Sin variables de Supabase no envía nada.
- Paso 9 en `docs/supabase.md` y la sección de datos de `/docentes` al día.

### T100a y T102a · Guías (solo documentos)

- `docs/piloto.md`: el piloto con un grupo de grado 10. Incluye antes, durante (guion y qué hacer si algo falla), la hoja de observación con códigos en vez de nombres, las preguntas de cierre sin datos personales y qué hacer después.
- `docs/lanzamiento.md`: el lanzamiento. Incluye el dominio en Cloudflare Pages, las reglas de la versión de contenido, la etiqueta `v1.0.0`, la lista para revisar producción y cómo volver atrás.

## 2. Qué decidí (Alex puede cambiarlo)

1. **`self: false` para todo el canal** (T92b): Supabase no permite otra cosa. Para el juego no cambia nada; en la cuenta de eventos, `int` y `evt` también bajan.
2. **La pista viaja con la foto completa** (T88b), no con un evento nuevo, para no cambiar el protocolo ni su versión. Son pocas veces por sala.
3. **`style-src 'self'` más hashes** (T02b), aunque no estaba en la lista: era eso o permitir `'unsafe-inline'`.
4. **Copia propia del transcodificador Basis** (T02b) en vez de permitir `'unsafe-eval'`. Se regenera con un comando y una prueba avisa si queda vieja.
5. **Los contadores son por día** (T98) y en grupo solo cuenta el anfitrión. Cualquiera con la clave pública podría sumar a un contador: no hay forma de evitarlo sin servidor propio, así que son una guía, no una cifra exacta.
6. **Archivos compartidos que toqué, lo mínimo:**
   - `astro.config.mjs` (la integración de la CSP);
   - `package.json` (el script `basis-sin-eval`);
   - `eslint.config.js` y `.prettierignore` (ignoran la copia generada);
   - `AGENTS.md` (regla 1: Supabase también tiene los contadores);
   - `src/ui/IslaJuego.tsx` (una línea que arranca la analítica);
   - `src/content/esquema-salas.ts` y dos imports del motor (`LUGARES`);
   - `src/debug/estres/cargas.ts` (el cargador KTX2 de la prueba de estrés).

## 3. Qué quedó incompleto

- **Nada se probó con Supabase real.** El cambio de `self` (T92b) y los contadores (T98) se probaron con clientes simulados.
- **`/docentes` dice en «Para quién es» que el cooperativo está en construcción.** No lo cambié porque la tarea era la parte de los datos.
- **La CSP no corre en `astro dev`**: Vite necesita scripts en línea para recargar en caliente. Se prueba con `astro preview`, las e2e y la vista previa de Cloudflare.

## 4. Qué debe hacer Alex

1. **Cuando cree el proyecto de Supabase** (`docs/supabase.md`), hacer también el **paso 9**: pegar el SQL de los contadores (unos 3 minutos).
2. **Leer `docs/piloto.md`** y conseguir el permiso del colegio y la fecha del piloto.
3. **Después del piloto**, seguir `docs/lanzamiento.md`: dominio, etiqueta `v1.0.0` y revisión de producción con dos celulares.

## 5. Pruebas y equipo

- **Cada PR con código** pasó formato, lint, tipos, las pruebas de unidad y las e2e de lo que tocaba, con el candado (`candado-pruebas.txt`, letra B), un navegador y prioridad baja. Luego esperé su vista previa de Cloudflare antes de fusionarlo. El de documentos usó `[skip ci]`.
- **Pruebas de unidad:** de 874 a 912 en `main`.
- **E2e por PR:**
  - T92b: `coop-poses` y `coop-senal`, 2 de 2.
  - T88b: sin e2e propia; la cubre la suite final.
  - T98: `docentes`, `humo` y `csp`, 30 de 30.
- **T02b corrió la suite completa con la CSP:** 233 pasaron y 2 fallaron (el eje Texturas de la prueba de estrés, bloqueado por la CSP). Lo corregí y al repetir `estres` y `csp` pasaron 18 de 18.
- **Suite completa final sobre `main`**, con las cinco tareas: **235 pasaron, 0 fallaron y 21 se saltaron (24,7 min)**. Las saltadas son las que no corren en ese perfil (el cooperativo en escritorio, el teclado en celular, girar el teléfono en escritorio).
- **Equipo:** un `astro preview` mío de depuración quedó vivo y bloqueó una corrida. Astro 7 permite uno solo por carpeta del proyecto. Lo cerré y lo dejé anotado en la memoria de la sesión.
