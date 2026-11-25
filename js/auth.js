/* ==========================================================================
   Cine Majestad - Controlador de Autenticación, Seguridad y Formularios
   Incluye:
   1. Validación robusta de formularios del lado cliente con feedback visual
   2. Bloqueo de seguridad tras 5 intentos fallidos (15 minutos de bloqueo con cuenta regresiva)
   3. Protección de información sensible y persistencia resiliente
   ========================================================================== */

let lockoutInterval = null;
let clientFailedAttempts = 0;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutos

document.addEventListener("DOMContentLoaded", () => {
  // Verificar si hay un bloqueo de seguridad activo en el almacenamiento local
  checkInitialLockout();

  // Si ya tiene sesión activa y llega a login.html, mostrar aviso y redirigir
  const currentUser = typeof Storage !== "undefined" && Storage.getAuthUser ? Storage.getAuthUser() : null;
  if (currentUser) {
    showAlert(`Ya has iniciado sesión como <strong>${currentUser.nombre}</strong> (${currentUser.rol}).`, "success");
    setTimeout(() => {
      redirectByRole(currentUser.rol);
    }, 1000);
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const returnTo = urlParams.get("returnTo");
  const tab = urlParams.get("tab");

  if (tab === "register") {
    switchAuthTab("register");
  }

  if (returnTo) {
    showAlert("🎟️ Para completar tu compra y asegurar tus boletos, inicia sesión o crea tu cuenta de cliente a continuación.", "info");
  }

  setupLiveValidation();
});

// =============================================================================
// GESTIÓN DEL BLOQUEO DE SEGURIDAD POR 5 INTENTOS FALLIDOS (15 MINUTOS)
// =============================================================================

function checkInitialLockout() {
  try {
    const rawLock = localStorage.getItem("cinemajestad_login_lockout");
    if (!rawLock) return;

    const lockData = JSON.parse(rawLock);
    const now = Date.now();

    if (lockData && lockData.lockedUntil && lockData.lockedUntil > now) {
      const remainingSeconds = Math.ceil((lockData.lockedUntil - now) / 1000);
      activateLockout(remainingSeconds);
    } else {
      clearLockout();
    }
  } catch (e) {
    console.warn("[Lockout Check]:", e);
  }
}

function activateLockout(durationSeconds = 900) {
  const emailInput = document.querySelector("#loginEmail");
  const passInput = document.querySelector("#loginPassword");
  const submitBtn = document.querySelector("#loginSubmitBtn");
  const banner = document.querySelector("#loginLockoutBanner");
  const countdownEl = document.querySelector("#lockoutCountdown");
  const attemptsBadge = document.querySelector("#loginAttemptsBadge");

  if (attemptsBadge) attemptsBadge.style.display = "none";

  // Guardar en localStorage para que persista al recargar la página o abrir otra pestaña
  const lockedUntil = Date.now() + durationSeconds * 1000;
  localStorage.setItem("cinemajestad_login_lockout", JSON.stringify({
    lockedUntil,
    email: emailInput ? emailInput.value.trim() : ""
  }));

  // Deshabilitar campos y botón
  if (emailInput) {
    emailInput.disabled = true;
    emailInput.classList.add("is-invalid");
  }
  if (passInput) {
    passInput.disabled = true;
    passInput.classList.add("is-invalid");
  }
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `🔒 Acceso Bloqueado (Seguridad)`;
  }

  if (banner) banner.style.display = "flex";

  if (lockoutInterval) clearInterval(lockoutInterval);

  const updateCountdownDisplay = (remainingSec) => {
    const m = Math.floor(remainingSec / 60);
    const s = remainingSec % 60;
    if (countdownEl) {
      countdownEl.textContent = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
  };

  updateCountdownDisplay(durationSeconds);

  let remaining = durationSeconds;
  lockoutInterval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(lockoutInterval);
      clearLockout();
      showAlert("El período de bloqueo de 15 minutos ha finalizado. Puedes volver a intentar iniciar sesión.", "success");
    } else {
      updateCountdownDisplay(remaining);
    }
  }, 1000);
}

