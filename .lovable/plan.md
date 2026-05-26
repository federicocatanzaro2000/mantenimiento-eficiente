# Módulo de Mantenimiento Preventivo

Integra un módulo completo de preventivos al sistema actual de órdenes de mantenimiento, sin tocar la lógica existente. Reutiliza autenticación, roles, `profiles`, `user_roles`, `ordenes`, el `AppLayout`, design tokens y la navegación actual.

## Análisis del Excel adjunto

Hojas: `2024`, `2025`, `2026,`. Estructura matriz:

- **Fila 1**: contiene el año y los nombres de mes (Enero, Febrero, …). Cada mes ocupa 5 columnas (semanas). En 2024 los meses arrancan en col 4; en 2025 en col 5. Detección dinámica.
- **Equipos**: columna izquierda con nombre y código entre paréntesis (`Extrusora (EX1)`, `MEZCLADORA   (M1)`, `EXTRUSORA (EXMN 1)`).
- **Tareas**: filas inferiores con frecuencia (`6000 hs`, `6meses`, `8 meses`, `1 MES`, `-`) + descripción.
- **Celdas mes**: número 1–31 = día programado para ese mes y año de la hoja.
- Equipo se hereda hacia abajo hasta el siguiente bloque.

## Cambios mínimos al sistema actual

**No se toca**: `ordenes`, `profiles`, `user_roles`, login, RLS existente, navegación, layout.

**Sí se agrega**:

1. Tablas nuevas (todas con RLS):
   - `preventivos_planes` — definiciones (equipo, código, tarea, tipo, frecuencia + texto original, hoja/fila origen)
   - `preventivos_schedule` — ocurrencias agendadas (plan_id, fecha, año/mes/día, estado, orden_id, celda origen, notas)
   - `preventivos_imports` — historial de importaciones (archivo, hash, usuario, contadores, errores JSON)
   - `preventivos_alertas` — alertas generadas por schedule (offset en días, estado, fecha envío)
   - Clave única `(plan_id, scheduled_date, source_cell)` para idempotencia
2. Extensión mínima a `ordenes`: columna `preventivo_schedule_id uuid` (nullable) para vincular. Trigger: cuando `ordenes.estado` pasa a `Completado/Finalizada`, el schedule vinculado pasa a `Completado` con `fecha_real`.
3. RLS:
   - SELECT: cualquier autenticado
   - INSERT/UPDATE/DELETE planes y schedule: supervisor
   - Importar Excel: supervisor (validado en frontend + RLS)
   - Marcar completado / reprogramar: supervisor; operario puede marcar “En proceso”

## Frontend

Nuevas rutas dentro de `AppLayout` (mismo header, mismos tokens):

- `/preventivos` — Tabla operativa (fecha, días restantes, equipo, tarea, estado, OT, acciones)
- `/preventivos/cronograma` — Grilla anual estilo Excel (filas equipo+tarea, columnas mes, días dentro)
- `/preventivos/calendario` — Calendario mensual con react-day-picker (ya instalado)
- `/preventivos/importar` — Upload .xlsx, preview, confirmar
- `/preventivos/:id` — Detalle, reprogramar, completar, crear OT, vincular OT existente
- Dashboard actual: tarjetas adicionales (próx 7d, próx 30d, vencidos, completados mes, sin OT, por tipo, cumplimiento %)

Estados con colores semánticos: Programado, Próximo, OT creada, En proceso, Completado, Vencido, Reprogramado, Cancelado, Requiere revisión.

Menú "Preventivos" agregado a `AppLayout` tabs como dropdown (Tabla / Cronograma / Calendario / Importar).

## Parser de Excel

Librería: `xlsx` (SheetJS) en el frontend (sin necesidad de edge function para parsear; solo INSERT vía Supabase con RLS).

Robustez:
- Detecta meses por nombre normalizado (sin acentos, lowercase) en cualquier fila de las primeras 5
- Cada mes mapea a su rango de columnas hasta el siguiente mes
- Año desde el nombre de la hoja (regex `\d{4}`) o desde celdas A1/B1
- Hereda equipo desde columna izquierda no vacía hacia abajo
- Normaliza frecuencia: `6meses`/`6 MESES`/`8meses` → `{value:6, unit:'meses', raw:'...'}`; `120 hs` → `{value:120, unit:'horas'}`; `-` → null
- Normaliza tipo de tarea por keywords (mecánico, eléctrico, refrigeración, lubricación, limpieza, aceite→lubricación, rodamiento/correa→mecánico)
- Celda numérica 1–31 → crea schedule con fecha `YYYY-MM-DD` en zona America/Argentina/Buenos_Aires
- Celda no numérica con contenido → schedule con estado `Requiere revisión`
- Idempotencia: upsert por hash `sha256(plan_key + scheduled_date + source_cell)`

Pantalla importar:
1. Drop/upload .xlsx
2. Parser corre en navegador → muestra preview: equipos detectados, tareas, schedules, errores
3. "Confirmar" → batch insert (chunks de 500). Registra en `preventivos_imports`.

## Alertas

Función SQL `preventivos_calcular_alertas()` genera alertas en `preventivos_alertas` para offsets [15, 7, 3, 1, 0] y `vencido`.
Cron diario (`pg_cron`) recalcula estado de cada schedule (Próximo / Vencido) y crea alertas internas. Visible en:
- Badge en header del módulo
- Dashboard (panel "Próximos preventivos")
- Indicador en calendario (color por proximidad)

Infraestructura email queda preparada (columna `sent_at`, `alert_type`) pero sin SMTP por ahora.

## Integración con órdenes

Botón "Crear OT" en schedule:
- Crea fila en `ordenes` con: equipo, tarea, tipo_orden='Preventivo', fecha_limite=scheduled_date, observaciones, `preventivo_schedule_id`=id
- Schedule pasa a `OT creada`
- Vincular existente: combobox de órdenes abiertas
- Al completar la orden (trigger DB), schedule → `Completado` con `fecha_real`

## Criterios cubiertos

Todos los 14 criterios de aceptación. Sin romper rutas, RLS, ni tipos existentes.

## Plan técnico resumido (orden de ejecución)

```text
1. Migración SQL: 4 tablas nuevas + columna en ordenes + triggers + RLS
2. Tipos + helpers: src/lib/preventivos/{parser.ts, normalize.ts, api.ts, types.ts}
3. Páginas: PreventivosTabla, PreventivosCronograma, PreventivosCalendario,
   PreventivosImportar, PreventivosDetalle
4. Rutas en App.tsx + menú en AppLayout
5. Dashboard: tarjetas preventivos
6. Cron de alertas + función SQL
7. Smoke test importando el Excel adjunto
```

¿Apruebo y procedo, o querés ajustar algo (por ejemplo: dejar fuera el cron de alertas, o usar edge function para parsear en backend en vez de frontend)?
