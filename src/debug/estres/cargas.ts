/**
 * La carga de cada eje de la prueba de estrés (T11p y T11q), en Three.js. Todo lo que se
 * agrega cuelga de un grupo puesto donde mira la cámara al empezar, y `liberar()` lo saca de
 * la escena y lo libera con `dispose()` (T11r). Nada de la sala se toca ni se libera: el eje
 * de triángulos usa la geometría más pesada de la sala, pero solo la comparte.
 */
import {
  BoxGeometry,
  Color,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three';
import type { BufferGeometry, Camera, Object3D, Texture, WebGLRenderer } from 'three';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { gestorSinEval } from '../../engine/carga/cargador';
import {
  MALLAS_POR_ESCALON,
  MAX_ESCALONES,
  TEXTURAS_POR_ESCALON,
  TRIANGULOS_POR_ESCALON,
  nivelPixeles,
} from './ejes';
import type { Eje } from './marca';

/** Textura propia de 1024 px en KTX2 ETC1S (`npm run textura-estres`). */
export const URL_TEXTURA_ESTRES = '/assets/pruebas/estres-1024.ktx2';

export interface ContextoCarga {
  renderer: WebGLRenderer;
  escena: Object3D;
  camara: Camera;
  /** Raíz de la sala actual, para buscar su malla más pesada. */
  raizSala: Object3D | null;
  dprEquipo: number;
  /** Pixel ratio con el que se dibuja durante la prueba. */
  fijarPixelRatio(ratio: number): void;
}

export interface CargaEstres {
  /** Deja la carga del nivel `escalon`. */
  aplicar(escalon: number): Promise<void> | void;
  /** Saca todo de la escena y lo libera de la GPU. */
  liberar(): void;
}

/** Semilla fija: las posiciones son las mismas en cada corrida y en cada equipo. */
function aleatorio(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Un punto delante de la cámara, dentro de lo que se ve (coordenadas del grupo). */
function puntoDelante(azar: () => number, destino: Vector3): Vector3 {
  const z = -1.6 - azar() * 2.4;
  const ancho = -z * 0.9;
  const alto = -z * 0.45;
  return destino.set((azar() * 2 - 1) * ancho, (azar() * 2 - 1) * alto, z);
}

function trianglosDe(g: BufferGeometry): number {
  const n = g.index ? g.index.count : (g.getAttribute('position')?.count ?? 0);
  return Math.floor(n / 3);
}

/** La geometría con más triángulos de la sala (sin contar mallas instanciadas). */
export function geometriaMasPesada(raiz: Object3D | null): BufferGeometry | null {
  let mejor: BufferGeometry | null = null;
  let max = 0;
  raiz?.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh || (o as InstancedMesh).isInstancedMesh) return;
    const t = trianglosDe(m.geometry);
    if (t > max) {
      max = t;
      mejor = m.geometry;
    }
  });
  return mejor;
}

