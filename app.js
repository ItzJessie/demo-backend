const express = require("express");
const cors = require("cors");
const path = require("path");
const fsSync = require("fs");
const fs = require("fs/promises");
const { MongoClient } = require("mongodb");
const Joi = require("joi");
const multer = require("multer");

require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const FEEDBACK_DIR = path.join(__dirname, "feedbacks");
const ANIME_FILE = path.join(__dirname, "data", "animeSeries.json");
const UPLOADS_DIR = path.join(__dirname, "public", "images", "uploads");
const STUDIOS_CREATORS_FILE =
  process.env.STUDIOS_CREATORS_FILE || path.join(__dirname, "data", "studiosCreators.json");

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "anime_archive";
const MONGODB_COLLECTION = process.env.MONGODB_COLLECTION || "feedbacks";
const MAX_CREATE_YEAR = new Date().getFullYear() + 1;

function normalizeOrigin(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "")
    .toLowerCase();
}

const FRONTEND_ORIGINS = new Set([
  normalizeOrigin("https://itzjessie.github.io"),
  normalizeOrigin("https://www.itzjessie.github.io"),
  normalizeOrigin("http://localhost:3000"),
  normalizeOrigin("http://localhost:5173"),
]);

if (process.env.FRONTEND_ORIGIN) {
  FRONTEND_ORIGINS.add(normalizeOrigin(process.env.FRONTEND_ORIGIN));
}

if (process.env.FRONTEND_ORIGINS) {
  process.env.FRONTEND_ORIGINS.split(",")
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean)
    .forEach((origin) => FRONTEND_ORIGINS.add(origin));
}

fsSync.mkdirSync(UPLOADS_DIR, { recursive: true });

let mongoClient;
let mongoCollection;
let animeListCache = null;

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const originalName = String(file.originalname || "upload").toLowerCase();
    const extension = path.extname(originalName) || ".jpg";
    const baseName = path
      .basename(originalName, extension)
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${baseName || "image"}-${uniqueSuffix}${extension}`);
  },
});

const uploadImage = multer({
  storage: uploadStorage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (String(file.mimetype || "").startsWith("image/")) {
      cb(null, true);
      return;
    }

    cb(new Error("Only image files are allowed"));
  },
});

const animeCreateSchema = Joi.object({
  title: Joi.string().trim().min(2).max(120).required(),
  img_name: Joi.string()
    .trim()
    .min(6)
    .max(512)
    .pattern(/^(https?:\/\/[^\s]+|images\/[A-Za-z0-9_./-]+)$/i)
    .required(),
  year: Joi.number().integer().min(1960).max(MAX_CREATE_YEAR).required(),
  era: Joi.string().trim().valid("1980s", "1990s", "2000s", "2010s", "2020s").optional(),
  genre: Joi.string().trim().min(2).max(80).required(),
  synopsis: Joi.string().trim().min(20).max(1200).required(),
  studio: Joi.string().trim().min(2).max(90).required(),
  episodes: Joi.number().integer().min(1).max(2500).required(),
  slug: Joi.string().trim().lowercase().pattern(/^[a-z0-9\-]+$/).min(1).max(200).optional(),
});

function getEraLabel(year) {
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

function toSlug(title) {
  return String(title || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function ensureMongoCollection() {
  if (!MONGODB_URI) {
    return null;
  }

  if (!mongoCollection) {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    mongoCollection = mongoClient.db(MONGODB_DB).collection(MONGODB_COLLECTION);
    console.log(`Connected to Atlas collection ${MONGODB_DB}.${MONGODB_COLLECTION}`);
  }

  return mongoCollection;
}

async function saveFeedbackToLocalFile(feedback) {
  await fs.mkdir(FEEDBACK_DIR, { recursive: true });
  const filePath = path.join(FEEDBACK_DIR, `feedback_${feedback.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(feedback, null, 2), "utf8");
}

