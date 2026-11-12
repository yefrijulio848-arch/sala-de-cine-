# 🚀 Guía Oficial de Despliegue - Cine Majestad Multiplex

Esta guía te explica paso a paso cómo desplegar la plataforma **Cine Majestad** en internet (Render, Railway o VPS) con base de datos MySQL en producción.

---

## ⚡ Resumen de Arquitectura de Despliegue

| Componente | Tecnología | Configuración en Producción |
| :--- | :--- | :--- |
| **Backend & Web Server** | Node.js + Express | `server.js` (Sirve la API REST y el frontend estático) |
| **Tiempo Real** | Socket.io | Conexión WebSocket / Polling en mismo origen |
| **Base de Datos** | MySQL 8.x / MariaDB | Auto-inicialización con `database/cine_majestad_db.sql` |
| **Modo Resiliente** | Híbrido | Si MySQL no está disponible, el sistema conmuta a almacenamiento en memoria |

---

## 🟢 Opción 1: Despliegue en Render (Recomendado y Gratuito)

[Render](https://render.com) permite desplegar tanto la aplicación Node.js como la base de datos MySQL de forma muy sencilla.

### Paso 1: Subir tu código a GitHub
1. Abre tu terminal en la carpeta del proyecto.
2. Inicializa git y sube el proyecto a un repositorio privado o público:
   ```bash
   git init
   git add .
   git commit -m "Cine Majestad v2.0 - Listo para despliegue"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/cine-majestad.git
   git push -u origin main
   ```

### Paso 2: Crear el Web Service en Render
1. Inicia sesión en [render.com](https://render.com).
2. Haz clic en **New +** > **Web Service**.
3. Conecta tu repositorio de GitHub.
4. Completa la configuración:
   - **Name:** `cine-majestad`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start` (o `node server.js`)
   - **Plan:** Free
5. En la sección **Environment Variables**, añade:
   - `NODE_ENV` = `production`
   - `PORT` = `3000` (Render asignará automáticamente el puerto público)
   - `JWT_SECRET` = `clave_secreta_super_segura_2026`
   - `SEAT_HOLD_DURATION_MINUTES` = `5`

### Paso 3: Conectar la Base de Datos MySQL
Puedes usar una base de datos MySQL gratuita de servicios como **Railway**, **Clever Cloud**, **Aiven** o **TiDB Cloud**:
1. En tu proveedor de base de datos, obtén la URL de conexión (ejemplo: `mysql://root:password@host:port/database`).
2. En las Variables de Entorno de Render, añade:
   - `MYSQL_URL` = `tu_url_de_conexion_mysql`
   *(El servidor de Cine Majestad detectará automáticamente la URL y creará las tablas y datos iniciales en el primer inicio).*

---

## 🟣 Opción 2: Despliegue en Railway (1 Clic)

[Railway](https://railway.app) es una de las plataformas más rápidas para desplegar Node.js + MySQL:

1. Inicia sesión en [railway.app](https://railway.app).
2. Haz clic en **New Project** > **Provision MySQL**.
3. Haz clic en **+ New** > **GitHub Repo** y selecciona tu repositorio.
4. En las variables del servicio web, añade:
   - `MYSQL_URL` = `${{MySQL.MYSQL_URL}}` (Railway lo autocompleta con una variable de referencia).
   - `JWT_SECRET` = `cinemajestad_super_secret_jwt_key_2026_royal`
   - `NODE_ENV` = `production`
5. En la pestaña **Settings** > **Networking**, haz clic en **Generate Domain**.
6. ¡Listo! Tu cine estará disponible en `https://tu-proyecto.up.railway.app`.

---

## 🐳 Opción 3: Despliegue con Docker

El proyecto incluye un `Dockerfile` optimizado:

```bash
# 1. Construir la imagen Docker
docker build -t cine-majestad:2.0 .

# 2. Ejecutar el contenedor
docker run -d -p 3000:3000 --name cine-majestad --env-file .env cine-majestad:2.0
```

---

## 🔑 Cuentas de Acceso Predeterminadas (Semilla)

| Rol | Correo Electrónico | Contraseña | Permisos y Alcance |
| :--- | :--- | :--- | :--- |
| **👑 Administrador** | `admin@cinemajestad.com` | `123456` | Control total, cartelera, salas, reportes y finanzas |
| **👔 Taquillero / Operador** | `taquilla@cinemajestad.com` | `123456` | Turno de taquilla, funciones, despacho de comidas e impresión |
| **👤 Cliente / Espectador** | `yeffry@cinemajestad.com` | `123456` | Reserva de butacas en tiempo real y emisión de boleto |
| **👤 Cliente Demo 2** | `carlos@cliente.com` | `123456` | Usuario de prueba para compras simultáneas |

---

## 🩺 Verificación de Salud del Servidor

Una vez desplegado tu servidor, puedes verificar el estado de la API visitando:
`https://tu-dominio.com/api/health`

Respuesta esperada:
```json
{
  "status": "online",
  "name": "Cine Majestad API",
  "version": "2.0.0",
  "environment": "production",
  "timestamp": "2026-11-11T..."
}
```

