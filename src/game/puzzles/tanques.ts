import type { EstadoDe, EtapaDe } from '../../content/esquema';
import { esEntero, esObjeto, evaluacion, iguales, soloClaves, type Evaluacion } from './tipos';

/**
 * Sala 2 · Los tanques. Cada tanque sube o baja a ritmo constante: altura = inicio +
 * caudal × tiempo, sin pasar del borde ni bajar de 0.
 */

type Etapa = EtapaDe<'tanques'>;
type Estado = EstadoDe<'tanques'>;
type Tanque = NonNullable<Estado['b']>;

/** Altura en cm del tanque a los `s` segundos de arrancar la corrida. */
export function nivelEn(t: Pick<Tanque, 'nivel' | 'caudal'>, s: number, alturaCm: number): number {
  return Math.min(alturaCm, Math.max(0, t.nivel + t.caudal * s));
}

/** Condición `nivel`: al sonar la campana, A está en la línea o A y B tienen la misma altura. */
export function evaluarTanques(etapa: Etapa, estado: Estado): Evaluacion {
  const { campana_s, objetivo } = etapa.exito;
  const alto = etapa.controles.altura_cm;
  const a = nivelEn(estado.a, campana_s, alto);
  const nivel =
    objetivo.tipo === 'linea'
      ? a === objetivo.nivel
      : estado.b !== null && a === nivelEn(estado.b, campana_s, alto);
  return evaluacion({ nivel });
}

/** Revisa un estado que llega de fuera: solo cambian los caudales de las perillas libres. */
export function esEstadoTanques(etapa: Etapa, x: unknown): x is Estado {
  if (!esObjeto(x) || !soloClaves(x, ['a', 'b'])) return false;
  const { perillas, caudal_min, caudal_max } = etapa.controles;
  for (const id of ['a', 'b'] as const) {
    const inicial = etapa.estado_inicial[id];
    const t = x[id];
    if (!perillas.includes(id) || inicial === null) {
      if (!iguales(t, inicial)) return false;
      continue;
    }
    if (!esObjeto(t) || !esEntero(t['caudal'])) return false;
    if (t['caudal'] < caudal_min || t['caudal'] > caudal_max) return false;
    if (!iguales({ ...t, caudal: inicial.caudal }, inicial)) return false;
  }
  return true;
}
