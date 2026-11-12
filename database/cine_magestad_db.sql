
CREATE DATABASE IF NOT EXISTS cine_majestad_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE cine_majestad_db;

-- Desactivar temporalmente revisión de claves foráneas para recreación limpia
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS bloqueos_temporales_asientos;
DROP TABLE IF EXISTS reserva_snacks;
DROP TABLE IF EXISTS reserva_asientos;
DROP TABLE IF EXISTS reservas;
DROP TABLE IF EXISTS productos_snack;
DROP TABLE IF EXISTS proveedores;
DROP TABLE IF EXISTS categorias_snack;
DROP TABLE IF EXISTS asientos;
DROP TABLE IF EXISTS funciones;
DROP TABLE IF EXISTS salas;
DROP TABLE IF EXISTS pelicula_formatos;
DROP TABLE IF EXISTS pelicula_generos;
DROP TABLE IF EXISTS formatos;
DROP TABLE IF EXISTS generos;
DROP TABLE IF EXISTS peliculas;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS configuracion_cine;

SET FOREIGN_KEY_CHECKS = 1;


CREATE TABLE configuracion_cine (
    id INT PRIMARY KEY DEFAULT 1,
    nombre_cine VARCHAR(100) NOT NULL DEFAULT 'Cine Majestad',
    slogan VARCHAR(200) NOT NULL DEFAULT 'La Majestad del Séptimo Arte',
    telefono VARCHAR(50) NULL,
    direccion VARCHAR(255) NULL,
    horarios_operacion VARCHAR(150) NULL,
    minutos_bloqueo_asiento INT NOT NULL DEFAULT 5,
    max_boletos_por_transaccion INT NOT NULL DEFAULT 8,
    moneda VARCHAR(10) NOT NULL DEFAULT '$',
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;


CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(60) NOT NULL UNIQUE,                    -- 'Administrador General', 'Taquillero', 'Cliente'
    slug VARCHAR(30) NOT NULL UNIQUE,                      -- 'ADMIN', 'TAQUILLERO', 'CLIENTE', 'GERENTE', 'CONFITERIA'
    descripcion VARCHAR(255) NULL,                         -- Descripción de funciones y responsabilidades
    nivel_jerarquia INT NOT NULL DEFAULT 1,                -- 1: Cliente, 15: Confitería, 20: Taquillero, 70: Gerente, 100: SuperAdmin
    permisos JSON NULL,                                    -- Matriz JSON de permisos y capacidades
    puede_vender_boletos BOOLEAN NOT NULL DEFAULT FALSE,   -- Permiso para emisión en taquilla física
    puede_vender_snacks BOOLEAN NOT NULL DEFAULT FALSE,    -- Permiso para caja de dulcería
    puede_gestionar_peliculas BOOLEAN NOT NULL DEFAULT FALSE, -- Gestión de cartelera, salas y funciones
    puede_gestionar_usuarios BOOLEAN NOT NULL DEFAULT FALSE,  -- Crear/editar usuarios y roles
    puede_ver_metricas_financieras BOOLEAN NOT NULL DEFAULT FALSE, -- Reportes financieros y balances
    puede_gestionar_proveedores BOOLEAN NOT NULL DEFAULT FALSE,    -- Alta y control de proveedores
    activo BOOLEAN NOT NULL DEFAULT TRUE,                  -- Estado del rol
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_rol_slug (slug),
    INDEX idx_rol_jerarquia (nivel_jerarquia)
) ENGINE=InnoDB;


CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rol_id INT NOT NULL DEFAULT 5,                         -- Clave foránea referenciando roles(id) (Default 5: CLIENTE)
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    telefono VARCHAR(25) NULL,
    rol VARCHAR(30) NOT NULL DEFAULT 'CLIENTE',            -- Código de rol (sincronizado con roles.slug para compatibilidad)
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuarios_roles FOREIGN KEY (rol_id) REFERENCES roles(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_usuario_rol (rol_id),
    INDEX idx_usuario_slug (rol),
    INDEX idx_usuario_email (email)
) ENGINE=InnoDB;


CREATE TABLE generos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE formatos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(30) NOT NULL UNIQUE, -- '2D', '3D', 'IMAX', 'Atmos', '70mm'
    descripcion VARCHAR(200) NULL
) ENGINE=InnoDB;

CREATE TABLE peliculas (
    id VARCHAR(30) PRIMARY KEY, -- 'mov-01', 'mov-02'
    titulo VARCHAR(200) NOT NULL,
    sinopsis TEXT NOT NULL,
    director VARCHAR(120) NOT NULL,
    duracion_min INT NOT NULL,
    clasificacion_edad ENUM('AA', 'A', 'B', 'B-15', 'C', 'D') NOT NULL DEFAULT 'B',
    rating DECIMAL(3,1) DEFAULT 0.0,
    poster_url VARCHAR(500) NOT NULL,
    backdrop_url VARCHAR(500) NULL,
    trailer_url VARCHAR(500) NULL,
    precio_estandar_base DECIMAL(8,2) NOT NULL DEFAULT 6.50,
    precio_vip_base DECIMAL(8,2) NOT NULL DEFAULT 10.00,
    es_destacada BOOLEAN DEFAULT FALSE,
    estado ENUM('EN_CARTELERA', 'PROXIMAMENTE', 'ARCHIVADA') DEFAULT 'EN_CARTELERA',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_pelicula_estado (estado),
    INDEX idx_pelicula_destacada (es_destacada)
) ENGINE=InnoDB;

