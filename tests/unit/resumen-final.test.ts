import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PUZZLES } from '../../src/content/puzzles';
import { nombreDeObjeto } from '../../src/content/salas';
import { iniciarControlador, OBJETO_INTERCOMUNICADOR } from '../../src/signals/controlador';
import { reiniciarCuaderno } from '../../src/signals/cuaderno';
import { fichas } from '../../src/signals/contenido';
import { enfocado, reiniciarInterfaz } from '../../src/signals/interfaz';
import { reiniciarMecanismo } from '../../src/signals/mecanismo';
import { aprendizaje, reiniciarPartida } from '../../src/signals/partida';
import { enviar } from '../../src/signals/puente';
import {
  FINALES_TEXTO,
  textoResultadoSala,
  textoTotalAprendizaje,
} from '../../src/ui/finales/textos';

// Punto 15 del hito 1: el resumen de aprendizaje en la pantalla de final.

describe('textos del resumen de aprendizaje', () => {
  it('dice cómo terminó cada sala, en texto', () => {
    expect(textoResultadoSala('sin_resolver', 0)).toBe('Sin resolver');
    expect(textoResultadoSala('sin_pistas', 0)).toBe('Resuelta sin pistas');
    expect(textoResultadoSala('con_pistas', 1)).toBe('Resuelta con 1 pista');
    expect(textoResultadoSala('con_pistas', 3)).toBe('Resuelta con 3 pistas');
  });

  it('resume cuántas salas se resolvieron y cuántas sin pistas', () => {
    expect(textoTotalAprendizaje(0, 0)).toBe('Esta vez no alcanzaste a resolver ninguna sala.');
    expect(textoTotalAprendizaje(1, 1)).toBe('Resolviste 1 de 5 salas, sin pistas.');
    expect(textoTotalAprendizaje(5, 5)).toBe('Resolviste 5 de 5 salas, todas sin pistas.');
    expect(textoTotalAprendizaje(4, 2)).toBe('Resolviste 4 de 5 salas, 2 sin pistas.');
    expect(textoTotalAprendizaje(3, 0)).toBe('Resolviste 3 de 5 salas.');
  });

  it('ningún final promete un modo práctica que no existe', () => {
    for (const t of Object.values(FINALES_TEXTO)) {
      expect(t.parrafos.join(' ')).not.toMatch(/práctica/i);
    }
  });
});

describe('controlador: el resumen al llegar a un final', () => {
  let detener: () => void;
  let ahora = 0;
  const s1 = PUZZLES[0];
  if (!s1) throw new Error('falta el puzzle de la sala 1');

  const usar = (objeto: string): void => {
    enfocado.value = { id: objeto, nombre: nombreDeObjeto(objeto) ?? objeto, accion: 'usar' };
    enviar({ t: 'accion', objeto, accion: 'usar' });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    ahora = 1_000;
    vi.spyOn(performance, 'now').mockImplementation(() => ahora);
    detener = iniciarControlador({ documento: null, almacen: null });
  });

  afterEach(() => {
    detener();
    vi.useRealTimers();
    vi.restoreAllMocks();
    reiniciarPartida();
    reiniciarInterfaz();
    reiniciarCuaderno();
    reiniciarMecanismo();
    fichas.value = {};
  });

  it('mientras se juega no hay resumen; al pedir ayuda, las cinco salas con lo hecho', () => {
    enviar({ t: 'iniciar', modo: 'individual' });
    expect(aprendizaje.value).toBeNull();

    // Sala 1: tres intentos fallidos, abre la pista que se ofrece y la resuelve.
    usar('porteria-puerta-1');
    const regla = s1.etapas[0]?.intento;
    if (regla?.tipo !== 'accionar') throw new Error('la etapa 1 de la sala 1 se acciona');
    for (let i = 0; i < 3; i++) enviar({ t: 'accionar', objeto: regla.objeto });
    enviar({ t: 'ver_pista' });
    for (const e of s1.etapas) {
      enviar({ t: 'ajustar', estado: e.solucion });
      if (e.intento.tipo === 'accionar') enviar({ t: 'accionar', objeto: e.intento.objeto });
    }
    usar('s1-puerta');
    usar(OBJETO_INTERCOMUNICADOR);
    enviar({ t: 'pedir_ayuda' });

    const r = aprendizaje.value;
    expect(r?.resueltas).toBe(1);
    expect(r?.salas.map((s) => s.resultado)).toEqual([
      'con_pistas',
      'sin_resolver',
      'sin_resolver',
      'sin_resolver',
      'sin_resolver',
    ]);
    expect(r?.salas[0]?.pistasVistas).toBe(1);
  });

  it('al salir al menú se borra', () => {
    enviar({ t: 'iniciar', modo: 'individual' });
    enviar({ t: 'pedir_ayuda' });
    expect(aprendizaje.value?.resueltas).toBe(0);
    enviar({ t: 'salir' });
    expect(aprendizaje.value).toBeNull();
  });
});
