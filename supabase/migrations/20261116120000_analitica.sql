-- T98 · Analítica sin cookies ni datos personales: contadores agregados.
--
-- Una sola tabla de contadores por día y una función que solo suma 1. El navegador llama a la
-- función con la clave pública (anon) y tres textos de listas cerradas; no puede leer, borrar
-- ni cambiar la tabla. No se guarda id de jugador, código de partida, IP, navegador ni texto
-- libre: solo cuántas veces pasó cada cosa cada día.
--
-- Eventos (la misma lista que `src/game/analitica.ts`):
--   partida_iniciada   modo: solo | grupo   detalle: '' (vacío)
--   sala_resuelta      modo: solo | grupo   detalle: s1 | s2 | s3 | s4 | s5
--   partida_terminada  modo: solo | grupo   detalle: 0-10 | 10-20 | 20-30 | 30-40 (minutos de reloj)
--
-- Cómo aplicarlo: en el panel de Supabase, «SQL Editor» → «New query», pegar todo este
-- archivo y pulsar «Run». Se puede correr más de una vez: no borra los contadores.

create table if not exists public.analitica_contadores (
  dia date not null,
  evento text not null,
  modo text not null,
  detalle text not null default '',
  total bigint not null default 0,
  primary key (dia, evento, modo, detalle)
);

comment on table public.analitica_contadores is
  'T98: contadores agregados por día. Sin datos personales. Solo la función contar_evento escribe.';

-- Nadie entra a la tabla por la API: ni anon ni authenticated pueden leerla o cambiarla.
alter table public.analitica_contadores enable row level security;
revoke all on table public.analitica_contadores from anon, authenticated;

-- La única puerta: suma 1 al contador del día si los tres valores están en las listas.
-- `security definer` porque quien llama no tiene permiso sobre la tabla; `search_path` vacío
-- para que nadie pueda colar otra tabla con el mismo nombre.
create or replace function public.contar_evento(evento text, modo text, detalle text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if modo is null or modo not in ('solo', 'grupo') then
    return;
  end if;
  if not (
    (evento = 'partida_iniciada' and detalle = '')
    or (evento = 'sala_resuelta' and detalle in ('s1', 's2', 's3', 's4', 's5'))
    or (evento = 'partida_terminada' and detalle in ('0-10', '10-20', '20-30', '30-40'))
  ) then
    return;
  end if;
  -- Los parámetros se nombran con la función delante para no confundirlos con las columnas.
  insert into public.analitica_contadores as c (dia, evento, modo, detalle, total)
  values (
    (now() at time zone 'America/Bogota')::date,
    contar_evento.evento,
    contar_evento.modo,
    contar_evento.detalle,
    1
  )
  on conflict on constraint analitica_contadores_pkey do update set total = c.total + 1;
end;
$$;

revoke all on function public.contar_evento(text, text, text) from public;
grant execute on function public.contar_evento(text, text, text) to anon, authenticated;
