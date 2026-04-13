const API_SERVER_ORIGIN = "https://demo-backend-1-0t5d.onrender.com";
const API_BASE = `${API_SERVER_ORIGIN}/api`;
const CREATE_ENDPOINT_CANDIDATES = ["/api/anime", "/post", "/add", "/create", "/new"];
const THEME_STORAGE_KEY = "animePortalTheme";
const MOBILE_SECTION_STORAGE_KEY = "animePortalMobileSection";
const MOBILE_SECTION_QUERY = "(max-width: 640px)";
const DESKTOP_COLLAPSE_QUERY = "(min-width: 641px)";
const FALLBACK_IMAGE_PATH = "images/fallback.jpg";

const state = {
    anime: [],
    filteredAnime: [],
    studios: [],
    creators: [],
    filteredStudios: [],
    filteredCreators: [],
    routes: [],
    createEndpointPath: "/api/anime",
    availableCreatePaths: ["/api/anime"],
    collapsedGridState: {
        anime: true,
        studios: true,
        creators: true,
    },
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

    await Promise.all([
        loadRouteDocs(),
        refreshAnimeData("Initial load"),
        refreshStudiosCreatorsData("Initial load"),
    ]);
    await verifyCreateEndpoint();
}

async function verifyCreateEndpoint() {
    try {
        const routes = await fetchJson(`${API_BASE}/routes`);
        const routeList = Array.isArray(routes.routes) ? routes.routes : [];
        const availableCreatePaths = CREATE_ENDPOINT_CANDIDATES.filter((candidatePath) =>
            routeList.some((route) => route.method === "POST" && route.path === candidatePath)
        );

        if (availableCreatePaths.length > 0) {
            state.availableCreatePaths = availableCreatePaths;
            state.createEndpointPath = availableCreatePaths[0];
            return;
        }

        console.warn("No supported create endpoint found in available routes", routeList);
        state.availableCreatePaths = [...CREATE_ENDPOINT_CANDIDATES];
        state.createEndpointPath = CREATE_ENDPOINT_CANDIDATES[0];

        const addAnimeMeta = document.getElementById("addAnimeMeta");
        if (addAnimeMeta) {
            addAnimeMeta.innerHTML = `<strong style="color: var(--color-error, #d32f2f);">Error:</strong> Could not locate a working create endpoint on the backend. Expected one of: ${escapeHtml(CREATE_ENDPOINT_CANDIDATES.join(", "))}.`;
        }
    } catch (err) {
        console.error("Failed to verify create endpoint:", err);
        state.availableCreatePaths = [...CREATE_ENDPOINT_CANDIDATES];
        state.createEndpointPath = CREATE_ENDPOINT_CANDIDATES[0];

        const addAnimeMeta = document.getElementById("addAnimeMeta");
        if (addAnimeMeta) {
            addAnimeMeta.innerHTML = `<strong style="color: var(--color-error, #d32f2f);">Error:</strong> Could not reach backend to verify create endpoint availability. Submission will still try: ${escapeHtml(CREATE_ENDPOINT_CANDIDATES.join(", "))}.`;
        }
    }
}

