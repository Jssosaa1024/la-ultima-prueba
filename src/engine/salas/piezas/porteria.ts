/**
 * Piezas por código de la portería (pulir las salas, sesión C): el reloj de pared, la
 * linterna, el cuaderno y el intercomunicador de emergencia. Cada una cabe en el `tam` de su
 * objeto de `salas.json` y es una sola malla.
 */
import { CircleGeometry, PlaneGeometry, TorusGeometry } from 'three';
import type { ObjetoSala } from '../../../content/esquema-salas';
import { LETRA_RENGLON, LETRA_TITULO, garabatos, aleatorio } from '../laminas';
import { cajaBiselada, cilindro, enRegion, parte, unirPartes } from './comunes';
import type { ConstructorPieza, Parte, Pieza } from './comunes';

/** Paleta: colores planos como los de KayKit y Kenney. */
export const PALETA = {
  metalOscuro: '#2b2f36',
  metal: '#5d6670',
  metalClaro: '#b8c0c6',
  laton: '#d4a24c',
  rojo: '#c0392b',
  rojoOscuro: '#922b21',
  amarillo: '#f1c40f',
  crema: '#f3ead7',
  blanco: '#f7f5ef',
  azul: '#1f618d',
  azulOscuro: '#173f5f',
  verde: '#2ecc71',
  vidrio: '#fff6c4',
} as const;

type Ctx = CanvasRenderingContext2D;

/** Una parte que usa el lienzo de la pieza en `region` (ver `enRegion`). */
function conDibujo(p: Parte, region: readonly [number, number, number, number]): Parte {
  enRegion(p.g, region);
  return { ...p, conDibujo: true };
}

// ---------- Reloj de pared ----------

/** La hora del reloj: las 11:59 (la historia pasa a las 23:59). En grados desde las 12. */
export const HORA_RELOJ = { horario: (11 + 59 / 60) * 30, minutero: 59 * 6 };

