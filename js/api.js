/* ==========================================================================
   Cine Majestad - Cliente API HTTP Centralizado
   Manejo de peticiones REST con autenticación Bearer JWT y fallback reactivo
   ========================================================================== */

const API = {
  baseUrl: (function () {
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      const port = window.location.port;

      // Si está en Live Server local de desarrollo (puertos 5500, 5501, 8080, etc. y no es el backend 3000)
      if ((hostname === "localhost" || hostname === "127.0.0.1") && port && port !== "3000") {
        return `http://${hostname}:3000`;
      }

      // Si se abrió directamente como archivo local (file://)
      if (window.location.protocol === "file:") {
        return "http://localhost:3000";
      }

      // En producción desplegada (Render, Railway, VPS, dominio propio) o backend Express local:
      // Peticiones relativas al mismo origen
      return "";
    }
    return "";
  })(),

  getToken() {
    return localStorage.getItem("cinemajestad_token") || null;
  },

  setToken(token) {
    if (token) {
      localStorage.setItem("cinemajestad_token", token);
    } else {
      localStorage.removeItem("cinemajestad_token");
    }
  },

  getHeaders() {
    const headers = {
      "Content-Type": "application/json"
    };
    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  },

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...(options.headers || {})
      }
    };

    if (config.body && typeof config.body === "object") {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const text = await response.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (jsonErr) {
        throw new Error(
          `No se pudo conectar al backend en ${url}. Por favor asegúrate de tener el servidor activo con 'node server.js'.`
        );
      }

      if (!response.ok) {
        throw new Error(data.message || `Error HTTP: ${response.status}`);
      }

      return data;
    } catch (err) {
      console.warn(`[API] Fallo en ${endpoint}:`, err.message);
      throw err;
    }
  },

  // Métodos auxiliares
  get(endpoint) {
    return this.request(endpoint, { method: "GET" });
  },

  post(endpoint, body) {
    return this.request(endpoint, { method: "POST", body });
  },

  put(endpoint, body) {
    return this.request(endpoint, { method: "PUT", body });
  },

  patch(endpoint, body) {
    return this.request(endpoint, { method: "PATCH", body });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  },

  // Servicios específicos
  auth: {
    login: (credentials) => API.post("/api/auth/login", credentials),
    register: (userData) => API.post("/api/auth/register", userData),
    getProfile: () => API.get("/api/auth/me")
  },

  movies: {
    getAll: () => API.get("/api/movies"),
    getById: (id) => API.get(`/api/movies/${id}`),
    create: (data) => API.post("/api/movies", data),
    update: (id, data) => API.put(`/api/movies/${id}`, data),
    delete: (id) => API.delete(`/api/movies/${id}`)
  },

  functions: {
    getAll: () => API.get("/api/functions"),
    getRooms: () => API.get("/api/functions/rooms")
  },

  seats: {
    getStatus: (showtimeKey) => API.get(`/api/seats/${showtimeKey}`),
    hold: (data) => API.post("/api/seats/hold", data),
    release: (data) => API.post("/api/seats/release", data)
  },

  orders: {
    create: (orderData) => API.post("/api/orders", orderData),
    getAll: (userId) => API.get(userId ? `/api/orders?userId=${userId}` : "/api/orders"),
    getById: (id) => API.get(`/api/orders/${id}`),
    updateFoodStatus: (id, status) => API.patch(`/api/orders/${id}/food-status`, { status }),
    cancel: (id) => API.delete(`/api/orders/${id}`),
    getSnacks: () => API.get("/api/orders/snacks/all"),
    createSnack: (data) => API.post("/api/orders/snacks", data),
    updateSnack: (id, data) => API.put(`/api/orders/snacks/${id}`, data),
    deleteSnack: (id) => API.delete(`/api/orders/snacks/${id}`)
  },

  admin: {
    getStats: () => API.get("/api/admin/stats"),
    getFinancials: () => API.get("/api/admin/financials"),
    getSettings: () => API.get("/api/admin/settings"),
    updateSettings: (data) => API.put("/api/admin/settings", data)
  },

  suppliers: {
    getAll: () => API.get("/api/admin/suppliers"),
    create: (data) => API.post("/api/admin/suppliers", data),
    update: (id, data) => API.put(`/api/admin/suppliers/${id}`, data),
    delete: (id) => API.delete(`/api/admin/suppliers/${id}`)
  },

  roles: {
    getAll: () => API.get("/api/admin/roles")
  },

  users: {
    getAll: () => API.get("/api/admin/users"),
    create: (data) => API.post("/api/admin/users", data),
    updateRole: (userId, rol_id) => API.put(`/api/admin/users/${userId}/role`, { rol_id }),
    delete: (userId) => API.delete(`/api/admin/users/${userId}`)
  }
};

window.API = API;
