import { useEffect, useRef, useState } from 'preact/hooks';
import { tieneWebGL2 } from '../engine/compatibilidad';
import { ajustarCanvas } from '../engine/pantalla';
import { pantalla } from '../signals/pantalla';
import NoCompatible from './NoCompatible';
import './IslaJuego.css';

interface Margenes {
  arriba: number;
  derecha: number;
  abajo: number;
  izquierda: number;
}

const nf = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

/**
 * Isla del juego (client:only). Primero comprueba WebGL2 (T04): sin él, muestra el aviso
 * de equipo no compatible y no arranca la escena.
 */
export default function IslaJuego() {
  const [compatible] = useState(tieneWebGL2);
  return compatible ? <Escena /> : <NoCompatible />;
}

/**
 * Por ahora: canvas a pantalla completa con un patrón de prueba y un HUD que respeta la
 * zona segura. El renderer de Three.js llega en T12 y reemplaza `dibujarPrueba`.
 */
function Escena() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const [margenes, setMargenes] = useState<Margenes>({
    arriba: 0,
    derecha: 0,
    abajo: 0,
    izquierda: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const hud = hudRef.current;
    if (!canvas || !hud) return;
    return ajustarCanvas(canvas, () => {
      dibujarPrueba(canvas);
      const estilo = getComputedStyle(hud);
      setMargenes({
        arriba: parseFloat(estilo.paddingTop),
        derecha: parseFloat(estilo.paddingRight),
        abajo: parseFloat(estilo.paddingBottom),
        izquierda: parseFloat(estilo.paddingLeft),
      });
    });
  }, []);

  const p = pantalla.value;

  return (
    <div class="juego">
      <canvas ref={canvasRef} class="juego-canvas" aria-label="Escena del juego" />
      <div ref={hudRef} class="hud">
        <div class="zona-segura">
          <a class="hud-boton" href="/">
            Salir
          </a>
          <p class="hud-info">
            {p.ancho} × {p.alto} px · DPR {nf.format(p.dprEquipo)} → {nf.format(p.dprUsado)}
            <br />
            Zona segura: ↑{margenes.arriba} →{margenes.derecha} ↓{margenes.abajo} ←
            {margenes.izquierda}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Patrón temporal: cuadrícula cada 50 px CSS y borde, para comprobar tamaño y nitidez. */
function dibujarPrueba(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const escala = canvas.width / Math.max(1, canvas.clientWidth);
  const { width: w, height: h } = canvas;
  ctx.fillStyle = '#111418';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#2a3340';
  ctx.lineWidth = 1;
  const paso = 50 * escala;
  ctx.beginPath();
  for (let x = paso; x < w; x += paso) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, h);
  }
  for (let y = paso; y < h; y += paso) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(w, Math.round(y) + 0.5);
  }
  ctx.stroke();
  // Borde del canvas: debe tocar los cuatro bordes de la pantalla, incluso bajo el notch.
  ctx.strokeStyle = '#e8a33d';
  ctx.lineWidth = 4 * escala;
  ctx.strokeRect(0, 0, w, h);
}
