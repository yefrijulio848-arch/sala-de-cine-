const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticateToken, requireAuth } = require("../middlewares/auth");

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", authenticateToken, requireAuth, authController.getProfile);

module.exports = router;
