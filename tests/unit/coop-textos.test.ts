import { describe, expect, it } from 'vitest';
import type { JugadorCoop } from '../../src/signals/coop';
import {
  aliasDe,
  lista,
  queSeVota,
  textoCuenta,
  textoEncargos,
  textoEsperaD,
  textoVoto,
} from '../../src/ui/coop/textos';

// T85 y T87: lo que el grupo lee sobre propuestas, votos y la espera de D.

const j = (jugador: string, alias: JugadorCoop['alias'], extra: Partial<JugadorCoop> = {}) =>
  ({
    jugador,
    alias,
    color: 'ambar',
    listo: true,
    conectado: true,
    anfitrion: false,
    yo: false,
    eligiendo: false,
    ...extra,
  }) satisfies JugadorCoop;

const grupo = [j('j_a', 'zorro', { yo: true }), j('j_b', 'buho'), j('j_c', 'rana')];

describe('textos del grupo', () => {
  it('nombra a cada uno por su alias y a este jugador como «tú»', () => {
    expect(aliasDe(grupo, 'j_b')).toBe('Búho');
    expect(aliasDe(grupo, 'j_a')).toBe('tú');
    expect(lista(['Zorro', 'Rana', 'Oso'])).toBe('Zorro, Rana y Oso');
  });

  it('dice qué se vota y quién lo propone', () => {
    expect(queSeVota({ asunto: 'sala', opcion: 's1-cooperativa' })).toBe('ir a La cooperativa');
    expect(queSeVota({ asunto: 'final', opcion: 'restaurar' })).toBe(
      'restaurar el archivo y salir',
    );
    expect(textoVoto({ asunto: 'pausa', opcion: null, votos: ['j_b'] }, grupo)).toBe(
      'Búho propone pausar el reloj.',
    );
    expect(textoVoto({ asunto: 'pausa', opcion: null, votos: ['j_a'] }, grupo)).toBe(
      'Propones pausar el reloj.',
    );
  });

  it('cuenta solo a los conectados y dice quién falta', () => {
    expect(textoCuenta(['j_b'], grupo)).toBe('Aceptaron 1 de 3. Faltan tú y Rana.');
    const sinRana = [grupo[0], grupo[1], j('j_c', 'rana', { conectado: false })] as JugadorCoop[];
    expect(textoCuenta(['j_a', 'j_b'], sinRana)).toBe('Aceptaron 2 de 2.');
  });

  it('la espera de D muestra el tiempo que falta', () => {
    expect(textoEsperaD('Búho', 42_000)).toContain('Esperando a Búho');
    expect(textoEsperaD('Búho', 42_000)).toContain('00:42');
    expect(textoEncargos(['C', 'D'])).toBe('Tus encargos: C y D');
    expect(textoEncargos(['A'])).toBe('Tu encargo: A');
  });
});
