const express = require("express");
const router = express.Router();
const seatController = require("../controllers/seatController");
const { authenticateToken } = require("../middlewares/auth");

router.get("/:showtimeKey", seatController.getSeatsStatus);
router.post("/hold", authenticateToken, seatController.holdSeat);
router.post("/release", authenticateToken, seatController.releaseSeat);

module.exports = router;
