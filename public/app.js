const DEPLOYED_BACKEND_ORIGIN = "https://demo-backend-1-0t5d.onrender.com";
const API_SERVER_ORIGIN = resolveApiServerOrigin();
const API_BASE = `${API_SERVER_ORIGIN}/api`;
const CREATE_ENDPOINT_CANDIDATES = ["/api/anime", "/post", "/add", "/create", "/new"];
const EDIT_DELETE_API_BASE_PATH = "/api/anime";
const THEME_STORAGE_KEY = "animePortalTheme";
const MOBILE_SECTION_STORAGE_KEY = "animePortalMobileSection";
const CHECKLIST_STORAGE_KEY = "animePortalChecklist";
const MOBILE_SECTION_QUERY = "(max-width: 719px)";
const DESKTOP_COLLAPSE_QUERY = "(min-width: 1100px)";
const FALLBACK_IMAGE_PATH = "images/fallback.jpg";
const posterPreviewObjectUrls = { add: "", edit: "" };
const JSON_BODY_METHODS = ["POST", "PUT", "PATCH"];
const MULTIPART_UPLOAD_ROUTES = ["/api/upload-image"];
const ACTIVITY_FEED_LIMIT = 8;
const CHECKLIST_STEPS = ["search", "filters", "endpoint", "crud"];
const SNIPPET_LANGUAGES = ["curl", "javascript", "python"];
const HEALTH_CHECK_INTERVAL_MS = 30000;
const HEALTH_LATENCY_SAMPLE_SIZE = 10;
const BULK_DEFAULT_IDS = "1, 2, 3";

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
    checklist: {
        search: false,
        filters: false,
        endpoint: false,
        crud: false,
    },
    metrics: {
        totalCalls: 0,
        successfulCalls: 0,
        endpointPaths: [],
        filteredAnimeCount: 0,
        totalAnimeCount: 0,
    },
    activityFeed: [],
    activeSnippetLanguage: "curl",
    health: {
        lastCheckedAt: null,
        averageLatencyMs: null,
        latencySamples: [],
        statusLabel: "Checking...",
        indicatorState: "degraded",
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

const DEFAULT_ANIME_BODY = {
    title: "Sample Anime Title",
    img_name: "images/uploads/sample-anime-title.webp",
    year: 2024,
    genre: "Action, Adventure",
    synopsis:
        "A sample anime payload for testing create or update routes in the endpoint explorer.",
    studio: "Sample Studio",
    episodes: 12,
    era: "2020s",
};

function resolveApiServerOrigin() {
    const params = new URLSearchParams(window.location.search);
    const overrideOrigin = String(params.get("apiOrigin") || "").trim();

    if (overrideOrigin) {
        return overrideOrigin.replace(/\/+$/, "");
    }

    const runtimeOrigin = String(window.location.origin || "").replace(/\/+$/, "");
    const protocol = String(window.location.protocol || "").toLowerCase();
    const hostname = String(window.location.hostname || "").toLowerCase();
    const port = String(window.location.port || "").trim();
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
    const isGithubPages = hostname.endsWith("github.io");
    const hasHttpOrigin = /^https?:\/\//i.test(runtimeOrigin);

    // If loaded from file:// or other non-http contexts, use deployed backend.
    if (!hasHttpOrigin || protocol === "file:") {
        return DEPLOYED_BACKEND_ORIGIN;
    }

    if (isLocal) {
        // If served by the backend itself, same-origin is correct.
        if (port === "3001") {
            return runtimeOrigin;
        }

        // Common local setup: frontend on another port, backend on 3001.
        return `${window.location.protocol}//${window.location.hostname}:3001`;
    }

    if (isGithubPages) {
        return DEPLOYED_BACKEND_ORIGIN;
    }

    return runtimeOrigin;
}

document.addEventListener("DOMContentLoaded", () => {
    initializePortal();
});

async function initializePortal() {
    initializeTheme();
    initializeSidebarToggle();
    initializeDeterminationDashboard();
    initializeApiHealthWidget();
    initializeSectionNavigation();
    bindEvents();
    fillSampleBody();
    recordMissionActivity("Portal initialized", "Ready for API exploration", "system");

    await Promise.all([
        loadRouteDocs(),
        refreshAnimeData("Initial load"),
        refreshStudiosCreatorsData("Initial load"),
    ]);
    await verifyCreateEndpoint();
}

function initializeApiHealthWidget() {
    renderApiHealthWidget();
    runApiHealthCheck();

    window.setInterval(() => {
        runApiHealthCheck();
    }, HEALTH_CHECK_INTERVAL_MS);
}

async function runApiHealthCheck() {
    const startedAt = performance.now();

    try {
        const response = await fetch(buildApiUrl("/api/health"), {
            cache: "no-store",
        });
        const latencyMs = Math.round(performance.now() - startedAt);

        let payload = {};
        try {
            payload = await response.json();
        } catch (_err) {
            payload = {};
        }

        const healthStatus = String(payload.status || "").toLowerCase();
        const isHealthy = response.ok && healthStatus === "ok";
        const statusLabel = isHealthy
            ? "Healthy"
            : response.ok
              ? "Degraded"
              : `Down (${response.status})`;

        applyApiHealthSample({
            statusLabel,
            indicatorState: isHealthy ? "healthy" : response.ok ? "degraded" : "down",
            latencyMs,
            checkedAt: new Date(),
        });
    } catch (_err) {
        applyApiHealthSample({
            statusLabel: "Down (network)",
            indicatorState: "down",
            checkedAt: new Date(),
        });
    }
}

function applyApiHealthSample({ statusLabel = "Unknown", indicatorState = "degraded", latencyMs, checkedAt }) {
    state.health.statusLabel = String(statusLabel || "Unknown");
    state.health.indicatorState = String(indicatorState || "degraded");
    state.health.lastCheckedAt = checkedAt instanceof Date ? checkedAt : new Date();

    if (Number.isFinite(latencyMs) && latencyMs >= 0) {
        state.health.latencySamples.push(Math.round(latencyMs));
        if (state.health.latencySamples.length > HEALTH_LATENCY_SAMPLE_SIZE) {
            state.health.latencySamples = state.health.latencySamples.slice(-HEALTH_LATENCY_SAMPLE_SIZE);
        }
    }

    if (state.health.latencySamples.length) {
        const total = state.health.latencySamples.reduce((sum, value) => sum + value, 0);
        state.health.averageLatencyMs = Math.round(total / state.health.latencySamples.length);
    }

    renderApiHealthWidget();
}

function renderApiHealthWidget() {
    const statusText = document.getElementById("apiHealthStatusText");
    const indicator = document.getElementById("apiHealthIndicator");
    const lastCheck = document.getElementById("apiHealthLastCheck");
    const avgLatency = document.getElementById("apiHealthAvgLatency");

    if (!statusText || !indicator || !lastCheck || !avgLatency) {
        return;
    }

    statusText.textContent = state.health.statusLabel;

    indicator.classList.remove("is-healthy", "is-degraded", "is-down");
    if (state.health.indicatorState === "healthy") {
        indicator.classList.add("is-healthy");
    } else if (state.health.indicatorState === "down") {
        indicator.classList.add("is-down");
    } else {
        indicator.classList.add("is-degraded");
    }

    lastCheck.textContent = state.health.lastCheckedAt
        ? formatTimestamp(state.health.lastCheckedAt)
        : "Pending";

    avgLatency.textContent = Number.isFinite(state.health.averageLatencyMs)
        ? `${state.health.averageLatencyMs} ms`
        : "Pending";
}

function formatTimestamp(date) {
    if (!(date instanceof Date)) {
        return "Pending";
    }

    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
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
            recordMissionActivity("Create endpoint verified", `Using ${state.createEndpointPath}`, "success");
            return;
        }

        console.warn("No supported create endpoint found in available routes", routeList);
        state.availableCreatePaths = [...CREATE_ENDPOINT_CANDIDATES];
        state.createEndpointPath = CREATE_ENDPOINT_CANDIDATES[0];

        const addAnimeMeta = document.getElementById("addAnimeMeta");
        if (addAnimeMeta) {
            addAnimeMeta.innerHTML = `<strong style="color: var(--color-error, #d32f2f);">Error:</strong> Could not locate a working create endpoint on the backend. Expected one of: ${escapeHtml(CREATE_ENDPOINT_CANDIDATES.join(", "))}.`;
        }

        recordMissionActivity("Create endpoint missing", "No supported POST create route found", "error");
    } catch (err) {
        console.error("Failed to verify create endpoint:", err);
        state.availableCreatePaths = [...CREATE_ENDPOINT_CANDIDATES];
        state.createEndpointPath = CREATE_ENDPOINT_CANDIDATES[0];

        const addAnimeMeta = document.getElementById("addAnimeMeta");
        if (addAnimeMeta) {
            addAnimeMeta.innerHTML = `<strong style="color: var(--color-error, #d32f2f);">Error:</strong> Could not reach backend to verify create endpoint availability. Submission will still try: ${escapeHtml(CREATE_ENDPOINT_CANDIDATES.join(", "))}.`;
        }

        recordMissionActivity("Create endpoint check failed", String(err.message || err), "error");
    }
}

