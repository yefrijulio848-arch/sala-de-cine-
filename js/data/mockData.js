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
  currency: "$"
};

// Salas y Esquemas Arquitectónicos de Asientos
const INITIAL_ROOMS = [
  {
    id: "sala-1",
    name: "Sala 1 (IMAX Laser & Dolby)",
    technology: "IMAX Laser",
    rows: ["A", "B", "C", "D", "E", "F"],
    seatsPerRow: 10,
    vipRows: ["E", "F"],
    capacity: 60,
    screenType: "Curva Gigante 4K",
    soundSystem: "Dolby Atmos 64 Canales"
  },
  {
    id: "sala-2",
    name: "Sala 2 (70mm Master Cinema)",
    technology: "70mm Film",
    rows: ["A", "B", "C", "D", "E", "F"],
    seatsPerRow: 10,
    vipRows: ["E", "F"],
    capacity: 60,
    screenType: "Plana 70mm Panavision",
    soundSystem: "DTS-X Surround"
  },
  {
    id: "sala-3",
    name: "Sala 3 (Dolby Atmos 360°)",
    technology: "Dolby Atmos",
    rows: ["A", "B", "C", "D", "E"],
    seatsPerRow: 10,
    vipRows: ["E"],
    capacity: 50,
    screenType: "Microperforada 2K",
    soundSystem: "Dolby Atmos 360°"
  },
  {
    id: "sala-4",
    name: "Sala 4 (VIP Royal Lounge)",
    technology: "VIP Luxury",
    rows: ["A", "B", "C", "D"],
    seatsPerRow: 8,
    vipRows: ["A", "B", "C", "D"],
    capacity: 32,
    screenType: "Pantalla Láser Premium",
    soundSystem: "Bowers & Wilkins Hi-Fi"
  }
];

// Catálogo Inicial de Películas
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
    isFeatured: true
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
    isFeatured: false
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
    isFeatured: false
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
    isFeatured: false
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
    isFeatured: false
  }
];

