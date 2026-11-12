const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

let pool = null;
let isConnected = false;

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "cine_majestad_db",
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  multipleStatements: true
};

async function ensureDatabaseReady(conn) {
  try {
    // 1. Verificar si existen las tablas del sistema
    const [tables] = await conn.query("SHOW TABLES LIKE 'roles'");
    if (!tables || tables.length === 0) {
      console.log("[DB] No se detectaron tablas en la base de datos. Auto-ejecutando script oficial de Cine Majestad...");
      const sqlPath = path.join(__dirname, "../../database/cine_majestad_db.sql");
      if (fs.existsSync(sqlPath)) {
        let sql = fs.readFileSync(sqlPath, "utf-8");
        // Remover directivas de CREATE DATABASE y USE para compatibilidad con bases de datos en la nube (Railway/Render/CleverCloud)
        sql = sql
          .replace(/CREATE DATABASE[\s\S]*?;/gi, "")
          .replace(/USE\s+[\w`]+;/gi, "");
        await conn.query(sql);
        console.log("[DB] ¡Tablas, vistas y datos iniciales de Cine Majestad creados con éxito en MySQL!");
        return;
      }
    }

    // 2. Si las tablas existen, verificar que los roles base estén presentes
    const [rolesCount] = await conn.query("SELECT COUNT(*) as cnt FROM roles");
    if (rolesCount[0].cnt === 0) {
      const roles = [
        [1, "Administrador General", "ADMIN", "Control total y absoluto del multiplex, salas, finanzas, inventario, usuarios y configuración global.", 100, JSON.stringify(["dashboard:view", "movies:create", "movies:edit", "movies:delete", "shows:manage", "rooms:manage", "candybar:manage", "suppliers:manage", "orders:view", "orders:cancel", "reports:financial", "users:manage", "settings:edit", "boxoffice:sell"]), 1, 1, 1, 1, 1, 1, 1],
        [2, "Taquillero / Boletería", "TAQUILLERO", "Venta y emisión de boletos en mostrador físico, consulta de funciones y butacas en tiempo real.", 20, JSON.stringify(["dashboard:view", "shows:view", "boxoffice:sell", "orders:create", "seats:lock", "candybar:sell"]), 1, 1, 0, 0, 0, 0, 1],
        [3, "Operador de Confitería / Dulcería", "CONFITERIA", "Atención en CandyBar, despacho de combos, control de stock de bodega y registro de ventas de dulcería.", 15, JSON.stringify(["candybar:view", "candybar:sell", "inventory:view", "inventory:adjust"]), 0, 1, 0, 0, 0, 0, 1],
        [4, "Gerente de Operaciones y Sucursal", "GERENTE", "Supervisión operativa diaria, monitoreo de recaudación, gestión de proveedores, compras y cartelera.", 70, JSON.stringify(["dashboard:view", "movies:create", "movies:edit", "shows:manage", "candybar:manage", "suppliers:manage", "inventory:manage", "reports:financial", "orders:view"]), 1, 1, 1, 0, 1, 1, 1],
        [5, "Cliente / Espectador Registrado", "CLIENTE", "Usuario final para reserva de entradas y combos en línea, acumulación de fidelidad e historial personal.", 1, JSON.stringify(["catalog:view", "booking:create", "profile:manage", "orders:history"]), 0, 0, 0, 0, 0, 0, 1]
      ];
      for (const r of roles) {
        await conn.query(
          "INSERT INTO roles (id, nombre, slug, descripcion, nivel_jerarquia, permisos, puede_vender_boletos, puede_vender_snacks, puede_gestionar_peliculas, puede_gestionar_usuarios, puede_ver_metricas_financieras, puede_gestionar_proveedores, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          r
        );
      }
      console.log("[DB] Roles base inicializados correctamente.");
    }
  } catch (err) {
    console.warn("[DB AutoCheck Warning]:", err.message);
  }
}

async function initDatabase() {
  try {
    const connectionUri = process.env.MYSQL_URL || process.env.DATABASE_URL;
    if (connectionUri) {
      console.log("[DB] Detectada URL de conexión en la nube (MYSQL_URL / DATABASE_URL).");
      pool = mysql.createPool({
        uri: connectionUri,
        multipleStatements: true,
        waitForConnections: true,
        connectionLimit: 15,
        enableKeepAlive: true,
        ssl: (process.env.DB_SSL === "true" || process.env.DB_SSL === "1") ? { rejectUnauthorized: false } : undefined
      });
    } else {
      const config = { ...dbConfig };
      if (process.env.DB_SSL === "true" || process.env.DB_SSL === "1") {
        config.ssl = { rejectUnauthorized: false };
      }
      pool = mysql.createPool(config);
    }

    const conn = await pool.getConnection();
    await conn.ping();
    await ensureDatabaseReady(conn);
    conn.release();
    isConnected = true;
    console.log(`[DB] Conectado exitosamente a MySQL (${dbConfig.database} en ${dbConfig.host}:${dbConfig.port})`);
    return true;
  } catch (err) {
    isConnected = false;
    console.warn(`[DB] Advertencia: No se pudo conectar a MySQL (${err.code || err.message}).`);
    console.info(`[DB] Activando modo híbrido / almacenamiento resiliente en memoria.`);
    return false;
  }
}

function getPool() {
  return pool;
}

function isDbConnected() {
  return isConnected;
}

// Wrapper para ejecutar queries de forma segura con fallback
async function query(sql, params = []) {
  if (isConnected && pool) {
    try {
      const [rows] = await pool.query(sql, params);
      return rows;
    } catch (err) {
      console.error("[DB Query Error]:", err.message);
      throw err;
    }
  }
  return null;
}

module.exports = {
  initDatabase,
  getPool,
  isDbConnected,
  query,
  dbConfig
};
