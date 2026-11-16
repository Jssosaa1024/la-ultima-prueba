/**
 * Leer originales desde los zips de `art/` (T11a) sin descomprimirlos en el repositorio.
 *
 * Un GLB de Kenney (Mini Shop, Factory Kit) apunta a su textura con una ruta relativa
 * (`Textures/colormap.png`), así que se saca a una carpeta temporal toda la carpeta del
 * modelo, con sus subcarpetas, y se lee desde ahí. Usa el fflate que ya trae three.js.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { unzipSync } from 'three/examples/jsm/libs/fflate.module.js';
import { partirOriginal } from './lista.ts';

/** Entradas de un zip cuya ruta empieza por `prefijo` (sin carpetas vacías). */
export function entradasBajo(zip: Uint8Array, prefijo: string): Record<string, Uint8Array> {
  return unzipSync(zip, { filter: (f) => f.name.startsWith(prefijo) && !f.name.endsWith('/') });
}

/** Una ruta interna segura: relativa, sin `..` ni letras de unidad. */
function rutaSegura(nombre: string): boolean {
  return (
    !nombre.startsWith('/') && !/^[a-z]:/i.test(nombre) && !nombre.split(/[/\\]/).includes('..')
  );
}

/**
 * Saca de los zips lo que piden los originales y devuelve la ruta en disco de cada uno.
 * Llama a `limpiar()` al terminar para borrar la carpeta temporal.
 */
export class ExtractorOriginales {
  private carpeta: string | null = null;
  private readonly hechos = new Map<string, string>();
  private readonly zips = new Map<string, Uint8Array>();
  private readonly raiz: string;

  constructor(raiz: string) {
    this.raiz = raiz;
  }

  /** Ruta en disco del original (`art/...` o `art/...zip#ruta`). */
  async ruta(original: string): Promise<string> {
    const { archivo, interna } = partirOriginal(original);
    const enDisco = path.join(this.raiz, archivo);
    if (interna === null) return enDisco;

    this.carpeta ??= await mkdtemp(path.join(tmpdir(), 'lup-originales-'));
    const directorio = interna.includes('/') ? interna.slice(0, interna.lastIndexOf('/') + 1) : '';
    const clave = `${archivo}#${directorio}`;
    let base = this.hechos.get(clave);
    if (!base) {
      let zip = this.zips.get(archivo);
      if (!zip) {
        zip = new Uint8Array(await readFile(enDisco));
        if (zip[0] !== 0x50 || zip[1] !== 0x4b) {
          throw new Error(
            `${archivo} no es un zip. Si es un puntero de Git LFS, corre «git lfs pull».`,
          );
        }
        this.zips.set(archivo, zip);
      }
      base = path.join(this.carpeta, String(this.hechos.size));
      for (const [nombre, datos] of Object.entries(entradasBajo(zip, directorio))) {
        if (!rutaSegura(nombre)) throw new Error(`Ruta peligrosa en ${archivo}: ${nombre}`);
        const destino = path.join(base, nombre);
        await mkdir(path.dirname(destino), { recursive: true });
        await writeFile(destino, datos);
      }
      this.hechos.set(clave, base);
    }
    const destino = path.join(base, interna);
    await readFile(destino).catch(() => {
      throw new Error(`No encontré «${interna}» dentro de ${archivo}`);
    });
    return destino;
  }

  async limpiar(): Promise<void> {
    if (this.carpeta) await rm(this.carpeta, { recursive: true, force: true });
    this.carpeta = null;
    this.hechos.clear();
    this.zips.clear();
  }
}
