import { signal } from '@preact/signals';

/** Resultado de la prueba de carga de `/jugar?prueba=glb` (T10). Lo escribe engine/, lo lee ui/. */
export interface PruebaCarga {
  estado: 'inactiva' | 'cargando' | 'lista' | 'error';
  /** Milisegundos desde pedir el GLB hasta tenerlo decodificado. */
  ms: number;
  triangulos: number;
  drawCalls: number;
  /** Formato de GPU de cada textura, por ejemplo `ETC2 RGB` o `ASTC 4×4`. */
  texturas: string[];
}

export const pruebaCarga = signal<PruebaCarga>({
  estado: 'inactiva',
  ms: 0,
  triangulos: 0,
  drawCalls: 0,
  texturas: [],
});
