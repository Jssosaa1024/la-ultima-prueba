/**
 * Sala 2 · Los tanques en 3D (T52), en tres estaciones (corrección del 25 de noviembre).
 *
 * Cada etapa tiene su estación (`content/estaciones.ts`): su tanque A, desde la segunda su
 * tanque B, y su palanca. Los tanques son de vidrio y dejan ver su líquido. En reposo, cada
 * estación muestra cómo empieza su etapa; las ya resueltas, cómo quedaron al sonar la campana.
 * Cada vez que la máquina responde (signal `resultado`), baja la palanca de la estación de esa
 * etapa y su líquido corre en tiempo real hasta que suena la campana, que se sacude; los niveles
 * se quedan quietos un momento y vuelven a su reposo.
 *
 * Un tanque tapado con cinta se ve gris y opaco: no deja ver su nivel.
 *
 * Son cinco mallas más en la sala: el líquido de cada tanque.
 *
 * Pulir salas (sesión A): el vidrio es más redondo y casi incoloro, para que el color lo dé el
 * líquido; el líquido tiene la superficie más clara (el menisco).
 * Las bases, tapas, varillas y regla de los tanques las pone `laboratorio-piezas.ts`.
 */
import { effect } from '@preact/signals';
import { Color, CylinderGeometry, Mesh, MeshLambertMaterial } from 'three';
import type { Object3D } from 'three';
import type { PuzzleDe } from '../../content/esquema';
import { ESTACIONES } from '../../content/estaciones';
import { PUZZLES } from '../../content/puzzles';
import { duracionCorridaS, nivelEn } from '../../game/puzzles';
import { etapa, mecanismo, resultado } from '../../signals/mecanismo';
import { sellos } from '../../signals/partida';
import { idaYVuelta } from './curvas';
import { Piezas } from './piezas-por-codigo';
import { sonar } from '../audio/eventos';
import type { AnimacionSala } from './tipos';

const SALA = 's2-laboratorio';
const PUZZLE = 's2-tanques';

/** Lo que los niveles se quedan quietos después de la campana, en segundos (igual que el panel). */
export const PAUSA_S = 2;
/** Lo que dura el movimiento de la palanca y la sacudida de la campana. */
const DURACION_PALANCA_S = 0.9;
const DURACION_CAMPANA_S = 0.8;
const ANGULO_PALANCA = 1.1;

/** Alto del líquido con el tanque lleno, en metros (el tanque mide 1,6 m). */
const ALTO_LIQUIDO = 1.5;
const OPACIDAD_VIDRIO = 0.3;
const COLOR_CINTA = new Color(0x8a9199);
/** Cuánto se acerca el vidrio al blanco: un tinte apenas, el color fuerte es el del líquido. */
const BLANQUEO_VIDRIO = 0.55;
/** Lados del cilindro de vidrio (la primitiva tiene 16). */
const LADOS_VIDRIO = 32;
/** Radio del líquido, por dentro del vidrio (0,35 m). */
const RADIO_LIQUIDO = 0.3;

/** Lo que la animación necesita de un tanque. */
interface Tanque {
  nivel: number;
  caudal: number;
  visible: boolean;
}

/** Lee un tanque de un estado sin tipo (viene de un signal): `null` si no hay o no tiene forma. */
function leerTanque(x: unknown): Tanque | null {
  if (typeof x !== 'object' || x === null) return null;
  const { nivel, caudal, visible } = x as Record<string, unknown>;
  if (typeof nivel !== 'number' || typeof caudal !== 'number' || typeof visible !== 'boolean') {
    return null;
  }
  return { nivel, caudal, visible };
}

function leerTanques(x: unknown): { a: Tanque | null; b: Tanque | null } {
  if (typeof x !== 'object' || x === null) return { a: null, b: null };
  const { a, b } = x as Record<string, unknown>;
  return { a: leerTanque(a), b: leerTanque(b) };
}

/** Un tanque de la sala con su líquido adentro. */
interface Vidrio {
  /** Pone el nivel (en cm) o deja el tanque vacío (`null`). `tapado`: no se ve nada adentro. */
  mostrar(nivel: number | null, alturaCm: number, tapado: boolean): void;
}

