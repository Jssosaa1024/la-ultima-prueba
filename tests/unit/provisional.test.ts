import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cargarEjemplo, quitarEjemplo } from '../../src/signals/ejemplo';
import { enfocado, inspeccionando, panel, reiniciarInterfaz } from '../../src/signals/interfaz';
import {
  DURACION_MS,
  fase,
  final,
  inventario,
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
  quitarEjemplo();
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

  it('empieza con la linterna en el inventario', () => {
    enviar({ t: 'iniciar', modo: 'individual' });
    expect(inventario.value.map((o) => o.id)).toEqual(['linterna']);
  });

  it('con datos de ejemplo, examinar abre la inspección y recoger guarda el objeto', () => {
    enviar({ t: 'iniciar', modo: 'individual' });
    cargarEjemplo();
    expect(enfocado.value?.id).toBe('s1-factura');
    enviar({ t: 'accion', objeto: 's1-factura', accion: 'examinar' });
    expect(panel.value).toBe('inspeccion');
    expect(inspeccionando.value).toBe('s1-factura');
    expect(enfocado.value?.id).toBe('s1-menu');
    enviar({ t: 'accion', objeto: 's1-menu', accion: 'examinar' });
    enviar({ t: 'accion', objeto: 's1-tarjeta', accion: 'recoger' });
    expect(inventario.value.map((o) => o.id)).toEqual(['linterna', 's1-tarjeta']);
  });

  it('ignora la acción si el objeto no es el enfocado', () => {
    enviar({ t: 'iniciar', modo: 'individual' });
    enviar({ t: 'accion', objeto: 's1-factura', accion: 'examinar' });
    expect(panel.value).toBeNull();
  });
});
