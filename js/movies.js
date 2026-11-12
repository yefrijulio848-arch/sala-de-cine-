/* ==========================================================================
   Cine Majestad - Cartelera & Películas
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  renderHero();
  renderBillboard();
  initCategoryFilters();
});

// Renderizar la película destacada en el Hero Banner
function renderHero() {
  const movies = Storage.getMovies();
  const featured = movies.find(m => m.isFeatured) || movies[0];
  const heroContainer = document.querySelector("#heroSection");

  if (!heroContainer || !featured) return;

  heroContainer.innerHTML = `
    <img src="${featured.backdrop}" alt="${featured.title}" class="hero-backdrop">
    <div class="hero-overlay"></div>
    <div class="hero-content">
      <span class="hero-tag">👑 Gran Estreno en Cine Majestad</span>
      <h1 class="hero-title">${featured.title}</h1>
      <div class="hero-meta">
        <span class="badge badge-rating">⭐ ${featured.rating}</span>
        <span class="badge badge-age">${featured.ageRating}</span>
        <span>⏱️ ${featured.duration}</span>
        <span class="badge badge-format">${featured.formats.join(" • ")}</span>
      </div>
      <p class="hero-synopsis">${featured.synopsis}</p>
      <div class="hero-buttons">
        <button class="btn btn-primary" onclick="startBooking('${featured.id}', '${featured.showtimes[0]}')">
          🎟️ Reservar Butacas
        </button>
        <button class="btn btn-secondary" onclick="openTrailerModal('${featured.title}', '${featured.trailerUrl}')">
          ▶ Ver Tráiler Oficial
        </button>
      </div>
    </div>
  `;
}

// Renderizar la cartelera completa
function renderBillboard(category = "all") {
  const grid = document.querySelector("#moviesGrid");
  if (!grid) return;

  const movies = Storage.getMovies();
  const filtered = category === "all" 
    ? movies 
    : movies.filter(m => m.genre.toLowerCase() === category.toLowerCase());

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
        <h3>No se encontraron películas en este género</h3>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(movie => `
    <div class="movie-card">
      <div class="poster-wrapper">
        <img src="${movie.poster}" alt="${movie.title}" class="poster-img" loading="lazy">
        <div class="poster-overlay"></div>
        <div class="card-badges">
          <span class="badge badge-format">${movie.formats[0]}</span>
          <span class="badge badge-age">${movie.ageRating}</span>
        </div>
        <div class="rating-badge-floating">
          <span class="badge badge-rating">⭐ ${movie.rating}</span>
        </div>
      </div>
      <div class="card-content">
        <span class="movie-genre">${movie.genre}</span>
        <h3 class="movie-card-title">${movie.title}</h3>
        <div class="movie-info-row">
          <span>⏱️ ${movie.duration}</span>
          <span>🏛️ ${movie.hall.split("(")[0]}</span>
        </div>

        <div class="showtimes-container">
          <p class="showtimes-label">Horarios disponibles hoy:</p>
          <div class="showtime-chips">
            ${movie.showtimes.map(time => `
              <button class="time-chip" onclick="startBooking('${movie.id}', '${time}')">
                ${time}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="card-footer-btns">
          <button class="btn btn-primary" onclick="startBooking('${movie.id}', '${movie.showtimes[0]}')">
            Comprar Boletos
          </button>
          <button class="btn btn-secondary" onclick="openTrailerModal('${movie.title}', '${movie.trailerUrl}')" title="Ver tráiler">
            ▶
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

// Filtros por Categoría
function initCategoryFilters() {
  const pills = document.querySelectorAll(".pill-btn");
  pills.forEach(pill => {
    pill.addEventListener("click", () => {
      pills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      const category = pill.getAttribute("data-category");
      renderBillboard(category);
    });
  });
}

// Iniciar proceso de reserva y redirigir a sala de asientos
function startBooking(movieId, showtime) {
  const movie = Storage.getMovieById(movieId);
  const currentOrder = {
    movieId: movie.id,
    movieTitle: movie.title,
    poster: movie.poster,
    hall: movie.hall,
    roomId: movie.roomId || "sala-1",
    showtime: showtime,
    priceStandard: movie.priceStandard,
    priceVip: movie.priceVip,
    seats: [],
    snacks: [],
    total: 0
  };

  Storage.saveCurrentOrder(currentOrder);
  window.location.href = "seats.html";
}