/** La esfera: números, rayitas y la etiqueta de mantenimiento de la ficha 2D. */
function esferaReloj(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) / 2;
  ctx.fillStyle = PALETA.blanco;
  ctx.fillRect(0, 0, w, h);
  // Rayitas: 60 cortas y 12 largas.
  ctx.strokeStyle = '#2b2f36';
  ctx.lineCap = 'butt';
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const larga = i % 5 === 0;
    ctx.lineWidth = larga ? r * 0.035 : r * 0.012;
    const desde = r * (larga ? 0.8 : 0.86);
    ctx.beginPath();
    ctx.moveTo(cx + Math.sin(a) * desde, cy - Math.cos(a) * desde);
    ctx.lineTo(cx + Math.sin(a) * r * 0.93, cy - Math.cos(a) * r * 0.93);
    ctx.stroke();
  }
  ctx.fillStyle = '#1d1a16';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(r * 0.2)}px ${LETRA_TITULO}`;
  for (let n = 1; n <= 12; n++) {
    const a = (n / 12) * Math.PI * 2;
    ctx.fillText(String(n), cx + Math.sin(a) * r * 0.63, cy - Math.cos(a) * r * 0.63 + r * 0.01);
  }
  // La etiqueta amarilla de mantenimiento (se lee en la vista 2D).
  ctx.save();
  ctx.translate(cx + r * 0.05, cy + r * 0.36);
  ctx.rotate(-0.12);
  ctx.fillStyle = '#ffe066';
  ctx.fillRect(-r * 0.2, -r * 0.07, r * 0.4, r * 0.14);
  garabatos(ctx, aleatorio(12), -r * 0.16, -r * 0.02, r * 0.32, r * 0.05, 2, 'rgba(60,50,20,0.7)');
  ctx.restore();
}

/** Una manecilla que sale del centro hacia las 12 y gira `grados` en el sentido del reloj. */
function manecilla(
  largo: number,
  ancho: number,
  grados: number,
  centro: readonly [number, number, number],
  color: string,
): Parte {
  const g = cajaBiselada(ancho, largo, ancho * 0.4, ancho * 0.15).translate(0, largo * 0.38, 0);
  return parte(g, color, centro, [0, 0, -grados]);
}

const reloj: ConstructorPieza = (o: ObjetoSala): Pieza => {
  const [ancho, alto] = o.tam;
  const r = Math.min(ancho, alto) / 2;
  const cy = r;
  const partes: Parte[] = [
    // Caja de atrás, contra la pared.
    parte(cilindro(r * 0.97, r * 0.97, 0.024, 24), PALETA.metalOscuro, [0, cy, -0.003], [90, 0, 0]),
    // Aro biselado y la esfera, un poco hundida.
    parte(new TorusGeometry(r * 0.9, r * 0.075, 6, 28), PALETA.metalOscuro, [0, cy, 0.009]),
    conDibujo(
      parte(new CircleGeometry(r * 0.86, 32), PALETA.blanco, [0, cy, 0.0095]),
      [0, 0, 1, 1],
    ),
    manecilla(r * 0.5, r * 0.07, HORA_RELOJ.horario, [0, cy, 0.013], PALETA.metalOscuro),
    manecilla(r * 0.76, r * 0.05, HORA_RELOJ.minutero, [0, cy, 0.016], PALETA.metalOscuro),
    manecilla(r * 0.8, r * 0.018, 210, [0, cy, 0.018], PALETA.rojo),
    parte(cilindro(r * 0.06, r * 0.06, 0.012, 12), PALETA.rojo, [0, cy, 0.018], [90, 0, 0]),
  ];
  return {
    geometria: unirPartes(partes),
    dibujo: { ancho: 256, alto: 256, pintar: esferaReloj },
  };
};

// ---------- Linterna ----------

const linterna: ConstructorPieza = (o: ObjetoSala): Pieza => {
  const [diametro, alto] = o.tam;
  const r = diametro / 2;
  const cuerpo = r * 0.74;
  const largoCabeza = alto * 0.24;
  const largoCuerpo = alto - largoCabeza - alto * 0.06;
  const partes: Parte[] = [
    // Tapa de atrás, el cuerpo amarillo con tres anillos de agarre y el botón.
    parte(cilindro(cuerpo * 1.05, cuerpo * 1.05, alto * 0.06, 12), PALETA.metalOscuro, [
      0,
      alto * 0.03,
      0,
    ]),
    parte(cilindro(cuerpo, cuerpo, largoCuerpo, 12), PALETA.amarillo, [
      0,
      alto * 0.06 + largoCuerpo / 2,
      0,
    ]),
    ...[0.25, 0.4, 0.55].map((f) =>
      parte(cilindro(cuerpo * 1.06, cuerpo * 1.06, alto * 0.025, 12), PALETA.metalOscuro, [
        0,
        alto * 0.06 + largoCuerpo * f,
        0,
      ]),
    ),
    parte(cajaBiselada(cuerpo * 0.7, alto * 0.08, cuerpo * 0.5), PALETA.rojo, [
      0,
      alto * 0.06 + largoCuerpo * 0.8,
      cuerpo * 0.92,
    ]),
    // Cabeza que se abre hacia el vidrio, con su aro.
    parte(cilindro(r * 0.98, cuerpo, largoCabeza, 14), PALETA.metalOscuro, [
      0,
      alto - largoCabeza / 2,
      0,
    ]),
    parte(
      new TorusGeometry(r * 0.86, r * 0.1, 4, 14),
      PALETA.metal,
      [0, alto - r * 0.1, 0],
      [90, 0, 0],
    ),
    parte(cilindro(r * 0.84, r * 0.84, alto * 0.012, 14), PALETA.vidrio, [
      0,
      alto - alto * 0.012,
      0,
    ]),
  ];
  return { geometria: unirPartes(partes) };
};

// ---------- Cuaderno ----------

function etiquetaCuaderno(ctx: Ctx, w: number, h: number): void {
  const alto = h * 0.84;
  ctx.fillStyle = PALETA.blanco;
  ctx.fillRect(0, 0, w, alto);
  ctx.strokeStyle = PALETA.rojo;
  ctx.lineWidth = h * 0.04;
  ctx.strokeRect(h * 0.05, h * 0.05, w - h * 0.1, alto - h * 0.1);
  ctx.fillStyle = PALETA.rojoOscuro;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(alto * 0.36)}px ${LETRA_TITULO}`;
  ctx.fillText('CUADERNO', w / 2, alto * 0.38);
  ctx.strokeStyle = 'rgba(146,43,33,0.5)';
  ctx.lineWidth = Math.max(1, h * 0.02);
  ctx.beginPath();
  ctx.moveTo(w * 0.15, alto * 0.75);
  ctx.lineTo(w * 0.85, alto * 0.75);
  ctx.stroke();
  ctx.font = `700 ${Math.round(alto * 0.16)}px ${LETRA_RENGLON}`;
  ctx.fillStyle = 'rgba(120,30,25,0.85)';
  ctx.fillText('Nombre:', w * 0.27, alto * 0.64);
}

const cuaderno: ConstructorPieza = (o: ObjetoSala): Pieza => {
  const [ancho, alto, fondo] = o.tam;
  const tapa = alto * 0.2;
  const espiral = Math.min(0.012, ancho * 0.06);
  const x0 = -ancho / 2 + espiral; // borde del lomo
  const anchoTapa = ancho - espiral;
  const cx = x0 + anchoTapa / 2;
  const partes: Parte[] = [
    parte(cajaBiselada(anchoTapa, tapa, fondo, tapa * 0.4), PALETA.rojo, [cx, tapa / 2, 0]),
    parte(
      cajaBiselada(anchoTapa * 0.96, alto - 2 * tapa - 0.002, fondo * 0.96, 0.002),
      PALETA.crema,
      [cx + anchoTapa * 0.015, alto / 2, 0],
    ),
    parte(cajaBiselada(anchoTapa, tapa, fondo, tapa * 0.4), PALETA.rojo, [
      cx,
      alto - tapa / 2 - 0.001,
      0,
    ]),
  ];
  // El espiral: anillos que abrazan el lomo.
  const anillos = Math.max(6, Math.round(fondo / 0.022));
  for (let i = 0; i < anillos; i++) {
    const z = -fondo / 2 + fondo * ((i + 0.5) / anillos);
    partes.push(
      parte(new TorusGeometry(alto * 0.42, espiral * 0.16, 4, 8), PALETA.metalClaro, [
        x0 + espiral * 0.15,
        alto / 2,
        z,
      ]),
    );
  }
  // La etiqueta en la tapa: mira hacia arriba, con su borde de arriba hacia −z.
  const etiqueta = new PlaneGeometry(anchoTapa * 0.62, fondo * 0.22);
  partes.push(
    conDibujo(
      parte(
        etiqueta,
        PALETA.blanco,
        [cx + anchoTapa * 0.04, alto + 0.0005, fondo * 0.05],
        [-90, 0, 0],
      ),
      [0, 0, 1, 0.84],
    ),
  );
  return {
    geometria: unirPartes(partes),
    dibujo: { ancho: 256, alto: 108, pintar: etiquetaCuaderno },
  };
};