function initializeDeterminationDashboard() {
    restoreChecklistState();

    const checklistRoot = document.getElementById("onboardingChecklist");
    if (checklistRoot) {
        checklistRoot.addEventListener("change", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") {
                return;
            }

            const key = String(target.dataset.checklistKey || "");
            if (!CHECKLIST_STEPS.includes(key)) {
                return;
            }

            state.checklist[key] = target.checked;
            persistChecklistState();
            renderChecklistProgress();
        });
    }

    const resetChecklistBtn = document.getElementById("resetChecklistBtn");
    if (resetChecklistBtn) {
        resetChecklistBtn.addEventListener("click", () => {
            state.checklist = {
                search: false,
                filters: false,
                endpoint: false,
                crud: false,
            };
            persistChecklistState();
            renderChecklistProgress();
            recordMissionActivity("Checklist reset", "Onboarding targets restarted", "system");
        });
    }

    renderChecklistProgress();
    renderUsageMeters();
    renderMissionActivity();
}

function restoreChecklistState() {
    try {
        const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
        if (!raw) {
            return;
        }

        const parsed = JSON.parse(raw);
        CHECKLIST_STEPS.forEach((stepKey) => {
            state.checklist[stepKey] = Boolean(parsed[stepKey]);
        });
    } catch (_err) {
        // Ignore malformed localStorage data and continue with defaults.
    }
}

function persistChecklistState() {
    localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(state.checklist));
}

function renderChecklistProgress() {
    const checklistInputs = document.querySelectorAll("#onboardingChecklist input[type='checkbox'][data-checklist-key]");
    checklistInputs.forEach((input) => {
        const key = String(input.dataset.checklistKey || "");
        input.checked = Boolean(state.checklist[key]);
    });

    const completed = CHECKLIST_STEPS.filter((key) => Boolean(state.checklist[key])).length;
    const total = CHECKLIST_STEPS.length;
    const percent = Math.round((completed / total) * 100);
    const circle = document.getElementById("checklistProgressCircle");
    const percentLabel = document.getElementById("checklistProgressPercent");
    const countLabel = document.getElementById("checklistProgressCount");
    const status = document.getElementById("checklistStatus");

    if (circle) {
        const circumference = 326.73;
        const offset = circumference - (percent / 100) * circumference;
        circle.style.strokeDashoffset = String(offset);
    }

    if (percentLabel) {
        percentLabel.textContent = `${percent}%`;
    }

    if (countLabel) {
        countLabel.textContent = `${completed}/${total} done`;
    }

    if (status) {
        status.textContent =
            completed === total
                ? "Mission complete: all onboarding checkpoints are done."
                : `Keep pushing: ${total - completed} checkpoints remaining.`;
    }
}

function markChecklistStep(stepKey) {
    if (!CHECKLIST_STEPS.includes(stepKey) || state.checklist[stepKey]) {
        return;
    }

    state.checklist[stepKey] = true;
    persistChecklistState();
    renderChecklistProgress();
}

function updateUsageMetrics({ path = "", ok = false, source = "api" } = {}) {
    state.metrics.totalCalls += 1;
    if (ok) {
        state.metrics.successfulCalls += 1;
    }

    if (source === "api" && path) {
        if (!state.metrics.endpointPaths.includes(path)) {
            state.metrics.endpointPaths.push(path);
        }
    }

    renderUsageMeters();
}

function renderUsageMeters() {
    const endpointTotal = Math.max(1, state.routes.length || getFallbackRoutes().length);
    const endpointReach = Math.min(100, Math.round((state.metrics.endpointPaths.length / endpointTotal) * 100));
    const successRate = state.metrics.totalCalls
        ? Math.round((state.metrics.successfulCalls / state.metrics.totalCalls) * 100)
        : 0;
    const catalogPercent = state.metrics.totalAnimeCount
        ? Math.round((state.metrics.filteredAnimeCount / state.metrics.totalAnimeCount) * 100)
        : 0;

    setMeterValue("usageEndpointReach", endpointReach);
    setMeterValue("usageSuccessRate", successRate);
    setMeterValue("usageCatalog", catalogPercent);

    const usageSummary = document.getElementById("usageSummary");
    if (usageSummary) {
        usageSummary.textContent = `${state.metrics.successfulCalls}/${state.metrics.totalCalls} successful requests, ${state.metrics.endpointPaths.length} unique endpoints reached.`;
    }
}

function setMeterValue(prefix, value) {
    const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
    const valueEl = document.getElementById(`${prefix}Value`);
    const barEl = document.getElementById(`${prefix}Bar`);

    if (valueEl) {
        valueEl.textContent = `${safeValue}%`;
    }

    if (barEl) {
        barEl.style.width = `${safeValue}%`;
    }
}

function recordMissionActivity(title, detail = "", level = "system") {
    const timestamp = new Date();
    state.activityFeed.unshift({
        title: String(title || "Activity update"),
        detail: String(detail || ""),
        level: String(level || "system"),
        timestamp,
    });

    if (state.activityFeed.length > ACTIVITY_FEED_LIMIT) {
        state.activityFeed = state.activityFeed.slice(0, ACTIVITY_FEED_LIMIT);
    }

    renderMissionActivity();
}

function renderMissionActivity() {
    const feed = document.getElementById("missionActivityFeed");
    if (!feed) {
        return;
    }

    if (!state.activityFeed.length) {
        feed.innerHTML = `<p class="state-note">No mission activity yet. Start by running an endpoint.</p>`;
        return;
    }

    feed.innerHTML = state.activityFeed
        .map((item) => {
            const timeLabel = formatRelativeTime(item.timestamp);
            return `
                <article class="activity-item">
                    <div class="activity-head">
                        <p class="activity-title">${escapeHtml(item.title)}</p>
                        <time class="activity-time">${escapeHtml(timeLabel)}</time>
                    </div>
                    <p class="activity-meta">${escapeHtml(item.detail || "No additional details")}</p>
                </article>
            `;
        })
        .join("");
}

