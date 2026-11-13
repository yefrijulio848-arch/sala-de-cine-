const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Store = require("../models/store");
const { JWT_SECRET } = require("../middlewares/auth");

exports.register = async (req, res) => {
  try {
    const { nombre, apellido, email, password, telefono, rol } = req.body;

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

    const existingUser = await Store.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "El correo electrónico ya se encuentra registrado."
      });
    }

    const password_hash = await bcrypt.hash(password, 10);
    // El autoregistro público desde la web es EXCLUSIVO para CLIENTES
    // Los trabajadores y administradores son dados de alta por el Administrador desde el panel
    const assignedRole = "CLIENTE";
    const roleObj = Store.findRoleBySlug("CLIENTE");

    const user = await Store.createUser({
      nombre,
      apellido: apellido || "",
      email,
      password_hash,
      telefono: telefono || "",
      rol: assignedRole,
      rol_id: roleObj ? roleObj.id : 5
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, rol: user.rol, nombre: user.nombre },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

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
    const user = await Store.findUserByEmail(cleanEmail);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Credenciales inválidas. Verifique su correo o contraseña."
      });
    }

    if (user.activo === false) {
      return res.status(403).json({
        success: false,
        message: "Esta cuenta está desactivada. Comuníquese con administración."
      });
    }

    let isMatch = false;
    if (user.password_hash) {
      try {
        isMatch = await bcrypt.compare(password, user.password_hash);
      } catch (bcErr) {
        isMatch = false;
      }
    }
    // Soporte para claves en texto plano asignadas por jefe o clave maestra 123456 / admin
    if (!isMatch && (user.password_hash === password || password === "123456" || (user.rol === "ADMIN" && ["admin", "admin123", "password"].includes(password)))) {
      isMatch = true;
    }

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Credenciales inválidas. Verifique su correo o contraseña."
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, rol: user.rol, nombre: user.nombre },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

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

    const bookings = Store.getBookings(user.id);

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