async function submitAnimeWithFallback(payload) {
    const attemptedPaths = new Set();
    const prioritizedPaths = [state.createEndpointPath, ...state.availableCreatePaths, ...CREATE_ENDPOINT_CANDIDATES]
        .filter((path) => {
            if (attemptedPaths.has(path)) {
                return false;
            }
            attemptedPaths.add(path);
            return true;
        });

    let lastData = { error: "No response from create endpoint" };
    let lastStatus = 0;

    for (const path of prioritizedPaths) {
        const response = await fetch(buildApiUrl(path), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        let data = {};
        try {
            data = await response.json();
        } catch (_err) {
            data = { error: "Invalid or non-JSON response" };
        }

        if (response.ok) {
            state.createEndpointPath = path;
            if (!state.availableCreatePaths.includes(path)) {
                state.availableCreatePaths = [path, ...state.availableCreatePaths];
            }
            return { response, data, usedPath: path };
        }

        lastStatus = response.status;
        lastData = data;

        if (response.status !== 404) {
            return { response, data, usedPath: path };
        }
    }

    return {
        response: { ok: false, status: lastStatus || 404 },
        data: lastData,
        usedPath: prioritizedPaths[0] || state.createEndpointPath,
        triedPaths: prioritizedPaths,
    };
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
    const backToTopBtn = document.getElementById("backToTopBtn");
    const studiosCreatorsSearchForm = document.getElementById("studiosCreatorsSearchForm");
    const clearStudiosCreatorsSearchBtn = document.getElementById("clearStudiosCreatorsSearchBtn");
    const mobileToggleButtons = document.querySelectorAll(".mobile-toggle-btn");
    const animeCollapseBtn = document.getElementById("animeCollapseBtn");
    const studiosCollapseBtn = document.getElementById("studiosCollapseBtn");
    const creatorsCollapseBtn = document.getElementById("creatorsCollapseBtn");

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

    if (studiosCreatorsSearchForm) {
        studiosCreatorsSearchForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            await refreshStudiosCreatorsData("Studios/creators search applied");
        });
    }

    if (clearStudiosCreatorsSearchBtn) {
        clearStudiosCreatorsSearchBtn.addEventListener("click", async () => {
            const searchInput = document.getElementById("studiosCreatorsSearchInput");
            if (searchInput) {
                searchInput.value = "";
            }
            await refreshStudiosCreatorsData("Studios/creators search cleared");
        });
    }

    const addAnimeForm = document.getElementById("addAnimeForm");
    const clearAddAnimeBtn = document.getElementById("clearAddAnimeBtn");
    const addAnimeYearInput = document.getElementById("addAnimeYear");

    if (addAnimeYearInput) {
        addAnimeYearInput.max = String(new Date().getFullYear() + 1);
    }

    if (addAnimeForm) {
        addAnimeForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            await submitAddAnimeForm();
        });
    }

    if (clearAddAnimeBtn) {
        clearAddAnimeBtn.addEventListener("click", () => {
            addAnimeForm.reset();
            const responseDiv = document.getElementById("addAnimeResponse");
            responseDiv.style.display = "none";
            document.getElementById("addAnimeMeta").textContent = "Fill all fields to add a new anime record. Required fields marked with *.";
        });
    }

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

    if (backToTopBtn) {
        const toggleBackToTopVisibility = () => {
            backToTopBtn.classList.toggle("is-visible", window.scrollY > 280);
        };

        backToTopBtn.addEventListener("click", () => {
            const prefersReducedMotion =
                window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

            window.scrollTo({
                top: 0,
                behavior: prefersReducedMotion ? "auto" : "smooth",
            });
        });

        window.addEventListener("scroll", toggleBackToTopVisibility, { passive: true });
        toggleBackToTopVisibility();
    }

    if (mobileToggleButtons.length) {
        initializeMobileSectionToggle(mobileToggleButtons);
    }

    bindGridCollapseToggle(animeCollapseBtn, "anime");
    bindGridCollapseToggle(studiosCollapseBtn, "studios");
    bindGridCollapseToggle(creatorsCollapseBtn, "creators");

    window.addEventListener("resize", () => {
        applyAllGridCollapseStates();
    });
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

async function refreshStudiosCreatorsData(reason) {
    try {
        const data = await fetchJson(`${API_BASE}/studios-creators`);
        state.studios = Array.isArray(data.studios) ? data.studios : [];
        state.creators = Array.isArray(data.creators) ? data.creators : [];

        const query = getStudiosCreatorsQuery();
        state.filteredStudios = filterStudiosCreators(state.studios, query);
        state.filteredCreators = filterStudiosCreators(state.creators, query);

        renderStudios(state.filteredStudios);
        renderCreators(state.filteredCreators);
        updateStudiosCreatorsMeta(
            reason,
            state.filteredStudios.length,
            state.studios.length,
            state.filteredCreators.length,
            state.creators.length
        );
    } catch (err) {
        console.error(err);
        renderStudiosCreatorsError();
    }
}

