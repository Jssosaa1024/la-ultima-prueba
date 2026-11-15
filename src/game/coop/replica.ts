import type { Evento, Foto } from './mensajes';
import { puzzlePorId } from './mundo';
import { ETAPAS_POR_SALA, SALAS } from '../partida';
import { repartirConAusencias, type RepartoConAusencias } from '../reparto';

/**
 * Copia local de la partida en cada cliente (T84–T88). Parte de una foto (`estado`) y aplica
 * cada evento del anfitrión. No decide nada: refleja lo que el anfitrión ya decidió. Cada foto
 * nueva (al unirse, tras un hueco y cada 15 s) reemplaza la copia entera y corrige cualquier
 * diferencia.
 */

/** Aplica un evento a la copia. Devuelve una foto nueva (o la misma si no cambia nada). */
export function aplicarEvento(f: Foto, e: Evento): Foto {
  switch (e.t) {
    case 'estado':
      return e.p;
    case 'inicio':
      return {
        ...f,
        fase: 'jugando',
        orden: [...e.p.orden],
        listos: [...e.p.orden],
        reloj: { restante_ms: e.p.restante_ms, pausado: false },
      };
    case 'objeto':
      return { ...f, objetos: [...f.objetos.filter((o) => o.objeto !== e.p.objeto), { ...e.p }] };
    case 'revelado':
      return f.revelados.includes(e.p.objeto)
        ? f
        : { ...f, revelados: [...f.revelados, e.p.objeto] };
    case 'propuesta':
      return { ...f, propuesta: { ...e.p, votos: [{ jugador: e.p.por, acepta: true }] } };
    case 'confirmacion': {
      const p = f.propuesta;
      if (!p || p.id !== e.p.propuesta) return f;
      if (!e.p.acepta) return { ...f, propuesta: null };
      return {
        ...f,
        propuesta: { ...p, votos: [...p.votos, { jugador: e.p.jugador, acepta: true }] },
      };
    }
    case 'resultado': {
      const puzzle = puzzlePorId(e.p.puzzle);
      if (!puzzle) return { ...f, propuesta: null };
      const i = puzzle.sala - 1;
      const etapas = f.etapas.map((n, k) =>
        k === i && e.p.resuelta ? Math.min(ETAPAS_POR_SALA, e.p.etapa + 1) : n,
      );
      const pistas = f.pistas.map((p, k) => {
        if (k !== i) return p;
        return e.p.resuelta ? { ...p, ms: 0, intentos: 0 } : { ...p, intentos: p.intentos + 1 };
      });
      return { ...f, etapas, pistas, propuesta: null };
    }
    case 'pista': {
      const puzzle = puzzlePorId(e.p.puzzle);
      if (!puzzle) return f;
      const i = puzzle.sala - 1;
      const nivel = e.p.nivel;
      return {
        ...f,
        pistas: f.pistas.map((p, k) =>
          k === i
            ? { ...p, vistas: Math.max(p.vistas, nivel), ofrecidas: Math.max(p.ofrecidas, nivel) }
            : p,
        ),
      };
    }
    case 'voto': {
      const resto = f.votos.filter((v) => v.asunto !== e.p.asunto);
      if (!e.p.resuelto) {
        const votos =
          e.p.votos.length === 0
            ? resto
            : [...resto, { asunto: e.p.asunto, opcion: e.p.opcion, votos: [...e.p.votos] }];
        return { ...f, votos };
      }
      // Un voto de sala resuelto mueve al grupo; lo demás llega en su propio evento.
      if (
        e.p.asunto === 'sala' &&
        e.p.opcion !== null &&
        e.p.opcion !== 'salir' &&
        e.p.opcion !== 'restaurar'
      ) {
        const lugar = e.p.opcion;
        const objetos = f.objetos.map((o) => (o.portador ? { ...o, sala: lugar } : o));
        return { ...f, lugar, objetos, votos: [], propuesta: null };
      }
      return { ...f, votos: resto };
    }
    case 'reloj':
      return { ...f, reloj: { ...e.p } };
    case 'grabacion':
      return f.grabaciones.includes(e.p.fragmento)
        ? f
        : { ...f, grabaciones: [...f.grabaciones, e.p.fragmento] };
    case 'final':
      return { ...f, fase: 'final', final: e.p.final, propuesta: null, votos: [] };
    case 'anfitrion':
      return { ...f, anfitrion: e.p.jugador };
    case 'roles':
    case 'rechazo':
      return f;
  }
}

/** Reparto del lugar actual según la copia, o null en la portería o fuera de juego. */
export function repartoDeFoto(f: Foto): RepartoConAusencias | null {
  const i = SALAS.indexOf(f.lugar as (typeof SALAS)[number]);
  if (i < 0 || f.fase !== 'jugando') return null;
  const ausencias = Object.fromEntries(f.ausentes.map((a) => [a.jugador, a.ms]));
  return repartirConAusencias(f.orden, i + 1, ausencias);
}
