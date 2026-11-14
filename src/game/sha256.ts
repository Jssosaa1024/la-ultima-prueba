/**
 * SHA-256 en TypeScript puro (T23). Es síncrono y no usa DOM ni Node, para que el mismo código
 * sirva en el script `hash-answers`, en el navegador y en los tests. Los tests lo comparan con
 * `node:crypto`.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

/** Bytes UTF-8 de un texto, sin depender de TextEncoder. */
function utf8(texto: string): number[] {
  const bytes: number[] = [];
  for (const caracter of texto) {
    const c = caracter.codePointAt(0) ?? 0;
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else {
      bytes.push(
        0xf0 | (c >> 18),
        0x80 | ((c >> 12) & 63),
        0x80 | ((c >> 6) & 63),
        0x80 | (c & 63),
      );
    }
  }
  return bytes;
}

/** SHA-256 de un texto (en UTF-8), en hexadecimal: 64 caracteres. */
export function sha256(texto: string): string {
  const bytes = utf8(texto);
  const bits = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  // Longitud en bits, en 64 bits big-endian.
  const alto = Math.floor(bits / 0x100000000);
  const bajo = bits >>> 0;
  for (const parte of [alto, bajo]) {
    bytes.push((parte >>> 24) & 255, (parte >>> 16) & 255, (parte >>> 8) & 255, parte & 255);
  }

  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  const v = new Uint32Array(8);
  const en = (a: Uint32Array | number[], i: number): number => a[i] ?? 0;

  for (let inicio = 0; inicio < bytes.length; inicio += 64) {
    for (let i = 0; i < 16; i++) {
      const j = inicio + i * 4;
      w[i] =
        (en(bytes, j) << 24) |
        (en(bytes, j + 1) << 16) |
        (en(bytes, j + 2) << 8) |
        en(bytes, j + 3);
    }
    for (let i = 16; i < 64; i++) {
      const a = en(w, i - 15);
      const b = en(w, i - 2);
      const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3);
      const s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
      w[i] = en(w, i - 16) + s0 + en(w, i - 7) + s1;
    }
    v.set(h);
    for (let i = 0; i < 64; i++) {
      const [a, b, c, d, e, f, g, hh] = [
        en(v, 0),
        en(v, 1),
        en(v, 2),
        en(v, 3),
        en(v, 4),
        en(v, 5),
        en(v, 6),
        en(v, 7),
      ];
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + s1 + ch + en(K, i) + en(w, i)) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) >>> 0;
      v[7] = g;
      v[6] = f;
      v[5] = e;
      v[4] = d + t1;
      v[3] = c;
      v[2] = b;
      v[1] = a;
      v[0] = t1 + t2;
    }
    for (let i = 0; i < 8; i++) h[i] = en(h, i) + en(v, i);
  }

  return Array.from(h, (x) => x.toString(16).padStart(8, '0')).join('');
}
