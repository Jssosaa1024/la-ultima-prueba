/**
 * Sala 2 · Las flechas que revela la linterna (T75).
 *
 * Con la linterna de la portería en el inventario, en el piso del laboratorio se ven unas
 * flechas moradas que van de la entrada al gabinete donde está la grabación 1. Sin la
 * linterna no se ven. Son una sola malla (una llamada de dibujo) y no se pueden tocar.
 */
import { effect } from '@preact/signals';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial } from 'three';
import type { Object3D } from 'three';
import { OBJETO_LINTERNA } from '../../content/grabaciones';
import { inventario } from '../../signals/partida';
import type { AnimacionSala } from './tipos';

/** De dónde a dónde van las flechas, en el piso (x, z): de la entrada al frente del gabinete. */
export const RUTA_FLECHAS = { desde: [-0.6, 1.7], hasta: [-3.5, -2.1] } as const;
export const CANTIDAD_FLECHAS = 5;
/** Apenas por encima del piso, para que no parpadeen con él. */
const ALTURA = 0.012;
const LARGO = 0.5;
const ANCHO = 0.26;

/**
 * Triángulos de las flechas, en el plano del piso. Cada flecha es una cola (dos triángulos)
 * y una punta (uno), y todas apuntan hacia el final de la ruta.
 */
export function geometriaDeFlechas(): BufferGeometry {
  const [x0, z0] = RUTA_FLECHAS.desde;
  const [x1, z1] = RUTA_FLECHAS.hasta;
  const largoRuta = Math.hypot(x1 - x0, z1 - z0);
  // Hacia dónde apuntan (d) y su perpendicular en el piso (p).
  const d = [(x1 - x0) / largoRuta, (z1 - z0) / largoRuta] as const;
  const p = [-d[1], d[0]] as const;
  const posiciones: number[] = [];
  /** Un punto de la flecha: `a` metros hacia adelante y `l` metros hacia el lado. */
  const punto = (cx: number, cz: number, a: number, l: number): void => {
    posiciones.push(cx + d[0] * a + p[0] * l, ALTURA, cz + d[1] * a + p[1] * l);
  };
  for (let i = 0; i < CANTIDAD_FLECHAS; i++) {
    const f = (i + 0.5) / CANTIDAD_FLECHAS;
    const cx = x0 + (x1 - x0) * f;
    const cz = z0 + (z1 - z0) * f;
    const cola = ANCHO * 0.22;
    // Cola: un rectángulo angosto en la mitad de atrás.
    punto(cx, cz, -LARGO / 2, -cola);
    punto(cx, cz, 0, -cola);
    punto(cx, cz, 0, cola);
    punto(cx, cz, -LARGO / 2, -cola);
    punto(cx, cz, 0, cola);
    punto(cx, cz, -LARGO / 2, cola);
    // Punta: un triángulo en la mitad de adelante.
    punto(cx, cz, 0, -ANCHO / 2);
    punto(cx, cz, LARGO / 2, 0);
    punto(cx, cz, 0, ANCHO / 2);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(posiciones, 3));
  return g;
}

/**
 * @param raiz  la sala ya construida: las flechas se le agregan y se liberan con ella.
 */
export function animarFlechas(raiz: Object3D): AnimacionSala {
  // Sin luces: se ven igual en la penumbra, como tinta que brilla con luz ultravioleta.
  const flechas = new Mesh(
    geometriaDeFlechas(),
    new MeshBasicMaterial({ color: 0xb388ff, side: DoubleSide }),
  );
  flechas.name = 'flechas-linterna';
  // No son un objeto de la sala: un toque las atraviesa y llega a lo que haya detrás.
  flechas.raycast = () => {};
  raiz.add(flechas);

  const dejarInventario = effect(() => {
    flechas.visible = inventario.value.some((o) => o.id === OBJETO_LINTERNA);
  });

  return {
    actualizar() {},
    get estado() {
      return flechas.visible ? 'flechas' : 'sin-flechas';
    },
    liberar() {
      dejarInventario();
    },
  };
}
