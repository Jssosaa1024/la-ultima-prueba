import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  agregarFuentes,
  enLinea,
  hashCsp,
  leerPolitica,
  noCubiertos,
  politicaConHashes,
  reemplazarPolitica,
} from '../../scripts/csp/csp';

/** T02b · CSP en `public/_headers` con hashes de lo que Astro deja en línea. */

const HEADERS = readFileSync('public/_headers', 'utf8');

/** Directivas de la política como mapa: `script-src` → fuentes. */
const directivas = (politica: string) =>
  Object.fromEntries(
    politica.split(';').map((p) => {
      const [nombre = '', ...fuentes] = p.trim().split(/\s+/);
      return [nombre, fuentes];
    }),
  );

describe('T02b · política de public/_headers', () => {
  const politica = leerPolitica(HEADERS) ?? '';
  const d = directivas(politica);

  it('tiene exactamente las directivas pedidas', () => {
    expect(d['default-src']).toEqual(["'self'"]);
    expect(d['connect-src']).toEqual(["'self'", 'https://*.supabase.co', 'wss://*.supabase.co']);
    expect(d['script-src']).toEqual(["'self'", "'wasm-unsafe-eval'"]);
    expect(d['style-src']).toEqual(["'self'"]);
    expect(d['worker-src']).toEqual(["'self'", 'blob:']);
    expect(d['img-src']).toEqual(["'self'", 'data:', 'blob:']);
    expect(d['object-src']).toEqual(["'none'"]);
    expect(d['base-uri']).toEqual(["'self'"]);
    expect(d['frame-ancestors']).toEqual(["'none'"]);
  });

  it("nunca 'unsafe-inline' ni 'unsafe-eval', ni orígenes de terceros", () => {
    expect(politica).not.toContain("'unsafe-inline'");
    expect(politica).not.toContain("'unsafe-eval'");
    const fuentes = Object.values(d).flat();
    const externas = fuentes.filter((f) => /^(https?|wss?):/.test(f));
    expect(externas).toEqual(['https://*.supabase.co', 'wss://*.supabase.co']);
  });

  it('va en la sección /* junto a las otras cabeceras de seguridad', () => {
    expect(HEADERS).toMatch(/\/\*\n(?: {2}.+\n)*? {2}Content-Security-Policy: default-src/);
  });
});

describe('T02b · hashes de lo que queda en línea', () => {
  const html = `<!doctype html><html><head>
<script type="module">navigator.serviceWorker.register('/sw.js')</script>
<script type="module" src="/_astro/a.js"></script>
<script type="application/ld+json">{"a":1}</script>
<style>astro-island{display:contents}</style>
</head><body><astro-island client="only"></astro-island>
<script>(function(){self.Astro={}})()</script></body></html>`;

  it('encuentra los scripts sin src y los estilos, con su texto exacto', () => {
    expect(enLinea(html)).toEqual({
      scripts: ["navigator.serviceWorker.register('/sw.js')", '(function(){self.Astro={}})()'],
      estilos: ['astro-island{display:contents}'],
    });
  });

  it('el hash es el SHA-256 en base64, como lo calcula el navegador', () => {
    // Valor de referencia: `echo -n 'alert(1)' | openssl dgst -sha256 -binary | base64`.
    expect(hashCsp('alert(1)')).toBe("'sha256-bhHHL3z2vDgxUt0W3dWQOrprscmda2Y5pLsLg4GF+pI='");
  });

  it('agrega los hashes a script-src y style-src, sin repetir y en orden', () => {
    const base = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'";
    const p = politicaConHashes(base, [enLinea(html), enLinea(html)]);
    const d = directivas(p);
    expect(d['script-src']?.slice(0, 2)).toEqual(["'self'", "'wasm-unsafe-eval'"]);
    expect(d['script-src']).toHaveLength(4);
    expect(d['style-src']).toEqual(["'self'", hashCsp('astro-island{display:contents}')]);
    expect(d['default-src']).toEqual(["'self'"]);
  });

  it('falla si falta la directiva', () => {
    expect(() => agregarFuentes("default-src 'self'", 'script-src', ["'sha256-x'"])).toThrow(
      /script-src/,
    );
  });

  it('reemplaza solo la línea de la CSP de /*', () => {
    const nueva = reemplazarPolitica(HEADERS, "default-src 'none'");
    expect(leerPolitica(nueva)).toBe("default-src 'none'");
    expect(nueva.replace(/ {2}Content-Security-Policy:.*\n/, '')).toBe(
      HEADERS.replace(/ {2}Content-Security-Policy:.*\n/, ''),
    );
  });
});

describe('T02b · lo que un hash no cubre hace fallar el build', () => {
  it('detecta on…=, style="…" y javascript:', () => {
    expect(noCubiertos('<button onclick="x()">a</button>')).toEqual(['onclick=']);
    expect(noCubiertos('<div style="color:red">a</div>')).toEqual(['style=']);
    expect(noCubiertos('<a href="javascript:void(0)">a</a>')).toEqual(['javascript:']);
  });

  it('no confunde atributos parecidos ni el texto de scripts y estilos', () => {
    expect(noCubiertos('<div data-style="x" class="onda">onclick=</div>')).toEqual([]);
    expect(noCubiertos('<script>el.onclick = f; a.style="x"</script>')).toEqual([]);
    expect(noCubiertos('<style>.a{color:red}</style><p>javascript: es un lenguaje</p>')).toEqual(
      [],
    );
  });
});
