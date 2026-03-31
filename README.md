# 🎌 Anime Archive Backend API

A powerful backend server for the Anime Archive Timeline Website. This API serves extensive anime data and handles user feedback submissions with a beautifully themed anime interface.

## 🚀 Features

- **📺 Anime Data API**: Browse and search through 50+ popular anime series
- **💬 Feedback Form**: Collect user feedback with ratings and comments
- **🎨 Anime-Themed Interface**: Modern, dark-themed UI with anime aesthetics
- **🔍 Search & Filter**: Search by title, genre, studio, or filter by era (1980s-2020s)
- **✅ Persistent Storage**: All feedback is saved locally in JSON format

## 📋 Prerequisites

- Node.js (v14+)
- npm (v6+)

## 🛠️ Installation

1. **Navigate to the project directory**
```bash
cd /Users/jessiejavanbrown/Desktop/DEMO-BACKEND2/demo-backend
```

2. **Install dependencies**
```bash
npm install
```

3. **(Optional) Connect to MongoDB Atlas**

Create a `.env` file in the project root and add:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/?retryWrites=true&w=majority
MONGODB_DB=anime_archive
MONGODB_COLLECTION=feedbacks
```

If `MONGODB_URI` is present, feedback is written to Atlas and appears in MongoDB Data Explorer.

## 🎯 Getting Started

### Start the Server

```bash
npm start
```

The server will start on **http://localhost:3001**

You should see:
```
🎌 Anime Archive Backend Server is up and running on port 3001
```

### Access the Interface

Open your browser and navigate to:
```
http://localhost:3001
```

## 📡 API Endpoints

### 📺 Get All Anime Series
```
GET /api/anime
```

**Response**: Array of anime objects with all series data

**Example**:
```bash
curl http://localhost:3001/api/anime
```

### 🔍 Get Specific Anime by ID
```
GET /api/anime/:id
```

**Parameters**:
- `id` (number): Anime ID (1-10)

**Response**: Single anime object

**Example**:
```bash
curl http://localhost:3001/api/anime/1
```

### 💬 Submit Feedback
```
POST /api/feedback
```

**Request Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "(555) 123-4567",
  "age": "25",
  "satisfaction": "Great content and easy to navigate!",
  "rating": 5,
  "comments": "Would love to see more studios featured"
}
```

**Response**:
```json
{
  "message": "Feedback submitted successfully",
  "id": "1774967773042"
}
```

**Example**:
```bash
curl -X POST http://localhost:3001/api/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith",
    "email": "jane@example.com",
    "rating": 5,
    "satisfaction": "Excellent website!",
    "comments": "Very informative"
  }'
```

### 📋 Get All Feedback Submissions
```
GET /api/feedback
```

**Response**: Array of all submitted feedback

**Example**:
```bash
curl http://localhost:3001/api/feedback
```

## 🎨 Frontend Features

### Navigation Sections

1. **📺 Anime Series**
   - View all anime with detailed information
   - Search by title, genre, or studio
   - Filter by era (1980s-2020s)
   - Beautiful card layout with anime details

2. **💬 Feedback Form**
   - Name, email, phone, age fields
   - Satisfaction rating (required)
   - Star rating system (1-5 stars)
   - Additional comments field
   - Real-time success/error messages

3. **📚 API Documentation**
   - Complete endpoint documentation
   - Example requests and responses
   - Integration guide

## 📊 Anime Data Structure

Each anime object contains:
```json
{
  "_id": 1,
  "title": "Fullmetal Alchemist",
  "img_name": "images/full-metal-alchemist-500x750.jpg",
  "year": 2003,
  "era": "2000s",
  "genre": "Action, Adventure, Dark Fantasy",
  "synopsis": "Brothers search for redemption...",
  "studio": "Bones",
  "episodes": 51
}
```

## 💾 Feedback Storage

Feedback is always saved in the local `/feedbacks` directory as individual JSON files with the naming pattern:
```
feedback_[timestamp].json
```

Example feedback file:
```json
{
  "id": "1774967773042",
  "name": "Test User",
  "email": "test@example.com",
  "phone": "(555) 123-4567",
  "age": "25",
  "satisfaction": "Great backend!",
  "rating": 5,
  "comments": "Love the anime archive",
  "submittedAt": "2026-03-31T10:36:13.042Z"
}
```

When `MONGODB_URI` is configured, the same feedback is also inserted into Atlas database `MONGODB_DB` and collection `MONGODB_COLLECTION`.

## 🎨 Design Features

### Color Scheme
- **Primary**: Vibrant Pink (#ff006d)
- **Secondary**: Electric Blue (#0066ff)
- **Accent**: Bright Yellow (#ffbe0b)
- **Dark Background**: Deep Navy (#1a1a2e)

### UI Elements
- Animated header with gradient and scroll effect
- Smooth navigation with active state indicators
- Responsive anime card grid with hover effects
- Star rating system with hover animation
- Success/error message notifications
- Mobile-responsive design

## 📱 Responsive Design

The interface is fully responsive and works on:
- **Desktop**: Full featured experience
- **Tablet**: Adjusted layout with optimized controls
- **Mobile**: Single column layout with touch-friendly buttons

## 🔧 Project Structure

```
demo-backend/
├── app.js                          # Express server and API routes
├── package.json                    # Dependencies and scripts
├── README.md                       # This file
├── public/
│   ├── index.html                 # Main frontend interface
│   ├── app.js                     # Frontend JavaScript logic
│   └── styles.css                 # Anime-themed styling
└── feedbacks/                     # Storage for feedback submissions
    ├── feedback_[timestamp].json
    └── ...
```

## 🚀 Extending the Backend

### Add More Anime
Edit `app.js` and add new objects to the `animeSeries` array:

```javascript
{
    "_id": 11,
    "title": "New Anime Title",
    "img_name": "images/new-anime.jpg",
    "year": 2024,
    "era": "2020s",
    "genre": "Action, Adventure",
    "synopsis": "Description here...",
    "studio": "Studio Name",
    "episodes": 12
}
```

### Add More API Endpoints
Extend the Express app in `app.js` with additional routes:

```javascript
app.get("/api/custom-endpoint", (req, res) => {
  // Your custom logic here
  res.send(data);
});
```

## 🔐 Validation

The API includes built-in validation:
- Feedback requires `name` and `email` fields
- Rating is converted to integer
- Timestamps are automatically added
- Invalid IDs return 404 errors

## 📝 Notes

- The backend uses CORS to allow cross-origin requests
- All feedback is persisted locally; no database required
- The frontend automatically handles server errors gracefully
- Images are loaded from the `public/images/` directory

## 🤝 Integration with Frontend

To use this backend with your Anime Archive frontend:

1. Ensure the backend is running on port 3001
2. Update your frontend to call the API endpoints:
   - `GET http://localhost:3001/api/anime` for anime data
   - `POST http://localhost:3001/api/feedback` for feedback submission

## 📞 Support

If you encounter any issues:
1. Check that Node.js is installed: `node --version`
2. Verify dependencies are installed: `npm install`
3. Ensure port 3001 is not in use: `lsof -i :3001`
4. Check the server logs in the terminal

## ✨ Features Coming Soon

- Database integration for persistent storage
- Authentication system for admin feedback review
- Advanced filtering and pagination
- Export feedback to CSV
- User authentication for favorites
- Anime recommendation system

---

🎌 **Anime Archive Backend** | Powered by Express.js | v1.0.0
