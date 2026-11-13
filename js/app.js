/* ==========================================================================
   Cine Majestad - Lógica Global, Navegación y Control de Roles
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  initNavbar();
  updateCartBadge();
  initUserProfileModal();
  checkPageAccess();

  // Escuchar si otra pestaña o acción cambió el rol activo o estado de sesión
  Storage.onSync((event) => {
    if (event.type === "ROLE_CHANGED" || event.type === "AUTH_STATE_CHANGED") {
      updateNavbarForRole();
      checkPageAccess();
    }
  });
});

// Inicialización de la barra de navegación con soporte de roles
function initNavbar() {
  updateNavbarForRole();

  // Buscador global rápido (index.html)
  const searchInput = document.querySelector("#globalSearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase().trim();
      const movieCards = document.querySelectorAll(".movie-card");
      
      movieCards.forEach(card => {
        const title = card.querySelector(".movie-card-title")?.textContent.toLowerCase() || "";
        const genre = card.querySelector(".movie-genre")?.textContent.toLowerCase() || "";
        if (title.includes(query) || genre.includes(query)) {
          card.style.display = "flex";
        } else {
          card.style.display = "none";
        }
      });
    });
  }
}

// Actualizar enlaces del navbar según el rol activo y estado de autenticación
function updateNavbarForRole() {
  const authUser = Storage.getAuthUser();
  const currentRole = (authUser && authUser.rol) ? authUser.rol : Storage.ROLES.CLIENTE;
  const currentPath = window.location.pathname;

  // 1. Limpieza de elementos de cambio manual de rol (seguridad: no se puede cambiar de rol sin iniciar sesión)
  const oldRoleBtn = document.querySelector("#roleBadgeBtn");
  if (oldRoleBtn) oldRoleBtn.remove();
  const oldRoleModal = document.querySelector("#roleSwitchModal");
  if (oldRoleModal) oldRoleModal.remove();

  // 2. Inyectar o actualizar el botón de Usuario / Login en la barra
  const navActions = document.querySelector(".nav-actions");
  if (navActions) {
    let userBtn = document.querySelector("#userAccountNavBtn");
    if (!userBtn) {
      userBtn = document.createElement("div");
      userBtn.id = "userAccountNavBtn";
      userBtn.style.display = "inline-flex";
      userBtn.style.alignItems = "center";
      userBtn.style.gap = "0.5rem";
      navActions.insertBefore(userBtn, navActions.firstChild);
    }

    if (authUser) {
      const isStaff = ["TRABAJADOR", "TAQUILLERO", "CONFITERIA", "GERENTE", "ADMIN"].includes(authUser.rol);
      const isAdmin = authUser.rol === "ADMIN" || authUser.rol === "GERENTE";
      const icon = isAdmin ? "👑" : (isStaff ? "👔" : "👤");
      const roleClass = isAdmin ? "role-admin" : (isStaff ? "role-trabajador" : "");
      const roleText = isAdmin ? "Admin" : (isStaff ? "Personal" : "Cliente");

      userBtn.innerHTML = `
        <button class="role-badge-btn ${roleClass}" onclick="openUserProfileModal()" title="Mi Cuenta (${roleText})">
          ${icon} ${authUser.nombre} <span style="font-size: 0.72rem; opacity: 0.85;">(${roleText})</span> ▾
        </button>
      `;
    } else {
      userBtn.innerHTML = `
        <a href="login.html" class="btn btn-secondary btn-sm" style="font-size: 0.82rem; padding: 0.45rem 0.85rem;" title="Iniciar sesión o registrarse">
          🔑 Iniciar Sesión
        </a>
      `;
    }
  }

  // 3. Filtrar enlaces visibles de navegación según el rol autenticado
  const navLinksContainer = document.querySelector(".nav-links");
  if (!navLinksContainer) return;

  let linksHtml = "";

  if (authUser && (currentRole === Storage.ROLES.ADMIN || currentRole === "GERENTE")) {
    linksHtml = `
      <li><a href="index.html" class="nav-link ${currentPath.endsWith('index.html') || currentPath.endsWith('/') ? 'active' : ''}">Cartelera</a></li>
      <li><a href="candybar.html" class="nav-link ${currentPath.endsWith('candybar.html') ? 'active' : ''}">Dulcería</a></li>
      <li><a href="trabajador.html" class="nav-link ${currentPath.endsWith('trabajador.html') ? 'active' : ''}">Portal Trabajador</a></li>
      <li><a href="admin.html" class="nav-link ${currentPath.endsWith('admin.html') ? 'active' : ''}">Panel Admin</a></li>
    `;
  } else if (authUser && ["TRABAJADOR", "TAQUILLERO", "CONFITERIA"].includes(currentRole)) {
    const workerLink = currentRole === "CONFITERIA" ? "trabajador.html?tab=food" : "trabajador.html?tab=print";
    const workerLabel = currentRole === "CONFITERIA" ? "🍿 Portal Dulcería" : "🎟️ Portal Taquilla";
    linksHtml = `
      <li><a href="index.html" class="nav-link ${currentPath.endsWith('index.html') || currentPath.endsWith('/') ? 'active' : ''}">Cartelera Web</a></li>
      <li><a href="candybar.html" class="nav-link ${currentPath.endsWith('candybar.html') ? 'active' : ''}">Dulcería</a></li>
      <li><a href="${workerLink}" class="nav-link ${currentPath.endsWith('trabajador.html') ? 'active' : ''}">${workerLabel}</a></li>
    `;
  } else {
    // Cliente o visitante anónimo
    linksHtml = `
      <li><a href="index.html" class="nav-link ${currentPath.endsWith('index.html') || currentPath.endsWith('/') ? 'active' : ''}">Cartelera</a></li>
      <li><a href="candybar.html" class="nav-link ${currentPath.endsWith('candybar.html') ? 'active' : ''}">Dulcería</a></li>
      <li><a href="checkout.html" class="nav-link ${currentPath.endsWith('checkout.html') ? 'active' : ''}">Mi Entrada</a></li>
    `;
  }

  navLinksContainer.innerHTML = linksHtml;
}

// Validación de Acceso por Página (Role Guard)
function checkPageAccess() {
  const authUser = Storage.getAuthUser();
  const currentPath = window.location.pathname;

  // Si está en admin.html
  if (currentPath.endsWith("admin.html")) {
    if (!authUser) {
      renderAccessRestrictedScreen("admin", "NO_AUTH");
      return;
    }
    if (authUser.rol !== Storage.ROLES.ADMIN && authUser.rol !== "GERENTE") {
      renderAccessRestrictedScreen("admin", "FORBIDDEN");
      return;
    }
  }

  // Si está en trabajador.html
  if (currentPath.endsWith("trabajador.html")) {
    if (!authUser) {
      renderAccessRestrictedScreen("trabajador", "NO_AUTH");
      return;
    }
    if (authUser.rol === Storage.ROLES.CLIENTE) {
      renderAccessRestrictedScreen("trabajador", "FORBIDDEN");
      return;
    }
  }
}

// Pantalla de Acceso Restringido para roles no autorizados
function renderAccessRestrictedScreen(requiredRoleType, reason = "NO_AUTH") {
  const main = document.querySelector("main");
  if (!main) return;

  const roleName = requiredRoleType === "admin" ? "Administrador" : "Trabajador / Personal";
  const authUser = Storage.getAuthUser();

  let messageHtml = "";
  let actionsHtml = "";

  if (reason === "NO_AUTH") {
    messageHtml = `
      <p style="color: var(--text-secondary); margin-bottom: 1.5rem; line-height: 1.5;">
        Esta sección está reservada exclusivamente para el personal de <strong>${roleName}</strong> de Cine Majestad.<br>
        Debes iniciar sesión con una cuenta autorizada creada previamente por la administración.
      </p>
    `;
    actionsHtml = `
      <a href="login.html?returnTo=${encodeURIComponent(window.location.pathname)}" class="btn btn-primary">🔐 Iniciar Sesión con Cuenta Autorizada</a>
      <a href="index.html" class="btn btn-secondary">← Volver a la Cartelera</a>
    `;
  } else {
    // FORBIDDEN: Está logueado pero es cliente
    messageHtml = `
      <p style="color: var(--text-secondary); margin-bottom: 1.5rem; line-height: 1.5;">
        Has iniciado sesión como <strong>${authUser.nombre}</strong> con perfil de <strong>${authUser.rol || 'CLIENTE'}</strong>.<br>
        No cuentas con los permisos para acceder a esta área de <strong>${roleName}</strong>.<br>
        <span style="color: var(--gold); font-size: 0.85rem; display: block; margin-top: 0.5rem;">
          Recuerda: Las cuentas y credenciales de trabajadores son creadas y gestionadas únicamente por el Administrador / Jefe del cine.
        </span>
      </p>
    `;
    actionsHtml = `
      <button class="btn btn-secondary" onclick="logoutUser()">🚪 Cerrar Sesión e Ingresar con Otra Cuenta</button>
      <a href="index.html" class="btn btn-primary">← Ir a la Cartelera de Películas</a>
    `;
  }

  main.innerHTML = `
    <div class="access-restricted-card">
      <div class="access-restricted-icon">🔒</div>
      <h2 style="font-size: 1.8rem; margin-bottom: 0.8rem; color: #fff;">Acceso Restringido</h2>
      ${messageHtml}
      <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
        ${actionsHtml}
      </div>
    </div>
  `;
}

// Actualizar indicador del carrito / pedido
function updateCartBadge() {
  const badge = document.querySelector("#cartBadge");
  if (!badge) return;

  const order = Storage.getCurrentOrder();
  if (!order) {
    badge.style.display = "none";
    return;
  }

  const seatsCount = order.seats ? order.seats.length : 0;
  const snacksCount = order.snacks ? order.snacks.reduce((acc, s) => acc + s.qty, 0) : 0;
  const totalItems = seatsCount + snacksCount;

  badge.textContent = totalItems;
  badge.style.display = totalItems > 0 ? "flex" : "none";
}

// Notificaciones Toast Flotantes
function showToast(message, type = "info") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span style="font-size: 1.2rem;">${type === 'success' ? '👑' : '✨'}</span>
    <div>${message}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(50px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Modal de Tráiler
function openTrailerModal(title, trailerUrl) {
  const modal = document.querySelector("#trailerModal");
  const iframe = document.querySelector("#trailerIframe");
  const modalTitle = document.querySelector("#trailerModalTitle");

  if (!modal || !iframe) return;

  modalTitle.textContent = title;
  iframe.src = `${trailerUrl}?autoplay=1`;
  modal.classList.add("open");
}

function closeTrailerModal() {
  const modal = document.querySelector("#trailerModal");
  const iframe = document.querySelector("#trailerIframe");

  if (!modal || !iframe) return;

  iframe.src = "";
  modal.classList.remove("open");
}

// =============================================================================
// MODAL DE PERFIL DE USUARIO E HISTORIAL DE RESERVAS ("Mi Perfil")
// =============================================================================
function initUserProfileModal() {
  if (document.querySelector("#userProfileModal")) return;

  const modalHtml = `
    <div class="modal-backdrop" id="userProfileModal">
      <div class="modal-content" style="max-width: 680px; max-height: 85vh; display: flex; flex-direction: column;">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <span style="font-size: 1.4rem;">👑</span>
            <h3 style="color: #fff; margin: 0;">Mi Cuenta | Cine Majestad</h3>
          </div>
          <button class="modal-close" onclick="closeUserProfileModal()">✕</button>
        </div>

        <div style="padding: 1.5rem; overflow-y: auto; flex: 1;">
          <!-- Resumen de Datos Personales -->
          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.2rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <h4 id="profileUserName" style="font-size: 1.2rem; color: #fff; margin-bottom: 0.2rem;">Nombre Usuario</h4>
              <p id="profileUserEmail" style="color: var(--text-secondary); font-size: 0.88rem; margin: 0;">email@ejemplo.com</p>
              <span id="profileUserRoleBadge" class="badge" style="margin-top: 0.5rem; display: inline-block;">ROL</span>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="logoutUser()" style="color: #ff5252; border-color: rgba(255, 82, 82, 0.4);">
              🚪 Cerrar Sesión
            </button>
          </div>

          <!-- Historial de Boletos y Reservas -->
          <div>
            <h4 style="color: var(--gold); font-size: 1rem; margin-bottom: 0.8rem; display: flex; align-items: center; gap: 0.4rem;">
              🎟️ Mis Entradas y Compras Recientes
            </h4>
            <div id="profileBookingsList" style="display: flex; flex-direction: column; gap: 0.8rem;">
              <!-- Inyectado dinámicamente -->
            </div>
          </div>
        </div>

        <div class="modal-footer" style="padding: 1rem 1.5rem; display: flex; justify-content: flex-end; border-top: 1px solid var(--border-color);">
          <button class="btn btn-secondary" onclick="closeUserProfileModal()">Cerrar</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);
}

function openUserProfileModal() {
  const modal = document.querySelector("#userProfileModal");
  if (!modal) return;

  const user = Storage.getAuthUser();
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // Cargar datos del usuario
  const nameEl = document.querySelector("#profileUserName");
  const emailEl = document.querySelector("#profileUserEmail");
  const roleBadge = document.querySelector("#profileUserRoleBadge");

  if (nameEl) nameEl.textContent = `${user.nombre} ${user.apellido || ""}`;
  if (emailEl) emailEl.textContent = user.email;
  if (roleBadge) {
    roleBadge.textContent = user.rol;
    roleBadge.className = user.rol === "ADMIN" ? "badge badge-vip" : user.rol === "TRABAJADOR" ? "badge badge-format" : "badge";
  }

  renderUserProfileBookings(user.id);
  modal.classList.add("open");
}

function closeUserProfileModal() {
  const modal = document.querySelector("#userProfileModal");
  if (modal) modal.classList.remove("open");
}

function renderUserProfileBookings(userId) {
  const container = document.querySelector("#profileBookingsList");
  if (!container) return;

  // Filtrar boletos del usuario o todas si es demo
  const allBookings = Storage.getBookings();
  const userBookings = allBookings.filter(b => !b.userId || b.userId === userId);

  if (userBookings.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-muted); background: rgba(255,255,255,0.02); border-radius: var(--radius-sm);">
        <p style="font-size: 1.5rem; margin-bottom: 0.3rem;">🎟️</p>
        <p>Aún no tienes reservas registradas en tu cuenta.</p>
        <a href="index.html" class="btn btn-primary btn-sm" style="margin-top: 0.8rem; display: inline-block;">Explorar Cartelera</a>
      </div>
    `;
    return;
  }

  container.innerHTML = userBookings.map(b => `
    <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.8rem;">
      <div>
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem;">
          <strong style="color: #fff; font-size: 1.05rem;">${b.movieTitle}</strong>
          <span class="badge" style="background: rgba(212, 175, 55, 0.15); color: var(--gold); font-size: 0.72rem;">${b.id}</span>
        </div>
        <p style="color: var(--text-secondary); font-size: 0.82rem; margin: 0;">
          🕒 ${b.hall} • Horario: ${b.showtime} (${b.showtimeDate || 'Hoy'})
        </p>
        <p style="color: var(--gold); font-size: 0.82rem; margin-top: 0.2rem;">
          💺 Butacas: <strong>${(b.seats || []).join(", ")}</strong> • Total: <strong style="color:#00e676;">$${(b.total || 0).toFixed(2)}</strong>
        </p>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn btn-secondary btn-sm" onclick="downloadBookingPdf('${b.id}')" title="Descargar Boleto en PDF">
          📥 PDF
        </button>
      </div>
    </div>
  `).join("");
}

function logoutUser() {
  const authUser = Storage.getAuthUser();
  if (authUser && ["TAQUILLERO", "CONFITERIA", "GERENTE", "TRABAJADOR"].includes(authUser.rol)) {
    if (typeof Storage.recordWorkerCheckOut === "function") {
      Storage.recordWorkerCheckOut(authUser.id);
    }
  }
  Storage.logout();
  API.setToken(null);
  closeUserProfileModal();
  updateNavbarForRole();
  showToast("Sesión cerrada correctamente. ¡Hasta pronto!", "info");
  setTimeout(() => {
    window.location.reload();
  }, 600);
}

