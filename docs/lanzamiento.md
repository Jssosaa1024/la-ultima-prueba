# Lanzamiento de la versión 1.0.0

15 de noviembre de 2026 · prepara T102 (publicación: dominio, versión de contenido y etiqueta en git)

Esta guía dice qué hacer el día en que La Última Prueba pasa de «vista previa» a «publicada». Va después del piloto (T100) y de sus correcciones (T101): no se lanza con hallazgos graves abiertos.

Hoy el sitio vive en `https://la-ultima-prueba-duz.pages.dev` (rama `main`) y cada PR tiene su vista previa. Lanzar es: ponerle un dominio propio, congelar la versión del contenido, etiquetar el commit y revisar producción con una lista.

## 0. Antes de empezar

- [ ] Todas las tareas de la especificación que bloquean el lanzamiento están en `[x]`, en especial T93 (cuatro celulares), T96 (Safari en iPhone), T97 (celular de referencia) y T101 (hallazgos del piloto).
- [ ] `main` está en verde: la última vista previa de Cloudflare cargó y la suite e2e completa pasó.
- [ ] Supabase está configurado (`docs/supabase.md`, pasos 1 a 9) y las variables están en **Production**, no solo en **Preview**.
- [ ] Nadie está a mitad de un PR que cambie contenido (puzzles, salas, textos): el lanzamiento congela esa versión.

## 1. Dominio

### Escoger y comprar

- Un dominio corto y fácil de dictar en un salón, sin tildes ni eñes (por ejemplo, `laultimaprueba.co` o `.com`). Sin la palabra ICFES ni Saber.
- Si se compra en **Cloudflare Registrar** (dash.cloudflare.com → **Domain Registration** → **Register Domains**), el DNS queda listo solo. Si se compra en otro lado, hay que apuntarlo (abajo).
- La compra la hace Alex: necesita la tarjeta y la cuenta.

### Conectarlo a Cloudflare Pages

1. dash.cloudflare.com → **Workers & Pages** → el proyecto **la-ultima-prueba** → **Custom domains** → **Set up a custom domain**.
2. Escribe el dominio (por ejemplo, `laultimaprueba.co`) y pulsa **Continue**.
   - Si el dominio está en Cloudflare: pulsa **Activate domain** y listo.
   - Si está en otro registrador: Cloudflare muestra un registro **CNAME** con destino `la-ultima-prueba-duz.pages.dev`. Créalo en el panel de ese registrador y espera (de minutos a unas horas).
3. Repite con `www.` si quieres que también funcione (Cloudflare la redirige).
4. El certificado HTTPS lo pone Cloudflare solo. Espera a que el dominio diga **Active**.

### Después de conectarlo

- [ ] Abre `https://<dominio>/` y `https://<dominio>/jugar` en un celular.
- [ ] La dirección `*.pages.dev` sigue funcionando; no hace falta apagarla. Para el salón, comparte siempre el dominio propio (el QR del piloto se rehace).
- [ ] Pide a una sesión de Claude cambiar `site` en `astro.config.mjs` por el dominio propio: la imagen que se ve al compartir el enlace (Open Graph, T41h) usa esa dirección.
- [ ] En Supabase no hay que cambiar nada: la sesión anónima no usa redirecciones y las reglas no dependen del dominio. La CSP (`public/_headers`) tampoco: solo permite el propio sitio y `*.supabase.co`.

## 2. Versión de contenido

El cooperativo solo deja jugar juntos a celulares con el **mismo contenido**. Esa versión sale de los puzzles: `VERSION_CONTENIDO` en `src/net/protocolo.ts` une el campo `version` de cada `src/content/puzzles/*.json` (hoy `1.1.1.1.1`). Si un jugador tiene una versión vieja guardada en caché, el anfitrión lo rechaza con «Actualiza la página».

Reglas para el lanzamiento y después:

- **Para la 1.0.0 no se cambia nada** si ningún puzzle cambió desde el piloto. Si alguno cambió (controles, estado inicial, condición de éxito, solución), súbele `version` en su JSON **en el mismo PR** que el cambio.
- Un cambio solo de textos o arte no obliga a subirla. Una duda: si dos celulares con versiones distintas podrían ver la máquina en estados diferentes, se sube.
- La versión del sitio va en `package.json` (`"version"`): en el PR del lanzamiento pasa de `0.0.1` a `1.0.0`.
- El service worker (T94) toma su versión del hash de los archivos: no se toca. Un celular con la versión vieja abierta la conserva hasta cerrar todas las pestañas del juego; al volver a abrir, carga la nueva.
- La partida guardada en el navegador sobrevive a la actualización.

