const bcrypt = require("bcryptjs");
const { isDbConnected, query } = require("../config/db");

// Password hash por defecto para usuarios de demostración (clave: "123456")
const DEFAULT_HASH = bcrypt.hashSync("123456", 10);

// Base de datos en memoria para inicialización y fallback
const state = {
  settings: {
    cinemaName: "Cine Majestad",
    slogan: "La Majestad del Séptimo Arte",
    phone: "+57 (601) 789-2026",
    address: "Av. Principal Real #104, Centro Comercial Gran Plaza",
    hours: "Lunes a Domingo: 12:00 PM - 11:30 PM",
    seatHoldMinutes: parseInt(process.env.SEAT_HOLD_DURATION_MINUTES, 10) || 5,
    maxSeatsPerTransaction: 8,
    currency: "$"
  },

  roles: [
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
  ],

  users: [
    {
      id: 1,
      rol_id: 1,
      nombre: "Administrador",
      apellido: "Majestad",
      email: "admin@cinemajestad.com",
      password_hash: DEFAULT_HASH,
      telefono: "+57 320 987 6543",
      rol: "ADMIN",
      activo: true,
      creado_en: new Date().toISOString()
    },
    {
      id: 2,
      rol_id: 5,
      nombre: "Yeffry",
      apellido: "González",
      email: "yeffry@cinemajestad.com",
      password_hash: DEFAULT_HASH,
      telefono: "+57 300 555 1234",
      rol: "CLIENTE",
      activo: true,
      creado_en: new Date().toISOString()
    },
    {
      id: 6,
      rol_id: 5,
      nombre: "Carlos",
      apellido: "Gómez",
      email: "carlos@cliente.com",
      password_hash: DEFAULT_HASH,
      telefono: "+57 310 999 8877",
      rol: "CLIENTE",
      activo: true,
      creado_en: new Date().toISOString()
    },
    {
      id: 3,
      rol_id: 2,
      nombre: "María",
      apellido: "Rodríguez",
      email: "taquilla@cinemajestad.com",
      password_hash: DEFAULT_HASH,
      telefono: "+57 311 234 5678",
      rol: "TAQUILLERO",
      activo: true,
      creado_en: new Date().toISOString()
    },
    {
      id: 4,
      rol_id: 4,
      nombre: "Carlos",
      apellido: "Gerencia",
      email: "gerencia@cinemajestad.com",
      password_hash: DEFAULT_HASH,
      telefono: "+57 315 444 7788",
      rol: "GERENTE",
      activo: true,
      creado_en: new Date().toISOString()
    },
    {
      id: 5,
      rol_id: 3,
      nombre: "Sofía",
      apellido: "Dulcería",
      email: "candybar@cinemajestad.com",
      password_hash: DEFAULT_HASH,
      telefono: "+57 318 666 9900",
      rol: "CONFITERIA",
      activo: true,
      creado_en: new Date().toISOString()
    }
  ],

  rooms: [
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
  ],

  movies: [
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
      priceVip: 9.00,
      showtimes: ["13:00", "16:00", "19:15"],
      hall: "Sala 2 (70mm Master Cinema)",
      roomId: "sala-2",
      isFeatured: false
    },
    {
      id: "mov-03",
      title: "Oppenheimer",
      genre: "Drama",
      duration: "180 min",
      rating: 8.9,
      ageRating: "B-15",
      formats: ["70mm", "IMAX"],
      director: "Christopher Nolan",
      synopsis: "La historia del científico estadounidense J. Robert Oppenheimer y su papel fundamental en el desarrollo y culminación de la primera bomba atómica durante el Proyecto Manhattan.",
      poster: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=600&q=80",
      backdrop: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=80",
      trailerUrl: "https://www.youtube.com/embed/uYPbbksJxIg",
      priceStandard: 7.00,
      priceVip: 11.50,
      showtimes: ["15:00", "18:30", "22:00"],
      hall: "Sala 2 (70mm Master Cinema)",
      roomId: "sala-2",
      isFeatured: false
    },
    {
      id: "mov-04",
      title: "El Caballero de la Noche",
      genre: "Acción",
      duration: "152 min",
      rating: 9.0,
      ageRating: "B",
      formats: ["IMAX", "Atmos"],
      director: "Christopher Nolan",
      synopsis: "Cuando la amenaza conocida como el Guasón causa estragos y caos en Gotham City, Batman debe aceptar una de las mayores pruebas psicológicas y físicas de su capacidad para combatir la injusticia.",
      poster: "https://images.unsplash.com/photo-1509281373149-e957c6296406?auto=format&fit=crop&w=600&q=80",
      backdrop: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=1600&q=80",
      trailerUrl: "https://www.youtube.com/embed/EXeTwQWrcwY",
      priceStandard: 6.00,
      priceVip: 9.50,
      showtimes: ["16:45", "20:00", "22:45"],
      hall: "Sala 3 (Dolby Atmos 360°)",
      roomId: "sala-3",
      isFeatured: false
    },
    {
      id: "mov-05",
      title: "Avatar: El Camino del Agua",
      genre: "Ciencia Ficción",
      duration: "192 min",
      rating: 8.5,
      ageRating: "B",
      formats: ["3D", "IMAX", "HFR"],
      director: "James Cameron",
      synopsis: "Jake Sully vive con su nueva familia en Pandora. Una vez que una amenaza familiar regresa, Jake debe trabajar con Neytiri y el ejército de la raza Na'vi para proteger su hogar ancestral.",
      poster: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80",
      backdrop: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80",
      trailerUrl: "https://www.youtube.com/embed/d9MyW72ELq0",
      priceStandard: 7.50,
      priceVip: 12.00,
      showtimes: ["13:30", "17:30", "21:30"],
      hall: "Sala 4 (VIP Royal Lounge)",
      roomId: "sala-4",
      isFeatured: false
    }
  ],

  suppliers: [
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
  ],

  snacks: [
    {
      id: "snk-01",
      name: "Combo Imperial Doble",
      category: "combos",
      proveedor_id: "prov-01",
      costPrice: 3.80,
      price: 13.50,
      stock: 45,
      description: "2 Palomitas Gigantes con mantequilla real + 2 Refrescos grandes a elección + 1 Dulce M&M.",
      image: "https://images.unsplash.com/photo-1585647347483-22b66260dfff?auto=format&fit=crop&w=500&q=80",
      badge: "Más Vendido ⭐"
    },
    {
      id: "snk-02",
      name: "Combo Majestad VIP",
      category: "combos",
      costPrice: 5.20,
      price: 18.00,
      stock: 30,
      description: "Palomitas Jumbo mixtas (saladas/caramelo) + 2 Bebidas + Nachos con queso cheddar y jalapeños.",
      image: "https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=500&q=80",
      badge: "Recomendado 👑"
    },
    {
      id: "snk-03",
      name: "Palomitas Mantequilla Real (Grande)",
      category: "palomitas",
      costPrice: 0.90,
      price: 5.50,
      stock: 120,
      description: "Maíz importado recién estallado bañado en mantequilla dorada fundida al instante.",
      image: "https://images.unsplash.com/photo-1512149177596-f817c7ef5d4c?auto=format&fit=crop&w=500&q=80"
    },
    {
      id: "snk-04",
      name: "Palomitas Caramelo Supreme",
      category: "palomitas",
      costPrice: 1.10,
      price: 6.00,
      stock: 80,
      description: "Crujientes crispetas glaseadas en caramelo toffee artesanal.",
      image: "https://images.unsplash.com/photo-1505686994434-e3cc5abf1330?auto=format&fit=crop&w=500&q=80"
    },
    {
      id: "snk-05",
      name: "Nachos con Queso Cheddar Caliente",
      category: "snacks",
      costPrice: 1.80,
      price: 6.50,
      stock: 55,
      description: "Tortillas crujientes de maíz con abundante queso cheddar caliente fundido y jalapeños al gusto.",
      image: "https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&w=500&q=80"
    },
    {
      id: "snk-06",
      name: "Hot Dog Especial Majestad",
      category: "snacks",
      costPrice: 1.90,
      price: 5.80,
      stock: 40,
      description: "Salchicha tipo Frankfurt premium, papas trituradas, tocineta crujiente y salsa de la casa.",
      image: "https://images.unsplash.com/photo-1619740455993-9e612b1af08a?auto=format&fit=crop&w=500&q=80"
    },
    {
      id: "snk-07",
      name: "Gaseosa Gigante Helada (32 oz)",
      category: "bebidas",
      costPrice: 0.60,
      price: 3.80,
      stock: 200,
      description: "Coca-Cola, Zero, Sprite o Manzana servida con hielo escarchado.",
      image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=500&q=80"
    },
    {
      id: "snk-08",
      name: "Icee Granizado Polar",
      category: "bebidas",
      costPrice: 0.75,
      price: 4.50,
      stock: 90,
      description: "Bebida granizada ultra helada en sabores frambuesa azul y cereza silvestre.",
      image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=500&q=80"
    }
  ],

  // Bloqueos temporales en memoria: key = `${showtimeKey}__${seatId}`
  // Objeto: { sessionId, userId, seatId, showtimeKey, expiresAt, timerId }
  temporaryHolds: new Map(),

  // Butacas ocupadas permanentemente por función: key = showtimeKey, value = Set(seatIds)
  occupiedSeats: {
    "mov-01_21:00": ["C-5", "C-6", "D-5", "D-6"],
    "mov-02_16:00": ["B-4", "B-5", "C-4"],
    "mov-03_18:30": ["A-3", "A-4", "E-5", "E-6"]
  },

  // Butacas en mantenimiento o bloqueo manual por administrador
  seatOverrides: {},

  // Reservas confirmadas
  bookings: [
    {
      id: "CMG-748921",
      userId: 1,
      customerName: "Carlos Gómez",
      customerEmail: "carlos@cliente.com",
      movieId: "mov-01",
      movieTitle: "Dune: Parte Dos",
      hall: "Sala 1 (IMAX Laser & Dolby)",
      roomId: "sala-1",
      showtime: "21:00",
      showtimeDate: "Hoy",
      seats: ["C-5", "C-6"],
      snacks: [
        { id: "snk-01", name: "Combo Imperial Doble", quantity: 1, price: 13.50 }
      ],
      subtotalTickets: 13.00,
      subtotalSnacks: 13.50,
      total: 26.50,
      paymentMethod: "Tarjeta de Crédito (Visa •••• 4242)",
      paymentStatus: "APROBADO",
      foodStatus: "PENDIENTE",
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
    },
    {
      id: "CMG-882314",
      userId: 1,
      customerName: "Carlos Gómez",
      customerEmail: "carlos@cliente.com",
      movieId: "mov-02",
      movieTitle: "Spider-Man: A Través del Spider-Verso",
      hall: "Sala 2 (70mm Master Cinema)",
      roomId: "sala-2",
      showtime: "16:00",
      showtimeDate: "Hoy",
      seats: ["B-4", "B-5"],
      snacks: [],
      subtotalTickets: 11.00,
      subtotalSnacks: 0.00,
      total: 11.00,
      paymentMethod: "Nequi",
      paymentStatus: "APROBADO",
      foodStatus: "ENTREGADO",
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
    }
  ]
};

