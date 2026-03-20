$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$ogr2ogr = "C:\Program Files\QGIS 3.40.10\bin\ogr2ogr.exe"
$dataDir = Join-Path $root "data"
$catastroOutput = Join-Path $dataDir "catastro_riobamba.geojson"
$bienesOutput = Join-Path $dataDir "bienes_municipales.geojson"

if (!(Test-Path $ogr2ogr)) {
  throw "No se encontro ogr2ogr en la ruta esperada: $ogr2ogr"
}

New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
Remove-Item $catastroOutput -Force -ErrorAction SilentlyContinue
Remove-Item $bienesOutput -Force -ErrorAction SilentlyContinue

& $ogr2ogr `
  -f GeoJSON `
  $catastroOutput `
  (Join-Path $root "catastro municipal\catastro_riobamba.shp") `
  -t_srs EPSG:4326 `
  -lco RFC7946=YES `
  -lco COORDINATE_PRECISION=6 `
  -dialect SQLITE `
  -sql "SELECT ST_SimplifyPreserveTopology(geometry, 0.000005) AS geometry, gid AS id, claves AS clave, codigo_pre AS pre, codigo_pro AS pro, codigo_can AS can, codigo_par AS par, codigo_zon AS zon, codigo_sec AS sec, codigo_man AS man, bloque AS bloque, piso AS piso, prop_horiz AS ph, estado AS estado, tipo_catas AS tipo, nombre AS nombre, area AS area, fecha_text AS fecha FROM catastro_riobamba" `
  -skipfailures

& $ogr2ogr `
  -f GeoJSON `
  $bienesOutput `
  (Join-Path $root "Bienes municipales 2\BIENES_MUNICIPALES_3.shp") `
  -t_srs EPSG:4326 `
  -lco RFC7946=YES `
  -lco COORDINATE_PRECISION=6 `
  -dialect SQLITE `
  -sql "SELECT ST_SimplifyPreserveTopology(geometry, 0.000005) AS geometry, gid AS id, Clave_Cata AS clave_cat, Clave_Pred AS clave_pred, DESCRIPCIO AS descr, Parroquia_ AS parroquia, Barrio_Nom AS barrio, ESTADO AS estado, Clasificac AS clase, nombre AS nombre, Total_Area AS area, Area_Verif AS area_verif, Total_Aval AS avaluo, Contribuye AS contrib, INSTITUCIO AS institucion, Fuente AS fuente, ubicacion AS ubicacion FROM BIENES_MUNICIPALES_3" `
  -skipfailures

Write-Host "GeoJSON actualizados en $dataDir"
