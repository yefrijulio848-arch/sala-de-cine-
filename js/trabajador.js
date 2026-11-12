/* ==========================================================================
   Cine Majestad - Portal del Trabajador (Funciones, Comidas & Impresión)
   ========================================================================== */

let currentFoodFilter = "PENDIENTE";
let counterCart = {};

document.addEventListener("DOMContentLoaded", () => {
  initWorkerTabs();
  renderWorkerShowtimes();
  renderFoodOrders();
  initPosSnacks();
  renderWorkerPrintTable();

  // Suscribirse a cambios en tiempo real
  Storage.onSync((event) => {
    if (event.type === "BOOKING_SAVED" || event.type === "FOOD_STATUS_UPDATED" || event.type === "SALE_CONFIRMED") {
      renderFoodOrders();
      renderWorkerPrintTable();
      renderWorkerShowtimes();
    }
  });
});

// =============================================================================
// NAVEGACIÓN DE PESTAÑAS DEL TRABAJADOR
// =============================================================================
function initWorkerTabs() {
  const tabs = document.querySelectorAll(".worker-tab-btn");
  tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-tab");
      switchWorkerTab(target);
    });
  });
}

function switchWorkerTab(tabName) {
  const buttons = document.querySelectorAll(".worker-tab-btn");
  const panes = document.querySelectorAll(".worker-tab-pane");

  buttons.forEach(b => {
    if (b.getAttribute("data-tab") === tabName) {
      b.classList.add("active");
    } else {
      b.classList.remove("active");
    }
  });

  panes.forEach(p => {
    if (p.id === `tab-${tabName}`) {
      p.classList.add("active");
    } else {
      p.classList.remove("active");
    }
  });

  if (tabName === "food") renderFoodOrders();
  if (tabName === "print") renderWorkerPrintTable();
  if (tabName === "showtimes") renderWorkerShowtimes();
}

