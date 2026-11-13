/* ==========================================================================
   Cine Majestad - Cliente Socket.io para Sincronización de Butacas en Tiempo Real
   ========================================================================== */

const RealTime = {
  socket: null,
  sessionId: null,
  currentShowtimeKey: null,
  isConnected: false,

  init() {
    this.sessionId = Storage.getSessionId();

    if (typeof io !== "undefined") {
      try {
        const hostname = (typeof window !== "undefined") ? window.location.hostname : "";
        const port = (typeof window !== "undefined") ? window.location.port : "";
        let socketUrl = "";

        if (port && port !== "3000") {
          socketUrl = `http://${hostname || "localhost"}:3000`;
        } else if (typeof window !== "undefined" && window.location.protocol === "file:") {
          socketUrl = "http://localhost:3000";
        }

        this.socket = io(socketUrl, {
          query: { sessionId: this.sessionId },
          transports: ["websocket", "polling"],
          reconnectionAttempts: 5
        });

        this.socket.on("connect", () => {
          this.isConnected = true;
          console.log(`[RealTime] Conectado al servidor Socket.io en ${socketUrl || 'origen'} (ID: ${this.socket.id})`);
          if (this.currentShowtimeKey) {
            this.socket.emit("join:showtime", {
              showtimeKey: this.currentShowtimeKey,
              sessionId: this.sessionId
            });
          }
        });

        this.socket.on("disconnect", () => {
          this.isConnected = false;
          console.log("[RealTime] Desconectado de Socket.io.");
        });

        this.socket.on("seats:sync", (data) => {
          if (this.onSyncCallback) this.onSyncCallback(data);
        });

        this.socket.on("seat:selecting", (data) => {
          if (this.onSeatSelectingCallback) this.onSeatSelectingCallback(data);
        });

        this.socket.on("seat:released", (data) => {
          if (this.onSeatReleasedCallback) this.onSeatReleasedCallback(data);
        });

        this.socket.on("seat:booked", (data) => {
          if (this.onSeatBookedCallback) this.onSeatBookedCallback(data);
        });

        this.socket.on("seat:error", (data) => {
          if (this.onSeatErrorCallback) this.onSeatErrorCallback(data);
        });
      } catch (err) {
        console.warn("[RealTime] No se pudo inicializar Socket.io:", err.message);
      }
    } else {
      console.info("[RealTime] Socket.io cliente no detectado en ventana. Se usará sincronización local (BroadcastChannel).");
    }
  },

  joinShowtime(showtimeKey, onSync) {
    this.currentShowtimeKey = showtimeKey;
    this.onSyncCallback = onSync;

    if (this.socket && this.socket.connected) {
      this.socket.emit("join:showtime", {
        showtimeKey,
        sessionId: this.sessionId
      });
    }
  },

  selectSeat(seatId, showtimeKey) {
    const key = showtimeKey || this.currentShowtimeKey;
    const user = (typeof Storage !== "undefined" && Storage.getAuthUser) ? Storage.getAuthUser() : null;
    const userId = user ? user.id : null;

    if (this.socket && this.socket.connected) {
      this.socket.emit("seat:selecting", {
        showtimeKey: key,
        seatId,
        sessionId: this.sessionId,
        userId
      });
    } else if (typeof Storage !== "undefined") {
      if (typeof Storage.holdSeat === "function") {
        Storage.holdSeat(key, seatId, this.sessionId);
      } else if (typeof Storage.lockSeat === "function") {
        Storage.lockSeat(key, seatId, this.sessionId);
      }
    }
  },

  releaseSeat(seatId, showtimeKey) {
    const key = showtimeKey || this.currentShowtimeKey;

    if (this.socket && this.socket.connected) {
      this.socket.emit("seat:released", {
        showtimeKey: key,
        seatId,
        sessionId: this.sessionId
      });
    } else if (typeof Storage !== "undefined") {
      if (typeof Storage.releaseSeat === "function") {
        Storage.releaseSeat(key, seatId, this.sessionId);
      } else if (typeof Storage.unlockSeat === "function") {
        Storage.unlockSeat(key, seatId, this.sessionId);
      }
    }
  },

  onSeatSelecting(callback) {
    this.onSeatSelectingCallback = callback;
  },

  onSeatReleased(callback) {
    this.onSeatReleasedCallback = callback;
  },

  onSeatBooked(callback) {
    this.onSeatBookedCallback = callback;
  },

  onSeatError(callback) {
    this.onSeatErrorCallback = callback;
  }
};

window.RealTime = RealTime;
