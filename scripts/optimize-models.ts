/**
 * optimize-models (T06, T07): aplica la etapa común a uno o varios modelos .glb/.gltf.
 * Las texturas se pasan a KTX2 con `ktx` (KTX-Software 4.4.0 o superior en el PATH).
 *
 *   npm run optimize-models -- <entrada> <salida> [--sin-instance]
 *
 * <entrada> es un archivo o una carpeta (se buscan .glb y .gltf dentro, también en subcarpetas).
 * <salida> es la carpeta donde se escriben los .glb optimizados, con el mismo nombre.
 * Al final imprime un informe con triángulos, draw calls y peso antes y después.
 *
 *   npm run optimize-models -- --lista [--sala <carpeta>]
 *
 * T11a: arma lo que dice `art/modelos.json` (piezas de los zips de `art/`) con el perfil de la
 * `fuente` de su crédito (`scripts/perfiles/`) y lo escribe en `public/assets/salas/`.
 *
 * T11g: si el .glb de salida tiene entrada en art/credits.json, su crédito se escribe en
 * `asset.copyright`. Si la salida va a public/assets/salas/ y no tiene entrada, no se escribe
 * nada: primero se anota la licencia.
 */
import { mkdir, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { aplicarEtapaComun, crearIO, medir } from './modelos/etapa-comun.ts';
import { esquemaCreditos, type Credito } from './creditos/esquema.ts';
import { MANIFIESTO_CREDITOS } from './creditos/leer.ts';
import { creditoDe, textoCopyright } from './creditos/reglas.ts';
import type { Medidas } from './modelos/etapa-comun.ts';
import { armarModelo, armarTextura, planear } from './modelos/armar.ts';
import { esModelo, leerLista, LISTA_MODELOS } from './modelos/lista.ts';
import { ExtractorOriginales } from './modelos/zip.ts';
import type { InformeTextura } from './modelos/ktx2.ts';

const AYUDA = `Uso: npm run optimize-models -- <entrada> <salida> [--sin-instance] [--creditos <json>]
     npm run optimize-models -- --lista [--sala <carpeta>]

  <entrada>       archivo .glb/.gltf o carpeta con modelos
  <salida>        carpeta donde se guardan los .glb optimizados
  --sin-instance  no crea instancias GPU
  --creditos      manifiesto de créditos (por defecto, ${MANIFIESTO_CREDITOS})
  --lista         arma lo de art/modelos.json con el perfil de su fuente (T11a)
  --sala          con --lista, solo una carpeta de public/assets/salas/ (porteria, compartido…)`;

/** Lo que se publica y por eso necesita licencia antes de escribirse. */
const esPublicado = (destino: string): boolean =>
  path
    .relative(process.cwd(), destino)
    .split(path.sep)
    .join('/')
    .startsWith('public/assets/salas/');

/** Las entradas de art/credits.json; vacío si todavía no existe. Falla si está mal escrito. */
async function leerCreditos(archivo: string): Promise<Credito[]> {
  const texto = await readFile(archivo, 'utf8').catch(() => null);
  if (texto === null) return [];
  return esquemaCreditos.parse(JSON.parse(texto));
}

interface Fila {
  archivo: string;
  antes: Medidas & { bytes: number };
  despues: Medidas & { bytes: number };
  texturas: InformeTextura[];
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
    options: {
      'sin-instance': { type: 'boolean', default: false },
      creditos: { type: 'string', default: MANIFIESTO_CREDITOS },
      lista: { type: 'boolean', default: false },
      sala: { type: 'string' },
    },
  });
  if (values.lista) return optimizarLista(values.creditos, values.sala);
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

  // Primero la licencia: nada llega a public/assets/salas/ sin su entrada en el manifiesto.
  const creditos = await leerCreditos(values.creditos);
  const destinoDe = (archivo: string): string =>
    path.join(salida, `${path.parse(archivo).name}.glb`);
  const sinCredito = modelos
    .map(destinoDe)
    .filter((d) => esPublicado(d) && !creditoDe(creditos, path.relative(process.cwd(), d)));
  if (sinCredito.length > 0) {
    console.error(`Estos modelos no tienen entrada en ${values.creditos}; anótalos primero:`);
    for (const d of sinCredito) console.error(`  - ${path.relative(process.cwd(), d)}`);
    return 1;
  }

  const io = await crearIO();
  await mkdir(salida, { recursive: true });
  const filas: Fila[] = [];

  for (const archivo of modelos) {
    const documento = await io.read(archivo);
    const antes = { ...medir(documento), bytes: await pesoEnDisco(archivo) };
    const destino = destinoDe(archivo);
    const credito = creditoDe(creditos, path.relative(process.cwd(), destino));
    const texturas = await aplicarEtapaComun(documento, {
      instanciar: !values['sin-instance'],
      ...(credito ? { copyright: textoCopyright(credito) } : {}),
    });
    await io.write(destino, documento);
    const despues = { ...medir(documento), bytes: await pesoEnDisco(destino) };
    filas.push({ archivo: path.relative(process.cwd(), destino), antes, despues, texturas });
  }

  console.log('\nInforme de optimize-models\n');
  for (const { archivo, antes, despues, texturas } of filas) {
    console.log(archivo);
    console.log(
      `  peso        ${kb(antes.bytes)} → ${kb(despues.bytes)}${cambio(antes.bytes, despues.bytes)}`,
    );
    console.log(`  triángulos  ${antes.triangulos} → ${despues.triangulos}`);
    console.log(`  draw calls  ${antes.drawCalls} → ${despues.drawCalls}`);
    console.log(`  mallas      ${antes.mallas} → ${despues.mallas}`);
    console.log(`  materiales  ${antes.materiales} → ${despues.materiales}`);
    for (const t of texturas) {
      console.log(
        `  textura     ${t.nombre}: ${t.antes.ancho}×${t.antes.alto} → ${t.despues.ancho}×${t.despues.alto} ` +
          `${t.modo.toUpperCase()}, ${kb(t.antes.bytes)} → ${kb(t.despues.bytes)}`,
      );
    }
  }
  const total = (lado: 'antes' | 'despues'): number =>
    filas.reduce((suma, fila) => suma + fila[lado].bytes, 0);
  console.log(
    `\nTotal: ${filas.length} modelo(s), ${kb(total('antes'))} → ${kb(total('despues'))}${cambio(total('antes'), total('despues'))}`,
  );
  return 0;
}

