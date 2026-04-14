const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs/promises");
const path = require("path");

const { startServer } = require("../app");

let server;
let baseUrl;
const uploadedTestFiles = [];

test.before(async () => {
  server = startServer(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await Promise.all(
    uploadedTestFiles.map(async (filePath) => {
      try {
        await fs.unlink(filePath);
      } catch (_err) {
        // ignore cleanup failures for already-deleted files
      }
    })
  );

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

test("GET /get returns CORS headers for deployed frontend origin", async () => {
  const response = await fetch(`${baseUrl}/get`, {
    headers: {
      Origin: "https://itzjessie.github.io",
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://itzjessie.github.io");
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

test("POST /api/anime validates required fields", async () => {
  const response = await fetch(`${baseUrl}/api/anime`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: "New Anime" }),
  });

  assert.equal(response.status, 400);

  const data = await response.json();
  assert.equal(data.success, false);
  assert.equal(data.error, "Validation failed");
  assert.ok(Array.isArray(data.details));
  assert.ok(data.details.length > 0);
});

test("POST /api/anime adds a new anime record", async () => {
  const payload = {
    title: "Test Anime",
    img_name: "images/versions/anime/test-anime/test-anime-v0001.jpg",
    year: 2026,
    genre: "Action",
    synopsis: "A test-only anime created by integration tests and long enough for validation.",
    studio: "Test Studio",
    episodes: 12,
  };

  const response = await fetch(`${baseUrl}/api/anime`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  assert.equal(response.status, 201);

  const data = await response.json();
  assert.equal(data.success, true);
  assert.equal(data.data.title, payload.title);
  assert.equal(data.data.era, "2020s");
  assert.equal(typeof data.data.slug, "string");
  assert.equal(typeof data.data._id, "number");

  const fetchCreated = await fetch(`${baseUrl}/api/anime/${data.data._id}`);
  assert.equal(fetchCreated.status, 200);
});

test("POST /api/anime rejects invalid payload constraints", async () => {
  const payload = {
    title: "T",
    img_name: "bad-path",
    year: 2026,
    genre: "Action",
    synopsis: "Too short",
    studio: "Test Studio",
    episodes: 12,
  };

  const response = await fetch(`${baseUrl}/api/anime`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  assert.equal(response.status, 400);

  const data = await response.json();
  assert.equal(data.success, false);
  assert.equal(data.error, "Validation failed");
});

test("PUT /api/anime/:id validates required fields", async () => {
  const response = await fetch(`${baseUrl}/api/anime/1`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: "Updated" }),
  });

  assert.equal(response.status, 400);

  const data = await response.json();
  assert.equal(data.success, false);
  assert.equal(data.error, "Validation failed");
  assert.ok(Array.isArray(data.details));
  assert.ok(data.details.length > 0);
});

test("PUT /api/anime/:id updates an existing anime record", async () => {
  const createPayload = {
    title: "Put Target Anime",
    img_name: "images/versions/anime/put-target-anime/image.jpg",
    year: 2026,
    genre: "Action",
    synopsis: "This record is created to verify that the PUT endpoint updates an anime item.",
    studio: "Test Studio",
    episodes: 12,
  };

  const createResponse = await fetch(`${baseUrl}/api/anime`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(createPayload),
  });

  assert.equal(createResponse.status, 201);
  const created = await createResponse.json();

  const updatePayload = {
    title: "Put Target Anime Updated",
    img_name: "images/versions/anime/put-target-anime-updated/image.jpg",
    year: 2025,
    genre: "Sci-Fi",
    synopsis: "This updated record verifies the API can find a record by id and replace editable fields.",
    studio: "Update Studio",
    episodes: 24,
  };

  const updateResponse = await fetch(`${baseUrl}/api/anime/${created.data._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updatePayload),
  });

  assert.equal(updateResponse.status, 200);

  const updateData = await updateResponse.json();
  assert.equal(updateData.success, true);
  assert.equal(updateData.data._id, created.data._id);
  assert.equal(updateData.data.title, updatePayload.title);
  assert.equal(updateData.data.episodes, updatePayload.episodes);
  assert.equal(updateData.data.era, "2020s");
});

test("PUT /api/anime/:id updates image when file is provided", async () => {
  const createPayload = {
    title: "Put With File Target",
    img_name: "images/versions/anime/put-with-file-target/image.jpg",
    year: 2026,
    genre: "Action",
    synopsis: "This record verifies multipart PUT updates and image path replacement.",
    studio: "File Studio",
    episodes: 11,
  };

  const createResponse = await fetch(`${baseUrl}/api/anime`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(createPayload),
  });

  assert.equal(createResponse.status, 201);
  const created = await createResponse.json();

  const formData = new FormData();
  formData.append("title", "Put With File Updated");
  formData.append("year", "2026");
  formData.append("genre", "Adventure");
  formData.append(
    "synopsis",
    "This updated record includes a multipart image upload and validates image replacement."
  );
  formData.append("studio", "File Studio Updated");
  formData.append("episodes", "22");
  formData.append("image", new Blob(["updated-image-content"], { type: "image/png" }), "updated-put.png");

  const updateResponse = await fetch(`${baseUrl}/api/anime/${created.data._id}`, {
    method: "PUT",
    body: formData,
  });

  assert.equal(updateResponse.status, 200);

  const updateData = await updateResponse.json();
  assert.equal(updateData.success, true);
  assert.equal(updateData.data._id, created.data._id);
  assert.match(updateData.data.img_name, /^images\/uploads\//);

  const uploadedPath = path.join(__dirname, "..", "public", updateData.data.img_name);
  uploadedTestFiles.push(uploadedPath);

  const servedResponse = await fetch(`${baseUrl}/${updateData.data.img_name}`);
  assert.equal(servedResponse.status, 200);
});

test("DELETE /api/anime/:id deletes an existing anime record", async () => {
  const createPayload = {
    title: "Delete Target Anime",
    img_name: "images/versions/anime/delete-target-anime/image.jpg",
    year: 2026,
    genre: "Action",
    synopsis: "This record is created to verify that the DELETE endpoint removes an anime item.",
    studio: "Delete Studio",
    episodes: 13,
  };

  const createResponse = await fetch(`${baseUrl}/api/anime`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(createPayload),
  });

  assert.equal(createResponse.status, 201);
  const created = await createResponse.json();

  const deleteResponse = await fetch(`${baseUrl}/api/anime/${created.data._id}`, {
    method: "DELETE",
  });

  assert.equal(deleteResponse.status, 200);
  const deleteData = await deleteResponse.json();
  assert.equal(deleteData.success, true);
  assert.equal(deleteData.data._id, created.data._id);

  const fetchDeleted = await fetch(`${baseUrl}/api/anime/${created.data._id}`);
  assert.equal(fetchDeleted.status, 404);
});

test("DELETE /api/anime/:id returns 404 for missing record", async () => {
  const response = await fetch(`${baseUrl}/api/anime/999999`, {
    method: "DELETE",
  });

  assert.equal(response.status, 404);

  const data = await response.json();
  assert.equal(data.success, false);
  assert.equal(data.error, "Anime not found");
});

test("POST /add creates anime using React create alias", async () => {
  const payload = {
    title: "Test Create Alias",
    img_name: "images/versions/anime/test-uppercase/image.jpg",
    year: 2026,
    genre: "Action",
    synopsis: "Testing create aliases that React uses for backend create requests.",
    studio: "Test Studio",
    episodes: 12,
  };

  const response = await fetch(`${baseUrl}/add`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  assert.equal(response.status, 201);

  const data = await response.json();
  assert.equal(data.success, true);
  assert.equal(data.data.title, payload.title);
  assert.equal(typeof data.data.slug, "string");
});

test("POST /post creates anime using compatibility alias", async () => {
  const payload = {
    title: "Test Post Alias",
    img_name: "images/versions/anime/test-post-alias/image.jpg",
    year: 2026,
    genre: "Action",
    synopsis: "Testing the /post compatibility alias for anime creation.",
    studio: "Test Studio",
    episodes: 12,
  };

  const response = await fetch(`${baseUrl}/post`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  assert.equal(response.status, 201);

  const data = await response.json();
  assert.equal(data.success, true);
  assert.equal(data.data.title, payload.title);
  assert.equal(typeof data.data.slug, "string");
});

test("POST /create alias is reachable", async () => {
  const response = await fetch(`${baseUrl}/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: "x" }),
  });

  assert.equal(response.status, 400);
});

