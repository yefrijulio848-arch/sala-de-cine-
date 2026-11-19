/* ==========================================================================
   Cine Majestad - Portal del Trabajador (Funciones, Comidas & Impresión)
   ========================================================================== */

let currentFoodFilter = "PENDIENTE";
let counterCart = {};
let currentPosCategory = "all";
let currentPosSearch = "";
let currentActiveWorkerShowtimeKey = null;
let workerSelectedSeats = [];
let currentWorkerModalContext = null;

function findRoomForMovie(movie, rooms) {
  if (!movie) return (rooms && rooms[0]) || null;
  const list = rooms || Storage.getRooms();
  return list.find(r => 
    r.id === movie.roomId || 
    (r.id && movie.roomId && r.id.replace(/\D/g, '') === String(movie.roomId).replace(/\D/g, '')) ||
    r.name === movie.hall ||
    (r.name && movie.hall && (r.name.includes(movie.hall) || movie.hall.includes(r.name)))
  ) || list[0];
}

document.addEventListener("DOMContentLoaded", () => {
  initWorkerTabs();
  renderWorkerShowtimes();
  renderFoodOrders();
  initPosSnacks();
  renderWorkerPrintTable();

  // Configuración de interfaz automática según el cargo del trabajador
  setupWorkerRoleInterface();

  // Suscribirse a cambios en tiempo real
  Storage.onSync((event) => {
    if (event.type === "BOOKING_SAVED" || event.type === "FOOD_STATUS_UPDATED" || event.type === "SALE_CONFIRMED" || event.type === "ROOMS_UPDATED" || event.type === "MOVIES_UPDATED" || event.type === "SEATS_OCCUPIED_UPDATED" || event.type === "SEAT_OVERRIDE_CHANGED" || event.type === "ALL_LOCKS_CLEARED") {
      renderFoodOrders();
      renderWorkerPrintTable();
      renderWorkerShowtimes();
      if (currentActiveWorkerShowtimeKey && document.querySelector("#workerSeatModal.open")) {
        openWorkerSeatModal(currentActiveWorkerShowtimeKey);
      }
    }
  });

  // Escuchar actualización de salas en tiempo real vía Socket.io
  if (typeof RealTime !== "undefined" && RealTime.socket) {
    RealTime.socket.on("room:updated", (payload) => {
      if (payload && payload.rooms) {
        Storage.saveRooms(payload.rooms, true);
      }
      renderWorkerShowtimes();
      if (currentActiveWorkerShowtimeKey && document.querySelector("#workerSeatModal.open")) {
        openWorkerSeatModal(currentActiveWorkerShowtimeKey);
      }
    });

    RealTime.socket.on("seat:locked", () => {
      renderWorkerShowtimes();
      if (currentActiveWorkerShowtimeKey && document.querySelector("#workerSeatModal.open")) {
        openWorkerSeatModal(currentActiveWorkerShowtimeKey);
      }
    });

    RealTime.socket.on("seat:released", () => {
      renderWorkerShowtimes();
      if (currentActiveWorkerShowtimeKey && document.querySelector("#workerSeatModal.open")) {
        openWorkerSeatModal(currentActiveWorkerShowtimeKey);
      }
    });

    RealTime.socket.on("booking:confirmed", () => {
      renderWorkerShowtimes();
      if (currentActiveWorkerShowtimeKey && document.querySelector("#workerSeatModal.open")) {
        openWorkerSeatModal(currentActiveWorkerShowtimeKey);
      }
    });
  }

  // Escuchar eventos directos entre pestañas (Storage events)
  window.addEventListener("storage", (e) => {
    if (e.key === "cinemajestad_rooms" || e.key === "cinemajestad_movies" || e.key === "cinemajestad_occupied_seats" || e.key === "cinemajestad_seat_locks" || e.key === "cinemajestad_seat_overrides") {
      renderWorkerShowtimes();
      if (currentActiveWorkerShowtimeKey && document.querySelector("#workerSeatModal.open")) {
        openWorkerSeatModal(currentActiveWorkerShowtimeKey);
      }
    }
  });
});

