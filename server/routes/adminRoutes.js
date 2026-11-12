const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { authenticateToken, requireRole } = require("../middlewares/auth");

router.get("/stats", authenticateToken, requireRole(["ADMIN"]), adminController.getStats);
router.get("/financials", authenticateToken, requireRole(["ADMIN"]), adminController.getFinancials);
router.get("/settings", adminController.getSettings);
router.put("/settings", authenticateToken, requireRole(["ADMIN"]), adminController.updateSettings);
router.get("/export", authenticateToken, requireRole(["ADMIN"]), adminController.exportCSV);

// Rutas de Proveedores (Suppliers)
router.get("/suppliers", authenticateToken, requireRole(["ADMIN"]), adminController.getSuppliers);
router.post("/suppliers", authenticateToken, requireRole(["ADMIN"]), adminController.createSupplier);
router.put("/suppliers/:id", authenticateToken, requireRole(["ADMIN"]), adminController.updateSupplier);
router.delete("/suppliers/:id", authenticateToken, requireRole(["ADMIN"]), adminController.deleteSupplier);

// Rutas de Roles y Usuarios
router.get("/roles", authenticateToken, requireRole(["ADMIN", "GERENTE"]), adminController.getRoles);
router.get("/users", authenticateToken, requireRole(["ADMIN", "GERENTE"]), adminController.getUsers);
router.post("/users", authenticateToken, requireRole(["ADMIN"]), adminController.createUser);
router.put("/users/:id/role", authenticateToken, requireRole(["ADMIN"]), adminController.updateUserRole);
router.delete("/users/:id", authenticateToken, requireRole(["ADMIN"]), adminController.deleteUser);

module.exports = router;
