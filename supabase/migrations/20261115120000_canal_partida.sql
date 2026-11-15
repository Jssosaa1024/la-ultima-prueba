-- T78 · Políticas RLS del canal privado del cooperativo.
--
-- Supabase Realtime autoriza los canales privados con políticas sobre `realtime.messages`.
-- Solo se usan Broadcast y Presence (sin tablas propias ni datos guardados): estas políticas
-- dejan entrar únicamente a usuarios con sesión (la sesión anónima cuenta como
-- `authenticated`) y solo a canales con la forma `partida:XXXX`, donde XXXX es un código del
-- alfabeto del juego (sin 0, O, 1, I ni L; ver `src/net/protocolo.ts`).
--
-- Cómo aplicarlo: en el panel de Supabase, «SQL Editor» → «New query», pegar todo este
-- archivo y pulsar «Run». Se puede correr más de una vez: primero borra las políticas.

drop policy if exists "partida: recibir broadcast y presence" on realtime.messages;
drop policy if exists "partida: enviar broadcast y presence" on realtime.messages;

-- Recibir mensajes y ver quién está en el canal.
create policy "partida: recibir broadcast y presence"
on realtime.messages
for select
to authenticated
using (
  (select realtime.topic()) ~ '^partida:[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}$'
  and realtime.messages.extension in ('broadcast', 'presence')
);

-- Enviar mensajes y publicar la propia identidad en Presence.
create policy "partida: enviar broadcast y presence"
on realtime.messages
for insert
to authenticated
with check (
  (select realtime.topic()) ~ '^partida:[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}$'
  and realtime.messages.extension in ('broadcast', 'presence')
);
