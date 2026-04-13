#!/usr/bin/env node
const { startServer } = require("../app");

const PROD_BASE_URL = process.env.PROD_BASE_URL || "https://demo-backend-1-0t5d.onrender.com";
const REQUIRED_CREATE_PATHS = ["/api/anime", "/post", "/add", "/create", "/new"];

async function fetchRoutes(baseUrl) {
  const response = await fetch(`${baseUrl}/api/routes`);
  if (!response.ok) {
    throw new Error(`GET ${baseUrl}/api/routes failed with status ${response.status}`);
  }

  return response.json();
}

function extractPostPaths(routesPayload) {
  const routeList = Array.isArray(routesPayload.routes) ? routesPayload.routes : [];
  return routeList
    .filter((route) => route && route.method === "POST")
    .map((route) => String(route.path || ""))
    .filter(Boolean);
}

async function main() {
  const localServer = startServer(0);
  await new Promise((resolve) => localServer.once("listening", resolve));

  try {
    const localAddress = localServer.address();
    const localBaseUrl = `http://127.0.0.1:${localAddress.port}`;

    const [localRoutes, prodRoutes] = await Promise.all([
      fetchRoutes(localBaseUrl),
      fetchRoutes(PROD_BASE_URL),
    ]);

    const localPostPaths = extractPostPaths(localRoutes);
    const prodPostPaths = extractPostPaths(prodRoutes);
    const missingProdPaths = REQUIRED_CREATE_PATHS.filter((path) => !prodPostPaths.includes(path));

    console.log(`Local POST routes: ${localPostPaths.join(", ") || "none"}`);
    console.log(`Prod POST routes: ${prodPostPaths.join(", ") || "none"}`);

    if (missingProdPaths.length > 0) {
      console.error(`Missing on production: ${missingProdPaths.join(", ")}`);
      process.exitCode = 1;
      return;
    }

    console.log("Production exposes all expected create routes.");
  } finally {
    await new Promise((resolve, reject) => {
      localServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
