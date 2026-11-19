/**
 * Ayudas de las pruebas de geometría por código (pulir salas, sesión A): caras al revés y
 * normales rotas.
 */
import { Vector3 } from 'three';
import type { BufferGeometry } from 'three';

/** Cuántos triángulos tienen la cara al revés de sus normales (deben ser 0). */
export function carasAlReves(g: BufferGeometry): number {
  const p = g.getAttribute('position');
  const n = g.getAttribute('normal');
  let malas = 0;
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const m = new Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1).sub(a);
    c.fromBufferAttribute(p, i + 2).sub(a);
    const cara = b.clone().cross(c);
    m.set(0, 0, 0);
    for (let v = 0; v < 3; v++) m.add(new Vector3().fromBufferAttribute(n, i + v));
    if (cara.dot(m) < 0) malas++;
  }
  return malas;
}

/** Normales de largo 1 y sin NaN. */
export function normalesSanas(g: BufferGeometry): boolean {
  const n = g.getAttribute('normal');
  const v = new Vector3();
  for (let i = 0; i < n.count; i++) {
    v.fromBufferAttribute(n, i);
    if (!Number.isFinite(v.x + v.y + v.z) || Math.abs(v.length() - 1) > 1e-3) return false;
  }
  return true;
}