/** `--lista` (T11a): arma lo de `art/modelos.json` con el perfil de cada fuente. */
async function optimizarLista(archivoCreditos: string, carpeta?: string): Promise<number> {
  const raiz = process.cwd();
  const lista = await leerLista();
  const { planes, problemas } = planear(lista, await leerCreditos(archivoCreditos), carpeta);
  if (problemas.length > 0) {
    console.error(`No se escribió nada:\n${problemas.map((p) => `  - ${p}`).join('\n')}`);
    return 1;
  }
  if (planes.length === 0) {
    console.error(`No hay nada que armar${carpeta ? ` para ${carpeta}` : ''} en ${LISTA_MODELOS}`);
    return 1;
  }

  const io = await crearIO();
  const extractor = new ExtractorOriginales(raiz);
  let bytes = 0;
  try {
    console.log(`\nInforme de optimize-models --lista${carpeta ? ` (${carpeta})` : ''}\n`);
    for (const { entrada, credito } of planes) {
      if (esModelo(entrada)) {
        const f = await armarModelo(entrada, credito, io, extractor, raiz);
        bytes += f.despues.bytes;
        console.log(f.archivo);
        console.log(`  peso        ${kb(f.despues.bytes)}`);
        console.log(`  triángulos  ${f.antes.triangulos} → ${f.despues.triangulos}`);
        console.log(`  draw calls  ${f.antes.drawCalls} → ${f.despues.drawCalls}`);
        console.log(`  materiales  ${f.antes.materiales} → ${f.despues.materiales}`);
        console.log(`  tamaño      ${f.tam.map((m) => m.toFixed(2)).join(' × ')} m`);
      } else {
        const t = await armarTextura(entrada, extractor, raiz);
        bytes += t.bytes;
        console.log(t.archivo);
        console.log(`  textura     ${t.ancho}×${t.alto} ETC1S, ${kb(t.bytes)}`);
      }
    }
  } finally {
    await extractor.limpiar();
  }
  console.log(`\nTotal: ${planes.length} archivo(s), ${kb(bytes)}. Sigue: npm run build-manifest`);
  return 0;
}

process.exitCode = await principal();
