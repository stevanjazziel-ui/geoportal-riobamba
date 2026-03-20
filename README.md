# Geoportal Municipal de Riobamba

Geoportal web estatico para visualizar:

- Catastro municipal
- Bienes municipales

## Estructura

- `index.html`: interfaz principal
- `styles.css`: estilos del geoportal
- `app.js`: carga de capas, mapa, busqueda y ficha
- `data/`: GeoJSON optimizado para publicacion web
- `catastro municipal/`: fuente original del catastro
- `Bienes municipales 3/`: fuente principal actual de bienes
- `Mostrencos sn/`: complemento puntual para monstrencos urbanos con `REF`

## Como usar

Por seguridad del navegador, conviene abrir este proyecto con un servidor HTTP local.

Opciones comunes:

1. Con Live Server en VS Code
2. Con Python: `python -m http.server`
3. Con Node: `npx serve`

Luego abre en el navegador la URL local del servidor y carga `index.html`.

## Publicacion en GitHub

Este proyecto ya esta preparado para publicarse con GitHub Pages.

### 1. Crear el repositorio en GitHub

Crea un repositorio nuevo, por ejemplo:

- `geoportal-riobamba`

No agregues `README`, `.gitignore` ni licencia desde GitHub para evitar conflictos innecesarios.

### 2. Conectar el repositorio local con GitHub

Reemplaza `TU-USUARIO` y `TU-REPO`:

```powershell
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git branch -M main
git push -u origin main
```

### 3. Activar GitHub Pages

En GitHub:

1. Entra a `Settings`
2. Abre `Pages`
3. En `Source`, selecciona `GitHub Actions`

El workflow `.github/workflows/deploy-pages.yml` publicara automaticamente el sitio cada vez que hagas `push` a `main`.

### 4. URL esperada

La publicacion normalmente quedara en:

```text
https://TU-USUARIO.github.io/TU-REPO/
```

## Actualizar datos

Si cambias los shapefiles fuente, puedes regenerar los archivos web con el script de conversion. El origen actual de bienes combina `Bienes municipales 3\BIENES_MUNICIPALES_4.shp` y `Mostrencos sn\Monstrenco_Urbano_SN.shp`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\convert-to-geojson.ps1
```

Ese proceso:

- reproyecta a `EPSG:4326`
- simplifica geometria para web
- conserva un conjunto de atributos mas ligero
- genera los archivos en `data/`

## Funcionalidades incluidas

- Mapa base OpenStreetMap
- Carga de GeoJSON directamente en el navegador
- Datos reproyectados y optimizados para web
- Activacion y desactivacion de capas
- Busqueda general por atributos
- Panel lateral con ficha del elemento seleccionado
- Despliegue automatico con GitHub Pages

## Siguientes mejoras recomendadas

- Agregar filtros por claves catastrales, parroquia, barrio o tipo de bien
- Incorporar leyenda avanzada y tabla de atributos
- Publicar las capas como GeoJSON optimizado o desde GeoServer para mejor rendimiento
- Integrar impresion de mapas y exportacion de consultas
