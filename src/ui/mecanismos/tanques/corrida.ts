import type { EstadoDe, EtapaDe } from '../../../content/esquema';
import { nivelEn } from '../../../game/puzzles';

/**
 * La corrida de los tanques (T52), sin dibujo: qué puntos traza el graficador y qué dice la
 * máquina cuando suena la campana. Puro: se prueba sin navegador.
 */

type Etapa = EtapaDe<'tanques'>;
type Estado = EstadoDe<'tanques'>;
type Tanque = Estado['a'];

/** El eje de tiempo del graficador es fijo en las tres etapas (máximo que acepta el esquema). */
export const EJE_S = 15;
/** Lo que los niveles se quedan quietos después de la campana, antes de vaciarse. */
export const PAUSA_MS = 2000;

export type Punto = readonly [segundo: number, nivel: number];

/**
 * La línea que dibuja un tanque desde el segundo 0 hasta `hastaS`. Es una recta, salvo que
 * el tanque se llene o se vacíe antes: ahí se quiebra y sigue plana.
 */
export function trazo(
  t: Pick<Tanque, 'nivel' | 'caudal'>,
  hastaS: number,
  alturaCm: number,
): Punto[] {
  const fin = Math.max(0, hastaS);
  const puntos: Punto[] = [[0, nivelEn(t, 0, alturaCm)]];
  // Segundo en que toca el borde (si sube) o el fondo (si baja).
  const tope =
    t.caudal > 0 ? (alturaCm - t.nivel) / t.caudal : t.caudal < 0 ? t.nivel / -t.caudal : -1;
  if (tope > 0 && tope < fin) puntos.push([tope, nivelEn(t, tope, alturaCm)]);
  if (fin > 0) puntos.push([fin, nivelEn(t, fin, alturaCm)]);
  return puntos;
}

/** «3 cm/s», «−2 cm/s». */
export function textoCaudal(caudal: number): string {
  return `${caudal < 0 ? '−' : ''}${Math.abs(caudal)} cm/s`;
}

/** Qué hace un tanque con ese caudal, en palabras. */
export function textoRitmo(caudal: number): string {
  if (caudal === 0) return 'no cambia';
  return `${caudal > 0 ? 'sube' : 'baja'} ${Math.abs(caudal)} cm cada segundo`;
}

/** Altura de un tanque para leerla: sin decimales de más y con coma decimal. */
export function textoNivel(cm: number): string {
  return `${String(Math.round(cm * 10) / 10).replace('.', ',')} cm`;
}

/**
 * Lo que pasó al sonar la campana, en frases cortas. Dice dónde quedó cada tanque y qué hizo
 * la incubadora; nunca dice si estuvo bien o mal. Un tanque tapado no revela su nivel.
 */
export function lineasDeResultado(
  etapa: Etapa,
  estado: Estado,
  resuelta: boolean,
  sello: boolean,
): string[] {
  const { campana_s: s, objetivo } = etapa.exito;
  const alto = etapa.controles.altura_cm;
  const a = textoNivel(nivelEn(estado.a, s, alto));
  const cuando = `Al sonar la campana, a los ${s} segundos,`;
  const lineas: string[] = [];

  if (objetivo.tipo === 'linea') {
    lineas.push(`${cuando} el tanque A estaba en ${a}.`);
    lineas.push(
      resuelta ? 'Justo en la línea roja.' : `La línea roja está en ${textoNivel(objetivo.nivel)}.`,
    );
  } else if (estado.b?.visible) {
    const b = textoNivel(nivelEn(estado.b, s, alto));
    lineas.push(
      resuelta
        ? `${cuando} los tanques A y B estaban en ${a}: a la misma altura.`
        : `${cuando} el tanque A estaba en ${a} y el B en ${b}.`,
    );
  } else {
    lineas.push(`${cuando} el tanque A estaba en ${a}. El B sigue tapado.`);
    lineas.push(
      resuelta
        ? 'Los dos estaban a la misma altura.'
        : 'La incubadora no se movió: los dos niveles no eran iguales.',
    );
  }

  if (sello) lineas.push('La incubadora se abrió.');
  if (!resuelta) {
    lineas.push('Los tanques volvieron a como estaban. Puedes mover la perilla y probar otra vez.');
  }
  return lineas;
}
