/**
 * Colisión del jugador (T17): una cápsula vertical contra cajas alineadas a los ejes.
 *
 * El piso es plano en todas las salas, así que la cápsula se trata como un círculo en el
 * plano XZ que solo choca con las cajas que ocupan su altura (de los pies a la cabeza).
 * Al chocar, el jugador se desliza a lo largo de la pared en vez de frenarse en seco.
 * Matemática pura, sin Three, para probarla con tests.
 */

/** Caja de colisión alineada a los ejes, en metros. */
export interface Caja {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

export interface Capsula {
  /** Radio en el piso, en metros. */
  radio: number;
  /** Altura de los pies a la cabeza, en metros. */
  altura: number;
}

/** Jugador de grado 10: 30 cm de radio y 1,7 m de alto. */
export const CAPSULA_JUGADOR: Capsula = { radio: 0.3, altura: 1.7 };

/** Lo que mide menos que esto (tapetes, el piso mismo) no estorba al caminar. */
export const ALTURA_PASO = 0.05;

const ITERACIONES = 4;

const ocupaLaAltura = (c: Caja, piesY: number, capsula: Capsula): boolean =>
  c.maxY > piesY + ALTURA_PASO && c.minY < piesY + capsula.altura;

/** Empuja el círculo (x, z) fuera de la caja si se solapan. Devuelve la nueva posición. */
function separar(x: number, z: number, c: Caja, r: number): { x: number; z: number } | null {
  const cx = Math.min(Math.max(x, c.minX), c.maxX);
  const cz = Math.min(Math.max(z, c.minZ), c.maxZ);
  const dx = x - cx;
  const dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;

  if (d2 > 1e-12) {
    // El centro está fuera de la caja: se aleja del punto más cercano hasta tocar el borde.
    const d = Math.sqrt(d2);
    const empuje = (r - d) / d;
    return { x: x + dx * empuje, z: z + dz * empuje };
  }
  // El centro quedó dentro de la caja: sale por la cara más cercana.
  const salidas = [
    { x: c.minX - r, z, distancia: x - c.minX },
    { x: c.maxX + r, z, distancia: c.maxX - x },
    { x, z: c.minZ - r, distancia: z - c.minZ },
    { x, z: c.maxZ + r, distancia: c.maxZ - z },
  ];
  salidas.sort((a, b) => a.distancia - b.distancia);
  const mejor = salidas[0];
  return mejor ? { x: mejor.x, z: mejor.z } : null;
}

/** Deja la posición (x, z) fuera de todas las cajas que ocupan la altura del jugador. */
export function resolverSolapes(
  x: number,
  z: number,
  piesY: number,
  cajas: readonly Caja[],
  capsula: Capsula = CAPSULA_JUGADOR,
): { x: number; z: number } {
  let p = { x, z };
  // Varias pasadas: salir de una caja puede meter al jugador en otra (esquinas).
  for (let i = 0; i < ITERACIONES; i++) {
    let movido = false;
    for (const c of cajas) {
      if (!ocupaLaAltura(c, piesY, capsula)) continue;
      const nuevo = separar(p.x, p.z, c, capsula.radio);
      if (nuevo) {
        p = nuevo;
        movido = true;
      }
    }
    if (!movido) break;
  }
  return p;
}

/**
 * Mueve al jugador desde (x, z) con el desplazamiento (dx, dz) sin atravesar cajas.
 * Avanza en pasos de medio radio como máximo, para que un tirón (por ejemplo tras una pausa)
 * no lo haga saltar al otro lado de una pared delgada.
 */
export function moverConColision(
  x: number,
  z: number,
  dx: number,
  dz: number,
  piesY: number,
  cajas: readonly Caja[],
  capsula: Capsula = CAPSULA_JUGADOR,
): { x: number; z: number } {
  const largo = Math.hypot(dx, dz);
  const pasos = Math.max(1, Math.ceil(largo / (capsula.radio * 0.5)));
  let p = { x, z };
  for (let i = 0; i < pasos; i++) {
    p = resolverSolapes(p.x + dx / pasos, p.z + dz / pasos, piesY, cajas, capsula);
  }
  return p;
}