// ---------- Intercomunicador de emergencia ----------

function placaIntercomunicador(ctx: Ctx, w: number, h: number): void {
  // La placa ocupa el lienzo menos la franja de la derecha (ver la región de la parte).
  const pw = w * 0.92;
  const g = ctx.createLinearGradient(0, 0, pw, h);
  g.addColorStop(0, '#dfe4e8');
  g.addColorStop(1, '#aab3ba');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, pw, h);
  ctx.strokeStyle = '#7f8a91';
  ctx.lineWidth = w * 0.02;
  ctx.strokeRect(w * 0.01, w * 0.01, pw - w * 0.02, h - w * 0.02);
  // Tornillos.
  for (const [x, y] of [
    [0.07, 0.05],
    [0.86, 0.05],
    [0.07, 0.95],
    [0.86, 0.95],
  ] as const) {
    ctx.fillStyle = '#6c757d';
    ctx.beginPath();
    ctx.arc(pw * x, h * y, w * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
  // Rótulo rojo.
  ctx.fillStyle = PALETA.rojo;
  ctx.fillRect(pw * 0.1, h * 0.08, pw * 0.8, h * 0.13);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let tam = Math.round(h * 0.085);
  ctx.font = `700 ${tam}px ${LETRA_TITULO}`;
  while (tam > 8 && ctx.measureText('EMERGENCIA').width > pw * 0.74) {
    tam -= 1;
    ctx.font = `700 ${tam}px ${LETRA_TITULO}`;
  }
  ctx.fillText('EMERGENCIA', pw / 2, h * 0.145);
  // Rejilla del parlante: huecos en filas.
  ctx.fillStyle = '#2b2f36';
  const filas = 6;
  const columnas = 7;
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      const x = pw * (0.2 + (0.6 * c) / (columnas - 1));
      const y = h * (0.3 + (0.25 * f) / (filas - 1));
      ctx.beginPath();
      ctx.arc(x, y, w * 0.022, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Texto bajo el botón.
  ctx.fillStyle = '#2b2f36';
  ctx.font = `700 ${Math.round(h * 0.05)}px ${LETRA_RENGLON}`;
  ctx.fillText('OPRIMA Y HABLE', pw / 2, h * 0.9);
}

const intercomunicador: ConstructorPieza = (o: ObjetoSala): Pieza => {
  const [ancho, alto] = o.tam;
  const fondo = 0.05;
  const placaW = ancho * 0.8;
  const placaH = alto * 0.82;
  const yPlaca = alto * 0.5;
  const yBoton = yPlaca - placaH / 2 + placaH * 0.26;
  const partes: Parte[] = [
    parte(cajaBiselada(ancho, alto, fondo, 0.012), PALETA.rojo, [0, alto / 2, 0]),
    conDibujo(
      parte(new PlaneGeometry(placaW, placaH), PALETA.blanco, [0, yPlaca, fondo / 2 + 0.0008]),
      [0, 0, 0.92, 1],
    ),
    // El botón grande, con su aro, y la luz que dice que hay línea.
    parte(
      cilindro(ancho * 0.16, ancho * 0.16, 0.012, 16),
      PALETA.metalOscuro,
      [0, yBoton, fondo / 2 + 0.006],
      [90, 0, 0],
    ),
    parte(
      cilindro(ancho * 0.11, ancho * 0.12, 0.016, 16),
      PALETA.amarillo,
      [0, yBoton, fondo / 2 + 0.014],
      [90, 0, 0],
    ),
    parte(
      cilindro(ancho * 0.03, ancho * 0.03, 0.01, 8),
      PALETA.verde,
      [placaW * 0.36, yPlaca + placaH * 0.42, fondo / 2 + 0.005],
      [90, 0, 0],
    ),
  ];
  return {
    geometria: unirPartes(partes),
    dibujo: { ancho: 280, alto: 320, pintar: placaIntercomunicador },
  };
};

export const PIEZAS_PORTERIA: Readonly<Record<string, ConstructorPieza>> = {
  'reloj-pared': reloj,
  linterna,
  cuaderno,
  intercomunicador,
};
