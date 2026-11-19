/* ==========================================================================
   Cine Majestad - Tablas de Analíticas de Rendimiento & Inteligencia Financiera
   Cálculo robusto, sincronización en vivo con Base de Datos MySQL
   ========================================================================== */

// Helpers globales unificados para cálculo exacto de ingresos y asientos
function getBookingTotal(b) {
  if (!b) return 0;
  if (typeof b.grandTotal === "number" && !isNaN(b.grandTotal)) return b.grandTotal;
  if (typeof b.total === "number" && !isNaN(b.total)) return b.total;
  if (typeof b.total_pagado === "number" && !isNaN(b.total_pagado)) return b.total_pagado;

  const pGrand = parseFloat(b.grandTotal);
  if (!isNaN(pGrand)) return pGrand;
  const pTotal = parseFloat(b.total);
  if (!isNaN(pTotal)) return pTotal;
  const pPagado = parseFloat(b.total_pagado);
  if (!isNaN(pPagado)) return pPagado;

  const sTickets = parseFloat(b.subtotalTickets || b.ticketsTotal || 0) || 0;
  const sSnacks = parseFloat(b.subtotalSnacks || b.snacksTotal || b.subtotal_snacks || 0) || 0;
  return sTickets + sSnacks;
}
window.getBookingTotal = getBookingTotal;

function getBookingCandyTotal(b) {
  if (!b) return 0;
  if (typeof b.snacksTotal === "number" && !isNaN(b.snacksTotal)) return b.snacksTotal;
  if (typeof b.subtotalSnacks === "number" && !isNaN(b.subtotalSnacks)) return b.subtotalSnacks;
  if (typeof b.subtotal_snacks === "number" && !isNaN(b.subtotal_snacks)) return b.subtotal_snacks;

  const pSnacks = parseFloat(b.snacksTotal || b.subtotalSnacks || b.subtotal_snacks);
  if (!isNaN(pSnacks)) return pSnacks;

  if (Array.isArray(b.snacks)) {
    return b.snacks.reduce((acc, s) => acc + ((parseFloat(s.price) || 0) * (parseInt(s.qty || s.quantity || 1, 10))), 0);
  }
  return 0;
}
window.getBookingCandyTotal = getBookingCandyTotal;

function getBookingTicketCount(b) {
  if (!b) return 0;
  if (Array.isArray(b.seats)) return b.seats.length;
  if (typeof b.seats === "string" && b.seats.trim()) {
    try {
      const parsed = JSON.parse(b.seats);
      if (Array.isArray(parsed)) return parsed.length;
    } catch (e) {
      return b.seats.split(",").filter(s => s.trim().length > 0).length;
    }
  }
  const count = parseInt(b.ticketCount || b.boletos || 0, 10);
  return !isNaN(count) && count > 0 ? count : ((parseFloat(b.subtotalTickets) || 0) > 0 ? 1 : 0);
}
window.getBookingTicketCount = getBookingTicketCount;

async function syncSalesDataFromAPI() {
  try {
    if (typeof API !== "undefined" && API.orders && API.orders.getAll) {
      const res = await API.orders.getAll();
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        Storage.saveBookings(res.data, true);
        return res.data;
      }
    }
  } catch (err) {
    console.warn("[Analytics API Direct Fetch Warning]:", err.message);
  }
  return null;
}

