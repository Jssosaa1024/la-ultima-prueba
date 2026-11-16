/**
 * Los compañeros del cooperativo en el motor (T82): envía la pose propia a `POSES_POR_SEGUNDO`
 * en movimiento (más una al detenerse) y dibuja a los demás interpolados un poco en el pasado
 * (`RETRASO_INTERPOLACION_MS`, en `poses.ts`). También dibuja
 * las señales de la sala (T91).
 *
 * El motor lo carga con `import()` solo en el modo cooperativo. Habla con la red únicamente
 * por signals: escribe `poseParaEnviar` y `miPosicion`, y lee `poseRecibida` y `coop`.
 */
import { effect } from '@preact/signals';
import type { Object3D } from 'three';
import { LUGARES } from '../../content/lugares';
import type { Lugar } from '../../content/esquema-salas';
import { coop, miPosicion, senales } from '../../signals/coop';
import type { Color } from '../../signals/coop';
import { poseParaEnviar, poseRecibida, ultimasPoses } from '../../signals/poses';
import { crearAvatares, MAX_COMPANEROS } from './avatares';
import { crearMarcadores } from './marcadores';
import { aCm, crearEmisorPoses, crearInterpolador, yawACentesimas } from './poses';
import type { Interpolador, PoseMundo, PoseRed } from './poses';

/** Cada cuánto se escribe la posición de los demás en el canvas, para las e2e. */
const MS_ENTRE_ATRIBUTOS = 250;

export interface Companeros {
  /** Cada cuadro, después de mover al jugador. */
  cuadro(ahoraMs: number, lugar: Lugar, x: number, z: number, yaw: number): void;
  liberar(): void;
}

export function crearCompaneros(escena: Object3D, canvas: HTMLCanvasElement): Companeros {
  const emisor = crearEmisorPoses();
  const interpoladores = new Map<string, Interpolador>();
  const avatares = crearAvatares();
  escena.add(avatares.malla);
  const marcadores = crearMarcadores();
  escena.add(marcadores.malla);
  let senalesVistas = -1;
  const colorDe = (jugador: string): Color | null =>
    coop.peek().jugadores.find((j) => j.jugador === jugador)?.color ?? null;
  const muestra: PoseMundo = { s: 0, x: 0, y: 0, z: 0, yaw: 0 };
  let ultimoAtributo = 0;

  const guardar = (r: { de: string; pose: PoseRed; en: number }): void => {
    let i = interpoladores.get(r.de);
    if (!i) interpoladores.set(r.de, (i = crearInterpolador()));
    i.recibir(r.en, r.pose);
  };
  // Las que llegaron antes de cargar este módulo (un jugador quieto no vuelve a enviar).
  for (const r of ultimasPoses.values()) guardar(r);
  const dejarDeRecibir = effect(() => {
    const r = poseRecibida.value;
    if (r) guardar(r);
  });
  // Si cambia quién está conectado (alguien llega o vuelve), la pose propia sale de nuevo:
  // quien llega no tiene la de un jugador quieto.
  let conectados = '';
  const dejarDeSeguirGrupo = effect(() => {
    const ahora = coop.value.jugadores
      .filter((j) => j.conectado)
      .map((j) => j.jugador)
      .join(',');
    if (ahora !== conectados) emisor.reiniciar();
    conectados = ahora;
  });

  return {
    cuadro(ahoraMs, lugar, x, z, yaw) {
      const s = LUGARES.indexOf(lugar);
      // Los pies, en el piso: y = 0.
      const pose = emisor.cuadro(ahoraMs, s, aCm(x), 0, aCm(z), yawACentesimas(yaw));
      if (pose) {
        poseParaEnviar.value = pose;
        miPosicion.value = { x: pose.x / 100, y: 0, z: pose.z / 100 };
      }

      let n = 0;
      let texto = '';
      const escribir = ahoraMs - ultimoAtributo >= MS_ENTRE_ATRIBUTOS;
      const jugadores = coop.peek().jugadores;
      for (let k = 0; k < jugadores.length; k++) {
        const j = jugadores[k];
        if (!j || j.yo || !j.conectado || n >= MAX_COMPANEROS) continue;
        const interpolador = interpoladores.get(j.jugador);
        if (!interpolador?.muestra(ahoraMs, muestra) || muestra.s !== s) continue;
        avatares.poner(n, muestra.x, muestra.y, muestra.z, muestra.yaw, j.color, j.alias);
        n++;
        if (escribir)
          texto += `${texto ? ';' : ''}${j.alias}:${muestra.x.toFixed(2)},${muestra.z.toFixed(2)}`;
      }
      avatares.mostrar(n);

      // Señales (T91): `find` solo corre si hay señales en la lista.
      const vistas = marcadores.cuadro(ahoraMs, s, senales.peek(), colorDe);
      if (vistas !== senalesVistas) {
        senalesVistas = vistas;
        canvas.dataset['senales'] = String(vistas);
      }
      if (escribir) {
        ultimoAtributo = ahoraMs;
        if (canvas.dataset['companeros'] !== texto) canvas.dataset['companeros'] = texto;
      }
    },
    liberar() {
      dejarDeRecibir();
      dejarDeSeguirGrupo();
      avatares.liberar();
      marcadores.liberar();
      interpoladores.clear();
      delete canvas.dataset['companeros'];
      delete canvas.dataset['senales'];
    },
  };
}
