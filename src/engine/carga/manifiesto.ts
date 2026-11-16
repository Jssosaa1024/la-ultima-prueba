/**
 * Índice de assets (T19g): de un id del contenido a la URL con hash del manifiesto.
 *
 * `public/assets/manifest.json` lo escribe `npm run build-manifest` (T08) y lista cada archivo
 * como `salas/<carpeta>/<nombre>.<hash>.<ext>`. El juego lo pide una sola vez, y solo si la
 * sala usa un modelo o una textura. Aunque viene del propio sitio, se valida cada ruta con una
 * expresión estricta antes de usarla en una URL.
 */

/** `salas/<carpeta>/<nombre>.<hash de 8>.<glb|ktx2>`, todo en minúsculas. */
const RUTA =
  /^salas\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([a-z0-9]+(?:-[a-z0-9]+)*)\.[0-9a-f]{8}\.(glb|ktx2)$/;

export const URL_MANIFIESTO = '/assets/manifest.json';

export type Extension = 'glb' | 'ktx2';

/** De `<carpeta>/<nombre>.<ext>` a la URL publicada (`/assets/salas/…<hash>.<ext>`). */
export type IndiceAssets = ReadonlyMap<string, string>;

/** Arma el índice con lo que pase la validación; lo demás se ignora. */
export function indiceDeManifiesto(json: unknown): IndiceAssets {
  const indice = new Map<string, string>();
  const salas = (json as { salas?: unknown } | null)?.salas;
  if (typeof salas !== 'object' || salas === null) return indice;
  for (const sala of Object.values(salas as Record<string, unknown>)) {
    const archivos = (sala as { archivos?: unknown } | null)?.archivos;
    if (!Array.isArray(archivos)) continue;
    for (const a of archivos) {
      const archivo = (a as { archivo?: unknown } | null)?.archivo;
      if (typeof archivo !== 'string') continue;
      const m = RUTA.exec(archivo);
      if (m) indice.set(`${m[1]}/${m[2]}.${m[3]}`, `/assets/${archivo}`);
    }
  }
  return indice;
}

/** La URL de `<carpeta>/<nombre>` con esa extensión, o `null` si no está publicado. */
export function urlDeAsset(indice: IndiceAssets, id: string, ext: Extension): string | null {
  return indice.get(`${id}.${ext}`) ?? null;
}

/** Pide el manifiesto. Si falla, el índice queda vacío: las salas se ven con sus primitivas. */
export async function pedirIndice(
  pedir: (url: string) => Promise<Response> = (url) => fetch(url),
): Promise<IndiceAssets> {
  try {
    const respuesta = await pedir(URL_MANIFIESTO);
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    return indiceDeManifiesto(await respuesta.json());
  } catch (error) {
    console.warn('No se pudo leer el manifiesto de assets', error);
    return new Map();
  }
}
