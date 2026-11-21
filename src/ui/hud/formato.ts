import { lineaPorId } from '../../content/guion';
import { frasePuertaFalsa } from '../../content/puertas-falsas';
import { nombreDeObjeto } from '../../content/salas';
import type { Aviso } from '../../signals/interfaz';
import { NOMBRE_ALIAS } from '../coop/nombres';

/** Formatos del HUD. Puros: se prueban sin navegador. */

/** `ms` → `mm:ss`, redondeando hacia arriba para que el 00:00 solo aparezca al acabarse. */
export function formatoReloj(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(total / 60);
  const seg = total % 60;
  return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
}

/** Versión para lector de pantalla: «38 minutos y 5 segundos». */
export function relojEnPalabras(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(total / 60);
  const seg = total % 60;
  const m = `${min} ${min === 1 ? 'minuto' : 'minutos'}`;
  const s = `${seg} ${seg === 1 ? 'segundo' : 'segundos'}`;
  if (min === 0) return s;
  if (seg === 0) return m;
  return `${m} y ${s}`;
}

/** Lo que el HUD (y el lector de pantalla) le dice al jugador con un aviso del controlador. */
export function textoDeAviso(aviso: Aviso): string {
  switch (aviso.t) {
    case 'puerta_cerrada':
      return `La puerta ${aviso.sala} está cerrada. Se abre cuando consigas el sello de la sala ${aviso.sala - 1}.`;
    case 'necesita_herramienta': {
      const objeto = nombreDeObjeto(aviso.objeto) ?? 'Esto';
      const herramienta = (nombreDeObjeto(aviso.herramienta) ?? 'una herramienta').toLowerCase();
      return `${objeto}: está muy oscuro para leer. Hace falta que quien tenga la ${herramienta} la use aquí.`;
    }
    case 'objeto_recibido': {
      const objeto = nombreDeObjeto(aviso.objeto) ?? 'un objeto';
      const quien = aviso.de ? NOMBRE_ALIAS[aviso.de] : 'Alguien';
      return `${quien} te pasó: ${objeto}. Ya está en lo que llevas.`;
    }
    case 'objeto_pasado': {
      const objeto = nombreDeObjeto(aviso.objeto) ?? 'un objeto';
      const quien = aviso.a ? NOMBRE_ALIAS[aviso.a] : 'tu compañero';
      return `Le pasaste a ${quien}: ${objeto}.`;
    }
    case 'puerta_falsa':
      return fraseDeAviso(aviso.frase);
  }
}

/** Si una puerta falsa no tiene frase (no debería pasar: lo revisa el build). */
export const FRASE_RESPALDO = 'Está cerrada con llave.';

/** La frase de una puerta falsa: su texto o, si la dice La Voz, el texto de esa línea. */
function fraseDeAviso(id: string): string {
  const frase = frasePuertaFalsa(id);
  if (!frase) return FRASE_RESPALDO;
  if (frase.texto) return frase.texto;
  return (frase.voz && lineaPorId(frase.voz)?.texto) || FRASE_RESPALDO;
}

/**
 * Lo que oye el lector de pantalla con un aviso, o `null` si no debe decir nada. La frase de
 * una puerta falsa va con el rótulo de la puerta delante («Aula 10-A: …»), porque quien no ve
 * no sabe cuál tocó; si la dice La Voz, ya la anuncian los subtítulos.
 */
export function textoDeAvisoParaLector(aviso: Aviso): string | null {
  if (aviso.t !== 'puerta_falsa') return textoDeAviso(aviso);
  if (aviso.hablada) return null;
  const rotulo = frasePuertaFalsa(aviso.frase)?.rotulo;
  const frase = textoDeAviso(aviso);
  return rotulo ? `${rotulo}: ${frase}` : frase;
}

/** Milisegundos que se ve un aviso antes de irse solo. */
export const DURACION_AVISO_MS = 6000;

/**
 * Cuánto dura un aviso en pantalla. La frase de una puerta falsa es corta y se va antes: lo
 * justo para leerla con calma (unos 55 ms por letra), entre 3,5 y 6 segundos.
 */
export function duracionDeAviso(aviso: Aviso): number {
  if (aviso.t !== 'puerta_falsa') return DURACION_AVISO_MS;
  const letras = textoDeAviso(aviso).length;
  return Math.min(DURACION_AVISO_MS, Math.max(3500, 1500 + letras * 55));
}