// Configuración de acceso y pestaña inicial según rol del trabajador
function setupWorkerRoleInterface() {
  const authUser = Storage.getAuthUser();
  const urlParams = new URLSearchParams(window.location.search);
  const paramTab = urlParams.get("tab");
  const shiftBadge = document.querySelector("#workerShiftBadge");

  // Rol Dulcería / Confitería: directo a atender comidas y despacho
  if (authUser && authUser.rol === "CONFITERIA") {
    if (shiftBadge) {
      shiftBadge.innerHTML = `🍿 Turno Activo: Operador de Dulcería & Confitería`;
      shiftBadge.style.background = "rgba(245, 197, 24, 0.15)";
      shiftBadge.style.color = "var(--gold)";
      shiftBadge.style.borderColor = "rgba(245, 197, 24, 0.35)";
    }
    switchWorkerTab(paramTab || "food");
    if (typeof showToast === "function") {
      showToast(`¡Bienvenido(a), ${authUser.nombre}! Tu módulo de Dulcería y Despacho está listo.`, "info");
    }
    return;
  }

  // Rol Taquillero / Boletería: directo a emisión e impresión de boletos
  if (authUser && (authUser.rol === "TAQUILLERO" || authUser.rol === "TRABAJADOR")) {
    if (shiftBadge) {
      shiftBadge.innerHTML = `🎟️ Turno Activo: Taquillero / Boletería (Emisión e Impresión)`;
      shiftBadge.style.background = "rgba(0, 210, 255, 0.15)";
      shiftBadge.style.color = "var(--accent-blue)";
      shiftBadge.style.borderColor = "rgba(0, 210, 255, 0.35)";
    }
    switchWorkerTab(paramTab || "print");
    if (typeof showToast === "function") {
      showToast(`¡Bienvenido(a), ${authUser.nombre}! Tu terminal de Taquilla e Impresión de Boletos está lista.`, "info");
    }
    return;
  }

  // Otros roles o admin supervisando
  if (paramTab) {
    switchWorkerTab(paramTab);
  } else {
    switchWorkerTab("showtimes");
  }
}

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

  if (tabName === "food") {
    renderFoodOrders();
    initPosSnacks();
  }
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

  const todayIso = new Date().toISOString().split("T")[0];

  movies.forEach(movie => {
    movie.showtimes.forEach(time => {
      const showtimeKey = `${movie.id}_${todayIso}_${time}`;
      const room = findRoomForMovie(movie, rooms);
      const roomName = room.name || movie.hall || "Sala";

      if (filterHall === "all" || roomName.toLowerCase().includes(filterHall.toLowerCase()) || movie.hall.toLowerCase().includes(filterHall.toLowerCase())) {
        const occupied = Storage.getOccupiedSeats(showtimeKey);
        const locks = Storage.getSeatLocksForShowtime(showtimeKey);
        const totalSeats = (room.rows && room.rows.length && room.seatsPerRow) ? (room.rows.length * room.seatsPerRow) : (room.capacity || 60);
        const occupiedCount = occupied.length;
        const lockedCount = locks.length;
        const availableCount = Math.max(0, totalSeats - occupiedCount - lockedCount);
        const occupancyPct = Math.round(((occupiedCount + lockedCount) / totalSeats) * 100);

        functionsList.push({
          movie,
          time,
          showtimeKey,
          room,
          roomName,
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

  container.innerHTML = functionsList.map(fn => {
    const vigencia = Storage.getMovieVigenciaInfo(fn.movie);

    return `
    <div class="showtime-worker-card">
      <div class="showtime-card-top">
        <img src="${fn.movie.poster}" alt="${fn.movie.title}" class="showtime-mini-poster">
        <div class="showtime-meta-info" style="flex: 1;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.4rem;">
            <h4>${fn.movie.title}</h4>
            <span class="badge ${vigencia.isPresale ? 'badge-presale' : 'badge-now-showing'}" style="font-size: 0.65rem; padding: 0.2rem 0.5rem; flex-shrink: 0;">
              ${vigencia.badgeText}
            </span>
          </div>
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 2px;">🏛️ ${fn.movie.hall}</p>
          <small style="font-size: 0.72rem; color: ${vigencia.isPresale ? '#ff66b2' : 'var(--gold)'}; display: block; margin-top: 2px; font-weight: 600;">
            ${vigencia.isPresale ? '🚀' : '⏳'} ${vigencia.durationDays} días temporada • ${vigencia.statusLabel}
          </small>
          <div style="display: flex; gap: 0.5rem; margin-top: 0.4rem; align-items: center;">
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
  `;
  }).join('');
}

// Modal para que el trabajador vea los asientos de una función y realice ventas presenciales en taquilla (solo efectivo)
function openWorkerSeatModal(showtimeKey) {
  if (currentActiveWorkerShowtimeKey !== showtimeKey) {
    workerSelectedSeats = [];
  }
  currentActiveWorkerShowtimeKey = showtimeKey;

  const parts = showtimeKey.split("_");
  const movieId = parts[0];
  const showtimeDate = parts.length >= 3 ? parts[1] : new Date().toISOString().split("T")[0];
  const showtime = parts.length >= 3 ? parts[2] : parts[1];
  const movie = Storage.getMovieById(movieId) || (Storage.getMovies()[0] || {});
  const rooms = Storage.getRooms();
  const room = findRoomForMovie(movie, rooms);
  const dayPricing = Storage.getDayPricingInfo(showtimeDate, movie);

  currentWorkerModalContext = {
    showtimeKey,
    showtimeDate,
    showtime,
    movie,
    room,
    dayPricing
  };

  const modal = document.querySelector("#workerSeatModal");
  const title = document.querySelector("#workerSeatModalTitle");
  const grid = document.querySelector("#workerSeatsGrid");
  const hallSection = document.querySelector("#workerCinemaHall");
  const archBadge = document.querySelector("#workerHallArchBadge");
  const statsBox = document.querySelector("#workerSeatStats");

  if (!modal || !grid) return;

  const roomName = room.name || movie.hall || "Sala";
  title.textContent = `Asientos: ${movie.title || 'Película'} (${showtime || ''}) - ${roomName}`;
  grid.innerHTML = "";

  const layoutType = room.layoutType || (
    room.id === "sala-1" ? "curved_imax" :
    room.id === "sala-2" ? "stadium_double_aisle" :
    room.id === "sala-3" ? "motion_4dx" : "vip_lounge"
  );

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

  const rows = room.rows || ["A", "B", "C", "D", "E", "F"];
  const seatsPerRow = room.seatsPerRow || 10;
  const vipRows = room.vipRows || ["E", "F"];
  const wheelchairSeats = Array.isArray(room.wheelchairSeats)
    ? room.wheelchairSeats
    : (room.wheelchairCols ? (room.rows.slice(0, 1).map(r => room.wheelchairCols.map(c => `${r}-${c}`)).flat()) : ["A-1", "A-2"]);

  // Renderizar Puertas de Acceso y Evacuación de Emergencia en Taquilla del Trabajador
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

  function createWorkerDoorBadge(door) {
    if (!door.active) {
      return `<div class="hall-door-badge door-closed" style="cursor: default;">🚫 PARED</div>`;
    }
    if (door.type === "ENTRADA") {
      return `<div class="hall-door-badge door-entrance" style="cursor: default;">🚪 ENTRADA SALA</div>`;
    }
    return `<div class="hall-door-badge door-exit" style="cursor: default;">🟢 SALIDA EMERGENCIA</div>`;
  }

  const slotFL = document.querySelector("#slotDoorFrontLeftWorker");
  const slotFR = document.querySelector("#slotDoorFrontRightWorker");
  const slotBL = document.querySelector("#slotDoorBackLeftWorker");
  const slotBR = document.querySelector("#slotDoorBackRightWorker");

  if (slotFL) slotFL.innerHTML = createWorkerDoorBadge(dFL);
  if (slotFR) slotFR.innerHTML = createWorkerDoorBadge(dFR);
  if (slotBL) slotBL.innerHTML = createWorkerDoorBadge(dBL);
  if (slotBR) slotBR.innerHTML = createWorkerDoorBadge(dBR);

  // Pasillos de Circulación del Trabajador (Walkways: por donde pasa la gente)
  const walkwayL = document.querySelector("#walkwayLeftWorker");
  const walkwayR = document.querySelector("#walkwayRightWorker");
  const tagL = document.querySelector("#tagWalkwayLeftWorker");
  const tagR = document.querySelector("#tagWalkwayRightWorker");
  const arrTopL = document.querySelector("#arrowTopLeftWorker");
  const arrBotL = document.querySelector("#arrowBottomLeftWorker");
  const arrTopR = document.querySelector("#arrowTopRightWorker");
  const arrBotR = document.querySelector("#arrowBottomRightWorker");

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

  const occupied = Storage.getOccupiedSeats(showtimeKey);
  const locks = Storage.getSeatLocksForShowtime(showtimeKey);
  const overrides = Storage.getSeatOverrides(showtimeKey);

  let stats = {
    available: 0,
    vip: 0,
    locked: 0,
    occupied: 0,
    maintenance: 0,
    total: rows.length * seatsPerRow
  };

  function createWorkerSeatButton(row, col, isVipRow) {
    const seatCode = `${row}-${col}`;
    const isWheelchair = wheelchairSeats.includes(seatCode);
    const seat = document.createElement("button");
    seat.type = "button";
    seat.className = "seat";
    seat.setAttribute("data-seat", seatCode);
    seat.setAttribute("data-col", col);
    seat.setAttribute("data-row", row);
    seat.setAttribute("data-type", isVipRow ? "vip" : "standard");
    seat.textContent = col;

    if (isVipRow) seat.classList.add("vip");
    if (layoutType === "vip_lounge") seat.classList.add("vip-recliner");
    if (isWheelchair) seat.classList.add("wheelchair", "seat-wheelchair");

    // Curvatura radial idéntica a la vista de usuario y editor de admin
    if (layoutType === "curved_imax") {
      if (col === 1) seat.style.transform = "rotate(7deg) translateY(3px)";
      else if (col === 2) seat.style.transform = "rotate(4deg) translateY(1.5px)";
      else if (col === seatsPerRow - 1) seat.style.transform = "rotate(-4deg) translateY(1.5px)";
      else if (col === seatsPerRow) seat.style.transform = "rotate(-7deg) translateY(3px)";
    }

    const isOcc = occupied.includes(seatCode);
    const lock = locks.find(l => l.seatCode === seatCode && l.expiresAt > Date.now());
    const isMaint = overrides[seatCode] === "MAINTENANCE";
    const isSelected = workerSelectedSeats.some(s => s.code === seatCode);

    if (isSelected) {
      seat.classList.add("selected");
    }

    if (isMaint) {
      seat.classList.add("maintenance");
      seat.title = `Butaca ${seatCode}: Fuera de servicio por mantenimiento`;
      stats.maintenance++;
    } else if (isOcc) {
      seat.classList.add("occupied");
      seat.title = `Butaca ${seatCode}: Ocupada / Vendida`;
      stats.occupied++;
    } else if (lock) {
      seat.classList.add("locked");
      const remSec = Math.max(0, Math.round((lock.expiresAt - Date.now()) / 1000));
      seat.title = `Butaca ${seatCode}: En selección por cliente (${remSec}s restantes) 🔒`;
      stats.locked++;
    } else {
      const typeLabel = isWheelchair ? "Accesible ♿" : (layoutType === "vip_lounge" ? "Sillón VIP Reclinable" : (isVipRow ? "VIP Luxury" : "Estándar"));
      const price = isVipRow ? dayPricing.priceVip : dayPricing.priceStandard;
      seat.title = `Butaca ${seatCode} (${typeLabel}): Libre ($${price.toFixed(2)}) - Clic para vender en Taquilla`;
      stats.available++;
      if (isVipRow) stats.vip++;

      // Habilitar selección interactiva de butacas para el trabajador
      seat.style.cursor = "pointer";
      seat.addEventListener("click", () => {
        toggleWorkerSeatSelection(seatCode, row, col, isVipRow, isWheelchair, seat);
      });
    }

    return seat;
  }

  // RENDERIZADO IDÉNTICO SEGÚN LA FORMA ARQUITECTÓNICA DE LA SALA
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
      const midCol = Math.floor(seatsPerRow / 2);
      for (let col = 1; col <= seatsPerRow; col++) {
        if (col === midCol + 1) {
          const aisle = document.createElement("div");
          aisle.className = "aisle-gap";
          rowEl.appendChild(aisle);
        }
        rowEl.appendChild(createWorkerSeatButton(row, col, isVipRow));
      }
    }

    // =========================================================================
    // MAQUETA 2: ESTADIO CLÁSICO 3 BLOQUES Y DOBLE PASILLO (Triple Block Stadium)
    // =========================================================================
    else if (layoutType === "stadium_double_aisle") {
      const leftCount = Math.max(1, Math.min(3, Math.round(seatsPerRow * 0.2)));
      const rightCount = leftCount;
      const centerCount = Math.max(1, seatsPerRow - leftCount - rightCount);

      // Bloque Lateral Izquierdo
      const blockLeft = document.createElement("div");
      blockLeft.className = "stadium-block block-left";
      for (let col = 1; col <= leftCount; col++) {
        blockLeft.appendChild(createWorkerSeatButton(row, col, isVipRow));
      }
      rowEl.appendChild(blockLeft);

      // Pasillo 1 de escalones iluminados
      const aisle1 = document.createElement("div");
      aisle1.className = "aisle-stairs";
      rowEl.appendChild(aisle1);

      // Bloque Central Platea
      const blockCenter = document.createElement("div");
      blockCenter.className = "stadium-block block-center";
      for (let col = leftCount + 1; col <= leftCount + centerCount; col++) {
        blockCenter.appendChild(createWorkerSeatButton(row, col, isVipRow));
      }
      rowEl.appendChild(blockCenter);

      // Pasillo 2 de escalones iluminados
      const aisle2 = document.createElement("div");
      aisle2.className = "aisle-stairs";
      rowEl.appendChild(aisle2);

      // Bloque Lateral Derecho
      const blockRight = document.createElement("div");
      blockRight.className = "stadium-block block-right";
      for (let col = leftCount + centerCount + 1; col <= seatsPerRow; col++) {
        blockRight.appendChild(createWorkerSeatButton(row, col, isVipRow));
      }
      rowEl.appendChild(blockRight);
    }

    // =========================================================================
    // MAQUETA 3: PODS MECÁNICOS 4DX (Motion Pods)
    // =========================================================================
    else if (layoutType === "motion_4dx") {
      let pod = document.createElement("div");
      pod.className = "motion-pod";

      for (let col = 1; col <= seatsPerRow; col++) {
        pod.appendChild(createWorkerSeatButton(row, col, isVipRow));

        if (col % 4 === 0 && col < seatsPerRow) {
          rowEl.appendChild(pod);

          const effectsAisle = document.createElement("div");
          effectsAisle.className = "effects-aisle";
          effectsAisle.innerHTML = `<span>💨</span>`;
          effectsAisle.title = "Pasillo de efectos ambientales (viento, niebla y estrobos)";
          rowEl.appendChild(effectsAisle);

          pod = document.createElement("div");
          pod.className = "motion-pod";
        }
      }
      if (pod.children.length > 0) {
        rowEl.appendChild(pod);
      }
    }

    // =========================================================================
    // MAQUETA 4: PALCOS VIP & SOFÁS DOBLES PARA PAREJAS (Love Seats & Suites)
    // =========================================================================
    else if (layoutType === "vip_lounge") {
      const midCol = Math.floor(seatsPerRow / 2);
      for (let col = 1; col <= seatsPerRow; col += 2) {
        const pair = document.createElement("div");
        pair.className = "love-seat-pair";
        pair.appendChild(createWorkerSeatButton(row, col, isVipRow));
        if (col + 1 <= seatsPerRow) {
          pair.appendChild(createWorkerSeatButton(row, col + 1, isVipRow));
        }
        rowEl.appendChild(pair);

        if (col + 1 === midCol || col === midCol) {
          const carpetAisle = document.createElement("div");
          carpetAisle.className = "carpet-aisle";
          carpetAisle.textContent = "⚜️";
          rowEl.appendChild(carpetAisle);
        } else if (col + 2 <= seatsPerRow) {
          const table = document.createElement("div");
          table.className = "lounge-table";
          table.innerHTML = `🍷`;
          table.title = "Mesita de servicio gourmet para pareja";
          rowEl.appendChild(table);
        }
      }
    }

    // Etiqueta lateral derecha
    const labelRight = document.createElement("span");
    labelRight.className = "row-label";
    labelRight.textContent = row;
    rowEl.appendChild(labelRight);

    grid.appendChild(rowEl);
  });

  if (statsBox) {
    statsBox.innerHTML = `
      <div><strong style="color: #fff;">Capacidad Total:</strong> ${stats.total} butacas (${stats.vip} VIP)</div>
      <div style="color: #2ed573;"><strong>Libres:</strong> ${stats.available}</div>
      <div style="color: #e67e22;"><strong>En Selección 🔒:</strong> ${stats.locked}</div>
      <div style="color: #ff4757;"><strong>Ocupadas:</strong> ${stats.occupied}</div>
      ${stats.maintenance > 0 ? `<div style="color: #7f8c8d;"><strong>Mantenimiento:</strong> ${stats.maintenance}</div>` : ''}
    `;
  }

  // Renderizar panel de cobro exclusivo en efectivo para taquilla
  renderWorkerCheckoutPanel();

  modal.classList.add("open");
}

function closeWorkerSeatModal() {
  currentActiveWorkerShowtimeKey = null;
  workerSelectedSeats = [];
  const modal = document.querySelector("#workerSeatModal");
  if (modal) modal.classList.remove("open");
}

// Conmutar selección de butaca por el trabajador en taquilla
function toggleWorkerSeatSelection(seatCode, row, col, isVipRow, isWheelchair, seatEl) {
  if (!currentWorkerModalContext) return;
  const { dayPricing } = currentWorkerModalContext;
  const price = isVipRow ? dayPricing.priceVip : dayPricing.priceStandard;

  const existingIdx = workerSelectedSeats.findIndex(s => s.code === seatCode);
  if (existingIdx > -1) {
    workerSelectedSeats.splice(existingIdx, 1);
    if (seatEl) seatEl.classList.remove("selected");
  } else {
    workerSelectedSeats.push({
      code: seatCode,
      row,
      col,
      isVip: isVipRow,
      isWheelchair,
      price,
      type: isVipRow ? "VIP Luxury" : "Estándar"
    });
    if (seatEl) seatEl.classList.add("selected");
  }

  renderWorkerCheckoutPanel();
}

// Eliminar una butaca específica de la selección
function removeSingleWorkerSeat(seatCode) {
  const existingIdx = workerSelectedSeats.findIndex(s => s.code === seatCode);
  if (existingIdx > -1) {
    workerSelectedSeats.splice(existingIdx, 1);
    const seatEl = document.querySelector(`#workerSeatsGrid [data-seat="${seatCode}"]`);
    if (seatEl) seatEl.classList.remove("selected");
    renderWorkerCheckoutPanel();
  }
}

// Desmarcar todas las butacas seleccionadas
function clearWorkerSeatSelection() {
  workerSelectedSeats = [];
  const grid = document.querySelector("#workerSeatsGrid");
  if (grid) {
    grid.querySelectorAll(".seat.selected").forEach(s => s.classList.remove("selected"));
  }
  renderWorkerCheckoutPanel();
}

// Calcular cambio de efectivo en vivo
function calcWorkerCashChange(totalAmount) {
  const input = document.querySelector("#workerCounterCashReceived");
  const changeEl = document.querySelector("#workerCounterCashChange");
  if (!input || !changeEl) return;

  const received = parseFloat(input.value) || 0;
  const change = Math.max(0, received - totalAmount);
  changeEl.textContent = `$${change.toFixed(2)}`;
}

// Renderizar panel de cobro en taquilla (solo efectivo)
function renderWorkerCheckoutPanel() {
  const panel = document.querySelector("#workerCheckoutPanel");
  if (!panel || !currentWorkerModalContext) return;

  if (workerSelectedSeats.length === 0) {
    panel.innerHTML = `
      <div style="background: rgba(255,255,255,0.03); border: 1px dashed rgba(255,255,255,0.15); border-radius: var(--radius-md); padding: 0.9rem 1.2rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.8rem;">
        <div style="display: flex; align-items: center; gap: 0.6rem; color: var(--text-secondary); font-size: 0.85rem;">
          <span style="font-size: 1.25rem;">🎟️</span>
          <span><strong>Venta en Taquilla:</strong> Haz clic en las butacas libres que solicite el cliente para seleccionarlas y cobrar en caja.</span>
        </div>
        <span class="badge" style="background: rgba(0, 230, 118, 0.12); color: #00e676; border: 1px solid rgba(0, 230, 118, 0.3); font-weight: 700; padding: 0.4rem 0.8rem; font-size: 0.78rem;">
          💵 Cobro Exclusivo en Efectivo
        </span>
      </div>
    `;
    return;
  }

  const { movie, room, dayPricing } = currentWorkerModalContext;
  let rawSubtotal = workerSelectedSeats.reduce((acc, s) => acc + s.price, 0);
  let discount2x1 = 0;

  if (dayPricing.has2x1Promo && workerSelectedSeats.length >= 2) {
    const freeQty = Math.floor(workerSelectedSeats.length / 2);
    const sorted = [...workerSelectedSeats].sort((a, b) => a.price - b.price);
    for (let i = 0; i < freeQty; i++) {
      discount2x1 += sorted[i].price;
    }
  }

  const finalTotal = Math.max(0, rawSubtotal - discount2x1);

  // Generar chips
  const chipsHtml = workerSelectedSeats.map(s => `
    <span style="background: rgba(229, 9, 20, 0.15); border: 1px solid rgba(229, 9, 20, 0.5); color: #ff6b72; padding: 0.3rem 0.65rem; border-radius: 6px; font-size: 0.8rem; font-weight: 700; display: inline-flex; align-items: center; gap: 0.4rem;">
      💺 ${s.code} (${s.type} • $${s.price.toFixed(2)})
      <button type="button" onclick="removeSingleWorkerSeat('${s.code}')" style="background: transparent; border: none; color: #fff; cursor: pointer; font-size: 0.85rem; padding: 0; line-height: 1;" title="Quitar butaca">✕</button>
    </span>
  `).join("");

  const prevName = document.querySelector("#workerCounterClientName")?.value || "";

  panel.innerHTML = `
    <div style="background: linear-gradient(135deg, rgba(14, 18, 28, 0.98), rgba(20, 28, 44, 0.98)); border: 1.5px solid var(--gold); border-radius: var(--radius-md); padding: 1.2rem; box-shadow: 0 8px 32px rgba(0,0,0,0.6);">
      <!-- Encabezado del Cobro -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.9rem; flex-wrap: wrap; gap: 0.6rem; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.65rem;">
        <div>
          <span style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--gold); font-weight: 800;">
            🎟️ Taquilla Presencial Cine Majestad
          </span>
          <h4 style="color: #fff; margin: 0.15rem 0 0; font-size: 1.15rem;">
            ${workerSelectedSeats.length} Butaca(s) Seleccionada(s)
          </h4>
        </div>
        <div style="background: rgba(0, 230, 118, 0.12); border: 1px solid rgba(0, 230, 118, 0.35); color: #00e676; padding: 0.35rem 0.85rem; border-radius: 20px; font-size: 0.76rem; font-weight: 800; display: flex; align-items: gap: 0.4rem;">
          <span>💵 Pago Exclusivo en Efectivo (Sin transferencias)</span>
        </div>
      </div>

      <!-- Chips de Asientos -->
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.1rem;">
        ${chipsHtml}
      </div>

      <!-- Cuadrícula de Cobro en Mostrador -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.9rem; margin-bottom: 1.2rem; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 0.9rem;">
        <div>
          <label style="display: block; font-size: 0.74rem; color: var(--text-secondary); margin-bottom: 0.3rem;">
            👤 Nombre del Cliente (Opcional):
          </label>
          <input type="text" id="workerCounterClientName" class="form-control" placeholder="Ej. Carlos Mendoza (Taquilla)" value="${prevName}" style="font-size: 0.85rem; padding: 0.5rem 0.75rem;">
        </div>

        <div>
          <label style="display: block; font-size: 0.74rem; color: var(--text-secondary); margin-bottom: 0.3rem;">
            💰 Total a Cobrar:
          </label>
          <div style="font-size: 1.45rem; font-weight: 800; color: var(--gold);">
            $${finalTotal.toFixed(2)}
            ${discount2x1 > 0 ? `<span style="font-size: 0.74rem; color: #00e676; margin-left: 0.3rem; display: block;">🎉 ¡Ahorro 2x1: -$${discount2x1.toFixed(2)}!</span>` : ''}
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 0.74rem; color: var(--text-secondary); margin-bottom: 0.3rem;">
            💵 Efectivo Recibido ($):
          </label>
          <input type="number" step="0.5" id="workerCounterCashReceived" class="form-control" placeholder="$${finalTotal.toFixed(2)}" value="${finalTotal.toFixed(2)}" oninput="calcWorkerCashChange(${finalTotal})" style="font-size: 0.95rem; font-weight: 700; padding: 0.5rem 0.75rem; color: #fff;">
        </div>

        <div>
          <label style="display: block; font-size: 0.74rem; color: var(--text-secondary); margin-bottom: 0.3rem;">
            🪙 Cambio / Vueltos:
          </label>
          <div id="workerCounterCashChange" style="font-size: 1.45rem; font-weight: 800; color: #00e676;">
            $0.00
          </div>
        </div>
      </div>

      <!-- Barra de Acciones -->
      <div style="display: flex; gap: 0.8rem; justify-content: flex-end; align-items: center; flex-wrap: wrap;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="clearWorkerSeatSelection()">
          Desmarcar Todo
        </button>
        <button type="button" class="btn btn-primary" onclick="processWorkerCashSale()" style="font-size: 0.95rem; font-weight: 700; padding: 0.7rem 1.6rem; box-shadow: 0 0 15px var(--primary-glow);">
          💵 Cobrar en Efectivo e Imprimir Boletos 🖨️
        </button>
      </div>
    </div>
  `;
}

// Procesar venta presencial en taquilla exclusivamente en efectivo
async function processWorkerCashSale() {
  if (workerSelectedSeats.length === 0) {
    if (typeof showToast === "function") {
      showToast("Por favor selecciona al menos una butaca libre.", "info");
    } else {
      alert("Por favor selecciona al menos una butaca libre.");
    }
    return;
  }

  if (!currentWorkerModalContext) return;
  const { showtimeKey, showtimeDate, showtime, movie, room, dayPricing } = currentWorkerModalContext;

  // Verificar que ninguna butaca haya sido tomada entre tanto por otro usuario
  const occupied = Storage.getOccupiedSeats(showtimeKey);
  const conflict = workerSelectedSeats.find(s => occupied.includes(s.code));
  if (conflict) {
    if (typeof showToast === "function") {
      showToast(`La butaca ${conflict.code} acaba de ser reservada por otro cliente. Se ha actualizado la sala.`, "error");
    }
    openWorkerSeatModal(showtimeKey);
    return;
  }

  // Calcular precio
  let rawSubtotal = workerSelectedSeats.reduce((acc, s) => acc + s.price, 0);
  let discount2x1 = 0;
  if (dayPricing.has2x1Promo && workerSelectedSeats.length >= 2) {
    const freeQty = Math.floor(workerSelectedSeats.length / 2);
    const sorted = [...workerSelectedSeats].sort((a, b) => a.price - b.price);
    for (let i = 0; i < freeQty; i++) {
      discount2x1 += sorted[i].price;
    }
  }
  const totalAmount = Math.max(0, rawSubtotal - discount2x1);

  const clientNameInput = document.querySelector("#workerCounterClientName");
  const clientName = (clientNameInput && clientNameInput.value.trim()) ? clientNameInput.value.trim() : "Cliente Taquilla";

  const cashInput = document.querySelector("#workerCounterCashReceived");
  const cashReceived = parseFloat(cashInput?.value) || totalAmount;
  const cashChange = Math.max(0, cashReceived - totalAmount);

  const bookingCode = `CMG-${Math.floor(100000 + Math.random() * 900000)}`;

  const seatObjects = workerSelectedSeats.map(s => ({
    code: s.code,
    type: s.type,
    price: s.price
  }));

  const now = new Date();
  const dateFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const newBooking = {
    id: bookingCode,
    bookingCode: bookingCode,
    code: bookingCode,
    userId: "taquilla-staff",
    customerName: clientName,
    clientName: clientName,
    customerEmail: "taquilla@cinemajestad.com",
    movieId: movie.id,
    movieTitle: movie.title,
    hall: room.name || movie.hall,
    roomId: room.id,
    showtime: showtime,
    date: showtimeDate,
    showtimeDate: showtimeDate,
    showtimeKey: showtimeKey,
    seats: seatObjects,
    snacks: [],
    subtotalTickets: totalAmount,
    ticketsTotal: totalAmount,
    subtotalSnacks: 0,
    snacksTotal: 0,
    discount2x1: discount2x1,
    total: totalAmount,
    grandTotal: totalAmount,
    total_pagado: totalAmount,
    status: "CONFIRMADA",
    paymentMethod: "EFECTIVO", // EXCLUSIVO EFECTIVO EN TAQUILLA
    cashReceived: cashReceived,
    cashChange: cashChange,
    isCounterSale: true,
    foodStatus: "ENTREGADO",
    createdAt: now.toISOString(),
    dateFormatted: dateFormatted
  };

  // Guardar en Storage
  Storage.saveBooking(newBooking);

  // Marcar butacas como ocupadas permanentemente
  const newOccupied = [...occupied];
  seatObjects.forEach(s => {
    if (!newOccupied.includes(s.code)) {
      newOccupied.push(s.code);
    }
    if (typeof Storage.unlockSeat === "function") {
      Storage.unlockSeat(showtimeKey, s.code);
    }
  });
  Storage.saveOccupiedSeats(showtimeKey, newOccupied);

  // Intentar persistir en API REST backend
  if (typeof API !== "undefined" && API.orders && API.orders.create) {
    try {
      await API.orders.create(newBooking);
    } catch (e) {
      console.warn("[Taquilla API fallback]:", e.message);
    }
  }

  // Notificar por Socket.io en tiempo real a clientes y administradores
  if (typeof RealTime !== "undefined" && RealTime.socket && RealTime.socket.connected) {
    RealTime.socket.emit("seat:booked", {
      showtimeKey,
      seats: seatObjects,
      bookingId: bookingCode
    });
  }

  if (typeof showToast === "function") {
    showToast(`¡Venta cobrada en EFECTIVO por $${totalAmount.toFixed(2)}! Abriendo boleto térmico...`, "success");
  }

  // Limpiar selección y cerrar modal de asientos
  workerSelectedSeats = [];
  closeWorkerSeatModal();

  // Abrir de inmediato el modal de impresión de boletos
  openPrintModalForTicket(bookingCode);

  // Refrescar tablas
  renderWorkerShowtimes();
  renderWorkerPrintTable();
}

// =============================================================================
// MÓDULO 2: ATENCIÓN Y DESPACHO DE COMIDAS & DULCERÍA
// =============================================================================

function switchFoodSubView(mode) {
  const posSec = document.querySelector("#foodViewPosSection");
  const dispatchSec = document.querySelector("#foodViewDispatchSection");
  const btnPos = document.querySelector("#btnFoodSubPos");
  const btnDispatch = document.querySelector("#btnFoodSubDispatch");

  if (mode === "pos") {
    if (posSec) posSec.style.display = "block";
    if (dispatchSec) dispatchSec.style.display = "none";
    if (btnPos) {
      btnPos.classList.add("btn-primary");
      btnPos.classList.remove("btn-secondary");
    }
    if (btnDispatch) {
      btnDispatch.classList.add("btn-secondary");
      btnDispatch.classList.remove("btn-primary");
    }
    renderWorkerCandyGrid();
    renderPosCartSummary();
  } else {
    if (posSec) posSec.style.display = "none";
    if (dispatchSec) dispatchSec.style.display = "block";
    if (btnPos) {
      btnPos.classList.add("btn-secondary");
      btnPos.classList.remove("btn-primary");
    }
    if (btnDispatch) {
      btnDispatch.classList.add("btn-primary");
      btnDispatch.classList.remove("btn-secondary");
    }
    renderFoodOrders();
  }
}

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
  const countBadgeTop = document.querySelector("#countFoodPendingBadge");
  if (!container) return;

  const allFoodOrders = Storage.getFoodOrders();
  const pendingCount = allFoodOrders.filter(o => o.foodStatus !== "ENTREGADO").length;
  if (countBadge) countBadge.textContent = pendingCount;
  if (countBadgeTop) countBadgeTop.textContent = pendingCount;

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

// Punto de Venta Completo de Combos y Snacks en Mostrador
function initPosSnacks() {
  renderWorkerCandyGrid();
  renderPosCartSummary();
}

function filterPosSnacksByCategory(category) {
  currentPosCategory = (category || "all").toLowerCase();
  const buttons = document.querySelectorAll("#posCategoryFilters [data-pos-cat]");
  buttons.forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-pos-cat") === currentPosCategory);
  });
  renderWorkerCandyGrid();
}

function filterPosSnacksBySearch(query) {
  currentPosSearch = (query || "").trim().toLowerCase();
  renderWorkerCandyGrid();
}

function renderWorkerCandyGrid() {
  const grid = document.querySelector("#workerCandyGrid");
  if (!grid) return;

  const snacks = Storage.getSnacks();
  let filtered = snacks;

  if (currentPosCategory !== "all") {
    filtered = filtered.filter(s => (s.category || "").toLowerCase() === currentPosCategory);
  }

  if (currentPosSearch) {
    filtered = filtered.filter(s => 
      s.name.toLowerCase().includes(currentPosSearch) || 
      (s.desc && s.desc.toLowerCase().includes(currentPosSearch)) ||
      (s.tag && s.tag.toLowerCase().includes(currentPosSearch))
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; background: var(--bg-card); border: 1px dashed var(--border-color); border-radius: var(--radius-md); padding: 3rem; text-align: center; color: var(--text-muted);">
        <h3>No se encontraron productos en esta categoría o búsqueda</h3>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(item => {
    const qty = counterCart[item.id] ? counterCart[item.id].qty : 0;
    const imgUrl = (item.img && item.img !== "undefined" && item.img.startsWith("http"))
      ? item.img
      : ((item.image && item.image !== "undefined" && item.image.startsWith("http"))
        ? item.image
        : "https://images.unsplash.com/photo-1585647347384-2593bc35786b?auto=format&fit=crop&w=600&q=80");

    const descText = (item.desc && item.desc !== "undefined")
      ? item.desc
      : ((item.description && item.description !== "undefined")
        ? item.description
        : "Delicioso combo preparado fresco para disfrutar en sala.");

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
              <button class="stepper-btn" onclick="updateCounterCart('${item.id}', -1)">-</button>
              <span class="stepper-value" id="pos-qty-${item.id}">${qty}</span>
              <button class="stepper-btn" onclick="updateCounterCart('${item.id}', 1)">+</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
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

  renderPosCartSummary();
}

function removeSinglePosCartItem(snackId) {
  if (counterCart[snackId]) {
    delete counterCart[snackId];
    const qtyLabel = document.querySelector(`#pos-qty-${snackId}`);
    if (qtyLabel) qtyLabel.textContent = "0";
    renderPosCartSummary();
  }
}

function renderPosCartSummary() {
  const listContainer = document.querySelector("#posCartItemsList");
  const totalLabel = document.querySelector("#posTotalLabel");
  const cashInput = document.querySelector("#posCashReceived");

  const items = Object.values(counterCart);
  const total = items.reduce((sum, s) => sum + (s.price * s.qty), 0);

  if (totalLabel) totalLabel.textContent = `$${total.toFixed(2)}`;

  if (!listContainer) return;

  if (items.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align: center; padding: 1.5rem 0.5rem; color: var(--text-muted); font-size: 0.8rem;">
        No has agregado combos o snacks aún.<br>Elige productos en el catálogo visual.
      </div>
    `;
    if (cashInput) cashInput.value = "";
    calcPosCashChange();
    return;
  }

  listContainer.innerHTML = items.map(it => `
    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; padding: 0.45rem 0.65rem;">
      <div style="flex: 1; padding-right: 0.5rem;">
        <strong style="color: #fff; font-size: 0.82rem; display: block; line-height: 1.2;">${it.name}</strong>
        <span style="font-size: 0.75rem; color: var(--gold); font-weight: 700;">${it.qty}x $${it.price.toFixed(2)} = $${(it.price * it.qty).toFixed(2)}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 0.35rem;">
        <button type="button" class="stepper-btn" style="width: 24px; height: 24px; font-size: 0.75rem;" onclick="updateCounterCart('${it.id}', -1)">-</button>
        <span style="font-size: 0.8rem; font-weight: 700; min-width: 16px; text-align: center;">${it.qty}</span>
        <button type="button" class="stepper-btn" style="width: 24px; height: 24px; font-size: 0.75rem;" onclick="updateCounterCart('${it.id}', 1)">+</button>
        <button type="button" onclick="removeSinglePosCartItem('${it.id}')" style="background: transparent; border: none; color: #ff5252; cursor: pointer; font-size: 0.85rem; margin-left: 0.2rem;" title="Eliminar item">✕</button>
      </div>
    </div>
  `).join('');

  if (cashInput && (!cashInput.value || parseFloat(cashInput.value) < total)) {
    cashInput.value = total.toFixed(2);
  }
  calcPosCashChange();
}

function calcPosCashChange() {
  const items = Object.values(counterCart);
  const total = items.reduce((sum, s) => sum + (s.price * s.qty), 0);
  const input = document.querySelector("#posCashReceived");
  const changeLabel = document.querySelector("#posCashChangeLabel");

  if (!input || !changeLabel) return;

  const received = parseFloat(input.value) || 0;
  const change = Math.max(0, received - total);
  changeLabel.textContent = `$${change.toFixed(2)}`;
}

function clearCounterCart() {
  counterCart = {};
  renderWorkerCandyGrid();
  renderPosCartSummary();
}

function processCounterSale() {
  const items = Object.values(counterCart);
  if (items.length === 0) {
    showToast("Por favor selecciona al menos un combo o snack para la venta.", "info");
    return;
  }

  const clientNameInput = document.querySelector("#posClientName");
  const clientName = clientNameInput && clientNameInput.value.trim() ? clientNameInput.value.trim() : "Cliente Mostrador";
  const total = items.reduce((sum, s) => sum + (s.price * s.qty), 0);

  const cashInput = document.querySelector("#posCashReceived");
  const cashReceived = parseFloat(cashInput?.value) || total;
  const cashChange = Math.max(0, cashReceived - total);

  // Crear la venta registrada con entrega inmediata y pago en efectivo
  const sale = Storage.createWorkerFoodSale(clientName, items, total, cashReceived, cashChange);

  // Reiniciar carrito de mostrador
  clearCounterCart();
  if (clientNameInput) clientNameInput.value = "";

  showToast(`¡Venta de comida ${sale.bookingCode} cobrada en EFECTIVO ($${total.toFixed(2)})! Abriendo comprobante...`, "success");
  renderFoodOrders();

  // Abrir de inmediato la opción de imprimir el ticket térmico de comida
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
