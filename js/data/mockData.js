/* ==========================================================================
   Cine Majestad - Base de Datos Local, Modelos y Sincronización en Tiempo Real
   ========================================================================== */

// Migración transparente de llaves previas (cinemagestad_* -> cinemajestad_*)
try {
  ["movies", "snacks", "bookings", "rooms", "settings", "seat_locks", "seat_overrides", "suppliers", "users", "token", "auth_user"].forEach(k => {
    const oldVal = localStorage.getItem("cinemagestad_" + k);
    if (oldVal && !localStorage.getItem("cinemajestad_" + k)) {
      localStorage.setItem("cinemajestad_" + k, oldVal);
    }
  });
} catch (e) {}

// Identificador único de sesión para esta pestaña / cliente
function getOrCreateSessionId() {
  let sessionId = sessionStorage.getItem("cinemajestad_session_id") || sessionStorage.getItem("cinemagestad_session_id");
  if (!sessionId) {
    sessionId = "sess_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now().toString(36);
    sessionStorage.setItem("cinemajestad_session_id", sessionId);
  }
  return sessionId;
}

const CURRENT_SESSION_ID = getOrCreateSessionId();

// Canal de Broadcast para sincronización instantánea entre pestañas / ventanas
let syncChannel = null;
try {
  if (typeof BroadcastChannel !== "undefined") {
    syncChannel = new BroadcastChannel("cinemajestad_channel");
  }
} catch (e) {
  console.warn("BroadcastChannel no soportado en este entorno", e);
}

// Configuración general del cine
const DEFAULT_SETTINGS = {
  cinemaName: "Cine Majestad",
  slogan: "La Majestad del Séptimo Arte",
  phone: "+57 (601) 789-2026",
  address: "Av. Principal Real #104, Centro Comercial Gran Plaza",
  hours: "Lunes a Domingo: 12:00 PM - 11:30 PM",
  seatHoldMinutes: 5, // Minutos que dura el bloqueo temporal de un asiento
  maxSeatsPerTransaction: 8,
  currency: "$",
  pricingRules: {
    weekendSurchargeStandard: 1.50, // Recargo para sábados y domingos (Estándar)
    weekendSurchargeVip: 2.00,      // Recargo para sábados y domingos (VIP)
    wednesdayPromo2x1: true,        // Promoción 2x1 en boletería los miércoles
    weekendNotice: "Tarifa Fin de Semana (+alta demanda)",
    calmDayNotice: "Tarifa Días Calmados (Económica)",
    wednesdayPromoNotice: "¡Miércoles 2x1 en Boletería!"
  }
};

// Salas y Esquemas Arquitectónicos de Asientos
const INITIAL_ROOMS = [
  {
    id: "sala-1",
    name: "Sala 1 (IMAX Laser & Dolby)",
    technology: "IMAX Laser",
    layoutType: "curved_imax",
    layoutBadge: "🏛️ Anfiteatro Curvo IMAX",
    layoutDesc: "Distribución semicircular en abanico con pantalla curva gigante y visión envolvente",
    rows: ["A", "B", "C", "D", "E", "F"],
    seatsPerRow: 10,
    vipRows: ["E", "F"],
    wheelchairSeats: ["A-1", "A-2"],
    doors: [
      { id: "front-left", active: true, type: "SALIDA", label: "🟢 SALIDA DE EMERGENCIA" },
      { id: "front-right", active: true, type: "ENTRADA", label: "🚪 ENTRADA SALA" },
      { id: "back-left", active: true, type: "ENTRADA", label: "🚪 ENTRADA SALA" },
      { id: "back-right", active: false, type: "SALIDA", label: "🟢 SALIDA DE EMERGENCIA" }
    ],
    capacity: 60,
    screenType: "Curva Gigante 4K",
    soundSystem: "Dolby Atmos 64 Canales"
  },
  {
    id: "sala-2",
    name: "Sala 2 (70mm Master Cinema)",
    technology: "70mm Film",
    layoutType: "stadium_double_aisle",
    layoutBadge: "🏟️ Estadio 3 Bloques (Doble Pasillo)",
    layoutDesc: "Tribuna de 3 bloques con doble pasillo de escalones iluminados y puestos accesibles ♿",
    rows: ["A", "B", "C", "D", "E", "F"],
    seatsPerRow: 10,
    vipRows: ["E", "F"],
    wheelchairCols: [1, 10],
    wheelchairSeats: ["A-1", "A-10"],
    doors: [
      { id: "front-left", active: true, type: "SALIDA", label: "🟢 SALIDA DE EMERGENCIA" },
      { id: "front-right", active: true, type: "SALIDA", label: "🟢 SALIDA DE EMERGENCIA" },
      { id: "back-left", active: true, type: "ENTRADA", label: "🚪 ENTRADA SALA" },
      { id: "back-right", active: true, type: "ENTRADA", label: "🚪 ENTRADA SALA" }
    ],
    capacity: 60,
    screenType: "Plana 70mm Panavision",
    soundSystem: "DTS-X Surround"
  },
  {
    id: "sala-3",
    name: "Sala 3 (Dolby Atmos 360°)",
    technology: "Dolby Atmos",
    layoutType: "motion_4dx",
    layoutBadge: "🚀 Pods Mecánicos 4DX",
    layoutDesc: "Plataformas de movimiento síncrono en pods con pasillo central para efectos climáticos",
    rows: ["A", "B", "C", "D", "E"],
    seatsPerRow: 10,
    vipRows: ["E"],
    wheelchairSeats: ["A-1", "A-2"],
    doors: [
      { id: "front-left", active: true, type: "SALIDA", label: "🟢 SALIDA DE EMERGENCIA" },
      { id: "front-right", active: false, type: "SALIDA", label: "🟢 SALIDA DE EMERGENCIA" },
      { id: "back-left", active: true, type: "ENTRADA", label: "🚪 ENTRADA SALA" },
      { id: "back-right", active: false, type: "ENTRADA", label: "🚪 ENTRADA SALA" }
    ],
    capacity: 50,
    screenType: "Microperforada 2K",
    soundSystem: "Dolby Atmos 360°"
  },
  {
    id: "sala-4",
    name: "Sala 4 (VIP Royal Lounge)",
    technology: "VIP Luxury",
    layoutType: "vip_lounge",
    layoutBadge: "👑 Palcos VIP & Sofás Dobles",
    layoutDesc: "Salón boutique con sofás reclinables de cuero dobles para parejas y mesitas auxiliares",
    rows: ["A", "B", "C", "D"],
    seatsPerRow: 8,
    vipRows: ["A", "B", "C", "D"],
    wheelchairSeats: ["A-1", "A-2"],
    doors: [
      { id: "front-left", active: true, type: "SALIDA", label: "🟢 SALIDA DE EMERGENCIA" },
      { id: "front-right", active: false, type: "SALIDA", label: "🟢 SALIDA DE EMERGENCIA" },
      { id: "back-left", active: true, type: "ENTRADA", label: "🚪 ENTRADA SALA" },
      { id: "back-right", active: true, type: "ENTRADA", label: "🚪 ENTRADA SALA" }
    ],
    capacity: 32,
    screenType: "Pantalla Láser Premium",
    soundSystem: "Bowers & Wilkins Hi-Fi"
  }
];

