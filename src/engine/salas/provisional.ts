/**
 * Escena provisional (T12): un salón de 8 × 6 m hecho con primitivas, para tener algo
 * que mirar mientras llegan las salas por código. Se reemplaza en la tarea «salas por código».
 */
import {
  BoxGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
} from 'three';
import { marcarInteractivo } from '../interaccion/interaccion';
import { marcarSolido } from './colisiones';

const ANCHO = 8;
const FONDO = 6;
const ALTO = 3;

export function crearEscenaProvisional(): Group {
  const sala = new Group();
  sala.name = 'provisional';

  const piso = new Mesh(
    new PlaneGeometry(ANCHO, FONDO),
    new MeshLambertMaterial({ color: 0x6b5b4b }),
  );
  piso.rotation.x = -Math.PI / 2;
  sala.add(piso);

  // Paredes de 10 cm de grosor, por fuera del piso: sólidas para el jugador (T17).
  const pared = new MeshLambertMaterial({ color: 0xd9d2c3 });
  const GROSOR = 0.1;
  const muro = (ancho: number, fondo: number, x: number, z: number): Mesh => {
    const m = new Mesh(new BoxGeometry(ancho, ALTO, fondo), pared);
    m.position.set(x, ALTO / 2, z);
    return marcarSolido(m);
  };
  sala.add(
    muro(ANCHO, GROSOR, 0, -(FONDO + GROSOR) / 2),
    muro(ANCHO, GROSOR, 0, (FONDO + GROSOR) / 2),
    muro(GROSOR, FONDO, -(ANCHO + GROSOR) / 2, 0),
    muro(GROSOR, FONDO, (ANCHO + GROSOR) / 2, 0),
  );

  // Muebles de referencia: una mesa y dos cajas, para ver profundidad y escala.
  const madera = new MeshLambertMaterial({ color: 0x8a5a2b });
  const mesa = marcarSolido(new Mesh(new BoxGeometry(1.6, 0.75, 0.8), madera));
  mesa.position.set(0, 0.375, -1.5);
  const caja = marcarSolido(
    new Mesh(new BoxGeometry(0.6, 0.6, 0.6), new MeshLambertMaterial({ color: 0x2f5d8a })),
  );
  caja.position.set(-2.5, 0.3, -2);
  const caja2 = caja.clone();
  caja2.position.set(2.8, 0.3, 1.5);
  sala.add(mesa, caja, caja2);

  // Objetos de prueba para tocar (T18): un cartel para examinar y un libro para recoger.
  // Lo que se recoge no es sólido: al desaparecer no debe dejar un obstáculo invisible.
  marcarInteractivo(caja, { id: 'prueba-caja', nombre: 'Caja azul', accion: 'examinar' });
  const cartel = marcarInteractivo(
    new Mesh(new PlaneGeometry(1, 0.7), new MeshLambertMaterial({ color: 0xe8a33d })),
    { id: 'prueba-cartel', nombre: 'Cartel de la pared', accion: 'examinar' },
  );
  cartel.position.set(0, 1.45, -FONDO / 2 + 0.01);
  const libro = marcarInteractivo(
    new Mesh(new BoxGeometry(0.22, 0.05, 0.16), new MeshLambertMaterial({ color: 0xb03a2e })),
    { id: 'prueba-libro', nombre: 'Libro rojo', accion: 'recoger' },
  );
  libro.position.set(2.8, 0.625, 1.5);
  sala.add(cartel, libro);

  // Dos luces dinámicas como máximo (presupuesto); el resto irá horneado.
  const cielo = new HemisphereLight(0xf2f0ff, 0x3a3028, 1.6);
  const sol = new DirectionalLight(0xfff2dd, 1.4);
  sol.position.set(2, 4, 3);
  sala.add(cielo, sol);

  return sala;
}
