@AGENTS.md

# CLAUDE.md — cómo trabajar en este repo

Las reglas del juego, el stack y el presupuesto están en `AGENTS.md` (importado arriba) y en `docs/especificacion-tecnica.md`. Este archivo dice **cómo** se trabaja cada tarea.

## Quién revisa

Alex dirige el proyecto y está aprendiendo git. No escribe código: revisa la vista previa y fusiona el PR desde GitHub. Por eso:

- Escribe en español de Colombia: commits, PR, comentarios y textos del juego.
- Explica el resultado en lenguaje sencillo. Si Alex tiene que hacer algo, dale los pasos exactos.
- Nunca le pidas que corra comandos que tú puedes correr.

## Una tarea, una rama, un PR

1. Lee la tarea en `docs/especificacion-tecnica.md` (sección 4) y todo lo que diga de ella. Haz solo esa tarea: nada de «ya que estaba» en otros archivos.
2. Parte de `main` actualizado. Rama: `tNN-descripcion-corta` (ej.: `t07-ktx2`). Si el entorno impone otro nombre, úsalo.
3. Commits pequeños en español que empiecen con el id: `T07: añade ETC1S y UASTC al pipeline`.
4. Antes del PR, corre y deja en verde:
   - `npm run verify` (formato, lint, tipos, tests de unidad y build)
   - `npm run test:e2e` si tocaste algo de `src/` o de páginas
   - los checks que ya existan (`check-budget` desde T09, `check-credits` desde T11h, `check-audio` desde T11j)

   **Ahorro de builds en Cloudflare (plan gratis: 500 builds al mes, 1 a la vez).**
   - Las pruebas corren en local (`npm run verify`, `npm run test:e2e`), no en Cloudflare. Cloudflare solo construye la vista previa.
   - Haz tus commits en local y sube con `git push` una sola vez, cuando todo esté en verde y vayas a abrir el PR. Si después corriges algo, junta las correcciones en un solo push.
   - Usa `[skip ci]` en el mensaje de commit solo si el PR completo toca únicamente archivos de `docs/` o `*.md`. Nunca en un PR que cambie código, configuración o `public/`, ni en el último commit de un PR con código, porque ese PR se quedaría sin vista previa actualizada.

5. Abre el PR contra `main` con título `TNN · <nombre de la tarea>` y en el cuerpo:
   - qué hiciste, en 3 a 6 viñetas
   - cómo probarlo en la vista previa (`https://<rama>.la-ultima-prueba-duz.pages.dev/...`), paso a paso y pensado para un celular
   - qué quedó pendiente o qué necesita a Alex (celular real, Blender, descargar un asset)
6. Marca la tarea como hecha (`- [x]`) en la especificación dentro del mismo PR.
7. No fusiones el PR tú mismo. Alex lo fusiona.

## Trabajo en paralelo

Puede haber varias sesiones a la vez, cada una con su tarea. Para no chocar:

- No reformatees ni muevas archivos que tu tarea no necesita.
- Si tienes que tocar un archivo compartido (`package.json`, `astro.config.mjs`, `AGENTS.md`, `src/signals/`), cambia solo lo mínimo y dilo en el PR.
- Dependencias nuevas: versión exacta y probada, y explica en el PR para qué sirve.
- Si tu tarea depende de otra que aún no está en `main`, para y dilo en vez de reescribirla.

## Lo que no puedes hacer tú

Estas tareas necesitan a Alex; prepara todo lo posible y deja en el PR los pasos exactos:

- Medir en el celular de referencia o en un iPhone real.
- Usar Blender (colisiones, horneado de lightmaps, exportación).
- Descargar assets con licencia o generar en Meshy/ElevenLabs, y guardar la captura de la licencia.
- Crear el proyecto de Supabase o cualquier cuenta o clave.

## Seguridad (XSS y datos)

- Nada de `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, `set:html` de Astro ni `dangerouslySetInnerHTML` de Preact. Muestra texto con JSX normal, que ya escapa.
- Todo lo que venga de fuera del bundle es texto no confiable: parámetros de la URL (`?codigo=`, `?debug=`, `?lab=`), `localStorage` y mensajes de Supabase. Valídalo con una lista o expresión estricta antes de usarlo (ej.: el código de partida solo `^[A-Z0-9]{4}$`) y nunca lo pongas en HTML, URLs ni selectores sin validar.
- Por la red solo viajan ids (preguntas, objetos, alias de la lista), nunca texto libre.
- No agregues scripts de terceros ni CDN: todo se sirve desde el propio sitio.
- Ninguna clave en el repo ni en los logs. Solo `PUBLIC_*` de Supabase.

## Contexto que manda sobre los docs viejos

- El juego **no tiene relación con el ICFES ni con Saber 11**. Público: grado 9 en adelante, con foco en grado 10. Si un doc o un campo dice lo contrario, no lo copies; avísalo en el PR.