async function refreshAdminAnalytics(isManual = false) {
  const btn = document.querySelector("#btnRefreshAnalytics");
  const badgeUpdated = document.querySelector("#analyticsLastUpdated");

  if (btn && isManual) {
    btn.disabled = true;
    btn.innerHTML = `<span style="display: inline-block; animation: spin 1s infinite linear;">🔄</span> Sincronizando con BD...`;
  }

  try {
    // 1. Sincronizar en vivo con la Base de Datos MySQL
    if (typeof syncBookingsFromAPI === "function") {
      await syncBookingsFromAPI();
    } else {
      await syncSalesDataFromAPI();
    }

    // 2. Refrescar los 4 KPIs superiores de la cabecera
    if (typeof renderStats === "function") {
      renderStats();
    }

    // 3. Sincronizar tabla de Historial de Ventas si está presente
    if (typeof renderBookingsTable === "function") {
      renderBookingsTable();
    }

    // 4. Obtener las reservas activas (no canceladas ni reembolsadas)
    const bookings = (typeof Storage !== "undefined" && Storage.getBookings ? Storage.getBookings() : [])
      .filter(b => b.status !== "CANCELADA" && b.status !== "REEMBOLSADA");
    const movies = (typeof Storage !== "undefined" && Storage.getMovies) ? Storage.getMovies() : [];
    const rooms = (typeof Storage !== "undefined" && Storage.getRooms) ? Storage.getRooms() : [];

    // 5. Renderizar tablas analíticas (Ingresos por Película y Métodos de Pago)
    renderMovieRevenueTable(bookings, movies);
    renderPaymentMethodsTable(bookings);

    // 6. Calcular recaudación total
    const grandTotal = bookings.reduce((sum, b) => sum + getBookingTotal(b), 0);
    const timeStr = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    if (badgeUpdated) {
      badgeUpdated.innerHTML = `<span style="color: #00e676; font-weight: 600;">● Sincronizado</span> Último refresco: ${timeStr} (${bookings.length} ventas | $${grandTotal.toFixed(2)})`;
    }

    if (isManual && typeof showToast === "function") {
      showToast(`✅ Métricas actualizadas: ${bookings.length} ventas sincronizadas desde MySQL ($${grandTotal.toFixed(2)} USD).`, "success");
    }
  } catch (err) {
    console.error("[Analytics Refresh Error]:", err);
    if (isManual && typeof showToast === "function") {
      showToast("Error al refrescar analíticas: " + err.message, "error");
    }
  } finally {
    if (btn && isManual) {
      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = `🔄 Refrescar Métricas`;
      }, 400);
    }
  }
}

// 1. Tabla: Ingresos y Recaudación por Película
function renderMovieRevenueTable(bookings, movies) {
  const tbody = document.querySelector("#tableMovieRevenueBody");
  const totalBadge = document.querySelector("#movieRevenueTotalBadge");
  if (!tbody) return;

  const movieMap = {};
  movies.forEach(m => {
    movieMap[m.title] = {
      title: m.title,
      tickets: 0,
      revenue: 0
    };
  });

  let grandTotal = 0;

  bookings.forEach(b => {
    const amount = getBookingTotal(b);
    const ticketCount = getBookingTicketCount(b);
    const rawTitle = (b.movieTitle || "").trim();

    let matched = Object.keys(movieMap).find(k => k.toLowerCase() === rawTitle.toLowerCase());
    if (!matched) {
      matched = rawTitle || ((b.snacks && b.snacks.length > 0) ? "Ventas Directas de Confitería" : "Otras Ventas");
      if (!movieMap[matched]) {
        movieMap[matched] = { title: matched, tickets: 0, revenue: 0 };
      }
    }

    movieMap[matched].tickets += ticketCount;
    movieMap[matched].revenue += amount;
    grandTotal += amount;
  });

  if (totalBadge) {
    totalBadge.textContent = `$${grandTotal.toFixed(2)}`;
  }

  const list = Object.values(movieMap).sort((a, b) => b.revenue - a.revenue);

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No hay películas con ventas registradas aún.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(item => {
    const pct = grandTotal > 0 ? ((item.revenue / grandTotal) * 100).toFixed(1) : "0.0";
    return `
      <tr>
        <td>
          <strong style="color: #fff;">${item.title}</strong>
          <div style="background: rgba(255,255,255,0.06); border-radius: 999px; height: 5px; width: 100%; margin-top: 5px; overflow: hidden;">
            <div style="background: var(--gold); height: 100%; width: ${Math.min(pct, 100)}%;"></div>
          </div>
        </td>
        <td style="text-align: right; color: var(--text-secondary); font-weight: 600;">${item.tickets} boles.</td>
        <td style="text-align: right; font-weight: 700; color: #00e676;">$${item.revenue.toFixed(2)}</td>
        <td style="text-align: right;">
          <span class="badge" style="background: rgba(212, 175, 55, 0.15); color: var(--gold); font-size: 0.75rem;">${pct}%</span>
        </td>
      </tr>
    `;
  }).join("");
}