// =============================================================================
// MÉTODOS DE ACCESO A DATOS
// =============================================================================

const Store = {
  getSettings() {
    return state.settings;
  },

  updateSettings(newSettings) {
    state.settings = { ...state.settings, ...newSettings };
    return state.settings;
  },

  // Películas
  async getMovies() {
    if (isDbConnected()) {
      try {
        const rows = await query(`
          SELECT p.*, s.nombre as hall
          FROM peliculas p
          LEFT JOIN salas s ON s.id = p.sala_defecto_id
          ORDER BY p.es_destacada DESC, p.titulo ASC
        `);
        if (rows && rows.length > 0) {
          return rows.map(r => ({
            id: r.id,
            title: r.titulo,
            synopsis: r.sinopsis,
            director: r.director,
            duration: `${r.duracion_min} min`,
            ageRating: r.clasificacion_edad,
            rating: parseFloat(r.rating),
            poster: r.poster_url,
            backdrop: r.backdrop_url,
            trailerUrl: r.trailer_url,
            priceStandard: parseFloat(r.precio_estandar_base),
            priceVip: parseFloat(r.precio_vip_base),
            isFeatured: Boolean(r.es_destacada),
            hall: r.hall || "Sala 1",
            roomId: r.sala_defecto_id || "sala-1",
            showtimes: ["14:30", "17:45", "21:00"],
            formats: ["2D", "3D", "IMAX"],
            genre: "Acción"
          }));
        }
      } catch (e) {
        console.warn("[Store] Error leyendo películas de MySQL, usando estado:", e.message);
      }
    }
    return state.movies;
  },

  async getMovieById(id) {
    const movies = await this.getMovies();
    return movies.find(m => m.id === id) || null;
  },

  async createMovie(movieData) {
    const newMovie = {
      id: "mov-" + Date.now().toString(36),
      title: movieData.title,
      genre: movieData.genre || "Acción",
      duration: movieData.duration || "120 min",
      rating: parseFloat(movieData.rating) || 8.0,
      ageRating: movieData.ageRating || "B",
      formats: Array.isArray(movieData.formats) ? movieData.formats : ["2D"],
      director: movieData.director || "Director Cine Majestad",
      synopsis: movieData.synopsis || "Sinopsis oficial.",
      poster: movieData.poster || "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80",
      backdrop: movieData.backdrop || "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1600&q=80",
      trailerUrl: movieData.trailerUrl || "",
      priceStandard: parseFloat(movieData.priceStandard) || 6.50,
      priceVip: parseFloat(movieData.priceVip) || 10.00,
      showtimes: Array.isArray(movieData.showtimes) ? movieData.showtimes : ["16:00", "19:00", "21:30"],
      hall: movieData.hall || "Sala 1 (IMAX Laser & Dolby)",
      roomId: movieData.roomId || "sala-1",
      isFeatured: Boolean(movieData.isFeatured)
    };
    state.movies.unshift(newMovie);
    return newMovie;
  },

  async updateMovie(id, updateData) {
    const idx = state.movies.findIndex(m => m.id === id);
    if (idx === -1) return null;
    state.movies[idx] = { ...state.movies[idx], ...updateData };
    return state.movies[idx];
  },

  async deleteMovie(id) {
    const idx = state.movies.findIndex(m => m.id === id);
    if (idx === -1) return false;
    state.movies.splice(idx, 1);
    return true;
  },

  // Salas
  getRooms() {
    return state.rooms;
  },

  getRoomById(roomId) {
    return state.rooms.find(r => r.id === roomId) || state.rooms[0];
  },

  // Snacks
  getSnacks() {
    return state.snacks;
  },

  createSnack(snackData) {
    const newSnack = {
      id: "snk-" + Date.now().toString(36),
      name: snackData.name,
      category: snackData.category || "snacks",
      price: parseFloat(snackData.price) || 5.00,
      stock: parseInt(snackData.stock, 10) || 50,
      description: snackData.description || "",
      image: snackData.image || "https://images.unsplash.com/photo-1585647347483-22b66260dfff?auto=format&fit=crop&w=500&q=80",
      badge: snackData.badge || ""
    };
    state.snacks.push(newSnack);
    return newSnack;
  },

  updateSnack(id, data) {
    const idx = state.snacks.findIndex(s => s.id === id);
    if (idx === -1) return null;
    state.snacks[idx] = { ...state.snacks[idx], ...data };
    return state.snacks[idx];
  },

  deleteSnack(id) {
    const idx = state.snacks.findIndex(s => s.id === id);
    if (idx === -1) return false;
    state.snacks.splice(idx, 1);
    return true;
  },

  // Roles y Control de Acceso
  async getRoles() {
    if (isDbConnected()) {
      try {
        const rows = await query("SELECT * FROM roles ORDER BY nivel_jerarquia DESC");
        if (rows && rows.length > 0) {
          return rows.map(r => ({
            ...r,
            permisos: typeof r.permisos === "string" ? JSON.parse(r.permisos) : (r.permisos || []),
            puede_vender_boletos: Boolean(r.puede_vender_boletos),
            puede_vender_snacks: Boolean(r.puede_vender_snacks),
            puede_gestionar_peliculas: Boolean(r.puede_gestionar_peliculas),
            puede_gestionar_usuarios: Boolean(r.puede_gestionar_usuarios),
            puede_ver_metricas_financieras: Boolean(r.puede_ver_metricas_financieras),
            puede_gestionar_proveedores: Boolean(r.puede_gestionar_proveedores),
            activo: Boolean(r.activo)
          }));
        }
      } catch (err) {
        console.warn("[Store] Error listando roles de MySQL:", err.message);
      }
    }
    return state.roles;
  },

  findRoleById(id) {
    return state.roles.find(r => r.id === parseInt(id, 10)) || null;
  },

  findRoleBySlug(slug) {
    if (!slug) return null;
    return state.roles.find(r => r.slug.toUpperCase() === String(slug).toUpperCase()) || null;
  },

  // Usuarios y Auth con conexión a MySQL
  async findUserByEmail(email) {
    if (!email) return null;
    const cleanEmail = email.toLowerCase().trim();

    if (isDbConnected()) {
      try {
        const rows = await query(`
          SELECT u.id, u.rol_id, u.nombre, u.apellido, u.email, u.password_hash, u.telefono, u.rol, u.activo, u.creado_en,
                 r.nombre as rol_nombre, r.slug as rol_slug, r.nivel_jerarquia, r.permisos
          FROM usuarios u
          LEFT JOIN roles r ON u.rol_id = r.id
          WHERE LOWER(u.email) = ?
          LIMIT 1
        `, [cleanEmail]);

        if (rows && rows.length > 0) {
          const u = rows[0];
          let permisos = [];
          try {
            permisos = typeof u.permisos === "string" ? JSON.parse(u.permisos) : (u.permisos || []);
          } catch (e) {
            permisos = [];
          }
          return {
            id: u.id,
            rol_id: u.rol_id,
            nombre: u.nombre,
            apellido: u.apellido,
            email: u.email,
            password_hash: u.password_hash,
            telefono: u.telefono,
            rol: u.rol_slug || u.rol || "CLIENTE",
            rol_nombre: u.rol_nombre || "Cliente",
            nivel_jerarquia: u.nivel_jerarquia || 1,
            permisos,
            activo: Boolean(u.activo),
            creado_en: u.creado_en
          };
        }
      } catch (err) {
        console.warn("[Store] Error consultando usuario por email en MySQL:", err.message);
      }
    }

    const user = state.users.find(u => u.email.toLowerCase() === cleanEmail) || null;
    if (!user) return null;
    const role = this.findRoleById(user.rol_id) || this.findRoleBySlug(user.rol);
    return {
      ...user,
      rol: role ? role.slug : user.rol,
      rol_id: role ? role.id : 5,
      rol_nombre: role ? role.nombre : "Cliente",
      permisos: role ? role.permisos : []
    };
  },

  async findUserById(id) {
    if (!id) return null;
    const numId = parseInt(id, 10);

    if (isDbConnected()) {
      try {
        const rows = await query(`
          SELECT u.id, u.rol_id, u.nombre, u.apellido, u.email, u.password_hash, u.telefono, u.rol, u.activo, u.creado_en,
                 r.nombre as rol_nombre, r.slug as rol_slug, r.nivel_jerarquia, r.permisos
          FROM usuarios u
          LEFT JOIN roles r ON u.rol_id = r.id
          WHERE u.id = ?
          LIMIT 1
        `, [numId]);

        if (rows && rows.length > 0) {
          const u = rows[0];
          let permisos = [];
          try {
            permisos = typeof u.permisos === "string" ? JSON.parse(u.permisos) : (u.permisos || []);
          } catch (e) {
            permisos = [];
          }
          return {
            id: u.id,
            rol_id: u.rol_id,
            nombre: u.nombre,
            apellido: u.apellido,
            email: u.email,
            password_hash: u.password_hash,
            telefono: u.telefono,
            rol: u.rol_slug || u.rol || "CLIENTE",
            rol_nombre: u.rol_nombre || "Cliente",
            nivel_jerarquia: u.nivel_jerarquia || 1,
            permisos,
            activo: Boolean(u.activo),
            creado_en: u.creado_en
          };
        }
      } catch (err) {
        console.warn("[Store] Error consultando usuario por id en MySQL:", err.message);
      }
    }

    const user = state.users.find(u => u.id === numId) || null;
    if (!user) return null;
    const role = this.findRoleById(user.rol_id) || this.findRoleBySlug(user.rol);
    return {
      ...user,
      rol: role ? role.slug : user.rol,
      rol_id: role ? role.id : 5,
      rol_nombre: role ? role.nombre : "Cliente",
      permisos: role ? role.permisos : []
    };
  },

  async getUsers() {
    if (isDbConnected()) {
      try {
        const rows = await query(`
          SELECT u.id, u.rol_id, u.nombre, u.apellido, u.email, u.telefono, u.rol, u.activo, u.creado_en,
                 r.nombre as rol_nombre, r.slug as rol_slug, r.nivel_jerarquia
          FROM usuarios u
          LEFT JOIN roles r ON u.rol_id = r.id
          ORDER BY u.id DESC
        `);
        if (rows && rows.length > 0) {
          return rows.map(u => ({
            id: u.id,
            rol_id: u.rol_id,
            nombre: u.nombre,
            apellido: u.apellido,
            email: u.email,
            telefono: u.telefono || "",
            rol: u.rol_slug || u.rol || "CLIENTE",
            rol_nombre: u.rol_nombre || "Cliente",
            nivel_jerarquia: u.nivel_jerarquia || 1,
            activo: Boolean(u.activo),
            creado_en: u.creado_en
          }));
        }
      } catch (err) {
        console.warn("[Store] Error listando usuarios de MySQL:", err.message);
      }
    }

    return state.users.map(u => {
      const role = this.findRoleById(u.rol_id) || this.findRoleBySlug(u.rol);
      return {
        id: u.id,
        rol_id: role ? role.id : 5,
        nombre: u.nombre,
        apellido: u.apellido,
        email: u.email,
        telefono: u.telefono,
        rol: role ? role.slug : (u.rol || "CLIENTE"),
        rol_nombre: role ? role.nombre : "Cliente",
        nivel_jerarquia: role ? role.nivel_jerarquia : 1,
        activo: u.activo,
        creado_en: u.creado_en
      };
    });
  },

  async createUser(userData) {
    const role = userData.rol_id ? this.findRoleById(userData.rol_id) : (userData.rol ? this.findRoleBySlug(userData.rol) : this.findRoleBySlug("CLIENTE"));
    const rolId = role ? role.id : (userData.rol_id || 5);
    const rolSlug = role ? role.slug : (userData.rol || "CLIENTE");
    const rolNombre = role ? role.nombre : "Cliente";
    const nombre = userData.nombre;
    const apellido = userData.apellido || "";
    const email = userData.email.toLowerCase().trim();
    const password_hash = userData.password_hash;
    const telefono = userData.telefono || "";
    const activo = userData.activo !== undefined ? (userData.activo ? 1 : 0) : 1;

    if (isDbConnected()) {
      try {
        const result = await query(
          "INSERT INTO usuarios (rol_id, nombre, apellido, email, password_hash, telefono, rol, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [rolId, nombre, apellido, email, password_hash, telefono, rolSlug, activo]
        );
        const newId = result.insertId;
        const newUser = {
          id: newId,
          rol_id: rolId,
          nombre,
          apellido,
          email,
          password_hash,
          telefono,
          rol: rolSlug,
          rol_nombre: rolNombre,
          activo: Boolean(activo),
          creado_en: new Date().toISOString()
        };
        state.users.push(newUser);
        return newUser;
      } catch (err) {
        console.error("[Store] Error insertando usuario en MySQL:", err.message);
        throw err;
      }
    }

    const newUser = {
      id: state.users.length > 0 ? Math.max(...state.users.map(u => u.id)) + 1 : 1,
      rol_id: rolId,
      nombre,
      apellido,
      email,
      password_hash,
      telefono,
      rol: rolSlug,
      rol_nombre: rolNombre,
      activo: true,
      creado_en: new Date().toISOString()
    };
    state.users.push(newUser);
    return newUser;
  },

  async updateUserRole(userId, newRolId) {
    const role = this.findRoleById(newRolId) || this.findRoleBySlug(newRolId);
    if (!role) throw new Error("Rol especificado no existe");

    const numId = parseInt(userId, 10);
    if (isDbConnected()) {
      try {
        await query(
          "UPDATE usuarios SET rol_id = ?, rol = ? WHERE id = ?",
          [role.id, role.slug, numId]
        );
      } catch (err) {
        console.error("[Store] Error actualizando rol en MySQL:", err.message);
        throw err;
      }
    }

    const idx = state.users.findIndex(u => u.id === numId);
    if (idx !== -1) {
      state.users[idx].rol_id = role.id;
      state.users[idx].rol = role.slug;
    }

    return {
      id: numId,
      rol_id: role.id,
      rol: role.slug,
      rol_nombre: role.nombre
    };
  },

  async deleteUser(userId) {
    const numId = parseInt(userId, 10);
    if (isDbConnected()) {
      try {
        const result = await query("DELETE FROM usuarios WHERE id = ?", [numId]);
        const idx = state.users.findIndex(u => u.id === numId);
        if (idx !== -1) state.users.splice(idx, 1);
        return result.affectedRows > 0;
      } catch (err) {
        console.error("[Store] Error eliminando usuario en MySQL:", err.message);
        throw err;
      }
    }
    const idx = state.users.findIndex(u => u.id === numId);
    if (idx === -1) return false;
    state.users.splice(idx, 1);
    return true;
  },

  // Concurrencia de Butacas y Bloqueos Temporales
  cleanExpiredHolds() {
    const now = Date.now();
    const expiredKeys = [];
    for (const [key, hold] of state.temporaryHolds.entries()) {
      if (hold.expiresAt <= now) {
        expiredKeys.push(key);
      }
    }
    expiredKeys.forEach(k => state.temporaryHolds.delete(k));
    return expiredKeys;
  },

  getSeatStatusMap(showtimeKey) {
    this.cleanExpiredHolds();
    const occupied = new Set(state.occupiedSeats[showtimeKey] || []);
    const overrides = state.seatOverrides[showtimeKey] || {};

    const lockedBy = {};
    for (const [key, hold] of state.temporaryHolds.entries()) {
      if (hold.showtimeKey === showtimeKey) {
        lockedBy[hold.seatId] = {
          sessionId: hold.sessionId,
          userId: hold.userId,
          expiresAt: hold.expiresAt,
          remainingSeconds: Math.max(0, Math.round((hold.expiresAt - Date.now()) / 1000))
        };
      }
    }

    return {
      showtimeKey,
      occupied: Array.from(occupied),
      overrides,
      lockedBy
    };
  },

  holdSeat(showtimeKey, seatId, sessionId, userId = null) {
    this.cleanExpiredHolds();
    const occupied = state.occupiedSeats[showtimeKey] || [];
    if (occupied.includes(seatId)) {
      return { success: false, reason: "OCCUPIED", message: "La butaca ya está ocupada o vendida." };
    }

    const key = `${showtimeKey}__${seatId}`;
    const existing = state.temporaryHolds.get(key);
    if (existing && existing.sessionId !== sessionId) {
      return { success: false, reason: "LOCKED_BY_OTHER", message: "La butaca está siendo seleccionada por otro cliente en este momento." };
    }

    const durationMinutes = state.settings.seatHoldMinutes || 5;
    const expiresAt = Date.now() + durationMinutes * 60 * 1000;

    const holdObj = {
      key,
      showtimeKey,
      seatId,
      sessionId,
      userId,
      expiresAt
    };

    state.temporaryHolds.set(key, holdObj);
    return {
      success: true,
      hold: {
        seatId,
        showtimeKey,
        expiresAt,
        remainingSeconds: durationMinutes * 60
      }
    };
  },

  releaseSeat(showtimeKey, seatId, sessionId) {
    const key = `${showtimeKey}__${seatId}`;
    const existing = state.temporaryHolds.get(key);
    if (existing && existing.sessionId === sessionId) {
      state.temporaryHolds.delete(key);
      return { success: true, seatId, showtimeKey };
    }
    return { success: false };
  },

  releaseAllSessionSeats(sessionId, showtimeKey = null) {
    const released = [];
    for (const [key, hold] of state.temporaryHolds.entries()) {
      if (hold.sessionId === sessionId && (!showtimeKey || hold.showtimeKey === showtimeKey)) {
        state.temporaryHolds.delete(key);
        released.push({ showtimeKey: hold.showtimeKey, seatId: hold.seatId });
      }
    }
    return released;
  },

  // Reservas
  async createBooking(bookingData) {
    const bookingId = "CMG-" + Math.floor(100000 + Math.random() * 900000);
    const subtotalTickets = parseFloat(bookingData.subtotalTickets) || 0;
    const subtotalSnacks = parseFloat(bookingData.subtotalSnacks) || 0;
    const total = parseFloat(bookingData.total) || (subtotalTickets + subtotalSnacks);
    const dateFormatted = new Date().toLocaleDateString("es-ES") + " " + new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

    const newBooking = {
      id: bookingId,
      bookingCode: bookingId,
      userId: bookingData.userId || null,
      customerName: bookingData.customerName || "Cliente Cine Majestad",
      customerEmail: bookingData.customerEmail || "cliente@cinemajestad.com",
      movieId: bookingData.movieId,
      movieTitle: bookingData.movieTitle,
      hall: bookingData.hall || "Sala 1",
      roomId: bookingData.roomId || "sala-1",
      showtime: bookingData.showtime,
      showtimeDate: bookingData.showtimeDate || "Hoy",
      seats: Array.isArray(bookingData.seats) ? bookingData.seats : [],
      snacks: Array.isArray(bookingData.snacks) ? bookingData.snacks : [],
      subtotalTickets: subtotalTickets,
      ticketsTotal: subtotalTickets,
      subtotalSnacks: subtotalSnacks,
      snacksTotal: subtotalSnacks,
      total: total,
      grandTotal: total,
      paymentMethod: bookingData.paymentMethod || "Tarjeta de Crédito",
      paymentStatus: "APROBADO",
      status: "CONFIRMADA",
      foodStatus: (bookingData.snacks && bookingData.snacks.length > 0) ? "PENDIENTE" : "SIN_COMIDA",
      date: dateFormatted,
      createdAt: new Date().toISOString()
    };

    // Marcar asientos ocupados permanentemente en la función
    const showtimeKey = `${newBooking.movieId}_${newBooking.showtime}`;
    if (!state.occupiedSeats[showtimeKey]) {
      state.occupiedSeats[showtimeKey] = [];
    }
    newBooking.seats.forEach(s => {
      const code = typeof s === "string" ? s : s.code;
      if (!state.occupiedSeats[showtimeKey].includes(code)) {
        state.occupiedSeats[showtimeKey].push(code);
      }
      state.temporaryHolds.delete(`${showtimeKey}__${code}`);
    });

    state.bookings.unshift(newBooking);

    // Persistir en MySQL
    try {
      if (isDbConnected()) {
        let funcionId = 1;
        const funcRows = await query(
          "SELECT id FROM funciones WHERE pelicula_id = ? AND hora_inicio LIKE ? LIMIT 1",
          [newBooking.movieId, `${newBooking.showtime}%`]
        );
        if (funcRows && funcRows.length > 0) {
          funcionId = funcRows[0].id;
        }

        const comisionPorc = 2.90;
        const comisionFija = 0.30;
        const comisionTotal = Number((total * 0.029 + 0.30).toFixed(2));
        const costoProd = Number((subtotalSnacks * 0.40).toFixed(2));
        const gananciaNeta = Number((total - comisionTotal - costoProd).toFixed(2));

        let mpEnum = "TARJETA_CREDITO";
        const mpStr = (newBooking.paymentMethod || "").toUpperCase();
        if (mpStr.includes("DEBITO")) mpEnum = "TARJETA_DEBITO";
        else if (mpStr.includes("TRANSFER") || mpStr.includes("NEQUI") || mpStr.includes("PSE")) mpEnum = "TRANSFERENCIA";
        else if (mpStr.includes("EFECTIVO") || mpStr.includes("TAQUILLA")) mpEnum = "EFECTIVO";

        const resInsert = await query(
          `INSERT INTO reservas (
            codigo_reserva, usuario_id, cliente_nombre, cliente_email, funcion_id,
            subtotal_boletos, subtotal_snacks, total_pagado, costo_total_productos,
            comision_pasarela_porcentaje, comision_pasarela_fija, comision_total_pasarela,
            ganancia_neta, estado, metodo_pago, referencia_pago
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMADA', ?, ?)`,
          [
            newBooking.bookingCode,
            newBooking.userId,
            newBooking.customerName,
            newBooking.customerEmail,
            funcionId,
            subtotalTickets,
            subtotalSnacks,
            total,
            costoProd,
            comisionPorc,
            comisionFija,
            comisionTotal,
            gananciaNeta,
            mpEnum,
            `TX-${bookingId}`
          ]
        );

        const newReservaId = resInsert ? resInsert.insertId : null;

        if (newReservaId) {
          for (const seatItem of newBooking.seats) {
            const seatCode = typeof seatItem === "string" ? seatItem : seatItem.code;
            const seatType = (typeof seatItem === "object" && seatItem.type === "VIP") ? "VIP" : "ESTANDAR";
            const seatPrice = (typeof seatItem === "object" && seatItem.price) ? seatItem.price : (seatType === "VIP" ? 8.50 : 5.50);

            let asientoId = null;
            const sRows = await query(
              "SELECT id FROM asientos WHERE codigo = ? LIMIT 1",
              [seatCode]
            );
            if (sRows && sRows.length > 0) {
              asientoId = sRows[0].id;
            }

            if (asientoId) {
              await query(
                `INSERT INTO reserva_asientos (reserva_id, funcion_id, asiento_id, precio_unitario, tipo_asiento)
                 VALUES (?, ?, ?, ?, ?)`,
                [newReservaId, funcionId, asientoId, seatPrice, seatType]
              );
            }
          }

          for (const snackItem of newBooking.snacks) {
            const sId = snackItem.id || "snack-01";
            const sQty = snackItem.qty || snackItem.quantity || 1;
            const sPrice = snackItem.price || 0;
            const sSub = sPrice * sQty;

            await query(
              `INSERT INTO reserva_snacks (reserva_id, producto_snack_id, cantidad, precio_unitario, subtotal)
               VALUES (?, ?, ?, ?, ?)`,
              [newReservaId, sId, sQty, sPrice, sSub]
            );
          }
        }
      }
    } catch (dbErr) {
      console.warn("[DB Booking Sync Error]:", dbErr.message);
    }

    return newBooking;
  },

  async getBookings(userId = null) {
    if (isDbConnected()) {
      try {
        let sql = `
          SELECT r.id, r.codigo_reserva, r.cliente_nombre, r.cliente_email,
                 r.subtotal_boletos, r.subtotal_snacks, r.total_pagado, r.estado,
                 r.metodo_pago, r.creado_en,
                 f.pelicula_id, p.titulo as pelicula_titulo, s.nombre as sala_nombre,
                 f.hora_inicio
          FROM reservas r
          LEFT JOIN funciones f ON r.funcion_id = f.id
          LEFT JOIN peliculas p ON f.pelicula_id = p.id
          LEFT JOIN salas s ON f.sala_id = s.id
        `;
        const params = [];
        if (userId) {
          sql += ` WHERE r.usuario_id = ?`;
          params.push(userId);
        }
        sql += ` ORDER BY r.creado_en DESC`;
        const rows = await query(sql, params);
        if (rows && rows.length > 0) {
          const dbBookings = [];
          for (const row of rows) {
            const aRows = await query(
              `SELECT a.codigo 
               FROM reserva_asientos ra 
               JOIN asientos a ON ra.asiento_id = a.id 
               WHERE ra.reserva_id = ?`,
              [row.id]
            );
            const seats = aRows ? aRows.map(a => a.codigo) : [];

            dbBookings.push({
              id: row.codigo_reserva,
              bookingCode: row.codigo_reserva,
              customerName: row.cliente_nombre,
              customerEmail: row.cliente_email,
              movieId: row.pelicula_id,
              movieTitle: row.pelicula_titulo || "Película Cine Majestad",
              hall: row.sala_nombre || "Sala 1",
              showtime: row.hora_inicio ? row.hora_inicio.substring(0, 5) : "14:30",
              seats: seats,
              subtotalTickets: parseFloat(row.subtotal_boletos) || 0,
              ticketsTotal: parseFloat(row.subtotal_boletos) || 0,
              subtotalSnacks: parseFloat(row.subtotal_snacks) || 0,
              snacksTotal: parseFloat(row.subtotal_snacks) || 0,
              total: parseFloat(row.total_pagado) || 0,
              grandTotal: parseFloat(row.total_pagado) || 0,
              status: row.estado,
              paymentMethod: row.metodo_pago,
              date: new Date(row.creado_en).toLocaleDateString("es-ES") + " " + new Date(row.creado_en).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
              createdAt: row.creado_en
            });
          }
          const allCodes = new Set(dbBookings.map(b => b.bookingCode));
          state.bookings.forEach(b => {
            if (!allCodes.has(b.bookingCode)) {
              dbBookings.push(b);
            }
          });
          return dbBookings;
        }
      } catch (err) {
        console.warn("[DB GetBookings Sync]:", err.message);
      }
    }
    if (userId) {
      return state.bookings.filter(b => b.userId === parseInt(userId, 10));
    }
    return state.bookings;
  },

  getBookingById(id) {
    return state.bookings.find(b => b.id.toUpperCase() === id.toUpperCase().trim()) || null;
  },

  updateFoodStatus(bookingId, newStatus) {
    const booking = this.getBookingById(bookingId);
    if (!booking) return null;
    booking.foodStatus = newStatus;
    return booking;
  },

  cancelBooking(bookingId) {
    const idx = state.bookings.findIndex(b => b.id.toUpperCase() === bookingId.toUpperCase().trim());
    if (idx === -1) return null;
    const removed = state.bookings[idx];

    // Liberar las butacas ocupadas
    const showtimeKey = `${removed.movieId}_${removed.showtime}`;
    if (state.occupiedSeats[showtimeKey]) {
      state.occupiedSeats[showtimeKey] = state.occupiedSeats[showtimeKey].filter(
        s => !removed.seats.includes(s)
      );
    }

    state.bookings.splice(idx, 1);
    return removed;
  },

  // Analíticas y Métricas
  getAnalytics() {
    const totalMovies = state.movies.length;
    const totalBookings = state.bookings.length;
    let totalRevenue = 0;
    let candyRevenue = 0;

    const movieSalesMap = {};
    const paymentMethodsMap = {
      "Tarjeta de Crédito / Débito": 0,
      "PSE": 0,
      "Nequi / Daviplata": 0,
      "Efectivo en Taquilla": 0
    };

    state.bookings.forEach(b => {
      totalRevenue += b.total || 0;
      candyRevenue += b.subtotalSnacks || 0;

      // Por película
      const mTitle = b.movieTitle || "Desconocida";
      movieSalesMap[mTitle] = (movieSalesMap[mTitle] || 0) + (b.total || 0);

      // Por método de pago
      const pm = b.paymentMethod || "Tarjeta de Crédito / Débito";
      if (pm.toLowerCase().includes("nequi") || pm.toLowerCase().includes("daviplata")) {
        paymentMethodsMap["Nequi / Daviplata"] += 1;
      } else if (pm.toLowerCase().includes("pse")) {
        paymentMethodsMap["PSE"] += 1;
      } else if (pm.toLowerCase().includes("efectivo") || pm.toLowerCase().includes("taquilla")) {
        paymentMethodsMap["Efectivo en Taquilla"] += 1;
      } else {
        paymentMethodsMap["Tarjeta de Crédito / Débito"] += 1;
      }
    });

    // Ocupación estimada por sala
    const occupancyByRoom = state.rooms.map(room => {
      let occupiedCount = 0;
      Object.keys(state.occupiedSeats).forEach(k => {
        // Encontrar si la película/función usa este room
        occupiedCount += state.occupiedSeats[k].length;
      });
      const maxPossible = room.capacity * 3; // 3 funciones promedio
      const percent = Math.min(100, Math.round((occupiedCount / (maxPossible || 1)) * 100));
      return {
        roomName: room.name,
        capacity: room.capacity,
        occupiedCount,
        percent: percent || 15
      };
    });

    return {
      totalMovies,
      totalBookings,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      candyRevenue: parseFloat(candyRevenue.toFixed(2)),
      movieSales: movieSalesMap,
      paymentMethods: paymentMethodsMap,
      occupancyByRoom
    };
  },

  // =============================================================================
  // INTELIGENCIA FINANCIERA: VENTAS, COSTOS, GANANCIAS, MÁRGENES E INTERESES
  // =============================================================================
  getFinancialAnalytics() {
    let grossRevenue = 0;
    let ticketRevenue = 0;
    let snackRevenue = 0;
    let totalCogs = 0;          // Cost of Goods Sold (Costo de adquisición de productos)
    let totalGatewayFees = 0;   // Comisiones e intereses bancarios/pasarelas

    // Mapa para acumular unidades vendidas por producto
    const snackSalesCount = {};
    state.snacks.forEach(s => { snackSalesCount[s.id] = 0; });

    state.bookings.forEach(b => {
      grossRevenue += b.total || 0;
      ticketRevenue += b.subtotalTickets || 0;
      snackRevenue += b.subtotalSnacks || 0;

      // Calcular costo de productos de esta venta
      if (b.snacks && Array.isArray(b.snacks)) {
        b.snacks.forEach(item => {
          const snackDef = state.snacks.find(s => s.id === item.id || s.name === item.name);
          const cost = snackDef ? (snackDef.costPrice || 0) : 0;
          const qty = item.qty || item.quantity || 1;
          totalCogs += cost * qty;

          if (snackDef) {
            snackSalesCount[snackDef.id] = (snackSalesCount[snackDef.id] || 0) + qty;
          }
        });
      }

      // Calcular comisiones / intereses financieros de pasarela
      const pm = (b.paymentMethod || "").toLowerCase();
      let fee = 0;
      if (pm.includes("nequi") || pm.includes("daviplata")) {
        // Nequi cobra aprox 1.5%
        fee = (b.total || 0) * 0.015;
      } else if (pm.includes("efectivo") || pm.includes("taquilla")) {
        // Efectivo presencial no tiene comisiones de pasarela digital
        fee = 0;
      } else {
        // Tarjeta de crédito / débito / PSE cobra 2.9% + $0.30 USD
        fee = ((b.total || 0) * 0.029) + 0.30;
      }
      totalGatewayFees += fee;
    });

    const netProfit = Math.max(0, grossRevenue - totalCogs - totalGatewayFees);
    const netMarginPercent = grossRevenue > 0 ? ((netProfit / grossRevenue) * 100) : 0;
    const grossMarginPercent = grossRevenue > 0 ? (((grossRevenue - totalCogs) / grossRevenue) * 100) : 0;

    // Análisis de rentabilidad producto por producto de inventario
    const inventoryProfitability = state.snacks.map(snack => {
      const soldUnits = snackSalesCount[snack.id] || 0;
      const cost = snackDef => snack.costPrice || 0;
      const price = snack.price;
      const unitProfit = price - snack.costPrice;
      const marginPercent = price > 0 ? ((unitProfit / price) * 100) : 0;
      const markupRoiPercent = snack.costPrice > 0 ? ((unitProfit / snack.costPrice) * 100) : 0;
      const productTotalRevenue = soldUnits * price;
      const productTotalCost = soldUnits * snack.costPrice;
      const productTotalProfit = productTotalRevenue - productTotalCost;
      const currentStockValue = snack.stock * snack.costPrice;

      return {
        id: snack.id,
        name: snack.name,
        category: snack.category,
        stock: snack.stock,
        costPrice: parseFloat(snack.costPrice.toFixed(2)),
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

  // =============================================================================
  // GESTIÓN DE PROVEEDORES (VENDORS / SUPPLIERS)
  // =============================================================================
  getSuppliers() {
    return state.suppliers || [];
  },

  getSupplierById(id) {
    return (state.suppliers || []).find(s => s.id === id) || null;
  },

  createSupplier(data) {
    const newSupplier = {
      id: data.id || "prov-" + Date.now(),
      empresa: data.empresa || "Proveedor Sin Nombre",
      nit_rut: data.nit_rut || "",
      contacto_nombre: data.contacto_nombre || "",
      telefono: data.telefono || "",
      email: data.email || "",
      categoria: data.categoria || "Insumos",
      porcentaje_ganancia: parseFloat(data.porcentaje_ganancia) || 0,
      porcentaje_comision: parseFloat(data.porcentaje_comision) || 0,
      terminos_pago: data.terminos_pago || "Contado",
      estado: data.estado || "ACTIVO",
      direccion: data.direccion || "",
      notas: data.notas || "",
      creado_en: new Date().toISOString()
    };
    state.suppliers.push(newSupplier);
    return newSupplier;
  },

  updateSupplier(id, data) {
    const idx = (state.suppliers || []).findIndex(s => s.id === id);
    if (idx > -1) {
      state.suppliers[idx] = {
        ...state.suppliers[idx],
        ...data,
        porcentaje_ganancia: data.porcentaje_ganancia != null ? parseFloat(data.porcentaje_ganancia) : state.suppliers[idx].porcentaje_ganancia,
        porcentaje_comision: data.porcentaje_comision != null ? parseFloat(data.porcentaje_comision) : state.suppliers[idx].porcentaje_comision,
        actualizado_en: new Date().toISOString()
      };
      return state.suppliers[idx];
    }
    return null;
  },

  deleteSupplier(id) {
    const initialLen = (state.suppliers || []).length;
    state.suppliers = (state.suppliers || []).filter(s => s.id !== id);
    return state.suppliers.length < initialLen;
  }
};

module.exports = Store;