CREATE TABLE pelicula_generos (
    pelicula_id VARCHAR(30) NOT NULL,
    genero_id INT NOT NULL,
    PRIMARY KEY (pelicula_id, genero_id),
    FOREIGN KEY (pelicula_id) REFERENCES peliculas(id) ON DELETE CASCADE,
    FOREIGN KEY (genero_id) REFERENCES generos(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE pelicula_formatos (
    pelicula_id VARCHAR(30) NOT NULL,
    formato_id INT NOT NULL,
    PRIMARY KEY (pelicula_id, formato_id),
    FOREIGN KEY (pelicula_id) REFERENCES peliculas(id) ON DELETE CASCADE,
    FOREIGN KEY (formato_id) REFERENCES formatos(id) ON DELETE RESTRICT
) ENGINE=InnoDB;


CREATE TABLE salas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    tipo_tecnologia ENUM('ESTANDAR', 'IMAX', 'DOLBY_ATMOS', '70MM', 'VIP_LOUNGE') DEFAULT 'ESTANDAR',
    capacidad_total INT NOT NULL DEFAULT 60,
    total_filas INT NOT NULL DEFAULT 6,
    asientos_por_fila INT NOT NULL DEFAULT 10,
    pantalla_tipo VARCHAR(100) DEFAULT 'Curva Gigante 4K',
    sistema_sonido VARCHAR(100) DEFAULT 'Dolby Atmos 64 Canales',
    activa BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;


CREATE TABLE asientos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sala_id INT NOT NULL,
    fila CHAR(1) NOT NULL,
    columna INT NOT NULL,
    codigo VARCHAR(10) NOT NULL, -- 'A-1', 'E-5'
    tipo ENUM('ESTANDAR', 'VIP', 'DISCAPACITADOS') NOT NULL DEFAULT 'ESTANDAR',
    estado_fisico ENUM('OPERATIVO', 'EN_REPARACION', 'BLOQUEADO') DEFAULT 'OPERATIVO',
    FOREIGN KEY (sala_id) REFERENCES salas(id) ON DELETE CASCADE,
    UNIQUE KEY uq_sala_asiento (sala_id, fila, columna),
    INDEX idx_asiento_sala_codigo (sala_id, codigo)
) ENGINE=InnoDB;

CREATE TABLE funciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pelicula_id VARCHAR(30) NOT NULL,
    sala_id INT NOT NULL,
    fecha_funcion DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    precio_estandar DECIMAL(8,2) NOT NULL,
    precio_vip DECIMAL(8,2) NOT NULL,
    estado ENUM('PROGRAMADA', 'EN_VENTA', 'EN_SALA', 'FINALIZADA', 'CANCELADA') DEFAULT 'EN_VENTA',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pelicula_id) REFERENCES peliculas(id) ON DELETE RESTRICT,
    FOREIGN KEY (sala_id) REFERENCES salas(id) ON DELETE RESTRICT,
    INDEX idx_funcion_cartelera (fecha_funcion, estado),
    INDEX idx_funcion_pelicula (pelicula_id)
) ENGINE=InnoDB;


CREATE TABLE bloqueos_temporales_asientos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    funcion_id INT NOT NULL,
    asiento_id INT NOT NULL,
    session_token VARCHAR(100) NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expira_en TIMESTAMP NOT NULL,
    FOREIGN KEY (funcion_id) REFERENCES funciones(id) ON DELETE CASCADE,
    FOREIGN KEY (asiento_id) REFERENCES asientos(id) ON DELETE CASCADE,
    UNIQUE KEY uq_bloqueo_activo (funcion_id, asiento_id),
    INDEX idx_bloqueo_expira (expira_en)
) ENGINE=InnoDB;


CREATE TABLE categorias_snack (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion VARCHAR(200) NULL
) ENGINE=InnoDB;

