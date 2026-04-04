const test = require("node:test");
const assert = require("node:assert/strict");

const { startServer } = require("../app");

let server;
let baseUrl;

test.before(async () => {
  server = startServer(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (!server) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});

test("GET /api/routes returns route metadata", async () => {
  const response = await fetch(`${baseUrl}/api/routes`);
  assert.equal(response.status, 200);

  const data = await response.json();
  assert.ok(Array.isArray(data.routes));
  assert.ok(data.routes.length >= 6);
});

test("GET /api/anime returns data", async () => {
  const response = await fetch(`${baseUrl}/api/anime`);
  assert.equal(response.status, 200);

  const data = await response.json();
  assert.ok(Array.isArray(data));
  assert.ok(data.length > 0);
  assert.equal(typeof data[0]._id, "number");
});

test("GET /api/studios-creators returns arrays", async () => {
  const response = await fetch(`${baseUrl}/api/studios-creators`);
  assert.equal(response.status, 200);

  const data = await response.json();
  assert.ok(Array.isArray(data.studios));
  assert.ok(Array.isArray(data.creators));
});

test("GET /api/anime/:id returns 404 for missing record", async () => {
  const response = await fetch(`${baseUrl}/api/anime/999999`);
  assert.equal(response.status, 404);
});

test("POST /api/feedback validates required fields", async () => {
  const response = await fetch(`${baseUrl}/api/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "Jessie" }),
  });

  assert.equal(response.status, 400);
});

test("GET /api/health returns health payload", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);

  const data = await response.json();
  assert.equal(data.status, "ok");
});
