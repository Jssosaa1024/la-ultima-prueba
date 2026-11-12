import type { BufferGeometry, Material, Object3D, Texture } from 'three';

export interface Liberado {
  geometrias: number;
  materiales: number;
  texturas: number;
}

const esTextura = (valor: unknown): valor is Texture =>
  typeof valor === 'object' && valor !== null && (valor as Texture).isTexture === true;

/**
 * Libera de la GPU todo lo que cuelga de `raiz`: geometrías, materiales y sus texturas,
 * y lo saca de la escena. Safari recarga la pestaña si se queda sin memoria, así que
 * esto se llama siempre al cambiar de sala o al cerrar el juego.
 */
export function liberarObjeto(raiz: Object3D): Liberado {
  const geometrias = new Set<BufferGeometry>();
  const materiales = new Set<Material>();
  const texturas = new Set<Texture>();

  raiz.traverse((objeto) => {
    const { geometry, material } = objeto as Object3D & {
      geometry?: BufferGeometry;
      material?: Material | Material[];
    };
    if (geometry) geometrias.add(geometry);
    for (const m of Array.isArray(material) ? material : material ? [material] : []) {
      materiales.add(m);
      for (const valor of Object.values(m)) if (esTextura(valor)) texturas.add(valor);
    }
  });

  geometrias.forEach((g) => g.dispose());
  texturas.forEach((t) => t.dispose());
  materiales.forEach((m) => m.dispose());
  raiz.removeFromParent();
  return { geometrias: geometrias.size, materiales: materiales.size, texturas: texturas.size };
}
