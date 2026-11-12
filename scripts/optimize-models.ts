/**
 * optimize-models (T06): aplica la etapa común a uno o varios modelos .glb/.gltf.
 *
 *   npm run optimize-models -- <entrada> <salida> [--sin-instance]
 *
 * <entrada> es un archivo o una carpeta (se buscan .glb y .gltf dentro, también en subcarpetas).
 * <salida> es la carpeta donde se escriben los .glb optimizados, con el mismo nombre.
 * Al final imprime un informe con triángulos, draw calls y peso antes y después.
 */
import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { aplicarEtapaComun, crearIO, medir } from './modelos/etapa-comun.ts';
import type { Medidas } from './modelos/etapa-comun.ts';

const AYUDA = `Uso: npm run optimize-models -- <entrada> <salida> [--sin-instance]

  <entrada>       archivo .glb/.gltf o carpeta con modelos
  <salida>        carpeta donde se guardan los .glb optimizados
  --sin-instance  no crea instancias GPU (para escenas con lightmap)`;

interface Fila {
  archivo: string;
  antes: Medidas & { bytes: number };
  despues: Medidas & { bytes: number };
}

async function buscarModelos(entrada: string): Promise<string[]> {
  const info = await stat(entrada);
  if (info.isFile()) return [entrada];
  const encontrados = await readdir(entrada, { recursive: true });
  return encontrados
    .filter((nombre) => /\.(glb|gltf)$/i.test(nombre))
    .map((nombre) => path.join(entrada, nombre))
    .sort();
}

async function pesoEnDisco(archivo: string): Promise<number> {
  // Un .gltf trae búferes y texturas aparte; se cuenta solo el archivo principal.
  return (await stat(archivo)).size;
}

const kb = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KB`;
const cambio = (antes: number, despues: number): string =>
  antes === 0 ? '' : ` (${Math.round(((despues - antes) / antes) * 100)} %)`;

async function principal(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { 'sin-instance': { type: 'boolean', default: false } },
  });
  const [entrada, salida] = positionals;
  if (!entrada || !salida) {
    console.error(AYUDA);
    return 1;
  }

  const modelos = await buscarModelos(entrada);
  if (modelos.length === 0) {
    console.error(`No encontré archivos .glb ni .gltf en ${entrada}`);
    return 1;
  }

  const io = await crearIO();
  await mkdir(salida, { recursive: true });
  const filas: Fila[] = [];

  for (const archivo of modelos) {
    const documento = await io.read(archivo);
    const antes = { ...medir(documento), bytes: await pesoEnDisco(archivo) };
    await aplicarEtapaComun(documento, { instanciar: !values['sin-instance'] });
    const destino = path.join(salida, `${path.parse(archivo).name}.glb`);
    await io.write(destino, documento);
    const despues = { ...medir(documento), bytes: await pesoEnDisco(destino) };
    filas.push({ archivo: path.relative(process.cwd(), destino), antes, despues });
  }

  console.log('\nInforme de optimize-models\n');
  for (const { archivo, antes, despues } of filas) {
    console.log(archivo);
    console.log(
      `  peso        ${kb(antes.bytes)} → ${kb(despues.bytes)}${cambio(antes.bytes, despues.bytes)}`,
    );
    console.log(`  triángulos  ${antes.triangulos} → ${despues.triangulos}`);
    console.log(`  draw calls  ${antes.drawCalls} → ${despues.drawCalls}`);
    console.log(`  mallas      ${antes.mallas} → ${despues.mallas}`);
    console.log(`  materiales  ${antes.materiales} → ${despues.materiales}`);
  }
  const total = (lado: 'antes' | 'despues'): number =>
    filas.reduce((suma, fila) => suma + fila[lado].bytes, 0);
  console.log(
    `\nTotal: ${filas.length} modelo(s), ${kb(total('antes'))} → ${kb(total('despues'))}${cambio(total('antes'), total('despues'))}`,
  );
  return 0;
}

process.exitCode = await principal();
