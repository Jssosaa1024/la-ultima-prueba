import { afterEach, describe, expect, it } from 'vitest';
import { Mesh } from 'three';
import type { Object3D } from 'three';
import type { EstadoDe, PuzzleDe } from '../../src/content/esquema';
import { PUZZLES } from '../../src/content/puzzles';
import { salaPorId } from '../../src/content/salas';
import { animacionDeSala } from '../../src/engine/mecanismos';
import { acercar } from '../../src/engine/mecanismos/comunes';
import { ALTURAS_POSTES, RIEL_A_SENSORES } from '../../src/engine/mecanismos/reflector';
import { construirSala } from '../../src/engine/salas/construir';
import {
  conDistancia,
  conMuesca,
  conPolea,
  esEstadoReflector,
  evaluar,
  lecturaPolea,
  lecturaPostes,
  sombraMarcador,
} from '../../src/game/puzzles';
import {
  condiciones,
  etapa,
  mecanismo,
  reiniciarMecanismo,
  resultado,
} from '../../src/signals/mecanismo';
import {
  metros,
  nombreSensor,
  textoMarcador,
  textoPolea,
  textoPoste,
} from '../../src/ui/mecanismos/reflector/textos';

/**
 * T58 · Sala 3, el reflector: lo que la máquina muestra (reglas), cómo lo dice el panel
 * (textos) y lo que se mueve en la escena (animador).
 */

const puzzle = PUZZLES.find((p) => p.mecanismo === 'reflector') as PuzzleDe<'reflector'>;
type Estado = EstadoDe<'reflector'>;
const inicial = (n: number): Estado => structuredClone(puzzle.etapas[n]?.estado_inicial) as Estado;
const datos = (n: number) => {
  const e = puzzle.etapas[n];
  if (!e) throw new Error(`falta la etapa ${n}`);
  return e;
};

describe('reflector: lo que la máquina muestra (T58)', () => {
  it('presentar: la sombra del poste de 2 m frente a su sensor, muesca por muesca', () => {
    const lectura = (muesca: number) => lecturaPostes(conMuesca(inicial(0), muesca))[0];
    expect(lectura(63)).toMatchObject({ altura: 2, sombra: 1, distancia: 2, alcance: 'corta' });
    expect(lectura(53)).toMatchObject({ sombra: 1.5, alcance: 'corta' });
    expect(lectura(45)).toMatchObject({ sombra: 2, alcance: 'toca' });
    expect(lectura(37)?.alcance).toBe('larga');
    expect(lectura(27)).toMatchObject({ sombra: 4, alcance: 'larga' });
  });

  it('el alcance «toca» coincide siempre con la condición del sensor', () => {
    for (const n of [0, 1]) {
      const e = datos(n);
      for (const muesca of e.controles.muescas) {
        for (let d = e.controles.distancia_min; d <= e.controles.distancia_max; d++) {
          let estado = conMuesca(inicial(n), muesca);
          for (const id of e.controles.postes_moviles) estado = conDistancia(estado, id, d);
          expect(esEstadoReflector(e, estado)).toBe(true);
          const cumple = evaluar(puzzle, n, estado)?.condiciones ?? {};
          for (const l of lecturaPostes(estado)) {
            if (e.exito.sensores.includes(l.id)) {
              expect(l.alcance === 'toca', `${n}/${muesca}/${d}/${l.id}`).toBe(cumple[l.id]);
            }
          }
        }
      }
    }
  });

  it('torcer: el poste que se desliza cambia solo su distancia', () => {
    const estado = conDistancia(conMuesca(inicial(1), 27), 'poste-3', 6);
    expect(estado.postes).toEqual([
      { id: 'poste-1', altura: 1, distancia: 2 },
      { id: 'poste-3', altura: 3, distancia: 6 },
    ]);
    expect(lecturaPostes(estado).map((l) => [l.sombra, l.alcance])).toEqual([
      [2, 'toca'],
      [6, 'toca'],
    ]);
    expect(evaluar(puzzle, 1, estado)?.resuelta).toBe(true);
    // El estado original no se toca.
    expect(inicial(1).postes[1]?.distancia).toBe(4);
  });

  it('dominar: la sombra del marcador en la cinta y la del poste, sin sensores', () => {
    const e = datos(2);
    expect(sombraMarcador(e, 45)).toBe(8);
    expect(sombraMarcador(e, 53)).toBe(6);
    expect(sombraMarcador(e, 63)).toBe(4);
    expect(sombraMarcador(e, 27)).toBe(16);
    expect(sombraMarcador(datos(0), 45)).toBeNull();
    expect(lecturaPostes(conMuesca(inicial(2), 53))).toEqual([
      { id: 'poste-2', altura: 2, sombra: 1.5, distancia: null, alcance: null },
    ]);
  });

  it('dominar: el gancho queda corto, justo o pasa de largo', () => {
    const e = datos(2);
    expect(lecturaPolea(e, 3)).toBe('corta');
    expect(lecturaPolea(e, 8)).toBe('toca');
    expect(lecturaPolea(e, 9)).toBe('larga');
    expect(lecturaPolea(e, null)).toBeNull();
    expect(lecturaPolea(datos(0), 8)).toBeNull();
    const estado = conPolea(conMuesca(inicial(2), 45), 8);
    expect(esEstadoReflector(e, estado)).toBe(true);
    expect(evaluar(puzzle, 2, estado)?.resuelta).toBe(true);
  });
});

