const map = L.map("map", {
  zoomControl: false,
  preferCanvas: true
});

const maxSatelliteZoom = 18;

map.options.maxZoom = maxSatelliteZoom;

L.control.zoom({ position: "topright" }).addTo(map);

L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
  maxZoom: maxSatelliteZoom,
  maxNativeZoom: maxSatelliteZoom,
  attribution: "Tiles &copy; Esri"
}).addTo(map);

map.setView([-1.664, -78.654], 13);

const dataSources = [
  {
    id: "catastro",
    name: "Catastro municipal",
    color: "#5b6770",
    fillColor: "rgba(91, 103, 112, 0)",
    path: "./data/catastro_riobamba.geojson?v=20260320-14"
  },
  {
    id: "bienes",
    name: "Bienes municipales",
    color: "#b45309",
    fillColor: "rgba(180, 83, 9, 0.24)",
    path: "./data/bienes_municipales.geojson?v=20260323-15"
  }
];

const layerState = new Map();
const statusList = document.getElementById("status-list");
const mapMessage = document.getElementById("map-message");
const detailsContainer = document.getElementById("feature-details");
const searchInput = document.getElementById("search-input");
const clearSelectionButton = document.getElementById("clear-selection");
const fitAllButton = document.getElementById("fit-all");
const heroFitAllButton = document.getElementById("hero-fit-all");
const heroOpenRegistroButton = document.getElementById("hero-open-registro");
const mapFocusTitle = document.getElementById("map-focus-title");
const mapFocusPercent = document.getElementById("map-focus-percent");
const mapFocusCopy = document.getElementById("map-focus-copy");
const mapFocusChart = document.getElementById("map-focus-chart");
const mapFocusTags = document.getElementById("map-focus-tags");
const mapFocusTotal = document.getElementById("map-focus-total");
const mapFocusCon = document.getElementById("map-focus-con");
const mapFocusSin = document.getElementById("map-focus-sin");
const statCatastro = document.getElementById("stat-catastro");
const statBienes = document.getElementById("stat-bienes");
const statSupport = document.getElementById("stat-support");
const statResults = document.getElementById("stat-results");
const heroActiveLayers = document.getElementById("hero-active-layers");
const heroActiveFilters = document.getElementById("hero-active-filters");
const heroSupportCount = document.getElementById("hero-support-count");
const heroCatastroCount = document.getElementById("hero-catastro-count");
const heroBienesCount = document.getElementById("hero-bienes-count");
const heroViewMode = document.getElementById("hero-view-mode");
const toggleCatastro = document.getElementById("toggle-catastro");
const toggleBienes = document.getElementById("toggle-bienes");
const sidebar = document.querySelector(".sidebar");
const sidebarScrollUp = document.getElementById("sidebar-scroll-up");
const sidebarScrollDown = document.getElementById("sidebar-scroll-down");
const sidebarScrollThumb = document.getElementById("sidebar-scroll-thumb");
const categoryCards = Array.from(document.querySelectorAll(".category-card"));
const dashboardGrid = document.getElementById("dashboard-grid");
const dashboardNote = document.getElementById("dashboard-note");
const dashboardSummaryList = document.getElementById("dashboard-summary-list");
const openRegistroModalButton = document.getElementById("open-registro-modal");
const registroModal = document.getElementById("registro-modal");
const closeRegistroModalButton = document.getElementById("close-registro-modal");
const registroModalCategory = document.getElementById("registro-modal-category");
const modalGrid = document.getElementById("modal-grid");
const modalColumnCon = document.getElementById("modal-column-con");
const modalColumnSin = document.getElementById("modal-column-sin");
const modalCountCon = document.getElementById("modal-count-con");
const modalCountSin = document.getElementById("modal-count-sin");
const modalListCon = document.getElementById("modal-list-con");
const modalListSin = document.getElementById("modal-list-sin");
const modalViewButtons = Array.from(document.querySelectorAll(".modal-view-button"));
const bienesCategories = [
  { value: "Area Verde", label: "Area Verde", countId: "count-area-verde", color: "#15803d", dashKey: "area-verde" },
  { value: "Propiedades municipales", label: "Propiedades municipales", countId: "count-propiedades-municipales", color: "#0f766e", dashKey: "propiedades-municipales" },
  { value: "Comodato", label: "Comodato", countId: "count-comodato", color: "#7c3aed", dashKey: "comodato" },
  { value: "Bienes Mostrencos", label: "Bienes Mostrencos", countId: "count-bienes-mostrencos", color: "#ea580c", dashKey: "bienes-mostrencos" },
  { value: "Subdivisiones", label: "Subdivisiones", countId: "count-subdivisiones", color: "#dc2626", dashKey: "subdivisiones" }
];
const bienesCategoryCounters = Object.fromEntries(
  bienesCategories.map((category) => [category.value, document.getElementById(category.countId)])
);

let selectedLayer = null;
let sidebarScrollDragState = null;
const activeBienesCategories = new Set();
const sourceLoadPromises = new Map();
const bienesLayerIndex = new Map();
let dashboardCategorySummary = {};
let dashboardFocusCategory = null;
let bienesSupportRecords = [];
let registroModalView = "both";
const numberFormatter = new Intl.NumberFormat("es-EC");
const ignoredTramiteFields = new Set([
  "id",
  "clave_cat",
  "clave_pred",
  "clase",
  "area",
  "area_verif",
  "avaluo"
]);
const documentSupportFields = new Set(["numero_reg", "ref"]);
const propertyLabelMap = {
  documento: "Documento",
  numero_reg: "Numero de registro",
  ref: "REF",
  nombre: "Nombre",
  descr: "Descripcion",
  ubicacion: "Ubicacion",
  institucion: "Institucion",
  contrib: "Contribuye",
  fuente: "Fuente"
};

const bienesColorMap = Object.fromEntries(
  bienesCategories.map((category) => [category.value, category.color])
);

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
  requestAnimationFrame(updateSidebarScrollUi);
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

function formatNumber(value) {
  return numberFormatter.format(value || 0);
}