// =============================================================================
// MÓDULO 1: VER FUNCIONES (PROGRAMACIÓN Y OCUPACIÓN EN VIVO)
// =============================================================================
function renderWorkerShowtimes() {
  const container = document.querySelector("#workerShowtimesGrid");
  if (!container) return;

  const filterHall = document.querySelector("#workerHallFilter")?.value || "all";
  const movies = Storage.getMovies();
  const rooms = Storage.getRooms();

  let functionsList = [];

  movies.forEach(movie => {
    movie.showtimes.forEach(time => {
      const showtimeKey = `${movie.id}_${time}`;
      const room = rooms.find(r => r.id === movie.roomId || r.name === movie.hall) || rooms[0];

      if (filterHall === "all" || movie.hall.toLowerCase().includes(filterHall.toLowerCase())) {
        const occupied = Storage.getOccupiedSeats(showtimeKey);
        const locks = Storage.getSeatLocksForShowtime(showtimeKey);
        const totalSeats = room.capacity || 60;
        const occupiedCount = occupied.length;
        const lockedCount = locks.length;
        const availableCount = Math.max(0, totalSeats - occupiedCount - lockedCount);
        const occupancyPct = Math.round(((occupiedCount + lockedCount) / totalSeats) * 100);

        functionsList.push({
          movie,
          time,
          showtimeKey,
          room,
          totalSeats,
          occupiedCount,
          lockedCount,
          availableCount,
          occupancyPct
        });
      }
    });
  });

  if (functionsList.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
        <h3>No hay funciones programadas para este filtro</h3>
      </div>
    `;
    return;
  }

  container.innerHTML = functionsList.map(fn => `
    <div class="showtime-worker-card">
      <div class="showtime-card-top">
        <img src="${fn.movie.poster}" alt="${fn.movie.title}" class="showtime-mini-poster">
        <div class="showtime-meta-info" style="flex: 1;">
          <h4>${fn.movie.title}</h4>
          <p style="color: var(--text-secondary); font-size: 0.85rem;">🏛️ ${fn.movie.hall}</p>
          <div style="display: flex; gap: 0.5rem; margin-top: 0.3rem;">
            <span class="badge" style="background: rgba(0, 210, 255, 0.15); color: var(--accent-blue); font-weight: 800; font-size: 0.9rem;">
              🕒 ${fn.time}
            </span>
            <span class="badge badge-format">${fn.room.technology}</span>
          </div>
        </div>
      </div>

      <div>
        <div style="display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--text-secondary);">
          <span>Ocupación de Sala: <strong>${fn.occupancyPct}%</strong></span>
          <span><strong>${fn.availableCount}</strong> libres de ${fn.totalSeats}</span>
        </div>
        <div class="occupancy-bar-wrapper">
          <div class="occupancy-bar-fill" style="width: ${fn.occupancyPct}%;"></div>
        </div>
      </div>

      <div style="display: flex; gap: 0.6rem; margin-top: 0.3rem;">
        <button class="btn btn-secondary btn-sm" style="flex: 1; font-size: 0.82rem;" onclick="openWorkerSeatModal('${fn.showtimeKey}')">
          👁️ Ver Asientos en Vivo
        </button>
      </div>
    </div>
  `).join('');
}

// Modal para que el trabajador vea los asientos de una función
function openWorkerSeatModal(showtimeKey) {
  const [movieId, showtime] = showtimeKey.split("_");
  const movie = Storage.getMovieById(movieId);
  const rooms = Storage.getRooms();
  const room = rooms.find(r => r.id === movie.roomId || r.name === movie.hall) || rooms[0];

  const modal = document.querySelector("#workerSeatModal");
  const title = document.querySelector("#workerSeatModalTitle");
  const grid = document.querySelector("#workerSeatsGrid");

  if (!modal || !grid) return;

  title.textContent = `Asientos: ${movie.title} (${showtime}) - ${movie.hall}`;
  grid.innerHTML = "";

  const rows = room.rows || ["A", "B", "C", "D", "E", "F"];
  const seatsPerRow = room.seatsPerRow || 10;
  const vipRows = room.vipRows || ["E", "F"];

  const occupied = Storage.getOccupiedSeats(showtimeKey);
  const locks = Storage.getSeatLocksForShowtime(showtimeKey);

  rows.forEach(r => {
    const rowEl = document.createElement("div");
    rowEl.className = "seat-row";

    const labelLeft = document.createElement("span");
    labelLeft.className = "row-label";
    labelLeft.textContent = r;
    rowEl.appendChild(labelLeft);

    const isVipRow = vipRows.includes(r);

    for (let c = 1; c <= seatsPerRow; c++) {
      if (c === Math.floor(seatsPerRow / 2) + 1) {
        const gap = document.createElement("div");
        gap.className = "aisle-gap";
        rowEl.appendChild(gap);
      }

      const code = `${r}-${c}`;
      const seat = document.createElement("div");
      seat.className = "seat";
      seat.textContent = c;

      if (isVipRow) seat.classList.add("vip");

      if (occupied.includes(code)) {
        seat.classList.add("occupied");
        seat.title = `Butaca ${code}: Vendida`;
      } else if (locks.some(l => l.seatCode === code && l.expiresAt > Date.now())) {
        seat.classList.add("locked");
        seat.title = `Butaca ${code}: En selección por cliente 🔒`;
      } else {
        seat.title = `Butaca ${code}: Libre`;
      }

      rowEl.appendChild(seat);
    }

    const labelRight = document.createElement("span");
    labelRight.className = "row-label";
    labelRight.textContent = r;
    rowEl.appendChild(labelRight);

    grid.appendChild(rowEl);
  });

  modal.classList.add("open");
}

function closeWorkerSeatModal() {
  const modal = document.querySelector("#workerSeatModal");
  if (modal) modal.classList.remove("open");
}

// =============================================================================
// MÓDULO 2: ATENCIÓN Y DESPACHO DE COMIDAS & DULCERÍA
// =============================================================================
function filterFoodOrders(filter) {
  currentFoodFilter = filter;

  const btnPending = document.querySelector("#filterFoodPendingBtn");
  const btnDelivered = document.querySelector("#filterFoodDeliveredBtn");
  const btnAll = document.querySelector("#filterFoodAllBtn");

  if (btnPending) btnPending.classList.toggle("active", filter === "PENDIENTE");
  if (btnDelivered) btnDelivered.classList.toggle("active", filter === "ENTREGADO");
  if (btnAll) btnAll.classList.toggle("active", filter === "ALL");

  renderFoodOrders();
}

function renderFoodOrders() {
  const container = document.querySelector("#foodOrdersList");
  const countBadge = document.querySelector("#countFoodPending");
  if (!container) return;

  const allFoodOrders = Storage.getFoodOrders();
  const pendingCount = allFoodOrders.filter(o => o.foodStatus !== "ENTREGADO").length;
  if (countBadge) countBadge.textContent = pendingCount;

  let filtered = allFoodOrders;
  if (currentFoodFilter === "PENDIENTE") {
    filtered = allFoodOrders.filter(o => o.foodStatus !== "ENTREGADO");
  } else if (currentFoodFilter === "ENTREGADO") {
    filtered = allFoodOrders.filter(o => o.foodStatus === "ENTREGADO");
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="background: var(--bg-card); border: 1px dashed var(--border-color); border-radius: var(--radius-md); padding: 3rem; text-align: center; color: var(--text-muted);">
        <h3>No hay pedidos de comida en este estado</h3>
        <p style="font-size: 0.85rem; margin-top: 0.4rem;">Los pedidos con snacks comprados en la web aparecerán aquí para ser despachados.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(order => {
    const isPending = order.foodStatus !== "ENTREGADO";

    return `
      <div class="food-order-card ${isPending ? 'pending' : 'delivered'}">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 0.4rem; flex-wrap: wrap;">
            <strong style="color: var(--gold); font-size: 1.1rem; font-family: monospace;">${order.bookingCode}</strong>
            <span class="badge" style="background: rgba(255,255,255,0.06); color: #fff;">${order.clientName || 'Cliente'}</span>
            <span class="badge ${isPending ? 'badge-format' : ''}" style="${isPending ? 'background: rgba(245,197,24,0.15); color: var(--gold);' : 'background: rgba(0,230,118,0.15); color: #00e676;'}">
              ${isPending ? '⏳ PENDIENTE DE ENTREGA' : `✅ ENTREGADO ${order.foodDeliveredAt ? `(${order.foodDeliveredAt})` : ''}`}
            </span>
          </div>

          <p style="color: var(--text-secondary); font-size: 0.82rem; margin-bottom: 0.4rem;">
            🎬 ${order.movieTitle} | ${order.hall} (${order.showtime}) | 📅 ${order.date}
          </p>

          <div class="food-order-items-list">
            ${order.snacks.map(s => `
              <div class="food-item-badge">
                <span style="color: var(--gold); font-weight: 800;">${s.qty}x</span>
                <span>${s.name}</span>
                <span style="color: var(--text-muted); font-size: 0.78rem;">($${(s.price * s.qty).toFixed(2)})</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.6rem;">
          <strong style="font-size: 1.2rem; color: #00e676;">$${(order.snacksTotal || 0).toFixed(2)}</strong>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            ${isPending ? `
              <button class="btn btn-primary btn-sm" onclick="markDeliveredHandler('${order.bookingCode}')">
                ✅ Despachar Comida
              </button>
            ` : ''}
            <button class="btn btn-secondary btn-sm" onclick="openPrintModalForFood('${order.bookingCode}')" title="Dar opción de imprimir ticket de dulcería">
              🖨️ Imprimir Ticket
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function markDeliveredHandler(bookingCode) {
  Storage.markFoodDelivered(bookingCode);
  renderFoodOrders();
  showToast(`Pedido ${bookingCode} marcado como ENTREGADO y despachado.`, "success");
}

// Punto de Venta Rápido de Snacks en Mostrador
function initPosSnacks() {
  const container = document.querySelector("#posSnacksSelector");
  if (!container) return;

  const snacks = Storage.getSnacks();
  counterCart = {};

  container.innerHTML = snacks.map(item => `
    <div class="pos-snack-item">
      <div>
        <strong style="font-size: 0.85rem; color: #fff;">${item.name}</strong>
        <p style="color: var(--gold); font-size: 0.78rem;">$${item.price.toFixed(2)}</p>
      </div>
      <div style="display: flex; align-items: center; gap: 0.4rem;">
        <button class="stepper-btn" style="width: 26px; height: 26px; font-size: 0.8rem;" onclick="updateCounterCart('${item.id}', -1)">-</button>
        <span id="pos-qty-${item.id}" style="font-weight: 700; font-size: 0.85rem; min-width: 18px; text-align: center;">0</span>
        <button class="stepper-btn" style="width: 26px; height: 26px; font-size: 0.8rem;" onclick="updateCounterCart('${item.id}', 1)">+</button>
      </div>
    </div>
  `).join('');
}

function updateCounterCart(snackId, change) {
  const snacks = Storage.getSnacks();
  const item = snacks.find(s => s.id === snackId);
  if (!item) return;

  if (!counterCart[snackId]) {
    counterCart[snackId] = { id: item.id, name: item.name, price: item.price, qty: 0 };
  }

  counterCart[snackId].qty += change;
  if (counterCart[snackId].qty <= 0) {
    delete counterCart[snackId];
  }

  const qtyLabel = document.querySelector(`#pos-qty-${snackId}`);
  if (qtyLabel) {
    qtyLabel.textContent = counterCart[snackId] ? counterCart[snackId].qty : 0;
  }

  // Actualizar total
  const total = Object.values(counterCart).reduce((sum, s) => sum + (s.price * s.qty), 0);
  const totalLabel = document.querySelector("#posTotalLabel");
  if (totalLabel) totalLabel.textContent = `$${total.toFixed(2)}`;
}

function processCounterSale() {
  const items = Object.values(counterCart);
  if (items.length === 0) {
    showToast("Por favor selecciona al menos un producto para la venta.", "info");
    return;
  }

  const clientNameInput = document.querySelector("#posClientName");
  const clientName = clientNameInput && clientNameInput.value.trim() ? clientNameInput.value.trim() : "Cliente Mostrador";
  const total = items.reduce((sum, s) => sum + (s.price * s.qty), 0);

  // Crear la venta registrada con entrega inmediata
  const sale = Storage.createWorkerFoodSale(clientName, items, total);

  // Reiniciar mostrador
  initPosSnacks();
  if (clientNameInput) clientNameInput.value = "";
  const totalLabel = document.querySelector("#posTotalLabel");
  if (totalLabel) totalLabel.textContent = "$0.00";

  showToast(`Venta de comida ${sale.bookingCode} registrada con éxito.`, "success");
  renderFoodOrders();

  // Dar la opción inmediata de imprimir el ticket de comida
  openPrintModalForFood(sale.bookingCode);
}

// =============================================================================
// MÓDULO 3: CENTRO DE IMPRESIÓN DE BOLETOS Y COMPROBANTES
// =============================================================================
function renderWorkerPrintTable(filterQuery = "") {
  const tbody = document.querySelector("#workerPrintTableBody");
  if (!tbody) return;

  let bookings = Storage.getBookings().filter(b => b.status === "CONFIRMADA");

  if (filterQuery) {
    const q = filterQuery.toLowerCase().trim();
    bookings = bookings.filter(b => 
      b.bookingCode.toLowerCase().includes(q) || 
      (b.clientName && b.clientName.toLowerCase().includes(q)) ||
      (b.movieTitle && b.movieTitle.toLowerCase().includes(q))
    );
  }

  tbody.innerHTML = bookings.map(b => {
    const seatsList = b.seats && Array.isArray(b.seats) ? b.seats.map(s => s.code || s).join(", ") : "Sin butacas";
    const snacksCount = b.snacks ? b.snacks.reduce((acc, s) => acc + s.qty, 0) : 0;

    return `
      <tr>
        <td><strong style="color: var(--gold); font-family: monospace; font-size: 1rem;">${b.bookingCode}</strong></td>
        <td>${b.showtime} (${b.date})</td>
        <td><strong>${b.movieTitle}</strong></td>
        <td>${b.hall}</td>
        <td><span class="badge" style="background: rgba(229,9,20,0.15); color: #ff6b72;">${seatsList}</span></td>
        <td>${snacksCount > 0 ? `🍿 ${snacksCount} productos` : 'Sin snacks'}</td>
        <td><strong style="color: #00e676;">$${(b.grandTotal || 0).toFixed(2)}</strong></td>
        <td>
          <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
            <button class="btn btn-primary btn-sm" onclick="openPrintModalForTicket('${b.bookingCode}')">
              🖨️ Imprimir Boleto
            </button>
            ${snacksCount > 0 ? `
              <button class="btn btn-secondary btn-sm" onclick="openPrintModalForFood('${b.bookingCode}')" title="Imprimir Comprobante de Dulcería">
                🍿 Imprimir Comida
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function searchTicketToPrint() {
  const input = document.querySelector("#workerSearchTicketInput");
  const query = input ? input.value.trim() : "";

  if (!query) {
    renderWorkerPrintTable();
    return;
  }

  const booking = Storage.getBookingByCode(query);
  if (booking) {
    // Si escribió el código exacto, abrir de inmediato la opción de imprimir
    openPrintModalForTicket(booking.bookingCode);
  } else {
    renderWorkerPrintTable(query);
  }
}

// Modal de Impresión: Boleto de Cine
function openPrintModalForTicket(bookingCode) {
  const booking = Storage.getBookingByCode(bookingCode);
  if (!booking) {
    showToast("Reserva no encontrada.", "info");
    return;
  }

  const modal = document.querySelector("#printTicketModal");
  const content = document.querySelector("#ticketPrintContent");
  if (!modal || !content) return;

  const seatsList = booking.seats && Array.isArray(booking.seats) 
    ? booking.seats.map(s => `${s.code || s} [${s.type || 'EST'}]`).join(", ")
    : "ENTRADA GENERAL";

  content.innerHTML = `
    <div class="ticket-print-header">
      <h2>👑 CINE MAJESTAD MULTIPLEX</h2>
      <p style="font-size: 0.8rem; margin-top: 0.2rem;">*** ENTRADA DE SALA OFICIAL ***</p>
      <p style="font-size: 0.75rem; color: #555;">Av. Principal Real #104 | Tel: 789-2026</p>
    </div>

    <div class="ticket-print-body">
      <div class="ticket-print-row">
        <span>CODIGO RESERVA:</span>
        <strong style="font-size: 1.1rem; letter-spacing: 0.1em;">${booking.bookingCode}</strong>
      </div>
      <div class="ticket-print-row">
        <span>FECHA / EMISION:</span>
        <span>${booking.date}</span>
      </div>
      <hr style="border: none; border-top: 1px dashed #999; margin: 0.6rem 0;">

      <div class="ticket-print-row">
        <span>PELICULA:</span>
        <strong style="text-transform: uppercase;">${booking.movieTitle}</strong>
      </div>
      <div class="ticket-print-row">
        <span>SALA:</span>
        <span>${booking.hall}</span>
      </div>
      <div class="ticket-print-row">
        <span>HORARIO:</span>
        <strong>${booking.showtime} (HOY)</strong>
      </div>
      <div class="ticket-print-row">
        <span>BUTACAS:</span>
        <strong style="font-size: 1.05rem;">${seatsList}</strong>
      </div>
      <div class="ticket-print-row">
        <span>CLIENTE:</span>
        <span>${booking.clientName || 'Cliente Taquilla'}</span>
      </div>

      <hr style="border: none; border-top: 1px dashed #999; margin: 0.6rem 0;">
      <div class="ticket-print-row" style="font-size: 1.1rem;">
        <span>TOTAL PAGADO:</span>
        <strong>$${(booking.grandTotal || 0).toFixed(2)}</strong>
      </div>
    </div>

    <div class="ticket-print-footer">
      <p style="font-size: 0.75rem; letter-spacing: 0.25em; font-family: monospace;">|||| | ||||| || |||||| | |||</p>
      <p style="font-size: 0.78rem; margin-top: 0.4rem; font-weight: bold;">ACCESO RAPIDO SIN FILAS</p>
      <p style="font-size: 0.7rem; color: #666; margin-top: 0.2rem;">¡Que disfrute la función en Cine Majestad!</p>
    </div>
  `;

  modal.classList.add("open");
}

// Modal de Impresión: Comprobante de Comida
function openPrintModalForFood(bookingCode) {
  const booking = Storage.getBookingByCode(bookingCode);
  if (!booking || !booking.snacks || booking.snacks.length === 0) {
    showToast("Esta orden no contiene productos de dulcería.", "info");
    return;
  }

  const modal = document.querySelector("#printTicketModal");
  const content = document.querySelector("#ticketPrintContent");
  if (!modal || !content) return;

  content.innerHTML = `
    <div class="ticket-print-header">
      <h2>👑 CINE MAJESTAD - DULCERIA</h2>
      <p style="font-size: 0.8rem; margin-top: 0.2rem;">*** TICKET DE DESPACHO DE COMIDAS ***</p>
      <p style="font-size: 0.75rem; color: #555;">Barra de Confitería Real</p>
    </div>

    <div class="ticket-print-body">
      <div class="ticket-print-row">
        <span>ORDEN:</span>
        <strong style="font-size: 1.1rem;">${booking.bookingCode}</strong>
      </div>
      <div class="ticket-print-row">
        <span>CLIENTE:</span>
        <strong>${booking.clientName || 'Cliente Mostrador'}</strong>
      </div>
      <div class="ticket-print-row">
        <span>HORA DESPACHO:</span>
        <span>${new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      <hr style="border: none; border-top: 1px dashed #999; margin: 0.6rem 0;">
      <p style="font-weight: bold; margin-bottom: 0.4rem;">PRODUCTOS A RETIRAR:</p>

      ${booking.snacks.map(s => `
        <div class="ticket-print-row">
          <span>${s.qty}x ${s.name}</span>
          <span>$${(s.price * s.qty).toFixed(2)}</span>
        </div>
      `).join('')}

      <hr style="border: none; border-top: 1px dashed #999; margin: 0.6rem 0;">
      <div class="ticket-print-row" style="font-size: 1.1rem;">
        <span>TOTAL ALIMENTOS:</span>
        <strong>$${(booking.snacksTotal || booking.grandTotal || 0).toFixed(2)}</strong>
      </div>
    </div>

    <div class="ticket-print-footer">
      <p style="font-size: 0.78rem; font-weight: bold;">PRODUCTOS LISTOS PARA CONSUMO</p>
      <p style="font-size: 0.7rem; color: #666; margin-top: 0.2rem;">Presenta este ticket en barra para cualquier cambio.</p>
    </div>
  `;

  modal.classList.add("open");
}

function closePrintModal() {
  const modal = document.querySelector("#printTicketModal");
  if (modal) modal.classList.remove("open");
}

// Disparar diálogo de impresión nativo del navegador
function triggerNativePrint() {
  window.print();
}
