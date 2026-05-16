# Sistema de usuarios, roles y auditoría

## Objetivo
Agregar login obligatorio, roles con permisos por inciso del formulario, ABM de usuarios y registro de auditoría básica (quién creó/modificó cada orden y cuándo).

## Decisión clave: las órdenes pasan a la base de datos
Hoy las órdenes viven en `localStorage` (zustand+persist). Eso impide compartir datos entre usuarios y hacer auditoría real. Las vamos a migrar a Lovable Cloud (tabla `ordenes` + tabla `materiales`). Los filtros, listado, resultados y dashboard van a leer desde la base.

## Roles
Enum `app_role` con 5 valores:
- `supervisor` — ve todo, edita todo, crea/elimina todo.
- `calidad` — ve todo, solo edita inciso 6.
- `operario` — ve todo, solo edita incisos 3 y 4.
- `panol` — ve todo, solo edita inciso 5.
- `admin_usuarios` — ABM de usuarios y asignación de roles. Sin permisos operativos salvo que tenga además otro rol.

Un usuario puede tener múltiples roles (tabla `user_roles` con `(user_id, role)` único).

## Base de datos (migración)

Tablas nuevas:
- `profiles` — `user_id` (FK a auth.users), `nombre`, `activo`.
- `user_roles` — `user_id`, `role` (enum). Sin RLS recursiva.
- `ordenes` — todos los campos del modelo actual + `created_by`, `updated_by`, `created_at`, `updated_at`.
- `materiales` — `orden_id` FK, `cantidad`, `descripcion`, `codigo`.

Función security-definer:
- `has_role(_user_id, _role)` — para usar en políticas sin recursión.

RLS:
- `profiles`: cualquier autenticado puede leer; solo `admin_usuarios` puede insertar/actualizar; el propio usuario puede leer su perfil.
- `user_roles`: cualquier autenticado puede leer (para la app saber su rol); solo `admin_usuarios` inserta/borra.
- `ordenes`:
  - SELECT: cualquier autenticado.
  - INSERT/DELETE: solo `supervisor`.
  - UPDATE: solo `supervisor` (la app limita visualmente por inciso para `calidad`, `operario`, `panol`, pero en la base esos roles también pueden hacer UPDATE — la columna-por-columna se hace con un trigger que valida qué campos cambiaron según el rol).
- `materiales`:
  - SELECT: cualquier autenticado.
  - INSERT/UPDATE/DELETE: `supervisor` o `panol` (inciso 5).

Trigger `ordenes_audit_bizrule`:
- En UPDATE compara `OLD` vs `NEW` y, según el rol del editor, rechaza el cambio si tocó campos fuera de su inciso.
- En cualquier INSERT/UPDATE setea `updated_by = auth.uid()`, `updated_at = now()`.

Trigger `handle_new_user` (auth):
- Al registrarse, crea fila en `profiles`. No asigna roles automáticamente (lo hace el admin).

Auto-confirm de email: **activado** (es app interna de planta, no hay servidor de mail).

## Primer usuario
Creamos por migración el usuario `fcatanzaro@incalfer.com` con contraseña `Clave:incalfer2026` y le asignamos los roles `supervisor` + `admin_usuarios`.

## Frontend

### Nuevas piezas
- `src/integrations/supabase/client.ts` (auto-generado, no se toca).
- `src/hooks/useAuth.tsx` — provider con `session`, `user`, `roles`, `signIn`, `signOut`. Usa `onAuthStateChange` + `getSession`.
- `src/hooks/usePermissions.ts` — helpers `canEditSection(n)`, `isSupervisor`, `isAdminUsuarios`.
- `src/pages/Login.tsx` — pantalla de login (email + contraseña, en español).
- `src/pages/AdminUsuarios.tsx` — listado, crear, cambiar contraseña, asignar/quitar roles, activar/desactivar. Visible solo si `admin_usuarios`.
- `src/components/ProtectedRoute.tsx` — envuelve rutas privadas; redirige a `/login` si no hay sesión.
- `src/store/ordenesRemote.ts` — reemplaza el store local: funciones `listOrdenes`, `getOrden`, `createOrden`, `updateOrden`, `deleteOrden` contra Supabase. Mantiene la misma forma de `Orden` que ya usa el form.

### Edge function
- `crear-usuario` — invocada desde Admin de Usuarios. Usa service role para `auth.admin.createUser`, inserta perfil y roles. Verifica que el caller tenga rol `admin_usuarios`.
- `cambiar-password-usuario` — idem, `auth.admin.updateUserById`.
- `desactivar-usuario` — marca `profiles.activo = false` y (opcional) bloquea acceso vía RLS (`profiles.activo = true` requerido en políticas).

### Cambios en pantallas existentes
- `AppLayout` — muestra usuario logueado, botón salir, pestaña "Usuarios" solo si `admin_usuarios`.
- `OrdenForm` — cada `<Section>` recibe `seccionNro`; los campos quedan `disabled` si el rol no puede editar ese inciso. Botones Guardar/Eliminar ocultos si el rol no tiene ningún permiso de edición. Muestra "Creado por X — Modificado por Y (fecha)" arriba.
- `Listado`, `FiltrosPage`, `ResultadosPage`, `DashboardPage` — pasan a leer de la base con React Query. Botones "Nueva orden" / "Eliminar" solo si `supervisor`.

## Auditoría
Cada orden muestra:
- Creado por: `<nombre del perfil>` — `<fecha y hora>`
- Última modificación: `<nombre>` — `<fecha y hora>`

Se imprime en el PDF.

## Detalles técnicos
- Usamos `@tanstack/react-query` (ya instalado) para cache + invalidación al guardar.
- El trigger de validación por inciso usa `TG_OP = 'UPDATE'` y compara columnas específicas agrupadas por inciso:
  - Inciso 1: nro_orden, fecha_creacion, solicitante, tecnico_responsable, sector, tipo_orden, estado, prioridad, aprobado.
  - Inciso 2: fechas, horas, descripcion_problema, trabajo_solicitado.
  - Inciso 3: codigo_documento, codigo_equipo, nombre_equipo.
  - Inciso 4: estado_recepcion_equipo, sector_limpio_ordenado, herramientas_limpias_ordenadas, observaciones.
  - Inciso 5: materiales (tabla aparte, se controla por RLS de `materiales`).
  - Inciso 6: control_liberacion_calidad, responsable_control_calidad, elaboro, reviso, aprobo.

## Qué NO se hace en esta entrega
- Historial campo-por-campo (rechazado por el usuario, eligió auditoría básica).
- Recuperación de contraseña por email (no hay dominio de mail configurado; el admin la cambia desde la pantalla de usuarios).
- Login con Google.

## Pasos de ejecución
1. Migración SQL (tablas, enum, RLS, triggers, función `has_role`, usuario inicial con roles).
2. Edge functions (`crear-usuario`, `cambiar-password-usuario`, `desactivar-usuario`).
3. `useAuth`, `ProtectedRoute`, `Login`.
4. Migrar store de órdenes a remoto + adaptar `Listado`, `FiltrosPage`, `ResultadosPage`, `DashboardPage`, `OrdenForm`.
5. Aplicar gating por rol en `OrdenForm` y en `AppLayout`.
6. Pantalla `AdminUsuarios`.
7. Mostrar info de auditoría en form y PDF.
