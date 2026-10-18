# Brackets Live

MVP de un sistema de brackets de esports en tiempo real, construido con HTML, CSS, JavaScript vanilla, Express y Socket.IO. Incluye vista pública (`/`), panel protegido (`/admin`), eliminación directa para ocho equipos demo y persistencia local intercambiable.

## Ejecutar localmente

1. Instala Node.js 20 o superior.
2. Ejecuta `npm install`.
3. Copia `.env.example` a `.env` y define `ADMIN_PASSWORD` y `SESSION_SECRET`.
4. Ejecuta `npm start`.
5. Abre `http://localhost:10000` y `http://localhost:10000/admin`.

La contraseña nunca se incluye en el frontend. El adaptador usa Upstash Redis cuando `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` están definidos; si no, usa `DATA_FILE` para desarrollo local.

## Flujo de resultados

En el panel `/admin`, `GUARDAR RESULTADO` conserva un marcador provisional y mantiene el enfrentamiento editable. `FINALIZAR ENFRENTAMIENTO` exige seleccionar un ganador, lo avanza a la siguiente ronda y bloquea el resultado. Para corregir un resultado confirmado, usa `EDITAR RESULTADO`; si la corrección afecta una ronda posterior ya disputada, el panel solicita confirmación e invalida los resultados dependientes antes de sincronizar el bracket público.

## Streaming y OBS

Abre `/streaming` e inicia sesión con las credenciales del administrador. La vista previa y `/overlay-ingame.html` reciben los cambios por Socket.IO. Añade esta última URL como fuente de navegador en OBS (1920 × 1080); el fondo es transparente.

Streaming obtiene nombres y marcadores directamente del bracket, sin crear resultados adicionales. `GUARDAR RESULTADO` con estado EN JUEGO actualiza OBS automáticamente. Con un solo enfrentamiento EN JUEGO se selecciona automáticamente; con varios, selecciona uno en Streaming y guarda. Si la selección deja de estar activa y hay varios, vuelve al estado de espera hasta elegir; sin enfrentamientos activos nunca muestra resultados anteriores. Al desconectarse oculta los datos y recupera el estado al reconectar.

Los colores y el intercambio de equipos entre lados se guardan exclusivamente en Streaming. No modifican el bracket. La configuración persiste en la clave Upstash `brackets-live:streaming` o, en desarrollo, en `streaming.json` junto a `DATA_FILE`. Render conserva la misma instalación, inicio y health check; necesita Upstash para persistir después de un despliegue.

Ejecuta `node --test` con Node.js 22 o superior para comprobar la selección, los datos y la independencia de Streaming.

### Personalización del overlay

En `/streaming`, **Personalización del overlay** permite ajustar tamaño y tipografía de los nombres (Arial Black, Barlow Condensed o Impact), colores de bloques y texto, contorno, desplazamiento de sombra sólida, anchura máxima de bloques, separación central y brillo. La vista previa cambia inmediatamente; el diseño se guarda automáticamente y se transmite a OBS. **Restablecer diseño predeterminado** restaura únicamente el diseño, sin cambiar el enfrentamiento elegido ni el intercambio de lados.

El diseño predeterminado utiliza nombres blancos de 48 px en un lienzo de 1920 px, contorno de 0.6 px y sombra negra sólida de 2 px. Los nombres largos reducen su tamaño y, cuando hace falta, usan dos líneas equilibradas. El brillo se dibuja en una capa independiente para mantener opaco y legible el texto. El diseño escala con la anchura de la fuente de navegador.

Para repetir la revisión en Chrome instalado, ejecuta `npm install --prefix .tmp/visual-tools --no-save --package-lock=false playwright` y luego `node scripts/check-overlay-browser.cjs`. Usa un servidor y datos de prueba independientes; comprueba los controles, vista previa inmediata, persistencia al recargar, OBS, restablecimiento y nombres largos/cortos. Guarda las capturas en `.tmp/visual-check/`, excluida de Git.

## Configuración de Render

El archivo `render.yaml` deja configurado el servicio, `npm ci`, `npm start` y el health check. Puedes crear el servicio desde el repositorio y configurar estas variables:

- `ADMIN_USER`: usuario del panel.
- `ADMIN_PASSWORD`: mínimo 12 caracteres, nunca lo subas a GitHub.
- `SESSION_SECRET`: mínimo 32 caracteres. Render puede generarlo automáticamente.
- `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`: credenciales de una base Redis externa.

En producción el servidor rechaza iniciar si faltan las credenciales obligatorias. El almacenamiento local solo debe usarse durante desarrollo; Render utiliza disco efímero.

## Publicar en GitHub

Desde PowerShell, en esta carpeta:

```powershell
git init
git add .
git commit -m "Prepare Brackets Live for production"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```

Comprueba antes de `git add .` que `.env`, `data/` y `node_modules/` no aparezcan en `git status`. El repositorio ya incluye `package-lock.json` para instalaciones reproducibles.
