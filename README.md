# 👑 Cine Majestad Multiplex - Plataforma Web y Sistema de Gestión Cinematográfica

Una plataforma web cinematográfica de vanguardia para la cadena de salas de cine **Cine Majestad**, con separación estricta de roles, cartelera interactiva, selección de butacas con **concurrencia y bloqueo temporal en tiempo real** (prevención de reservas simultáneas y liberación automática por expiración de tiempo), portal operativo del trabajador para comidas e impresión, y un **Panel Administrativo Supremo** con control total sobre el sistema.

---

## 👥 Sistema de Roles y Permisos

El sistema cuenta con un selector de perfil/rol activo en la barra superior de todas las páginas:

1. **👤 Rol Usuario / Cliente**:
   - Diseñado estrictamente para el espectador:
     - **Ver películas en cartelera**: Sinopsis, tráilers oficiales, calificación, formatos y duración.
     - **Elegir el horario disponible**: Funciones programadas del día.
     - **Elegir los asientos disponibles**: Mapa interactivo con bloqueo concurrente en tiempo real.
     - Confirmación directa de compra y emisión de boleto digital.
   - *Nota:* El cliente no tiene acceso a funciones internas de empleados ni al panel de administración.

2. **👔 Rol Trabajador / Taquilla & Dulcería (`trabajador.html`)**:
   - Diseñado para el personal operativo de sala, taquilla y confitería:
     - **📅 Ver Funciones**: Monitor de programación del día con porcentaje de ocupación de sala y visor de asientos en vivo.
     - **🍿 Atender sobre las comidas**:
       - Bandeja de despacho para entregar pedidos de dulcería comprados por la web (`Pendiente` / `Entregado`).
       - Punto de venta rápido en mostrador para ventas directas en barra de snacks.
     - **🖨️ Dar la opción de imprimir**:
       - Búsqueda de cualquier boleto por código (`CMG-XXXXXX`) o cliente.
       - Impresión de boletos térmicos de cine oficiales para acceso a sala.
       - Impresión de tickets de entrega de confitería/comidas.

3. **👑 Rol Administrador (`admin.html`)**:
   - Control total sobre todo el negocio:
     - CRUD completo de películas, sinopsis, tráilers, salas, horarios y precios (Estándar y VIP).
     - Configuración arquitectónica de salas (filas, columnas, VIP) e inspector de butacas en vivo con opción de mantenimiento y desbloqueo forzado.
     - CRUD de productos de dulcería, inventario y stock.
     - Historial de ventas con opción de cancelación y liberación de butacas.
     - Parámetros del sistema: tiempo límite de bloqueo temporal (minutos), límite de boletos, nombre del cine y respaldos JSON.

---

## 💺 Esquemas de Asientos y Concurrencia en Tiempo Real (`seats.html`)

- **Bloqueo Concurrente Real**: Cuando un cliente selecciona una butaca, ésta queda bloqueada con candado (`🔒`) en tiempo real para todos los demás clientes (entre pestañas, ventanas y dispositivos mediante `BroadcastChannel` y sincronización reactiva). Nadie más puede tomar esa butaca mientras esté en proceso de selección.
- **Temporizador de Reserva con Liberación Automática**: Un contador regresivo configurable (por defecto 5:00 minutos) protege la selección del cliente. Si no confirma su compra antes de agotarse el tiempo, las butacas se **liberan automáticamente** y vuelven al estado `DISPONIBLE` para que otros usuarios puedan adquirirlas.
- **Botón Demostrativo de Concurrencia**: Permite simular a un segundo comprador en tiempo real para observar cómo se bloquean y liberan las butacas en pantalla.

---

## 📂 Estructura del Proyecto

```text
sala-de-cine/
│
├── index.html              # Portada y Cartelera interactiva de Cine Majestad (Cliente)
├── seats.html              # Selector de asientos con bloqueo concurrente en tiempo real
├── candybar.html           # Dulcería y combos imperiales
├── checkout.html           # Boleto digital confirmado con código CMG
├── trabajador.html         # Portal del Trabajador: Funciones, Comidas & Impresión
├── admin.html              # Panel Administrativo con control total
│
├── css/
│   ├── main.css            # Design System, variables de color y fuentes
│   ├── navbar-footer.css   # Barra de navegación flotante, selector de rol y pie de página
│   ├── billboard.css       # Tarjetas de cartelera y modal de tráiler
│   ├── seats.css           # Sala 3D, butacas bloqueadas en vivo y temporizador
│   ├── candybar.css        # Cards de combos y selector de cantidades
│   ├── trabajador.css      # Funciones, despacho de comidas y tickets térmicos imprimibles
│   ├── admin.css           # Pestañas del admin, tablas e inspector de sala en vivo
│   └── checkout.css        # Boleto con perforaciones y código QR
│
├── js/
│   ├── app.js              # Lógica global, control de roles y buscador
│   ├── movies.js           # Cartelera, filtrado por género y modales
│   ├── seats.js            # Motor de concurrencia, bloqueo y expiración de butacas
│   ├── candybar.js         # Lógica de confitería y temporizador sincronizado
│   ├── trabajador.js       # Operaciones del trabajador: funciones, despacho e impresión
│   ├── admin.js            # CRUD completo, inspector de salas y configuración
│   ├── checkout.js         # Emisión de tickets digitales CMG y confirmación
│   └── data/
│       └── mockData.js     # Motor de almacenamiento, roles, BroadcastChannel y modelos
│
├── database/
│   ├── cine_majestad_db.sql # Base de datos SQL completa con bloqueos temporales
│   └── README.md           # Documentación relacional y modelo ERD
│
└── README.md               # Documentación general del proyecto
```

---

## 💻 Cómo Ejecutar y Probar el Sistema

1. **Abrir en el Navegador**:
   - Abre `index.html` en cualquier navegador web moderno (o mediante el servidor local activo en `http://localhost:8080/index.html`).
2. **Probar los Roles de Usuario**:
   - En la parte superior derecha de la barra de navegación verás el botón de rol: **`[ 👤 Rol: Cliente ▾ ]`**.
   - Haz clic para alternar entre:
     - **👤 Cliente:** Navega por la cartelera, elige horario y butacas disponibles.
     - **👔 Trabajador:** Accede al portal de funciones, despacho de comidas y módulo de impresión de boletos térmicos.
     - **👑 Administrador:** Accede al panel administrativo con control total sobre películas, salas, precios y dulcería.
3. **Probar la Atención de Comidas e Impresión (Trabajador)**:
   - Cambia al rol **Trabajador** o entra a `trabajador.html`.
   - En la pestaña **🍿 2. Atender Comidas**: puedes marcar pedidos web como entregados o registrar ventas directas de mostrador.
   - En la pestaña **🖨️ 3. Impresión de Boletos**: busca cualquier código (ej. `CMG-748921`) y haz clic en **"🖨️ Imprimir Boleto"** para abrir el ticket térmico listo para mandar a la impresora con `window.print()`.
