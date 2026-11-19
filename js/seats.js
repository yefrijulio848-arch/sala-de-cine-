/* ==========================================================================
   Cine Majestad - Sala de Cine & Selección de Asientos con Concurrencia Real
   ========================================================================== */

let currentOrder = null;
let currentRoom = null;
let showtimeKey = "";
let timerInterval = null;

document.addEventListener("DOMContentLoaded", () => {
  initOrderAndRoom();
  renderSeatViewSchedule();
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
    // Si cualquier otra pestaña guardó salas, películas, o bloqueó/liberó asientos, refrescar inmediatamente
    initOrderAndRoom();
    renderSeatsGrid();
    updateSummary();
  });

  // Si Socket.io recibe actualización de salas desde el Administrador
  if (typeof RealTime !== "undefined" && RealTime.socket) {
    RealTime.socket.on("room:updated", (payload) => {
      if (payload && payload.rooms) {
        Storage.saveRooms(payload.rooms, true);
      }
      initOrderAndRoom();
      renderSeatsGrid();
      updateSummary();
    });
  }
});

// Generar lista de fechas disponibles para el conmutador de función (con soporte de Cartelera y Preventas)
function getUpcomingDatesList(count = 7, movie = null) {
  const dates = [];
  let baseDate = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let isFuturePresale = false;
  let vigencia = null;

  if (movie) {
    vigencia = Storage.getMovieVigenciaInfo(movie);
    if (vigencia.isPresale && vigencia.diffDaysToStart > 0) {
      isFuturePresale = true;
      const startParts = vigencia.startDate.split("-");
      if (startParts.length === 3) {
        baseDate = new Date(parseInt(startParts[0], 10), parseInt(startParts[1], 10) - 1, parseInt(startParts[2], 10));
      }
    }
  }

  for (let i = 0; i < count; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const dayNum = String(d.getDate()).padStart(2, "0");
    const iso = `${year}-${month}-${dayNum}`;

    const rawWeekday = d.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "").toUpperCase();
    const rawMonth = d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "").toUpperCase();
    const weekdayLong = d.toLocaleDateString("es-ES", { weekday: "long" });
    const monthLong = d.toLocaleDateString("es-ES", { month: "long" });

    let dayNameShort = rawWeekday;
    let shortLabel = `${rawWeekday.charAt(0) + rawWeekday.slice(1).toLowerCase()} ${d.getDate()}`;

    if (isFuturePresale && i === 0) {
      dayNameShort = "ESTRENO";
      shortLabel = `Estreno (${d.getDate()} ${rawMonth.slice(0, 3)})`;
    } else if (!isFuturePresale) {
      dayNameShort = i === 0 ? "HOY" : (i === 1 ? "MAÑANA" : rawWeekday);
      shortLabel = i === 0 ? "Hoy" : (i === 1 ? "Mañana" : `${rawWeekday.charAt(0) + rawWeekday.slice(1).toLowerCase()} ${d.getDate()}`);
    }

    const fullLabel = (i === 0 && !isFuturePresale)
      ? `Hoy, ${weekdayLong.charAt(0).toUpperCase() + weekdayLong.slice(1)} ${d.getDate()} de ${monthLong}`
      : `${weekdayLong.charAt(0).toUpperCase() + weekdayLong.slice(1)} ${d.getDate()} de ${monthLong}`;

    const dayPricing = Storage.getDayPricingInfo(iso);

    dates.push({
      iso,
      dayNum: d.getDate(),
      dayNameShort,
      monthShort: rawMonth,
      shortLabel,
      fullLabel,
      dayPricing,
      isPresaleDay: isFuturePresale
    });
  }
  return dates;
}

