/**
 * prueba-carga (T92): simula partidas del cooperativo y cuenta los eventos por segundo que
 * cobraría Supabase Realtime, frente a los límites de cada plan.
 *
 *   npm run prueba-carga                 # 1, 2, 3, 5 y 10 partidas de 4, 2 minutos cada una
 *   npm run prueba-carga -- --partidas 4 --segundos 60
 *   npm run prueba-carga -- --hz 2       # poses a 2 Hz (respaldo de la especificación)
 *
 * No usa la red: todo pasa en la red en memoria de las pruebas (`src/net/memoria.ts`), con el
 * anfitrión, los clientes y el emisor de poses del juego. El código de `src/` se carga con el
 * cargador de módulos de Vite, que entiende sus importaciones sin extensión.
 */
import { parseArgs } from 'node:util';
import { runnerImport } from 'vite';

type Simulacion = typeof import('./carga/simulacion.ts');

const { values } = parseArgs({
  options: {
    partidas: { type: 'string' },
    segundos: { type: 'string', default: '120' },
    moviendose: { type: 'string', default: '0.5' },
    hz: { type: 'string', default: '4' },
  },
});

/** Un número entero positivo de la línea de comandos, o el valor por defecto. */
function entero(texto: string | undefined, porDefecto: number, max: number): number {
  const n = Number(texto);
  return Number.isInteger(n) && n > 0 && n <= max ? n : porDefecto;
}

async function principal(): Promise<number> {
  const { module: sim } = await runnerImport<Simulacion>('./scripts/carga/simulacion.ts', {
    configFile: false,
    logLevel: 'error',
  });
  const segundos = entero(values.segundos, 120, 3600);
  const fraccion = Math.min(1, Math.max(0, Number(values.moviendose) || 0.5));
  const hz = entero(values.hz, 4, 30);
  const lista = values.partidas ? [entero(values.partidas, 2, 100)] : [1, 2, 3, 5, 10];
  const resultados = [];
  for (const partidas of lista) {
    resultados.push(
      await sim.simular({
        ...sim.ESCENARIO_BASE,
        partidas,
        segundos,
        fraccionMoviendose: fraccion,
        hz,
      }),
    );
  }
  console.log(
    `Prueba de carga: partidas de 4 jugadores, ${segundos} s, poses a ${hz} Hz, ` +
      `${Math.round(fraccion * 100)} % del tiempo caminando.\n`,
  );
  console.log(sim.tabla(resultados));
  const mensajes = resultados[0]?.mensajes;
  if (mensajes) {
    console.log(
      `\nMensajes en la primera fila: ${mensajes.dir} directos (poses y señales), ` +
        `${mensajes.evt} eventos del anfitrión y ${mensajes.int} intenciones.`,
    );
  }
  return 0;
}

process.exitCode = await principal();
