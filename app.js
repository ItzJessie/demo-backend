const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const app = express();

app.use(express.static("public"));
app.use(express.json());
app.use(cors());

// Create feedbacks directory if it doesn't exist
const feedbackDir = path.join(__dirname, "feedbacks");
if (!fs.existsSync(feedbackDir)) {
  fs.mkdirSync(feedbackDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "./public/images/");
    },
    filename: (req, file, cb) => {
      cb(null, file.originalname);
    },
  });
  
const upload = multer({ storage: storage });

// Anime series data
let animeSeries = [
    {
        "_id": 1,
        "title": "Fullmetal Alchemist",
        "img_name": "images/full-metal-alchemist-500x750.jpg",
        "year": 2003,
        "era": "2000s",
        "genre": "Action, Adventure, Dark Fantasy",
        "synopsis": "Brothers search for redemption after a failed human transmutation shatters their bodies.",
        "studio": "Bones",
        "episodes": 51
    },
    {
        "_id": 2,
        "title": "Hunter x Hunter",
        "img_name": "images/hunterxhunter-1280×720px.jpg",
        "year": 2011,
        "era": "2010s",
        "genre": "Action, Adventure, Shonen",
        "synopsis": "Gon and Killua chase their dreams through a world of hunters, trials, and mysteries.",
        "studio": "Madhouse",
        "episodes": 148
    },
    {
        "_id": 3,
        "title": "One Punch Man",
        "img_name": "images/one-punch-man-1280x720.jpg",
        "year": 2015,
        "era": "2010s",
        "genre": "Action, Comedy, Superhero",
        "synopsis": "A bored hero named Saitama defeats every enemy with a single punch.",
        "studio": "Madhouse",
        "episodes": 24
    },
    {
        "_id": 4,
        "title": "Chainsaw Man",
        "img_name": "images/chainsaw-man-1280x720.jpg",
        "year": 2022,
        "era": "2020s",
        "genre": "Action, Dark Fantasy, Shonen",
        "synopsis": "Denji makes a devil bargain and joins a public safety squad to hunt monsters.",
        "studio": "MAPPA",
        "episodes": 12
    },
    {
        "_id": 5,
        "title": "JoJo's Bizarre Adventure",
        "img_name": "images/jojo-bizarre-adventure-1280-720.jpg",
        "year": 2012,
        "era": "2010s",
        "genre": "Action, Adventure, Supernatural",
        "synopsis": "Generations of the Joestar family battle supernatural foes with unique powers.",
        "studio": "David Production",
        "episodes": 190
    },
    {
        "_id": 6,
        "title": "Bleach",
        "img_name": "images/bleach-1280x720.jpg",
        "year": 2004,
        "era": "2000s",
        "genre": "Action, Adventure, Supernatural",
        "synopsis": "Ichigo gains Soul Reaper powers and defends the living world from Hollows.",
        "studio": "Pierrot",
        "episodes": 366
    },
    {
        "_id": 7,
        "title": "Cyberpunk: Edgerunners",
        "img_name": "images/cyberpunk-1280x260.jpg",
        "year": 2022,
        "era": "2020s",
        "genre": "Sci-Fi, Action, Cyberpunk",
        "synopsis": "A street kid fights to survive in a neon megacity fueled by cyberware.",
        "studio": "Trigger",
        "episodes": 10
    },
    {
        "_id": 8,
        "title": "Code Geass",
        "img_name": "images/wp12255968 8.png",
        "year": 2006,
        "era": "2000s",
        "genre": "Action, Mecha, Supernatural",
        "synopsis": "Exiled prince Lelouch leads a rebellion with a power that can command anyone.",
        "studio": "Sunrise",
        "episodes": 50
    },
    {
        "_id": 9,
        "title": "Princess Mononoke",
        "img_name": "images/wp12255968 10.png",
        "year": 1997,
        "era": "1990s",
        "genre": "Fantasy, Adventure, Drama",
        "synopsis": "A cursed warrior is caught between iron miners and the spirits of the forest.",
        "studio": "Studio Ghibli",
        "episodes": 1
    },
    {
        "_id": 10,
        "title": "Cowboy Bebop",
        "img_name": "images/cowboy-1280x720.jpg",
        "year": 1998,
        "era": "1990s",
        "genre": "Neo-Noir, Sci-Fi, Space Opera",
        "synopsis": "A crew of bounty hunters cruises the solar system chasing dangerous criminals.",
        "studio": "Sunrise",
        "episodes": 26
    }
];

// GET endpoint for all anime series
app.get("/api/anime", (req, res) => {
  res.send(animeSeries);
});

// GET endpoint for a specific anime by ID
app.get("/api/anime/:id", (req, res) => {
  const anime = animeSeries.find(a => a._id === parseInt(req.params.id));
  if (anime) {
    res.send(anime);
  } else {
    res.status(404).send({ error: "Anime not found" });
  }
});

// GET endpoint for all feedback submissions
app.get("/api/feedback", (req, res) => {
  try {
    const feedbackFiles = fs.readdirSync(feedbackDir);
    const allFeedback = feedbackFiles.map(file => {
      const data = fs.readFileSync(path.join(feedbackDir, file), "utf-8");
      return JSON.parse(data);
    });
    res.send(allFeedback);
  } catch (err) {
    res.status(500).send({ error: "Could not retrieve feedback" });
  }
});

// POST endpoint to submit feedback
app.post("/api/feedback", (req, res) => {
  try {
    const { name, email, phone, age, satisfaction, rating, comments } = req.body;
    
    // Validate required fields
    if (!name || !email) {
      return res.status(400).send({ error: "Name and email are required" });
    }

    const feedback = {
      id: Date.now().toString(),
      name,
      email,
      phone,
      age,
      satisfaction,
      rating: parseInt(rating),
      comments,
      submittedAt: new Date().toISOString()
    };

    // Save feedback to a JSON file
    const filePath = path.join(feedbackDir, `feedback_${feedback.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(feedback, null, 2));

    res.status(201).send({ 
      message: "Feedback submitted successfully", 
      id: feedback.id 
    });
  } catch (err) {
    res.status(500).send({ error: "Could not submit feedback" });
  }
});

// Listen for incoming requests
app.listen(3001, () => {
  console.log("🎌 Anime Archive Backend Server is up and running on port 3001");
});