// Renderizar la barra selectora de días y horarios en la vista de butacas
function renderSeatViewSchedule() {
  const datesStrip = document.querySelector("#seatViewDatesStrip");
  const timesStrip = document.querySelector("#seatViewTimesStrip");
  const lblScheduleCurrent = document.querySelector("#lblSeatScheduleCurrent");
  const promoAlertEl = document.querySelector("#seatSchedulePromoAlert");

  if (!datesStrip || !timesStrip || !currentOrder) return;

  const movie = Storage.getMovieById(currentOrder.movieId) || { showtimes: [currentOrder.showtime] };
  const vigencia = Storage.getMovieVigenciaInfo(movie);
  const dates = getUpcomingDatesList(7, movie);
  const showtimes = movie.showtimes || [currentOrder.showtime];

  const currentDateIso = currentOrder.date || dates[0].iso;
  const currentFormatted = currentOrder.dateFormatted || (vigencia.isPresale ? "Estreno" : "Hoy");
  const dayPricing = Storage.getDayPricingInfo(currentDateIso, movie);

  if (lblScheduleCurrent) {
    lblScheduleCurrent.textContent = `${currentFormatted} • ${currentOrder.showtime} (${dayPricing.tierLabel})`;
  }

  // Banner explicativo de tarifas dinámicas en la sala y preventas
  if (promoAlertEl) {
    let alertHtml = "";
    if (vigencia.isPresale) {
      alertHtml += `
        <div class="seat-schedule-alert presale" style="background: linear-gradient(135deg, rgba(255,0,128,0.22), rgba(255,0,128,0.06)); border: 1.5px solid rgba(255,0,128,0.5); color: #fff; padding: 0.85rem 1.1rem; border-radius: var(--radius-sm); margin-bottom: 0.8rem; display: flex; align-items: center; gap: 0.8rem; box-shadow: 0 4px 16px rgba(255,0,128,0.25);">
          <span style="font-size: 1.6rem;">🎟️</span>
          <div>
            <strong style="color: #ff66b2; font-size: 0.95rem; display: block;">¡Función de Preventa Exclusiva!</strong>
            <span style="opacity: 0.95; font-size: 0.84rem;">
              Estreno Oficial el <strong>${vigencia.startDateFormatted}</strong>. Compra tus entradas con antelación durante su temporada de <strong>${vigencia.durationDays} días</strong> y asegura las mejores butacas.
            </span>
          </div>
        </div>
      `;
    }

    if (dayPricing.isWednesday) {
      alertHtml += `
        <div class="seat-schedule-alert wednesday">
          <span style="font-size: 1.3rem;">🎉</span>
          <div>
            <strong>¡Hoy es Miércoles de Cine: Promoción 2x1 en Boletos!</strong>
            <span style="opacity: 0.95; margin-left: 0.3rem;">Selecciona tus butacas en pares: ¡por cada 2 pagas solo 1!</span>
          </div>
        </div>
      `;
    } else if (dayPricing.isWeekend) {
      alertHtml += `
        <div class="seat-schedule-alert weekend">
          <span style="font-size: 1.3rem;">⭐</span>
          <div>
            <strong>Tarifa Fin de Semana (Sábados y Domingos)</strong>
            <span style="opacity: 0.95; margin-left: 0.3rem;">Funciones de alta demanda con tarifa especial fin de semana.</span>
          </div>
        </div>
      `;
    } else if (!vigencia.isPresale) {
      alertHtml += `
        <div class="seat-schedule-alert calm">
          <span style="font-size: 1.3rem;">🌿</span>
          <div>
            <strong>Tarifa Días Calmados (Lunes, Martes, Jueves, Viernes)</strong>
            <span style="opacity: 0.95; margin-left: 0.3rem;">Tarifa económica regular entre semana para disfrutar con tranquilidad.</span>
          </div>
        </div>
      `;
    }
    promoAlertEl.innerHTML = alertHtml;
  }

  // Renderizar píldoras de días con distintivos de promoción
  datesStrip.innerHTML = dates.map(d => {
    const isActive = d.iso === currentDateIso;
    let badgeHtml = "";
    if (d.dayPricing.isWednesday) {
      badgeHtml = `<span class="s-badge-tag wednesday">2x1</span>`;
    } else if (d.dayPricing.isWeekend) {
      badgeHtml = `<span class="s-badge-tag weekend">Finde</span>`;
    }

    return `
      <button class="schedule-date-btn ${isActive ? 'active' : ''}" 
              data-iso="${d.iso}"
              onclick="switchSeatSchedule('${d.iso}', '${d.shortLabel}', '${currentOrder.showtime}')"
              title="${d.fullLabel} (${d.dayPricing.tierLabel})">
        ${badgeHtml}
        <span class="s-date-day">${d.dayNameShort}</span>
        <span class="s-date-num">${d.dayNum}</span>
        <span class="s-date-month">${d.monthShort}</span>
      </button>
    `;
  }).join("");

  // Renderizar fichas de horarios disponibles
  timesStrip.innerHTML = showtimes.map(time => {
    const isActive = time === currentOrder.showtime;
    return `
      <button class="schedule-time-btn ${isActive ? 'active' : ''}"
              data-time="${time}"
              onclick="switchSeatSchedule('${currentDateIso}', '${currentFormatted}', '${time}')"
              title="Ver asientos para las ${time}">
        ${time}
      </button>
    `;
  }).join("");
}

