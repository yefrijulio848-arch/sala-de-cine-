/* ==========================================================================
   Cine Majestad - Dulcería / Confitería & Temporizador Activo
   ========================================================================== */

let currentOrder = null;
let candyTimerInterval = null;

document.addEventListener("DOMContentLoaded", () => {
  currentOrder = Storage.getCurrentOrder();
  if (!currentOrder) {
    currentOrder = {
      movieId: null,
      movieTitle: "Combo Confitería / Snacks",
      poster: "https://images.unsplash.com/photo-1585647347483-22b66260dfff?w=600&auto=format&fit=crop&q=80",
      hall: "Área de Confitería",
      roomId: "candybar",
      showtime: "Inmediato",
      date: new Date().toISOString().split("T")[0],
      dateFormatted: "Hoy",
      seats: [],
      snacks: [],
      ticketsTotal: 0,
      total: 0,
      isDirectCandy: true
    };
    Storage.saveCurrentOrder(currentOrder);
  }
  if (!currentOrder.snacks) currentOrder.snacks = [];

  const backBtn = document.querySelector("#candyBackBtn");
  if (backBtn) {
    if (currentOrder.seats && currentOrder.seats.length > 0) {
      backBtn.href = "seats.html";
      backBtn.textContent = "← Regresar a Asientos";
    } else {
      backBtn.href = "index.html";
      backBtn.textContent = "← Volver a Cartelera";
    }
  }

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
  const targetCategory = (category || "all").toLowerCase();

  const filtered = targetCategory === "all" 
    ? snacks 
    : snacks.filter(s => (s.category || "").toLowerCase() === targetCategory);

  grid.innerHTML = filtered.map(item => {
    const existing = (currentOrder && currentOrder.snacks) ? currentOrder.snacks.find(s => s.id === item.id) : null;
    const qty = existing ? existing.qty : 0;

    const imgUrl = (item.img && item.img !== "undefined" && item.img.startsWith("http"))
      ? item.img
      : ((item.image && item.image !== "undefined" && item.image.startsWith("http"))
        ? item.image
        : "https://images.unsplash.com/photo-1585647347384-2593bc35786b?auto=format&fit=crop&w=600&q=80");

    const descText = (item.desc && item.desc !== "undefined")
      ? item.desc
      : ((item.description && item.description !== "undefined")
        ? item.description
        : "Acompaña tu película con nuestros mejores snacks recién preparados y bebidas heladas.");

    const badgeText = item.tag || item.badge || item.etiqueta || "Popular";

    return `
      <div class="snack-card">
        <div class="snack-img-box">
          <img src="${imgUrl}" 
               alt="${item.name}" 
               class="snack-img" 
               loading="lazy"
               onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1585647347384-2593bc35786b?auto=format&fit=crop&w=600&q=80';">
          <span class="snack-badge">${badgeText}</span>
        </div>
        <div class="snack-info">
          <h3 class="snack-title">${item.name}</h3>
          <p class="snack-desc">${descText}</p>
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

  const todayIso = new Date().toISOString().split("T")[0];
  const targetDate = currentOrder.date || todayIso;
  const showtimeKey = currentOrder.showtimeKey || `${currentOrder.movieId}_${targetDate}_${currentOrder.showtime}`;
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
  const snacksSubtotal = (currentOrder.snacks || []).reduce((sum, s) => sum + (s.price * s.qty), 0);

  if (ticketsSubtotal === 0 && snacksSubtotal === 0) {
    if (typeof showToast !== "undefined") {
      showToast("Por favor selecciona al menos un producto o combo de dulcería.", "warning");
    } else {
      alert("Por favor selecciona al menos un producto o combo de dulcería.");
    }
    return;
  }

  currentOrder.subtotalTickets = ticketsSubtotal;
  currentOrder.subtotalSnacks = snacksSubtotal;
  currentOrder.total = ticketsSubtotal + snacksSubtotal;
  currentOrder.seats = (currentOrder.seats || []).map(s => s.code || s);
  
  Storage.saveCurrentOrder(currentOrder);

  // Exigir registro o inicio de sesión como cliente antes de comprar
  const authUser = Storage.getAuthUser();
  if (!authUser) {
    if (typeof showToast !== "undefined") {
      showToast("Para completar tu compra, debes registrarte o iniciar sesión como cliente.", "info");
    }
    setTimeout(() => {
      window.location.href = `login.html?returnTo=${encodeURIComponent("candybar.html")}&tab=register`;
    }, 800);
    return;
  }

  if (typeof PaymentModal !== "undefined") {
    PaymentModal.open(currentOrder);
  } else {
    window.location.href = "checkout.html";
  }
}
