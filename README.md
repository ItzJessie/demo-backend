# Japanese Animation History Archive Backend API

Express-based backend for the Anime Archive project. It serves the anime dataset, studio and creator metadata, feedback storage, image uploads, and a route catalog used by the tests and frontend.

## Overview

The app starts from `index.js` and `server.js`, both of which load the shared server implementation in `app.js`. The server serves static files from `public/` and exposes JSON APIs under `/api`.

Important runtime note:

- Anime create/update/delete changes are applied in memory for the current process and are **not** persisted back to `data/animeSeries.json`.
- Feedback submissions are persisted to local JSON files under `feedbacks/`.

## Requirements

- Node.js 18 or newer
- npm

## Install and run

```bash
npm install
npm start
```

By default the server listens on port `3001`. You can override it with `PORT`.

Expected startup output:

```text
Anime Archive Backend Server is running on http://localhost:3001
```

Open `http://localhost:3001` to load the static frontend from `public/index.html`.

## Environment variables

Create a `.env` file in the project root if you need to customize runtime behavior.

```env
PORT=3001
FRONTEND_ORIGIN=https://itzjessie.github.io
FRONTEND_ORIGINS=https://itzjessie.github.io,https://www.itzjessie.github.io
STUDIOS_CREATORS_FILE=/absolute/path/to/studiosCreators.json
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/?retryWrites=true&w=majority
MONGODB_DB=anime_archive
MONGODB_COLLECTION=feedbacks
```

Notes:

- `FRONTEND_ORIGIN` and `FRONTEND_ORIGINS` extend the CORS allowlist.
- In non-production mode, localhost, private-network, and `.local` origins are also allowed for cross-device testing.
- If `MONGODB_URI` is set, feedback is also inserted into the configured MongoDB collection.
- If `STUDIOS_CREATORS_FILE` is set, the studios/creators endpoint reads from that file instead of `data/studiosCreators.json`.

## API

### Health

```http
GET /api/health
```

Returns server status and whether MongoDB is configured.

### Route catalog

```http
GET /api/routes
```

Returns the list of available API routes.

### Anime data

```http
GET /api/anime
GET /get
```

Returns the full anime list from `data/animeSeries.json`.

```http
GET /api/anime/:id
```

Returns one anime record by numeric `_id`.

Example:

```bash
curl http://localhost:3001/api/anime/1
```

### Create, update, delete anime

```http
POST /api/anime
POST /add
POST /post
POST /create
POST /new
PUT /api/anime/:id
DELETE /api/anime/:id
```

Create and update requests are validated with Joi. Required fields are:

- `title`
- `img_name`
- `year`
- `genre`
- `synopsis`
- `studio`
- `episodes`

Optional fields:

- `era`
- `slug`

Behavior:

- `era` is auto-derived from `year` when omitted.
- `slug` is auto-generated from `title` and `year` when omitted.
- Duplicate title/year or duplicate slug records are rejected.
- `PUT /api/anime/:id` accepts regular JSON or multipart form data with an `image` file field.
- Uploaded images are stored under `public/images/uploads` and returned as `images/uploads/<filename>`.

Example create request:

```bash
curl -X POST http://localhost:3001/api/anime \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Anime",
    "img_name": "images/versions/anime/test-anime/test-anime-v0001.jpg",
    "year": 2026,
    "genre": "Action",
    "synopsis": "A test-only anime created for validation.",
    "studio": "Test Studio",
    "episodes": 12
  }'
```

### Image upload

```http
POST /api/upload-image
```

Uploads a single image file using multipart form data with the field name `image`.

Upload rules:

- Max file size: 5MB
- Allowed types: `image/*`
- Stored location: `public/images/uploads`

### Studios and creators

```http
GET /api/studios-creators
```

Returns the `studios` and `creators` arrays from the configured JSON file.

### Feedback

```http
POST /api/feedback
GET /api/feedback
```

Feedback requires `name`, `email`, and `satisfaction`. The server stores each submission locally in `feedbacks/feedback_<timestamp>.json` and, if MongoDB is configured, also inserts it into the configured Atlas collection.

Example response:

```json
{
  "message": "Feedback submitted successfully",
  "id": "1774967773042",
  "insertedToMongo": false,
  "atlasLocation": null
}
```

## Data shape

Anime records in `data/animeSeries.json` use this structure:

```json
{
  "_id": 1,
  "title": "Fullmetal Alchemist",
  "img_name": "images/versions/anime/fullmetal-alchemist-1/fullmetal-alchemist-1-v0002.jpg",
  "year": 2003,
  "era": "2000s",
  "genre": "Action, Adventure, Dark Fantasy",
  "synopsis": "Brothers search for redemption after a failed human transmutation shatters their bodies.",
  "studio": "Bones",
  "episodes": 51,
  "slug": "fullmetal-alchemist-1"
}
```

## Scripts

```bash
npm run <script>
```

Available scripts:

- `start`: start the backend server (`node index.js`)
- `test`: run the Node test suite (`node --test`)
- `verify`: run tests plus image verification
- `verify:images`: validate anime image paths against files in `public/images`
- `verify:routes`: validate route coverage for create endpoints
- `dedupe:image-refs`: deduplicate anime image references
- `sync:images`: synchronize image assets
- `repair:anime-covers`: repair anime cover images
- `repair:creator-images`: repair creator image assets
- `image-remap`: remap image references
- `deploy`: push `main` to origin

## Verification and tests

```bash
npm test
npm run verify:images
npm run verify:routes
```

What these do:

- `npm test` runs the Node test suite in `test/api.test.js`.
- `npm run verify:images` checks anime image references against files in `public/images`.
- `npm run verify:routes` validates the create-endpoint coverage used by the repo scripts.

## Security and platform behavior

- CORS is enabled with an allowlist that includes deployed frontend origins plus development-safe local origins.
- Static assets are served from `public/`.
- Request parsing limits are configured at `10mb` for JSON and URL-encoded bodies.
- Responses include hardening headers such as `X-Content-Type-Options`, `X-Frame-Options`, and `X-XSS-Protection`.

## Project structure

```text
demo-backend/
├── app.js
├── index.js
├── server.js
├── package.json
├── data/
├── feedbacks/
├── public/
└── scripts/
```

## Operational notes

- The server enables CORS for the local frontend and the deployed GitHub Pages origin.
- Static assets are served from `public/`.
- Feedback remains available locally even when MongoDB is not configured.
- Anime record edits are process-local and reset when the server restarts.
- The API returns JSON errors for validation failures, missing anime records, and storage issues.

## Support

If something is not working, verify:

1. `node --version`
2. `npm install`
3. `npm test`
4. `npm run verify:images`
5. `lsof -i :3001`
