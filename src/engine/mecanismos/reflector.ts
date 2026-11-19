/**
 * Sala 3 · El reflector, en la escena (T58).
 *
 * Con los ajustes del panel (signal `mecanismo`), en el gimnasio se ve:
 * - el reflector inclinado en su muesca;
 * - solo los postes de la etapa, con el que se desliza a su distancia del sensor;
 * - la sombra de cada poste en el piso, del largo que le toca con esa luz;
 * - un disco por sensor, que se enciende cuando la punta de la sombra lo toca;
 * - la sombra del marcador junto a la pared y, al soltar la polea, el gancho que sube.
 *
 * Los números salen de las mismas reglas del panel (`game/puzzles`). La escena es un
 * blockout: lo que no cabe en la cancha (una sombra de 16 m) se corta en la pared.
 *
 * Pulir salas (sesión A): cada sensor es un lente sobre un aro oscuro (el material le da el
 * color de su estado) y el gancho es un gancho de verdad, con su grillete. El reflector, los
 * postes y el riel los viste `gimnasio-piezas.ts` sin cambiar su malla ni su pivote.
 */
import { effect } from '@preact/signals';
import { Mesh, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry } from 'three';
import type { BufferGeometry } from 'three';
import type { Object3D } from 'three';
import { puzzleDeSala } from '../../content/puzzles';
import { esEstadoReflector, lecturaPostes, sombraMarcador } from '../../game/puzzles';
import { condiciones, etapa, mecanismo, resultado } from '../../signals/mecanismo';
import { acercar, sinRayo } from './comunes';
import { PALETA } from './piezas-comunes';
import { Piezas } from './piezas-por-codigo';
import type { AnimacionSala } from './tipos';

const GRADOS = Math.PI / 180;
/** Número de la sala y alturas de los tres postes del riel, en el orden de `salas.json`. */
const SALA = 3;
export const ALTURAS_POSTES = [1, 2, 3] as const;
/** La franja de sensores está a esta distancia (en +Z) del riel de los postes. */
export const RIEL_A_SENSORES = 2;
/** Hasta dónde puede alejarse de los sensores el poste que se desliza (la gradería estorba). */
const RETROCESO_MAX = 4.5;
/** Las sombras no pasan de la pared sur. */
const Z_PARED_SUR = 5.9;
/** El marcador cuelga en la pared este; su sombra se dibuja al pie, desde este punto. */
const MARCADOR = { x: 9.6, z: -2 } as const;
/** El gancho de la polea descansa a esta altura y sube junto a la pared. */
const GANCHO = { x: 9.75, z: -1.2, reposo: 0.4 } as const;
const ALTO_SOBRE_PISO = 0.012;

const COLOR_SOMBRA = 0x2a2118;
const COLOR_SENSOR_APAGADO = 0x1f5a36;
const COLOR_SENSOR_SUENA = 0x9dffb8;

interface PosteAnimado {
  malla: Object3D;
  /** Posición del poste en el riel, sin deslizar (z local del grupo). */
  zCasa: number;
  sombra: Mesh;
  sensor: Mesh<BufferGeometry, MeshBasicMaterial>;
  /** Metas, que escribe el efecto, y valores actuales, que acerca `actualizar`. */
  metaZ: number;
  metaSombra: number;
  largoSombra: number;
}

/**
 * Un sensor en el piso, centrado en su altura: aro oscuro y lente abombado. Los vértices van
 * en gris y blanco; el material (sin luz) les pone el color del estado.
 */
function geometriaSensor(): BufferGeometry {
  return new Piezas()
    .cilindro(0.2, 0.016, '#5a5a5a', { pos: [0, -0.01, 0], bisel: 0.004, lados: 16 })
    .torno(
      [
        [0.15, 0.006],
        [0.12, 0.016],
        [0.06, 0.021],
        [0, 0.022],
      ],
      '#ffffff',
      { lados: 16, suave: true },
    )
    .geometria();
}

