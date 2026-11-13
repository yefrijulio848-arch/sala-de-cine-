const bcrypt = require("bcryptjs");
const Store = require("../models/store");

exports.getStats = async (req, res) => {
  try {
    const analytics = await Store.getAnalytics();
    return res.json({ success: true, data: analytics });
  } catch (error) {
    console.error("[Admin Stats Error]:", error);
    return res.status(500).json({ success: false, message: "Error al calcular estadísticas." });
  }
};

exports.getFinancials = async (req, res) => {
  try {
    const financials = await Store.getFinancialAnalytics();
    return res.json({ success: true, data: financials });
  } catch (error) {
    console.error("[Admin Financials Error]:", error);
    return res.status(500).json({ success: false, message: "Error al calcular balance financiero." });
  }
};

exports.getSettings = (req, res) => {
  try {
    return res.json({ success: true, data: Store.getSettings() });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al obtener configuración." });
  }
};

exports.updateSettings = (req, res) => {
  try {
    const updated = Store.updateSettings(req.body);
    return res.json({ success: true, message: "Parámetros actualizados con éxito.", data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al actualizar configuración." });
  }
};

// Generación de CSV para exportación
exports.exportCSV = (req, res) => {
  try {
    const { type } = req.query; // 'sales', 'inventory', 'financials'
    let csv = "";
    let filename = "reporte_cinemajestad.csv";

    if (type === "inventory") {
      filename = "inventario_dulceria.csv";
      csv = "ID,Nombre,Categoria,Costo Unitario,Precio Venta,Stock,Ganancia Unitaria,Margen Ganancia (%)\n";
      const snacks = Store.getSnacks();
      snacks.forEach(s => {
        const profit = s.price - (s.costPrice || 0);
        const margin = s.price > 0 ? ((profit / s.price) * 100).toFixed(1) : 0;
        csv += `"${s.id}","${s.name}","${s.category}",${s.costPrice || 0},${s.price},${s.stock},${profit.toFixed(2)},${margin}%\n`;
      });
    } else if (type === "financials") {
      filename = "balance_financiero_rentabilidad.csv";
      csv = "Producto,Categoria,Stock,Costo ($),Venta ($),Ganancia x Unidad ($),Margen (%),Unidades Vendidas,Ingresos Brutos ($),Costo Total Insumos ($),Utilidad Bruta Total ($)\n";
      const financials = Store.getFinancialAnalytics();
      financials.inventoryProfitability.forEach(p => {
        csv += `"${p.name}","${p.category}",${p.stock},${p.costPrice},${p.salePrice},${p.unitProfit},"${p.marginPercent}%",${p.unitsSold},${p.productTotalRevenue},${p.productTotalCost},${p.productTotalProfit}\n`;
      });
    } else if (type === "suppliers") {
      filename = "proveedores_cinemajestad.csv";
      csv = "ID,Empresa,NIT/RUT,Contacto,Telefono,Email,Categoria,Margen Ganancia (%),Comision Proveedor (%),Terminos de Pago,Estado,Notas\n";
      const suppliers = Store.getSuppliers();
      suppliers.forEach(sup => {
        csv += `"${sup.id}","${sup.empresa}","${sup.nit_rut || ''}","${sup.contacto_nombre}","${sup.telefono}","${sup.email}","${sup.categoria}",${sup.porcentaje_ganancia}%,${sup.porcentaje_comision}%,"${sup.terminos_pago}","${sup.estado}","${(sup.notas || '').replace(/"/g, '""')}"\n`;
      });
    } else {
      filename = "ventas_reservas.csv";
      csv = "ID Reserva,Fecha,Cliente,Email,Pelicula,Sala,Horario,Asientos,Subtotal Boletos,Subtotal Snacks,Total,Metodo Pago,Estado Comida\n";
      const bookings = Store.getBookings();
      bookings.forEach(b => {
        const seatsStr = (b.seats || []).join("; ");
        csv += `"${b.id}","${b.createdAt}","${b.customerName}","${b.customerEmail}","${b.movieTitle}","${b.hall}","${b.showtime}","${seatsStr}",${b.subtotalTickets},${b.subtotalSnacks},${b.total},"${b.paymentMethod}","${b.foodStatus}"\n`;
      });
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send("\uFEFF" + csv); // BOM UTF-8 para apertura directa en Excel
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al exportar reporte." });
  }
};

// Métodos CRUD para Proveedores vinculados a MySQL
exports.getSuppliers = async (req, res) => {
  try {
    const suppliers = await Store.getSuppliers();
    return res.status(200).json({ success: true, data: suppliers });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al obtener proveedores." });
  }
};

exports.createSupplier = async (req, res) => {
  try {
    const { empresa, contacto_nombre, telefono, email } = req.body;
    if (!empresa || !contacto_nombre) {
      return res.status(400).json({ success: false, message: "Nombre de empresa y contacto son requeridos." });
    }
    const newSupplier = await Store.createSupplier(req.body);
    return res.status(201).json({ success: true, data: newSupplier, message: "Proveedor registrado con éxito." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al registrar proveedor." });
  }
};

exports.updateSupplier = async (req, res) => {
  try {
    const updated = await Store.updateSupplier(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: "Proveedor no encontrado." });
    }
    return res.status(200).json({ success: true, data: updated, message: "Proveedor actualizado con éxito." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al actualizar proveedor." });
  }
};

exports.deleteSupplier = async (req, res) => {
  try {
    const deleted = await Store.deleteSupplier(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Proveedor no encontrado." });
    }
    return res.status(200).json({ success: true, message: "Proveedor eliminado exitosamente." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al eliminar proveedor." });
  }
};

// =============================================================================
// ROLES Y GESTIÓN DE ACCESO
// =============================================================================
exports.getRoles = async (req, res) => {
  try {
    const roles = await Store.getRoles();
    return res.json({ success: true, data: roles });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al obtener roles del sistema." });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await Store.getUsers();
    return res.json({ success: true, data: users });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al obtener usuarios." });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { nombre, apellido, email, password, telefono, rol, rol_id } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Nombre, email y contraseña son obligatorios."
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "El formato de correo no es válido."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "La contraseña debe tener mínimo 6 caracteres."
      });
    }

    const existingUser = await Store.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Ya existe un usuario con este correo electrónico."
      });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const role = rol_id ? Store.findRoleById(rol_id) : (rol ? Store.findRoleBySlug(rol) : Store.findRoleBySlug("CLIENTE"));

    const newUser = await Store.createUser({
      nombre,
      apellido: apellido || "",
      email,
      password_hash,
      telefono: telefono || "",
      rol: role ? role.slug : (rol || "CLIENTE"),
      rol_id: role ? role.id : (rol_id || 5)
    });

    return res.status(201).json({
      success: true,
      message: "Usuario registrado con éxito en la base de datos.",
      data: newUser
    });
  } catch (error) {
    console.error("[Admin Create User Error]:", error);
    return res.status(500).json({ success: false, message: "Error al registrar usuario." });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    const { rol_id } = req.body;
    if (!rol_id) {
      return res.status(400).json({ success: false, message: "El rol_id es requerido." });
    }
    const updated = await Store.updateUserRole(req.params.id, rol_id);
    if (!updated) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado." });
    }
    return res.json({ success: true, data: updated, message: "Rol asignado correctamente al usuario." });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const deleted = await Store.deleteUser(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado." });
    }
    return res.json({ success: true, message: "Usuario eliminado correctamente." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al eliminar usuario." });
  }
};
