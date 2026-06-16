import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { AppRole, useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/lib/permissions";
import { Trash2, KeyRound, UserPlus, Shield } from "lucide-react";

type Profile = { user_id: string; nombre: string; email: string | null; activo: boolean };

const ALL_ROLES: AppRole[] = ["supervisor", "calidad", "operario", "panol", "admin_usuarios"];

export default function AdminUsuarios() {
  const { user, refreshRoles } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [rolesByUser, setRolesByUser] = useState<Record<string, AppRole[]>>({});
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newNombre, setNewNombre] = useState("");
  const [newRoles, setNewRoles] = useState<AppRole[]>([]);
  const [pwdUserId, setPwdUserId] = useState<string | null>(null);
  const [pwdValue, setPwdValue] = useState("");

  const load = async () => {
    setLoading(true);
    const [listRes, { data: roles }] = await Promise.all([
      supabase.functions.invoke("admin-usuarios", { body: { action: "list" } }),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    const users = ((listRes.data as any)?.users ?? []) as Profile[];
    setProfiles(users);
    const map: Record<string, AppRole[]> = {};
    (roles ?? []).forEach((r: any) => {
      (map[r.user_id] ||= []).push(r.role as AppRole);
    });
    setRolesByUser(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const call = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("admin-usuarios", { body });
    if (error) { toast.error(error.message); return null; }
    if ((data as any)?.error) { toast.error((data as any).error); return null; }
    return data;
  };

  const onCreate = async () => {
    if (!newEmail || !newPassword) { toast.error("Email y contraseña obligatorios"); return; }
    const r = await call({ action: "create", email: newEmail.trim(), password: newPassword, nombre: newNombre.trim(), roles: newRoles });
    if (r) {
      toast.success("Usuario creado");
      setOpenNew(false); setNewEmail(""); setNewPassword(""); setNewNombre(""); setNewRoles([]);
      load();
    }
  };

  const onChangePassword = async () => {
    if (!pwdUserId || pwdValue.length < 6) { toast.error("Mínimo 6 caracteres"); return; }
    const r = await call({ action: "update_password", user_id: pwdUserId, password: pwdValue });
    if (r) { toast.success("Contraseña actualizada"); setPwdUserId(null); setPwdValue(""); }
  };

  const toggleActivo = async (p: Profile) => {
    const r = await call({ action: "set_active", user_id: p.user_id, activo: !p.activo });
    if (r) { toast.success(p.activo ? "Usuario desactivado" : "Usuario activado"); load(); }
  };

  const toggleRole = async (uid: string, role: AppRole, has: boolean) => {
    const current = rolesByUser[uid] ?? [];
    const next = has ? current.filter((r) => r !== role) : [...current, role];
    const r = await call({ action: "set_roles", user_id: uid, roles: next });
    if (r) {
      toast.success("Roles actualizados");
      if (uid === user?.id) await refreshRoles();
      load();
    }
  };

  const onDelete = async (uid: string) => {
    const r = await call({ action: "delete", user_id: uid });
    if (r) { toast.success("Usuario eliminado"); load(); }
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2"><Shield className="h-5 w-5" /> Administración de Usuarios</h2>
          <p className="text-sm text-muted-foreground">Crear usuarios, asignar roles, cambiar contraseñas y activar/desactivar.</p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button className="gap-2"><UserPlus className="h-4 w-4" /> Nuevo usuario</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear nuevo usuario</DialogTitle>
              <DialogDescription>El usuario podrá iniciar sesión con email y contraseña.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Nombre</Label><Input value={newNombre} onChange={(e) => setNewNombre(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Contraseña inicial</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label>Roles</Label>
                <div className="grid grid-cols-1 gap-1.5">
                  {ALL_ROLES.map((r) => (
                    <label key={r} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={newRoles.includes(r)} onCheckedChange={(v) => setNewRoles((cur) => v ? [...cur, r] : cur.filter((x) => x !== r))} />
                      {ROLE_LABELS[r]}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
              <Button onClick={onCreate}>Crear</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border border-border rounded-md shadow-sm overflow-x-auto">
        <table className="erp-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Roles</th>
              <th>Activo</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Cargando...</td></tr>}
            {!loading && profiles.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Sin usuarios</td></tr>}
            {profiles.map((p) => {
              const roles = rolesByUser[p.user_id] ?? [];
              return (
                <tr key={p.user_id}>
                  <td className="font-medium">{p.nombre}</td>
                  <td>{p.email}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {ALL_ROLES.map((r) => {
                        const has = roles.includes(r);
                        return (
                          <button
                            key={r}
                            onClick={() => toggleRole(p.user_id, r, has)}
                            className={`text-xs px-2 py-0.5 rounded border transition-colors ${has ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-secondary"}`}
                            title={has ? `Quitar ${ROLE_LABELS[r]}` : `Asignar ${ROLE_LABELS[r]}`}
                          >
                            {ROLE_LABELS[r]}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Switch checked={p.activo} onCheckedChange={() => toggleActivo(p)} />
                      <span className="text-xs text-muted-foreground">{p.activo ? "Activo" : "Inactivo"}</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" title="Cambiar contraseña" onClick={() => { setPwdUserId(p.user_id); setPwdValue(""); }}>
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" title="Eliminar" disabled={p.user_id === user?.id}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Eliminar usuario</AlertDialogTitle>
                            <AlertDialogDescription>Esta acción no se puede deshacer. El usuario perderá acceso al sistema.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(p.user_id)}>Eliminar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!pwdUserId} onOpenChange={(v) => { if (!v) setPwdUserId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
            <DialogDescription>Asignar una nueva contraseña al usuario.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Nueva contraseña</Label>
            <Input type="password" value={pwdValue} onChange={(e) => setPwdValue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdUserId(null)}>Cancelar</Button>
            <Button onClick={onChangePassword}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
