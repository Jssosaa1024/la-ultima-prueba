/**
 * Sala 2 · Los tanques en 3D (T52).
 *
 * Los dos tanques son de vidrio y dejan ver su líquido. En reposo muestran el nivel inicial
 * de la etapa. Cada vez que la máquina responde (signal `resultado`), la palanca baja y el
 * líquido corre en tiempo real hasta que suena la campana, que se sacude; los niveles se
 * quedan quietos un momento y vuelven a como estaban. Con el sello, la incubadora se abre.
 *
 * Un tanque tapado con cinta se ve gris y opaco: no deja ver su nivel.
 *
 * Son cuatro mallas más en la sala (dos líquidos, la bandeja de la incubadora y su gota).
 *
 * Pulir salas (sesión A): el vidrio es más redondo y casi incoloro, para que el color lo dé el
 * líquido; el líquido tiene la superficie más clara (el menisco) y la bandeja, bordes y asa.
 * Las bases, tapas, varillas y regla de los tanques las pone `laboratorio-piezas.ts`.
 */
import { effect } from '@preact/signals';
import { Color, CylinderGeometry, Mesh, MeshLambertMaterial, SphereGeometry } from 'three';
import type { Object3D } from 'three';
import type { PuzzleDe } from '../../content/esquema';
import { PUZZLES } from '../../content/puzzles';
import { duracionCorridaS, nivelEn } from '../../game/puzzles';
import { etapa, mecanismo, resultado } from '../../signals/mecanismo';
import { sellos } from '../../signals/partida';
import { idaYVuelta, mezclar, suave } from './curvas';
import { PALETA } from './piezas-comunes';
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
/** Lo que tarda en salir la bandeja de la incubadora. */
export const DURACION_BANDEJA_S = 0.7;
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

const BANDEJA_DENTRO = 0.1;
const BANDEJA_FUERA = 0.55;

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

/** La bandeja de la incubadora (70 × 6 × 50 cm, centrada): fondo, bordes y un asa al frente. */
function geometriaBandeja(): Piezas {
  const p = new Piezas().caja([0.7, 0.016, 0.5], PALETA.metal, {
    pos: [0, -0.022, 0],
    bisel: 0.005,
  });
  for (const s of [1, -1]) {
    p.caja([0.7, 0.06, 0.018], PALETA.cromo, { pos: [0, 0, s * 0.241], bisel: 0.005 });
    p.caja([0.018, 0.06, 0.5], PALETA.cromo, { pos: [s * 0.341, 0, 0], bisel: 0.005 });
    p.barra([s * 0.12, 0.005, 0.25], [s * 0.12, 0.005, 0.285], 0.009, PALETA.metalOscuro, 6);
  }
  return p.barra([-0.13, 0.005, 0.285], [0.13, 0.005, 0.285], 0.011, PALETA.metalOscuro, 8);
}

/**
 * @param raiz  la sala ya construida: se buscan los tanques, la palanca, la campana y la
 *              incubadora por su id. Si falta alguno, esa parte no se anima.
 */
