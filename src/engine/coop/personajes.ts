/**
 * Personajes del cooperativo (T83c): cada compañero es un estudiante animado, con la camiseta
 * del color de su jugador. Reemplazan la cápsula de T83; el alias sigue en `avatares.ts`.
 *
 * - **Modelo:** al principio, el de prueba hecho por código (`personaje-prueba.ts`); cuando
 *   llega el GLB del paquete CC0 (`modelo-personajes.ts`), `cambiarModelo` lo reemplaza.
 * - **Variante:** sale del color del jugador (`varianteDe`): compañeros distintos y siempre el
 *   mismo personaje para el mismo jugador.
 * - **Animación:** quieto o caminando según la velocidad interpolada (`animacion-personaje.ts`),
 *   con el clip de caminar a la rapidez que no deja patinar. El saludo es un clip aditivo que
 *   solo gira el brazo: sirve quieto o caminando. Con `prefers-reduced-motion` no se saluda.
 * - **Costo:** un `SkinnedMesh` no se instancia, así que cada personaje cuesta una draw call por
 *   material (1 el de prueba, 2 el de Kenney). El mezclador solo corre si el personaje está a
 *   la vista; fuera de ella, el cuerpo se oculta y no se anima.
 */
import {
  AdditiveAnimationBlendMode,
  AnimationClip,
  AnimationMixer,
  Color,
  Frustum,
  Group,
  LoopOnce,
  Matrix4,
  Quaternion,
  QuaternionKeyframeTrack,
  Sphere,
  Vector3,
} from 'three';
import type {
  AnimationAction,
  Camera,
  Material,
  Mesh,
  Object3D,
  SkinnedMesh,
  WebGLProgramParametersWithUniforms,
} from 'three';
import { clone as clonarConEsqueleto } from 'three/addons/utils/SkeletonUtils.js';
import { COLORES } from '../../game/coop/apariencia';
import type { Color as ColorJugador } from '../../signals/coop';
import { crearAndar, varianteDe } from './animacion-personaje';
import type { Andar, Paso } from './animacion-personaje';
import { HEX_COLOR } from './avatares';

/** Un paquete de personajes listo para clonar. */
export interface ModeloPersonajes {
  /** `prueba` o el nombre del paquete: va en `data-personajes` para las e2e. */
  readonly nombre: string;
  /**
   * Los personajes distintos. Cada uno mira hacia −Z, con los pies en y = 0, en metros, y con
   * sus mallas con piel (`SkinnedMesh`). La parte del uniforme lleva el atributo `tinte` = 1.
   */
  readonly variantes: readonly Object3D[];
  /** Los tres clips, con los nombres de huesos que comparten todas las variantes. */
  readonly clips: { quieto: AnimationClip; caminar: AnimationClip; saludar: AnimationClip };
  /** Metros por segundo del clip de caminar a rapidez 1 (para que los pies no patinen). */
  readonly velocidadCaminar: number;
  liberar(): void;
}

/** Hacia dónde gira el brazo del saludo, en grados, a lo largo del clip. */
const SALUDO_TIEMPOS = [0, 0.25, 0.45, 0.65, 0.85, 1.05, 1.25, 1.6];
const SALUDO_GRADOS = [0, 150, 125, 155, 125, 155, 140, 0];

/**
 * Clip del saludo para un esqueleto cualquiera: sube el brazo, lo agita tres veces y lo baja.
 * Es aditivo (empieza sin giro): se suma a lo que haga el brazo, quieto o caminando. Ningún
 * paquete CC0 de Kenney trae un saludo con la mano, así que va por código.
 * @param eje eje local del hueso que levanta el brazo hacia afuera; `signo` lo invierte.
 */
export function clipSaludo(hueso: string, eje: Vector3, signo = 1): AnimationClip {
  const q = new Quaternion();
  const valores = SALUDO_GRADOS.flatMap((g) =>
    q.setFromAxisAngle(eje, (signo * g * Math.PI) / 180).toArray(),
  );
  const duracion = SALUDO_TIEMPOS[SALUDO_TIEMPOS.length - 1] ?? 1.6;
  return new AnimationClip('saludar', duracion, [
    new QuaternionKeyframeTrack(`${hueso}.quaternion`, SALUDO_TIEMPOS, valores),
  ]);
}

/** Más instancias guardadas que esto y se liberan las que no se ven (jugadores que se fueron). */
const MAX_GUARDADOS = 6;
/** Tiempo para pasar de quieto a caminar y al revés. */
const MEZCLA_PASO_S = 0.25;
/** Esfera que envuelve al personaje para saber si está a la vista. */
const RADIO_VISTA = 1.1;
const ALTO_CENTRO = 0.9;
/** Más que esto sin animar (fuera de la vista) y no se adelanta todo de golpe. */
const MAX_DT_S = 0.1;

