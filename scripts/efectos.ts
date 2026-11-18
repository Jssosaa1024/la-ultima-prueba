/**
 * efectos (T42c): genera los efectos de sonido con la API de ElevenLabs (efectos de sonido).
 *
 *   npm run efectos                       los que aún no tienen original
 *   npm run efectos -- --forzar           todos otra vez
 *   npm run efectos -- --solo puerta,clac solo esos (separados por comas)
 *   npm run efectos -- --en-seco          solo dice qué haría
 *
 * Lee `art/audio/efectos/efectos.json` (modelo y descripción de cada efecto) y escribe
 * `art/audio/efectos/originales/<nombre>.mp3` (Git LFS).
 *
 * La clave va en la variable de entorno ELEVENLABS_API_KEY: nunca en un archivo ni en la
 * salida. Solo con plan de pago: lo generado en plan gratis no tiene licencia comercial.
 * Después: `npm run optimize-audio` los pasa a .m4a a −16 LUFS en `compartido/`.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  ErrorApi,
  efectoDeSonido,
  hayClave,
  suscripcion,
  VARIABLE_CLAVE,
} from './voz/elevenlabs.ts';
import {
  ARCHIVO_CONFIG,
  cuerpoPedido,
  leerConfig,
  pendientes,
  rutaOriginal,
} from './efectos/plan.ts';

/** Escribe primero a un temporal: si se corta a mitad, no queda un mp3 roto que se salte. */
async function guardar(ruta: string, datos: Uint8Array): Promise<void> {
  await mkdir(path.dirname(ruta), { recursive: true });
  const temporal = `${ruta}.parcial`;
  await writeFile(temporal, datos);
  await rename(temporal, ruta);
}

async function principal(): Promise<number> {
  const { values } = parseArgs({
    options: {
      forzar: { type: 'boolean', default: false },
      solo: { type: 'string' },
      'en-seco': { type: 'boolean', default: false },
    },
  });

  const config = leerConfig(JSON.parse(await readFile(ARCHIVO_CONFIG, 'utf8')) as unknown);
  if (Array.isArray(config)) {
    console.error(`efectos: ${ARCHIVO_CONFIG} tiene problemas:`);
    for (const p of config) console.error(`  - ${p}`);
    return 1;
  }
  const solo =
    values.solo
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  const p = pendientes((n) => existsSync(rutaOriginal(n)), { forzar: values.forzar, solo });
  if (p.desconocidos.length > 0) {
    console.error(`efectos: no son efectos grabados: ${p.desconocidos.join(', ')}`);
    return 1;
  }
  if (p.saltados.length > 0) {
    console.log(`  Se saltan ${p.saltados.length} que ya existen (usa --forzar para rehacerlos).`);
  }
  if (p.generar.length === 0) {
    console.log('efectos: no hay nada que generar.');
    return 0;
  }
  const segundos = p.generar.reduce((s, n) => s + config.efectos[n].duracion, 0);
  console.log(
    `efectos: ${p.generar.length} efecto(s) con ${config.modelo}, ${segundos.toFixed(1)} s en total.`,
  );
  if (values['en-seco']) {
    for (const n of p.generar) console.log(`  · ${n} → ${rutaOriginal(n)}`);
    return 0;
  }
  if (!hayClave()) {
    console.error(`efectos: falta la variable de entorno ${VARIABLE_CLAVE}.`);
    return 1;
  }
  const s = await suscripcion();
  if (s?.plan === 'gratis') {
    console.error(
      'efectos: la cuenta está en plan gratis; lo generado no tendría licencia comercial.',
    );
    return 1;
  }
  console.log(
    s
      ? `  Plan: ${s.tier} (${s.plan}).`
      : '  Plan: no se puede leer (la clave no tiene «User: read»).',
  );

  let errores = 0;
  for (const nombre of p.generar) {
    const ruta = rutaOriginal(nombre);
    try {
      const audio = await efectoDeSonido(
        config.formato,
        cuerpoPedido(config.efectos[nombre], config),
      );
      if (audio.byteLength < 1000) throw new ErrorApi(0, 'la API devolvió un audio vacío');
      await guardar(ruta, audio);
      console.log(`  ✓ ${nombre} → ${ruta} (${(audio.byteLength / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.error(`  ✗ ${nombre}: ${e instanceof ErrorApi ? e.message : 'error de red'}`);
      errores++;
      // Sin permiso, sin créditos o con la clave mala, los demás fallarían igual.
      if (e instanceof ErrorApi && [401, 402, 403].includes(e.estado)) break;
    }
  }
  if (errores > 0) {
    console.error(`\nefectos: ${errores} efecto(s) con problemas.`);
    return 1;
  }
  console.log('\nefectos: listo. Ahora corre: npm run optimize-audio');
  return 0;
}

process.exitCode = await principal();
