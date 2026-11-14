import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { iniciarControlador } from '../../src/signals/controlador';
import { finalPedido, quitarEjemplo } from '../../src/signals/ejemplo';
import { reiniciarInterfaz } from '../../src/signals/interfaz';
import { DURACION_MS, FINALES, fase, final, reiniciarPartida } from '../../src/signals/partida';
import { enviar } from '../../src/signals/puente';
import { FINALES_TEXTO } from '../../src/ui/finales/textos';

describe('fin del reloj', () => {
  let detener: () => void;
  let ahora = 0;

  beforeEach(() => {
    vi.useFakeTimers();
    ahora = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => ahora);
    detener = iniciarControlador({ documento: null });
  });

  afterEach(() => {
    detener();
    vi.useRealTimers();
    vi.restoreAllMocks();
    quitarEjemplo();
    reiniciarPartida();
    reiniciarInterfaz();
  });

  const avanzar = (ms: number): void => {
    ahora += ms;
    vi.advanceTimersByTime(ms);
  };

  it('a los 40 minutos termina en «Tiempo cumplido»', () => {
    enviar({ t: 'iniciar', modo: 'individual' });
    avanzar(DURACION_MS - 1);
    expect(fase.value).toBe('jugando');
    avanzar(1);
    expect(fase.value).toBe('final');
    expect(final.value).toBe('tiempo_cumplido');
  });

  it('el tiempo en pausa no cuenta', () => {
    enviar({ t: 'iniciar', modo: 'individual' });
    avanzar(10_000);
    enviar({ t: 'pausar' });
    avanzar(DURACION_MS);
    expect(fase.value).toBe('jugando');
    enviar({ t: 'reanudar' });
    avanzar(DURACION_MS - 10_000);
    expect(final.value).toBe('tiempo_cumplido');
  });

  it('al salir antes de tiempo no aparece ningún final', () => {
    enviar({ t: 'iniciar', modo: 'individual' });
    enviar({ t: 'salir' });
    avanzar(DURACION_MS * 2);
    expect(fase.value).toBe('inicio');
    expect(final.value).toBeNull();
  });
});

describe('finalPedido', () => {
  it('acepta solo ids de la lista de finales', () => {
    expect(finalPedido('?ejemplo=1&final=el_legado')).toBe('el_legado');
    expect(finalPedido('?final=<script>')).toBeNull();
    expect(finalPedido('?final=')).toBeNull();
    expect(finalPedido('')).toBeNull();
  });
});

describe('textos de los finales', () => {
  it('cada final tiene título y texto', () => {
    for (const f of FINALES) {
      expect(FINALES_TEXTO[f].titulo.length).toBeGreaterThan(0);
      expect(FINALES_TEXTO[f].parrafos.length).toBeGreaterThan(0);
    }
  });
});