/**
 * El líquido de alto 1 (la animación lo estira): cuerpo un poco más oscuro y la superficie
 * clara, con el borde redondeado del menisco. El color lo pone el material.
 */
function geometriaLiquido(): Piezas {
  return new Piezas()
    .torno(
      [
        [0, 0],
        [RADIO_LIQUIDO, 0],
        [RADIO_LIQUIDO, 0.965],
      ],
      '#e2e2e2',
      { lados: 24 },
    )
    .torno(
      [
        [RADIO_LIQUIDO, 0.965],
        [RADIO_LIQUIDO - 0.012, 1],
        [0, 1],
      ],
      '#ffffff',
      { lados: 24 },
    );
}

/** Vidrio más redondo que la primitiva, del mismo tamaño y con la base en y = 0. */
function redondearVidrio(malla: Mesh): void {
  const g = malla.geometry as CylinderGeometry;
  if (g.type !== 'CylinderGeometry') return;
  const { radiusTop, radiusBottom, height } = g.parameters;
  g.dispose();
  malla.geometry = new CylinderGeometry(radiusTop, radiusBottom, height, LADOS_VIDRIO).translate(
    0,
    height / 2,
    0,
  );
}

function crearVidrio(tanque: Object3D | undefined): Vidrio {
  const malla = tanque as Mesh | undefined;
  const material = malla?.isMesh ? (malla.material as MeshLambertMaterial) : null;
  const color = material ? material.color.clone() : new Color(0xffffff);
  const vidrio = color.clone().lerp(new Color(0xffffff), BLANQUEO_VIDRIO);
  if (malla?.isMesh) redondearVidrio(malla);
  const liquido = new Mesh(
    geometriaLiquido().geometria(),
    new MeshLambertMaterial({ color, vertexColors: true }),
  );
  liquido.name = `liquido-${tanque?.name ?? ''}`;
  liquido.position.y = 0.03;
  liquido.visible = false;
  tanque?.add(liquido);
  if (material) {
    // El vidrio se dibuja después que el líquido y no tapa lo que tiene adentro.
    material.transparent = true;
    material.depthWrite = false;
  }
  return {
    mostrar(nivel, alturaCm, tapado) {
      if (material) {
        material.opacity = tapado ? 1 : OPACIDAD_VIDRIO;
        material.color.copy(tapado ? COLOR_CINTA : vidrio);
      }
      const lleno = nivel === null || tapado ? 0 : Math.min(1, Math.max(0, nivel / alturaCm));
      liquido.visible = lleno > 0;
      // Una escala de 0 daña las normales: con el tanque vacío, el líquido se esconde.
      if (lleno > 0) liquido.scale.y = lleno * ALTO_LIQUIDO;
    },
  };
}

/** Un tanque de una etapa: cómo empieza y su nivel cuando suena la campana. */
function nivelesDe(
  t: { nivel: number; caudal: number; visible: boolean } | null,
  campanaS: number,
  alto: number,
  alSonar: boolean,
): { nivel: number | null; tapado: boolean } {
  if (!t) return { nivel: null, tapado: false };
  return { nivel: alSonar ? nivelEn(t, campanaS, alto) : t.nivel, tapado: !t.visible };
}

/**
 * @param raiz  la sala ya construida: se buscan los tanques y la palanca de cada estación y la
 *              campana por su id. Si falta alguno, esa parte no se anima.
 */
