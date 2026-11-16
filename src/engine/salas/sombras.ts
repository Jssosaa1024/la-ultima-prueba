/**
 * Sombras de contacto (T19f): sin luz horneada ni sombras en tiempo real, cada mueble que se
 * apoya en el piso lleva debajo un plano oscuro de bordes difusos. Lo une al piso a la vista y
 * cuesta casi nada: todos los planos van en UNA malla (una draw call) con una textura de 64 × 32
 * generada por código, sin descarga.
 *
 * La textura tiene dos mitades: a la izquierda un rectángulo de esquinas suaves (cajas) y a la
 * derecha un círculo (cilindros y esferas).
 */
import {
  BufferGeometry,
  DataTexture,
  Float32BufferAttribute,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  RGBAFormat,
} from 'three';
import type { ObjetoSala } from '../../content/esquema-salas';

/** Lo que la sombra sobresale del mueble por cada lado, en metros. */
export const MARGEN_SOMBRA = 0.12;
/** Qué tan oscura es en el centro (0 = no se ve, 1 = negra). */
export const OPACIDAD_SOMBRA = 0.45;
/** Altura sobre el piso, para que no parpadee con él. */
const ALTURA = 0.004;
/** Un mueble se apoya en el piso si su base está más abajo que esto. */
const APOYADO = 0.05;
const GRADOS = Math.PI / 180;
const ANCHO_TEXTURA = 64;
const ALTO_TEXTURA = 32;

/**
 * Los objetos que llevan sombra: sólidos, apoyados en el piso y que no se mueven de su sitio.
 * Quedan fuera los planos (puertas, carteles), lo que se recoge (al llevárselo la sombra se
 * quedaría sola) y los grupos que se usan, porque sus piezas se animan.
 */
export function objetosConSombra(objetos: readonly ObjetoSala[]): ObjetoSala[] {
  return objetos.filter(
    (o) =>
      o.solido === true &&
      o.pos[1] < APOYADO &&
      o.forma !== 'plano' &&
      o.accion !== 'recoger' &&
      !(o.forma === 'grupo' && o.accion),
  );
}

/** Opacidad de un texel: 1 en el centro y 0 en el borde, con una caída suave. */
function caida(distanciaAlBorde: number): number {
  const t = Math.min(1, Math.max(0, distanciaAlBorde / 0.45));
  return t * t * (3 - 2 * t);
}

/** La textura de las dos mitades: alfa en el canal A, color negro. */
export function texturaSombra(): DataTexture {
  const datos = new Uint8Array(ANCHO_TEXTURA * ALTO_TEXTURA * 4);
  const mitad = ANCHO_TEXTURA / 2;
  for (let y = 0; y < ALTO_TEXTURA; y++) {
    for (let x = 0; x < ANCHO_TEXTURA; x++) {
      // Coordenadas de −1 a 1 dentro de su mitad.
      const u = (((x % mitad) + 0.5) / mitad) * 2 - 1;
      const v = ((y + 0.5) / ALTO_TEXTURA) * 2 - 1;
      const borde = x < mitad ? 1 - Math.max(Math.abs(u), Math.abs(v)) : 1 - Math.hypot(u, v);
      datos[(y * ANCHO_TEXTURA + x) * 4 + 3] = Math.round(255 * caida(borde));
    }
  }
  const textura = new DataTexture(datos, ANCHO_TEXTURA, ALTO_TEXTURA, RGBAFormat);
  textura.magFilter = LinearFilter;
  textura.minFilter = LinearFilter;
  textura.needsUpdate = true;
  return textura;
}

/** Huella del objeto en el piso: ancho y fondo, y si es redonda. */
function huella(o: ObjetoSala): { ancho: number; fondo: number; redonda: boolean } {
  const [ancho, , fondo] = o.tam;
  if (o.forma === 'cilindro' || o.forma === 'esfera') return { ancho, fondo: ancho, redonda: true };
  if (o.forma === 'grupo') {
    // La caja que encierra las piezas apoyadas en el piso.
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of o.partes ?? []) {
      if (o.pos[1] + p.pos[1] >= APOYADO) continue;
      const redonda = p.forma === 'cilindro' || p.forma === 'esfera';
      const medioX = p.tam[0] / 2;
      const medioZ = (redonda ? p.tam[0] : p.forma === 'plano' ? 0.03 : p.tam[2]) / 2;
      minX = Math.min(minX, p.pos[0] - medioX);
      maxX = Math.max(maxX, p.pos[0] + medioX);
      minZ = Math.min(minZ, p.pos[2] - medioZ);
      maxZ = Math.max(maxZ, p.pos[2] + medioZ);
    }
    if (minX === Infinity) return { ancho: 0, fondo: 0, redonda: false };
    return { ancho: maxX - minX, fondo: maxZ - minZ, redonda: false };
  }
  return { ancho, fondo, redonda: false };
}

/** Une las sombras de `objetos` en una malla. `null` si no hay ninguna. */
export function crearSombras(objetos: readonly ObjetoSala[]): Mesh | null {
  const posiciones: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const o of objetos) {
    const { ancho, fondo, redonda } = huella(o);
    if (ancho <= 0 || fondo <= 0) continue;
    const mx = ancho / 2 + MARGEN_SOMBRA;
    const mz = fondo / 2 + MARGEN_SOMBRA;
    const g = (o.giro ?? 0) * GRADOS;
    const c = Math.cos(g);
    const s = Math.sin(g);
    const u0 = redonda ? 0.5 : 0;
    const base = posiciones.length / 3;
    for (const [lx, lz, u, v] of [
      [-mx, -mz, u0, 1],
      [mx, -mz, u0 + 0.5, 1],
      [mx, mz, u0 + 0.5, 0],
      [-mx, mz, u0, 0],
    ] as const) {
      // El mismo giro que el objeto (rotation.y de Three.js).
      posiciones.push(o.pos[0] + lx * c + lz * s, ALTURA, o.pos[2] - lx * s + lz * c);
      uvs.push(u, v);
    }
    // Mirando hacia arriba.
    indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  if (indices.length === 0) return null;

  const geometria = new BufferGeometry();
  geometria.setAttribute('position', new Float32BufferAttribute(posiciones, 3));
  geometria.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometria.setIndex(indices);
  const material = new MeshBasicMaterial({
    color: 0x000000,
    map: texturaSombra(),
    transparent: true,
    opacity: OPACIDAD_SOMBRA,
    depthWrite: false,
  });
  const malla = new Mesh(geometria, material);
  malla.name = 'sombras';
  // No es algo que se toque: el rayo del toque la atraviesa.
  malla.raycast = () => undefined;
  return malla;
}