async function getLocalFeedback() {
  try {
    const files = await fs.readdir(FEEDBACK_DIR);
    const feedbackFiles = files.filter((name) => /^feedback_\d+\.json$/.test(name));
    const records = await Promise.all(
      feedbackFiles.map(async (name) => {
        const raw = await fs.readFile(path.join(FEEDBACK_DIR, name), "utf8");
        return JSON.parse(raw);
      })
    );

    return records.sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
  } catch (err) {
    if (err.code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

async function loadAnimeList() {
  const raw = await fs.readFile(ANIME_FILE, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("Anime data file is not an array");
  }

  return parsed;
}

async function getAnimeList() {
  if (!animeListCache) {
    animeListCache = await loadAnimeList();
  }

  return animeListCache;
}

async function loadStudiosCreators() {
  const raw = await fs.readFile(STUDIOS_CREATORS_FILE, "utf8");
  const parsed = JSON.parse(raw);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Studios/creators data file must be a JSON object");
  }

  if (!Array.isArray(parsed.studios) || !Array.isArray(parsed.creators)) {
    throw new Error("Studios/creators data file must include studios[] and creators[]");
  }

  return parsed;
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (FRONTEND_ORIGINS.has(normalizeOrigin(origin))) {
      callback(null, true);
      return;
    }

    callback(new Error("Origin not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

async function handleAnimeRequest(_req, res) {
  try {
    const animeList = await getAnimeList();
    res.json(animeList);
  } catch (err) {
    console.error("Error loading anime data", err);
    res.status(500).json({ error: "Failed to load anime records" });
  }
}

app.get("/api/anime", async (_req, res) => {
  await handleAnimeRequest(_req, res);
});

app.get("/get", async (_req, res) => {
  await handleAnimeRequest(_req, res);
});

app.get("/api/studios-creators", async (_req, res) => {
  try {
    const studiosCreators = await loadStudiosCreators();
    res.json(studiosCreators);
  } catch (err) {
    console.error("Error loading studios/creators data", err);
    res.status(500).json({ error: "Failed to load studios/creators records" });
  }
});

app.get("/api/routes", (_req, res) => {
  res.json({
    name: "Anime Archive Backend API",
    version: "1.0.0",
    routes: [
      {
        method: "GET",
        path: "/api/anime",
        description: "Get all anime records",
      },
      {
        method: "GET",
        path: "/get",
        description: "Alias for getting all anime records",
      },
      {
        method: "GET",
        path: "/api/studios-creators",
        description: "Get studios and creators records",
      },
      {
        method: "GET",
        path: "/api/anime/:id",
        description: "Get a single anime by numeric id",
      },
      {
        method: "POST",
        path: "/api/anime",
        description: "Validate and add a new anime record",
      },
      {
        method: "PUT",
        path: "/api/anime/:id",
        description: "Validate and update an existing anime record by numeric id",
      },
      {
        method: "DELETE",
        path: "/api/anime/:id",
        description: "Delete an anime record by numeric id",
      },
      {
        method: "POST",
        path: "/api/upload-image",
        description: "Upload an image file and store it under public/images/uploads",
      },
      {
        method: "POST",
        path: "/add",
        description: "Create alias for anime record insert",
      },
      {
        method: "POST",
        path: "/post",
        description: "Create alias for anime record insert",
      },
      {
        method: "POST",
        path: "/create",
        description: "Create alias for anime record insert",
      },
      {
        method: "POST",
        path: "/new",
        description: "Create alias for anime record insert",
      },
      {
        method: "POST",
        path: "/api/feedback",
        description: "Submit feedback",
      },
      {
        method: "GET",
        path: "/api/feedback",
        description: "Read all feedback submitted to local storage",
      },
      {
        method: "GET",
        path: "/api/health",
        description: "Health and MongoDB configuration status",
      },
      {
        method: "GET",
        path: "/api/routes",
        description: "List all available API requests",
      },
    ],
  });
});

app.get("/api/anime/:id", async (req, res) => {
  try {
    const animeList = await getAnimeList();
    const id = Number(req.params.id);
    const anime = animeList.find((item) => item._id === id);

    if (!anime) {
      return res.status(404).json({ error: "Anime not found" });
    }

    return res.json(anime);
  } catch (err) {
    console.error("Error loading anime data", err);
    return res.status(500).json({ error: "Failed to load anime records" });
  }
});

async function handleAnimeCreate(req, res) {
  const { error, value } = animeCreateSchema.validate(req.body || {}, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: error.details.map((item) => item.message),
    });
  }

  try {
    const animeList = await getAnimeList();
    const resolvedSlug = value.slug || `${toSlug(value.title)}-${value.year}`;
    const resolvedEra = value.era || getEraLabel(value.year);

    const duplicate = animeList.some(
      (item) =>
        String(item.slug || "").toLowerCase() === resolvedSlug.toLowerCase() ||
        (String(item.title || "").toLowerCase() === String(value.title).toLowerCase() &&
          Number(item.year) === Number(value.year))
    );

    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: "Anime record already exists",
      });
    }

    const nextId = animeList.reduce((maxId, item) => {
      const currentId = Number(item._id) || 0;
      return currentId > maxId ? currentId : maxId;
    }, 0) + 1;

    const newAnime = {
      _id: nextId,
      ...value,
      era: resolvedEra,
      slug: resolvedSlug,
    };

    animeList.push(newAnime);

    return res.status(201).json({
      success: true,
      message: "Anime added successfully",
      data: newAnime,
    });
  } catch (err) {
    console.error("Error adding anime", err);
    return res.status(500).json({
      success: false,
      error: "Failed to add anime record",
    });
  }
}

app.post("/api/anime", handleAnimeCreate);
app.post("/add", handleAnimeCreate);
app.post("/post", handleAnimeCreate);
app.post("/create", handleAnimeCreate);
app.post("/new", handleAnimeCreate);

