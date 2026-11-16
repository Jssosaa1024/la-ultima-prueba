/**
 * Salas por código: arma una sala de `src/content/salas.json` con primitivas de Three.js.
 *
 * - Piso, techo y cuatro paredes con el tamaño de la sala; las paredes son sólidas.
 * - Cada objeto es una caja, un cilindro, una esfera, un plano (una caja muy delgada, para que se vea
 *   y se pueda tocar por los dos lados) o un grupo de piezas.
 * - Las cajas de colisión salen de los objetos sólidos (T17) ANTES de unir la geometría.
 * - Todo lo fijo que no se toca se une en UNA sola malla con colores por vértice: una
 *   draw call para casi toda la sala. Lo que se toca queda aparte, con su propio material,
 *   para poder resaltarlo (T18).
 * - Luz sin horneado (T19f): una hemisférica y una direccional, sin sombras en tiempo real, y
 *   una sombra de contacto falsa bajo cada mueble que se apoya en el piso (`sombras.ts`), todas
 *   en UNA malla.
 * - Modelos (T19e): un objeto con `modelo` no se une a la malla fija; su primitiva sigue siendo
 *   la caja que choca y la que se toca, y `vestir.ts` pone el GLB encima al cargarlo.
 * - Texturas de piso, paredes y techo (T19g): la superficie que tiene textura en `salas.json`
 *   se une en su propia malla, con UV en metros, para que `vestir.ts` le ponga el mapa al
 *   cargarlo. Mientras tanto (o si no carga) se ve con su color.
 * - Acabados (T19j): si la sala los pide, zócalo, rodapié, cornisa, marcos y carcasas de
 *   lámparas se unen con lo fijo; los difusores y brillos de las lámparas son dos mallas más, y
 *   la oclusión falsa va en la malla de las sombras (`acabados.ts`).
 */
import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
  SphereGeometry,
} from 'three';
import type { Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ObjetoSala, Sala } from '../../content/esquema-salas';
import { marcarInteractivo } from '../interaccion/interaccion';
import type { Caja } from '../jugador/colision';
import { crearAcabados } from './acabados';
import { cajasDeColision, marcarSolido } from './colisiones';
import { crearSombras, objetosConSombra } from './sombras';

/** Grosor de las paredes, por fuera del piso. */
const GROSOR_PARED = 0.2;
/** Grosor de un plano (cartel, puerta, pizarra). */
const GROSOR_PLANO = 0.03;
const LADOS_CILINDRO = 16;
/** Gajos de una esfera (y la mitad de anillos): unos 140 triángulos, que alcanzan para un balón. */
const LADOS_ESFERA = 12;
const GRADOS = Math.PI / 180;

/** Las superficies del cascarón que pueden llevar textura (T19g). */
export const SUPERFICIES = ['piso', 'paredes', 'techo'] as const;
export type Superficie = (typeof SUPERFICIES)[number];
/**
 * Lo que cubre una repetición de la textura, en metros, si la sala no dice otra cosa (T19g).
 * Va aquí y no en `esquema-salas.ts`: el motor solo importa TIPOS de los esquemas, para no meter
 * zod en el bundle del juego (zod prueba `Function('')` y la CSP lo bloquea).
 */
export const METROS_POR_REPETICION = 2;
/** En `userData`: a qué superficie pertenece una malla del cascarón. */
const SUPERFICIE = 'superficie';
/** En `userData` de la malla de una superficie con textura: el id de la textura en el manifiesto. */
export const TEXTURA = 'textura';
/** En `userData` de un objeto con modelo (T19e): el nombre del GLB en la carpeta de la sala. */
export const MODELO = 'modelo';

export interface SalaConstruida {
  id: Sala['id'];
  raiz: Group;
  cajas: Caja[];
  /** Dónde aparece el jugador y hacia dónde mira (yaw en radianes, 0 = hacia −Z). */
  inicio: { x: number; z: number; yaw: number };
  triangulos: number;
  /** Mallas que se dibujan: una draw call cada una. */
  mallas: number;
}

/** Geometría con la base en y = 0, centrada en x y z. */
function geometria(
  forma: 'caja' | 'cilindro' | 'esfera' | 'plano',
  tam: readonly number[],
): BufferGeometry {
  const [ancho = 1, alto = 1, fondo = 1] = tam;
  // Una esfera mide lo mismo en todas direcciones: su diámetro es el ancho.
  if (forma === 'esfera') {
    return new SphereGeometry(ancho / 2, LADOS_ESFERA, LADOS_ESFERA / 2).translate(0, ancho / 2, 0);
  }
  const g =
    forma === 'cilindro'
      ? new CylinderGeometry(ancho / 2, ancho / 2, alto, LADOS_CILINDRO)
      : new BoxGeometry(ancho, alto, forma === 'plano' ? GROSOR_PLANO : fondo);
  return g.translate(0, alto / 2, 0);
}

