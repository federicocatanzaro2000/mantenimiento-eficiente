import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logo from "@/assets/logo-incalfood.png";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase auto-processes the recovery token from the URL hash and fires a PASSWORD_RECOVERY event.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // If user lands here already authenticated from the recovery link
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error("No se pudo cambiar: " + error.message);
    } else {
      toast.success("Contraseña actualizada");
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-md shadow-sm">
        <div className="bg-[hsl(var(--header-bg))] text-[hsl(var(--header-fg))] rounded-t-md p-4 flex items-center gap-3">
          <img src={logo} alt="INCALFOOD" className="h-12 w-auto bg-white rounded p-1" />
          <div>
            <h1 className="text-lg font-semibold">Nueva contraseña</h1>
            <p className="text-xs opacity-80">Ingresá tu nueva contraseña</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">Nueva contraseña</Label>
            <Input id="password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirmar contraseña</Label>
            <Input id="confirm" type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={busy || !ready}>
            {busy ? "Guardando..." : ready ? "Guardar nueva contraseña" : "Validando enlace..."}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Mínimo 8 caracteres. Evitá contraseñas comunes o filtradas.
          </p>
        </form>
      </div>
    </div>
  );
}