export function crearCarga(eje: Eje, ctx: ContextoCarga): CargaEstres {
  const grupo = new Group();
  grupo.name = 'estres';
  ctx.camara.getWorldPosition(grupo.position);
  ctx.camara.getWorldQuaternion(grupo.quaternion);
  grupo.updateMatrixWorld(true);
  ctx.escena.add(grupo);

  // Todo lo creado aquí, para liberarlo al final (T11r).
  const geometrias = new Set<BufferGeometry>();
  const materiales = new Set<{ dispose(): void }>();
  const texturas = new Set<Texture>();
  const instancias: InstancedMesh[] = [];
  let ktx2: KTX2Loader | null = null;
  let liberada = false;

  const azar = aleatorio(20261115);
  const punto = new Vector3();
  const dprJuego = Math.min(ctx.dprEquipo, 1.25);

  let aplicar: (escalon: number) => Promise<void> | void;

  switch (eje) {
    case 'triangulos': {
      ctx.fijarPixelRatio(dprJuego);
      let base = geometriaMasPesada(ctx.raizSala);
      if (!base || trianglosDe(base) < 1) {
        base = new IcosahedronGeometry(0.1, 4);
        geometrias.add(base);
      }
      const porInstancia = trianglosDe(base);
      const capacidad = Math.ceil(
        (MAX_ESCALONES.triangulos * TRIANGULOS_POR_ESCALON) / porInstancia,
      );
      base.computeBoundingSphere();
      const radio = Math.max(1e-3, base.boundingSphere?.radius ?? 1);
      const material = new MeshLambertMaterial({ color: 0x9aa7b4 });
      materiales.add(material);
      const malla = new InstancedMesh(base, material, capacidad);
      malla.frustumCulled = false;
      const m = new Matrix4();
      const q = new Quaternion();
      const escala = new Vector3().setScalar(0.12 / radio);
      for (let i = 0; i < capacidad; i++) {
        m.compose(puntoDelante(azar, punto), q, escala);
        malla.setMatrixAt(i, m);
      }
      malla.count = 0;
      instancias.push(malla);
      grupo.add(malla);
      aplicar = (escalon) => {
        malla.count = Math.min(
          capacidad,
          Math.ceil((escalon * TRIANGULOS_POR_ESCALON) / porInstancia),
        );
      };
      break;
    }
    case 'draw-calls': {
      ctx.fijarPixelRatio(dprJuego);
      const caja = new BoxGeometry(0.1, 0.1, 0.1);
      geometrias.add(caja);
      const color = new Color();
      aplicar = (escalon) => {
        const meta = escalon * MALLAS_POR_ESCALON;
        while (grupo.children.length < meta) {
          // Un material propio por malla: cada una es una draw call aparte.
          const material = new MeshLambertMaterial({
            color: color.setHSL(azar(), 0.6, 0.55).getHex(),
          });
          materiales.add(material);
          const malla = new Mesh(caja, material);
          malla.position.copy(puntoDelante(azar, punto));
          grupo.add(malla);
        }
      };
      break;
    }
    case 'texturas': {
      ctx.fijarPixelRatio(dprJuego);
      const plano = new PlaneGeometry(0.35, 0.35);
      geometrias.add(plano);
      // Con la copia del transcodificador sin eval (T02b): la CSP no permite 'unsafe-eval'.
      const cargador = new KTX2Loader(gestorSinEval())
        .setWorkerLimit(1)
        .detectSupport(ctx.renderer);
      ktx2 = cargador;
      aplicar = async (escalon) => {
        const meta = escalon * TEXTURAS_POR_ESCALON;
        while (texturas.size < meta) {
          // Cada carga transcodifica de nuevo: es una textura distinta en la GPU.
          const textura = await cargador.loadAsync(URL_TEXTURA_ESTRES);
          if (liberada) {
            textura.dispose();
            return;
          }
          texturas.add(textura);
          const material = new MeshBasicMaterial({ map: textura });
          materiales.add(material);
          const malla = new Mesh(plano, material);
          malla.position.copy(puntoDelante(azar, punto));
          grupo.add(malla);
        }
      };
      break;
    }
    case 'pixeles': {
      // Plano que cubre la pantalla sin importar la cámara: se dibuja en coordenadas de recorte.
      const plano = new PlaneGeometry(2, 2);
      geometrias.add(plano);
      const material = new ShaderMaterial({
        vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: 'void main() { gl_FragColor = vec4(1.0, 1.0, 1.0, 0.03); }',
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      materiales.add(material);
      aplicar = (escalon) => {
        const nivel = nivelPixeles(escalon, ctx.dprEquipo);
        ctx.fijarPixelRatio(nivel.pixelRatio);
        while (grupo.children.length < nivel.planos) {
          const malla = new Mesh(plano, material);
          malla.frustumCulled = false;
          malla.renderOrder = 1000;
          grupo.add(malla);
        }
      };
      break;
    }
  }

  return {
    aplicar: (escalon) => aplicar(escalon),
    liberar() {
      if (liberada) return;
      liberada = true;
      grupo.removeFromParent();
      grupo.clear();
      for (const i of instancias) i.dispose();
      for (const t of texturas) t.dispose();
      for (const m of materiales) m.dispose();
      for (const g of geometrias) g.dispose();
      texturas.clear();
      ktx2?.dispose();
    },
  };
}
