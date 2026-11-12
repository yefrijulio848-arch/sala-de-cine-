const Store = require("../models/store");

function initSeatSockets(io) {
  io.on("connection", (socket) => {
    let currentShowtimeKey = null;
    let clientSessionId = socket.handshake.query.sessionId || socket.id;

    console.log(`[Socket.io] Cliente conectado: ${socket.id} (Sesión: ${clientSessionId})`);

    // 1. Unirse a la sala de una función en vivo
    socket.on("join:showtime", ({ showtimeKey, sessionId }) => {
      if (!showtimeKey) return;
      if (sessionId) clientSessionId = sessionId;

      // Abandonar sala previa si existía
      if (currentShowtimeKey && currentShowtimeKey !== showtimeKey) {
        socket.leave(currentShowtimeKey);
      }

      currentShowtimeKey = showtimeKey;
      socket.join(showtimeKey);

      // Enviar de inmediato el mapa actualizado de asientos para esta sala
      const seatStatus = Store.getSeatStatusMap(showtimeKey);
      socket.emit("seats:sync", seatStatus);
      console.log(`[Socket.io] ${socket.id} se unió a la sala: ${showtimeKey}`);
    });

    // 2. Selección / Bloqueo temporal de una butaca
    socket.on("seat:selecting", ({ showtimeKey, seatId, sessionId, userId }) => {
      const activeSession = sessionId || clientSessionId;
      const key = showtimeKey || currentShowtimeKey;
      if (!key || !seatId) return;

      const result = Store.holdSeat(key, seatId, activeSession, userId);
      if (result.success) {
        // Notificar a todos los demás clientes en la misma sala
        socket.to(key).emit("seat:selecting", {
          showtimeKey: key,
          seatId,
          sessionId: activeSession,
          expiresAt: result.hold.expiresAt,
          remainingSeconds: result.hold.remainingSeconds
        });

        // Confirmar al emisor
        socket.emit("seat:hold-confirmed", {
          showtimeKey: key,
          seatId,
          expiresAt: result.hold.expiresAt
        });
      } else {
        // Enviar error al emisor si otro usuario ya la tomó
        socket.emit("seat:error", {
          seatId,
          reason: result.reason,
          message: result.message
        });
      }
    });

    // 3. Liberación manual o deselección de una butaca
    socket.on("seat:released", ({ showtimeKey, seatId, sessionId }) => {
      const activeSession = sessionId || clientSessionId;
      const key = showtimeKey || currentShowtimeKey;
      if (!key || !seatId) return;

      const result = Store.releaseSeat(key, seatId, activeSession);
      if (result.success) {
        socket.to(key).emit("seat:released", {
          showtimeKey: key,
          seatId
        });
        socket.emit("seat:release-confirmed", {
          showtimeKey: key,
          seatId
        });
      }
    });

    // 4. Desconexión: Limpiar asientos en selección de esta sesión si correspondía
    socket.on("disconnect", () => {
      console.log(`[Socket.io] Cliente desconectado: ${socket.id}`);
      if (currentShowtimeKey && clientSessionId) {
        const released = Store.releaseAllSessionSeats(clientSessionId, currentShowtimeKey);
        if (released.length > 0) {
          released.forEach(item => {
            socket.to(item.showtimeKey).emit("seat:released", {
              showtimeKey: item.showtimeKey,
              seatId: item.seatId,
              reason: "DISCONNECT"
            });
          });
        }
      }
    });
  });
}

module.exports = { initSeatSockets };