// 2. Tabla: Ocupación Real por Sala
function renderRoomOccupancyTable(rooms, bookings) {
  const tbody = document.querySelector("#tableRoomOccupancyBody");
  const avgBadge = document.querySelector("#avgOccupancyBadge");
  if (!tbody) return;

  if (rooms.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No hay salas configuradas.</td></tr>`;
    return;
  }

  let totalPctSum = 0;

  const rowsHtml = rooms.map(room => {
    const rName = (room.name || "").toLowerCase().trim();
    const rCleanName = rName.split("(")[0].trim();
    const rId = (room.id || "").toLowerCase().trim();
    const rNum = rId.replace(/\D/g, "");
    let occupiedCount = 0;

    bookings.forEach(b => {
      const bHall = (b.hall || "").toLowerCase().trim();
      const bRoom = (b.roomId || "").toLowerCase().trim();
      const isMatch = (bRoom === rId) || 
                      (rNum && (bRoom === rNum || bRoom === `sala-${rNum}`)) || 
                      (bHall && (bHall.includes(rCleanName) || rName.includes(bHall)));

      if (isMatch) {
        occupiedCount += getBookingTicketCount(b);
      }
    });

    const cap = room.capacity || 50;
    const pct = Math.min(100, Math.round((occupiedCount / cap) * 100));
    totalPctSum += pct;

    let barColor = "#00e676";
    let statusBadge = `<span class="badge" style="background: rgba(0, 230, 118, 0.12); color: #00e676; font-size: 0.72rem;">Disponible</span>`;

    if (pct >= 75) {
      barColor = "#e50914";
      statusBadge = `<span class="badge" style="background: rgba(229, 9, 20, 0.15); color: #ff5252; font-size: 0.72rem;">Alta Demanda</span>`;
    } else if (pct >= 30) {
      barColor = "#00d2ff";
      statusBadge = `<span class="badge" style="background: rgba(0, 210, 255, 0.15); color: #00d2ff; font-size: 0.72rem;">Moderada</span>`;
    }

    return `
      <tr>
        <td>
          <strong style="color: #fff;">${room.name}</strong>
          <div style="background: rgba(255,255,255,0.06); border-radius: 999px; height: 5px; width: 100%; margin-top: 5px; overflow: hidden;">
            <div style="background: ${barColor}; height: 100%; width: ${pct}%;"></div>
          </div>
        </td>
        <td style="text-align: center; color: var(--text-secondary);">${cap}</td>
        <td style="text-align: center; font-weight: 700; color: var(--gold);">${occupiedCount}</td>
        <td style="text-align: right;">
          <span style="font-weight: 800; color: #fff; margin-right: 0.4rem;">${pct}%</span>
          ${statusBadge}
        </td>
      </tr>
    `;
  }).join("");

  tbody.innerHTML = rowsHtml;

  if (avgBadge) {
    const avg = rooms.length > 0 ? Math.round(totalPctSum / rooms.length) : 0;
    avgBadge.textContent = `${avg}% Ocupación Prom.`;
  }
}

// 3. Tabla: Canales y Métodos de Pago
function renderPaymentMethodsTable(bookings) {
  const tbody = document.querySelector("#tablePaymentMethodsBody");
  const badgeTotal = document.querySelector("#paymentTotalBadge");
  if (!tbody) return;

  const channels = {
    "Transferencia / PSE": { name: "Transferencia / PSE", icon: "🏦", count: 0, total: 0, color: "#00d2ff" },
    "Tarjeta Crédito / Débito": { name: "Tarjeta Crédito / Débito", icon: "💳", count: 0, total: 0, color: "var(--gold)" },
    "Nequi / Daviplata": { name: "Nequi / Daviplata", icon: "📱", count: 0, total: 0, color: "#da0081" },
    "Efectivo en Taquilla": { name: "Efectivo en Taquilla", icon: "💵", count: 0, total: 0, color: "#00e676" }
  };

  let totalVentasCount = 0;
  let totalMontoRecaudado = 0;

  bookings.forEach(b => {
    const amount = getBookingTotal(b);
    const pm = (b.paymentMethod || b.metodo_pago || "").toUpperCase();

    totalVentasCount++;
    totalMontoRecaudado += amount;

    if (pm.includes("NEQUI") || pm.includes("DAVIPLATA")) {
      channels["Nequi / Daviplata"].count++;
      channels["Nequi / Daviplata"].total += amount;
    } else if (pm.includes("TRANSFER") || pm.includes("PSE") || pm.includes("BANCO")) {
      channels["Transferencia / PSE"].count++;
      channels["Transferencia / PSE"].total += amount;
    } else if (pm.includes("EFECTIVO") || pm.includes("TAQUILLA") || pm.includes("CASH")) {
      channels["Efectivo en Taquilla"].count++;
      channels["Efectivo en Taquilla"].total += amount;
    } else {
      channels["Tarjeta Crédito / Débito"].count++;
      channels["Tarjeta Crédito / Débito"].total += amount;
    }
  });

  if (badgeTotal) {
    badgeTotal.textContent = `${totalVentasCount} Ventas`;
  }

  tbody.innerHTML = Object.values(channels).map(c => {
    const pct = totalVentasCount > 0 ? ((c.count / totalVentasCount) * 100).toFixed(1) : "0.0";
    return `
      <tr>
        <td>
          <strong style="color: #fff;">${c.icon} ${c.name}</strong>
          <div style="background: rgba(255,255,255,0.06); border-radius: 999px; height: 5px; width: 100%; margin-top: 5px; overflow: hidden;">
            <div style="background: ${c.color}; height: 100%; width: ${Math.min(pct, 100)}%;"></div>
          </div>
        </td>
        <td style="text-align: right; color: var(--text-secondary); font-weight: 600;">${c.count} trans.</td>
        <td style="text-align: right; font-weight: 700; color: #00e676;">$${c.total.toFixed(2)}</td>
        <td style="text-align: right;"><span class="badge" style="background: rgba(255,255,255,0.08); font-size: 0.75rem;">${pct}%</span></td>
      </tr>
    `;
  }).join("");
}

function initAdminCharts() {
  refreshAdminAnalytics(false);
}

function renderAllAdminCharts() {
  refreshAdminAnalytics(false);
}

// =============================================================================
// EXPORTACIÓN DE REPORTES A CSV / EXCEL (.csv con BOM UTF-8)
// =============================================================================

function exportSalesToCsv() {
  const bookings = Storage.getBookings();
  let csv = "ID Reserva,Fecha,Cliente,Email,Pelicula,Sala,Horario,Asientos,Subtotal Boletos,Subtotal Snacks,Total,Metodo Pago,Estado Comida\n";

  bookings.forEach(b => {
    const seatsStr = (b.seats || []).join("; ");
    csv += `"${b.id}","${b.createdAt}","${b.customerName}","${b.customerEmail}","${b.movieTitle}","${b.hall}","${b.showtime}","${seatsStr}",${b.subtotalTickets || 0},${b.subtotalSnacks || 0},${b.total || 0},"${b.paymentMethod || ''}","${b.foodStatus || ''}"\n`;
  });

  downloadCsvFile(csv, `ventas_cinemajestad_${Date.now()}.csv`);
  showToast("Reporte de ventas exportado exitosamente a CSV / Excel.", "success");
}

function exportInventoryToCsv() {
  const snacks = Storage.getSnacks();
  let csv = "ID Producto,Nombre,Categoria,Precio ($),Stock Actual\n";

  snacks.forEach(s => {
    csv += `"${s.id}","${s.name}","${s.category}",${s.price},${s.stock}\n`;
  });

  downloadCsvFile(csv, `inventario_dulceria_${Date.now()}.csv`);
  showToast("Inventario de dulcería exportado exitosamente.", "success");
}

function downloadCsvFile(content, fileName) {
  // Añadir BOM (\uFEFF) para que Excel reconozca tildes y caracteres especiales automáticamente
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// =============================================================================
// INTELIGENCIA FINANCIERA, RENTABILIDAD Y COMISIONES (MÓDULO NUEVO)
// =============================================================================

async function getFinancialData() {
  if (typeof API !== "undefined" && API.admin && API.admin.getFinancials) {
    try {
      const res = await API.admin.getFinancials();
      if (res && res.success && res.data) return res.data;
    } catch (e) {
      console.warn("[Analytics] Fallback local para financieras:", e.message);
    }
  }
  return Storage.getFinancialAnalytics();
}

async function renderFinancialDashboard() {
  try {
    await ensureChartJsLoaded();
    const data = await getFinancialData();
    if (!data) return;

    // 1. Actualizar Tarjetas KPI
    const elGross = document.querySelector("#finGrossRevenue");
    const elSplit = document.querySelector("#finRevenueSplit");
    const elCogs = document.querySelector("#finTotalCogs");
    const elCogsPercent = document.querySelector("#finCogsPercent");
    const elFees = document.querySelector("#finGatewayFees");
    const elFeesPercent = document.querySelector("#finFeesPercent");
    const elNet = document.querySelector("#finNetProfit");
    const elNetMargin = document.querySelector("#finNetMargin");
    const elGrossMargin = document.querySelector("#finGrossMargin");

    if (elGross) elGross.textContent = `$${data.grossRevenue.toFixed(2)}`;
    if (elSplit) elSplit.textContent = `🎟️ Boletos: $${data.ticketRevenue.toFixed(2)} | 🍿 Snacks: $${data.snackRevenue.toFixed(2)}`;
    if (elCogs) elCogs.textContent = `$${data.totalCogs.toFixed(2)}`;
    if (elCogsPercent) {
      const cogsRatio = data.grossRevenue > 0 ? ((data.totalCogs / data.grossRevenue) * 100).toFixed(1) : "0.0";
      elCogsPercent.textContent = `${cogsRatio}% de las ventas brutas`;
    }
    if (elFees) elFees.textContent = `$${data.totalGatewayFees.toFixed(2)}`;
    if (elFeesPercent) {
      const feeRatio = data.grossRevenue > 0 ? ((data.totalGatewayFees / data.grossRevenue) * 100).toFixed(1) : "0.0";
      elFeesPercent.textContent = `${feeRatio}% retención bancaria/pasarela`;
    }
    if (elNet) elNet.textContent = `$${data.netProfit.toFixed(2)}`;
    if (elNetMargin) elNetMargin.textContent = `${data.netMarginPercent.toFixed(1)}%`;
    if (elGrossMargin) elGrossMargin.textContent = `Margen Bruto: ${data.grossMarginPercent.toFixed(1)}%`;

    // 2. Renderizar Gráficos Financieros
    renderFinancialCharts(data);

    // 3. Renderizar Tabla de Rentabilidad
    renderFinancialProductsTable(data.inventoryProfitability || []);

  } catch (err) {
    console.error("[Analytics] Error al renderizar dashboard financiero:", err);
  }
}

function renderFinancialCharts(data) {
  // Gráfico 1: Estructura del Ingreso (Doughnut)
  const canvasStructure = document.querySelector("#chartFinancialStructure");
  if (canvasStructure) {
    if (financialStructureChart) financialStructureChart.destroy();
    const ctx = canvasStructure.getContext("2d");
    financialStructureChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Ganancia Neta Real", "Costo de Insumos (COGS)", "Intereses y Pasarela"],
        datasets: [{
          data: [
            parseFloat(data.netProfit.toFixed(2)),
            parseFloat(data.totalCogs.toFixed(2)),
            parseFloat(data.totalGatewayFees.toFixed(2))
          ],
          backgroundColor: ["#00e676", "#ff9100", "#c77dff"],
          borderColor: "#12121a",
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { color: "#a0a0af", boxWidth: 12 } },
          tooltip: {
            callbacks: {
              label: (item) => ` ${item.label}: $${item.raw.toFixed(2)} (${data.grossRevenue > 0 ? ((item.raw / data.grossRevenue) * 100).toFixed(1) : 0}%)`
            }
          }
        }
      }
    });
  }

  // Gráfico 2: Rentabilidad por Producto (Bar)
  const canvasMargins = document.querySelector("#chartProductMargins");
  if (canvasMargins && data.inventoryProfitability) {
    if (productMarginsChart) productMarginsChart.destroy();
    const ctx2 = canvasMargins.getContext("2d");

    const items = data.inventoryProfitability;
    const labels = items.map(i => i.name.length > 15 ? i.name.substring(0, 15) + "..." : i.name);
    const costData = items.map(i => i.costPrice);
    const saleData = items.map(i => i.salePrice);
    const profitData = items.map(i => i.unitProfit);

    productMarginsChart = new Chart(ctx2, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Costo Insumo ($)",
            data: costData,
            backgroundColor: "rgba(255, 145, 0, 0.7)",
            borderColor: "#ff9100",
            borderWidth: 1.5,
            borderRadius: 4
          },
          {
            label: "Precio Venta ($)",
            data: saleData,
            backgroundColor: "rgba(212, 175, 55, 0.7)",
            borderColor: "#d4af37",
            borderWidth: 1.5,
            borderRadius: 4
          },
          {
            label: "Ganancia Unit. ($)",
            data: profitData,
            backgroundColor: "rgba(0, 230, 118, 0.7)",
            borderColor: "#00e676",
            borderWidth: 1.5,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: "#a0a0af", boxWidth: 12 } }
        },
        scales: {
          x: { ticks: { color: "#a0a0af", font: { size: 10 } }, grid: { color: "rgba(255,255,255,0.04)" } },
          y: { ticks: { color: "#a0a0af", callback: (v) => "$" + v }, grid: { color: "rgba(255,255,255,0.05)" } }
        }
      }
    });
  }
}

function renderFinancialProductsTable(products) {
  const tbody = document.querySelector("#tableFinancialProductsBody");
  const tfoot = document.querySelector("#tableFinancialProductsFoot");
  if (!tbody) return;

  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: var(--text-muted); padding: 2rem;">No hay productos de inventario registrados.</td></tr>`;
    if (tfoot) tfoot.innerHTML = "";
    return;
  }

  let totalStockUnits = 0;
  let totalSoldUnits = 0;
  let totalRevenue = 0;
  let totalCost = 0;
  let totalProfit = 0;

  tbody.innerHTML = products.map(p => {
    totalStockUnits += p.stock;
    totalSoldUnits += p.unitsSold;
    totalRevenue += p.productTotalRevenue;
    totalCost += p.productTotalCost;
    totalProfit += p.productTotalProfit;

    const marginClass = p.marginPercent >= 75 ? 'badge-margin-high' : 'badge-margin-gold';

    return `
      <tr>
        <td>
          <strong>${p.name}</strong>
          <span class="badge" style="display: block; width: fit-content; margin-top: 3px; font-size: 0.7rem; background: rgba(255,255,255,0.06);">${p.category}</span>
        </td>
        <td><strong>${p.stock}</strong> uds.</td>
        <td><span class="badge-cost">$${p.costPrice.toFixed(2)}</span></td>
        <td><strong style="color: var(--gold);">$${p.salePrice.toFixed(2)}</strong></td>
        <td><span class="badge-profit">+$${p.unitProfit.toFixed(2)}</span></td>
        <td><span class="${marginClass}">${p.marginPercent.toFixed(1)}%</span></td>
        <td><strong style="color: #00d2ff;">+${p.markupRoiPercent.toFixed(1)}%</strong></td>
        <td><span class="badge" style="background: rgba(255,255,255,0.08); font-weight: 700;">${p.unitsSold}</span></td>
        <td>$${p.productTotalRevenue.toFixed(2)}</td>
        <td style="color: #ff9100;">$${p.productTotalCost.toFixed(2)}</td>
        <td><strong style="color: #00e676;">+$${p.productTotalProfit.toFixed(2)}</strong></td>
      </tr>
    `;
  }).join('');

  if (tfoot) {
    const globalMargin = totalRevenue > 0 ? (((totalRevenue - totalCost) / totalRevenue) * 100).toFixed(1) : "0.0";
    tfoot.innerHTML = `
      <tr>
        <td colspan="2" style="padding: 1rem; color: #fff;">TOTALES CONSOLIDADOS (${products.length} productos):</td>
        <td colspan="3" style="color: var(--text-muted); font-size: 0.85rem;">Stock: ${totalStockUnits} uds.</td>
        <td style="color: var(--gold); font-size: 0.9rem;">${globalMargin}% Margen</td>
        <td>-</td>
        <td style="color: #fff; font-size: 0.9rem;">${totalSoldUnits} uds.</td>
        <td style="color: #00d2ff; font-size: 0.95rem;">$${totalRevenue.toFixed(2)}</td>
        <td style="color: #ff9100; font-size: 0.95rem;">$${totalCost.toFixed(2)}</td>
        <td style="color: #00e676; font-size: 1.05rem;">+$${totalProfit.toFixed(2)}</td>
      </tr>
    `;
  }
}

