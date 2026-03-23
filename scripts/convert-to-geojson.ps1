$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$ogr2ogr = "C:\Program Files\QGIS 3.40.10\bin\ogr2ogr.exe"
$dataDir = Join-Path $root "data"
$catastroOutput = Join-Path $dataDir "catastro_riobamba.geojson"
$bienesOutput = Join-Path $dataDir "bienes_municipales.geojson"
$mostrencosSnTemp = Join-Path $dataDir "_mostrencos_sn_tmp.geojson"

if (!(Test-Path $ogr2ogr)) {
  throw "No se encontro ogr2ogr en la ruta esperada: $ogr2ogr"
}

New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
Remove-Item $catastroOutput -Force -ErrorAction SilentlyContinue
Remove-Item $bienesOutput -Force -ErrorAction SilentlyContinue
Remove-Item $mostrencosSnTemp -Force -ErrorAction SilentlyContinue

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
  (Join-Path $root "Bienes Municipales 4\BIENES_MUNICIPALES_6.shp") `
  -t_srs EPSG:4326 `
  -lco RFC7946=YES `
  -lco COORDINATE_PRECISION=6 `
  -dialect SQLITE `
  -sql "SELECT ST_SimplifyPreserveTopology(geometry, 0.000005) AS geometry, gid AS id, claves AS clave_cat, Clave AS clave_pred, DESCRIPCIO AS descr, Parroquia_ AS parroquia, Barrio_Nom AS barrio, COALESCE(ESTADO_1, estado) AS estado, CASE WHEN Clasificac = 'Bienes Municipales Rurales' THEN 'Bienes Municipales Rurale' WHEN Clasificac = 'Bienes Municipales Urbanos' THEN 'Bienes Municipales Urbano' WHEN Clasificac IN ('Monstrencos Urbanos','Mostrencos Urbanos','Mostrenco Urbano') THEN 'Monstrencos_urbanos' WHEN Clasificac = 'Mostrencos Rurales' THEN 'Mostrencos_Rurales' ELSE Clasificac END AS clase, COALESCE(Nombre_Pre, nombre) AS nombre, Area_total AS area, Area_Verif AS area_verif, NULL AS avaluo, Contribuye AS contrib, Documento_ AS documento, Numero_Reg AS numero_reg, REF AS ref, NULL AS institucion, NULL AS fuente, NULL AS ubicacion FROM BIENES_MUNICIPALES_6" `
  -skipfailures

& $ogr2ogr `
  -f GeoJSON `
  $mostrencosSnTemp `
  (Join-Path $root "Mostrencos sn\Monstrenco_Urbano_SN.shp") `
  -t_srs EPSG:4326 `
  -lco RFC7946=YES `
  -lco COORDINATE_PRECISION=6 `
  -dialect SQLITE `
  -sql "SELECT geometry AS geometry, id AS id, NULL AS clave_cat, NULL AS clave_pred, 'Monstrenco urbano sin credito' AS descr, NULL AS parroquia, NULL AS barrio, NULL AS estado, 'Monstrencos_urbanos' AS clase, 'Monstrenco urbano SN ' || COALESCE(REF, CAST(id AS TEXT)) AS nombre, AREA AS area, NULL AS area_verif, NULL AS avaluo, NULL AS contrib, NULL AS documento, NULL AS numero_reg, REF AS ref, NULL AS institucion, 'Mostrencos sn' AS fuente, NULL AS ubicacion FROM Monstrenco_Urbano_SN" `
  -skipfailures

$bienesMain = Get-Content $bienesOutput -Raw | ConvertFrom-Json
$mostrencosSn = Get-Content $mostrencosSnTemp -Raw | ConvertFrom-Json
$bienesMain.features = @($bienesMain.features) + @($mostrencosSn.features)
[System.IO.File]::WriteAllText($bienesOutput, ($bienesMain | ConvertTo-Json -Depth 100), [System.Text.Encoding]::UTF8)
Remove-Item $mostrencosSnTemp -Force -ErrorAction SilentlyContinue

Write-Host "GeoJSON actualizados en $dataDir"

