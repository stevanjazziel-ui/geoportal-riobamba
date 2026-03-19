const map = L.map("map", {
  zoomControl: false
});

L.control.zoom({ position: "topright" }).addTo(map);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 20,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

map.setView([-1.664, -78.654], 13);

const dataSources = [
  {
    id: "catastro",
    name: "Catastro municipal",
    color: "#1d4ed8",
    fillColor: "rgba(29, 78, 216, 0.18)",
    paths: {
      shp: "./catastro municipal/catastro_riobamba.shp",
      dbf: "./catastro municipal/catastro_riobamba.dbf",
      prj: "./catastro municipal/catastro_riobamba.prj",
      cpg: "./catastro municipal/catastro_riobamba.cpg"
    }
  },
  {
    id: "bienes",
    name: "Bienes municipales",
    color: "#b45309",
    fillColor: "rgba(180, 83, 9, 0.24)",
    paths: {
      shp: "./BIENES MUNICIPALES/BIENES_MUNICIPALES.shp",
      dbf: "./BIENES MUNICIPALES/BIENES_MUNICIPALES.dbf",
      prj: "./BIENES MUNICIPALES/BIENES_MUNICIPALES.prj",
      cpg: "./BIENES MUNICIPALES/BIENES_MUNICIPALES.cpg"
    }
  }
];

const layerState = new Map();
const statusList = document.getElementById("status-list");
const mapMessage = document.getElementById("map-message");
const detailsContainer = document.getElementById("feature-details");
const searchInput = document.getElementById("search-input");
const clearSelectionButton = document.getElementById("clear-selection");
const fitAllButton = document.getElementById("fit-all");
const statCatastro = document.getElementById("stat-catastro");
const statBienes = document.getElementById("stat-bienes");
const statResults = document.getElementById("stat-results");

let selectedLayer = null;

const projectionAliases = {
  WGS84: "EPSG:4326",
  "WGS 84": "EPSG:4326",
  "WGS_1984_UTM_Zone_17S": "+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs"
};

