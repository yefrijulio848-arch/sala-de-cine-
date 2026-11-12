/* ==========================================================================
   Cine Majestad - Lógica Global, Navegación y Control de Roles
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  initNavbar();
  updateCartBadge();
  initRoleModal();
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
  const currentRole = Storage.getActiveRole();
  const currentPath = window.location.pathname;
  const authUser = Storage.getAuthUser();

  // 1. Inyectar o actualizar el botón de Rol y Usuario en la barra
  const navActions = document.querySelector(".nav-actions");
  if (navActions) {
    // Botón de Usuario / Login
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
      userBtn.innerHTML = `
        <button class="role-badge-btn" style="background: rgba(212, 175, 55, 0.15); border-color: rgba(212, 175, 55, 0.4); color: var(--gold);" onclick="openUserProfileModal()" title="Ver Mi Perfil e Historial de Boletos">
          👤 ${authUser.nombre} ▾
        </button>
      `;
    } else {
      userBtn.innerHTML = `
        <a href="login.html" class="btn btn-secondary btn-sm" style="font-size: 0.82rem; padding: 0.45rem 0.85rem;" title="Iniciar sesión o registrarse">
          🔑 Iniciar Sesión
        </a>
      `;
    }

    // Botón de Rol
    let roleBtn = document.querySelector("#roleBadgeBtn");
    if (!roleBtn) {
      roleBtn = document.createElement("button");
      roleBtn.id = "roleBadgeBtn";
      roleBtn.className = "role-badge-btn";
      roleBtn.onclick = openRoleModal;
      navActions.insertBefore(roleBtn, userBtn.nextSibling);
    }

    if (currentRole === Storage.ROLES.CLIENTE) {
      roleBtn.className = "role-badge-btn";
      roleBtn.innerHTML = `👤 Rol: Cliente ▾`;
      roleBtn.title = "Modo Usuario: Ver películas, horarios y asientos";
    } else if (currentRole === Storage.ROLES.TRABAJADOR) {
      roleBtn.className = "role-badge-btn role-trabajador";
      roleBtn.innerHTML = `👔 Rol: Trabajador ▾`;
      roleBtn.title = "Modo Trabajador: Ver funciones, atender comidas e imprimir";
    } else if (currentRole === Storage.ROLES.ADMIN) {
      roleBtn.className = "role-badge-btn role-admin";
      roleBtn.innerHTML = `👑 Rol: Admin ▾`;
      roleBtn.title = "Modo Administrador: Control total de la plataforma";
    }
  }

  // 2. Filtrar enlaces visibles de navegación según el rol
  const navLinksContainer = document.querySelector(".nav-links");
  if (!navLinksContainer) return;

  let linksHtml = "";

  if (currentRole === Storage.ROLES.CLIENTE) {
    linksHtml = `
      <li><a href="index.html" class="nav-link ${currentPath.endsWith('index.html') || currentPath.endsWith('/') ? 'active' : ''}">Cartelera</a></li>
      <li><a href="checkout.html" class="nav-link ${currentPath.endsWith('checkout.html') ? 'active' : ''}">Mi Entrada</a></li>
    `;
  } else if (currentRole === Storage.ROLES.TRABAJADOR) {
    linksHtml = `
      <li><a href="index.html" class="nav-link ${currentPath.endsWith('index.html') || currentPath.endsWith('/') ? 'active' : ''}">Cartelera Web</a></li>
      <li><a href="trabajador.html" class="nav-link ${currentPath.endsWith('trabajador.html') ? 'active' : ''}">Portal Trabajador (Funciones, Comidas & Impresión)</a></li>
    `;
  } else {
    linksHtml = `
      <li><a href="index.html" class="nav-link ${currentPath.endsWith('index.html') || currentPath.endsWith('/') ? 'active' : ''}">Cartelera</a></li>
      <li><a href="trabajador.html" class="nav-link ${currentPath.endsWith('trabajador.html') ? 'active' : ''}">Portal Trabajador</a></li>
      <li><a href="admin.html" class="nav-link ${currentPath.endsWith('admin.html') ? 'active' : ''}">Panel Admin</a></li>
    `;
  }

  navLinksContainer.innerHTML = linksHtml;
}

// Validación de Acceso por Página (Role Guard)
function checkPageAccess() {
  const authUser = Storage.getAuthUser();
  const currentRole = (authUser && authUser.rol) ? authUser.rol : Storage.getActiveRole();
  const currentPath = window.location.pathname;

  // Si está en admin.html y no es ADMIN ni GERENTE
  if (currentPath.endsWith("admin.html") && currentRole !== Storage.ROLES.ADMIN && currentRole !== "GERENTE") {
    renderAccessRestrictedScreen("admin");
  }

  // Si está en trabajador.html y es CLIENTE
  if (currentPath.endsWith("trabajador.html") && currentRole === Storage.ROLES.CLIENTE) {
    renderAccessRestrictedScreen("trabajador");
  }
}

// Pantalla de Acceso Restringido para roles no autorizados
function renderAccessRestrictedScreen(requiredRoleType) {
  const main = document.querySelector("main");
  if (!main) return;

  const roleName = requiredRoleType === "admin" ? "Administrador" : "Trabajador";

  main.innerHTML = `
    <div class="access-restricted-card">
      <div class="access-restricted-icon">🔒</div>
      <h2 style="font-size: 1.8rem; margin-bottom: 0.8rem; color: #fff;">Acceso Restringido</h2>
      <p style="color: var(--text-secondary); margin-bottom: 1.5rem; line-height: 1.5;">
        Esta sección está reservada exclusivamente para el rol de <strong>${roleName}</strong> de Cine Majestad.<br>
        Actualmente estás navegando con el rol de <strong>${Storage.getActiveRole()}</strong>.
      </p>
      <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
        <a href="login.html" class="btn btn-primary">🔐 Iniciar Sesión como ${roleName}</a>
        <button class="btn btn-secondary" onclick="openRoleModal()">Cambiar a Rol ${roleName}</button>
        <a href="index.html" class="btn btn-secondary">← Volver a la Cartelera</a>
      </div>
    </div>
  `;
}

// Modal Selector de Roles
function initRoleModal() {
  if (document.querySelector("#roleSwitchModal")) return;

  const modalHtml = `
    <div class="modal-backdrop" id="roleSwitchModal">
      <div class="modal-content" style="max-width: 580px;">
        <div class="modal-header">
          <h3 style="color: #fff;">Seleccionar Rol de Usuario</h3>
          <button class="modal-close" onclick="closeRoleModal()">✕</button>
        </div>

        <div style="padding: 1rem 1.5rem 0.5rem; color: var(--text-secondary); font-size: 0.88rem;">
          Elige con qué perfil deseas navegar y operar en la plataforma de Cine Majestad:
        </div>

        <div class="role-options-grid">
          <!-- Opción 1: Cliente -->
          <div class="role-option-card" id="roleCardCliente" onclick="selectRole('CLIENTE')">
            <div class="role-option-icon">👤</div>
            <div class="role-option-info">
              <h4>Cliente / Espectador</h4>
              <p>Solo puede ver películas en cartelera, elegir el horario disponible y reservar sus asientos.</p>
            </div>
          </div>

          <!-- Opción 2: Trabajador -->
          <div class="role-option-card" id="roleCardTrabajador" onclick="selectRole('TRABAJADOR')">
            <div class="role-option-icon" style="color: var(--accent-blue);">👔</div>
            <div class="role-option-info">
              <h4>Trabajador / Taquillero & Dulcería</h4>
              <p>Puede ver funciones de salas, atender y despachar pedidos de comida en mostrador, y dar la opción de imprimir boletos físicos.</p>
            </div>
          </div>

          <!-- Opción 3: Administrador -->
          <div class="role-option-card" id="roleCardAdmin" onclick="selectRole('ADMIN')">
            <div class="role-option-icon" style="color: var(--gold);">👑</div>
            <div class="role-option-info">
              <h4>Administrador Supremo</h4>
              <p>Control total: programar películas, configurar salas y butacas en vivo, administrar inventario de comidas y ajustes generales.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);
}

function openRoleModal() {
  const modal = document.querySelector("#roleSwitchModal");
  if (!modal) return;

  const currentRole = Storage.getActiveRole();
  document.querySelectorAll(".role-option-card").forEach(c => c.classList.remove("active"));

  if (currentRole === Storage.ROLES.CLIENTE) {
    document.querySelector("#roleCardCliente")?.classList.add("active");
  } else if (currentRole === Storage.ROLES.TRABAJADOR) {
    document.querySelector("#roleCardTrabajador")?.classList.add("active");
  } else if (currentRole === Storage.ROLES.ADMIN) {
    document.querySelector("#roleCardAdmin")?.classList.add("active");
  }

  modal.classList.add("open");
}

function closeRoleModal() {
  const modal = document.querySelector("#roleSwitchModal");
  if (modal) modal.classList.remove("open");
}

function selectRole(newRole) {
  Storage.setActiveRole(newRole);
  closeRoleModal();
  updateNavbarForRole();
  showToast(`Rol cambiado exitosamente a: ${newRole}`, "success");

  // Redirigir inteligentemente según el rol elegido
  const currentPath = window.location.pathname;

  if (newRole === Storage.ROLES.TRABAJADOR && !currentPath.endsWith("trabajador.html")) {
    window.location.href = "trabajador.html";
  } else if (newRole === Storage.ROLES.ADMIN && !currentPath.endsWith("admin.html")) {
    window.location.href = "admin.html";
  } else if (newRole === Storage.ROLES.CLIENTE && (currentPath.endsWith("admin.html") || currentPath.endsWith("trabajador.html"))) {
    window.location.href = "index.html";
  } else {
    window.location.reload();
  }
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
  Storage.logout();
  API.setToken(null);
  closeUserProfileModal();
  updateNavbarForRole();
  showToast("Sesión cerrada correctamente.", "info");
  setTimeout(() => {
    window.location.reload();
  }, 600);
}

