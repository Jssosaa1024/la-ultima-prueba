import type { ComponentChildren } from 'preact';
import '../tema.css';

export type VarianteFicha = 'papel' | 'renglones' | 'carpeta';

interface Props {
  /**
   * `papel`: hoja envejecida lisa. `renglones`: ficha de archivo con margen rojo y renglones.
   * `carpeta`: carpeta de cartón.
   */
  variante?: VarianteFicha;
  /** Rótulo de la pestaña, en letra de máquina de escribir (p. ej. «Expediente 00:40»). */
  pestana?: string;
  /** Entra deslizándose al montarse (se quita con `prefers-reduced-motion`). */
  entra?: boolean;
  /** Etiqueta del contenedor: un `section` con `etiquetadaPor` es una región con nombre. */
  como?: 'div' | 'section' | 'article';
  /** id del título que nombra la ficha (`aria-labelledby`). */
  etiquetadaPor?: string;
  /** Clases extra del contenedor (para colocarla en su pantalla). */
  clase?: string;
  children: ComponentChildren;
}

/**
 * Ficha del archivo (tema de la ola 6): un papel envejecido, una ficha con renglones o una
 * carpeta de cartón, con pestaña opcional. Solo da la apariencia; el contenido y su
 * accesibilidad son de quien la usa. Los estilos están en `ui/tema.css` (`.tema-ficha`).
 */
export default function Ficha({
  variante = 'papel',
  pestana,
  entra = false,
  como: Etiqueta = 'div',
  etiquetadaPor,
  clase,
  children,
}: Props) {
  const clases = [
    'tema-ficha',
    variante === 'renglones' && 'tema-ficha-renglones',
    variante === 'carpeta' && 'tema-ficha-carpeta',
    entra && 'tema-ficha-entra',
    clase,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Etiqueta class={clases} aria-labelledby={etiquetadaPor}>
      {pestana && (
        // La pestaña es un rótulo de papel: se ve y se lee, pero no es un encabezado.
        <p class="tema-ficha-pestana tema-etiqueta">{pestana}</p>
      )}
      {children}
    </Etiqueta>
  );
}
