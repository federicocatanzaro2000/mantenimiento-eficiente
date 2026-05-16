import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isAdminUsuarios } from "@/lib/permissions";

export function ProtectedRoute({ children, requireAdmin }: { children: JSX.Element; requireAdmin?: boolean }) {
  const { session, loading, roles } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Cargando...
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  if (requireAdmin && !isAdminUsuarios(roles)) return <Navigate to="/" replace />;
  return children;
}