function initializeMobileSectionToggle(toggleButtons) {
    const mediaQuery = window.matchMedia(MOBILE_SECTION_QUERY);
    const animeSection = document.getElementById("animePreviewSection");
    const studiosSection = document.getElementById("studiosCreatorsPreviewSection");

    if (!animeSection || !studiosSection) {
        return;
    }

    const applySectionState = (sectionName, updateStorage = true) => {
        const showAnime = sectionName !== "studios-creators";
        animeSection.classList.toggle("is-mobile-hidden", mediaQuery.matches && !showAnime);
        studiosSection.classList.toggle("is-mobile-hidden", mediaQuery.matches && showAnime);

        toggleButtons.forEach((button) => {
            const isActive = button.dataset.target === (showAnime ? "animePreviewSection" : "studiosCreatorsPreviewSection");
            button.classList.toggle("is-active", isActive);
            button.classList.toggle("primary", isActive);
            button.classList.toggle("ghost", !isActive);
            button.setAttribute("aria-pressed", String(isActive));
        });

        if (updateStorage) {
            localStorage.setItem(MOBILE_SECTION_STORAGE_KEY, showAnime ? "anime" : "studios-creators");
        }
    };

    toggleButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const target = button.dataset.target === "studiosCreatorsPreviewSection" ? "studios-creators" : "anime";
            applySectionState(target);
        });
    });

    const getStoredSection = () =>
        localStorage.getItem(MOBILE_SECTION_STORAGE_KEY) === "studios-creators"
            ? "studios-creators"
            : "anime";

    const syncForViewport = () => {
        applySectionState(getStoredSection(), false);
    };

    if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", syncForViewport);
    } else if (typeof mediaQuery.addListener === "function") {
        mediaQuery.addListener(syncForViewport);
    }

    applySectionState(getStoredSection(), false);
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
    applyGridCollapseState("anime");
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

function getStudiosCreatorsQuery() {
    const searchInput = document.getElementById("studiosCreatorsSearchInput");
    return searchInput ? searchInput.value.trim() : "";
}

function filterStudiosCreators(items, query) {
    const normalizedQuery = normalizeSearchText(query);
    const queryTokens = toSearchTokens(query);

    return items.filter((item) => {
        const searchable = normalizeSearchText(
            `${item.name || ""} ${item.meta || ""} ${item.role || ""} ${item.affiliation || ""} ${item.detail || ""} ${(item.related || []).join(" ")}`
        );

        if (!normalizedQuery) {
            return true;
        }

        return searchable.includes(normalizedQuery) || queryTokens.every((token) => searchable.includes(token));
    });
}