function normalizeBienesCategory(value) {
  const category = String(value || "").trim();
  if (category === "Bienes Municipales Rurale" || category === "Bienes Municipales Urbano") {
    return "Propiedades municipales";
  }

  if (category === "Monstrencos_urbanos" || category === "Mostrencos_Rurales") {
    return "Bienes Mostrencos";
  }

  return category;
}

function updateMapFocusPanel() {
  if (!mapFocusTitle || !mapFocusPercent || !mapFocusCopy || !mapFocusChart || !mapFocusTags || !mapFocusTotal || !mapFocusCon || !mapFocusSin) {
    return;
  }

  const fallbackCategory = activeBienesCategories.size === 1 ? Array.from(activeBienesCategories)[0] : null;
  const focusCategory = dashboardFocusCategory && dashboardCategorySummary[dashboardFocusCategory]
    ? dashboardFocusCategory
    : fallbackCategory;
  const item = focusCategory ? dashboardCategorySummary[focusCategory] : null;

  if (!item) {
    mapFocusTitle.textContent = "Selecciona una clasificacion";
    mapFocusPercent.textContent = "0%";
    mapFocusCopy.textContent = "Haz clic en una categoria para ver su lectura documental en el mapa.";
    mapFocusTotal.textContent = "0";
    mapFocusCon.textContent = "0";
    mapFocusSin.textContent = "0";
    mapFocusChart.style.setProperty("--focus-chart-fill", "#39d0ff");
    mapFocusChart.style.setProperty("--focus-chart-angle", "0deg");
    mapFocusTags.innerHTML = '<span class="map-focus-tag is-muted">Sin lectura activa</span>';
    return;
  }

  const percentage = item.total ? Math.round((item.con / item.total) * 100) : 0;
  const topSignals = Object.entries(item.keywordCounts || {})
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([keyword]) => `<span class="map-focus-tag">${escapeHtml(keyword)}</span>`)
    .join("");
  mapFocusTitle.textContent = item.label;
  mapFocusPercent.textContent = `${percentage}%`;
  mapFocusCopy.textContent = `${formatNumber(item.gravamenCon)} de ${formatNumber(item.total)} bienes de esta clasificacion cuentan con numero de registro o REF.`;
  mapFocusTotal.textContent = formatNumber(item.total);
  mapFocusCon.textContent = formatNumber(item.gravamenCon);
  mapFocusSin.textContent = formatNumber(item.gravamenSin);
  mapFocusChart.style.setProperty("--focus-chart-fill", getBienesColor(focusCategory));
  mapFocusChart.style.setProperty("--focus-chart-angle", `${percentage * 3.6}deg`);
  mapFocusTags.innerHTML = topSignals || '<span class="map-focus-tag is-muted">Sin registro o REF</span>';
}

function updateHeroOverview() {
  const activeLayers = dataSources.reduce((count, source) => {
    const layer = layerState.get(source.id)?.layer;
    return layer && map.hasLayer(layer) ? count + 1 : count;
  }, 0);
  const activeFilters = activeBienesCategories.size + (((searchInput?.value || "").trim()) ? 1 : 0);
  const supportCount = bienesSupportRecords.filter((record) => record.hasSupport).length;
  const catastroCount = layerState.get("catastro")?.featureCount || 0;
  const bienesCount = layerState.get("bienes")?.featureCount || 0;

  if (statSupport) {
    statSupport.textContent = formatNumber(supportCount);
  }

  if (!heroActiveLayers || !heroActiveFilters || !heroSupportCount || !heroCatastroCount || !heroBienesCount || !heroViewMode) {
    return;
  }

  heroActiveLayers.textContent = formatNumber(activeLayers);
  heroActiveFilters.textContent = formatNumber(activeFilters);
  heroSupportCount.textContent = formatNumber(supportCount);
  heroCatastroCount.textContent = formatNumber(catastroCount);
  heroBienesCount.textContent = formatNumber(bienesCount);
  heroViewMode.textContent = activeFilters > 0 ? "Busqueda y filtro activos" : "Exploracion general";
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getPropertyLabel(key) {
  return propertyLabelMap[key] || key;
}

function buildExcerpt(value) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (!text) {
    return "";
  }

  if (text.length <= 132) {
    return text;
  }

  return `${text.slice(0, 129).trimEnd()}...`;
}

function analyzeTramiteSupport(properties) {
  const labels = new Set();
  const fieldMatches = [];

  Object.entries(properties || {}).forEach(([key, rawValue]) => {
    if (ignoredTramiteFields.has(key)) {
      return;
    }

    const value = String(rawValue || "").trim();
    if (!value) {
      return;
    }

    const normalizedValue = normalizeText(value);
    const fieldLabel = getPropertyLabel(key);
    if (documentSupportFields.has(key)) {
      labels.add(fieldLabel);
    }

    if (documentSupportFields.has(key)) {
      fieldMatches.push({
        field: key,
        fieldLabel,
        value,
        excerpt: buildExcerpt(value),
        matchedKeywords: []
      });
    }
  });

  const excerptSource = fieldMatches[0] || null;

  return {
    hasSupport: labels.size > 0,
    labels: Array.from(labels),
    keywords: Array.from(labels),
    fieldsSummary: fieldMatches.map((match) => `${match.fieldLabel}: ${buildExcerpt(match.value)}`).join(" | "),
    fieldMatches,
    matchedField: excerptSource?.fieldLabel || "",
    excerpt: buildExcerpt(excerptSource?.value || "")
  };
}

function getFeatureDisplayTitle(properties) {
  return String(
    properties?.nombre ||
    properties?.descr ||
    properties?.clave_pred ||
    properties?.clave_cat ||
    "Bien municipal"
  ).trim();
}

function getFeatureKey(properties) {
  return String(
    properties?.clave_pred ||
    properties?.clave_cat ||
    properties?.id ||
    "s/d"
  ).trim() || "s/d";
}

function getFeatureDescription(properties) {
  return String(
    properties?.descr ||
    properties?.nombre ||
    "Sin descripcion"
  ).trim() || "Sin descripcion";
}

