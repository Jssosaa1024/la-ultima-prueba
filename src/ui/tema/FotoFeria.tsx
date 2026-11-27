import '../tema.css';

interface Props {
  /**
   * El cartel escrito a mano. Sin él, el cartel queda en blanco: el nombre del estudiante solo
   * se ve en «El legado» y en los créditos (`docs/historia.md`, el giro).
   */
  cartel?: string | undefined;
  /** Pie de foto, en letra de máquina. */
  pie: string;
  /** Lo que dice el lector de pantalla de la foto. */
  descripcion: string;
  /** Más pequeña y torcida, como una foto metida en el cuaderno. */
  pequena?: boolean;
  /** Clases extra (para colocarla en su pantalla). */
  clase?: string;
}

/**
 * La foto de la feria de 1991 (Historia · sesión C): el puesto de E. C. en el gimnasio, con el
 * filtro de agua que gotea, el poste de la canasta y su sombra larga. Es un dibujo SVG propio en
 * sepia dentro de un marco de foto vieja: sin imágenes ni assets que acreditar.
 */
export default function FotoFeria({ cartel, pie, descripcion, pequena = false, clase }: Props) {
  const clases = ['tema-foto', pequena && 'tema-foto-pequena', clase].filter(Boolean).join(' ');
  return (
    <figure class={clases}>
      <svg class="tema-foto-imagen" viewBox="0 0 240 150" role="img" aria-label={descripcion}>
        {/* Pared y piso del gimnasio. */}
        <rect width="240" height="150" fill="#d9c7a2" />
        <rect y="96" width="240" height="54" fill="#bfa77c" />
        <line x1="0" y1="96" x2="240" y2="96" stroke="#8a7350" stroke-width="1.5" />
        {/* El poste de la canasta y su sombra larga en el piso (sala 3). */}
        <rect x="214" y="18" width="5" height="80" fill="#5a4630" />
        <rect x="206" y="8" width="30" height="18" fill="none" stroke="#5a4630" stroke-width="3" />
        <polygon points="214,98 219,98 110,140 98,140" fill="#8a7350" opacity="0.55" />
        {/* La mesa del puesto. */}
        <rect x="28" y="78" width="120" height="8" fill="#6d5538" />
        <rect x="34" y="86" width="5" height="30" fill="#6d5538" />
        <rect x="137" y="86" width="5" height="30" fill="#6d5538" />
        {/* El filtro: una botella con capas de arena y carbón, y el agua que gotea a un frasco. */}
        <rect x="56" y="30" width="22" height="40" rx="4" fill="#efe4cc" stroke="#5a4630" />
        <rect x="58" y="40" width="18" height="10" fill="#b39566" />
        <rect x="58" y="50" width="18" height="10" fill="#4a3b2a" />
        <rect x="58" y="60" width="18" height="8" fill="#c9b48a" />
        <rect x="64" y="70" width="6" height="4" fill="#5a4630" />
        <circle cx="67" cy="77" r="1.6" fill="#5a4630" />
        <rect x="88" y="58" width="16" height="20" rx="2" fill="#e6d6b4" stroke="#5a4630" />
        <rect x="89" y="68" width="14" height="9" fill="#a89470" />
        {/* El cartel escrito a mano (su texto va encima, en HTML, para que se lea a 14 px). */}
        <rect x="100" y="26" width="104" height="54" fill="#f3ead6" stroke="#5a4630" />
        {!cartel && (
          // Sin nombre: la letra a mano se borró con los años.
          <g stroke="#8a7350" stroke-width="2.5" stroke-linecap="round" opacity="0.45">
            <path d="M114 44 q8 -4 16 0 t16 0 t16 0 t14 -1" fill="none" />
            <path d="M124 60 q7 -3 14 0 t14 0 t12 0" fill="none" />
          </g>
        )}
        {/* Grano y viñeta de foto vieja. */}
        <rect width="240" height="150" fill="url(#tema-foto-vineta)" />
        <defs>
          <radialGradient id="tema-foto-vineta" cx="50%" cy="50%" r="70%">
            <stop offset="60%" stop-color="#000" stop-opacity="0" />
            <stop offset="100%" stop-color="#2a2118" stop-opacity="0.45" />
          </radialGradient>
        </defs>
      </svg>
      {cartel && (
        // El lector de pantalla ya lo oye en la descripción de la foto.
        <span class="tema-foto-cartel" aria-hidden="true">
          {cartel}
        </span>
      )}
      <figcaption class="tema-foto-pie">{pie}</figcaption>
    </figure>
  );
}
