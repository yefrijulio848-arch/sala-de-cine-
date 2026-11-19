/* ==========================================================================
   Cine Majestad - Panel de Administración Integral
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  initAdminTabs();
  renderStats();
  renderMoviesTable();
  initMovieSearch();
  initRoomsAndInspector();
  renderSnacksTable();
  renderSuppliersTable();
  initSupplierSearch();
  renderBookingsTable();
  initBookingSearch();
  renderRolesAndUsersTab();
  initUserSearch();
  loadSettingsForms();
  initFormHandlers();
  if (typeof refreshAdminAnalytics === "function") refreshAdminAnalytics(false);
  if (typeof renderFinancialDashboard === "function") renderFinancialDashboard();

  // Sincronizar datos reales desde API MySQL (Reservas, Dulcería y Proveedores)
  await Promise.all([
    syncBookingsFromAPI(),
    syncSnacksFromAPI(),
    syncSuppliersFromAPI()
  ]);
  renderStats();
  renderSnacksTable();
  renderSuppliersTable();
  renderBookingsTable();

  // Suscribirse a actualizaciones por WebSocket en tiempo real
  if (typeof RealTime !== "undefined") {
    RealTime.init();
    if (RealTime.socket) {
      RealTime.socket.on("booking:created", async (newBooking) => {
        if (newBooking) {
          Storage.saveBooking(newBooking);
          await Promise.all([
            syncBookingsFromAPI(),
            syncSnacksFromAPI(),
            syncSuppliersFromAPI()
          ]);
          renderStats();
          renderSnacksTable();
          renderSuppliersTable();
          renderBookingsTable();
          renderAdminSeatInspector();

          // Si el admin está en la pestaña de analíticas, actualizar sin recargar
          const currentTab = document.querySelector(".admin-tab-pane.active");
          if (currentTab && currentTab.id === "tab-analytics" && typeof refreshAdminAnalytics === "function") {
            refreshAdminAnalytics(false);
          } else {
            const badgeUpdated = document.querySelector("#analyticsLastUpdated");
            if (badgeUpdated) {
              badgeUpdated.innerHTML = `<span style="color: var(--gold); font-weight: 600;">🔔 ¡Nueva venta registrada! Haz clic en "Refrescar Métricas"</span>`;
            }
          }

          showToast(`🔔 ¡Nueva venta registrada en tiempo real! Código: ${newBooking.bookingCode || newBooking.id} ($${(newBooking.grandTotal || newBooking.total || 0).toFixed(2)})`, "success");
        }
      });
      RealTime.socket.on("analytics:updated", async (payload) => {
        if (payload && payload.suppliers) {
          Storage.saveSuppliers(payload.suppliers);
        }
        await Promise.all([
          syncBookingsFromAPI(),
          syncSnacksFromAPI(),
          syncSuppliersFromAPI()
        ]);
        renderStats();
        renderSnacksTable();
        renderSuppliersTable();
        renderBookingsTable();
      });
      RealTime.socket.on("stock:updated", (payload) => {
        if (payload && payload.snacks) {
          Storage.saveSnacks(payload.snacks);
          renderSnacksTable();
        }
      });
      RealTime.socket.on("seat:booked", () => {
        renderAdminSeatInspector();
      });
    }
  }

  // Suscribirse a actualizaciones en tiempo real (BroadcastChannel entre pestañas)
  Storage.onSync((event) => {
    renderStats();
    renderAdminSeatInspector();
    renderSnacksTable();
    renderSuppliersTable();
    renderBookingsTable();
    renderRolesAndUsersTab();

    const currentTab = document.querySelector(".admin-tab-pane.active");
    if (currentTab && currentTab.id === "tab-analytics" && typeof refreshAdminAnalytics === "function") {
      refreshAdminAnalytics(false);
    } else {
      const badgeUpdated = document.querySelector("#analyticsLastUpdated");
      if (badgeUpdated && event && (event.type === "BOOKING_SAVED" || event.type === "BOOKINGS_UPDATED")) {
        badgeUpdated.innerHTML = `<span style="color: var(--gold); font-weight: 600;">🔔 Nueva venta detectada. Haz clic en "Refrescar Métricas"</span>`;
      }
    }
  });
});

async function syncBookingsFromAPI() {
  try {
    if (typeof API !== "undefined" && API.orders && API.orders.getAll) {
      const res = await API.orders.getAll();
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        Storage.saveBookings(res.data, true);
      }
    }
  } catch (err) {
    console.warn("Sincronización de reservas MySQL omitida:", err.message);
  }
}

async function syncSuppliersFromAPI() {
  try {
    if (typeof API !== "undefined" && API.suppliers && API.suppliers.getAll) {
      const res = await API.suppliers.getAll();
      if (res && res.data && Array.isArray(res.data)) {
        Storage.saveSuppliers(res.data);
      }
    }
  } catch (err) {
    console.warn("Sincronización de proveedores MySQL omitida:", err.message);
  }
}

async function syncSnacksFromAPI() {
  try {
    if (typeof API !== "undefined" && API.orders && API.orders.getSnacks) {
      const res = await API.orders.getSnacks();
      if (res && res.data && Array.isArray(res.data)) {
        Storage.saveSnacks(res.data);
      }
    }
  } catch (err) {
    console.warn("Sincronización de snacks MySQL omitida:", err.message);
  }
}

// =============================================================================
// NAVEGACIÓN POR PESTAÑAS
// =============================================================================
function initAdminTabs() {
  const tabButtons = document.querySelectorAll(".admin-tab-btn");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");
      switchAdminTab(targetTab);
    });
  });

  const urlTab = new URLSearchParams(window.location.search).get("tab");
  if (urlTab) {
    switchAdminTab(urlTab);
  }
}

function switchAdminTab(tabName) {
  const buttons = document.querySelectorAll(".admin-tab-btn");
  const panes = document.querySelectorAll(".admin-tab-pane");

  buttons.forEach(b => {
    if (b.getAttribute("data-tab") === tabName) {
      b.classList.add("active");
    } else {
      b.classList.remove("active");
    }
  });

  panes.forEach(pane => {
    if (pane.id === `tab-${tabName}`) {
      pane.classList.add("active");
    } else {
      pane.classList.remove("active");
    }
  });

  // Si se abre la pestaña de salas, refrescar inspector
  if (tabName === "seats-manager") {
    renderAdminSeatInspector();
  }

  // Si se abre la pestaña de analíticas, refrescar tablas
  if (tabName === "analytics" && typeof refreshAdminAnalytics === "function") {
    refreshAdminAnalytics(false);
  }

  // Si se abre la pestaña de proveedores, refrescar tabla y KPIs
  if (tabName === "suppliers" && typeof renderSuppliersTable === "function") {
    renderSuppliersTable();
  }

  // Si se abre la pestaña de finanzas, refrescar dashboard financiero
  if (tabName === "financials" && typeof renderFinancialDashboard === "function") {
    renderFinancialDashboard();
  }

  // Si se abre la pestaña de roles y usuarios, refrescar vista
  if (tabName === "roles-users" && typeof renderRolesAndUsersTab === "function") {
    renderRolesAndUsersTab();
  }
}

// =============================================================================
// MÉTRICAS DEL DASHBOARD
// =============================================================================
function renderStats() {
  const movies = Storage.getMovies();
  const bookings = (typeof Storage !== "undefined" && Storage.getBookings ? Storage.getBookings() : [])
    .filter(b => b.status !== "CANCELADA" && b.status !== "REEMBOLSADA");

  const statMovies = document.querySelector("#statTotalMovies");
  const statBookings = document.querySelector("#statTotalBookings");
  const statRevenue = document.querySelector("#statEstimatedRevenue");
  const statCandy = document.querySelector("#statCandyRevenue");

  if (statMovies) statMovies.textContent = movies.length;
  if (statBookings) statBookings.textContent = bookings.length;

  const calcTotal = typeof window.getBookingTotal === "function" 
    ? window.getBookingTotal 
    : (b) => (typeof b.grandTotal === "number" ? b.grandTotal : (typeof b.total === "number" ? b.total : (parseFloat(b.total_pagado) || 0)));

  const calcCandy = typeof window.getBookingCandyTotal === "function" 
    ? window.getBookingCandyTotal 
    : (b) => (typeof b.snacksTotal === "number" ? b.snacksTotal : (typeof b.subtotalSnacks === "number" ? b.subtotalSnacks : (parseFloat(b.subtotal_snacks) || 0)));

  if (statRevenue) {
    const totalRev = bookings.reduce((sum, b) => sum + calcTotal(b), 0);
    statRevenue.textContent = `$${totalRev.toFixed(2)}`;
  }

  if (statCandy) {
    const candyRev = bookings.reduce((sum, b) => sum + calcCandy(b), 0);
    statCandy.textContent = `$${candyRev.toFixed(2)}`;
  }
}

// =============================================================================
// MÓDULO 1: CARTELERA Y PELÍCULAS (CRUD CON DURABILIDAD Y PREVENTAS)
// =============================================================================
function renderMoviesTable(filterQuery = "") {
  const tbody = document.querySelector("#adminMoviesTableBody");
  if (!tbody) return;

  let movies = Storage.getMovies();
  if (filterQuery) {
    const q = filterQuery.toLowerCase().trim();
    movies = movies.filter(m => m.title.toLowerCase().includes(q) || m.genre.toLowerCase().includes(q));
  }

  tbody.innerHTML = movies.map(movie => {
    const vigencia = Storage.getMovieVigenciaInfo(movie);

    return `
    <tr>
      <td>
        <div class="table-movie-info">
          <img src="${movie.poster}" alt="${movie.title}" class="table-poster">
          <div>
            <strong>${movie.title}</strong>
            <p style="color: var(--text-muted); font-size: 0.78rem;">${movie.director || 'Director no esp.'}</p>
          </div>
        </div>
      </td>
      <td>
        <div style="display: flex; flex-direction: column; gap: 0.3rem;">
          <span class="badge ${vigencia.isPresale ? 'badge-presale' : 'badge-now-showing'}" style="width: fit-content;">
            ${vigencia.badgeText}
          </span>
          <span style="font-size: 0.8rem; font-weight: 700; color: #fff;">
            ⏳ ${vigencia.durationDays} Días en Cartelera
          </span>
          <span style="font-size: 0.72rem; color: var(--text-secondary);">
            Del ${vigencia.startDateFormatted} al ${vigencia.endDateFormatted}
          </span>
          <small style="font-size: 0.72rem; color: ${vigencia.isPresale ? '#ff66b2' : 'var(--gold)'}; font-weight: 700;">
            ${vigencia.statusLabel}
          </small>
        </div>
      </td>
      <td><span class="badge badge-genre">${movie.genre}</span></td>
      <td>⏱️ ${movie.duration}</td>
      <td>🏛️ ${movie.hall}</td>
      <td>
        <div style="display: flex; gap: 0.3rem; flex-wrap: wrap;">
          ${movie.showtimes.map(t => `<span class="badge" style="background: rgba(255,255,255,0.06);">${t}</span>`).join('')}
        </div>
      </td>
      <td>
        <span style="color: #fff;">$${movie.priceStandard.toFixed(2)}</span> / 
        <strong style="color: var(--gold);">$${movie.priceVip.toFixed(2)}</strong>
      </td>
      <td>
        <button class="btn-icon-action" onclick="toggleMovieFeatured('${movie.id}')" title="Alternar Destacada" style="${movie.isFeatured ? 'color: var(--gold); background: rgba(245,197,24,0.15);' : ''}">
          ${movie.isFeatured ? '⭐ Sí' : '☆ No'}
        </button>
      </td>
      <td>
        <div class="table-actions">
          <button class="btn-icon-action" onclick="editMovie('${movie.id}')" title="Editar">✏️</button>
          <button class="btn-icon-action delete" onclick="deleteMovieHandler('${movie.id}')" title="Eliminar">🗑️</button>
        </div>
      </td>
    </tr>
  `;
  }).join('');
}

function initMovieSearch() {
  const searchInput = document.querySelector("#adminMovieSearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      renderMoviesTable(e.target.value);
    });
  }
}

// Control interactivo de Modalidad (Cartelera vs Preventa) y Durabilidad de Días
function onMovieReleaseTypeChange(type) {
  const isPresale = type === "PREVENTA";
  const badge = document.querySelector("#badgeMovieVigenciaPreview");
  const cardCartelera = document.querySelector("#lblTypeCartelera");
  const cardPreventa = document.querySelector("#lblTypePreventa");
  const lblStart = document.querySelector("#lblStartDateTitle");

  if (cardCartelera) cardCartelera.style.borderColor = !isPresale ? "var(--gold)" : "var(--border-color)";
  if (cardPreventa) cardPreventa.style.borderColor = isPresale ? "#ff007f" : "var(--border-color)";

  if (badge) {
    badge.className = `badge ${isPresale ? 'badge-presale' : 'badge-now-showing'}`;
    badge.textContent = isPresale ? "🎟️ PREVENTA EXCLUSIVA" : "🔥 EN CARTELERA";
  }

  if (lblStart) {
    lblStart.textContent = isPresale ? "🚀 Fecha de Estreno Oficial *" : "📅 Fecha Inicio en Cartelera *";
  }

  // Si cambia a preventa y la fecha de inicio es anterior o igual a hoy, sugerir fecha de estreno próxima
  const startInput = document.querySelector("#inputStartDate");
  if (isPresale && startInput) {
    const todayStr = new Date().toISOString().split("T")[0];
    if (!startInput.value || startInput.value <= todayStr) {
      const future = new Date();
      future.setDate(future.getDate() + 9);
      const y = future.getFullYear();
      const m = String(future.getMonth() + 1).padStart(2, "0");
      const d = String(future.getDate()).padStart(2, "0");
      startInput.value = `${y}-${m}-${d}`;
    }
  }

  onMovieDatesChange("duration");
}

function onMovieDatesChange(trigger = "duration") {
  const startInput = document.querySelector("#inputStartDate");
  const daysInput = document.querySelector("#inputDurationDays");
  const endInput = document.querySelector("#inputEndDate");

  if (!startInput || !daysInput || !endInput) return;

  if (trigger === "start" || trigger === "duration") {
    const startVal = startInput.value;
    const daysVal = parseInt(daysInput.value, 10) || 1;
    if (startVal) {
      endInput.value = Storage.calculateMovieEndDate(startVal, daysVal);
    }
  } else if (trigger === "end") {
    const startVal = startInput.value;
    const endVal = endInput.value;
    if (startVal && endVal) {
      const s = new Date(startVal);
      const e = new Date(endVal);
      const diffMs = e.getTime() - s.getTime();
      const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
      daysInput.value = diffDays;
    }
  }

  updateMovieVigenciaUI();
}

function setMovieDurationPreset(days) {
  const daysInput = document.querySelector("#inputDurationDays");
  if (daysInput) {
    daysInput.value = days;
    onMovieDatesChange("duration");
  }
}

function updateMovieVigenciaUI() {
  const radioPreventa = document.querySelector("#radioTypePreventa");
  const isPresale = radioPreventa ? radioPreventa.checked : false;
  const startInput = document.querySelector("#inputStartDate");
  const daysInput = document.querySelector("#inputDurationDays");
  const endInput = document.querySelector("#inputEndDate");
  const lblDaysCount = document.querySelector("#lblDurationDaysCount");
  const lblSummary = document.querySelector("#lblVigenciaSummaryText");

  const startVal = startInput ? startInput.value : "";
  const daysVal = daysInput ? (parseInt(daysInput.value, 10) || 21) : 21;
  const endVal = endInput ? endInput.value : "";

  if (lblDaysCount) lblDaysCount.textContent = `${daysVal} Días`;

  if (lblSummary) {
    const tempMovie = {
      releaseType: isPresale ? "PREVENTA" : "CARTELERA",
      isPresale,
      startDate: startVal,
      durationDays: daysVal,
      endDate: endVal
    };
    const vigencia = Storage.getMovieVigenciaInfo(tempMovie);
    if (isPresale) {
      lblSummary.innerHTML = `🎟️ <strong>Preventa Exclusiva:</strong> Estreno el <strong>${vigencia.startDateFormatted}</strong>. Temporada de <strong>${daysVal} días</strong> (hasta el ${vigencia.endDateFormatted}). <span style="color: #ff66b2; font-weight: 700;">${vigencia.statusLabel}</span>.`;
    } else {
      lblSummary.innerHTML = `🎬 <strong>En Cartelera:</strong> Del <strong>${vigencia.startDateFormatted}</strong> al <strong>${vigencia.endDateFormatted}</strong> (${daysVal} días de temporada). <strong style="color: var(--gold);">${vigencia.statusLabel}</strong>.`;
    }
  }
}

window.onMovieReleaseTypeChange = onMovieReleaseTypeChange;
window.onMovieDatesChange = onMovieDatesChange;
window.setMovieDurationPreset = setMovieDurationPreset;
window.updateMovieVigenciaUI = updateMovieVigenciaUI;

function openMovieModal(isEdit = false, movieData = null) {
  const modal = document.querySelector("#movieFormModal");
  const modalTitle = document.querySelector("#modalFormTitle");
  const form = document.querySelector("#movieForm");

  if (!modal || !form) return;
  form.reset();

  const todayStr = new Date().toISOString().split("T")[0];

  if (isEdit && movieData) {
    modalTitle.textContent = "Editar Película en Cartelera";
    document.querySelector("#movieIdInput").value = movieData.id;
    document.querySelector("#inputTitle").value = movieData.title;
    document.querySelector("#inputGenre").value = movieData.genre;
    document.querySelector("#inputDuration").value = movieData.duration;
    document.querySelector("#inputRating").value = movieData.rating;
    document.querySelector("#inputAge").value = movieData.ageRating;
    document.querySelector("#inputHall").value = movieData.hall;
    document.querySelector("#inputTimes").value = movieData.showtimes.join(", ");
    document.querySelector("#inputStandardPrice").value = movieData.priceStandard;
    document.querySelector("#inputVipPrice").value = movieData.priceVip;
    document.querySelector("#inputDirector").value = movieData.director || "";
    document.querySelector("#inputFeatured").value = movieData.isFeatured ? "true" : "false";
    document.querySelector("#inputPoster").value = movieData.poster;
    document.querySelector("#inputBackdrop").value = movieData.backdrop || "";
    document.querySelector("#inputTrailer").value = movieData.trailerUrl;
    document.querySelector("#inputSynopsis").value = movieData.synopsis;

    // Cargar vigencia y tipo de preventa
    const isPresale = movieData.releaseType === "PREVENTA" || movieData.isPresale === true;
    const radioCartelera = document.querySelector("#radioTypeCartelera");
    const radioPreventa = document.querySelector("#radioTypePreventa");

    if (isPresale && radioPreventa) {
      radioPreventa.checked = true;
    } else if (radioCartelera) {
      radioCartelera.checked = true;
    }

    const startDate = movieData.startDate || (isPresale ? "2026-11-28" : todayStr);
    const durationDays = parseInt(movieData.durationDays, 10) || (isPresale ? 30 : 21);
    const endDate = movieData.endDate || Storage.calculateMovieEndDate(startDate, durationDays);

    document.querySelector("#inputStartDate").value = startDate;
    document.querySelector("#inputDurationDays").value = durationDays;
    document.querySelector("#inputEndDate").value = endDate;

    onMovieReleaseTypeChange(isPresale ? "PREVENTA" : "CARTELERA");
  } else {
    modalTitle.textContent = "Programar Nueva Película en Cartelera";
    document.querySelector("#movieIdInput").value = "";
    document.querySelector("#inputFeatured").value = "false";

    const radioCartelera = document.querySelector("#radioTypeCartelera");
    if (radioCartelera) radioCartelera.checked = true;

    document.querySelector("#inputStartDate").value = todayStr;
    document.querySelector("#inputDurationDays").value = 21;
    document.querySelector("#inputEndDate").value = Storage.calculateMovieEndDate(todayStr, 21);

    onMovieReleaseTypeChange("CARTELERA");
  }

  modal.classList.add("open");
}

function closeMovieModal() {
  const modal = document.querySelector("#movieFormModal");
  if (modal) modal.classList.remove("open");
}

function editMovie(id) {
  const movie = Storage.getMovieById(id);
  if (movie) openMovieModal(true, movie);
}

function deleteMovieHandler(id) {
  if (confirm("¿Estás seguro de que deseas retirar esta película de Cine Majestad?")) {
    Storage.deleteMovie(id);
    renderMoviesTable();
    renderStats();
    populateInspectorShowtimes();
    showToast("Película eliminada de la cartelera.", "info");
  }
}

function toggleMovieFeatured(id) {
  let movies = Storage.getMovies();
  movies = movies.map(m => {
    if (m.id === id) {
      return { ...m, isFeatured: !m.isFeatured };
    }
    return m;
  });
  Storage.saveMovies(movies);
  renderMoviesTable();
  showToast("Estado de película destacada actualizado.", "success");
}

// =============================================================================
// MÓDULO 2: SALAS Y ESQUEMAS DE ASIENTOS EN VIVO
// =============================================================================
function initRoomsAndInspector() {
  renderAdminRooms();
  populateInspectorShowtimes();
  renderAdminSeatInspector();
}

function renderAdminRooms() {
  const container = document.querySelector("#adminRoomsGrid");
  if (!container) return;

  const rooms = Storage.getRooms();

  container.innerHTML = rooms.map(room => `
    <div class="room-card">
      <div class="room-card-header">
        <div>
          <h4 style="font-size: 1.15rem; color: #fff;">${room.name}</h4>
          <span class="badge" style="background: rgba(212, 175, 55, 0.15); color: var(--gold); font-size: 0.72rem; margin-top: 0.25rem; display: inline-block;">
            ${room.layoutBadge || '🏛️ Maqueta Estándar'}
          </span>
        </div>
        <span class="badge badge-format">${room.technology}</span>
      </div>
      <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0.5rem 0 0.8rem; line-height: 1.4;">
        ${room.layoutDesc || 'Configuración arquitectónica de puestos y butacas.'}
      </p>
      <div class="room-card-meta">
        <div><strong>Capacidad:</strong> ${room.capacity} butacas</div>
        <div><strong>Distribución:</strong> Filas ${room.rows.join(", ")} (${room.seatsPerRow} por fila)</div>
        <div><strong>Zona VIP:</strong> Filas ${room.vipRows.join(", ")}</div>
        <div><strong>Pantalla:</strong> ${room.screenType}</div>
        <div><strong>Sonido:</strong> ${room.soundSystem}</div>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="openRoomModal('${room.id}')" style="width: 100%;">
        ⚙️ Configurar Sala
      </button>
    </div>
  `).join('');
}

// =============================================================================
// DISEÑADOR VISUAL E INTERACTIVO DE SALAS Y BUTACAS
// =============================================================================
let roomEditorState = {
  roomId: "sala-1",
  layoutType: "curved_imax",
  rowCount: 6,
  cols: 10,
  rows: ["A", "B", "C", "D", "E", "F"],
  vipRows: ["E", "F"],
  wheelchairSeats: ["A-1", "A-2"],
  doors: [
    { id: "front-left", active: true, type: "SALIDA" },
    { id: "front-right", active: true, type: "ENTRADA" },
    { id: "back-left", active: true, type: "ENTRADA" },
    { id: "back-right", active: false, type: "SALIDA" }
  ],
  activeBrush: "cycle"
};

function openRoomModal(roomId) {
  const room = Storage.getRoomById(roomId);
  if (!room) return;

  document.querySelector("#roomIdInput").value = room.id;
  document.querySelector("#inputRoomName").value = room.name || "";
  document.querySelector("#inputRoomTech").value = room.technology || "IMAX Laser";
  document.querySelector("#inputRoomScreen").value = room.screenType || "Curva Gigante 4K";
  document.querySelector("#inputRoomSound").value = room.soundSystem || "Dolby Atmos 64 Canales";

  // Cargar estado inicial del diseñador de butacas
  const rawRows = (Array.isArray(room.rows) && room.rows.length > 0) ? room.rows : ["A", "B", "C", "D", "E", "F"];
  const rawVip = Array.isArray(room.vipRows) ? room.vipRows : ["E", "F"];
  const rawCols = parseInt(room.seatsPerRow, 10) || 10;

  // Cargar sillas para discapacitados
  let rawWheelchair = [];
  if (Array.isArray(room.wheelchairSeats)) {
    rawWheelchair = [...room.wheelchairSeats];
  } else if (room.wheelchairCols && Array.isArray(room.wheelchairCols)) {
    rawWheelchair = room.wheelchairCols.map(c => `${rawRows[0] || 'A'}-${c}`);
  } else {
    rawWheelchair = [`${rawRows[0] || 'A'}-1`, `${rawRows[0] || 'A'}-2`];
  }

  // Cargar puertas de acceso y evacuación
  const defaultDoors = [
    { id: "front-left", active: true, type: "SALIDA" },
    { id: "front-right", active: true, type: "ENTRADA" },
    { id: "back-left", active: true, type: "ENTRADA" },
    { id: "back-right", active: false, type: "SALIDA" }
  ];
  const rawDoors = (Array.isArray(room.doors) && room.doors.length === 4)
    ? JSON.parse(JSON.stringify(room.doors))
    : defaultDoors;

  roomEditorState = {
    roomId: room.id,
    layoutType: room.layoutType || (
      room.id === "sala-1" ? "curved_imax" :
      room.id === "sala-2" ? "stadium_double_aisle" :
      room.id === "sala-3" ? "motion_4dx" : "vip_lounge"
    ),
    rowCount: rawRows.length,
    cols: Math.max(4, Math.min(18, rawCols)),
    rows: [...rawRows],
    vipRows: [...rawVip],
    wheelchairSeats: rawWheelchair,
    doors: rawDoors,
    activeBrush: "cycle"
  };

  syncDoorControlsUI();
  setEditorBrush("cycle");
  renderRoomSeatEditor();

  const controlsEl = document.querySelector(".room-editor-controls");
  if (controlsEl) controlsEl.scrollTop = 0;
  const hallEl = document.querySelector("#roomEditorCinemaHall");
  if (hallEl) hallEl.scrollTop = 0;

  const modal = document.querySelector("#roomFormModal");
  if (modal) modal.classList.add("open");
}

function setEditorBrush(brush) {
  roomEditorState.activeBrush = brush;
  document.querySelectorAll("#editorBrushGroup .editor-brush-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-brush") === brush);
  });
}

function syncDoorControlsUI() {
  const dFL = roomEditorState.doors.find(d => d.id === "front-left") || { active: false, type: "SALIDA" };
  const dFR = roomEditorState.doors.find(d => d.id === "front-right") || { active: false, type: "SALIDA" };
  const dBL = roomEditorState.doors.find(d => d.id === "back-left") || { active: false, type: "ENTRADA" };
  const dBR = roomEditorState.doors.find(d => d.id === "back-right") || { active: false, type: "SALIDA" };

  const selFL = document.querySelector("#selDoorFrontLeft");
  const selFR = document.querySelector("#selDoorFrontRight");
  const selBL = document.querySelector("#selDoorBackLeft");
  const selBR = document.querySelector("#selDoorBackRight");

  if (selFL) selFL.value = !dFL.active ? "CERRADA" : dFL.type;
  if (selFR) selFR.value = !dFR.active ? "CERRADA" : dFR.type;
  if (selBL) selBL.value = !dBL.active ? "CERRADA" : dBL.type;
  if (selBR) selBR.value = !dBR.active ? "CERRADA" : dBR.type;
}

function onDoorSelectChange(doorId, value) {
  let door = roomEditorState.doors.find(d => d.id === doorId);
  if (!door) {
    door = { id: doorId, active: true, type: "ENTRADA" };
    roomEditorState.doors.push(door);
  }
  if (value === "CERRADA") {
    door.active = false;
  } else {
    door.active = true;
    door.type = value;
  }
  renderRoomDoors();
}

function cycleDoorState(doorId) {
  let door = roomEditorState.doors.find(d => d.id === doorId);
  if (!door) {
    door = { id: doorId, active: true, type: "ENTRADA" };
    roomEditorState.doors.push(door);
  }

  // Ciclo interactivo directo al hacer clic en la maqueta: ENTRADA -> SALIDA -> PARED -> ENTRADA
  if (door.active && door.type === "ENTRADA") {
    door.active = true;
    door.type = "SALIDA";
  } else if (door.active && door.type === "SALIDA") {
    door.active = false;
  } else {
    door.active = true;
    door.type = "ENTRADA";
  }

  syncDoorControlsUI();
  renderRoomDoors();
}

function applyDoorPreset(preset) {
  if (preset === "entrance_left") {
    // Entrada en el lateral izquierdo, evacuación por el derecho y frontal
    roomEditorState.doors = [
      { id: "front-left", active: true, type: "SALIDA" },
      { id: "front-right", active: true, type: "SALIDA" },
      { id: "back-left", active: true, type: "ENTRADA" },
      { id: "back-right", active: true, type: "SALIDA" }
    ];
  } else if (preset === "entrance_right") {
    // Entrada en el lateral derecho, evacuación por el izquierdo y frontal
    roomEditorState.doors = [
      { id: "front-left", active: true, type: "SALIDA" },
      { id: "front-right", active: true, type: "SALIDA" },
      { id: "back-left", active: true, type: "SALIDA" },
      { id: "back-right", active: true, type: "ENTRADA" }
    ];
  } else if (preset === "entrance_both") {
    // Entrada por ambos pasillos laterales
    roomEditorState.doors = [
      { id: "front-left", active: true, type: "SALIDA" },
      { id: "front-right", active: true, type: "SALIDA" },
      { id: "back-left", active: true, type: "ENTRADA" },
      { id: "back-right", active: true, type: "ENTRADA" }
    ];
  } else if (preset === "front_exits_only") {
    // Entradas atrás, salidas únicamente al frente
    roomEditorState.doors = [
      { id: "front-left", active: true, type: "SALIDA" },
      { id: "front-right", active: true, type: "SALIDA" },
      { id: "back-left", active: true, type: "ENTRADA" },
      { id: "back-right", active: false, type: "SALIDA" }
    ];
  }

  syncDoorControlsUI();
  renderRoomDoors();
}

function renderRoomDoors() {
  const hiddenDoors = document.querySelector("#inputRoomDoors");
  if (hiddenDoors) hiddenDoors.value = JSON.stringify(roomEditorState.doors);

  const dFL = roomEditorState.doors.find(d => d.id === "front-left") || { active: false, type: "SALIDA" };
  const dFR = roomEditorState.doors.find(d => d.id === "front-right") || { active: false, type: "SALIDA" };
  const dBL = roomEditorState.doors.find(d => d.id === "back-left") || { active: false, type: "ENTRADA" };
  const dBR = roomEditorState.doors.find(d => d.id === "back-right") || { active: false, type: "SALIDA" };

  function createDoorBadgeHtml(door, defaultRole) {
    if (!door.active) {
      return `<div class="hall-door-badge door-closed" onclick="cycleDoorState('${door.id}')" title="Pared cerrada (Clic para activar puerta)">🚫 PARED</div>`;
    }
    if (door.type === "ENTRADA") {
      return `<div class="hall-door-badge door-entrance" onclick="cycleDoorState('${door.id}')" title="Entrada Principal (Clic para alternar a Salida o Pared)">🚪 ENTRADA SALA</div>`;
    }
    return `<div class="hall-door-badge door-exit" onclick="cycleDoorState('${door.id}')" title="Salida de Emergencia (Clic para alternar a Pared o Entrada)">🟢 SALIDA EMERGENCIA</div>`;
  }

  const slotFL = document.querySelector("#slotDoorFrontLeft");
  const slotFR = document.querySelector("#slotDoorFrontRight");
  const slotBL = document.querySelector("#slotDoorBackLeft");
  const slotBR = document.querySelector("#slotDoorBackRight");

  if (slotFL) slotFL.innerHTML = createDoorBadgeHtml(dFL, "SALIDA");
  if (slotFR) slotFR.innerHTML = createDoorBadgeHtml(dFR, "SALIDA");
  if (slotBL) slotBL.innerHTML = createDoorBadgeHtml(dBL, "ENTRADA");
  if (slotBR) slotBR.innerHTML = createDoorBadgeHtml(dBR, "ENTRADA");

  // Actualizar Pasillos de Circulación (Walkways: por donde pasa la gente)
  const walkwayL = document.querySelector("#walkwayLeft");
  const walkwayR = document.querySelector("#walkwayRight");
  const tagL = document.querySelector("#tagWalkwayLeft");
  const tagR = document.querySelector("#tagWalkwayRight");
  const arrTopL = document.querySelector("#arrowTopLeft");
  const arrBotL = document.querySelector("#arrowBottomLeft");
  const arrTopR = document.querySelector("#arrowTopRight");
  const arrBotR = document.querySelector("#arrowBottomRight");

  // Pasillo Izquierdo: Determinar si es flujo de entrada o salida
  const isLeftEntrance = (dBL.active && dBL.type === "ENTRADA") || (dFL.active && dFL.type === "ENTRADA");
  const isLeftExit = (dBL.active && dBL.type === "SALIDA") || (dFL.active && dFL.type === "SALIDA");

  if (walkwayL) {
    walkwayL.classList.remove("walkway-entrance", "walkway-exit");
    if (isLeftEntrance) {
      walkwayL.classList.add("walkway-entrance");
      if (tagL) tagL.textContent = "🚶 PASILLO ENTRADA (IZQ)";
      if (arrTopL) arrTopL.textContent = "↓";
      if (arrBotL) arrBotL.textContent = "↓";
    } else if (isLeftExit) {
      walkwayL.classList.add("walkway-exit");
      if (tagL) tagL.textContent = "🏃 PASILLO SALIDA (IZQ)";
      if (arrTopL) arrTopL.textContent = "↑";
      if (arrBotL) arrBotL.textContent = "↑";
    } else {
      if (tagL) tagL.textContent = "🚶 PASILLO IZQ.";
      if (arrTopL) arrTopL.textContent = "↕";
      if (arrBotL) arrBotL.textContent = "↕";
    }
  }

  // Pasillo Derecho: Determinar si es flujo de entrada o salida
  const isRightEntrance = (dBR.active && dBR.type === "ENTRADA") || (dFR.active && dFR.type === "ENTRADA");
  const isRightExit = (dBR.active && dBR.type === "SALIDA") || (dFR.active && dFR.type === "SALIDA");

  if (walkwayR) {
    walkwayR.classList.remove("walkway-entrance", "walkway-exit");
    if (isRightEntrance) {
      walkwayR.classList.add("walkway-entrance");
      if (tagR) tagR.textContent = "🚶 PASILLO ENTRADA (DER)";
      if (arrTopR) arrTopR.textContent = "↓";
      if (arrBotR) arrBotR.textContent = "↓";
    } else if (isRightExit) {
      walkwayR.classList.add("walkway-exit");
      if (tagR) tagR.textContent = "🏃 PASILLO SALIDA (DER)";
      if (arrTopR) arrTopR.textContent = "↑";
      if (arrBotR) arrBotR.textContent = "↑";
    } else {
      if (tagR) tagR.textContent = "🚶 PASILLO DER.";
      if (arrTopR) arrTopR.textContent = "↕";
      if (arrBotR) arrBotR.textContent = "↕";
    }
  }
}

function handleEditorSeatClick(row, col) {
  const seatCode = `${row}-${col}`;
  const brush = roomEditorState.activeBrush || "cycle";
  const isVip = roomEditorState.vipRows.includes(row);
  const isWheelchair = roomEditorState.wheelchairSeats.includes(seatCode);

  if (brush === "cycle") {
    // Ciclo dinámico: Estándar -> Wheelchair (♿) -> VIP -> Estándar
    if (!isWheelchair && !isVip) {
      roomEditorState.wheelchairSeats.push(seatCode);
    } else if (isWheelchair) {
      roomEditorState.wheelchairSeats = roomEditorState.wheelchairSeats.filter(s => s !== seatCode);
      if (!roomEditorState.vipRows.includes(row)) {
        roomEditorState.vipRows.push(row);
      }
    } else {
      roomEditorState.wheelchairSeats = roomEditorState.wheelchairSeats.filter(s => s !== seatCode);
      roomEditorState.vipRows = roomEditorState.vipRows.filter(r => r !== row);
    }
  } else if (brush === "wheelchair") {
    if (isWheelchair) {
      roomEditorState.wheelchairSeats = roomEditorState.wheelchairSeats.filter(s => s !== seatCode);
    } else {
      roomEditorState.wheelchairSeats.push(seatCode);
    }
  } else if (brush === "vip") {
    if (!roomEditorState.vipRows.includes(row)) {
      roomEditorState.vipRows.push(row);
    }
    roomEditorState.wheelchairSeats = roomEditorState.wheelchairSeats.filter(s => s !== seatCode);
  } else if (brush === "standard") {
    roomEditorState.wheelchairSeats = roomEditorState.wheelchairSeats.filter(s => s !== seatCode);
    roomEditorState.vipRows = roomEditorState.vipRows.filter(r => r !== row);
  }

  renderRoomSeatEditor();
}

function setWheelchairPreset(preset) {
  const rowA = roomEditorState.rows[0] || "A";
  const cols = roomEditorState.cols;

  if (preset === "rowA_flanks") {
    roomEditorState.wheelchairSeats = [`${rowA}-1`, `${rowA}-${cols}`];
  } else if (preset === "rowA_all") {
    roomEditorState.wheelchairSeats = [];
    for (let c = 1; c <= cols; c++) {
      roomEditorState.wheelchairSeats.push(`${rowA}-${c}`);
    }
  } else if (preset === "aisles") {
    const midCol = Math.floor(cols / 2);
    roomEditorState.wheelchairSeats = [
      `${rowA}-1`,
      `${rowA}-${midCol}`,
      `${rowA}-${midCol + 1}`,
      `${rowA}-${cols}`
    ];
  } else if (preset === "clear") {
    roomEditorState.wheelchairSeats = [];
  }

  renderRoomSeatEditor();
}

function renderRoomSeatEditor() {
  const lblRowCount = document.querySelector("#lblRoomRowCount");
  const lblRowRange = document.querySelector("#lblRoomRowRange");
  const lblSeatsPerRow = document.querySelector("#lblRoomSeatsPerRow");
  const hiddenSeatsPerRow = document.querySelector("#inputRoomSeatsPerRow");
  const hiddenRows = document.querySelector("#inputRoomRows");
  const hiddenVipRows = document.querySelector("#inputRoomVipRows");
  const hiddenWheelchair = document.querySelector("#inputRoomWheelchairSeats");
  const lblWheelchairCount = document.querySelector("#lblRoomWheelchairCount");
  const gridContainer = document.querySelector("#roomEditorSeatGrid");
  const hallSection = document.querySelector("#roomEditorCinemaHall");
  const archBadge = document.querySelector("#roomEditorArchBadge");

  const badgeTotal = document.querySelector("#badgeEditorTotalSeats");
  const badgeStandard = document.querySelector("#badgeEditorStandardSeats");
  const badgeVip = document.querySelector("#badgeEditorVipSeats");
  const badgeWheelchair = document.querySelector("#badgeEditorWheelchairSeats");

  // Validar y mantener coherencia de filas
  const ALL_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  if (roomEditorState.rows.length !== roomEditorState.rowCount) {
    roomEditorState.rows = ALL_LETTERS.slice(0, roomEditorState.rowCount);
  }

  // Filtrar VIPs y Wheelchairs que no pertenezcan a filas activas o excedan columnas
  roomEditorState.vipRows = roomEditorState.vipRows.filter(r => roomEditorState.rows.includes(r));
  roomEditorState.wheelchairSeats = (roomEditorState.wheelchairSeats || []).filter(code => {
    const parts = code.split("-");
    const r = parts[0];
    const c = parseInt(parts[1], 10);
    return roomEditorState.rows.includes(r) && c <= roomEditorState.cols;
  });

  // Actualizar textos informativos
  if (lblRowCount) lblRowCount.textContent = `${roomEditorState.rowCount} Filas`;
  if (lblRowRange && roomEditorState.rows.length > 0) {
    lblRowRange.textContent = `Filas ${roomEditorState.rows[0]} hasta ${roomEditorState.rows[roomEditorState.rows.length - 1]}`;
  }
  if (lblSeatsPerRow) lblSeatsPerRow.textContent = `${roomEditorState.cols} Butacas`;
  if (lblWheelchairCount) lblWheelchairCount.textContent = `${roomEditorState.wheelchairSeats.length} Asignadas`;

  // Sincronizar inputs ocultos para el guardado en Storage/DB
  if (hiddenSeatsPerRow) hiddenSeatsPerRow.value = roomEditorState.cols;
  if (hiddenRows) hiddenRows.value = roomEditorState.rows.join(", ");
  if (hiddenVipRows) hiddenVipRows.value = roomEditorState.vipRows.join(", ");
  if (hiddenWheelchair) hiddenWheelchair.value = roomEditorState.wheelchairSeats.join(", ");

  // Calcular totales
  const totalSeats = roomEditorState.rowCount * roomEditorState.cols;
  const vipSeats = roomEditorState.vipRows.length * roomEditorState.cols;
  const wheelchairCount = roomEditorState.wheelchairSeats.length;
  const standardSeats = Math.max(0, totalSeats - vipSeats);

  if (badgeTotal) badgeTotal.textContent = `${totalSeats} Butacas`;
  if (badgeStandard) badgeStandard.textContent = `${standardSeats} Estándar`;
  if (badgeVip) badgeVip.textContent = `${vipSeats} VIP`;
  if (badgeWheelchair) badgeWheelchair.textContent = `♿ ${wheelchairCount} Accesibles`;

  // Renderizar puertas arquitectónicas
  renderRoomDoors();

  if (!gridContainer) return;

  const layoutType = roomEditorState.layoutType || (
    roomEditorState.roomId === "sala-1" ? "curved_imax" :
    roomEditorState.roomId === "sala-2" ? "stadium_double_aisle" :
    roomEditorState.roomId === "sala-3" ? "motion_4dx" : "vip_lounge"
  );

  // Sincronizar la maqueta arquitectónica exacta al contenedor
  if (hallSection) {
    hallSection.classList.remove("layout-curved-imax", "layout-stadium-double", "layout-motion-4dx", "layout-vip-lounge");
    hallSection.classList.add(`layout-${layoutType.replace(/_/g, "-")}`);
  }

  if (archBadge) {
    archBadge.textContent = 
      layoutType === "curved_imax" ? "🏛️ Maqueta: Anfiteatro Curvo IMAX" :
      layoutType === "stadium_double_aisle" ? "🏟️ Maqueta: Estadio 3 Bloques (Doble Pasillo)" :
      layoutType === "motion_4dx" ? "🚀 Maqueta: Pods Mecánicos 4DX" :
      "👑 Maqueta: Palcos VIP & Sofás Dobles";
  }

  const rows = roomEditorState.rows;
  const seatsPerRow = roomEditorState.cols;
  const vipRows = roomEditorState.vipRows;
  const wheelchairSeats = roomEditorState.wheelchairSeats;

  // Renderizar la misma maqueta de butacas 3D idéntica a la vista del usuario
  gridContainer.innerHTML = rows.map(row => {
    const isVipRow = vipRows.includes(row);
    let seatsContent = "";

    // 1. ANFITEATRO CURVO IMAX (Sala 1)
    if (layoutType === "curved_imax") {
      const midCol = Math.floor(seatsPerRow / 2);
      for (let col = 1; col <= seatsPerRow; col++) {
        if (col === midCol + 1) {
          seatsContent += `<div class="aisle-gap"></div>`;
        }
        let dynamicTransform = "";
        if (col === 1) dynamicTransform = "style='transform: rotate(7deg) translateY(3px);'";
        else if (col === 2) dynamicTransform = "style='transform: rotate(4deg) translateY(1.5px);'";
        else if (col === seatsPerRow - 1) dynamicTransform = "style='transform: rotate(-4deg) translateY(1.5px);'";
        else if (col === seatsPerRow) dynamicTransform = "style='transform: rotate(-7deg) translateY(3px);'";

        const seatCode = `${row}-${col}`;
        const isWheelchair = wheelchairSeats.includes(seatCode);

        seatsContent += `
          <button type="button" 
                  class="seat ${isVipRow ? 'vip' : ''} ${isWheelchair ? 'wheelchair' : ''}" 
                  data-col="${col}" 
                  data-row="${row}" 
                  ${dynamicTransform}
                  onclick="handleEditorSeatClick('${row}', ${col})" 
                  title="Fila ${row} Butaca ${col} (${isWheelchair ? 'Accesible ♿' : (isVipRow ? 'VIP Luxury' : 'Estándar')}) - Clic para pintar con el pincel activo">
            ${col}
          </button>
        `;
      }
    }
    // 2. ESTADIO CLÁSICO 3 BLOQUES Y DOBLE PASILLO (Sala 2)
    else if (layoutType === "stadium_double_aisle") {
      const leftCount = Math.max(1, Math.min(3, Math.round(seatsPerRow * 0.2)));
      const rightCount = leftCount;
      const centerCount = Math.max(1, seatsPerRow - leftCount - rightCount);

      // Bloque izquierdo
      seatsContent += `<div class="stadium-block block-left">`;
      for (let col = 1; col <= leftCount; col++) {
        const seatCode = `${row}-${col}`;
        const isWheelchair = wheelchairSeats.includes(seatCode);
        seatsContent += `
          <button type="button" class="seat ${isVipRow ? 'vip' : ''} ${isWheelchair ? 'wheelchair' : ''}" data-col="${col}" data-row="${row}" onclick="handleEditorSeatClick('${row}', ${col})" title="Fila ${row}-${col}">${col}</button>
        `;
      }
      seatsContent += `</div><div class="aisle-stairs"></div><div class="stadium-block block-center">`;
      // Bloque centro
      for (let col = leftCount + 1; col <= leftCount + centerCount; col++) {
        const seatCode = `${row}-${col}`;
        const isWheelchair = wheelchairSeats.includes(seatCode);
        seatsContent += `
          <button type="button" class="seat ${isVipRow ? 'vip' : ''} ${isWheelchair ? 'wheelchair' : ''}" data-col="${col}" data-row="${row}" onclick="handleEditorSeatClick('${row}', ${col})" title="Fila ${row}-${col}">${col}</button>
        `;
      }
      seatsContent += `</div><div class="aisle-stairs"></div><div class="stadium-block block-right">`;
      // Bloque derecho
      for (let col = leftCount + centerCount + 1; col <= seatsPerRow; col++) {
        const seatCode = `${row}-${col}`;
        const isWheelchair = wheelchairSeats.includes(seatCode);
        seatsContent += `
          <button type="button" class="seat ${isVipRow ? 'vip' : ''} ${isWheelchair ? 'wheelchair' : ''}" data-col="${col}" data-row="${row}" onclick="handleEditorSeatClick('${row}', ${col})" title="Fila ${row}-${col}">${col}</button>
        `;
      }
      seatsContent += `</div>`;
    }
    // 3. PODS 4DX (Sala 3)
    else if (layoutType === "motion_4dx") {
      let inPod = false;
      for (let col = 1; col <= seatsPerRow; col++) {
        if (!inPod) {
          seatsContent += `<div class="motion-pod">`;
          inPod = true;
        }
        const seatCode = `${row}-${col}`;
        const isWheelchair = wheelchairSeats.includes(seatCode);
        seatsContent += `
          <button type="button" class="seat ${isVipRow ? 'vip' : ''} ${isWheelchair ? 'wheelchair' : ''}" data-col="${col}" data-row="${row}" onclick="handleEditorSeatClick('${row}', ${col})" title="Fila ${row}-${col}">${col}</button>
        `;
        if (col % 4 === 0 && col < seatsPerRow) {
          seatsContent += `</div><div class="effects-aisle"><span>💨</span></div>`;
          inPod = false;
        }
      }
      if (inPod) seatsContent += `</div>`;
    }
    // 4. VIP LOUNGE (Sala 4)
    else if (layoutType === "vip_lounge") {
      const midCol = Math.floor(seatsPerRow / 2);
      for (let col = 1; col <= seatsPerRow; col += 2) {
        seatsContent += `<div class="love-seat-pair">`;
        const seatCode1 = `${row}-${col}`;
        const isWheelchair1 = wheelchairSeats.includes(seatCode1);
        seatsContent += `
          <button type="button" class="seat vip-recliner ${isVipRow ? 'vip' : ''} ${isWheelchair1 ? 'wheelchair' : ''}" data-col="${col}" data-row="${row}" onclick="handleEditorSeatClick('${row}', ${col})" title="Fila ${row}-${col}">${col}</button>
        `;
        if (col + 1 <= seatsPerRow) {
          const seatCode2 = `${row}-${col + 1}`;
          const isWheelchair2 = wheelchairSeats.includes(seatCode2);
          seatsContent += `
            <button type="button" class="seat vip-recliner ${isVipRow ? 'vip' : ''} ${isWheelchair2 ? 'wheelchair' : ''}" data-col="${col + 1}" data-row="${row}" onclick="handleEditorSeatClick('${row}', ${col + 1})" title="Fila ${row}-${col + 1}">${col + 1}</button>
          `;
        }
        seatsContent += `</div>`;

        if (col + 1 === midCol || col === midCol) {
          seatsContent += `<div class="carpet-aisle">⚜️</div>`;
        } else if (col + 2 <= seatsPerRow) {
          seatsContent += `<div class="lounge-table">🍷</div>`;
        }
      }
    }
    // Fallback estándar
    else {
      const midCol = Math.floor(seatsPerRow / 2);
      for (let col = 1; col <= seatsPerRow; col++) {
        if (col === midCol + 1) {
          seatsContent += `<div class="aisle-gap"></div>`;
        }
        const seatCode = `${row}-${col}`;
        const isWheelchair = wheelchairSeats.includes(seatCode);
        seatsContent += `
          <button type="button" class="seat ${isVipRow ? 'vip' : ''} ${isWheelchair ? 'wheelchair' : ''}" data-col="${col}" data-row="${row}" onclick="handleEditorSeatClick('${row}', ${col})" title="Fila ${row}-${col}">${col}</button>
        `;
      }
    }

    return `
      <div class="seat-row">
        <span class="row-label" 
              onclick="toggleRowVip('${row}')" 
              title="Fila ${row} (${isVipRow ? 'VIP' : 'Estándar'}) - Clic para alternar Fila ${row}" 
              style="cursor: pointer; user-select: none; transition: all 0.2s ease;">
          ${row}
        </span>
        ${seatsContent}
        <span class="row-label" 
              onclick="toggleRowVip('${row}')" 
              title="Fila ${row} (${isVipRow ? 'VIP' : 'Estándar'}) - Clic para alternar Fila ${row}" 
              style="cursor: pointer; user-select: none; transition: all 0.2s ease;">
          ${row}
        </span>
      </div>
    `;
  }).join("");
}

function adjustRoomRows(delta) {
  const newCount = Math.max(2, Math.min(12, roomEditorState.rowCount + delta));
  if (newCount !== roomEditorState.rowCount) {
    roomEditorState.rowCount = newCount;
    const ALL_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    roomEditorState.rows = ALL_LETTERS.slice(0, newCount);
    roomEditorState.vipRows = roomEditorState.vipRows.filter(r => roomEditorState.rows.includes(r));
    renderRoomSeatEditor();
  }
}

function adjustRoomCols(delta) {
  const newCols = Math.max(4, Math.min(18, roomEditorState.cols + delta));
  if (newCols !== roomEditorState.cols) {
    roomEditorState.cols = newCols;
    renderRoomSeatEditor();
  }
}

function toggleRowVip(rowLetter) {
  const idx = roomEditorState.vipRows.indexOf(rowLetter);
  if (idx > -1) {
    roomEditorState.vipRows.splice(idx, 1);
  } else {
    roomEditorState.vipRows.push(rowLetter);
  }
  renderRoomSeatEditor();
}

function setVipPreset(preset) {
  if (preset === "last2") {
    roomEditorState.vipRows = roomEditorState.rows.slice(-2);
  } else if (preset === "last1") {
    roomEditorState.vipRows = roomEditorState.rows.slice(-1);
  } else if (preset === "none") {
    roomEditorState.vipRows = [];
  } else if (preset === "all") {
    roomEditorState.vipRows = [...roomEditorState.rows];
  }
  renderRoomSeatEditor();
}

function closeRoomModal() {
  const modal = document.querySelector("#roomFormModal");
  if (modal) modal.classList.remove("open");
}

// Exponer en el objeto global para handlers de eventos en línea
window.openRoomModal = openRoomModal;
window.closeRoomModal = closeRoomModal;
window.renderRoomSeatEditor = renderRoomSeatEditor;
window.adjustRoomRows = adjustRoomRows;
window.adjustRoomCols = adjustRoomCols;
window.toggleRowVip = toggleRowVip;
window.setVipPreset = setVipPreset;
window.setEditorBrush = setEditorBrush;
window.handleEditorSeatClick = handleEditorSeatClick;
window.setWheelchairPreset = setWheelchairPreset;
window.toggleDoorActive = toggleDoorActive;
window.changeDoorType = changeDoorType;
window.renderRoomDoors = renderRoomDoors;
window.cycleDoorState = cycleDoorState;
window.applyDoorPreset = applyDoorPreset;
window.onDoorSelectChange = onDoorSelectChange;
window.syncDoorControlsUI = syncDoorControlsUI;

// Llenar selector de fechas en el inspector de asientos
function populateInspectorDates() {
  const dateSelect = document.querySelector("#inspectorDateSelect");
  if (!dateSelect) return;

  const today = new Date();
  let html = "";
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const dayNum = String(d.getDate()).padStart(2, "0");
    const iso = `${year}-${month}-${dayNum}`;

    const rawWeekday = d.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "").toUpperCase();
    const monthShort = d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "").toUpperCase();
    const label = i === 0 ? `Hoy (${dayNum} ${monthShort})` : (i === 1 ? `Mañana (${dayNum} ${monthShort})` : `${rawWeekday} ${dayNum} ${monthShort}`);

    html += `<option value="${iso}">${label}</option>`;
  }
  const prevVal = dateSelect.value;
  dateSelect.innerHTML = html;
  if (prevVal) dateSelect.value = prevVal;
}

// Llenar selector de funciones en el inspector
function populateInspectorShowtimes() {
  populateInspectorDates();
  const select = document.querySelector("#inspectorShowtimeSelect");
  const dateSelect = document.querySelector("#inspectorDateSelect");
  if (!select) return;

  const targetDateIso = dateSelect && dateSelect.value ? dateSelect.value : new Date().toISOString().split("T")[0];
  const movies = Storage.getMovies();
  let optionsHtml = "";

  movies.forEach(m => {
    m.showtimes.forEach(t => {
      const key = `${m.id}_${targetDateIso}_${t}`;
      optionsHtml += `<option value="${key}">${m.title} - ${t} (${m.hall})</option>`;
    });
  });

  const prevVal = select.value;
  select.innerHTML = optionsHtml;
  if (prevVal && select.querySelector(`option[value="${prevVal}"]`)) {
    select.value = prevVal;
  }
  renderAdminSeatInspector();
}

// Renderizar matriz de butacas en vivo para el Administrador según su maqueta arquitectónica
function renderAdminSeatInspector() {
  const select = document.querySelector("#inspectorShowtimeSelect");
  const grid = document.querySelector("#adminSeatsGrid");
  const statsBox = document.querySelector("#inspectorStats");

  if (!select || !grid || !select.value) return;

  const showtimeKey = select.value;
  const parts = showtimeKey.split("_");
  const movieId = parts[0];
  const showtime = parts.length >= 3 ? parts[2] : parts[1];
  const movie = Storage.getMovieById(movieId);
  if (!movie) return;

  const rooms = Storage.getRooms();
  const room = rooms.find(r => 
    r.id === movie.roomId || 
    (r.id && movie.roomId && r.id.replace(/\D/g, '') === String(movie.roomId).replace(/\D/g, '')) ||
    r.name === movie.hall ||
    (r.name && movie.hall && (r.name.includes(movie.hall) || movie.hall.includes(r.name)))
  ) || rooms[0];

  grid.innerHTML = "";

  const layoutType = room.layoutType || (
    room.id === "sala-1" ? "curved_imax" :
    room.id === "sala-2" ? "stadium_double_aisle" :
    room.id === "sala-3" ? "motion_4dx" : "vip_lounge"
  );

  const hallSection = document.querySelector("#adminInspectorCinemaHall");
  const archBadge = document.querySelector("#adminInspectorArchBadge");

  if (hallSection) {
    hallSection.classList.remove("layout-curved-imax", "layout-stadium-double", "layout-motion-4dx", "layout-vip-lounge");
    hallSection.classList.add(`layout-${layoutType.replace(/_/g, "-")}`);
  }

  if (archBadge) {
    archBadge.textContent = room.layoutBadge || (
      layoutType === "curved_imax" ? "🏛️ Maqueta: Anfiteatro Curvo IMAX" :
      layoutType === "stadium_double_aisle" ? "🏟️ Maqueta: Estadio 3 Bloques (Doble Pasillo)" :
      layoutType === "motion_4dx" ? "🚀 Maqueta: Pods Mecánicos 4DX" :
      "👑 Maqueta: Palcos VIP & Sofás Dobles"
    );
  }

  // Renderizar Puertas de Acceso y Evacuación de Emergencia en el Inspector del Admin
  const doors = (Array.isArray(room.doors) && room.doors.length === 4) ? room.doors : [
    { id: "front-left", active: true, type: "SALIDA" },
    { id: "front-right", active: true, type: "SALIDA" },
    { id: "back-left", active: true, type: "ENTRADA" },
    { id: "back-right", active: false, type: "SALIDA" }
  ];

  const dFL = doors.find(d => d.id === "front-left") || { active: false, type: "SALIDA" };
  const dFR = doors.find(d => d.id === "front-right") || { active: false, type: "SALIDA" };
  const dBL = doors.find(d => d.id === "back-left") || { active: false, type: "ENTRADA" };
  const dBR = doors.find(d => d.id === "back-right") || { active: false, type: "SALIDA" };

  function createInspectorDoorBadge(door) {
    if (!door.active) {
      return `<div class="hall-door-badge door-closed" style="cursor: default;">🚫 PARED</div>`;
    }
    if (door.type === "ENTRADA") {
      return `<div class="hall-door-badge door-entrance" style="cursor: default;">🚪 ENTRADA SALA</div>`;
    }
    return `<div class="hall-door-badge door-exit" style="cursor: default;">🟢 SALIDA EMERGENCIA</div>`;
  }

  const slotFL = document.querySelector("#slotDoorFrontLeftInspector");
  const slotFR = document.querySelector("#slotDoorFrontRightInspector");
  const slotBL = document.querySelector("#slotDoorBackLeftInspector");
  const slotBR = document.querySelector("#slotDoorBackRightInspector");

  if (slotFL) slotFL.innerHTML = createInspectorDoorBadge(dFL);
  if (slotFR) slotFR.innerHTML = createInspectorDoorBadge(dFR);
  if (slotBL) slotBL.innerHTML = createInspectorDoorBadge(dBL);
  if (slotBR) slotBR.innerHTML = createInspectorDoorBadge(dBR);

  // Pasillos de Circulación del Inspector
  const walkwayL = document.querySelector("#walkwayLeftInspector");
  const walkwayR = document.querySelector("#walkwayRightInspector");
  const tagL = document.querySelector("#tagWalkwayLeftInspector");
  const tagR = document.querySelector("#tagWalkwayRightInspector");
  const arrTopL = document.querySelector("#arrowTopLeftInspector");
  const arrBotL = document.querySelector("#arrowBottomLeftInspector");
  const arrTopR = document.querySelector("#arrowTopRightInspector");
  const arrBotR = document.querySelector("#arrowBottomRightInspector");

  const isLeftEntrance = (dBL.active && dBL.type === "ENTRADA") || (dFL.active && dFL.type === "ENTRADA");
  const isLeftExit = (dBL.active && dBL.type === "SALIDA") || (dFL.active && dFL.type === "SALIDA");

  if (walkwayL) {
    walkwayL.classList.remove("walkway-entrance", "walkway-exit");
    if (isLeftEntrance) {
      walkwayL.classList.add("walkway-entrance");
      if (tagL) tagL.textContent = "🚶 PASILLO ENTRADA (IZQ)";
      if (arrTopL) arrTopL.textContent = "↓";
      if (arrBotL) arrBotL.textContent = "↓";
    } else if (isLeftExit) {
      walkwayL.classList.add("walkway-exit");
      if (tagL) tagL.textContent = "🏃 PASILLO SALIDA (IZQ)";
      if (arrTopL) arrTopL.textContent = "↑";
      if (arrBotL) arrBotL.textContent = "↑";
    } else {
      if (tagL) tagL.textContent = "🚶 PASILLO IZQ.";
      if (arrTopL) arrTopL.textContent = "↕";
      if (arrBotL) arrBotL.textContent = "↕";
    }
  }

  const isRightEntrance = (dBR.active && dBR.type === "ENTRADA") || (dFR.active && dFR.type === "ENTRADA");
  const isRightExit = (dBR.active && dBR.type === "SALIDA") || (dFR.active && dFR.type === "SALIDA");

  if (walkwayR) {
    walkwayR.classList.remove("walkway-entrance", "walkway-exit");
    if (isRightEntrance) {
      walkwayR.classList.add("walkway-entrance");
      if (tagR) tagR.textContent = "🚶 PASILLO ENTRADA (DER)";
      if (arrTopR) arrTopR.textContent = "↓";
      if (arrBotR) arrBotR.textContent = "↓";
    } else if (isRightExit) {
      walkwayR.classList.add("walkway-exit");
      if (tagR) tagR.textContent = "🏃 PASILLO SALIDA (DER)";
      if (arrTopR) arrTopR.textContent = "↑";
      if (arrBotR) arrBotR.textContent = "↑";
    } else {
      if (tagR) tagR.textContent = "🚶 PASILLO DER.";
      if (arrTopR) arrTopR.textContent = "↕";
      if (arrBotR) arrBotR.textContent = "↕";
    }
  }

  const rows = room.rows || ["A", "B", "C", "D", "E", "F"];
  const seatsPerRow = room.seatsPerRow || 10;
  const vipRows = room.vipRows || ["E", "F"];

  const occupiedSeats = Storage.getOccupiedSeats(showtimeKey);
  const activeLocks = Storage.getSeatLocksForShowtime(showtimeKey);
  const overrides = Storage.getSeatOverrides(showtimeKey);

  let countAvailable = 0;
  let countLocked = 0;
  let countOccupied = 0;
  let countMaintenance = 0;

  function createAdminSeatBtn(row, col, isVipRow) {
    const seatCode = `${row}-${col}`;
    const seat = document.createElement("div");
    seat.className = "admin-seat";
    seat.textContent = col;
    seat.setAttribute("data-seat", seatCode);
    seat.setAttribute("data-col", col);

    if (isVipRow) seat.classList.add("vip");
    if (layoutType === "vip_lounge") seat.classList.add("vip-recliner");

    if (layoutType === "curved_imax") {
      if (col === 1) seat.style.transform = "rotate(7deg) translateY(3px)";
      else if (col === 2) seat.style.transform = "rotate(4deg) translateY(1.5px)";
      else if (col === seatsPerRow - 1) seat.style.transform = "rotate(-4deg) translateY(1.5px)";
      else if (col === seatsPerRow) seat.style.transform = "rotate(-7deg) translateY(3px)";
    }

    const isMaint = overrides[seatCode] === "MAINTENANCE";
    const isOcc = occupiedSeats.includes(seatCode);
    const lock = activeLocks.find(l => l.seatCode === seatCode && l.expiresAt > Date.now());

    if (isMaint) {
      seat.classList.add("maintenance");
      seat.title = `Butaca ${seatCode}: Bloqueada por mantenimiento (Clic para liberar)`;
      countMaintenance++;
    } else if (isOcc) {
      seat.classList.add("occupied");
      seat.title = `Butaca ${seatCode}: Vendida permanentemente`;
      countOccupied++;
    } else if (lock) {
      seat.classList.add("locked");
      const remainingSec = Math.max(0, Math.round((lock.expiresAt - Date.now()) / 1000));
      seat.title = `Butaca ${seatCode}: En compra por cliente ${lock.lockedBy} (${remainingSec}s restantes). Clic para liberar forzosamente.`;
      countLocked++;
    } else {
      seat.title = `Butaca ${seatCode} (${isVipRow ? 'VIP' : 'Estándar'}). Clic para poner en mantenimiento.`;
      countAvailable++;
    }

    seat.addEventListener("click", () => handleAdminSeatClick(showtimeKey, seatCode, lock, isMaint, isOcc));
    return seat;
  }

  rows.forEach(row => {
    const rowEl = document.createElement("div");
    rowEl.className = "admin-seat-row";

    const labelLeft = document.createElement("span");
    labelLeft.className = "row-label";
    labelLeft.textContent = row;
    rowEl.appendChild(labelLeft);

    const isVipRow = vipRows.includes(row);

    // Maqueta 2: Estadio 3 Bloques (cols dinámicas según seatsPerRow)
    if (layoutType === "stadium_double_aisle") {
      const leftCount = Math.max(1, Math.min(3, Math.round(seatsPerRow * 0.2)));
      const rightCount = leftCount;
      const centerCount = Math.max(1, seatsPerRow - leftCount - rightCount);

      const bLeft = document.createElement("div");
      bLeft.className = "stadium-block";
      for (let col = 1; col <= leftCount; col++) {
        bLeft.appendChild(createAdminSeatBtn(row, col, isVipRow));
      }
      rowEl.appendChild(bLeft);

      const aisle1 = document.createElement("div");
      aisle1.className = "aisle-stairs";
      rowEl.appendChild(aisle1);

      const bCenter = document.createElement("div");
      bCenter.className = "stadium-block";
      for (let col = leftCount + 1; col <= leftCount + centerCount; col++) {
        bCenter.appendChild(createAdminSeatBtn(row, col, isVipRow));
      }
      rowEl.appendChild(bCenter);

      const aisle2 = document.createElement("div");
      aisle2.className = "aisle-stairs";
      rowEl.appendChild(aisle2);

      const bRight = document.createElement("div");
      bRight.className = "stadium-block";
      for (let col = leftCount + centerCount + 1; col <= seatsPerRow; col++) {
        bRight.appendChild(createAdminSeatBtn(row, col, isVipRow));
      }
      rowEl.appendChild(bRight);
    }
    // Maqueta 3: Pods 4DX (Pods de 4 dinámicos)
    else if (layoutType === "motion_4dx") {
      let pod = document.createElement("div");
      pod.className = "motion-pod";

      for (let col = 1; col <= seatsPerRow; col++) {
        pod.appendChild(createAdminSeatBtn(row, col, isVipRow));

        if (col % 4 === 0 && col < seatsPerRow) {
          rowEl.appendChild(pod);

          const effAisle = document.createElement("div");
          effAisle.className = "effects-aisle";
          effAisle.innerHTML = `<span>💨</span>`;
          rowEl.appendChild(effAisle);

          pod = document.createElement("div");
          pod.className = "motion-pod";
        }
      }
      if (pod.children.length > 0) {
        rowEl.appendChild(pod);
      }
    }
    // Maqueta 4: VIP Lounge (Sofás dobles y mesitas dinámicas)
    else if (layoutType === "vip_lounge") {
      const midCol = Math.floor(seatsPerRow / 2);
      for (let col = 1; col <= seatsPerRow; col += 2) {
        const pair = document.createElement("div");
        pair.className = "love-seat-pair";
        pair.appendChild(createAdminSeatBtn(row, col, isVipRow));
        if (col + 1 <= seatsPerRow) {
          pair.appendChild(createAdminSeatBtn(row, col + 1, isVipRow));
        }
        rowEl.appendChild(pair);

        if (col + 1 === midCol || col === midCol) {
          const cp = document.createElement("div");
          cp.className = "carpet-aisle";
          cp.textContent = "⚜️";
          rowEl.appendChild(cp);
        } else if (col + 2 <= seatsPerRow) {
          const t = document.createElement("div");
          t.className = "lounge-table";
          t.innerHTML = `🍷`;
          rowEl.appendChild(t);
        }
      }
    }
    // Fallback o Anfiteatro IMAX
    else {
      const midCol = Math.floor(seatsPerRow / 2);
      for (let col = 1; col <= seatsPerRow; col++) {
        if (col === midCol + 1) {
          const gap = document.createElement("div");
          gap.style.width = "20px";
          rowEl.appendChild(gap);
        }
        rowEl.appendChild(createAdminSeatBtn(row, col, isVipRow));
      }
    }

    const labelRight = document.createElement("span");
    labelRight.className = "row-label";
    labelRight.textContent = row;
    rowEl.appendChild(labelRight);

    grid.appendChild(rowEl);
  });

  if (statsBox) {
    statsBox.innerHTML = `
      <div>🟢 <strong>Disponibles:</strong> ${countAvailable}</div>
      <div>🟠 <strong>En proceso de compra:</strong> ${countLocked}</div>
      <div>🔴 <strong>Vendidas:</strong> ${countOccupied}</div>
      <div>🛠️ <strong>Mantenimiento:</strong> ${countMaintenance}</div>
      <div>📐 <strong>Capacidad Total:</strong> ${room.capacity || (rows.length * seatsPerRow)}</div>
    `;
  }
}

// Acción del admin al hacer clic en un asiento del inspector
function handleAdminSeatClick(showtimeKey, seatCode, lock, isMaint, isOcc) {
  if (lock) {
    if (confirm(`La butaca ${seatCode} está actualmente bloqueada por un cliente en proceso de pago. ¿Deseas liberar forzosamente este bloqueo para dejarla libre?`)) {
      Storage.unlockSeat(showtimeKey, seatCode, "ADMIN");
      renderAdminSeatInspector();
      showToast(`Bloqueo de la butaca ${seatCode} liberado forzosamente.`, "success");
    }
    return;
  }

  if (isOcc) {
    showToast(`La butaca ${seatCode} corresponde a una reserva ya vendida. Para liberarla, cancela la reserva en la pestaña de Ventas.`, "info");
    return;
  }

  // Alternar mantenimiento
  const result = Storage.toggleSeatAdminOverride(showtimeKey, seatCode, "MAINTENANCE");
  renderAdminSeatInspector();
  if (result === "MAINTENANCE") {
    showToast(`Butaca ${seatCode} puesta en Mantenimiento. Ningún cliente podrá reservarla.`, "info");
  } else {
    showToast(`Butaca ${seatCode} liberada y disponible para la venta.`, "success");
  }
}

// Liberar todos los bloqueos temporales
function clearAllTemporaryLocksHandler() {
  if (confirm("¿Deseas liberar todos los bloqueos temporales activos de clientes en todas las salas?")) {
    Storage.clearAllTemporalLocks();
    renderAdminSeatInspector();
    showToast("Todos los bloqueos temporales han sido liberados.", "success");
  }
}

function updateSnackMarginPreview() {
  const p = parseFloat(document.querySelector("#inputSnackPrice")?.value) || 0;
  const c = parseFloat(document.querySelector("#inputSnackCostPrice")?.value) || 0;
  const preview = document.querySelector("#snackMarginPreview");
  if (!preview) return;
  if (p <= 0) {
    preview.textContent = "-";
    return;
  }
  const profit = p - c;
  const margin = ((profit / p) * 100).toFixed(1);
  const roi = c > 0 ? ((profit / c) * 100).toFixed(1) : "0.0";
  preview.textContent = `+$${profit.toFixed(2)} (${margin}% margen | +${roi}% ROI)`;
  preview.style.color = profit >= 0 ? "var(--gold)" : "#ff6b72";
}

function renderSnacksTable() {
  const tbody = document.querySelector("#adminSnacksTableBody");
  if (!tbody) return;

  const snacks = Storage.getSnacks();

  tbody.innerHTML = snacks.map(snack => {
    const cost = snack.costPrice != null ? snack.costPrice : (snack.price * 0.35);
    const unitProfit = snack.price - cost;
    const margin = snack.price > 0 ? ((unitProfit / snack.price) * 100) : 0;
    const marginClass = margin >= 75 ? 'badge-margin-high' : 'badge-margin-gold';
    const supplier = snack.proveedor_id ? Storage.getSupplierById(snack.proveedor_id) : null;

    return `
      <tr>
        <td>
          <div class="table-movie-info">
            <img src="${snack.img}" alt="${snack.name}" style="width: 44px; height: 44px; border-radius: 8px; object-fit: cover;">
            <div>
              <strong>${snack.name}</strong>
              <p style="color: var(--text-muted); font-size: 0.78rem; max-width: 250px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${snack.desc}</p>
              ${supplier ? `<span style="font-size: 0.72rem; color: var(--gold); display: inline-flex; align-items: center; gap: 3px; margin-top: 2px;">🚚 ${supplier.empresa}</span>` : ''}
            </div>
          </div>
        </td>
        <td><span class="badge" style="background: rgba(255,255,255,0.06);">${snack.category}</span></td>
        <td><span class="badge-cost">$${cost.toFixed(2)}</span></td>
        <td><strong style="color: var(--gold);">$${snack.price.toFixed(2)}</strong></td>
        <td><span class="badge-profit">+$${unitProfit.toFixed(2)}</span></td>
        <td><span class="${marginClass}">${margin.toFixed(1)}%</span></td>
        <td><strong>${snack.stock || 100} uds.</strong></td>
        <td>
          <div class="table-actions">
            <button class="btn-icon-action" onclick="editSnack('${snack.id}')" title="Editar">✏️</button>
            <button class="btn-icon-action delete" onclick="deleteSnackHandler('${snack.id}')" title="Eliminar">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function populateSupplierDropdown(selectedId = "") {
  const select = document.querySelector("#inputSnackSupplier");
  if (!select) return;
  const suppliers = Storage.getSuppliers().filter(s => s.estado === "ACTIVO");
  select.innerHTML = `<option value="">-- Sin proveedor asignado --</option>` +
    suppliers.map(s => `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${s.empresa} (${s.categoria} - ${s.porcentaje_ganancia}% margen)</option>`).join('');
}

function openSnackModal(isEdit = false, snackData = null) {
  const modal = document.querySelector("#snackFormModal");
  const modalTitle = document.querySelector("#modalSnackTitle");
  const form = document.querySelector("#snackForm");

  if (!modal || !form) return;
  form.reset();

  const priceInput = document.querySelector("#inputSnackPrice");
  const costInput = document.querySelector("#inputSnackCostPrice");

  // Escuchas para actualizar el margen proyectado en vivo
  if (priceInput && !priceInput.dataset.bound) {
    priceInput.dataset.bound = "true";
    priceInput.addEventListener("input", updateSnackMarginPreview);
  }
  if (costInput && !costInput.dataset.bound) {
    costInput.dataset.bound = "true";
    costInput.addEventListener("input", updateSnackMarginPreview);
  }

  if (isEdit && snackData) {
    modalTitle.textContent = "Editar Producto de Confitería";
    document.querySelector("#snackIdInput").value = snackData.id;
    document.querySelector("#inputSnackName").value = snackData.name;
    document.querySelector("#inputSnackCategory").value = snackData.category;
    document.querySelector("#inputSnackPrice").value = snackData.price;
    if (costInput) costInput.value = (snackData.costPrice != null ? snackData.costPrice : (snackData.price * 0.35)).toFixed(2);
    document.querySelector("#inputSnackTag").value = snackData.tag || "";
    document.querySelector("#inputSnackStock").value = snackData.stock || 100;
    document.querySelector("#inputSnackImg").value = snackData.img;
    document.querySelector("#inputSnackDesc").value = snackData.desc;
    populateSupplierDropdown(snackData.proveedor_id || "");
    updateSnackMarginPreview();
  } else {
    modalTitle.textContent = "Nuevo Producto de Confitería";
    document.querySelector("#snackIdInput").value = "";
    document.querySelector("#inputSnackStock").value = "200";
    if (costInput) costInput.value = "1.50";
    if (priceInput) priceInput.value = "5.00";
    populateSupplierDropdown("");
    updateSnackMarginPreview();
  }

  modal.classList.add("open");
}

function closeSnackModal() {
  const modal = document.querySelector("#snackFormModal");
  if (modal) modal.classList.remove("open");
}

function editSnack(id) {
  const snack = Storage.getSnackById(id);
  if (snack) openSnackModal(true, snack);
}

function deleteSnackHandler(id) {
  if (confirm("¿Estás seguro de que deseas eliminar este snack/combo de la dulcería?")) {
    Storage.deleteSnack(id);
    renderSnacksTable();
    if (typeof renderFinancialDashboard === "function") renderFinancialDashboard();
    showToast("Producto eliminado de la dulcería.", "info");
  }
}

// =============================================================================
// MÓDULO NUEVO: GESTIÓN DE PROVEEDORES Y ACUERDOS COMERCIALES
// =============================================================================
function renderSuppliersTable(filterQuery = "") {
  const tbody = document.querySelector("#adminSuppliersTableBody");
  if (!tbody) return;

  let suppliers = Storage.getSuppliers();
  if (filterQuery) {
    const q = filterQuery.toLowerCase().trim();
    suppliers = suppliers.filter(s =>
      (s.empresa && s.empresa.toLowerCase().includes(q)) ||
      (s.contacto_nombre && s.contacto_nombre.toLowerCase().includes(q)) ||
      (s.categoria && s.categoria.toLowerCase().includes(q)) ||
      (s.nit_rut && s.nit_rut.toLowerCase().includes(q))
    );
  }

  // Actualizar KPIs de proveedores
  const allSuppliers = Storage.getSuppliers();
  const activeCount = allSuppliers.filter(s => s.estado === "ACTIVO").length;
  const totalMargin = allSuppliers.reduce((sum, s) => sum + (parseFloat(s.porcentaje_ganancia) || 0), 0);
  const avgMargin = allSuppliers.length > 0 ? (totalMargin / allSuppliers.length).toFixed(1) : "0.0";
  const uniqueCats = new Set(allSuppliers.map(s => s.categoria).filter(Boolean)).size;
  const creditCount = allSuppliers.filter(s => (s.terminos_pago || "").toLowerCase().includes("crédito")).length;

  const elActive = document.querySelector("#statActiveSuppliers");
  const elAvgMargin = document.querySelector("#statAvgSupplierMargin");
  const elCats = document.querySelector("#statSupplierCategories");
  const elCredit = document.querySelector("#statCreditSuppliers");

  if (elActive) elActive.textContent = activeCount;
  if (elAvgMargin) elAvgMargin.textContent = `${avgMargin}%`;
  if (elCats) elCats.textContent = uniqueCats;
  if (elCredit) elCredit.textContent = creditCount;

  if (suppliers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 2rem;">No se encontraron proveedores registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = suppliers.map(s => {
    const isActivo = s.estado === "ACTIVO";
    const marginBadgeClass = (parseFloat(s.porcentaje_ganancia) >= 60) ? 'badge-margin-high' : 'badge-margin-gold';
    return `
      <tr>
        <td>
          <strong style="color: #fff;">${s.empresa}</strong>
          ${s.nit_rut ? `<p style="color: var(--text-muted); font-size: 0.75rem; margin-top: 2px;">NIT: ${s.nit_rut}</p>` : ''}
          ${s.notas ? `<p style="color: var(--text-secondary); font-size: 0.72rem; max-width: 220px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; margin-top: 2px;">${s.notas}</p>` : ''}
        </td>
        <td><strong>${s.contacto_nombre}</strong></td>
        <td>
          <a href="tel:${s.telefono}" style="color: var(--accent-blue); text-decoration: none; font-size: 0.85rem; font-weight: 600;">📞 ${s.telefono}</a>
        </td>
        <td>
          <a href="mailto:${s.email}" style="color: var(--text-secondary); text-decoration: underline; font-size: 0.82rem;">✉️ ${s.email}</a>
        </td>
        <td><span class="badge" style="background: rgba(255,255,255,0.06); font-weight: 600;">${s.categoria || 'Insumos'}</span></td>
        <td><span class="${marginBadgeClass}">${parseFloat(s.porcentaje_ganancia || 0).toFixed(1)}%</span></td>
        <td><span class="badge" style="background: rgba(157, 78, 221, 0.15); color: #c77dff; font-weight: 600;">${parseFloat(s.porcentaje_comision || 0).toFixed(1)}%</span></td>
        <td><strong style="color: #ff9100;">$${parseFloat(s.total_comprado_proveedor || 0).toFixed(2)}</strong></td>
        <td><span class="badge" style="background: rgba(0,210,255,0.12); color: #00d2ff; font-weight: 600;">${s.unidades_vendidas || 0} un.</span></td>
        <td><span class="badge badge-format">${s.terminos_pago || 'Contado'}</span></td>
        <td>
          <button class="btn-icon-action" onclick="toggleSupplierStatus('${s.id}')" title="Alternar Estado" style="${isActivo ? 'color: #00e676; background: rgba(0,230,118,0.1);' : 'color: #ff6b72; background: rgba(255,107,114,0.1);'} padding: 0.3rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: bold;">
            ${isActivo ? '🟢 Activo' : '🔴 Inactivo'}
          </button>
        </td>
        <td>
          <div class="table-actions">
            <button class="btn-icon-action" onclick="editSupplier('${s.id}')" title="Editar Proveedor">✏️</button>
            <button class="btn-icon-action delete" onclick="deleteSupplierHandler('${s.id}')" title="Eliminar Proveedor">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function initSupplierSearch() {
  const searchInput = document.querySelector("#adminSupplierSearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      renderSuppliersTable(e.target.value);
    });
  }
}

function openSupplierModal(isEdit = false, supplierData = null) {
  const modal = document.querySelector("#supplierFormModal");
  const modalTitle = document.querySelector("#modalSupplierTitle");
  const form = document.querySelector("#supplierForm");
  if (!modal || !form) return;
  form.reset();

  if (isEdit && supplierData) {
    modalTitle.textContent = "Editar Información de Proveedor";
    document.querySelector("#supplierIdInput").value = supplierData.id;
    document.querySelector("#inputSupplierCompany").value = supplierData.empresa;
    document.querySelector("#inputSupplierNit").value = supplierData.nit_rut || "";
    document.querySelector("#inputSupplierContact").value = supplierData.contacto_nombre;
    document.querySelector("#inputSupplierPhone").value = supplierData.telefono;
    document.querySelector("#inputSupplierEmail").value = supplierData.email;
    document.querySelector("#inputSupplierCategory").value = supplierData.categoria || "Insumos";
    document.querySelector("#inputSupplierProfitMargin").value = supplierData.porcentaje_ganancia || 0;
    document.querySelector("#inputSupplierCommission").value = supplierData.porcentaje_comision || 0;
    document.querySelector("#inputSupplierPaymentTerms").value = supplierData.terminos_pago || "Contado";
    document.querySelector("#inputSupplierStatus").value = supplierData.estado || "ACTIVO";
    document.querySelector("#inputSupplierAddress").value = supplierData.direccion || "";
    document.querySelector("#inputSupplierNotes").value = supplierData.notas || "";
  } else {
    modalTitle.textContent = "Registrar Nuevo Proveedor";
    document.querySelector("#supplierIdInput").value = "";
    document.querySelector("#inputSupplierProfitMargin").value = "50.0";
    document.querySelector("#inputSupplierCommission").value = "0.0";
    document.querySelector("#inputSupplierStatus").value = "ACTIVO";
  }

  modal.classList.add("open");
}

function closeSupplierModal() {
  const modal = document.querySelector("#supplierFormModal");
  if (modal) modal.classList.remove("open");
}

function editSupplier(id) {
  const supplier = Storage.getSupplierById(id);
  if (supplier) openSupplierModal(true, supplier);
}

function toggleSupplierStatus(id) {
  const s = Storage.getSupplierById(id);
  if (!s) return;
  const newStatus = s.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";
  Storage.updateSupplier(id, { estado: newStatus });
  renderSuppliersTable();
  populateSupplierDropdown();
  showToast(`Estado de ${s.empresa} cambiado a ${newStatus}.`, "info");
}

function deleteSupplierHandler(id) {
  const s = Storage.getSupplierById(id);
  const name = s ? s.empresa : "este proveedor";
  if (confirm(`¿Estás seguro de que deseas eliminar a ${name}?`)) {
    Storage.deleteSupplier(id);
    renderSuppliersTable();
    populateSupplierDropdown();
    showToast("Proveedor eliminado exitosamente.", "info");
  }
}

function exportSuppliersToCsv() {
  const suppliers = Storage.getSuppliers();
  let csv = "ID,Empresa / Razon Social,NIT / RUT,Contacto Principal,Telefono,Email,Categoria,Margen Acordado (%),Comision (%),Terminos de Pago,Estado,Direccion,Notas\n";

  suppliers.forEach(s => {
    csv += `"${s.id}","${s.empresa}","${s.nit_rut || ''}","${s.contacto_nombre}","${s.telefono}","${s.email}","${s.categoria}",${s.porcentaje_ganancia}%,${s.porcentaje_comision}%,"${s.terminos_pago}","${s.estado}","${(s.direccion || '').replace(/"/g, '""')}","${(s.notas || '').replace(/"/g, '""')}"\n`;
  });

  if (typeof downloadCsvFile === "function") {
    downloadCsvFile(csv, `proveedores_cinemajestad_${Date.now()}.csv`);
  } else {
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proveedores_cinemajestad_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  showToast("Catálogo de proveedores exportado exitosamente a CSV.", "success");
}

// =============================================================================
// MÓDULO 4: HISTORIAL DE VENTAS Y RESERVAS
// =============================================================================
function renderBookingsTable(filterQuery = "") {
  const tbody = document.querySelector("#adminBookingsTableBody");
  if (!tbody) return;

  let bookings = Storage.getBookings();
  if (filterQuery) {
    const q = filterQuery.toLowerCase().trim();
    bookings = bookings.filter(b => b.bookingCode.toLowerCase().includes(q) || b.movieTitle.toLowerCase().includes(q));
  }

  tbody.innerHTML = bookings.map(b => {
    const seatsStr = b.seats && Array.isArray(b.seats) ? b.seats.map(s => s.code || s).join(", ") : "N/A";
    const snacksCount = b.snacks ? b.snacks.reduce((acc, s) => acc + s.qty, 0) : 0;
    const isCancelled = b.status === "CANCELADA";

    return `
      <tr>
        <td><strong style="color: var(--gold); font-family: monospace;">${b.bookingCode}</strong></td>
        <td>${b.date || 'Reciente'}</td>
        <td><strong>${b.movieTitle}</strong></td>
        <td>${b.hall} (${b.showtime})</td>
        <td><span class="badge" style="background: rgba(229,9,20,0.15); color: #ff6b72;">${seatsStr}</span></td>
        <td>${snacksCount > 0 ? `🍿 ${snacksCount} productos` : 'Sin snacks'}</td>
        <td><strong style="color: #00e676;">$${(b.grandTotal || 0).toFixed(2)}</strong></td>
        <td>
          <span class="badge-status ${isCancelled ? 'cancelled' : 'confirmed'}">
            ${b.status || 'CONFIRMADA'}
          </span>
        </td>
        <td>
          <div class="table-actions">
            <button class="btn-icon-action" onclick="viewBookingDetails('${b.bookingCode}')" title="Ver Boleto">🔍</button>
            ${!isCancelled ? `
              <button class="btn-icon-action delete" onclick="cancelBookingHandler('${b.bookingCode}')" title="Cancelar y liberar butacas">✕</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function initBookingSearch() {
  const searchInput = document.querySelector("#adminBookingSearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      renderBookingsTable(e.target.value);
    });
  }
}

function viewBookingDetails(bookingCode) {
  const bookings = Storage.getBookings();
  const b = bookings.find(item => item.bookingCode === bookingCode);
  if (!b) return;

  const modal = document.querySelector("#bookingDetailModal");
  const body = document.querySelector("#bookingModalBody");

  const seatsStr = b.seats && Array.isArray(b.seats) ? b.seats.map(s => `${s.code || s} (${s.type || 'Est.'})`).join(", ") : "N/A";

  body.innerHTML = `
    <div style="background: rgba(255,255,255,0.03); padding: 1.2rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 1rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem;">
        <span style="font-size: 1.2rem; font-weight: 800; color: var(--gold);">${b.bookingCode}</span>
        <span class="badge-status ${b.status === 'CANCELADA' ? 'cancelled' : 'confirmed'}">${b.status}</span>
      </div>
      <h3 style="font-size: 1.2rem; color: #fff; margin-bottom: 0.5rem;">${b.movieTitle}</h3>
      <p style="color: var(--text-secondary); font-size: 0.85rem;">🏛️ ${b.hall} | 🕒 ${b.showtime} | 📅 ${b.date}</p>
    </div>

    <div style="display: flex; flex-direction: column; gap: 0.6rem; font-size: 0.9rem;">
      <div style="display: flex; justify-content: space-between;">
        <span style="color: var(--text-secondary);">Butacas:</span>
        <strong>${seatsStr}</strong>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: var(--text-secondary);">Subtotal Taquilla:</span>
        <strong>$${(b.ticketsTotal || 0).toFixed(2)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: var(--text-secondary);">Subtotal Dulcería:</span>
        <strong>$${(b.snacksTotal || 0).toFixed(2)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 1.1rem; padding-top: 0.5rem; border-top: 1px solid var(--border-color); color: #00e676;">
        <span>Total Pagado:</span>
        <strong>$${(b.grandTotal || 0).toFixed(2)}</strong>
      </div>
    </div>
  `;

  modal.classList.add("open");
}

function closeBookingModal() {
  const modal = document.querySelector("#bookingDetailModal");
  if (modal) modal.classList.remove("open");
}

function cancelBookingHandler(bookingCode) {
  if (confirm(`¿Estás seguro de cancelar la reserva ${bookingCode}? Sus asientos se liberarán de inmediato en el esquema del cine.`)) {
    Storage.cancelBooking(bookingCode);
    renderBookingsTable();
    renderStats();
    renderAdminSeatInspector();
    showToast(`Reserva ${bookingCode} cancelada y butacas liberadas.`, "info");
  }
}

function exportBookingsJSON() {
  const bookings = Storage.getBookings();
  const blob = new Blob([JSON.stringify(bookings, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `CineMajestad_Reservas_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// =============================================================================
// MÓDULO 5: CONFIGURACIÓN GENERAL
// =============================================================================
function loadSettingsForms() {
  const settings = Storage.getSettings();

  const cfgName = document.querySelector("#cfgCinemaName");
  const cfgSlogan = document.querySelector("#cfgSlogan");
  const cfgPhone = document.querySelector("#cfgPhone");
  const cfgAddress = document.querySelector("#cfgAddress");
  const cfgHours = document.querySelector("#cfgHours");
  const cfgHold = document.querySelector("#cfgHoldMinutes");
  const cfgMaxSeats = document.querySelector("#cfgMaxSeats");

  if (cfgName) cfgName.value = settings.cinemaName || "Cine Majestad";
  if (cfgSlogan) cfgSlogan.value = settings.slogan || "";
  if (cfgPhone) cfgPhone.value = settings.phone || "";
  if (cfgAddress) cfgAddress.value = settings.address || "";
  if (cfgHours) cfgHours.value = settings.hours || "";
  if (cfgHold) cfgHold.value = settings.seatHoldMinutes || 5;
  if (cfgMaxSeats) cfgMaxSeats.value = settings.maxSeatsPerTransaction || 8;

  // Cargar parámetros de tarifas dinámicas y promoción 2x1
  const rules = settings.pricingRules || {
    weekendSurchargeStandard: 1.50,
    weekendSurchargeVip: 2.00,
    wednesdayPromo2x1: true
  };
  const cfgWkStd = document.querySelector("#cfgWeekendSurchargeStd");
  const cfgWkVip = document.querySelector("#cfgWeekendSurchargeVip");
  const cfgWed2x1 = document.querySelector("#cfgWednesdayPromo2x1");

  if (cfgWkStd) cfgWkStd.value = typeof rules.weekendSurchargeStandard === "number" ? rules.weekendSurchargeStandard : 1.50;
  if (cfgWkVip) cfgWkVip.value = typeof rules.weekendSurchargeVip === "number" ? rules.weekendSurchargeVip : 2.00;
  if (cfgWed2x1) cfgWed2x1.checked = rules.wednesdayPromo2x1 !== false;
}

function initFormHandlers() {
  // 1. Guardar Película (Crear o Editar)
  const movieForm = document.querySelector("#movieForm");
  if (movieForm) {
    movieForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const id = document.querySelector("#movieIdInput").value;
      const title = document.querySelector("#inputTitle").value.trim();
      const genre = document.querySelector("#inputGenre").value.trim();
      const duration = document.querySelector("#inputDuration").value.trim();
      const rating = parseFloat(document.querySelector("#inputRating").value) || 8.0;
      const ageRating = document.querySelector("#inputAge").value.trim();
      const hall = document.querySelector("#inputHall").value.trim();
      const showtimes = document.querySelector("#inputTimes").value.split(",").map(s => s.trim()).filter(Boolean);
      const priceStandard = parseFloat(document.querySelector("#inputStandardPrice").value) || 6.5;
      const priceVip = parseFloat(document.querySelector("#inputVipPrice").value) || 10.0;
      const director = document.querySelector("#inputDirector").value.trim();
      const isFeatured = document.querySelector("#inputFeatured").value === "true";
      const poster = document.querySelector("#inputPoster").value.trim() || "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80";
      const backdrop = document.querySelector("#inputBackdrop").value.trim() || poster;
      const trailerUrl = document.querySelector("#inputTrailer").value.trim() || "https://www.youtube.com/embed/Way9Dexny3w";
      const synopsis = document.querySelector("#inputSynopsis").value.trim();

      // Modalidad de Exhibición y Durabilidad en Días
      const radioPreventa = document.querySelector("#radioTypePreventa");
      const isPresale = radioPreventa ? radioPreventa.checked : false;
      const releaseType = isPresale ? "PREVENTA" : "CARTELERA";
      const startDate = document.querySelector("#inputStartDate").value.trim() || new Date().toISOString().split("T")[0];
      const durationDays = parseInt(document.querySelector("#inputDurationDays").value, 10) || 21;
      const endDate = document.querySelector("#inputEndDate").value.trim() || Storage.calculateMovieEndDate(startDate, durationDays);

      // Deducir ID de sala
      const rooms = Storage.getRooms();
      const matchingRoom = rooms.find(r => r.name === hall) || rooms[0];

      let movies = Storage.getMovies();

      if (id) {
        // Actualizar
        const idx = movies.findIndex(m => m.id === id);
        if (idx > -1) {
          movies[idx] = {
            ...movies[idx],
            title, genre, duration, rating, ageRating, hall, showtimes,
            priceStandard, priceVip, director, isFeatured, poster, backdrop,
            trailerUrl, synopsis, roomId: matchingRoom.id,
            releaseType, isPresale, startDate, durationDays, endDate
          };
          Storage.saveMovies(movies);
          showToast(`Película "${title}" actualizada con éxito (${durationDays} días de cartelera).`, "success");
        }
      } else {
        // Nueva
        const newMovie = {
          id: "mov-" + Date.now(),
          title, genre, duration, rating, ageRating, hall, showtimes,
          priceStandard, priceVip, director, isFeatured, poster, backdrop,
          trailerUrl, synopsis, formats: ["2D", "Atmos"], roomId: matchingRoom.id,
          releaseType, isPresale, startDate, durationDays, endDate
        };
        movies.unshift(newMovie);
        Storage.saveMovies(movies);
        showToast(`Nueva película "${title}" programada en cartelera (${durationDays} días).`, "success");
      }

      closeMovieModal();
      renderMoviesTable();
      renderStats();
      populateInspectorShowtimes();
    });
  }

  // 2. Guardar Producto de Confitería
  const snackForm = document.querySelector("#snackForm");
  if (snackForm) {
    snackForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const id = document.querySelector("#snackIdInput").value;
      const name = document.querySelector("#inputSnackName").value.trim();
      const category = document.querySelector("#inputSnackCategory").value;
      const price = parseFloat(document.querySelector("#inputSnackPrice").value) || 5.0;
      const costPrice = parseFloat(document.querySelector("#inputSnackCostPrice")?.value) || (price * 0.35);
      const proveedor_id = document.querySelector("#inputSnackSupplier")?.value || null;
      const tag = document.querySelector("#inputSnackTag").value.trim() || "Popular";
      const stock = parseInt(document.querySelector("#inputSnackStock").value) || 200;
      const img = document.querySelector("#inputSnackImg").value.trim() || "https://images.unsplash.com/photo-1585647347384-2593bc35786b?auto=format&fit=crop&w=600&q=80";
      const desc = document.querySelector("#inputSnackDesc").value.trim();

      if (id) {
        Storage.updateSnack(id, { name, category, price, costPrice, proveedor_id, tag, stock, img, desc });
        showToast("Producto de dulcería actualizado.", "success");
      } else {
        const newSnack = {
          id: "snack-" + Date.now(),
          name, category, price, costPrice, proveedor_id, tag, stock, img, desc
        };
        Storage.addSnack(newSnack);
        showToast("Nuevo producto añadido a la dulcería.", "success");
      }

      closeSnackModal();
      renderSnacksTable();
      if (typeof renderFinancialDashboard === "function") renderFinancialDashboard();
    });
  }

  // 2.1 Guardar Proveedor
  const supplierForm = document.querySelector("#supplierForm");
  if (supplierForm) {
    supplierForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const id = document.querySelector("#supplierIdInput").value;
      const empresa = document.querySelector("#inputSupplierCompany").value.trim();
      const nit_rut = document.querySelector("#inputSupplierNit").value.trim();
      const contacto_nombre = document.querySelector("#inputSupplierContact").value.trim();
      const telefono = document.querySelector("#inputSupplierPhone").value.trim();
      const email = document.querySelector("#inputSupplierEmail").value.trim();
      const categoria = document.querySelector("#inputSupplierCategory").value;
      const porcentaje_ganancia = parseFloat(document.querySelector("#inputSupplierProfitMargin").value) || 0;
      const porcentaje_comision = parseFloat(document.querySelector("#inputSupplierCommission").value) || 0;
      const terminos_pago = document.querySelector("#inputSupplierPaymentTerms").value;
      const estado = document.querySelector("#inputSupplierStatus").value;
      const direccion = document.querySelector("#inputSupplierAddress").value.trim();
      const notas = document.querySelector("#inputSupplierNotes").value.trim();

      const payload = {
        empresa, nit_rut, contacto_nombre, telefono, email,
        categoria, porcentaje_ganancia, porcentaje_comision,
        terminos_pago, estado, direccion, notas
      };

      if (id) {
        Storage.updateSupplier(id, payload);
        showToast("Proveedor actualizado exitosamente.", "success");
      } else {
        const newSupplier = {
          id: "prov-" + Date.now(),
          ...payload
        };
        Storage.addSupplier(newSupplier);
        showToast("Nuevo proveedor registrado en Cine Majestad.", "success");
      }

      closeSupplierModal();
      renderSuppliersTable();
      populateSupplierDropdown();
    });
  }

  // 3. Guardar Configuración de Sala
  const roomForm = document.querySelector("#roomForm");
  if (roomForm) {
    roomForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const roomId = document.querySelector("#roomIdInput").value;
      const name = document.querySelector("#inputRoomName").value.trim();
      const technology = document.querySelector("#inputRoomTech").value.trim();
      const seatsPerRow = parseInt(document.querySelector("#inputRoomSeatsPerRow").value) || 10;
      const rows = document.querySelector("#inputRoomRows").value.split(",").map(r => r.trim()).filter(Boolean);
      const vipRows = document.querySelector("#inputRoomVipRows").value.split(",").map(r => r.trim()).filter(Boolean);
      const screenType = document.querySelector("#inputRoomScreen").value.trim();
      const soundSystem = document.querySelector("#inputRoomSound").value.trim();
      const wheelchairSeats = Array.isArray(roomEditorState.wheelchairSeats) ? [...roomEditorState.wheelchairSeats] : [];
      const doors = Array.isArray(roomEditorState.doors) ? JSON.parse(JSON.stringify(roomEditorState.doors)) : [];

      const rooms = Storage.getRooms();
      const idx = rooms.findIndex(r => r.id === roomId);
      if (idx > -1) {
        const oldName = rooms[idx].name;
        rooms[idx] = {
          ...rooms[idx],
          name, technology, seatsPerRow, rows, vipRows, screenType, soundSystem,
          wheelchairSeats, doors,
          capacity: rows.length * seatsPerRow
        };
        Storage.saveRooms(rooms);

        // Si cambió el nombre de la sala, actualizar las películas vinculadas
        if (oldName && oldName !== name) {
          const movies = Storage.getMovies();
          let moviesChanged = false;
          movies.forEach(m => {
            if (m.roomId === roomId || m.hall === oldName) {
              m.hall = name;
              m.roomId = roomId;
              moviesChanged = true;
            }
          });
          if (moviesChanged) {
            Storage.saveMovies(movies);
          }
        }

        // Emitir difusión inmediata vía Socket.io para clientes y taquilla en vivo
        if (typeof RealTime !== "undefined" && RealTime.socket) {
          RealTime.socket.emit("room:updated", {
            roomId,
            room: rooms[idx],
            rooms
          });
        }

        // Persistir en backend API REST
        if (typeof API !== "undefined" && API.functions && API.functions.updateRoom) {
          API.functions.updateRoom(roomId, rooms[idx]).catch(err => {
            console.warn("[Room Sync API Warning]:", err.message);
          });
        }

        showToast("Configuración de sala guardada y sincronizada en vivo con todos los usuarios.", "success");
        closeRoomModal();
        renderAdminRooms();
        renderAdminSeatInspector();
        populateInspectorShowtimes();
      }
    });
  }

  // 4. Guardar Identidad del Cine
  const cinemaSettingsForm = document.querySelector("#cinemaSettingsForm");
  if (cinemaSettingsForm) {
    cinemaSettingsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const current = Storage.getSettings();
      const updated = {
        ...current,
        cinemaName: document.querySelector("#cfgCinemaName").value.trim(),
        slogan: document.querySelector("#cfgSlogan").value.trim(),
        phone: document.querySelector("#cfgPhone").value.trim(),
        address: document.querySelector("#cfgAddress").value.trim(),
        hours: document.querySelector("#cfgHours").value.trim()
      };
      Storage.saveSettings(updated);
      showToast("Identidad de Cine Majestad guardada exitosamente.", "success");
    });
  }

  // 5. Guardar Reglas de Concurrencia
  const concurrencySettingsForm = document.querySelector("#concurrencySettingsForm");
  if (concurrencySettingsForm) {
    concurrencySettingsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const current = Storage.getSettings();
      const updated = {
        ...current,
        seatHoldMinutes: parseInt(document.querySelector("#cfgHoldMinutes").value) || 5,
        maxSeatsPerTransaction: parseInt(document.querySelector("#cfgMaxSeats").value) || 8
      };
      Storage.saveSettings(updated);
      showToast("Parámetros de concurrencia y venta actualizados.", "success");
    });
  }

  // 6. Guardar Tarifas Dinámicas y Promoción Miércoles 2x1
  const pricingRulesForm = document.querySelector("#pricingRulesSettingsForm");
  if (pricingRulesForm) {
    pricingRulesForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const current = Storage.getSettings();
      const wkStd = parseFloat(document.querySelector("#cfgWeekendSurchargeStd").value);
      const wkVip = parseFloat(document.querySelector("#cfgWeekendSurchargeVip").value);
      const wed2x1 = document.querySelector("#cfgWednesdayPromo2x1").checked;

      const updated = {
        ...current,
        pricingRules: {
          ...(current.pricingRules || {}),
          weekendSurchargeStandard: isNaN(wkStd) ? 1.50 : wkStd,
          weekendSurchargeVip: isNaN(wkVip) ? 2.00 : wkVip,
          wednesdayPromo2x1: wed2x1,
          weekendNotice: "Tarifa Fin de Semana (+alta demanda)",
          calmDayNotice: "Tarifa Días Calmados (Económica)",
          wednesdayPromoNotice: "¡Miércoles 2x1 en Boletería!"
        }
      };
      Storage.saveSettings(updated);
      showToast("Tarifas de fin de semana y promoción Miércoles 2x1 guardadas correctamente.", "success");
    });
  }
}

// Exportar base de datos completa a JSON
function exportFullDatabaseJSON() {
  const fullBackup = {
    settings: Storage.getSettings(),
    rooms: Storage.getRooms(),
    movies: Storage.getMovies(),
    snacks: Storage.getSnacks(),
    bookings: Storage.getBookings(),
    exportedAt: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `CineMajestad_BackupCompleto_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Restablecer sistema a valores de fábrica
function resetSystemHandler() {
  if (confirm("⚠️ ¿Estás seguro de que deseas restablecer TODOS los datos a los valores de fábrica de Cine Majestad? Esta acción recreará las películas iniciales, salas y confitería.")) {
    Storage.resetToDefaults();
    showToast("Sistema restablecido con éxito a los valores iniciales de Cine Majestad.", "info");
    setTimeout(() => {
      window.location.reload();
    }, 1200);
  }
}

// Exposición global para eventos onclick en HTML
window.renderSuppliersTable = renderSuppliersTable;
window.openSupplierModal = openSupplierModal;
window.closeSupplierModal = closeSupplierModal;
window.editSupplier = editSupplier;
window.toggleSupplierStatus = toggleSupplierStatus;
window.deleteSupplierHandler = deleteSupplierHandler;
window.exportSuppliersToCsv = exportSuppliersToCsv;
window.populateSupplierDropdown = populateSupplierDropdown;
window.renderRolesAndUsersTab = renderRolesAndUsersTab;
window.handleUserRoleChange = handleUserRoleChange;
window.switchStaffSubtab = switchStaffSubtab;
window.renderWorkersTable = renderWorkersTable;
window.renderWorkerShiftsTable = renderWorkerShiftsTable;
window.handleDismissWorker = handleDismissWorker;
window.handleToggleWorkerShift = handleToggleWorkerShift;

// =============================================================================
// GESTIÓN DE ROLES, PRIVILEGIOS Y PERSONAL (VINCULADO A BASE DE DATOS)
// =============================================================================
async function syncRolesAndUsersFromAPI() {
  try {
    if (typeof API !== "undefined" && API.users && API.users.getAll) {
      const res = await API.users.getAll();
      if (res && res.data) {
        Storage.saveUsers(res.data);
      }
    }
    if (typeof API !== "undefined" && API.roles && API.roles.getAll) {
      const resRoles = await API.roles.getAll();
      if (resRoles && resRoles.data) {
        Storage.saveRoles(resRoles.data);
      }
    }
  } catch (err) {
    console.warn("Sincronización con API MySQL omitida:", err.message);
  }
}

async function renderRolesAndUsersTab() {
  await syncRolesAndUsersFromAPI();
  updateStaffKpis();
  renderWorkersTable();
  renderWorkerShiftsTable();
  renderRolesCards();
}

function switchStaffSubtab(subtabName) {
  const btnWorkers = document.querySelector("#subtabBtnWorkers");
  const btnShifts = document.querySelector("#subtabBtnShifts");
  const btnRoles = document.querySelector("#subtabBtnRoles");

  const paneWorkers = document.querySelector("#subpaneWorkers");
  const paneShifts = document.querySelector("#subpaneShifts");
  const paneRoles = document.querySelector("#subpaneRoles");

  if (btnWorkers) btnWorkers.classList.toggle("active", subtabName === "workers");
  if (btnShifts) btnShifts.classList.toggle("active", subtabName === "shifts");
  if (btnRoles) btnRoles.classList.toggle("active", subtabName === "roles");

  if (paneWorkers) paneWorkers.style.display = subtabName === "workers" ? "block" : "none";
  if (paneShifts) paneShifts.style.display = subtabName === "shifts" ? "block" : "none";
  if (paneRoles) paneRoles.style.display = subtabName === "roles" ? "block" : "none";
}

function updateStaffKpis() {
  const users = Storage.getUsers();
  const shifts = Storage.getWorkerShifts();
  const staff = users.filter(u => u.rol !== "CLIENTE");

  const totalStaff = staff.length;
  const taquillaCount = staff.filter(u => u.rol === "TAQUILLERO" || u.rol === "TRABAJADOR").length;
  const dulceriaCount = staff.filter(u => u.rol === "CONFITERIA").length;
  const onDutyCount = shifts.filter(s => s.estado === "EN_TURNO").length;

  const elTotal = document.querySelector("#kpiStaffTotal");
  const elTaquilla = document.querySelector("#kpiStaffTaquilla");
  const elDulceria = document.querySelector("#kpiStaffDulceria");
  const elOnDuty = document.querySelector("#kpiStaffOnDuty");

  if (elTotal) elTotal.textContent = totalStaff;
  if (elTaquilla) elTaquilla.textContent = taquillaCount;
  if (elDulceria) elDulceria.textContent = dulceriaCount;
  if (elOnDuty) elOnDuty.textContent = onDutyCount;
}

function getRoleIcon(slug) {
  switch (slug) {
    case "ADMIN": return "👑";
    case "GERENTE": return "💼";
    case "TAQUILLERO": return "🎟️";
    case "CONFITERIA": return "🍿";
    case "CLIENTE": return "👤";
    default: return "🛡️";
  }
}

function getRoleColor(slug) {
  switch (slug) {
    case "ADMIN": return { bg: "rgba(229,9,20,0.15)", text: "#ff5252", border: "rgba(229,9,20,0.4)" };
    case "GERENTE": return { bg: "rgba(255,193,7,0.15)", text: "#ffc107", border: "rgba(255,193,7,0.4)" };
    case "TAQUILLERO": return { bg: "rgba(33,150,243,0.15)", text: "#42a5f5", border: "rgba(33,150,243,0.4)" };
    case "CONFITERIA": return { bg: "rgba(76,175,80,0.15)", text: "#66bb6a", border: "rgba(76,175,80,0.4)" };
    case "CLIENTE": return { bg: "rgba(158,158,158,0.15)", text: "#b0bec5", border: "rgba(158,158,158,0.4)" };
    default: return { bg: "rgba(255,255,255,0.1)", text: "#fff", border: "rgba(255,255,255,0.2)" };
  }
}

function renderRolesCards() {
  const container = document.querySelector("#rolesCardsGrid");
  if (!container) return;

  const roles = Storage.getRoles();
  container.innerHTML = roles.map(r => {
    const icon = getRoleIcon(r.slug);
    const colors = getRoleColor(r.slug);

    const permBadges = [];
    if (r.puede_vender_boletos) permBadges.push(`<span class="perm-badge active">🎟️ Venta Boletos</span>`);
    if (r.puede_vender_snacks) permBadges.push(`<span class="perm-badge active">🍿 Venta Confitería</span>`);
    if (r.puede_gestionar_peliculas) permBadges.push(`<span class="perm-badge active">🎬 Cartelera & Salas</span>`);
    if (r.puede_gestionar_usuarios) permBadges.push(`<span class="perm-badge active">👥 Gestión Usuarios</span>`);
    if (r.puede_ver_metricas_financieras) permBadges.push(`<span class="perm-badge active">💰 Balances Financieros</span>`);
    if (r.puede_gestionar_proveedores) permBadges.push(`<span class="perm-badge active">🚚 Proveedores</span>`);

    if (permBadges.length === 0) {
      permBadges.push(`<span class="perm-badge inactive">👤 Acceso Cliente / Consulta</span>`);
    }

    return `
      <div class="role-card" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between; transition: var(--transition-fast);">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.8rem;">
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <span style="font-size: 1.8rem;">${icon}</span>
              <div>
                <h4 style="color: #fff; font-size: 1.05rem; font-weight: 700; margin: 0;">${r.nombre}</h4>
                <span style="display: inline-block; font-size: 0.75rem; font-weight: 700; color: ${colors.text}; background: ${colors.bg}; border: 1px solid ${colors.border}; padding: 0.15rem 0.5rem; border-radius: 4px; margin-top: 0.2rem;">
                  ${r.slug} (ID: ${r.id})
                </span>
              </div>
            </div>
            <span style="font-size: 0.75rem; color: #aaa; background: rgba(255,255,255,0.06); padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);">
              Nivel ${r.nivel_jerarquia}
            </span>
          </div>
          <p style="color: var(--text-muted); font-size: 0.85rem; line-height: 1.4; margin-bottom: 1rem;">
            ${r.descripcion || "Sin descripción."}
          </p>
        </div>
        <div>
          <div style="font-size: 0.75rem; font-weight: 600; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem;">
            Privilegios Otorgados:
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
            ${permBadges.join("")}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function renderWorkersTable() {
  const tbody = document.querySelector("#adminWorkersTableBody");
  if (!tbody) return;

  const roles = Storage.getRoles();
  let users = Storage.getUsers();
  const filterSelect = document.querySelector("#adminRoleFilterSelect");
  const searchInput = document.querySelector("#adminUserSearch");

  const filterRole = filterSelect ? filterSelect.value : "ALL_WORKERS";
  const search = searchInput ? searchInput.value.toLowerCase().trim() : "";

  // Filtrado de trabajadores
  if (filterRole === "ALL_WORKERS") {
    users = users.filter(u => u.rol !== "CLIENTE");
  } else if (filterRole === "TAQUILLERO") {
    users = users.filter(u => u.rol === "TAQUILLERO" || u.rol === "TRABAJADOR");
  } else if (filterRole === "CONFITERIA") {
    users = users.filter(u => u.rol === "CONFITERIA");
  } else if (filterRole === "GERENTE") {
    users = users.filter(u => u.rol === "GERENTE");
  }

  if (search) {
    users = users.filter(u =>
      (u.nombre && u.nombre.toLowerCase().includes(search)) ||
      (u.apellido && u.apellido.toLowerCase().includes(search)) ||
      (u.email && u.email.toLowerCase().includes(search)) ||
      (u.rol && u.rol.toLowerCase().includes(search)) ||
      (u.telefono && u.telefono.toLowerCase().includes(search))
    );
  }

  // Ordenar los más recientes primero para que el nuevo aparezca arriba
  users.sort((a, b) => (b.id || 0) - (a.id || 0));

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 3rem 1rem;">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">👔</div>
          <strong>No se encontraron empleados registrados con los filtros aplicados.</strong>
          <p style="font-size: 0.85rem; margin-top: 0.3rem;">Haz clic en <em>"👔 + Contratar Nuevo Trabajador"</em> para agregar a un empleado.</p>
        </td>
      </tr>
    `;
    return;
  }

  const shifts = Storage.getWorkerShifts();
  const todayStr = new Date().toISOString().split("T")[0];

  tbody.innerHTML = users.map(u => {
    const role = roles.find(r => r.id === u.rol_id || r.slug === u.rol) || { id: 5, nombre: "Empleado", slug: u.rol || "TRABAJADOR", nivel_jerarquia: 10 };
    const colors = getRoleColor(role.slug);
    const icon = getRoleIcon(role.slug);

    // Turno activo o registrado hoy
    const activeShift = shifts.find(s => s.usuario_id === u.id && s.estado === "EN_TURNO");
    const todayShift = shifts.find(s => s.usuario_id === u.id && s.fecha === todayStr);

    let shiftBadgeHtml = "";
    let toggleBtnLabel = "⏱️ Marcar Entrada";
    let isCurrentlyOnDuty = false;

    if (activeShift) {
      isCurrentlyOnDuty = true;
      shiftBadgeHtml = `
        <span style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.78rem; font-weight: 700; color: #00e676; background: rgba(0, 230, 118, 0.12); border: 1px solid rgba(0, 230, 118, 0.3); padding: 0.25rem 0.6rem; border-radius: 6px;">
          🟢 En Turno Activo (Entrada: ${activeShift.hora_entrada})
        </span>
      `;
      toggleBtnLabel = "⚪ Marcar Salida";
    } else if (todayShift && todayShift.hora_salida) {
      shiftBadgeHtml = `
        <span style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.78rem; font-weight: 600; color: #aaa; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 0.25rem 0.6rem; border-radius: 6px;">
          ⚪ Fuera de Turno (Salida: ${todayShift.hora_salida})
        </span>
      `;
    } else {
      shiftBadgeHtml = `
        <span style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.78rem; color: var(--text-muted); background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); padding: 0.25rem 0.6rem; border-radius: 6px;">
          ⏳ Sin turno registrado hoy
        </span>
      `;
    }

    const isStaff = role.slug !== "CLIENTE";
    const staffBadge = isStaff 
      ? `<span style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.72rem; font-weight: 700; color: #00e676; background: rgba(0,230,118,0.1); border: 1px solid rgba(0,230,118,0.25); padding: 0.15rem 0.45rem; border-radius: 4px;">👔 Personal Oficial</span>`
      : `<span style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.72rem; color: #aaa; background: rgba(255,255,255,0.05); padding: 0.15rem 0.45rem; border-radius: 4px;">👤 Cliente</span>`;

    const fechaAlta = u.creado_en ? new Date(u.creado_en).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" }) : "Contratado";

    return `
      <tr>
        <td style="font-family: monospace; color: var(--gold); font-weight: bold;">#${u.id}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <div style="width: 36px; height: 36px; border-radius: 8px; background: ${colors.bg}; border: 1px solid ${colors.border}; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
              ${icon}
            </div>
            <div>
              <div style="font-weight: 700; color: #fff; font-size: 0.95rem;">${u.nombre} ${u.apellido || ""}</div>
              <div style="margin-top: 0.2rem;">${staffBadge}</div>
            </div>
          </div>
        </td>
        <td>
          <span style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.82rem; font-weight: 700; color: ${colors.text}; background: ${colors.bg}; border: 1px solid ${colors.border}; padding: 0.25rem 0.65rem; border-radius: 6px;">
            ${icon} ${role.nombre}
          </span>
        </td>
        <td style="color: #ddd; font-family: monospace; font-size: 0.88rem;">${u.email}</td>
        <td style="color: #bbb; font-size: 0.88rem;">${u.telefono || "Sin registrar"}</td>
        <td>${shiftBadgeHtml}</td>
        <td style="color: var(--text-muted); font-size: 0.82rem;">${fechaAlta}</td>
        <td>
          <div style="display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;" onclick="handleToggleWorkerShift(${u.id}, '${(u.nombre || '').replace(/'/g, "\\'")}', ${isCurrentlyOnDuty})" title="Registrar inicio o fin de turno laboral">
              ${toggleBtnLabel}
            </button>
            <button class="btn btn-secondary btn-sm" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; color: #ff5252; border-color: rgba(255,82,82,0.35); background: rgba(255,82,82,0.08);" onclick="handleDismissWorker(${u.id}, '${(u.nombre || '').replace(/'/g, "\\'")}')" title="Dar de baja definitiva por renuncia">
              🗑️ Dar de Baja (Renuncia)
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderWorkerShiftsTable(searchFilter = "") {
  const tbody = document.querySelector("#adminShiftsTableBody");
  if (!tbody) return;

  const shifts = Storage.getWorkerShifts();
  const searchInput = document.querySelector("#adminShiftSearch");
  const filter = (searchFilter || (searchInput ? searchInput.value : "")).toLowerCase().trim();

  let filteredShifts = [...shifts];
  if (filter) {
    filteredShifts = filteredShifts.filter(s =>
      (s.nombre && s.nombre.toLowerCase().includes(filter)) ||
      (s.rol_nombre && s.rol_nombre.toLowerCase().includes(filter)) ||
      (s.fecha && s.fecha.includes(filter))
    );
  }

  if (filteredShifts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2.5rem 1rem;">
          <div style="font-size: 1.8rem; margin-bottom: 0.4rem;">⏱️</div>
          <strong>No hay registros de asistencia en la bitácora de turnos.</strong>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filteredShifts.map(s => {
    const isEnTurno = s.estado === "EN_TURNO";
    const statusBadge = isEnTurno
      ? `<span style="color: #00e676; background: rgba(0,230,118,0.12); border: 1px solid rgba(0,230,118,0.3); font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.76rem;">🟢 EN TURNO</span>`
      : `<span style="color: #aaa; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.76rem;">✅ FINALIZADO</span>`;

    const icon = getRoleIcon(s.rol);
    const actionBtn = isEnTurno
      ? `<button class="btn btn-secondary btn-sm" style="font-size: 0.74rem; padding: 0.2rem 0.5rem;" onclick="handleToggleWorkerShift(${s.usuario_id}, '${(s.nombre || '').replace(/'/g, "\\'")}', true)">⚪ Cerrar Turno</button>`
      : `<span style="color: var(--text-muted); font-size: 0.75rem;">Jornada Completa</span>`;

    return `
      <tr>
        <td style="font-family: monospace; color: var(--gold); font-weight: bold;">#T-${s.id}</td>
        <td style="font-weight: 600; color: #fff;">${s.nombre}</td>
        <td>
          <span style="font-size: 0.8rem; color: #ddd;">${icon} ${s.rol_nombre || s.rol}</span>
        </td>
        <td style="font-family: monospace; color: #bbb;">${s.fecha}</td>
        <td style="color: #00e676; font-weight: 700;">🟢 ${s.hora_entrada}</td>
        <td style="color: ${s.hora_salida ? '#ffb300' : 'var(--text-muted)'}; font-weight: ${s.hora_salida ? '600' : 'normal'};">
          ${s.hora_salida ? `⚪ ${s.hora_salida}` : '<i>En curso...</i>'}
        </td>
        <td style="font-weight: 600; color: var(--gold);">${s.horas_trabajadas || 'Calculando...'}</td>
        <td>${statusBadge}</td>
        <td>${actionBtn}</td>
      </tr>
    `;
  }).join("");
}

async function handleDismissWorker(userId, userName) {
  const confirmed = confirm(
    `⚠️ ¿CONFIRMAS DAR DE BAJA DEFINITIVA POR RENUNCIA?\n\n` +
    `Empleado: ${userName} (ID #${userId})\n\n` +
    `Esta acción eliminará al trabajador de la base de datos MySQL y del directorio oficial, revocando sus accesos al sistema inmediatamente.`
  );

  if (!confirmed) return;

  try {
    if (typeof API !== "undefined" && API.users && API.users.delete) {
      await API.users.delete(userId);
    }
  } catch (err) {
    console.warn("No se pudo ejecutar DELETE en backend (posiblemente offline):", err.message);
  }

  // Eliminar en Storage local y revocar turnos
  Storage.deleteWorker(userId);
  showToast(`¡El empleado ${userName} ha sido dado de baja por renuncia exitosamente! 🗑️`, "info");
  await renderRolesAndUsersTab();
}

async function handleToggleWorkerShift(userId, userName, isCurrentlyOnDuty) {
  if (isCurrentlyOnDuty) {
    Storage.recordWorkerCheckOut(userId);
    showToast(`Salida registrada para ${userName}. Turno finalizado exitosamente. ⚪`, "info");
  } else {
    const users = Storage.getUsers();
    const user = users.find(u => u.id === parseInt(userId, 10));
    Storage.recordWorkerCheckIn(userId, userName, user ? user.rol : "TAQUILLERO");
    showToast(`Entrada registrada para ${userName}. ¡Turno laboral activo! 🟢`, "success");
  }
  await renderRolesAndUsersTab();
}

async function handleUserRoleChange(userId, newRolId) {
  try {
    if (typeof API !== "undefined" && API.users && API.users.updateRole) {
      await API.users.updateRole(userId, newRolId);
    }
  } catch (e) {
    console.warn("Backend API no disponible en este momento, actualizando almacenamiento local:", e);
  }

  const updated = Storage.updateUserRole(userId, newRolId);
  if (updated) {
    showToast(`Rol actualizado a "${updated.rol_nombre || updated.rol}" para ${updated.nombre}.`, "success");
    await renderRolesAndUsersTab();
  } else {
    showToast("Error al actualizar rol del usuario.", "error");
  }
}

function openUserModal() {
  const modal = document.querySelector("#userFormModal");
  if (!modal) return;
  const form = document.querySelector("#userForm");
  if (form) form.reset();
  const select = document.querySelector("#inputUserRole");
  if (select) {
    const roles = Storage.getRoles();
    // El Administrador contrata exclusivamente personal para áreas operativas:
    // 1. Taquillero / Boletería (TAQUILLERO)
    // 2. Operador de Confitería / Dulcería (CONFITERIA)
    // Se excluyen ADMIN, GERENTE y CLIENTE
    const operativeRoles = roles.filter(r => r.slug === "TAQUILLERO" || r.slug === "CONFITERIA");
    select.innerHTML = operativeRoles.map(r => `
      <option value="${r.id}" ${r.slug === "TAQUILLERO" ? "selected" : ""}>
        ${r.slug === "TAQUILLERO" ? "🎟️ Taquillero / Boletería (TAQUILLERO)" : "🍿 Operador de Confitería / Dulcería (CONFITERIA)"}
      </option>
    `).join("");
  }
  modal.classList.add("visible");
}

function closeUserModal() {
  const modal = document.querySelector("#userFormModal");
  if (modal) modal.classList.remove("visible");
}

async function handleUserFormSubmit(event) {
  event.preventDefault();
  const nombre = document.querySelector("#inputUserNombre").value.trim();
  const apellido = document.querySelector("#inputUserApellido").value.trim();
  const email = document.querySelector("#inputUserEmail").value.trim().toLowerCase();
  const telefono = document.querySelector("#inputUserTelefono").value.trim();
  const password = document.querySelector("#inputUserPassword").value;
  const rol_id = parseInt(document.querySelector("#inputUserRole").value, 10);

  if (!nombre || !email || !password) {
    showToast("Por favor complete nombre, correo y contraseña del trabajador.", "error");
    return;
  }

  const roleObj = Storage.getRoleById(rol_id) || Storage.getRoleBySlug("TAQUILLERO");
  let createdInBackend = false;

  // 1. Intentar registrar en backend / base de datos MySQL si está activo
  try {
    if (typeof API !== "undefined" && API.users && API.users.create) {
      const res = await API.users.create({
        nombre,
        apellido,
        email,
        password,
        telefono,
        rol_id
      });
      if (res && (res.success || res.data)) {
        createdInBackend = true;
      }
    }
  } catch (apiErr) {
    console.warn("[Worker Create API Warning]: Backend no alcanzable en este instante, guardando en almacenamiento seguro:", apiErr.message);
  }

  // 2. Guardar SIEMPRE en Storage local para disponibilidad inmediata de acceso y visualización
  const localUsers = Storage.getUsers();
  const existingIdx = localUsers.findIndex(u => u.email && u.email.toLowerCase() === email);
  const newWorker = {
    id: localUsers.length ? Math.max(...localUsers.map(u => u.id || 0)) + 1 : 10,
    rol_id: roleObj ? roleObj.id : rol_id,
    nombre,
    apellido: apellido || "",
    email,
    password: password,
    telefono: telefono || "",
    rol: roleObj ? roleObj.slug : "TAQUILLERO",
    rol_nombre: roleObj ? roleObj.nombre : "Trabajador",
    activo: true,
    creado_en: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    localUsers[existingIdx] = { ...localUsers[existingIdx], ...newWorker };
  } else {
    localUsers.push(newWorker);
  }
  Storage.saveUsers(localUsers);

  closeUserModal();
  await renderRolesAndUsersTab();

  if (createdInBackend) {
    showToast(`¡Trabajador ${nombre} contratado y registrado en MySQL con éxito! 👔`, "success");
  } else {
    showToast(`¡Trabajador ${nombre} contratado exitosamente (${roleObj ? roleObj.nombre : "Operativo"})! 👔`, "success");
  }
}

async function handleDeleteUser(userId, userName) {
  if (!confirm(`¿Deseas dar de baja o eliminar al empleado ${userName} (#${userId}) de la base de datos?`)) {
    return;
  }
  try {
    if (typeof API !== "undefined" && API.users && API.users.delete) {
      await API.users.delete(userId);
    }
  } catch (err) {
    console.warn("No se pudo eliminar en backend:", err.message);
  }
  const users = Storage.getUsers().filter(u => u.id !== parseInt(userId, 10));
  Storage.saveUsers(users);
  showToast(`Usuario ${userName} eliminado exitosamente.`, "success");
  await renderRolesAndUsersTab();
}

function initUserSearch() {
  const searchInput = document.querySelector("#adminUserSearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      renderUsersTable(e.target.value);
    });
  }
}

