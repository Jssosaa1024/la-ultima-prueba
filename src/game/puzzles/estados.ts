import type { EstadoDe, EtapaDe, Puzzle } from '../../content/esquema';

/**
 * Todos los estados que el jugador puede armar en una etapa (T23). Como los controles son
 * discretos, se pueden recorrer completos: lo usan `hash-answers` para sacar el hash de cada
 * estado resuelto y los tests para comparar el validador con las reglas.
 */

const rango = (min: number, max: number): number[] =>
  Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);

/** Rodillos de la caja, sin repetir, en cualquier orden y hasta el máximo de la máquina. */
function* estadosEtiquetadora(e: EtapaDe<'etiquetadora'>): Generator<EstadoDe<'etiquetadora'>> {
  const { rodillos, max_rodillos } = e.controles;
  function* elegir(puestos: number[]): Generator<number[]> {
    yield puestos;
    if (puestos.length === max_rodillos) return;
    for (const r of rodillos) {
      if (!puestos.includes(r)) yield* elegir([...puestos, r]);
    }
  }
  for (const puestos of elegir([])) yield { ...e.estado_inicial, rodillos: puestos };
}

/** Cada perilla libre, en cada caudal de su rango. */
function* estadosTanques(e: EtapaDe<'tanques'>): Generator<EstadoDe<'tanques'>> {
  const { perillas, caudal_min, caudal_max } = e.controles;
  const { a, b } = e.estado_inicial;
  const caudales = rango(caudal_min, caudal_max);
  const deA = perillas.includes('a') ? caudales : [a.caudal];
  const deB = b !== null && perillas.includes('b') ? caudales : [b?.caudal ?? 0];
  for (const ca of deA) {
    for (const cb of deB) {
      yield { a: { ...a, caudal: ca }, b: b === null ? null : { ...b, caudal: cb } };
    }
  }
}

/** Cada muesca (si se puede girar), cada posición de los postes móviles y cada largo de polea. */
function* estadosReflector(e: EtapaDe<'reflector'>): Generator<EstadoDe<'reflector'>> {
  const c = e.controles;
  const inicial = e.estado_inicial;
  const muescas = c.girar ? c.muescas : [inicial.muesca];
  const poleas = c.polea ? rango(c.polea.min, c.polea.max) : [inicial.polea];
  const distancias = rango(c.distancia_min, c.distancia_max);

  type Postes = EstadoDe<'reflector'>['postes'];
  function* mover(i: number, hechos: Postes): Generator<Postes> {
    const poste = inicial.postes[i];
    if (!poste) {
      yield hechos;
      return;
    }
    if (!c.postes_moviles.includes(poste.id)) {
      yield* mover(i + 1, [...hechos, poste]);
      return;
    }
    for (const distancia of distancias) yield* mover(i + 1, [...hechos, { ...poste, distancia }]);
  }

  for (const muesca of muescas) {
    for (const postes of mover(0, [])) {
      for (const polea of poleas) yield { muesca, postes, polea };
    }
  }
}

/** Cada reparto de libros en los carritos, sin pasar de los que hay en la pila. */
function* estadosCarritos(e: EtapaDe<'carritos'>): Generator<EstadoDe<'carritos'>> {
  const { carritos, libros } = e.controles;
  function* repartir(faltan: number, quedan: number): Generator<number[]> {
    if (faltan === 0) {
      yield [];
      return;
    }
    for (let n = 0; n <= quedan; n++) {
      for (const resto of repartir(faltan - 1, quedan - n)) yield [n, ...resto];
    }
  }
  for (const reparto of repartir(carritos, libros)) yield { carritos: reparto };
}

/** Cada cantidad de fichas de cada color que dan los dispensadores. */
function* estadosUrna(e: EtapaDe<'urna'>): Generator<EstadoDe<'urna'>> {
  const fichas = rango(0, e.controles.max_por_color);
  for (const azules of fichas) {
    for (const amarillas of fichas) yield { azules, amarillas };
  }
}

/** Todos los estados válidos de una etapa. Vacío si la etapa no existe. */
export function* estadosPosibles(puzzle: Puzzle, etapa: number): Generator<unknown> {
  switch (puzzle.mecanismo) {
    case 'etiquetadora': {
      const e = puzzle.etapas[etapa];
      if (e) yield* estadosEtiquetadora(e);
      return;
    }
    case 'tanques': {
      const e = puzzle.etapas[etapa];
      if (e) yield* estadosTanques(e);
      return;
    }
    case 'reflector': {
      const e = puzzle.etapas[etapa];
      if (e) yield* estadosReflector(e);
      return;
    }
    case 'carritos': {
      const e = puzzle.etapas[etapa];
      if (e) yield* estadosCarritos(e);
      return;
    }
    case 'urna': {
      const e = puzzle.etapas[etapa];
      if (e) yield* estadosUrna(e);
      return;
    }
  }
}
