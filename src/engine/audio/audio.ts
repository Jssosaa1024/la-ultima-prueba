/**
 * Módulo de audio del motor (T43).
 *
 * - **Desbloqueo.** Nada suena hasta el primer toque del jugador (lo exige Safari en iPhone).
 * - **Mezcla.** Voz, ambiente y efectos, cada uno con su volumen (voz y ambiente, de los
 *   ajustes del jugador, T39); el ambiente baja mientras habla La Voz.
 * - **Ambiente.** Un fondo por sala durante la partida; en el menú y los finales, silencio.
 * - **Efectos.** Lo que hace cada máquina al responder (signal `resultado`), el sello ganado,
 *   lo que piden las animaciones con `sonar()` (la mano de la urna, la caja fuerte, la campana,
 *   la registradora, la incubadora) y, desde T42c, las puertas, los objetos que se usan o se
 *   recogen y los controles de las máquinas (`momentos.ts`). Su volumen es el de los ajustes.
 * - **Voz.** La línea de La Voz que la interfaz muestra (`lineaEnPantalla`: un subtítulo, una
 *   grabación o un final) suena con la voz grabada (T42b, `voz.ts`). Mientras se juega, se
 *   bajan de antemano las líneas de la sala actual.
 *
 * El ambiente se genera con Web Audio. La voz y, desde T42c, los efectos grabados con
 * ElevenLabs (`grabados.ts`) se bajan de `public/assets/audio/`; mientras un efecto grabado no
 * ha llegado, suena el hecho con código del mismo nombre (`sintesis.ts`).
 * Lee signals y no escribe más que `audioDesbloqueado` y, desde `voz.ts`, `sonidoVoz`.
 */
import { effect } from '@preact/signals';
import type { Lugar } from '../../content/esquema-salas';
import { carpetaDeAudio } from '../../content/audio-guion';
import { GUION } from '../../content/guion';
import { ajustes } from '../../signals/ajustes';
import { audioDesbloqueado } from '../../signals/audio';
import { resultado, type ResultadoMecanismo } from '../../signals/mecanismo';
import { fase, sala } from '../../signals/partida';
import { lineaEnPantalla } from '../../signals/voz';
import { crearAmbiente, type Ambiente } from './ambiente';
import { desbloquearAlPrimerToque, type DocumentoAudio } from './desbloqueo';
import { escucharSonidos } from './eventos';
import { crearEfectosGrabados, type EfectosGrabados } from './grabados';
import { crearMezcla, volumenesDeAjustes, type Mezcla } from './mezcla';
import { escucharMomentos } from './momentos';
import { EFECTOS, type NombreEfecto } from './sintesis';
import { crearVoz, type OpcionesVoz, type Voz } from './voz';

/**
 * Las líneas que conviene tener bajadas en un lugar: las suyas y las que suenan en cualquier
 * sala (espera y fallo). Las de un final se bajan cuando llega el final.
 */
export function lineasDeLugar(lugar: string): string[] {
  return GUION.filter((l) => {
    const carpeta = carpetaDeAudio(l.sala);
    return l.momento !== 'final' && (carpeta === lugar || carpeta === 'compartido');
  }).map((l) => l.id);
}
/**
 * Cuánto esperan algunos efectos desde que responde la máquina, en segundos: la imprenta, a
 * que la palanca de la etiquetadora llegue abajo (T42c). El acierto, el error y el sello
 * esperan a que la máquina termine de moverse (`retroalimentacion.ts`).
 */
export const RETRASOS: Partial<Record<NombreEfecto, number>> = { imprenta: 0.36 };

/**
 * Qué suena cuando responde la máquina de cada puzzle, en ese momento. El acierto o el error
 * y el sello suenan después, cuando la máquina termina de moverse (`retroalimentacion.ts`).
 */
export function efectosDeResultado(r: ResultadoMecanismo): NombreEfecto[] {
  switch (r.puzzle) {
    case 's1-etiquetadora':
      // La palanca baja y la etiqueta se imprime (T42c).
      return ['palanca', 'imprenta'];
    case 's2-tanques':
      // La campana suena al final de la corrida: la pide la animación.
      return ['palanca'];
    case 's3-reflector':
      // Las dos primeras etapas responden solas (reposo); la tercera es la polea.
      return r.etapa === 2 ? ['polea'] : ['clic'];
    case 's5-urna':
      return ['manija', 'fichas'];
    case 's4-carritos':
      // Con las cuatro lámparas en verde, la pared de casilleros se abre (T42c).
      return r.sello ? ['clic', 'casilleros'] : ['clic'];
    default:
      return ['clic'];
  }
}