// Conmutar día y horario dinámicamente con actualización instantánea de asientos y tarifas
function switchSeatSchedule(newDateIso, newDateFormatted, newShowtime) {
  if (currentOrder.date === newDateIso && currentOrder.showtime === newShowtime) {
    return; // Ya está en esta función
  }

  // Liberar candados previos si tenía butacas seleccionadas en la función anterior
  if (currentOrder.seats && currentOrder.seats.length > 0) {
    const mySessionId = Storage.getSessionId();
    Storage.releaseAllLocksForSession(mySessionId, showtimeKey);
    if (typeof RealTime !== "undefined") {
      currentOrder.seats.forEach(s => {
        RealTime.releaseSeat(s.code || s, showtimeKey);
      });
    }
    currentOrder.seats = [];
  }

  const movie = Storage.getMovieById(currentOrder.movieId) || {};
  const dayPricing = Storage.getDayPricingInfo(newDateIso, movie);

  currentOrder.date = newDateIso;
  currentOrder.dateFormatted = newDateFormatted;
  currentOrder.showtime = newShowtime;
  currentOrder.priceStandard = dayPricing.priceStandard;
  currentOrder.priceVip = dayPricing.priceVip;
  currentOrder.isWeekend = dayPricing.isWeekend;
  currentOrder.isWednesday = dayPricing.isWednesday;
  currentOrder.tierLabel = dayPricing.tierLabel;

  showtimeKey = `${currentOrder.movieId}_${newDateIso}_${newShowtime}`;
  currentOrder.showtimeKey = showtimeKey;

  // Actualizar leyendas con precios reales de esta nueva fecha
  const legendStd = document.querySelector("#legendPriceStandard");
  const legendVip = document.querySelector("#legendPriceVip");
  if (legendStd) {
    legendStd.textContent = dayPricing.has2x1Promo 
      ? `Estándar ($${dayPricing.priceStandard.toFixed(2)} - ¡Aplica 2x1!)` 
      : `Estándar ($${dayPricing.priceStandard.toFixed(2)})`;
  }
  if (legendVip) {
    legendVip.textContent = dayPricing.has2x1Promo 
      ? `VIP Luxury ($${dayPricing.priceVip.toFixed(2)} - ¡Aplica 2x1!)` 
      : `VIP Luxury ($${dayPricing.priceVip.toFixed(2)})`;
  }

  Storage.saveCurrentOrder(currentOrder);

  // Conectar al nuevo canal de tiempo real para esta fecha y horario
  if (typeof RealTime !== "undefined") {
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
  }

  renderSeatViewSchedule();
  renderSeatsGrid();
  updateSummary();
  initHoldTimer();

  if (typeof showToast === "function") {
    showToast(`📅 Función: ${newDateFormatted} • ${newShowtime} (${dayPricing.tierLabel})`, "info");
  }
}

