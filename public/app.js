const API_BASE = "/api";
const THEME_STORAGE_KEY = "animePortalTheme";

const state = {
    anime: [],
    filteredAnime: [],
    routes: [],
};

const DEFAULT_FEEDBACK_BODY = {
    name: "API Tester",
    email: "tester@example.com",
    phone: "555-1234",
    age: "22",
    satisfaction: "Very Satisfied",
    rating: "5",
    comments: "Testing from Endpoint Explorer",
};

document.addEventListener("DOMContentLoaded", () => {
    initializePortal();
});

async function initializePortal() {
    initializeTheme();
    bindEvents();
    fillSampleBody();

    await Promise.all([loadRouteDocs(), refreshAnimeData("Initial load")]);
}

function bindEvents() {
    const animeSearchForm = document.getElementById("animeSearchForm");
    const filterForm = document.getElementById("filterForm");
    const endpointForm = document.getElementById("endpointExplorerForm");
    const clearSearchBtn = document.getElementById("clearSearchBtn");
    const resetFiltersBtn = document.getElementById("resetFiltersBtn");
    const fillSampleBodyBtn = document.getElementById("fillSampleBodyBtn");
    const endpointSelect = document.getElementById("endpointSelect");
    const integrationButtons = document.querySelectorAll(".integration-row .integration");
    const routeList = document.getElementById("routeList");
    const themeToggleBtn = document.getElementById("themeToggleBtn");

    animeSearchForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        await refreshAnimeData("Search ran on GET /api/anime");
    });

    filterForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        await refreshAnimeData("Smart filters applied on GET /api/anime");
    });

    clearSearchBtn.addEventListener("click", async () => {
        document.getElementById("animeSearchInput").value = "";
        await refreshAnimeData("Search cleared and data refreshed");
    });

    resetFiltersBtn.addEventListener("click", async () => {
        document.getElementById("filterForm").reset();
        await refreshAnimeData("Filters reset");
    });

    endpointForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const selected = endpointSelect.value;
        if (!selected) {
            return;
        }

        const [method, path] = selected.split("|");
        await executeEndpoint(method, path);
    });

    fillSampleBodyBtn.addEventListener("click", () => {
        fillSampleBody();
    });

    endpointSelect.addEventListener("change", () => {
        updateEndpointFormState();
    });

    integrationButtons.forEach((button) => {
        button.addEventListener("click", async () => {
            const method = button.dataset.method || "GET";
            const path = button.dataset.path || `${API_BASE}/health`;
            await executeEndpoint(method, path);
        });
    });

    routeList.addEventListener("click", async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLButtonElement)) {
            return;
        }

        if (!target.classList.contains("try-route-btn")) {
            return;
        }

        const method = target.dataset.method || "GET";
        const path = target.dataset.path || `${API_BASE}/health`;
        await executeEndpoint(method, path);
    });

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener("click", () => {
            const current = getCurrentTheme();
            const nextTheme = current === "dark" ? "light" : "dark";
            animateThemeToggle(themeToggleBtn, nextTheme);
            triggerThemeShiftAnimation();
            applyTheme(nextTheme);
            localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        });
    }
}

function initializeTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = savedTheme === "dark" || savedTheme === "light" ? savedTheme : prefersDark ? "dark" : "light";

    applyTheme(theme);
}

function getCurrentTheme() {
    const current = document.body.dataset.theme;
    return current === "dark" ? "dark" : "light";
}

function applyTheme(theme) {
    document.body.dataset.theme = theme;

    const themeToggleBtn = document.getElementById("themeToggleBtn");
    if (!themeToggleBtn) {
        return;
    }

    const isDark = theme === "dark";
    const label = themeToggleBtn.querySelector(".theme-toggle-label");
    if (label) {
        label.textContent = isDark ? "Light mode" : "Dark mode";
    } else {
        themeToggleBtn.textContent = isDark ? "Light mode" : "Dark mode";
    }
    themeToggleBtn.setAttribute("aria-pressed", String(isDark));
}

function animateThemeToggle(button, nextTheme) {
    if (!(button instanceof HTMLElement)) {
        return;
    }

    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
    }

    button.classList.remove("is-switching", "switch-to-dark", "switch-to-light");
    // Restarting animation lets rapid repeated clicks still feel smooth.
    button.offsetWidth;
    button.classList.add("is-switching", nextTheme === "dark" ? "switch-to-dark" : "switch-to-light");

    window.setTimeout(() => {
        button.classList.remove("is-switching", "switch-to-dark", "switch-to-light");
    }, 500);
}