async function exportFinancialsToCsv() {
  const data = await getFinancialData();
  if (!data) return;

  let csv = "CINE MAJESTAD - BALANCE FINANCIERO Y AUDITORIA DE VENTAS\n";
  csv += `Fecha de Generacion:,"${new Date().toLocaleString('es-ES')}"\n\n`;

  csv += "--- RESUMEN EJECUTIVO GLOBAL ---\n";
  csv += `Ventas Brutas Totales (USD),${data.grossRevenue.toFixed(2)}\n`;
  csv += `Ventas Taquilla / Boletos (USD),${data.ticketRevenue.toFixed(2)}\n`;
  csv += `Ventas Dulceria / Snacks (USD),${data.snackRevenue.toFixed(2)}\n`;
  csv += `Costo de Insumos Vendidos (COGS USD),${data.totalCogs.toFixed(2)}\n`;
  csv += `Comisiones e Intereses de Pasarela (USD),${data.totalGatewayFees.toFixed(2)}\n`;
  csv += `Utilidad Neta Real (USD),${data.netProfit.toFixed(2)}\n`;
  csv += `Margen Neto Real (%),${data.netMarginPercent.toFixed(2)}%\n`;
  csv += `Margen Bruto (%),${data.grossMarginPercent.toFixed(2)}%\n\n`;

  csv += "--- RENTABILIDAD Y RENDIMIENTO POR PRODUCTO ---\n";
  csv += "ID Producto,Nombre Producto,Categoria,Stock Disponible,Valor Inventario Costo,Costo Unitario ($),Precio Venta ($),Ganancia Unitaria ($),Margen Bruto (%),Markup ROI (%),Unidades Vendidas,Ingresos Totales ($),Costo Total Insumos ($),Ganancia Neta Total ($)\n";

  (data.inventoryProfitability || []).forEach(p => {
    csv += `"${p.id}","${p.name}","${p.category}",${p.stock},${p.currentStockValue.toFixed(2)},${p.costPrice.toFixed(2)},${p.salePrice.toFixed(2)},${p.unitProfit.toFixed(2)},${p.marginPercent.toFixed(2)},${p.markupRoiPercent.toFixed(2)},${p.unitsSold},${p.productTotalRevenue.toFixed(2)},${p.productTotalCost.toFixed(2)},${p.productTotalProfit.toFixed(2)}\n`;
  });

  downloadCsvFile(csv, `balance_financiero_rentabilidad_${Date.now()}.csv`);
  if (typeof showToast === "function") showToast("Balance financiero y rentabilidad exportado exitosamente a CSV / Excel.", "success");
}

window.initAdminCharts = initAdminCharts;
window.renderAllAdminCharts = renderAllAdminCharts;
window.refreshAdminAnalytics = refreshAdminAnalytics;
window.renderFinancialDashboard = renderFinancialDashboard;
window.exportSalesToCsv = exportSalesToCsv;
window.exportInventoryToCsv = exportInventoryToCsv;
window.exportFinancialsToCsv = exportFinancialsToCsv;

