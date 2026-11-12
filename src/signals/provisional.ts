import { batch } from '@preact/signals';
import { datosEncontrados, limpiarNota, notas, reiniciarCuaderno } from './cuaderno';
import { enfocarSiguiente, quitarEjemplo } from './ejemplo';
import { abrirInspeccion, enfocado, reiniciarInterfaz, type AccionObjeto } from './interfaz';
import {
  fase,
  final,
  inventario,
  modo,
  reiniciarPartida,
  reloj,
  restanteEn,
  sala,
} from './partida';
import { escuchar, type Comando } from './puente';

/**
 * Controlador PROVISIONAL de la partida individual.
 *
 * La lógica real vive en `game/` (máquina de estados T24, reloj T25, finales T28), que
 * todavía no está en `main`. Mientras tanto, este módulo atiende las órdenes del puente con
 * lo mínimo para que las pantallas funcionen. Cuando llegue `game/`, se borra este archivo y
 * su controlador se suscribe con `escuchar()` en su lugar.
 */

const ahora = (): number => performance.now();

let contadorNotas = 0;
const nuevoIdNota = (): string => `n${++contadorNotas}`;

function pausar(): void {
  const r = reloj.value;
  if (r.pausado) return;
  const t = ahora();
  reloj.value = { restanteMs: restanteEn(r, t), pausado: true, desde: t };
}

function reanudar(): void {
  const r = reloj.value;
  if (!r.pausado || fase.value !== 'jugando') return;
  reloj.value = { ...r, pausado: false, desde: ahora() };
}

function atender(comando: Comando): void {
  switch (comando.t) {
    case 'iniciar':
      // El cooperativo aún no existe: solo se atiende el modo individual.
      if (comando.modo !== 'individual') return;
      reiniciarInterfaz();
      batch(() => {
        reiniciarPartida();
        reiniciarCuaderno();
        modo.value = 'individual';
        sala.value = 'porteria';
        fase.value = 'jugando';
        // En el modo individual se empieza con linterna (y el cuaderno, que va en el HUD).
        inventario.value = [{ id: 'linterna', nombre: 'Linterna' }];
        reloj.value = { ...reloj.value, pausado: false, desde: ahora() };
      });
      return;
    case 'salir':
      quitarEjemplo();
      reiniciarInterfaz();
      reiniciarPartida();
      reiniciarCuaderno();
      return;
    case 'pausar':
      pausar();
      return;
    case 'reanudar':
      reanudar();
      return;
    case 'elegir_final':
      batch(() => {
        pausar();
        final.value = comando.final;
        fase.value = 'final';
      });
      return;
    case 'accion':
      atenderAccion(comando.objeto, comando.accion);
      return;
    case 'nota':
      if (comando.op === 'agregar') {
        const texto = limpiarNota(comando.texto);
        if (texto) notas.value = [...notas.value, { id: nuevoIdNota(), texto }];
      } else {
        notas.value = notas.value.filter((n) => n.id !== comando.id);
      }
      return;
  }
}

function atenderAccion(objeto: string, accion: AccionObjeto): void {
  const actual = enfocado.value;
  if (!actual || actual.id !== objeto) return;
  batch(() => {
    if (accion === 'examinar') {
      abrirInspeccion(objeto);
      // Lo que se inspecciona queda anotado en «Datos encontrados» del cuaderno.
      if (!datosEncontrados.value.includes(objeto)) {
        datosEncontrados.value = [...datosEncontrados.value, objeto];
      }
    }
    if (accion === 'recoger' && !inventario.value.some((o) => o.id === objeto)) {
      inventario.value = [...inventario.value, { id: objeto, nombre: actual.nombre }];
    }
    // «Usar» una herramienta sobre un objeto llega con la lógica del juego.
    enfocado.value = null;
    enfocarSiguiente();
  });
}

/** Empieza a atender órdenes. Devuelve la función para detenerlo. */
export function iniciarControladorProvisional(): () => void {
  return escuchar(atender);
}