function renderStudios(studios) {
    const studiosList = document.getElementById("studiosList");
    if (!studiosList) {
        return;
    }

    studiosList.innerHTML = "";
    if (!studios.length) {
        studiosList.innerHTML = `<p class="state-note">No studio records match your search.</p>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    studios.forEach((studio) => {
        fragment.appendChild(createStudioCard(studio));
    });

    studiosList.appendChild(fragment);
    applyGridCollapseState("studios");
}

function renderCreators(creators) {
    const creatorsList = document.getElementById("creatorsList");
    if (!creatorsList) {
        return;
    }

    creatorsList.innerHTML = "";
    if (!creators.length) {
        creatorsList.innerHTML = `<p class="state-note">No creator records match your search.</p>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    creators.forEach((creator) => {
        fragment.appendChild(createCreatorCard(creator));
    });

    creatorsList.appendChild(fragment);
    applyGridCollapseState("creators");
}

function bindGridCollapseToggle(button, key) {
    if (!button) {
        return;
    }

    button.addEventListener("click", () => {
        state.collapsedGridState[key] = !state.collapsedGridState[key];
        applyGridCollapseState(key);
    });
}

function applyAllGridCollapseStates() {
    applyGridCollapseState("anime");
    applyGridCollapseState("studios");
    applyGridCollapseState("creators");
}

function applyGridCollapseState(key) {
    const config = {
        anime: {
            gridId: "animeList",
            buttonId: "animeCollapseBtn",
            cardClass: "anime-card",
            showMoreLabel: "Show more anime",
            showLessLabel: "Show less anime",
        },
        studios: {
            gridId: "studiosList",
            buttonId: "studiosCollapseBtn",
            cardClass: "knowledge-card",
            showMoreLabel: "Show more studios",
            showLessLabel: "Show fewer studios",
        },
        creators: {
            gridId: "creatorsList",
            buttonId: "creatorsCollapseBtn",
            cardClass: "knowledge-card",
            showMoreLabel: "Show more creators",
            showLessLabel: "Show fewer creators",
        },
    }[key];

    if (!config) {
        return;
    }

    const grid = document.getElementById(config.gridId);
    const button = document.getElementById(config.buttonId);
    if (!grid || !button) {
        return;
    }

    const cards = Array.from(grid.querySelectorAll(`.${config.cardClass}`));
    cards.forEach((card) => {
        card.classList.remove("is-collapsed-hidden");
    });

    const isDesktop = window.matchMedia(DESKTOP_COLLAPSE_QUERY).matches;
    if (!isDesktop) {
        button.classList.add("is-hidden");
        button.setAttribute("aria-expanded", "true");
        return;
    }

    const columns = getGridColumnCount(grid);
    const maxVisibleCards = Math.max(1, columns * 2);

    if (cards.length <= maxVisibleCards) {
        button.classList.add("is-hidden");
        button.setAttribute("aria-expanded", "true");
        return;
    }

    button.classList.remove("is-hidden");

    const isCollapsed = state.collapsedGridState[key] !== false;
    if (isCollapsed) {
        cards.slice(maxVisibleCards).forEach((card) => {
            card.classList.add("is-collapsed-hidden");
        });
    }

    button.textContent = isCollapsed ? config.showMoreLabel : config.showLessLabel;
    button.setAttribute("aria-expanded", String(!isCollapsed));
}

function getGridColumnCount(grid) {
    const style = window.getComputedStyle(grid);
    if (style.display !== "grid") {
        return 1;
    }

    const template = style.gridTemplateColumns;
    if (!template || template === "none") {
        return 1;
    }

    return template.split(" ").filter(Boolean).length || 1;
}

function renderStudiosCreatorsError() {
    const studiosList = document.getElementById("studiosList");
    const creatorsList = document.getElementById("creatorsList");
    const meta = document.getElementById("studiosCreatorsMeta");

    if (studiosList) {
        studiosList.innerHTML = `<p class="state-note">Could not load studios from GET /api/studios-creators.</p>`;
    }
    if (creatorsList) {
        creatorsList.innerHTML = `<p class="state-note">Could not load creators from GET /api/studios-creators.</p>`;
    }
    if (meta) {
        meta.textContent = "Studios/creators data unavailable right now.";
    }
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
    const resolvedImagePath = imagePath || FALLBACK_IMAGE_PATH;
    const isMissingImage = !imagePath;

    card.innerHTML = `
        <img src="${escapeHtml(resolvedImagePath)}" alt="${escapeHtml(title)}" loading="lazy" class="${isMissingImage ? "img-missing" : ""}" />
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
            if (img.dataset.fallbackApplied === "true") {
                return;
            }

            img.dataset.fallbackApplied = "true";
            img.src = FALLBACK_IMAGE_PATH;
            img.classList.add("img-missing");
            img.alt = `${title} (image missing)`;
            console.warn(`Image failed to load for anime #${item._id}: ${title} -> ${imagePath}`);
        });
    }

    return card;
}

function createStudioCard(item) {
    const card = document.createElement("article");
    card.className = "knowledge-card";

    const imagePath = String(item.image || "");
    const resolvedImagePath = imagePath || FALLBACK_IMAGE_PATH;
    const isMissingImage = !imagePath;
    const name = String(item.name || "Unknown studio");
    const related = Array.isArray(item.related) && item.related.length ? item.related.join(", ") : "No linked titles";

    card.innerHTML = `
        <img src="${escapeHtml(resolvedImagePath)}" alt="${escapeHtml(name)}" loading="lazy" class="${isMissingImage ? "img-missing" : ""}" />
        <div class="knowledge-card-body">
            <h3 class="knowledge-title">${escapeHtml(name)}</h3>
            <p class="knowledge-meta">${escapeHtml(String(item.meta || "Studio profile"))}</p>
            <p class="knowledge-detail">${escapeHtml(String(item.detail || "No details available."))}</p>
            <p class="knowledge-related"><strong>Related:</strong> ${escapeHtml(related)}</p>
        </div>
    `;

    const img = card.querySelector("img");
    if (img) {
        img.addEventListener("error", () => {
            if (img.dataset.fallbackApplied === "true") {
                return;
            }

            img.dataset.fallbackApplied = "true";
            img.src = FALLBACK_IMAGE_PATH;
            img.classList.add("img-missing");
            img.alt = `${name} (image missing)`;
        });
    }

    return card;
}

