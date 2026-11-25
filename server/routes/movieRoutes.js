const express = require("express");
const router = express.Router();
const movieController = require("../controllers/movieController");
const { authenticateToken, requireRole } = require("../middlewares/auth");
const { validateMovie } = require("../middlewares/validator");

router.get("/", movieController.getAllMovies);
router.get("/:id", movieController.getMovieById);
router.post("/", authenticateToken, requireRole(["ADMIN"]), validateMovie, movieController.createMovie);
router.put("/:id", authenticateToken, requireRole(["ADMIN"]), validateMovie, movieController.updateMovie);
router.delete("/:id", authenticateToken, requireRole(["ADMIN"]), movieController.deleteMovie);

module.exports = router;
