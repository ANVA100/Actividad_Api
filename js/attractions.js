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

  if (!statusRegion || !resultsRegion || !totalLabel) return;

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

  async function loadAttractions() {
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

      const departmentsById = new Map(
        (Array.isArray(departmentData) ? departmentData : [])
          .filter((department) => department && department.id !== null && department.id !== undefined && department.name)
          .map((department) => [String(department.id), department.name])
      );
      const allAttractions = attractionData.filter(
        (attraction) => attraction && typeof attraction === "object"
      );
      const attractions = allAttractions.slice(0, FIRST_ITEMS_LIMIT);

      if (attractions.length === 0) {
        totalLabel.textContent = "0 atractivos";
        ColombiaApi.showEmpty(statusRegion, "La API no devolvió atractivos turísticos para mostrar.");
        return;
      }

      resultsRegion.replaceChildren(
        ...attractions.map((attraction, index) => createAttractionCard(attraction, index, departmentsById))
      );
      totalLabel.textContent = allAttractions.length > attractions.length
        ? `Primeros ${formatCount(attractions.length)} de ${formatCount(allAttractions.length)} atractivos`
        : `Mostrando ${formatCount(attractions.length)} atractivos`;
      statusRegion.replaceChildren();
      statusRegion.setAttribute("aria-busy", "false");
    } catch (error) {
      totalLabel.textContent = "Guía no disponible";
      ColombiaApi.showError(statusRegion, error, loadAttractions);
    }
  }

  function formatCount(value) {
    return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value);
  }

  loadAttractions();
})();
