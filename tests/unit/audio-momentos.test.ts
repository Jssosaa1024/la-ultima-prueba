import { batch } from '@preact/signals';
import { afterEach, describe, expect, it } from 'vitest';
import {
  condicionesNuevas,
  efectoDeAjuste,
  efectoDeUso,
  ETAPAS_EN_VIVO,
  escucharMomentos,
  respondeEnVivo,
} from '../../src/engine/audio/momentos';
import { EFECTOS } from '../../src/engine/audio/sintesis';
import { PUZZLES } from '../../src/content/puzzles';
import { abrirPanel, avisar, enfocado, reiniciarInterfaz } from '../../src/signals/interfaz';
import { condiciones, etapa, mecanismo, reiniciarMecanismo } from '../../src/signals/mecanismo';
import { fase, grabaciones, inventario, reiniciarPartida, sala } from '../../src/signals/partida';

// T42c: puertas, objetos que se usan o se recogen y controles de las máquinas.

afterEach(() => {
  reiniciarPartida();
  reiniciarInterfaz();
  reiniciarMecanismo();
});

/** Escucha los momentos y devuelve lo que sonó y cómo dejar de escuchar. */
function escuchar() {
  const sonidos: string[] = [];
  const dejar = escucharMomentos((n) => sonidos.push(n));
  return { sonidos, dejar };
}

describe('reglas', () => {
  it('cada objeto usado suena con un efecto que existe; la registradora con sus teclas', () => {
    expect(efectoDeUso('s1-registradora')).toBe('teclas');
    expect(efectoDeUso('porteria-intercomunicador')).toBe('interfono');
    expect(efectoDeUso('s2-palanca')).toBe('clac');
    expect(efectoDeUso(null)).toBe('clac');
    for (const p of PUZZLES) expect(EFECTOS).toHaveProperty(efectoDeAjuste(p.id));
    expect(efectoDeAjuste('s4-carritos')).toBe('libro');
    expect(efectoDeAjuste('s5-urna')).toBe('ficha');
  });

  it('solo hacen bip las etapas que responden solas (reposo), nunca las de palanca', () => {
    for (const p of PUZZLES) {
      p.etapas.forEach((e, i) => {
        const enVivo = respondeEnVivo({ sala: 's1-cooperativa', puzzle: p.id, etapa: i });
        expect(enVivo, `${p.id} etapa ${i}`).toBe(e.intento.tipo === 'reposo');
      });
    }
    expect(Object.keys(ETAPAS_EN_VIVO)).toEqual(['s3-reflector', 's4-carritos']);
    expect(respondeEnVivo(null)).toBe(false);
  });

  it('cuenta las condiciones que se acaban de cumplir', () => {
    expect(condicionesNuevas({}, { media: true, mediana: false })).toBe(1);
    expect(condicionesNuevas({ media: true }, { media: true, moda: true })).toBe(1);
    expect(condicionesNuevas({ media: true }, { media: false })).toBe(0);
  });
});

describe('escucharMomentos', () => {
  it('jugando, cambiar de sala abre una puerta y recoger algo suena', () => {
    fase.value = 'jugando';
    const { sonidos, dejar } = escuchar();
    sala.value = 's1-cooperativa';
    sala.value = 'porteria';
    inventario.value = [{ id: 'porteria-linterna', nombre: 'Linterna' }];
    grabaciones.value = ['grab-1'];
    expect(sonidos).toEqual(['puerta', 'puerta', 'recoger', 'recoger']);
    dejar();
    sala.value = 's1-cooperativa';
    expect(sonidos).toHaveLength(4);
  });

  it('empezar, continuar o salir de una partida no suena como una puerta', () => {
    const { sonidos, dejar } = escuchar();
    // «Continuar partida»: fase, sala e inventario cambian a la vez.
    fase.value = 'jugando';
    expect(sonidos).toEqual([]);
    reiniciarPartida();
    expect(sonidos).toEqual([]);
    dejar();
  });

  it('una puerta cerrada traquetea cada vez que se toca', () => {
    const { sonidos, dejar } = escuchar();
    avisar({ t: 'puerta_cerrada', sala: 2 });
    avisar({ t: 'puerta_cerrada', sala: 2 });
    avisar({ t: 'necesita_herramienta', objeto: 's1-pizarra', herramienta: 'porteria-linterna' });
    expect(sonidos).toEqual(['puerta-cerrada', 'puerta-cerrada']);
    dejar();
  });

  it('usar la registradora suena con teclas; los paneles del HUD no suenan', () => {
    const { sonidos, dejar } = escuchar();
    enfocado.value = { id: 's1-registradora', nombre: 'Registradora', accion: 'usar' };
    abrirPanel('mecanismo');
    abrirPanel('pistas');
    abrirPanel('pausa');
    enfocado.value = { id: 'porteria-salida', nombre: 'Salida', accion: 'usar' };
    abrirPanel('salida');
    expect(sonidos).toEqual(['teclas', 'clac']);
    dejar();
  });

  it('mover un control hace clic; en la biblioteca, cada lámpara que se enciende hace bip', () => {
    etapa.value = { sala: 's1-cooperativa', puzzle: 's1-etiquetadora', etapa: 0 };
    mecanismo.value = { rodillos: [] };
    const { sonidos, dejar } = escuchar();
    mecanismo.value = { rodillos: [-20] };
    // En la etiquetadora la condición se cumple antes de bajar la palanca: no se delata.
    condiciones.value = { precio: true };
    expect(sonidos).toEqual(['clic']);

    // Pasar a la biblioteca cambia la etapa, los ajustes y las condiciones: nada suena.
    batch(() => {
      etapa.value = { sala: 's4-biblioteca', puzzle: 's4-carritos', etapa: 2 };
      mecanismo.value = { carritos: [0, 0, 0, 0, 0] };
      condiciones.value = { media: false, mediana: false };
    });
    expect(sonidos).toEqual(['clic']);

    mecanismo.value = { carritos: [1, 0, 0, 0, 0] };
    condiciones.value = { media: true, mediana: false };
    expect(sonidos).toEqual(['clic', 'libro', 'bip']);
    dejar();
  });
});
