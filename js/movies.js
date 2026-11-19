/* ==========================================================================
   Cine Majestad - Cartelera & Películas con Selector Multidía
   ========================================================================== */

let upcomingDates = [];
let currentSelectedDate = null;
let currentCategory = "all";

document.addEventListener("DOMContentLoaded", () => {
  initUpcomingDates();
  renderBillboardDates();
  renderHero();
  renderBillboard();
  initCategoryFilters();
});

// Generar los próximos 7 días calendario a partir de hoy con tarifas dinámicas
function initUpcomingDates(count = 7) {
  upcomingDates = [];
  const today = new Date();

  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const dayNum = String(d.getDate()).padStart(2, "0");
    const iso = `${year}-${month}-${dayNum}`;

    const rawWeekday = d.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "").toUpperCase();
    const rawMonth = d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "").toUpperCase();
    const weekdayLong = d.toLocaleDateString("es-ES", { weekday: "long" });
    const monthLong = d.toLocaleDateString("es-ES", { month: "long" });

    const dayNameShort = i === 0 ? "HOY" : (i === 1 ? "MAÑANA" : rawWeekday);
    const shortLabel = i === 0 ? "Hoy" : (i === 1 ? "Mañana" : `${rawWeekday.charAt(0) + rawWeekday.slice(1).toLowerCase()} ${d.getDate()}`);
    const fullLabel = i === 0 
      ? `Hoy, ${weekdayLong.charAt(0).toUpperCase() + weekdayLong.slice(1)} ${d.getDate()} de ${monthLong}`
      : `${weekdayLong.charAt(0).toUpperCase() + weekdayLong.slice(1)} ${d.getDate()} de ${monthLong}`;

    const dayPricing = Storage.getDayPricingInfo(iso);

    upcomingDates.push({
      iso,
      dayNum: d.getDate(),
      dayNameShort,
      monthShort: rawMonth,
      shortLabel,
      fullLabel,
      dayPricing
    });
  }

  // Por defecto seleccionar el primer día (Hoy) o el guardado previamente
  const savedIso = sessionStorage.getItem("cinemajestad_billboard_date");
  currentSelectedDate = upcomingDates.find(d => d.iso === savedIso) || upcomingDates[0];
}

// Renderizar la barra de píldoras de fechas en la cartelera
function renderBillboardDates() {
  const bar = document.querySelector("#billboardDatesBar");
  const labelCurrent = document.querySelector("#lblBillboardCurrentDate");

  if (labelCurrent && currentSelectedDate) {
    labelCurrent.textContent = currentSelectedDate.fullLabel;
  }

  if (!bar) return;

  bar.innerHTML = upcomingDates.map(d => {
    const isActive = currentSelectedDate && currentSelectedDate.iso === d.iso;
    const isWed = d.dayPricing && d.dayPricing.isWednesday;
    const isWknd = d.dayPricing && d.dayPricing.isWeekend;

    let promoTagHtml = "";
    if (isWed) {
      promoTagHtml = `<span class="date-pill-promo-tag" title="Promoción Miércoles 2x1 en Boletos">2x1</span>`;
    } else if (isWknd) {
      promoTagHtml = `<span class="date-pill-weekend-tag" title="Tarifa Fin de Semana">Finde</span>`;
    }

    return `
      <button class="date-pill-btn ${isActive ? 'active' : ''}" 
              data-iso="${d.iso}"
              onclick="selectBillboardDate('${d.iso}')"
              title="${d.fullLabel} (${d.dayPricing ? d.dayPricing.tierLabel : ''})">
        ${promoTagHtml}
        <span class="date-pill-day">${d.dayNameShort}</span>
        <span class="date-pill-num">${d.dayNum}</span>
        <span class="date-pill-month">${d.monthShort}</span>
      </button>
    `;
  }).join("");
}

