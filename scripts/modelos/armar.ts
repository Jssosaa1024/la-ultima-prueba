/**
 * `optimize-models --lista` (T11a): arma lo que dice `art/modelos.json` con el perfil de su
 * fuente (`art/credits.json`) y la etapa común, y lo escribe en `public/assets/salas/`.
 * Después, `npm run build-manifest` le pone el hash al nombre.
 */
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { Document, getBounds, Logger } from '@gltf-transform/core';
import type { Node, NodeIO } from '@gltf-transform/core';
import { mergeDocuments, unpartition } from '@gltf-transform/functions';
import type { Credito } from '../creditos/esquema.ts';
import { creditoDe, textoCopyright } from '../creditos/reglas.ts';
import { aplicarPerfilKenney, escalaDe, texturaMaximaDe } from '../perfiles/kenney.ts';
import type { PiezaColocada } from '../perfiles/kenney.ts';
import { texturaAmbientcg } from '../perfiles/ambientcg.ts';
import { perfilDe, PRODUCE } from '../perfiles/index.ts';
import type { Perfil } from '../perfiles/index.ts';
import { aplicarEtapaComun, medir } from './etapa-comun.ts';
import type { Medidas } from './etapa-comun.ts';
import { carpetaDe, esModelo } from './lista.ts';
import type { EntradaLista, EntradaModelo, EntradaTextura } from './lista.ts';
import type { ExtractorOriginales } from './zip.ts';

export interface Plan {
  entrada: EntradaLista;
  perfil: Perfil;
  credito: Credito;
}

/**
 * Revisa la lista contra los créditos antes de escribir nada: cada archivo con su entrada,
 * una fuente con perfil y el perfil adecuado (modelo o textura). Devuelve el plan o los
 * problemas.
 */
export function planear(
  lista: EntradaLista[],
  creditos: Credito[],
  carpeta?: string,
): { planes: Plan[]; problemas: string[] } {
  const planes: Plan[] = [];
  const problemas: string[] = [];
  for (const entrada of lista) {
    if (carpeta && carpetaDe(entrada.archivo) !== carpeta) continue;
    const credito = creditoDe(creditos, entrada.archivo);
    if (!credito) {
      problemas.push(`${entrada.archivo}: no tiene entrada en art/credits.json; anótala primero`);
      continue;
    }
    const perfil = perfilDe(credito.fuente);
    if (!perfil) {
      problemas.push(
        `${entrada.archivo}: la fuente «${credito.fuente}» no tiene perfil de limpieza`,
      );
      continue;
    }
    const tipo = esModelo(entrada) ? 'modelo' : 'textura';
    if (PRODUCE[perfil] !== tipo) {
      problemas.push(`${entrada.archivo}: el perfil ${perfil} no produce un ${tipo}`);
      continue;
    }
    planes.push({ entrada, perfil, credito });
  }
  return { planes, problemas };
}

export interface FilaModelo {
  archivo: string;
  antes: Medidas;
  despues: Medidas & { bytes: number };
  /** Ancho, alto y fondo en metros. */
  tam: [number, number, number];
}

/** Une las piezas en un documento nuevo, aplica el perfil y la etapa común, y lo escribe. */
export async function armarModelo(
  entrada: EntradaModelo,
  credito: Credito,
  io: NodeIO,
  extractor: ExtractorOriginales,
  raiz: string,
): Promise<FilaModelo> {
  // Solo avisos: el informe propio dice lo que importa.
  const documento = new Document().setLogger(new Logger(Logger.Verbosity.WARN));
  const piezas: PiezaColocada[] = [];
  const antes: Medidas = { triangulos: 0, drawCalls: 0, mallas: 0, materiales: 0 };
  for (const p of entrada.piezas) {
    const fuente = await io.read(await extractor.ruta(p.original));
    const m = medir(fuente);
    antes.triangulos += m.triangulos;
    antes.drawCalls += m.drawCalls;
    antes.mallas += m.mallas;
    antes.materiales += m.materiales;
    const escenaFuente = fuente.getRoot().getDefaultScene() ?? fuente.getRoot().listScenes()[0];
    const mapa = mergeDocuments(documento, fuente);
    const raices = (escenaFuente?.listChildren() ?? []).map((n) => mapa.get(n) as Node);
    piezas.push({ raices, pos: p.pos, giro: p.giro });
  }

  await aplicarPerfilKenney(documento, piezas, {
    escala: escalaDe(entrada),
    giro: entrada.giro,
    estirar: entrada.estirar,
    caja: entrada.caja,
  });
  // Un GLB lleva un solo búfer: las piezas traían uno cada una.
  await documento.transform(unpartition());

  const escena = documento.getRoot().getDefaultScene();
  const caja = escena ? getBounds(escena) : { min: [0, 0, 0], max: [0, 0, 0] };
  const tam = caja.max.map((v, i) => Math.round((v - (caja.min[i] ?? 0)) * 1000) / 1000) as [
    number,
    number,
    number,
  ];

  const tamanoMaximo = texturaMaximaDe(entrada);
  await aplicarEtapaComun(documento, {
    copyright: textoCopyright(credito),
    ...(tamanoMaximo ? { ktx2: { tamanoMaximo } } : {}),
  });
  const destino = path.join(raiz, entrada.archivo);
  await mkdir(path.dirname(destino), { recursive: true });
  await io.write(destino, documento);
  const { size } = await stat(destino);
  return { archivo: entrada.archivo, antes, despues: { ...medir(documento), bytes: size }, tam };
}

/** Saca la imagen del zip y la pasa a KTX2 con el perfil de ambientCG. */
export async function armarTextura(
  entrada: EntradaTextura,
  extractor: ExtractorOriginales,
  raiz: string,
): Promise<{ archivo: string; ancho: number; alto: number; bytes: number }> {
  const destino = path.join(raiz, entrada.archivo);
  const informe = await texturaAmbientcg(await extractor.ruta(entrada.original), destino);
  return { archivo: entrada.archivo, ...informe.despues };
}
