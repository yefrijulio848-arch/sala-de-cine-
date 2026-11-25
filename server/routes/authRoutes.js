const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticateToken, requireAuth } = require("../middlewares/auth");
const { validateRegister, validateLogin } = require("../middlewares/validator");

router.post("/register", validateRegister, authController.register);
router.post("/login", validateLogin, authController.login);
router.get("/me", authenticateToken, requireAuth, authController.getProfile);

module.exports = router;
