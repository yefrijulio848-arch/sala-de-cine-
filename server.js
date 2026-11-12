require("dotenv").config();
const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");

const { initDatabase } = require("./server/config/db");
const { initSeatSockets } = require("./server/sockets/seatSocket");

// Rutas
const authRoutes = require("./server/routes/authRoutes");
const movieRoutes = require("./server/routes/movieRoutes");
const functionRoutes = require("./server/routes/functionRoutes");
const seatRoutes = require("./server/routes/seatRoutes");
const orderRoutes = require("./server/routes/orderRoutes");
const adminRoutes = require("./server/routes/adminRoutes");

const app = express();
const server = http.createServer(app);

// Configuración de Socket.io
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
  }
});

// Guardar instancia de io en la app para controladores
app.set("io", io);

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend (HTML, CSS, JS, imágenes)
app.use(express.static(path.join(__dirname)));

// Iniciar eventos de Socket.io
initSeatSockets(io);

// Montaje de Endpoints API REST
app.use("/api/auth", authRoutes);
app.use("/api/movies", movieRoutes);
app.use("/api/functions", functionRoutes);
app.use("/api/seats", seatRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);

// Ruta raíz directa
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Endpoint de verificación del estado del servidor (Health Check)
app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    name: "Cine Majestad API",
    version: "2.0.0",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString()
  });
});

// Redirección o manejo 404 para la API
app.use("/api/*", (req, res) => {
  res.status(404).json({ success: false, message: "Endpoint no encontrado." });
});

// Puerto y host de ejecución (0.0.0.0 obligatorio para despliegues en la nube / contenedores)
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

async function startServer() {
  // Conexión e inicialización de la base de datos
  await initDatabase();

  server.listen(PORT, HOST, () => {
    console.log("==================================================================");
    console.log(`👑 Cine Majestad Multiplex - Servidor Activo en http://${HOST}:${PORT}`);
    console.log(`📡 Sincronización en Tiempo Real activa con Socket.io`);
    console.log(`🌐 Acceso a Cartelera: http://${HOST}:${PORT}/index.html`);
    console.log(`🔐 Inicio de Sesión & Registro: http://${HOST}:${PORT}/login.html`);
    console.log(`👔 Portal Trabajador: http://${HOST}:${PORT}/trabajador.html`);
    console.log(`👑 Panel Administrativo: http://${HOST}:${PORT}/admin.html`);
    console.log("==================================================================");
  });
}

startServer();

module.exports = { app, server, io };