// Inicializar orden actual y datos de sala
function initOrderAndRoom() {
  currentOrder = Storage.getCurrentOrder();

  const todayIso = new Date().toISOString().split("T")[0];

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
      date: todayIso,
      dateFormatted: "Hoy",
      showtimeKey: `${defaultMovie.id}_${todayIso}_${defaultMovie.showtimes[0]}`,
      priceStandard: defaultMovie.priceStandard,
      priceVip: defaultMovie.priceVip,
      seats: [],
      snacks: [],
      total: 0
    };
    Storage.saveCurrentOrder(currentOrder);
  }

  // Asegurar fecha y showtimeKey con soporte multidía
  if (!currentOrder.date) {
    currentOrder.date = todayIso;
    currentOrder.dateFormatted = "Hoy";
  }
  showtimeKey = currentOrder.showtimeKey || `${currentOrder.movieId}_${currentOrder.date}_${currentOrder.showtime}`;
  currentOrder.showtimeKey = showtimeKey;
  Storage.saveCurrentOrder(currentOrder);

  // Buscar configuración de la sala arquitectónica actualizada
  const rooms = Storage.getRooms();
  currentRoom = rooms.find(r => 
    r.id === currentOrder.roomId || 
    (r.id && currentOrder.roomId && r.id.replace(/\D/g, '') === String(currentOrder.roomId).replace(/\D/g, '')) ||
    r.name === currentOrder.hall ||
    (r.name && currentOrder.hall && (r.name.includes(currentOrder.hall) || currentOrder.hall.includes(r.name)))
  ) || rooms[0];

  // Sincronizar nombre si fue editado por el administrador
  if (currentRoom && currentRoom.name && currentRoom.name !== currentOrder.hall) {
    currentOrder.hall = currentRoom.name;
    Storage.saveCurrentOrder(currentOrder);
  }

  // Depurar butacas previamente seleccionadas si fueron eliminadas en la reconfiguración del Administrador
  if (currentOrder.seats && currentOrder.seats.length > 0) {
    const validRows = currentRoom.rows || ["A", "B", "C", "D", "E", "F"];
    const maxCols = currentRoom.seatsPerRow || 10;
    const initialLen = currentOrder.seats.length;
    currentOrder.seats = currentOrder.seats.filter(s => {
      const code = s.code || s;
      const parts = code.split("-");
      if (parts.length === 2) {
        return validRows.includes(parts[0]) && parseInt(parts[1], 10) <= maxCols;
      }
      return true;
    });
    if (currentOrder.seats.length !== initialLen) {
      Storage.saveCurrentOrder(currentOrder);
    }
  }

  // Sincronizar tarifas dinámicas y promociones (Fin de semana vs días calmados vs Miércoles 2x1)
  const movie = Storage.getMovieById(currentOrder.movieId) || {};
  const dayPricing = Storage.getDayPricingInfo(currentOrder.date, movie);
  currentOrder.priceStandard = dayPricing.priceStandard;
  currentOrder.priceVip = dayPricing.priceVip;
  currentOrder.basePriceStandard = movie.priceStandard || 6.50;
  currentOrder.basePriceVip = movie.priceVip || 10.00;
  currentOrder.isWeekend = dayPricing.isWeekend;
  currentOrder.isWednesday = dayPricing.isWednesday;
  currentOrder.tierLabel = dayPricing.tierLabel;

  // Actualizar leyendas con precios reales de esta función
  const legendStd = document.querySelector("#legendPriceStandard");
  const legendVip = document.querySelector("#legendPriceVip");
  if (legendStd) {
    legendStd.textContent = dayPricing.has2x1Promo 
      ? `Estándar ($${dayPricing.priceStandard.toFixed(2)} - ¡Aplica 2x1!)` 
      : (dayPricing.isWeekend ? `Estándar ($${dayPricing.priceStandard.toFixed(2)} - Finde)` : `Estándar ($${dayPricing.priceStandard.toFixed(2)})`);
  }
  if (legendVip) {
    legendVip.textContent = dayPricing.has2x1Promo 
      ? `VIP Luxury ($${dayPricing.priceVip.toFixed(2)} - ¡Aplica 2x1!)` 
      : (dayPricing.isWeekend ? `VIP Luxury ($${dayPricing.priceVip.toFixed(2)} - Finde)` : `VIP Luxury ($${dayPricing.priceVip.toFixed(2)})`);
  }
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
  const wheelchairSeats = Array.isArray(currentRoom.wheelchairSeats)
    ? currentRoom.wheelchairSeats
    : (currentRoom.wheelchairCols ? (currentRoom.rows.slice(0, 1).map(r => currentRoom.wheelchairCols.map(c => `${r}-${c}`)).flat()) : ["A-1", "A-2"]);

  // Renderizar Puertas de Acceso y Evacuación de Emergencia del Cliente
  const doors = (Array.isArray(currentRoom.doors) && currentRoom.doors.length === 4) ? currentRoom.doors : [
    { id: "front-left", active: true, type: "SALIDA" },
    { id: "front-right", active: true, type: "SALIDA" },
    { id: "back-left", active: true, type: "ENTRADA" },
    { id: "back-right", active: false, type: "SALIDA" }
  ];

  const dFL = doors.find(d => d.id === "front-left") || { active: false, type: "SALIDA" };
  const dFR = doors.find(d => d.id === "front-right") || { active: false, type: "SALIDA" };
  const dBL = doors.find(d => d.id === "back-left") || { active: false, type: "ENTRADA" };
  const dBR = doors.find(d => d.id === "back-right") || { active: false, type: "SALIDA" };

  function createClientDoorBadge(door) {
    if (!door.active) {
      return `<div class="hall-door-badge door-closed" style="cursor: default;">🚫 PARED</div>`;
    }
    if (door.type === "ENTRADA") {
      return `<div class="hall-door-badge door-entrance" style="cursor: default;">🚪 ENTRADA SALA</div>`;
    }
    return `<div class="hall-door-badge door-exit" style="cursor: default;">🟢 SALIDA EMERGENCIA</div>`;
  }

  const slotFL = document.querySelector("#slotDoorFrontLeftClient");
  const slotFR = document.querySelector("#slotDoorFrontRightClient");
  const slotBL = document.querySelector("#slotDoorBackLeftClient");
  const slotBR = document.querySelector("#slotDoorBackRightClient");

  if (slotFL) slotFL.innerHTML = createClientDoorBadge(dFL);
  if (slotFR) slotFR.innerHTML = createClientDoorBadge(dFR);
  if (slotBL) slotBL.innerHTML = createClientDoorBadge(dBL);
  if (slotBR) slotBR.innerHTML = createClientDoorBadge(dBR);

  // Pasillos de Circulación del Cliente
  const walkwayL = document.querySelector("#walkwayLeftClient");
  const walkwayR = document.querySelector("#walkwayRightClient");
  const tagL = document.querySelector("#tagWalkwayLeftClient");
  const tagR = document.querySelector("#tagWalkwayRightClient");
  const arrTopL = document.querySelector("#arrowTopLeftClient");
  const arrBotL = document.querySelector("#arrowBottomLeftClient");
  const arrTopR = document.querySelector("#arrowTopRightClient");
  const arrBotR = document.querySelector("#arrowBottomRightClient");

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

  // Estados de ocupación y candados en tiempo real
  const occupiedSeats = Storage.getOccupiedSeats(showtimeKey);
  const overrides = Storage.getSeatOverrides(showtimeKey);
  const mySessionId = Storage.getSessionId();

  // Función fábrica para crear cada botón de butaca
  function createSeatButton(row, col, isVipRow) {
    const seatCode = `${row}-${col}`;
    const isWheelchair = wheelchairSeats.includes(seatCode);
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
    if (isWheelchair) seat.classList.add("wheelchair", "seat-wheelchair");

    // Curvatura radial anfiteatro adaptada a la cantidad dinámica de columnas
    if (layoutType === "curved_imax") {
      if (col === 1) seat.style.transform = "rotate(7deg) translateY(3px)";
      else if (col === 2) seat.style.transform = "rotate(4deg) translateY(1.5px)";
      else if (col === seatsPerRow - 1) seat.style.transform = "rotate(-4deg) translateY(1.5px)";
      else if (col === seatsPerRow) seat.style.transform = "rotate(-7deg) translateY(3px)";
    }

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
      const midCol = Math.floor(seatsPerRow / 2);
      for (let col = 1; col <= seatsPerRow; col++) {
        // Pasillo central dinámico según la cantidad de butacas por fila
        if (col === midCol + 1) {
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
      const leftCount = Math.max(1, Math.min(3, Math.round(seatsPerRow * 0.2)));
      const rightCount = leftCount;
      const centerCount = Math.max(1, seatsPerRow - leftCount - rightCount);

      // Bloque Lateral Izquierdo
      const blockLeft = document.createElement("div");
      blockLeft.className = "stadium-block block-left";
      for (let col = 1; col <= leftCount; col++) {
        blockLeft.appendChild(createSeatButton(row, col, isVipRow));
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
        blockCenter.appendChild(createSeatButton(row, col, isVipRow));
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
        blockRight.appendChild(createSeatButton(row, col, isVipRow));
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
        pod.appendChild(createSeatButton(row, col, isVipRow));

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
        pair.appendChild(createSeatButton(row, col, isVipRow));
        if (col + 1 <= seatsPerRow) {
          pair.appendChild(createSeatButton(row, col + 1, isVipRow));
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

    // Fallback estándar
    else {
      const midCol = Math.floor(seatsPerRow / 2);
      for (let col = 1; col <= seatsPerRow; col++) {
        if (col === midCol + 1) {
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
  const miniDate = document.querySelector("#summaryDate");
  const seatsTagsContainer = document.querySelector("#selectedSeatsTags");
  const countLabel = document.querySelector("#summarySeatsCount");
  const totalPriceLabel = document.querySelector("#summaryTotalPrice");
  const continueBtn = document.querySelector("#btnProceedCandy");

  if (miniPoster) miniPoster.src = currentOrder.poster;
  if (miniTitle) miniTitle.textContent = currentOrder.movieTitle;
  if (miniHall) miniHall.textContent = currentOrder.hall;
  if (miniTime) miniTime.textContent = currentOrder.showtime;
  if (miniDate) miniDate.textContent = currentOrder.dateFormatted || currentOrder.date || "Hoy";

  const vigenciaContainer = document.querySelector("#summaryVigenciaBadge");
  const movie = Storage.getMovieById(currentOrder.movieId) || {};
  if (vigenciaContainer && movie) {
    const vigencia = Storage.getMovieVigenciaInfo(movie);
    vigenciaContainer.innerHTML = `
      <span class="badge ${vigencia.isPresale ? 'badge-presale' : 'badge-now-showing'}" style="font-size: 0.68rem; padding: 0.2rem 0.5rem;">
        ${vigencia.badgeText}
      </span>
      <div style="font-size: 0.72rem; color: ${vigencia.isPresale ? '#ff66b2' : 'var(--gold)'}; margin-top: 0.25rem; font-weight: 600;">
        ${vigencia.daysNotice}
      </div>
    `;
  }

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

  // Cálculo dinámico de precios con soporte para fin de semana y promoción Miércoles 2x1
  const baseStd = currentOrder.basePriceStandard || movie.priceStandard || 6.50;
  const baseVip = currentOrder.basePriceVip || movie.priceVip || 10.00;
  const calc = Storage.calculateTicketsPrice(currentOrder.seats, currentOrder.date, baseStd, baseVip);

  // Actualizar etiqueta de tarifa
  const tariffLabel = document.querySelector("#summaryTariffLabel");
  if (tariffLabel) tariffLabel.textContent = calc.dayPricing.tierLabel;

  // Actualizar desglose de subtotal y descuento 2x1
  const rowSubtotal = document.querySelector("#rowSummarySubtotal");
  const rowDiscount = document.querySelector("#rowSummaryDiscount");
  const subtotalEl = document.querySelector("#summarySubtotalAmount");
  const discountEl = document.querySelector("#summaryDiscountAmount");

  if (calc.discount2x1 > 0) {
    if (rowSubtotal) { rowSubtotal.style.display = "flex"; subtotalEl.textContent = `$${calc.subtotal.toFixed(2)}`; }
    if (rowDiscount) { rowDiscount.style.display = "flex"; discountEl.textContent = `-$${calc.discount2x1.toFixed(2)}`; }
  } else {
    if (rowSubtotal) rowSubtotal.style.display = "none";
    if (rowDiscount) rowDiscount.style.display = "none";
  }

  // Tip de ayuda 2x1 si seleccionaron número impar de butacas los miércoles
  const tipEl = document.querySelector("#wednesdayPromoTip");
  if (tipEl) {
    if (calc.isOddWednesday) {
      tipEl.innerHTML = `💡 <strong>¡Aprovecha el 2x1!</strong> Tienes ${currentOrder.seats.length} butaca(s) en tu orden. Si seleccionas 1 más, ¡te saldrá totalmente <strong>GRATIS</strong>!`;
      tipEl.style.display = "block";
    } else if (calc.discount2x1 > 0) {
      tipEl.innerHTML = `🎉 <strong>¡Promoción 2x1 aplicada!</strong> Estás ahorrando <strong>$${calc.discount2x1.toFixed(2)}</strong> en tus entradas hoy.`;
      tipEl.style.display = "block";
    } else {
      tipEl.style.display = "none";
    }
  }

  currentOrder.ticketsSubtotal = calc.subtotal;
  currentOrder.discount2x1 = calc.discount2x1;
  currentOrder.ticketsTotal = calc.total;
  currentOrder.subtotalTickets = calc.total;
  currentOrder.grandTotal = calc.total + (currentOrder.subtotalSnacks || 0);
  currentOrder.total = currentOrder.grandTotal;

  if (countLabel) countLabel.textContent = `${currentOrder.seats.length} boletos`;
  if (totalPriceLabel) totalPriceLabel.textContent = `$${calc.total.toFixed(2)}`;

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
