import { pulsaciones } from '../signals/demo';

/** Isla mínima que comprueba que Preact y Signals funcionan juntos. */
export default function Contador() {
  return (
    <button
      type="button"
      class="contador"
      onClick={() => {
        pulsaciones.value++;
      }}
    >
      Toques: {pulsaciones}
    </button>
  );
}