export interface OpcionesAudio {
  documento?: DocumentoAudio;
  /** Crea el `AudioContext`. Por defecto, el del navegador. */
  crear?: () => AudioContext;
  /** Se llama con el nombre de cada efecto que suena (atributo para las pruebas e2e). */
  alSonar?: (nombre: string) => void;
  /** Cómo se bajan los archivos de voz (las pruebas lo reemplazan). Por defecto, `fetch`. */
  bajarVoz?: OpcionesVoz['bajar'];
  /** Cómo se bajan los efectos grabados (T42c). Por defecto, `fetch`. */
  bajarEfectos?: OpcionesVoz['bajar'];
}

/** Empieza a escuchar. Devuelve la función que lo apaga todo y cierra el contexto. */
export function iniciarAudio(opciones: OpcionesAudio = {}): () => void {
  const crear = opciones.crear ?? (() => new AudioContext({ latencyHint: 'interactive' }));
  let contexto: AudioContext | null = null;
  let mezcla: Mezcla | null = null;
  let ambiente: Ambiente | null = null;
  let voz: Voz | null = null;
  let grabados: EfectosGrabados | null = null;
  const efectos: (() => void)[] = [];

  const tocar = (nombre: NombreEfecto, retraso = 0): void => {
    if (!contexto || !mezcla) return;
    const t = contexto.currentTime + retraso;
    // El grabado con ElevenLabs si ya llegó; si no, el hecho con código (T42c).
    if (!grabados?.tocar(nombre, t)) EFECTOS[nombre](contexto, mezcla.efectos, t);
    opciones.alSonar?.(nombre);
  };

  const alDesbloquear = (c: AudioContext): void => {
    contexto = c;
    mezcla = crearMezcla(c, volumenesDeAjustes(ajustes.peek()));
    ambiente = crearAmbiente(c, mezcla.ambiente);
    voz = crearVoz({
      contexto: c,
      destino: mezcla.voz,
      ...(opciones.bajarVoz ? { bajar: opciones.bajarVoz } : {}),
      alEmpezar: () => {
        mezcla?.hablando(true);
        opciones.alSonar?.('voz');
      },
      alTerminar: () => mezcla?.hablando(false),
    });
    grabados = crearEfectosGrabados({
      contexto: c,
      destino: mezcla.efectos,
      ...(opciones.bajarEfectos ? { bajar: opciones.bajarEfectos } : {}),
    });
    audioDesbloqueado.value = true;

    efectos.push(
      // Los volúmenes de voz, ambiente y efectos de la pantalla de ajustes (T39, T42c).
      effect(() => mezcla?.aplicar(volumenesDeAjustes(ajustes.value))),
      effect(() => {
        const lugar: Lugar | null = fase.value === 'jugando' ? sala.value : null;
        ambiente?.cambiar(lugar);
        // La voz de la sala queda bajada antes de que la pida un subtítulo.
        if (lugar) voz?.precargar(lineasDeLugar(lugar));
      }),
    );
    // Lo que respondió la máquina antes del desbloqueo ya pasó: no se toca.
    let ultimo = resultado.peek()?.n ?? 0;
    efectos.push(
      effect(() => {
        const r = resultado.value;
        if (!r || r.n === ultimo) return;
        ultimo = r.n;
        efectosDeResultado(r).forEach((nombre) => {
          tocar(nombre, RETRASOS[nombre] ?? 0);
        });
      }),
    );
    // Puertas, objetos y controles (T42c).
    efectos.push(escucharMomentos((nombre) => tocar(nombre)));
    // La línea que la interfaz muestra ahora: un subtítulo (T34), una grabación o un final.
    // La que ya se veía al desbloquear también suena: es la presentación de La Voz, pedida en
    // el mismo toque de «Jugar solo». Si se deja de ver (se abre un panel), se calla; al
    // volver a verse, empieza otra vez.
    efectos.push(
      effect(() => {
        const id = lineaEnPantalla.value;
        if (id) voz?.decir(id);
        else voz?.callar();
      }),
    );
  };

  const desbloqueo = desbloquearAlPrimerToque({
    crear,
    alDesbloquear,
    ...(opciones.documento ? { documento: opciones.documento } : {}),
  });
  const dejarDeEscuchar = escucharSonidos((nombre) => tocar(nombre));

  return () => {
    desbloqueo.detener();
    dejarDeEscuchar();
    efectos.forEach((dejar) => dejar());
    voz?.detener();
    grabados?.detener();
    ambiente?.detener();
    mezcla?.desconectar();
    void desbloqueo.contexto?.close().catch(() => undefined);
    audioDesbloqueado.value = false;
  };
}
