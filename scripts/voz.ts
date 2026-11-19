/**
 * voz (T42b): genera la voz de La Voz con la API de ElevenLabs, a partir del guion.
 *
 *   npm run voz                         las líneas que aún no tienen original
 *   npm run voz -- --forzar             todas otra vez
 *   npm run voz -- --solo voz-intro-1   solo esas (separadas por comas)
 *   npm run voz -- --muestras           la línea voz-intro-1 con cada voz candidata
 *   npm run voz -- --en-seco            solo dice qué haría y cuántos caracteres gastaría
 *
 * Una línea puede llevar su propio modelo, ajustes, semilla o un texto con marcas de
 * entonación en `lineas` de voz.json (la bienvenida, por ejemplo, va con eleven_v3).
 *
 * Lee `src/content/guion.json` y `art/audio/voz/voz.json` (modelo, ajustes, voces candidatas
 * y la elegida) y escribe `art/audio/voz/originales/<id>.mp3` (Git LFS) o, con --muestras,
 * `art/audio/voz/muestras/`. Antes de generar dice cuántos caracteres va a gastar.
 *
 * La clave va en la variable de entorno ELEVENLABS_API_KEY: nunca en un archivo ni en la
 * salida. Solo con plan de pago: lo generado en plan gratis no tiene licencia comercial.
 * Después: `npm run optimize-audio` pasa los originales a .m4a a −16 LUFS.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ErrorApi, hayClave, suscripcion, textoAVoz, VARIABLE_CLAVE } from './voz/elevenlabs.ts';
import {
  ARCHIVO_CONFIG,
  CARPETA_MUESTRAS,
  caracteres,
  cuerpoPedido,
  idsDesconocidos,
  LINEA_MUESTRA,
  leerConfig,
  lineasQueNoCuadran,
  nombreMuestra,
  pedidoDeLinea,
  pendientes,
  rutaOriginal,
  type ConfigVoz,
  type LineaVoz,
} from './voz/plan.ts';

const GUION_JSON = path.join('src', 'content', 'guion.json');

/** Escribe primero a un temporal: si se corta a mitad, no queda un mp3 roto que se salte. */
async function guardar(ruta: string, datos: Uint8Array): Promise<void> {
  await mkdir(path.dirname(ruta), { recursive: true });
  const temporal = `${ruta}.parcial`;
  await writeFile(temporal, datos);
  await rename(temporal, ruta);
}

async function leerJson(ruta: string): Promise<unknown> {
  return JSON.parse(await readFile(ruta, 'utf8')) as unknown;
}

/** Dice el plan de la cuenta y si se puede seguir (no con plan gratis). */
async function revisarPlan(): Promise<boolean> {
  const s = await suscripcion();
  if (!s) {
    console.log(
      '  Plan: la clave no tiene el permiso «User: read», así que no se puede leer el plan.\n' +
        '        Se sigue porque el plan de pago lo confirma Alex con la captura de art/evidencia/.',
    );
    return true;
  }
  console.log(`  Plan: ${s.tier} (${s.plan}); van ${s.usados} de ${s.limite} caracteres del mes.`);
  if (s.plan === 'gratis') {
    console.error('voz: la cuenta está en plan gratis; lo generado no tendría licencia comercial.');
    return false;
  }
  return true;
}

interface Trabajo {
  linea: LineaVoz;
  vozId: string;
  ruta: string;
  /** Lo que se manda a la API (cobra por sus caracteres). */
  texto: string;
  modelo: string;
  cuerpo: Record<string, unknown>;
}

async function generar(trabajos: Trabajo[], config: ConfigVoz): Promise<number> {
  let errores = 0;
  for (const { linea, vozId, ruta, cuerpo } of trabajos) {
    try {
      const audio = await textoAVoz(vozId, config.formato, cuerpo);
      if (audio.byteLength < 1000) throw new ErrorApi(0, 'la API devolvió un audio vacío');
      await guardar(ruta, audio);
      console.log(`  ✓ ${linea.id} → ${ruta} (${(audio.byteLength / 1024).toFixed(0)} KB)`);
    } catch (e) {
      const mensaje = e instanceof ErrorApi ? e.message : 'error de red';
      console.error(`  ✗ ${linea.id}: ${mensaje}`);
      errores++;
      // Sin permiso, sin créditos o con la clave mala, las demás fallarían igual.
      if (e instanceof ErrorApi && [401, 402, 403].includes(e.estado)) break;
    }
  }
  return errores;
}

