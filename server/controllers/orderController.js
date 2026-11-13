const Store = require("../models/store");

exports.createOrder = async (req, res) => {
  try {
    const {
      movieId,
      movieTitle,
      hall,
      roomId,
      showtime,
      showtimeDate,
      seats,
      snacks,
      subtotalTickets,
      subtotalSnacks,
      total,
      paymentMethod,
      customerName,
      customerEmail
    } = req.body;

    if (!movieId || !showtime || !seats || seats.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Debe incluir película, horario y al menos un asiento seleccionado."
      });
    }

    const userId = req.user ? req.user.id : null;
    const name = customerName || (req.user ? req.user.nombre : "Cliente Cine Majestad");
    const email = customerEmail || (req.user ? req.user.email : "cliente@cinemajestad.com");

    const booking = await Store.createBooking({
      userId,
      customerName: name,
      customerEmail: email,
      movieId,
      movieTitle,
      hall,
      roomId,
      showtime,
      showtimeDate,
      seats,
      snacks: snacks || [],
      subtotalTickets,
      subtotalSnacks,
      total,
      paymentMethod: paymentMethod || "Tarjeta de Crédito"
    });

    // Notificar a Socket.io si la instancia está disponible
    const io = req.app.get("io");
    if (io) {
      const showtimeKey = `${movieId}_${showtime}`;
      io.to(showtimeKey).emit("seat:booked", {
        showtimeKey,
        seats,
        bookingId: booking.id
      });
      io.emit("booking:created", booking);

      // Notificar actualización en tiempo real de inventario y analíticas
      Promise.all([Store.getSnacks(), Store.getAnalytics(), Store.getFinancialAnalytics(), Store.getSuppliers()])
        .then(([snacks, stats, financials, suppliers]) => {
          io.emit("stock:updated", { snacks });
          io.emit("analytics:updated", { stats, financials, suppliers });
        })
        .catch(err => console.warn("[Socket Sync Warning]:", err.message));
    }

    return res.status(201).json({
      success: true,
      message: "Reserva procesada exitosamente.",
      data: booking
    });
  } catch (error) {
    console.error("[Create Order Error]:", error);
    return res.status(500).json({ success: false, message: "Error al procesar la reserva." });
  }
};

exports.getBookings = async (req, res) => {
  try {
    const { userId, all } = req.query;
    // Si es un usuario cliente normal y no es trabajador/admin ni sincronización administrativa, solo sus propias reservas
    let targetUserId = userId;
    if (req.user && req.user.rol === "CLIENTE" && all !== "true" && req.headers["x-admin-sync"] !== "true") {
      targetUserId = req.user.id;
    }
    const bookings = await Store.getBookings(targetUserId);
    return res.json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al consultar reservas." });
  }
};

exports.getBookingById = (req, res) => {
  try {
    const booking = Store.getBookingById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Boleto o reserva no encontrada." });
    }
    return res.json({ success: true, data: booking });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al consultar reserva." });
  }
};

exports.updateFoodStatus = (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: "El estado de comida es requerido." });
    }

    const updated = Store.updateFoodStatus(id, status);
    if (!updated) {
      return res.status(404).json({ success: false, message: "Boleto no encontrado." });
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("food:updated", { bookingId: id, status });
    }

    return res.json({ success: true, message: `Estado de dulcería actualizado a: ${status}`, data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al actualizar estado de dulcería." });
  }
};

exports.cancelBooking = (req, res) => {
  try {
    const { id } = req.params;
    const cancelled = Store.cancelBooking(id);
    if (!cancelled) {
      return res.status(404).json({ success: false, message: "Reserva no encontrada." });
    }

    const io = req.app.get("io");
    if (io) {
      const showtimeKey = `${cancelled.movieId}_${cancelled.showtime}`;
      io.to(showtimeKey).emit("seat:released", {
        showtimeKey,
        seats: cancelled.seats,
        reason: "CANCELLATION"
      });
      io.emit("booking:cancelled", { bookingId: id });
    }

    return res.json({ success: true, message: "Reserva cancelada y butacas liberadas.", data: cancelled });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al cancelar reserva." });
  }
};

// Snacks vinculados a MySQL
exports.getSnacks = async (req, res) => {
  try {
    const snacks = await Store.getSnacks();
    return res.json({ success: true, count: snacks.length, data: snacks });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al obtener catálogo de confitería." });
  }
};

exports.createSnack = async (req, res) => {
  try {
    const snack = await Store.createSnack(req.body);
    return res.status(201).json({ success: true, message: "Producto agregado a dulcería.", data: snack });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al crear producto." });
  }
};

exports.updateSnack = async (req, res) => {
  try {
    const updated = await Store.updateSnack(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, message: "Producto no encontrado." });
    return res.json({ success: true, message: "Producto actualizado.", data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al actualizar producto." });
  }
};

exports.deleteSnack = async (req, res) => {
  try {
    const ok = await Store.deleteSnack(req.params.id);
    if (!ok) return res.status(404).json({ success: false, message: "Producto no encontrado." });
    return res.json({ success: true, message: "Producto eliminado del catálogo." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al eliminar producto." });
  }
};