function getSupportSummary(tramiteAnalysis) {
  if (!tramiteAnalysis?.hasSupport) {
    return "No tiene numero de registro ni referencia.";
  }

  const labels = tramiteAnalysis.labels?.length
    ? tramiteAnalysis.labels.join(", ")
    : "Numero de registro o REF";
  return `Si. Detectado en: ${labels}.`;
}

function getSupportReferenceDetails(properties) {
  const numeroRegistro = String(properties?.numero_reg || "").trim();
  const referencia = String(properties?.ref || "").trim();
  const details = [];

  if (numeroRegistro) {
    details.push({ label: "Numero de registro", value: numeroRegistro });
  }

  if (referencia) {
    details.push({ label: "Referencia", value: referencia });
  }

  return details;
}

function hasCertificadoGravamen(properties) {
  return [properties?.numero_reg, properties?.ref]
    .some((value) => value !== null && value !== undefined && String(value).trim() !== "");
}

function sortRecords(records) {
  return [...records].sort((left, right) => {
    const categoryCompare = left.categoryLabel.localeCompare(right.categoryLabel, "es");
    if (categoryCompare !== 0) {
      return categoryCompare;
    }

    return left.title.localeCompare(right.title, "es");
  });
}

function populateRegistroModalCategories() {
  if (!registroModalCategory) {
    return;
  }

  const selectedValue = registroModalCategory.value || "__all__";
  registroModalCategory.innerHTML = [
    '<option value="__all__">Todas las clasificaciones</option>',
    ...bienesCategories.map((category) => `<option value="${escapeHtml(category.value)}">${escapeHtml(category.label)}</option>`)
  ].join("");
  registroModalCategory.value = bienesCategories.some((category) => category.value === selectedValue) ? selectedValue : "__all__";
}

function renderModalRecord(record, withSupport) {
  const supportReferenceMarkup = record.supportReferences?.length
    ? record.supportReferences.map((item) => (
      `<p class="modal-item-text"><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value)}</p>`
    )).join("")
    : "";
  const labelsMarkup = record.labels.length
    ? `
      <div class="modal-item-tags">
        ${record.labels.map((label) => `<span class="modal-item-tag">${escapeHtml(label)}</span>`).join("")}
      </div>
    `
    : "";
  const fieldsMarkup = record.fieldMatches?.length
    ? `
      <div class="modal-item-field-list">
        ${record.fieldMatches.map((match) => `
          <div class="modal-item-field">
            <div class="modal-item-field-head">
              <strong>${escapeHtml(match.fieldLabel)}</strong>
              ${match.matchedKeywords.length ? `<span class="modal-item-field-keywords">${escapeHtml(match.matchedKeywords.join(", "))}</span>` : ""}
            </div>
            <p class="modal-item-text">${escapeHtml(match.excerpt || match.value || "Sin extracto disponible.")}</p>
          </div>
        `).join("")}
      </div>
    `
    : '<p class="modal-item-text">No se encontraron campos documentales detallados.</p>';
  const supportMarkup = withSupport
    ? `
      <div class="modal-item-summary">
        <p class="modal-item-text"><strong>Clave:</strong> ${escapeHtml(record.key)}</p>
        <p class="modal-item-text"><strong>Descripcion:</strong> ${escapeHtml(record.description)}</p>
        <p class="modal-item-text"><strong>Clasificacion:</strong> ${escapeHtml(record.categoryLabel)}</p>
        <p class="modal-item-text"><strong>Estado documental:</strong> ${escapeHtml(record.supportSummary)}</p>
        ${supportReferenceMarkup}
      </div>
      <p class="modal-item-signals">Campos y senales detectadas</p>
      ${labelsMarkup}
      ${fieldsMarkup}
    `
    : `
      <div class="modal-item-summary">
        <p class="modal-item-text"><strong>Clave:</strong> ${escapeHtml(record.key)}</p>
        <p class="modal-item-text"><strong>Descripcion:</strong> ${escapeHtml(record.description)}</p>
        <p class="modal-item-text"><strong>Clasificacion:</strong> ${escapeHtml(record.categoryLabel)}</p>
        <p class="modal-item-text"><strong>Estado documental:</strong> ${escapeHtml(record.supportSummary)}</p>
        ${supportReferenceMarkup}
      </div>
    `;

  return `
    <article class="modal-item ${withSupport ? "modal-item-support" : "modal-item-empty"}" data-record-id="${escapeHtml(record.id || "")}">
      <div class="modal-item-head">
        <span class="modal-item-title">${escapeHtml(record.title)}</span>
        <div class="modal-item-meta-row">
          <span class="modal-item-meta">${escapeHtml(record.categoryLabel)}</span>
          <span class="modal-item-meta">ID ${escapeHtml(record.id || "s/d")}</span>
        </div>
      </div>
      ${supportMarkup}
    </article>
  `;
}

function updateRegistroModalLists() {
  if (!registroModalCategory || !modalCountCon || !modalCountSin || !modalListCon || !modalListSin || !modalGrid || !modalColumnCon || !modalColumnSin) {
    return;
  }

  const selectedCategory = registroModalCategory.value;
  const filteredRecords = selectedCategory === "__all__"
    ? bienesSupportRecords
    : bienesSupportRecords.filter((record) => record.categoryValue === selectedCategory);

  const conRecords = sortRecords(filteredRecords.filter((record) => record.hasSupport));
  const sinRecords = sortRecords(filteredRecords.filter((record) => !record.hasSupport));

  modalCountCon.textContent = formatNumber(conRecords.length);
  modalCountSin.textContent = formatNumber(sinRecords.length);

  modalListCon.innerHTML = conRecords.length
    ? conRecords.map((record) => renderModalRecord(record, true)).join("")
    : '<p class="dashboard-empty">No hay bienes con respaldo en esta vista.</p>';

  modalListSin.innerHTML = sinRecords.length
    ? sinRecords.map((record) => renderModalRecord(record, false)).join("")
    : '<p class="dashboard-empty">No hay bienes sin respaldo en esta vista.</p>';

  modalGrid.classList.toggle("show-con", registroModalView === "con");
  modalGrid.classList.toggle("show-sin", registroModalView === "sin");
  modalColumnCon.hidden = registroModalView === "sin";
  modalColumnSin.hidden = registroModalView === "con";
  modalListCon.scrollTop = 0;
  modalListSin.scrollTop = 0;
}