export function animarTanques(raiz: Object3D): AnimacionSala {
  const puzzle = PUZZLES.find((p): p is PuzzleDe<'tanques'> => p.mecanismo === 'tanques');
  const campana = raiz.getObjectByName('s2-campana');
  const estaciones = ESTACIONES.map((e) => ({
    etapa: e.etapa,
    vidrioA: crearVidrio(raiz.getObjectByName(e.tanqueA)),
    vidrioB: e.tanqueB ? crearVidrio(raiz.getObjectByName(e.tanqueB)) : null,
    palanca: raiz.getObjectByName(e.palanca),
  }));

  /** La corrida en curso: en qué estación, con qué ajustes, cuánto dura y cuánto lleva. */
  let corrida: {
    estacion: number;
    a: Tanque | null;
    b: Tanque | null;
    duracion: number;
    alto: number;
    t: number;
  } | null = null;
  let conSello = sellos.peek().includes(SALA);

  /**
   * En reposo, cada estación muestra cómo empieza su etapa; las que ya se resolvieron, cómo
   * quedaron al sonar la campana (con la solución: cada etapa tiene un solo caudal que sirve).
   */
  const mostrarReposo = (): void => {
    const actual = etapa.peek();
    const enCurso = conSello ? 3 : actual?.puzzle === PUZZLE ? actual.etapa : 0;
    for (const e of estaciones) {
      const datos = puzzle?.etapas[e.etapa];
      if (!datos) continue;
      const resuelta = e.etapa < enCurso;
      const fuente = resuelta ? datos.solucion : datos.estado_inicial;
      const alto = datos.controles.altura_cm;
      const s = datos.exito.campana_s;
      const a = nivelesDe(fuente.a, s, alto, resuelta);
      const b = nivelesDe(fuente.b, s, alto, resuelta);
      e.vidrioA.mostrar(a.nivel, alto, a.tapado);
      e.vidrioB?.mostrar(b.nivel, alto, b.tapado);
    }
  };

  // El resultado que ya estaba al entrar no se anima: pasó antes de llegar.
  let ultimo = resultado.peek()?.n ?? 0;
  const dejarResultado = effect(() => {
    const r = resultado.value;
    if (!r || r.n === ultimo) return;
    ultimo = r.n;
    const datos = r.puzzle === PUZZLE ? puzzle?.etapas[r.etapa] : undefined;
    if (!datos) return;
    const { a, b } = leerTanques(r.estado);
    corrida = {
      estacion: r.etapa,
      a,
      b,
      duracion: duracionCorridaS(datos),
      alto: datos.controles.altura_cm,
      t: 0,
    };
  });
  // Al cambiar de etapa (o los ajustes), los tanques en reposo se ponen al día.
  const dejarEtapa = effect(() => {
    void etapa.value;
    void mecanismo.value;
    if (!corrida) mostrarReposo();
  });
  const dejarSellos = effect(() => {
    conSello = sellos.value.includes(SALA);
    if (!corrida) mostrarReposo();
  });

  return {
    actualizar(dt) {
      if (!corrida) return;
      const antes = corrida.t;
      corrida.t += dt;
      // La campana suena cuando la corrida llega a su tiempo (T43). El acierto o el error y el
      // sello suenan después, con su pausa (`audio/retroalimentacion.ts`).
      if (antes < corrida.duracion && corrida.t >= corrida.duracion) sonar('campana');
      const { a, b, duracion, alto, t } = corrida;
      const estacion = estaciones[corrida.estacion];
      // El líquido corre hasta la campana y ahí se queda quieto.
      const s = Math.min(t, duracion);
      estacion?.vidrioA.mostrar(a ? nivelEn(a, s, alto) : null, alto, a ? !a.visible : false);
      estacion?.vidrioB?.mostrar(b ? nivelEn(b, s, alto) : null, alto, b ? !b.visible : false);
      if (estacion?.palanca) {
        estacion.palanca.rotation.x = ANGULO_PALANCA * idaYVuelta(t, DURACION_PALANCA_S);
      }
      if (campana) {
        // La campana se sacude al sonar, cada vez menos.
        const desde = t - duracion;
        const fuerza = desde > 0 && desde < DURACION_CAMPANA_S ? 1 - desde / DURACION_CAMPANA_S : 0;
        campana.rotation.z = fuerza > 0 ? 0.35 * fuerza * Math.sin(desde * 40) : 0;
      }
      if (t >= duracion + PAUSA_S) {
        corrida = null;
        if (campana) campana.rotation.z = 0;
        if (estacion?.palanca) estacion.palanca.rotation.x = 0;
        mostrarReposo();
      }
    },
    get animando() {
      // La corrida hasta que la campana deja de sacudirse: después suena el acierto o el error.
      return corrida !== null && corrida.t < corrida.duracion + DURACION_CAMPANA_S;
    },
    get estado() {
      if (corrida) return corrida.t < corrida.duracion ? 'corriendo' : 'campana';
      return conSello ? 'sellada' : 'reposo';
    },
    liberar() {
      dejarResultado();
      dejarEtapa();
      dejarSellos();
    },
  };
}
