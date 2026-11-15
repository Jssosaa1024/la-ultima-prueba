/**
 * Sala 5 · La urna en 3D (T70): las fichas dentro de la urna y la mano mecánica, creadas por
 * código. El mecanismo se opera en su panel 2D; aquí solo se anima lo que ya decidió la
 * partida, leyendo los signals `etapa`, `mecanismo` y `resultado`.
 *
 * - **Fichas.** Las que hay en la urna: azules redondas y amarillas cuadradas, apiladas en
 *   cuatro columnas. Son dos mallas instanciadas: dos draw calls para hasta 20 fichas.
 * - **Mano mecánica.** Cada vez que se tira de la manija (un `resultado` nuevo de esta sala),
 *   baja a la urna, sube con dos fichas y las muestra un momento. Si el panel está abierto,
 *   espera a que se cierre: detrás del panel no se vería.
 * - **Urna.** El cilindro de `salas.json` se vuelve translúcido para que se vean las fichas.
 *
 * Todo cuelga de la raíz de la sala, así que se libera con ella al salir. El motor la crea con
 * `animacionDeSala()` (`./index.ts`), igual que las de las otras salas.
 */
import { effect } from '@preact/signals';
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
} from 'three';
import type { Material, Object3D } from 'three';
import { panel } from '../../signals/interfaz';
import { etapa, mecanismo, resultado } from '../../signals/mecanismo';
import type { AnimacionSala } from './tipos';

const SALA = 's5-rectoria';
const OBJETO_URNA = 's5-urna';
/** Máximo de fichas por color que dan los dispensadores (`max_por_color` del puzzle). */
export const MAX_POR_COLOR = 10;

const COLOR_AZUL = 0x5aa9e6;
const COLOR_AMARILLA = 0xf1c40f;
const COLOR_MANO = 0x8a96a3;

/** Tamaño de una ficha, en metros. */
const LADO_FICHA = 0.05;
const ALTO_FICHA = 0.012;
/** Separación de las cuatro columnas respecto al eje de la urna. */
const SEPARACION = 0.045;
/** Alto de la urna de `salas.json` y altura a la que descansa la mano sobre su borde. */
const ALTO_URNA = 0.45;
const ALTURA_REPOSO = ALTO_URNA + 0.35;
const ALTURA_AGARRE = ALTO_URNA - 0.05;

/** Duración de cada tramo de la mano, en segundos. */
const T_BAJAR = 0.5;
const T_SUBIR = 0.5;
const T_MOSTRAR = 1.5;
export const DURACION_MANO = T_BAJAR + T_SUBIR + T_MOSTRAR;

export interface FichasEnUrna {
  azules: number;
  amarillas: number;
}

/** Dónde va la ficha número `i` (desde 0), respecto a la base de la urna. */
export function posicionDeFicha(i: number): { x: number; y: number; z: number } {
  const columna = i % 4;
  const piso = Math.floor(i / 4);
  return {
    x: columna % 2 === 0 ? -SEPARACION : SEPARACION,
    y: 0.01 + piso * (ALTO_FICHA + 0.002) + ALTO_FICHA / 2,
    z: columna < 2 ? -SEPARACION : SEPARACION,
  };
}

/** Las fichas que dicen esos ajustes, o ninguna si no tienen la forma de la urna. */
export function fichasDe(estado: unknown): FichasEnUrna {
  const valido = (n: unknown): number =>
    typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= MAX_POR_COLOR ? n : 0;
  if (typeof estado !== 'object' || estado === null) return { azules: 0, amarillas: 0 };
  const e = estado as Record<string, unknown>;
  return { azules: valido(e['azules']), amarillas: valido(e['amarillas']) };
}

/** Altura de la mano, sobre la base de la urna, a los `t` segundos de empezar a bajar. */
export function alturaDeLaMano(t: number): number {
  if (t <= 0 || t >= DURACION_MANO) return ALTURA_REPOSO;
  if (t < T_BAJAR) return ALTURA_REPOSO + (ALTURA_AGARRE - ALTURA_REPOSO) * (t / T_BAJAR);
  if (t < T_BAJAR + T_SUBIR) {
    return ALTURA_AGARRE + (ALTURA_REPOSO - ALTURA_AGARRE) * ((t - T_BAJAR) / T_SUBIR);
  }
  return ALTURA_REPOSO;
}

