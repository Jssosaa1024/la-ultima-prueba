# Reporte de la ola 6 · fase 1 · Sesión B · 16 de noviembre de 2026

Esta sesión hizo las cinco tareas de la lista. Todas están fusionadas en `main`:

| Tarea | Qué es | PR |
| --- | --- | --- |
| **T19d** | Campo opcional `modelo` en los objetos de `salas.json` (lo necesitaba la sesión A) | [#125](https://github.com/Jssosaa1024/la-ultima-prueba/pull/125) |
| **T99b** | `/docentes` explica el cooperativo; ya no dice «en construcción» | [#126](https://github.com/Jssosaa1024/la-ultima-prueba/pull/126) |
| **T11s · T11sb** | `docs/arte-cc0.md`, reglas sin Blender ni luz horneada y Git LFS para `art/` | [#128](https://github.com/Jssosaa1024/la-ultima-prueba/pull/128) |

Las tareas 2, 3 y 4 de la lista van juntas en un PR, porque las tres son el paso a CC0. Las nuevas tienen número con la letra siguiente libre.

Resumen honesto:

- **No bajé ningún asset.** Los nombres de archivo salen de listados públicos de los paquetes; no vi las vistas previas de los modelos.
- **No probé nada en un celular real.**
- **Hay un problema de licencia con Quaternius** (punto 2.1): lo dejé en pausa.

## 1. Qué hice

### T19d · Campo `modelo` (#125)

- Cada objeto de `src/content/salas.json` puede llevar `modelo`: el nombre del GLB en `public/assets/salas/<sala>/` sin hash ni `.glb`. Por ejemplo, `mostrador` → `salas/s1-cooperativa/mostrador.<hash>.glb`.
- Solo acepta minúsculas, números y guiones: nada de rutas, extensiones ni hashes.
- La primitiva sigue siendo la caja que choca y el respaldo si el modelo no carga.
- Tres pruebas de unidad. Se lo avisé a la sesión A, que hace la carga en el motor (T19e).

### T99b · `/docentes` (#126)

- La viñeta del cooperativo explica cómo se juega en grupo:
  - de 2 a 4 estudiantes, cada uno con su celular;
  - uno toca «Crear partida» y los demás entran con «Unirse con código» y el código de cuatro caracteres;
  - el grupo vota cuándo cambiar de sala o pedir ayuda.
- La e2e de `/docentes` revisa el texto nuevo.

### T11s · `docs/arte-cc0.md` (#128)

- Para la portería y cada sala hay una tabla con cada objeto visible (de `salas.json` y de `src/engine/mecanismos/`). Cada fila dice qué lo reemplaza:
  - un modelo de Kenney, con paquete, nombre exacto del archivo, triángulos e id propuesto para `modelo`;
  - o «primitiva», con la razón.
- **Solo 3 paquetes:** Furniture Kit, Mini Shop y Factory Kit. Los tres dicen «License: Creative Commons CC0» en su página (lo revisé hoy).
- **5 texturas de ambientCG** (CC0): baldosa, piso de gimnasio, parqué, pañete y cielo raso. Tienen ids `compartido/<nombre>`, acordados con la sesión A.
- **Presupuesto:** ninguna sala pasa de 1 MB ni de 15.000 triángulos según la estimación (límites: 2 MB y 90.000). El riesgo son las draw calls: el Furniture Kit trae un material por color. Para eso están `join`, `instance` y `palette` en el perfil `kenney`.
- Arriba hay una lista para Alex: qué bajar, a qué carpeta y qué captura guardar.

### T11sb · Reglas y Git LFS (#128)

- `AGENTS.md` y la especificación:
  - la tabla de fuentes pasa a Kenney CC0 (con Quaternius en pausa);
  - el pipeline ya no tiene paso de Blender;
  - sin lightmap: Lambert con luz hemisférica y linterna;
  - los perfiles quedan `kenney`, `quaternius`, `ambientcg` (e `ia-imagen`, sin uso planeado).
- **Tareas canceladas, tachadas en la especificación:** T11c, T11d, T11f, T11t, T11u y T11v (Meshy, Sketchfab, Poly Haven y Blender); T16 (colisiones desde Blender); y T48, T55, T61, T67 y T73 (lightmaps).
- **T11e** pasa a ser «perfiles Quaternius y ambientCG».
- `scripts/creditos/esquema.ts` acepta la fuente `quaternius`, con su prueba.
- `.gitattributes` manda por Git LFS los zips, modelos, imágenes y audio que estén bajo `art/`, en mayúsculas o minúsculas. `public/` y los textos de `art/` quedan fuera. Una prueba lo revisa con `git check-attr`.

## 2. Qué decidí (Alex puede cambiarlo)

### 2.1 Quaternius, en pausa

Desde el 28 de agosto de 2026, <https://quaternius.com/license.html> publica la **Quaternius Asset License (QAL) v1.0**, que no es CC0:

- permite usar los assets gratis y sin crédito;
- prohíbe redistribuirlos como assets, sin importar de qué sitio se bajaron.

Las páginas de los paquetes todavía dicen CC0. Como el repositorio es público y `art/` guarda los originales, subir un zip de Quaternius podría contar como redistribuirlo. Además, QAL no está en la lista de `check-credits`.

Por otro lado, Quaternius casi no aporta: no tiene nada para el gimnasio, ni caja fuerte, registradora, casilleros, reloj ni linterna.

**Recomiendo no usarlo.** Lo que Kenney no tiene se queda como la primitiva que ya existe.

### 2.2 Otras decisiones

1. **Primitivas que se quedan:**
   - los planos que se leen en 2D;
   - lo que Kenney no tiene (reloj, linterna, campana, polea, postes, balones);
   - lo que una máquina anima con su forma actual (tanques, caja fuerte, urna, carritos);
   - la taza y las graderías, para no bajar un paquete por un solo objeto (Food Kit y Racing Kit).
2. **Los paquetes van a `art/compartido/originales/`**, no a `art/<sala>/originales/`: cada uno sirve a varias salas y así no se duplica en LFS.
3. **`/docentes` describe el cooperativo** aunque producción todavía no tiene Supabase (punto 4).
4. **Archivos compartidos que toqué, lo mínimo:**
   - `AGENTS.md` (tabla de fuentes, pipeline, presupuesto de luces y texturas);
   - `.gitattributes`;
   - `scripts/creditos/esquema.ts` (una fuente más).
5. **No toqué `CLAUDE.md`**, aunque su lista «Lo que no puedes hacer tú» todavía nombra el horneado de lightmaps en Blender.

## 3. Cómo se probó

- **Cada PR con código** pasó:
  - formato, lint, tipos y las pruebas de unidad (de 915 a 918);
  - los checks de créditos, presupuesto y audio;
  - el build;
  - las e2e de lo que tocaba (`/docentes`: 6 de 6, en celular y escritorio).

  Todo corrió con el candado (`candado-pruebas.txt`, letra B), un solo navegador, prioridad baja y en un worktree aparte. Antes de fusionar revisé el build local con `astro preview`.
- **Después de cada fusión**, el despliegue de `main` cargó `/jugar/` con el menú completo y sin errores en la consola.
- **Sin vista previa de Cloudflare** (regla nueva): una sola subida por PR.

## 4. Qué debe hacer Alex

1. **Bajar los paquetes** de la lista de arriba de `docs/arte-cc0.md` (T11sa): 3 de Kenney y 5 texturas, con sus capturas.
   - Antes, mira las vistas previas. El Furniture Kit (2018, colores planos) puede verse distinto de Mini Shop y Factory Kit (2024–2026).
   - Revisa también si las puertas del Furniture Kit traen la hoja.
2. **Decidir sobre Quaternius** (punto 2.1). Mi recomendación es no usarlo.
3. **Supabase en producción.** El bundle publicado no trae ningún proyecto de Supabase, así que el cooperativo en línea muestra «todavía no está disponible». Ahora `/docentes` lo presenta como disponible. Hay que cargar `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY` en Cloudflare Pages (`docs/supabase.md`).
4. **Git LFS:** cada computador que suba algo a `art/` necesita `git lfs install` una vez. GitHub da una cuota gratis de almacenamiento y descarga para LFS: conviene subir solo los paquetes que se usan.
