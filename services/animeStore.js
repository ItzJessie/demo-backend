const fs = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");
const { Anime, AnimeCounter } = require("../models/anime");

const ANIME_FILE = path.join(__dirname, "..", "data", "animeSeries.json");
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "anime_archive";

let localAnimeCache = null;
let seedCache = null;
let connectPromise = null;
let seedPromise = null;
let primePromise = null;

function cloneRecord(record) {
  if (!record) {
    return null;
  }

  return JSON.parse(JSON.stringify(record));
}

function normalizeString(value) {
  return String(value || "").trim();
}

function toSlug(title) {
  return normalizeString(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

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

function buildAnimeRecord(id, payload) {
  const year = Number(payload.year);
  const slug = normalizeString(payload.slug) || `${toSlug(payload.title)}-${year}`;

  return {
    _id: id,
    title: normalizeString(payload.title),
    img_name: normalizeString(payload.img_name),
    year,
    era: normalizeString(payload.era) || getEraLabel(year),
    genre: normalizeString(payload.genre),
    synopsis: normalizeString(payload.synopsis),
    studio: normalizeString(payload.studio),
    episodes: Number(payload.episodes),
    slug: slug.toLowerCase(),
  };
}

function buildDuplicateKey(record) {
  return `${normalizeString(record.title).toLowerCase()}::${Number(record.year)}`;
}

function buildResolvedKey(payload) {
  return `${normalizeString(payload.title).toLowerCase()}::${Number(payload.year)}`;
}

function isSameAnimeRecord(record, payload) {
  if (!record || typeof record !== "object") {
    return false;
  }

  const slugMatch = normalizeString(record.slug).toLowerCase() === normalizeString(payload.slug).toLowerCase();
  const titleYearMatch = buildDuplicateKey(record) === buildResolvedKey(payload);
  return slugMatch || titleYearMatch;
}

async function loadSeedAnime() {
  if (!seedCache) {
    const raw = await fs.readFile(ANIME_FILE, "utf8");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      throw new Error("Anime data file is not an array");
    }

    seedCache = parsed;
  }

  return cloneRecord(seedCache);
}

async function loadLocalAnime() {
  if (!localAnimeCache) {
    localAnimeCache = await loadSeedAnime();
  }

  return localAnimeCache;
}

async function connectMongo() {
  if (!MONGODB_URI) {
    return false;
  }

  if (mongoose.connection.readyState === 1) {
    return true;
  }

  if (!connectPromise) {
    connectPromise = mongoose
      .connect(MONGODB_URI, {
        dbName: MONGODB_DB,
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000,
      })
      .then(() => true)
      .catch((error) => {
        connectPromise = null;
        throw error;
      });
  }

  return connectPromise;
}

function isMongoAnimeStoreReady() {
  return Boolean(MONGODB_URI) && mongoose.connection.readyState === 1;
}

async function seedMongoAnimeIfConnected() {
  if (!isMongoAnimeStoreReady()) {
    return false;
  }

  if (!seedPromise) {
    seedPromise = (async () => {
      const count = await Anime.countDocuments();

      if (count === 0) {
        const seedAnime = await loadSeedAnime();
        if (seedAnime.length > 0) {
          await Anime.insertMany(seedAnime, { ordered: true });
        }
      }

      const maxIdRecord = await Anime.findOne().sort({ _id: -1 }).select({ _id: 1 }).lean();
      const maxId = maxIdRecord ? Number(maxIdRecord._id) || 0 : 0;

      await AnimeCounter.updateOne(
        { _id: "anime" },
        { $set: { seq: maxId } },
        { upsert: true }
      );
    })().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }

  return seedPromise;
}

function primeMongoAnimeStore() {
  if (!MONGODB_URI) {
    return null;
  }

  if (!primePromise) {
    primePromise = connectMongo()
      .then(() => seedMongoAnimeIfConnected())
      .catch((error) => {
        primePromise = null;
        throw error;
      });
  }

  return primePromise;
}

async function useMongoAnimeStore() {
  if (!isMongoAnimeStoreReady()) {
    return false;
  }

  await seedMongoAnimeIfConnected();
  return isMongoAnimeStoreReady();
}

async function getNextAnimeId() {
  if (await useMongoAnimeStore()) {
    const counter = await AnimeCounter.findOneAndUpdate(
      { _id: "anime" },
      {
        $setOnInsert: { seq: 0 },
        $inc: { seq: 1 },
      },
      {
        new: true,
        upsert: true,
      }
    );

    return counter.seq;
  }

  const animeList = await loadLocalAnime();
  const maxId = animeList.reduce((currentMax, record) => {
    const recordId = Number(record && record._id) || 0;
    return recordId > currentMax ? recordId : currentMax;
  }, 0);

  return maxId + 1;
}

async function getAllAnime() {
  if (await useMongoAnimeStore()) {
    return Anime.find().sort({ _id: 1 }).lean();
  }

  return cloneRecord(await loadLocalAnime());
}

async function getAnimeById(id) {
  const numericId = Number(id);

  if (await useMongoAnimeStore()) {
    return Anime.findById(numericId).lean();
  }

  const animeList = await loadLocalAnime();
  const record = animeList.find((item) => Number(item && item._id) === numericId);
  return cloneRecord(record);
}

async function createAnime(payload) {
  const animeList = await getAllAnime();
  const resolvedSlug = normalizeString(payload.slug) || `${toSlug(payload.title)}-${Number(payload.year)}`;
  const candidate = {
    ...payload,
    slug: resolvedSlug,
  };

  if (animeList.some((record) => isSameAnimeRecord(record, candidate))) {
    const error = new Error("Anime record already exists");
    error.code = "ANIME_DUPLICATE";
    throw error;
  }

  const newAnime = buildAnimeRecord(await getNextAnimeId(), {
    ...candidate,
    era: payload.era,
  });

  if (await useMongoAnimeStore()) {
    const created = await Anime.create(newAnime);
    return cloneRecord(created.toObject({ versionKey: false }));
  }

  const localAnime = await loadLocalAnime();
  localAnime.push(newAnime);
  return cloneRecord(newAnime);
}

async function updateAnime(id, payload) {
  const numericId = Number(id);
  const animeList = await getAllAnime();
  const existingAnime = animeList.find((record) => Number(record && record._id) === numericId);

  if (!existingAnime) {
    return null;
  }

  const resolvedSlug = normalizeString(payload.slug) || `${toSlug(payload.title)}-${Number(payload.year)}`;
  const candidate = {
    ...payload,
    slug: resolvedSlug,
  };

  if (animeList.some((record) => Number(record && record._id) !== numericId && isSameAnimeRecord(record, candidate))) {
    const error = new Error("Anime record already exists");
    error.code = "ANIME_DUPLICATE";
    throw error;
  }

  const updatedAnime = buildAnimeRecord(numericId, {
    ...existingAnime,
    ...candidate,
    era: payload.era || existingAnime.era,
    img_name: payload.img_name || existingAnime.img_name,
  });

  if (await useMongoAnimeStore()) {
    await Anime.updateOne({ _id: numericId }, { $set: updatedAnime });
    return cloneRecord(updatedAnime);
  }

  const localAnime = await loadLocalAnime();
  const animeIndex = localAnime.findIndex((record) => Number(record && record._id) === numericId);
  localAnime[animeIndex] = updatedAnime;
  return cloneRecord(updatedAnime);
}

async function deleteAnime(id) {
  const numericId = Number(id);
  const animeList = await getAllAnime();
  const existingAnime = animeList.find((record) => Number(record && record._id) === numericId);

  if (!existingAnime) {
    return null;
  }

  if (await useMongoAnimeStore()) {
    await Anime.deleteOne({ _id: numericId });
    return cloneRecord(existingAnime);
  }

  const localAnime = await loadLocalAnime();
  const animeIndex = localAnime.findIndex((record) => Number(record && record._id) === numericId);
  const [deletedAnime] = localAnime.splice(animeIndex, 1);
  return cloneRecord(deletedAnime);
}

async function getAnimeStoreStatus() {
  if (!MONGODB_URI) {
    return {
      configured: false,
      connected: false,
      mode: "local",
      target: null,
    };
  }

  return {
    configured: true,
    connected: isMongoAnimeStoreReady(),
    mode: isMongoAnimeStoreReady() ? "mongo" : "local",
    target: `${MONGODB_DB}.anime`,
  };
}

void primeMongoAnimeStore();

module.exports = {
  createAnime,
  deleteAnime,
  getAllAnime,
  getAnimeById,
  getAnimeStoreStatus,
  updateAnime,
};