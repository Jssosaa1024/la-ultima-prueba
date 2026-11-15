import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { archivoIcono, enDibujo, icono, TAMANOS } from '../../scripts/pwa/iconos';
import { esIOS, sugerirInstalar, type Navegador } from '../../src/ui/menus/instalar';

// T95: manifiesto, iconos hechos por código y sugerencia de instalar en iPhone.

const manifiesto = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8')) as {
  start_url: string;
  scope: string;
  display: string;
  orientation: string;
  icons: { src: string; sizes: string; purpose: string }[];
};

describe('manifiesto', () => {
  it('pide pantalla completa y horizontal y abre el juego', () => {
    expect(manifiesto.display).toBe('fullscreen');
    expect(manifiesto.orientation).toBe('landscape');
    expect(manifiesto.start_url).toBe('/jugar/');
    expect(manifiesto.scope).toBe('/');
  });

  it('cada icono existe con el tamaño que declara, y hay uno maskable de 512', () => {
    for (const i of manifiesto.icons) {
      const datos = readFileSync(path.join('public', i.src));
      const ancho = datos.readUInt32BE(16);
      const alto = datos.readUInt32BE(20);
      expect(`${ancho}x${alto}`).toBe(i.sizes);
    }
    expect(manifiesto.icons.some((i) => i.purpose === 'maskable' && i.sizes === '512x512')).toBe(
      true,
    );
  });
});

describe('iconos', () => {
  it.each(TAMANOS)('el PNG de %i px coincide con lo que dibuja el script', (lado) => {
    const publicado = readFileSync(path.join('public', 'iconos', archivoIcono(lado)));
    expect(publicado.equals(icono(lado))).toBe(true);
  });

  it('el dibujo cabe en la zona segura de un icono maskable (círculo del 80 %)', () => {
    for (let y = 0; y <= 1; y += 0.01) {
      for (let x = 0; x <= 1; x += 0.01) {
        if (enDibujo(x, y)) expect(Math.hypot(x - 0.5, y - 0.5)).toBeLessThanOrEqual(0.4);
      }
    }
  });
});

describe('sugerencia de instalar', () => {
  const base: Navegador = { userAgent: '', plataforma: '', toques: 0, instalado: false };
  const iphone = { ...base, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' };

  it('solo en iPhone o iPad sin instalar', () => {
    expect(sugerirInstalar(iphone)).toBe(true);
    expect(sugerirInstalar({ ...iphone, instalado: true })).toBe(false);
    expect(sugerirInstalar({ ...base, userAgent: 'Mozilla/5.0 (Linux; Android 14)' })).toBe(false);
  });

  it('reconoce un iPad que se presenta como Mac por sus toques', () => {
    expect(esIOS({ ...base, plataforma: 'MacIntel', toques: 5 })).toBe(true);
    expect(esIOS({ ...base, plataforma: 'MacIntel', toques: 0 })).toBe(false);
  });
});
