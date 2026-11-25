/* ==========================================================================
   Cine Majestad - Middleware de Validación Robusta del Lado del Servidor
   Asegura sanitización, tipos de datos, patrones regex y rechazo con HTTP 400
   ========================================================================== */

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^[\d\s+\-().]{7,25}$/;

/**
 * Validador para registro público de clientes
 */
function validateRegister(req, res, next) {
  const { nombre, apellido, email, password, telefono } = req.body;
  const errors = [];

  if (!nombre || typeof nombre !== "string" || nombre.trim().length < 2) {
    errors.push("El nombre es obligatorio y debe tener al menos 2 caracteres.");
  } else if (nombre.length > 70) {
    errors.push("El nombre no puede exceder 70 caracteres.");
  }

  if (apellido && (typeof apellido !== "string" || apellido.length > 70)) {
    errors.push("El apellido no puede exceder 70 caracteres.");
  }

  if (!email || typeof email !== "string" || !emailRegex.test(email.trim())) {
    errors.push("Debe ingresar una dirección de correo electrónico válida.");
  } else if (email.length > 100) {
    errors.push("El correo no puede exceder 100 caracteres.");
  }

  if (!password || typeof password !== "string" || password.length < 6) {
    errors.push("La contraseña es obligatoria y debe tener al menos 6 caracteres.");
  } else if (password.length > 128) {
    errors.push("La contraseña no puede exceder 128 caracteres.");
  }

  if (telefono && (typeof telefono !== "string" || !phoneRegex.test(telefono.trim()))) {
    errors.push("El formato del número telefónico no es válido.");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validación del lado servidor fallida.",
      errors
    });
  }

  // Sanitizar
  req.body.nombre = nombre.trim();
  if (apellido) req.body.apellido = apellido.trim();
  req.body.email = email.trim().toLowerCase();
  if (telefono) req.body.telefono = telefono.trim();

  next();
}

/**
 * Validador para inicio de sesión
 */
function validateLogin(req, res, next) {
  const { email, password } = req.body;
  const errors = [];

  if (!email || typeof email !== "string" || !emailRegex.test(email.trim())) {
    errors.push("Ingrese un correo electrónico válido.");
  }

  if (!password || typeof password !== "string" || password.length < 1) {
    errors.push("Ingrese su contraseña.");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Credenciales incompletas o formato inválido.",
      errors
    });
  }

  req.body.email = email.trim().toLowerCase();
  next();
}

/**
 * Validador para creación / actualización de películas
 */
function validateMovie(req, res, next) {
  const { title, duration, priceStandard, priceVip } = req.body;
  const errors = [];

  if (!title || typeof title !== "string" || title.trim().length < 2) {
    errors.push("El título de la película es obligatorio (mínimo 2 caracteres).");
  }

  if (priceStandard !== undefined) {
    const num = Number(priceStandard);
    if (isNaN(num) || num <= 0) {
      errors.push("El precio estándar debe ser un número mayor a cero.");
    }
  }

  if (priceVip !== undefined) {
    const num = Number(priceVip);
    if (isNaN(num) || num <= 0) {
      errors.push("El precio VIP debe ser un número mayor a cero.");
    }
  }

  if (duration !== undefined && (typeof duration !== "string" && typeof duration !== "number")) {
    errors.push("La duración de la película no tiene un formato válido.");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Datos de película inválidos.",
      errors
    });
  }

  next();
}

/**
 * Validador para órdenes y reservas de boletos
 */
function validateOrder(req, res, next) {
  const { movieId, showtime, seats, total, customerEmail } = req.body;
  const errors = [];

  if (!movieId) {
    errors.push("Debe especificar la película a reservar.");
  }

  if (!showtime || typeof showtime !== "string" || showtime.trim().length === 0) {
    errors.push("Debe seleccionar un horario de función válido.");
  }

  if (!Array.isArray(seats) || seats.length === 0) {
    errors.push("Debe seleccionar al menos una butaca.");
  } else {
    const invalidSeat = seats.some(s => {
      const code = typeof s === "string" ? s : (s && s.code);
      return !code || typeof code !== "string" || code.length < 2;
    });
    if (invalidSeat) {
      errors.push("Uno o más códigos de butacas seleccionados son inválidos.");
    }
  }

  if (total !== undefined) {
    const totalNum = Number(total);
    if (isNaN(totalNum) || totalNum < 0) {
      errors.push("El monto total de la reserva no puede ser negativo.");
    }
  }

  if (customerEmail && (typeof customerEmail !== "string" || !emailRegex.test(customerEmail.trim()))) {
    errors.push("El correo del cliente tiene un formato inválido.");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Error de validación en la orden de reserva.",
      errors
    });
  }

  next();
}

/**
 * Validador para productos de confitería / snacks
 */
function validateSnack(req, res, next) {
  const { name, price, stock, costPrice } = req.body;
  const errors = [];

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    errors.push("El nombre del producto es obligatorio (mínimo 2 caracteres).");
  }

  if (price === undefined || isNaN(Number(price)) || Number(price) <= 0) {
    errors.push("El precio de venta debe ser un número mayor a 0.");
  }

  if (stock !== undefined && (isNaN(Number(stock)) || Number(stock) < 0)) {
    errors.push("El stock no puede ser un número negativo.");
  }

  if (costPrice !== undefined && (isNaN(Number(costPrice)) || Number(costPrice) < 0)) {
    errors.push("El costo unitario no puede ser negativo.");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Datos de confitería inválidos.",
      errors
    });
  }

  next();
}

/**
 * Validador para creación de usuarios del sistema
 */
function validateUser(req, res, next) {
  const { nombre, email, password } = req.body;
  const errors = [];

  if (!nombre || typeof nombre !== "string" || nombre.trim().length < 2) {
    errors.push("El nombre del usuario es obligatorio (mínimo 2 caracteres).");
  }

  if (!email || typeof email !== "string" || !emailRegex.test(email.trim())) {
    errors.push("Debe ingresar un correo electrónico válido.");
  }

  if (!password || typeof password !== "string" || password.length < 6) {
    errors.push("La contraseña debe tener al menos 6 caracteres.");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validación de usuario fallida.",
      errors
    });
  }

  req.body.email = email.trim().toLowerCase();
  next();
}

/**
 * Validador para proveedores
 */
function validateSupplier(req, res, next) {
  const { empresa, contacto_nombre, email, telefono } = req.body;
  const errors = [];

  if (!empresa || typeof empresa !== "string" || empresa.trim().length < 2) {
    errors.push("El nombre de la empresa proveedora es obligatorio.");
  }

  if (!contacto_nombre || typeof contacto_nombre !== "string" || contacto_nombre.trim().length < 2) {
    errors.push("El nombre de la persona de contacto es obligatorio.");
  }

  if (email && (typeof email !== "string" || !emailRegex.test(email.trim()))) {
    errors.push("El correo del proveedor no tiene un formato válido.");
  }

  if (telefono && (typeof telefono !== "string" || !phoneRegex.test(telefono.trim()))) {
    errors.push("El teléfono del proveedor no tiene un formato válido.");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Datos de proveedor inválidos.",
      errors
    });
  }

  next();
}

module.exports = {
  validateRegister,
  validateLogin,
  validateMovie,
  validateOrder,
  validateSnack,
  validateUser,
  validateSupplier
};