function crearObjeto(o: ObjetoSala): Object3D {
  let objeto: Object3D;
  if (o.forma === 'grupo') {
    objeto = new Group();
    for (const p of o.partes ?? []) {
      const malla = new Mesh(
        geometria(p.forma, p.tam),
        new MeshLambertMaterial({ color: p.color ?? o.color }),
      );
      malla.position.set(p.pos[0], p.pos[1], p.pos[2]);
      objeto.add(malla);
    }
  } else {
    objeto = new Mesh(geometria(o.forma, o.tam), new MeshLambertMaterial({ color: o.color }));
  }
  objeto.name = o.id;
  objeto.position.set(o.pos[0], o.pos[1], o.pos[2]);
  objeto.rotation.y = (o.giro ?? 0) * GRADOS;
  objeto.userData['id'] = o.id;
  if (o.puerta) objeto.userData['puerta'] = o.puerta;
  if (o.modelo) objeto.userData[MODELO] = o.modelo;
  if (o.solido) marcarSolido(objeto);
  if (o.accion && o.nombre) {
    marcarInteractivo(objeto, { id: o.id, nombre: o.nombre, accion: o.accion });
  }
  return objeto;
}

/** Marca una malla del cascarón con su superficie. */
function superficie<T extends Object3D>(o: T, cual: Superficie): T {
  o.userData[SUPERFICIE] = cual;
  return o;
}

/** Piso, techo y paredes. Las paredes quedan por fuera del rectángulo de la sala. */
function crearCascaron(sala: Sala): Object3D[] {
  const { ancho, fondo, alto, colores } = sala;
  const piso = new Mesh(
    new PlaneGeometry(ancho, fondo).rotateX(-Math.PI / 2),
    material(colores.piso),
  );
  const techo = new Mesh(
    new PlaneGeometry(ancho, fondo).rotateX(Math.PI / 2),
    material(colores.techo),
  );
  techo.position.y = alto;

  const g = GROSOR_PARED;
  const pared = (w: number, d: number, x: number, z: number): Mesh => {
    const m = new Mesh(
      new BoxGeometry(w, alto, d).translate(0, alto / 2, 0),
      material(colores.paredes),
    );
    m.position.set(x, 0, z);
    return superficie(marcarSolido(m), 'paredes');
  };
  return [
    superficie(piso, 'piso'),
    superficie(techo, 'techo'),
    pared(ancho + 2 * g, g, 0, -(fondo + g) / 2),
    pared(ancho + 2 * g, g, 0, (fondo + g) / 2),
    pared(g, fondo, -(ancho + g) / 2, 0),
    pared(g, fondo, (ancho + g) / 2, 0),
  ];
}

const material = (color: string): MeshLambertMaterial => new MeshLambertMaterial({ color });

/** `true` si el objeto o alguno de sus padres tiene la marca `clave` en `userData`. */
function conMarca(o: Object3D, clave: string): boolean {
  for (let a: Object3D | null = o; a; a = a.parent) if (a.userData[clave]) return true;
  return false;
}

/**
 * UV planas en metros según hacia dónde mira cada cara (T19g): el piso y el techo usan x y z;
 * las paredes, su lado horizontal y la altura. Así la textura se repite igual en toda la sala.
 */
export function uvEnMetros(g: BufferGeometry, metros: number): void {
  const p = g.getAttribute('position');
  const n = g.getAttribute('normal');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i));
    const ny = Math.abs(n.getY(i));
    const nz = Math.abs(n.getZ(i));
    let u = p.getX(i);
    let v = p.getY(i);
    if (ny >= nx && ny >= nz) v = p.getZ(i);
    else if (nx >= nz) u = p.getZ(i);
    uv[i * 2] = u / metros;
    uv[i * 2 + 1] = v / metros;
  }
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
}

/** Une geometrías ya puestas en el mundo y libera las partes. */
function unir(partes: BufferGeometry[]): BufferGeometry {
  const unida = mergeGeometries(partes);
  partes.forEach((g) => g.dispose());
  if (!unida) throw new Error('No se pudo unir la geometría fija de la sala');
  return unida;
}

/**
 * Une en una sola malla todas las mallas fijas que no se tocan, con su color en los vértices.
 * Las superficies con textura (T19g) se unen aparte, una malla por superficie, con UV en
 * metros. Las originales se quitan de la escena y se liberan.
 */