// Cálculo y Gestión de Vigencia en Cartelera y Preventas
function calculateMovieEndDate(startDateStr, durationDays) {
  if (!startDateStr) return "";
  const parts = String(startDateStr).split("T")[0].split("-");
  if (parts.length !== 3) return "";
  const days = Math.max(1, parseInt(durationDays, 10) || 1);
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  d.setDate(d.getDate() + days - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMovieVigenciaInfo(movie) {
  if (!movie) return {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isPresale = movie.releaseType === "PREVENTA" || movie.isPresale === true;
  const startDateStr = movie.startDate || (isPresale ? "2026-11-28" : "2026-11-15");
  const durationDays = parseInt(movie.durationDays, 10) || 21;
  const endDateStr = movie.endDate || calculateMovieEndDate(startDateStr, durationDays);

  const startParts = String(startDateStr).split("T")[0].split("-");
  const endParts = String(endDateStr).split("T")[0].split("-");

  const startDate = startParts.length === 3 
    ? new Date(parseInt(startParts[0], 10), parseInt(startParts[1], 10) - 1, parseInt(startParts[2], 10)) 
    : today;
  const endDate = endParts.length === 3 
    ? new Date(parseInt(endParts[0], 10), parseInt(endParts[1], 10) - 1, parseInt(endParts[2], 10)) 
    : today;

  const msPerDay = 1000 * 60 * 60 * 24;
  const diffDaysFromToday = Math.round((endDate.getTime() - today.getTime()) / msPerDay);
  const diffDaysToStart = Math.round((startDate.getTime() - today.getTime()) / msPerDay);

  let statusLabel = "";
  let badgeClass = "";
  let badgeText = "";
  let daysNotice = "";

  if (isPresale) {
    badgeClass = "badge-presale";
    badgeText = "🎟️ PREVENTA";
    if (diffDaysToStart > 0) {
      statusLabel = `Estreno en ${diffDaysToStart} días`;
      daysNotice = `Preventa Activa • Estreno el ${startDate.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`;
    } else {
      statusLabel = "¡Preventa / Estreno Hoy!";
      daysNotice = "¡Estreno en cines hoy!";
    }
  } else {
    badgeClass = "badge-now-showing";
    badgeText = "🔥 EN CARTELERA";
    if (diffDaysFromToday > 0) {
      statusLabel = `Quedan ${diffDaysFromToday} días en cartelera`;
      daysNotice = `En cartelera: hasta el ${endDate.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} (${diffDaysFromToday} días restantes)`;
    } else if (diffDaysFromToday === 0) {
      statusLabel = "Último día en cartelera";
      daysNotice = "¡Último día en cartelera hoy!";
    } else {
      statusLabel = "Finalizada";
      daysNotice = "Temporada finalizada en cartelera";
    }
  }

  return {
    isPresale,
    releaseType: isPresale ? "PREVENTA" : "CARTELERA",
    startDate: startDateStr,
    durationDays,
    endDate: endDateStr,
    diffDaysFromToday,
    diffDaysToStart,
    statusLabel,
    badgeClass,
    badgeText,
    daysNotice,
    startDateFormatted: startDate.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }),
    endDateFormatted: endDate.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
  };
}

function normalizeMovieData(movie, index = 0) {
  if (!movie || typeof movie !== "object") return movie;

  const isPresale = movie.releaseType === "PREVENTA" || movie.isPresale === true || (index === 3 && !movie.releaseType);
  const releaseType = isPresale ? "PREVENTA" : (movie.releaseType || "CARTELERA");
  
  let defaultStart = "2026-11-10";
  let defaultDays = 21;
  if (isPresale) {
    defaultStart = "2026-11-28";
    defaultDays = 30;
  } else if (index === 0) {
    defaultStart = "2026-11-10";
    defaultDays = 28;
  } else if (index === 2) {
    defaultStart = "2026-11-01";
    defaultDays = 30;
  }

  const startDate = movie.startDate || defaultStart;
  const durationDays = parseInt(movie.durationDays, 10) || defaultDays;
  const endDate = movie.endDate || calculateMovieEndDate(startDate, durationDays);

  return {
    ...movie,
    releaseType,
    isPresale,
    startDate,
    durationDays,
    endDate
  };
}

// Catálogo Inicial de Películas con Vigencia en Cartelera y Preventa
const INITIAL_MOVIES = [
  {
    id: "mov-01",
    title: "Dune: Parte Dos",
    genre: "Ciencia Ficción",
    duration: "166 min",
    rating: 8.8,
    ageRating: "B-15",
    formats: ["IMAX", "3D", "Atmos"],
    director: "Denis Villeneuve",
    synopsis: "Paul Atreides se une a Chani y a los Fremen mientras busca venganza contra los conspiradores que destruyeron a su familia. Ante la encrucijada del universo, se esfuerza por evitar un futuro terrible.",
    poster: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80",
    backdrop: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1600&q=80",
    trailerUrl: "https://www.youtube.com/embed/Way9Dexny3w",
    priceStandard: 6.50,
    priceVip: 10.00,
    showtimes: ["14:30", "17:45", "21:00"],
    hall: "Sala 1 (IMAX Laser & Dolby)",
    roomId: "sala-1",
    isFeatured: true,
    releaseType: "CARTELERA",
    isPresale: false,
    startDate: "2026-11-10",
    durationDays: 28,
    endDate: "2026-12-07"
  },
  {
    id: "mov-02",
    title: "Spider-Man: A Través del Spider-Verso",
    genre: "Animación",
    duration: "140 min",
    rating: 8.9,
    ageRating: "A",
    formats: ["2D", "3D"],
    director: "Joaquim Dos Santos, Kemp Powers",
    synopsis: "Miles Morales es catapultado a través del Multiverso, donde se encuentra con un equipo de Spider-People encargados de proteger su propia existencia ante una nueva y colosal amenaza.",
    poster: "https://images.unsplash.com/photo-1635805737707-575885ab0820?auto=format&fit=crop&w=600&q=80",
    backdrop: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1600&q=80",
    trailerUrl: "https://www.youtube.com/embed/cqGjhVJWtEg",
    priceStandard: 5.50,
    priceVip: 8.50,
    showtimes: ["13:00", "16:15", "19:30"],
    hall: "Sala 3 (Dolby Atmos 360°)",
    roomId: "sala-3",
    isFeatured: false,
    releaseType: "CARTELERA",
    isPresale: false,
    startDate: "2026-11-05",
    durationDays: 21,
    endDate: "2026-11-25"
  },
  {
    id: "mov-03",
    title: "Oppenheimer",
    genre: "Drama",
    duration: "180 min",
    rating: 8.9,
    ageRating: "B-15",
    formats: ["IMAX", "2D"],
    director: "Christopher Nolan",
    synopsis: "La historia del físico teórico J. Robert Oppenheimer y su liderazgo en el Proyecto Manhattan que culminó en el desarrollo de la bomba atómica y cambió el mundo para siempre.",
    poster: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=600&q=80",
    backdrop: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=80",
    trailerUrl: "https://www.youtube.com/embed/uYPbbksJxIg",
    priceStandard: 6.00,
    priceVip: 9.50,
    showtimes: ["15:00", "18:45", "22:15"],
    hall: "Sala 2 (70mm Master Cinema)",
    roomId: "sala-2",
    isFeatured: false,
    releaseType: "CARTELERA",
    isPresale: false,
    startDate: "2026-11-01",
    durationDays: 30,
    endDate: "2026-11-30"
  },
  {
    id: "mov-04",
    title: "Interstellar (Edición Aniversario)",
    genre: "Ciencia Ficción",
    duration: "169 min",
    rating: 8.7,
    ageRating: "A",
    formats: ["IMAX", "Atmos"],
    director: "Christopher Nolan",
    synopsis: "Un equipo de exploradores liderado por Joseph Cooper viaja a través de un agujero de gusano interestelar en un heroico intento por encontrar un nuevo hogar para la humanidad.",
    poster: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80",
    backdrop: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1600&q=80",
    trailerUrl: "https://www.youtube.com/embed/zSWdZVtXT7E",
    priceStandard: 6.50,
    priceVip: 10.00,
    showtimes: ["17:00", "20:30"],
    hall: "Sala 1 (IMAX Laser & Dolby)",
    roomId: "sala-1",
    isFeatured: false,
    releaseType: "PREVENTA",
    isPresale: true,
    startDate: "2026-11-28",
    durationDays: 30,
    endDate: "2026-12-27"
  },
  {
    id: "mov-05",
    title: "El Caballero de la Noche",
    genre: "Acción",
    duration: "152 min",
    rating: 9.0,
    ageRating: "B-15",
    formats: ["2D", "Atmos"],
    director: "Christopher Nolan",
    synopsis: "Batman asciende las apuestas en su guerra contra el crimen. Con la ayuda del teniente Jim Gordon y el fiscal Harvey Dent, se propone desmantelar las mafias que azotan Gotham, pero el Guasón desata la anarquía.",
    poster: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=600&q=80",
    backdrop: "https://images.unsplash.com/photo-1514306191717-452ec28c7814?auto=format&fit=crop&w=1600&q=80",
    trailerUrl: "https://www.youtube.com/embed/EXeTwQWrcwY",
    priceStandard: 5.50,
    priceVip: 8.50,
    showtimes: ["16:00", "19:00", "22:00"],
    hall: "Sala 4 (VIP Royal Lounge)",
    roomId: "sala-4",
    isFeatured: false,
    releaseType: "CARTELERA",
    isPresale: false,
    startDate: "2026-11-12",
    durationDays: 21,
    endDate: "2026-12-02"
  }
];

// Imágenes oficiales de alta resolución y respaldo para Confitería
function getSnackFallbackImage(category = "", name = "") {
  const cat = String(category || "").toLowerCase();
  const n = String(name || "").toLowerCase();

  if (cat.includes("combo") || n.includes("combo")) {
    return "https://images.unsplash.com/photo-1585647347384-2593bc35786b?auto=format&fit=crop&w=600&q=80";
  }
  if (cat.includes("palo") || cat.includes("crisp") || n.includes("palo") || n.includes("crisp")) {
    return "https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=600&q=80";
  }
  if (cat.includes("nacho") || n.includes("nacho")) {
    return "https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&w=600&q=80";
  }
  if (cat.includes("hot") || cat.includes("perro") || n.includes("hot") || n.includes("perro")) {
    return "https://images.unsplash.com/photo-1619740455993-9e612b1af08a?auto=format&fit=crop&w=600&q=80";
  }
  if (cat.includes("beb") || cat.includes("refresco") || cat.includes("gaseosa") || n.includes("refresco") || n.includes("coca")) {
    return "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80";
  }
  if (cat.includes("dulce") || cat.includes("choc") || n.includes("caramelo") || n.includes("dulce")) {
    return "https://images.unsplash.com/photo-1505686994434-e3cc5abf1330?auto=format&fit=crop&w=600&q=80";
  }
  return "https://images.unsplash.com/photo-1585647347483-22b66260dfff?auto=format&fit=crop&w=600&q=80";
}

function normalizeSnackItem(item) {
  if (!item || typeof item !== "object") return item;

  const validImg = (item.img && typeof item.img === "string" && item.img.startsWith("http"))
    ? item.img
    : ((item.image && typeof item.image === "string" && item.image.startsWith("http"))
      ? item.image
      : ((item.imagen_url && typeof item.imagen_url === "string" && item.imagen_url.startsWith("http"))
        ? item.imagen_url
        : getSnackFallbackImage(item.category, item.name)));

  const validDesc = (item.desc && typeof item.desc === "string" && item.desc.trim() !== "" && item.desc !== "undefined")
    ? item.desc
    : ((item.description && typeof item.description === "string" && item.description.trim() !== "" && item.description !== "undefined")
      ? item.description
      : ((item.descripcion && typeof item.descripcion === "string" && item.descripcion.trim() !== "" && item.descripcion !== "undefined")
        ? item.descripcion
        : "Acompaña tu película con nuestros mejores snacks recién preparados y bebidas heladas."));

  const validTag = item.tag || item.badge || item.etiqueta || "Popular";
  const validCat = String(item.category || "snacks").toLowerCase();

  return {
    ...item,
    img: validImg,
    image: validImg,
    imagen_url: validImg,
    desc: validDesc,
    description: validDesc,
    descripcion: validDesc,
    tag: validTag,
    badge: validTag,
    etiqueta: validTag,
    category: validCat,
    price: typeof item.price === "number" ? item.price : (parseFloat(item.precio || item.price) || 0),
    costPrice: typeof item.costPrice === "number" ? item.costPrice : (parseFloat(item.precio_costo || item.costPrice) || 0),
    stock: typeof item.stock === "number" ? item.stock : (parseInt(item.stock_disponible || item.stock, 10) || 0)
  };
}

// Catálogo Inicial de Confitería / Dulcería
const INITIAL_SNACKS = [
  {
    id: "snack-01",
    name: "Combo Majestad Dúo Real",
    category: "combos",
    desc: "1 Palomitas gigantes (mantequilla o caramelo) + 2 Bebidas grandes heladas + 1 Hot Dog supremo o Nachos cheddar.",
    description: "1 Palomitas gigantes (mantequilla o caramelo) + 2 Bebidas grandes heladas + 1 Hot Dog supremo o Nachos cheddar.",
    costPrice: 3.80,
    price: 13.50,
    tag: "Más Vendido",
    badge: "Más Vendido",
    img: "https://images.unsplash.com/photo-1585647347384-2593bc35786b?auto=format&fit=crop&w=600&q=80",
    image: "https://images.unsplash.com/photo-1585647347384-2593bc35786b?auto=format&fit=crop&w=600&q=80",
    stock: 250
  },
  {
    id: "snack-02",
    name: "Palomitas Mega Mantequilla Dorada",
    category: "palomitas",
    desc: "Crujientes granos de maíz gourmet recién preparados, bañados en generosa mantequilla dorada caliente.",
    description: "Crujientes granos de maíz gourmet recién preparados, bañados en generosa mantequilla dorada caliente.",
    costPrice: 0.90,
    price: 5.80,
    tag: "Clásico",
    badge: "Clásico",
    img: "https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=600&q=80",
    image: "https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=600&q=80",
    stock: 400
  },
  {
    id: "snack-03",
    name: "Nachos Suprema con Queso Fundido",
    category: "snacks",
    desc: "Crujientes totopos de maíz con abundante queso cheddar caliente, frijoles negros y rodajas de jalapeños.",
    description: "Crujientes totopos de maíz con abundante queso cheddar caliente, frijoles negros y rodajas de jalapeños.",
    costPrice: 1.80,
    price: 6.50,
    tag: "Crujiente",
    badge: "Crujiente",
    img: "https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&w=600&q=80",
    image: "https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&w=600&q=80",
    stock: 300
  },
  {
    id: "snack-04",
    name: "Refresco Ice Cold 32oz",
    category: "bebidas",
    desc: "Bebida gasificada helada a elección (Coca-Cola, Sprite, Fanta, Té frío de limón o Manzana).",
    description: "Bebida gasificada helada a elección (Coca-Cola, Sprite, Fanta, Té frío de limón o Manzana).",
    costPrice: 0.60,
    price: 3.50,
    tag: "Refrescante",
    badge: "Refrescante",
    img: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80",
    image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80",
    stock: 600
  },
  {
    id: "snack-05",
    name: "Combo Dulzura Caramelo Imperial",
    category: "combos",
    desc: "Palomitas de caramelo artesanal crocante + 1 Bebida gigante + 1 Chocolate M&M's familiar.",
    description: "Palomitas de caramelo artesanal crocante + 1 Bebida gigante + 1 Chocolate M&M's familiar.",
    costPrice: 2.60,
    price: 10.20,
    tag: "Favorito",
    badge: "Favorito",
    img: "https://images.unsplash.com/photo-1505686994434-e3cc5abf1330?auto=format&fit=crop&w=600&q=80",
    image: "https://images.unsplash.com/photo-1505686994434-e3cc5abf1330?auto=format&fit=crop&w=600&q=80",
    stock: 180
  },
  {
    id: "snack-06",
    name: "Hot Dog Majestad Jumbo",
    category: "snacks",
    desc: "Salchicha alemana de res en pan brioche artesanal con queso derretido, tocino crocante y salsas.",
    description: "Salchicha alemana de res en pan brioche artesanal con queso derretido, tocino crocante y salsas.",
    costPrice: 1.90,
    price: 5.90,
    tag: "Especial",
    badge: "Especial",
    img: "https://images.unsplash.com/photo-1619740455993-9e612b1af08a?auto=format&fit=crop&w=600&q=80",
    image: "https://images.unsplash.com/photo-1619740455993-9e612b1af08a?auto=format&fit=crop&w=600&q=80",
    stock: 220
  }
];

// Catálogo Inicial de Proveedores y Acuerdos Comerciales
const INITIAL_SUPPLIERS = [
  {
    id: "prov-01",
    empresa: "Distribuidora Maíz & Granos del Valle SAS",
    nit_rut: "900.874.120-1",
    contacto_nombre: "Juan Carlos Mendoza",
    telefono: "+57 312 456 7890",
    email: "ventas@maizdelvalle.com",
    categoria: "Maíz y Granos",
    porcentaje_ganancia: 65.0,
    porcentaje_comision: 5.0,
    terminos_pago: "Crédito 30 días",
    estado: "ACTIVO",
    direccion: "Zona Industrial Puente Aranda, Bodega 14",
    notas: "Proveedor principal de maíz pisingallo premium y aceites de mantequilla dorada."
  },
  {
    id: "prov-02",
    empresa: "Coca-Cola FEMSA Distribución",
    nit_rut: "860.001.234-5",
    contacto_nombre: "Marcela Suárez",
    telefono: "+57 320 889 1122",
    email: "pedidos.cine@femsa.com",
    categoria: "Bebidas",
    porcentaje_ganancia: 80.0,
    porcentaje_comision: 0.0,
    terminos_pago: "Crédito 15 días",
    estado: "ACTIVO",
    direccion: "Parque Empresarial del Norte, Módulo B",
    notas: "Distribuidor exclusivo de concentrados para dispensadores 32oz, agua brisa y jugos."
  },
  {
    id: "prov-03",
    empresa: "Empaques & Vasos Biodegradables CinePack",
    nit_rut: "901.332.998-3",
    contacto_nombre: "Andrés Felipe Gómez",
    telefono: "+57 301 776 5432",
    email: "contacto@cinepack.co",
    categoria: "Empaques & Vasos",
    porcentaje_ganancia: 45.0,
    porcentaje_comision: 2.0,
    terminos_pago: "Contado",
    estado: "ACTIVO",
    direccion: "Calle 68 # 45-20, Centro Logístico",
    notas: "Cajas de palomitas personalizadas con logo de Cine Majestad y vasos ecológicos."
  },
  {
    id: "prov-04",
    empresa: "Golosinas & Chocolates Nacionales SAS",
    nit_rut: "890.102.554-9",
    contacto_nombre: "Carolina Herrera",
    telefono: "+57 315 223 9988",
    email: "carolina@chocolatesnac.com",
    categoria: "Dulces y Chocolates",
    porcentaje_ganancia: 55.0,
    porcentaje_comision: 3.5,
    terminos_pago: "Crédito 30 días",
    estado: "ACTIVO",
    direccion: "Av. Las Américas # 72-10",
    notas: "Chocolates confitados, gomitas ácidas y caramelos masticables para combos infantiles."
  },
  {
    id: "prov-05",
    empresa: "Carnes Frías & Embutidos Premium Gourmet",
    nit_rut: "900.551.442-8",
    contacto_nombre: "Roberto Duque",
    telefono: "+57 318 990 4455",
    email: "rduque@carnespremium.co",
    categoria: "Snacks Calientes",
    porcentaje_ganancia: 50.0,
    porcentaje_comision: 0.0,
    terminos_pago: "Contado",
    estado: "ACTIVO",
    direccion: "Cra 50 # 22-80",
    notas: "Salchichas gigantes tipo Frankfurt para Hot Dogs Jumbo y queso cheddar caliente."
  }
];

// Presets de asientos inicialmente ocupados por función para realismo
const INITIAL_OCCUPIED = {
  "mov-01_21:00": ["B-3", "B-4", "C-5", "C-6", "E-4", "E-5", "F-8"],
  "mov-01_17:45": ["A-4", "A-5", "D-6", "E-7", "E-8"],
  "mov-02_19:30": ["B-5", "B-6", "C-4", "D-5", "E-6"],
  "mov-03_18:45": ["C-5", "C-6", "D-5", "E-4", "E-5", "F-5"],
  "mov-04_20:30": ["B-4", "B-5", "E-5", "E-6"],
  "mov-05_19:00": ["A-3", "A-4", "B-3", "C-4", "D-4"]
};

// =============================================================================
// Roles del Sistema Cine Majestad (Matriz de Control de Acceso y Jerarquía)
// =============================================================================
const INITIAL_ROLES = [
  {
    id: 1,
    nombre: "Administrador General",
    slug: "ADMIN",
    descripcion: "Control total y absoluto del multiplex, salas, finanzas, inventario, usuarios y configuración global.",
    nivel_jerarquia: 100,
    permisos: [
      "dashboard:view", "movies:create", "movies:edit", "movies:delete",
      "shows:manage", "rooms:manage", "candybar:manage", "suppliers:manage",
      "orders:view", "orders:cancel", "reports:financial", "users:manage", "settings:edit", "boxoffice:sell"
    ],
    puede_vender_boletos: true,
    puede_vender_snacks: true,
    puede_gestionar_peliculas: true,
    puede_gestionar_usuarios: true,
    puede_ver_metricas_financieras: true,
    puede_gestionar_proveedores: true,
    activo: true
  },
  {
    id: 2,
    nombre: "Taquillero / Boletería",
    slug: "TAQUILLERO",
    descripcion: "Venta y emisión de boletos en mostrador físico, consulta de funciones y butacas en tiempo real.",
    nivel_jerarquia: 20,
    permisos: ["dashboard:view", "shows:view", "boxoffice:sell", "orders:create", "seats:lock", "candybar:sell"],
    puede_vender_boletos: true,
    puede_vender_snacks: true,
    puede_gestionar_peliculas: false,
    puede_gestionar_usuarios: false,
    puede_ver_metricas_financieras: false,
    puede_gestionar_proveedores: false,
    activo: true
  },
  {
    id: 3,
    nombre: "Operador de Confitería / Dulcería",
    slug: "CONFITERIA",
    descripcion: "Atención en CandyBar, despacho de combos, control de stock de bodega y registro de ventas de dulcería.",
    nivel_jerarquia: 15,
    permisos: ["candybar:view", "candybar:sell", "inventory:view", "inventory:adjust"],
    puede_vender_boletos: false,
    puede_vender_snacks: true,
    puede_gestionar_peliculas: false,
    puede_gestionar_usuarios: false,
    puede_ver_metricas_financieras: false,
    puede_gestionar_proveedores: false,
    activo: true
  },
  {
    id: 4,
    nombre: "Gerente de Operaciones y Sucursal",
    slug: "GERENTE",
    descripcion: "Supervisión operativa diaria, monitoreo de recaudación, gestión de proveedores, compras y cartelera.",
    nivel_jerarquia: 70,
    permisos: [
      "dashboard:view", "movies:create", "movies:edit", "shows:manage",
      "candybar:manage", "suppliers:manage", "inventory:manage", "reports:financial", "orders:view"
    ],
    puede_vender_boletos: true,
    puede_vender_snacks: true,
    puede_gestionar_peliculas: true,
    puede_gestionar_usuarios: false,
    puede_ver_metricas_financieras: true,
    puede_gestionar_proveedores: true,
    activo: true
  },
  {
    id: 5,
    nombre: "Cliente / Espectador Registrado",
    slug: "CLIENTE",
    descripcion: "Usuario final para reserva de entradas y combos en línea, acumulación de fidelidad e historial personal.",
    nivel_jerarquia: 1,
    permisos: ["catalog:view", "booking:create", "profile:manage", "orders:history"],
    puede_vender_boletos: false,
    puede_vender_snacks: false,
    puede_gestionar_peliculas: false,
    puede_gestionar_usuarios: false,
    puede_ver_metricas_financieras: false,
    puede_gestionar_proveedores: false,
    activo: true
  }
];

const INITIAL_USERS = [
  {
    id: 1,
    rol_id: 1,
    nombre: "Administrador",
    apellido: "Majestad",
    email: "admin@cinemajestad.com",
    telefono: "+57 320 987 6543",
    rol: "ADMIN",
    activo: true,
    creado_en: "2026-01-01T08:00:00.000Z"
  },
  {
    id: 2,
    rol_id: 5,
    nombre: "Yeffry",
    apellido: "González",
    email: "yeffry@cinemajestad.com",
    telefono: "+57 300 555 1234",
    rol: "CLIENTE",
    activo: true,
    creado_en: "2026-01-10T14:30:00.000Z"
  },
  {
    id: 6,
    rol_id: 5,
    nombre: "Carlos",
    apellido: "Gómez",
    email: "carlos@cliente.com",
    telefono: "+57 310 999 8877",
    rol: "CLIENTE",
    activo: true,
    creado_en: "2026-01-12T10:00:00.000Z"
  },
  {
    id: 3,
    rol_id: 2,
    nombre: "María",
    apellido: "Rodríguez",
    email: "taquilla@cinemajestad.com",
    telefono: "+57 311 234 5678",
    rol: "TAQUILLERO",
    activo: true,
    creado_en: "2026-01-15T09:15:00.000Z"
  },
  {
    id: 4,
    rol_id: 4,
    nombre: "Carlos",
    apellido: "Gerencia",
    email: "gerencia@cinemajestad.com",
    telefono: "+57 315 444 7788",
    rol: "GERENTE",
    activo: true,
    creado_en: "2026-02-01T11:00:00.000Z"
  },
  {
    id: 5,
    rol_id: 3,
    nombre: "Sofía",
    apellido: "Dulcería",
    email: "candybar@cinemajestad.com",
    telefono: "+57 318 666 9900",
    rol: "CONFITERIA",
    activo: true,
    creado_en: "2026-02-10T16:45:00.000Z"
  }
];

const USER_ROLES = {
  ADMIN: "ADMIN",
  TAQUILLERO: "TAQUILLERO",
  TRABAJADOR: "TAQUILLERO",
  CONFITERIA: "CONFITERIA",
  GERENTE: "GERENTE",
  CLIENTE: "CLIENTE"
};

// Historial Inicial de Registro de Turnos, Asistencia y Horas (Entrada y Salida)
const INITIAL_SHIFTS = [
  {
    id: 1,
    usuario_id: 3,
    nombre: "María Rodríguez",
    rol: "TAQUILLERO",
    rol_nombre: "Taquillero / Boletería",
    fecha: new Date().toISOString().split("T")[0],
    hora_entrada: "08:00 AM",
    hora_salida: null,
    horas_trabajadas: "En curso",
    estado: "EN_TURNO"
  },
  {
    id: 2,
    usuario_id: 5,
    nombre: "Sofía Dulcería",
    rol: "CONFITERIA",
    rol_nombre: "Operador de Confitería",
    fecha: new Date().toISOString().split("T")[0],
    hora_entrada: "09:00 AM",
    hora_salida: "05:00 PM",
    horas_trabajadas: "8h 00m",
    estado: "FINALIZADO"
  }
];

// Historial Inicial de Reservas
const INITIAL_BOOKINGS = [
  {
    id: "CMG-580158",
    bookingCode: "CMG-580158",
    userId: 8,
    customerName: "diego moreno",
    clientName: "diego moreno",
    customerEmail: "moreno@cliente.com",
    clientEmail: "moreno@cliente.com",
    movieId: "mov-02",
    movieTitle: "Spider-Man: A Través del Spider-Verso",
    hall: "Sala 3 (Dolby Atmos 360°)",
    roomId: "sala-3",
    showtime: "16:15",
    showtimeKey: "mov-02_16:15",
    showtimeDate: "Hoy",
    seats: [
      { code: "C-9", type: "Estándar", price: 5.50 },
      { code: "A-7", type: "Estándar", price: 5.50 }
    ],
    snacks: [
      { id: "snack-02", name: "Palomitas Mega Mantequilla Dorada", price: 5.80, costPrice: 0.90, qty: 3, proveedor_id: "prov-01" }
    ],
    foodStatus: "PENDIENTE",
    subtotalTickets: 11.00,
    ticketsTotal: 11.00,
    subtotalSnacks: 17.40,
    snacksTotal: 17.40,
    total: 28.40,
    grandTotal: 28.40,
    total_pagado: 28.40,
    status: "CONFIRMADA",
    paymentMethod: "TRANSFERENCIA",
    date: "12/11/2026 21:55",
    createdAt: "2026-11-13T02:55:39.000Z"
  },
  {
    id: "CMG-474942",
    bookingCode: "CMG-474942",
    userId: null,
    customerName: "Cliente Prueba Real",
    clientName: "Cliente Prueba Real",
    customerEmail: "prueba@cinemajestad.com",
    clientEmail: "prueba@cinemajestad.com",
    movieId: "mov-01",
    movieTitle: "Dune: Parte Dos",
    hall: "Sala 1 (IMAX Laser & Dolby)",
    roomId: "sala-1",
    showtime: "14:30",
    showtimeKey: "mov-01_14:30",
    showtimeDate: "Hoy",
    seats: [
      { code: "C-1", type: "Estándar", price: 7.00 },
      { code: "C-2", type: "Estándar", price: 7.00 }
    ],
    snacks: [
      { id: "snack-06", name: "Hot Dog Majestad Jumbo", price: 5.90, costPrice: 1.90, qty: 1, proveedor_id: "prov-05" }
    ],
    foodStatus: "PENDIENTE",
    subtotalTickets: 14.00,
    ticketsTotal: 14.00,
    subtotalSnacks: 5.90,
    snacksTotal: 5.90,
    total: 19.90,
    grandTotal: 19.90,
    total_pagado: 19.90,
    status: "CONFIRMADA",
    paymentMethod: "TRANSFERENCIA",
    date: "12/11/2026 15:38",
    createdAt: "2026-11-12T20:38:06.000Z"
  },
  {
    id: "CMG-748921",
    bookingCode: "CMG-748921",
    userId: 2,
    customerName: "Yeffry González",
    clientName: "Yeffry González",
    customerEmail: "yeffry@cinemajestad.com",
    clientEmail: "yeffry@cinemajestad.com",
    movieId: "mov-01",
    movieTitle: "Dune: Parte Dos",
    hall: "Sala 1 (IMAX Laser & Dolby)",
    roomId: "sala-1",
    showtime: "21:00",
    showtimeKey: "mov-01_21:00",
    showtimeDate: "Hoy",
    seats: [
      { code: "E-4", type: "VIP", price: 10.00 },
      { code: "E-5", type: "VIP", price: 10.00 }
    ],
    snacks: [
      { id: "snack-01", name: "Combo Majestad Dúo Real", price: 13.50, costPrice: 3.80, qty: 1, proveedor_id: "prov-01" }
    ],
    foodStatus: "PENDIENTE",
    subtotalTickets: 20.00,
    ticketsTotal: 20.00,
    subtotalSnacks: 13.50,
    snacksTotal: 13.50,
    total: 33.50,
    grandTotal: 33.50,
    total_pagado: 33.50,
    status: "CONFIRMADA",
    paymentMethod: "TARJETA_CREDITO",
    date: "12/11/2026 09:28",
    createdAt: "2026-11-12T14:28:41.000Z"
  }
];

// =============================================================================
// GESTOR PRINCIPAL DE ALMACENAMIENTO (Storage API)
// =============================================================================
const Storage = {
  // Roles de usuario
  ROLES: USER_ROLES,

  getActiveRole: () => {
    const user = Storage.getAuthUser();
    if (user && user.rol) {
      return user.rol;
    }
    return USER_ROLES.CLIENTE;
  },

  setActiveRole: (role) => {
    const user = Storage.getAuthUser();
    // Solo un usuario autenticado con rol administrativo puede cambiar la vista activa
    if (user && (user.rol === USER_ROLES.ADMIN || user.rol === "GERENTE")) {
      localStorage.setItem("cinemajestad_active_role", role);
      Storage.broadcastChange("ROLE_CHANGED", { role });
    } else if (user && user.rol) {
      localStorage.setItem("cinemajestad_active_role", user.rol);
      Storage.broadcastChange("ROLE_CHANGED", { role: user.rol });
    } else {
      localStorage.setItem("cinemajestad_active_role", USER_ROLES.CLIENTE);
      Storage.broadcastChange("ROLE_CHANGED", { role: USER_ROLES.CLIENTE });
    }
  },
  // Identificador de cliente / pestaña
  getSessionId: () => CURRENT_SESSION_ID,

  // Configuración general
  getSettings: () => {
    const raw = localStorage.getItem("cinemajestad_settings");
    if (!raw) {
      localStorage.setItem("cinemajestad_settings", JSON.stringify(DEFAULT_SETTINGS));
      return { ...DEFAULT_SETTINGS };
    }
    try {
      const parsed = JSON.parse(raw);
      // Garantizar que las reglas de precios existan siempre
      if (!parsed.pricingRules) {
        parsed.pricingRules = { ...DEFAULT_SETTINGS.pricingRules };
        localStorage.setItem("cinemajestad_settings", JSON.stringify(parsed));
      }
      return parsed;
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  },

  saveSettings: (settings) => {
    localStorage.setItem("cinemajestad_settings", JSON.stringify(settings));
    Storage.broadcastChange("SETTINGS_UPDATED", settings);
  },

  // Consulta de tarifas dinámicas y promociones por día (Fin de semana vs días calmados vs Miércoles 2x1)
  getDayPricingInfo: (dateIso, movie = null) => {
    let targetDate = new Date();
    if (dateIso) {
      const parts = String(dateIso).split("T")[0].split("-");
      if (parts.length === 3) {
        targetDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
    }

    const dayOfWeek = targetDate.getDay(); // 0 = Domingo, 1 = Lunes, ..., 3 = Miércoles, ..., 6 = Sábado
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const isWednesday = (dayOfWeek === 3);
    const isCalmDay = !isWeekend && !isWednesday;

    const settings = Storage.getSettings();
    const rules = settings.pricingRules || DEFAULT_SETTINGS.pricingRules;

    const baseStd = movie ? (typeof movie.priceStandard === "number" ? movie.priceStandard : parseFloat(movie.priceStandard) || 6.50) : 6.50;
    const baseVip = movie ? (typeof movie.priceVip === "number" ? movie.priceVip : parseFloat(movie.priceVip) || 10.00) : 10.00;

    let priceStd = baseStd;
    let priceVip = baseVip;

    if (isWeekend) {
      priceStd += (rules.weekendSurchargeStandard || 1.50);
      priceVip += (rules.weekendSurchargeVip || 2.00);
    }

    let tierLabel = "Tarifa Regular";
    let badgeClass = "badge-calm";
    let badgeText = "Día Calmado";
    let promoDescription = "Tarifa económica regular entre semana.";

    if (isWednesday && rules.wednesdayPromo2x1) {
      tierLabel = "Miércoles de Cine (Promo 2x1)";
      badgeClass = "badge-wednesday";
      badgeText = "🎉 Promo 2x1";
      promoDescription = "¡Miércoles de película! Compra en pares y por cada 2 boletos paga solo 1 (2x1 en boletería).";
    } else if (isWeekend) {
      tierLabel = "Tarifa Fin de Semana";
      badgeClass = "badge-weekend";
      badgeText = "⭐ Fin de Semana";
      promoDescription = "Tarifa especial de fin de semana para días de alta concurrencia.";
    }

    return {
      dateIso,
      dayOfWeek,
      isWeekend,
      isWednesday,
      isCalmDay,
      baseStandard: baseStd,
      baseVip: baseVip,
      priceStandard: priceStd,
      priceVip: priceVip,
      tierLabel,
      badgeClass,
      badgeText,
      promoDescription,
      has2x1Promo: isWednesday && rules.wednesdayPromo2x1
    };
  },

  // Cálculo de total con descuento 2x1 los miércoles y tarifas fin de semana
  calculateTicketsPrice: (seats, dateIso, basePriceStandard = 6.50, basePriceVip = 10.00) => {
    const dayPricing = Storage.getDayPricingInfo(dateIso, { priceStandard: basePriceStandard, priceVip: basePriceVip });
    const unitStd = dayPricing.priceStandard;
    const unitVip = dayPricing.priceVip;

    if (!seats || seats.length === 0) {
      return {
        unitStandard: unitStd,
        unitVip: unitVip,
        seatsCount: 0,
        subtotal: 0,
        discount2x1: 0,
        total: 0,
        dayPricing,
        isOddWednesday: false
      };
    }

    // Clasificar butacas estándar vs VIP
    const stdSeats = seats.filter(s => {
      const type = typeof s === "object" ? s.type : "";
      return (type || "").toUpperCase() !== "VIP";
    });
    const vipSeats = seats.filter(s => {
      const type = typeof s === "object" ? s.type : "";
      return (type || "").toUpperCase() === "VIP";
    });

    const subtotal = (stdSeats.length * unitStd) + (vipSeats.length * unitVip);
    let discount2x1 = 0;

    if (dayPricing.has2x1Promo) {
      // 2x1 por cada par de boletos de cada categoría
      const freeStd = Math.floor(stdSeats.length / 2);
      const freeVip = Math.floor(vipSeats.length / 2);
      discount2x1 = (freeStd * unitStd) + (freeVip * unitVip);
    }

    const total = Math.max(0, subtotal - discount2x1);

    return {
      unitStandard: unitStd,
      unitVip: unitVip,
      seatsCount: seats.length,
      stdCount: stdSeats.length,
      vipCount: vipSeats.length,
      subtotal,
      discount2x1,
      total,
      dayPricing,
      isOddWednesday: dayPricing.has2x1Promo && (seats.length % 2 !== 0)
    };
  },

  // Gestión de Salas
  getRooms: () => {
    const raw = localStorage.getItem("cinemajestad_rooms");
    if (!raw) {
      localStorage.setItem("cinemajestad_rooms", JSON.stringify(INITIAL_ROOMS));
      return INITIAL_ROOMS;
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(r => {
          const initR = INITIAL_ROOMS.find(i => i.id === r.id);
          return {
            ...(initR || {}),
            ...r,
            wheelchairSeats: Array.isArray(r.wheelchairSeats) ? r.wheelchairSeats : (initR && initR.wheelchairSeats ? [...initR.wheelchairSeats] : ["A-1", "A-2"]),
            doors: Array.isArray(r.doors) ? r.doors : (initR && initR.doors ? JSON.parse(JSON.stringify(initR.doors)) : [
              { id: "front-left", active: true, type: "SALIDA" },
              { id: "front-right", active: true, type: "ENTRADA" },
              { id: "back-left", active: true, type: "ENTRADA" },
              { id: "back-right", active: false, type: "SALIDA" }
            ]),
            layoutType: r.layoutType || (initR ? initR.layoutType : "curved_imax"),
            layoutBadge: r.layoutBadge || (initR ? initR.layoutBadge : "🏛️ Maqueta: Anfiteatro Curvo IMAX"),
            layoutDesc: r.layoutDesc || (initR ? initR.layoutDesc : "Distribución arquitectónica de sala")
          };
        });
      }
      return INITIAL_ROOMS;
    } catch (e) {
      return INITIAL_ROOMS;
    }
  },

  saveRooms: (rooms) => {
    localStorage.setItem("cinemajestad_rooms", JSON.stringify(rooms));
    Storage.broadcastChange("ROOMS_UPDATED", rooms);
  },

  getRoomById: (id) => {
    const rooms = Storage.getRooms();
    return rooms.find(r => r.id === id) || rooms[0];
  },

  // Gestión de Películas con Vigencia y Preventas
  getMovies: () => {
    const raw = localStorage.getItem("cinemajestad_movies");
    let list = INITIAL_MOVIES;
    if (raw) {
      try {
        list = JSON.parse(raw);
      } catch (e) {
        list = INITIAL_MOVIES;
      }
    }
    const normalized = (list || []).map((m, idx) => normalizeMovieData(m, idx));
    return normalized;
  },

  getMovieVigenciaInfo: (movie) => getMovieVigenciaInfo(movie),
  calculateMovieEndDate: (startDate, durationDays) => calculateMovieEndDate(startDate, durationDays),
  normalizeMovieData: (movie, index) => normalizeMovieData(movie, index),

  saveMovies: (movies) => {
    localStorage.setItem("cinemajestad_movies", JSON.stringify(movies));
    Storage.broadcastChange("MOVIES_UPDATED", movies);
  },

  getMovieById: (id) => {
    const movies = Storage.getMovies();
    return movies.find(m => m.id === id) || movies[0];
  },

  addMovie: (movie) => {
    const movies = Storage.getMovies();
    movies.unshift(movie);
    Storage.saveMovies(movies);
  },

  updateMovie: (id, updatedData) => {
    const movies = Storage.getMovies();
    const idx = movies.findIndex(m => m.id === id);
    if (idx > -1) {
      movies[idx] = { ...movies[idx], ...updatedData };
      Storage.saveMovies(movies);
      return movies[idx];
    }
    return null;
  },

  deleteMovie: (id) => {
    let movies = Storage.getMovies();
    movies = movies.filter(m => m.id !== id);
    Storage.saveMovies(movies);
  },

  // Gestión de Confitería
  getSnacks: () => {
    const raw = localStorage.getItem("cinemajestad_snacks");
    let snacks = INITIAL_SNACKS;
    if (raw) {
      try {
        snacks = JSON.parse(raw);
      } catch (e) {
        snacks = INITIAL_SNACKS;
      }
    }
    const normalized = (snacks || []).map(normalizeSnackItem);
    // Auto-sanar inmediatamente si el localStorage tenía items con imagen o descripción rota/undefined
    if (!raw || snacks.some(s => !s.img || s.img === 'undefined' || !s.desc || s.desc === 'undefined')) {
      localStorage.setItem("cinemajestad_snacks", JSON.stringify(normalized));
    }
    return normalized;
  },

  saveSnacks: (snacks) => {
    const normalized = (snacks || []).map(normalizeSnackItem);
    localStorage.setItem("cinemajestad_snacks", JSON.stringify(normalized));
    Storage.broadcastChange("SNACKS_UPDATED", normalized);
  },

  addSnack: (snack) => {
    const snacks = Storage.getSnacks();
    snacks.unshift(snack);
    Storage.saveSnacks(snacks);
  },

  updateSnack: (id, data) => {
    const snacks = Storage.getSnacks();
    const idx = snacks.findIndex(s => s.id === id);
    if (idx > -1) {
      snacks[idx] = { ...snacks[idx], ...data };
      Storage.saveSnacks(snacks);
      return snacks[idx];
    }
    return null;
  },

  deleteSnack: (id) => {
    let snacks = Storage.getSnacks();
    snacks = snacks.filter(s => s.id !== id);
    Storage.saveSnacks(snacks);
  },

  // Gestión de Proveedores
  getSuppliers: () => {
    const raw = localStorage.getItem("cinemajestad_suppliers");
    if (!raw) {
      localStorage.setItem("cinemajestad_suppliers", JSON.stringify(INITIAL_SUPPLIERS));
      return INITIAL_SUPPLIERS;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return INITIAL_SUPPLIERS;
    }
  },

  saveSuppliers: (suppliers) => {
    localStorage.setItem("cinemajestad_suppliers", JSON.stringify(suppliers));
    Storage.broadcastChange("SUPPLIERS_UPDATED", suppliers);
  },

  addSupplier: (supplier) => {
    const suppliers = Storage.getSuppliers();
    suppliers.unshift(supplier);
    Storage.saveSuppliers(suppliers);
    return supplier;
  },

  updateSupplier: (id, data) => {
    const suppliers = Storage.getSuppliers();
    const idx = suppliers.findIndex(s => s.id === id);
    if (idx > -1) {
      suppliers[idx] = {
        ...suppliers[idx],
        ...data,
        porcentaje_ganancia: data.porcentaje_ganancia != null ? parseFloat(data.porcentaje_ganancia) : suppliers[idx].porcentaje_ganancia,
        porcentaje_comision: data.porcentaje_comision != null ? parseFloat(data.porcentaje_comision) : suppliers[idx].porcentaje_comision,
        actualizado_en: new Date().toISOString()
      };
      Storage.saveSuppliers(suppliers);
      return suppliers[idx];
    }
    return null;
  },

  deleteSupplier: (id) => {
    let suppliers = Storage.getSuppliers();
    suppliers = suppliers.filter(s => s.id !== id);
    Storage.saveSuppliers(suppliers);
  },

  getSupplierById: (id) => {
    const suppliers = Storage.getSuppliers();
    return suppliers.find(s => s.id === id) || null;
  },

  // Roles y Control de Acceso
  getRoles: () => {
    const raw = localStorage.getItem("cinemajestad_roles");
    if (!raw) {
      localStorage.setItem("cinemajestad_roles", JSON.stringify(INITIAL_ROLES));
      return INITIAL_ROLES;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return INITIAL_ROLES;
    }
  },

  saveRoles: (roles) => {
    localStorage.setItem("cinemajestad_roles", JSON.stringify(roles));
    Storage.broadcastChange("ROLES_UPDATED", roles);
  },

  getRoleById: (id) => {
    const roles = Storage.getRoles();
    return roles.find(r => r.id === parseInt(id, 10)) || null;
  },

  getRoleBySlug: (slug) => {
    if (!slug) return null;
    const roles = Storage.getRoles();
    return roles.find(r => r.slug.toUpperCase() === String(slug).toUpperCase()) || null;
  },

  // Gestión de Usuarios y Roles
  getUsers: () => {
    const raw = localStorage.getItem("cinemajestad_users");
    if (!raw) {
      localStorage.setItem("cinemajestad_users", JSON.stringify(INITIAL_USERS));
      return INITIAL_USERS;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return INITIAL_USERS;
    }
  },

  saveUsers: (users) => {
    localStorage.setItem("cinemajestad_users", JSON.stringify(users));
    Storage.broadcastChange("USERS_UPDATED", users);
  },

  updateUserRole: (userId, newRolId) => {
    const users = Storage.getUsers();
    const idx = users.findIndex(u => u.id === parseInt(userId, 10));
    if (idx !== -1) {
      const role = Storage.getRoleById(newRolId) || Storage.getRoleBySlug(newRolId);
      if (role) {
        users[idx].rol_id = role.id;
        users[idx].rol = role.slug;
        users[idx].rol_nombre = role.nombre;
        Storage.saveUsers(users);
        return users[idx];
      }
    }
    return null;
  },

  // Control de Asistencia, Turnos de Entrada y Salida (Exclusivo Trabajadores)
  getWorkerShifts: () => {
    const raw = localStorage.getItem("cinemajestad_worker_shifts");
    if (!raw) {
      localStorage.setItem("cinemajestad_worker_shifts", JSON.stringify(INITIAL_SHIFTS));
      return INITIAL_SHIFTS;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return INITIAL_SHIFTS;
    }
  },

  saveWorkerShifts: (shifts) => {
    localStorage.setItem("cinemajestad_worker_shifts", JSON.stringify(shifts));
    Storage.broadcastChange("SHIFTS_UPDATED", shifts);
  },

  recordWorkerCheckIn: (userId, userName, userRole) => {
    const shifts = Storage.getWorkerShifts();
    const now = new Date();
    const timeStr = now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true });
    const dateStr = now.toISOString().split("T")[0];

    // Verificar si ya tiene un turno abierto hoy
    const existing = shifts.find(s => s.usuario_id === parseInt(userId, 10) && s.fecha === dateStr && s.estado === "EN_TURNO");
    if (existing) {
      return existing;
    }

    const newShift = {
      id: shifts.length ? Math.max(...shifts.map(s => s.id || 0)) + 1 : 1,
      usuario_id: parseInt(userId, 10),
      nombre: userName || "Trabajador",
      rol: userRole || "TAQUILLERO",
      rol_nombre: userRole === "CONFITERIA" ? "Operador de Confitería" : "Taquillero / Boletería",
      fecha: dateStr,
      hora_entrada: timeStr,
      hora_salida: null,
      horas_trabajadas: "En curso",
      estado: "EN_TURNO",
      timestamp_entrada: now.getTime()
    };

    shifts.unshift(newShift);
    Storage.saveWorkerShifts(shifts);

    // Actualizar usuario en lista
    const users = Storage.getUsers();
    const uIdx = users.findIndex(u => u.id === parseInt(userId, 10));
    if (uIdx !== -1) {
      users[uIdx].en_turno = true;
      users[uIdx].hora_entrada = timeStr;
      users[uIdx].hora_salida = null;
      users[uIdx].ultimo_ingreso = `${dateStr} ${timeStr}`;
      Storage.saveUsers(users);
    }
    return newShift;
  },

  recordWorkerCheckOut: (userId) => {
    const shifts = Storage.getWorkerShifts();
    const now = new Date();
    const timeStr = now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true });

    const activeShift = shifts.find(s => s.usuario_id === parseInt(userId, 10) && s.estado === "EN_TURNO");
    if (activeShift) {
      activeShift.hora_salida = timeStr;
      activeShift.estado = "FINALIZADO";
      if (activeShift.timestamp_entrada) {
        const diffMs = now.getTime() - activeShift.timestamp_entrada;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        activeShift.horas_trabajadas = `${diffHours}h ${diffMins}m`;
      } else {
        activeShift.horas_trabajadas = "Completado";
      }
      Storage.saveWorkerShifts(shifts);
    }

    const users = Storage.getUsers();
    const uIdx = users.findIndex(u => u.id === parseInt(userId, 10));
    if (uIdx !== -1) {
      users[uIdx].en_turno = false;
      users[uIdx].hora_salida = timeStr;
      Storage.saveUsers(users);
    }
    return activeShift;
  },

  deleteWorker: (userId) => {
    const numId = parseInt(userId, 10);
    const users = Storage.getUsers().filter(u => u.id !== numId);
    Storage.saveUsers(users);

    // Cerrar turnos abiertos de ese trabajador si los tenía
    const shifts = Storage.getWorkerShifts();
    shifts.forEach(s => {
      if (s.usuario_id === numId && s.estado === "EN_TURNO") {
        s.estado = "DADO_DE_BAJA";
        s.hora_salida = "Baja por Renuncia";
      }
    });
    Storage.saveWorkerShifts(shifts);
    return true;
  },

  // Estado del Pedido Actual en Proceso
  getCurrentOrder: () => {
    const raw = sessionStorage.getItem("cinemajestad_current_order");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },

  saveCurrentOrder: (order) => {
    sessionStorage.setItem("cinemajestad_current_order", JSON.stringify(order));
  },

  clearCurrentOrder: () => {
    sessionStorage.removeItem("cinemajestad_current_order");
  },

  // Historial de Reservas Completadas
  getBookings: () => {
    const raw = localStorage.getItem("cinemajestad_completed_bookings");
    if (!raw) {
      localStorage.setItem("cinemajestad_completed_bookings", JSON.stringify(INITIAL_BOOKINGS));
      return INITIAL_BOOKINGS;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return INITIAL_BOOKINGS;
    }
  },

  saveBooking: (booking) => {
    if (booking.snacks && booking.snacks.length > 0 && !booking.foodStatus) {
      booking.foodStatus = "PENDIENTE";
    }
    const code = booking.bookingCode || booking.id || ("CMG-" + Math.floor(100000 + Math.random() * 900000));
    booking.bookingCode = code;
    booking.id = code;
    booking.grandTotal = typeof booking.grandTotal === "number" ? booking.grandTotal : (typeof booking.total === "number" ? booking.total : 0);
    booking.total = booking.grandTotal;
    booking.status = booking.status || "CONFIRMADA";
    booking.createdAt = booking.createdAt || new Date().toISOString();
    booking.date = booking.date || (new Date().toLocaleDateString("es-ES") + " " + new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' }));

    const bookings = Storage.getBookings();
    const existingIdx = bookings.findIndex(b => (b.bookingCode === code || b.id === code));
    if (existingIdx > -1) {
      bookings[existingIdx] = { ...bookings[existingIdx], ...booking };
    } else {
      bookings.unshift(booking);
    }
    localStorage.setItem("cinemajestad_completed_bookings", JSON.stringify(bookings));
    Storage.broadcastChange("BOOKING_SAVED", booking);
    return booking;
  },

  saveBookings: (bookingsList, silent = false) => {
    if (Array.isArray(bookingsList)) {
      localStorage.setItem("cinemajestad_completed_bookings", JSON.stringify(bookingsList));
      if (!silent) {
        Storage.broadcastChange("BOOKINGS_UPDATED", bookingsList);
      }
    }
  },

  cancelBooking: (bookingCode) => {
    let bookings = Storage.getBookings();
    const idx = bookings.findIndex(b => b.bookingCode === bookingCode);
    if (idx > -1) {
      bookings[idx].status = "CANCELADA";
      localStorage.setItem("cinemajestad_completed_bookings", JSON.stringify(bookings));
      Storage.broadcastChange("BOOKING_CANCELLED", { bookingCode });
      return true;
    }
    return false;
  },

  getBookingByCode: (bookingCode) => {
    const bookings = Storage.getBookings();
    return bookings.find(b => b.bookingCode === bookingCode) || null;
  },

  getBookingById: (id) => {
    const bookings = Storage.getBookings();
    return bookings.find(b => b.id === id || b.bookingCode === id) || null;
  },

  // Gestión de Despacho de Comidas para el Trabajador
  getFoodOrders: () => {
    const bookings = Storage.getBookings();
    // Retornar compras que tienen snacks y no están canceladas
    return bookings.filter(b => b.snacks && b.snacks.length > 0 && b.status !== "CANCELADA");
  },

  markFoodDelivered: (bookingCode) => {
    let bookings = Storage.getBookings();
    const idx = bookings.findIndex(b => b.bookingCode === bookingCode);
    if (idx > -1) {
      bookings[idx].foodStatus = "ENTREGADO";
      bookings[idx].foodDeliveredAt = new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' });
      localStorage.setItem("cinemajestad_completed_bookings", JSON.stringify(bookings));
      Storage.broadcastChange("FOOD_STATUS_UPDATED", { bookingCode, status: "ENTREGADO" });
      return true;
    }
    return false;
  },

  createWorkerFoodSale: (clientName, snacks, total, cashReceived = 0, cashChange = 0) => {
    const code = "CMG-F" + Math.floor(10000 + Math.random() * 90000);
    const now = new Date();
    const dateFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const sale = {
      id: code,
      bookingCode: code,
      code: code,
      movieTitle: "Venta Directa de Dulcería & Combos",
      hall: "Barra Confitería Real",
      showtime: "Entrega Inmediata",
      seats: [],
      snacks: snacks,
      ticketsTotal: 0,
      subtotalTickets: 0,
      snacksTotal: total,
      subtotalSnacks: total,
      total: total,
      grandTotal: total,
      total_pagado: total,
      status: "CONFIRMADA",
      foodStatus: "ENTREGADO",
      paymentMethod: "EFECTIVO", // Pago presencial exclusivo en efectivo
      cashReceived: cashReceived || total,
      cashChange: cashChange || 0,
      isCounterSale: true,
      clientName: clientName || "Cliente Mostrador Dulcería",
      customerName: clientName || "Cliente Mostrador Dulcería",
      clientEmail: "mostrador@cinemajestad.com",
      customerEmail: "mostrador@cinemajestad.com",
      date: dateFormatted,
      dateFormatted: dateFormatted,
      createdAt: now.toISOString()
    };
    Storage.saveBooking(sale);
    if (typeof API !== "undefined" && API.orders && API.orders.create) {
      API.orders.create(sale).catch(e => console.warn("[Food Sale API fallback]:", e.message));
    }
    return sale;
  },

  // ===========================================================================
  // MOTOR DE CONCURRENCIA Y BLOQUEOS TEMPORALES DE ASIENTOS (REAL-TIME ENGINE)
  // ===========================================================================

  // Obtener todos los bloqueos temporales activos (purgando automáticamente los expirados)
  getAllSeatLocks: () => {
    const raw = localStorage.getItem("cinemajestad_seat_locks");
    if (!raw) return [];
    try {
      const locks = JSON.parse(raw);
      const now = Date.now();
      // Filtrar y eliminar expirados
      const validLocks = locks.filter(lock => lock.expiresAt > now);
      if (validLocks.length !== locks.length) {
        localStorage.setItem("cinemajestad_seat_locks", JSON.stringify(validLocks));
      }
      return validLocks;
    } catch (e) {
      return [];
    }
  },

  // Obtener bloqueos para una función específica (ej. "mov-01_21:00")
  getSeatLocksForShowtime: (showtimeKey) => {
    const allLocks = Storage.getAllSeatLocks();
    return allLocks.filter(l => l.showtimeKey === showtimeKey);
  },

  // Verificar si un asiento está bloqueado temporalmente por OTRO usuario
  isSeatLockedByOther: (showtimeKey, seatCode, currentSessionId = CURRENT_SESSION_ID) => {
    const locks = Storage.getSeatLocksForShowtime(showtimeKey);
    const lock = locks.find(l => l.seatCode === seatCode && l.expiresAt > Date.now());
    if (lock && lock.lockedBy !== currentSessionId) {
      return lock;
    }
    return null;
  },

  // Bloquear temporalmente un asiento para este cliente
  lockSeat: (showtimeKey, seatCode, currentSessionId = CURRENT_SESSION_ID) => {
    const now = Date.now();
    const settings = Storage.getSettings();
    const holdMs = (settings.seatHoldMinutes || 5) * 60 * 1000;
    const expiresAt = now + holdMs;

    let locks = Storage.getAllSeatLocks();

    // Validar si otro cliente ya lo tomó antes
    const existingOther = locks.find(l => l.showtimeKey === showtimeKey && l.seatCode === seatCode && l.expiresAt > now && l.lockedBy !== currentSessionId);
    if (existingOther) {
      return { success: false, reason: "LOCKED_BY_OTHER", lock: existingOther };
    }

    // Remover bloqueo previo propio si existía y crear nuevo con timestamp renovado
    locks = locks.filter(l => !(l.showtimeKey === showtimeKey && l.seatCode === seatCode));
    const newLock = {
      showtimeKey,
      seatCode,
      lockedBy: currentSessionId,
      lockedAt: now,
      expiresAt: expiresAt
    };
    locks.push(newLock);

    localStorage.setItem("cinemajestad_seat_locks", JSON.stringify(locks));
    Storage.broadcastChange("SEAT_LOCKED", newLock);

    return { success: true, lock: newLock, expiresAt };
  },

  // Liberar el bloqueo temporal de un asiento
  unlockSeat: (showtimeKey, seatCode, currentSessionId = CURRENT_SESSION_ID) => {
    let locks = Storage.getAllSeatLocks();
    const beforeCount = locks.length;
    locks = locks.filter(l => !(l.showtimeKey === showtimeKey && l.seatCode === seatCode && (l.lockedBy === currentSessionId || currentSessionId === "ADMIN")));

    if (locks.length !== beforeCount) {
      localStorage.setItem("cinemajestad_seat_locks", JSON.stringify(locks));
      Storage.broadcastChange("SEAT_UNLOCKED", { showtimeKey, seatCode });
      return true;
    }
    return false;
  },

  // Alias para interoperabilidad de Socket.io y controladores
  holdSeat: (showtimeKey, seatCode, currentSessionId = CURRENT_SESSION_ID) => {
    return Storage.lockSeat(showtimeKey, seatCode, currentSessionId);
  },

  releaseSeat: (showtimeKey, seatCode, currentSessionId = CURRENT_SESSION_ID) => {
    return Storage.unlockSeat(showtimeKey, seatCode, currentSessionId);
  },

  // Liberar todos los bloqueos temporales de esta sesión (por expiración de tiempo o cancelación)
  releaseAllLocksForSession: (currentSessionId = CURRENT_SESSION_ID, showtimeKey = null) => {
    let locks = Storage.getAllSeatLocks();
    const released = [];
    locks = locks.filter(l => {
      const matchSession = l.lockedBy === currentSessionId;
      const matchShowtime = showtimeKey ? l.showtimeKey === showtimeKey : true;
      if (matchSession && matchShowtime) {
        released.push(l);
        return false;
      }
      return true;
    });

    localStorage.setItem("cinemajestad_seat_locks", JSON.stringify(locks));
    if (released.length > 0) {
      Storage.broadcastChange("SESSION_SEATS_RELEASED", { sessionId: currentSessionId, seats: released });
    }
    return released;
  },

  // Obtener tiempo restante de expiración para la sesión actual en una función (en ms)
  getSessionRemainingHoldTime: (showtimeKey, currentSessionId = CURRENT_SESSION_ID) => {
    const locks = Storage.getSeatLocksForShowtime(showtimeKey);
    const myLocks = locks.filter(l => l.lockedBy === currentSessionId);
    if (myLocks.length === 0) return 0;
    const maxExpiry = Math.max(...myLocks.map(l => l.expiresAt));
    const remaining = maxExpiry - Date.now();
    return remaining > 0 ? remaining : 0;
  },

  // Asientos permanentemente ocupados por función y día específico
  getOccupiedSeats: (showtimeKey) => {
    const occupiedSet = new Set();
    if (!showtimeKey) return [];

    const parts = showtimeKey.split("_");
    const targetMovieId = parts[0];
    let targetDate = null;
    let targetTime = null;

    if (parts.length >= 3) {
      targetDate = parts[1]; // Formato YYYY-MM-DD
      targetTime = parts[2]; // Formato HH:mm
    } else if (parts.length === 2) {
      targetTime = parts[1];
    }

    const todayIso = new Date().toISOString().split("T")[0];

    // 1. Presets iniciales demostrativos (aplican exclusivamente a la fecha de hoy)
    if (INITIAL_OCCUPIED[showtimeKey]) {
      INITIAL_OCCUPIED[showtimeKey].forEach(seat => occupiedSet.add(seat));
    } else if (targetTime && (!targetDate || targetDate === todayIso)) {
      const shortKey = `${targetMovieId}_${targetTime}`;
      if (INITIAL_OCCUPIED[shortKey]) {
        INITIAL_OCCUPIED[shortKey].forEach(seat => occupiedSet.add(seat));
      }
    }

    // 2. Almacenamiento directo de ocupados guardados para esta función y día
    try {
      const raw = localStorage.getItem("cinemajestad_occupied_seats");
      if (raw) {
        const all = JSON.parse(raw);
        if (all[showtimeKey] && Array.isArray(all[showtimeKey])) {
          all[showtimeKey].forEach(seat => occupiedSet.add(seat));
        }
      }
    } catch (e) {}

    // 3. Compras reales confirmadas filtradas estrictamente por día y hora
    const bookings = Storage.getBookings();
    bookings.forEach(b => {
      if (b.status === "CONFIRMADA") {
        let isMatch = false;

        // Coincidencia exacta de clave de función con fecha
        if (b.showtimeKey && b.showtimeKey === showtimeKey) {
          isMatch = true;
        } else if (b.movieId === targetMovieId && b.showtime === targetTime) {
          if (targetDate) {
            const bDate = String(b.date || b.showtimeDate || "").trim();
            // Comparación contra YYYY-MM-DD
            if (bDate.includes(targetDate) || (targetDate === todayIso && bDate.toLowerCase().includes("hoy"))) {
              isMatch = true;
            } else {
              // Convertir formatos tipo DD/MM/YYYY
              const firstPart = bDate.split(" ")[0];
              const slashParts = firstPart.split("/");
              if (slashParts.length === 3) {
                const bDateIso = `${slashParts[2]}-${slashParts[1].padStart(2, "0")}-${slashParts[0].padStart(2, "0")}`;
                if (bDateIso === targetDate) isMatch = true;
              }
            }
          } else {
            isMatch = true;
          }
        }

        if (isMatch && b.seats && Array.isArray(b.seats)) {
          b.seats.forEach(s => occupiedSet.add(s.code || s));
        }
      }
    });

    // 4. Bloqueos manuales del Administrador (Mantenimiento / Sala)
    const overrides = Storage.getSeatOverrides(showtimeKey);
    Object.keys(overrides).forEach(seatCode => {
      if (overrides[seatCode] === "BLOCKED" || overrides[seatCode] === "MAINTENANCE") {
        occupiedSet.add(seatCode);
      }
    });

    return Array.from(occupiedSet);
  },

  // Guardar asientos ocupados para una función específica
  saveOccupiedSeats: (showtimeKey, seats) => {
    let raw = localStorage.getItem("cinemajestad_occupied_seats");
    let all = {};
    if (raw) {
      try { all = JSON.parse(raw); } catch (e) { all = {}; }
    }
    all[showtimeKey] = Array.isArray(seats) ? seats : [];
    localStorage.setItem("cinemajestad_occupied_seats", JSON.stringify(all));
    Storage.broadcastChange("SEATS_OCCUPIED_UPDATED", { showtimeKey, seats: all[showtimeKey] });
  },

  // Bloqueos directos del administrador (Mantenimiento de butacas)
  getSeatOverrides: (showtimeKey) => {
    const raw = localStorage.getItem("cinemajestad_seat_overrides");
    if (!raw) return {};
    try {
      const all = JSON.parse(raw);
      return all[showtimeKey] || {};
    } catch (e) {
      return {};
    }
  },

  toggleSeatAdminOverride: (showtimeKey, seatCode, status = "MAINTENANCE") => {
    const raw = localStorage.getItem("cinemajestad_seat_overrides");
    let all = {};
    if (raw) {
      try { all = JSON.parse(raw); } catch (e) { all = {}; }
    }
    if (!all[showtimeKey]) all[showtimeKey] = {};

    if (all[showtimeKey][seatCode]) {
      delete all[showtimeKey][seatCode];
    } else {
      all[showtimeKey][seatCode] = status;
    }

    localStorage.setItem("cinemajestad_seat_overrides", JSON.stringify(all));
    Storage.broadcastChange("SEAT_OVERRIDE_CHANGED", { showtimeKey, seatCode, status: all[showtimeKey][seatCode] || null });
    return all[showtimeKey][seatCode] || null;
  },

  // Liberar todos los bloqueos temporales (función especial para el Admin)
  clearAllTemporalLocks: () => {
    localStorage.removeItem("cinemajestad_seat_locks");
    Storage.broadcastChange("ALL_LOCKS_CLEARED", {});
  },

  // Gestión de Autenticación de Usuario
  getAuthUser: () => {
    try {
      const u = localStorage.getItem("cinemajestad_user");
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  },

  setAuthUser: (user) => {
    if (user) {
      localStorage.setItem("cinemajestad_user", JSON.stringify(user));
      // Sincronizar rol activo
      if (user.rol) {
        Storage.setActiveRole(user.rol);
      }
    } else {
      localStorage.removeItem("cinemajestad_user");
    }
    Storage.broadcastChange("AUTH_STATE_CHANGED", { user });
  },

  getAuthToken: () => {
    return localStorage.getItem("cinemajestad_token") || null;
  },

  setAuthToken: (token) => {
    if (token) {
      localStorage.setItem("cinemajestad_token", token);
    } else {
      localStorage.removeItem("cinemajestad_token");
    }
  },

  logout: () => {
    localStorage.removeItem("cinemajestad_user");
    localStorage.removeItem("cinemajestad_token");
    Storage.setActiveRole(Storage.ROLES.CLIENTE);
    Storage.broadcastChange("AUTH_STATE_CHANGED", { user: null });
  },


  // Notificador en tiempo real a otras pestañas
  broadcastChange: (type, payload) => {
    if (syncChannel) {
      try {
        syncChannel.postMessage({ type, payload, senderId: CURRENT_SESSION_ID, timestamp: Date.now() });
      } catch (e) {
        console.warn("Error al enviar mensaje por syncChannel", e);
      }
    }
    // Evento interno de ventana para la pestaña actual
    window.dispatchEvent(new CustomEvent("cinemajestad_sync", { detail: { type, payload } }));
  },

  // Suscribirse a cambios en tiempo real
  onSync: (callback) => {
    if (syncChannel) {
      syncChannel.onmessage = (event) => {
        if (event.data && event.data.senderId !== CURRENT_SESSION_ID) {
          callback(event.data);
        }
      };
    }
    // Escuchar eventos de Storage (disparado entre ventanas en navegadores)
    window.addEventListener("storage", (e) => {
      if (e.key && e.key.startsWith("cinemajestad_")) {
        callback({ type: "STORAGE_CHANGE", key: e.key, newValue: e.newValue });
      }
    });
    // Escuchar evento local
    window.addEventListener("cinemajestad_sync", (e) => {
      callback(e.detail);
    });
  },

  // Inteligencia Financiera: Ventas, Costos, Márgenes de Ganancia e Intereses
  getFinancialAnalytics: () => {
    const bookings = Storage.getBookings();
    const snacks = Storage.getSnacks();

    let grossRevenue = 0;
    let ticketRevenue = 0;
    let snackRevenue = 0;
    let totalCogs = 0;
    let totalGatewayFees = 0;

    const snackSalesCount = {};
    snacks.forEach(s => { snackSalesCount[s.id] = 0; });

    bookings.forEach(b => {
      grossRevenue += b.total || b.grandTotal || 0;
      ticketRevenue += b.subtotalTickets || b.ticketsTotal || 0;
      snackRevenue += b.subtotalSnacks || b.snacksTotal || 0;

      if (b.snacks && Array.isArray(b.snacks)) {
        b.snacks.forEach(item => {
          const snackDef = snacks.find(s => s.id === item.id || s.name === item.name);
          const cost = snackDef ? (snackDef.costPrice || 0) : 0;
          const qty = item.qty || item.quantity || 1;
          totalCogs += cost * qty;

          if (snackDef) {
            snackSalesCount[snackDef.id] = (snackSalesCount[snackDef.id] || 0) + qty;
          }
        });
      }

      const pm = (b.paymentMethod || "").toLowerCase();
      let fee = 0;
      if (pm.includes("nequi") || pm.includes("daviplata")) {
        fee = (b.total || b.grandTotal || 0) * 0.015;
      } else if (pm.includes("efectivo") || pm.includes("taquilla")) {
        fee = 0;
      } else {
        fee = ((b.total || b.grandTotal || 0) * 0.029) + 0.30;
      }
      totalGatewayFees += fee;
    });

    const netProfit = Math.max(0, grossRevenue - totalCogs - totalGatewayFees);
    const netMarginPercent = grossRevenue > 0 ? ((netProfit / grossRevenue) * 100) : 0;
    const grossMarginPercent = grossRevenue > 0 ? (((grossRevenue - totalCogs) / grossRevenue) * 100) : 0;

    const inventoryProfitability = snacks.map(snack => {
      const soldUnits = snackSalesCount[snack.id] || 0;
      const cost = snack.costPrice || 0;
      const price = snack.price;
      const unitProfit = price - cost;
      const marginPercent = price > 0 ? ((unitProfit / price) * 100) : 0;
      const markupRoiPercent = cost > 0 ? ((unitProfit / cost) * 100) : 0;
      const productTotalRevenue = soldUnits * price;
      const productTotalCost = soldUnits * cost;
      const productTotalProfit = productTotalRevenue - productTotalCost;
      const currentStockValue = snack.stock * cost;

      return {
        id: snack.id,
        name: snack.name,
        category: snack.category,
        stock: snack.stock,
        costPrice: parseFloat(cost.toFixed(2)),
        salePrice: parseFloat(price.toFixed(2)),
        unitProfit: parseFloat(unitProfit.toFixed(2)),
        marginPercent: parseFloat(marginPercent.toFixed(1)),
        markupRoiPercent: parseFloat(markupRoiPercent.toFixed(1)),
        unitsSold: soldUnits,
        productTotalRevenue: parseFloat(productTotalRevenue.toFixed(2)),
        productTotalCost: parseFloat(productTotalCost.toFixed(2)),
        productTotalProfit: parseFloat(productTotalProfit.toFixed(2)),
        currentStockValue: parseFloat(currentStockValue.toFixed(2))
      };
    });

    return {
      grossRevenue: parseFloat(grossRevenue.toFixed(2)),
      ticketRevenue: parseFloat(ticketRevenue.toFixed(2)),
      snackRevenue: parseFloat(snackRevenue.toFixed(2)),
      totalCogs: parseFloat(totalCogs.toFixed(2)),
      totalGatewayFees: parseFloat(totalGatewayFees.toFixed(2)),
      netProfit: parseFloat(netProfit.toFixed(2)),
      netMarginPercent: parseFloat(netMarginPercent.toFixed(1)),
      grossMarginPercent: parseFloat(grossMarginPercent.toFixed(1)),
      inventoryProfitability
    };
  },

  // Restaurar todo a valores iniciales de Cine Majestad
  resetToDefaults: () => {
    localStorage.setItem("cinemajestad_settings", JSON.stringify(DEFAULT_SETTINGS));
    localStorage.setItem("cinemajestad_rooms", JSON.stringify(INITIAL_ROOMS));
    localStorage.setItem("cinemajestad_movies", JSON.stringify(INITIAL_MOVIES));
    localStorage.setItem("cinemajestad_snacks", JSON.stringify(INITIAL_SNACKS));
    localStorage.setItem("cinemajestad_completed_bookings", JSON.stringify(INITIAL_BOOKINGS));
    localStorage.removeItem("cinemajestad_seat_locks");
    localStorage.removeItem("cinemajestad_seat_overrides");
    sessionStorage.removeItem("cinemajestad_current_order");
    Storage.broadcastChange("SYSTEM_RESET", {});
  }
};

if (typeof window !== "undefined") {
  window.Storage = Storage;
}