function triggerThemeShiftAnimation() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
    }

    document.body.classList.remove("theme-shift");
    // Force reflow so the soft flash animation restarts every click.
    document.body.offsetWidth;
    document.body.classList.add("theme-shift");

    window.setTimeout(() => {
        document.body.classList.remove("theme-shift");
    }, 650);
}

async function loadRouteDocs() {
    const routeList = document.getElementById("routeList");

    try {
        const data = await fetchJson(`${API_BASE}/routes`);
        state.routes = Array.isArray(data.routes) ? data.routes : [];

        routeList.innerHTML = "";
        state.routes.forEach((route) => {
            routeList.appendChild(createRouteCard(route));
        });

        populateEndpointSelect();
    } catch (err) {
        console.error(err);
        routeList.innerHTML = `<p class="state-note">Could not load routes from GET /api/routes.</p>`;
    }
}

async function refreshAnimeData(reason) {
    try {
        state.anime = await fetchJson(`${API_BASE}/anime`);
        if (!Array.isArray(state.anime)) {
            state.anime = [];
        }

        populateFilterOptions(state.anime);
        state.filteredAnime = applySearchAndFilters(state.anime);

        // If smart filters hide a valid text match, fall back to query-only results
        // so live search always feels responsive when a user types a known title.
        if (!state.filteredAnime.length) {
            const query = getSearchQuery();
            if (query && hasActiveSmartFilters()) {
                const queryOnlyMatches = applySearchAndFilters(state.anime, { ignoreSmartFilters: true });
                if (queryOnlyMatches.length) {
                    state.filteredAnime = queryOnlyMatches;
                    reason = `${reason} (smart filters were relaxed to show matches)`;
                }
            }
        }

        renderAnimeList(state.filteredAnime);
        renderTimeline(state.filteredAnime);
        updateSearchMeta(reason, state.filteredAnime.length, state.anime.length);
        updateFilterMeta(state.filteredAnime.length, state.anime.length);
    } catch (err) {
        console.error(err);
        renderAnimeError();
    }
}

function applySearchAndFilters(anime, options = {}) {
    const query = getSearchQuery();
    const era = document.getElementById("eraFilter").value;
    const studio = document.getElementById("studioFilter").value;
    const genre = document.getElementById("genreFilter").value.trim().toLowerCase();
    const minEpisodesRaw = document.getElementById("minEpisodesFilter").value;
    const sortBy = document.getElementById("sortFilter").value;
    const ignoreSmartFilters = Boolean(options.ignoreSmartFilters);

    const minEpisodes = minEpisodesRaw ? Number(minEpisodesRaw) : 0;
    const queryTokens = toSearchTokens(query);

    const filtered = anime.filter((item) => {
        const title = String(item.title || "");
        const studioName = String(item.studio || "");
        const genreText = String(item.genre || "");
        const synopsis = String(item.synopsis || "");
        const itemEra = String(item.era || "");
        const episodes = Number(item.episodes) || 0;
        const searchable = normalizeSearchText(`${title} ${studioName} ${genreText} ${synopsis}`);
        const normalizedQuery = normalizeSearchText(query);

        const queryMatch =
            !query ||
            searchable.includes(normalizedQuery) ||
            queryTokens.every((token) => searchable.includes(token));

        const eraMatch = ignoreSmartFilters || !era || itemEra === era;
        const studioMatch = ignoreSmartFilters || !studio || String(item.studio || "") === studio;
        const genreMatch =
            ignoreSmartFilters || !genre || normalizeSearchText(genreText).includes(normalizeSearchText(genre));
        const episodesMatch = ignoreSmartFilters || episodes >= minEpisodes;

        return queryMatch && eraMatch && studioMatch && genreMatch && episodesMatch;
    });

    return sortAnime(filtered, sortBy);
}

function getSearchQuery() {
    return document.getElementById("animeSearchInput").value.trim();
}

function toSearchTokens(text) {
    return normalizeSearchText(text)
        .split(" ")
        .filter(Boolean);
}