function clearLockout() {
  if (lockoutInterval) clearInterval(lockoutInterval);
  lockoutInterval = null;
  clientFailedAttempts = 0;
  localStorage.removeItem("cinemajestad_login_lockout");

  const emailInput = document.querySelector("#loginEmail");
  const passInput = document.querySelector("#loginPassword");
  const submitBtn = document.querySelector("#loginSubmitBtn");
  const banner = document.querySelector("#loginLockoutBanner");
  const attemptsBadge = document.querySelector("#loginAttemptsBadge");

  if (emailInput) {
    emailInput.disabled = false;
    emailInput.classList.remove("is-invalid");
  }
  if (passInput) {
    passInput.disabled = false;
    passInput.classList.remove("is-invalid");
  }
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `Entrar a Cine Majestad 🎟️`;
  }
  if (banner) banner.style.display = "none";
  if (attemptsBadge) attemptsBadge.style.display = "none";
}

function updateAttemptsBadge(failedCount, maxAllowed = 5) {
  const badge = document.querySelector("#loginAttemptsBadge");
  if (!badge) return;
  const left = Math.max(0, maxAllowed - failedCount);
  if (failedCount > 0 && left > 0) {
    badge.innerHTML = `⚠️ <strong>Intento ${failedCount} de ${maxAllowed} fallido.</strong> Te quedan <strong>${left}</strong> intento(s) antes del bloqueo de seguridad de 15 minutos.`;
    badge.style.display = "block";
  } else {
    badge.style.display = "none";
  }
}

// =============================================================================
// VALIDACIÓN EN TIEMPO REAL DE FORMULARIOS (CLIENT-SIDE VALIDATION)
// =============================================================================

function setupLiveValidation() {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^[\d\s+\-().]{7,25}$/;

  // Campos de Login
  const loginEmail = document.querySelector("#loginEmail");
  const loginPassword = document.querySelector("#loginPassword");

  if (loginEmail) {
    const validateLoginEmail = () => {
      const val = loginEmail.value.trim();
      const valid = emailRegex.test(val);
      const err = document.querySelector("#loginEmailError");
      loginEmail.classList.toggle("is-invalid", !valid && val.length > 0);
      loginEmail.classList.toggle("is-valid", valid);
      if (err) err.classList.toggle("visible", !valid && val.length > 0);
      return valid;
    };
    loginEmail.addEventListener("input", validateLoginEmail);
    loginEmail.addEventListener("blur", validateLoginEmail);
  }

  if (loginPassword) {
    const validateLoginPassword = () => {
      const val = loginPassword.value;
      const valid = val.length >= 6;
      const err = document.querySelector("#loginPasswordError");
      loginPassword.classList.toggle("is-invalid", !valid && val.length > 0);
      loginPassword.classList.toggle("is-valid", valid);
      if (err) err.classList.toggle("visible", !valid && val.length > 0);
      return valid;
    };
    loginPassword.addEventListener("input", validateLoginPassword);
    loginPassword.addEventListener("blur", validateLoginPassword);
  }

  // Campos de Registro
  const regNombre = document.querySelector("#regNombre");
  const regEmail = document.querySelector("#regEmail");
  const regTelefono = document.querySelector("#regTelefono");
  const regPassword = document.querySelector("#regPassword");
  const regConfirm = document.querySelector("#regPasswordConfirm");

  if (regNombre) {
    const validateRegNombre = () => {
      const valid = regNombre.value.trim().length >= 2;
      const err = document.querySelector("#regNombreError");
      regNombre.classList.toggle("is-invalid", !valid && regNombre.value.length > 0);
      regNombre.classList.toggle("is-valid", valid);
      if (err) err.classList.toggle("visible", !valid && regNombre.value.length > 0);
      return valid;
    };
    regNombre.addEventListener("input", validateRegNombre);
    regNombre.addEventListener("blur", validateRegNombre);
  }

  if (regEmail) {
    const validateRegEmail = () => {
      const val = regEmail.value.trim();
      const valid = emailRegex.test(val);
      const err = document.querySelector("#regEmailError");
      regEmail.classList.toggle("is-invalid", !valid && val.length > 0);
      regEmail.classList.toggle("is-valid", valid);
      if (err) err.classList.toggle("visible", !valid && val.length > 0);
      return valid;
    };
    regEmail.addEventListener("input", validateRegEmail);
    regEmail.addEventListener("blur", validateRegEmail);
  }

  if (regTelefono) {
    regTelefono.addEventListener("input", () => {
      const val = regTelefono.value.trim();
      if (!val) {
        regTelefono.classList.remove("is-invalid", "is-valid");
        return;
      }
      const valid = phoneRegex.test(val);
      regTelefono.classList.toggle("is-invalid", !valid);
      regTelefono.classList.toggle("is-valid", valid);
    });
  }

  if (regPassword && regConfirm) {
    const validatePasswords = () => {
      const passVal = regPassword.value;
      const confVal = regConfirm.value;
      const errPass = document.querySelector("#regPasswordError");
      const errConf = document.querySelector("#regPasswordConfirmError");

      const passValid = passVal.length >= 6;
      regPassword.classList.toggle("is-invalid", !passValid && passVal.length > 0);
      regPassword.classList.toggle("is-valid", passValid);
      if (errPass) errPass.classList.toggle("visible", !passValid && passVal.length > 0);

      const confValid = passVal === confVal && confVal.length >= 6;
      regConfirm.classList.toggle("is-invalid", !confValid && confVal.length > 0);
      regConfirm.classList.toggle("is-valid", confValid);
      if (errConf) errConf.classList.toggle("visible", (!confValid && confVal.length > 0));

      return passValid && confValid;
    };

    regPassword.addEventListener("input", validatePasswords);
    regConfirm.addEventListener("input", validatePasswords);
    regPassword.addEventListener("blur", validatePasswords);
    regConfirm.addEventListener("blur", validatePasswords);
  }
}

