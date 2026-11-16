/**
 * Medidor del motor para el panel `?debug=1` (T11m). El motor lo crea con `import()` solo al
 * abrir el panel y lo libera al cerrarlo: con el panel cerrado no existe y no cuesta nada.
 *
 * En cada cuadro (`cuadro()`) solo guarda el tiempo en un búfer fijo. Cada 500 ms lee
 * `renderer.info`, estima la memoria de texturas recorriendo la escena, suma lo descargado y
 * escribe el signal `metricas`.
 */
import {
  RGBA_ASTC_4x4_Format,
  RGBA_BPTC_Format,
  RGBA_ETC2_EAC_Format,
  RGBA_S3TC_DXT3_Format,
  RGBA_S3TC_DXT5_Format,
  RGB_ETC1_Format,
  RGB_ETC2_Format,
  RGB_PVRTC_4BPPV1_Format,
  RGBA_PVRTC_4BPPV1_Format,
  RGB_S3TC_DXT1_Format,
  RGBA_S3TC_DXT1_Format,
} from 'three';
import type { Material, Object3D, Texture, WebGLRenderer } from 'three';
import {
  HUECO_MAX_MS,
  MS_ENTRE_PUBLICACIONES,
  aMb,
  bytesTextura,
  crearVentanaCuadros,
  metricas,
  sumarDescargas,
  ultimaCargaDeSala,
} from './metricas';
import type { ClaseTextura, Recurso } from './metricas';

const FORMATOS_4_BITS = new Set<number>([
  RGB_ETC1_Format,
  RGB_ETC2_Format,
  RGB_S3TC_DXT1_Format,
  RGBA_S3TC_DXT1_Format,
  RGB_PVRTC_4BPPV1_Format,
  RGBA_PVRTC_4BPPV1_Format,
]);
const FORMATOS_8_BITS = new Set<number>([
  RGBA_ASTC_4x4_Format,
  RGBA_ETC2_EAC_Format,
  RGBA_S3TC_DXT3_Format,
  RGBA_S3TC_DXT5_Format,
  RGBA_BPTC_Format,
]);

export function claseDeTextura(t: Texture): ClaseTextura {
  if (FORMATOS_4_BITS.has(t.format)) return 'bpp4';
  if (FORMATOS_8_BITS.has(t.format)) return 'bpp8';
  return 'sin-comprimir';
}

const esTextura = (valor: unknown): valor is Texture =>
  typeof valor === 'object' && valor !== null && (valor as Texture).isTexture === true;

/** Estimación de la memoria de texturas de lo que cuelga de `raiz`, en bytes. */
export function bytesTexturasDe(raiz: Object3D): number {
  const vistas = new Set<Texture>();
  raiz.traverse((o) => {
    const material = (o as Object3D & { material?: Material | Material[] }).material;
    for (const m of Array.isArray(material) ? material : material ? [material] : []) {
      for (const valor of Object.values(m)) if (esTextura(valor)) vistas.add(valor);
    }
  });
  let total = 0;
  for (const t of vistas) {
    const imagen = t.image as { width?: number; height?: number } | null | undefined;
    const ancho = imagen?.width ?? 0;
    const alto = imagen?.height ?? 0;
    const conMipmaps = t.mipmaps.length > 1 || t.generateMipmaps;
    total += bytesTextura(ancho, alto, claseDeTextura(t), conMipmaps);
  }
  return total;
}

export interface OpcionesMedidor {
  renderer: WebGLRenderer;
  escena: Object3D;
  sala: () => string | null;
  /** `devicePixelRatio` del equipo y pixel ratio con el que se dibuja de verdad. */
  pixeles: () => { equipo: number; usado: number };
}

export interface MedidorMotor {
  /** Después de dibujar un cuadro. No asigna memoria salvo cada 500 ms. */
  cuadro(ahoraMs: number): void;
  /** Olvida el cuadro anterior: tras una pausa o un panel del juego, el hueco no cuenta. */
  reiniciar(): void;
  liberar(): void;
}

export function crearMedidor({ renderer, escena, sala, pixeles }: OpcionesMedidor): MedidorMotor {
  const ventana = crearVentanaCuadros();
  let anterior: number | null = null;
  let ultimaPublicacion = 0;

  // Lo descargado desde que abrió la página (`buffered`) y lo que llegue después.
  const recursos: Recurso[] = [];
  const guardar = (lista: PerformanceEntryList): void => {
    for (const e of lista) {
      const r = e as PerformanceResourceTiming;
      if (r.name.includes('/assets/salas/')) {
        recursos.push({
          name: r.name,
          transferSize: r.transferSize,
          decodedBodySize: r.decodedBodySize,
        });
      }
    }
  };
  let observador: PerformanceObserver | null = null;
  try {
    observador = new PerformanceObserver((lista) => guardar(lista.getEntries()));
    observador.observe({ type: 'resource', buffered: true });
  } catch {
    observador = null;
  }

  const publicar = (ahoraMs: number): void => {
    const actual = sala();
    const descargas = actual ? sumarDescargas(recursos, actual) : null;
    const carga = ultimaCargaDeSala();
    const px = pixeles();
    metricas.value = {
      lista: true,
      sala: actual,
      cuadro: ventana.estadisticas(ahoraMs),
      triangulos: renderer.info.render.triangles,
      drawCalls: renderer.info.render.calls,
      mbTexturas: aMb(bytesTexturasDe(escena)),
      geometrias: renderer.info.memory.geometries,
      texturas: renderer.info.memory.textures,
      mbDescargados: descargas ? aMb(descargas.bytesRed) : 0,
      archivosDeCache: descargas?.desdeCache ?? 0,
      cargaMs: carga && carga.sala === actual ? carga.ms : null,
      devicePixelRatio: px.equipo,
      pixelRatioUsado: Math.round(px.usado * 100) / 100,
      perfil: null,
    };
  };

  return {
    cuadro(ahoraMs) {
      if (anterior !== null) {
        const ms = ahoraMs - anterior;
        if (ms > 0 && ms < HUECO_MAX_MS) ventana.registrar(ms, ahoraMs);
      } else if (ultimaPublicacion === 0) {
        // Primer cuadro: se mide medio segundo antes de publicar. Si no, el panel quedaba
        // «listo» con 0 cuadros y un JSON exportado enseguida decía p95 = 0 (ola 6).
        ultimaPublicacion = ahoraMs;
      }
      anterior = ahoraMs;
      if (ahoraMs - ultimaPublicacion >= MS_ENTRE_PUBLICACIONES) {
        ultimaPublicacion = ahoraMs;
        publicar(ahoraMs);
      }
    },
    reiniciar() {
      anterior = null;
    },
    liberar() {
      observador?.disconnect();
      recursos.length = 0;
      ventana.vaciar();
    },
  };
}
