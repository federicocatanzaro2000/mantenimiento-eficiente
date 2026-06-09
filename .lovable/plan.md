# Mejora del módulo Preventivos — Generador anual real

## Diagnóstico de la causa raíz

El sistema **no está hardcodeado a 2025**:
- El calendario inicializa con la fecha actual (`todayBA()`), no con 2025.
- El filtro de año se construye dinámicamente desde los datos.
- La importación de Excel respeta el año detectado en cada hoja.

El bloqueo real es que **no existe un generador anual basado en plantillas**:
- Los únicos atajos para crear preventivos 2026 son 4 botones dentro del diálogo "Nuevo preventivo" hardcodeados a `2026-01-15` y aplicados a **un solo plan a la vez**.
- No hay forma de decir "tomá todos los planes activos y armá el cronograma del año X" en una sola acción.
- Cada plan tiene su frecuencia (`frecuencia_valor` + `frecuencia_unidad`) pero esa info no se usa para autogenerar instancias.

## Cambios

### 1. Base de datos (migración)
Agregar a `preventivos_planes` dos columnas opcionales:
- `dia_preferido int` (1–31, default 15) — día del mes al que se programan las instancias.
- `mes_inicio int` (1–12, default 1) — primer mes del año en el que arranca la cadencia.

No se borran datos. Los planes existentes quedan con valores por defecto.

### 2. Nueva API `generarAnio(year, opts)` en `src/lib/preventivos/api.ts`
- Carga todos los `preventivos_planes` con `activo = true` y `frecuencia_unidad = 'meses'`.
- Para cada plan calcula los meses objetivo según `frecuencia_valor`:
  - mensual (1) → 12 instancias, bimestral (2) → 6, trimestral (3) → 4, cuatrimestral (4) → 3, semestral (6) → 2, anual (12) → 1.
- Para cada mes resuelve la fecha con `dia_preferido` ajustando al último día válido (ej.: 31 en febrero → 28/29).
- Inserta en `preventivos_schedule` con `source_cell = "auto-{year}"` y `onConflict: "plan_id,anio,mes,source_cell"` → **idempotente**. Re-ejecutar el mismo año no duplica.
- Devuelve `{ creados, omitidos, planesSinFrecuencia, errores }`.
- Modo `dryRun: true` cuenta sin insertar (para la vista previa del modal).

### 3. UI: botón y modal "Generar año"
En `src/pages/Preventivos.tsx`, junto a "Nuevo preventivo" e "Importar Excel":
- Nuevo botón **"Generar año"** (solo para `canManagePreventivos`).
- Modal con:
  - Select de año (rango: año actual − 1 … año actual + 5, editable libremente).
  - Vista previa en vivo (dryRun): "X plantillas activas · Y instancias a crear · Z ya existen".
  - Botones Cancelar / Generar.
- Toast con resumen final.

### 4. Estado vacío en la vista Tabla
Si el filtro Año tiene un año seleccionado y la lista filtrada está vacía:
- Mensaje "No hay preventivos generados para {año}".
- Botón inline "Generar preventivos {año}" que abre el modal con ese año preseleccionado.

### 5. Limpieza de hardcodes
- Eliminar los 4 atajos "Generar 2026 / bimestral / trimestral / semestral" del diálogo "Nuevo preventivo" (quedan reemplazados por el generador anual real).

## Lo que NO se toca
- Estructura de tabs (Tabla / Cronograma / Calendario / Importar).
- Calendario, Cronograma, filtros existentes, contadores superiores, importador Excel, creación de OIT desde preventivo, permisos, dashboard, OITs.
- Tipos `EstadoPreventivo`, `ESTADO_COLOR`, ni las funciones `computeStatusBy` / `deriveEstado`.
- Tabla `ordenes` ni el trigger que sincroniza `preventivos_schedule.estado` cuando se crea una OIT.

## Criterios de aceptación cubiertos
- Generación de 2026, 2027 o cualquier año futuro desde un único botón.
- Idempotente: re-ejecutar no duplica.
- Respeta frecuencia de cada plan y el día preferido (ajustando meses cortos).
- Filtro de año sigue siendo data-driven (al generar 2027 aparece 2027 al refrescar).
- Calendario y Cronograma ya funcionan con cualquier año (no requieren cambio).
- No se borran preventivos existentes.
