const Store = require("../models/store");

exports.getAllMovies = async (req, res) => {
  try {
    const movies = await Store.getMovies();
    return res.json({ success: true, count: movies.length, data: movies });
  } catch (error) {
    console.error("[Movies Error]:", error);
    return res.status(500).json({ success: false, message: "Error al obtener cartelera de películas." });
  }
};

exports.getMovieById = async (req, res) => {
  try {
    const movie = await Store.getMovieById(req.params.id);
    if (!movie) {
      return res.status(404).json({ success: false, message: "Película no encontrada." });
    }
    return res.json({ success: true, data: movie });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al consultar película." });
  }
};

exports.createMovie = async (req, res) => {
  try {
    const { title, duration, priceStandard, priceVip } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: "El título de la película es obligatorio." });
    }
    const newMovie = await Store.createMovie(req.body);
    return res.status(201).json({ success: true, message: "Película agregada con éxito.", data: newMovie });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al crear película." });
  }
};

exports.updateMovie = async (req, res) => {
  try {
    const updated = await Store.updateMovie(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: "Película no encontrada." });
    }
    return res.json({ success: true, message: "Película actualizada con éxito.", data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al actualizar película." });
  }
};

exports.deleteMovie = async (req, res) => {
  try {
    const success = await Store.deleteMovie(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, message: "Película no encontrada." });
    }
    return res.json({ success: true, message: "Película eliminada de la cartelera." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al eliminar película." });
  }
};
