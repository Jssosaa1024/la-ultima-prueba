import { describe, expect, it } from 'vitest';
import {
  CompressedTexture,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RGBA_ASTC_4x4_Format,
  RGB_ETC2_Format,
  Scene,
  Texture,
} from 'three';
import { crearDetectorToques, pideDepuracion } from '../../src/debug/apertura';
import { armarInforme, fechaLocal, nombreArchivo } from '../../src/debug/informe';
import { bytesTexturasDe, claseDeTextura } from '../../src/debug/medidor';
import {
  METRICAS_VACIAS,
  bytesTextura,
  colorContra,
  crearVentanaCuadros,
  marcarInicioSala,
  marcarPrimerCuadro,
  reiniciarCargas,
  sumarDescargas,
  ultimaCargaDeSala,
} from '../../src/debug/metricas';

describe('colores contra el presupuesto (T11n)', () => {
  it('verde hasta el 85 %, ámbar hasta el límite y rojo por encima', () => {
    expect(colorContra(51_000, 60_000)).toBe('verde');
    expect(colorContra(51_001, 60_000)).toBe('ambar');
    expect(colorContra(60_000, 60_000)).toBe('ambar');
    expect(colorContra(60_001, 60_000)).toBe('rojo');
    expect(colorContra(0, 40)).toBe('verde');
  });
});

describe('ventana de tiempos de cuadro (T11m)', () => {
  it('da mediana, p95 y el 1 % más lento de los últimos 5 s', () => {
    const v = crearVentanaCuadros();
    // 100 cuadros: 1 ms, 2 ms … 100 ms, uno cada 10 ms.
    for (let i = 1; i <= 100; i++) v.registrar(i, i * 10);
    const e = v.estadisticas(1000);
    expect(e.cuadros).toBe(100);
    expect(e.medianaMs).toBe(50);
    expect(e.p95Ms).toBe(95);
    expect(e.p1Ms).toBe(99);
  });

  it('olvida los cuadros de hace más de 5 s', () => {
    const v = crearVentanaCuadros();
    v.registrar(500, 0);
    for (let t = 6000; t <= 7000; t += 100) v.registrar(16, t);
    const e = v.estadisticas(7000);
    expect(e.cuadros).toBe(11);
    expect(e.p1Ms).toBe(16);
  });

  it('con el búfer lleno, sigue con los más recientes sin crecer', () => {
    const v = crearVentanaCuadros(8);
    for (let i = 0; i < 20; i++) v.registrar(i, i);
    const e = v.estadisticas(20);
    expect(e.cuadros).toBe(8);
    expect(e.p1Ms).toBe(19);
  });

  it('vacía da ceros', () => {
    const v = crearVentanaCuadros();
    expect(v.estadisticas(0)).toEqual({ cuadros: 0, medianaMs: 0, p95Ms: 0, p1Ms: 0 });
  });
});

describe('memoria de texturas (T11m)', () => {
  it('ancho × alto × bytes por píxel × 1,33 con mipmaps', () => {
    expect(bytesTextura(1024, 1024, 'bpp4', true)).toBeCloseTo(1024 * 1024 * 0.5 * 1.33);
    expect(bytesTextura(1024, 1024, 'bpp8', false)).toBe(1024 * 1024);
    expect(bytesTextura(512, 512, 'sin-comprimir', false)).toBe(512 * 512 * 4);
  });

  it('reconoce ETC2 RGB, ASTC 4×4 y sin comprimir', () => {
    const etc2 = new CompressedTexture([], 4, 4, RGB_ETC2_Format);
    const astc = new CompressedTexture([], 4, 4, RGBA_ASTC_4x4_Format);
    expect(claseDeTextura(etc2)).toBe('bpp4');
    expect(claseDeTextura(astc)).toBe('bpp8');
    expect(claseDeTextura(new Texture())).toBe('sin-comprimir');
  });

  it('suma una vez cada textura de la escena aunque la usen dos materiales', () => {
    const t = new CompressedTexture([], 1024, 1024, RGB_ETC2_Format);
    t.mipmaps = [{ data: new Uint8Array(0), width: 1024, height: 1024 }];
    t.generateMipmaps = false;
    const escena = new Scene();
    const g = new PlaneGeometry();
    escena.add(new Mesh(g, new MeshBasicMaterial({ map: t })));
    escena.add(new Mesh(g, new MeshBasicMaterial({ map: t })));
    expect(bytesTexturasDe(escena)).toBe(1024 * 1024 * 0.5);
  });
});