export function animarTanques(raiz: Object3D): AnimacionSala {
  const puzzle = PUZZLES.find((p): p is PuzzleDe<'tanques'> => p.mecanismo === 'tanques');
  const palanca = raiz.getObjectByName('s2-palanca');
  const campana = raiz.getObjectByName('s2-campana');
  const incubadora = raiz.getObjectByName('s2-incubadora');
  const vidrioA = crearVidrio(raiz.getObjectByName('s2-tanque-a'));
  const vidrioB = crearVidrio(raiz.getObjectByName('s2-tanque-b'));

  const bandeja = new Mesh(
    geometriaBandeja().geometria(),
    new MeshLambertMaterial({ vertexColors: true }),
  );
  bandeja.name = 'bandeja-incubadora';
  bandeja.position.set(0, 0.55, BANDEJA_DENTRO);
  // La gota es la silueta del sello de la sala 2 en el mural de la portería.
  const gota = new Mesh(
    new SphereGeometry(0.07, 12, 8),
    new MeshLambertMaterial({ color: 0x3498db }),
  );
  gota.scale.y = 1.3;
  gota.position.set(0, 0.12, 0.12);
  bandeja.add(gota);
  incubadora?.add(bandeja);

  /** La corrida en curso: con qué ajustes arrancó, cuánto dura y cuánto lleva. */
  let corrida: {
    a: Tanque | null;
    b: Tanque | null;
    duracion: number;
    alto: number;
    t: number;
  } | null = null;
  let conSello = sellos.peek().includes(SALA);
  let apertura = conSello ? 1 : 0;

  const colocarBandeja = (): void => {
    bandeja.visible = apertura > 0;
    bandeja.position.z = mezclar(BANDEJA_DENTRO, BANDEJA_FUERA, suave(apertura));
  };
  colocarBandeja();

  /** En reposo los tanques muestran cómo empieza la etapa pendiente; sin etapa, vacíos. */
  const mostrarReposo = (): void => {
    const actual = etapa.peek();
    const datos = actual?.puzzle === PUZZLE ? puzzle?.etapas[actual.etapa] : undefined;
    if (!datos) {
      vidrioA.mostrar(null, 1, false);
      vidrioB.mostrar(null, 1, false);
      return;
    }
    // Los niveles iniciales salen del contenido: los ajustes solo cambian el caudal.
    const { a, b } = datos.estado_inicial;
    const alto = datos.controles.altura_cm;
    vidrioA.mostrar(a.nivel, alto, !a.visible);
    vidrioB.mostrar(b ? b.nivel : null, alto, b ? !b.visible : false);
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
    if (!conSello) {
      apertura = 0;
      colocarBandeja();
    }
  });

  return {
    actualizar(dt) {
      if (corrida) {
        const antes = corrida.t;
        corrida.t += dt;
        // La campana suena cuando la corrida llega a su tiempo (T43).
        if (antes < corrida.duracion && corrida.t >= corrida.duracion) {
          // El sello suena después del acierto, con su pausa (`audio/retroalimentacion.ts`).
          sonar('campana');
        }
        const { a, b, duracion, alto, t } = corrida;
        // El líquido corre hasta la campana y ahí se queda quieto.
        const s = Math.min(t, duracion);
        vidrioA.mostrar(a ? nivelEn(a, s, alto) : null, alto, a ? !a.visible : false);
        vidrioB.mostrar(b ? nivelEn(b, s, alto) : null, alto, b ? !b.visible : false);
        if (palanca) palanca.rotation.x = ANGULO_PALANCA * idaYVuelta(t, DURACION_PALANCA_S);
        if (campana) {
          // La campana se sacude al sonar, cada vez menos.
          const desde = t - duracion;
          const fuerza =
            desde > 0 && desde < DURACION_CAMPANA_S ? 1 - desde / DURACION_CAMPANA_S : 0;
          campana.rotation.z = fuerza > 0 ? 0.35 * fuerza * Math.sin(desde * 40) : 0;
        }
        if (t >= duracion + PAUSA_S) {
          corrida = null;
          if (campana) campana.rotation.z = 0;
          mostrarReposo();
        }
      }
      // La bandeja espera a que termine la corrida que ganó el sello.
      if (conSello && !corrida && apertura < 1) {
        // La incubadora suena al empezar a abrirse (T42c).
        if (apertura === 0) sonar('incubadora');
        apertura = Math.min(1, apertura + dt / DURACION_BANDEJA_S);
        colocarBandeja();
      }
    },
    get animando() {
      // La corrida con su campana y, con el sello, la bandeja de la incubadora que sale.
      return corrida !== null || (conSello && apertura < 1);
    },
    get estado() {
      if (corrida) return corrida.t < corrida.duracion ? 'corriendo' : 'campana';
      return apertura >= 1 ? 'incubadora-abierta' : 'reposo';
    },
    liberar() {
      dejarResultado();
      dejarEtapa();
      dejarSellos();
    },
  };
}
