import { useEffect, useRef, useState } from 'preact/hooks';
import { tieneWebGL2 } from '../engine/compatibilidad';
import { ajustarCanvas } from '../engine/pantalla';
import { pantalla } from '../signals/pantalla';
import { pruebaCarga } from '../signals/prueba-carga';
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
 * `/jugar?prueba=glb` carga el GLB de prueba con meshopt y KTX2 (T10).
 * El parámetro viene de la URL: solo se acepta el valor exacto `glb`.
 */
const esPruebaGlb = (): boolean =>
  new URLSearchParams(window.location.search).get('prueba') === 'glb';

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
 * Con `?prueba=glb`, en lugar del patrón se carga el GLB de prueba (T10).
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

  const [pruebaGlb] = useState(esPruebaGlb);

  useEffect(() => {
    const canvas = canvasRef.current;
    const hud = hudRef.current;
    if (!canvas || !hud) return;
    const detenerAjuste = ajustarCanvas(canvas, () => {
      // En la prueba de carga, Three.js dibuja el canvas en cada cuadro.
      if (!pruebaGlb) dibujarPrueba(canvas);
      const estilo = getComputedStyle(hud);
      setMargenes({
        arriba: parseFloat(estilo.paddingTop),
        derecha: parseFloat(estilo.paddingRight),
        abajo: parseFloat(estilo.paddingBottom),
        izquierda: parseFloat(estilo.paddingLeft),
      });
    });

    // Three.js se descarga solo en la prueba: import dinámico, en su propio archivo.
    let detenerPrueba: (() => void) | undefined;
    let cancelado = false;
    if (pruebaGlb) {
      void import('../engine/carga/prueba').then(({ iniciarPruebaCarga }) => {
        if (!cancelado) detenerPrueba = iniciarPruebaCarga(canvas);
      });
    }
    return () => {
      cancelado = true;
      detenerPrueba?.();
      detenerAjuste();
    };
  }, [pruebaGlb]);

  const p = pantalla.value;
  const carga = pruebaCarga.value;

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
          {pruebaGlb && (
            <p class="hud-info" role="status">
              {carga.estado === 'lista' && (
                <>
                  Modelo de prueba listo en {carga.ms} ms · {carga.triangulos} triángulos ·{' '}
                  {carga.drawCalls} {carga.drawCalls === 1 ? 'draw call' : 'draw calls'}
                  <br />
                  Texturas: {carga.texturas.join(', ')}
                </>
              )}
              {carga.estado === 'error' && 'No se pudo cargar el modelo de prueba.'}
              {(carga.estado === 'cargando' || carga.estado === 'inactiva') &&
                'Cargando modelo de prueba…'}
            </p>
          )}
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
