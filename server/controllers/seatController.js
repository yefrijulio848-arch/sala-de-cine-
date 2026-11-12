const Store = require("../models/store");

exports.getSeatsStatus = (req, res) => {
  try {
    const { showtimeKey } = req.params;
    if (!showtimeKey) {
      return res.status(400).json({ success: false, message: "showtimeKey es requerido." });
    }
    const status = Store.getSeatStatusMap(showtimeKey);
    return res.json({ success: true, data: status });
  } catch (error) {
    console.error("[Seats Status Error]:", error);
    return res.status(500).json({ success: false, message: "Error al obtener estado de asientos." });
  }
};

exports.holdSeat = (req, res) => {
  try {
    const { showtimeKey, seatId, sessionId } = req.body;
    if (!showtimeKey || !seatId || !sessionId) {
      return res.status(400).json({
        success: false,
        message: "showtimeKey, seatId y sessionId son requeridos."
      });
    }

    const userId = req.user ? req.user.id : null;
    const result = Store.holdSeat(showtimeKey, seatId, sessionId, userId);

    if (!result.success) {
      return res.status(409).json(result);
    }

    return res.json({ success: true, message: "Butaca bloqueada temporalmente.", data: result.hold });
  } catch (error) {
    console.error("[Hold Seat Error]:", error);
    return res.status(500).json({ success: false, message: "Error al bloquear butaca." });
  }
};

exports.releaseSeat = (req, res) => {
  try {
    const { showtimeKey, seatId, sessionId } = req.body;
    if (!showtimeKey || !seatId || !sessionId) {
      return res.status(400).json({
        success: false,
        message: "showtimeKey, seatId y sessionId son requeridos."
      });
    }

    const result = Store.releaseSeat(showtimeKey, seatId, sessionId);
    return res.json({ success: result.success, message: result.success ? "Butaca liberada." : "No se encontró el bloqueo." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al liberar butaca." });
  }
};
