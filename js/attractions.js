(() => {
  const FIRST_ITEMS_LIMIT = 20;
  const FALLBACK_IMAGES = [
    {
      url: "https://images.unsplash.com/photo-1588535030351-7b8b8c1d05c0?auto=format&fit=crop&w=1000&q=80",
      source: "https://unsplash.com/es/s/fotos/paisaje-de-colombia",
      credit: "Foto de referencia · Unsplash ↗",
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/P%C3%B3rtico_Hacienda_N%C3%A1poles.JPG/800px-P%C3%B3rtico_Hacienda_N%C3%A1poles.JPG",
      source: "https://commons.wikimedia.org/wiki/File:P%C3%B3rtico_Hacienda_N%C3%A1poles.JPG",
      credit: "Foto de referencia · Wikimedia Commons ↗",
    },
  ];
  const statusRegion = document.querySelector("#attraction-status");
  const resultsRegion = document.querySelector("#attraction-results");
  const totalLabel = document.querySelector("#attraction-count");
  const filterForm = document.querySelector("#attraction-filter-form");
  const searchInput = document.querySelector("#attraction-search");
  const clearSearchButton = document.querySelector("#attraction-clear");

  if (!statusRegion || !resultsRegion || !totalLabel || !filterForm || !searchInput || !clearSearchButton) return;

  let firstAttractions = [];
  let departmentsById = new Map();
  let totalAttractionCount = 0;
  let hasLoaded = false;
  let searchTimer = null;

  function makeTextElement(tagName, className, text) {
    const element = document.createElement(tagName);
    element.className = className;
    element.textContent = text;
    return element;
  }

  function getDepartmentName(attraction, departmentsById) {
    const city = attraction.city;
    const departmentName = city?.department?.name;
    const departmentId = city?.departmentId ?? attraction.departmentId;

    return departmentName
      || departmentsById.get(String(departmentId))
      || "Departamento no disponible";
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("es");
  }

  function getSecureImageUrl(images) {
    if (!Array.isArray(images)) return null;

    for (const imageValue of images) {
      if (typeof imageValue !== "string") continue;

      try {
        const imageUrl = new URL(imageValue);
        if (imageUrl.protocol === "https:") return imageUrl.href;
      } catch {
        // Ignoramos enlaces incompletos y probamos la siguiente imagen.
      }
    }

    return null;
  }

  function addFallbackCredit(caption, fallbackImage) {
    const creditLink = document.createElement("a");
    creditLink.className = "attraction-credit-link";
    creditLink.href = fallbackImage.source;
    creditLink.target = "_blank";
    creditLink.rel = "noreferrer";
    creditLink.textContent = fallbackImage.credit;
    caption.replaceChildren(creditLink);
  }

  function applyFallbackImage(image, figure, caption, name, fallbackIndex = 0) {
    const fallbackImage = FALLBACK_IMAGES[fallbackIndex];
    if (!fallbackImage) {
      image.remove();
      figure.classList.add("photo-unavailable");
      caption.textContent = "Imagen temporalmente no disponible";
      return;
    }

    image.dataset.usingFallback = "true";
    image.dataset.fallbackIndex = String(fallbackIndex);
    image.alt = `Paisaje de Colombia de referencia para ${name}`;
    figure.classList.add("is-fallback-image");
    addFallbackCredit(caption, fallbackImage);
    image.src = fallbackImage.url;
  }

  function createAttractionCard(attraction, index, departmentsById) {
    const name = typeof attraction.name === "string" && attraction.name.trim()
      ? attraction.name.trim()
      : "Atractivo turístico";
    const cityName = attraction.city?.name || "Ciudad no disponible";
    const departmentName = getDepartmentName(attraction, departmentsById);
    const description = typeof attraction.description === "string" && attraction.description.trim()
      ? attraction.description.trim()
      : "Descripción no disponible.";

    const card = document.createElement("article");
    card.className = "attraction-card";

    const figure = document.createElement("figure");
    figure.className = "attraction-photo";
    const image = document.createElement("img");
    image.alt = `Fotografía de ${name}`;
    image.loading = "lazy";
    image.decoding = "async";
    const caption = document.createElement("figcaption");
    caption.className = "attraction-photo-caption";
    caption.textContent = "Imagen incluida en API Colombia";
    image.addEventListener("error", () => {
      if (image.dataset.usingFallback === "true") {
        const nextFallbackIndex = Number(image.dataset.fallbackIndex) + 1;
        applyFallbackImage(image, figure, caption, name, nextFallbackIndex);
        return;
      }

      applyFallbackImage(image, figure, caption, name);
    });

    const apiImageUrl = getSecureImageUrl(attraction.images);
    if (apiImageUrl) {
      image.src = apiImageUrl;
    } else {
      applyFallbackImage(image, figure, caption, name);
    }
    figure.append(image, caption);

    const body = document.createElement("div");
    body.className = "attraction-card-body";
    body.append(
      makeTextElement("p", "attraction-index", `DESTINO  /  ${String(index + 1).padStart(2, "0")}`),
      makeTextElement("h3", "attraction-name", name)
    );

    const location = document.createElement("p");
    location.className = "attraction-location";
    location.append(
      makeTextElement("span", "attraction-city", cityName),
      makeTextElement("span", "attraction-location-separator", "·"),
      makeTextElement("span", "attraction-department", departmentName)
    );

    body.append(location, makeTextElement("p", "attraction-description", description));
    card.append(figure, body);
    return card;
  }

  function renderAttractions() {
    const query = normalizeText(searchInput.value.trim());
    const matchingAttractions = firstAttractions.filter(({ attraction }) => {
      if (!query) return true;
      const searchableText = [
        attraction.name,
        attraction.city?.name,
        getDepartmentName(attraction, departmentsById),
        attraction.description,
      ].join(" ");
      return normalizeText(searchableText).includes(query);
    });

    if (matchingAttractions.length === 0) {
      resultsRegion.replaceChildren();
      totalLabel.textContent = `0 resultados entre los primeros ${formatCount(firstAttractions.length)}`;
      ColombiaApi.showEmpty(statusRegion, "No hay atractivos que coincidan entre los primeros 20.");
      return;
    }

    resultsRegion.replaceChildren(
      ...matchingAttractions.map(({ attraction, index }) => createAttractionCard(attraction, index, departmentsById))
    );
    totalLabel.textContent = query
      ? `${formatCount(matchingAttractions.length)} resultados entre los primeros ${formatCount(firstAttractions.length)}`
      : totalAttractionCount > firstAttractions.length
        ? `Primeros ${formatCount(firstAttractions.length)} de ${formatCount(totalAttractionCount)} atractivos`
        : `Mostrando ${formatCount(firstAttractions.length)} atractivos`;
    statusRegion.replaceChildren();
    statusRegion.setAttribute("aria-busy", "false");
  }

  async function loadAttractions() {
    hasLoaded = false;
    ColombiaApi.showLoading(statusRegion, "Consultando atractivos turísticos...");
    totalLabel.textContent = "Cargando atractivos";
    resultsRegion.replaceChildren();

    try {
      const [attractionData, departmentData] = await Promise.all([
        ColombiaApi.getJson("TouristicAttraction"),
        ColombiaApi.getJson("Department"),
      ]);

      if (!Array.isArray(attractionData)) {
        throw new TypeError("El endpoint de atractivos no devolvió una lista.");
      }

      departmentsById = new Map(
        (Array.isArray(departmentData) ? departmentData : [])
          .filter((department) => department && department.id !== null && department.id !== undefined && department.name)
          .map((department) => [String(department.id), department.name])
      );
      const allAttractions = attractionData.filter(
        (attraction) => attraction && typeof attraction === "object"
      );
      firstAttractions = allAttractions
        .slice(0, FIRST_ITEMS_LIMIT)
        .map((attraction, index) => ({ attraction, index }));
      totalAttractionCount = allAttractions.length;

      if (firstAttractions.length === 0) {
        hasLoaded = true;
        totalLabel.textContent = "0 atractivos";
        ColombiaApi.showEmpty(statusRegion, "La API no devolvió atractivos turísticos para mostrar.");
        return;
      }

      hasLoaded = true;
      renderAttractions();
    } catch (error) {
      hasLoaded = false;
      totalLabel.textContent = "Guía no disponible";
      ColombiaApi.showError(statusRegion, error, loadAttractions);
    }
  }

  function formatCount(value) {
    return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value);
  }

  function updateFromSearch() {
    if (!hasLoaded) return;
    renderAttractions();
  }

  function scheduleSearchUpdate() {
    if (!hasLoaded) return;
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(updateFromSearch, 140);
  }

  filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    window.clearTimeout(searchTimer);
    updateFromSearch();
  });
  searchInput.addEventListener("input", scheduleSearchUpdate);
  clearSearchButton.addEventListener("click", () => {
    window.clearTimeout(searchTimer);
    searchInput.value = "";
    updateFromSearch();
    searchInput.focus();
  });

  loadAttractions();
})();