describe('MB descargados por sala (T11m)', () => {
  it('suma transferSize bajo /assets/salas/<sala>/ y cuenta aparte la caché', () => {
    const d = sumarDescargas(
      [
        {
          name: 'https://x.dev/assets/salas/s1-cooperativa/a.glb',
          transferSize: 1000,
          decodedBodySize: 900,
        },
        {
          name: 'https://x.dev/assets/salas/s1-cooperativa/b.glb',
          transferSize: 0,
          decodedBodySize: 500,
        },
        {
          name: 'https://x.dev/assets/salas/s2-laboratorio/c.glb',
          transferSize: 7000,
          decodedBodySize: 1,
        },
        { name: 'https://x.dev/_astro/motor.js', transferSize: 9000, decodedBodySize: 1 },
      ],
      's1-cooperativa',
    );
    expect(d).toEqual({ bytesRed: 1000, desdeCache: 1, archivos: 2 });
  });
});

describe('tiempo de carga de la sala (T11m)', () => {
  it('mide entre sala:inicio y el primer cuadro', () => {
    reiniciarCargas();
    marcarInicioSala('s1-cooperativa');
    marcarPrimerCuadro();
    const c = ultimaCargaDeSala();
    expect(c?.sala).toBe('s1-cooperativa');
    expect(c?.ms).toBeGreaterThanOrEqual(0);
    // Un segundo cuadro no vuelve a medir.
    marcarPrimerCuadro();
    expect(ultimaCargaDeSala()).toEqual(c);
  });
});

describe('apertura del panel (T11n)', () => {
  it('solo ?debug=1 exacto', () => {
    expect(pideDepuracion('?debug=1')).toBe(true);
    expect(pideDepuracion('?sala=s1-cooperativa&debug=1')).toBe(true);
    expect(pideDepuracion('?debug=true')).toBe(false);
    expect(pideDepuracion('?debug=1%3Cscript')).toBe(false);
    expect(pideDepuracion('')).toBe(false);
  });

  it('3 toques en la esquina en menos de 1 s', () => {
    const d = crearDetectorToques();
    expect(d.tocar(10, 10, 0)).toBe(false);
    expect(d.tocar(20, 5, 300)).toBe(false);
    expect(d.tocar(30, 30, 600)).toBe(true);
    // Vuelve a empezar.
    expect(d.tocar(30, 30, 700)).toBe(false);
  });

  it('no abre con toques lentos ni fuera de la esquina', () => {
    const d = crearDetectorToques();
    d.tocar(10, 10, 0);
    d.tocar(10, 10, 600);
    expect(d.tocar(10, 10, 1200)).toBe(false);
    const e = crearDetectorToques();
    e.tocar(10, 10, 0);
    e.tocar(200, 10, 100);
    e.tocar(10, 10, 200);
    expect(e.tocar(10, 10, 300)).toBe(false);
  });
});

describe('informe JSON (T11n)', () => {
  it('tiene el formato de la especificación', () => {
    const informe = armarInforme(
      {
        ...METRICAS_VACIAS,
        lista: true,
        sala: 's1-cooperativa',
        cuadro: { cuadros: 300, medianaMs: 24.1, p95Ms: 31, p1Ms: 38.2 },
        triangulos: 52_000,
        drawCalls: 34,
        mbTexturas: 12.4,
        mbDescargados: 2.3,
        cargaMs: 4100,
        pixelRatioUsado: 1.25,
      },
      { userAgent: 'Prueba/1.0', devicePixelRatio: 2, pantalla: [720, 1600] },
      new Date(2026, 10, 5, 15, 0, 0),
    );
    expect(informe).toMatchObject({
      version: 1,
      dispositivo: { userAgent: 'Prueba/1.0', devicePixelRatio: 2, pantalla: [720, 1600] },
      sala: 's1-cooperativa',
      metricas: {
        mediana_ms: 24.1,
        p95_ms: 31,
        p1_ms: 38.2,
        triangulos: 52_000,
        draw_calls: 34,
        mb_texturas: 12.4,
        mb_descargados: 2.3,
        carga_ms: 4100,
      },
      estres: null,
    });
    expect(informe.fecha).toMatch(/^2026-11-05T15:00:00[+-]\d\d:\d\d$/);
    expect(nombreArchivo(informe)).toBe('metricas-s1-cooperativa-20261105150000.json');
  });

  it('la fecha lleva el desfase local', () => {
    const f = fechaLocal(new Date(2026, 0, 2, 3, 4, 5));
    expect(f.startsWith('2026-01-02T03:04:05')).toBe(true);
  });
});