// Alternar entre pestaña de Login y Registro
function switchAuthTab(tab) {
  const tabBtnLogin = document.querySelector("#tabBtnLogin");
  const tabBtnRegister = document.querySelector("#tabBtnRegister");
  const formLogin = document.querySelector("#loginForm");
  const formRegister = document.querySelector("#registerForm");
  const subtitle = document.querySelector("#authSubtitle");
  const alertEl = document.querySelector("#authAlert");

  if (alertEl && !new URLSearchParams(window.location.search).get("returnTo")) {
    alertEl.className = "auth-alert";
  }

  if (tab === "login") {
    tabBtnLogin.classList.add("active");
    tabBtnRegister.classList.remove("active");
    formLogin.classList.add("active");
    formRegister.classList.remove("active");
    if (subtitle) subtitle.textContent = "Ingresa tus credenciales para continuar tu experiencia cinematográfica";
  } else {
    tabBtnRegister.classList.add("active");
    tabBtnLogin.classList.remove("active");
    formRegister.classList.add("active");
    formLogin.classList.remove("active");
    if (subtitle) subtitle.textContent = "Crea tu cuenta de cliente en segundos para reservar y comprar tus boletos";
  }
}

// Alerta de feedback
function showAlert(message, type = "error") {
  const alertEl = document.querySelector("#authAlert");
  if (!alertEl) return;
  alertEl.innerHTML = message;
  alertEl.className = `auth-alert ${type}`;
}

// =============================================================================
// ENVÍO DE LOGIN CON RATE LIMITING Y BLOQUEO TRAS 5 INTENTOS
// =============================================================================

