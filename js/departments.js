(() => {
  const PAGE_SIZE = 15;
  const statusRegion = document.querySelector("#department-status");
  const resultsRegion = document.querySelector("#department-results");
  const totalLabel = document.querySelector("#department-count");
  const regionSummary = document.querySelector("#region-summary");
  const pagination = document.querySelector("#department-pagination");
  const previousButton = document.querySelector("#department-prev");
  const nextButton = document.querySelector("#department-next");
  const pageLabel = document.querySelector("#department-page-label");

  if (!statusRegion || !resultsRegion || !totalLabel || !regionSummary || !pagination) return;

  let departments = [];
  let regionsById = new Map();
  let currentPage = 1;

  function formatNumber(value) {
    if (value === null || value === undefined || value === "") return "Sin dato";
    const number = Number(value);
    if (!Number.isFinite(number)) return "Sin dato";
    return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(number);
  }

  function makeTextElement(tagName, className, text) {
    const element = document.createElement(tagName);
    element.className = className;
    element.textContent = text;
    return element;
  }

  function makeMetric(label, value) {
    const wrapper = document.createElement("div");
    wrapper.className = "department-metric";
    wrapper.append(
      makeTextElement("dt", "", label),
      makeTextElement("dd", "", value)
    );
    return wrapper;
  }

  function getRegionName(department) {
    return department.region?.name
      || regionsById.get(String(department.regionId))
      || "Región no disponible";
  }

  function renderRegionSummary() {
    const counts = new Map(
      Array.from(new Set(regionsById.values()), (name) => [name, 0])
    );

    departments.forEach((department) => {
      const regionName = getRegionName(department);
      counts.set(regionName, (counts.get(regionName) || 0) + 1);
    });

    const items = Array.from(counts, ([name, count]) => {
      const item = document.createElement("li");
      item.className = "region-stat";
      item.append(
        makeTextElement("span", "region-stat-name", name),
        makeTextElement("strong", "region-stat-count", formatNumber(count))
      );
      return item;
    });

    regionSummary.replaceChildren(...items);
  }

  function createDepartmentCard(department) {
    const regionName = getRegionName(department);
    const capitalName = department.cityCapital?.name || "No registrada";
    const description = typeof department.description === "string" && department.description.trim()
      ? department.description.trim()
      : "Descripción no disponible.";

    const card = document.createElement("article");
    card.className = "department-card";

    const top = document.createElement("div");
    top.className = "department-card-top";
    top.append(
      makeTextElement("p", "department-region", regionName),
      makeTextElement("span", "department-id", `#${department.id ?? "—"}`)
    );

    const title = makeTextElement("h3", "department-name", department.name || "Departamento sin nombre");
    const capital = document.createElement("p");
    capital.className = "department-capital";
    capital.append(makeTextElement("span", "", "Capital"), document.createTextNode(` ${capitalName}`));

    const metrics = document.createElement("dl");
    metrics.className = "department-metrics";
    metrics.append(
      makeMetric("Población", formatNumber(department.population)),
      makeMetric("Superficie", department.surface === null || department.surface === undefined
        ? "Sin dato"
        : `${formatNumber(department.surface)} km²`),
      makeMetric("Municipios", formatNumber(department.municipalities))
    );

    const descriptionBlock = document.createElement("p");
    descriptionBlock.className = "department-description";
    descriptionBlock.textContent = description;

    card.append(top, title, capital, metrics, descriptionBlock);
    return card;
  }

  function updatePagination(totalItems) {
    const pageCount = Math.ceil(totalItems / PAGE_SIZE);
    pagination.hidden = pageCount <= 1;
    previousButton.disabled = currentPage <= 1;
    nextButton.disabled = currentPage >= pageCount;
    const firstVisible = (currentPage - 1) * PAGE_SIZE + 1;
    const lastVisible = Math.min(currentPage * PAGE_SIZE, totalItems);
    pageLabel.textContent = `${firstVisible}–${lastVisible} de ${formatNumber(totalItems)} · página ${currentPage} de ${pageCount}`;
  }

  function renderDepartments() {
    const totalItems = departments.length;
    const pageCount = Math.ceil(totalItems / PAGE_SIZE);
    currentPage = Math.min(Math.max(currentPage, 1), Math.max(pageCount, 1));

    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const visibleDepartments = departments.slice(startIndex, startIndex + PAGE_SIZE);
    const cards = visibleDepartments.map(createDepartmentCard);
    resultsRegion.replaceChildren(...cards);

    totalLabel.textContent = `${formatNumber(totalItems)} departamentos`;
    updatePagination(totalItems);
    statusRegion.replaceChildren();
    statusRegion.setAttribute("aria-busy", "false");
  }

  async function loadDepartments() {
    ColombiaApi.showLoading(statusRegion, "Consultando departamentos y regiones...");
    totalLabel.textContent = "Cargando directorio";
    resultsRegion.replaceChildren();
    pagination.hidden = true;

    try {
      const [departmentData, regionData] = await Promise.all([
        ColombiaApi.getJson("Department"),
        ColombiaApi.getJson("Region"),
      ]);

      if (!Array.isArray(departmentData)) {
        throw new TypeError("El endpoint de departamentos no devolvió una lista.");
      }

      regionsById = new Map(
        (Array.isArray(regionData) ? regionData : [])
          .filter((region) => region && region.id !== null && region.id !== undefined && region.name)
          .map((region) => [String(region.id), region.name])
      );

      departments = departmentData
        .filter((department) => department && typeof department === "object")
        .sort((first, second) => String(first.name || "").localeCompare(String(second.name || ""), "es", { sensitivity: "base" }));

      if (departments.length === 0) {
        totalLabel.textContent = "0 departamentos";
        renderRegionSummary();
        ColombiaApi.showEmpty(statusRegion, "La API no devolvió departamentos para mostrar.");
        pagination.hidden = true;
        return;
      }

      renderRegionSummary();
      currentPage = 1;
      renderDepartments();
    } catch (error) {
      totalLabel.textContent = "Directorio no disponible";
      ColombiaApi.showError(statusRegion, error, loadDepartments);
    }
  }

  previousButton.addEventListener("click", () => {
    if (currentPage <= 1) return;
    currentPage -= 1;
    renderDepartments();
  });

  nextButton.addEventListener("click", () => {
    const pageCount = Math.ceil(departments.length / PAGE_SIZE);
    if (currentPage >= pageCount) return;
    currentPage += 1;
    renderDepartments();
  });

  loadDepartments();
})();
