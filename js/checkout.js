/* ==========================================================================
   Cine Majestad - Checkout, Boleto Digital & Confirmación de Venta
   ========================================================================== */

let activeBookingId = "";

document.addEventListener("DOMContentLoaded", () => {
  renderDigitalTicket();
});

function renderDigitalTicket() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramBookingId = urlParams.get("booking") || urlParams.get("bookingId") || urlParams.get("id");

  let booking = null;

  // 1. Si viene con ID de reserva en la URL (flujo normal tras pasarela de pagos)
  if (paramBookingId) {
    booking = Storage.getBookingById(paramBookingId);
    if (!booking) {
      // Buscar en listado de completadas
      const all = Storage.getBookings();
      booking = all.find(b => b.id === paramBookingId || b.bookingCode === paramBookingId);
    }
  }

  // 2. Si no viene en URL pero hay una orden en sesión
  if (!booking) {
    const user = Storage.getAuthUser();
    const order = Storage.getCurrentOrder();
    const sessionId = Storage.getSessionId();

    if (!user && order && order.seats && order.seats.length > 0) {
      window.location.href = "login.html?returnTo=checkout.html&tab=register";
      return;
    }

    if (!order || !order.movieTitle || (!order.seats || order.seats.length === 0)) {
      // Mostrar la última reserva confirmada si existe
      const latestBookings = Storage.getBookings();
      if (latestBookings.length > 0) {
        booking = latestBookings[0];
      } else {
        renderNoActiveReservation();
        return;
      }
    } else {
      // Confirmar orden pendiente
      const bookingCode = "CMG-" + Math.floor(100000 + Math.random() * 900000);
      const user = Storage.getAuthUser();
      const seatsArr = order.seats.map(s => s.code || s);
      const snacksArr = order.snacks || [];
      const showtimeKey = `${order.movieId}_${order.showtime}`;
      const grandTotal = order.total || order.grandTotal || (order.ticketsTotal || 0);

      booking = {
        id: bookingCode,
        bookingCode: bookingCode,
        movieTitle: order.movieTitle,
        hall: order.hall,
        showtime: order.showtime,
        showtimeDate: "Hoy",
        seats: seatsArr,
        snacks: snacksArr,
        total: grandTotal,
        paymentMethod: "Tarjeta de Crédito",
        paymentStatus: "APROBADO",
        customerName: user ? user.nombre : "Cliente Cine Majestad",
        customerEmail: user ? user.email : "cliente@cinemajestad.com"
      };

      Storage.saveBooking(booking);
      Storage.releaseAllLocksForSession(sessionId, showtimeKey);
      Storage.clearCurrentOrder();
    }
  }

  // Desplegar datos en el boleto
  activeBookingId = booking.id || booking.bookingCode || "CMG-748921";
  const seatsList = (booking.seats || []).map(s => s.code || s).join(", ");
  const snacksCount = (booking.snacks || []).reduce((acc, s) => acc + (s.qty || s.quantity || 1), 0);
  const paidTotal = typeof booking.grandTotal === "number" ? booking.grandTotal : (typeof booking.total === "number" ? booking.total : (parseFloat(booking.total_pagado) || 0));

  document.querySelector("#ticketMovieTitle").textContent = booking.movieTitle;
  document.querySelector("#ticketHall").textContent = booking.hall;
  document.querySelector("#ticketShowtime").textContent = `${booking.showtime} (${booking.showtimeDate || 'Hoy'})`;
  document.querySelector("#ticketSeats").textContent = seatsList || "Asientos Asignados";
  document.querySelector("#ticketTotalPaid").textContent = `$${paidTotal.toFixed(2)}`;
  document.querySelector("#ticketBookingCode").textContent = activeBookingId;

  const snacksRow = document.querySelector("#ticketSnacksRow");
  if (snacksRow) {
    if (snacksCount > 0) {
      snacksRow.innerHTML = `<label>Dulcería Majestad</label><span>${snacksCount} productos listos para retirar en barra</span>`;
      snacksRow.style.display = "block";
    } else {
      snacksRow.style.display = "none";
    }
  }
}

function renderNoActiveReservation() {
  const container = document.querySelector("#checkoutContent");
  if (container) {
    container.innerHTML = `
      <div style="text-align: center; padding: 4rem 1rem;">
        <span style="font-size: 3rem;">🎟️</span>
        <h2 style="margin-top: 1rem;">No tienes una reserva activa</h2>
        <p style="color: var(--text-secondary); margin: 1rem 0 2rem;">Selecciona una película y tus butacas para generar tu entrada en Cine Majestad.</p>
        <a href="index.html" class="btn btn-primary">Ir a la Cartelera</a>
      </div>
    `;
  }
}

function handleDownloadCurrentPdf() {
  if (!activeBookingId) {
    showToast("No hay un boleto activo para descargar.", "error");
    return;
  }
  downloadBookingPdf(activeBookingId);
}

window.handleDownloadCurrentPdf = handleDownloadCurrentPdf;
