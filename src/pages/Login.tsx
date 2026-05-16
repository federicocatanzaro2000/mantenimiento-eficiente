import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logo from "@/assets/logo-incalfood.png";

export default function Login() {
  const { signIn, session } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) navigate("/", { replace: true });
  }, [session, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) toast.error("No se pudo ingresar: " + error);
    else {
      toast.success("Sesión iniciada");
      navigate("/", { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-md shadow-sm">
        <div className="bg-[hsl(var(--header-bg))] text-[hsl(var(--header-fg))] rounded-t-md p-4 flex items-center gap-3">
          <img src={logo} alt="INCALFOOD" className="h-12 w-auto bg-white rounded p-1" />
          <div>
            <h1 className="text-lg font-semibold">Órdenes de Mantenimiento</h1>
            <p className="text-xs opacity-80">Iniciar sesión</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Ingresando..." : "Ingresar"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Si no tenés usuario, contactá al Administrador.
          </p>
        </form>
      </div>
    </div>
  );
}
