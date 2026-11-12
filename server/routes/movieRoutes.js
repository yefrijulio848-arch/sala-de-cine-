const express = require("express");
const router = express.Router();
const movieController = require("../controllers/movieController");
const { authenticateToken, requireRole } = require("../middlewares/auth");

router.get("/", movieController.getAllMovies);
router.get("/:id", movieController.getMovieById);
router.post("/", authenticateToken, requireRole(["ADMIN"]), movieController.createMovie);
router.put("/:id", authenticateToken, requireRole(["ADMIN"]), movieController.updateMovie);
router.delete("/:id", authenticateToken, requireRole(["ADMIN"]), movieController.deleteMovie);

module.exports = router;
