/* ==========================================================================
   Cine Majestad - Sala de Cine & Selección de Asientos con Concurrencia Real
   ========================================================================== */

let currentOrder = null;
let currentRoom = null;
let showtimeKey = "";
let timerInterval = null;

document.addEventListener("DOMContentLoaded", () => {
  initOrderAndRoom();
  renderSeatsGrid();
  updateSummary();
  initHoldTimer();

  // Inicializar cliente Socket.io en tiempo real
  if (typeof RealTime !== "undefined") {
    RealTime.init();
    RealTime.joinShowtime(showtimeKey, (syncData) => {
      if (syncData) {
        if (syncData.occupied && Array.isArray(syncData.occupied)) {
          Storage.saveOccupiedSeats(showtimeKey, syncData.occupied);
        }
        if (syncData.lockedBy) {
          Object.entries(syncData.lockedBy).forEach(([sId, lock]) => {
            Storage.lockSeat(showtimeKey, sId, lock.sessionId);
          });
        }
      }
      renderSeatsGrid();
    });
    RealTime.onSeatSelecting((data) => {
      if (data && data.seatId) {
        Storage.lockSeat(data.showtimeKey || showtimeKey, data.seatId, data.sessionId);
      }
      renderSeatsGrid();
    });
    RealTime.onSeatReleased((data) => {
      if (data && data.seatId) {
        Storage.unlockSeat(data.showtimeKey || showtimeKey, data.seatId, data.sessionId);
      }
      renderSeatsGrid();
    });
    RealTime.onSeatBooked((data) => {
      if (data && data.seats) {
        const occupied = Storage.getOccupiedSeats(data.showtimeKey || showtimeKey);
        data.seats.forEach(s => {
          const sCode = s.code || s;
          if (!occupied.includes(sCode)) occupied.push(sCode);
          Storage.unlockSeat(data.showtimeKey || showtimeKey, sCode);
        });
        Storage.saveOccupiedSeats(data.showtimeKey || showtimeKey, occupied);
      }
      renderSeatsGrid();
    });
  }

  // Escuchar eventos en tiempo real entre pestañas / sesiones (BroadcastChannel)
  Storage.onSync((event) => {
    // Si cualquier otra pestaña bloqueó, liberó o completó asientos, refrescar la sala
    renderSeatsGrid();
  });
});

// Inicializar orden actual y datos de sala
function initOrderAndRoom() {
  currentOrder = Storage.getCurrentOrder();

  // Si no hay película cargada, cargar la primera por defecto
  if (!currentOrder || !currentOrder.movieTitle) {
    const defaultMovie = Storage.getMovies()[0];
    currentOrder = {
      movieId: defaultMovie.id,
      movieTitle: defaultMovie.title,
      poster: defaultMovie.poster,
      hall: defaultMovie.hall,
      roomId: defaultMovie.roomId || "sala-1",
      showtime: defaultMovie.showtimes[0],
      priceStandard: defaultMovie.priceStandard,
      priceVip: defaultMovie.priceVip,
      seats: [],
      snacks: [],
      total: 0
    };
    Storage.saveCurrentOrder(currentOrder);
  }

  showtimeKey = `${currentOrder.movieId}_${currentOrder.showtime}`;

  // Buscar configuración de la sala arquitectónica
  const rooms = Storage.getRooms();
  currentRoom = rooms.find(r => r.id === currentOrder.roomId || r.name === currentOrder.hall) || rooms[0];

  // Actualizar leyendas con precios reales de esta función
  const legendStd = document.querySelector("#legendPriceStandard");
  const legendVip = document.querySelector("#legendPriceVip");
  if (legendStd) legendStd.textContent = `Estándar ($${currentOrder.priceStandard.toFixed(2)})`;
  if (legendVip) legendVip.textContent = `VIP Luxury ($${currentOrder.priceVip.toFixed(2)})`;
}

