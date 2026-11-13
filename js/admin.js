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
  if (typeof initAdminCharts === "function") initAdminCharts();
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
  if (typeof renderFinancialDashboard === "function") renderFinancialDashboard();
  if (typeof renderAllAdminCharts === "function") renderAllAdminCharts();

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
          if (typeof renderAllAdminCharts === "function") renderAllAdminCharts();
          if (typeof renderFinancialDashboard === "function") renderFinancialDashboard();
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
        if (typeof renderFinancialDashboard === "function") renderFinancialDashboard();
        if (typeof renderAllAdminCharts === "function") renderAllAdminCharts();
      });
      RealTime.socket.on("stock:updated", (payload) => {
        if (payload && payload.snacks) {
          Storage.saveSnacks(payload.snacks);
          renderSnacksTable();
          if (typeof renderFinancialDashboard === "function") renderFinancialDashboard();
        }
      });
      RealTime.socket.on("seat:booked", () => {
        renderAdminSeatInspector();
      });
    }
  }

  // Suscribirse a actualizaciones en tiempo real (BroadcastChannel entre pestañas)
  Storage.onSync(() => {
    renderStats();
    renderAdminSeatInspector();
    renderSnacksTable();
    renderSuppliersTable();
    renderBookingsTable();
    renderRolesAndUsersTab();
    if (typeof renderAllAdminCharts === "function") renderAllAdminCharts();
    if (typeof renderFinancialDashboard === "function") renderFinancialDashboard();
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

  // Si se abre la pestaña de analíticas, refrescar gráficos
  if (tabName === "analytics" && typeof renderAllAdminCharts === "function") {
    renderAllAdminCharts();
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
  const bookings = Storage.getBookings();

  const statMovies = document.querySelector("#statTotalMovies");
  const statBookings = document.querySelector("#statTotalBookings");
  const statRevenue = document.querySelector("#statEstimatedRevenue");
  const statCandy = document.querySelector("#statCandyRevenue");

  if (statMovies) statMovies.textContent = movies.length;
  if (statBookings) statBookings.textContent = bookings.length;

  if (statRevenue) {
    const totalRev = bookings
      .filter(b => b.status === "CONFIRMADA")
      .reduce((sum, b) => sum + (typeof b.grandTotal === "number" ? b.grandTotal : (typeof b.total === "number" ? b.total : (parseFloat(b.total_pagado) || 0))), 0);
    statRevenue.textContent = `$${totalRev.toFixed(2)}`;
  }

  if (statCandy) {
    const candyRev = bookings
      .filter(b => b.status === "CONFIRMADA")
      .reduce((sum, b) => sum + (typeof b.snacksTotal === "number" ? b.snacksTotal : (typeof b.subtotalSnacks === "number" ? b.subtotalSnacks : (parseFloat(b.subtotal_snacks) || 0))), 0);
    statCandy.textContent = `$${candyRev.toFixed(2)}`;
  }
}

// =============================================================================
// MÓDULO 1: CARTELERA Y PELÍCULAS (CRUD)
// =============================================================================
function renderMoviesTable(filterQuery = "") {
  const tbody = document.querySelector("#adminMoviesTableBody");
  if (!tbody) return;

  let movies = Storage.getMovies();
  if (filterQuery) {
    const q = filterQuery.toLowerCase().trim();
    movies = movies.filter(m => m.title.toLowerCase().includes(q) || m.genre.toLowerCase().includes(q));
  }

  tbody.innerHTML = movies.map(movie => `
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
  `).join('');
}

function initMovieSearch() {
  const searchInput = document.querySelector("#adminMovieSearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      renderMoviesTable(e.target.value);
    });
  }
}