function normalizeSearchText(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function hasActiveSmartFilters() {
    const era = document.getElementById("eraFilter").value;
    const studio = document.getElementById("studioFilter").value;
    const genre = document.getElementById("genreFilter").value.trim();
    const minEpisodesRaw = document.getElementById("minEpisodesFilter").value;
    const minEpisodes = minEpisodesRaw ? Number(minEpisodesRaw) : 0;

    return Boolean(era || studio || genre || minEpisodes > 0);
}

function sortAnime(anime, sortBy) {
    const sorted = [...anime];

    switch (sortBy) {
        case "year-desc":
            sorted.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
            break;
        case "episodes-desc":
            sorted.sort((a, b) => (Number(b.episodes) || 0) - (Number(a.episodes) || 0));
            break;
        case "title-asc":
            sorted.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
            break;
        case "year-asc":
        default:
            sorted.sort((a, b) => (Number(a.year) || 0) - (Number(b.year) || 0));
            break;
    }

    return sorted;
}

function populateFilterOptions(anime) {
    const eraFilter = document.getElementById("eraFilter");
    const studioFilter = document.getElementById("studioFilter");
    const currentEra = eraFilter.value;
    const currentStudio = studioFilter.value;

    const eras = [...new Set(anime.map((item) => String(item.era || "")).filter(Boolean))].sort();
    const studios = [...new Set(anime.map((item) => String(item.studio || "")).filter(Boolean))].sort();

    eraFilter.innerHTML = `<option value="">All eras</option>${eras
        .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
        .join("")}`;
    studioFilter.innerHTML = `<option value="">All studios</option>${studios
        .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
        .join("")}`;

    if (eras.includes(currentEra)) {
        eraFilter.value = currentEra;
    }
    if (studios.includes(currentStudio)) {
        studioFilter.value = currentStudio;
    }
}

function renderAnimeList(anime) {
    const animeList = document.getElementById("animeList");
    animeList.innerHTML = "";

    if (!anime.length) {
        animeList.innerHTML = `<p class="state-note">No anime match the current search and filter settings.</p>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    anime.forEach((item) => {
        fragment.appendChild(createAnimeCard(item));
    });

    animeList.appendChild(fragment);
}

function renderAnimeError() {
    const animeList = document.getElementById("animeList");
    const timelineTrack = document.getElementById("timelineTrack");
    animeList.innerHTML = `<p class="state-note">Could not load anime from GET /api/anime.</p>`;
    timelineTrack.innerHTML = `<p class="state-note">Timeline unavailable until anime data loads.</p>`;
}

function renderTimeline(anime) {
    const timelineTrack = document.getElementById("timelineTrack");
    timelineTrack.innerHTML = "";

    if (!anime.length) {
        timelineTrack.innerHTML = `<p class="state-note">No items to display on the timeline.</p>`;
        return;
    }

    const sorted = [...anime].sort((a, b) => (Number(a.year) || 0) - (Number(b.year) || 0));
    const fragment = document.createDocumentFragment();

    sorted.forEach((item, index) => {
        const node = document.createElement("article");
        node.className = "timeline-node";
        node.style.setProperty("--delay", `${index * 70}ms`);
        node.innerHTML = `
            <div class="timeline-dot" aria-hidden="true"></div>
            <p class="timeline-year">${escapeHtml(String(item.year || "-"))}</p>
            <p class="timeline-title">${escapeHtml(String(item.title || "Untitled"))}</p>
            <p class="timeline-sub">${escapeHtml(String(item.studio || "Unknown studio"))}</p>
        `;
        fragment.appendChild(node);
    });

    timelineTrack.appendChild(fragment);
}

function createRouteCard(route) {
    const card = document.createElement("article");
    card.className = "endpoint-card";

    const method = String(route.method || "GET");
    const methodClass = method.toLowerCase();
    const path = String(route.path || "");

    card.innerHTML = `
        <span class="method-tag ${methodClass}">${escapeHtml(method)}</span>
        <p class="endpoint-path">${escapeHtml(path)}</p>
        <p class="endpoint-desc">${escapeHtml(route.description || "No description")}</p>
        <button
            type="button"
            class="action-btn ghost try-route-btn"
            data-method="${escapeHtml(method)}"
            data-path="${escapeHtml(path)}"
        >
            Try it live
        </button>
    `;

    return card;
}

function createAnimeCard(item) {
    const card = document.createElement("article");
    card.className = "anime-card";

    const title = String(item.title || "Anime");
    const imagePath = String(item.img_name || "");

    card.innerHTML = `
        <img src="${escapeHtml(imagePath)}" alt="${escapeHtml(title)}" loading="lazy" />
        <div class="anime-card-body">
            <h3 class="anime-title">${escapeHtml(String(item.title || "Untitled"))}</h3>
            <p class="anime-meta">${escapeHtml(String(item.year || "-"))} • ${escapeHtml(String(item.era || "Unknown era"))}</p>
            <p class="anime-meta">${escapeHtml(String(item.studio || "Unknown studio"))}</p>
            <p class="anime-meta">${escapeHtml(String(item.genre || "Unknown genre"))}</p>
        </div>
    `;

    const img = card.querySelector("img");
    if (img) {
        img.addEventListener("error", () => {
            img.classList.add("img-missing");
            img.alt = `${title} (image missing)`;
            console.warn(`Image failed to load for anime #${item._id}: ${title} -> ${imagePath}`);
        });
    }

    return card;
}

