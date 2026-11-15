/// <reference types="astro/client" />

// Variables públicas del build (T79). Solo la URL y la clave anon de Supabase; nunca la
// `service_role`. Sin ellas, el cooperativo en línea no está disponible y el modo individual
// funciona igual.
interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_ANON_KEY?: string;
}
