# Reporte de la ola 3 · Sesión B · 15 de noviembre de 2026

La sesión B es dueña de `src/game/`, `src/content/`, `docs/` y las páginas fuera del juego. En esta ola hizo seis cosas, cada una en su rama y su PR:

| Tarea | Qué quedó | PR |
| --- | --- | --- |
| **T34a** (nueva) | El guion de La Voz como contenido validado en build, y un CSV para revisarlo y grabarlo | [#66](https://github.com/Jssosaa1024/la-ultima-prueba/pull/66), fusionado |
| **T40b** (nueva) | El resumen de aprendizaje de cada sala para los finales y la función que dice qué salas se resolvieron y cuáles sin pistas (punto 15 del hito 1, la parte de contenido) | [#72](https://github.com/Jssosaa1024/la-ultima-prueba/pull/72), fusionado |
| **T11g y T11h** | El esquema de `art/credits.json`, la carpeta de evidencias, el crédito dentro de cada GLB y `check-credits` en el build | [#67](https://github.com/Jssosaa1024/la-ultima-prueba/pull/67), fusionado |
| **T99** | La página `/docentes` | [#68](https://github.com/Jssosaa1024/la-ultima-prueba/pull/68), fusionado |
| **T03b** (nueva) | La portada nueva: título, historia, «Jugar» y enlace a la guía | [#69](https://github.com/Jssosaa1024/la-ultima-prueba/pull/69), fusionado |
| Este reporte | | (este PR) |

Resumen honesto: **nada se probó en un celular real.** Todo se comprobó con pruebas de unidad y e2e (Pixel 5 emulado y Chrome de escritorio). La sección 4 dice qué mirar.

## 1. Qué hice

### T34a · El guion de La Voz

- `src/content/guion.json`: 23 líneas con `id`, `texto`, `sala`, `momento`, `duracion_s` y `origen`. Son las 16 de La Voz que trae `docs/salas-y-puzzles.md`, las 3 grabaciones y 4 nuevas, una por final.
- El build falla si una línea es muy larga (más de 6 s o 16 palabras; 20 s en las grabaciones), si su momento no cuadra con la sala, si la duración no corresponde al texto o si falta algo (la entrada o el sello de una sala, una grabación o un final).
- `npm run exportar-guion` escribe `docs/guion-la-voz.csv`. **Alex puede abrirlo en GitHub y se ve como tabla.** Trae el archivo de audio que tendrá cada línea: `public/assets/audio/es-CO/<sala>/<id>.m4a`. Un test falla si el CSV queda viejo.
- Para la sesión C (T34, subtítulos): `lineaPorId()` y `lineasDe(momento, sala)` en `src/content/guion.ts`.

### T40b · Resumen de aprendizaje de los finales

- `src/content/resumenes.json`: para cada sala, el tema, la máquina y cómo funcionaba, en una o dos frases para un estudiante.
- `resumenDeAprendizaje(partida, pistas)` en `src/game/aprendizaje.ts`: las cinco salas, cada una «sin pistas», «con pistas» o «sin resolver», con sus etapas y pistas abiertas. Recibe las pistas como las guarda el controlador.
- La pantalla la hace la sesión C.

### T11g y T11h · Créditos y licencias

- `art/credits.json` (vacío: todavía no se publica nada de fuera), su esquema en `scripts/creditos/esquema.ts` y `art/evidencia/LEEME.md`.
- `optimize-models` escribe el crédito en `asset.copyright` de cada GLB y se niega a escribir en `public/assets/salas/` un modelo sin entrada.
- `npm run check-credits` corre en `build` y `verify`, antes de `astro build`, con todas las reglas de AGENTS.md.

### T99 · `/docentes`

- Qué es, para quién, cuánto dura, qué matemática trabaja cada sala (concepto, proceso del MEN, grado, dificultad, tiempo, lo que se descubre y la intuición que se pone a prueba), cómo usarlo en clase y qué datos guarda: ninguno personal.
- Lo de las salas sale de los JSON de los puzzles: si cambia un puzzle, la guía cambia sola.

### T03b · La portada

- Título, una frase de la historia, botón grande **Jugar** y enlace a la guía para docentes. En horizontal, el texto a la izquierda y los botones a la derecha, sin desplazarse.
- Se borró la demo de T01 (`Contador.tsx` y `signals/demo.ts`).

## 2. Qué decidí yo (Alex no estaba)

1. **Las cuatro líneas de La Voz para los finales las escribí yo** (en el JSON y el CSV dicen `propuesta`):
   - El legado: «Me llamo Tobías Rincón. Treinta y cuatro años, y la última clase la diste tú.»
   - Justo a tiempo: «Ahí está tu memoria. El archivo se va; lo que pensaste aquí se queda.»
   - Pedir ayuda: «Pedir ayuda a tiempo también es pensar. Don Efraín tiene la llave.»
   - Tiempo cumplido: «Las 00:40. Se acabó el reloj, no las ganas de entender.»
2. **La duración de cada línea es una estimación** (2,8 palabras por segundo más medio segundo). Con el audio real se reemplaza.
3. **El final muestra siempre las cinco salas**, también las que no se resolvieron, con su resumen. Era la pregunta del punto 15; lo decidí así porque el diseño dice que todos los finales muestran los cinco temas.
4. **«Sin pistas» es sin abrir ninguna.** Que el juego ofrezca una pista no cuenta.
5. **Sin modo práctica.** Ojo: `src/ui/finales/textos.ts` (de la sesión C) todavía lo promete en dos finales.
6. **T11g y T11h van en un solo PR**, porque la ola las pidió juntas y la segunda usa el esquema de la primera.
7. **`check-credits` tiene tres reglas más** que AGENTS.md, sacadas de la especificación y de la licencia: CC BY exige el enlace a la licencia, lo hecho con IA exige el prompt y la captura anotada debe existir. Las URL de los créditos solo pueden ser `https`.
8. **En `/docentes` dije que el cooperativo «está en construcción»** y propuse cómo usar el juego en una hora de clase. Trata al docente de «usted».
9. **Pruebas e2e: una corrida completa para las cinco ramas juntas.** Con las otras sesiones turnándose el candado, correr la suite de 20 minutos cinco veces habría tomado más de dos horas. La corrí una vez, con `verify`, sobre una rama de integración con las cinco tareas y `main`. Cada rama, por separado, solo pasó por el build de su vista previa en Cloudflare. Antes de subir cada rama traje `main`; lo único nuevo era el #65 de otra sesión, que no toca nada de esto. T40b chocaba con T34a en `src/content.config.ts`: lo resolví igual que en la integración y corrí `verify` otra vez.

## 3. Qué quedó incompleto

- **Los subtítulos (T34) y la voz**: el guion está listo, pero falta la pantalla (sesión C) y grabar con ElevenLabs en plan de pago (Alex).
- **La pantalla del resumen de aprendizaje**: la hace la sesión C con `resumenDeAprendizaje()` y `textoResumen()`.
- **`/creditos` (T11i)**: no era de esta ola. El manifiesto ya existe para generarla.
- **Git LFS para `art/`** no está configurado.

## 4. Qué debe revisar Alex

1. **El tono de las líneas nuevas de La Voz** (sección 2, punto 1). Están al final de `docs/guion-la-voz.csv`.
2. **Los cinco resúmenes** de `src/content/resumenes.json`: ¿los entiende un estudiante de grado 9?
3. **La guía para docentes** en el celular: https://la-ultima-prueba-duz.pages.dev/docentes/ ¿Le falta algo que un colegio preguntaría?
4. **La portada** en el celular en horizontal: https://la-ultima-prueba-duz.pages.dev/ ¿Se ve todo sin bajar? ¿Invita a jugar?
5. **Al descargar un asset** (T11s a T11x): guardar la captura de la licencia en `art/evidencia/` y pasarme el enlace para anotar la entrada en `art/credits.json`. Sin eso, el build no deja publicar el asset.
6. **Decidir Git LFS** antes de subir archivos `.blend` y WAV a `art/`.

## 5. Pruebas

- **Corrida única sobre la integración de las cinco tareas con `main`** (`PUERTO_E2E=4532 npx playwright test --workers=1`): `npm run verify` en verde con **615 pruebas de unidad**; e2e **155 pasan, 7 saltadas (las de siempre) y 0 fallan**, en 21,3 minutos.
- T40b, después de traer `main` con T34a: `npm run verify` en verde con 616 pruebas de unidad. Después entró a `main` el #70 de otra sesión (la partida solo en horizontal), que no toca esos archivos; lo traje sin conflictos y la vista previa pasó.
- Las cinco vistas previas de Cloudflare (#66 a #69 y #72) pasaron; además revisé que `/docentes` y la portada nueva respondieran en la vista previa antes de fusionar.
- Pruebas nuevas: 20 del guion, 12 del resumen, 26 de créditos, 3 e2e de `/docentes` y 3 de la portada (por perfil).

## 6. El equipo se satura

Alex avisó a mitad de la ola que el computador se estaba saturando. Medí: los 4 núcleos al 100 % y la memoria bien (6,5 de 16 GB). La carga es la suite e2e: el navegador de pruebas dibuja el 3D con el procesador, unos 20 minutos por corrida.

Lo que hice: una sola corrida completa para mis cinco tareas, bajar la prioridad del navegador de pruebas y quitar dos procesos míos que sobraban (una espera duplicada y un segundo turno de pruebas que habría repetido la corrida entera).

Lo que propongo para las tres sesiones (lo decide Alex):

1. La suite completa una vez por lote de PR, no una vez por PR; en cada PR, `verify` y las e2e de lo que se tocó.
2. En cada PR, solo el perfil celular: el de escritorio es el que más procesador gasta.
3. Que la e2e no vuelva a revisar tipos y construir si `verify` ya lo hizo (cambio pequeño en `playwright.config.ts`).
4. Que el motor deje de dibujar con un panel abierto (punto 21 del hito 1).
5. Si no alcanza, dos sesiones a la vez en lugar de tres.

