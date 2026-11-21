/**
 * Láminas: planos legibles dibujados por código (pulir las salas, sesión C).
 *
 * Una pizarra, un corcho, una planilla, un papel, una gráfica, un marcador o un cartel ya no
 * son una caja de un color: el motor dibuja su cara en un lienzo 2D (marco, título con letra
 * clara y renglones) y lo pone como textura en la cara que se ve. Se pide en `salas.json` con
 * `lamina` (ver `esquema-salas.ts`); el color del objeto es el de su superficie (el verde de la
 * pizarra, el corcho, el papel).
 *
 * - **Draw calls.** La textura va en el mismo material de la primitiva, y las otras caras toman
 *   el color del borde del lienzo: una lámina que se toca sigue siendo una malla y una draw call.
 *   Una que no se toca ya no se une a lo fijo (lleva su textura): suma una draw call.
 * - **Texto.** El título y las líneas salen del contenido del juego (`salas.json`), nunca de la
 *   red. Lo que hace falta para resolver un puzzle se lee en la vista 2D de inspección, no en
 *   la lámina (AGENTS.md): la lámina da el título y el aspecto. Sin `lineas`, se dibujan
 *   renglones de garabatos que se ven como escritura sin decir nada.
 * - **Letra clara.** Títulos en Atkinson Hyperlegible (negrita) y renglones en Courier Prime,
 *   las fuentes del tema (T41g). El color de la letra se escoge por contraste con el fondo
 *   (al menos 4,5:1). Si las fuentes aún no cargaron, se dibuja con la del sistema y se vuelve
 *   a dibujar cuando lleguen.
 * - **Memoria.** Un lienzo por lámina, de 320 px por metro, con lados de 128 a 1024 px
 *   (presupuesto: nada mayor de 1024²). Una pizarra de 1,8 × 1 m pesa unos 0,9 MB en la GPU
 *   con sus mipmaps. La textura se libera con la sala (`liberar.ts`).
 *
 * Sin `document` (las pruebas de unidad corren en Node) no hay lienzo: la lámina lleva una
 * textura vacía, para que la sala se arme igual que en el juego y las pruebas cuenten bien.
 */
import {
  CanvasTexture,
  LinearMipmapLinearFilter,
  MeshLambertMaterial,
  SRGBColorSpace,
  Texture,
} from 'three';
import type { BufferGeometry } from 'three';
import type { ObjetoSala } from '../../content/esquema-salas';

export type Lamina = NonNullable<ObjetoSala['lamina']>;
export type TipoLamina = Lamina['tipo'];
type Ctx = CanvasRenderingContext2D;
/** La textura de un lienzo, del documento o fuera de pantalla. */
export type TexturaLienzo = Texture;

/** Resolución de la lámina en la pared. */
export const PX_POR_METRO = 320;
/** Ningún lado pasa de esto (presupuesto de AGENTS.md: nada mayor de 1024²). */
export const LADO_MAXIMO = 1024;
/** Lo más chico que se dibuja: una ficha de 15 cm se ve de cerca y necesita su letra. */
export const LADO_MINIMO = 128;
/** Contraste mínimo entre la letra y su fondo (WCAG AA para texto normal). */
export const CONTRASTE_MINIMO = 4.5;

export const LETRA_TITULO = '"Atkinson Hyperlegible", system-ui, "Segoe UI", Roboto, sans-serif';
export const LETRA_RENGLON = '"Courier Prime", "Courier New", Courier, ui-monospace, monospace';
/** Lo que se pide a `document.fonts` antes de volver a dibujar. */
const FUENTES = [`700 32px "Atkinson Hyperlegible"`, `700 32px "Courier Prime"`];

/** En `userData` del objeto con lámina: su tipo (para las pruebas y el panel). */
export const LAMINA = 'lamina';
/** En `userData` de la textura: vuelve a pintar el lienzo (solo con navegador). */
const REPINTAR = 'repintar';
/** En `userData` de la textura de una lámina: sus marcas (`MarcasLamina`), que lee al pintar. */
const MARCAS = 'marcas';