app.put("/api/anime/:id", (req, res) => {
  uploadImage.single("image")(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        error: err.code === "LIMIT_FILE_SIZE" ? "Image must be 5MB or less" : err.message,
      });
    }

    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid anime id",
      });
    }

    const payload = {
      ...(req.body || {}),
    };

    if (req.file) {
      payload.img_name = `images/uploads/${req.file.filename}`;
    }

    const { error, value } = animeCreateSchema.validate(payload, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.details.map((item) => item.message),
      });
    }

    try {
      const animeList = await getAnimeList();
      const animeIndex = animeList.findIndex((item) => Number(item._id) === id);

      if (animeIndex === -1) {
        return res.status(404).json({
          success: false,
          error: "Anime not found",
        });
      }

      const resolvedSlug = value.slug || `${toSlug(value.title)}-${value.year}`;
      const resolvedEra = value.era || getEraLabel(value.year);

      const duplicate = animeList.some(
        (item, index) =>
          index !== animeIndex &&
          (String(item.slug || "").toLowerCase() === resolvedSlug.toLowerCase() ||
            (String(item.title || "").toLowerCase() === String(value.title).toLowerCase() &&
              Number(item.year) === Number(value.year)))
      );

      if (duplicate) {
        return res.status(409).json({
          success: false,
          error: "Anime record already exists",
        });
      }

      const existingAnime = animeList[animeIndex];
      const updatedAnime = {
        ...existingAnime,
        ...value,
        era: resolvedEra,
        slug: resolvedSlug,
        _id: existingAnime._id,
      };

      animeList[animeIndex] = updatedAnime;

      return res.status(200).json({
        success: true,
        message: "Anime updated successfully",
        data: updatedAnime,
      });
    } catch (updateErr) {
      console.error("Error updating anime", updateErr);
      return res.status(500).json({
        success: false,
        error: "Failed to update anime record",
      });
    }
  });
});

app.delete("/api/anime/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid anime id",
    });
  }

  try {
    const animeList = await getAnimeList();
    const animeIndex = animeList.findIndex((item) => Number(item._id) === id);

    if (animeIndex === -1) {
      return res.status(404).json({
        success: false,
        error: "Anime not found",
      });
    }

    const deletedAnime = animeList[animeIndex];
    animeList.splice(animeIndex, 1);

    return res.json({
      success: true,
      message: "Anime deleted successfully",
      data: deletedAnime,
    });
  } catch (err) {
    console.error("Error deleting anime", err);
    return res.status(500).json({
      success: false,
      error: "Failed to delete anime record",
    });
  }
});

app.post("/api/upload-image", (req, res) => {
  uploadImage.single("image")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        error: err.code === "LIMIT_FILE_SIZE" ? "Image must be 5MB or less" : err.message,
      });
    }

    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: "No image file uploaded" });
    }

    const storedPath = `images/uploads/${req.file.filename}`;
    return res.status(201).json({
      success: true,
      message: "Image uploaded successfully",
      file: {
        filename: req.file.filename,
        path: storedPath,
        url: `/${storedPath}`,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
    });
  });
});

app.post("/api/feedback", async (req, res) => {
  const payload = req.body || {};
  const feedback = {
    id: String(Date.now()),
    name: payload.name || "",
    email: payload.email || "",
    phone: payload.phone || "",
    age: payload.age || "",
    satisfaction: payload.satisfaction || "",
    rating: payload.rating || "",
    comments: payload.comments || "",
    submittedAt: new Date().toISOString(),
  };

  if (!feedback.name || !feedback.email || !feedback.satisfaction) {
    return res.status(400).json({ error: "name, email, and satisfaction are required" });
  }

  try {
    await saveFeedbackToLocalFile(feedback);

    let insertedToMongo = false;
    const collection = await ensureMongoCollection();
    if (collection) {
      await collection.insertOne(feedback);
      insertedToMongo = true;
    }

    return res.status(201).json({
      message: "Feedback submitted successfully",
      id: feedback.id,
      insertedToMongo,
      atlasLocation: insertedToMongo ? `${MONGODB_DB}.${MONGODB_COLLECTION}` : null,
    });
  } catch (err) {
    console.error("Error saving feedback", err);
    return res.status(500).json({ error: "Failed to save feedback" });
  }
});

app.get("/api/feedback", async (_req, res) => {
  try {
    const feedback = await getLocalFeedback();
    res.json(feedback);
  } catch (err) {
    console.error("Error reading feedback", err);
    res.status(500).json({ error: "Failed to read feedback" });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    mongodbConfigured: Boolean(MONGODB_URI),
    atlasTarget: MONGODB_URI ? `${MONGODB_DB}.${MONGODB_COLLECTION}` : null,
  });
});

let hasSignalHandler = false;

function registerSignalHandler() {
  if (hasSignalHandler) {
    return;
  }

  process.on("SIGINT", async () => {
    if (mongoClient) {
      await mongoClient.close();
    }
    process.exit(0);
  });

  hasSignalHandler = true;
}

function startServer(port = PORT) {
  registerSignalHandler();
  const server = app.listen(port, () => {
    console.log(`Anime Archive Backend Server is running on http://localhost:${port}`);
    if (!MONGODB_URI) {
      console.log("MONGODB_URI not set. Feedback will still save locally under /feedbacks.");
    }
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer,
};