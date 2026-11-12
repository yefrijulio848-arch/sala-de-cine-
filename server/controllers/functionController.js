const Store = require("../models/store");

exports.getRooms = (req, res) => {
  try {
    const rooms = Store.getRooms();
    return res.json({ success: true, count: rooms.length, data: rooms });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al obtener salas." });
  }
};

exports.getRoomById = (req, res) => {
  try {
    const room = Store.getRoomById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: "Sala no encontrada." });
    return res.json({ success: true, data: room });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al consultar sala." });
  }
};

exports.getFunctions = async (req, res) => {
  try {
    const movies = await Store.getMovies();
    const rooms = Store.getRooms();
    const functionsList = [];

    movies.forEach(m => {
      const room = rooms.find(r => r.id === m.roomId || r.name === m.hall) || rooms[0];
      (m.showtimes || []).forEach(time => {
        const key = `${m.id}_${time}`;
        const seatStatus = Store.getSeatStatusMap(key);
        const occupiedCount = seatStatus.occupied.length;
        const totalCapacity = room.capacity || 60;
        const percent = Math.round((occupiedCount / totalCapacity) * 100);

        functionsList.push({
          key,
          movieId: m.id,
          movieTitle: m.title,
          poster: m.poster,
          duration: m.duration,
          hall: m.hall,
          roomId: room.id,
          showtime: time,
          priceStandard: m.priceStandard,
          priceVip: m.priceVip,
          capacity: totalCapacity,
          occupiedCount,
          availableCount: Math.max(0, totalCapacity - occupiedCount),
          occupancyPercent: percent
        });
      });
    });

    return res.json({ success: true, count: functionsList.length, data: functionsList });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al obtener funciones programadas." });
  }
};