function createCreatorCard(item) {
    const card = document.createElement("article");
    card.className = "knowledge-card";

    const imagePath = String(item.image || "");
    const name = String(item.name || "Unknown creator");
    const related = Array.isArray(item.related) && item.related.length ? item.related.join(", ") : "No linked titles";
    const portraitMarkup = imagePath
        ? `<img src="${escapeHtml(imagePath)}" alt="${escapeHtml(name)}" loading="lazy" />`
        : "";

    card.innerHTML = `
        ${portraitMarkup}
        <div class="knowledge-card-body">
            <h3 class="knowledge-title">${escapeHtml(name)}</h3>
            <p class="knowledge-meta">${escapeHtml(String(item.role || "Creator profile"))}</p>
            <p class="knowledge-meta">${escapeHtml(String(item.affiliation || ""))}</p>
            <p class="knowledge-detail">${escapeHtml(String(item.detail || "No details available."))}</p>
            <p class="knowledge-related"><strong>Related:</strong> ${escapeHtml(related)}</p>
        </div>
    `;

    const img = card.querySelector("img");
    if (img) {
        img.addEventListener("error", () => {
            img.remove();
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
        const targetUrl = buildApiUrl(path);
        const res = await fetch(targetUrl, options);
        const elapsedMs = Math.round(performance.now() - started);
        const contentType = res.headers.get("content-type") || "";

        let payload;
        if (contentType.includes("application/json")) {
            payload = await res.json();
        } else {
            payload = { raw: await res.text() };
        }

        responseMeta.textContent = `${method} ${targetUrl} • ${res.status} ${res.statusText} • ${elapsedMs} ms`;
        renderResponse(payload);
    } catch (err) {
        console.error(err);
        responseMeta.textContent = `${method} ${buildApiUrl(path)} failed`;
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

function updateStudiosCreatorsMeta(reason, filteredStudios, totalStudios, filteredCreators, totalCreators) {
    const meta = document.getElementById("studiosCreatorsMeta");
    if (!meta) {
        return;
    }

    meta.textContent = `${reason}. Studios: ${filteredStudios}/${totalStudios}. Creators: ${filteredCreators}/${totalCreators}.`;
}

async function fetchJson(url) {
    const response = await fetch(buildApiUrl(url));
    if (!response.ok) {
        throw new Error(`Request failed for ${url} with status ${response.status}`);
    }

    return response.json();
}

function buildApiUrl(url) {
    const value = String(url || "").trim();
    if (/^https?:\/\//i.test(value)) {
        return value;
    }

    if (value.startsWith("/")) {
        return `${API_SERVER_ORIGIN}${value}`;
    }

    return `${API_SERVER_ORIGIN}/${value}`;
}

function getEraLabelFromYear(year) {
    if (year >= 2020) {
        return "2020s";
    }

    if (year >= 2010) {
        return "2010s";
    }

    if (year >= 2000) {
        return "2000s";
    }

    if (year >= 1990) {
        return "1990s";
    }

    return "1980s";
}

async function submitAddAnimeForm() {
    const form = document.getElementById("addAnimeForm");
    const responseDiv = document.getElementById("addAnimeResponse");
    const metaDiv = document.getElementById("addAnimeMeta");

    // Validate HTML5 constraints first
    if (!form.checkValidity()) {
        metaDiv.textContent = "Please fill all required fields with valid values.";
        metaDiv.style.color = "var(--color-error, #d32f2f)";
        return;
    }

    const createYearMax = new Date().getFullYear() + 1;

    // Collect form data
    const payload = {
        title: document.getElementById("addAnimeTitle").value.trim(),
        img_name: document.getElementById("addAnimeImgName").value.trim(),
        year: Number(document.getElementById("addAnimeYear").value),
        genre: document.getElementById("addAnimeGenre").value.trim(),
        synopsis: document.getElementById("addAnimeSynopsis").value.trim(),
        studio: document.getElementById("addAnimeStudio").value.trim(),
        episodes: Number(document.getElementById("addAnimeEpisodes").value),
        era: getEraLabelFromYear(Number(document.getElementById("addAnimeYear").value)),
    };

    // Client-side validation mirrors server-side Joi schema
    const validationErrors = [];
    
    if (!payload.title || payload.title.length < 2 || payload.title.length > 120) {
        validationErrors.push("Title must be 2-120 characters");
    }
    if (!payload.img_name || payload.img_name.length < 6 || payload.img_name.length > 512) {
        validationErrors.push("Image path must be 6-512 characters");
    } else if (!/^(https?:\/\/[^\s]+|images\/[A-Za-z0-9_./-]+)$/i.test(payload.img_name)) {
        validationErrors.push("Use a full URL or a relative path like images/your-poster.webp");
    }
    if (!payload.year || payload.year < 1960 || payload.year > createYearMax) {
        validationErrors.push(`Year must be between 1960 and ${createYearMax}`);
    }
    if (!payload.genre || payload.genre.length < 2 || payload.genre.length > 80) {
        validationErrors.push("Genre must be 2-80 characters");
    }
    if (!payload.synopsis || payload.synopsis.length < 20 || payload.synopsis.length > 1200) {
        validationErrors.push("Synopsis must be 20-1200 characters");
    }
    if (!payload.studio || payload.studio.length < 2 || payload.studio.length > 90) {
        validationErrors.push("Studio must be 2-90 characters");
    }
    if (!payload.episodes || payload.episodes < 1 || payload.episodes > 2500) {
        validationErrors.push("Episodes must be between 1 and 2500");
    }

    if (validationErrors.length > 0) {
        metaDiv.innerHTML = `<strong>Validation Errors:</strong><ul style="margin-top: 0.5rem;"><li>${validationErrors.join("</li><li>")}</li></ul>`;
        metaDiv.style.color = "var(--color-error, #d32f2f)";
        return;
    }

    try {
        metaDiv.textContent = "Submitting...";
        responseDiv.style.display = "none";

        const { response, data, usedPath, triedPaths } = await submitAnimeWithFallback(payload);

        if (!response.ok) {
            const errorMsg = data.error || "Unknown error";
            const details = data.details && Array.isArray(data.details) ? data.details.join(", ") : "";
            const fullMsg = details ? `${errorMsg}: ${details}` : errorMsg;
            
            const triedText = Array.isArray(triedPaths) && triedPaths.length
                ? ` Tried: ${escapeHtml(triedPaths.join(", "))}.`
                : "";
            metaDiv.innerHTML = `<strong style="color: var(--color-error, #d32f2f);">Error:</strong> ${escapeHtml(fullMsg)} (primary endpoint: ${escapeHtml(usedPath)}).${triedText}`;
            responseDiv.innerHTML = `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
            responseDiv.style.display = "block";
            return;
        }

        // Success
        metaDiv.innerHTML = `<strong style="color: var(--color-success, #388e3c);">Success!</strong> New anime added with ID: ${data.data._id} via ${escapeHtml(usedPath)}`;
        responseDiv.innerHTML = `<pre>${escapeHtml(JSON.stringify(data.data, null, 2))}</pre>`;
        responseDiv.style.display = "block";
        
        // Clear the form
        form.reset();
        
        // Refresh the anime list to show the new entry
        await refreshAnimeData(`New anime added via POST ${usedPath}`);
    } catch (err) {
        console.error("Error adding anime:", err);
        const errorMsg = err.message || "Unknown error occurred";
        const fullErrorMsg = `${errorMsg}. Please ensure the backend server is running and at least one create endpoint is accessible: ${CREATE_ENDPOINT_CANDIDATES.join(", ")}.`;
        metaDiv.innerHTML = `<strong style="color: var(--color-error, #d32f2f);">Error:</strong> ${escapeHtml(fullErrorMsg)}`;
    }
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}