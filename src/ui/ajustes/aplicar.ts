import { effect } from '@preact/signals';
import { ajustes } from '../../signals/ajustes';
import './ajustes.css';

/**
 * Lleva el tamaño del texto (T39) a `<html data-texto>`: la interfaz mide sus letras en
 * `rem`, así que todo crece junto. Devuelve la función que deja de seguir el ajuste.
 */
export function aplicarTamanoTexto(raiz: HTMLElement = document.documentElement): () => void {
  const dejar = effect(() => {
    const texto = ajustes.value.texto;
    if (texto === 'normal') delete raiz.dataset['texto'];
    else raiz.dataset['texto'] = texto;
  });
  return () => {
    dejar();
    delete raiz.dataset['texto'];
  };
}