async function principal(): Promise<number> {
  const { values } = parseArgs({
    options: {
      forzar: { type: 'boolean', default: false },
      solo: { type: 'string' },
      muestras: { type: 'boolean', default: false },
      'en-seco': { type: 'boolean', default: false },
    },
  });

  const config = leerConfig(await leerJson(ARCHIVO_CONFIG));
  if (Array.isArray(config)) {
    console.error(`voz: ${ARCHIVO_CONFIG} tiene problemas:`);
    for (const p of config) console.error(`  - ${p}`);
    return 1;
  }
  const guion = (await leerJson(GUION_JSON)) as LineaVoz[];
  const noCuadran = lineasQueNoCuadran(config, guion);
  if (noCuadran.length > 0) {
    console.error(
      `voz: en ${ARCHIVO_CONFIG}, «lineas» no cuadra con el guion: ${noCuadran.join(', ')}\n` +
        '     (el id no existe o texto_voz no dice las mismas palabras que el subtítulo).',
    );
    return 1;
  }

  let trabajos: Trabajo[];
  let saltadas: string[] = [];
  if (values.muestras) {
    const linea = guion.find((l) => l.id === LINEA_MUESTRA);
    if (!linea || config.candidatas.length === 0) {
      console.error(`voz: hace falta la línea ${LINEA_MUESTRA} y al menos una voz candidata.`);
      return 1;
    }
    trabajos = config.candidatas.map((c, i) => ({
      linea,
      vozId: c.voice_id,
      ruta: path.join(CARPETA_MUESTRAS, nombreMuestra(linea.id, i + 1, c.nombre)),
      texto: linea.texto,
      modelo: config.modelo,
      cuerpo: cuerpoPedido(linea.texto, config),
    }));
    if (!values.forzar) {
      saltadas = trabajos.filter((t) => existsSync(t.ruta)).map((t) => path.basename(t.ruta));
      trabajos = trabajos.filter((t) => !existsSync(t.ruta));
    }
  } else {
    const elegida = config.elegida;
    if (!elegida) {
      console.error(
        `voz: todavía no hay voz elegida en ${ARCHIVO_CONFIG}.\n` +
          '     Genera las muestras con «npm run voz -- --muestras» y anota la que escoja Alex.',
      );
      return 1;
    }
    const solo =
      values.solo
        ?.split(',')
        .map((s) => s.trim())
        .filter(Boolean) ?? [];
    const desconocidos = idsDesconocidos(guion, solo);
    if (desconocidos.length > 0) {
      console.error(`voz: estos ids no están en el guion: ${desconocidos.join(', ')}`);
      return 1;
    }
    const p = pendientes(guion, (id) => existsSync(rutaOriginal(id) ?? ''), {
      forzar: values.forzar,
      solo,
    });
    const malos = p.generar.filter((l) => !rutaOriginal(l.id)).map((l) => l.id);
    if (malos.length > 0) {
      console.error(`voz: ids que no sirven como nombre de archivo: ${malos.join(', ')}`);
      return 1;
    }
    trabajos = p.generar.map((linea) => ({
      linea,
      vozId: elegida,
      ruta: rutaOriginal(linea.id) as string,
      ...pedidoDeLinea(linea, config),
    }));
    saltadas = p.saltadas;
  }

  const total = trabajos.reduce((s, t) => s + caracteres(t.texto), 0);
  const modelos = [...new Set(trabajos.map((t) => t.modelo))].join(' y ');
  if (saltadas.length > 0) {
    console.log(`  Se saltan ${saltadas.length} que ya existen (usa --forzar para rehacerlas).`);
  }
  if (trabajos.length === 0) {
    console.log('voz: no hay nada que generar.');
    return 0;
  }
  console.log(
    `voz: ${trabajos.length} audio(s) con ${modelos}; ` +
      `se van a gastar ${total} caracteres (créditos de ElevenLabs).`,
  );
  if (values['en-seco']) {
    for (const t of trabajos) console.log(`  · ${t.linea.id} (${t.modelo}) → ${t.ruta}`);
    return 0;
  }
  if (!hayClave()) {
    console.error(`voz: falta la variable de entorno ${VARIABLE_CLAVE}.`);
    return 1;
  }
  if (!(await revisarPlan())) return 1;

  const errores = await generar(trabajos, config);
  if (errores > 0) {
    console.error(`\nvoz: ${errores} audio(s) con problemas.`);
    return 1;
  }
  console.log(
    values.muestras
      ? '\nvoz: muestras listas. Escucha y anota la elegida en art/audio/voz/voz.json.'
      : '\nvoz: listo. Ahora corre: npm run optimize-audio',
  );
  return 0;
}

process.exitCode = await principal();
