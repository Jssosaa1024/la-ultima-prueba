/**
 * Vestir una sala (T19g): ponerle a la sala ya armada por código lo que se descarga.
 *
 * Hoy son las texturas de color de piso, paredes y techo (KTX2 de 1024, repetidas). La sala
 * ya se ve completa con sus colores antes de vestirla: si un archivo no está en el manifiesto
 * o no se puede cargar, esa superficie se queda con su color y la partida sigue.
 *
 * Cada sala carga sus propias copias de las texturas (de la caché HTTP, sin volver a
 * descargar): así, al liberar una sala con `dispose()`, la portería no pierde las suyas.
 */
import { RepeatWrapping, SRGBColorSpace } from 'three';
import type { Mesh, MeshLambertMaterial, Object3D, Texture } from 'three';
import type { Sala } from '../../content/esquema-salas';
import { urlDeAsset } from '../carga/manifiesto';
import type { IndiceAssets } from '../carga/manifiesto';
import { SUPERFICIES, TEXTURA } from './construir';

/** De dónde salen los archivos. En el juego, el manifiesto y el cargador KTX2 (T10). */
export interface FuentesAssets {
  indice(): Promise<IndiceAssets>;
  textura(url: string): Promise<Texture>;
}

/** `true` si la sala tiene algo que descargar. */
export function necesitaVestir(sala: Sala): boolean {
  return SUPERFICIES.some((s) => sala.texturas?.[s]);
}

/** Las URL de lo que usa la sala, para dejarlas en la caché antes de entrar. */
export function urlsDeSala(sala: Sala, indice: IndiceAssets): string[] {
  const urls = new Set<string>();
  for (const s of SUPERFICIES) {
    const id = sala.texturas?.[s];
    const url = id ? urlDeAsset(indice, id, 'ktx2') : null;
    if (url) urls.add(url);
  }
  return [...urls];
}

/** Pone el mapa de color en el material de la superficie, repetido y en sRGB. */
function aplicarTextura(malla: Mesh, textura: Texture): void {
  const material = malla.material as MeshLambertMaterial;
  textura.wrapS = RepeatWrapping;
  textura.wrapT = RepeatWrapping;
  textura.colorSpace = SRGBColorSpace;
  textura.needsUpdate = true;
  material.map = textura;
  // El color de respaldo ya no tiñe la textura.
  material.color.set(0xffffff);
  material.needsUpdate = true;
}

/** Descarga y aplica lo que la sala pide. Nunca falla: lo que no carga se queda con su color. */
export async function vestirSala(
  raiz: Object3D,
  sala: Sala,
  fuentes: FuentesAssets,
): Promise<void> {
  if (!necesitaVestir(sala)) return;
  const indice = await fuentes.indice();

  const porTextura = new Map<string, Mesh[]>();
  raiz.traverse((o) => {
    const id = o.userData[TEXTURA] as string | undefined;
    if (!id || !(o as Mesh).isMesh) return;
    porTextura.set(id, [...(porTextura.get(id) ?? []), o as Mesh]);
  });

  await Promise.all(
    [...porTextura].map(async ([id, mallas]) => {
      const url = urlDeAsset(indice, id, 'ktx2');
      if (!url) {
        console.warn(`La textura ${id} no está en el manifiesto; queda el color de la sala`);
        return;
      }
      try {
        const textura = await fuentes.textura(url);
        for (const m of mallas) aplicarTextura(m, textura);
      } catch (error) {
        console.warn(`No se pudo cargar la textura ${id}; queda el color de la sala`, error);
      }
    }),
  );
}
