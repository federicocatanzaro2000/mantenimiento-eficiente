# Módulo "Preventivos" desde cero

Reemplazo completo del módulo anterior. Tabla nueva, página nueva, sin dependencias de lo viejo.

## 1. Base de datos (migración)

Nueva tabla `public.preventive_manual_items` (independiente de las tablas `preventivos_*` viejas, que quedan intactas por ahora):

Campos clave:
- `id uuid pk`
- `scheduled_date date NOT NULL`, `scheduled_year int`, `scheduled_month int`, `scheduled_day int` (calculados por trigger desde `scheduled_date`)
- `equipment_id uuid` → FK opcional a `equipment(id)`
- `equipment_code_snapshot text NOT NULL`, `equipment_name_snapshot text NOT NULL`
- `task_name text NOT NULL`
- `preventive_type text NOT NULL` (Mecánico, Eléctrico, Refrigeración, Lubricación, Limpieza, Otro)
- `frequency_label text` (ej. "6000 hs", "6 meses", "-")
- `status text NOT NULL DEFAULT 'Programado'` (Programado | Vencido | Con OIT | Realizado | Cancelado)
- `responsible_id uuid` (FK a people, opcional)
- `estimated_hours numeric`
- `notes text`
- `work_order_id uuid` (FK a `ordenes(id)`)
- `source text` (`manual` | `excel_import` | `duplicated_year`)
- `active boolean default true`
- `created_by`, `updated_by`, `created_at`, `updated_at`

Reglas:
- Trigger `BEFORE INSERT/UPDATE` que recalcula año/mes/día desde `scheduled_date`.
- Trigger `touch_updated_at`.
- Índice único parcial: `(equipment_code_snapshot, task_name, scheduled_date) WHERE active` → idempotencia de import.
- Índices: `scheduled_date`, `scheduled_year`, `equipment_id`, `status`, `work_order_id`.
- RLS + GRANT (`authenticated` RW, `service_role` ALL). Política: cualquier autenticado lee; supervisores/admin escriben (siguiendo patrón existente con `has_role`).

No tocamos: `ordenes`, `equipment`, `people`, `sectors`, `user_roles`, ni los `preventivos_*` viejos.

## 2. API frontend

Nuevo `src/lib/preventiveManual/api.ts`:
- `list({year?, month?, equipmentCode?, type?, status?, withOIT?, search?})`
- `create`, `update`, `softDelete`
- `markRealizado(id)`, `cancelar(id)`
- `duplicateYear({from, to, mode: 'fechas' | 'estructura' | 'solo_equipos'})`
- `createOITFromPreventivo(id)` → inserta en `ordenes` (nro_orden = max+1, tipo `Preventivo`, hereda equipo/tarea/fecha) y setea `work_order_id` + `status='Con OIT'`.

Tipos en `src/lib/preventiveManual/types.ts`.

## 3. Importador Excel

`src/lib/preventiveManual/excelImport.ts` usando `xlsx` (ya en deps si no, lo agrego):
- Para cada hoja, extraer año del nombre con regex `\d{4}`.
- Detectar fila de encabezado (la que contiene "Enero".."Diciembre"). Mapear columnas de meses → rango de 5 columnas (semanas) por mes.
- Recorrer filas: si col A o B contiene `Equipo (CODIGO)`, abrir bloque equipo (parsea `nombre` y `codigo` con regex `(.+?)\s*\((.+?)\)`).
- Filas siguientes con texto en columna "tarea" (3ª/4ª) → tarea. Columna previa = `frequency_label`.
- Saltar filas "Horas de trabajo" y filas de números puros sin tarea.
- Para cada celda numérica 1–31 en columnas de mes → fecha `YYYY-MM-DD`. Validar día existe en el mes (sino marcar error).
- Validar equipo contra catálogo `equipment` (match por `codigo`). Si no existe → reportar como "equipo no encontrado", omitir.
- Tipo se infiere del nombre de tarea ("mecanico"→Mecánico, "electrico"→Eléctrico, "refrigeracion"→Refrigeración, "lubricacion"→Lubricación, "limpieza"→Limpieza, sino Otro).
- Previsualización con conteos antes de insertar. Insert en bulk con `upsert` sobre el índice único → idempotente.

## 4. Exportador Excel

