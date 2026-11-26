import { afterEach, describe, expect, it } from 'vitest';
import { cerrarPanel, franja, panel, panelRecogido } from '../../src/signals/interfaz';
import { msRecogido } from '../../src/ui/mecanismos/marco/recoger';

// Correcciones del 25 nov (sesión C): el panel de la máquina en franja.

describe('panel en franja: cuánto se queda recogido al accionar', () => {
  it('cada máquina espera lo que dura su animación 3D, y un poco más con el sello', () => {
    expect(msRecogido('etiquetadora', false)).toBe(1300);
    expect(msRecogido('etiquetadora', true)).toBe(1900);
    expect(msRecogido('reflector', false)).toBe(2500);
    expect(msRecogido('urna', false)).toBe(2800);
  });

  it('los tanques no tienen tiempo fijo: su panel avisa mientras corre', () => {
    expect(msRecogido('tanques', false)).toBe(0);
    expect(msRecogido('tanques', true)).toBe(0);
  });

  it('los carritos responden en vivo: nunca se recogen solos', () => {
    expect(msRecogido('carritos', false)).toBe(0);
  });
});

describe('panel en franja: signals que lee el motor', () => {
  afterEach(() => cerrarPanel());

  it('al cerrar el panel, la franja vuelve a 0 y deja de estar recogido', () => {
    panel.value = 'mecanismo';
    franja.value = { derecha: 0.35 };
    panelRecogido.value = true;
    cerrarPanel();
    expect(panel.value).toBeNull();
    expect(franja.value).toEqual({ derecha: 0 });
    expect(panelRecogido.value).toBe(false);
  });
});
