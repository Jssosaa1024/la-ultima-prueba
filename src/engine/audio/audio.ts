/**
 * Módulo de audio del motor (T43).
 *
 * - **Desbloqueo.** Nada suena hasta el primer toque del jugador (lo exige Safari en iPhone).
 * - **Mezcla.** Voz, ambiente y efectos, cada uno con su volumen (signal `volumenes`); el
 *   ambiente baja mientras habla La Voz.
 * - **Ambiente.** Un fondo por sala durante la partida; en el menú y los finales, silencio.
 * - **Efectos.** Lo que hace cada máquina al responder (signal `resultado`), el sello ganado y
 *   lo que piden las animaciones con `sonar()` (la mano de la urna, la caja fuerte, la campana).
 * - **Voz provisional.** Al abrir una grabación suena un murmullo sin palabras, hasta que
 *   llegue la voz grabada de La Voz (ElevenLabs, plan de pago).
 *
 * Todo se genera con Web Audio: no hay archivos que descargar todavía. Lee signals y no
 * escribe más que `audioDesbloqueado`.
 */
import { effect } from '@preact/signals';
import type { Lugar } from '../../content/esquema-salas';
import { audioDesbloqueado, volumenes } from '../../signals/audio';
import { panel } from '../../signals/interfaz';
import { resultado, type ResultadoMecanismo } from '../../signals/mecanismo';
import { fase, sala } from '../../signals/partida';
import { crearAmbiente, type Ambiente } from './ambiente';
import { desbloquearAlPrimerToque, type DocumentoAudio } from './desbloqueo';
import { escucharSonidos } from './eventos';
import { crearMezcla, type Mezcla } from './mezcla';
import { EFECTOS, murmullo, type NombreEfecto } from './sintesis';

/** Lo que dura la voz provisional de una grabación, en segundos. */
export const DURACION_MURMULLO_S = 4;
/** Espera entre el sonido de la máquina y el del sello. */
const ESPERA_SELLO_S = 0.45;

/** Qué suena cuando responde la máquina de cada puzzle. */
export function efectosDeResultado(r: ResultadoMecanismo): NombreEfecto[] {
  const maquina = ((): NombreEfecto[] => {
    switch (r.puzzle) {
      case 's1-etiquetadora':
        return ['palanca'];
      case 's2-tanques':
        // La campana (y el sello) suenan al final de la corrida: los pide la animación.
        return ['palanca'];
      case 's3-reflector':
        // Las dos primeras etapas responden solas (reposo); la tercera es la polea.
        return r.etapa === 2 ? ['polea'] : ['clic'];
      case 's5-urna':
        return ['manija', 'fichas'];
      default:
        return ['clic'];
    }
  })();
  // En los tanques, el sello espera a la campana (lo pide su animación).
  return r.sello && r.puzzle !== 's2-tanques' ? [...maquina, 'sello'] : maquina;
}

export interface OpcionesAudio {
  documento?: DocumentoAudio;
  /** Crea el `AudioContext`. Por defecto, el del navegador. */
  crear?: () => AudioContext;
  /** Se llama con el nombre de cada efecto que suena (atributo para las pruebas e2e). */
  alSonar?: (nombre: string) => void;
}

/** Empieza a escuchar. Devuelve la función que lo apaga todo y cierra el contexto. */
export function iniciarAudio(opciones: OpcionesAudio = {}): () => void {
  const crear = opciones.crear ?? (() => new AudioContext({ latencyHint: 'interactive' }));
  let contexto: AudioContext | null = null;
  let mezcla: Mezcla | null = null;
  let ambiente: Ambiente | null = null;
  let finVoz: ReturnType<typeof setTimeout> | undefined;
  const efectos: (() => void)[] = [];

  const tocar = (nombre: NombreEfecto, retraso = 0): void => {
    if (!contexto || !mezcla) return;
    EFECTOS[nombre](contexto, mezcla.efectos, contexto.currentTime + retraso);
    opciones.alSonar?.(nombre);
  };

  const hablar = (segundos: number): void => {
    if (!contexto || !mezcla) return;
    mezcla.hablando(true);
    murmullo(contexto, mezcla.voz, contexto.currentTime + 0.1, segundos);
    opciones.alSonar?.('voz');
    clearTimeout(finVoz);
    finVoz = setTimeout(() => mezcla?.hablando(false), (segundos + 0.3) * 1000);
  };

  const alDesbloquear = (c: AudioContext): void => {
    contexto = c;
    mezcla = crearMezcla(c, volumenes.peek());
    ambiente = crearAmbiente(c, mezcla.ambiente);
    audioDesbloqueado.value = true;

    efectos.push(
      effect(() => mezcla?.aplicar(volumenes.value)),
      effect(() => {
        const lugar: Lugar | null = fase.value === 'jugando' ? sala.value : null;
        ambiente?.cambiar(lugar);
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
          tocar(nombre, nombre === 'sello' ? ESPERA_SELLO_S : 0);
        });
      }),
    );
    let grabacionAbierta = panel.peek() === 'grabacion';
    efectos.push(
      effect(() => {
        const abierta = panel.value === 'grabacion';
        if (abierta && !grabacionAbierta) hablar(DURACION_MURMULLO_S);
        grabacionAbierta = abierta;
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
    clearTimeout(finVoz);
    ambiente?.detener();
    mezcla?.desconectar();
    void desbloqueo.contexto?.close().catch(() => undefined);
    audioDesbloqueado.value = false;
  };
}
