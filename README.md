# La Última Prueba

Escape room 3D de matemáticas (grados 9 a 11) para el navegador. Reglas para agentes: [AGENTS.md](AGENTS.md). Especificación: [docs/especificacion-tecnica.md](docs/especificacion-tecnica.md).

## Requisitos

- Node.js 22 LTS o más reciente (22.12 como mínimo).

## Comandos

| Comando                                         | Qué hace                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------ |
| `npm install`                                   | Instala las dependencias                                                       |
| `npm run dev`                                   | Abre el sitio en `http://localhost:4321`                                       |
| `npm run build`                                 | Revisa los tipos y genera el sitio estático en `dist/`                         |
| `npm run lint`                                  | ESLint                                                                         |
| `npm run format`                                | Formatea el código con Prettier                                                |
| `npm run verify`                                | Formato, lint, tipos y build: todo lo que debe pasar                           |
| `npm run optimize-models -- <entrada> <salida>` | Limpia y comprime modelos 3D (dedup, prune, weld, instance, quantize, meshopt) |
