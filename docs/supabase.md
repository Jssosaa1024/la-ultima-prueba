# Supabase para el cooperativo · pasos para Alex

15 de noviembre de 2026 · T78 y T79

El modo cooperativo usa Supabase solo para dos cosas:

- una **sesión anónima** para cada jugador, sin correo, nombre ni contraseña;
- un **canal privado** por partida (`partida:K7MP`) para enviar mensajes y saber quién está conectado.

No hay tablas, no se guarda nada y no hay servidor propio. El código ya está listo: falta crear el proyecto y poner dos valores en Cloudflare Pages.

**Nadie ha probado esto con un proyecto real todavía.** Las pruebas usan un Supabase simulado. Si un paso del panel no se ve igual, busca el nombre entre comillas en el buscador del panel.

Mientras no hagas esto, el juego individual funciona igual. El cooperativo solo funciona entre pestañas del mismo navegador, que sirve para las pruebas pero no para jugar en el salón.

## 1. Crear el proyecto (una sola vez, unos 5 minutos)

1. Entra a [supabase.com](https://supabase.com) e inicia sesión (o crea la cuenta).
2. Pulsa **New project**.
   - **Name:** `la-ultima-prueba`.
   - **Database password:** pulsa «Generate a password» y guárdala en tu gestor de contraseñas. El juego no la usa; no la compartas.
   - **Region:** la más cercana a Colombia que aparezca (por ejemplo, «East US» o «South America (São Paulo)»).
   - **Plan:** Free.
3. Pulsa **Create new project** y espera a que diga que está listo (uno o dos minutos).

## 2. Activar la sesión anónima

1. En el menú de la izquierda: **Authentication** → **Sign In / Providers**.
2. Activa **Allow anonymous sign-ins** y pulsa **Save**.
3. En **Authentication** → **Rate Limits**, busca el límite de **sesiones anónimas por hora** (por defecto, 30 por dirección IP). Súbelo a **150** y guarda.
   - Un salón entero sale a internet con la misma IP: con 30, el estudiante 31 de esa hora no podría entrar.

## 3. Hacer privados los canales

1. En el menú: **Realtime** → **Settings**.
2. Desactiva **Allow public access** y guarda.
   - Así solo entran a los canales quienes cumplen las reglas del paso 4.

## 4. Pegar las reglas de los canales (SQL)

1. En el menú: **SQL Editor** → **New query**.
2. Abre en GitHub el archivo [`supabase/migrations/20261115120000_canal_partida.sql`](../supabase/migrations/20261115120000_canal_partida.sql), pulsa el botón de copiar («Copy raw file») y pégalo completo en el editor.
3. Pulsa **Run**. Debe decir «Success. No rows returned».
   - Si lo corres dos veces no pasa nada: primero borra las reglas viejas.

Qué hacen estas reglas: solo un jugador con sesión puede entrar, y solo a un canal con la forma `partida:` más un código de 4 caracteres del juego. Y solo para mensajes y presencia: nada se guarda.

## 5. Copiar los dos valores públicos

1. En el menú: **Project Settings** (la rueda dentada) → **API** (o **Data API**).
2. Copia dos cosas:
   - **Project URL**: se ve como `https://abcdefghijkl.supabase.co`.
   - La clave **anon public** (o **publishable**). Es una cadena larga que empieza por `eyJ` o por `sb_publishable_`.
3. **No copies nunca la clave `service_role` ni la `secret`.** Esa clave abre todo el proyecto y no va en el juego, ni en GitHub, ni en Cloudflare, ni en un chat.

Las dos que sí copias son públicas a propósito: el navegador de cada jugador las ve. Lo que protege la partida son las reglas del paso 4.

## 6. Ponerlas en Cloudflare Pages

1. Entra a [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → el proyecto **la-ultima-prueba**.
2. **Settings** → **Variables and Secrets** (puede decir **Environment variables**) → **Add**.
3. Agrega dos variables, de tipo **Text** (no hace falta «Secret», son públicas), en **Production** y también en **Preview**:

   | Nombre | Valor |
   | --- | --- |
   | `PUBLIC_SUPABASE_URL` | la Project URL del paso 5 |
   | `PUBLIC_SUPABASE_ANON_KEY` | la clave anon o publishable del paso 5 |

   Los nombres van exactos, en mayúsculas y con guion bajo. Si la URL no termina en `.supabase.co` o la clave está incompleta, el juego la ignora.

4. Pulsa **Save**.
5. Los valores entran al construir el sitio. Ve a **Deployments**, abre el último de `main` y pulsa **Retry deployment**. Las ramas nuevas ya los tomarán solas.

## 7. En el computador (opcional)

Para probar en local con el Supabase real hace falta un archivo `.env` en la carpeta del proyecto, con las mismas dos líneas. Ese archivo está en `.gitignore`: nunca se sube a GitHub.

No tienes que crearlo tú: pásale los dos valores públicos a la sesión que esté trabajando y ella lo crea a partir de `.env.example`.

## 8. Cómo saber que funciona

Todavía no hay pantalla del cooperativo: la sala de espera (T81) y la conexión con la interfaz las hacen otras sesiones. Cuando estén:

1. Abre la vista previa en dos celulares.
2. En uno, crea una partida y anota el código. En el otro, únete con ese código.
3. Los dos deben verse en la lista de la sala de espera.

Si en el panel de Supabase, en **Realtime** → **Inspector**, aparece un canal `partida:XXXX` mientras juegan, la conexión llega.

## Cosas para tener en cuenta

- **El plan Free se pausa** si el proyecto pasa una semana sin uso. Si el cooperativo deja de conectar después de unos días quieto, entra al panel y pulsa **Restore project**.
- **Límites del plan Free:** 200 conexiones a la vez y 100 mensajes por segundo. Alcanza para unas 3 partidas de 4 jugadores al mismo tiempo; el plan del juego es máximo 2 (especificación, «Costo frente a los límites de Supabase»).
- **El código de partida es la llave.** Cualquiera con sesión que adivine un código activo puede entrar al canal. Hay unos 923.000 códigos posibles, el anfitrión rechaza al quinto jugador y a quien llega con la partida empezada, y por el canal solo viajan ids y números, nunca texto escrito por los jugadores.
- **Datos de menores:** Supabase guarda un usuario anónimo por navegador, sin correo ni nombre. El alias se elige de una lista. No se guarda ninguna partida.

## Para quien programa

- `src/net/supabase.ts`: el transporte. Se carga con `import()` solo en el cooperativo.
- `src/net/index.ts`: `elegirRed()` usa Supabase si las dos variables están y tienen la forma esperada, salvo con `?red=pestanas`. Sin ellas usa BroadcastChannel y la interfaz debe mostrar `AVISO_SIN_SUPABASE`.
- Canal: `private: true`, `broadcast: { self: false, ack: true }` (T92b: Supabase no devuelve nada a quien envía; `int` y `evt` se entregan a uno mismo en el navegador al confirmarse y las poses no vuelven) y `presence: { key: jugador }`. Presence se escribe una vez por unión, porque Supabase permite 5 llamadas de Presence cada 30 s.
- Si el canal se vuelve a unir solo tras una caída, el transporte avisa con `alReconectar` y `ClienteCoop` aplica las reglas de T89 y T90.