// Cambiar la fecha seleccionada en la cartelera
function selectBillboardDate(iso) {
  const found = upcomingDates.find(d => d.iso === iso);
  if (!found) return;

  currentSelectedDate = found;
  sessionStorage.setItem("cinemajestad_billboard_date", iso);

  // Actualizar clases activas en botones de fecha
  const btns = document.querySelectorAll(".date-pill-btn");
  btns.forEach(btn => {
    if (btn.getAttribute("data-iso") === iso) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  const labelCurrent = document.querySelector("#lblBillboardCurrentDate");
  if (labelCurrent) {
    labelCurrent.textContent = currentSelectedDate.fullLabel;
  }

  // Re-renderizar cartelera con la nueva fecha activa
  renderBillboard(currentCategory);
}

// Renderizar la película destacada en el Hero Banner
function renderHero() {
  const movies = Storage.getMovies();
  const featured = movies.find(m => m.isFeatured) || movies[0];
  const heroContainer = document.querySelector("#heroSection");

  if (!heroContainer || !featured) return;

  const dateIso = currentSelectedDate ? currentSelectedDate.iso : "";
  const dateLabel = currentSelectedDate ? currentSelectedDate.shortLabel : "Hoy";

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
        <button class="btn btn-primary" onclick="startBooking('${featured.id}', '${featured.showtimes[0]}', '${dateIso}', '${dateLabel}')">
          🎟️ Reservar Butacas (${dateLabel})
        </button>
        <button class="btn btn-secondary" onclick="openTrailerModal('${featured.title}', '${featured.trailerUrl}')">
          ▶ Ver Tráiler Oficial
        </button>
      </div>
    </div>
  `;
}

// Renderizar la cartelera completa con horarios y día seleccionado
function renderBillboard(category = "all") {
  currentCategory = category;
  const grid = document.querySelector("#moviesGrid");
  if (!grid) return;

  const movies = Storage.getMovies();
  const filtered = category === "all" 
    ? movies 
    : movies.filter(m => m.genre.toLowerCase() === category.toLowerCase());

  const dateIso = currentSelectedDate ? currentSelectedDate.iso : "";
  const dateLabel = currentSelectedDate ? currentSelectedDate.shortLabel : "Hoy";
  const dayPricing = Storage.getDayPricingInfo(dateIso);

  // Renderizar banner informativo de tarifas dinámicas y promociones
  const noticeContainer = document.querySelector("#billboardPricingNotice");
  if (noticeContainer) {
    if (dayPricing.isWednesday) {
      noticeContainer.innerHTML = `
        <div class="billboard-pricing-banner wednesday">
          <span style="font-size: 1.6rem;">🎉</span>
          <div>
            <strong>¡Hoy es Miércoles de Cine con Promoción 2x1 en Boletería!</strong>
            <div style="font-size: 0.84rem; opacity: 0.95; margin-top: 0.2rem;">
              Compra en pares: por cada 2 butacas de la misma categoría, pagas 1 y la segunda es totalmente <strong>GRATIS</strong>.
            </div>
          </div>
        </div>
      `;
    } else if (dayPricing.isWeekend) {
      noticeContainer.innerHTML = `
        <div class="billboard-pricing-banner weekend">
          <span style="font-size: 1.6rem;">⭐</span>
          <div>
            <strong>Tarifa Fin de Semana (Sábados y Domingos)</strong>
            <div style="font-size: 0.84rem; opacity: 0.95; margin-top: 0.2rem;">
              Días estelares de alta concurrencia. Aplica tarifa especial de fin de semana para funciones premium.
            </div>
          </div>
        </div>
      `;
    } else {
      noticeContainer.innerHTML = `
        <div class="billboard-pricing-banner calm">
          <span style="font-size: 1.6rem;">🌿</span>
          <div>
            <strong>Tarifa Días Calmados (Lunes, Martes, Jueves, Viernes)</strong>
            <div style="font-size: 0.84rem; opacity: 0.95; margin-top: 0.2rem;">
              Disfruta del mejor confort cinematográfico con tarifa económica regular entre semana.
            </div>
          </div>
        </div>
      `;
    }
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
        <h3>No se encontraron películas en este género</h3>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(movie => {
    const moviePricing = Storage.getDayPricingInfo(dateIso, movie);

    return `
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

        <!-- Fila de Tarifas Dinámicas por Día -->
        <div class="card-pricing-badge-row">
          <div class="pricing-pill">
            <span>Estándar:</span>
            <strong>$${moviePricing.priceStandard.toFixed(2)}</strong>
            ${moviePricing.has2x1Promo ? '<span class="tag-2x1">2x1</span>' : ''}
          </div>
          <div class="pricing-pill">
            <span>VIP:</span>
            <strong class="vip">$${moviePricing.priceVip.toFixed(2)}</strong>
            ${moviePricing.has2x1Promo ? '<span class="tag-2x1">2x1</span>' : ''}
          </div>
        </div>

        <div class="showtimes-container">
          <p class="showtimes-label">Horarios para <strong>${dateLabel}</strong>:</p>
          <div class="showtime-chips">
            ${movie.showtimes.map(time => `
              <button class="time-chip" onclick="startBooking('${movie.id}', '${time}', '${dateIso}', '${dateLabel}')" title="Reservar para ${dateLabel} a las ${time}">
                ${time}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="card-footer-btns">
          <button class="btn btn-primary" onclick="startBooking('${movie.id}', '${movie.showtimes[0]}', '${dateIso}', '${dateLabel}')">
            Comprar Boletos
          </button>
          <button class="btn btn-secondary" onclick="openTrailerModal('${movie.title}', '${movie.trailerUrl}')" title="Ver tráiler">
            ▶
          </button>
        </div>
      </div>
    </div>
  `;
  }).join('');
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

// Iniciar proceso de reserva y redirigir a sala de asientos con día y horario específico
function startBooking(movieId, showtime, dateIso = null, dateLabel = null) {
  const movie = Storage.getMovieById(movieId);
  if (!movie) return;

  const targetIso = dateIso || (currentSelectedDate ? currentSelectedDate.iso : new Date().toISOString().split("T")[0]);
  const targetLabel = dateLabel || (currentSelectedDate ? currentSelectedDate.shortLabel : "Hoy");
  const fullLabel = currentSelectedDate ? currentSelectedDate.fullLabel : `Fecha: ${targetIso}`;

  const targetShowtimeKey = `${movie.id}_${targetIso}_${showtime}`;
  const moviePricing = Storage.getDayPricingInfo(targetIso, movie);

  const currentOrder = {
    movieId: movie.id,
    movieTitle: movie.title,
    poster: movie.poster,
    hall: movie.hall,
    roomId: movie.roomId || "sala-1",
    showtime: showtime,
    date: targetIso,
    dateFormatted: targetLabel,
    dateFull: fullLabel,
    showtimeKey: targetShowtimeKey,
    priceStandard: moviePricing.priceStandard,
    priceVip: moviePricing.priceVip,
    basePriceStandard: movie.priceStandard || 6.50,
    basePriceVip: movie.priceVip || 10.00,
    isWeekend: moviePricing.isWeekend,
    isWednesday: moviePricing.isWednesday,
    has2x1Promo: moviePricing.has2x1Promo,
    tierLabel: moviePricing.tierLabel,
    seats: [],
    snacks: [],
    total: 0
  };

  Storage.saveCurrentOrder(currentOrder);
  window.location.href = "seats.html";
}