describe('reflector: textos del panel (T58)', () => {
  it('los metros se escriben con coma decimal y un decimal como máximo', () => {
    expect(metros(2)).toBe('2 m');
    expect(metros(1.5)).toBe('1,5 m');
    expect(metros(32 / 3)).toBe('10,7 m');
    expect(metros(8 / 3)).toBe('2,7 m');
    expect(metros(16)).toBe('16 m');
  });

  it('cada poste cuenta cuánto mide su sombra y dónde cae la punta', () => {
    const lectura = (muesca: number) => {
      const l = lecturaPostes(conMuesca(inicial(0), muesca))[0];
      if (!l) throw new Error('sin poste');
      return textoPoste(l);
    };
    expect(lectura(45)).toBe('Poste de 2 m: su sombra mide 2 m. La punta toca el sensor y suena.');
    expect(lectura(63)).toBe(
      'Poste de 2 m: su sombra mide 1 m. La punta se queda antes del sensor, que está a 2 m.',
    );
    expect(lectura(27)).toBe(
      'Poste de 2 m: su sombra mide 4 m. La punta pasa de largo del sensor, que está a 2 m.',
    );
    const sinSensor = lecturaPostes(conMuesca(inicial(2), 53))[0];
    expect(sinSensor && textoPoste(sinSensor)).toBe('Poste de 2 m: su sombra mide 1,5 m.');
  });

  it('el marcador y la polea cuentan lo que pasó, sin decir la altura que falta', () => {
    expect(textoMarcador(6)).toBe('Marcador: su sombra llega hasta los 6 m de la cinta del piso.');
    expect(textoPolea(3, 'corta')).toBe(
      'Soltaste 3 m de cuerda y el gancho subió 3 m. Quedó colgando por debajo del marcador, sin alcanzarlo.',
    );
    expect(textoPolea(9, 'larga')).toContain('Pasó de largo');
    expect(textoPolea(8, 'toca')).toContain('lo enganchó');
    expect(nombreSensor(3)).toBe('Sensor del poste de 3 m');
  });

  it('ningún texto dice «incorrecto», «error» ni «mal»', () => {
    const textos = [
      ...[27, 37, 45, 53, 63].flatMap((m) =>
        [0, 1, 2].flatMap((n) => lecturaPostes(conMuesca(inicial(n), m)).map(textoPoste)),
      ),
      textoPolea(1, 'corta'),
      textoPolea(9, 'larga'),
      textoPolea(8, 'toca'),
      textoMarcador(8),
    ];
    for (const t of textos) expect(t).not.toMatch(/incorrect|error|\bmal\b|fall/i);
  });
});

