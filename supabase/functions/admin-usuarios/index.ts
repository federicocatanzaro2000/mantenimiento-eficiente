import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Action =
  | { action: "create"; email: string; password: string; nombre: string; roles: string[] }
  | { action: "update_password"; user_id: string; password: string }
  | { action: "set_active"; user_id: string; activo: boolean }
  | { action: "set_roles"; user_id: string; roles: string[] }
  | { action: "delete"; user_id: string };

const VALID_ROLES = ["supervisor", "calidad", "operario", "panol", "admin_usuarios"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "No autenticado" }, 401);
    }
    const token = authHeader.slice(7);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verificar caller
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "Sesión inválida" }, 401);

    const callerId = userData.user.id;

    // Verificar rol admin_usuarios
    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: rolesRow } = await admin
      .from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin_usuarios").maybeSingle();
    if (!rolesRow) return json({ error: "Requiere rol Administrador de Usuarios" }, 403);

    const body = (await req.json()) as Action;

    switch (body.action) {
      case "create": {
        if (!body.email || !body.password) return json({ error: "Email y contraseña requeridos" }, 400);
        if (body.password.length < 6) return json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400);
        const { data: created, error } = await admin.auth.admin.createUser({
          email: body.email,
          password: body.password,
          email_confirm: true,
          user_metadata: { nombre: body.nombre || body.email.split("@")[0] },
        });
        if (error) return json({ error: error.message }, 400);
        const uid = created.user!.id;
        // El trigger handle_new_user crea profile. Actualizo nombre si vino.
        await admin.from("profiles").update({ nombre: body.nombre || body.email.split("@")[0] }).eq("user_id", uid);
        // Roles
        const rs = (body.roles ?? []).filter((r) => VALID_ROLES.includes(r));
        if (rs.length) {
          await admin.from("user_roles").insert(rs.map((role) => ({ user_id: uid, role })));
        }
        return json({ ok: true, user_id: uid });
      }
      case "update_password": {
        if (!body.password || body.password.length < 6) return json({ error: "Contraseña inválida (mín 6)" }, 400);
        const { error } = await admin.auth.admin.updateUserById(body.user_id, { password: body.password });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
      case "set_active": {
        await admin.from("profiles").update({ activo: body.activo }).eq("user_id", body.user_id);
        // Si se desactiva, también lo bloqueamos en auth (ban)
        if (!body.activo) {
          await admin.auth.admin.updateUserById(body.user_id, { ban_duration: "100y" });
        } else {
          await admin.auth.admin.updateUserById(body.user_id, { ban_duration: "none" });
        }
        return json({ ok: true });
      }
      case "set_roles": {
        const rs = (body.roles ?? []).filter((r) => VALID_ROLES.includes(r));
        await admin.from("user_roles").delete().eq("user_id", body.user_id);
        if (rs.length) {
          await admin.from("user_roles").insert(rs.map((role) => ({ user_id: body.user_id, role })));
        }
        return json({ ok: true });
      }
      case "delete": {
        const { error } = await admin.auth.admin.deleteUser(body.user_id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
      default:
        return json({ error: "Acción desconocida" }, 400);
    }
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}