function formatRelativeTime(date) {
    if (!(date instanceof Date)) {
        return "just now";
    }

    const diffMs = Date.now() - date.getTime();
    if (diffMs < 5000) {
        return "just now";
    }

    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) {
        return `${seconds}s ago`;
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours}h ago`;
    }

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
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
    const endpointAnimeId = document.getElementById("endpointAnimeId");
    const endpointBody = document.getElementById("endpointBody");
    const endpointFile = document.getElementById("endpointFile");
    const copySnippetBtn = document.getElementById("copySnippetBtn");
    const snippetTabs = document.querySelectorAll(".snippet-tab[data-snippet-tab]");
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
    const bulkRunnerForm = document.getElementById("bulkRunnerForm");
    const bulkRunBtn = document.getElementById("bulkRunBtn");
    const bulkResetBtn = document.getElementById("bulkResetBtn");

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
    const editAnimeForm = document.getElementById("editAnimeForm");
    const clearEditAnimeBtn = document.getElementById("clearEditAnimeBtn");
    const editAnimeYearInput = document.getElementById("editAnimeYear");
    const editAnimeSelect = document.getElementById("editAnimeSelect");
    const deleteAnimeForm = document.getElementById("deleteAnimeForm");
    const addPosterFileInput = document.getElementById("addAnimePosterFile");
    const editPosterFileInput = document.getElementById("editAnimePosterFile");

    if (addAnimeYearInput) {
        addAnimeYearInput.max = String(new Date().getFullYear() + 1);
    }

    if (editAnimeYearInput) {
        editAnimeYearInput.max = String(new Date().getFullYear() + 1);
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
            applyPosterSelection("add");
            const responseDiv = document.getElementById("addAnimeResponse");
            responseDiv.style.display = "none";
            document.getElementById("addAnimeMeta").textContent = "Fill all fields to add a new anime record. Required fields marked with *.";
        });
    }

    if (addPosterFileInput) {
        addPosterFileInput.addEventListener("change", () => {
            applyPosterSelection("add");
        });
    }

    if (editAnimeSelect) {
        editAnimeSelect.addEventListener("change", () => {
            populateEditAnimeFormFromSelection();
        });
    }

    if (editPosterFileInput) {
        editPosterFileInput.addEventListener("change", () => {
            applyPosterSelection("edit");
        });
    }

    if (editAnimeForm) {
        editAnimeForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            await submitEditAnimeForm();
        });
    }

    if (clearEditAnimeBtn && editAnimeForm) {
        clearEditAnimeBtn.addEventListener("click", () => {
            editAnimeForm.reset();
            applyPosterSelection("edit");
            const responseDiv = document.getElementById("editAnimeResponse");
            responseDiv.style.display = "none";
            document.getElementById("editAnimeMeta").textContent =
                "Choose an anime, update fields, then save changes to the API.";
        });
    }

    if (deleteAnimeForm) {
        deleteAnimeForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            await submitDeleteAnimeForm();
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
        renderCodeSnippets();
    });

    endpointSelect.addEventListener("change", () => {
        updateEndpointFormState();
    });

    if (endpointAnimeId) {
        endpointAnimeId.addEventListener("input", () => {
            renderCodeSnippets();
        });
    }

    if (endpointBody) {
        endpointBody.addEventListener("input", () => {
            renderCodeSnippets();
        });
    }

    if (endpointFile) {
        endpointFile.addEventListener("change", () => {
            renderCodeSnippets();
        });
    }

    snippetTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            setActiveSnippetLanguage(String(tab.dataset.snippetTab || "curl"));
        });
    });

    if (copySnippetBtn) {
        copySnippetBtn.addEventListener("click", async () => {
            await copyActiveSnippet();
        });
    }

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

    if (bulkRunnerForm) {
        bulkRunnerForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (bulkRunBtn) {
                bulkRunBtn.disabled = true;
                bulkRunBtn.textContent = "Running...";
            }

            try {
                await runBulkRequestComparison();
            } finally {
                if (bulkRunBtn) {
                    bulkRunBtn.disabled = false;
                    bulkRunBtn.textContent = "Run Bulk Requests";
                }
            }
        });
    }

    if (bulkResetBtn) {
        bulkResetBtn.addEventListener("click", () => {
            resetBulkRunnerOutput();
            const idsInput = document.getElementById("bulkIdsInput");
            if (idsInput) {
                idsInput.value = BULK_DEFAULT_IDS;
            }
            const meta = document.getElementById("bulkRunnerMeta");
            if (meta) {
                meta.textContent = "Enter IDs and run the same endpoint for each ID.";
            }
        });
    }

    window.addEventListener("resize", () => {
        applyAllGridCollapseStates();
    });
}

function initializeSectionNavigation() {
    const tocList = document.getElementById("docsTocList");
    const nav = document.querySelector(".docs-nav");
    const sections = Array.from(
        document.querySelectorAll(".content-main > section.panel[aria-labelledby]")
    );

    if (!tocList || !nav || !sections.length) {
        if (nav) {
            nav.hidden = true;
        }
        return;
    }

    const tocEntries = [];

    sections.forEach((section) => {
        const headingId = String(section.getAttribute("aria-labelledby") || "").trim();
        if (!headingId) {
            return;
        }

        const heading = document.getElementById(headingId);
        if (!heading) {
            return;
        }

        const text = String(heading.textContent || "").trim();
        if (!text) {
            return;
        }

        const li = document.createElement("li");
        const link = document.createElement("a");
        link.className = "docs-toc-link";
        link.href = `#${headingId}`;
        link.dataset.targetId = headingId;
        link.textContent = text;

        link.addEventListener("click", (event) => {
            event.preventDefault();
            heading.scrollIntoView({
                behavior:
                    window.matchMedia &&
                    window.matchMedia("(prefers-reduced-motion: reduce)").matches
                        ? "auto"
                        : "smooth",
                block: "start",
            });
            window.history.replaceState(null, "", `#${headingId}`);
        });

        li.appendChild(link);
        tocList.appendChild(li);

        tocEntries.push({
            section,
            heading,
            id: headingId,
            link,
        });
    });

    if (!tocEntries.length) {
        nav.hidden = true;
        return;
    }

    let activeId = "";

    const setActiveLink = (nextId) => {
        if (!nextId || nextId === activeId) {
            return;
        }

        activeId = nextId;

        tocEntries.forEach((entry) => {
            const isActive = entry.id === activeId;
            entry.link.classList.toggle("is-active", isActive);
            if (isActive) {
                entry.link.setAttribute("aria-current", "location");
            } else {
                entry.link.removeAttribute("aria-current");
            }
        });
    };

    const syncActiveByViewport = () => {
        const viewportTop = window.innerHeight * 0.22;
        let winner = tocEntries[0];

        for (const entry of tocEntries) {
            const top = entry.section.getBoundingClientRect().top;
            if (top <= viewportTop) {
                winner = entry;
            } else {
                break;
            }
        }

        setActiveLink(winner.id);
    };

    if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

                if (visible.length) {
                    const nextId = String(visible[0].target.getAttribute("aria-labelledby") || "");
                    if (nextId) {
                        setActiveLink(nextId);
                        return;
                    }
                }

                syncActiveByViewport();
            },
            {
                root: null,
                rootMargin: "-20% 0px -64% 0px",
                threshold: [0, 0.2, 0.6, 1],
            }
        );

        tocEntries.forEach((entry) => observer.observe(entry.section));
    } else {
        window.addEventListener("scroll", syncActiveByViewport, { passive: true });
    }

    const hash = String(window.location.hash || "").replace(/^#/, "");
    const hashEntry = hash ? tocEntries.find((entry) => entry.id === hash) : null;
    setActiveLink(hashEntry ? hashEntry.id : tocEntries[0].id);
    syncActiveByViewport();
}

function initializeTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = savedTheme === "dark" || savedTheme === "light" ? savedTheme : prefersDark ? "dark" : "light";

    applyTheme(theme);
}

function initializeSidebarToggle() {
    const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
    const docsNav = document.querySelector(".docs-nav");
    const docsNavContent = document.getElementById("docsNavContent");

    if (!sidebarToggleBtn || !docsNav || !docsNavContent) {
        return;
    }

    const SIDEBAR_STORAGE_KEY = "animePortalSidebarCollapsed";
    const isCollapsed = localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";

    if (isCollapsed) {
        docsNav.classList.add("is-collapsed");
        sidebarToggleBtn.setAttribute("aria-expanded", "false");
    } else {
        docsNav.classList.remove("is-collapsed");
        sidebarToggleBtn.setAttribute("aria-expanded", "true");
    }

    sidebarToggleBtn.addEventListener("click", () => {
        const isCurrentlyCollapsed = docsNav.classList.toggle("is-collapsed");
        const newAriaExpanded = isCurrentlyCollapsed ? "false" : "true";
        
        sidebarToggleBtn.setAttribute("aria-expanded", newAriaExpanded);
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isCurrentlyCollapsed));
    });
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
        updateUsageMetrics({ path: "/api/routes", ok: true });
        state.routes = Array.isArray(data.routes) ? data.routes : [];

        routeList.innerHTML = "";
        state.routes.forEach((route) => {
            routeList.appendChild(createRouteCard(route));
        });

        populateEndpointSelect();
        populateBulkEndpointSelect();
        recordMissionActivity("Routes loaded", `${state.routes.length} routes discovered`, "success");
    } catch (err) {
        console.error(err);
        updateUsageMetrics({ path: "/api/routes", ok: false });
        routeList.innerHTML = `<p class="state-note">Could not load routes from GET /api/routes. Showing built-in route fallbacks.</p>`;
        state.routes = getFallbackRoutes();
        state.routes.forEach((route) => {
            routeList.appendChild(createRouteCard(route));
        });
        populateEndpointSelect();
        populateBulkEndpointSelect();
        recordMissionActivity("Routes fallback enabled", "Using built-in route definitions", "error");
    }
}

function getFallbackRoutes() {
    return [
        { method: "GET", path: "/api/anime", description: "Get all anime" },
        { method: "GET", path: "/api/anime/:id", description: "Get anime by ID" },
        { method: "POST", path: "/api/anime", description: "Create anime" },
        { method: "PUT", path: "/api/anime/:id", description: "Update anime by ID" },
        { method: "DELETE", path: "/api/anime/:id", description: "Delete anime by ID" },
        { method: "GET", path: "/api/studios-creators", description: "Get studios and creators" },
        { method: "GET", path: "/api/routes", description: "Get route metadata" },
        { method: "GET", path: "/api/health", description: "Health check" },
        { method: "GET", path: "/api/feedback", description: "Get feedback entries" },
        { method: "POST", path: "/api/feedback", description: "Submit feedback" },
        { method: "POST", path: "/api/upload-image", description: "Upload image" },
        { method: "POST", path: "/add", description: "Create anime alias" },
        { method: "POST", path: "/post", description: "Create anime alias" },
        { method: "POST", path: "/create", description: "Create anime alias" },
        { method: "POST", path: "/new", description: "Create anime alias" },
        { method: "GET", path: "/get", description: "Anime alias" },
    ];
}