describe('reflector: animación en la escena (T58)', () => {
  afterEach(reiniciarMecanismo);

  /** Entra al gimnasio con unos ajustes y deja pasar el tiempo hasta que todo llegue. */
  function montar() {
    const sala = construirSala(salaPorId('s3-gimnasio'));
    const antes = contarMallas(sala.raiz);
    const animador = animacionDeSala('s3-gimnasio', sala.raiz);
    if (!animador) throw new Error('el gimnasio no tiene animación');
    const asentar = (): void => {
      for (let i = 0; i < 240; i++) animador.actualizar(1 / 30);
    };
    const reflector = sala.raiz.getObjectByName('s3-reflector');
    const postes = sala.raiz.getObjectByName('s3-postes');
    if (!reflector || !postes) throw new Error('faltan piezas del gimnasio');
    const nuevas = (): Mesh[] => {
      const lista: Mesh[] = [];
      for (const o of sala.raiz.children) {
        if ((o as Mesh).isMesh && !o.name && !o.userData['id']) lista.push(o as Mesh);
      }
      return lista;
    };
    return { sala, animador, asentar, reflector, postes, antes, nuevas };
  }

  function contarMallas(raiz: Object3D): number {
    let n = 0;
    raiz.traverse((o) => {
      if ((o as Mesh).isMesh) n++;
    });
    return n;
  }

  function poner(n: number, estado: Estado): void {
    etapa.value = { sala: 's3-gimnasio', puzzle: puzzle.id, etapa: n };
    mecanismo.value = estado;
    condiciones.value = evaluar(puzzle, n, estado)?.condiciones ?? {};
  }

  it('los postes del riel de salas.json son los de 1, 2 y 3 m, en ese orden', () => {
    const riel = salaPorId('s3-gimnasio').objetos.find((o) => o.id === 's3-postes');
    expect(riel?.partes?.slice(1).map((p) => p.tam[1])).toEqual([...ALTURAS_POSTES]);
    // La franja de sensores está a 2 m del riel, como los sensores fijos del puzzle.
    const sensores = salaPorId('s3-gimnasio').objetos.find((o) => o.id === 's3-sensores');
    expect((sensores?.pos[2] ?? 0) - (riel?.pos[2] ?? 0)).toBe(RIEL_A_SENSORES);
  });

  it('la sala no pasa de 40 mallas con las de la animación', () => {
    const { sala, antes } = montar();
    expect(contarMallas(sala.raiz) - antes).toBe(8);
    expect(contarMallas(sala.raiz)).toBeLessThanOrEqual(40);
  });

  it('presentar: solo el poste de 2 m, con su sombra, y el reflector en su muesca', () => {
    const { asentar, reflector, postes, nuevas } = montar();
    poner(0, conMuesca(inicial(0), 45));
    asentar();
    expect(postes.children.slice(1).map((p) => p.visible)).toEqual([false, true, false]);
    expect(reflector.rotation.x).toBeCloseTo((45 * Math.PI) / 180, 3);
    const sombras = nuevas().filter((m) => m.visible && m.geometry.type === 'PlaneGeometry');
    expect(sombras).toHaveLength(1);
    expect(sombras[0]?.scale.z).toBeCloseTo(2, 2);
    // La sombra nace en la base del poste de 2 m (x = 2, z = −1) y va hacia los sensores.
    expect(sombras[0]?.position.x).toBeCloseTo(2, 3);
    expect(sombras[0]?.position.z).toBeCloseTo(-1, 3);

    poner(0, conMuesca(inicial(0), 27));
    asentar();
    expect(reflector.rotation.x).toBeCloseTo((63 * Math.PI) / 180, 3);
    expect(
      nuevas().filter((m) => m.visible && m.geometry.type === 'PlaneGeometry')[0]?.scale.z,
    ).toBeCloseTo(4, 2);
  });

  it('torcer: el poste de 3 m se aleja de su sensor y su sombra llega hasta él', () => {
    const { asentar, postes, nuevas } = montar();
    poner(1, conDistancia(conMuesca(inicial(1), 27), 'poste-3', 6));
    asentar();
    expect(postes.children.slice(1).map((p) => p.visible)).toEqual([true, false, true]);
    // A 6 m del sensor: 4 m más atrás que el riel (z local 0 → −4).
    expect(postes.children[3]?.position.z).toBeCloseTo(-4, 2);
    expect(postes.children[1]?.position.z).toBeCloseTo(0, 3);
    const largos = nuevas()
      .filter((m) => m.visible && m.geometry.type === 'PlaneGeometry')
      .map((m) => Math.round(m.scale.z * 100) / 100)
      .sort((a, b) => a - b);
    expect(largos).toEqual([2, 6]);
  });

  it('dominar: la sombra del marcador y el gancho, que sube al soltar la polea', () => {
    const { asentar, nuevas } = montar();
    const estado = conPolea(conMuesca(inicial(2), 53), 5);
    poner(2, estado);
    asentar();
    // El gancho es la única pieza nueva con luz (las sombras y los sensores no la tienen).
    const gancho = nuevas().find(
      (m) => (m.material as { type: string }).type === 'MeshLambertMaterial',
    );
    expect(gancho?.visible).toBe(true);
    expect(gancho?.position.y).toBeCloseTo(0.4, 2);
    // Poste de 2 m (1,5 m de sombra) y marcador (6 m de sombra).
    const largos = nuevas()
      .filter((m) => m.visible && m.geometry.type === 'PlaneGeometry')
      .map((m) => Math.round(m.scale.z * 100) / 100)
      .sort((a, b) => a - b);
    expect(largos).toEqual([1.5, 6]);

    resultado.value = {
      n: 1,
      sala: 's3-gimnasio',
      puzzle: puzzle.id,
      etapa: 2,
      estado,
      condiciones: { polea: false },
      resuelta: false,
      sello: false,
    };
    asentar();
    expect(gancho?.position.y).toBeCloseTo(5, 2);
  });

  it('con la sala resuelta vuelven los tres postes y no quedan sombras', () => {
    const { asentar, postes, nuevas } = montar();
    poner(1, conDistancia(conMuesca(inicial(1), 27), 'poste-3', 6));
    asentar();
    reiniciarMecanismo();
    asentar();
    expect(postes.children.slice(1).map((p) => p.visible)).toEqual([true, true, true]);
    expect(postes.children[3]?.position.z).toBeCloseTo(0, 2);
    expect(nuevas().filter((m) => m.visible)).toEqual([]);
  });

  it('al liberarse deja de seguir los signals, y las mallas nuevas no reciben toques', () => {
    const { animador, asentar, reflector, nuevas } = montar();
    poner(0, conMuesca(inicial(0), 45));
    asentar();
    const giro = reflector.rotation.x;
    animador.liberar();
    poner(0, conMuesca(inicial(0), 27));
    asentar();
    expect(reflector.rotation.x).toBe(giro);
    for (const m of nuevas()) expect(m.raycast.toString()).not.toContain('intersect');
  });

  it('acercar llega a la meta sin pasarse', () => {
    let v = 0;
    for (let i = 0; i < 200; i++) v = acercar(v, 3, 1 / 30);
    expect(v).toBe(3);
    expect(acercar(0, 1, 10)).toBe(1);
  });
});
