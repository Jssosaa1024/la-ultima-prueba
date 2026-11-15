/**
 * Service worker propio (T94), sin librerías. Esta es la plantilla: al terminar `astro build`,
 * `scripts/pwa/integracion.ts` la copia a `dist/sw.js` con una primera línea que define
 * `self.__SW__ = { version, nucleo, salas }` para ese build.
 *
 * Qué hace:
 * - **Núcleo** (`nucleo-<version>`): al instalarse guarda las páginas `/` y `/jugar/`, el JS y
 *   el CSS de `/_astro/` (con el transcodificador Basis), el manifiesto y los iconos.
 * - **Páginas**: primero la red y, solo si no hay red, la copia guardada. Así una versión nueva
 *   del sitio se ve en cuanto hay conexión, nunca la tapa la caché vieja.
 * - **`/_astro/`**: llevan hash en el nombre, así que nunca cambian: primero la caché.
 * - **Salas** (`salas`): lo que se descarga de `/assets/` queda guardado al visitarlo. Los
 *   archivos con hash se sirven desde la caché; los demás (`manifest.json`, audio sin hash)
 *   van primero a la red.
 *
 * Actualizaciones: la versión nueva se instala en paralelo y espera a que se cierren las
 * pestañas abiertas (no usa `skipWaiting`). Una partida en curso sigue con los archivos de su
 * versión, que siguen en la caché aunque Cloudflare ya no los tenga. Al activarse borra los
 * núcleos viejos y, de `salas`, los archivos con hash que ya no existen en el build.
 *
 * Nunca toca `localStorage`: la partida guardada, los ajustes y el id del jugador sobreviven
 * a cualquier actualización.
 */

const DATOS = self.__SW__ ?? { version: 'dev', nucleo: [], salas: [] };

const PREFIJO_NUCLEO = 'nucleo-';
const NUCLEO = PREFIJO_NUCLEO + DATOS.version;
const SALAS = 'salas';

/** Nombre de archivo con hash: `escena.Ab12Cd34.glb`, `motor.B_DyNdXR.js`. */
const RE_HASH = /\.[A-Za-z0-9_-]{8,}\.[a-z0-9]{2,5}$/;

/**
 * Qué hacer con una petición GET del mismo sitio, según su ruta:
 * `pagina` (red y luego caché), `inmutable` (caché y luego red, en el núcleo),
 * `sala` (caché y luego red, en salas), `sala-red` (red y luego caché, en salas) o `pasar`.
 */
function estrategia(ruta, esNavegacion) {
  if (esNavegacion) return 'pagina';
  if (ruta.startsWith('/_astro/')) return 'inmutable';
  if (ruta.startsWith('/assets/')) return RE_HASH.test(ruta) ? 'sala' : 'sala-red';
  if (DATOS.nucleo.includes(ruta)) return 'inmutable-red';
  return 'pasar';
}

/** Cachés que sobran tras activar esta versión: los núcleos de otras versiones. */
function cachesViejas(nombres) {
  return nombres.filter((n) => n.startsWith(PREFIJO_NUCLEO) && n !== NUCLEO);
}

/** Archivos de `salas` que ya no existen en este build (solo los que llevan hash). */
function salasViejas(rutas) {
  return rutas.filter((r) => RE_HASH.test(r) && !DATOS.salas.includes(r));
}

/** Ruta con la que se guarda una página: `/jugar` y `/jugar/?debug=1` son `/jugar/`. */
function rutaDePagina(ruta) {
  if (ruta.endsWith('/')) return ruta;
  return /\.[a-z0-9]+$/i.test(ruta) ? ruta : ruta + '/';
}

/**
 * Lo guardado se busca sin mirar `Vary`: un módulo JS se pide con la cabecera `Origin` y la
 * copia guardada al instalar no la tiene. El contenido es el mismo.
 */
const BUSQUEDA = { ignoreVary: true };

/** Solo se guarda una respuesta completa y del propio sitio. */
function guardable(respuesta) {
  return respuesta.ok && respuesta.status === 200 && respuesta.type === 'basic';
}

async function guardar(nombreCache, clave, respuesta) {
  if (!guardable(respuesta)) return;
  try {
    const cache = await caches.open(nombreCache);
    await cache.put(clave, respuesta);
  } catch {
    // Sin espacio o en una ventana privada: se sigue sin guardar.
  }
}

async function redPrimero(peticion, nombreCache, clave) {
  try {
    const respuesta = await fetch(peticion);
    if (guardable(respuesta)) await guardar(nombreCache, clave, respuesta.clone());
    return respuesta;
  } catch (error) {
    const guardada = await caches.match(clave, BUSQUEDA);
    if (guardada) return guardada;
    throw error;
  }
}

async function cachePrimero(peticion, nombreCache) {
  const guardada = await caches.match(peticion, BUSQUEDA);
  if (guardada) return guardada;
  const respuesta = await fetch(peticion);
  if (guardable(respuesta)) await guardar(nombreCache, peticion, respuesta.clone());
  return respuesta;
}

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(NUCLEO);
      // `reload`: que el navegador no devuelva una copia vieja de su propia caché HTTP.
      await cache.addAll(DATOS.nucleo.map((ruta) => new Request(ruta, { cache: 'reload' })));
    })(),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      for (const nombre of cachesViejas(await caches.keys())) await caches.delete(nombre);
      const salas = await caches.open(SALAS);
      for (const peticion of await salas.keys()) {
        const ruta = new URL(peticion.url).pathname;
        if (salasViejas([ruta]).length > 0) await salas.delete(peticion);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  if (peticion.method !== 'GET' || peticion.headers.has('range')) return;
  const url = new URL(peticion.url);
  if (url.origin !== self.location.origin) return;
  const que = estrategia(url.pathname, peticion.mode === 'navigate');
  switch (que) {
    case 'pagina':
      evento.respondWith(redPrimero(peticion, NUCLEO, rutaDePagina(url.pathname)));
      break;
    case 'inmutable':
      evento.respondWith(cachePrimero(peticion, NUCLEO));
      break;
    case 'inmutable-red':
      evento.respondWith(redPrimero(peticion, NUCLEO, url.pathname));
      break;
    case 'sala':
      evento.respondWith(cachePrimero(peticion, SALAS));
      break;
    case 'sala-red':
      evento.respondWith(redPrimero(peticion, SALAS, url.pathname));
      break;
    default:
      break;
  }
});
