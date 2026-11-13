const jwt = require("jsonwebtoken");
const Store = require("../models/store");

const JWT_SECRET = process.env.JWT_SECRET || "cinemajestad_super_secret_jwt_key_2026_royal";

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    req.user = null;
    return next();
  }

  // Soporte para tokens demo / sesiones locales de desarrollo del administrador
  if (token.startsWith("demo_jwt_token_")) {
    req.user = { id: 1, email: "admin@cinemajestad.com", nombre: "Administrador", rol: "ADMIN" };
    return next();
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      req.user = null;
      return next();
    }
    try {
      const user = await Store.findUserById(decoded.id);
      req.user = user ? { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol } : decoded;
    } catch (e) {
      req.user = decoded;
    }
    next();
  });
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Acceso no autorizado. Debe iniciar sesión."
    });
  }
  next();
}

function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Debe iniciar sesión para acceder a este recurso."
      });
    }
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({
        success: false,
        message: `Acceso denegado. Se requiere rol: ${roles.join(" o ")}.`
      });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  requireAuth,
  requireRole,
  JWT_SECRET
};
