# Historia · sesión B · El caso de Don Efraín

26 de noviembre de 2026. Alex eligió el misterio «El caso de Don Efraín»: en la feria de ciencias de 1991 acusaron a un estudiante de copiar el proyecto de otro colegio, el profe Tobías Rincón guardó las pruebas y el acusado era Don Efraín, el celador. Los puzzles no cambian: cambia lo que significa resolverlos.

## PR de esta sesión

| PR | Qué trae |
| --- | --- |
| [#192](https://github.com/Jssosaa1024/la-ultima-prueba/pull/192) | `docs/historia.md`: la historia en una página. Alex lo lee primero. |
| este PR | El contenido del juego, este reporte y `docs/escenas.md`. |

## 1 · La historia (`docs/historia.md`)

- **Por qué estás ahí:** vuelves por tu memoria USB la noche antes de tu feria de ciencias. A las 00:40 se borra la carpeta `ULTIMA_PRUEBA`, donde Rincón dejó el expediente de 1991.
- **El caso:** un estudiante de 10-B presentó un filtro de agua para su vereda. Dio el mismo dato que el filtro de otro colegio y el jurado lo sancionó por copia en cuarenta minutos. Rincón, el jurado más nuevo, votó en contra y perdió.
- **Cada sala es una prueba** y cada una desmiente una acusación con la idea matemática de su máquina: el recibo (los descuentos se multiplican), la bitácora (dos rectas distintas se cruzan en un solo punto), la foto de la feria (la sombra da la hora), las fichas de préstamo (la media del año esconde las semanas de estudio) y el acta (contando parejas, «imposible por casualidad» no era cierto).
- **El giro, sin adelantarlo:** el estudiante es siempre «E. C., 10-B». Las migas: el papel del casillero firmado por Don Efraín, las puertas del pasillo («impecable desde hace treinta años», «un puesto quedó vacío en 1991»), la foto («siempre llegaba primero y abría la puerta») y la grabación 3 («está más cerca de lo que crees»). El nombre completo, Efraín Cárdenas, solo sale en los finales y los créditos. Una prueba de unidad lo vigila.
- **Finales:** uno bueno («El legado») y dos malos, cada uno aparte: «Justo a tiempo» (salvas tu proyecto y el de 1991 se pierde) y «Tiempo cumplido». «Pedir ayuda» queda como salida amable. El código de los finales no cambió.
- **Videos** (decisión de Alex): el juego tendrá un trailer, un video de intro y uno por cada final. Los hará otro agente, después; `docs/escenas.md` tiene el guion de cada uno.

## 2 · Contenido

- **La Voz:** 24 líneas reescritas (entrada y sello de cada sala, espera, fallo, cinco sellos, tres grabaciones y tres finales) y 2 nuevas (puertas del 10-B y el 11-A). Quedan iguales «Buenas noches. Llegas tarde…» (la que escogió Alex), la puerta del 11-B y el final de pedir ayuda. Todas cumplen las reglas del guion: menos de 6 s y 16 palabras; las grabaciones, 25 palabras como mucho. Las frases de las puertas no repiten el nombre de la puerta (lo dice el rótulo), para que la tirita del pasillo quede de un renglón en el celular.
- **Prueba en el cuaderno:** cada sello trae una ficha de evidencia a la sección nueva «Expediente 1991» del cuaderno (`src/content/expediente.json`, validado en el build). El aviso del sello lo dice. En el cooperativo todos la ven, porque el avance es del grupo.
- **Siembra en las salas:** el corcho de la cooperativa tiene un recorte de la feria de 1991; la carta de Rincón dice «algo que le debo a alguien desde 1991»; el computador de la rectoría dice qué hay en la carpeta.
- **Finales y salida:** los cuatro textos de final siguen la historia; la puerta de salida explica que al salir se borran las pruebas de 1991.
- **Docs:** `docs/diseno.md`, `docs/salas-y-puzzles.md` (narrativa, tabla del guion y grabaciones) y la página `/docentes` cuentan el caso.

## 3 · Videos de la intro y los finales (`docs/escenas.md`)

Alex decidió que el juego tiene un trailer, un video de intro y un video por cada final; los hace otro agente, después. `docs/escenas.md` trae el guion de texto y de cámara de la intro (unos 45 s, que cuenta el caso de 1991 sin decir quién es el estudiante) y de los cuatro finales, más las reglas para todos: MP4 H.264 + AAC, subtítulos, botón «Saltar», carga aparte y estilo grabado desde el propio juego. La intro necesita 4 frases nuevas de La Voz, que se agregan al guion cuando se haga el video. **Falta decidir** si los videos cuentan para el límite de 3 MB de la primera sala y cómo se acreditan si se hacen con IA. Mientras no existan, el juego empieza en la portería y los finales son pantallas de texto que dicen lo mismo.

## 4 · Créditos

En lugar de los cameos, los créditos son el **expediente 1991-14**: abierto y cerrado el día de la feria, con cada personaje y su papel (Efraín Cárdenas, Tobías Rincón, el jurado y tú). Con «El legado» lleva el sello azul «Reabierto»; con los demás finales, el rojo «Cerrado». El agradecimiento a Don Efraín y la fotocopiadora de los poscréditos siguen.

## 5 · Para la sesión A: 26 líneas por grabar

Están en `POR_GRABAR` (`tests/unit/voz-grabada.test.ts`). A las 24 que cambiaron se les quitó el `.m4a`, el original de `art/audio/voz/originales/` y su entrada en `art/credits.json`, para que el juego no diga la frase vieja con el subtítulo nuevo. Por eso `npm run voz` sin opciones genera justo estas 26. Mientras tanto el juego muestra el subtítulo con su duración estimada.

Portería: `voz-intro-2`, `voz-intro-3`, `voz-final`. Salas: `voz-s1-entrar` a `voz-s5-sello` (10). Cualquier sala: `voz-espera`, `voz-fallo`. Pasillo: `voz-pasillo-profesores`, `voz-pasillo-10a`, `voz-pasillo-aseo` y las nuevas `voz-pasillo-10b`, `voz-pasillo-11a`. Grabaciones: `grab-1`, `grab-2`, `grab-3` (voz de Tobías sin parlante). Finales: `voz-fin-legado`, `voz-fin-justo`, `voz-fin-tiempo`.

## Pruebas

- `format:check`, `lint`, tipos, las 1.273 pruebas de unidad, `check-credits`, `check-audio`, `check-budget` y `astro build`: en verde. Pruebas nuevas: `tests/unit/expediente.test.ts` (las cinco pruebas y que el giro no se adelante) y una en `pasillo.test.ts` (la frase de cada puerta cabe en un renglón).
- E2E de lo tocado, en celular y escritorio: `cuaderno` (con una prueba nueva del expediente), `finales` (los créditos del caso), `grabaciones`, `docentes`, `pasillo-puertas` y `subtitulos`. Todo en verde. La primera corrida encontró dos fallos de verdad, ya corregidos: un texto viejo de la grabación 1 y la frase de la sala de profesores, que no cabía en un renglón. Una prueba de grabaciones falló una vez por tiempo de carga de la sala y pasó al repetirla sola.
- El build tardó 225 s, casi en el límite de 240 s del servidor de las e2e. Por eso corrí las e2e contra el `dist/` ya construido, con una configuración temporal que no se subió.

## Lo que necesita a Alex

- Leer `docs/historia.md` (#192) antes de fusionar el contenido.
- El apellido del estudiante es una propuesta: Cárdenas.
- Las frases de Don Efraín en los finales («Ese era yo», «Mañana llegue temprano a su feria») van como texto. Si las quiere con voz, hace falta otra voz en ElevenLabs.
- Mientras la sesión A no grabe, 26 líneas salen solo con subtítulo.

## Para las otras sesiones

En esta carpeta hay un worktree ajeno, `.claude/worktrees/kind-lalande-80028d`, que hace fallar `npm run lint` y `npm run format:check` (eslint encuentra dos `tsconfig` y prettier revisa sus archivos). Corrí los dos dejando por fuera `.claude/`. No lo borré porque no es de esta sesión.
