import { afterEach, describe, expect, it } from 'vitest';
import {
  AJUSTES_INICIALES,
  ajustes,
  BRILLOS,
  cambiarAjustes,
  cargarAjustes,
  CLAVE_AJUSTES,
  guardarAjustes,
  leerAjustes,
  validarAjustes,
} from '../../src/signals/ajustes';

/** `localStorage` de mentira, en memoria. */
function almacen(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    datos,
    getItem: (c: string) => datos.get(c) ?? null,
    setItem: (c: string, v: string) => void datos.set(c, v),
    removeItem: (c: string) => void datos.delete(c),
  };
}

afterEach(() => {
  ajustes.value = { ...AJUSTES_INICIALES };
});

describe('validarAjustes (T39)', () => {
  it('acepta unos ajustes válidos tal cual', () => {
    const a = {
      sensibilidad: 1.5,
      zurdo: true,
      texto: 'muy-grande',
      volumenVoz: 40,
      volumenAmbiente: 0,
      brillo: 1.2,
    };
    expect(validarAjustes(a)).toEqual(a);
  });

  it('cada campo inválido vuelve a su valor inicial sin tocar los demás', () => {
    const a = validarAjustes({
      sensibilidad: 1.3,
      zurdo: 'sí',
      texto: '<b>enorme</b>',
      volumenVoz: 45,
      volumenAmbiente: 30,
    });
    expect(a).toEqual({ ...AJUSTES_INICIALES, volumenAmbiente: 30 });
  });

  it('rechaza volúmenes fuera de 0 a 100, decimales y textos', () => {
    for (const v of [-10, 110, 50.5, '50', null, Number.NaN, Infinity]) {
      expect(validarAjustes({ volumenVoz: v }).volumenVoz).toBe(AJUSTES_INICIALES.volumenVoz);
    }
  });

  it('el brillo (T19k) solo toma uno de sus tres pasos', () => {
    for (const b of BRILLOS) expect(validarAjustes({ brillo: b }).brillo).toBe(b);
    for (const b of [0, 0.5, 1.1, 2, '1', null, Number.NaN]) {
      expect(validarAjustes({ brillo: b }).brillo).toBe(1);
    }
  });

  it('con algo que no es un objeto, devuelve los iniciales', () => {
    for (const d of [null, undefined, 3, 'hola', [1, 2], true]) {
      expect(validarAjustes(d)).toEqual(AJUSTES_INICIALES);
    }
  });

  it('ignora los campos de más', () => {
    expect(validarAjustes({ extra: 'x', __proto__: { zurdo: true } })).toEqual(AJUSTES_INICIALES);
  });
});

describe('leer y guardar los ajustes', () => {
  it('sin nada guardado, o sin almacén, son los iniciales', () => {
    expect(leerAjustes(almacen())).toEqual(AJUSTES_INICIALES);
    expect(leerAjustes(null)).toEqual(AJUSTES_INICIALES);
  });

  it('con JSON roto o demasiado largo, son los iniciales', () => {
    expect(leerAjustes(almacen({ [CLAVE_AJUSTES]: '{zurdo:true' }))).toEqual(AJUSTES_INICIALES);
    const largo = JSON.stringify({ zurdo: true, relleno: 'x'.repeat(600) });
    expect(leerAjustes(almacen({ [CLAVE_AJUSTES]: largo }))).toEqual(AJUSTES_INICIALES);
  });

  it('lo guardado se vuelve a leer igual', () => {
    const a = almacen();
    const nuevos = { ...AJUSTES_INICIALES, zurdo: true, texto: 'grande' as const };
    expect(guardarAjustes(a, nuevos)).toBe(true);
    expect(leerAjustes(a)).toEqual(nuevos);
  });

  it('si el navegador no deja guardar, sigue sin fallar', () => {
    const roto = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('cuota llena');
      },
      removeItem: () => {},
    };
    expect(guardarAjustes(roto, AJUSTES_INICIALES)).toBe(false);
    expect(leerAjustes(roto)).toEqual(AJUSTES_INICIALES);
  });

  it('cambiarAjustes actualiza el signal y guarda; cargarAjustes lo recupera', () => {
    const a = almacen();
    cambiarAjustes({ sensibilidad: 2 }, a);
    cambiarAjustes({ volumenAmbiente: 20 }, a);
    expect(ajustes.value).toEqual({ ...AJUSTES_INICIALES, sensibilidad: 2, volumenAmbiente: 20 });
    ajustes.value = { ...AJUSTES_INICIALES };
    cargarAjustes(a);
    expect(ajustes.value.sensibilidad).toBe(2);
    expect(ajustes.value.volumenAmbiente).toBe(20);
  });

  it('cambiarAjustes no deja pasar un valor inválido', () => {
    cambiarAjustes({ volumenVoz: 55 }, almacen());
    expect(ajustes.value.volumenVoz).toBe(AJUSTES_INICIALES.volumenVoz);
  });
});
