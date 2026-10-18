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

## Streaming / Overlays

El panel `/admin` incluye el control `STREAMING / OVERLAYS`. El operador puede seleccionar un enfrentamiento, editar el draft y controlar el marcador in-game. Las URLs públicas para OBS son:

- `/overlay/draft`
- `/overlay/ingame`

El bloque `streaming` se guarda dentro del torneo persistido. El enfrentamiento y los logos se derivan automáticamente del bracket; picks, bans, textos y scores manuales se conservan al cambiar de enfrentamiento hasta que el operador use uno de los botones de reinicio. Ambos overlays reciben las actualizaciones mediante el mismo evento Socket.IO del sistema.

## Render

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