// Catálogo Inicial de Confitería / Dulcería
const INITIAL_SNACKS = [
  {
    id: "snack-01",
    name: "Combo Majestad Dúo Real",
    category: "combos",
    desc: "1 Palomitas gigantes (mantequilla o caramelo) + 2 Bebidas grandes heladas + 1 Hot Dog supremo o Nachos cheddar.",
    costPrice: 3.80,
    price: 13.50,
    tag: "Más Vendido",
    img: "https://images.unsplash.com/photo-1585647347384-2593bc35786b?auto=format&fit=crop&w=600&q=80",
    stock: 250
  },
  {
    id: "snack-02",
    name: "Palomitas Mega Mantequilla Dorada",
    category: "palomitas",
    desc: "Crujientes granos de maíz gourmet recién preparados, bañados en generosa mantequilla dorada caliente.",
    costPrice: 0.90,
    price: 5.80,
    tag: "Clásico",
    img: "https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=600&q=80",
    stock: 400
  },
  {
    id: "snack-03",
    name: "Nachos Suprema con Queso Fundido",
    category: "snacks",
    desc: "Crujientes totopos de maíz con abundante queso cheddar caliente, frijoles negros y rodajas de jalapeños.",
    costPrice: 1.80,
    price: 6.50,
    tag: "Crujiente",
    img: "https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&w=600&q=80",
    stock: 300
  },
  {
    id: "snack-04",
    name: "Refresco Ice Cold 32oz",
    category: "bebidas",
    desc: "Bebida gasificada helada a elección (Coca-Cola, Sprite, Fanta, Té frío de limón o Manzana).",
    costPrice: 0.60,
    price: 3.50,
    tag: "Refrescante",
    img: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80",
    stock: 600
  },
  {
    id: "snack-05",
    name: "Combo Dulzura Caramelo Imperial",
    category: "combos",
    desc: "Palomitas de caramelo artesanal crocante + 1 Bebida gigante + 1 Chocolate M&M's familiar.",
    costPrice: 2.60,
    price: 10.20,
    tag: "Favorito",
    img: "https://images.unsplash.com/photo-1505686994434-e3cc5abf1330?auto=format&fit=crop&w=600&q=80",
    stock: 180
  },
  {
    id: "snack-06",
    name: "Hot Dog Majestad Jumbo",
    category: "snacks",
    desc: "Salchicha alemana de res en pan brioche artesanal con queso derretido, tocino crocante y salsas.",
    costPrice: 1.90,
    price: 5.90,
    tag: "Especial",
    img: "https://images.unsplash.com/photo-1619740455993-9e612b1af08a?auto=format&fit=crop&w=600&q=80",
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

// Historial Inicial de Reservas
const INITIAL_BOOKINGS = [
  {
    bookingCode: "CMG-748921",
    movieTitle: "Dune: Parte Dos",
    hall: "Sala 1 (IMAX Laser & Dolby)",
    showtime: "21:00",
    showtimeKey: "mov-01_21:00",
    seats: [
      { code: "E-4", type: "VIP", price: 10.00 },
      { code: "E-5", type: "VIP", price: 10.00 }
    ],
    snacks: [
      { id: "snack-01", name: "Combo Majestad Dúo Real", price: 13.50, qty: 1 }
    ],
    foodStatus: "PENDIENTE", // PENDIENTE o ENTREGADO
    clientName: "Yeffry González",
    clientEmail: "yeffry@cinemajestad.com",
    ticketsTotal: 20.00,
    snacksTotal: 13.50,
    grandTotal: 33.50,
    status: "CONFIRMADA",
    date: new Date(Date.now() - 3600000 * 2).toLocaleDateString("es-ES") + " 19:15"
  },
  {
    bookingCode: "CMG-312984",
    movieTitle: "Oppenheimer",
    hall: "Sala 2 (70mm Master Cinema)",
    showtime: "18:45",
    showtimeKey: "mov-03_18:45",
    seats: [
      { code: "C-5", type: "Estándar", price: 6.00 },
      { code: "C-6", type: "Estándar", price: 6.00 }
    ],
    snacks: [
      { id: "snack-02", name: "Palomitas Mega Mantequilla", price: 5.80, qty: 1 },
      { id: "snack-04", name: "Refresco Ice Cold 32oz", price: 3.50, qty: 2 }
    ],
    foodStatus: "PENDIENTE",
    clientName: "Mariana Rivera",
    clientEmail: "mariana@gmail.com",
    ticketsTotal: 12.00,
    snacksTotal: 12.80,
    grandTotal: 24.80,
    status: "CONFIRMADA",
    date: new Date(Date.now() - 3600000 * 5).toLocaleDateString("es-ES") + " 16:30"
  }
];

// =============================================================================
// GESTOR PRINCIPAL DE ALMACENAMIENTO (Storage API)
// =============================================================================
const Storage = {
  // Roles de usuario
  ROLES: USER_ROLES,

  getActiveRole: () => {
    return localStorage.getItem("cinemajestad_active_role") || USER_ROLES.CLIENTE;
  },

  setActiveRole: (role) => {
    localStorage.setItem("cinemajestad_active_role", role);
    Storage.broadcastChange("ROLE_CHANGED", { role });
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
      return JSON.parse(raw);
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  },

  saveSettings: (settings) => {
    localStorage.setItem("cinemajestad_settings", JSON.stringify(settings));
    Storage.broadcastChange("SETTINGS_UPDATED", settings);
  },

  // Gestión de Salas
  getRooms: () => {
    const raw = localStorage.getItem("cinemajestad_rooms");
    if (!raw) {
      localStorage.setItem("cinemajestad_rooms", JSON.stringify(INITIAL_ROOMS));
      return INITIAL_ROOMS;
    }
    try {
      return JSON.parse(raw);
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

  // Gestión de Películas
  getMovies: () => {
    const raw = localStorage.getItem("cinemajestad_movies");
    if (!raw) {
      localStorage.setItem("cinemajestad_movies", JSON.stringify(INITIAL_MOVIES));
      return INITIAL_MOVIES;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return INITIAL_MOVIES;
    }
  },

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
    if (!raw) {
      localStorage.setItem("cinemajestad_snacks", JSON.stringify(INITIAL_SNACKS));
      return INITIAL_SNACKS;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return INITIAL_SNACKS;
    }
  },

  saveSnacks: (snacks) => {
    localStorage.setItem("cinemajestad_snacks", JSON.stringify(snacks));
    Storage.broadcastChange("SNACKS_UPDATED", snacks);
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

  saveBookings: (bookingsList) => {
    if (Array.isArray(bookingsList)) {
      localStorage.setItem("cinemajestad_completed_bookings", JSON.stringify(bookingsList));
      Storage.broadcastChange("BOOKINGS_UPDATED", bookingsList);
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

  createWorkerFoodSale: (clientName, snacks, total) => {
    const code = "CMG-F" + Math.floor(10000 + Math.random() * 90000);
    const sale = {
      bookingCode: code,
      movieTitle: "Venta Directa de Dulcería",
      hall: "Barra Confitería",
      showtime: "Inmediato",
      seats: [],
      snacks: snacks,
      ticketsTotal: 0,
      snacksTotal: total,
      grandTotal: total,
      status: "CONFIRMADA",
      foodStatus: "ENTREGADO",
      clientName: clientName || "Cliente Mostrador",
      clientEmail: "mostrador@cinemajestad.com",
      date: new Date().toLocaleDateString("es-ES") + " " + new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })
    };
    Storage.saveBooking(sale);
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

  // Asientos permanentemente ocupados (por compras confirmadas + presets iniciales)
  getOccupiedSeats: (showtimeKey) => {
    const occupiedSet = new Set();

    // 1. Presets iniciales demostrativos
    if (INITIAL_OCCUPIED[showtimeKey]) {
      INITIAL_OCCUPIED[showtimeKey].forEach(seat => occupiedSet.add(seat));
    }

    // 2. Almacenamiento directo de ocupados guardados en tiempo real
    try {
      const raw = localStorage.getItem("cinemajestad_occupied_seats");
      if (raw) {
        const all = JSON.parse(raw);
        if (all[showtimeKey] && Array.isArray(all[showtimeKey])) {
          all[showtimeKey].forEach(seat => occupiedSet.add(seat));
        }
      }
    } catch (e) {}

    // 3. Compras reales confirmadas en el sistema
    const bookings = Storage.getBookings();
    bookings.forEach(b => {
      if (b.status === "CONFIRMADA" && (b.showtimeKey === showtimeKey || (!b.showtimeKey && b.showtime))) {
        if (b.seats && Array.isArray(b.seats)) {
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