// Renderizar la matriz arquitectónica de butacas según la maqueta de la sala
function renderSeatsGrid() {
  const gridContainer = document.querySelector("#seatsGrid");
  if (!gridContainer || !currentRoom) return;

  gridContainer.innerHTML = "";

  const hallSection = document.querySelector(".cinema-hall");
  const layoutType = currentRoom.layoutType || (
    currentRoom.id === "sala-1" ? "curved_imax" :
    currentRoom.id === "sala-2" ? "stadium_double_aisle" :
    currentRoom.id === "sala-3" ? "motion_4dx" : "vip_lounge"
  );

  // Aplicar clases de maqueta arquitectónica al contenedor
  if (hallSection) {
    hallSection.classList.remove("layout-curved-imax", "layout-stadium-double", "layout-motion-4dx", "layout-vip-lounge");
    hallSection.classList.add(`layout-${layoutType.replace(/_/g, "-")}`);
  }

  // Actualizar distintivo de maqueta
  const badgeEl = document.querySelector("#hallArchitectureBadge");
  if (badgeEl) {
    badgeEl.textContent = currentRoom.layoutBadge || (
      layoutType === "curved_imax" ? "🏛️ Maqueta: Anfiteatro Curvo IMAX" :
      layoutType === "stadium_double_aisle" ? "🏟️ Maqueta: Estadio 3 Bloques (Doble Pasillo)" :
      layoutType === "motion_4dx" ? "🚀 Maqueta: Pods Mecánicos 4DX" :
      "👑 Maqueta: Palcos VIP & Sofás Dobles"
    );
  }

  const rows = currentRoom.rows || ["A", "B", "C", "D", "E", "F"];
  const seatsPerRow = currentRoom.seatsPerRow || 10;
  const vipRows = currentRoom.vipRows || ["E", "F"];

  // Estados de ocupación y candados en tiempo real
  const occupiedSeats = Storage.getOccupiedSeats(showtimeKey);
  const overrides = Storage.getSeatOverrides(showtimeKey);
  const mySessionId = Storage.getSessionId();

  // Función fábrica para crear cada botón de butaca
  function createSeatButton(row, col, isVipRow, isWheelchair = false) {
    const seatCode = `${row}-${col}`;
    const isOccupied = occupiedSeats.includes(seatCode);
    const isSelectedByMe = currentOrder.seats && currentOrder.seats.some(s => s.code === seatCode);
    const lockedByOther = Storage.isSeatLockedByOther(showtimeKey, seatCode, mySessionId);
    const isMaintenance = overrides[seatCode] === "MAINTENANCE";

    const seat = document.createElement("button");
    seat.className = "seat";
    seat.setAttribute("data-seat", seatCode);
    seat.setAttribute("data-col", col);
    seat.setAttribute("data-row", row);
    seat.setAttribute("data-type", isVipRow ? "vip" : "standard");
    seat.textContent = col;

    if (isVipRow) seat.classList.add("vip");
    if (layoutType === "vip_lounge") seat.classList.add("vip-recliner");
    if (isWheelchair) seat.classList.add("seat-wheelchair");

    if (isMaintenance) {
      seat.classList.add("maintenance");
      seat.title = `Butaca ${seatCode}: No disponible por mantenimiento`;
    } else if (isOccupied) {
      seat.classList.add("occupied");
      seat.title = `Butaca ${seatCode}: Ocupada / Vendida`;
    } else if (isSelectedByMe) {
      seat.classList.add("selected");
      seat.title = `Butaca ${seatCode}: Bloqueada en tu orden`;
    } else if (lockedByOther) {
      seat.classList.add("locked");
      seat.title = `Butaca ${seatCode}: Siendo seleccionada por otro cliente en este momento 🔒`;
    } else {
      const price = isVipRow ? currentOrder.priceVip : currentOrder.priceStandard;
      const typeLabel = isWheelchair ? "Accesible ♿" : (layoutType === "vip_lounge" ? "Sillón VIP Reclinable" : (isVipRow ? "VIP Luxury" : "Estándar"));
      seat.title = `Butaca ${seatCode} (${typeLabel}): $${price.toFixed(2)}`;
    }

    seat.addEventListener("click", () => handleSeatClick(seatCode, isVipRow, seat));
    return seat;
  }

  // RENDERIZADO SEGÚN LA FORMA ARQUITECTÓNICA DE CADA SALA
  rows.forEach(row => {
    const rowEl = document.createElement("div");
    rowEl.className = "seat-row";

    // Etiqueta lateral izquierda
    const labelLeft = document.createElement("span");
    labelLeft.className = "row-label";
    labelLeft.textContent = row;
    rowEl.appendChild(labelLeft);

    const isVipRow = vipRows.includes(row);

    // =========================================================================
    // MAQUETA 1: ANFITEATRO CURVO IMAX (Curved Amphitheater)
    // =========================================================================
    if (layoutType === "curved_imax") {
      for (let col = 1; col <= seatsPerRow; col++) {
        // Pasillo central
        if (col === 6) {
          const aisle = document.createElement("div");
          aisle.className = "aisle-gap";
          rowEl.appendChild(aisle);
        }
        rowEl.appendChild(createSeatButton(row, col, isVipRow));
      }
    }

    // =========================================================================
    // MAQUETA 2: ESTADIO CLÁSICO 3 BLOQUES Y DOBLE PASILLO (Triple Block Stadium)
    // =========================================================================
    else if (layoutType === "stadium_double_aisle") {
      // Bloque Lateral Izquierdo (cols 1 y 2)
      const blockLeft = document.createElement("div");
      blockLeft.className = "stadium-block block-left";
      blockLeft.appendChild(createSeatButton(row, 1, isVipRow, row === "A"));
      blockLeft.appendChild(createSeatButton(row, 2, isVipRow));
      rowEl.appendChild(blockLeft);

      // Pasillo 1 de escalones iluminados
      const aisle1 = document.createElement("div");
      aisle1.className = "aisle-stairs";
      rowEl.appendChild(aisle1);

      // Bloque Central Platea (cols 3, 4, 5, 6, 7, 8)
      const blockCenter = document.createElement("div");
      blockCenter.className = "stadium-block block-center";
      for (let col = 3; col <= 8; col++) {
        blockCenter.appendChild(createSeatButton(row, col, isVipRow));
      }
      rowEl.appendChild(blockCenter);

      // Pasillo 2 de escalones iluminados
      const aisle2 = document.createElement("div");
      aisle2.className = "aisle-stairs";
      rowEl.appendChild(aisle2);

      // Bloque Lateral Derecho (cols 9 y 10)
      const blockRight = document.createElement("div");
      blockRight.className = "stadium-block block-right";
      blockRight.appendChild(createSeatButton(row, 9, isVipRow));
      blockRight.appendChild(createSeatButton(row, 10, isVipRow, row === "A"));
      rowEl.appendChild(blockRight);
    }

    // =========================================================================
    // MAQUETA 3: PODS MECÁNICOS 4DX (Motion Pods)
    // =========================================================================
    else if (layoutType === "motion_4dx") {
      // Pod 1 (cols 1 a 4)
      const pod1 = document.createElement("div");
      pod1.className = "motion-pod";
      for (let col = 1; col <= 4; col++) {
        pod1.appendChild(createSeatButton(row, col, isVipRow));
      }
      rowEl.appendChild(pod1);

      // Pasillo de Efectos Especiales 4DX
      const effectsAisle = document.createElement("div");
      effectsAisle.className = "effects-aisle";
      effectsAisle.innerHTML = `<span>💨</span><span>💧</span>`;
      effectsAisle.title = "Pasillo de efectos ambientales (viento, niebla y estrobos)";
      rowEl.appendChild(effectsAisle);

      // Pod 2 (cols 5 a 8)
      const pod2 = document.createElement("div");
      pod2.className = "motion-pod";
      for (let col = 5; col <= 8; col++) {
        pod2.appendChild(createSeatButton(row, col, isVipRow));
      }
      rowEl.appendChild(pod2);

      // Si la fila tiene más de 8 asientos, agregar un pod adicional
      if (seatsPerRow > 8) {
        const pod3 = document.createElement("div");
        pod3.className = "motion-pod";
        for (let col = 9; col <= seatsPerRow; col++) {
          pod3.appendChild(createSeatButton(row, col, isVipRow));
        }
        rowEl.appendChild(pod3);
      }
    }

    // =========================================================================
    // MAQUETA 4: PALCOS VIP & SOFÁS DOBLES PARA PAREJAS (Love Seats & Suites)
    // =========================================================================
    else if (layoutType === "vip_lounge") {
      // Pareja 1: cols 1 y 2
      const pair1 = document.createElement("div");
      pair1.className = "love-seat-pair";
      pair1.appendChild(createSeatButton(row, 1, true));
      pair1.appendChild(createSeatButton(row, 2, true));
      rowEl.appendChild(pair1);

      // Mesita auxiliar con servicio
      const table1 = document.createElement("div");
      table1.className = "lounge-table";
      table1.innerHTML = `🍷`;
      table1.title = "Mesita de servicio gourmet para pareja";
      rowEl.appendChild(table1);

      // Pareja 2: cols 3 y 4
      const pair2 = document.createElement("div");
      pair2.className = "love-seat-pair";
      pair2.appendChild(createSeatButton(row, 3, true));
      pair2.appendChild(createSeatButton(row, 4, true));
      rowEl.appendChild(pair2);

      // Pasillo central con alfombra roja
      const carpetAisle = document.createElement("div");
      carpetAisle.className = "carpet-aisle";
      carpetAisle.textContent = "⚜️";
      rowEl.appendChild(carpetAisle);

      // Pareja 3: cols 5 y 6
      const pair3 = document.createElement("div");
      pair3.className = "love-seat-pair";
      pair3.appendChild(createSeatButton(row, 5, true));
      pair3.appendChild(createSeatButton(row, 6, true));
      rowEl.appendChild(pair3);

      // Mesita auxiliar con servicio
      const table2 = document.createElement("div");
      table2.className = "lounge-table";
      table2.innerHTML = `🍷`;
      table2.title = "Mesita de servicio gourmet para pareja";
      rowEl.appendChild(table2);

      // Pareja 4: cols 7 y 8
      const pair4 = document.createElement("div");
      pair4.className = "love-seat-pair";
      pair4.appendChild(createSeatButton(row, 7, true));
      pair4.appendChild(createSeatButton(row, 8, true));
      rowEl.appendChild(pair4);
    }

    // Fallback estándar
    else {
      for (let col = 1; col <= seatsPerRow; col++) {
        if (col === Math.floor(seatsPerRow / 2) + 1) {
          const aisle = document.createElement("div");
          aisle.className = "aisle-gap";
          rowEl.appendChild(aisle);
        }
        rowEl.appendChild(createSeatButton(row, col, isVipRow));
      }
    }

    // Etiqueta lateral derecha
    const labelRight = document.createElement("span");
    labelRight.className = "row-label";
    labelRight.textContent = row;
    rowEl.appendChild(labelRight);

    gridContainer.appendChild(rowEl);
  });
}