/**
 * Las dos fichas que saca la mano de una urna con esas fichas, sin devolver la primera.
 * `null` si hay menos de dos. `true` es azul.
 */
export function sacarPareja(
  fichas: FichasEnUrna,
  azar: () => number = Math.random,
): [boolean, boolean] | null {
  const total = fichas.azules + fichas.amarillas;
  if (total < 2) return null;
  const primera = azar() * total < fichas.azules;
  const segunda = azar() * (total - 1) < fichas.azules - (primera ? 1 : 0);
  return [primera, segunda];
}

/** `estado` (el `data-maquina` del canvas) son las fichas que se ven: «3,1» es 3 azules y 1 amarilla. */
export interface AnimacionUrna extends AnimacionSala {
  /** Fichas que se ven ahora dentro de la urna. */
  readonly fichas: FichasEnUrna;
  /** La mano está en movimiento o mostrando una pareja. */
  readonly manoActiva: boolean;
}

const SIN_FICHAS: FichasEnUrna = { azules: 0, amarillas: 0 };

/**
 * Agrega las fichas y la mano a la sala de la urna. Si la sala no tiene el objeto `s5-urna`
 * (por ejemplo, si cambia de id en `salas.json`), no agrega ni anima nada.
 */
export function animarUrna(raiz: Object3D, azar: () => number = Math.random): AnimacionUrna {
  const urna = raiz.getObjectByName(OBJETO_URNA);
  if (!urna) {
    return { actualizar() {}, liberar() {}, estado: '', fichas: SIN_FICHAS, manoActiva: false };
  }

  // La urna se ve por dentro. No escribe profundidad, para no tapar las fichas.
  urna.traverse((o) => {
    const malla = o as Mesh;
    if (!malla.isMesh) return;
    for (const m of ([] as Material[]).concat(malla.material)) {
      m.transparent = true;
      m.opacity = 0.35;
      m.depthWrite = false;
    }
  });

  const grupo = new Group();
  grupo.name = 'urna-animacion';
  grupo.position.copy(urna.position);

  const azules = new InstancedMesh(
    new CylinderGeometry(LADO_FICHA / 2, LADO_FICHA / 2, ALTO_FICHA, 12),
    new MeshLambertMaterial({ color: COLOR_AZUL }),
    MAX_POR_COLOR,
  );
  const amarillas = new InstancedMesh(
    new BoxGeometry(LADO_FICHA, ALTO_FICHA, LADO_FICHA),
    new MeshLambertMaterial({ color: COLOR_AMARILLA }),
    MAX_POR_COLOR,
  );
  azules.name = 'fichas-azules';
  amarillas.name = 'fichas-amarillas';
  azules.count = 0;
  amarillas.count = 0;

  // La mano: un brazo que baja del techo, una pinza y las dos fichas que saca.
  const mano = new Group();
  mano.name = 'mano-mecanica';
  const brazo = new Mesh(
    new BoxGeometry(0.03, 1.2, 0.03).translate(0, 0.6, 0),
    new MeshLambertMaterial({ color: COLOR_MANO }),
  );
  const pinza = new Mesh(
    new BoxGeometry(0.16, 0.03, 0.08),
    new MeshLambertMaterial({ color: COLOR_MANO }),
  );
  // Cada ficha sacada tiene las dos formas; se muestra la del color que salió.
  const sacadas = [-0.045, 0.045].map((x) => {
    const redonda = new Mesh(azules.geometry, azules.material);
    const cuadrada = new Mesh(amarillas.geometry, amarillas.material);
    for (const ficha of [redonda, cuadrada]) {
      ficha.position.set(x, -0.03, 0);
      ficha.visible = false;
    }
    return { redonda, cuadrada };
  });
  mano.add(brazo, pinza, ...sacadas.flatMap((s) => [s.redonda, s.cuadrada]));
  mano.position.y = ALTURA_REPOSO;
  grupo.add(azules, amarillas, mano);
  raiz.add(grupo);

  let visibles: FichasEnUrna = SIN_FICHAS;
  // El texto se arma solo cuando cambian las fichas: el motor lo lee en cada cuadro.
  let estado = '0,0';
  const matriz = new Matrix4();
  const poner = (fichas: FichasEnUrna): void => {
    if (fichas.azules === visibles.azules && fichas.amarillas === visibles.amarillas) return;
    visibles = fichas;
    estado = `${fichas.azules},${fichas.amarillas}`;
    // Primero las azules y encima, en el mismo orden, las amarillas.
    for (let i = 0; i < fichas.azules; i++) {
      const p = posicionDeFicha(i);
      azules.setMatrixAt(i, matriz.makeTranslation(p.x, p.y, p.z));
    }
    for (let i = 0; i < fichas.amarillas; i++) {
      const p = posicionDeFicha(fichas.azules + i);
      amarillas.setMatrixAt(i, matriz.makeTranslation(p.x, p.y, p.z));
    }
    azules.count = fichas.azules;
    amarillas.count = fichas.amarillas;
    azules.instanceMatrix.needsUpdate = true;
    amarillas.instanceMatrix.needsUpdate = true;
  };

  /** Segundos desde que la mano empezó a bajar; `null` si está en reposo. */
  let tiempo: number | null = null;
  let pareja: [boolean, boolean] | null = null;
  /** Último resultado que la mano ya representó, y el que espera a que se cierre el panel. */
  let animado = resultado.peek()?.n ?? 0;
  let pendiente: FichasEnUrna | null = null;

  const mostrarSacadas = (ver: boolean): void => {
    sacadas.forEach((s, i) => {
      const azul = pareja?.[i];
      s.redonda.visible = ver && azul === true;
      s.cuadrada.visible = ver && azul === false;
    });
  };

  const dejarDeSeguir = effect(() => {
    const actual = etapa.value;
    const r = resultado.value;
    const deEstaSala = r?.sala === SALA ? r : null;
    // Con una etapa pendiente, lo que hay en la urna; con la sala resuelta, lo último que tuvo.
    if (actual?.sala === SALA) poner(fichasDe(mecanismo.value));
    else poner(fichasDe(deEstaSala?.estado));

    if (deEstaSala && deEstaSala.n > animado) {
      animado = deEstaSala.n;
      pendiente = fichasDe(deEstaSala.estado);
    }
    // La mano juega cuando el jugador puede verla: sin panel encima.
    if (panel.value === null) empezarSiHayPendiente();
  });

  function empezarSiHayPendiente(): void {
    if (!pendiente || tiempo !== null) return;
    pareja = sacarPareja(pendiente, azar);
    pendiente = null;
    tiempo = 0;
  }

  return {
    actualizar(dt) {
      if (tiempo === null) return;
      tiempo += dt;
      mano.position.y = alturaDeLaMano(tiempo);
      // Las fichas aparecen en la pinza al tocar el fondo y se sueltan al terminar.
      mostrarSacadas(tiempo >= T_BAJAR && tiempo < DURACION_MANO);
      if (tiempo >= DURACION_MANO) {
        tiempo = null;
        pareja = null;
        // Si se tiró otra vez de la manija mientras la mano jugaba, juega de nuevo.
        if (panel.peek() === null) empezarSiHayPendiente();
      }
    },
    get estado() {
      return estado;
    },
    get fichas() {
      return visibles;
    },
    get manoActiva() {
      return tiempo !== null;
    },
    liberar() {
      dejarDeSeguir();
      grupo.removeFromParent();
      azules.geometry.dispose();
      amarillas.geometry.dispose();
      (azules.material as Material).dispose();
      (amarillas.material as Material).dispose();
      azules.dispose();
      amarillas.dispose();
      brazo.geometry.dispose();
      (brazo.material as Material).dispose();
      pinza.geometry.dispose();
      (pinza.material as Material).dispose();
    },
  };
}
