# La Última Prueba

Escape room 3D de matemáticas (grados 9 a 11) para el navegador. Reglas para agentes: [AGENTS.md](AGENTS.md). Especificación: [docs/especificacion-tecnica.md](docs/especificacion-tecnica.md).

## Requisitos

- Node.js 22 LTS o más reciente (22.12 como mínimo).
- Para `optimize-models`: [KTX-Software](https://github.com/KhronosGroup/KTX-Software/releases) 4.4.0 o superior, con el comando `ktx` en el PATH.

## Comandos

| Comando                                         | Qué hace                                                                                                                                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install`                                   | Instala las dependencias                                                                                                                                                                                                  |
| `npm run dev`                                   | Abre el sitio en `http://localhost:4321`                                                                                                                                                                                  |
| `npm run build`                                 | Revisa los tipos, corre `check-budget` y genera el sitio estático en `dist/`                                                                                                                                              |
| `npm run lint`                                  | ESLint                                                                                                                                                                                                                    |
| `npm run format`                                | Formatea el código con Prettier                                                                                                                                                                                           |
| `npm run verify`                                | Formato, lint, tipos, tests, `check-budget` y build: todo lo que debe pasar                                                                                                                                               |
| `npm run optimize-models -- <entrada> <salida>` | Limpia y comprime modelos 3D (dedup, prune, weld, instance, quantize, meshopt, KTX2)                                                                                                                                      |
| `npm run build-manifest`                        | Pone el hash en los nombres de `public/assets/salas/` y escribe `public/assets/manifest.json` (hash, bytes y triángulos por sala); con `-- --comprobar` solo revisa que esté al día                                       |
| `npm run check-budget`                          | Falla si una sala de `public/assets/` se pasa del presupuesto (90.000 triángulos, 40 draw calls, 2 MB de descarga, 0,6 MB de audio, 16 MB de texturas en GPU, texturas de máx. 1024 px) o si el manifiesto no está al día |
| `npm run modelo-prueba`                         | Genera `public/assets/pruebas/cubo.glb` (meshopt + KTX2) para la prueba de carga `/jugar?prueba=glb`                                                                                                                      |
