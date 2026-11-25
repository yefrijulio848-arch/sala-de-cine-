const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Store = require("../models/store");
const { JWT_SECRET } = require("../middlewares/auth");
const {
  checkLoginLockout,
  recordFailedLogin,
  resetLoginLockout,
  MAX_ATTEMPTS
} = require("../middlewares/rateLimiter");

exports.register = async (req, res) => {
  try {
    const { nombre, apellido, email, password, telefono } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Por favor complete nombre, correo electrónico y contraseña."
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "El formato del correo electrónico no es válido."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "La contraseña debe contener al menos 6 caracteres."
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existingUser = await Store.findUserByEmail(cleanEmail);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "El correo electrónico ya se encuentra registrado."
      });
    }

    // Hasheo seguro obligatorio con bcrypt (10 rounds)
    const password_hash = await bcrypt.hash(password, 10);
    const assignedRole = "CLIENTE";
    const roleObj = Store.findRoleBySlug("CLIENTE");

    const user = await Store.createUser({
      nombre: nombre.trim(),
      apellido: (apellido || "").trim(),
      email: cleanEmail,
      password_hash,
      telefono: (telefono || "").trim(),
      rol: assignedRole,
      rol_id: roleObj ? roleObj.id : 5
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, rol: user.rol, nombre: user.nombre },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    // Protección de información sensible: no se retorna jamás la contraseña ni su hash
    return res.status(201).json({
      success: true,
      message: "Registro exitoso.",
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        telefono: user.telefono,
        rol: user.rol
      }
    });
  } catch (error) {
    console.error("[Auth Register Error]:", error);
    return res.status(500).json({ success: false, message: "Error interno al procesar el registro." });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Ingrese su correo electrónico y contraseña."
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // 1. REGLA DE SEGURIDAD: Verificar si la cuenta/IP está bloqueada por exceder 5 intentos fallidos
    const lockoutStatus = checkLoginLockout(req, cleanEmail);
    if (lockoutStatus.locked) {
      return res.status(429).json({
        success: false,
        locked: true,
        remainingSeconds: lockoutStatus.remainingSeconds,
        remainingMinutes: lockoutStatus.remainingMinutes,
        message: `Acceso temporalmente bloqueado por seguridad tras 5 intentos fallidos. Intente nuevamente en ${lockoutStatus.remainingMinutes} minuto(s) (${lockoutStatus.remainingSeconds} seg).`
      });
    }

    const user = await Store.findUserByEmail(cleanEmail);
    if (!user) {
      const attemptResult = recordFailedLogin(req, cleanEmail);
      if (attemptResult.locked) {
        return res.status(429).json({
          success: false,
          locked: true,
          remainingSeconds: attemptResult.remainingSeconds,
          remainingMinutes: 15,
          message: "Has superado el límite de 5 intentos fallidos. El acceso ha sido bloqueado durante 15 minutos por seguridad."
        });
      }
      return res.status(401).json({
        success: false,
        attemptsLeft: attemptResult.attemptsLeft,
        failedAttempts: attemptResult.failedAttempts,
        message: `Credenciales inválidas. Te quedan ${attemptResult.attemptsLeft} intento(s) antes del bloqueo temporal de seguridad (15 minutos).`
      });
    }

    if (user.activo === false) {
      return res.status(403).json({
        success: false,
        message: "Esta cuenta está desactivada. Comuníquese con administración."
      });
    }

    // 2. PROTECCIÓN DE INFORMACIÓN SENSIBLE: Validación estricta y exclusiva con bcrypt
    let isMatch = false;
    if (user.password_hash) {
      try {
        isMatch = await bcrypt.compare(password, user.password_hash);
      } catch (bcErr) {
        isMatch = false;
      }
    }

    if (!isMatch) {
      const attemptResult = recordFailedLogin(req, cleanEmail);
      if (attemptResult.locked) {
        return res.status(429).json({
          success: false,
          locked: true,
          remainingSeconds: attemptResult.remainingSeconds,
          remainingMinutes: 15,
          message: "Has alcanzado el límite de 5 intentos fallidos. El inicio de sesión ha sido bloqueado durante 15 minutos por seguridad."
        });
      }
      return res.status(401).json({
        success: false,
        attemptsLeft: attemptResult.attemptsLeft,
        failedAttempts: attemptResult.failedAttempts,
        message: `Contraseña incorrecta. Te quedan ${attemptResult.attemptsLeft} intento(s) antes del bloqueo de seguridad.`
      });
    }

    // Inicio de sesión exitoso: restablecer contador de intentos fallidos
    resetLoginLockout(req, cleanEmail);

    const token = jwt.sign(
      { id: user.id, email: user.email, rol: user.rol, nombre: user.nombre },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    // Respuesta saneada: sin password ni password_hash
    return res.json({
      success: true,
      message: "Sesión iniciada con éxito.",
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        telefono: user.telefono,
        rol: user.rol
      }
    });
  } catch (error) {
    console.error("[Auth Login Error]:", error);
    return res.status(500).json({ success: false, message: "Error interno al iniciar sesión." });
  }
};

exports.getProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "No autenticado." });
    }
    const user = await Store.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado." });
    }

    const bookings = await Store.getBookings(user.id);

    return res.json({
      success: true,
      user: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        telefono: user.telefono,
        rol: user.rol,
        creado_en: user.creado_en
      },
      bookings
    });
  } catch (error) {
    console.error("[Auth Profile Error]:", error);
    return res.status(500).json({ success: false, message: "Error al obtener perfil." });
  }
};