async function refreshAnimeData(reason) {
    try {
        state.anime = await fetchJson(`${API_BASE}/anime`);
        updateUsageMetrics({ path: "/api/anime", ok: true });
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
        populateManageAnimeSelects();
        updateSearchMeta(reason, state.filteredAnime.length, state.anime.length);
        updateFilterMeta(state.filteredAnime.length, state.anime.length);
        state.metrics.filteredAnimeCount = state.filteredAnime.length;
        state.metrics.totalAnimeCount = state.anime.length;
        renderUsageMeters();
        recordMissionActivity(reason, `Anime ${state.filteredAnime.length}/${state.anime.length} visible`, "success");

        if (String(reason || "").toLowerCase().includes("search")) {
            markChecklistStep("search");
        }

        if (String(reason || "").toLowerCase().includes("filter")) {
            markChecklistStep("filters");
        }
    } catch (err) {
        console.error(err);
        updateUsageMetrics({ path: "/api/anime", ok: false });
        renderAnimeError();
        recordMissionActivity("Anime load failed", String(err.message || err), "error");
    }
}

async function refreshStudiosCreatorsData(reason) {
    try {
        const data = await fetchJson(`${API_BASE}/studios-creators`);
        updateUsageMetrics({ path: "/api/studios-creators", ok: true });
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
        recordMissionActivity(
            reason,
            `Studios ${state.filteredStudios.length}/${state.studios.length}, creators ${state.filteredCreators.length}/${state.creators.length}`,
            "success"
        );
    } catch (err) {
        console.error(err);
        updateUsageMetrics({ path: "/api/studios-creators", ok: false });
        renderStudiosCreatorsError();
        recordMissionActivity("Studios/creators load failed", String(err.message || err), "error");
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
    endpointSelect.innerHTML = state.routes.length
        ? state.routes
        .map((route) => {
            const method = String(route.method || "GET");
            const path = String(route.path || "");
            const label = `${method} ${path}`;
            return `<option value="${escapeHtml(`${method}|${path}`)}">${escapeHtml(label)}</option>`;
        })
        .join("")
        : `<option value="">No routes available</option>`;

    updateEndpointFormState();
}

function getBulkEligibleRoutes() {
    const routes = state.routes.length ? state.routes : getFallbackRoutes();
    const eligible = routes.filter((route) => {
        const method = String(route.method || "").toUpperCase();
        const path = String(route.path || "");
        return method === "GET" && path.includes(":id");
    });

    if (eligible.length) {
        return eligible;
    }

    return [
        {
            method: "GET",
            path: "/api/anime/:id",
            description: "Get a single anime by numeric id",
        },
    ];
}

function populateBulkEndpointSelect() {
    const select = document.getElementById("bulkEndpointSelect");
    if (!select) {
        return;
    }

    const routes = getBulkEligibleRoutes();
    select.innerHTML = routes
        .map((route) => {
            const method = String(route.method || "GET").toUpperCase();
            const path = String(route.path || "");
            return `<option value="${escapeHtml(`${method}|${path}`)}">${escapeHtml(`${method} ${path}`)}</option>`;
        })
        .join("");
}

function parseBulkIds(value) {
    const tokens = String(value || "")
        .split(/[\s,]+/)
        .map((token) => token.trim())
        .filter(Boolean);

    const seen = new Set();
    const validIds = [];
    const invalidTokens = [];

    tokens.forEach((token) => {
        const id = Number(token);
        if (!Number.isInteger(id) || id < 1) {
            invalidTokens.push(token);
            return;
        }

        if (seen.has(id)) {
            return;
        }

        seen.add(id);
        validIds.push(id);
    });

    return { validIds, invalidTokens };
}

function resetBulkRunnerOutput() {
    const results = document.getElementById("bulkRunnerResults");
    const compare = document.getElementById("bulkComparisonViewer");

    if (results) {
        results.innerHTML = "";
    }

    if (compare) {
        compare.style.display = "none";
        compare.textContent = "";
    }
}

function getPayloadShapeSignature(value, depth = 0) {
    if (value === null) {
        return "null";
    }

    if (Array.isArray(value)) {
        if (!value.length || depth >= 2) {
            return "array";
        }

        return `array<${getPayloadShapeSignature(value[0], depth + 1)}>`;
    }

    if (typeof value === "object") {
        if (depth >= 2) {
            return "object";
        }

        const keys = Object.keys(value).sort();
        const children = keys.map((key) => `${key}:${getPayloadShapeSignature(value[key], depth + 1)}`);
        return `{${children.join(",")}}`;
    }

    return typeof value;
}

function buildBulkComparisonSummary(results) {
    const successful = results.filter((item) => item.ok);
    if (!successful.length) {
        return "No successful responses to compare.";
    }

    const shapeMap = new Map();
    successful.forEach((item) => {
        const shape = getPayloadShapeSignature(item.payload);
        if (!shapeMap.has(shape)) {
            shapeMap.set(shape, []);
        }
        shapeMap.get(shape).push(item.id);
    });

    const lines = [];
    lines.push(`Compared ${successful.length} successful responses across ${shapeMap.size} payload shape(s).`);

    const sortedShapes = [...shapeMap.entries()].sort((left, right) => right[1].length - left[1].length);
    sortedShapes.forEach(([shape, ids], index) => {
        const label = index === 0 ? "Primary shape" : `Variant ${index}`;
        lines.push(`${label}: IDs [${ids.join(", ")}]`);
        lines.push(shape);
    });

    const objectPayloads = successful.filter(
        (item) => item.payload && typeof item.payload === "object" && !Array.isArray(item.payload)
    );

    if (objectPayloads.length >= 2) {
        const keySet = new Set();
        objectPayloads.forEach((item) => {
            Object.keys(item.payload).forEach((key) => keySet.add(key));
        });

        const allKeys = [...keySet].sort();
        const inconsistentKeys = allKeys.filter((key) => {
            const presentCount = objectPayloads.reduce((sum, item) => sum + (key in item.payload ? 1 : 0), 0);
            return presentCount > 0 && presentCount < objectPayloads.length;
        });

        lines.push("");
        lines.push(`Top-level keys inspected: ${allKeys.length}`);
        if (!inconsistentKeys.length) {
            lines.push("Top-level key presence is consistent across successful object responses.");
        } else {
            lines.push(`Inconsistent keys: ${inconsistentKeys.join(", ")}`);
        }
    }

    return lines.join("\n");
}

function renderBulkResults(results) {
    const container = document.getElementById("bulkRunnerResults");
    const compareViewer = document.getElementById("bulkComparisonViewer");

    if (!container || !compareViewer) {
        return;
    }

    if (!results.length) {
        container.innerHTML = `<p class="state-note">No requests were run.</p>`;
        compareViewer.style.display = "none";
        return;
    }

    container.innerHTML = results
        .map((item) => {
            const statusClass = item.ok ? "bulk-status-ok" : "bulk-status-error";
            const statusLabel = item.error
                ? "Request failed"
                : `${item.status} ${item.statusText || ""}`.trim();

            return `
                <article class="bulk-result-card">
                    <p class="bulk-result-head">
                        <span class="bulk-id-chip">ID ${escapeHtml(String(item.id))}</span>
                        <span class="bulk-status-chip ${statusClass}">${escapeHtml(statusLabel)}</span>
                    </p>
                    <p class="bulk-result-meta">${escapeHtml(item.targetUrl || "-")} • ${escapeHtml(String(item.elapsedMs || 0))} ms</p>
                    <details>
                        <summary>View response</summary>
                        <pre class="response-viewer bulk-response-preview">${escapeHtml(
                            JSON.stringify(item.error ? { error: item.error } : item.payload, null, 2)
                        )}</pre>
                    </details>
                </article>
            `;
        })
        .join("");

    compareViewer.style.display = "block";
    compareViewer.textContent = buildBulkComparisonSummary(results);
}

async function runBulkRequestComparison() {
    const endpointSelect = document.getElementById("bulkEndpointSelect");
    const idsInput = document.getElementById("bulkIdsInput");
    const meta = document.getElementById("bulkRunnerMeta");

    if (!endpointSelect || !idsInput || !meta) {
        return;
    }

    if (!endpointSelect.value) {
        meta.textContent = "Select an endpoint before running bulk requests.";
        return;
    }

    const { validIds, invalidTokens } = parseBulkIds(idsInput.value);
    if (!validIds.length) {
        meta.textContent = "Provide at least one valid positive integer ID.";
        resetBulkRunnerOutput();
        return;
    }

    const [method, rawPath] = endpointSelect.value.split("|");
    meta.textContent = `Running ${method} ${rawPath} for IDs: ${validIds.join(", ")}`;

    const results = await Promise.all(
        validIds.map(async (id) => {
            const result = await runEndpointRequest({
                method,
                rawPath,
                animeId: String(id),
                endpointBodyValue: "",
                selectedFile: null,
                autoFillBody: false,
            });

            return {
                id,
                ...result,
            };
        })
    );

    renderBulkResults(results);

    const successCount = results.filter((item) => item.ok).length;
    const failureCount = results.length - successCount;
    const invalidSuffix = invalidTokens.length ? ` Ignored invalid values: ${invalidTokens.join(", ")}.` : "";
    meta.textContent = `Completed ${results.length} requests: ${successCount} success, ${failureCount} failed.${invalidSuffix}`;
    updateUsageMetrics({ path: rawPath, ok: failureCount === 0 });
    recordMissionActivity(
        `Bulk runner ${method} ${rawPath}`,
        `${successCount}/${results.length} succeeded across IDs: ${validIds.join(", ")}`,
        failureCount === 0 ? "success" : "error"
    );
    markChecklistStep("endpoint");
}

function methodSupportsJsonBody(method) {
    return JSON_BODY_METHODS.includes(String(method || "").toUpperCase());
}

function isMultipartUploadRoute(path, method) {
    return String(method || "").toUpperCase() === "POST" && MULTIPART_UPLOAD_ROUTES.includes(String(path || ""));
}

function updateEndpointFormState() {
    const endpointSelect = document.getElementById("endpointSelect");
    const endpointAnimeId = document.getElementById("endpointAnimeId");
    const endpointBody = document.getElementById("endpointBody");
    const endpointFileField = document.getElementById("endpointFileField");
    const endpointFile = document.getElementById("endpointFile");
    const endpointFormHint = document.getElementById("endpointFormHint");
    const selected = endpointSelect.value;

    if (!selected) {
        endpointAnimeId.disabled = true;
        endpointBody.disabled = true;
        if (endpointFileField) {
            endpointFileField.hidden = true;
        }
        if (endpointFile) {
            endpointFile.required = false;
            endpointFile.value = "";
        }
        if (endpointFormHint) {
            endpointFormHint.textContent = "Select an endpoint to configure required inputs.";
        }
        renderCodeSnippets();
        return;
    }

    const [method, path] = selected.split("|");
    const normalizedMethod = method.toUpperCase();
    const isMultipartRoute = isMultipartUploadRoute(path, normalizedMethod);
    const usesJsonBody = methodSupportsJsonBody(normalizedMethod) && !isMultipartRoute;

    endpointAnimeId.disabled = !path.includes(":id");
    endpointBody.disabled = !usesJsonBody;

    if (!usesJsonBody) {
        endpointBody.value = "";
    }

    if (endpointFileField) {
        endpointFileField.hidden = !isMultipartRoute;
    }

    if (endpointFile) {
        endpointFile.required = isMultipartRoute;
        if (!isMultipartRoute) {
            endpointFile.value = "";
        }
    }

    if (endpointFormHint) {
        if (isMultipartRoute) {
            endpointFormHint.textContent =
                "This endpoint requires multipart upload. Choose an image file below, then run endpoint.";
        } else if (usesJsonBody) {
            endpointFormHint.textContent = "This endpoint accepts JSON body. Use Fill Sample POST Body to generate payload.";
        } else {
            endpointFormHint.textContent = "This endpoint does not require a request body.";
        }
    }

    renderCodeSnippets();
}

function setActiveSnippetLanguage(language) {
    const safeLanguage = SNIPPET_LANGUAGES.includes(language) ? language : "curl";
    state.activeSnippetLanguage = safeLanguage;

    const tabs = document.querySelectorAll(".snippet-tab[data-snippet-tab]");
    const panels = document.querySelectorAll("[data-snippet-panel]");

    tabs.forEach((tab) => {
        const isActive = tab.dataset.snippetTab === safeLanguage;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-selected", String(isActive));
    });

    panels.forEach((panel) => {
        const isActive = panel.getAttribute("data-snippet-panel") === safeLanguage;
        panel.hidden = !isActive;
    });
}

function renderCodeSnippets() {
    const endpointSelect = document.getElementById("endpointSelect");
    const curlPanel = document.getElementById("snippetCurl");
    const jsPanel = document.getElementById("snippetJavascript");
    const pyPanel = document.getElementById("snippetPython");
    const meta = document.getElementById("snippetMeta");

    if (!curlPanel || !jsPanel || !pyPanel || !endpointSelect) {
        return;
    }

    if (!endpointSelect.value) {
        const emptyMessage = "Select an endpoint to generate code snippets.";
        curlPanel.textContent = emptyMessage;
        jsPanel.textContent = emptyMessage;
        pyPanel.textContent = emptyMessage;
        if (meta) {
            meta.textContent = "Choose an endpoint to generate copy-ready snippets.";
        }
        setActiveSnippetLanguage(state.activeSnippetLanguage);
        return;
    }

    const [method, rawPath] = endpointSelect.value.split("|");
    const config = getSnippetRequestConfig(method, rawPath);

    curlPanel.textContent = buildCurlSnippet(config);
    jsPanel.textContent = buildJavascriptSnippet(config);
    pyPanel.textContent = buildPythonSnippet(config);

    if (meta) {
        meta.textContent = `${config.method} ${config.path} snippets are ready. They reflect your current ID, body, and file selection.`;
    }

    setActiveSnippetLanguage(state.activeSnippetLanguage);
}

function getSnippetRequestConfig(method, rawPath) {
    const endpointAnimeId = document.getElementById("endpointAnimeId");
    const endpointBody = document.getElementById("endpointBody");
    const endpointFile = document.getElementById("endpointFile");

    const normalizedMethod = String(method || "GET").toUpperCase();
    const originalPath = String(rawPath || "").trim();
    const animeId = endpointAnimeId && endpointAnimeId.value ? endpointAnimeId.value : "1";
    const path = originalPath.includes(":id") ? originalPath.replace(":id", animeId) : originalPath;
    const url = buildApiUrl(path);
    const multipart = isMultipartUploadRoute(path, normalizedMethod);
    const jsonBodySupported = methodSupportsJsonBody(normalizedMethod) && !multipart;
    const rawBody = endpointBody ? endpointBody.value.trim() : "";

    let parsedJsonBody = null;
    let jsonBodyIsValid = false;
    if (jsonBodySupported && rawBody) {
        try {
            parsedJsonBody = JSON.parse(rawBody);
            jsonBodyIsValid = true;
        } catch (_err) {
            parsedJsonBody = null;
            jsonBodyIsValid = false;
        }
    }

    const selectedFile = endpointFile && endpointFile.files && endpointFile.files[0] ? endpointFile.files[0] : null;

    return {
        method: normalizedMethod,
        path,
        url,
        multipart,
        jsonBodySupported,
        rawBody,
        parsedJsonBody,
        jsonBodyIsValid,
        fileName: selectedFile ? selectedFile.name : "image-file.jpg",
    };
}

function buildCurlSnippet(config) {
    const lines = [`curl -X ${config.method} "${config.url}"`];

    if (config.multipart) {
        lines.push(`  -F "image=@${config.fileName}"`);
        return lines.join(" \\\n");
    }

    if (config.jsonBodySupported) {
        const bodyObject =
            config.jsonBodyIsValid && config.parsedJsonBody
                ? config.parsedJsonBody
                : getDefaultSnippetBodyForPath(config.path);
        const bodyJson = JSON.stringify(bodyObject, null, 2);
        const escapedBody = bodyJson.replace(/'/g, "'\\''");
        lines.push("  -H \"Content-Type: application/json\"");
        lines.push(`  -d '${escapedBody}'`);
    }

    return lines.join(" \\\n");
}

function buildJavascriptSnippet(config) {
    const lines = [
        `const url = \"${config.url}\";`,
    ];

    if (config.multipart) {
        lines.push("const formData = new FormData();");
        lines.push(`// Attach a real File object from an input before running this request.`);
        lines.push(`formData.append(\"image\", selectedFile);`);
        lines.push("");
        lines.push("const response = await fetch(url, {");
        lines.push(`  method: \"${config.method}\",`);
        lines.push("  body: formData,");
        lines.push("});");
    } else if (config.jsonBodySupported) {
        const bodyObject =
            config.jsonBodyIsValid && config.parsedJsonBody
                ? config.parsedJsonBody
                : getDefaultSnippetBodyForPath(config.path);
        const bodyLiteral = JSON.stringify(bodyObject, null, 2);

        lines.push(`const payload = ${bodyLiteral};`);
        lines.push("");
        lines.push("const response = await fetch(url, {");
        lines.push(`  method: \"${config.method}\",`);
        lines.push("  headers: {");
        lines.push('    \"Content-Type\": \"application/json\",');
        lines.push("  },");
        lines.push("  body: JSON.stringify(payload),");
        lines.push("});");
    } else {
        lines.push("");
        lines.push("const response = await fetch(url, {");
        lines.push(`  method: \"${config.method}\",`);
        lines.push("});");
    }

    lines.push("const data = await response.json();");
    lines.push("console.log(response.status, data);");

    return lines.join("\n");
}

function buildPythonSnippet(config) {
    const lines = ["import requests", "", `url = \"${escapeDoubleQuotes(config.url)}\"`];

    if (config.multipart) {
        lines.push("");
        lines.push(`# Replace with a valid local file path before running.`);
        lines.push(`with open(\"${escapeDoubleQuotes(config.fileName)}\", \"rb\") as image_file:`);
        lines.push("    files = {\"image\": image_file}");
        lines.push(`    response = requests.request(\"${config.method}\", url, files=files)`);
    } else if (config.jsonBodySupported) {
        const bodyObject =
            config.jsonBodyIsValid && config.parsedJsonBody
                ? config.parsedJsonBody
                : getDefaultSnippetBodyForPath(config.path);
        const bodyJson = JSON.stringify(bodyObject, null, 4);
        lines.push("payload = " + bodyJson);
        lines.push("headers = {\"Content-Type\": \"application/json\"}");
        lines.push("");
        lines.push(`response = requests.request(\"${config.method}\", url, headers=headers, json=payload)`);
    } else {
        lines.push("");
        lines.push(`response = requests.request(\"${config.method}\", url)`);
    }

    lines.push("print(response.status_code)");
    lines.push("print(response.text)");

    return lines.join("\n");
}

function getDefaultSnippetBodyForPath(path) {
    const normalized = String(path || "");

    if (
        normalized === "/api/anime" ||
        normalized === "/add" ||
        normalized === "/post" ||
        normalized === "/create" ||
        normalized === "/new" ||
        normalized.startsWith("/api/anime/")
    ) {
        return DEFAULT_ANIME_BODY;
    }

    if (normalized === "/api/feedback") {
        return DEFAULT_FEEDBACK_BODY;
    }

    return DEFAULT_FEEDBACK_BODY;
}

function escapeDoubleQuotes(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/\"/g, '\\\"');
}

async function copyActiveSnippet() {
    const panel = document.querySelector(`[data-snippet-panel="${state.activeSnippetLanguage}"]`);
    const meta = document.getElementById("snippetMeta");

    if (!panel) {
        return;
    }

    const textToCopy = String(panel.textContent || "").trim();
    if (!textToCopy) {
        if (meta) {
            meta.textContent = "No snippet to copy yet. Select an endpoint first.";
        }
        return;
    }

    try {
        await navigator.clipboard.writeText(textToCopy);
        if (meta) {
            meta.textContent = `${state.activeSnippetLanguage} snippet copied to clipboard.`;
        }
    } catch (_err) {
        if (meta) {
            meta.textContent = "Clipboard permission was blocked. Copy manually from the snippet box.";
        }
    }
}

async function executeEndpoint(method, rawPath) {
    const responseMeta = document.getElementById("responseMeta");
    const animeIdInput = document.getElementById("endpointAnimeId");
    const endpointBody = document.getElementById("endpointBody");
    const endpointFile = document.getElementById("endpointFile");
    const selectedFile = endpointFile && endpointFile.files ? endpointFile.files[0] : null;

    const result = await runEndpointRequest({
        method,
        rawPath,
        animeId: animeIdInput && animeIdInput.value ? animeIdInput.value : "1",
        endpointBodyValue: endpointBody ? endpointBody.value : "",
        selectedFile,
        autoFillBody: true,
    });

    if (result.clientError) {
        renderResponse({ error: result.clientError.message, hint: result.clientError.hint || "" });
        responseMeta.textContent = result.clientError.meta;
        return;
    }

    if (result.error) {
        responseMeta.textContent = `${method} ${result.targetUrl} failed`;
        renderResponse({ error: "Request failed", detail: result.error });
        updateUsageMetrics({ path: rawPath, ok: false });
        recordMissionActivity(`${method} ${rawPath} failed`, String(result.error), "error");
        return;
    }

    try {
        responseMeta.textContent = `${method} ${result.targetUrl} • ${result.status} ${result.statusText} • ${result.elapsedMs} ms`;
        renderResponse(result.payload);
        updateUsageMetrics({ path: rawPath, ok: result.ok });
        recordMissionActivity(
            `${method} ${rawPath}`,
            `${result.status} ${result.statusText} in ${result.elapsedMs} ms`,
            result.ok ? "success" : "error"
        );
        markChecklistStep("endpoint");
    } catch (_err) {
        // No-op because request errors are handled by runEndpointRequest.
    }
}

async function runEndpointRequest({
    method,
    rawPath,
    animeId = "1",
    endpointBodyValue = "",
    selectedFile = null,
    autoFillBody = false,
}) {
    let path = String(rawPath || "");

    if (path.includes(":id")) {
        path = path.replace(":id", String(animeId || "1"));
    }

    const normalizedMethod = String(method || "GET").toUpperCase();
    const isMultipartRoute = isMultipartUploadRoute(path, normalizedMethod);
    const usesJsonBody = methodSupportsJsonBody(normalizedMethod) && !isMultipartRoute;
    const options = { method: normalizedMethod };

    if (isMultipartRoute) {
        if (!selectedFile) {
            return {
                clientError: {
                    message: "Image file is required for this endpoint.",
                    hint: "Choose a file in File Upload, then run endpoint again.",
                    meta: `Missing file for ${normalizedMethod} ${path}`,
                },
            };
        }

        const formData = new FormData();
        formData.append("image", selectedFile);
        options.body = formData;
    }

    if (usesJsonBody) {
        let bodyText = String(endpointBodyValue || "").trim();
        if (!bodyText && autoFillBody) {
            const sample = getDefaultSnippetBodyForPath(path);
            bodyText = JSON.stringify(sample, null, 2);
            const endpointBody = document.getElementById("endpointBody");
            if (endpointBody) {
                endpointBody.value = bodyText;
            }
        }

        try {
            const parsed = JSON.parse(bodyText);
            options.headers = {
                "Content-Type": "application/json",
            };
            options.body = JSON.stringify(parsed);
        } catch (_err) {
            return {
                clientError: {
                    message: "JSON body is invalid. Please fix and try again.",
                    hint: "Ensure the body is valid JSON.",
                    meta: `Invalid JSON for ${normalizedMethod} ${path}`,
                },
            };
        }
    }

    const started = performance.now();
    const targetUrl = buildApiUrl(path);

    try {
        const response = await fetch(targetUrl, options);
        const elapsedMs = Math.round(performance.now() - started);
        const contentType = response.headers.get("content-type") || "";

        let payload;
        if (contentType.includes("application/json")) {
            payload = await response.json();
        } else {
            payload = { raw: await response.text() };
        }

        return {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            elapsedMs,
            targetUrl,
            payload,
            path,
        };
    } catch (err) {
        return {
            ok: false,
            error: String(err.message || err),
            elapsedMs: Math.round(performance.now() - started),
            targetUrl,
            path,
        };
    }
}

function fillSampleBody() {
    const endpointSelect = document.getElementById("endpointSelect");
    if (!endpointSelect || !endpointSelect.value) {
        document.getElementById("endpointBody").value = JSON.stringify(DEFAULT_FEEDBACK_BODY, null, 2);
        return;
    }

    const [method, path] = endpointSelect.value.split("|");
    fillSampleBodyForEndpoint(path, String(method || "GET").toUpperCase());
}

function fillSampleBodyForEndpoint(path = "", method = "POST") {
    const endpointBody = document.getElementById("endpointBody");
    if (!endpointBody) {
        return;
    }

    const normalizedPath = String(path || "");
    const normalizedMethod = String(method || "POST").toUpperCase();

    if (!methodSupportsJsonBody(normalizedMethod) || isMultipartUploadRoute(normalizedPath, normalizedMethod)) {
        endpointBody.value = "";
        return;
    }

    if (
        normalizedPath === "/api/anime" ||
        normalizedPath === "/add" ||
        normalizedPath === "/post" ||
        normalizedPath === "/create" ||
        normalizedPath === "/new" ||
        normalizedPath.startsWith("/api/anime/")
    ) {
        endpointBody.value = JSON.stringify(DEFAULT_ANIME_BODY, null, 2);
        return;
    }

    if (normalizedPath === "/api/feedback") {
        endpointBody.value = JSON.stringify(DEFAULT_FEEDBACK_BODY, null, 2);
        return;
    }

    endpointBody.value = JSON.stringify(DEFAULT_FEEDBACK_BODY, null, 2);
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

function getPosterDomRefs(prefix) {
    return {
        fileInput: document.getElementById(`${prefix}AnimePosterFile`),
        pathInput: document.getElementById(`${prefix}AnimeImgName`),
        previewImage: document.getElementById(`${prefix}AnimePosterPreview`),
        previewPlaceholder: document.getElementById(`${prefix}AnimePosterPlaceholder`),
        fileLabel: document.getElementById(`${prefix}AnimePosterFileLabel`),
    };
}

function sanitizePosterFileName(fileName) {
    return String(fileName || "")
        .trim()
        .toLowerCase()
        .replace(/\.[a-z0-9]+$/i, "")
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 120);
}

function toUploadImagePath(fileName) {
    const extensionMatch = String(fileName || "").toLowerCase().match(/\.(avif|webp|png|jpe?g|gif)$/i);
    const extension = extensionMatch ? extensionMatch[0] : ".webp";
    const base = sanitizePosterFileName(fileName) || "anime-poster";
    return `images/uploads/${base}${extension}`;
}

function revokePosterPreviewObjectUrl(prefix) {
    const existingUrl = posterPreviewObjectUrls[prefix];
    if (!existingUrl) {
        return;
    }

    URL.revokeObjectURL(existingUrl);
    posterPreviewObjectUrls[prefix] = "";
}

function setPosterPreview(prefix, sourceUrl, isObjectUrl = false) {
    const { previewImage, previewPlaceholder } = getPosterDomRefs(prefix);
    if (!previewImage || !previewPlaceholder) {
        return;
    }

    if (!isObjectUrl) {
        revokePosterPreviewObjectUrl(prefix);
    }

    const safeUrl = String(sourceUrl || "").trim();
    if (!safeUrl) {
        previewImage.style.display = "none";
        previewImage.removeAttribute("src");
        previewPlaceholder.style.display = "flex";
        return;
    }

    previewImage.src = safeUrl;
    previewImage.style.display = "block";
    previewPlaceholder.style.display = "none";

    if (isObjectUrl) {
        revokePosterPreviewObjectUrl(prefix);
        posterPreviewObjectUrls[prefix] = safeUrl;
    }
}

function setPosterPreviewFromPath(prefix, imagePath) {
    const pathValue = String(imagePath || "").trim();
    if (!pathValue) {
        setPosterPreview(prefix, "");
        return;
    }

    const resolvedUrl = /^https?:\/\//i.test(pathValue) ? pathValue : buildApiUrl(pathValue);
    setPosterPreview(prefix, resolvedUrl);
}

function applyPosterSelection(prefix) {
    const { fileInput, pathInput, fileLabel } = getPosterDomRefs(prefix);
    if (!fileInput || !pathInput || !fileLabel) {
        return;
    }

    const selectedFile = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    if (!selectedFile) {
        if (prefix === "add") {
            pathInput.value = "";
            fileLabel.textContent = "No file selected";
            setPosterPreview("add", "");
            return;
        }

        fileLabel.textContent = "No new file selected (keeping current poster)";
        setPosterPreviewFromPath("edit", pathInput.value);
        return;
    }

    pathInput.value = toUploadImagePath(selectedFile.name);
    fileLabel.textContent = `Selected: ${selectedFile.name}`;
    const objectUrl = URL.createObjectURL(selectedFile);
    setPosterPreview(prefix, objectUrl, true);
}

function validateAnimePayload(payload) {
    const createYearMax = new Date().getFullYear() + 1;
    const errors = [];

    if (!payload.title || payload.title.length < 2 || payload.title.length > 120) {
        errors.push("Title must be 2-120 characters");
    }
    if (!payload.img_name || payload.img_name.length < 6 || payload.img_name.length > 512) {
        errors.push("Image path must be 6-512 characters");
    } else if (!/^(https?:\/\/[^\s]+|images\/[A-Za-z0-9_./-]+)$/i.test(payload.img_name)) {
        errors.push("Use a full URL or a relative path like images/your-poster.webp");
    }
    if (!payload.year || payload.year < 1960 || payload.year > createYearMax) {
        errors.push(`Year must be between 1960 and ${createYearMax}`);
    }
    if (!payload.genre || payload.genre.length < 2 || payload.genre.length > 80) {
        errors.push("Genre must be 2-80 characters");
    }
    if (!payload.synopsis || payload.synopsis.length < 20 || payload.synopsis.length > 1200) {
        errors.push("Synopsis must be 20-1200 characters");
    }
    if (!payload.studio || payload.studio.length < 2 || payload.studio.length > 90) {
        errors.push("Studio must be 2-90 characters");
    }
    if (!payload.episodes || payload.episodes < 1 || payload.episodes > 2500) {
        errors.push("Episodes must be between 1 and 2500");
    }

    return errors;
}

function buildAnimePayload(prefix) {
    const year = Number(document.getElementById(`${prefix}AnimeYear`).value);
    return {
        title: document.getElementById(`${prefix}AnimeTitle`).value.trim(),
        img_name: document.getElementById(`${prefix}AnimeImgName`).value.trim(),
        year,
        genre: document.getElementById(`${prefix}AnimeGenre`).value.trim(),
        synopsis: document.getElementById(`${prefix}AnimeSynopsis`).value.trim(),
        studio: document.getElementById(`${prefix}AnimeStudio`).value.trim(),
        episodes: Number(document.getElementById(`${prefix}AnimeEpisodes`).value),
        era: getEraLabelFromYear(year),
    };
}

function setFormStatus(metaElement, type, message) {
    if (!metaElement) {
        return;
    }

    if (type === "success") {
        metaElement.innerHTML = `<strong style="color: var(--color-success, #388e3c);">Success!</strong> ${escapeHtml(message)}`;
        return;
    }

    if (type === "error") {
        metaElement.innerHTML = `<strong style="color: var(--color-error, #d32f2f);">Error:</strong> ${escapeHtml(message)}`;
        return;
    }

    metaElement.textContent = message;
}

function setValidationErrors(metaElement, errors) {
    if (!metaElement) {
        return;
    }

    metaElement.innerHTML = `<strong style="color: var(--color-error, #d32f2f);">Validation Errors:</strong><ul style="margin-top: 0.5rem;"><li>${errors
        .map((item) => escapeHtml(item))
        .join("</li><li>")}</li></ul>`;
}

function populateManageAnimeSelects() {
    const editSelect = document.getElementById("editAnimeSelect");
    const deleteSelect = document.getElementById("deleteAnimeSelect");

    if (!editSelect || !deleteSelect) {
        return;
    }

    const previousEditValue = editSelect.value;
    const previousDeleteValue = deleteSelect.value;
    const animeById = [...state.anime]
        .filter((item) => Number.isInteger(Number(item._id)) && Number(item._id) > 0)
        .sort((left, right) => Number(left._id) - Number(right._id));

    const optionsHtml = animeById
        .map(
            (item) =>
                `<option value="${escapeHtml(String(item._id))}">#${escapeHtml(String(item._id))} - ${escapeHtml(
                    String(item.title || "Untitled")
                )}</option>`
        )
        .join("");

    const defaultOption = `<option value="">Choose an anime by ID and title</option>`;
    editSelect.innerHTML = `${defaultOption}${optionsHtml}`;
    deleteSelect.innerHTML = `${defaultOption}${optionsHtml}`;

    if (animeById.length === 0) {
        editSelect.value = "";
        deleteSelect.value = "";
        const editPathInput = document.getElementById("editAnimeImgName");
        if (editPathInput) {
            editPathInput.value = "";
        }
        const editPosterFileInput = document.getElementById("editAnimePosterFile");
        if (editPosterFileInput) {
            editPosterFileInput.value = "";
        }
        applyPosterSelection("edit");
        return;
    }

    const hasPreviousEdit = animeById.some((item) => String(item._id) === String(previousEditValue));
    const hasPreviousDelete = animeById.some((item) => String(item._id) === String(previousDeleteValue));

    editSelect.value = hasPreviousEdit ? String(previousEditValue) : String(animeById[0]._id);
    deleteSelect.value = hasPreviousDelete ? String(previousDeleteValue) : String(animeById[0]._id);

    populateEditAnimeFormFromSelection();
}

function populateEditAnimeFormFromSelection() {
    const editSelect = document.getElementById("editAnimeSelect");
    if (!editSelect || !editSelect.value) {
        return;
    }

    const id = Number(editSelect.value);
    const selected = state.anime.find((item) => Number(item._id) === id);
    if (!selected) {
        return;
    }

    document.getElementById("editAnimeTitle").value = String(selected.title || "");
    document.getElementById("editAnimeImgName").value = String(selected.img_name || "");
    document.getElementById("editAnimeYear").value = String(Number(selected.year) || "");
    document.getElementById("editAnimeGenre").value = String(selected.genre || "");
    document.getElementById("editAnimeSynopsis").value = String(selected.synopsis || "");
    document.getElementById("editAnimeStudio").value = String(selected.studio || "");
    document.getElementById("editAnimeEpisodes").value = String(Number(selected.episodes) || "");

    const editPosterFileInput = document.getElementById("editAnimePosterFile");
    if (editPosterFileInput) {
        editPosterFileInput.value = "";
    }
    applyPosterSelection("edit");
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

    const payload = buildAnimePayload("add");
    const validationErrors = validateAnimePayload(payload);

    if (validationErrors.length > 0) {
        setValidationErrors(metaDiv, validationErrors);
        return;
    }

    try {
        setFormStatus(metaDiv, "info", "Submitting...");
        responseDiv.style.display = "none";

        const { response, data, usedPath, triedPaths } = await submitAnimeWithFallback(payload);

        if (!response.ok) {
            const errorMsg = data.error || "Unknown error";
            const details = data.details && Array.isArray(data.details) ? data.details.join(", ") : "";
            const fullMsg = details ? `${errorMsg}: ${details}` : errorMsg;
            
            const triedText = Array.isArray(triedPaths) && triedPaths.length
                ? ` Tried: ${triedPaths.join(", ")}.`
                : "";
            setFormStatus(metaDiv, "error", `${fullMsg} (primary endpoint: ${usedPath}).${triedText}`);
            responseDiv.innerHTML = `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
            responseDiv.style.display = "block";
            return;
        }

        setFormStatus(metaDiv, "success", `New anime added with ID: ${data.data._id} via ${usedPath}`);
        responseDiv.innerHTML = `<pre>${escapeHtml(JSON.stringify(data.data, null, 2))}</pre>`;
        responseDiv.style.display = "block";
        form.reset();
        applyPosterSelection("add");
        updateUsageMetrics({ path: usedPath, ok: true });
        recordMissionActivity("Anime added", `Created via POST ${usedPath}`, "success");
        markChecklistStep("crud");
        await refreshAnimeData(`New anime added via POST ${usedPath}`);
    } catch (err) {
        console.error("Error adding anime:", err);
        const errorMsg = err.message || "Unknown error occurred";
        const fullErrorMsg = `${errorMsg}. Please ensure the backend server is running and at least one create endpoint is accessible: ${CREATE_ENDPOINT_CANDIDATES.join(", ")}.`;
        setFormStatus(metaDiv, "error", fullErrorMsg);
        updateUsageMetrics({ path: state.createEndpointPath, ok: false });
        recordMissionActivity("Add anime failed", fullErrorMsg, "error");
    }
}

async function submitEditAnimeForm() {
    const form = document.getElementById("editAnimeForm");
    const select = document.getElementById("editAnimeSelect");
    const responseDiv = document.getElementById("editAnimeResponse");
    const metaDiv = document.getElementById("editAnimeMeta");

    if (!select.value) {
        setFormStatus(metaDiv, "error", "Select an anime record to edit.");
        return;
    }

    if (!form.checkValidity()) {
        setFormStatus(metaDiv, "error", "Please fill all required fields with valid values.");
        return;
    }

    const payload = buildAnimePayload("edit");
    const validationErrors = validateAnimePayload(payload);
    if (validationErrors.length > 0) {
        setValidationErrors(metaDiv, validationErrors);
        return;
    }

    const id = Number(select.value);

    try {
        setFormStatus(metaDiv, "info", "Submitting update...");
        responseDiv.style.display = "none";

        const response = await fetch(buildApiUrl(`${EDIT_DELETE_API_BASE_PATH}/${id}`), {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => ({ error: "Invalid or non-JSON response" }));

        if (!response.ok) {
            const errorMsg = data.error || data.message || "Unknown error";
            const details = Array.isArray(data.details) ? data.details.join(", ") : "";
            setFormStatus(metaDiv, "error", details ? `${errorMsg}: ${details}` : errorMsg);
            responseDiv.innerHTML = `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
            responseDiv.style.display = "block";
            return;
        }

        setFormStatus(metaDiv, "success", `Anime #${id} updated successfully.`);
        responseDiv.innerHTML = `<pre>${escapeHtml(JSON.stringify(data.data || data, null, 2))}</pre>`;
        responseDiv.style.display = "block";
        updateUsageMetrics({ path: `${EDIT_DELETE_API_BASE_PATH}/:id`, ok: true });
        recordMissionActivity("Anime updated", `PUT ${EDIT_DELETE_API_BASE_PATH}/${id}`, "success");
        markChecklistStep("crud");
        await refreshAnimeData(`Anime #${id} updated via PUT ${EDIT_DELETE_API_BASE_PATH}/:id`);
        document.getElementById("editAnimeSelect").value = String(id);
        document.getElementById("deleteAnimeSelect").value = String(id);
    } catch (err) {
        console.error("Error updating anime:", err);
        setFormStatus(metaDiv, "error", err.message || "Failed to update anime record.");
        updateUsageMetrics({ path: `${EDIT_DELETE_API_BASE_PATH}/:id`, ok: false });
        recordMissionActivity("Edit anime failed", String(err.message || err), "error");
    }
}

async function submitDeleteAnimeForm() {
    const select = document.getElementById("deleteAnimeSelect");
    const responseDiv = document.getElementById("deleteAnimeResponse");
    const metaDiv = document.getElementById("deleteAnimeMeta");

    if (!select.value) {
        setFormStatus(metaDiv, "error", "Select an anime record to delete.");
        return;
    }

    const id = Number(select.value);
    const selectedAnime = state.anime.find((item) => Number(item._id) === id);
    const label = selectedAnime ? `${selectedAnime.title} (#${id})` : `#${id}`;

    const confirmed = window.confirm(`Delete ${label}? This action cannot be undone.`);
    if (!confirmed) {
        return;
    }

    try {
        setFormStatus(metaDiv, "info", "Deleting anime...");
        responseDiv.style.display = "none";

        const response = await fetch(buildApiUrl(`${EDIT_DELETE_API_BASE_PATH}/${id}`), {
            method: "DELETE",
        });
        const data = await response.json().catch(() => ({ error: "Invalid or non-JSON response" }));

        if (!response.ok) {
            const errorMsg = data.error || data.message || "Unknown error";
            setFormStatus(metaDiv, "error", errorMsg);
            responseDiv.innerHTML = `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
            responseDiv.style.display = "block";
            return;
        }

        setFormStatus(metaDiv, "success", `Anime ${label} deleted successfully.`);
        responseDiv.innerHTML = `<pre>${escapeHtml(JSON.stringify(data.data || data, null, 2))}</pre>`;
        responseDiv.style.display = "block";
        updateUsageMetrics({ path: `${EDIT_DELETE_API_BASE_PATH}/:id`, ok: true });
        recordMissionActivity("Anime deleted", `DELETE ${EDIT_DELETE_API_BASE_PATH}/${id}`, "success");
        markChecklistStep("crud");
        await refreshAnimeData(`Anime ${label} deleted via DELETE ${EDIT_DELETE_API_BASE_PATH}/:id`);
    } catch (err) {
        console.error("Error deleting anime:", err);
        setFormStatus(metaDiv, "error", err.message || "Failed to delete anime record.");
        updateUsageMetrics({ path: `${EDIT_DELETE_API_BASE_PATH}/:id`, ok: false });
        recordMissionActivity("Delete anime failed", String(err.message || err), "error");
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