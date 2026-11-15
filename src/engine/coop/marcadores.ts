/**
 * Señales del cooperativo en la escena (T91, la parte 3D): cada señal con punto se ve unos
 * segundos como un aro y una flecha del color de quien señaló, latiendo. Todas son un solo
 * `InstancedMesh`: una draw call para las 8 señales que guarda `senales`.
 */
import {
  ConeGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  RingGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Color as ColorJugador, SenalCoop } from '../../signals/coop';
import { HEX_COLOR } from './avatares';

/** Las que guarda `senales` como máximo. */
export const MAX_MARCADORES = 8;
/** Cuánto se ve cada señal, en ms. */
export const DURACION_SENAL_MS = 5000;
/** Al final se encoge hasta desaparecer. */
const MS_DESAPARECER = 400;

/** Aro plano (en el punto) y flecha que apunta hacia él desde arriba. */
export function crearGeometriaMarcador() {
  const aro = new RingGeometry(0.2, 0.28, 20);
  aro.rotateX(-Math.PI / 2);
  const flecha = new ConeGeometry(0.09, 0.22, 8);
  flecha.rotateX(Math.PI);
  flecha.translate(0, 0.45, 0);
  const g = mergeGeometries([aro, flecha]);
  aro.dispose();
  flecha.dispose();
  if (!g) throw new Error('No se pudo armar el marcador');
  return g;
}

/** Escala del marcador según su edad: late y al final se encoge. 0 = no se ve. */
export function escalaMarcador(edadMs: number): number {
  if (edadMs < 0 || edadMs >= DURACION_SENAL_MS) return 0;
  const latido = 1 + 0.15 * Math.sin((edadMs / 1000) * Math.PI * 3);
  const restante = DURACION_SENAL_MS - edadMs;
  return restante < MS_DESAPARECER ? latido * (restante / MS_DESAPARECER) : latido;
}

/** Si la señal se dibuja en la sala `s`: misma sala y con punto (0, 0, 0 es «sin punto»). */
export const senalConPunto = (x: SenalCoop, s: number): boolean =>
  x.s === s && !(x.x === 0 && x.y === 0 && x.z === 0);

export interface Marcadores {
  readonly malla: InstancedMesh;
  /**
   * Cada cuadro. `colorDe` da el color del jugador que señaló. Devuelve cuántos se ven.
   */
  cuadro(
    ahoraMs: number,
    s: number,
    lista: readonly SenalCoop[],
    colorDe: (jugador: string) => ColorJugador | null,
  ): number;
  liberar(): void;
}

export function crearMarcadores(): Marcadores {
  const geometria = crearGeometriaMarcador();
  // Sin luces: la señal se ve igual en una sala en penumbra.
  const material = new MeshBasicMaterial({ color: 0xffffff });
  const malla = new InstancedMesh(geometria, material, MAX_MARCADORES);
  malla.name = 'senales';
  malla.frustumCulled = false;
  malla.count = 0;
  const m = new Matrix4();
  const q = new Quaternion();
  const p = new Vector3();
  const e = new Vector3();
  const color = new Color();
  for (let i = 0; i < MAX_MARCADORES; i++) malla.setColorAt(i, color.setHex(0xffffff));

  return {
    malla,
    cuadro(ahoraMs, s, lista, colorDe) {
      let n = 0;
      for (let k = 0; k < lista.length && n < MAX_MARCADORES; k++) {
        const x = lista[k];
        if (!x || !senalConPunto(x, s)) continue;
        const escala = escalaMarcador(ahoraMs - x.en);
        if (escala <= 0) continue;
        m.compose(p.set(x.x / 100, x.y / 100, x.z / 100), q, e.setScalar(escala));
        malla.setMatrixAt(n, m);
        malla.setColorAt(n, color.setHex(HEX_COLOR[colorDe(x.jugador) ?? 'ambar']));
        n++;
      }
      if (n > 0 || malla.count > 0) {
        malla.instanceMatrix.needsUpdate = true;
        if (malla.instanceColor) malla.instanceColor.needsUpdate = true;
      }
      malla.count = n;
      return n;
    },
    liberar() {
      malla.removeFromParent();
      malla.dispose();
      geometria.dispose();
      material.dispose();
    },
  };
}
