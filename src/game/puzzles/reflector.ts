import type { EstadoDe, EtapaDe } from '../../content/esquema';
import { esEntero, esObjeto, evaluacion, iguales, soloClaves, type Evaluacion } from './tipos';

/**
 * Sala 3 · El reflector. Con la misma luz, sombra ÷ altura es igual para todo lo que la
 * proyecta. Las razones están idealizadas para que las sombras den metros enteros o medios
 * (tan 27° ≈ 1/2, tan 37° ≈ 3/4, tan 45° = 1, tan 53° ≈ 4/3, tan 63° ≈ 2).
 */

type Etapa = EtapaDe<'reflector'>;
type Estado = EstadoDe<'reflector'>;

/** Sombra ÷ altura en cada muesca del reflector, como fracción [numerador, denominador]. */
export const RAZON_SOMBRA: Readonly<Record<number, readonly [number, number]>> = {
  27: [2, 1],
  37: [4, 3],
  45: [1, 1],
  53: [3, 4],
  63: [1, 2],
};

/** Largo de la sombra en metros, o null si la muesca no existe. */
export function sombra(altura: number, muesca: number): number | null {
  const r = RAZON_SOMBRA[muesca];
  return r ? (altura * r[0]) / r[1] : null;
}

/**
 * Una condición por poste de `exito.sensores` (su sombra toca su sensor) y `polea` si la
 * etapa tiene marcador (la polea suelta exactamente su altura).
 */
export function evaluarReflector(etapa: Etapa, estado: Estado): Evaluacion {
  const r = RAZON_SOMBRA[estado.muesca];
  const condiciones: Record<string, boolean> = {};
  for (const id of etapa.exito.sensores) {
    const poste = estado.postes.find((p) => p.id === id);
    condiciones[id] =
      r !== undefined &&
      poste !== undefined &&
      poste.distancia !== null &&
      // Comparación exacta, sin decimales: altura × num / den === distancia.
      poste.altura * r[0] === poste.distancia * r[1];
  }
  if (etapa.exito.marcador) condiciones['polea'] = estado.polea === etapa.exito.marcador.altura;
  return evaluacion(condiciones);
}

/** Revisa un estado que llega de fuera: muesca, postes móviles y polea dentro de su rango. */
export function esEstadoReflector(etapa: Etapa, x: unknown): x is Estado {
  if (!esObjeto(x) || !soloClaves(x, ['muesca', 'postes', 'polea'])) return false;
  const c = etapa.controles;
  const inicial = etapa.estado_inicial;
  const muesca = x['muesca'];
  if (!esEntero(muesca) || !c.muescas.includes(muesca) || RAZON_SOMBRA[muesca] === undefined) {
    return false;
  }
  if (!c.girar && muesca !== inicial.muesca) return false;

  const polea = x['polea'];
  if (c.polea === null) {
    if (polea !== null) return false;
  } else if (!esEntero(polea) || polea < c.polea.min || polea > c.polea.max) {
    return false;
  }

  const postes = x['postes'];
  if (!Array.isArray(postes) || postes.length !== inicial.postes.length) return false;
  return inicial.postes.every((antes, i) => {
    const p: unknown = postes[i];
    if (!c.postes_moviles.includes(antes.id)) return iguales(p, antes);
    if (!esObjeto(p) || !esEntero(p['distancia'])) return false;
    const d = p['distancia'];
    return (
      d >= c.distancia_min &&
      d <= c.distancia_max &&
      iguales({ ...p, distancia: antes.distancia }, antes)
    );
  });
}