`exportYear(year)`: arma planilla con columnas fijas (Código, Nombre, Frecuencia, Tarea, Tipo) + 12 columnas de meses con días separados por coma. Descarga `INCALFOOD Preventivos {year}.xlsx`.

## 5. UI

Ruta `/preventivos` con `<ProtectedRoute>`. Página `src/pages/PreventivosPage.tsx`.

Header:
- Título "Preventivos" + subtítulo.
- Botones: Nuevo, Importar Excel, Exportar Excel, Duplicar año, Refrescar.

Filtros (sticky): Año (select editable + años con datos + año actual), Mes, SearchSelect Código equipo (catálogo `equipment`), SearchSelect Nombre equipo, Tipo, Estado, Con/Sin OIT, búsqueda de tarea.

Tarjetas indicadoras: Total, Vencidos, Próx 7d, Próx 30d, Con OIT, Sin OIT, Realizados.

Tabs `Excel | Calendario | Listado`:

A. **Vista Excel** `PreventivosGridView.tsx`: tabla agrupada por equipo. Columnas fijas (sticky-left) + 12 columnas de meses. Celda muestra días separados por coma. Click en día → modal editar. Click en celda vacía → modal nuevo prellenado con equipo/mes.

B. **Vista Calendario** `PreventivosCalendarView.tsx`: grid mes con chips por evento (color por estado). Navegación mes/año. Click día vacío → nuevo. Click chip → detalle con acciones.

C. **Vista Listado** `PreventivosListView.tsx`: tabla con paginación, ordenada por fecha asc, acciones por fila.

Modales reutilizables:
- `PreventivoFormDialog` (nuevo/editar) con SearchSelect equipo (auto-completa nombre), Datepicker, selects.
  Botones: Guardar / Guardar y cargar otro (mantiene equipo+tipo+frecuencia+año, limpia fecha+tarea+observaciones) / Cancelar.
- `ImportExcelDialog`: input archivo → previsualización (planes detectados, equipos no encontrados, duplicados) → confirmar.
- `DuplicarAnioDialog`: año origen + año destino + modo + previsualización.
- `PreventivoDetailDialog`: detalle con acciones (Editar, Crear/Ver OIT, Marcar realizado, Cancelar, Desactivar).

## 6. Navegación

Agregar tab "Preventivos" en `src/components/AppLayout.tsx` y ruta en `src/App.tsx`.

## 7. Estados

Estado visual calculado: si `status` ∈ {Programado} y `scheduled_date < hoy` y sin OIT → mostrar "Vencido" (calculado en cliente, no se persiste salvo acción manual). Los estados explícitos (Con OIT, Realizado, Cancelado) ganan.

## 8. Permisos

- Supervisor/Admin: todo.
- Operario/Calidad/Pañol: ver + crear OIT (si tiene permiso de crear OIT en sistema actual).
- Botones se ocultan según rol (helpers existentes en `src/lib/permissions.ts`).

## 9. Limpieza opcional

No se elimina nada de `preventivos_*` viejas para no romper datos históricos; quedan ortogonales. Si después confirmás, las eliminamos en un segundo paso.

## Detalles técnicos

- Dep nueva: `xlsx` (si no está). Verifico antes.
- Tipos generados de Supabase se regeneran tras la migración.
- Archivos nuevos: migración SQL, `lib/preventiveManual/{types,api,excelImport,excelExport}.ts`, `pages/PreventivosPage.tsx`, `components/preventivos/{FormDialog,ImportDialog,DuplicarAnioDialog,DetailDialog,GridView,CalendarView,ListView,IndicatorsBar,FiltersBar}.tsx`.
- Archivos editados: `src/App.tsx`, `src/components/AppLayout.tsx`.

## Riesgos / dudas

1. El Excel tiene celdas combinadas y filas auxiliares ("Horas de trabajo", filas de ceros). El parser las salta heurísticamente; si algún equipo del Excel no está en el catálogo `equipment` actual, esos preventivos NO se importan y aparecen en el reporte. ¿Querés que en ese caso te ofrezca **crear el equipo automáticamente** durante la importación, o estricto (omitir y reportar)?
2. La hoja 2024 tiene 429 columnas (estructura por semanas), mientras 2025/2026 tienen ~67. El parser detectará columnas de mes por el encabezado, así que funcionará en ambos formatos.
3. ¿OK con que las tablas viejas `preventivos_planes/schedule/imports/alertas` queden sin uso pero sin borrar?
