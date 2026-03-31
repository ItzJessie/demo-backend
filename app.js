const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs/promises");
const { MongoClient } = require("mongodb");

require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const FEEDBACK_DIR = path.join(__dirname, "feedbacks");

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "anime_archive";
const MONGODB_COLLECTION = process.env.MONGODB_COLLECTION || "feedbacks";

let mongoClient;
let mongoCollection;

const animeList = [
  {
    _id: 1,
    title: "Fullmetal Alchemist",
    img_name: "images/full-metal-alchemist-500x750.jpg",
    year: 2003,
    era: "2000s",
    genre: "Action, Adventure, Dark Fantasy",
    synopsis: "Two brothers search for the Philosopher's Stone to restore what they lost.",
    studio: "Bones",
    episodes: 51,
  },
  {
    _id: 2,
    title: "Cowboy Bebop",
    img_name: "images/cowboy-bebop-500x750.jpg",
    year: 1998,
    era: "1990s",
    genre: "Sci-Fi, Action, Space Western",
    synopsis: "Bounty hunters chase criminals across the solar system.",
    studio: "Sunrise",
    episodes: 26,
  },
  {
    _id: 3,
    title: "Attack on Titan",
    img_name: "images/attack-on-titan-500x750.jpg",
    year: 2013,
    era: "2010s",
    genre: "Action, Dark Fantasy",
    synopsis: "Humanity fights for survival against massive Titans.",
    studio: "Wit Studio / MAPPA",
    episodes: 89,
  },
  {
    _id: 4,
    title: "Frieren: Beyond Journey's End",
    img_name: "images/frieren-500x750.jpg",
    year: 2023,
    era: "2020s",
    genre: "Fantasy, Drama, Adventure",
    synopsis: "An elf mage reflects on life after the hero's journey ends.",
    studio: "Madhouse",
    episodes: 28,
  },
];

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

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/anime", (_req, res) => {
  res.json(animeList);
});

app.get("/api/anime/:id", (req, res) => {
  const id = Number(req.params.id);
  const anime = animeList.find((item) => item._id === id);

  if (!anime) {
    return res.status(404).json({ error: "Anime not found" });
  }

  return res.json(anime);
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

app.listen(PORT, () => {
  console.log(`Anime Archive Backend Server is running on http://localhost:${PORT}`);
  if (!MONGODB_URI) {
    console.log("MONGODB_URI not set. Feedback will still save locally under /feedbacks.");
  }
});

process.on("SIGINT", async () => {
  if (mongoClient) {
    await mongoClient.close();
  }
  process.exit(0);
});