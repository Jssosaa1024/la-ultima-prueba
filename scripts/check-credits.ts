/**
 * check-credits (T11h): falla el build si algo publicado no tiene una licencia válida.
 *
 *   npm run check-credits [-- --raiz <carpeta del repositorio>]
 *
 * Revisa que cada archivo bajo public/assets/salas/ y public/assets/audio/ tenga su entrada
 * en art/credits.json y que cumpla las reglas de licencia de AGENTS.md (ver
 * scripts/creditos/reglas.ts). Corre antes de `astro build`.
 */
import { parseArgs } from 'node:util';
import {
  leerManifiestoCreditos,
  listarEvidencias,
  listarPublicados,
  MANIFIESTO_CREDITOS,
} from './creditos/leer.ts';
import { revisarCreditos } from './creditos/reglas.ts';

async function principal(): Promise<number> {
  const { values } = parseArgs({ options: { raiz: { type: 'string', default: '.' } } });
  const raiz = values.raiz;

  const crudo = await leerManifiestoCreditos(raiz);
  if (crudo === null) {
    console.error(`check-credits: no pude leer ${MANIFIESTO_CREDITOS} (falta o no es JSON).`);
    return 1;
  }
  const publicados = await listarPublicados(raiz);
  const { problemas, avisos, creditos } = revisarCreditos(
    crudo,
    publicados,
    await listarEvidencias(raiz),
  );

  for (const aviso of avisos) console.warn(`check-credits: aviso: ${aviso}`);
  if (problemas.length > 0) {
    console.error('check-credits: no se puede publicar:');
    for (const p of problemas) console.error(`  - ${p}`);
    console.error('Anota o corrige la entrada en art/credits.json. No publiques sin licencia.');
    return 1;
  }
  console.log(
    `check-credits: ${publicados.length} archivo(s) publicado(s), ${creditos.length} entrada(s); todo con licencia válida.`,
  );
  return 0;
}

process.exitCode = await principal();
