import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Ola 6: los esquemas de `src/content/` usan zod, que al cargar prueba `Function('')` y la CSP
// (T02b) lo bloquea como «script-src eval». Solo el build los usa (`content.config.ts` y las
// páginas): el código que corre en el navegador solo puede importar sus TIPOS.

const raiz = join(import.meta.dirname, '../..');

function archivos(carpeta: string): string[] {
  return readdirSync(join(raiz, carpeta), { withFileTypes: true }).flatMap((e) => {
    const ruta = `${carpeta}/${e.name}`;
    if (e.isDirectory()) return archivos(ruta);
    return /\.(?:ts|tsx)$/.test(e.name) ? [ruta] : [];
  });
}

/** Código del navegador: todo `src/` menos los esquemas mismos y la configuración del build. */
const DEL_NAVEGADOR = archivos('src').filter(
  (a) => !/^src\/content\/esquema[^/]*\.ts$/.test(a) && a !== 'src/content.config.ts',
);

/** `import … from '…'` y `export … from '…'` que no son solo de tipos. */
const IMPORTACION = /^\s*(?:import|export)\s+(?!type\b)([\s\S]*?)\sfrom\s+['"]([^'"]+)['"]/gm;
const CON_ZOD = /(?:^|\/)esquema[^/]*$|^(?:astro\/)?zod$/;

describe('zod no entra al bundle del juego', () => {
  it('ningún archivo del navegador importa valores de un esquema ni de zod', () => {
    const malos: string[] = [];
    for (const archivo of DEL_NAVEGADOR) {
      const texto = readFileSync(join(raiz, archivo), 'utf8');
      for (const m of texto.matchAll(IMPORTACION)) {
        const ruta = m[2] ?? '';
        if (CON_ZOD.test(ruta)) malos.push(`${archivo}: ${ruta}`);
      }
    }
    expect(malos).toEqual([]);
  });

  it('la regla detecta un import de valor y deja pasar el de tipos', () => {
    const ejemplo = [
      "import { METROS } from '../../content/esquema-salas';",
      "import type { Sala } from '../../content/esquema-salas';",
      "import { z } from 'astro/zod';",
    ].join('\n');
    const rutas = [...ejemplo.matchAll(IMPORTACION)]
      .map((m) => m[2])
      .filter((r) => CON_ZOD.test(r ?? ''));
    expect(rutas).toEqual(['../../content/esquema-salas', 'astro/zod']);
  });
});
