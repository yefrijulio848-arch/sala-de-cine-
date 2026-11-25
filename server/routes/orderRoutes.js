const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { authenticateToken, requireRole } = require("../middlewares/auth");
const { validateOrder, validateSnack } = require("../middlewares/validator");

// Reservas
router.post("/", authenticateToken, validateOrder, orderController.createOrder);
router.get("/", authenticateToken, orderController.getBookings);
router.get("/:id", orderController.getBookingById);
router.patch("/:id/food-status", authenticateToken, requireRole(["TRABAJADOR", "ADMIN"]), orderController.updateFoodStatus);
router.delete("/:id", authenticateToken, requireRole(["ADMIN"]), orderController.cancelBooking);

// Snacks
router.get("/snacks/all", orderController.getSnacks);
router.post("/snacks", authenticateToken, requireRole(["ADMIN"]), validateSnack, orderController.createSnack);
router.put("/snacks/:id", authenticateToken, requireRole(["ADMIN"]), validateSnack, orderController.updateSnack);
router.delete("/snacks/:id", authenticateToken, requireRole(["ADMIN"]), orderController.deleteSnack);

module.exports = router;
