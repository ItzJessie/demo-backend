const mongoose = require("mongoose");

const animeSchema = new mongoose.Schema(
  {
    _id: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    img_name: {
      type: String,
      required: true,
      trim: true,
    },
    year: {
      type: Number,
      required: true,
    },
    era: {
      type: String,
      required: true,
      trim: true,
    },
    genre: {
      type: String,
      required: true,
      trim: true,
    },
    synopsis: {
      type: String,
      required: true,
      trim: true,
    },
    studio: {
      type: String,
      required: true,
      trim: true,
    },
    episodes: {
      type: Number,
      required: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
  },
  {
    versionKey: false,
    collection: "anime",
  }
);

const animeCounterSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    seq: {
      type: Number,
      default: 0,
    },
  },
  {
    versionKey: false,
    collection: "counters",
  }
);

const Anime = mongoose.models.Anime || mongoose.model("Anime", animeSchema);
const AnimeCounter =
  mongoose.models.AnimeCounter || mongoose.model("AnimeCounter", animeCounterSchema);

module.exports = {
  Anime,
  AnimeCounter,
};