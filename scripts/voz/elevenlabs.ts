/**
 * Cliente mínimo de la API de ElevenLabs para `npm run voz` (T42b).
 *
 * La clave se lee de la variable de entorno `ELEVENLABS_API_KEY` en cada pedido y solo va en
 * la cabecera `xi-api-key`. Nunca se imprime, ni se guarda, ni aparece en los errores: de la
 * respuesta solo se muestra el código HTTP y el mensaje que devuelve la API.
 */
import { planDeTier } from './plan.ts';

export const VARIABLE_CLAVE = 'ELEVENLABS_API_KEY';
const BASE = 'https://api.elevenlabs.io';

export class ErrorApi extends Error {
  readonly estado: number;
  constructor(estado: number, mensaje: string) {
    super(mensaje);
    this.estado = estado;
  }
}

/** Si la variable de la clave está definida (sin leer su valor más que para eso). */
export const hayClave = (): boolean => Boolean(process.env[VARIABLE_CLAVE]?.trim());

function clave(): string {
  const valor = process.env[VARIABLE_CLAVE]?.trim();
  if (!valor) throw new ErrorApi(0, `falta la variable de entorno ${VARIABLE_CLAVE}`);
  return valor;
}

/** El mensaje legible de un error de la API (`detail.message` o `detail`), sin nada más. */
export function mensajeDeError(estado: number, cuerpo: string): string {
  try {
    const datos = JSON.parse(cuerpo) as { detail?: { message?: unknown } | string };
    const d = datos.detail;
    const texto = typeof d === 'string' ? d : typeof d?.message === 'string' ? d.message : '';
    if (texto) return `HTTP ${estado}: ${texto.slice(0, 300)}`;
  } catch {
    // No era JSON: solo el código.
  }
  return `HTTP ${estado}`;
}

async function pedir(ruta: string, init: RequestInit = {}): Promise<Response> {
  const r = await fetch(`${BASE}${ruta}`, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), 'xi-api-key': clave() },
  });
  if (!r.ok) throw new ErrorApi(r.status, mensajeDeError(r.status, await r.text()));
  return r;
}

/** Texto a voz: devuelve el audio en el formato pedido. */
export async function textoAVoz(
  vozId: string,
  formato: string,
  cuerpo: Record<string, unknown>,
): Promise<Uint8Array> {
  const r = await pedir(
    `/v1/text-to-speech/${encodeURIComponent(vozId)}?output_format=${encodeURIComponent(formato)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify(cuerpo),
    },
  );
  return new Uint8Array(await r.arrayBuffer());
}

/** Efecto de sonido a partir de una descripción (T42c): devuelve el audio en el formato pedido. */
export async function efectoDeSonido(
  formato: string,
  cuerpo: Record<string, unknown>,
): Promise<Uint8Array> {
  const r = await pedir(`/v1/sound-generation?output_format=${encodeURIComponent(formato)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify(cuerpo),
  });
  return new Uint8Array(await r.arrayBuffer());
}

export interface Suscripcion {
  tier: string;
  plan: 'gratis' | 'pago';
  usados: number;
  limite: number;
}

/**
 * El plan de la cuenta. Necesita el permiso «User: read» en la clave; si no lo tiene,
 * devuelve `null` y el script lo dice.
 */
export async function suscripcion(): Promise<Suscripcion | null> {
  try {
    const r = await pedir('/v1/user/subscription');
    const s = (await r.json()) as {
      tier?: string;
      character_count?: number;
      character_limit?: number;
    };
    const tier = typeof s.tier === 'string' ? s.tier : 'desconocido';
    return {
      tier,
      plan: planDeTier(tier),
      usados: s.character_count ?? 0,
      limite: s.character_limit ?? 0,
    };
  } catch (e) {
    if (e instanceof ErrorApi && e.estado === 401) return null;
    throw e;
  }
}
