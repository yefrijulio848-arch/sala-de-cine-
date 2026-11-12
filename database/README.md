# 🗄️ Cine Majestad Multiplex - Arquitectura de Base de Datos

Base de datos relacional profesional (en Tercera Forma Normal - 3FN) diseñada a la medida para la plataforma web de cine **Cine Majestad Multiplex**, incorporando concurrencia de butacas en tiempo real y panel administrativo integral.

---

## 📐 Diagrama Entidad-Relación (ERD)

```text
[usuarios] (1) ───────────< (0..N) [reservas] (1) ──────────< (1..N) [reserva_asientos] >─────────── (1) [asientos] (N) >─── (1) [salas]
                                       │                                                                                           ▲
                                       │                                                                                           │
                                       ├──────────< (0..N) [reserva_snacks] >── (1) [productos_snack] >── (1) [categorias_snack]  │
                                       │                                                                                           │
                                       ├──────────> (1) [funciones] ───────────────────────────────────────────────────────────────┤
                                       │                      │                                                                    │
                                       │                      ▼                                                                    │
                                       │               [bloqueos_temporales_asientos] ─────────────────────────────────────────────┘
                                       │                      │ (Reserva en curso con expiración)
                                       ▼ (N..1)
                                 [peliculas] 
                                  ├──< (N..M) >── [generos]
                                  └──< (N..M) >── [formatos]
```

---

## 🚀 Cómo importar la Base de Datos

### Opción 1: Con MySQL / MariaDB (Consola o Terminal)
```bash
mysql -u root -p < database/cine_majestad_db.sql
```

### Opción 2: Con phpMyAdmin o XAMPP
1. Abre **phpMyAdmin** en tu navegador (`http://localhost/phpmyadmin`).
2. Ve a la pestaña **Importar**.
3. Selecciona el archivo `database/cine_majestad_db.sql` (o `cinenova_db.sql`).
4. Haz clic en **Importar**. La base de datos `cine_majestad_db` se creará con todas sus tablas, vistas y datos iniciales.

---

## 🛡️ Aspectos Clave de Negocio y Concurrencia Implementados

1. **Bloqueo Concurrente Temporal de Butacas (`bloqueos_temporales_asientos`)**:
   - Resuelve el requisito fundamental: si un usuario está seleccionando una silla, nadie más puede tomarla.
   - Si la compra no se confirma dentro del tiempo límite (`expira_en`), el asiento se libera automáticamente a estado `DISPONIBLE`.

2. **Prevención de Overbooking Definitivo (`reserva_asientos`)**:
   - Llave única compuesta:
     ```sql
     UNIQUE KEY uq_funcion_asiento (funcion_id, asiento_id)
     ```
   - Impide a nivel de motor de base de datos que dos clientes compren la misma butaca en la misma función.

3. **Vistas Optimizadas en Tiempo Real**:
   - `v_cartelera_web`: Cartelera completa con géneros y formatos agregados.
   - `v_disponibilidad_asientos`: Cruza la matriz arquitectónica con bloqueos temporales activos y reservas confirmadas, clasificando cada asiento como `DISPONIBLE`, `EN_SELECCION_TEMPORAL`, `OCUPADO` o `MANTENIMIENTO`.
   - `v_dashboard_metricas`: Métricas globales para el panel de administración.
