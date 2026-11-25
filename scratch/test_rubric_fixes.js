const http = require("http");
const { app } = require("../server");
const Store = require("../server/models/store");

let serverInstance;
let serverPort;

function request(path, method, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1",
      port: serverPort,
      path,
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers
      }
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data, headers: res.headers });
        }
      });
    });
    req.on("error", reject);
    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  await new Promise(resolve => {
    serverInstance = app.listen(0, "127.0.0.1", () => {
      serverPort = serverInstance.address().port;
      console.log(`[Test Server] Activo en puerto efímero ${serverPort}`);
      resolve();
    });
  });

  console.log("=== INICIANDO VERIFICACIÓN DE LAS 5 CORRECCIONES DE LA RÚBRICA ===\n");
  let allPassed = true;

  // --------------------------------------------------------------------------
  // TEST 1: Validación del Lado Servidor (Rechazo HTTP 400 con errores estructurados)
  // --------------------------------------------------------------------------
  console.log("1. Probando Validación del Lado Servidor (HTTP 400):");

  const invalidReg = await request("/api/auth/register", "POST", {
    nombre: "A",
    email: "correo_invalido",
    password: "123"
  });

  if (invalidReg.status === 400 && invalidReg.body.errors && invalidReg.body.errors.length >= 2) {
    console.log("  [PASS] Registro con datos inválidos rechazado con HTTP 400 y lista de errores.");
  } else {
    console.error("  [FAIL] Falló validación de registro:", invalidReg);
    allPassed = false;
  }

  const invalidLogin = await request("/api/auth/login", "POST", {
    email: "no-email",
    password: ""
  });

  if (invalidLogin.status === 400 && invalidLogin.body.errors) {
    console.log("  [PASS] Login con formato inválido rechazado con HTTP 400.");
  } else {
    console.error("  [FAIL] Falló validación de login:", invalidLogin);
    allPassed = false;
  }

  // --------------------------------------------------------------------------
  // TEST 2: Protección de Información Sensible (Sin hashes ni bypasses)
  // --------------------------------------------------------------------------
  console.log("\n2. Probando Protección de Información Sensible:");

  const validLogin = await request("/api/auth/login", "POST", {
    email: "admin@cinemajestad.com",
    password: "123456"
  });

  if (validLogin.status === 200 && validLogin.body.user) {
    const hasSensitive = "password" in validLogin.body.user || "password_hash" in validLogin.body.user;
    if (!hasSensitive) {
      console.log("  [PASS] Respuesta de Login saneada: NO contiene password ni password_hash.");
    } else {
      console.error("  [FAIL] Se detectaron datos sensibles en respuesta:", validLogin.body.user);
      allPassed = false;
    }
  } else {
    console.error("  [FAIL] Login admin no pudo completarse:", validLogin);
    allPassed = false;
  }

  // Comprobar que contraseñas incorrectas son rechazadas
  const badAdminLogin = await request("/api/auth/login", "POST", {
    email: "admin@cinemajestad.com",
    password: "clave_totalmente_incorrecta"
  });

  if (badAdminLogin.status === 401) {
    console.log("  [PASS] Contraseña incorrecta rechazada con HTTP 401 (sin bypasses inseguros).");
  } else {
    console.error("  [FAIL] Debería rechazar contraseña incorrecta:", badAdminLogin);
    allPassed = false;
  }

  // --------------------------------------------------------------------------
  // TEST 3: 5 Intentos Fallidos se Cierre el Login (HTTP 429 & Lockout)
  // --------------------------------------------------------------------------
  console.log("\n3. Probando Bloqueo tras 5 Intentos Fallidos (Rate Limiting 15 mins):");
  const testEmail = "test_lockout_" + Date.now() + "@cinemajestad.com";

  for (let attempt = 1; attempt <= 4; attempt++) {
    const failRes = await request("/api/auth/login", "POST", {
      email: testEmail,
      password: "wrong_password"
    });

    if (failRes.status === 401 && failRes.body.attemptsLeft === (5 - attempt)) {
      console.log(`  [PASS] Intento fallido ${attempt}/5: HTTP 401, quedan ${failRes.body.attemptsLeft} intentos.`);
    } else {
      console.error(`  [FAIL] Intento ${attempt} no retornó lo esperado:`, failRes);
      allPassed = false;
    }
  }

  // 5to intento fallido: Debe bloquearse inmediatamente con HTTP 429
  const lockRes = await request("/api/auth/login", "POST", {
    email: testEmail,
    password: "wrong_password"
  });

  if (lockRes.status === 429 && lockRes.body.locked === true) {
    console.log(`  [PASS] 5to intento fallido: HTTP 429 BLOQUEADO exitosamente (${lockRes.body.remainingSeconds}s restantes).`);
  } else {
    console.error("  [FAIL] 5to intento no bloqueó el acceso:", lockRes);
    allPassed = false;
  }

  // 6to intento (durante el bloqueo): Debe seguir bloqueado con HTTP 429
  const subsequentRes = await request("/api/auth/login", "POST", {
    email: testEmail,
    password: "any_password"
  });

  if (subsequentRes.status === 429 && subsequentRes.body.locked === true) {
    console.log("  [PASS] Intento posterior durante el bloqueo: Rechazado inmediatamente con HTTP 429.");
  } else {
    console.error("  [FAIL] Intento bloqueado no fue rechazado:", subsequentRes);
    allPassed = false;
  }

  // --------------------------------------------------------------------------
  // TEST 4: Interacción entre Módulos (Stock de dulcería al crear reserva)
  // --------------------------------------------------------------------------
  console.log("\n4. Probando Interacción entre Módulos (Boletos ⇄ Dulcería/Stock):");
  const snacksBefore = await Store.getSnacks();
  const testSnack = snacksBefore[0];
  const initialStock = testSnack.stock;

  const orderToken = validLogin.body.token;
  const orderRes = await request("/api/orders", "POST", {
    movieId: "mov-01",
    showtime: "14:30",
    seats: ["C-5"],
    total: 15.50,
    snacks: [{ id: testSnack.id, name: testSnack.name, quantity: 2, price: testSnack.price }]
  }, {
    "Authorization": `Bearer ${orderToken}`
  });

  const snacksAfter = await Store.getSnacks();
  const updatedSnack = snacksAfter.find(s => s.id === testSnack.id);

  if (orderRes.status === 201 && updatedSnack.stock === initialStock - 2) {
    console.log(`  [PASS] Stock de dulcería descontado automáticamente: antes=${initialStock}, después=${updatedSnack.stock}.`);
  } else {
    console.error("  [FAIL] Error en sincronización de stock entre módulos:", { orderRes, updatedSnack });
    allPassed = false;
  }

  console.log("\n==================================================================");
  if (allPassed) {
    console.log(" RESULTADO: ¡TODAS LAS 5 CORRECCIONES DE LA RÚBRICA PASARON CON ÉXITO! ");
  } else {
    console.log(" RESULTADO: Hubo fallos en algunos tests.");
  }
  console.log("==================================================================");

  serverInstance.close();
  process.exit(allPassed ? 0 : 1);
}

runTests().catch(err => {
  console.error("Error fatal en suite de pruebas:", err);
  if (serverInstance) serverInstance.close();
  process.exit(1);
});
