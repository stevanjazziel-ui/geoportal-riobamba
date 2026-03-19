const map = L.map("map", {
  zoomControl: false,
  preferCanvas: true
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
    path: "./data/catastro_riobamba.geojson"
  },
  {
    id: "bienes",
    name: "Bienes municipales",
    color: "#b45309",
    fillColor: "rgba(180, 83, 9, 0.24)",
    path: "./data/bienes_municipales.geojson"
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
      const matchesQuery = !query || layer.__searchText.includes(query);
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
      featureLayer.__searchText = getFeatureText(feature.properties);
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
  const response = await fetch(source.path);
  if (!response.ok) {
    throw new Error(`No fue posible leer ${source.path}.`);
  }

  const parsed = await response.json();
  const features = parsed.features || [];

  const layer = buildGeoJsonLayer(source, {
    type: "FeatureCollection",
    features
  });

  layer.addTo(map);
  return { count: features.length, bounds: layer.getBounds() };
}

async function initialize() {
  setStatus([
    "Leyendo GeoJSON optimizado.",
    "Preparando simbologia para catastro y bienes.",
    "Cargando capas listas para web."
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
      "Las capas ahora se sirven como GeoJSON para una carga mas rapida."
    ]);

    mapMessage.textContent = "Capas cargadas y listas para exploracion.";
    fitAllLayers();
  } catch (error) {
    console.error(error);
    setStatus([
      "No se pudieron cargar las capas desde el navegador.",
      "Abre el geoportal usando un servidor HTTP local para evitar bloqueos del navegador.",
      "Asegurate de que la carpeta data este publicada junto con index.html."
    ]);
    mapMessage.textContent = "Hubo un problema al leer los archivos geograficos.";
  }
}

searchInput.addEventListener("input", updateSearch);
clearSelectionButton.addEventListener("click", clearSelection);
fitAllButton.addEventListener("click", fitAllLayers);

initialize();
