/* ==========================================================================
   Cine Majestad - Generador de Boletos Oficiales en Formato PDF
   Uso de jsPDF con diseño cinematográfico de alta resolución
   ========================================================================== */

function ensureJsPdfLoaded() {
  return new Promise((resolve, reject) => {
    if (window.jspdf && window.jspdf.jsPDF) {
      return resolve(window.jspdf.jsPDF);
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.onload = () => resolve(window.jspdf.jsPDF);
    script.onerror = () => reject(new Error("No se pudo cargar jsPDF desde la CDN."));
    document.head.appendChild(script);
  });
}

async function downloadBookingPdf(bookingId) {
  try {
    let booking = null;
    // Buscar en Storage o API
    if (typeof API !== "undefined") {
      try {
        const res = await API.orders.getById(bookingId);
        booking = res.data;
      } catch (e) {
        // Fallback local
      }
    }

    if (!booking) {
      booking = Storage.getBookingById(bookingId);
    }

    if (!booking) {
      showToast("No se encontró la información del boleto.", "error");
      return;
    }

    showToast("Generando boleto oficial en PDF...", "info");

    const jsPDF = await ensureJsPdfLoaded();
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [100, 180] // Formato ticket de cine térmico elegante
    });

    // Colores de Cine Majestad
    const primaryColor = [18, 18, 26]; // #12121a
    const goldColor = [212, 175, 55];    // #d4af37
    const textColor = [255, 255, 255];
    const secondaryText = [160, 160, 175];

    // Fondo del Boleto
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 100, 180, "F");

    // Borde Dorado Superior
    doc.setFillColor(...goldColor);
    doc.rect(0, 0, 100, 4, "F");

    // Cabecera / Marca
    doc.setTextColor(...goldColor);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("CINE MAJESTAD", 50, 14, { align: "center" });

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...secondaryText);
    doc.text("MULTIPLEX & ROYAL CINEMA", 50, 18, { align: "center" });

    // Código de Reserva
    doc.setFontSize(9);
    doc.setTextColor(...goldColor);
    doc.setFont("helvetica", "bold");
    doc.text(`RESERVA: ${booking.id}`, 50, 26, { align: "center" });

    // Línea divisoria
    doc.setDrawColor(...goldColor);
    doc.setLineWidth(0.3);
    doc.line(10, 30, 90, 30);

    // Título de la Película
    doc.setFontSize(13);
    doc.setTextColor(...textColor);
    doc.setFont("helvetica", "bold");
    const titleLines = doc.splitTextToSize(booking.movieTitle || "Película", 80);
    doc.text(titleLines, 50, 37, { align: "center" });

    let currentY = 37 + (titleLines.length * 5) + 3;

    // Metadatos de la Función
    doc.setFontSize(8);
    doc.setTextColor(...secondaryText);
    doc.text("SALA:", 12, currentY);
    doc.setTextColor(...textColor);
    doc.text(booking.hall || "Sala 1", 35, currentY);

    currentY += 6;
    doc.setTextColor(...secondaryText);
    doc.text("HORARIO:", 12, currentY);
    doc.setTextColor(...textColor);
    doc.text(`${booking.showtime} (${booking.showtimeDate || 'Hoy'})`, 35, currentY);

    currentY += 6;
    doc.setTextColor(...secondaryText);
    doc.text("CLIENTE:", 12, currentY);
    doc.setTextColor(...textColor);
    doc.text(booking.customerName || "Cliente", 35, currentY);

    currentY += 8;
    // Caja destacada de Asientos
    doc.setFillColor(25, 25, 38);
    doc.roundedRect(10, currentY, 80, 16, 2, 2, "F");

    doc.setFontSize(8);
    doc.setTextColor(...secondaryText);
    doc.text("BUTACAS RESERVADAS", 50, currentY + 5, { align: "center" });

    doc.setFontSize(12);
    doc.setTextColor(...goldColor);
    doc.setFont("helvetica", "bold");
    doc.text((booking.seats || []).join("  •  "), 50, currentY + 12, { align: "center" });

    currentY += 22;

    // Snacks si existen
    if (booking.snacks && booking.snacks.length > 0) {
      doc.setFontSize(8);
      doc.setTextColor(...goldColor);
      doc.text("CONFITERÍA Y DULCERÍA:", 12, currentY);
      currentY += 5;

      booking.snacks.forEach(s => {
        doc.setFontSize(7.5);
        doc.setTextColor(...textColor);
        doc.text(`• ${s.qty || s.quantity}x ${s.name}`, 14, currentY);
        doc.text(`$${((s.price || 0) * (s.qty || s.quantity)).toFixed(2)}`, 88, currentY, { align: "right" });
        currentY += 4;
      });
      currentY += 2;
    }

    // Desglose Financiero
    doc.setDrawColor(50, 50, 70);
    doc.line(10, currentY, 90, currentY);
    currentY += 5;

    doc.setFontSize(8);
    doc.setTextColor(...secondaryText);
    doc.text("MÉTODO DE PAGO:", 12, currentY);
    doc.setTextColor(...textColor);
    doc.text(booking.paymentMethod || "Tarjeta", 88, currentY, { align: "right" });

    currentY += 6;
    doc.setFontSize(10);
    doc.setTextColor(...goldColor);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL PAGADO:", 12, currentY);
    doc.text(`$${(booking.total || 0).toFixed(2)}`, 88, currentY, { align: "right" });

    currentY += 8;
    // Código QR Simulado Vectorial en PDF
    doc.setFillColor(255, 255, 255);
    doc.rect(37, currentY, 26, 26, "F");

    doc.setFillColor(0, 0, 0);
    // Cuadrantes QR
    doc.rect(39, currentY + 2, 7, 7, "F");
    doc.rect(54, currentY + 2, 7, 7, "F");
    doc.rect(39, currentY + 17, 7, 7, "F");
    doc.rect(48, currentY + 11, 4, 4, "F");
    doc.rect(53, currentY + 15, 5, 5, "F");

    currentY += 30;
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...secondaryText);
    doc.text("Presenta este boleto digital o impreso en la entrada a sala.", 50, currentY, { align: "center" });
    doc.text("¡Gracias por disfrutar de Cine Majestad Multiplex!", 50, currentY + 3.5, { align: "center" });

    // Descargar archivo PDF
    doc.save(`Boleto_CineMajestad_${booking.id}.pdf`);
    showToast("¡Boleto en PDF descargado exitosamente!", "success");
  } catch (err) {
    console.error("[PDF Export Error]:", err);
    showToast("Error al exportar el PDF. Utilizando impresión del navegador...", "error");
    window.print();
  }
}

window.downloadBookingPdf = downloadBookingPdf;