// ---------- Colores ----------

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const aHex = ([r, g, b]: Rgb): string =>
  `#${[r, g, b]
    .map((c) =>
      Math.round(Math.min(255, Math.max(0, c)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;

/** Mezcla dos colores: `t` = 0 da `a`, 1 da `b`. */
export function mezclar(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return aHex([0, 1, 2].map((i) => (x[i] ?? 0) + ((y[i] ?? 0) - (x[i] ?? 0)) * t) as Rgb);
}

const aclarar = (c: string, t: number): string => mezclar(c, '#ffffff', t);
const oscurecer = (c: string, t: number): string => mezclar(c, '#000000', t);

/** Luminancia relativa (WCAG 2), de 0 (negro) a 1 (blanco). */
export function luminancia(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste WCAG entre dos colores, de 1 a 21. */
export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * La letra que se lee mejor sobre `fondo`: la oscura o la clara de cada tipo, o negro o blanco
 * si ninguna llega al contraste mínimo.
 */
export function tintaPara(fondo: string, oscura = '#1d1a16', clara = '#fbf8ef'): string {
  const mejor = contraste(fondo, oscura) >= contraste(fondo, clara) ? oscura : clara;
  if (contraste(fondo, mejor) >= CONTRASTE_MINIMO) return mejor;
  // Un fondo de tono medio: ni la tinta oscura ni la clara alcanzan; negro o blanco puro.
  return contraste(fondo, '#000000') >= contraste(fondo, '#ffffff') ? '#000000' : '#ffffff';
}

// ---------- Azar con semilla (la misma lámina se dibuja igual siempre) ----------

export function semillaDe(texto: string): number {
  let h = 2166136261;
  for (const c of texto) {
    h ^= c.codePointAt(0) ?? 0;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function aleatorio(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Medidas ----------

/** Qué cara lleva la lámina: el frente de un plano o de una caja alta, o la de arriba de una hoja. */
export type CaraLamina = 'frente' | 'arriba';

export function caraDeLamina(o: Pick<ObjetoSala, 'forma' | 'tam'>): CaraLamina {
  const [ancho, alto, fondo] = o.tam;
  return o.forma === 'caja' && alto < Math.min(ancho, fondo) ? 'arriba' : 'frente';
}

/** Ancho y alto en metros de la cara que lleva la lámina. */
export function medidasCara(o: Pick<ObjetoSala, 'forma' | 'tam'>): [number, number] {
  const [ancho, alto, fondo] = o.tam;
  return caraDeLamina(o) === 'arriba' ? [ancho, fondo] : [ancho, alto];
}

/** Tamaño del lienzo en píxeles para una cara de `ancho` × `alto` metros. */
export function medidasLienzo(ancho: number, alto: number): { ancho: number; alto: number } {
  let escala = PX_POR_METRO;
  const menor = Math.min(ancho, alto);
  const mayor = Math.max(ancho, alto);
  if (menor * escala < LADO_MINIMO) escala = LADO_MINIMO / menor;
  if (mayor * escala > LADO_MAXIMO) escala = LADO_MAXIMO / mayor;
  return {
    ancho: Math.max(1, Math.min(LADO_MAXIMO, Math.round(ancho * escala))),
    alto: Math.max(1, Math.min(LADO_MAXIMO, Math.round(alto * escala))),
  };
}

// ---------- Ayudas de dibujo ----------

function caminoRedondeado(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const radio = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radio, y);
  ctx.arcTo(x + w, y, x + w, y + h, radio);
  ctx.arcTo(x + w, y + h, x, y + h, radio);
  ctx.arcTo(x, y + h, x, y, radio);
  ctx.arcTo(x, y, x + w, y, radio);
  ctx.closePath();
}

function rectRedondeado(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string,
): void {
  caminoRedondeado(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * Marco biselado, como los muebles de KayKit: el borde de un color, con luz arriba y a la
 * izquierda y sombra abajo y a la derecha. Devuelve el rectángulo de adentro.
 */
export function marcoBiselado(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  grosor: number,
  color: string,
): { x: number; y: number; w: number; h: number } {
  const g = Math.max(1, grosor);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  const bisel = Math.max(1, g * 0.35);
  ctx.fillStyle = aclarar(color, 0.28);
  ctx.fillRect(x, y, w, bisel);
  ctx.fillRect(x, y, bisel, h);
  ctx.fillStyle = oscurecer(color, 0.3);
  ctx.fillRect(x, y + h - bisel, w, bisel);
  ctx.fillRect(x + w - bisel, y, bisel, h);
  // El canto de adentro: sombra arriba y a la izquierda (el panel queda hundido).
  const ix = x + g;
  const iy = y + g;
  const iw = w - 2 * g;
  const ih = h - 2 * g;
  const filo = Math.max(1, g * 0.18);
  ctx.fillStyle = oscurecer(color, 0.45);
  ctx.fillRect(ix - filo, iy - filo, iw + 2 * filo, filo);
  ctx.fillRect(ix - filo, iy - filo, filo, ih + 2 * filo);
  ctx.fillStyle = aclarar(color, 0.15);
  ctx.fillRect(ix - filo, iy + ih, iw + 2 * filo, filo);
  ctx.fillRect(ix + iw, iy - filo, filo, ih + 2 * filo);
  return { x: ix, y: iy, w: iw, h: ih };
}

/**
 * Escribe `texto` en una línea que no pasa de `maxAncho`: baja la letra hasta `minimo` y, si
 * aun así no cabe, corta con «…». Devuelve el tamaño que usó.
 */
export function textoAjustado(
  ctx: Ctx,
  texto: string,
  x: number,
  y: number,
  maxAncho: number,
  tam: number,
  familia: string,
  color: string,
  alinear: CanvasTextAlign = 'center',
  minimo = tam * 0.55,
): number {
  let t = Math.max(1, Math.round(tam));
  const fuente = (n: number) => `700 ${n}px ${familia}`;
  ctx.font = fuente(t);
  while (t > minimo && ctx.measureText(texto).width > maxAncho) {
    t = Math.max(Math.floor(minimo), t - Math.max(1, Math.round(t * 0.06)));
    ctx.font = fuente(t);
  }
  let final = texto;
  if (ctx.measureText(final).width > maxAncho) {
    while (final.length > 1 && ctx.measureText(`${final}…`).width > maxAncho) {
      final = final.slice(0, -1).trimEnd();
    }
    final = `${final}…`;
  }
  ctx.fillStyle = color;
  ctx.textAlign = alinear;
  ctx.textBaseline = 'middle';
  ctx.fillText(final, x, y);
  return t;
}

/**
 * Renglones de «escritura» sin palabras: trazos redondeados de largo variable. Se leen como
 * texto de lejos sin decir nada (lo que importa va en la vista 2D).
 */
export function garabatos(
  ctx: Ctx,
  rnd: () => number,
  x: number,
  y: number,
  ancho: number,
  interlinea: number,
  lineas: number,
  color: string,
): void {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, interlinea * 0.22);
  for (let i = 0; i < lineas; i++) {
    const fin = i === lineas - 1 ? 0.35 + rnd() * 0.3 : 0.75 + rnd() * 0.25;
    const yy = y + i * interlinea;
    let xx = x;
    ctx.beginPath();
    while (xx < x + ancho * fin) {
      const palabra = interlinea * (0.6 + rnd() * 1.8);
      const hasta = Math.min(x + ancho * fin, xx + palabra);
      ctx.moveTo(xx, yy);
      ctx.lineTo(hasta, yy + (rnd() - 0.5) * interlinea * 0.08);
      xx = hasta + interlinea * 0.45;
    }
    ctx.stroke();
  }
}

/**
 * Parte un texto en hasta `maximo` líneas de largo parecido, sin cortar palabras (para las
 * notas del corcho, que son angostas).
 */
export function partirEnLineas(texto: string, maximo: number): string[] {
  const palabras = texto.split(/\s+/).filter(Boolean);
  if (palabras.length <= 1 || maximo <= 1) return [texto];
  const n = Math.min(maximo, palabras.length, Math.max(1, Math.round(texto.length / 7)));
  const meta = texto.length / n;
  const lineas: string[] = [];
  let actual = '';
  for (const p of palabras) {
    const junta = actual ? `${actual} ${p}` : p;
    if (actual && junta.length > meta && lineas.length < n - 1) {
      lineas.push(actual);
      actual = p;
    } else {
      actual = junta;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

/** Renglones: el texto dado o, sin texto, garabatos. */
function renglones(
  ctx: Ctx,
  rnd: () => number,
  lineas: readonly string[] | undefined,
  caja: { x: number; y: number; w: number; h: number },
  porDefecto: number,
  color: string,
  alinear: CanvasTextAlign = 'left',
): void {
  const n = lineas?.length ? lineas.length : porDefecto;
  if (n <= 0) return;
  if (!lineas?.length) {
    const paso = Math.min(caja.h / n, caja.w * 0.14);
    garabatos(ctx, rnd, caja.x, caja.y + paso / 2, caja.w, paso, n, color);
    return;
  }
  // Con texto, el renglón usa todo su alto (la letra se ajusta después al ancho).
  const interlinea = Math.min(caja.h / n, caja.w * 0.3);
  const x = alinear === 'center' ? caja.x + caja.w / 2 : caja.x;
  lineas.forEach((linea, i) => {
    textoAjustado(
      ctx,
      linea,
      x,
      caja.y + interlinea * (i + 0.5),
      caja.w,
      interlinea * 0.72,
      LETRA_RENGLON,
      color,
      alinear,
    );
  });
}

// ---------- Los tipos ----------

/**
 * Lo que el juego le agrega a una lámina mientras se juega, sin cambiar su contenido: por ahora,
 * el sello de la sala en su cartel del pasillo (pasillos, sesión C). Se cambia con
 * `marcarLamina` y la textura se vuelve a pintar en el mismo lienzo: ni malla ni draw call nueva.
 */
export interface MarcasLamina {
  /** Número de la sala (1 a 5) cuyo sello se estampa en el cartel. */
  sello?: number;
}

interface Dibujo {
  ctx: Ctx;
  w: number;
  h: number;
  /** Color de la superficie: el `color` del objeto. */
  base: string;
  lamina: Lamina;
  rnd: () => number;
  marcas: MarcasLamina;
}

const COLOR_ALUMINIO = '#a9b0b6';
const COLOR_MADERA = '#8a5a34';
const COLOR_TABLILLA = '#9c6b3c';

function pizarra({ ctx, w, h, base, lamina, rnd }: Dibujo): void {
  const m = Math.round(Math.min(w, h) * 0.045);
  const panel = marcoBiselado(ctx, 0, 0, w, h, m, COLOR_ALUMINIO);
  ctx.fillStyle = base;
  ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
  const blanca = luminancia(base) > 0.45;
  // Borrones del borrador: pasadas anchas y casi horizontales (en una pizarra blanca, apenas
  // sombras grises).
  ctx.fillStyle = blanca ? 'rgba(80,90,100,0.035)' : 'rgba(255,255,255,0.04)';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.ellipse(
      panel.x + rnd() * panel.w,
      panel.y + rnd() * panel.h,
      panel.w * (0.12 + rnd() * 0.14),
      panel.h * (0.04 + rnd() * 0.04),
      (rnd() - 0.5) * 0.3,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  // Tiza clara o marcador azul: la que más contraste dé con el fondo.
  const tinta = tintaPara(base, '#1f3b73', '#f4f1e6');
  const margen = panel.w * 0.06;
  const alto = panel.h;
  let y = panel.y + alto * 0.08;
  if (lamina.titulo) {
    const t = textoAjustado(
      ctx,
      lamina.titulo,
      panel.x + panel.w / 2,
      y + alto * 0.08,
      panel.w - 2 * margen,
      alto * 0.17,
      LETRA_TITULO,
      tinta,
    );
    ctx.strokeStyle = tinta;
    ctx.lineWidth = Math.max(1, t * 0.07);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(panel.x + panel.w * 0.3, y + alto * 0.08 + t * 0.62);
    ctx.lineTo(panel.x + panel.w * 0.7, y + alto * 0.08 + t * 0.6);
    ctx.stroke();
    y += alto * 0.27;
  }
  renglones(
    ctx,
    rnd,
    lamina.lineas,
    { x: panel.x + margen, y, w: panel.w - 2 * margen, h: panel.y + alto * 0.84 - y },
    4,
    tinta,
  );
  // Repisa de la tiza: una tiza y un borrador.
  const repisa = Math.max(2, m * 0.9);
  ctx.fillStyle = oscurecer(COLOR_ALUMINIO, 0.15);
  ctx.fillRect(panel.x, panel.y + panel.h - repisa, panel.w, repisa);
  ctx.fillStyle = blanca ? '#c0392b' : '#f7f4ea';
  ctx.fillRect(
    panel.x + panel.w * 0.18,
    panel.y + panel.h - repisa * 1.6,
    panel.w * 0.05,
    repisa * 0.6,
  );
  rectRedondeado(
    ctx,
    panel.x + panel.w * 0.72,
    panel.y + panel.h - repisa * 2.2,
    panel.w * 0.12,
    repisa * 1.2,
    repisa * 0.3,
    '#5d6d7e',
  );
  ctx.fillStyle = '#d5c4a1';
  ctx.fillRect(
    panel.x + panel.w * 0.72,
    panel.y + panel.h - repisa * 1.4,
    panel.w * 0.12,
    repisa * 0.4,
  );
}

const COLORES_NOTA = ['#fdfbf3', '#fff3a8', '#cfe8ff', '#ffd6e0', '#d9f2c7'];
const COLORES_CHINCHE = ['#c0392b', '#2471a3', '#239b56', '#d4ac0d'];

function nota(
  ctx: Ctx,
  rnd: () => number,
  cx: number,
  cy: number,
  w: number,
  h: number,
  color: string,
  texto: string | undefined,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rnd() - 0.5) * 0.16);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(-w / 2 + w * 0.04, -h / 2 + h * 0.05, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  const caja = { x: -w / 2 + w * 0.1, y: -h / 2 + h * 0.22, w: w * 0.8, h: h * 0.68 };
  if (texto) {
    const lineas = partirEnLineas(texto, 3);
    renglones(ctx, rnd, lineas, caja, lineas.length, tintaPara(color), 'center');
  } else {
    garabatos(
      ctx,
      rnd,
      caja.x,
      caja.y + h * 0.06,
      caja.w,
      Math.min(h * 0.15, w * 0.12),
      3,
      'rgba(40,40,60,0.55)',
    );
  }
  // Chinche con su brillo.
  const r = Math.max(2, Math.min(w, h) * 0.07);
  const chinche = COLORES_CHINCHE[Math.floor(rnd() * COLORES_CHINCHE.length)] ?? '#c0392b';
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.arc(r * 0.3, -h / 2 + h * 0.1 + r * 0.35, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = chinche;
  ctx.beginPath();
  ctx.arc(0, -h / 2 + h * 0.1, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(-r * 0.3, -h / 2 + h * 0.1 - r * 0.3, r * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function corcho({ ctx, w, h, base, lamina, rnd }: Dibujo): void {
  const m = Math.round(Math.min(w, h) * 0.05);
  const panel = marcoBiselado(ctx, 0, 0, w, h, m, COLOR_MADERA);
  ctx.fillStyle = base;
  ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
  // Grano del corcho.
  const granos = Math.round((panel.w * panel.h) / 90);
  const oscuro = oscurecer(base, 0.25);
  const claro = aclarar(base, 0.2);
  for (let i = 0; i < granos; i++) {
    ctx.fillStyle = rnd() < 0.5 ? oscuro : claro;
    const s = 1 + rnd() * 2;
    ctx.fillRect(panel.x + rnd() * panel.w, panel.y + rnd() * panel.h, s, s);
  }
  let arriba = panel.y;
  if (lamina.titulo) {
    const alto = panel.h * 0.18;
    const ancho = Math.min(panel.w * 0.7, alto * lamina.titulo.length * 0.7 + alto);
    const cx = panel.x + panel.w / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(cx - ancho / 2 + 3, panel.y + panel.h * 0.05 + 3, ancho, alto);
    ctx.fillStyle = '#fbf8ef';
    ctx.fillRect(cx - ancho / 2, panel.y + panel.h * 0.05, ancho, alto);
    textoAjustado(
      ctx,
      lamina.titulo,
      cx,
      panel.y + panel.h * 0.05 + alto / 2,
      ancho * 0.88,
      alto * 0.7,
      LETRA_TITULO,
      '#1d1a16',
    );
    arriba = panel.y + panel.h * 0.05 + alto;
  }
  const textos = lamina.lineas ?? [];
  const n = textos.length > 0 ? textos.length : 4 + Math.floor(rnd() * 2);
  // Con texto, notas más grandes (menos columnas) para que la letra se lea.
  const columnas =
    textos.length > 0
      ? Math.min(n, Math.max(1, Math.ceil(n / 2)))
      : Math.min(n, Math.max(2, Math.round((panel.w / panel.h) * 2)));
  const filas = Math.ceil(n / columnas);
  const celdaW = panel.w / columnas;
  const celdaH = (panel.y + panel.h - arriba) / filas;
  for (let i = 0; i < n; i++) {
    const col = i % columnas;
    const fila = Math.floor(i / columnas);
    const nw = celdaW * (0.62 + rnd() * 0.16);
    const nh = Math.min(celdaH * 0.78, nw * (0.75 + rnd() * 0.35));
    const cx = panel.x + celdaW * (col + 0.5) + (rnd() - 0.5) * celdaW * 0.12;
    const cy = arriba + celdaH * (fila + 0.5) + (rnd() - 0.5) * celdaH * 0.1;
    const color = COLORES_NOTA[(i + Math.floor(rnd() * 3)) % COLORES_NOTA.length] ?? '#fdfbf3';
    nota(ctx, rnd, cx, cy, nw, nh, color, textos[i]);
  }
}

function planilla({ ctx, w, h, base, lamina, rnd }: Dibujo): void {
  // La tablilla de madera prensada, con el papel encima y la pinza de metal.
  ctx.fillStyle = COLOR_TABLILLA;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = aclarar(COLOR_TABLILLA, 0.15);
  ctx.fillRect(0, 0, w, Math.max(1, h * 0.012));
  const mx = w * 0.07;
  const papel = { x: mx, y: h * 0.1, w: w - 2 * mx, h: h * 0.85 };
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(papel.x + 3, papel.y + 3, papel.w, papel.h);
  ctx.fillStyle = base;
  ctx.fillRect(papel.x, papel.y, papel.w, papel.h);
  const pinzaW = w * 0.34;
  const pinzaH = h * 0.1;
  rectRedondeado(ctx, (w - pinzaW) / 2, h * 0.03, pinzaW, pinzaH, pinzaH * 0.3, '#b8c0c6');
  ctx.fillStyle = '#e3e8eb';
  ctx.fillRect(
    (w - pinzaW) / 2 + pinzaW * 0.1,
    h * 0.03 + pinzaH * 0.18,
    pinzaW * 0.8,
    pinzaH * 0.18,
  );
  ctx.fillStyle = '#7f8a91';
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.03 + pinzaH * 0.62, pinzaH * 0.16, 0, Math.PI * 2);
  ctx.fill();

  const tinta = tintaPara(base);
  const dentro = { x: papel.x + papel.w * 0.06, w: papel.w * 0.88 };
  let y = papel.y + pinzaH * 0.75;
  const cabeza = papel.h * 0.13;
  if (lamina.titulo) {
    textoAjustado(
      ctx,
      lamina.titulo,
      dentro.x + dentro.w / 2,
      y + cabeza / 2,
      dentro.w,
      cabeza * 0.62,
      LETRA_TITULO,
      tinta,
    );
    y += cabeza;
  }
  // Tabla: encabezado de color y filas con rayas.
  const lineas = lamina.lineas ?? [];
  const filas = Math.max(lineas.length, 5);
  const altoFila = Math.min((papel.y + papel.h * 0.95 - y) / (filas + 1), cabeza);
  const columnas = Math.max(3, ...lineas.map((l) => l.split('|').length));
  const anchoCol = dentro.w / columnas;
  ctx.fillStyle = mezclar(base, '#2471a3', 0.22);
  ctx.fillRect(dentro.x, y, dentro.w, altoFila);
  ctx.strokeStyle = mezclar(base, '#2471a3', 0.5);
  ctx.lineWidth = Math.max(1, altoFila * 0.05);
  for (let f = 0; f <= filas + 1; f++) {
    ctx.beginPath();
    ctx.moveTo(dentro.x, y + f * altoFila);
    ctx.lineTo(dentro.x + dentro.w, y + f * altoFila);
    ctx.stroke();
  }
  for (let c = 0; c <= columnas; c++) {
    ctx.beginPath();
    ctx.moveTo(dentro.x + c * anchoCol, y);
    ctx.lineTo(dentro.x + c * anchoCol, y + (filas + 1) * altoFila);
    ctx.stroke();
  }
  for (let f = 0; f < filas; f++) {
    const yy = y + (f + 1) * altoFila;
    const celdas = lineas[f]?.split('|').map((s) => s.trim());
    for (let c = 0; c < columnas; c++) {
      const caja = {
        x: dentro.x + c * anchoCol + anchoCol * 0.1,
        y: yy,
        w: anchoCol * 0.8,
        h: altoFila,
      };
      const texto = celdas?.[c];
      if (texto) renglones(ctx, rnd, [texto], caja, 1, tinta, 'center');
      else if (!celdas)
        garabatos(
          ctx,
          rnd,
          caja.x,
          yy + altoFila / 2,
          caja.w * (0.4 + rnd() * 0.6),
          altoFila * 0.55,
          1,
          'rgba(30,40,70,0.6)',
        );
    }
  }
}

function papel({ ctx, w, h, base, lamina, rnd }: Dibujo): void {
  ctx.fillStyle = oscurecer(base, 0.12);
  ctx.fillRect(0, 0, w, h);
  const borde = Math.max(1, Math.min(w, h) * 0.012);
  ctx.fillStyle = base;
  ctx.fillRect(borde, borde, w - 2 * borde, h - 2 * borde);
  const tinta = tintaPara(base);
  const m = Math.min(w, h) * 0.09;
  let y = m;
  if (lamina.titulo) {
    const alto = Math.min(h * 0.14, w * 0.11);
    textoAjustado(ctx, lamina.titulo, w / 2, y + alto / 2, w - 2 * m, alto, LETRA_TITULO, tinta);
    y += alto * 1.25;
    ctx.fillStyle = mezclar(base, tinta, 0.6);
    ctx.fillRect(m, y, w - 2 * m, Math.max(1, h * 0.006));
    y += h * 0.04;
  }
  renglones(
    ctx,
    rnd,
    lamina.lineas,
    { x: m, y, w: w - 2 * m, h: h - m - y },
    Math.max(3, Math.round((h - m - y) / (h * 0.1))),
    lamina.lineas ? tinta : 'rgba(40,45,60,0.55)',
  );
}

function cuadricula({ ctx, w, h, base, lamina }: Dibujo): void {
  const m = Math.round(Math.min(w, h) * 0.035);
  const panel = marcoBiselado(ctx, 0, 0, w, h, m, COLOR_ALUMINIO);
  ctx.fillStyle = base;
  ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
  const tinta = tintaPara(base);
  const paso = Math.max(4, Math.min(panel.w, panel.h) / 20);
  const lado = paso * 5;
  const cuadro = {
    x: panel.x + panel.w * 0.08,
    y: panel.y + panel.h * (lamina.titulo ? 0.18 : 0.06),
    w: panel.w * 0.88,
    h: 0,
  };
  cuadro.h = panel.y + panel.h * 0.9 - cuadro.y;
  for (const [cada, color, grueso] of [
    [paso, mezclar(base, '#5dade2', 0.25), 1],
    [lado, mezclar(base, '#2471a3', 0.45), 2],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = grueso;
    ctx.beginPath();
    for (let x = cuadro.x; x <= cuadro.x + cuadro.w + 0.5; x += cada) {
      ctx.moveTo(x, cuadro.y);
      ctx.lineTo(x, cuadro.y + cuadro.h);
    }
    for (let y = cuadro.y + cuadro.h; y >= cuadro.y - 0.5; y -= cada) {
      ctx.moveTo(cuadro.x, y);
      ctx.lineTo(cuadro.x + cuadro.w, y);
    }
    ctx.stroke();
  }
  // Ejes con flecha.
  ctx.strokeStyle = tinta;
  ctx.fillStyle = tinta;
  ctx.lineWidth = Math.max(2, paso * 0.18);
  ctx.beginPath();
  ctx.moveTo(cuadro.x, cuadro.y - paso * 0.5);
  ctx.lineTo(cuadro.x, cuadro.y + cuadro.h);
  ctx.lineTo(cuadro.x + cuadro.w + paso * 0.2, cuadro.y + cuadro.h);
  ctx.stroke();
  const flecha = paso * 0.6;
  ctx.beginPath();
  ctx.moveTo(cuadro.x, cuadro.y - paso);
  ctx.lineTo(cuadro.x - flecha / 2, cuadro.y - paso + flecha);
  ctx.lineTo(cuadro.x + flecha / 2, cuadro.y - paso + flecha);
  ctx.fill();
  if (lamina.titulo) {
    textoAjustado(
      ctx,
      lamina.titulo,
      panel.x + panel.w / 2,
      panel.y + panel.h * 0.09,
      panel.w * 0.9,
      panel.h * 0.1,
      LETRA_TITULO,
      tinta,
    );
  }
  lamina.lineas?.slice(0, 2).forEach((eje, i) => {
    if (i === 0) {
      textoAjustado(
        ctx,
        eje,
        cuadro.x + cuadro.w,
        panel.y + panel.h * 0.95,
        cuadro.w * 0.5,
        panel.h * 0.055,
        LETRA_RENGLON,
        tinta,
        'right',
      );
    } else {
      ctx.save();
      ctx.translate(panel.x + panel.w * 0.04, cuadro.y + cuadro.h / 2);
      ctx.rotate(-Math.PI / 2);
      textoAjustado(ctx, eje, 0, 0, cuadro.h * 0.8, panel.h * 0.055, LETRA_RENGLON, tinta);
      ctx.restore();
    }
  });
}

/** Segmentos encendidos de cada dígito: a, b, c, d, e, f, g. */
const SIETE: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abdeg',
  '3': 'abcdg',
  '4': 'bcfg',
  '5': 'acdfg',
  '6': 'acdefg',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  '-': 'g',
  ' ': '',
};

/** Un dígito de siete segmentos en la caja (x, y, w, h). */
export function digito(
  ctx: Ctx,
  caracter: string,
  x: number,
  y: number,
  w: number,
  h: number,
  encendido: string,
  apagado: string,
): void {
  const g = Math.max(1, w * 0.18);
  const medio = y + h / 2;
  const seg: Record<string, [number, number, number, number]> = {
    a: [x + g, y, w - 2 * g, g],
    b: [x + w - g, y + g, g, h / 2 - 1.5 * g],
    c: [x + w - g, medio + g / 2, g, h / 2 - 1.5 * g],
    d: [x + g, y + h - g, w - 2 * g, g],
    e: [x, medio + g / 2, g, h / 2 - 1.5 * g],
    f: [x, y + g, g, h / 2 - 1.5 * g],
    g: [x + g, medio - g / 2, w - 2 * g, g],
  };
  const prendidos = SIETE[caracter] ?? '';
  for (const [nombre, [sx, sy, sw, sh]] of Object.entries(seg)) {
    rectRedondeado(ctx, sx, sy, sw, sh, g * 0.45, prendidos.includes(nombre) ? encendido : apagado);
  }
}

function marcador({ ctx, w, h, base, lamina }: Dibujo): void {
  const m = Math.round(Math.min(w, h) * 0.05);
  const panel = marcoBiselado(ctx, 0, 0, w, h, m, aclarar(base, 0.18));
  ctx.fillStyle = base;
  ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
  const encendido = '#ffb02e';
  const apagado = mezclar(base, encendido, 0.1);
  const rotulos = tintaPara(base, '#1d1a16', '#f7f4ea');
  let arriba = panel.y + panel.h * 0.05;
  if (lamina.titulo) {
    const alto = panel.h * 0.16;
    textoAjustado(
      ctx,
      lamina.titulo,
      panel.x + panel.w / 2,
      arriba + alto / 2,
      panel.w * 0.9,
      alto * 0.78,
      LETRA_TITULO,
      rotulos,
    );
    arriba += alto * 1.1;
  }
  // Cada línea es un tablero: «LOCAL 12» tiene rótulo y número; «12» solo el número.
  const tableros = (lamina.lineas?.length ? lamina.lineas : ['00', '00']).map((l) => {
    const partes = /^([^\d.,$]*?)\s*([0-9][0-9: -]*)$/.exec(l.trim());
    return { rotulo: partes?.[1]?.trim() ?? '', cifras: (partes?.[2] ?? l).replace(/\s/g, '') };
  });
  const conRotulo = tableros.some((t) => t.rotulo);
  const ancho = panel.w / tableros.length;
  const bajo = panel.y + panel.h * 0.94;
  const altoRotulo = conRotulo ? panel.h * 0.12 : 0;
  tableros.forEach(({ rotulo, cifras }, i) => {
    const x0 = panel.x + ancho * i;
    if (rotulo) {
      textoAjustado(
        ctx,
        rotulo,
        x0 + ancho / 2,
        arriba + altoRotulo / 2,
        ancho * 0.85,
        altoRotulo * 0.75,
        LETRA_TITULO,
        rotulos,
      );
    }
    const top = arriba + altoRotulo + panel.h * 0.03;
    const alto = bajo - top;
    const caracteres = [...cifras].filter((c) => c !== ':');
    const dw = Math.min(alto * 0.55, (ancho * 0.8) / Math.max(1, caracteres.length) - alto * 0.08);
    const total = caracteres.length * dw + (caracteres.length - 1) * dw * 0.22;
    let x = x0 + (ancho - total) / 2;
    rectRedondeado(
      ctx,
      x - dw * 0.25,
      top - dw * 0.15,
      total + dw * 0.5,
      alto + dw * 0.3,
      dw * 0.15,
      oscurecer(base, 0.45),
    );
    for (const c of caracteres) {
      digito(ctx, c, x, top, dw, alto, encendido, apagado);
      x += dw * 1.22;
    }
  });
}

/**
 * Cartel: fondo de color, borde interior y texto centrado. Con `flecha`, una flecha a ese lado
 * (pasillos); con el sello de su sala (`marcas.sello`), un sello redondo estampado a la
 * derecha, y el texto se corre para no quedar debajo.
 */
function cartel({ ctx, w, h, base, lamina, rnd, marcas }: Dibujo): void {
  const m = Math.round(Math.min(w, h) * 0.04);
  ctx.fillStyle = oscurecer(base, 0.25);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = base;
  ctx.fillRect(m * 0.5, m * 0.5, w - m, h - m);
  const tinta = tintaPara(base);
  ctx.strokeStyle = tinta;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = Math.max(1, m * 0.35);
  caminoRedondeado(ctx, m * 1.4, m * 1.4, w - m * 2.8, h - m * 2.8, m);
  ctx.stroke();
  ctx.globalAlpha = 1;
  const dentro = { x: m * 2.6, y: m * 2.4, w: w - m * 5.2, h: h - m * 4.8 };
  // Flecha: un cuadrado del alto de adentro, a su lado.
  if (lamina.flecha) {
    const lado = Math.min(dentro.h, dentro.w * 0.3);
    const x = lamina.flecha === 'izquierda' ? dentro.x : dentro.x + dentro.w - lado;
    dibujarFlecha(ctx, x, dentro.y + (dentro.h - lado) / 2, lado, lamina.flecha, tinta);
    dentro.w -= lado + m;
    if (lamina.flecha === 'izquierda') dentro.x += lado + m;
  }
  // Sello: un círculo casi del alto del cartel, a la derecha; el texto se corre a la izquierda.
  const sello = marcas.sello;
  const diametro = Math.min(h * 0.92, w * 0.4);
  if (sello !== undefined) dentro.w -= diametro * 0.8;
  const centro = dentro.x + dentro.w / 2;
  const hayLineas = Boolean(lamina.lineas?.length);
  const altoTitulo = hayLineas ? dentro.h * 0.38 : dentro.h * 0.6;
  if (lamina.titulo) {
    textoAjustado(
      ctx,
      lamina.titulo,
      centro,
      dentro.y + (hayLineas ? altoTitulo / 2 : dentro.h / 2),
      dentro.w,
      altoTitulo * 0.8,
      LETRA_TITULO,
      tinta,
    );
  }
  const desde = lamina.titulo ? dentro.y + altoTitulo : dentro.y;
  renglones(
    ctx,
    rnd,
    lamina.lineas,
    { x: dentro.x, y: desde, w: dentro.w, h: dentro.y + dentro.h - desde },
    lamina.titulo ? 0 : 2,
    tinta,
    'center',
  );
  if (sello !== undefined) {
    selloDeSala(ctx, w - m * 1.2 - diametro / 2, h / 2, diametro, sello, rnd);
  }
}

/** Flecha gruesa de punta triangular dentro de un cuadrado de `lado`, hacia ese lado. */
export function dibujarFlecha(
  ctx: Ctx,
  x: number,
  y: number,
  lado: number,
  hacia: 'izquierda' | 'derecha',
  color: string,
): void {
  const s = hacia === 'izquierda' ? -1 : 1;
  const cx = x + lado / 2;
  const cy = y + lado / 2;
  const largo = lado * 0.46;
  const punta = lado * 0.42;
  const grueso = lado * 0.13;
  ctx.beginPath();
  ctx.moveTo(cx + s * largo, cy);
  ctx.lineTo(cx + s * (largo - punta), cy - punta);
  ctx.lineTo(cx + s * (largo - punta), cy - grueso);
  ctx.lineTo(cx - s * largo, cy - grueso);
  ctx.lineTo(cx - s * largo, cy + grueso);
  ctx.lineTo(cx + s * (largo - punta), cy + grueso);
  ctx.lineTo(cx + s * (largo - punta), cy + punta);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * El sello de cada sala, con la misma figura y el mismo color de su pieza en el mural de la
 * portería (`mecanismos/porteria.ts`): moneda, gota, balón, libro y llave.
 */
export const SELLOS_DE_SALA: readonly { figura: string; color: string }[] = [
  { figura: 'moneda', color: '#d4ac0d' },
  { figura: 'gota', color: '#3498db' },
  { figura: 'balon', color: '#e67e22' },
  { figura: 'libro', color: '#c0392b' },
  { figura: 'llave', color: '#bdc3c7' },
];

/** Papel y tinta del sello: los del tema del archivo (`ui/tema.css`), verde 5,5:1 sobre el papel. */
export const PAPEL_SELLO = '#efe4cc';
export const TINTA_SELLO = '#2c6440';
const TRAZO_FIGURA = '#2a2118';

/**
 * Sello redondo de la sala `numero` (1 a 5), de diámetro `d`, como si lo hubieran estampado:
 * un disco de papel un poco torcido, doble anillo de tinta verde gastada y, en el centro, la
 * figura del sello de esa sala. El papel claro lo hace contrastar sobre cualquier cartel.
 */
export function selloDeSala(
  ctx: Ctx,
  cx: number,
  cy: number,
  d: number,
  numero: number,
  rnd: () => number,
): void {
  const r = d / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.18);
  // Sombra corta y el disco de papel.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.arc(r * 0.05, r * 0.07, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PAPEL_SELLO;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  // Doble anillo de tinta.
  ctx.strokeStyle = TINTA_SELLO;
  ctx.lineWidth = Math.max(1.5, r * 0.11);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.84, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = Math.max(1, r * 0.04);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.66, 0, Math.PI * 2);
  ctx.stroke();
  figuraDeSello(ctx, r * 0.46, numero);
  // Tinta gastada: unas motas de papel sobre los anillos.
  ctx.fillStyle = PAPEL_SELLO;
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2;
    const rr = r * (0.62 + rnd() * 0.28);
    ctx.globalAlpha = 0.55 + rnd() * 0.45;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, r * (0.02 + rnd() * 0.04), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** La figura del sello de la sala `numero`, centrada en el origen y de radio `r`. */
function figuraDeSello(ctx: Ctx, r: number, numero: number): void {
  const sello = SELLOS_DE_SALA[numero - 1] ?? SELLOS_DE_SALA[0];
  if (!sello) return;
  ctx.fillStyle = sello.color;
  ctx.strokeStyle = TRAZO_FIGURA;
  ctx.lineWidth = Math.max(1, r * 0.09);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  switch (sello.figura) {
    case 'moneda':
      ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      return;
    case 'gota':
      ctx.moveTo(0, -r);
      ctx.bezierCurveTo(r * 0.35, -r * 0.45, r * 0.75, -r * 0.05, r * 0.72, r * 0.32);
      ctx.arc(0, r * 0.3, r * 0.72, 0, Math.PI);
      ctx.bezierCurveTo(-r * 0.75, -r * 0.05, -r * 0.35, -r * 0.45, 0, -r);
      ctx.fill();
      ctx.stroke();
      return;
    case 'balon':
      ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.85, 0);
      ctx.lineTo(r * 0.85, 0);
      ctx.moveTo(0, -r * 0.85);
      ctx.lineTo(0, r * 0.85);
      ctx.stroke();
      return;
    case 'libro':
      ctx.rect(-r * 0.62, -r * 0.82, r * 1.24, r * 1.64);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, -r * 0.82);
      ctx.lineTo(-r * 0.4, r * 0.82);
      ctx.stroke();
      return;
    default:
      // Llave: cabeza redonda, caña y dos dientes.
      ctx.arc(0, -r * 0.48, r * 0.42, 0, Math.PI * 2);
      ctx.rect(-r * 0.13, -r * 0.1, r * 0.26, r * 1.05);
      ctx.rect(r * 0.13, r * 0.55, r * 0.32, r * 0.16);
      ctx.rect(r * 0.13, r * 0.78, r * 0.24, r * 0.16);
      ctx.fill();
      ctx.stroke();
  }
}

/**
 * Tablero pintado: la superficie con pinceladas suaves, una franja de adorno y una placa de
 * latón con el título arriba. El centro queda libre para lo que pone la máquina (los huecos
 * del mural de sellos). Las líneas van como rótulos repartidos abajo, una por columna.
 */
function tablero({ ctx, w, h, base, lamina, rnd }: Dibujo): void {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  // Pinceladas verticales, apenas visibles.
  for (let i = 0; i < Math.round(w / 14); i++) {
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.018)' : 'rgba(0,0,0,0.022)';
    ctx.fillRect(rnd() * w, 0, 4 + rnd() * 10, h);
  }
  const m = Math.min(w, h) * 0.05;
  ctx.strokeStyle = aclarar(base, 0.35);
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = Math.max(1, m * 0.18);
  caminoRedondeado(ctx, m, m, w - 2 * m, h - 2 * m, m * 0.6);
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (lamina.titulo) {
    const ph = h * 0.15;
    ctx.font = `700 ${Math.round(ph * 0.62)}px ${LETRA_TITULO}`;
    const pw = Math.min(w * 0.6, ctx.measureText(lamina.titulo).width + ph * 1.6);
    const px = (w - pw) / 2;
    const py = m * 1.6;
    rectRedondeado(ctx, px + 2, py + 3, pw, ph, ph * 0.18, 'rgba(0,0,0,0.25)');
    rectRedondeado(ctx, px, py, pw, ph, ph * 0.18, '#c9973f');
    rectRedondeado(
      ctx,
      px + ph * 0.08,
      py + ph * 0.08,
      pw - ph * 0.16,
      ph * 0.84,
      ph * 0.14,
      '#e0b25a',
    );
    ctx.fillStyle = '#8c6420';
    for (const x of [px + ph * 0.32, px + pw - ph * 0.32]) {
      ctx.beginPath();
      ctx.arc(x, py + ph / 2, ph * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
    textoAjustado(
      ctx,
      lamina.titulo,
      w / 2,
      py + ph * 0.53,
      pw - ph * 1.2,
      ph * 0.62,
      LETRA_TITULO,
      '#3b2a14',
    );
  }
  const rotulos = lamina.lineas ?? [];
  const tinta = tintaPara(base);
  rotulos.forEach((r, i) => {
    const ancho = (w - 2 * m) / rotulos.length;
    textoAjustado(
      ctx,
      r,
      m + ancho * (i + 0.5),
      h - m * 2.2,
      ancho * 0.9,
      h * 0.07,
      LETRA_RENGLON,
      tinta,
    );
  });
}

const TIPOS: Record<TipoLamina, (d: Dibujo) => void> = {
  pizarra,
  corcho,
  planilla,
  papel,
  cuadricula,
  marcador,
  cartel,
  tablero,
};

/**
 * Dibuja la lámina en un lienzo de `w` × `h` píxeles. `base` es el color de la superficie y
 * `semilla` fija el azar (notas, garabatos, polvo de tiza): la misma lámina sale igual siempre.
 */
export function dibujarLamina(
  ctx: Ctx,
  lamina: Lamina,
  w: number,
  h: number,
  base: string,
  semilla: number,
  marcas: MarcasLamina = {},
): void {
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  TIPOS[lamina.tipo]({ ctx, w, h, base, lamina, rnd: aleatorio(semilla), marcas });
  ctx.restore();
}

// ---------- En la escena ----------

interface LienzoConCtx {
  lienzo: HTMLCanvasElement | OffscreenCanvas;
  ctx: Ctx;
}

/** Un lienzo 2D, o `null` si no hay navegador (pruebas de unidad en Node). Lados de 1 a 1024. */
export function crearLienzo(ancho: number, alto: number): LienzoConCtx | null {
  const w = Math.max(1, Math.min(LADO_MAXIMO, Math.round(ancho)));
  const h = Math.max(1, Math.min(LADO_MAXIMO, Math.round(alto)));
  if (typeof document !== 'undefined') {
    const lienzo = document.createElement('canvas');
    lienzo.width = w;
    lienzo.height = h;
    const ctx = lienzo.getContext('2d');
    return ctx ? { lienzo, ctx } : null;
  }
  if (typeof OffscreenCanvas !== 'undefined') {
    const lienzo = new OffscreenCanvas(w, h);
    const ctx = lienzo.getContext('2d') as unknown as Ctx | null;
    return ctx ? { lienzo, ctx } : null;
  }
  return null;
}

/** `true` si las fuentes del tema ya están listas (o si no hay cómo saberlo). */
function fuentesListas(): boolean {
  if (typeof document === 'undefined' || !document.fonts) return true;
  return FUENTES.every((f) => document.fonts.check(f));
}

/**
 * Textura de un lienzo dibujado por `pintar`: sRGB, con mipmaps y filtrado anisótropo, para
 * que la letra se lea también de lado. Si las fuentes del tema llegan después, se vuelve a
 * pintar una vez. Los lados se limitan a 1024 px (presupuesto).
 *
 * Sin navegador (pruebas en Node) devuelve una textura vacía: así la malla queda aparte de lo
 * fijo igual que en el juego, y las pruebas cuentan las draw calls de verdad.
 */
export function texturaDibujada(
  ancho: number,
  alto: number,
  pintar: (ctx: Ctx, w: number, h: number) => void,
): TexturaLienzo {
  const w = Math.max(1, Math.min(LADO_MAXIMO, Math.round(ancho)));
  const h = Math.max(1, Math.min(LADO_MAXIMO, Math.round(alto)));
  const hecho = crearLienzo(w, h);
  if (!hecho) {
    const vacia = new Texture();
    vacia.name = 'lamina-sin-lienzo';
    return vacia;
  }
  pintar(hecho.ctx, w, h);
  const textura: TexturaLienzo = new CanvasTexture(hecho.lienzo);
  textura.userData[REPINTAR] = () => {
    pintar(hecho.ctx, w, h);
    textura.needsUpdate = true;
  };
  textura.colorSpace = SRGBColorSpace;
  textura.minFilter = LinearMipmapLinearFilter;
  textura.anisotropy = 4;
  textura.name = 'lamina';
  if (!fuentesListas()) {
    let viva = true;
    textura.addEventListener('dispose', () => {
      viva = false;
    });
    Promise.all(FUENTES.map((f) => document.fonts.load(f)))
      .then(() => {
        if (!viva) return;
        pintar(hecho.ctx, w, h);
        textura.needsUpdate = true;
      })
      .catch(() => undefined);
  }
  return textura;
}

/** La textura de la lámina de un objeto, o `null` si el objeto no tiene lámina. */
export function texturaLamina(o: ObjetoSala): TexturaLienzo | null {
  if (!o.lamina) return null;
  const lamina = o.lamina;
  const [ancho, alto] = medidasCara(o);
  const px = medidasLienzo(ancho, alto);
  const semilla = semillaDe(o.id);
  // Las marcas se leen en cada pintada: también cuando las fuentes llegan tarde.
  const marcas: MarcasLamina = {};
  const textura = texturaDibujada(px.ancho, px.alto, (ctx, w, h) =>
    dibujarLamina(ctx, lamina, w, h, o.color, semilla, marcas),
  );
  textura.userData[MARCAS] = marcas;
  return textura;
}

/**
 * Cambia las marcas de una lámina ya armada (el sello en un cartel) y, si cambiaron, la vuelve
 * a pintar en el mismo lienzo: la malla, el material y la draw call son los mismos. Devuelve si
 * cambió algo. Una textura que no es de lámina no cambia.
 */
export function marcarLamina(textura: Texture, nuevas: MarcasLamina): boolean {
  const marcas = textura.userData[MARCAS] as MarcasLamina | undefined;
  if (!marcas || marcas.sello === nuevas.sello) return false;
  if (nuevas.sello === undefined) delete marcas.sello;
  else marcas.sello = nuevas.sello;
  (textura.userData[REPINTAR] as (() => void) | undefined)?.();
  return true;
}

/** Las marcas que tiene ahora la textura de una lámina (para las pruebas y el motor). */
export function marcasDeLamina(textura: Texture): Readonly<MarcasLamina> | null {
  return (textura.userData[MARCAS] as MarcasLamina | undefined) ?? null;
}

/** Índice de la cara en `BoxGeometry` (+x, −x, +y, −y, +z, −z). */
const CARA_CAJA: Record<CaraLamina, number> = { arriba: 2, frente: 4 };

/**
 * UV de una caja para la lámina: la cara que la lleva ve el lienzo completo; las demás, el
 * píxel de la esquina de arriba a la izquierda (el borde del marco), así los cantos tienen el
 * color del marco sin otro material. Pensado para `BoxGeometry` de un segmento por lado.
 */
export function uvLamina(g: BufferGeometry, cara: CaraLamina): void {
  const uv = g.getAttribute('uv');
  const porCara = uv.count / 6;
  const dejar = CARA_CAJA[cara];
  for (let i = 0; i < uv.count; i++) {
    if (Math.floor(i / porCara) === dejar) continue;
    uv.setXY(i, 0.002, 0.998);
  }
  uv.needsUpdate = true;
}

/**
 * Cuánto más clara se ve cada lámina, para leerla en la penumbra de medianoche: multiplica la
 * textura (1 = como la pinta la luz de la sala).
 */
export const REALCE: Record<TipoLamina, number> = {
  pizarra: 1.15,
  corcho: 1.1,
  planilla: 1.1,
  papel: 1.1,
  cuadricula: 1.1,
  marcador: 1,
  cartel: 1.1,
  tablero: 1.1,
};

/** Luz propia de los dígitos del marcador (en espacio lineal): se ven aunque la sala esté oscura. */
export const LUZ_MARCADOR = 0.45;

/**
 * El material de una lámina: la textura, un poco realzada. El marcador brilla solo, con su
 * propia textura como mapa de emisión: sus dígitos ámbar se encienden y la carcasa oscura casi
 * no. El resaltado (T18) suma su brillo al `emissive` y lo devuelve a este valor al soltar.
 */
export function materialLamina(tipo: TipoLamina, textura: TexturaLienzo): MeshLambertMaterial {
  const material = new MeshLambertMaterial({ map: textura });
  material.color.setScalar(REALCE[tipo]);
  if (tipo === 'marcador') {
    material.emissiveMap = textura;
    material.emissive.setScalar(LUZ_MARCADOR);
  }
  return material;
}
