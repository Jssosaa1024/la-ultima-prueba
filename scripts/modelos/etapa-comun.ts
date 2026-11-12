/**
 * Etapa común del pipeline de modelos (T06).
 *
 * Orden de la especificación: dedup → prune → weld → instance → quantize → meshopt.
 * KTX2 (T07) y asset.copyright (T11a) se agregan después, en este mismo orden.
 * Nunca se usa `simplify` aquí: simplificar va solo en la etapa de limpieza, antes de hornear.
 */
import { NodeIO, Primitive } from '@gltf-transform/core';
import type { Document, Node } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import type { InstancedMesh } from '@gltf-transform/extensions';
import { dedup, instance, prune, quantize, reorder, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

export interface OpcionesEtapaComun {
  /**
   * Crea instancias GPU (EXT_mesh_gpu_instancing) de mallas repetidas.
   * Desactívalo en escenas con lightmap: los props instanciados no van horneados.
   */
  instanciar?: boolean;
  /** Mínimo de copias de una malla para instanciarla. Por defecto, 5. */
  minimoInstancias?: number;
}

export interface Medidas {
  /** Triángulos que se dibujan, contando cada instancia. */
  triangulos: number;
  /** Estimación de draw calls: una por primitiva por nodo; una malla instanciada cuenta una vez. */
  drawCalls: number;
  /** Mallas distintas en el archivo. */
  mallas: number;
  /** Materiales distintos en el archivo. */
  materiales: number;
}

/** Lector/escritor con todas las extensiones y los codificadores de meshopt listos. */
export async function crearIO(): Promise<NodeIO> {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': MeshoptDecoder,
  });
}

/** Aplica la etapa común al documento, en el sitio. */
export async function aplicarEtapaComun(
  documento: Document,
  opciones: OpcionesEtapaComun = {},
): Promise<void> {
  const { instanciar = true, minimoInstancias = 5 } = opciones;
  await MeshoptEncoder.ready;

  await documento.transform(
    // Une accesores, mallas, materiales y texturas idénticos.
    dedup(),
    // Quita nodos vacíos, cámaras, materiales y texturas que nadie usa.
    prune(),
    // Une vértices repetidos para que el índice los reutilice.
    weld(),
    // Copias de la misma malla → una sola draw call con EXT_mesh_gpu_instancing.
    ...(instanciar ? [instance({ min: minimoInstancias })] : []),
    // Reordena vértices e índices para que meshopt comprima mejor.
    reorder({ encoder: MeshoptEncoder, target: 'size' }),
    // Guarda posiciones, normales y UV en enteros pequeños (KHR_mesh_quantization).
    quantize(),
  );

  // meshopt: los búferes se comprimen al escribir el archivo.
  documento
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
}

/** Cuenta triángulos y draw calls de la escena principal. */
export function medir(documento: Document): Medidas {
  const raiz = documento.getRoot();
  const escena = raiz.getDefaultScene() ?? raiz.listScenes()[0];
  let triangulos = 0;
  let drawCalls = 0;

  const visitar = (nodo: Node): void => {
    const malla = nodo.getMesh();
    if (malla) {
      const instancias = nodo.getExtension<InstancedMesh>('EXT_mesh_gpu_instancing');
      const copias = instancias?.listAttributes()[0]?.getCount() ?? 1;
      for (const primitiva of malla.listPrimitives()) {
        triangulos += trianglesDe(primitiva) * copias;
        drawCalls += 1;
      }
    }
    nodo.listChildren().forEach(visitar);
  };
  escena?.listChildren().forEach(visitar);

  return {
    triangulos,
    drawCalls,
    mallas: raiz.listMeshes().length,
    materiales: raiz.listMaterials().length,
  };
}

function trianglesDe(primitiva: Primitive): number {
  const vertices =
    primitiva.getIndices()?.getCount() ?? primitiva.getAttribute('POSITION')?.getCount() ?? 0;
  switch (primitiva.getMode()) {
    case Primitive.Mode.TRIANGLES:
      return Math.floor(vertices / 3);
    case Primitive.Mode.TRIANGLE_STRIP:
    case Primitive.Mode.TRIANGLE_FAN:
      return Math.max(vertices - 2, 0);
    default:
      return 0;
  }
}
