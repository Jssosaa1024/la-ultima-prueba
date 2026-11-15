# Capturas de licencia

Aquí va una captura de la página de licencia de cada asset **el día de la descarga** (o de la
generación, en Meshy y ElevenLabs). Es obligatoria para Sketchfab, Meshy y ElevenLabs: la
licencia puede cambiar después y la captura prueba la que tenía el asset al bajarlo.

- Nombre: el del archivo publicado, en minúsculas y con guiones: `graderia.png`.
- Formato: PNG, JPG, WebP o PDF.
- Que se vean el nombre del asset, el autor, la licencia y la fecha (la del sistema sirve).
- Anótala en `art/credits.json`, campo `evidencia`: `"art/evidencia/graderia.png"`.

`npm run check-credits` falla si una entrada nombra una captura que no está en esta carpeta.