test("POST /new alias is reachable", async () => {
  const response = await fetch(`${baseUrl}/new`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: "x" }),
  });

  assert.equal(response.status, 400);
});

test("POST /api/upload-image uploads an image", async () => {
  const formData = new FormData();
  formData.append("image", new Blob(["fake-image-content"], { type: "image/png" }), "test-upload.png");

  const response = await fetch(`${baseUrl}/api/upload-image`, {
    method: "POST",
    body: formData,
  });

  assert.equal(response.status, 201);

  const data = await response.json();
  assert.equal(data.success, true);
  assert.equal(data.message, "Image uploaded successfully");
  assert.equal(data.file.mimetype, "image/png");
  assert.match(data.file.path, /^images\/uploads\//);

  const uploadedPath = path.join(__dirname, "..", "public", data.file.path);
  uploadedTestFiles.push(uploadedPath);

  const servedResponse = await fetch(`${baseUrl}/${data.file.path}`);
  assert.equal(servedResponse.status, 200);
});

test("POST /api/upload-image returns 400 when no file is provided", async () => {
  const response = await fetch(`${baseUrl}/api/upload-image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  assert.equal(response.status, 400);

  const data = await response.json();
  assert.equal(data.success, false);
  assert.equal(data.error, "No image file uploaded");
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
