// API Base URL
const API_URL = 'http://localhost:3001/api';

// State
let allAnime = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    loadAnimeData();
    setupEventListeners();
});

// Load anime data from API
async function loadAnimeData() {
    try {
        const response = await fetch(`${API_URL}/anime`);
        if (!response.ok) throw new Error('Failed to fetch anime data');
        allAnime = await response.json();
        displayAnimeList(allAnime);
    } catch (error) {
        console.error('Error loading anime:', error);
        document.getElementById('animeList').innerHTML = 
            '<p class="error">Failed to load anime data. Make sure the backend is running on port 3001.</p>';
    }
}

// Display anime cards
function displayAnimeList(animeList) {
    const animeGrid = document.getElementById('animeList');
    animeGrid.innerHTML = '';

    if (animeList.length === 0) {
        animeGrid.innerHTML = '<p class="no-results">No anime found matching your criteria.</p>';
        return;
    }

    animeList.forEach(anime => {
        const card = createAnimeCard(anime);
        animeGrid.appendChild(card);
    });
}

// Create anime card element
function createAnimeCard(anime) {
    const card = document.createElement('div');
    card.className = 'anime-card';
    card.innerHTML = `
        <div class="anime-image">
            <img src="${anime.img_name}" alt="${anime.title}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22300%22%3E%3Crect fill=%22%23333%22 width=%22200%22 height=%22300%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23fff%22%3E${anime.title}%3C/text%3E%3C/svg%3E'">
        </div>
        <div class="anime-info">
            <h3>${anime.title}</h3>
            <p class="year">${anime.year}</p>
            <p class="studio">Studio: ${anime.studio}</p>
            <p class="episodes">Episodes: ${anime.episodes}</p>
            <p class="genre">${anime.genre}</p>
            <p class="synopsis">${anime.synopsis}</p>
            <span class="era-badge">${anime.era}</span>
        </div>
    `;
    return card;
}

// Setup event listeners
function setupEventListeners() {
    // Navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', handleNavigation);
    });

    // Search functionality
    document.getElementById('searchInput').addEventListener('input', handleSearch);

    // Era filter
    document.getElementById('eraFilter').addEventListener('change', handleFilter);

    // Feedback form
    document.getElementById('feedbackForm').addEventListener('submit', handleFeedbackSubmit);
}

// Handle navigation between sections
function handleNavigation(e) {
    // Remove active class from all buttons and sections
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));

    // Add active class to clicked button
    e.target.classList.add('active');

    // Show corresponding section
    const sectionId = e.target.getAttribute('data-section');
    document.getElementById(sectionId).classList.add('active');

    // If showing anime section, reset filters
    if (sectionId === 'anime') {
        document.getElementById('searchInput').value = '';
        document.getElementById('eraFilter').value = '';
        displayAnimeList(allAnime);
    }
}

// Handle search
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    const filtered = allAnime.filter(anime =>
        anime.title.toLowerCase().includes(searchTerm) ||
        anime.genre.toLowerCase().includes(searchTerm) ||
        anime.studio.toLowerCase().includes(searchTerm)
    );
    displayAnimeList(filtered);
}

// Handle era filter
function handleFilter(e) {
    const selectedEra = e.target.value;
    let filtered = allAnime;

    if (selectedEra) {
        filtered = allAnime.filter(anime => anime.era === selectedEra);
    }

    // Also apply search filter if there's any
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(anime =>
            anime.title.toLowerCase().includes(searchTerm) ||
            anime.genre.toLowerCase().includes(searchTerm)
        );
    }

    displayAnimeList(filtered);
}

// Handle feedback form submission
async function handleFeedbackSubmit(e) {
    e.preventDefault();

    const formData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        age: document.getElementById('age').value,
        satisfaction: document.getElementById('satisfaction').value,
        rating: document.getElementById('rating').value || 
                 document.querySelector('input[name="rating"]:checked')?.value,
        comments: document.getElementById('comments').value
    };

    const messageDiv = document.getElementById('feedbackMessage');

    try {
        const response = await fetch(`${API_URL}/feedback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            throw new Error('Failed to submit feedback');
        }

        const result = await response.json();
        messageDiv.innerHTML = '✅ Thank you! Your feedback has been submitted successfully!';
        messageDiv.className = 'message success';
        document.getElementById('feedbackForm').reset();

        setTimeout(() => {
            messageDiv.innerHTML = '';
        }, 5000);
    } catch (error) {
        console.error('Error submitting feedback:', error);
        messageDiv.innerHTML = '❌ Error submitting feedback. Please try again.';
        messageDiv.className = 'message error';
    }
}

// Find a specific rating value
function getRatingValue() {
    const ratingInputs = document.querySelectorAll('input[name="rating"]');
    for (let input of ratingInputs) {
        if (input.checked) {
            return input.value;
        }
    }
    return null;
}