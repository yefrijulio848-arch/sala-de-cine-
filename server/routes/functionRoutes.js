const express = require("express");
const router = express.Router();
const functionController = require("../controllers/functionController");

router.get("/", functionController.getFunctions);
router.get("/rooms", functionController.getRooms);
router.get("/rooms/:id", functionController.getRoomById);

module.exports = router;
