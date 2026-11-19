/* ==========================================================================
   Cine Majestad - Lógica Global, Navegación y Control de Roles
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  initNavbar();
  updateCartBadge();
  initUserProfileModal();
  initNavDrawer();
  checkPageAccess();

  // Escuchar si otra pestaña o acción cambió el rol activo o estado de sesión
  Storage.onSync((event) => {
    if (event.type === "ROLE_CHANGED" || event.type === "AUTH_STATE_CHANGED") {
      updateNavbarForRole();
      checkPageAccess();
      if (document.body.classList.contains("drawer-open")) {
        renderNavDrawerContent();
      }
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

  // 2. Inyectar o actualizar el botón de Usuario / Login y las 3 Rayas (Menú)
  const navActions = document.querySelector(".nav-actions");
  if (navActions) {
    let userBtn = document.querySelector("#userAccountNavBtn");
    if (!userBtn) {
      userBtn = document.createElement("div");
      userBtn.id = "userAccountNavBtn";
      userBtn.style.display = "inline-flex";
      userBtn.style.alignItems = "center";
      userBtn.style.gap = "0.6rem";
      navActions.insertBefore(userBtn, navActions.firstChild);
    }

    const isStaffOrAdmin = authUser && ["TRABAJADOR", "TAQUILLERO", "CONFITERIA", "GERENTE", "ADMIN"].includes(authUser.rol);
    const isAdmin = authUser && (authUser.rol === "ADMIN" || authUser.rol === "GERENTE");
    const isSpecialPage = currentPath.endsWith("admin.html") || currentPath.endsWith("trabajador.html");

    // Botón de las 3 rayas (☰)
    const burgerHtml = (isStaffOrAdmin || isSpecialPage) ? `
      <button class="menu-burger-btn" id="menuBurgerBtn" onclick="toggleNavDrawer()" aria-label="Abrir Menú de Opciones" title="Menú de Navegación y Acciones (3 Rayas)">
        <span class="burger-bar bar-top"></span>
        <span class="burger-bar bar-mid"></span>
        <span class="burger-bar bar-bot"></span>
      </button>
    ` : '';

    if (authUser) {
      const isStaff = ["TRABAJADOR", "TAQUILLERO", "CONFITERIA", "GERENTE", "ADMIN"].includes(authUser.rol);
      const icon = isAdmin ? "👑" : (isStaff ? "👔" : "👤");
      const roleClass = isAdmin ? "role-admin" : (isStaff ? "role-trabajador" : "");
      const roleText = isAdmin ? "Admin" : (isStaff ? "Personal" : "Cliente");

      userBtn.innerHTML = `
        <button class="role-badge-btn ${roleClass}" onclick="openUserProfileModal()" title="Mi Perfil (${roleText})">
          ${icon} ${authUser.nombre} <span style="font-size: 0.72rem; opacity: 0.85;">(${roleText})</span>
        </button>
        ${burgerHtml}
      `;
    } else {
      userBtn.innerHTML = `
        <a href="login.html" class="btn btn-secondary btn-sm" style="font-size: 0.82rem; padding: 0.45rem 0.85rem;" title="Iniciar sesión o registrarse">
          🔑 Iniciar Sesión
        </a>
        ${burgerHtml}
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
  showToast("Sesión cerrada correctamente. Regresando a la cartelera...", "info");
  setTimeout(() => {
    window.location.href = "index.html";
  }, 450);
}

// =============================================================================
// MENÚ DE 3 RAYAS (HAMBURGER DRAWER) - PANELES ADMIN Y TRABAJADOR
// =============================================================================

function initNavDrawer() {
  // Asegurar backdrop oscuro
  if (!document.querySelector("#appNavDrawerBackdrop")) {
    const backdrop = document.createElement("div");
    backdrop.id = "appNavDrawerBackdrop";
    backdrop.className = "nav-drawer-backdrop";
    backdrop.onclick = closeNavDrawer;
    document.body.appendChild(backdrop);
  }

  // Asegurar panel lateral
  if (!document.querySelector("#appNavDrawerPanel")) {
    const panel = document.createElement("aside");
    panel.id = "appNavDrawerPanel";
    panel.className = "nav-drawer-panel";
    panel.setAttribute("aria-label", "Menú de Navegación y Acciones");
    document.body.appendChild(panel);
  }

  // Escuchar tecla Escape
  document.removeEventListener("keydown", handleNavDrawerKeyDown);
  document.addEventListener("keydown", handleNavDrawerKeyDown);
}

function handleNavDrawerKeyDown(e) {
  if (e.key === "Escape" && document.body.classList.contains("drawer-open")) {
    closeNavDrawer();
  }
}

function toggleNavDrawer() {
  if (document.body.classList.contains("drawer-open")) {
    closeNavDrawer();
  } else {
    openNavDrawer();
  }
}

function openNavDrawer() {
  initNavDrawer();
  renderNavDrawerContent();
  document.body.classList.add("drawer-open");
  const burgerBtn = document.querySelector("#menuBurgerBtn");
  if (burgerBtn) burgerBtn.classList.add("open");
}

function closeNavDrawer() {
  document.body.classList.remove("drawer-open");
  const burgerBtn = document.querySelector("#menuBurgerBtn");
  if (burgerBtn) burgerBtn.classList.remove("open");
}

function renderNavDrawerContent() {
  const panel = document.querySelector("#appNavDrawerPanel");
  if (!panel) return;

  const authUser = Storage.getAuthUser();
  const currentPath = window.location.pathname;
  const isAdminPage = currentPath.endsWith("admin.html");
  const isWorkerPage = currentPath.endsWith("trabajador.html");
  const currentRole = (authUser && authUser.rol) ? authUser.rol : Storage.ROLES.CLIENTE;
  const isAdmin = currentRole === "ADMIN" || currentRole === "GERENTE";
  const isStaff = ["TRABAJADOR", "TAQUILLERO", "CONFITERIA", "GERENTE", "ADMIN"].includes(currentRole);

  const userName = authUser ? authUser.nombre : "Invitado";
  const userRoleText = isAdmin ? "Administrador Supremo" : (isStaff ? (authUser.rol === "CONFITERIA" ? "Operador de Dulcería" : (authUser.rol === "TAQUILLERO" ? "Operador de Taquilla" : "Personal de Operaciones")) : "Cliente");
  const userIcon = isAdmin ? "👑" : (isStaff ? "👔" : "👤");

  // Identificar pestaña activa actual
  let activeTab = "";
  if (isAdminPage) {
    const activeBtn = document.querySelector(".admin-tab-btn.active");
    if (activeBtn) activeTab = activeBtn.getAttribute("data-tab") || "";
  } else if (isWorkerPage) {
    const activeBtn = document.querySelector(".worker-tab-btn.active");
    if (activeBtn) activeTab = activeBtn.getAttribute("data-tab") || "";
  }

  // 1. Acciones Rápidas (Nuevos) para Admin
  let quickActionsHtml = "";
  if (isAdminPage || isAdmin) {
    quickActionsHtml = `
      <div>
        <div class="drawer-section-title">⚡ Acciones Rápidas (+ Nuevos)</div>
        <div class="drawer-actions-grid">
          <button class="drawer-action-btn primary" onclick="handleDrawerAction('movie')">
            ➕ Película
          </button>
          <button class="drawer-action-btn" onclick="handleDrawerAction('snack')">
            🍿 Snack
          </button>
          <button class="drawer-action-btn" onclick="handleDrawerAction('supplier')">
            🚚 Proveedor
          </button>
          <button class="drawer-action-btn" onclick="handleDrawerAction('worker')">
            👔 + Trabajador
          </button>
        </div>
      </div>
    `;
  }

  // 2. Módulos Específicos
  let modulesHtml = "";
  if (isAdminPage || isAdmin) {
    modulesHtml = `
      <div>
        <div class="drawer-section-title">👑 Secciones de Administración</div>
        <nav class="drawer-menu-list">
          <button class="drawer-menu-item ${activeTab === 'movies' ? 'active' : ''}" onclick="navigateAdminSection('movies')">
            <span>🎬 Cartelera y Películas</span>
            <span style="font-size: 0.75rem; opacity: 0.7;">›</span>
          </button>
          <button class="drawer-menu-item ${activeTab === 'seats-manager' ? 'active' : ''}" onclick="navigateAdminSection('seats-manager')">
            <span>💺 Salas y Esquemas de Asientos</span>
            <span style="font-size: 0.75rem; opacity: 0.7;">›</span>
          </button>
          <button class="drawer-menu-item ${activeTab === 'candybar' ? 'active' : ''}" onclick="navigateAdminSection('candybar')">
            <span>🍿 Dulcería & Confitería</span>
            <span style="font-size: 0.75rem; opacity: 0.7;">›</span>
          </button>
          <button class="drawer-menu-item ${activeTab === 'suppliers' ? 'active' : ''}" onclick="navigateAdminSection('suppliers')">
            <span>🚚 Proveedores</span>
            <span style="font-size: 0.75rem; opacity: 0.7;">›</span>
          </button>
          <button class="drawer-menu-item ${activeTab === 'financials' ? 'active' : ''}" onclick="navigateAdminSection('financials')">
            <span>💰 Finanzas & Rentabilidad</span>
            <span style="font-size: 0.75rem; opacity: 0.7;">›</span>
          </button>
          <button class="drawer-menu-item ${activeTab === 'roles-users' ? 'active' : ''}" onclick="navigateAdminSection('roles-users')">
            <span>👔 Personal y Trabajadores</span>
            <span style="font-size: 0.75rem; opacity: 0.7;">›</span>
          </button>
          <button class="drawer-menu-item ${activeTab === 'bookings' ? 'active' : ''}" onclick="navigateAdminSection('bookings')">
            <span>🎟️ Historial de Ventas</span>
            <span style="font-size: 0.75rem; opacity: 0.7;">›</span>
          </button>
          <button class="drawer-menu-item ${activeTab === 'analytics' ? 'active' : ''}" onclick="navigateAdminSection('analytics')">
            <span>📊 Analíticas & Gráficos</span>
            <span style="font-size: 0.75rem; opacity: 0.7;">›</span>
          </button>
          <button class="drawer-menu-item ${activeTab === 'settings' ? 'active' : ''}" onclick="navigateAdminSection('settings')">
            <span>⚙️ Configuración del Cine</span>
            <span style="font-size: 0.75rem; opacity: 0.7;">›</span>
          </button>
        </nav>
      </div>
    `;
  } else if (isWorkerPage || isStaff) {
    modulesHtml = `
      <div>
        <div class="drawer-section-title">👔 Módulos Operativos del Trabajador</div>
        <nav class="drawer-menu-list">
          <button class="drawer-menu-item ${activeTab === 'print' ? 'active' : ''}" onclick="navigateWorkerSection('print')">
            <span>🎟️ 1. Taquilla & Impresión de Boletos</span>
            <span style="font-size: 0.75rem; opacity: 0.7;">›</span>
          </button>
          <button class="drawer-menu-item ${activeTab === 'food' ? 'active' : ''}" onclick="navigateWorkerSection('food')">
            <span>🍿 2. Atender Comidas & Dulcería (POS)</span>
            <span style="font-size: 0.75rem; opacity: 0.7;">›</span>
          </button>
          <button class="drawer-menu-item ${activeTab === 'showtimes' ? 'active' : ''}" onclick="navigateWorkerSection('showtimes')">
            <span>📅 3. Programación de Funciones</span>
            <span style="font-size: 0.75rem; opacity: 0.7;">›</span>
          </button>
        </nav>
      </div>
    `;
  }

  // 3. Navegación General
  const externalNavHtml = `
    <div>
      <div class="drawer-section-title">🌐 Navegación General</div>
      <nav class="drawer-menu-list">
        <a href="index.html" class="drawer-menu-item ${currentPath.endsWith('index.html') || currentPath.endsWith('/') ? 'active' : ''}" onclick="closeNavDrawer()">
          <span>🎬 Cartelera de Películas</span>
          <span>↗</span>
        </a>
        <a href="candybar.html" class="drawer-menu-item ${currentPath.endsWith('candybar.html') ? 'active' : ''}" onclick="closeNavDrawer()">
          <span>🍿 Dulcería & Confitería</span>
          <span>↗</span>
        </a>
        ${(isAdmin || isStaff) ? `
          <a href="trabajador.html" class="drawer-menu-item ${isWorkerPage ? 'active' : ''}" onclick="closeNavDrawer()">
            <span>👔 Portal del Trabajador</span>
            <span>↗</span>
          </a>
        ` : ''}
        ${isAdmin ? `
          <a href="admin.html" class="drawer-menu-item ${isAdminPage ? 'active' : ''}" onclick="closeNavDrawer()">
            <span>👑 Panel Administrativo</span>
            <span>↗</span>
          </a>
        ` : ''}
      </nav>
    </div>
  `;

  panel.innerHTML = `
    <div class="drawer-header">
      <div class="drawer-header-title">
        <span style="color: var(--gold);">👑</span>
        <span>Cine Majestad</span>
      </div>
      <button class="drawer-close-btn" onclick="closeNavDrawer()" title="Cerrar Menú (Esc)">✕</button>
    </div>

    <div class="drawer-body">
      <!-- Tarjeta de Usuario -->
      <div class="drawer-user-card">
        <div class="drawer-user-avatar">${userIcon}</div>
        <div class="drawer-user-info" style="flex: 1;">
          <h4>${userName}</h4>
          <p>${userRoleText}</p>
          <span style="font-size: 0.7rem; color: #00e676; font-weight: 700; display: inline-flex; align-items: center; gap: 0.25rem; margin-top: 0.2rem;">
            ● En Turno / Sesión Activa
          </span>
        </div>
      </div>

      <!-- Acciones Rápidas -->
      ${quickActionsHtml}

      <!-- Módulos de Administración / Trabajador -->
      ${modulesHtml}

      <!-- Navegación General -->
      ${externalNavHtml}
    </div>

    <div class="drawer-footer">
      <button class="btn btn-secondary btn-sm" onclick="openUserProfileModal(); closeNavDrawer();" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.4rem;">
        👤 Mi Perfil y Cuenta
      </button>
      <button class="btn btn-secondary btn-sm" onclick="logoutUser(); closeNavDrawer();" style="width: 100%; color: #ff5252; border-color: rgba(255, 82, 82, 0.4); display: flex; align-items: center; justify-content: center; gap: 0.4rem;">
        🚪 Cerrar Sesión (Volver a Cartelera)
      </button>
    </div>
  `;
}

function handleDrawerAction(type) {
  closeNavDrawer();
  if (type === "movie") {
    if (typeof openMovieModal === "function") {
      openMovieModal(false);
    } else {
      window.location.href = "admin.html#new-movie";
    }
  } else if (type === "snack") {
    if (typeof openSnackModal === "function") {
      openSnackModal(false);
    } else {
      window.location.href = "admin.html#new-snack";
    }
  } else if (type === "supplier") {
    if (typeof openSupplierModal === "function") {
      openSupplierModal(false);
    } else {
      window.location.href = "admin.html#new-supplier";
    }
  } else if (type === "worker") {
    if (typeof openUserModal === "function") {
      openUserModal();
    } else {
      window.location.href = "admin.html#new-worker";
    }
  }
}

function navigateAdminSection(tabName) {
  closeNavDrawer();
  if (window.location.pathname.endsWith("admin.html")) {
    if (typeof switchAdminTab === "function") {
      switchAdminTab(tabName);
    }
  } else {
    window.location.href = `admin.html?tab=${tabName}`;
  }
}

function navigateWorkerSection(tabName) {
  closeNavDrawer();
  if (window.location.pathname.endsWith("trabajador.html")) {
    if (typeof switchWorkerTab === "function") {
      switchWorkerTab(tabName);
    }
  } else {
    window.location.href = `trabajador.html?tab=${tabName}`;
  }
}

