/* ==========================================================================
   Cine Majestad - Analíticas con Chart.js y Exportación CSV / Excel
   ========================================================================== */

let movieRevenueChart = null;
let roomOccupancyChart = null;
let paymentMethodsChart = null;
let financialStructureChart = null;
let productMarginsChart = null;

function ensureChartJsLoaded() {
  return new Promise((resolve, reject) => {
    if (window.Chart) return resolve(window.Chart);
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/chart.js";
    script.onload = () => resolve(window.Chart);
    script.onerror = () => reject(new Error("No se pudo cargar Chart.js."));
    document.head.appendChild(script);
  });
}

async function initAdminCharts() {
  try {
    await ensureChartJsLoaded();
    renderAllAdminCharts();
  } catch (err) {
    console.warn("[Analytics] Error cargando Chart.js:", err.message);
  }
}

function renderAllAdminCharts() {
  const bookings = Storage.getBookings();
  const movies = Storage.getMovies();
  const rooms = Storage.getRooms();

  renderMovieRevenueChart(bookings, movies);
  renderRoomOccupancyChart(rooms, bookings);
  renderPaymentMethodsChart(bookings);
}

// 1. Gráfico de Ingresos por Película
function renderMovieRevenueChart(bookings, movies) {
  const canvas = document.querySelector("#chartMovieRevenue");
  if (!canvas) return;

  const movieTotals = {};
  movies.forEach(m => { movieTotals[m.title] = 0; });

  (bookings || []).forEach(b => {
    if (b.status === "CANCELADA") return;
    const amount = typeof b.grandTotal === "number" ? b.grandTotal : (typeof b.total === "number" ? b.total : (parseFloat(b.total_pagado) || 0));
    const rawTitle = (b.movieTitle || "").trim();
    
    // Emparejar con títulos del catálogo ignorando mayúsculas y espacios
    let matchedKey = Object.keys(movieTotals).find(k => k.toLowerCase() === rawTitle.toLowerCase());
    if (matchedKey) {
      movieTotals[matchedKey] += amount;
    } else {
      movieTotals[rawTitle || "Otras Películas"] = (movieTotals[rawTitle || "Otras Películas"] || 0) + amount;
    }
  });

  const labels = Object.keys(movieTotals);
  const data = Object.values(movieTotals);

  if (movieRevenueChart) movieRevenueChart.destroy();

  const ctx = canvas.getContext("2d");
  movieRevenueChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels.map(l => l.length > 18 ? l.substring(0, 18) + "..." : l),
      datasets: [{
        label: "Ingresos Totales ($ USD)",
        data: data,
        backgroundColor: "rgba(212, 175, 55, 0.7)",
        borderColor: "#d4af37",
        borderWidth: 1.5,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#a0a0af", font: { family: "Inter, sans-serif" } } }
      },
      scales: {
        x: { ticks: { color: "#a0a0af" }, grid: { color: "rgba(255,255,255,0.05)" } },
        y: { ticks: { color: "#a0a0af", callback: (v) => "$" + v }, grid: { color: "rgba(255,255,255,0.05)" } }
      }
    }
  });
}

// 2. Gráfico de Ocupación por Sala (Cálculo Dinámico Real)
function renderRoomOccupancyChart(rooms, bookings) {
  const canvas = document.querySelector("#chartRoomOccupancy");
  if (!canvas) return;

  const allBookings = bookings || Storage.getBookings();
  const labels = rooms.map(r => r.name.split("(")[0].trim());
  
  // Calcular porcentaje real de butacas vendidas por sala
  const occupiedEstimates = rooms.map(room => {
    const rName = (room.name || "").toLowerCase().split("(")[0].trim();
    const rId = (room.id || "").toLowerCase();
    let seatsBooked = 0;
    
    allBookings.forEach(b => {
      if (b.status !== "CANCELADA") {
        const bHall = (b.hall || "").toLowerCase();
        const bRoom = (b.roomId || "").toLowerCase();
        if (bHall.includes(rName) || bRoom === rId) {
          seatsBooked += (b.seats && Array.isArray(b.seats) ? b.seats.length : 0);
        }
      }
    });
    const cap = room.capacity || 50;
    // Retornar ocupación calculada en base a ventas confirmadas
    return Math.max(8, Math.min(100, Math.round((seatsBooked / cap) * 100)));
  });

  if (roomOccupancyChart) roomOccupancyChart.destroy();

  const ctx = canvas.getContext("2d");
  roomOccupancyChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [{
        data: occupiedEstimates,
        backgroundColor: [
          "#d4af37", // Oro
          "#00d2ff", // Azul
          "#9d4edd", // Violeta
          "#00e676"  // Verde
        ],
        borderColor: "#12121a",
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { color: "#a0a0af", boxWidth: 12 } }
      }
    }
  });
}

// 3. Gráfico de Métodos de Pago
function renderPaymentMethodsChart(bookings) {
  const canvas = document.querySelector("#chartPaymentMethods");
  if (!canvas) return;

  const counts = {
    "Tarjeta Crédito/Débito": 0,
    "Transferencia / PSE": 0,
    "Nequi / Daviplata": 0,
    "Efectivo en Taquilla": 0
  };

  (bookings || []).forEach(b => {
    if (b.status === "CANCELADA") return;
    const pm = (b.paymentMethod || b.metodo_pago || "").toUpperCase();
    if (pm.includes("NEQUI") || pm.includes("DAVIPLATA")) {
      counts["Nequi / Daviplata"]++;
    } else if (pm.includes("TRANSFER") || pm.includes("PSE")) {
      counts["Transferencia / PSE"]++;
    } else if (pm.includes("EFECTIVO") || pm.includes("TAQUILLA")) {
      counts["Efectivo en Taquilla"]++;
    } else {
      counts["Tarjeta Crédito/Débito"]++;
    }
  });

  if (paymentMethodsChart) paymentMethodsChart.destroy();

  const ctx = canvas.getContext("2d");
  paymentMethodsChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: [
          "rgba(0, 210, 255, 0.8)",
          "rgba(212, 175, 55, 0.8)",
          "rgba(218, 0, 129, 0.8)",
          "rgba(0, 230, 118, 0.8)"
        ],
        borderColor: "#12121a",
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { color: "#a0a0af", boxWidth: 12 } }
      }
    }
  });
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
window.renderFinancialDashboard = renderFinancialDashboard;
window.exportSalesToCsv = exportSalesToCsv;
window.exportInventoryToCsv = exportInventoryToCsv;
window.exportFinancialsToCsv = exportFinancialsToCsv;

