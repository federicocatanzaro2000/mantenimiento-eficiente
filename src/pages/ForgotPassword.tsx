import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logo from "@/assets/logo-incalfood.png";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error("No se pudo enviar: " + error.message);
    } else {
      setSent(true);
      toast.success("Si el email existe, te enviamos instrucciones.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-md shadow-sm">
        <div className="bg-[hsl(var(--header-bg))] text-[hsl(var(--header-fg))] rounded-t-md p-4 flex items-center gap-3">
          <img src={logo} alt="INCALFOOD" className="h-12 w-auto bg-white rounded p-1" />
          <div>
            <h1 className="text-lg font-semibold">Recuperar contraseña</h1>
            <p className="text-xs opacity-80">Te enviaremos un email con instrucciones</p>
          </div>
        </div>
        {sent ? (
          <div className="p-6 space-y-4 text-sm">
            <p>Si el email <strong>{email}</strong> está registrado, recibirás un enlace para restablecer tu contraseña.</p>
            <p className="text-muted-foreground">Revisá tu casilla y la carpeta de spam.</p>
            <Link to="/login" className="text-primary underline text-sm">Volver al login</Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Enviando..." : "Enviar instrucciones"}
            </Button>
            <div className="text-center">
              <Link to="/login" className="text-primary underline text-sm">Volver al login</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
