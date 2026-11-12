import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { panel, reiniciarInterfaz } from '../../src/signals/interfaz';
import {
  DURACION_MS,
  fase,
  final,
  modo,
  reiniciarPartida,
  reloj,
  restanteEn,
} from '../../src/signals/partida';
import { iniciarControladorProvisional } from '../../src/signals/provisional';
import { enviar } from '../../src/signals/puente';

let detener: () => void;
let ahora = 0;

beforeEach(() => {
  ahora = 1_000;
  vi.spyOn(performance, 'now').mockImplementation(() => ahora);
  detener = iniciarControladorProvisional();
});

afterEach(() => {
  detener();
  vi.restoreAllMocks();
  reiniciarPartida();
  reiniciarInterfaz();
});

describe('controlador provisional', () => {
  it('«iniciar» en individual pone a correr los 40 minutos', () => {
    panel.value = 'cuaderno';
    enviar({ t: 'iniciar', modo: 'individual' });
    expect(fase.value).toBe('jugando');
    expect(modo.value).toBe('individual');
    expect(panel.value).toBeNull();
    ahora = 61_000;
    expect(restanteEn(reloj.value, ahora)).toBe(DURACION_MS - 60_000);
  });

  it('ignora el cooperativo, que aún no existe', () => {
    enviar({ t: 'iniciar', modo: 'cooperativo' });
    expect(fase.value).toBe('inicio');
  });

  it('pausar congela el reloj y reanudar sigue desde ahí', () => {
    enviar({ t: 'iniciar', modo: 'individual' });
    ahora = 11_000;
    enviar({ t: 'pausar' });
    ahora = 500_000;
    expect(restanteEn(reloj.value, ahora)).toBe(DURACION_MS - 10_000);
    enviar({ t: 'reanudar' });
    ahora = 505_000;
    expect(restanteEn(reloj.value, ahora)).toBe(DURACION_MS - 15_000);
  });

  it('elegir un final detiene el reloj y pasa a la pantalla de final', () => {
    enviar({ t: 'iniciar', modo: 'individual' });
    enviar({ t: 'elegir_final', final: 'pedir_ayuda' });
    expect(fase.value).toBe('final');
    expect(final.value).toBe('pedir_ayuda');
    expect(reloj.value.pausado).toBe(true);
  });

  it('«salir» vuelve al menú de inicio', () => {
    enviar({ t: 'iniciar', modo: 'individual' });
    enviar({ t: 'salir' });
    expect(fase.value).toBe('inicio');
    expect(modo.value).toBeNull();
  });
});