-- TABLA DE PROVEEDORES (Control de compras, márgenes acordados y comisiones)
CREATE TABLE proveedores (
    id VARCHAR(30) PRIMARY KEY,                             -- 'prov-01', 'prov-02'
    empresa VARCHAR(150) NOT NULL,                          -- Razón Social / Nombre Comercial
    nit_rut VARCHAR(50) NULL,                               -- NIT / RUT Tributario
    contacto_nombre VARCHAR(120) NOT NULL,                  -- Persona de contacto / Ejecutivo de cuenta
    telefono VARCHAR(50) NOT NULL,                          -- Teléfono directo o WhatsApp
    email VARCHAR(150) NOT NULL,                            -- Correo de órdenes y facturación
    categoria VARCHAR(80) NOT NULL DEFAULT 'Insumos',       -- 'Maíz y Granos', 'Bebidas', 'Empaques', 'Snacks Calientes', etc.
    porcentaje_ganancia DECIMAL(5,2) NOT NULL DEFAULT 0.00, -- Margen de ganancia o descuento acordado (%)
    porcentaje_comision DECIMAL(5,2) NOT NULL DEFAULT 0.00, -- Comisión del proveedor o intermediación (%)
    terminos_pago VARCHAR(50) NOT NULL DEFAULT 'Contado',   -- 'Contado', 'Crédito 15 días', 'Crédito 30 días'
    estado ENUM('ACTIVO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    direccion VARCHAR(200) NULL,
    notas TEXT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_proveedor_estado (estado),
    INDEX idx_proveedor_categoria (categoria)
) ENGINE=InnoDB;

CREATE TABLE productos_snack (
    id VARCHAR(30) PRIMARY KEY,
    categoria_id INT NOT NULL,
    proveedor_id VARCHAR(30) NULL,                         -- Relación con el proveedor de insumo
    nombre VARCHAR(120) NOT NULL,
    descripcion TEXT NOT NULL,
    precio_costo DECIMAL(8,2) NOT NULL DEFAULT 0.00,       -- Costo de insumos / compra por unidad
    precio DECIMAL(8,2) NOT NULL,                          -- Precio de venta al público
    etiqueta VARCHAR(50) NULL,
    imagen_url VARCHAR(500) NOT NULL,
    stock_inicial INT NOT NULL DEFAULT 500,                -- Control de inventario inicial
    stock_disponible INT NOT NULL DEFAULT 500,             -- Stock actual en bodega / mostrador
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (categoria_id) REFERENCES categorias_snack(id) ON DELETE RESTRICT,
    FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE SET NULL,
    INDEX idx_snack_categoria (categoria_id),
    INDEX idx_snack_proveedor (proveedor_id)
) ENGINE=InnoDB;


CREATE TABLE reservas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo_reserva VARCHAR(20) NOT NULL UNIQUE,            -- 'CMG-748921'
    usuario_id INT NULL,
    cliente_nombre VARCHAR(150) NOT NULL DEFAULT 'Cliente Cine Majestad',
    cliente_email VARCHAR(150) NULL,
    funcion_id INT NOT NULL,
    subtotal_boletos DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    subtotal_snacks DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_pagado DECIMAL(10,2) NOT NULL DEFAULT 0.00,      -- Ingreso bruto total
    costo_total_productos DECIMAL(10,2) NOT NULL DEFAULT 0.00, -- Costo de los snacks vendidos (COGS)
    comision_pasarela_porcentaje DECIMAL(4,2) NOT NULL DEFAULT 2.90, -- % Comisión/Interés de pasarela
    comision_pasarela_fija DECIMAL(8,2) NOT NULL DEFAULT 0.30,       -- Tarifa fija por transacción ($)
    comision_total_pasarela DECIMAL(8,2) NOT NULL DEFAULT 0.00,      -- Total deducido por pasarela
    ganancia_neta DECIMAL(10,2) NOT NULL DEFAULT 0.00,     -- total_pagado - costo_total_productos - comision_total_pasarela
    estado ENUM('PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'REEMBOLSADA') DEFAULT 'CONFIRMADA',
    metodo_pago ENUM('TARJETA_CREDITO', 'TARJETA_DEBITO', 'TRANSFERENCIA', 'PAYPAL', 'EFECTIVO') DEFAULT 'TARJETA_CREDITO',
    referencia_pago VARCHAR(100) NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    FOREIGN KEY (funcion_id) REFERENCES funciones(id) ON DELETE RESTRICT,
    INDEX idx_reserva_codigo (codigo_reserva),
    INDEX idx_reserva_fecha (creado_en)
) ENGINE=InnoDB;

CREATE TABLE reserva_asientos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reserva_id INT NOT NULL,
    funcion_id INT NOT NULL,
    asiento_id INT NOT NULL,
    precio_unitario DECIMAL(8,2) NOT NULL,
    tipo_asiento ENUM('ESTANDAR', 'VIP') NOT NULL,
    FOREIGN KEY (reserva_id) REFERENCES reservas(id) ON DELETE CASCADE,
    FOREIGN KEY (funcion_id) REFERENCES funciones(id) ON DELETE RESTRICT,
    FOREIGN KEY (asiento_id) REFERENCES asientos(id) ON DELETE RESTRICT,
    UNIQUE KEY uq_funcion_asiento (funcion_id, asiento_id)
) ENGINE=InnoDB;

CREATE TABLE reserva_snacks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reserva_id INT NOT NULL,
    producto_snack_id VARCHAR(30) NOT NULL,
    cantidad INT NOT NULL DEFAULT 1,
    precio_unitario DECIMAL(8,2) NOT NULL,
    subtotal DECIMAL(8,2) NOT NULL,
    FOREIGN KEY (reserva_id) REFERENCES reservas(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_snack_id) REFERENCES productos_snack(id) ON DELETE RESTRICT
) ENGINE=InnoDB;


CREATE OR REPLACE VIEW v_cartelera_web AS
SELECT 
    p.id,
    p.titulo,
    p.sinopsis,
    p.director,
    CONCAT(p.duracion_min, ' min') AS duracion,
    p.clasificacion_edad,
    p.rating,
    p.poster_url,
    p.backdrop_url,
    p.trailer_url,
    p.precio_estandar_base,
    p.precio_vip_base,
    p.es_destacada,
    GROUP_CONCAT(DISTINCT g.nombre ORDER BY g.nombre SEPARATOR ', ') AS generos,
    GROUP_CONCAT(DISTINCT f.nombre ORDER BY f.nombre SEPARATOR ', ') AS formatos
FROM peliculas p
LEFT JOIN pelicula_generos pg ON p.id = pg.pelicula_id
LEFT JOIN generos g ON pg.genero_id = g.id
LEFT JOIN pelicula_formatos pf ON p.id = pf.pelicula_id
LEFT JOIN formatos f ON pf.formato_id = f.id
WHERE p.estado = 'EN_CARTELERA'
GROUP BY p.id;

CREATE OR REPLACE VIEW v_disponibilidad_asientos AS
SELECT 
    fn.id AS funcion_id,
    fn.pelicula_id,
    p.titulo AS pelicula_titulo,
    s.id AS sala_id,
    s.nombre AS sala_nombre,
    a.id AS asiento_id,
    a.fila,
    a.columna,
    a.codigo AS codigo_asiento,
    a.tipo AS tipo_asiento,
    CASE 
        WHEN a.estado_fisico != 'OPERATIVO' THEN 'MANTENIMIENTO'
        WHEN ra.id IS NOT NULL THEN 'OCUPADO'
        WHEN bta.id IS NOT NULL AND bta.expira_en > NOW() THEN 'EN_SELECCION_TEMPORAL'
        ELSE 'DISPONIBLE'
    END AS estado_actual,
    bta.session_token AS bloqueado_por_sesion,
    bta.expira_en AS bloqueo_expira_en
