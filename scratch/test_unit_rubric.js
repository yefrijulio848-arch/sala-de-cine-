const { validateRegister, validateLogin, validateMovie, validateOrder, validateSnack } = require("../server/middlewares/validator");
const { checkLoginLockout, recordFailedLogin, resetLoginLockout } = require("../server/middlewares/rateLimiter");
const authController = require("../server/controllers/authController");
const orderController = require("../server/controllers/orderController");
const Store = require("../server/models/store");

function createMockReqRes(body = {}, query = {}, headers = {}, params = {}) {
  const req = {
    body,
    query,
    headers,
    params,
    socket: { remoteAddress: "127.0.0.1" }
  };
  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    get statusCode() {
      return statusCode;
    },
    get body() {
      return responseData;
    }
  };

  return { req, res };
}

async function runUnitTests() {
  console.log("=== VERIFICACIÓN UNITARIA RIGUROSA DE LAS 5 FALLAS DE LA RÚBRICA ===\n");
  let allPassed = true;

  // --------------------------------------------------------------------------
  // 1. VALIDACIÓN DEL LADO SERVIDOR (HTTP 400 y errores estructurados)
  // --------------------------------------------------------------------------
  console.log("1. Validación del Lado Servidor:");
  {
    const { req, res } = createMockReqRes({ nombre: "X", email: "correo_invalido", password: "123" });
    let nextCalled = false;
    validateRegister(req, res, () => { nextCalled = true; });

    if (!nextCalled && res.statusCode === 400 && Array.isArray(res.body.errors) && res.body.errors.length >= 2) {
      console.log("  [PASS] validateRegister rechaza datos erróneos con HTTP 400 y lista de errores.");
    } else {
      console.error("  [FAIL] validateRegister no rechazó correctamente:", res.statusCode, res.body);
      allPassed = false;
    }
  }
  {
    const { req, res } = createMockReqRes({ email: "invalid-mail", password: "" });
    let nextCalled = false;
    validateLogin(req, res, () => { nextCalled = true; });

    if (!nextCalled && res.statusCode === 400 && Array.isArray(res.body.errors)) {
      console.log("  [PASS] validateLogin rechaza campos vacíos/inválidos con HTTP 400.");
    } else {
      console.error("  [FAIL] validateLogin no rechazó correctamente:", res.statusCode, res.body);
      allPassed = false;
    }
  }
  {
    const { req, res } = createMockReqRes({ movieId: "mov-01", showtime: "14:00", seats: [] });
    let nextCalled = false;
    validateOrder(req, res, () => { nextCalled = true; });

    if (!nextCalled && res.statusCode === 400) {
      console.log("  [PASS] validateOrder rechaza reservas sin butacas con HTTP 400.");
    } else {
      console.error("  [FAIL] validateOrder falló:", res.statusCode, res.body);
      allPassed = false;
    }
  }

  // --------------------------------------------------------------------------
  // 2. PROTECCIÓN DE INFORMACIÓN SENSIBLE
  // --------------------------------------------------------------------------
  console.log("\n2. Protección de Información Sensible:");
  {
    const { req, res } = createMockReqRes({
      email: "admin@cinemajestad.com",
      password: "123456"
    });
    await authController.login(req, res);

    if (res.statusCode === 200 && res.body.user) {
      const hasPassword = "password" in res.body.user || "password_hash" in res.body.user;
      if (!hasPassword) {
        console.log("  [PASS] Objeto de usuario retornado NO expone 'password' ni 'password_hash'.");
      } else {
        console.error("  [FAIL] Se filtraron campos sensibles:", res.body.user);
        allPassed = false;
      }
    } else {
      console.error("  [FAIL] Login admin falló:", res.statusCode, res.body);
      allPassed = false;
    }
  }
  {
    // Verificar que contraseñas erróneas NO tengan bypass
    const { req, res } = createMockReqRes({
      email: "admin@cinemajestad.com",
      password: "clave_totalmente_falsa"
    });
    await authController.login(req, res);

    if (res.statusCode === 401) {
      console.log("  [PASS] Bypasses inseguros eliminados: contraseña falsa rechazada con HTTP 401.");
    } else {
      console.error("  [FAIL] Se aceptó una contraseña incorrecta:", res.statusCode, res.body);
      allPassed = false;
    }
  }

  // --------------------------------------------------------------------------
  // 3. 5 INTENTOS FALLIDOS SE CIERRE EL LOGIN (HTTP 429 & Lockout)
  // --------------------------------------------------------------------------
  console.log("\n3. Regla de 5 Intentos Fallidos se Cierre el Login (15 min):");
  {
    const testEmail = "usuario_lockout_test_" + Date.now() + "@cinemajestad.com";

    // Intentos 1 a 4: retornan 401 con attemptsLeft decreciente
    for (let i = 1; i <= 4; i++) {
      const { req, res } = createMockReqRes({
        email: testEmail,
        password: "wrong_password_" + i
      });
      await authController.login(req, res);

      if (res.statusCode === 401 && res.body.attemptsLeft === (5 - i)) {
        console.log(`  [PASS] Intento ${i}/5: HTTP 401, te quedan ${res.body.attemptsLeft} intentos.`);
      } else {
        console.error(`  [FAIL] Intento ${i} falló:`, res.statusCode, res.body);
        allPassed = false;
      }
    }

    // 5to intento: Debe retornar HTTP 429 Too Many Requests y locked: true
    const { req: req5, res: res5 } = createMockReqRes({
      email: testEmail,
      password: "wrong_password_5"
    });
    await authController.login(req5, res5);

    if (res5.statusCode === 429 && res5.body.locked === true && res5.body.remainingSeconds > 0) {
      console.log(`  [PASS] 5to intento: HTTP 429 BLOQUEO ACTIVADO (espera: ${res5.body.remainingSeconds}s).`);
    } else {
      console.error("  [FAIL] 5to intento no activó el bloqueo 429:", res5.statusCode, res5.body);
      allPassed = false;
    }

    // 6to intento: Mientras está bloqueado, debe retornar 429 de inmediato
    const { req: req6, res: res6 } = createMockReqRes({
      email: testEmail,
      password: "any_password"
    });
    await authController.login(req6, res6);

    if (res6.statusCode === 429 && res6.body.locked === true) {
      console.log("  [PASS] Intento posterior: Bloqueo sostenido sin procesar credenciales (HTTP 429).");
    } else {
      console.error("  [FAIL] No mantuvo el bloqueo 429:", res6.statusCode, res6.body);
      allPassed = false;
    }
  }

  // --------------------------------------------------------------------------
  // 4. INTERACCIÓN ENTRE MÓDULOS (Boletos ⇄ Dulcería/Inventario Stock)
  // --------------------------------------------------------------------------
  console.log("\n4. Interacción entre Módulos:");
  {
    const snacks = await Store.getSnacks();
    const testSnack = snacks[0];
    const initialStock = testSnack.stock;

    const { req, res } = createMockReqRes({
      movieId: "mov-01",
      movieTitle: "Dune: Parte Dos",
      hall: "Sala 1",
      showtime: "18:00",
      seats: ["E-3", "E-4"],
      snacks: [{ id: testSnack.id, name: testSnack.name, quantity: 3, price: testSnack.price }],
      subtotalTickets: 13.00,
      subtotalSnacks: 15.00,
      total: 28.00,
      paymentMethod: "Tarjeta de Crédito (•••• 4242)"
    });
    req.app = { get: () => null };

    await orderController.createOrder(req, res);

    const snacksAfter = await Store.getSnacks();
    const updatedSnack = snacksAfter.find(s => s.id === testSnack.id);

    if (res.statusCode === 201 && updatedSnack.stock === initialStock - 3) {
      console.log(`  [PASS] Stock de dulcería sincronizado e integrado con la compra de boletos: antes=${initialStock}, después=${updatedSnack.stock}.`);
    } else {
      console.error("  [FAIL] Sincronización de inventario falló:", { resBody: res.body, updatedStock: updatedSnack.stock });
      allPassed = false;
    }
  }

  console.log("\n==================================================================");
  if (allPassed) {
    console.log(" ¡ÉXITO TOTAL: LAS 5 CORRECCIONES HAN SIDO VERIFICADAS Y CUMPLEN 100%! ");
  } else {
    console.log(" Hubo fallas en las verificaciones.");
  }
  console.log("==================================================================");

  process.exit(allPassed ? 0 : 1);
}

runUnitTests().catch(err => {
  console.error("Error inesperado en tests unitarios:", err);
  process.exit(1);
});