function updateRegistroModalViewButtons() {
  modalViewButtons.forEach((button) => {
    const isActive = button.dataset.modalView === registroModalView;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function openRegistroModal() {
  if (!registroModal) {
    return;
  }

  updateRegistroModalViewButtons();
  updateRegistroModalLists();
  registroModal.classList.add("is-open");
  registroModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeRegistroModal() {
  if (!registroModal) {
    return;
  }

  registroModal.classList.remove("is-open");
  registroModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function bindRegistroModal() {
  if (!registroModal || !registroModalCategory) {
    return;
  }

  if (bindRegistroModal.bound) {
    return;
  }

  bindRegistroModal.bound = true;
  registroModalCategory.addEventListener("change", updateRegistroModalLists);
  modalViewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      registroModalView = button.dataset.modalView || "both";
      updateRegistroModalViewButtons();
      updateRegistroModalLists();
    });
  });
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest("#open-registro-modal")) {
      openRegistroModal();
      return;
    }

    const recordCard = target.closest(".modal-item[data-record-id]");
    if (recordCard) {
      focusBienesRecord(recordCard.getAttribute("data-record-id"));
      return;
    }

    if (target.closest("#close-registro-modal") || target.closest("[data-close-modal='true']")) {
      closeRegistroModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && registroModal.classList.contains("is-open")) {
      closeRegistroModal();
    }
  });
}

function selectFeatureLayer(featureLayer) {
  if (!featureLayer) {
    return;
  }

  if (selectedLayer && selectedLayer !== featureLayer && selectedLayer.__baseStyle) {
    selectedLayer.setStyle(selectedLayer.__baseStyle);
  }

  selectedLayer = featureLayer;
  featureLayer.setStyle({
    ...featureLayer.__highlightStyle,
    fillColor: featureLayer.__baseStyle?.fillColor
  });
  if (featureLayer.bringToFront) {
    featureLayer.bringToFront();
  }
  renderDetails(featureLayer.feature, featureLayer.__sourceName || "Capa");
}

function focusBienesRecord(recordId) {
  const normalizedId = String(recordId || "").trim();
  if (!normalizedId) {
    return;
  }

  const bienesSource = layerState.get("bienes");
  const featureLayer = bienesLayerIndex.get(normalizedId);
  if (!bienesSource?.layer || !featureLayer) {
    mapMessage.textContent = "No fue posible ubicar ese bien municipal en el mapa.";
    return;
  }

  if (!map.hasLayer(bienesSource.layer)) {
    bienesSource.layer.addTo(map);
    toggleBienes.checked = true;
  }

  if (activeBienesCategories.size > 0) {
    activeBienesCategories.clear();
    updateCategoryCardState();
    refreshBienesFilter();
  }

  selectFeatureLayer(featureLayer);

  const bounds = featureLayer.getBounds ? featureLayer.getBounds() : null;
  if (bounds?.isValid()) {
    map.fitBounds(bounds.pad(0.8));
  }

  if (featureLayer.openPopup) {
    featureLayer.openPopup();
  }

  closeRegistroModal();
  mapMessage.textContent = `Ubicando bien municipal ${normalizedId}.`;
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
  requestAnimationFrame(updateSidebarScrollUi);
}

function clearSelection() {
  if (selectedLayer) {
    if (selectedLayer.__baseStyle) {
      selectedLayer.setStyle(selectedLayer.__baseStyle);
    }
  }

  selectedLayer = null;
  detailsContainer.innerHTML = "Selecciona un predio o bien municipal en el mapa para ver sus atributos.";
  requestAnimationFrame(updateSidebarScrollUi);
}

function resetSelectedLayerIfHidden(layer, styleKind) {
  if (selectedLayer === layer && styleKind === "hidden") {
    selectedLayer = null;
    detailsContainer.innerHTML = "Selecciona un predio o bien municipal en el mapa para ver sus atributos.";
  }
}

function getFeatureText(properties) {
  return [properties?.numero_reg, properties?.ref]
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== "")
    .join(" ")
    .toLowerCase();
}

