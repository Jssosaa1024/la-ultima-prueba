import type { Aviso } from '../../signals/interfaz';

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
  }
}
