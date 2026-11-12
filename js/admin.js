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

  // Sincronizar reservas reales desde API MySQL
  await syncBookingsFromAPI();
  renderStats();
  renderBookingsTable();
  if (typeof renderFinancialDashboard === "function") renderFinancialDashboard();

  // Suscribirse a actualizaciones por WebSocket en tiempo real
  if (typeof RealTime !== "undefined") {
    RealTime.init();
    if (RealTime.socket) {
      RealTime.socket.on("booking:created", (newBooking) => {
        if (newBooking) {
          Storage.saveBooking(newBooking);
          renderStats();
          renderBookingsTable();
          if (typeof renderAllAdminCharts === "function") renderAllAdminCharts();
          if (typeof renderFinancialDashboard === "function") renderFinancialDashboard();
          showToast(`🔔 ¡Nueva venta registrada en tiempo real! Código: ${newBooking.bookingCode || newBooking.id} ($${(newBooking.grandTotal || newBooking.total || 0).toFixed(2)})`, "success");
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
        Storage.saveBookings(res.data);
      }
    }
  } catch (err) {
    console.warn("Sincronización de reservas MySQL omitida:", err.message);
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
      .reduce((sum, b) => sum + (b.grandTotal || 0), 0);
    statRevenue.textContent = `$${totalRev.toFixed(2)}`;
  }

  if (statCandy) {
    const candyRev = bookings
      .filter(b => b.status === "CONFIRMADA")
      .reduce((sum, b) => sum + (b.snacksTotal || 0), 0);
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
        <h4 style="font-size: 1.15rem; color: #fff;">${room.name}</h4>
        <span class="badge badge-format">${room.technology}</span>
      </div>
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

// Renderizar matriz de butacas en vivo para el Administrador
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

  rows.forEach(row => {
    const rowEl = document.createElement("div");
    rowEl.className = "admin-seat-row";

    const labelLeft = document.createElement("span");
    labelLeft.className = "row-label";
    labelLeft.textContent = row;
    rowEl.appendChild(labelLeft);

    const isVipRow = vipRows.includes(row);

    for (let col = 1; col <= seatsPerRow; col++) {
      const middleCol = Math.floor(seatsPerRow / 2);
      if (col === middleCol + 1) {
        const gap = document.createElement("div");
        gap.style.width = "18px";
        rowEl.appendChild(gap);
      }

      const seatCode = `${row}-${col}`;
      const seat = document.createElement("div");
      seat.className = "admin-seat";
      seat.textContent = col;

      if (isVipRow) seat.classList.add("vip");

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

      // Al hacer clic, el admin puede alterar el estado de la butaca
      seat.addEventListener("click", () => handleAdminSeatClick(showtimeKey, seatCode, lock, isMaint, isOcc));
      rowEl.appendChild(seat);
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
  renderRolesCards();
  renderUsersTable();
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

function renderUsersTable(filter = "") {
  const tbody = document.querySelector("#adminUsersTableBody");
  if (!tbody) return;

  const roles = Storage.getRoles();
  let users = Storage.getUsers();

  if (filter && filter.trim()) {
    const q = filter.toLowerCase().trim();
    users = users.filter(u =>
      (u.nombre && u.nombre.toLowerCase().includes(q)) ||
      (u.apellido && u.apellido.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.rol && u.rol.toLowerCase().includes(q))
    );
  }

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">No se encontraron usuarios registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const role = roles.find(r => r.id === u.rol_id || r.slug === u.rol) || { id: 5, nombre: "Cliente", slug: "CLIENTE", nivel_jerarquia: 1 };
    const colors = getRoleColor(role.slug);
    const icon = getRoleIcon(role.slug);

    const options = roles.map(r => `
      <option value="${r.id}" ${r.id === role.id ? "selected" : ""}>
        ${getRoleIcon(r.slug)} ${r.nombre} (Nivel ${r.nivel_jerarquia})
      </option>
    `).join("");

    return `
      <tr>
        <td style="font-family: monospace; color: var(--gold); font-weight: bold;">#${u.id}</td>
        <td>
          <div style="font-weight: 600; color: #fff;">${u.nombre} ${u.apellido || ""}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${new Date(u.creado_en || Date.now()).toLocaleDateString("es-CO")}</div>
        </td>
        <td style="color: #ddd;">${u.email}</td>
        <td style="color: #bbb;">${u.telefono || "N/A"}</td>
        <td>
          <span style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; font-weight: 700; color: ${colors.text}; background: ${colors.bg}; border: 1px solid ${colors.border}; padding: 0.25rem 0.6rem; border-radius: 6px;">
            ${icon} ${role.slug}
          </span>
        </td>
        <td>
          <span class="badge" style="background: rgba(255,255,255,0.06); color: #ccc; border: 1px solid rgba(255,255,255,0.1);">
            Nivel ${role.nivel_jerarquia}
          </span>
        </td>
        <td>
          <select class="form-control" style="width: auto; padding: 0.3rem 0.6rem; font-size: 0.85rem;" onchange="handleUserRoleChange(${u.id}, this.value)">
            ${options}
          </select>
        </td>
        <td>
          <span class="badge ${u.activo !== false ? 'badge-confirmed' : 'badge-cancelled'}">
            ${u.activo !== false ? '● ACTIVO' : '○ INACTIVO'}
          </span>
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; color: #ff5252; border-color: rgba(255,82,82,0.3);" onclick="handleDeleteUser(${u.id}, '${(u.nombre || '').replace(/'/g, "\\'")}')" title="Eliminar de base de datos">
            🗑️ Eliminar
          </button>
        </td>
      </tr>
    `;
  }).join("");
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
    select.innerHTML = roles.map(r => `
      <option value="${r.id}" ${r.slug === "CLIENTE" ? "selected" : ""}>
        ${getRoleIcon(r.slug)} ${r.nombre} (${r.slug})
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
  const email = document.querySelector("#inputUserEmail").value.trim();
  const telefono = document.querySelector("#inputUserTelefono").value.trim();
  const password = document.querySelector("#inputUserPassword").value;
  const rol_id = parseInt(document.querySelector("#inputUserRole").value, 10);

  if (!nombre || !email || !password) {
    showToast("Por favor complete nombre, correo y contraseña.", "error");
    return;
  }

  try {
    if (typeof API !== "undefined" && API.users && API.users.create) {
      await API.users.create({
        nombre,
        apellido,
        email,
        password,
        telefono,
        rol_id
      });
      showToast("Usuario registrado exitosamente en la base de datos MySQL.", "success");
    } else {
      showToast("Backend API no disponible.", "error");
    }
    closeUserModal();
    await renderRolesAndUsersTab();
  } catch (err) {
    console.error("Error al registrar usuario:", err);
    showToast(err.message || "Error al registrar usuario.", "error");
  }
}

async function handleDeleteUser(userId, userName) {
  if (!confirm(`¿Deseas eliminar permanentemente al usuario ${userName} (#${userId}) de la base de datos?`)) {
    return;
  }
  try {
    if (typeof API !== "undefined" && API.users && API.users.delete) {
      await API.users.delete(userId);
      showToast(`Usuario ${userName} eliminado de la base de datos.`, "success");
      await renderRolesAndUsersTab();
    }
  } catch (err) {
    showToast(err.message || "Error al eliminar usuario.", "error");
  }
}

function initUserSearch() {
  const searchInput = document.querySelector("#adminUserSearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      renderUsersTable(e.target.value);
    });
  }
}

