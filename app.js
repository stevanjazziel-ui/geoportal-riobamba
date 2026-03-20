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
const heroFitAllButton = document.getElementById("hero-fit-all");
const heroOpenRegistroButton = document.getElementById("hero-open-registro");
const statCatastro = document.getElementById("stat-catastro");
const statBienes = document.getElementById("stat-bienes");
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
  { value: "Bienes Municipales Rurale", label: "Bienes Municipales Rurales", countId: "count-bienes-rurales", color: "#65a30d", dashKey: "bienes-rurales" },
  { value: "Bienes Municipales Urbano", label: "Bienes Municipales Urbanos", countId: "count-bienes-urbanos", color: "#b45309", dashKey: "bienes-urbanos" },
  { value: "Comodato", label: "Comodato", countId: "count-comodato", color: "#7c3aed", dashKey: "comodato" },
  { value: "Monstrencos_urbanos", label: "Monstrencos Urbanos", countId: "count-monstrencos-urbanos", color: "#ea580c", dashKey: "monstrencos-urbanos" },
  { value: "Mostrencos_Rurales", label: "Mostrencos Rurales", countId: "count-mostrencos-rurales", color: "#92400e", dashKey: "mostrencos-rurales" },
  { value: "Subdivisiones", label: "Subdivisiones", countId: "count-subdivisiones", color: "#dc2626", dashKey: "subdivisiones" }
];
const bienesCategoryCounters = Object.fromEntries(
  bienesCategories.map((category) => [category.value, document.getElementById(category.countId)])
);

let selectedLayer = null;
const activeBienesCategories = new Set();
const sourceLoadPromises = new Map();
const bienesLayerIndex = new Map();
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
const documentSupportFields = new Set(["documento", "numero_reg"]);
const tramiteKeywordPatterns = [
  { term: "tramite", label: "tramite" },
  { term: "resolucion", label: "resolucion" },
  { term: "registro", label: "registro" },
  { term: "registr", label: "registro" },
  { term: "certificado", label: "certificado" },
  { term: "ordenanza", label: "ordenanza" },
  { term: "escritura", label: "escritura" },
  { term: "inscrip", label: "inscripcion" },
  { term: "acuerdo", label: "acuerdo" },
  { term: "convenio", label: "convenio" },
  { term: "minuta", label: "minuta" },
  { term: "protocol", label: "protocolizacion" },
  { term: "sentencia", label: "sentencia" },
  { term: "adjudic", label: "adjudicacion" },
  { term: "legaliz", label: "legalizacion" },
  { term: "regulariz", label: "regularizacion" }
];
const propertyLabelMap = {
  documento: "Documento",
  numero_reg: "Numero de registro",
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

function updateHeroOverview() {
  if (!heroActiveLayers || !heroActiveFilters || !heroSupportCount || !heroCatastroCount || !heroBienesCount || !heroViewMode) {
    return;
  }

  const activeLayers = dataSources.reduce((count, source) => {
    const layer = layerState.get(source.id)?.layer;
    return layer && map.hasLayer(layer) ? count + 1 : count;
  }, 0);
  const activeFilters = activeBienesCategories.size + (searchInput.value.trim() ? 1 : 0);
  const supportCount = bienesSupportRecords.filter((record) => record.hasSupport).length;
  const catastroCount = layerState.get("catastro")?.featureCount || 0;
  const bienesCount = layerState.get("bienes")?.featureCount || 0;

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
  const keywords = new Set();
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
    const matchedKeywords = [];

    if (documentSupportFields.has(key)) {
      labels.add(fieldLabel);
    }

    tramiteKeywordPatterns.forEach((pattern) => {
      if (normalizedValue.includes(pattern.term)) {
        matchedKeywords.push(pattern.label);
        keywords.add(pattern.label);
        labels.add(pattern.label);
      }
    });

    if (documentSupportFields.has(key) || matchedKeywords.length > 0) {
      fieldMatches.push({
        field: key,
        fieldLabel,
        value,
        excerpt: buildExcerpt(value),
        matchedKeywords: Array.from(new Set(matchedKeywords))
      });
    }
  });

  const excerptSource = fieldMatches[0] || null;

  return {
    hasSupport: labels.size > 0,
    labels: Array.from(labels),
    keywords: Array.from(keywords),
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
      <p class="modal-item-signals">Campos y senales detectadas</p>
      ${labelsMarkup}
      ${fieldsMarkup}
    `
    : '<p class="modal-item-text">No se encontraron referencias de tramite, resolucion, registro o documento en los atributos revisados.</p>';

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
  if (!sidebar || !sidebarScrollUp || !sidebarScrollDown) {
    return;
  }

  sidebar.addEventListener("scroll", updateSidebarScrollUi);
  window.addEventListener("resize", updateSidebarScrollUi);
  sidebarScrollUp.addEventListener("click", () => scrollSidebarBy(-220));
  sidebarScrollDown.addEventListener("click", () => scrollSidebarBy(220));
  updateSidebarScrollUi();
}

function fitFilteredBienesBounds() {
  const source = layerState.get("bienes");
  if (!source?.layer || !map.hasLayer(source.layer)) {
    return;
  }

  const query = searchInput.value.trim().toLowerCase();
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
    const category = String(feature?.properties?.clase || "").trim();
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
      { label: category.label, total: 0, con: 0, sin: 0, keywordCounts: {} }
    ])
  );

  for (const feature of features || []) {
    const category = String(feature?.properties?.clase || "").trim();
    if (!Object.hasOwn(summary, category)) {
      continue;
    }

    const tramiteAnalysis = analyzeTramiteSupport(feature.properties);
    summary[category].total += 1;
    if (tramiteAnalysis.hasSupport) {
      summary[category].con += 1;
      tramiteAnalysis.keywords.forEach((keyword) => {
        summary[category].keywordCounts[keyword] = (summary[category].keywordCounts[keyword] || 0) + 1;
      });
    } else {
      summary[category].sin += 1;
    }

    bienesSupportRecords.push({
      id: feature?.properties?.id || "",
      categoryValue: category,
      categoryLabel: summary[category].label,
      title: getFeatureDisplayTitle(feature.properties),
      hasSupport: tramiteAnalysis.hasSupport,
      labels: tramiteAnalysis.labels,
      fieldMatches: tramiteAnalysis.fieldMatches,
      excerpt: tramiteAnalysis.excerpt,
      matchedField: tramiteAnalysis.matchedField
    });
  }

  const totalConRespaldo = bienesCategories.reduce(
    (accumulator, category) => accumulator + summary[category.value].con,
    0
  );

  if (dashboardNote) {
    dashboardNote.textContent = `${formatNumber(totalConRespaldo)} bienes muestran senales documentales al revisar campos como documento, numero de registro, nombre, institucion y fuente.`;
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
            <p class="dashboard-copy-text">${formatNumber(item.con)} de ${formatNumber(item.total)} bienes muestran senales de tramite, resolucion, registro o documento de respaldo.</p>
          </div>
        </div>
        <div class="dashboard-metrics">
          <div class="dashboard-metric">
            <span class="dashboard-metric-label">Total</span>
            <strong>${formatNumber(item.total)}</strong>
          </div>
          <div class="dashboard-metric">
            <span class="dashboard-metric-label">Con respaldo</span>
            <strong>${formatNumber(item.con)}</strong>
          </div>
          <div class="dashboard-metric">
            <span class="dashboard-metric-label">Sin respaldo</span>
            <strong>${formatNumber(item.sin)}</strong>
          </div>
        </div>
        <div class="dashboard-tags">
          ${topSignals || '<span class="dashboard-tag is-muted">Sin palabras clave detectadas</span>'}
        </div>
      </article>
    `;
  }).join("");
  populateRegistroModalCategories();
  updateRegistroModalLists();
  updateHeroOverview();
  requestAnimationFrame(updateSidebarScrollUi);
}