FROM funciones fn
JOIN peliculas p ON fn.pelicula_id = p.id
JOIN salas s ON fn.sala_id = s.id
JOIN asientos a ON s.id = a.sala_id
LEFT JOIN reserva_asientos ra ON fn.id = ra.funcion_id AND a.id = ra.asiento_id
LEFT JOIN bloqueos_temporales_asientos bta ON fn.id = bta.funcion_id AND a.id = bta.asiento_id AND bta.expira_en > NOW();

CREATE OR REPLACE VIEW v_dashboard_metricas AS
SELECT 
    (SELECT COUNT(*) FROM peliculas WHERE estado = 'EN_CARTELERA') AS total_peliculas_activas,
    (SELECT COUNT(*) FROM reservas WHERE estado = 'CONFIRMADA') AS total_reservas_completadas,
    (SELECT COALESCE(SUM(total_pagado), 0.00) FROM reservas WHERE estado = 'CONFIRMADA') AS recaudacion_total_estimada,
    (SELECT COALESCE(SUM(subtotal_boletos), 0.00) FROM reservas WHERE estado = 'CONFIRMADA') AS recaudacion_taquilla,
    (SELECT COALESCE(SUM(subtotal_snacks), 0.00) FROM reservas WHERE estado = 'CONFIRMADA') AS recaudacion_dulceria,
    (SELECT COUNT(*) FROM bloqueos_temporales_asientos WHERE expira_en > NOW()) AS bloqueos_activos_en_curso;

-- VISTA: RENTABILIDAD, MÁRGENES Y GANANCIAS POR PRODUCTO DE INVENTARIO
CREATE OR REPLACE VIEW v_rentabilidad_inventario AS
SELECT 
    ps.id AS producto_id,
    ps.nombre AS nombre_producto,
    cs.nombre AS categoria,
    ps.stock_disponible,
    ps.precio_costo,
    ps.precio AS precio_venta,
    (ps.precio - ps.precio_costo) AS ganancia_unitaria,
    ROUND(((ps.precio - ps.precio_costo) / ps.precio) * 100, 2) AS margen_ganancia_porcentaje,
    ROUND(((ps.precio - ps.precio_costo) / NULLIF(ps.precio_costo, 0)) * 100, 2) AS roi_markup_porcentaje,
    COALESCE(SUM(rs.cantidad), 0) AS unidades_vendidas,
    COALESCE(SUM(rs.subtotal), 0.00) AS ingresos_totales,
    COALESCE(SUM(rs.cantidad * ps.precio_costo), 0.00) AS costo_total_acumulado,
    (COALESCE(SUM(rs.subtotal), 0.00) - COALESCE(SUM(rs.cantidad * ps.precio_costo), 0.00)) AS utilidad_bruta_total
FROM productos_snack ps
JOIN categorias_snack cs ON ps.categoria_id = cs.id
LEFT JOIN reserva_snacks rs ON ps.id = rs.producto_snack_id
GROUP BY ps.id, ps.nombre, cs.nombre, ps.stock_disponible, ps.precio_costo, ps.precio;

-- VISTA: BALANCE FINANCIERO GLOBAL, COSTOS, INTERESES DE PASARELA Y UTILIDAD NETA
CREATE OR REPLACE VIEW v_balance_financiero_ventas AS
SELECT 
    COUNT(r.id) AS total_transacciones,
    COALESCE(SUM(r.total_pagado), 0.00) AS ingresos_totales_brutos,
    COALESCE(SUM(r.subtotal_boletos), 0.00) AS ingresos_taquilla,
    COALESCE(SUM(r.subtotal_snacks), 0.00) AS ingresos_dulceria,
    COALESCE(SUM(r.costo_total_productos), 0.00) AS costo_mercancia_vendida,
    COALESCE(SUM(r.comision_total_pasarela), 0.00) AS total_comisiones_intereses_pasarela,
    (COALESCE(SUM(r.total_pagado), 0.00) - COALESCE(SUM(r.costo_total_productos), 0.00) - COALESCE(SUM(r.comision_total_pasarela), 0.00)) AS utilidad_neta_limpia,
    ROUND(((COALESCE(SUM(r.total_pagado), 0.00) - COALESCE(SUM(r.costo_total_productos), 0.00) - COALESCE(SUM(r.comision_total_pasarela), 0.00)) / NULLIF(SUM(r.total_pagado), 0)) * 100, 2) AS margen_neto_porcentaje
FROM reservas r
WHERE r.estado = 'CONFIRMADA';

-- VISTA: USUARIOS CON DETALLE COMPLETO DE ROL Y PRIVILEGIOS
CREATE OR REPLACE VIEW v_usuarios_roles AS
SELECT 
    u.id AS usuario_id,
    CONCAT(u.nombre, ' ', u.apellido) AS nombre_completo,
    u.nombre,
    u.apellido,
    u.email,
    u.telefono,
    u.activo AS usuario_activo,
    r.id AS rol_id,
    r.nombre AS rol_nombre,
    r.slug AS rol_codigo,
    r.nivel_jerarquia,
    r.puede_vender_boletos,
    r.puede_vender_snacks,
    r.puede_gestionar_peliculas,
    r.puede_gestionar_usuarios,
    r.puede_ver_metricas_financieras,
    r.puede_gestionar_proveedores,
    r.permisos,
    u.creado_en AS fecha_registro
