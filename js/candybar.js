/* ==========================================================================
   Cine Majestad - Dulcería / Confitería & Temporizador Activo
   ========================================================================== */

let currentOrder = null;
let candyTimerInterval = null;

document.addEventListener("DOMContentLoaded", () => {
  currentOrder = Storage.getCurrentOrder();
  if (!currentOrder) {
    window.location.href = "index.html";
    return;
  }
  if (!currentOrder.snacks) currentOrder.snacks = [];

  renderSnacks("all");
  initSnackFilters();
  updateCandySummary();
  initCandyHoldTimer();
});

// Renderizar productos de dulcería
function renderSnacks(category = "all") {
  const grid = document.querySelector("#candyGrid");
  if (!grid) return;

  const snacks = Storage.getSnacks();
  const filtered = category === "all" 
    ? snacks 
    : snacks.filter(s => s.category === category);

  grid.innerHTML = filtered.map(item => {
    const existing = currentOrder.snacks.find(s => s.id === item.id);
    const qty = existing ? existing.qty : 0;

    return `
      <div class="snack-card">
        <div class="snack-img-box">
          <img src="${item.img}" alt="${item.name}" class="snack-img" loading="lazy">
          <span class="snack-badge">${item.tag || 'Popular'}</span>
        </div>
        <div class="snack-info">
          <h3 class="snack-title">${item.name}</h3>
          <p class="snack-desc">${item.desc}</p>
          <div class="snack-bottom">
            <span class="snack-price">$${item.price.toFixed(2)}</span>
            <div class="stepper">
              <button class="stepper-btn" onclick="updateSnackQty('${item.id}', -1)">-</button>
              <span class="stepper-value" id="qty-${item.id}">${qty}</span>
              <button class="stepper-btn" onclick="updateSnackQty('${item.id}', 1)">+</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Filtros de categoría de confitería
function initSnackFilters() {
  const pills = document.querySelectorAll(".candy-categories .pill-btn");
  pills.forEach(pill => {
    pill.addEventListener("click", () => {
      pills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      const cat = pill.getAttribute("data-category");
      renderSnacks(cat);
    });
  });
}

// Modificar cantidad de snack
function updateSnackQty(snackId, change) {
  const snacks = Storage.getSnacks();
  const item = snacks.find(s => s.id === snackId);
  if (!item) return;

  let existing = currentOrder.snacks.find(s => s.id === snackId);

  if (!existing && change > 0) {
    existing = {
      id: item.id,
      name: item.name,
      price: item.price,
      qty: 0
    };
    currentOrder.snacks.push(existing);
  }

  if (existing) {
    existing.qty += change;
    if (existing.qty <= 0) {
      currentOrder.snacks = currentOrder.snacks.filter(s => s.id !== snackId);
    }
  }

  // Actualizar visor de cantidad
  const qtyEl = document.querySelector(`#qty-${snackId}`);
  if (qtyEl) {
    qtyEl.textContent = existing && existing.qty > 0 ? existing.qty : 0;
  }

  Storage.saveCurrentOrder(currentOrder);
  updateCandySummary();
  updateCartBadge();
}

// Actualizar resumen de compra lateral
function updateCandySummary() {
  const ticketsSubtotal = currentOrder.ticketsTotal || 0;
  const snacksSubtotal = currentOrder.snacks.reduce((sum, s) => sum + (s.price * s.qty), 0);
  const grandTotal = ticketsSubtotal + snacksSubtotal;

  const ticketsLabel = document.querySelector("#candySummaryTickets");
  const snacksLabel = document.querySelector("#candySummarySnacks");
  const grandTotalLabel = document.querySelector("#candyGrandTotal");
  const snacksListEl = document.querySelector("#candyItemsList");

  if (ticketsLabel) ticketsLabel.textContent = `$${ticketsSubtotal.toFixed(2)}`;
  if (snacksLabel) snacksLabel.textContent = `$${snacksSubtotal.toFixed(2)}`;
  if (grandTotalLabel) grandTotalLabel.textContent = `$${grandTotal.toFixed(2)}`;

  if (snacksListEl) {
    if (currentOrder.snacks.length === 0) {
      snacksListEl.innerHTML = `<span style="color: var(--text-muted); font-size: 0.85rem;">No has agregado snacks aún</span>`;
    } else {
      snacksListEl.innerHTML = currentOrder.snacks.map(s => `
        <div class="summary-row" style="font-size: 0.85rem;">
          <span>${s.qty}x ${s.name}</span>
          <strong>$${(s.price * s.qty).toFixed(2)}</strong>
        </div>
      `).join('');
    }
  }
}

// Temporizador de protección de asientos mientras se eligen snacks
function initCandyHoldTimer() {
  const timerBar = document.querySelector("#candyTimerBar");
  const timerDigits = document.querySelector("#candyHoldTimer");
  if (!timerBar || !timerDigits) return;

  if (!currentOrder.seats || currentOrder.seats.length === 0) {
    timerBar.style.display = "none";
    return;
  }

  const showtimeKey = `${currentOrder.movieId}_${currentOrder.showtime}`;
  timerBar.style.display = "flex";

  const notice = document.querySelector("#candySeatsNotice");
  if (notice) {
    notice.innerHTML = `<strong>Tus butacas (${currentOrder.seats.map(s => s.code).join(", ")}) están aseguradas:</strong> Confirma antes de que acabe el tiempo.`;
  }

  const updateTick = () => {
    const remainingMs = Storage.getSessionRemainingHoldTime(showtimeKey, Storage.getSessionId());
    if (remainingMs <= 0) {
      clearInterval(candyTimerInterval);
      alert("⚠️ Tu tiempo de reserva ha expirado. Tus butacas se han liberado.");
      Storage.releaseAllLocksForSession(Storage.getSessionId(), showtimeKey);
      currentOrder.seats = [];
      Storage.saveCurrentOrder(currentOrder);
      window.location.href = "seats.html";
      return;
    }

    const totalSeconds = Math.floor(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    timerDigits.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  updateTick();
  candyTimerInterval = setInterval(updateTick, 1000);
}

// Continuar al Checkout final
function proceedToCheckout() {
  const ticketsSubtotal = currentOrder.ticketsTotal || 0;
  const snacksSubtotal = currentOrder.snacks.reduce((sum, s) => sum + (s.price * s.qty), 0);
  currentOrder.subtotalTickets = ticketsSubtotal;
  currentOrder.subtotalSnacks = snacksSubtotal;
  currentOrder.total = ticketsSubtotal + snacksSubtotal;
  currentOrder.seats = (currentOrder.seats || []).map(s => s.code || s);
  
  Storage.saveCurrentOrder(currentOrder);

  if (typeof PaymentModal !== "undefined") {
    PaymentModal.open(currentOrder);
  } else {
    window.location.href = "checkout.html";
  }
}