function updateCategoryCardState() {
  categoryCards.forEach((card) => {
    const isActive = activeBienesCategories.has(card.dataset.category);
    card.classList.toggle("is-active", isActive);
    card.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function getLayerStyleKind(sourceId, layer, query) {
  const matchesQuery = !query || layer.__searchText.includes(query);

  if (sourceId === "bienes" && activeBienesCategories.size > 0) {
    const category = String(layer.feature?.properties?.clase || "").trim();
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
      weight: 0.8,
      fillColor: source.fillColor,
      fillOpacity: 0,
      opacity: 0.6
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
    weight: 0,
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

  if (source.id === "bienes") {
    bienesLayerIndex.clear();
  }

  const layer = L.geoJSON(geojson, {
    style: (feature) => getFeatureStyle(source, feature),
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
        statCatastro.textContent = String(source.featureCount || 0);
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
        statBienes.textContent = String(source.featureCount || 0);
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
      } else {
        activeBienesCategories.add(category);
      }
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
          activeBienesCategories.clear();
          updateCategoryCardState();
          mapMessage.textContent = "No se pudieron cargar los bienes municipales.";
          return;
        }
      }

      refreshBienesFilter();
      if (activeBienesCategories.size > 0) {
        fitFilteredBienesBounds();
      } else {
        fitAllLayers();
      }
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

  updateHeroOverview();
  requestAnimationFrame(updateSidebarScrollUi);
}

searchInput.addEventListener("input", updateSearch);
clearSelectionButton.addEventListener("click", clearSelection);
fitAllButton.addEventListener("click", fitAllLayers);
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