FROM usuarios u
JOIN roles r ON u.rol_id = r.id;

-- VISTA: RESUMEN DE ROLES Y CANTIDAD DE USUARIOS ASIGNADOS
CREATE OR REPLACE VIEW v_roles_resumen AS
SELECT 
    r.id AS rol_id,
    r.nombre AS rol_nombre,
    r.slug AS rol_codigo,
    r.nivel_jerarquia,
    r.activo AS rol_activo,
    COUNT(u.id) AS total_usuarios_asignados,
    SUM(CASE WHEN u.activo = TRUE THEN 1 ELSE 0 END) AS usuarios_activos
FROM roles r
LEFT JOIN usuarios u ON r.id = u.rol_id
GROUP BY r.id, r.nombre, r.slug, r.nivel_jerarquia, r.activo;



INSERT INTO configuracion_cine (id, nombre_cine, slogan, telefono, direccion, horarios_operacion, minutos_bloqueo_asiento, max_boletos_por_transaccion) VALUES
(1, 'Cine Majestad', 'La Majestad del Séptimo Arte', '+57 (601) 789-2026', 'Av. Principal Real #104, Centro Comercial Gran Plaza', 'Lunes a Domingo: 12:00 PM - 11:30 PM', 5, 8);

-- ROLES BASE CON MATRIZ DE PERMISOS Y CAPACIDADES DEL MULTIPLEX
INSERT INTO roles (id, nombre, slug, descripcion, nivel_jerarquia, permisos, puede_vender_boletos, puede_vender_snacks, puede_gestionar_peliculas, puede_gestionar_usuarios, puede_ver_metricas_financieras, puede_gestionar_proveedores, activo) VALUES
(1, 'Administrador General', 'ADMIN', 'Control total y absoluto del multiplex, salas, finanzas, inventario, usuarios y configuración global.', 100, 
 JSON_ARRAY('dashboard:view', 'movies:create', 'movies:edit', 'movies:delete', 'shows:manage', 'rooms:manage', 'candybar:manage', 'suppliers:manage', 'orders:view', 'orders:cancel', 'reports:financial', 'users:manage', 'settings:edit', 'boxoffice:sell'), 
 TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),

(2, 'Taquillero / Boletería', 'TAQUILLERO', 'Venta y emisión de boletos en mostrador físico, consulta de funciones y butacas en tiempo real.', 20, 
 JSON_ARRAY('dashboard:view', 'shows:view', 'boxoffice:sell', 'orders:create', 'seats:lock', 'candybar:sell'), 
 TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, TRUE),

(3, 'Operador de Confitería / Dulcería', 'CONFITERIA', 'Atención en CandyBar, despacho de combos, control de stock de bodega y registro de ventas de dulcería.', 15, 
 JSON_ARRAY('candybar:view', 'candybar:sell', 'inventory:view', 'inventory:adjust'), 
 FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, TRUE),

(4, 'Gerente de Operaciones y Sucursal', 'GERENTE', 'Supervisión operativa diaria, monitoreo de recaudación, gestión de proveedores, compras y cartelera.', 70, 
 JSON_ARRAY('dashboard:view', 'movies:create', 'movies:edit', 'shows:manage', 'candybar:manage', 'suppliers:manage', 'inventory:manage', 'reports:financial', 'orders:view'), 
 TRUE, TRUE, TRUE, FALSE, TRUE, TRUE, TRUE),

(5, 'Cliente / Espectador Registrado', 'CLIENTE', 'Usuario final para reserva de entradas y combos en línea, acumulación de fidelidad e historial personal.', 1, 
 JSON_ARRAY('catalog:view', 'booking:create', 'profile:manage', 'orders:history'), 
 FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, TRUE);

-- USUARIOS DEL SISTEMA VINCULADOS A SU ROL_ID CORRESPONDIENTE
INSERT INTO usuarios (id, rol_id, nombre, apellido, email, password_hash, telefono, rol, activo) VALUES
(1, 1, 'Administrador', 'Majestad', 'admin@cinemajestad.com', '$2y$12$e8Ym...hashDemoAdmin', '+57 320 987 6543', 'ADMIN', TRUE),
(2, 5, 'Yeffry', 'González', 'yeffry@cinemajestad.com', '$2y$12$kP8...hashDemoCliente', '+57 300 555 1234', 'CLIENTE', TRUE),
(3, 2, 'María', 'Rodríguez', 'taquilla@cinemajestad.com', '$2y$12$t4Q...hashDemoTaquilla', '+57 311 234 5678', 'TAQUILLERO', TRUE),
(4, 4, 'Carlos', 'Gerencia', 'gerencia@cinemajestad.com', '$2y$12$g9R...hashDemoGerencia', '+57 315 444 7788', 'GERENTE', TRUE),
(5, 3, 'Sofía', 'Dulcería', 'candybar@cinemajestad.com', '$2y$12$s1K...hashDemoDulceria', '+57 318 666 9900', 'CONFITERIA', TRUE),
(6, 5, 'Carlos', 'Gómez', 'carlos@cliente.com', '$2y$12$kP8...hashDemoCliente', '+57 310 999 8877', 'CLIENTE', TRUE);

INSERT INTO generos (id, nombre, slug) VALUES
(1, 'Ciencia Ficción', 'ciencia-ficcion'),
(2, 'Animación', 'animacion'),
(3, 'Drama', 'drama'),
(4, 'Acción', 'accion'),
(5, 'Aventura', 'aventura');

