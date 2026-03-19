# Geoportal Municipal de Riobamba

Geoportal web estatico para visualizar:

- Catastro municipal
- Bienes municipales

## Estructura

- `index.html`: interfaz principal
- `styles.css`: estilos del geoportal
- `app.js`: carga de capas, mapa, busqueda y ficha
- `catastro municipal/`: shapefile del catastro
- `BIENES MUNICIPALES/`: shapefile de bienes

## Como usar

Por seguridad del navegador, conviene abrir este proyecto con un servidor HTTP local.

Opciones comunes:

1. Con Live Server en VS Code
2. Con Python: `python -m http.server`
3. Con Node: `npx serve`

Luego abre en el navegador la URL local del servidor y carga `index.html`.

## Funcionalidades incluidas

- Mapa base OpenStreetMap
- Carga de shapefiles directamente en el navegador
- Reproyeccion del shapefile de bienes municipales
- Activacion y desactivacion de capas
- Busqueda general por atributos
- Panel lateral con ficha del elemento seleccionado

## Siguientes mejoras recomendadas

- Agregar filtros por claves catastrales, parroquia, barrio o tipo de bien
- Incorporar leyenda avanzada y tabla de atributos
- Publicar las capas como GeoJSON optimizado o desde GeoServer para mejor rendimiento
- Integrar impresion de mapas y exportacion de consultas
