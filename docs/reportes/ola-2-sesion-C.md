# Reporte de la ola 2 · Sesión C · 14 de noviembre de 2026

Esta sesión es dueña de `src/ui/` y `src/signals/`. En esta ola hizo seis tareas, todas fusionadas en `main`:

- T31d · órdenes de los mecanismos: ajustar y accionar ([#47](https://github.com/Jssosaa1024/la-ultima-prueba/pull/47))
- T37 · marco común de los paneles de mecanismo ([#48](https://github.com/Jssosaa1024/la-ultima-prueba/pull/48))
- T38 · panel de pistas y cuaderno al resolver ([#50](https://github.com/Jssosaa1024/la-ultima-prueba/pull/50))
- T70 · sala 5, la urna, con panel y animación 3D ([#53](https://github.com/Jssosaa1024/la-ultima-prueba/pull/53))
- T35d · fichas reales en el juego y fuera `?ejemplo=1` ([#57](https://github.com/Jssosaa1024/la-ultima-prueba/pull/57))
- T76 · volver a salas ya resueltas, con su estado conservado ([#60](https://github.com/Jssosaa1024/la-ultima-prueba/pull/60))

Resumen honesto: **nada de esto se probó en un celular real ni con lector de pantalla.** Lo comprobé con pruebas de unidad (Vitest), con pruebas e2e (Playwright: Pixel 5 emulado y Chrome de escritorio, con WebGL por software) y con una sola captura de la sala 5 en un navegador de escritorio. Además, **las e2e de esta ola no fueron confiables**: casi ninguna corrida completa salió limpia a la primera (ver «Resultado de las pruebas»). La sección 3 dice qué debe revisar una persona.

Lo más importante para quien sigue: con el marco de T37 y las órdenes de T31d, las salas 1, 2, 3 y 5 ya se pueden resolver desde su panel. **Falta la sala 4** (los carritos, T64, de otra sesión): mientras no entre, jugando solo se llega hasta la sala 3, y a la sala 5 solo con una partida guardada puesta a mano.

## 1. Qué hice

### T31d · Órdenes de los mecanismos (#47)

- Orden `ajustar`: el panel envía los ajustes nuevos de la máquina, completos. El controlador los revisa con las reglas de la etapa y, si valen, los publica en `mecanismo` con sus `condiciones`.
- Orden `accionar`: solo responde el objeto que confirma la etapa según el JSON (palanca, polea o manija).
- **Etapas que se accionan:** si los ajustes resuelven, la partida avanza; si no, cuenta un intento para las pistas. Cada vez que se acciona cuenta, aunque los ajustes sean los mismos.
- **Etapas que responden en vivo** (sala 4 y las dos primeras de la sala 3): se resuelven, o cuentan un intento, cuando los ajustes quedan quietos los segundos de la regla (5).
- Signal `resultado`: lo último que respondió la máquina, con los ajustes que tenía, si resolvió y si dio el sello.
- Una prueba de unidad juega una partida completa: cinco sellos y «Justo a tiempo».

**Decisión mía:** en las máquinas en vivo, la etapa no se resuelve en el instante en que los ajustes cumplen, sino al quedar quietos 5 segundos. Es la misma regla de los intentos, y evita resolver una etapa arrastrando un control por todos los valores. Si se siente largo, se cambia el número en los JSON.

### T37 · Marco común de los paneles (#48)

- `src/ui/mecanismos/PanelMecanismo.tsx`: título, «Sala 1 · Etapa 1 de 3», la situación, el botón de accionar, el aviso de las máquinas que responden solas y el paso a la etapa siguiente («Seguir»). Con el sello dice qué puerta se abrió.
- Piezas para los paneles: `Pasos`, `Opciones`, `Respuesta` e `Indicador` (`marco/Controles.tsx`).
- Un archivo por máquina (`src/ui/mecanismos/<mecanismo>/Panel.tsx`). Las sesiones A y B reemplazaron el suyo sin tocar ningún archivo común de la interfaz.
- El controlador abre el panel al usar un objeto de la máquina y lo deja enfocado: al cerrar, el foco vuelve a su botón.

### T38 · Pistas y cuaderno al resolver (#50)

- Botón **Pista nueva** (naranja) o **Pistas** en el HUD, solo cuando la máquina de la sala ya ofreció alguna. Cada pista se abre con «Ver pista», en orden, y solo cuando el jugador quiere.
- Las mismas pistas aparecen al final del panel de la máquina.
- Al resolver una etapa, el panel muestra «Tu cuaderno anotó» con lo que pasó. **El nombre del concepto aparece solo con el sello.**
- El cuaderno tiene la sección «Lo que descubriste», por máquina.
- Signal `avance` (etapas resueltas por sala). El lector de pantalla anuncia «Hay una pista nueva».

**Decisión mía, para que Alex la revise:** lo que el cuaderno anota de cada etapa es el texto `aja` de los JSON de los puzzles, que la especificación describía como «para el docente y el modo práctica». Si el tono no es el de un estudiante, se cambian esos textos en `src/content/puzzles/`.

### T70 · Sala 5, la urna (#53)

- **Panel** (`src/ui/mecanismos/urna/`): dispensadores de fichas azules (redondas) y amarillas (cuadradas), simulador de 100 extracciones sin devolver, «ver parejas» y la respuesta de la caja fuerte al tirar de la manija. Nunca dice «incorrecto»: cuenta las fichas, las parejas y quién gana más veces.
- **Animación 3D** (`src/engine/mecanismos/urna.ts`): las fichas dentro de la urna translúcida (dos mallas instanciadas) y una mano mecánica que baja, saca dos fichas y las muestra cuando se tira de la manija. Espera a que se cierre el panel.
- La rectoría pasa de 10 a 16 mallas; el presupuesto es 40.

**Cómo terminó el PR:** en la primera versión puse un enganche propio en `src/engine/motor.ts`. Mientras lo probaba entró T45 (sesión A) con un enganche general para las animaciones, y los dos chocaban. Quité el mío y pasé la urna a la estructura de A: T70 **no toca `motor.ts`**. Después tuve que mezclar `main` dos veces más (T52 y T58), porque todos registrábamos nuestra animación en la misma lista de `src/engine/mecanismos/index.ts`.

### T35d · Fichas reales y fuera `?ejemplo=1` (#57)

- El controlador llena el signal `fichas` con `src/content/fichas.ts` (sesión B): las fichas de todas las salas, cada una según la etapa de su sala. «Examinar» ya muestra texto de verdad.
- Los papeles que se recogen (la hoja del graficador de ayer y la ficha rota) quedan en «Datos encontrados».
- Se borraron `?ejemplo=1`, `src/signals/ejemplo.ts` y la orden `ejemplo`. La lista `PENDIENTES` de `tests/unit/ids-objetos.test.ts` quedó vacía y la quité.
- Las e2e de HUD, inspección, cuaderno, finales y accesibilidad ahora usan objetos reales y llegan a los finales como en el juego.

### T76 · Volver a salas ya resueltas (#60)

- Signal `maquinaResuelta`: cómo quedó la máquina de la sala actual si ya tiene sello. El panel la muestra bloqueada, con «Esta máquina ya quedó resuelta», y la urna conserva sus fichas en la escena.
- En una sala con sello no se avisa de pistas nuevas ni se abren; las ya abiertas se pueden releer.
- Volver no cambia el sello ni el avance, y la máquina resuelta ya no responde.
- Las grabaciones las recoge T75 (otra sesión). Aquí solo comprobé, con una prueba de unidad, que se puede volver por las tres después de los cinco sellos y llegar a «El legado».
- **La recarga de la sala no necesitó cambios:** las salas se arman por código al entrar. Lo de «desde caché» tendrá sentido cuando haya modelos GLB.

### Archivos de otras sesiones que toqué

| Archivo | De quién | Qué cambié |
| --- | --- | --- |
| `src/engine/mecanismos/urna.ts` | A (carpeta) | Archivo nuevo: la animación de la urna. |
| `src/engine/mecanismos/index.ts` | A | Una línea: registrar la urna en la rectoría. |
| `tests/e2e/escena.ts` | A | Tres opciones nuevas para la partida de prueba: `lugar: 'porteria'`, `datos` y `restanteMs`. |
| `tests/unit/ids-objetos.test.ts` | A | Quité la lista `PENDIENTES`. |
| `docs/especificacion-tecnica.md` | compartido | T31d y T35d (nuevas), y T37, T38, T70 y T76 marcadas como hechas. |

No toqué `src/game/`, `src/content/` ni `src/engine/motor.ts`.

### Resultado de las pruebas

Las tres sesiones corrieron e2e al mismo tiempo casi toda la ola. Con el WebGL por software, el procesador estuvo al 100 %: una corrida que tarda 3 minutos con el equipo libre tardó entre 11 y 31, y cada vez fallaban pruebas distintas por tiempo de espera. Cuatro veces el build ni siquiera terminó dentro de los 4 minutos que espera Playwright.

| PR | `npm run verify` | E2E completas (`--workers=1`, puerto 4523) |
| --- | --- | --- |
| #47 | verde, 387 de unidad | 90 pasan y **8 fallan por tiempo**; las 8 pasaron al repetirlas |
| #48 | verde, 400 de unidad | **Limpia:** 102 pasan, 6 saltadas (corrida con el equipo libre, 3 minutos) |
| #50 | verde, 407 de unidad | 108 pasan y 2 fallan: una prueba de notas que tuve que corregir (ver abajo); corregida, pasó |
| #53 | verde, 435 de unidad | 115 pasan y **1 falla**, siempre «la puerta 2 sigue cerrada…», una prueba mía; sola pasó 6 de 6. **La última mezcla con `main` no se probó con e2e** |
| #57 | verde, 506 de unidad | 119 pasan y **1 falla**: el bloqueo del ratón (T19, de la sesión A); sola pasó |
| #60 | verde, 541 de unidad | 126 pasan y **6 fallan por tiempo** (tanques, grabaciones y una de inspección, en una corrida de 33 minutos); las 6 pasaron al repetirlas |

Qué hice para que mis pruebas aguanten la carga: se acercan a los objetos en lazo cerrado (leyendo la posición) en vez de caminar un tiempo fijo, repiten el toque si no enfoca y, si aun así fallan, dicen la posición, la mirada y el punto tocado.

## 2. Qué quedó incompleto o con riesgo

1. **Falta la sala 4.** El panel de los carritos (T64) está en un PR abierto de otra sesión. Sin él no se puede ganar el cuarto sello, así que jugando no se llega a la sala 5 ni a los finales «Justo a tiempo» y «El legado».
2. **Las e2e locales no dan una señal confiable con tres sesiones a la vez.** Fusioné cinco de los seis PR sin una corrida completa limpia, repitiendo aparte lo que fallaba. Conviene que una sola sesión corra la suite completa sobre `main` con el equipo libre.
3. **La última mezcla de T70 con `main` no se probó con e2e** antes de fusionar. Era una línea (el registro del reflector) sobre un estado donde las 24 pruebas de la partida pasaban; después, las corridas de #57 y #60 la cubrieron.
4. **Las máquinas en vivo tardan 5 segundos en resolver** (decisión de T31d). Nadie lo ha sentido con el dedo. En la sala 3 y en la 4 puede parecer que la máquina no responde.
5. **El texto `aja` como anotación del cuaderno** no lo revisó nadie con ojo de docente.
6. **La urna en 3D la vi una sola vez**, en una captura de escritorio: fichas dentro de la urna translúcida y la mano colgando encima. No vi la mano moverse (está en pruebas de unidad) ni lo vi en un celular. Las fichas miden 5 cm: en una pantalla de teléfono pueden verse muy pequeñas.
7. **La caja fuerte no se abre en 3D** al resolver la sala 5 y no hay sonido.
8. **Todos los objetos con «Usar» de la rectoría abren el mismo panel** (urna, dispensadores, simulador, botón «ver parejas» y caja fuerte).
9. **Estado conservado, a medias.** Al volver a una sala resuelta en la misma sesión, la máquina tiene los ajustes exactos con los que se resolvió. Después de recargar tiene la solución de ejemplo del JSON, porque esos ajustes no se guardan (habría que cambiar `src/game/guardado.ts`). En la urna se nota si se resolvió con 3 azules y 6 amarillas: al recargar aparecen 6 y 3.
10. **Solo comprobé el estado conservado de mi máquina** (la urna) y, en la sala 1, que el panel abre. No revisé cómo se ven al volver las animaciones 3D de las salas 1, 2 y 3, que son de otras sesiones.
11. **Con 20 fichas, «ver parejas» dibuja 190 parejas.** No lo medí en un celular.
12. **Los enlaces con `?ejemplo=1` de los reportes anteriores ya no sirven** (pruebas H3, H5, H6, H8, H10, H11 y H13 de `docs/reportes/sesion-C.md`, y 3.8 de `ola-1-sesion-C.md`). La sección 3 trae los pasos nuevos.
13. **El resumen del final** todavía no dice qué salas se resolvieron sin pistas, aunque el dato ya existe.
14. **El registro de animaciones** (`src/engine/mecanismos/index.ts`) hace chocar a cualquier par de PR que agreguen una sala. Para la interfaz lo evité con un archivo por máquina; en el motor sigue pendiente.

### Errores míos en esta ola

- **Dañé la vista de inspección en producción.** El estilo de las fichas de la urna (T70) usaba la clase `.ficha`, la misma de las fichas de inspección, y las dejaba de 22 px de ancho: el texto salía aplastado, en la inspección y en el cuaderno. Estuvo así desde la fusión de #53 hasta la de #57, donde lo corregí (ahora es `.urna-ficha`) y agregué una prueba que mide el ancho. Las pruebas viejas no lo veían porque solo miraban que el texto existiera.
- **En T38 rompí una prueba mía de notas:** contaba todos los elementos de lista del cuaderno, y T38 agregó otra lista. La corregí en el mismo PR.
- **En T70 escribí primero un enganche propio en el motor** sin mirar que otra sesión estaba haciendo uno general. Costó tres mezclas con `main` y cuatro pushes en un PR.
- **Un script mío vació `src/ui/hud/hud.css`** a mitad de T38. Lo noté enseguida y lo restauré desde git antes de confirmar nada.
- **Mis pruebas e2e caminaban un tiempo fijo**, y con el equipo cargado fallaban. Las reescribí dos veces.

## 3. Qué debe probar una persona en el celular

Todo con **producción**: `https://la-ultima-prueba-duz.pages.dev/jugar/`. Anota el modelo del celular y el navegador. Ninguna de estas pruebas la hice en un dispositivo real. Las máquinas de las salas 1, 2 y 3 son de otras sesiones; aquí solo va lo que pone el marco.

### 3.1 Las fichas se leen bien (lo primero, por el error que tuve)

- **Pasos:**
  1. Toca **Jugar solo** y recoge el **cuaderno** de la silla.
  2. Camina al fondo. A la izquierda de la puerta de salida está el **mural**: tócalo y **Examinar**.
  3. A la derecha, el **casillero** gris: **Examinar**.
  4. Abre el **Cuaderno** y despliega los dos datos.
- **Qué se espera:**
  - el mural abre una hoja clara con la tabla «Huecos del mural» (moneda, gota, balón, libro, llave);
  - el texto ocupa todo el ancho de la hoja, no una columna angosta;
  - en el cuaderno, los dos datos se despliegan con el mismo contenido.
- **Anota:** si la tabla de tres columnas cabe sin desplazar a los lados.

### 3.2 El panel de una máquina (marco de T37)

- **Pasos:**
  1. Entra por la **puerta 1**, toca la **etiquetadora** y **Usar**.
  2. Lee el encabezado y la situación.
  3. Baja la palanca sin poner rodillos.
  4. Resuelve la primera etapa (rodillo −20 %) y baja la palanca.
  5. Toca **Seguir**.
- **Qué se espera:**
  - arriba dice «Sala 1 · Etapa 1 de 3» y el texto del jugo y la pizarra;
  - al bajar la palanca sin resolver, la máquina muestra lo que hizo y la etapa no cambia;
  - al resolver, aparece «La máquina aceptó los ajustes», «Tu cuaderno anotó» y el botón **Seguir**; después, «Etapa 2 de 3».
- **Anota:** si los botones de abajo quedan cómodos para el pulgar y si el panel deja ver algo de la escena.

### 3.3 Pistas (toma 2 minutos)

- **Pasos:**
  1. Dentro de la sala 1, baja la palanca **tres veces** sin resolver.
  2. Mira el final del panel y luego ciérralo.
  3. Toca el botón naranja **Pista nueva** de arriba.
  4. Toca **Ver pista** y cierra.
  5. Sal a la portería y vuelve a entrar.
- **Qué se espera:**
  - a la tercera aparece la sección «Pistas (0 de 3 abiertas)» con el botón **Ver pista**;
  - la pista dice algo para mirar («Mira cuántos pesos quita o pone cada rodillo…»), no una cuenta;
  - después de abrirla, el botón de arriba dice **Pistas**, sin naranja, y no deja abrir la segunda todavía;
  - en la portería el botón desaparece y al volver a la sala sigue ahí.
- **Anota:** si el botón naranja se nota sin estorbar. Si esperas 2 minutos quieto en la sala, también debe aparecer.

### 3.4 El cuaderno anota y nombra el concepto solo al final

- **Pasos:**
  1. Resuelve las tres etapas de la sala 1 (−20 %; +25 %; −50 % y +50 %).
  2. Lee lo que dice el panel en cada una.
  3. Abre el **Cuaderno**.
- **Qué se espera:**
  - en las dos primeras etapas, «Tu cuaderno anotó» dice lo que pasó, sin nombrar el concepto;
  - en la tercera aparece «Lo que acabas de descubrir se llama: El porcentaje como multiplicador» y «Conseguiste el sello de esta sala. En la portería ya se abre la puerta 2»;
  - el cuaderno tiene «Lo que descubriste», con los tres renglones y el concepto.
- **Para Alex:** revisa el tono de los tres renglones; salen del campo `aja` de los puzzles.

### 3.5 Volver a una sala resuelta (T76)

- **Pasos:**
  1. Con la sala 1 resuelta, sal y vuelve a entrar por la puerta 1.
  2. Toca la etiquetadora y **Usar**.
- **Qué se espera:**
  - arriba sigue 1 de 5 sellos;
  - el panel dice «Esta máquina ya quedó resuelta: su sello está en el mural de la portería» y muestra la máquina como quedó, sin botón de palanca;
  - no aparece «Pista nueva».
- **Anota:** cómo se ve la etiquetadora en la escena al volver (es de la sesión A; yo no lo revisé).

### 3.6 La sala 5, con una partida puesta a mano

Mientras no esté la sala 4, a la rectoría solo se llega así. Necesita un computador con Chrome, o un celular conectado a las herramientas de desarrollo:

1. Abre `https://la-ultima-prueba-duz.pages.dev/jugar/`.
2. Abre la consola (F12 → Consola), pega esto y presiona Enter:

```js
localStorage.setItem(
  'la-ultima-prueba:partida',
  JSON.stringify({
    v: 2,
    partida: {
      fase: 'jugando',
      lugar: 's5-rectoria',
      etapas: {
        's1-cooperativa': 3,
        's2-laboratorio': 3,
        's3-gimnasio': 3,
        's4-biblioteca': 3,
        's5-rectoria': 0,
      },
      final: null,
      grabaciones: [],
    },
    restanteMs: 1800000,
    pistas: {},
    mecanismos: {},
    notas: [],
    datos: [],
    inventario: ['porteria-cuaderno'],
  }),
);
```

3. Recarga y toca **Continuar partida**.
4. Toca la **urna** (cilindro translúcido sobre la mesa) y **Usar**.
5. **Etapa 1:** tira de la manija con la urna vacía y lee lo que dice la caja. Pon 3 azules, toca **Simular 100 extracciones** y tira de la manija. **Seguir**.
6. Cierra el panel y mira la escena.
7. **Etapa 2:** prueba con 2 y 2 y tira de la manija. Luego 3 y 1, **Ver parejas**, manija, **Seguir**.
8. **Etapa 3:** 6 azules y 3 amarillas, manija, **Volver a la sala**.

- **Qué se espera:**
  - con la urna vacía, la caja dice cuántas fichas contó y cuántas pide la placa, sin decir «incorrecto»;
  - con 3 azules el simulador da 100 de 100;
  - al cerrar el panel se ven las fichas dentro de la urna y la mano mecánica baja, saca dos y las muestra;
  - con 2 y 2 la caja dice que La Voz gana más veces; con 3 y 1, «ver parejas» da 3 y 3;
  - al final hay 5 sellos, y en la urna quedan las 9 fichas.
- **Anota:** si las fichas se distinguen dentro de la urna y si la mano atraviesa algo. Es lo que menos pude comprobar.

### 3.7 Los finales, con una partida puesta a mano

- **«Tiempo cumplido»:** pega el mismo texto de 3.6 cambiando `restanteMs: 1800000` por `restanteMs: 5000`, recarga y toca **Continuar partida**. A los 5 segundos debe aparecer el final.
- **«Justo a tiempo»:** en el texto de 3.6 cambia `lugar: 's5-rectoria'` por `lugar: 'porteria'` y `'s5-rectoria': 0` por `'s5-rectoria': 3`. Camina al fondo, usa la **puerta de salida** y toca **Salir**. «Restaurar archivo» debe estar desactivado y decir «Faltan 3 grabaciones» y en qué salas.
- **«El legado»:** igual que el anterior, y además cambia `grabaciones: []` por `grabaciones: ['grab-1', 'grab-2', 'grab-3']`. Toca **Restaurar archivo**. Sigue con **Ver créditos**, **Continuar** y **Volver al menú**.
- **«También vale pedir ayuda»:** se puede jugando: el intercomunicador de la pared izquierda de la portería.
- **Qué se espera en todos:** el título del final, el resumen (sellos, grabaciones y tiempo usado) y, al volver al menú, que ya no ofrezca continuar.

### 3.8 Lector de pantalla (TalkBack y VoiceOver)

Reemplaza las pruebas H10 y H11 del primer reporte.

- **Pasos:**
  1. Activa el lector y entra con **Jugar solo**.
  2. Examina el mural del fondo y cierra la ficha.
  3. Entra a la sala 1, abre la etiquetadora y baja la palanca tres veces.
- **Qué se espera:**
  - al cerrar la ficha, el foco vuelve a «Examinar, Mural de sellos, botón»;
  - el panel de la máquina lee el título, la etapa y la situación;
  - al bajar la palanca lee lo que hizo la máquina;
  - a la tercera dice «Hay una pista nueva».

### 3.9 Lo que no hay que probar todavía

Resolver la sala 4 y llegar jugando a la sala 5 o a los finales con cinco sellos: falta el panel de los carritos.

## 4. Para las sesiones A y B

**Signals nuevos** (los escribe solo el controlador, salvo `resultadoVisto`):

| Signal (archivo) | Qué es |
| --- | --- |
| `resultado` (`mecanismo.ts`) | Lo último que respondió una máquina: ajustes, condiciones, si resolvió y si dio el sello |
| `maquinaResuelta` (`mecanismo.ts`) | Con la sala actual ya resuelta, los ajustes con los que quedó su máquina |
| `avance` (`partida.ts`) | Etapas resueltas por sala (0 a 3) |
| `resultadoVisto` (`interfaz.ts`) | Lo escribe el marco: hasta qué resultado resuelto ya se tocó «Seguir» |

**Órdenes nuevas del puente:** `ajustar` y `accionar`. Se fue `ejemplo`.

**Paneles nuevos:** `mecanismo` y `pistas`.

**Tres avisos:**

- **Clases de CSS:** todas las hojas de estilo terminan en un solo archivo. Una clase con nombre corto (`.ficha`, `.opcion`, `.pareja`) puede dañar otra pantalla sin que ninguna prueba lo note. Pongan el nombre de la máquina adelante (`.urna-ficha`). El reflector lo hace bien: cambia `.opcion` solo dentro de `.reflector-muescas`.
- **Al volver a una sala resuelta**, `etapa` y `mecanismo` son `null` y lo que hay es `maquinaResuelta`. El marco le pasa ese estado al panel con `bloqueado`. Si una animación 3D debe verse «como quedó», tiene que leer ese signal o `sellos`.
- **`tests/e2e/escena.ts`** acepta ahora `lugar: 'porteria'`, `datos` y `restanteMs`, para empezar una prueba en la portería con cualquier avance, con datos ya examinados o con el reloj casi en cero.