function updateSearch() {
  const query = (searchInput?.value || "").trim().toLowerCase();
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

  if (statResults) {
    statResults.textContent = query ? String(matches) : "0";
  }
  if (query) {
    mapMessage.textContent = `${matches} elemento(s) coinciden con la busqueda actual.`;
  } else if (activeBienesCategories.size > 0) {
    const labels = Array.from(activeBienesCategories).map((value) => getBienesCategoryLabel(value));
    mapMessage.textContent = `Filtros activos: ${labels.join(", ")}.`;
  } else {
    mapMessage.textContent = "Capas cargadas y listas para exploracion.";
  }

  updateHeroOverview();
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

function updateSidebarScrollUi() {
  if (!sidebar || !sidebarScrollThumb || !sidebarScrollUp || !sidebarScrollDown) {
    return;
  }

  const track = sidebarScrollThumb.parentElement;
  const scrollRange = Math.max(0, sidebar.scrollHeight - sidebar.clientHeight);
  const trackHeight = track.clientHeight;

  if (scrollRange <= 0 || trackHeight <= 0) {
    sidebarScrollThumb.style.height = `${trackHeight}px`;
    sidebarScrollThumb.style.transform = "translateY(0)";
    sidebarScrollUp.disabled = true;
    sidebarScrollDown.disabled = true;
    return;
  }

  const thumbHeight = Math.max(48, (sidebar.clientHeight / sidebar.scrollHeight) * trackHeight);
  const maxThumbTravel = Math.max(0, trackHeight - thumbHeight);
  const progress = sidebar.scrollTop / scrollRange;
  const thumbOffset = maxThumbTravel * progress;

  sidebarScrollThumb.style.height = `${thumbHeight}px`;
  sidebarScrollThumb.style.transform = `translateY(${thumbOffset}px)`;
  sidebarScrollUp.disabled = sidebar.scrollTop <= 0;
  sidebarScrollDown.disabled = sidebar.scrollTop >= scrollRange - 1;
}

function getSidebarScrollMetrics() {
  if (!sidebar || !sidebarScrollThumb) {
    return null;
  }

  const track = sidebarScrollThumb.parentElement;
  if (!track) {
    return null;
  }

  const scrollRange = Math.max(0, sidebar.scrollHeight - sidebar.clientHeight);
  const trackHeight = track.clientHeight;
  const thumbHeight = Math.max(48, (sidebar.clientHeight / sidebar.scrollHeight) * trackHeight);
  const maxThumbTravel = Math.max(0, trackHeight - thumbHeight);

  return {
    track,
    trackHeight,
    scrollRange,
    thumbHeight,
    maxThumbTravel
  };
}

function setSidebarScrollFromThumbOffset(thumbOffset) {
  const metrics = getSidebarScrollMetrics();
  if (!metrics || !sidebar) {
    return;
  }

  if (metrics.scrollRange <= 0 || metrics.maxThumbTravel <= 0) {
    sidebar.scrollTop = 0;
    updateSidebarScrollUi();
    return;
  }

  const clampedOffset = Math.max(0, Math.min(metrics.maxThumbTravel, thumbOffset));
  const progress = clampedOffset / metrics.maxThumbTravel;
  sidebar.scrollTop = progress * metrics.scrollRange;
  updateSidebarScrollUi();
}

function handleSidebarThumbPointerMove(event) {
  if (!sidebarScrollDragState) {
    return;
  }

  event.preventDefault();
  const metrics = getSidebarScrollMetrics();
  if (!metrics) {
    return;
  }

  const trackRect = metrics.track.getBoundingClientRect();
  const thumbOffset = event.clientY - trackRect.top - sidebarScrollDragState.pointerOffset;
  setSidebarScrollFromThumbOffset(thumbOffset);
}

function stopSidebarThumbPointerDrag() {
  if (!sidebarScrollDragState || !sidebarScrollThumb) {
    return;
  }

  sidebarScrollDragState = null;
  sidebarScrollThumb.classList.remove("is-dragging");
}

function scrollSidebarBy(amount) {
  if (!sidebar) {
    return;
  }

  sidebar.scrollBy({
    top: amount,
    behavior: "smooth"
  });
}

function bindSidebarScrollUi() {
  if (!sidebar || !sidebarScrollUp || !sidebarScrollDown || !sidebarScrollThumb) {
    return;
  }

  const track = sidebarScrollThumb.parentElement;
  sidebar.addEventListener("scroll", updateSidebarScrollUi);
  window.addEventListener("resize", updateSidebarScrollUi);
  sidebarScrollUp.addEventListener("click", () => scrollSidebarBy(-220));
  sidebarScrollDown.addEventListener("click", () => scrollSidebarBy(220));
  track?.addEventListener("pointerdown", (event) => {
    if (event.target === sidebarScrollThumb) {
      return;
    }

    const metrics = getSidebarScrollMetrics();
    if (!metrics) {
      return;
    }

    const trackRect = metrics.track.getBoundingClientRect();
    const thumbOffset = event.clientY - trackRect.top - metrics.thumbHeight / 2;
    setSidebarScrollFromThumbOffset(thumbOffset);
  });
  sidebarScrollThumb.addEventListener("pointerdown", (event) => {
    const thumbRect = sidebarScrollThumb.getBoundingClientRect();
    sidebarScrollDragState = {
      pointerOffset: event.clientY - thumbRect.top
    };
    sidebarScrollThumb.classList.add("is-dragging");
    event.preventDefault();
    event.stopPropagation();
  });
  window.addEventListener("pointermove", handleSidebarThumbPointerMove);
  window.addEventListener("pointerup", stopSidebarThumbPointerDrag);
  window.addEventListener("pointercancel", stopSidebarThumbPointerDrag);
  updateSidebarScrollUi();
}

function fitFilteredBienesBounds() {
  const source = layerState.get("bienes");
  if (!source?.layer || !map.hasLayer(source.layer)) {
    return;
  }

  const query = (searchInput?.value || "").trim().toLowerCase();
  const bounds = [];

  source.layer.eachLayer((layer) => {
    const styleKind = getLayerStyleKind("bienes", layer, query);
    if (styleKind === "hidden") {
      return;
    }

    const layerBounds = layer.getBounds ? layer.getBounds() : null;
    if (layerBounds && layerBounds.isValid()) {
      bounds.push(layerBounds);
    }
  });

  if (!bounds.length) {
    return;
  }

  const merged = bounds.reduce((accumulator, current) => accumulator.extend(current), bounds[0]);
  map.fitBounds(merged.pad(0.12));
}

function updateBienesCategoryCounts(features) {
  const counts = Object.fromEntries(bienesCategories.map((category) => [category.value, 0]));

  for (const feature of features || []) {
    const category = normalizeBienesCategory(feature?.properties?.clase);
    if (Object.hasOwn(counts, category)) {
      counts[category] += 1;
    }
  }

  for (const [category, element] of Object.entries(bienesCategoryCounters)) {
    element.textContent = String(counts[category] || 0);
  }
}

function getBienesCategoryLabel(value) {
  return bienesCategories.find((category) => category.value === value)?.label || value;
}

function renderBienesDashboards(features) {
  if (!dashboardGrid) {
    return;
  }

  bienesSupportRecords = [];
  const summary = Object.fromEntries(
    bienesCategories.map((category) => [
      category.value,
      { label: category.label, total: 0, con: 0, sin: 0, gravamenCon: 0, gravamenSin: 0, keywordCounts: {} }
    ])
  );

  for (const feature of features || []) {
    const category = normalizeBienesCategory(feature?.properties?.clase);
    if (!Object.hasOwn(summary, category)) {
      continue;
    }

    const tramiteAnalysis = analyzeTramiteSupport(feature.properties);
    const hasGravamen = hasCertificadoGravamen(feature.properties);
    summary[category].total += 1;
    if (tramiteAnalysis.hasSupport) {
      summary[category].con += 1;
      tramiteAnalysis.keywords.forEach((keyword) => {
        summary[category].keywordCounts[keyword] = (summary[category].keywordCounts[keyword] || 0) + 1;
      });
    } else {
      summary[category].sin += 1;
    }

    if (hasGravamen) {
      summary[category].gravamenCon += 1;
    } else {
      summary[category].gravamenSin += 1;
    }

    bienesSupportRecords.push({
      id: feature?.properties?.id || "",
      key: getFeatureKey(feature.properties),
      description: getFeatureDescription(feature.properties),
      categoryValue: category,
      categoryLabel: summary[category].label,
      title: getFeatureDisplayTitle(feature.properties),
      hasSupport: tramiteAnalysis.hasSupport,
      labels: tramiteAnalysis.labels,
      fieldMatches: tramiteAnalysis.fieldMatches,
      supportReferences: getSupportReferenceDetails(feature.properties),
      supportSummary: getSupportSummary(tramiteAnalysis),
      excerpt: tramiteAnalysis.excerpt,
      matchedField: tramiteAnalysis.matchedField
    });
  }

  const totalConRespaldo = bienesCategories.reduce(
    (accumulator, category) => accumulator + summary[category.value].con,
    0
  );

  dashboardCategorySummary = summary;
  if (!dashboardFocusCategory || !dashboardCategorySummary[dashboardFocusCategory]) {
    dashboardFocusCategory = bienesCategories.find((category) => summary[category.value]?.total > 0)?.value || null;
  }

  if (dashboardNote) {
    dashboardNote.textContent = `${formatNumber(totalConRespaldo)} bienes tienen respaldo porque cuentan con numero de registro o REF.`;
  }

  if (dashboardSummaryList) {
    dashboardSummaryList.innerHTML = bienesCategories.map((category) => {
      const item = summary[category.value];
      return `
        <button class="dashboard-summary-item" type="button" data-category="${escapeHtml(category.value)}" aria-pressed="false">
          <span class="dashboard-summary-title">${escapeHtml(item.label)}</span>
          <span class="dashboard-summary-text">
            Con certificado de gravamen ${formatNumber(item.gravamenCon)} y sin certificado de gravamen ${formatNumber(item.gravamenSin)}.
          </span>
        </button>
      `;
    }).join("");
    bindDashboardSummaryActions();
    updateDashboardSummaryState();
  }

  dashboardGrid.innerHTML = bienesCategories.map((category) => {
    const item = summary[category.value];
    const percentage = item.total ? Math.round((item.con / item.total) * 100) : 0;
    const topSignals = Object.entries(item.keywordCounts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([keyword]) => `<span class="dashboard-tag">${escapeHtml(keyword)}</span>`)
      .join("");

    return `
      <article class="dashboard-card">
        <div class="dashboard-top">
          <div
            class="dashboard-chart"
            style="--chart-fill: ${escapeHtml(category.color)}; --chart-angle: ${percentage * 3.6}deg;"
            aria-label="${escapeHtml(category.label)}: ${percentage}% con respaldo"
          >
            <div class="dashboard-chart-center">
              <strong>${percentage}%</strong>
              <span>con respaldo</span>
            </div>
          </div>
          <div class="dashboard-copy">
            <span class="dashboard-title">${escapeHtml(item.label)}</span>
            <p class="dashboard-copy-text">${formatNumber(item.con)} de ${formatNumber(item.total)} bienes cuentan con numero de registro o REF.</p>
          </div>
        </div>
        <div class="dashboard-metrics">
          <div class="dashboard-metric">
            <span class="dashboard-metric-label">Total</span>
            <strong>${formatNumber(item.total)}</strong>
          </div>
          <div class="dashboard-metric">
            <span class="dashboard-metric-label">Con cert. gravamen</span>
            <strong>${formatNumber(item.gravamenCon)}</strong>
          </div>
          <div class="dashboard-metric">
            <span class="dashboard-metric-label">Sin cert. gravamen</span>
            <strong>${formatNumber(item.gravamenSin)}</strong>
          </div>
        </div>
        <div class="dashboard-tags">
          ${topSignals || '<span class="dashboard-tag is-muted">Sin registro o REF</span>'}
        </div>
      </article>
    `;
  }).join("");
  populateRegistroModalCategories();
  updateRegistroModalLists();
  updateMapFocusPanel();
  updateHeroOverview();
  requestAnimationFrame(updateSidebarScrollUi);
}

function updateCategoryCardState() {
  categoryCards.forEach((card) => {
    const isActive = activeBienesCategories.has(card.dataset.category);
    card.classList.toggle("is-active", isActive);
    card.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  updateDashboardSummaryState();
  updateMapFocusPanel();
}

function updateDashboardSummaryState() {
  if (!dashboardSummaryList) {
    return;
  }

  const summaryItems = Array.from(dashboardSummaryList.querySelectorAll(".dashboard-summary-item"));
  summaryItems.forEach((item) => {
    const isActive = activeBienesCategories.size === 1 && activeBienesCategories.has(item.dataset.category);
    item.classList.toggle("is-active", isActive);
    item.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function bindDashboardSummaryActions() {
  if (!dashboardSummaryList) {
    return;
  }

  const summaryItems = Array.from(dashboardSummaryList.querySelectorAll(".dashboard-summary-item"));
  summaryItems.forEach((item) => {
    item.onclick = async () => {
      dashboardFocusCategory = item.dataset.category;
      updateMapFocusPanel();
      await focusBienesCategory(item.dataset.category);
    };
  });
}

function getLayerStyleKind(sourceId, layer, query) {
  const matchesQuery = !query || layer.__searchText.includes(query);

  if (sourceId === "bienes" && activeBienesCategories.size > 0) {
    const category = normalizeBienesCategory(layer.feature?.properties?.clase);
    if (!activeBienesCategories.has(category)) {
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
    if (layer.closePopup) {
      layer.closePopup();
    }
  } else if (styleKind === "dimmed") {
    layer.setStyle(layer.__dimmedStyle);
  } else {
    layer.setStyle(layer.__baseStyle);
    if (layer.bringToFront) {
      layer.bringToFront();
    }
  }

  if (layer.options) {
    layer.options.interactive = styleKind !== "hidden";
  }

  resetSelectedLayerIfHidden(layer, styleKind);
}

function refreshBienesFilter() {
  const source = layerState.get("bienes");
  if (!source?.layer) {
    updateCategoryCardState();
    return;
  }

  const query = (searchInput?.value || "").trim().toLowerCase();
  source.layer.eachLayer((layer) => {
    const styleKind = getLayerStyleKind("bienes", layer, query);
    applyLayerStyle(layer, styleKind);
  });

  updateCategoryCardState();
  updateSearch();
}

async function ensureBienesLayerVisible() {
  if (toggleBienes.checked) {
    return true;
  }

  toggleBienes.checked = true;
  mapMessage.textContent = "Cargando bienes municipales...";
  try {
    await ensureSourceLoaded("bienes");
    const source = layerState.get("bienes");
    if (source) {
      source.layer.addTo(map);
      if (statBienes) {
        if (statBienes) {
          statBienes.textContent = String(source.featureCount || 0);
        }
      }
    }
    return true;
  } catch (error) {
    console.error("bienes", error);
    toggleBienes.checked = false;
    activeBienesCategories.clear();
    updateCategoryCardState();
    mapMessage.textContent = "No se pudieron cargar los bienes municipales.";
    return false;
  }
}

async function focusBienesCategory(category) {
  dashboardFocusCategory = category;
  activeBienesCategories.clear();
  activeBienesCategories.add(category);
  updateCategoryCardState();

  const isReady = await ensureBienesLayerVisible();
  if (!isReady) {
    return;
  }

  refreshBienesFilter();
  fitFilteredBienesBounds();
}

function getBienesColor(category) {
  const normalizedCategory = normalizeBienesCategory(category);
  if (bienesColorMap[normalizedCategory]) {
    return bienesColorMap[normalizedCategory];
  }

  let hash = 0;
  for (let index = 0; index < normalizedCategory.length; index += 1) {
    hash = (hash * 31 + normalizedCategory.charCodeAt(index)) >>> 0;
  }

  return bienesFallbackPalette[hash % bienesFallbackPalette.length];
}

function hexToRgb(hex) {
  const sanitized = String(hex || "").trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(sanitized)) {
    return null;
  }

  return {
    red: Number.parseInt(sanitized.slice(0, 2), 16),
    green: Number.parseInt(sanitized.slice(2, 4), 16),
    blue: Number.parseInt(sanitized.slice(4, 6), 16)
  };
}

function mixHexColors(baseHex, targetHex, ratio) {
  const baseRgb = hexToRgb(baseHex);
  const targetRgb = hexToRgb(targetHex);
  if (!baseRgb || !targetRgb) {
    return baseHex;
  }

  const mixRatio = Math.max(0, Math.min(1, ratio));
  const channels = ["red", "green", "blue"].map((channel) => {
    const value = Math.round(baseRgb[channel] + (targetRgb[channel] - baseRgb[channel]) * mixRatio);
    return value.toString(16).padStart(2, "0");
  });

  return `#${channels.join("")}`;
}

function getFeatureStyle(source, feature) {
  if (source.id === "catastro") {
    return {
      color: source.color,
      weight: 0.8,
      fillColor: source.fillColor,
      fillOpacity: 0,
      opacity: 0.6
    };
  }

  const color = getBienesColor(feature?.properties?.clase);
  const hasSupport = hasCertificadoGravamen(feature?.properties);
  const noSupportStroke = mixHexColors(color, "#94a3b8", 0.42);
  const noSupportFill = mixHexColors(color, "#cbd5e1", 0.22);
  const geometryType = feature?.geometry?.type || "";
  if (geometryType === "Point" || geometryType === "MultiPoint") {
    if (hasSupport) {
      return {
        radius: 7.4,
        color: "#f8fafc",
        weight: 2.1,
        fillColor: color,
        fillOpacity: 0.9,
        opacity: 1
      };
    }

    return {
      radius: 5.4,
      color: noSupportStroke,
      weight: 2.1,
      fillColor: noSupportFill,
      fillOpacity: 0.24,
      opacity: 0.98
    };
  }

  if (hasSupport) {
    return {
      color,
      weight: 3.2,
      fillColor: color,
      fillOpacity: 0.16,
      opacity: 1
    };
  }

  return {
    color: noSupportStroke,
    weight: 2.2,
    fillColor: noSupportFill,
    fillOpacity: 0.04,
    opacity: 0.98,
    dashArray: "4 8"
  };
}

function getDimmedStyle(baseStyle) {
  const nextStyle = {
    ...baseStyle,
    fillOpacity: 0,
    opacity: 0.2
  };

  if (Object.hasOwn(baseStyle, "radius")) {
    nextStyle.radius = Math.max(3, (baseStyle.radius || 0) - 1);
    nextStyle.fillOpacity = 0.08;
  }

  return nextStyle;
}

function getHiddenStyle(baseStyle) {
  const nextStyle = {
    ...baseStyle,
    weight: 0,
    fillOpacity: 0,
    opacity: 0
  };

  if (Object.hasOwn(baseStyle, "radius")) {
    nextStyle.radius = 0.5;
  }

  return nextStyle;
}

function buildGeoJsonLayer(source, geojson) {
  const highlightStyle = {
    color: "#111827",
    weight: 2.5,
    fillOpacity: 0,
    opacity: 1,
    dashArray: null
  };

  if (source.id === "bienes") {
    bienesLayerIndex.clear();
  }

  const layer = L.geoJSON(geojson, {
    style: (feature) => getFeatureStyle(source, feature),
    pointToLayer(feature, latlng) {
      return L.circleMarker(latlng, getFeatureStyle(source, feature));
    },
    onEachFeature(feature, featureLayer) {
      const baseStyle = getFeatureStyle(source, feature);
      featureLayer.__sourceId = source.id;
      featureLayer.__sourceName = source.name;
      featureLayer.__searchText = getFeatureText(feature.properties);
      featureLayer.__baseStyle = baseStyle;
      featureLayer.__dimmedStyle = getDimmedStyle(baseStyle);
      featureLayer.__hiddenStyle = getHiddenStyle(baseStyle);
      featureLayer.__highlightStyle = highlightStyle;

      const featureId = String(feature?.properties?.id || "").trim();
      if (source.id === "bienes" && featureId) {
        bienesLayerIndex.set(featureId, featureLayer);
      }

      featureLayer.on("click", () => {
        selectFeatureLayer(featureLayer);
      });

      if (source.id === "bienes") {
        const tramiteAnalysis = analyzeTramiteSupport(feature.properties);
        const supportReferences = getSupportReferenceDetails(feature.properties);
        const supportReferencesMarkup = supportReferences.length
          ? `<br>${supportReferences.map((item) => (
            `<strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value)}`
          )).join("<br>")}`
          : "";
        featureLayer.bindPopup(`
          <div class="map-popup">
            <strong>${escapeHtml(source.name)}</strong><br>
            <strong>Clave:</strong> ${escapeHtml(getFeatureKey(feature.properties))}<br>
            <strong>Descripcion:</strong> ${escapeHtml(getFeatureDescription(feature.properties))}<br>
            <strong>Clasificacion:</strong> ${escapeHtml(normalizeBienesCategory(feature.properties?.clase) || "Sin clasificacion")}<br>
            <strong>Estado documental:</strong> ${escapeHtml(getSupportSummary(tramiteAnalysis))}
            ${supportReferencesMarkup}
          </div>
        `);
        return;
      }

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

function normalizeFeatures(source, features) {
  return (features || []).filter((feature) => {
    if (source?.id === "bienes" && feature?.properties) {
      feature.properties.clase = normalizeBienesCategory(feature.properties.clase);
    }

    const geometry = feature?.geometry;
    if (!geometry) {
      return false;
    }

    if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
      return true;
    }

    if (source?.id === "bienes") {
      return geometry.type === "Point" || geometry.type === "MultiPoint";
    }

    return false;
  });
}

async function loadSource(source) {
  const response = await fetch(source.path);
  if (!response.ok) {
    throw new Error(`No fue posible leer ${source.path}.`);
  }

  const parsed = await response.json();
  const features = normalizeFeatures(source, parsed.features);
  const layer = buildGeoJsonLayer(source, {
    type: "FeatureCollection",
    features
  });

  if (source.id === "bienes") {
    updateBienesCategoryCounts(features);
    renderBienesDashboards(features);
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
      updateHeroOverview();
      return;
    }

    mapMessage.textContent = "Cargando catastro municipal...";

    try {
      await ensureSourceLoaded("catastro");
      const source = layerState.get("catastro");
      if (source) {
        source.layer.addTo(map);
        if (statCatastro) {
          statCatastro.textContent = String(source.featureCount || 0);
        }
      }
      mapMessage.textContent = "Capas cargadas y listas para exploracion.";
      updateHeroOverview();
      fitAllLayers();
    } catch (error) {
      console.error("catastro", error);
      event.target.checked = false;
      mapMessage.textContent = "No se pudo cargar el catastro municipal.";
      updateHeroOverview();
    }
  });

  toggleBienes.addEventListener("change", async (event) => {
    if (!event.target.checked) {
      const source = layerState.get("bienes");
      if (source) {
        map.removeLayer(source.layer);
      }
      updateHeroOverview();
      return;
    }

    mapMessage.textContent = "Cargando bienes municipales...";

    try {
      await ensureSourceLoaded("bienes");
      const source = layerState.get("bienes");
      if (source) {
        source.layer.addTo(map);
        if (statBienes) {
          statBienes.textContent = String(source.featureCount || 0);
        }
      }
      mapMessage.textContent = "Capas cargadas y listas para exploracion.";
      updateHeroOverview();
      fitAllLayers();
    } catch (error) {
      console.error("bienes", error);
      event.target.checked = false;
      mapMessage.textContent = "No se pudieron cargar los bienes municipales.";
      updateHeroOverview();
    }
  });

  categoryCards.forEach((card) => {
    card.addEventListener("click", async () => {
      const category = card.dataset.category;
      if (activeBienesCategories.has(category)) {
        activeBienesCategories.delete(category);
        if (dashboardFocusCategory === category) {
          dashboardFocusCategory = activeBienesCategories.size ? Array.from(activeBienesCategories).at(-1) : null;
        }
      } else {
        activeBienesCategories.add(category);
        dashboardFocusCategory = category;
      }
      updateCategoryCardState();

      if (!(await ensureBienesLayerVisible())) {
        return;
      }

      refreshBienesFilter();
      if (activeBienesCategories.size > 0) {
        fitFilteredBienesBounds();
      } else {
        fitAllLayers();
      }
    });
  });

  dashboardSummaryList?.addEventListener("click", async (event) => {
    const summaryItem = event.target.closest(".dashboard-summary-item");
    if (!summaryItem) {
      return;
    }

    dashboardFocusCategory = summaryItem.dataset.category;
    updateMapFocusPanel();
    await focusBienesCategory(summaryItem.dataset.category);
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
  bindSidebarScrollUi();
  bindRegistroModal();

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

  if (statCatastro) {
    statCatastro.textContent = String(counts.catastro || 0);
  }

  if (statBienes) {
    statBienes.textContent = String(counts.bienes || 0);
  }

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

  updateHeroOverview();
  requestAnimationFrame(updateSidebarScrollUi);
}

searchInput?.addEventListener("input", updateSearch);
clearSelectionButton.addEventListener("click", clearSelection);
fitAllButton?.addEventListener("click", fitAllLayers);
heroFitAllButton?.addEventListener("click", fitAllLayers);
heroOpenRegistroButton?.addEventListener("click", openRegistroModal);

initialize().catch((error) => {
  console.error(error);
  mapMessage.textContent = "Hubo un problema al iniciar el geoportal.";
  setStatus([
    "Ocurrio un error inesperado al iniciar la aplicacion.",
    "Recarga la pagina dentro de unos segundos.",
    "Si persiste, revisamos el despliegue publicado."
  ]);
});



