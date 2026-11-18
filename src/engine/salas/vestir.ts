/**
 * Vestir una sala (T19g): ponerle a la sala ya armada por código lo que se descarga.
 *
 * - Los modelos de los objetos (T19e, GLB con meshopt y KTX2): ver `modelos.ts`.
 * - Las texturas de color de piso, paredes y techo (T19g, KTX2 de 1024, repetidas).
 *
 * La sala ya se ve completa con sus primitivas y colores antes de vestirla: si un archivo no
 * está en el manifiesto o no se puede cargar, ese objeto o esa superficie se queda como estaba
 * y la partida sigue.
 *
 * Cada sala carga sus propias copias (de la caché HTTP, sin volver a descargar): así, al
 * liberar una sala con `dispose()`, la portería no pierde las suyas.
 */
import { RepeatWrapping, SRGBColorSpace } from 'three';
import type { Mesh, MeshLambertMaterial, Object3D, Texture } from 'three';
import type { Sala } from '../../content/esquema-salas';
import { urlDeAsset } from '../carga/manifiesto';
import type { IndiceAssets } from '../carga/manifiesto';
import { SUPERFICIES, TEXTURA } from './construir';
import type { Superficie } from './construir';
import { aLambert, ponerModelos } from './modelos';

/** De dónde salen los archivos. En el juego, el manifiesto y el cargador KTX2 (T10). */
export interface FuentesAssets {
  indice(): Promise<IndiceAssets>;
  textura(url: string): Promise<Texture>;
  /** La escena del GLB. */
  modelo(url: string): Promise<Object3D>;
}

/** Los modelos distintos que usa la sala (nombres en su carpeta del manifiesto). */
const modelosDe = (sala: Sala): string[] => [
  ...new Set(sala.objetos.flatMap((o) => (o.modelo ? [o.modelo] : []))),
];

/** `true` si la sala tiene algo que descargar. */
export function necesitaVestir(sala: Sala): boolean {
  return SUPERFICIES.some((s) => sala.texturas?.[s]) || modelosDe(sala).length > 0;
}

/** Las URL de lo que usa la sala, para dejarlas en la caché antes de entrar. */
export function urlsDeSala(sala: Sala, indice: IndiceAssets): string[] {
  const urls = new Set<string>();
  for (const s of SUPERFICIES) {
    const id = sala.texturas?.[s];
    const url = id ? urlDeAsset(indice, id, 'ktx2') : null;
    if (url) urls.add(url);
  }
  for (const nombre of modelosDe(sala)) {
    const url = urlDeAsset(indice, `${sala.id}/${nombre}`, 'glb');
    if (url) urls.add(url);
  }
  return [...urls];
}

/**
 * Pone el mapa de color en el material de la superficie, repetido y en sRGB, con el tinte de
 * la sala si lo tiene (T19k).
 */
function aplicarTextura(malla: Mesh, textura: Texture, tinte: string | undefined): void {
  const material = malla.material as MeshLambertMaterial;
  textura.wrapS = RepeatWrapping;
  textura.wrapT = RepeatWrapping;
  textura.colorSpace = SRGBColorSpace;
  // T19k: las UV van en metros iguales a lo ancho y a lo alto; una imagen que no es cuadrada
  // (la de las paredes mide 1024 × 512) se repite más a lo alto para que no se vea estirada.
  const { width, height } = (textura.image ?? {}) as { width?: number; height?: number };
  if (width && height) textura.repeat.set(1, width / height);
  textura.needsUpdate = true;
  material.map = textura;
  // El color de respaldo ya no tiñe la textura: solo el tinte de la sala, si lo pide.
  material.color.set(tinte ?? 0xffffff);
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

  const cargados = new Map<string, Object3D>();
  const modelos = modelosDe(sala).map(async (nombre) => {
    const id = `${sala.id}/${nombre}`;
    const url = urlDeAsset(indice, id, 'glb');
    if (!url) {
      console.warn(`El modelo ${id} no está en el manifiesto; queda la primitiva`);
      return;
    }
    try {
      const modelo = await fuentes.modelo(url);
      aLambert(modelo);
      cargados.set(nombre, modelo);
    } catch (error) {
      console.warn(`No se pudo cargar el modelo ${id}; queda la primitiva`, error);
    }
  });

  const texturas = [...porTextura].map(async ([id, mallas]) => {
    const url = urlDeAsset(indice, id, 'ktx2');
    if (!url) {
      console.warn(`La textura ${id} no está en el manifiesto; queda el color de la sala`);
      return;
    }
    try {
      const textura = await fuentes.textura(url);
      const tintes = sala.texturas?.tinte;
      for (const m of mallas) aplicarTextura(m, textura, tintes?.[m.name as Superficie]);
    } catch (error) {
      console.warn(`No se pudo cargar la textura ${id}; queda el color de la sala`, error);
    }
  });

  await Promise.all([...modelos, ...texturas]);
  if (cargados.size > 0) ponerModelos(raiz, sala, cargados);
}
