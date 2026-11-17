import '../tema.css';

export type ColorSello = 'rojo' | 'azul' | 'verde' | 'ambar';

interface Props {
  /** Lo que dice el sello. Es texto real: se lee y se puede seleccionar. */
  texto: string;
  /** Tinta. `ambar` solo sobre la noche: sobre el papel no da contraste. */
  color?: ColorSello;
  /** Golpea al aparecer (se quita con `prefers-reduced-motion`). */
  golpe?: boolean;
  /** Más grande, para el resultado de una pantalla (el final, la pausa). */
  grande?: boolean;
  /** Casi derecho: para sellos pequeños que se leen junto a otro texto. */
  recto?: boolean;
  /** Va sobre la noche y no sobre papel (la tinta no se mezcla con el fondo). */
  sobreNoche?: boolean;
  /**
   * Solo adorno: el lector de pantalla no lo lee porque lo mismo ya está dicho en el texto.
   * Si el sello es la única forma de saber algo, déjalo en `false`.
   */
  decorativo?: boolean;
  /** Clases extra (para colocarlo en su pantalla). */
  clase?: string;
}

/**
 * Sello de goma del archivo (tema de la ola 6), como los sellos de las salas: borde doble,
 * letra de máquina de escribir, un poco torcido y con la tinta gastada. Estilos en
 * `ui/tema.css` (`.tema-sello`).
 */
export default function Sello({
  texto,
  color = 'rojo',
  golpe = false,
  grande = false,
  recto = false,
  sobreNoche = false,
  decorativo = false,
  clase,
}: Props) {
  const clases = [
    'tema-sello',
    `tema-sello-${color}`,
    golpe && 'tema-sello-golpe',
    grande && 'tema-sello-grande',
    recto && 'tema-sello-recto',
    sobreNoche && 'tema-sello-sobre-noche',
    clase,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span class={clases} aria-hidden={decorativo || undefined}>
      {texto}
    </span>
  );
}
