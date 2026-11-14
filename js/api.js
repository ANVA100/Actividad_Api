(() => {
  const API_ROOT = "https://api-colombia.com/api/v1";
  const CACHE_PREFIX = "colombia-api:";
  const CACHE_LIFETIME_MS = 24 * 60 * 60 * 1000;
  const REQUEST_TIMEOUT_MS = 12000;

  class ApiError extends Error {
    constructor(message, options = {}) {
      super(message);
      this.name = "ApiError";
      this.status = options.status ?? null;
      this.retryAfterSeconds = options.retryAfterSeconds ?? null;
    }
  }

  function readCache(url) {
    try {
      const cached = JSON.parse(localStorage.getItem(`${CACHE_PREFIX}${url}`));

      if (
        !cached
        || !Number.isFinite(cached.savedAt)
        || !Object.hasOwn(cached, "data")
        || Date.now() - cached.savedAt > CACHE_LIFETIME_MS
      ) {
        localStorage.removeItem(`${CACHE_PREFIX}${url}`);
        return null;
      }

      return cached.data;
    } catch {
      // Si el almacenamiento está bloqueado o el dato no se puede leer, consultamos la API.
      return null;
    }
  }

  function writeCache(url, data) {
    try {
      localStorage.setItem(
        `${CACHE_PREFIX}${url}`,
        JSON.stringify({ savedAt: Date.now(), data })
      );
    } catch {
      // La aplicación sigue funcionando aunque el navegador no permita guardar la caché.
    }
  }

  function parseRetryAfter(headerValue) {
    if (!headerValue) return null;

    const seconds = Number(headerValue);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds;

    const retryDate = Date.parse(headerValue);
    return Number.isNaN(retryDate) ? null : Math.max(0, (retryDate - Date.now()) / 1000);
  }

  function createHttpError(response) {
    if (response.status === 429) {
      const retryAfterSeconds = parseRetryAfter(response.headers.get("Retry-After"));
      const waitMessage = retryAfterSeconds !== null && retryAfterSeconds > 0
        ? ` Espera ${Math.ceil(retryAfterSeconds)} segundos y vuelve a intentarlo.`
        : " Espera un momento y vuelve a intentarlo.";

      return new ApiError(`La API recibió demasiadas solicitudes.${waitMessage}`, {
        status: response.status,
        retryAfterSeconds,
      });
    }

    if (response.status >= 500) {
      return new ApiError("La API no está disponible por ahora. Intenta de nuevo más tarde.", {
        status: response.status,
      });
    }

    return new ApiError(`La solicitud a la API falló (código ${response.status}).`, {
      status: response.status,
    });
  }

  async function getJson(endpoint, options = {}) {
    const normalizedEndpoint = String(endpoint).replace(/^\/+/, "");
    const url = `${API_ROOT}/${normalizedEndpoint}`;

    if (!options.forceRefresh) {
      const cachedData = readCache(url);
      if (cachedData !== null) return cachedData;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
        cache: options.forceRefresh ? "reload" : "default",
      });

      if (!response.ok) throw createHttpError(response);

      const contentType = response.headers.get("Content-Type") || "";
      if (!contentType.toLowerCase().includes("json")) {
        throw new ApiError("La respuesta de la API no llegó en formato JSON.", {
          status: response.status,
        });
      }

      let data;
      try {
        data = await response.json();
      } catch {
        throw new ApiError("La respuesta de la API no se pudo leer como JSON.", {
          status: response.status,
        });
      }

      writeCache(url, data);
      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;

      if (controller.signal.aborted) {
        throw new ApiError("La consulta tardó demasiado. Revisa tu conexión e inténtalo otra vez.");
      }

      throw new ApiError("No pudimos conectar con API Colombia. Revisa tu conexión e inténtalo otra vez.");
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  function showStatus(container, kind, message, options = {}) {
    if (!container) return;

    const status = document.createElement("div");
    status.className = `api-state api-state--${kind}`;
    status.setAttribute("role", kind === "error" ? "alert" : "status");
    container.setAttribute("aria-busy", String(kind === "loading"));

    const icon = document.createElement("span");
    icon.className = "api-state-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = kind === "loading" ? "" : kind === "error" ? "!" : kind === "empty" ? "—" : "i";
    status.append(icon);

    const copy = document.createElement("div");
    copy.className = "api-state-copy";
    const text = document.createElement("p");
    text.textContent = message;
    copy.append(text);
    status.append(copy);

    if (options.onRetry) {
      const retryButton = document.createElement("button");
      retryButton.className = "api-retry-button";
      retryButton.type = "button";
      const waitSeconds = options.retryAfterSeconds;
      retryButton.textContent = waitSeconds > 0
        ? `Espera ${Math.ceil(waitSeconds)} s`
        : options.retryLabel || "Intentar de nuevo";
      retryButton.disabled = waitSeconds > 0;
      retryButton.addEventListener("click", options.onRetry, { once: true });
      status.append(retryButton);

      if (waitSeconds > 0) {
        window.setTimeout(() => {
          if (!retryButton.isConnected) return;
          retryButton.disabled = false;
          retryButton.textContent = options.retryLabel || "Intentar de nuevo";
        }, Math.min(waitSeconds * 1000, 2147480000));
      }
    }

    container.replaceChildren(status);
  }

  function showLoading(container, message = "Consultando API Colombia…") {
    showStatus(container, "loading", message);
  }

  function showError(container, error, onRetry) {
    const message = error instanceof ApiError
      ? error.message
      : "No pudimos cargar los datos. Intenta de nuevo.";
    showStatus(container, "error", message, {
      onRetry,
      retryAfterSeconds: error instanceof ApiError ? error.retryAfterSeconds : null,
    });
  }

  function showEmpty(container, message = "No encontramos resultados para mostrar.") {
    showStatus(container, "empty", message);
  }

  window.ColombiaApi = Object.freeze({
    getJson,
    showLoading,
    showError,
    showEmpty,
  });
})();
