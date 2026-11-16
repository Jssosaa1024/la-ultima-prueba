/**
 * Sombras de contacto (T19f): sin luz horneada ni sombras en tiempo real, cada mueble que se
 * apoya en el piso lleva debajo un plano oscuro de bordes difusos. Lo une al piso a la vista y
 * cuesta casi nada: todos los planos van en UNA malla (una draw call) con una textura de 32 × 32
 * generada por código, sin descarga.
 *
 * Cada sombra es un plano de 3 × 3 trozos («nueve cortes»): el centro va oscuro parejo y el
 * borde difuso mide siempre lo mismo en metros (de `HUNDIDO` dentro del mueble a `MARGEN_SOMBRA`
 * fuera), sea una banca o una estantería. Las esquinas salen redondeadas.
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
export const MARGEN_SOMBRA = 0.14;
/** Dónde empieza a aclararse, por dentro del borde del mueble, en metros. */
const HUNDIDO = 0.06;
/** Qué tan oscura es en el centro (0 = no se ve, 1 = negra). */
export const OPACIDAD_SOMBRA = 0.5;
/** Altura sobre el piso, para que no parpadee con él. */
const ALTURA = 0.004;
/** Un mueble se apoya en el piso si su base está más abajo que esto. */
const APOYADO = 0.05;
const GRADOS = Math.PI / 180;
const LADO_TEXTURA = 32;

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

/** De 0 en el borde a 1 hacia el centro, con una curva suave. */
function suave(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** La textura: alfa en el canal A (color negro), oscura en el centro y difusa hacia el borde. */
export function texturaSombra(): DataTexture {
  const datos = new Uint8Array(LADO_TEXTURA * LADO_TEXTURA * 4);
  for (let y = 0; y < LADO_TEXTURA; y++) {
    for (let x = 0; x < LADO_TEXTURA; x++) {
      // 0 en el borde y 1 en el centro, en cada eje.
      const u = 1 - Math.abs(((x + 0.5) / LADO_TEXTURA) * 2 - 1);
      const v = 1 - Math.abs(((y + 0.5) / LADO_TEXTURA) * 2 - 1);
      datos[(y * LADO_TEXTURA + x) * 4 + 3] = Math.round(255 * suave(u) * suave(v));
    }
  }
  const textura = new DataTexture(datos, LADO_TEXTURA, LADO_TEXTURA, RGBAFormat);
  textura.magFilter = LinearFilter;
  textura.minFilter = LinearFilter;
  textura.needsUpdate = true;
  return textura;
}

/** Huella del objeto en el piso: ancho y fondo. */
function huella(o: ObjetoSala): { ancho: number; fondo: number } {
  const [ancho, , fondo] = o.tam;
  if (o.forma === 'cilindro' || o.forma === 'esfera') return { ancho, fondo: ancho };
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
    if (minX === Infinity) return { ancho: 0, fondo: 0 };
    return { ancho: maxX - minX, fondo: maxZ - minZ };
  }
  return { ancho, fondo };
}

/** Cortes de un eje: del borde de afuera al de adentro, en metros desde el centro, y su UV. */
function cortes(medio: number): { pos: number; uv: number }[] {
  const adentro = Math.max(0, medio - HUNDIDO);
  const afuera = medio + MARGEN_SOMBRA;
  return [
    { pos: -afuera, uv: 0 },
    { pos: -adentro, uv: 0.5 },
    { pos: adentro, uv: 0.5 },
    { pos: afuera, uv: 1 },
  ];
}

/** Une las sombras de `objetos` en una malla. `null` si no hay ninguna. */
export function crearSombras(objetos: readonly ObjetoSala[]): Mesh | null {
  const posiciones: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const o of objetos) {
    const { ancho, fondo } = huella(o);
    if (ancho <= 0 || fondo <= 0) continue;
    const g = (o.giro ?? 0) * GRADOS;
    const c = Math.cos(g);
    const s = Math.sin(g);
    const base = posiciones.length / 3;
    // Rejilla de 4 × 4 vértices (3 × 3 trozos).
    for (const z of cortes(fondo / 2)) {
      for (const x of cortes(ancho / 2)) {
        // El mismo giro que el objeto (rotation.y de Three.js).
        posiciones.push(o.pos[0] + x.pos * c + z.pos * s, ALTURA, o.pos[2] - x.pos * s + z.pos * c);
        uvs.push(x.uv, z.uv);
      }
    }
    for (let fila = 0; fila < 3; fila++) {
      for (let col = 0; col < 3; col++) {
        const a = base + fila * 4 + col;
        const b = a + 4;
        // Mirando hacia arriba.
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
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
