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
    color: "#5b6770",
    fillColor: "rgba(91, 103, 112, 0)",
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
const toggleCatastro = document.getElementById("toggle-catastro");
const toggleBienes = document.getElementById("toggle-bienes");
const categoryCards = Array.from(document.querySelectorAll(".category-card"));
const bienesCategoryCounters = {
  "Area Verde": document.getElementById("count-area-verde"),
  "Bienes Municipales Urbano": document.getElementById("count-bienes-urbano"),
  Comodato: document.getElementById("count-comodato"),
  Subdivisiones: document.getElementById("count-subdivisiones"),
  "Urbanizaciones Urbanas": document.getElementById("count-urbanizaciones")
};

let selectedLayer = null;
let activeBienesCategory = null;
const sourceLoadPromises = new Map();

const bienesColorMap = {
  "Area Verde": "#15803d",
  "Bienes Municipales Urbano": "#b45309",
  Comodato: "#7c3aed",
  Subdivisiones: "#dc2626",
  "Urbanizaciones Urbanas": "#0891b2"
};

const bienesFallbackPalette = [
  "#0f766e",
  "#2563eb",
  "#c2410c",
  "#7c2d12",
  "#4338ca",
  "#be185d",
  "#4d7c0f",
  "#0369a1"
];

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
    .map(([key, value]) => `
      <div class="detail-item">
        <dt>${escapeHtml(key)}</dt>
        <dd>${escapeHtml(value)}</dd>
      </div>
    `)
    .join("");

  detailsContainer.innerHTML = `
    <div class="detail-grid">
      ${content}
    </div>
  `;
}

function clearSelection() {
  if (selectedLayer) {
    if (selectedLayer.__baseStyle) {
      selectedLayer.setStyle(selectedLayer.__baseStyle);
    }
  }

  selectedLayer = null;
  detailsContainer.innerHTML = "Selecciona un predio o bien municipal en el mapa para ver sus atributos.";
}

function resetSelectedLayerIfHidden(layer, styleKind) {
  if (selectedLayer === layer && styleKind === "hidden") {
    selectedLayer = null;
    detailsContainer.innerHTML = "Selecciona un predio o bien municipal en el mapa para ver sus atributos.";
  }
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
      const styleKind = getLayerStyleKind(source.id, layer, query);
      applyLayerStyle(layer, styleKind);
      if (styleKind === "base" && query) {
        matches += 1;
      }
    });
  }

  statResults.textContent = query ? String(matches) : "0";
  if (query) {
    mapMessage.textContent = `${matches} elemento(s) coinciden con la busqueda actual.`;
  } else if (activeBienesCategory) {
    mapMessage.textContent = `Filtro activo: ${activeBienesCategory}.`;
  } else {
    mapMessage.textContent = "Capas cargadas y listas para exploracion.";
  }
}

function fitAllLayers() {
  const bounds = [];

  for (const source of layerState.values()) {
    if (!source.layer || !map.hasLayer(source.layer)) {
      continue;
    }

    const layerBounds = source.layer.getBounds();
    if (layerBounds.isValid()) {
      bounds.push(layerBounds);
    }
  }

  if (!bounds.length) {
    return;
  }

  const merged = bounds.reduce((accumulator, current) => accumulator.extend(current), bounds[0]);
  map.fitBounds(merged.pad(0.08));
}

function updateBienesCategoryCounts(features) {
  const counts = {
    "Area Verde": 0,
    "Bienes Municipales Urbano": 0,
    Comodato: 0,
    Subdivisiones: 0,
    "Urbanizaciones Urbanas": 0
  };

  for (const feature of features || []) {
    const category = String(feature?.properties?.clase || "").trim();
    if (Object.hasOwn(counts, category)) {
      counts[category] += 1;
    }
  }

  for (const [category, element] of Object.entries(bienesCategoryCounters)) {
    element.textContent = String(counts[category] || 0);
  }
}