function populateEndpointSelect() {
    const endpointSelect = document.getElementById("endpointSelect");
    endpointSelect.innerHTML = state.routes
        .map((route) => {
            const method = String(route.method || "GET");
            const path = String(route.path || "");
            const label = `${method} ${path}`;
            return `<option value="${escapeHtml(`${method}|${path}`)}">${escapeHtml(label)}</option>`;
        })
        .join("");

    updateEndpointFormState();
}

function updateEndpointFormState() {
    const endpointSelect = document.getElementById("endpointSelect");
    const endpointAnimeId = document.getElementById("endpointAnimeId");
    const endpointBody = document.getElementById("endpointBody");
    const selected = endpointSelect.value;

    if (!selected) {
        endpointAnimeId.disabled = true;
        endpointBody.disabled = true;
        return;
    }

    const [method, path] = selected.split("|");
    endpointAnimeId.disabled = !path.includes(":id");
    endpointBody.disabled = method.toUpperCase() !== "POST";
}

async function executeEndpoint(method, rawPath) {
    const responseMeta = document.getElementById("responseMeta");
    const animeId = document.getElementById("endpointAnimeId").value || "1";
    let path = rawPath;

    if (path.includes(":id")) {
        path = path.replace(":id", animeId);
    }

    const options = {
        method,
        headers: {
            "Content-Type": "application/json",
        },
    };

    if (method.toUpperCase() === "POST") {
        const bodyText = document.getElementById("endpointBody").value.trim();
        if (!bodyText) {
            fillSampleBody();
        }

        try {
            const parsed = JSON.parse(document.getElementById("endpointBody").value);
            options.body = JSON.stringify(parsed);
        } catch (_err) {
            renderResponse({ error: "JSON body is invalid. Please fix and try again." });
            responseMeta.textContent = `Invalid JSON for ${method} ${path}`;
            return;
        }
    }

    const started = performance.now();

    try {
        const res = await fetch(path, options);
        const elapsedMs = Math.round(performance.now() - started);
        const contentType = res.headers.get("content-type") || "";

        let payload;
        if (contentType.includes("application/json")) {
            payload = await res.json();
        } else {
            payload = { raw: await res.text() };
        }

        responseMeta.textContent = `${method} ${path} • ${res.status} ${res.statusText} • ${elapsedMs} ms`;
        renderResponse(payload);
    } catch (err) {
        console.error(err);
        responseMeta.textContent = `${method} ${path} failed`;
        renderResponse({ error: "Request failed", detail: String(err.message || err) });
    }
}

function fillSampleBody() {
    document.getElementById("endpointBody").value = JSON.stringify(DEFAULT_FEEDBACK_BODY, null, 2);
}

function renderResponse(payload) {
    const viewer = document.getElementById("apiResponseViewer");
    viewer.textContent = JSON.stringify(payload, null, 2);
}

function updateSearchMeta(reason, filteredCount, totalCount) {
    const searchMeta = document.getElementById("searchMeta");
    searchMeta.textContent = `${reason}. Showing ${filteredCount} of ${totalCount} anime records.`;
}

function updateFilterMeta(filteredCount, totalCount) {
    const filterMeta = document.getElementById("filterMeta");
    filterMeta.textContent = `Filter result: ${filteredCount} / ${totalCount} records.`;
}

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Request failed for ${url} with status ${response.status}`);
    }

    return response.json();
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}