INSERT INTO formatos (id, nombre, descripcion) VALUES
(1, '2D', 'Proyección digital estándar de alta definición'),
(2, '3D', 'Experiencia tridimensional inmersiva con lentes polarizados'),
(3, 'IMAX Laser', 'Pantalla curva gigante con proyección dual láser 4K'),
(4, 'Dolby Atmos', 'Sonido multidimensional y envolvente 360 grados'),
(5, '70mm Master', 'Proyección análoga de película de gran formato');

INSERT INTO peliculas (id, titulo, sinopsis, director, duracion_min, clasificacion_edad, rating, poster_url, backdrop_url, trailer_url, precio_estandar_base, precio_vip_base, es_destacada, estado) VALUES
('mov-01', 'Dune: Parte Dos', 'Paul Atreides se une a Chani y a los Fremen mientras busca venganza contra los conspiradores que destruyeron a su familia.', 'Denis Villeneuve', 166, 'B-15', 8.8, 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80', 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1600&q=80', 'https://www.youtube.com/embed/Way9Dexny3w', 6.50, 10.00, TRUE, 'EN_CARTELERA'),
('mov-02', 'Spider-Man: A Través del Spider-Verso', 'Miles Morales es catapultado a través del Multiverso, donde se encuentra con un equipo de Spider-People encargados de proteger su propia existencia.', 'Joaquim Dos Santos, Kemp Powers', 140, 'A', 8.9, 'https://images.unsplash.com/photo-1635805737707-575885ab0820?auto=format&fit=crop&w=600&q=80', 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1600&q=80', 'https://www.youtube.com/embed/cqGjhVJWtEg', 5.50, 8.50, FALSE, 'EN_CARTELERA'),
('mov-03', 'Oppenheimer', 'La historia del científico estadounidense J. Robert Oppenheimer y su papel en el desarrollo de la bomba atómica durante la Segunda Guerra Mundial.', 'Christopher Nolan', 180, 'B-15', 8.9, 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=600&q=80', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=80', 'https://www.youtube.com/embed/uYPbbksJxIg', 6.00, 9.50, FALSE, 'EN_CARTELERA'),
('mov-04', 'Interstellar (Edición Aniversario)', 'Un equipo de exploradores viaja a través de un agujero de gusano en el espacio en un intento por asegurar la supervivencia de la humanidad.', 'Christopher Nolan', 169, 'A', 8.7, 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80', 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1600&q=80', 'https://www.youtube.com/embed/zSWdZVtXT7E', 6.50, 10.00, FALSE, 'EN_CARTELERA'),
('mov-05', 'El Caballero de la Noche', 'Cuando la amenaza conocida como el Joker causa estragos en Gotham City, Batman debe aceptar una de las mayores pruebas para luchar contra la injusticia.', 'Christopher Nolan', 152, 'B-15', 9.0, 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=600&q=80', 'https://images.unsplash.com/photo-1514306191717-452ec28c7814?auto=format&fit=crop&w=1600&q=80', 'https://www.youtube.com/embed/EXeTwQWrcwY', 5.50, 8.50, FALSE, 'EN_CARTELERA');

INSERT INTO pelicula_generos (pelicula_id, genero_id) VALUES
('mov-01', 1), ('mov-01', 5), ('mov-02', 2), ('mov-02', 4), ('mov-03', 3), ('mov-04', 1), ('mov-04', 3), ('mov-05', 4), ('mov-05', 3);

INSERT INTO pelicula_formatos (pelicula_id, formato_id) VALUES
('mov-01', 3), ('mov-01', 2), ('mov-01', 4), ('mov-02', 1), ('mov-02', 2), ('mov-03', 3), ('mov-03', 5), ('mov-04', 3), ('mov-04', 4), ('mov-05', 1), ('mov-05', 4);

INSERT INTO salas (id, nombre, tipo_tecnologia, capacidad_total, total_filas, asientos_por_fila, pantalla_tipo, sistema_sonido) VALUES
(1, 'Sala 1 (IMAX Laser & Dolby)', 'IMAX', 60, 6, 10, 'Curva Gigante 4K', 'Dolby Atmos 64 Canales'),
(2, 'Sala 2 (70mm Master Cinema)', '70MM', 60, 6, 10, 'Plana 70mm Panavision', 'DTS-X Surround'),
(3, 'Sala 3 (Dolby Atmos 360°)', 'DOLBY_ATMOS', 50, 5, 10, 'Microperforada 2K', 'Dolby Atmos 360°'),
(4, 'Sala 4 (VIP Royal Lounge)', 'VIP_LOUNGE', 32, 4, 8, 'Pantalla Láser Premium', 'Bowers & Wilkins Hi-Fi');

INSERT INTO asientos (sala_id, fila, columna, codigo, tipo) VALUES
('1', 'A', 1, 'A-1', 'ESTANDAR'), ('1', 'A', 2, 'A-2', 'ESTANDAR'), ('1', 'A', 3, 'A-3', 'ESTANDAR'), ('1', 'A', 4, 'A-4', 'ESTANDAR'), ('1', 'A', 5, 'A-5', 'ESTANDAR'),
('1', 'A', 6, 'A-6', 'ESTANDAR'), ('1', 'A', 7, 'A-7', 'ESTANDAR'), ('1', 'A', 8, 'A-8', 'ESTANDAR'), ('1', 'A', 9, 'A-9', 'ESTANDAR'), ('1', 'A', 10, 'A-10', 'ESTANDAR'),
('1', 'B', 1, 'B-1', 'ESTANDAR'), ('1', 'B', 2, 'B-2', 'ESTANDAR'), ('1', 'B', 3, 'B-3', 'ESTANDAR'), ('1', 'B', 4, 'B-4', 'ESTANDAR'), ('1', 'B', 5, 'B-5', 'ESTANDAR'),
('1', 'B', 6, 'B-6', 'ESTANDAR'), ('1', 'B', 7, 'B-7', 'ESTANDAR'), ('1', 'B', 8, 'B-8', 'ESTANDAR'), ('1', 'B', 9, 'B-9', 'ESTANDAR'), ('1', 'B', 10, 'B-10', 'ESTANDAR'),
('1', 'C', 1, 'C-1', 'ESTANDAR'), ('1', 'C', 2, 'C-2', 'ESTANDAR'), ('1', 'C', 3, 'C-3', 'ESTANDAR'), ('1', 'C', 4, 'C-4', 'ESTANDAR'), ('1', 'C', 5, 'C-5', 'ESTANDAR'),
('1', 'C', 6, 'C-6', 'ESTANDAR'), ('1', 'C', 7, 'C-7', 'ESTANDAR'), ('1', 'C', 8, 'C-8', 'ESTANDAR'), ('1', 'C', 9, 'C-9', 'ESTANDAR'), ('1', 'C', 10, 'C-10', 'ESTANDAR'),
('1', 'D', 1, 'D-1', 'ESTANDAR'), ('1', 'D', 2, 'D-2', 'ESTANDAR'), ('1', 'D', 3, 'D-3', 'ESTANDAR'), ('1', 'D', 4, 'D-4', 'ESTANDAR'), ('1', 'D', 5, 'D-5', 'ESTANDAR'),
('1', 'D', 6, 'D-6', 'ESTANDAR'), ('1', 'D', 7, 'D-7', 'ESTANDAR'), ('1', 'D', 8, 'D-8', 'ESTANDAR'), ('1', 'D', 9, 'D-9', 'ESTANDAR'), ('1', 'D', 10, 'D-10', 'ESTANDAR'),
('1', 'E', 1, 'E-1', 'VIP'), ('1', 'E', 2, 'E-2', 'VIP'), ('1', 'E', 3, 'E-3', 'VIP'), ('1', 'E', 4, 'E-4', 'VIP'), ('1', 'E', 5, 'E-5', 'VIP'),
('1', 'E', 6, 'E-6', 'VIP'), ('1', 'E', 7, 'E-7', 'VIP'), ('1', 'E', 8, 'E-8', 'VIP'), ('1', 'E', 9, 'E-9', 'VIP'), ('1', 'E', 10, 'E-10', 'VIP'),
('1', 'F', 1, 'F-1', 'VIP'), ('1', 'F', 2, 'F-2', 'VIP'), ('1', 'F', 3, 'F-3', 'VIP'), ('1', 'F', 4, 'F-4', 'VIP'), ('1', 'F', 5, 'F-5', 'VIP'),
('1', 'F', 6, 'F-6', 'VIP'), ('1', 'F', 7, 'F-7', 'VIP'), ('1', 'F', 8, 'F-8', 'VIP'), ('1', 'F', 9, 'F-9', 'VIP'), ('1', 'F', 10, 'F-10', 'VIP');

INSERT INTO asientos (sala_id, fila, columna, codigo, tipo)
SELECT 2, fila, columna, codigo, tipo FROM asientos WHERE sala_id = 1;

INSERT INTO asientos (sala_id, fila, columna, codigo, tipo)
SELECT 3, fila, columna, codigo, tipo FROM asientos WHERE sala_id = 1 AND fila != 'F';

INSERT INTO asientos (sala_id, fila, columna, codigo, tipo)
SELECT 4, fila, columna, codigo, 'VIP' FROM asientos WHERE sala_id = 1 AND fila IN ('A', 'B', 'C', 'D') AND columna <= 8;

INSERT INTO funciones (id, pelicula_id, sala_id, fecha_funcion, hora_inicio, hora_fin, precio_estandar, precio_vip) VALUES
(1, 'mov-01', 1, CURRENT_DATE(), '14:30:00', '17:16:00', 6.50, 10.00),
(2, 'mov-01', 1, CURRENT_DATE(), '17:45:00', '20:31:00', 6.50, 10.00),
(3, 'mov-01', 1, CURRENT_DATE(), '21:00:00', '23:46:00', 6.50, 10.00),
(4, 'mov-02', 3, CURRENT_DATE(), '13:00:00', '15:20:00', 5.50, 8.50),
(5, 'mov-02', 3, CURRENT_DATE(), '16:15:00', '18:35:00', 5.50, 8.50),
(6, 'mov-02', 3, CURRENT_DATE(), '19:30:00', '21:50:00', 5.50, 8.50),
(7, 'mov-03', 2, CURRENT_DATE(), '15:00:00', '18:00:00', 6.00, 9.50),
(8, 'mov-04', 1, CURRENT_DATE(), '17:00:00', '19:49:00', 6.50, 10.00),
(9, 'mov-05', 4, CURRENT_DATE(), '19:00:00', '21:32:00', 5.50, 8.50);

INSERT INTO categorias_snack (id, nombre, descripcion) VALUES
(1, 'combos', 'Combos reales y para parejas'),
(2, 'palomitas', 'Palomitas gourmet con mantequilla dorada o caramelo'),
(3, 'snacks', 'Aperitivos calientes, nachos y hot dogs jumbo'),
(4, 'bebidas', 'Refrescos helados, tés fríos y agua mineral'),
(5, 'dulces', 'Chocolates y dulces');

INSERT INTO proveedores (id, empresa, nit_rut, contacto_nombre, telefono, email, categoria, porcentaje_ganancia, porcentaje_comision, terminos_pago, estado, direccion, notas) VALUES
('prov-01', 'Distribuidora Maíz & Granos del Valle SAS', '900.874.120-1', 'Juan Carlos Mendoza', '+57 312 456 7890', 'ventas@maizdelvalle.com', 'Maíz y Granos', 65.00, 5.00, 'Crédito 30 días', 'ACTIVO', 'Zona Industrial Puente Aranda, Bodega 14', 'Proveedor principal de maíz pisingallo grado premium y aceites de mantequilla dorada.'),
('prov-02', 'Coca-Cola FEMSA Distribución', '860.001.234-5', 'Marcela Suárez', '+57 320 889 1122', 'pedidos.cine@femsa.com', 'Bebidas', 80.00, 0.00, 'Crédito 15 días', 'ACTIVO', 'Parque Empresarial del Norte, Módulo B', 'Distribuidor exclusivo de concentrados para dispensadores 32oz, agua brisa y jugos.'),
('prov-03', 'Empaques & Vasos Biodegradables CinePack', '901.332.998-3', 'Andrés Felipe Gómez', '+57 301 776 5432', 'contacto@cinepack.co', 'Empaques & Vasos', 45.00, 2.00, 'Contado', 'ACTIVO', 'Calle 68 # 45-20, Centro Logístico', 'Cajas de palomitas personalizadas con logo de Cine Majestad y vasos ecológicos.'),
('prov-04', 'Golosinas & Chocolates Nacionales SAS', '890.102.554-9', 'Carolina Herrera', '+57 315 223 9988', 'carolina@chocolatesnac.com', 'Dulces y Chocolates', 55.00, 3.50, 'Crédito 30 días', 'ACTIVO', 'Av. Las Américas # 72-10', 'Chocolates confitados, gomitas ácidas y caramelos masticables para combos infantiles.'),
('prov-05', 'Carnes Frías & Embutidos Premium Gourmet', '900.551.442-8', 'Roberto Duque', '+57 318 990 4455', 'rduque@carnespremium.co', 'Snacks Calientes', 50.00, 0.00, 'Contado', 'ACTIVO', 'Cra 50 # 22-80', 'Salchichas gigantes tipo Frankfurt para Hot Dogs Jumbo y queso cheddar caliente.');

INSERT INTO productos_snack (id, categoria_id, proveedor_id, nombre, descripcion, precio_costo, precio, etiqueta, imagen_url, stock_disponible) VALUES
('snack-01', 1, 'prov-01', 'Combo Majestad Dúo Real', '1 Palomitas gigantes (mantequilla o caramelo) + 2 Bebidas grandes heladas + 1 Hot Dog supremo o Nachos cheddar.', 3.80, 13.50, 'Más Vendido', 'https://images.unsplash.com/photo-1585647347384-2593bc35786b?auto=format&fit=crop&w=600&q=80', 250),
('snack-02', 2, 'prov-01', 'Palomitas Mega Mantequilla Dorada', 'Crujientes granos de maíz gourmet recién preparados, bañados en generosa mantequilla dorada caliente.', 0.90, 5.80, 'Clásico', 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=600&q=80', 400),
('snack-03', 3, 'prov-05', 'Nachos Suprema con Queso Fundido', 'Crujientes totopos de maíz con abundante queso cheddar caliente, frijoles negros y rodajas de jalapeños.', 1.80, 6.50, 'Crujiente', 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&w=600&q=80', 300),
('snack-04', 4, 'prov-02', 'Refresco Ice Cold 32oz', 'Bebida gasificada helada a elección (Coca-Cola, Sprite, Fanta, Té frío de limón o Manzana).', 0.60, 3.50, 'Refrescante', 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80', 600),
('snack-05', 1, 'prov-04', 'Combo Dulzura Caramelo Imperial', 'Palomitas de caramelo artesanal crocante + 1 Bebida gigante + 1 Chocolate M&M''s familiar.', 2.60, 10.20, 'Favorito', 'https://images.unsplash.com/photo-1505686994434-e3cc5abf1330?auto=format&fit=crop&w=600&q=80', 180),
('snack-06', 3, 'prov-05', 'Hot Dog Majestad Jumbo', 'Salchicha alemana de res en pan brioche artesanal con queso derretido, tocino crocante y salsas.', 1.90, 5.90, 'Especial', 'https://images.unsplash.com/photo-1619740455993-9e612b1af08a?auto=format&fit=crop&w=600&q=80', 220);

INSERT INTO reservas (id, codigo_reserva, usuario_id, cliente_nombre, cliente_email, funcion_id, subtotal_boletos, subtotal_snacks, total_pagado, estado, metodo_pago) VALUES
(1, 'CMG-748921', 2, 'Yeffry González', 'yeffry@cinemajestad.com', 3, 20.00, 13.50, 33.50, 'CONFIRMADA', 'TARJETA_CREDITO');

INSERT INTO reserva_asientos (reserva_id, funcion_id, asiento_id, precio_unitario, tipo_asiento) VALUES
(1, 3, (SELECT id FROM asientos WHERE sala_id = 1 AND codigo = 'E-4'), 10.00, 'VIP'),
(1, 3, (SELECT id FROM asientos WHERE sala_id = 1 AND codigo = 'E-5'), 10.00, 'VIP');

INSERT INTO reserva_snacks (reserva_id, producto_snack_id, cantidad, precio_unitario, subtotal) VALUES
(1, 'snack-01', 1, 13.50, 13.50);