// Manejar clic en una butaca con validación concurrente estricta
function handleSeatClick(seatCode, isVip, seatElement) {
  const occupiedSeats = Storage.getOccupiedSeats(showtimeKey);
  const overrides = Storage.getSeatOverrides(showtimeKey);
  const mySessionId = Storage.getSessionId();

  // 1. Asiento en mantenimiento
  if (overrides[seatCode] === "MAINTENANCE") {
    showToast(`La butaca ${seatCode} está fuera de servicio por mantenimiento.`, "info");
    return;
  }

  // 2. Asiento vendido permanentemente
  if (occupiedSeats.includes(seatCode)) {
    showToast(`La butaca ${seatCode} ya fue comprada para esta función.`, "info");
    return;
  }

  // 3. Asiento bloqueado por OTRO cliente
  const lockedByOther = Storage.isSeatLockedByOther(showtimeKey, seatCode, mySessionId);
  if (lockedByOther) {
    showToast(`⚠️ La butaca ${seatCode} está siendo reservada por otro cliente. Nadie más la puede tomar hasta que se confirme o se libere.`, "info");
    return;
  }

  // 4. ¿Ya la tenía seleccionada este usuario? -> Deseleccionar y liberar bloqueo
  const existingIdx = currentOrder.seats.findIndex(s => s.code === seatCode);

  if (existingIdx > -1) {
    // Quitar de la selección
    currentOrder.seats.splice(existingIdx, 1);
    Storage.unlockSeat(showtimeKey, seatCode, mySessionId);
    if (typeof RealTime !== "undefined") RealTime.releaseSeat(seatCode, showtimeKey);
    seatElement.classList.remove("selected");
    showToast(`Butaca ${seatCode} liberada.`, "info");
  } else {
    // 5. Queriendo seleccionar una nueva butaca
    const settings = Storage.getSettings();
    const maxSeats = settings.maxSeatsPerTransaction || 8;

    if (currentOrder.seats.length >= maxSeats) {
      showToast(`Puedes seleccionar un máximo de ${maxSeats} boletos por compra.`, "info");
      return;
    }

    // Intentar adquirir el bloqueo en el motor de concurrencia
    const lockResult = Storage.lockSeat(showtimeKey, seatCode, mySessionId);
    if (!lockResult.success) {
      showToast(`⚠️ ¡La butaca ${seatCode} acaba de ser tomada por otro cliente!`, "info");
      renderSeatsGrid();
      return;
    }

    if (typeof RealTime !== "undefined") RealTime.selectSeat(seatCode, showtimeKey);

    const price = isVip ? currentOrder.priceVip : currentOrder.priceStandard;
    currentOrder.seats.push({
      code: seatCode,
      type: isVip ? "VIP" : "Estándar",
      price: price
    });
    seatElement.classList.add("selected");
    showToast(`Butaca ${seatCode} bloqueada temporalmente para ti.`, "success");
  }

  Storage.saveCurrentOrder(currentOrder);
  updateSummary();
  updateCartBadge();
  initHoldTimer(); // Reiniciar / actualizar temporizador
}