## 3. Etiqueta `v1.0.0` en git

La etiqueta marca el commit exacto que se publicó, para poder volver a él.

1. Se fusiona en `main` el PR del lanzamiento (versión `1.0.0` en `package.json` y T102 en `[x]`), y Cloudflare termina de construir `main`.
2. En GitHub: el repositorio → **Releases** → **Draft a new release**.
3. **Choose a tag** → escribe `v1.0.0` → **Create new tag: v1.0.0 on publish**. **Target:** `main`.
4. **Release title:** `La Última Prueba 1.0.0`. En la descripción: las cinco salas, solo y cooperativo, y un enlace al dominio.
5. Pulsa **Publish release**.

Si prefieres no hacerlo a mano, pídeselo a una sesión: lo hace con `git tag -a v1.0.0` sobre el commit de `main` y `git push origin v1.0.0` (una etiqueta no dispara un build de Cloudflare).

Las siguientes versiones siguen la misma idea: `v1.0.1` para correcciones, `v1.1.0` para algo nuevo (por ejemplo, una sala o un modo).

## 4. Qué revisar en producción

Hazlo el mismo día, en el dominio propio, con un Android y un iPhone. Marca cada casilla.

### Páginas y cabeceras

- [ ] `/`, `/jugar` y `/docentes` cargan sin errores. Los créditos se ven en la pantalla final.
- [ ] En el computador, en Chrome: F12 → **Console** en `/jugar`, juega hasta la sala 1. No debe aparecer ningún error rojo que diga «Content Security Policy» o «Refused to».
- [ ] F12 → **Network** → el documento `/jugar` → **Headers**: aparece `content-security-policy` con `default-src 'self'` y `frame-ancestors 'none'`, y `x-content-type-options: nosniff`.
- [ ] Los archivos de `/_astro/` y `/assets/salas/` responden con `cache-control: public, max-age=31536000, immutable`.

### Juego individual

- [ ] Una partida completa en el Android de referencia: las cinco salas, el final y la pantalla de créditos.
- [ ] El audio arranca después del primer toque y se oye la voz.
- [ ] Recargar a mitad de una sala y pulsar «Continuar» devuelve a la misma sala.
- [ ] En iPhone: «Agregar a inicio» y abrir desde el ícono: se ve a pantalla completa y en horizontal.
- [ ] Sin red (modo avión) después de haber jugado: la portada y `/jugar` abren desde la caché.

### Cooperativo

- [ ] Dos celulares con datos móviles (no la misma Wi-Fi): uno crea, el otro entra con el código y juegan la sala 1.
- [ ] En Supabase → **Realtime** → **Inspector** aparece el canal `partida:XXXX` mientras juegan.
- [ ] En Supabase → **Authentication** → **Users** aparecen usuarios anónimos, sin correo.

### Analítica (T98)

- [ ] Después de jugar, en Supabase → **SQL Editor** corre la consulta del paso 9 de `docs/supabase.md`: suben los contadores de `partida_iniciada`, `sala_resuelta` y `partida_terminada` del día.

### Datos y seguridad

- [ ] En el navegador (F12 → **Application** → **Cookies**) no hay cookies del sitio.
- [ ] En el código publicado no aparece la clave `service_role` ni `secret` (una sesión puede buscarlo en `dist/`).
- [ ] `?lab=1` no hace nada en producción.
- [ ] `/docentes` dice lo mismo que la sección «Qué datos guarda» de este lanzamiento.

## 5. Si algo sale mal

- **Volver a la versión anterior:** Cloudflare → **Workers & Pages** → **la-ultima-prueba** → **Deployments** → la última que funcionaba → **⋯** → **Rollback to this deployment**. Tarda segundos y no toca git.
- Después, la corrección va como un PR normal contra `main`, y se etiqueta `v1.0.1`.
- **Supabase sin conexión:** el juego individual sigue funcionando. Revisa si el proyecto se pausó (plan Free tras una semana sin uso) y pulsa **Restore project**.

## Qué necesita Alex

- Comprar el dominio y conectarlo (sección 1).
- Confirmar que las variables de Supabase están en **Production**.
- Publicar la release en GitHub (sección 3) o pedírsela a una sesión.
- Hacer la revisión de la sección 4 con los dos celulares.
