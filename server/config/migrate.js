const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
require("dotenv").config();

async function runMigration() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "root",
    database: process.env.DB_NAME || "cine_majestad_db"
  });

  console.log("[Migration] Conectado a MySQL cine_majestad_db");

  // 1. Roles
  const [existingRoles] = await conn.query("SELECT COUNT(*) as cnt FROM roles");
  if (existingRoles[0].cnt === 0) {
    console.log("[Migration] Insertando roles...");
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
    console.log("[Migration] 5 roles insertados con éxito.");
  }

  // 2. Columna rol_id en usuarios
  const [cols] = await conn.query("SHOW COLUMNS FROM usuarios LIKE 'rol_id'");
  if (cols.length === 0) {
    console.log("[Migration] Modificando tabla usuarios...");
    await conn.query("ALTER TABLE usuarios MODIFY COLUMN rol VARCHAR(30) NOT NULL DEFAULT 'CLIENTE'");
    await conn.query("ALTER TABLE usuarios ADD COLUMN rol_id INT NOT NULL DEFAULT 5 AFTER id");
    await conn.query("UPDATE usuarios SET rol_id = 1 WHERE rol = 'ADMIN'");
    await conn.query("UPDATE usuarios SET rol_id = 2 WHERE rol = 'TAQUILLERO'");
    await conn.query("UPDATE usuarios SET rol_id = 5 WHERE rol = 'CLIENTE'");
    try {
      await conn.query("ALTER TABLE usuarios ADD CONSTRAINT fk_usuarios_roles FOREIGN KEY (rol_id) REFERENCES roles(id) ON UPDATE CASCADE ON DELETE RESTRICT");
    } catch (e) {
      console.warn("[Migration] Nota FK:", e.message);
    }
    console.log("[Migration] Tabla usuarios actualizada con rol_id.");
  }

  // 3. Hashes reales para usuarios de demo
  const hash = await bcrypt.hash("123456", 10);
  await conn.query("UPDATE usuarios SET password_hash = ? WHERE email IN ('admin@cinemajestad.com', 'yeffry@cinemajestad.com')", [hash]);

  // 4. Asegurar usuarios iniciales para demo
  const [taq] = await conn.query("SELECT id FROM usuarios WHERE email = 'taquilla@cinemajestad.com'");
  if (taq.length === 0) {
    await conn.query(
      "INSERT INTO usuarios (rol_id, nombre, apellido, email, password_hash, telefono, rol, activo) VALUES (2, 'María', 'Rodríguez', 'taquilla@cinemajestad.com', ?, '+57 311 234 5678', 'TAQUILLERO', 1)",
      [hash]
    );
  }

  const [ger] = await conn.query("SELECT id FROM usuarios WHERE email = 'gerencia@cinemajestad.com'");
  if (ger.length === 0) {
    await conn.query(
      "INSERT INTO usuarios (rol_id, nombre, apellido, email, password_hash, telefono, rol, activo) VALUES (4, 'Carlos', 'Gerencia', 'gerencia@cinemajestad.com', ?, '+57 315 444 7788', 'GERENTE', 1)",
      [hash]
    );
  }

  const [cnd] = await conn.query("SELECT id FROM usuarios WHERE email = 'candybar@cinemajestad.com'");
  if (cnd.length === 0) {
    await conn.query(
      "INSERT INTO usuarios (rol_id, nombre, apellido, email, password_hash, telefono, rol, activo) VALUES (3, 'Sofía', 'Dulcería', 'candybar@cinemajestad.com', ?, '+57 318 666 9900', 'CONFITERIA', 1)",
      [hash]
    );
  }

  const [crl] = await conn.query("SELECT id FROM usuarios WHERE email = 'carlos@cliente.com'");
  if (crl.length === 0) {
    await conn.query(
      "INSERT INTO usuarios (rol_id, nombre, apellido, email, password_hash, telefono, rol, activo) VALUES (5, 'Carlos', 'Gómez', 'carlos@cliente.com', ?, '+57 300 123 4567', 'CLIENTE', 1)",
      [hash]
    );
  }

  const [users] = await conn.query("SELECT id, rol_id, nombre, apellido, email, rol, activo FROM usuarios");
  console.log("[Migration] Usuarios actuales en BD:", users);

  await conn.end();
}

runMigration().catch(console.error);