function unirFijas(raiz: Group, sala: Sala): void {
  raiz.updateMatrixWorld(true);
  const texturas = sala.texturas ?? {};
  const conTextura = (o: Object3D): Superficie | null => {
    const cual = o.userData[SUPERFICIE] as Superficie | undefined;
    return cual && texturas[cual] ? cual : null;
  };
  const fijas: Mesh[] = [];
  raiz.traverse((o) => {
    const malla = o as Mesh;
    // Lo que se toca y lo que lleva modelo (T19e) quedan aparte.
    if (malla.isMesh && !conMarca(malla, 'interactivo') && !conMarca(malla, MODELO)) {
      fijas.push(malla);
    }
  });
  if (fijas.length === 0) return;

  const enMundo = (malla: Mesh): BufferGeometry =>
    malla.geometry.clone().applyMatrix4(malla.matrixWorld);
  const partes = fijas
    .filter((m) => !conTextura(m))
    .map((malla) => {
      const g = enMundo(malla);
      const c = (malla.material as MeshLambertMaterial).color;
      const n = g.getAttribute('position').count;
      const colores = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) colores.set([c.r, c.g, c.b], i * 3);
      g.setAttribute('color', new Float32BufferAttribute(colores, 3));
      return g;
    });

  const metros = texturas.metros ?? METROS_POR_REPETICION;
  const aparte: Mesh[] = [];
  for (const cual of SUPERFICIES) {
    const id = texturas[cual];
    const mallas = fijas.filter((m) => conTextura(m) === cual);
    if (!id || mallas.length === 0) continue;
    const g = unir(mallas.map(enMundo));
    uvEnMetros(g, metros);
    const m = new Mesh(g, material(sala.colores[cual]));
    m.name = cual;
    m.userData[TEXTURA] = id;
    aparte.push(m);
  }

  for (const malla of fijas) {
    malla.removeFromParent();
    malla.geometry.dispose();
    (malla.material as MeshLambertMaterial).dispose();
  }
  // Los grupos fijos que quedaron vacíos (por ejemplo, una silla de dos piezas) sobran.
  const vacios: Object3D[] = [];
  raiz.traverse((o) => {
    if (o !== raiz && o.type === 'Group' && o.children.length === 0) vacios.push(o);
  });
  vacios.forEach((o) => o.removeFromParent());

  if (partes.length > 0) {
    const fija = new Mesh(unir(partes), new MeshLambertMaterial({ vertexColors: true }));
    fija.name = 'fija';
    raiz.add(fija);
  }
  if (aparte.length > 0) raiz.add(...aparte);
}

/**
 * Luz sin horneado (T19f). Dos luces dinámicas como máximo (presupuesto) y ninguna sombra en
 * tiempo real: el cielo y una direccional suave que da volumen a los muebles. El tono «de
 * suelo» ilumina lo que mira hacia abajo (el techo): claro, para que no quede negro.
 */
function crearLuces(sala: Sala): Object3D[] {
  // T19i: cielo cálido y suelo más oscuro, y una direccional más fuerte de lado: cada cara de
  // un mueble queda con su tono y las formas se leen mejor.
  const cielo = new HemisphereLight(0xfff6ea, 0x8f8377, 1.45);
  const sol = new DirectionalLight(0xffe9cc, 1.7);
  sol.castShadow = false;
  sol.position.set(sala.ancho * 0.6, sala.alto * 1.4, sala.fondo * 0.25);
  return [cielo, sol];
}

export function construirSala(sala: Sala): SalaConstruida {
  const raiz = new Group();
  raiz.name = sala.id;
  raiz.add(...crearCascaron(sala), ...sala.objetos.map(crearObjeto));

  // Primero las colisiones, con cada objeto por separado; después se une la geometría.
  const cajas = cajasDeColision(raiz);
  // Los acabados no chocan: entran después de las colisiones y antes de unir lo fijo.
  const acabados = sala.acabados ? crearAcabados(sala, sala.acabados) : null;
  if (acabados) raiz.add(...acabados.fijas);
  unirFijas(raiz, sala);
  const sombras = crearSombras(objetosConSombra(sala.objetos), acabados?.oclusion);
  if (sombras) raiz.add(sombras);
  if (acabados) raiz.add(...acabados.luces);
  raiz.add(...crearLuces(sala));

  let triangulos = 0;
  let mallas = 0;
  raiz.traverse((o) => {
    const malla = o as Mesh;
    if (!malla.isMesh) return;
    mallas++;
    const g = malla.geometry;
    triangulos += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  });

  return {
    id: sala.id,
    raiz,
    cajas,
    inicio: { x: sala.inicio.x, z: sala.inicio.z, yaw: sala.inicio.giro * GRADOS },
    triangulos,
    mallas,
  };
}