function openMovieModal(isEdit = false, movieData = null) {
  const modal = document.querySelector("#movieFormModal");
  const modalTitle = document.querySelector("#modalFormTitle");
  const form = document.querySelector("#movieForm");

  if (!modal || !form) return;
  form.reset();

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
  } else {
    modalTitle.textContent = "Programar Nueva Película en Cartelera";
    document.querySelector("#movieIdInput").value = "";
    document.querySelector("#inputFeatured").value = "false";
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

function openRoomModal(roomId) {
  const room = Storage.getRoomById(roomId);
  if (!room) return;

  document.querySelector("#roomIdInput").value = room.id;
  document.querySelector("#inputRoomName").value = room.name;
  document.querySelector("#inputRoomTech").value = room.technology;
  document.querySelector("#inputRoomSeatsPerRow").value = room.seatsPerRow;
  document.querySelector("#inputRoomRows").value = room.rows.join(", ");
  document.querySelector("#inputRoomVipRows").value = room.vipRows.join(", ");
  document.querySelector("#inputRoomScreen").value = room.screenType;
  document.querySelector("#inputRoomSound").value = room.soundSystem;

  const modal = document.querySelector("#roomFormModal");
  if (modal) modal.classList.add("open");
}

function closeRoomModal() {
  const modal = document.querySelector("#roomFormModal");
  if (modal) modal.classList.remove("open");
}

// Llenar selector de funciones en el inspector
function populateInspectorShowtimes() {
  const select = document.querySelector("#inspectorShowtimeSelect");
  if (!select) return;

  const movies = Storage.getMovies();
  let optionsHtml = "";

  movies.forEach(m => {
    m.showtimes.forEach(t => {
      const key = `${m.id}_${t}`;
      optionsHtml += `<option value="${key}">${m.title} - ${t} (${m.hall})</option>`;
    });
  });

  select.innerHTML = optionsHtml;
}

// Renderizar matriz de butacas en vivo para el Administrador según su maqueta arquitectónica
function renderAdminSeatInspector() {
  const select = document.querySelector("#inspectorShowtimeSelect");
  const grid = document.querySelector("#adminSeatsGrid");
  const statsBox = document.querySelector("#inspectorStats");

  if (!select || !grid || !select.value) return;

  const showtimeKey = select.value;
  const [movieId, showtime] = showtimeKey.split("_");
  const movie = Storage.getMovieById(movieId);
  if (!movie) return;

  const rooms = Storage.getRooms();
  const room = rooms.find(r => r.id === movie.roomId || r.name === movie.hall) || rooms[0];

  grid.innerHTML = "";

  const layoutType = room.layoutType || (
    room.id === "sala-1" ? "curved_imax" :
    room.id === "sala-2" ? "stadium_double_aisle" :
    room.id === "sala-3" ? "motion_4dx" : "vip_lounge"
  );

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

    // Maqueta 2: Estadio 3 Bloques (cols 1,2 - Pasillo - cols 3-8 - Pasillo - cols 9,10)
    if (layoutType === "stadium_double_aisle") {
      const bLeft = document.createElement("div");
      bLeft.className = "stadium-block";
      bLeft.appendChild(createAdminSeatBtn(row, 1, isVipRow));
      bLeft.appendChild(createAdminSeatBtn(row, 2, isVipRow));
      rowEl.appendChild(bLeft);

      const aisle1 = document.createElement("div");
      aisle1.className = "aisle-stairs";
      rowEl.appendChild(aisle1);

      const bCenter = document.createElement("div");
      bCenter.className = "stadium-block";
      for (let col = 3; col <= 8; col++) {
        bCenter.appendChild(createAdminSeatBtn(row, col, isVipRow));
      }
      rowEl.appendChild(bCenter);

      const aisle2 = document.createElement("div");
      aisle2.className = "aisle-stairs";
      rowEl.appendChild(aisle2);

      const bRight = document.createElement("div");
      bRight.className = "stadium-block";
      bRight.appendChild(createAdminSeatBtn(row, 9, isVipRow));
      bRight.appendChild(createAdminSeatBtn(row, 10, isVipRow));
      rowEl.appendChild(bRight);
    }
    // Maqueta 3: Pods 4DX (Pods de 4)
    else if (layoutType === "motion_4dx") {
      const pod1 = document.createElement("div");
      pod1.className = "motion-pod";
      for (let col = 1; col <= 4; col++) {
        pod1.appendChild(createAdminSeatBtn(row, col, isVipRow));
      }
      rowEl.appendChild(pod1);

      const effAisle = document.createElement("div");
      effAisle.className = "effects-aisle";
      effAisle.innerHTML = `<span>💨</span>`;
      rowEl.appendChild(effAisle);

      const pod2 = document.createElement("div");
      pod2.className = "motion-pod";
      for (let col = 5; col <= 8; col++) {
        pod2.appendChild(createAdminSeatBtn(row, col, isVipRow));
      }
      rowEl.appendChild(pod2);

      if (seatsPerRow > 8) {
        const pod3 = document.createElement("div");
        pod3.className = "motion-pod";
        for (let col = 9; col <= seatsPerRow; col++) {
          pod3.appendChild(createAdminSeatBtn(row, col, isVipRow));
        }
        rowEl.appendChild(pod3);
      }
    }
    // Maqueta 4: VIP Lounge (Sofás dobles y mesitas)
    else if (layoutType === "vip_lounge") {
      const p1 = document.createElement("div");
      p1.className = "love-seat-pair";
      p1.appendChild(createAdminSeatBtn(row, 1, true));
      p1.appendChild(createAdminSeatBtn(row, 2, true));
      rowEl.appendChild(p1);

      const t1 = document.createElement("div");
      t1.className = "lounge-table";
      t1.innerHTML = `🍷`;
      rowEl.appendChild(t1);

      const p2 = document.createElement("div");
      p2.className = "love-seat-pair";
      p2.appendChild(createAdminSeatBtn(row, 3, true));
      p2.appendChild(createAdminSeatBtn(row, 4, true));
      rowEl.appendChild(p2);

      const cp = document.createElement("div");
      cp.className = "carpet-aisle";
      cp.textContent = "⚜️";
      rowEl.appendChild(cp);

      const p3 = document.createElement("div");
      p3.className = "love-seat-pair";
      p3.appendChild(createAdminSeatBtn(row, 5, true));
      p3.appendChild(createAdminSeatBtn(row, 6, true));
      rowEl.appendChild(p3);

      const t2 = document.createElement("div");
      t2.className = "lounge-table";
      t2.innerHTML = `🍷`;
      rowEl.appendChild(t2);

      const p4 = document.createElement("div");
      p4.className = "love-seat-pair";
      p4.appendChild(createAdminSeatBtn(row, 7, true));
      p4.appendChild(createAdminSeatBtn(row, 8, true));
      rowEl.appendChild(p4);
    }
    // Fallback o Anfiteatro IMAX
    else {
      for (let col = 1; col <= seatsPerRow; col++) {
        if (col === Math.floor(seatsPerRow / 2) + 1) {
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
            trailerUrl, synopsis, roomId: matchingRoom.id
          };
          Storage.saveMovies(movies);
          showToast("Película actualizada con éxito en Cine Majestad.", "success");
        }
      } else {
        // Nueva
        const newMovie = {
          id: "mov-" + Date.now(),
          title, genre, duration, rating, ageRating, hall, showtimes,
          priceStandard, priceVip, director, isFeatured, poster, backdrop,
          trailerUrl, synopsis, formats: ["2D", "Atmos"], roomId: matchingRoom.id
        };
        movies.unshift(newMovie);
        Storage.saveMovies(movies);
        showToast("Nueva película agregada a la cartelera de Cine Majestad.", "success");
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

      const rooms = Storage.getRooms();
      const idx = rooms.findIndex(r => r.id === roomId);
      if (idx > -1) {
        rooms[idx] = {
          ...rooms[idx],
          name, technology, seatsPerRow, rows, vipRows, screenType, soundSystem,
          capacity: rows.length * seatsPerRow
        };
        Storage.saveRooms(rooms);
        showToast("Configuración de sala guardada.", "success");
        closeRoomModal();
        renderAdminRooms();
        renderAdminSeatInspector();
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