// Control del Temporizador de Expiración (Countdown Timer)
function initHoldTimer() {
  const timerBox = document.querySelector("#holdTimerBox");
  const timerDigits = document.querySelector("#holdTimer");
  const statusLabel = document.querySelector("#summaryLockStatus");

  if (!timerDigits) return;

  if (currentOrder.seats.length === 0) {
    if (timerInterval) clearInterval(timerInterval);
    timerDigits.textContent = "05:00";
    if (timerBox) timerBox.classList.remove("active");
    if (statusLabel) {
      statusLabel.textContent = "Sin asientos";
      statusLabel.style.color = "var(--text-muted)";
    }
    return;
  }

  if (statusLabel) {
    statusLabel.textContent = "🔒 Protegido para ti";
    statusLabel.style.color = "var(--gold)";
  }
  if (timerBox) timerBox.classList.add("active");

  if (timerInterval) clearInterval(timerInterval);

  const updateTick = () => {
    const remainingMs = Storage.getSessionRemainingHoldTime(showtimeKey, Storage.getSessionId());

    if (remainingMs <= 0) {
      clearInterval(timerInterval);
      handleHoldExpired();
      return;
    }

    const totalSeconds = Math.floor(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    timerDigits.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  updateTick();
  timerInterval = setInterval(updateTick, 1000);
}

// Acción cuando expira el temporizador sin confirmar la venta
function handleHoldExpired() {
  const mySessionId = Storage.getSessionId();
  Storage.releaseAllLocksForSession(mySessionId, showtimeKey);

  currentOrder.seats = [];
  Storage.saveCurrentOrder(currentOrder);

  renderSeatsGrid();
  updateSummary();
  updateCartBadge();

  // Abrir modal de alerta de expiración
  const modal = document.querySelector("#expiredModal");
  if (modal) modal.classList.add("open");
}

function closeExpiredModal() {
  const modal = document.querySelector("#expiredModal");
  if (modal) modal.classList.remove("open");
  initHoldTimer();
}

// Cancelar orden y liberar butacas
function handleCancelOrder() {
  const mySessionId = Storage.getSessionId();
  Storage.releaseAllLocksForSession(mySessionId, showtimeKey);
  currentOrder.seats = [];
  Storage.saveCurrentOrder(currentOrder);
}

// Actualizar resumen lateral
function updateSummary() {
  const miniPoster = document.querySelector("#summaryPoster");
  const miniTitle = document.querySelector("#summaryTitle");
  const miniHall = document.querySelector("#summaryHall");
  const miniTime = document.querySelector("#summaryTime");
  const seatsTagsContainer = document.querySelector("#selectedSeatsTags");
  const countLabel = document.querySelector("#summarySeatsCount");
  const totalPriceLabel = document.querySelector("#summaryTotalPrice");
  const continueBtn = document.querySelector("#btnProceedCandy");

  if (miniPoster) miniPoster.src = currentOrder.poster;
  if (miniTitle) miniTitle.textContent = currentOrder.movieTitle;
  if (miniHall) miniHall.textContent = currentOrder.hall;
  if (miniTime) miniTime.textContent = currentOrder.showtime;

  if (seatsTagsContainer) {
    if (currentOrder.seats.length === 0) {
      seatsTagsContainer.innerHTML = `<span style="color: var(--text-muted); font-size: 0.85rem;">Ningún asiento seleccionado</span>`;
    } else {
      seatsTagsContainer.innerHTML = currentOrder.seats.map(s => `
        <span class="seat-tag ${s.type === 'VIP' ? 'vip-tag' : ''}">
          ${s.code} (${s.type})
        </span>
      `).join('');
    }
  }

  const seatsTotal = currentOrder.seats.reduce((sum, s) => sum + s.price, 0);
  currentOrder.ticketsTotal = seatsTotal;

  if (countLabel) countLabel.textContent = `${currentOrder.seats.length} boletos`;
  if (totalPriceLabel) totalPriceLabel.textContent = `$${seatsTotal.toFixed(2)}`;

  const directBtn = document.querySelector("#btnProceedDirectCheckout");
  if (directBtn) {
    if (currentOrder.seats.length > 0) {
      directBtn.removeAttribute("disabled");
      directBtn.style.opacity = "1";
      directBtn.style.pointerEvents = "all";
    } else {
      directBtn.setAttribute("disabled", "true");
      directBtn.style.opacity = "0.5";
      directBtn.style.pointerEvents = "none";
    }
  }

  if (continueBtn) {
    if (currentOrder.seats.length > 0) {
      continueBtn.removeAttribute("disabled");
      continueBtn.style.opacity = "1";
      continueBtn.style.pointerEvents = "all";
    } else {
      continueBtn.setAttribute("disabled", "true");
      continueBtn.style.opacity = "0.5";
      continueBtn.style.pointerEvents = "none";
    }
  }
}

// Confirmar boletos directamente (flujo exclusivo del cliente que solo compra entradas)
function proceedToCheckoutDirectly() {
  if (!currentOrder || !currentOrder.seats || currentOrder.seats.length === 0) {
    showToast("Por favor selecciona al menos una butaca.", "info");
    return;
  }

  // Asegurar que cada asiento tenga formato consistente
  currentOrder.seats = currentOrder.seats.map(s => {
    if (typeof s === "string") {
      const isVip = currentRoom && currentRoom.vipRows && currentRoom.vipRows.includes(s.split("-")[0]);
      return {
        code: s,
        type: isVip ? "VIP" : "Estándar",
        price: isVip ? (currentOrder.priceVip || 8.50) : (currentOrder.priceStandard || 5.50)
      };
    }
    return s;
  });

  currentOrder.snacks = currentOrder.snacks || [];
  const ticketsSum = currentOrder.seats.reduce((sum, s) => sum + (s.price || 0), 0);
  currentOrder.subtotalTickets = ticketsSum;
  currentOrder.ticketsTotal = ticketsSum;
  currentOrder.subtotalSnacks = (currentOrder.snacks || []).reduce((sum, s) => sum + ((s.price || 0) * (s.qty || s.quantity || 1)), 0);
  currentOrder.total = currentOrder.subtotalTickets + currentOrder.subtotalSnacks;
  currentOrder.grandTotal = currentOrder.total;
  Storage.saveCurrentOrder(currentOrder);

  // Exigir registro o inicio de sesión como cliente antes de comprar
  const authUser = Storage.getAuthUser();
  if (!authUser) {
    showToast("Para completar tu compra, debes registrarte o iniciar sesión como cliente.", "info");
    setTimeout(() => {
      window.location.href = `login.html?returnTo=${encodeURIComponent("seats.html")}&tab=register`;
    }, 800);
    return;
  }

  if (typeof PaymentModal !== "undefined") {
    PaymentModal.open(currentOrder);
  } else {
    window.location.href = "checkout.html";
  }
}

// Continuar al paso opcional de confitería
function proceedToCandybar() {
  if (currentOrder.seats.length === 0) {
    showToast("Por favor selecciona al menos un asiento.", "info");
    return;
  }
  Storage.saveCurrentOrder(currentOrder);
  window.location.href = "candybar.html";
}

// =============================================================================
// DEMOSTRACIÓN EN VIVO DE CONCURRENCIA (Simular otro cliente eligiendo asientos)
// =============================================================================
function simulateConcurrentBuyer() {
  const mySessionId = Storage.getSessionId();
  const simSessionId = "sim_buyer_" + Math.floor(100 + Math.random() * 900);
  const occupied = Storage.getOccupiedSeats(showtimeKey);
  const mySeatCodes = currentOrder.seats.map(s => s.code);

  const rows = currentRoom.rows || ["A", "B", "C", "D", "E", "F"];
  const seatsPerRow = currentRoom.seatsPerRow || 10;
  const availableCandidates = [];

  rows.forEach(r => {
    for (let c = 1; c <= seatsPerRow; c++) {
      const code = `${r}-${c}`;
      if (!occupied.includes(code) && !mySeatCodes.includes(code) && !Storage.isSeatLockedByOther(showtimeKey, code, mySessionId)) {
        availableCandidates.push(code);
      }
    }
  });

  if (availableCandidates.length < 2) {
    showToast("No hay suficientes butacas libres para simular otro comprador.", "info");
    return;
  }

  // Escoger 2 butacas contiguas o cercanas al azar
  const seat1 = availableCandidates[Math.floor(Math.random() * availableCandidates.length)];
  const remainingCandidates = availableCandidates.filter(c => c !== seat1);
  const seat2 = remainingCandidates[Math.floor(Math.random() * remainingCandidates.length)];

  // Bloquear para el cliente simulado por 25 segundos
  Storage.lockSeat(showtimeKey, seat1, simSessionId);
  Storage.lockSeat(showtimeKey, seat2, simSessionId);

  renderSeatsGrid();

  showToast(`🤖 Simulación iniciada: Otro cliente (ID: ${simSessionId}) acaba de seleccionar las butacas ${seat1} y ${seat2}. Observa cómo quedaron bloqueadas con candado 🔒 en tu pantalla.`, "info");

  // Cuenta regresiva de liberación de la simulación
  setTimeout(() => {
    Storage.unlockSeat(showtimeKey, seat1, simSessionId);
    Storage.unlockSeat(showtimeKey, seat2, simSessionId);
    renderSeatsGrid();
    showToast(`🤖 El cliente simulado no completó su pago. Las butacas ${seat1} y ${seat2} se han liberado y están disponibles nuevamente.`, "success");
  }, 22000);
}