function updateCategoryCardState() {
  categoryCards.forEach((card) => {
    const isActive = card.dataset.category === activeBienesCategory;
    card.classList.toggle("is-active", isActive);
    card.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function getLayerStyleKind(sourceId, layer, query) {
  const matchesQuery = !query || layer.__searchText.includes(query);

  if (sourceId === "bienes" && activeBienesCategory) {
    const category = String(layer.feature?.properties?.clase || "").trim();
    if (category !== activeBienesCategory) {
      return "hidden";
    }
  }

  if (matchesQuery) {
    return "base";
  }

  return "dimmed";
}

function applyLayerStyle(layer, styleKind) {
  if (styleKind === "hidden") {
    layer.setStyle(layer.__hiddenStyle);
  } else if (styleKind === "dimmed") {
    layer.setStyle(layer.__dimmedStyle);
  } else {
    layer.setStyle(layer.__baseStyle);
  }

  resetSelectedLayerIfHidden(layer, styleKind);
}

function refreshBienesFilter() {
  const source = layerState.get("bienes");
  if (!source?.layer) {
    updateCategoryCardState();
    return;
  }

  const query = searchInput.value.trim().toLowerCase();
  source.layer.eachLayer((layer) => {
    const styleKind = getLayerStyleKind("bienes", layer, query);
    applyLayerStyle(layer, styleKind);
  });

  updateCategoryCardState();
  updateSearch();
}

function getBienesColor(category) {
  const normalizedCategory = String(category || "").trim();
  if (bienesColorMap[normalizedCategory]) {
    return bienesColorMap[normalizedCategory];
  }

  let hash = 0;
  for (let index = 0; index < normalizedCategory.length; index += 1) {
    hash = (hash * 31 + normalizedCategory.charCodeAt(index)) >>> 0;
  }

  return bienesFallbackPalette[hash % bienesFallbackPalette.length];
}

function getFeatureStyle(source, feature) {
  if (source.id === "catastro") {
    return {
      color: source.color,
      weight: 1.2,
      fillColor: source.fillColor,
      fillOpacity: 0,
      opacity: 0.9
    };
  }

  const color = getBienesColor(feature?.properties?.clase);
  return {
    color,
    weight: 2,
    fillColor: color,
    fillOpacity: 0,
    opacity: 0.95
  };
}

function getDimmedStyle(baseStyle) {
  return {
    ...baseStyle,
    fillOpacity: 0,
    opacity: 0.2
  };
}

function getHiddenStyle(baseStyle) {
  return {
    ...baseStyle,
    weight: 0.1,
    fillOpacity: 0,
    opacity: 0
  };
}

function buildGeoJsonLayer(source, geojson) {
  const highlightStyle = {
    color: "#111827",
    weight: 2.5,
    fillOpacity: 0,
    opacity: 1
  };

  const layer = L.geoJSON(geojson, {
    style: (feature) => getFeatureStyle(source, feature),
    onEachFeature(feature, featureLayer) {
      const baseStyle = getFeatureStyle(source, feature);
      featureLayer.__sourceId = source.id;
      featureLayer.__searchText = getFeatureText(feature.properties);
      featureLayer.__baseStyle = baseStyle;
      featureLayer.__dimmedStyle = getDimmedStyle(baseStyle);
      featureLayer.__hiddenStyle = getHiddenStyle(baseStyle);
      featureLayer.on("click", () => {
        if (selectedLayer && selectedLayer !== featureLayer) {
          if (selectedLayer.__baseStyle) {
            selectedLayer.setStyle(selectedLayer.__baseStyle);
          }
        }

        selectedLayer = featureLayer;
        featureLayer.setStyle({
          ...highlightStyle,
          fillColor: baseStyle.fillColor
        });
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

  layerState.set(source.id, { ...source, layer });
  return layer;
}

function normalizeFeatures(features) {
  return (features || []).filter((feature) => {
    const geometry = feature?.geometry;
    if (!geometry) {
      return false;
    }

    return geometry.type === "Polygon" || geometry.type === "MultiPolygon";
  });
}

async function loadSource(source) {
  const response = await fetch(source.path);
  if (!response.ok) {
    throw new Error(`No fue posible leer ${source.path}.`);
  }

  const parsed = await response.json();
  const features = normalizeFeatures(parsed.features);
  const layer = buildGeoJsonLayer(source, {
    type: "FeatureCollection",
    features
  });

  if (source.id === "bienes") {
    updateBienesCategoryCounts(features);
  }

  layer.addTo(map);
  if (source.id === "bienes") {
    refreshBienesFilter();
  }
  return { count: features.length, sourceId: source.id };
}

function bindLayerToggles() {
  toggleCatastro.addEventListener("change", async (event) => {
    if (!event.target.checked) {
      const source = layerState.get("catastro");
      if (source) {
        map.removeLayer(source.layer);
      }
      return;
    }

    mapMessage.textContent = "Cargando catastro municipal...";

    try {
      await ensureSourceLoaded("catastro");
      const source = layerState.get("catastro");
      if (source) {
        source.layer.addTo(map);
        statCatastro.textContent = String(source.featureCount || 0);
      }
      mapMessage.textContent = "Capas cargadas y listas para exploracion.";
      fitAllLayers();
    } catch (error) {
      console.error("catastro", error);
      event.target.checked = false;
      mapMessage.textContent = "No se pudo cargar el catastro municipal.";
    }
  });

  toggleBienes.addEventListener("change", async (event) => {
    if (!event.target.checked) {
      const source = layerState.get("bienes");
      if (source) {
        map.removeLayer(source.layer);
      }
      return;
    }

    mapMessage.textContent = "Cargando bienes municipales...";

    try {
      await ensureSourceLoaded("bienes");
      const source = layerState.get("bienes");
      if (source) {
        source.layer.addTo(map);
        statBienes.textContent = String(source.featureCount || 0);
      }
      mapMessage.textContent = "Capas cargadas y listas para exploracion.";
      fitAllLayers();
    } catch (error) {
      console.error("bienes", error);
      event.target.checked = false;
      mapMessage.textContent = "No se pudieron cargar los bienes municipales.";
    }
  });

  categoryCards.forEach((card) => {
    card.addEventListener("click", async () => {
      const category = card.dataset.category;
      activeBienesCategory = activeBienesCategory === category ? null : category;
      updateCategoryCardState();

      if (!toggleBienes.checked) {
        toggleBienes.checked = true;
        mapMessage.textContent = "Cargando bienes municipales...";
        try {
          await ensureSourceLoaded("bienes");
          const source = layerState.get("bienes");
          if (source) {
            source.layer.addTo(map);
            statBienes.textContent = String(source.featureCount || 0);
          }
        } catch (error) {
          console.error("bienes", error);
          toggleBienes.checked = false;
          activeBienesCategory = null;
          updateCategoryCardState();
          mapMessage.textContent = "No se pudieron cargar los bienes municipales.";
          return;
        }
      }

      refreshBienesFilter();
    });
  });
}

async function ensureSourceLoaded(sourceId) {
  const existing = layerState.get(sourceId);
  if (existing) {
    return existing;
  }

  const inFlight = sourceLoadPromises.get(sourceId);
  if (inFlight) {
    return inFlight;
  }

  const source = dataSources.find((item) => item.id === sourceId);
  const promise = loadSource(source)
    .then((result) => {
      const loadedSource = layerState.get(sourceId);
      if (loadedSource) {
        loadedSource.featureCount = result.count;
      }
      sourceLoadPromises.delete(sourceId);
      return loadedSource;
    })
    .catch((error) => {
      sourceLoadPromises.delete(sourceId);
      throw error;
    });

  sourceLoadPromises.set(sourceId, promise);
  return promise;
}

async function initialize() {
  setStatus([
    "Leyendo GeoJSON optimizado.",
    "Preparando simbologia para catastro y bienes.",
    "Cargando capas listas para web."
  ]);

  bindLayerToggles();

  const initialSourceIds = dataSources
    .filter((source) => {
      if (source.id === "catastro") {
        return toggleCatastro.checked;
      }

      if (source.id === "bienes") {
        return toggleBienes.checked;
      }

      return false;
    })
    .map((source) => source.id);

  const results = await Promise.allSettled(initialSourceIds.map((sourceId) => ensureSourceLoaded(sourceId)));
  const counts = { catastro: 0, bienes: 0 };
  const messages = [];

  results.forEach((result, index) => {
    const source = dataSources.find((item) => item.id === initialSourceIds[index]);
    if (result.status === "fulfilled") {
      counts[source.id] = result.value?.featureCount || 0;
      messages.push(`${source.name} cargado: ${counts[source.id]} elementos.`);
    } else {
      console.error(source.id, result.reason);
      messages.push(`${source.name}: no se pudo cargar correctamente.`);
      const toggle = document.getElementById(`toggle-${source.id}`);
      if (toggle) {
        toggle.checked = false;
      }
    }
  });

  statCatastro.textContent = String(counts.catastro || 0);
  statBienes.textContent = String(counts.bienes || 0);

  if (messages.length) {
    setStatus(messages);
  }

  const loadedCount = results.filter((result) => result.status === "fulfilled").length;
  if (loadedCount > 0) {
    mapMessage.textContent = "Capas cargadas y listas para exploracion.";
    fitAllLayers();
  } else {
    mapMessage.textContent = "Activa las capas que quieras visualizar.";
    setStatus([
      "Bienes municipales se carga al inicio.",
      "Catastro municipal ahora se carga solo bajo demanda.",
      "Esto reduce el peso inicial y mejora la apertura en Chrome."
    ]);
  }
}

searchInput.addEventListener("input", updateSearch);
clearSelectionButton.addEventListener("click", clearSelection);
fitAllButton.addEventListener("click", fitAllLayers);

initialize().catch((error) => {
  console.error(error);
  mapMessage.textContent = "Hubo un problema al iniciar el geoportal.";
  setStatus([
    "Ocurrio un error inesperado al iniciar la aplicacion.",
    "Recarga la pagina dentro de unos segundos.",
    "Si persiste, revisamos el despliegue publicado."
  ]);
});