async function handleLoginSubmit(event) {
  event.preventDefault();

  // Verificar si está actualmente bloqueado
  const rawLock = localStorage.getItem("cinemajestad_login_lockout");
  if (rawLock) {
    try {
      const lockData = JSON.parse(rawLock);
      if (lockData && lockData.lockedUntil && lockData.lockedUntil > Date.now()) {
        const remainingSec = Math.ceil((lockData.lockedUntil - Date.now()) / 1000);
        activateLockout(remainingSec);
        showAlert(`El acceso se encuentra bloqueado por exceder 5 intentos fallidos. Espere ${Math.ceil(remainingSec / 60)} minuto(s).`);
        return;
      }
    } catch (e) {}
  }

  const emailInput = document.querySelector("#loginEmail");
  const passInput = document.querySelector("#loginPassword");
  const email = emailInput.value.trim().toLowerCase();
  const password = passInput.value;
  const submitBtn = document.querySelector("#loginSubmitBtn");
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Validación estricta de formulario
  let hasError = false;
  if (!email || !emailRegex.test(email)) {
    emailInput.classList.add("is-invalid");
    document.querySelector("#loginEmailError")?.classList.add("visible");
    hasError = true;
  } else {
    emailInput.classList.remove("is-invalid");
    emailInput.classList.add("is-valid");
    document.querySelector("#loginEmailError")?.classList.remove("visible");
  }

  if (!password || password.length < 6) {
    passInput.classList.add("is-invalid");
    document.querySelector("#loginPasswordError")?.classList.add("visible");
    hasError = true;
  } else {
    passInput.classList.remove("is-invalid");
    passInput.classList.add("is-valid");
    document.querySelector("#loginPasswordError")?.classList.remove("visible");
  }

  if (hasError) {
    showAlert("Por favor corrija los campos marcados en rojo antes de continuar.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `Verificando credenciales... ⏳`;

  try {
    let result = null;
    try {
      result = await API.auth.login({ email, password });
    } catch (apiErr) {
      // Si el servidor Express respondió con HTTP 429 (Too Many Requests / Bloqueo activo)
      if (apiErr.status === 429 || apiErr.locked || (apiErr.message && apiErr.message.includes("bloqueado"))) {
        const remSec = apiErr.remainingSeconds || 900;
        activateLockout(remSec);
        throw new Error(apiErr.message || "Acceso bloqueado por superar 5 intentos fallidos.");
      }

      // Si el servidor retornó HTTP 401 con intentos restantes
      if (apiErr.status === 401 && apiErr.attemptsLeft !== undefined) {
        clientFailedAttempts = MAX_FAILED_ATTEMPTS - apiErr.attemptsLeft;
        updateAttemptsBadge(clientFailedAttempts, MAX_FAILED_ATTEMPTS);
        if (clientFailedAttempts >= MAX_FAILED_ATTEMPTS) {
          activateLockout(900);
        }
        throw new Error(apiErr.message);
      }

      // Si no hubo respuesta del servidor (backend apagado), aplicar política de seguridad sobre almacenamiento local
      console.warn("[Auth API Offline]: Evaluando credenciales en almacenamiento local.");
      const localUsers = (typeof Storage !== "undefined" && Storage.getUsers) ? Storage.getUsers() : [];
      const matched = localUsers.find(u => u.email && u.email.toLowerCase() === email);

      if (matched) {
        // En modo local seguro, verificar contraseña
        const isPasswordValid = Boolean(matched.password && matched.password === password);
        if (isPasswordValid) {
          result = {
            success: true,
            token: "demo_jwt_token_" + Date.now(),
            user: {
              id: matched.id,
              nombre: matched.nombre,
              apellido: matched.apellido || "",
              email: matched.email,
              telefono: matched.telefono || "",
              rol: matched.rol
            }
          };
        } else {
          clientFailedAttempts++;
          updateAttemptsBadge(clientFailedAttempts, MAX_FAILED_ATTEMPTS);
          if (clientFailedAttempts >= MAX_FAILED_ATTEMPTS) {
            activateLockout(900);
            throw new Error("Has superado el límite de 5 intentos fallidos. El acceso ha sido bloqueado durante 15 minutos por seguridad.");
          } else {
            const left = MAX_FAILED_ATTEMPTS - clientFailedAttempts;
            throw new Error(`Contraseña incorrecta. Te quedan ${left} intento(s) antes del bloqueo de seguridad.`);
          }
        }
      } else {
        clientFailedAttempts++;
        updateAttemptsBadge(clientFailedAttempts, MAX_FAILED_ATTEMPTS);
        if (clientFailedAttempts >= MAX_FAILED_ATTEMPTS) {
          activateLockout(900);
          throw new Error("Has superado el límite de 5 intentos fallidos. El acceso ha sido bloqueado durante 15 minutos.");
        } else {
          const left = MAX_FAILED_ATTEMPTS - clientFailedAttempts;
          throw new Error(`Usuario no registrado. Te quedan ${left} intento(s) antes del bloqueo de seguridad.`);
        }
      }
    }

    // Inicio de sesión exitoso: limpiar lockout y contadores
    clearLockout();

    if (result && result.user) {
      API.setToken(result.token);
      Storage.setAuthUser(result.user);
      Storage.setAuthToken(result.token);
      if (result.user.rol) {
        Storage.setActiveRole(result.user.rol);
      }

      // Registrar turno de trabajador si aplica
      if (["TAQUILLERO", "CONFITERIA", "GERENTE", "TRABAJADOR"].includes(result.user.rol)) {
        if (typeof Storage.recordWorkerCheckIn === "function") {
          Storage.recordWorkerCheckIn(
            result.user.id,
            `${result.user.nombre} ${result.user.apellido || ""}`.trim(),
            result.user.rol
          );
        }
      }

      showAlert(`¡Bienvenido(a), <strong>${result.user.nombre}</strong>! Redirigiendo a tu panel...`, "success");

      setTimeout(() => {
        redirectByRole(result.user.rol);
      }, 700);
    } else {
      throw new Error("Respuesta inválida del servidor.");
    }
  } catch (err) {
    console.error("[Auth Login Error]:", err);
    showAlert(err.message || "Credenciales incorrectas.");
    // Si no está bloqueado, re-habilitar botón
    if (!localStorage.getItem("cinemajestad_login_lockout")) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `Entrar a Cine Majestad 🎟️`;
    }
  }
}

// =============================================================================
// ENVÍO DE REGISTRO CON VALIDACIÓN RIGUROSA
// =============================================================================

async function handleRegisterSubmit(event) {
  event.preventDefault();
  const nombreInput = document.querySelector("#regNombre");
  const apellidoInput = document.querySelector("#regApellido");
  const emailInput = document.querySelector("#regEmail");
  const telefonoInput = document.querySelector("#regTelefono");
  const passInput = document.querySelector("#regPassword");
  const confirmInput = document.querySelector("#regPasswordConfirm");
  const submitBtn = document.querySelector("#registerSubmitBtn");

  const nombre = nombreInput.value.trim();
  const apellido = apellidoInput ? apellidoInput.value.trim() : "";
  const email = emailInput.value.trim().toLowerCase();
  const telefono = telefonoInput ? telefonoInput.value.trim() : "";
  const password = passInput.value;
  const confirm = confirmInput.value;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let hasError = false;

  if (!nombre || nombre.length < 2) {
    nombreInput.classList.add("is-invalid");
    document.querySelector("#regNombreError")?.classList.add("visible");
    hasError = true;
  } else {
    nombreInput.classList.remove("is-invalid");
    nombreInput.classList.add("is-valid");
    document.querySelector("#regNombreError")?.classList.remove("visible");
  }

  if (!email || !emailRegex.test(email)) {
    emailInput.classList.add("is-invalid");
    document.querySelector("#regEmailError")?.classList.add("visible");
    hasError = true;
  } else {
    emailInput.classList.remove("is-invalid");
    emailInput.classList.add("is-valid");
    document.querySelector("#regEmailError")?.classList.remove("visible");
  }

  if (!password || password.length < 6) {
    passInput.classList.add("is-invalid");
    document.querySelector("#regPasswordError")?.classList.add("visible");
    hasError = true;
  } else {
    passInput.classList.remove("is-invalid");
    passInput.classList.add("is-valid");
    document.querySelector("#regPasswordError")?.classList.remove("visible");
  }

  if (password !== confirm || confirm.length < 6) {
    confirmInput.classList.add("is-invalid");
    document.querySelector("#regPasswordConfirmError")?.classList.add("visible");
    hasError = true;
  } else {
    confirmInput.classList.remove("is-invalid");
    confirmInput.classList.add("is-valid");
    document.querySelector("#regPasswordConfirmError")?.classList.remove("visible");
  }

  if (hasError) {
    showAlert("Por favor completa correctamente los campos obligatorios señalados en rojo.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `Creando cuenta de cliente... ⏳`;

  try {
    let result = null;
    try {
      result = await API.auth.register({ nombre, apellido, email, telefono, password });
    } catch (apiErr) {
      console.warn("[Auth Register Fallback]:", apiErr.message);

      const localUsers = (typeof Storage !== "undefined" && Storage.getUsers) ? Storage.getUsers() : [];
      const emailLower = email.toLowerCase();
      const existingUser = localUsers.find(u => u.email && u.email.toLowerCase() === emailLower);
      if (existingUser) {
        throw new Error("Ya existe una cuenta registrada con este correo electrónico. Por favor inicia sesión.");
      }

      const newId = localUsers.length > 0 ? Math.max(...localUsers.map(u => u.id || 0)) + 1 : 1;
      const newUser = {
        id: newId,
        nombre: nombre,
        apellido: apellido || "",
        email: emailLower,
        telefono: telefono || "",
        password: password,
        rol: "CLIENTE",
        rol_id: 5,
        rol_nombre: "Cliente",
        fecha_registro: new Date().toISOString()
      };

      localUsers.push(newUser);
      if (typeof Storage !== "undefined" && Storage.saveUsers) {
        Storage.saveUsers(localUsers);
      }

      result = {
        success: true,
        token: "demo_jwt_token_" + Date.now(),
        user: {
          id: newUser.id,
          nombre: newUser.nombre,
          apellido: newUser.apellido,
          email: newUser.email,
          telefono: newUser.telefono,
          rol: newUser.rol
        }
      };
    }

    if (result && result.user) {
      API.setToken(result.token);
      Storage.setAuthUser(result.user);
      Storage.setAuthToken(result.token);
      if (result.user.rol) {
        Storage.setActiveRole(result.user.rol);
      }

      showAlert(`¡Cuenta creada con éxito! Bienvenido(a) <strong>${result.user.nombre}</strong>.`, "success");

      setTimeout(() => {
        redirectByRole(result.user.rol || "CLIENTE");
      }, 800);
    } else {
      throw new Error("No se pudo procesar el registro del usuario.");
    }
  } catch (err) {
    console.error("[Auth Register Error]:", err);
    showAlert(err.message || "Error al registrar la cuenta.");
    submitBtn.disabled = false;
    submitBtn.innerHTML = `Crear mi Cuenta de Cliente 👑`;
  }
}

// Redirección según rol
function redirectByRole(role) {
  const urlParams = new URLSearchParams(window.location.search);
  const returnTo = urlParams.get("returnTo");

  if (returnTo) {
    window.location.href = returnTo;
    return;
  }

  if (role === "ADMIN" || role === "GERENTE") {
    window.location.href = "admin.html";
  } else if (role === "CONFITERIA") {
    window.location.href = "trabajador.html?tab=food";
  } else if (role === "TAQUILLERO" || role === "TRABAJADOR") {
    window.location.href = "trabajador.html?tab=print";
  } else {
    const currentOrder = typeof Storage !== "undefined" && Storage.getCurrentOrder ? Storage.getCurrentOrder() : null;
    if (currentOrder && currentOrder.movieId) {
      window.location.href = "seats.html";
    } else {
      window.location.href = "index.html";
    }
  }
}