function setStatus(messages) {
  statusList.innerHTML = messages.map((message) => `<li>${message}</li>`).join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function collectPropertyEntries(properties) {
  return Object.entries(properties || {})
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
    .slice(0, 24);
}

function renderDetails(feature, layerName) {
  const entries = collectPropertyEntries(feature.properties);
  if (!entries.length) {
    detailsContainer.innerHTML = `<p class="details-empty">No hay atributos visibles para ${escapeHtml(layerName)}.</p>`;
    return;
  }

  const content = entries
    .map(([key, value]) => {
      return `
        <div class="detail-item">
          <dt>${escapeHtml(key)}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>
      `;
    })
    .join("");

  detailsContainer.innerHTML = `
    <div class="detail-grid">
      ${content}
    </div>
  `;
}

function clearSelection() {
  if (selectedLayer) {
    const source = layerState.get(selectedLayer.__sourceId);
    selectedLayer.setStyle(source.defaultStyle);
  }
  selectedLayer = null;
  detailsContainer.innerHTML = "Selecciona un predio o bien municipal en el mapa para ver sus atributos.";
}

function getFeatureText(properties) {
  return Object.values(properties || {})
    .filter((value) => value !== null && value !== undefined)
    .join(" ")
    .toLowerCase();
}

function updateSearch() {
  const query = searchInput.value.trim().toLowerCase();
  let matches = 0;

  for (const source of layerState.values()) {
    if (!source.layer) {
      continue;
    }

    source.layer.eachLayer((layer) => {
      const matchesQuery = !query || getFeatureText(layer.feature.properties).includes(query);
      layer.setStyle(matchesQuery ? source.defaultStyle : source.dimmedStyle);
      layer.__matchesQuery = matchesQuery;
      if (matchesQuery && query) {
        matches += 1;
      }
    });
  }

  statResults.textContent = query ? String(matches) : "0";
  mapMessage.textContent = query
    ? `${matches} elemento(s) coinciden con la busqueda actual.`
    : "Capas cargadas y listas para exploracion.";
}

function fitAllLayers() {
  const bounds = [];

  for (const source of layerState.values()) {
    if (source.layer && map.hasLayer(source.layer)) {
      bounds.push(source.layer.getBounds());
    }
  }

  if (!bounds.length) {
    return;
  }

  const merged = bounds.reduce((accumulator, current) => accumulator.extend(current), bounds[0]);
  map.fitBounds(merged.pad(0.08));
}

function parseProjection(prjText) {
  if (!prjText) {
    return "EPSG:4326";
  }

  for (const [token, projection] of Object.entries(projectionAliases)) {
    if (prjText.includes(token)) {
      return projection;
    }
  }

  return "EPSG:4326";
}

async function fetchSourceParts(paths) {
  const [shpResponse, dbfResponse, prjResponse, cpgResponse] = await Promise.all([
    fetch(paths.shp),
    fetch(paths.dbf),
    fetch(paths.prj),
    fetch(paths.cpg)
  ]);

  if (!shpResponse.ok || !dbfResponse.ok || !prjResponse.ok) {
    throw new Error("No fue posible leer uno o mas archivos de la capa.");
  }

  return {
    shp: await shpResponse.arrayBuffer(),
    dbf: await dbfResponse.arrayBuffer(),
    prj: await prjResponse.text(),
    cpg: cpgResponse.ok ? await cpgResponse.text() : "UTF-8"
  };
}

function reprojectGeometry(geometry, projection) {
  if (!geometry || projection === "EPSG:4326") {
    return geometry;
  }

  const reprojectCoordinate = ([x, y]) => {
    const [lon, lat] = proj4(projection, "EPSG:4326", [x, y]);
    return [lon, lat];
  };

  const walk = (coordinates) => {
    if (!Array.isArray(coordinates)) {
      return coordinates;
    }

    if (typeof coordinates[0] === "number") {
      return reprojectCoordinate(coordinates);
    }

    return coordinates.map(walk);
  };

  return {
    ...geometry,
    coordinates: walk(geometry.coordinates)
  };
}

function buildGeoJsonLayer(source, geojson) {
  const defaultStyle = {
    color: source.color,
    weight: 1.2,
    fillColor: source.fillColor,
    fillOpacity: 0.65
  };

  const highlightStyle = {
    color: "#111827",
    weight: 2.5,
    fillColor: source.fillColor,
    fillOpacity: 0.9
  };

  const dimmedStyle = {
    color: source.color,
    weight: 0.8,
    fillColor: source.fillColor,
    fillOpacity: 0.08,
    opacity: 0.2
  };

  const layer = L.geoJSON(geojson, {
    style: defaultStyle,
    onEachFeature(feature, featureLayer) {
      featureLayer.__sourceId = source.id;
      featureLayer.on("click", () => {
        if (selectedLayer && selectedLayer !== featureLayer) {
          const previousSource = layerState.get(selectedLayer.__sourceId);
          selectedLayer.setStyle(previousSource.defaultStyle);
        }

        selectedLayer = featureLayer;
        featureLayer.setStyle(highlightStyle);
        renderDetails(feature, source.name);
      });

      const entries = collectPropertyEntries(feature.properties);
      const preview = entries
        .slice(0, 4)
        .map(([key, value]) => `<strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}`)
        .join("<br>");

      featureLayer.bindPopup(`<div><strong>${escapeHtml(source.name)}</strong><br>${preview || "Sin atributos visibles"}</div>`);
    }
  });

  layerState.set(source.id, { ...source, layer, defaultStyle, dimmedStyle });
  return layer;
}

async function loadSource(source) {
  const parts = await fetchSourceParts(source.paths);
  const projection = parseProjection(parts.prj);
  const parsed = await shp({
    shp: parts.shp,
    dbf: parts.dbf,
    prj: parts.prj,
    cpg: parts.cpg
  });

  const features = (parsed.features || []).map((feature) => ({
    ...feature,
    geometry: reprojectGeometry(feature.geometry, projection)
  }));

  const layer = buildGeoJsonLayer(source, {
    type: "FeatureCollection",
    features
  });

  layer.addTo(map);
  return { count: features.length, bounds: layer.getBounds() };
}

async function initialize() {
  setStatus([
    "Leyendo shapefiles locales.",
    "Preparando simbologia para catastro y bienes.",
    "Transformando coordenadas cuando es necesario."
  ]);

  try {
    const results = await Promise.all(dataSources.map((source) => loadSource(source)));
    const counts = Object.fromEntries(dataSources.map((source, index) => [source.id, results[index].count]));

    statCatastro.textContent = String(counts.catastro || 0);
    statBienes.textContent = String(counts.bienes || 0);

    document.getElementById("toggle-catastro").addEventListener("change", (event) => {
      const source = layerState.get("catastro");
      if (event.target.checked) {
        source.layer.addTo(map);
      } else {
        map.removeLayer(source.layer);
      }
    });

    document.getElementById("toggle-bienes").addEventListener("change", (event) => {
      const source = layerState.get("bienes");
      if (event.target.checked) {
        source.layer.addTo(map);
      } else {
        map.removeLayer(source.layer);
      }
    });

    setStatus([
      `Catastro cargado: ${counts.catastro || 0} elementos.`,
      `Bienes municipales cargados: ${counts.bienes || 0} elementos.`,
      "Puedes buscar, activar o desactivar capas y revisar la ficha de cada entidad."
    ]);

    mapMessage.textContent = "Capas cargadas y listas para exploracion.";
    fitAllLayers();
  } catch (error) {
    console.error(error);
    setStatus([
      "No se pudieron cargar las capas desde el navegador.",
      "Abre el geoportal usando un servidor HTTP local para evitar bloqueos del navegador.",
      "Ejemplo: `python -m http.server`, `npx serve` o la extension Live Server."
    ]);
    mapMessage.textContent = "Hubo un problema al leer los archivos geograficos.";
  }
}

searchInput.addEventListener("input", updateSearch);
clearSelectionButton.addEventListener("click", clearSelection);
fitAllButton.addEventListener("click", fitAllLayers);

initialize();
