/**
 * check-budget (T09): falla el build si una sala excede el presupuesto.
 *
 *   npm run check-budget
 *
 * Vuelve a medir public/assets/ (no confía solo en el manifiesto), exige que
 * public/assets/manifest.json esté al día y compara cada sala con los límites
 * de scripts/presupuesto/evaluar.ts. Corre antes de `astro build`.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { generarManifiesto, serializar } from './manifiesto/construir.ts';
import { NOMBRES, evaluarPresupuesto, formatear } from './presupuesto/evaluar.ts';

async function principal(): Promise<number> {
  const { values } = parseArgs({
    options: { raiz: { type: 'string', default: path.join('public', 'assets') } },
  });
  const raiz = values.raiz;
  const archivoManifiesto = path.join(raiz, 'manifest.json');

  const { manifiesto, problemas } = await generarManifiesto(raiz);
  if (problemas.length > 0) {
    console.error('check-budget: hay problemas en los assets:');
    for (const problema of problemas) console.error(`  - ${problema}`);
    return 1;
  }

  const enDisco = await readFile(archivoManifiesto, 'utf8').catch(() => null);
  if (enDisco?.replace(/\r\n/g, '\n') !== serializar(manifiesto)) {
    console.error(
      `check-budget: ${archivoManifiesto} no coincide con los archivos. Corre: npm run build-manifest`,
    );
    return 1;
  }

  const salas = Object.keys(manifiesto.salas);
  if (salas.length === 0) {
    console.log('check-budget: todavía no hay salas en public/assets/; nada que revisar.');
    return 0;
  }

  const { filas, excesos } = evaluarPresupuesto(manifiesto);
  console.log('check-budget: presupuesto por sala\n');
  for (const sala of salas) {
    console.log(sala);
    for (const f of filas.filter((fila) => fila.sala === sala)) {
      const marca = f.ok ? 'ok   ' : 'EXCEDE';
      console.log(
        `  ${marca} ${NOMBRES[f.metrica].padEnd(16)} ${formatear(f.metrica, f.valor).padStart(10)}` +
          ` de ${formatear(f.metrica, f.limite)}`,
      );
    }
  }

  if (excesos.length > 0) {
    console.error(
      '\ncheck-budget: el presupuesto no se cumple. Optimiza el asset; no subas el límite.',
    );
    for (const exceso of excesos) console.error(`  - ${exceso}`);
    return 1;
  }
  console.log('\ncheck-budget: todas las salas cumplen el presupuesto.');
  return 0;
}

process.exitCode = await principal();