/**
 * Pinta la parte del uniforme (`tinte` = 1) con el color del jugador, sin perder la luz y la
 * sombra de la textura: el color se escala con la luminancia del original.
 */
const MEZCLA_TINTE = `
float luzTinte = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
diffuseColor.rgb = mix(diffuseColor.rgb, colorUniforme * mix(0.7, 1.0, clamp(luzTinte * 1.3, 0.0, 1.0)), vTinte);`;

/** Copia del material con el tinte del uniforme; todas comparten el mismo programa. */
export function materialConTinte(material: Material, color: { value: Color }): Material {
  const m = material.clone();
  m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms['colorUniforme'] = color;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float tinte;\nvarying float vTinte;',
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTinte = tinte;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 colorUniforme;\nvarying float vTinte;',
      )
      .replace('#include <color_fragment>', `#include <color_fragment>${MEZCLA_TINTE}`);
  };
  m.customProgramCacheKey = () => 'personaje-tinte';
  return m;
}

/** `true` si el sistema pide reducir el movimiento: entonces no se saluda. */
function prefiereQuieto(): boolean {
  try {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

interface Instancia {
  jugador: string;
  color: ColorJugador;
  raiz: Group;
  materiales: Material[];
  esqueletos: SkinnedMesh[];
  mezclador: AnimationMixer;
  quieto: AnimationAction;
  caminar: AnimationAction;
  saludo: AnimationAction;
  andar: Andar;
  pesoCaminar: number;
  /** Última vez que corrió el mezclador (ms), o NaN. */
  animadoEn: number;
  /** Cuadro en que se puso por última vez. */
  puestoEn: number;
  enVista: boolean;
}

/** Lo que hace un personaje, para el atributo de las e2e. */
export interface EstadoPersonaje {
  paso: Paso;
  saluda: boolean;
  enVista: boolean;
}

export interface Personajes {
  /** Va a la escena; los personajes cuelgan de aquí. */
  readonly grupo: Group;
  /** `prueba` o el paquete que se está usando. */
  readonly modelo: string;
  /** Cuántos se animaron en el último cuadro (los que están a la vista). */
  readonly animados: number;
  /** Pone al personaje de `jugador` en (x, y, z) mirando a `yaw` (pies en el piso). */
  poner(
    jugador: string,
    color: ColorJugador,
    x: number,
    y: number,
    z: number,
    yaw: number,
    ahoraMs: number,
  ): void;
  /** Después de ponerlos a todos: oculta a los demás, mira cuáles se ven y anima solo esos. */
  terminar(ahoraMs: number, camara: Camera): void;
  /** El personaje de `jugador` saluda una vez. `false` si no se vio (o no se saluda). */
  saludar(jugador: string): boolean;
  estado(jugador: string): EstadoPersonaje | null;
  /** Cambia de paquete (de la prueba al GLB). El anterior se libera. */
  cambiarModelo(modelo: ModeloPersonajes): void;
  liberar(): void;
}

export function crearPersonajes(modeloInicial: ModeloPersonajes): Personajes {
  const grupo = new Group();
  grupo.name = 'personajes';
  let modelo = modeloInicial;
  const instancias = new Map<string, Instancia>();
  let cuadro = 0;
  let animados = 0;
  const frustum = new Frustum();
  const vista = new Matrix4();
  const esfera = new Sphere(new Vector3(), RADIO_VISTA);

  const crear = (jugador: string, color: ColorJugador): Instancia => {
    const i = varianteDe(COLORES.indexOf(color), modelo.variantes.length);
    const original = modelo.variantes[i];
    if (!original) throw new Error('El modelo de personajes no tiene variantes');
    const copia = clonarConEsqueleto(original);
    const tono = { value: new Color(HEX_COLOR[color]) };
    const materiales: Material[] = [];
    const esqueletos: SkinnedMesh[] = [];
    const propios = new Map<Material, Material>();
    copia.traverse((o) => {
      const malla = o as Mesh;
      if (!malla.isMesh) return;
      const cambiar = (m: Material): Material => {
        let nuevo = propios.get(m);
        if (!nuevo) {
          nuevo = materialConTinte(m, tono);
          propios.set(m, nuevo);
          materiales.push(nuevo);
        }
        return nuevo;
      };
      malla.material = Array.isArray(malla.material)
        ? malla.material.map(cambiar)
        : cambiar(malla.material);
      if ((malla as SkinnedMesh).isSkinnedMesh) esqueletos.push(malla as SkinnedMesh);
    });
    const raiz = new Group();
    raiz.name = `personaje-${color}`;
    raiz.add(copia);
    grupo.add(raiz);

    const mezclador = new AnimationMixer(copia);
    const quieto = mezclador.clipAction(modelo.clips.quieto).play();
    const caminar = mezclador.clipAction(modelo.clips.caminar).play();
    caminar.setEffectiveWeight(0);
    const saludo = mezclador.clipAction(
      modelo.clips.saludar,
      undefined,
      AdditiveAnimationBlendMode,
    );
    saludo.setLoop(LoopOnce, 1);
    saludo.clampWhenFinished = false;
    // Cada jugador arranca el ciclo en un punto distinto: no respiran al mismo tiempo.
    quieto.time = (i * 0.37) % modelo.clips.quieto.duration;
    return {
      jugador,
      color,
      raiz,
      materiales,
      esqueletos,
      mezclador,
      quieto,
      caminar,
      saludo,
      andar: crearAndar(modelo.velocidadCaminar),
      pesoCaminar: 0,
      animadoEn: NaN,
      puestoEn: -1,
      enVista: false,
    };
  };

  const quitar = (p: Instancia): void => {
    p.mezclador.stopAllAction();
    p.mezclador.uncacheRoot(p.mezclador.getRoot());
    for (const m of p.materiales) m.dispose();
    // Cada copia tiene su esqueleto (y su textura de huesos en la GPU).
    for (const s of p.esqueletos) s.skeleton.dispose();
    p.raiz.removeFromParent();
    instancias.delete(p.jugador);
  };

  return {
    grupo,
    get modelo() {
      return modelo.nombre;
    },
    get animados() {
      return animados;
    },
    poner(jugador, color, x, y, z, yaw, ahoraMs) {
      let p = instancias.get(jugador);
      // Cambió de color (en la sala de espera): otra variante y otro tono.
      if (p && p.color !== color) {
        quitar(p);
        p = undefined;
      }
      if (!p) {
        p = crear(jugador, color);
        instancias.set(jugador, p);
      }
      p.raiz.position.set(x, y, z);
      p.raiz.rotation.y = yaw;
      p.andar.medir(ahoraMs, x, z);
      p.puestoEn = cuadro;
    },
    terminar(ahoraMs, camara) {
      camara.updateMatrixWorld();
      vista.multiplyMatrices(camara.projectionMatrix, camara.matrixWorldInverse);
      frustum.setFromProjectionMatrix(vista);
      animados = 0;
      for (const p of instancias.values()) {
        const puesto = p.puestoEn === cuadro;
        esfera.center.set(p.raiz.position.x, p.raiz.position.y + ALTO_CENTRO, p.raiz.position.z);
        p.enVista = puesto && frustum.intersectsSphere(esfera);
        p.raiz.visible = p.enVista;
        if (!puesto) p.andar.reiniciar();
        if (!p.enVista) {
          p.animadoEn = NaN;
          continue;
        }
        const dt = Number.isNaN(p.animadoEn)
          ? 0
          : Math.min(MAX_DT_S, Math.max(0, (ahoraMs - p.animadoEn) / 1000));
        p.animadoEn = ahoraMs;
        // Quieto ↔ caminar con un cruce corto; el clip de caminar a la rapidez del paso.
        const objetivo = p.andar.paso === 'caminar' ? 1 : 0;
        const k = dt > 0 ? Math.min(1, dt / MEZCLA_PASO_S) : 1;
        p.pesoCaminar += (objetivo - p.pesoCaminar) * k;
        p.caminar.setEffectiveWeight(p.pesoCaminar);
        p.quieto.setEffectiveWeight(1 - p.pesoCaminar);
        p.caminar.setEffectiveTimeScale(p.andar.escala);
        p.mezclador.update(dt);
        animados++;
      }
      // Jugadores que se fueron: no se guardan para siempre.
      if (instancias.size > MAX_GUARDADOS) {
        for (const p of [...instancias.values()]) if (p.puestoEn !== cuadro) quitar(p);
      }
      cuadro++;
    },
    saludar(jugador) {
      const p = instancias.get(jugador);
      if (!p?.enVista || prefiereQuieto()) return false;
      p.saludo.reset().play();
      return true;
    },
    estado(jugador) {
      const p = instancias.get(jugador);
      if (!p) return null;
      return { paso: p.andar.paso, saluda: p.saludo.isRunning(), enVista: p.enVista };
    },
    cambiarModelo(nuevo) {
      if (nuevo === modelo) return;
      for (const p of [...instancias.values()]) quitar(p);
      modelo.liberar();
      modelo = nuevo;
    },
    liberar() {
      for (const p of [...instancias.values()]) quitar(p);
      modelo.liberar();
      grupo.removeFromParent();
    },
  };
}