/** El gancho que sube con la polea, centrado: grillete, bloque amarillo, vástago y gancho. */
function geometriaGancho(): BufferGeometry {
  return new Piezas()
    .toro(0.03, 0.008, PALETA.cromo, {
      pos: [0, 0.09, 0],
      giro: [90, 0, 0],
      desde: 90,
      arco: 180,
      lados: 10,
      tubo: 4,
    })
    .caja([0.1, 0.1, 0.05], PALETA.amarillo, { pos: [0, 0.04, 0], bisel: 0.014 })
    .barra([0, -0.01, 0], [0, -0.055, 0], 0.012, PALETA.cromo, 6)
    .toro(0.035, 0.01, PALETA.cromo, {
      pos: [0, -0.09, 0],
      giro: [90, 0, 0],
      desde: 180,
      arco: 300,
      lados: 14,
      tubo: 5,
    })
    .geometria();
}

export function animarReflector(raiz: Object3D): AnimacionSala {
  const puzzle = puzzleDeSala(SALA);
  const reflector = raiz.getObjectByName('s3-reflector') ?? null;
  const grupoPostes = raiz.getObjectByName('s3-postes') ?? null;
  // Sin esas piezas (otra distribución de la sala) no hay nada que animar.
  if (!puzzle || puzzle.mecanismo !== 'reflector' || !reflector || !grupoPostes) {
    return { actualizar: () => undefined, estado: 'sin-piezas', liberar: () => undefined };
  }

  // Una geometría y un material para todas las sombras: una franja que nace en z = 0 y crece
  // hacia +Z con la escala.
  const franja = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
  const oscuro = new MeshBasicMaterial({ color: COLOR_SOMBRA });
  const disco = geometriaSensor();

  const nuevaSombra = (ancho: number): Mesh => {
    const m = sinRayo(new Mesh(franja, oscuro));
    m.scale.set(ancho, 1, 0.001);
    m.visible = false;
    raiz.add(m);
    return m;
  };

  // En `salas.json`, la primera pieza del grupo es el riel y las tres siguientes los postes.
  const postes: PosteAnimado[] = ALTURAS_POSTES.flatMap((_, i) => {
    const malla = grupoPostes.children[i + 1];
    if (!malla) return [];
    const sensor = sinRayo(
      new Mesh(disco, new MeshBasicMaterial({ color: COLOR_SENSOR_APAGADO, vertexColors: true })),
    );
    sensor.visible = false;
    raiz.add(sensor);
    return [
      {
        malla,
        zCasa: malla.position.z,
        sombra: nuevaSombra(0.16),
        sensor,
        metaZ: malla.position.z,
        metaSombra: 0,
        largoSombra: 0,
      },
    ];
  });

  const sombraDelMarcador = nuevaSombra(0.5);
  sombraDelMarcador.position.set(MARCADOR.x, ALTO_SOBRE_PISO, MARCADOR.z);
  const gancho = sinRayo(
    new Mesh(geometriaGancho(), new MeshLambertMaterial({ vertexColors: true })),
  );
  gancho.position.set(GANCHO.x, GANCHO.reposo, GANCHO.z);
  gancho.visible = false;
  raiz.add(gancho);

  let metaGiro = reflector.rotation.x;
  let metaMarcador = 0;
  let largoMarcador = 0;
  let metaGancho: number = GANCHO.reposo;
  let quieto = false;
  /** Hay una etapa en curso: el reflector alumbra y hay sombras. */
  let conLuz = false;

  // Las metas cambian solo cuando cambian los signals; `actualizar` no lee ninguno.
  const dejarDeSeguir = effect(() => {
    const actual = etapa.value;
    const datos = actual?.puzzle === puzzle.id ? puzzle.etapas[actual.etapa] : undefined;
    const estado: unknown = mecanismo.value;
    const cumple = condiciones.value;
    const ultimo = resultado.value?.puzzle === puzzle.id ? resultado.value : null;
    quieto = false;

    conLuz = datos !== undefined && esEstadoReflector(datos, estado);
    if (!datos || !esEstadoReflector(datos, estado)) {
      // Sala resuelta (o todavía sin datos): los tres postes en su sitio y el reflector apagado.
      for (const p of postes) {
        p.malla.visible = true;
        p.metaZ = p.zCasa;
        p.metaSombra = 0;
        p.sensor.visible = false;
      }
      metaMarcador = 0;
      // Con el sello ganado, el gancho se queda arriba, donde enganchó el marcador.
      gancho.visible = ultimo?.sello === true;
      const alto = ultimo?.sello ? poleaDe(ultimo.estado) : null;
      metaGancho = alto ?? GANCHO.reposo;
      return;
    }

    metaGiro = (90 - estado.muesca) * GRADOS;
    const lecturas = lecturaPostes(estado);
    postes.forEach((p, i) => {
      const lectura = lecturas.find((l) => l.altura === ALTURAS_POSTES[i]);
      p.malla.visible = lectura !== undefined;
      p.sensor.visible = lectura !== undefined && lectura.distancia !== null;
      if (!lectura) {
        p.metaSombra = 0;
        return;
      }
      // El poste que se desliza se aleja de los sensores; los demás quedan a 2 m de ellos.
      const movil = datos.controles.postes_moviles.includes(lectura.id);
      const retroceso =
        movil && lectura.distancia !== null
          ? Math.min(Math.max(lectura.distancia - RIEL_A_SENSORES, 0), RETROCESO_MAX)
          : 0;
      p.metaZ = p.zCasa - retroceso;
      p.metaSombra = lectura.sombra;
      p.sensor.material.color.set(
        cumple[lectura.id] === true ? COLOR_SENSOR_SUENA : COLOR_SENSOR_APAGADO,
      );
    });

    metaMarcador = sombraMarcador(datos, estado.muesca) ?? 0;
    // El gancho solo existe en la etapa de la polea; sube al soltarla y se queda ahí.
    gancho.visible = datos.controles.polea !== null;
    const soltada = ultimo && ultimo.etapa === actual?.etapa ? poleaDe(ultimo.estado) : null;
    metaGancho = soltada ?? GANCHO.reposo;
  });

  return {
    actualizar(dt) {
      if (quieto) return;
      let falta = false;
      const giro = acercar(reflector.rotation.x, metaGiro, dt);
      falta ||= giro !== metaGiro;
      reflector.rotation.x = giro;

      for (const p of postes) {
        const z = acercar(p.malla.position.z, p.metaZ, dt);
        p.largoSombra = acercar(p.largoSombra, p.metaSombra, dt);
        falta ||= z !== p.metaZ || p.largoSombra !== p.metaSombra;
        p.malla.position.z = z;
        // La sombra nace en la base del poste (en coordenadas de la sala) y va hacia +Z.
        const x = grupoPostes.position.x + p.malla.position.x;
        const zSala = grupoPostes.position.z + z;
        const largo = Math.min(p.largoSombra, Z_PARED_SUR - zSala);
        p.sombra.visible = p.malla.visible && largo > 0.01;
        p.sombra.position.set(x, ALTO_SOBRE_PISO, zSala);
        p.sombra.scale.z = Math.max(largo, 0.001);
        // El sensor está en la franja de sensores, frente al poste.
        p.sensor.position.set(x, 0.03, grupoPostes.position.z + p.zCasa + RIEL_A_SENSORES);
      }

      largoMarcador = acercar(largoMarcador, metaMarcador, dt);
      falta ||= largoMarcador !== metaMarcador;
      const largo = Math.min(largoMarcador, Z_PARED_SUR - MARCADOR.z);
      sombraDelMarcador.visible = largo > 0.01;
      sombraDelMarcador.scale.z = Math.max(largo, 0.001);

      const y = acercar(gancho.position.y, metaGancho, dt, 3);
      falta ||= y !== metaGancho;
      gancho.position.y = y;
      quieto = !falta;
    },
    get estado() {
      if (!quieto) return 'moviendo';
      if (gancho.visible && metaGancho > GANCHO.reposo) return 'gancho-arriba';
      return conLuz ? 'sombras' : 'sin-luz';
    },
    liberar() {
      dejarDeSeguir();
    },
  };
}

/** La longitud de polea de unos ajustes que vienen de un signal sin tipo. */
function poleaDe(estado: unknown): number | null {
  if (typeof estado !== 'object' || estado === null) return null;
  const polea = (estado as { polea?: unknown }).polea;
  return typeof polea === 'number' && Number.isFinite(polea) ? polea : null;
}
