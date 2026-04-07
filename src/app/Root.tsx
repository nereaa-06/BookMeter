import { Navigate, Outlet } from "react-router";
import Navigation from "./components/Navigation";
import { useAuth } from "./auth/AuthProvider";

export default function Root() {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return (
      <div className="min-h-dvh w-full flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-dvh w-full flex flex-col bg-background">
      <div className="flex-1 flex flex-col min-h-0 page-enter">
        <Outlet />
      </div>
      <Navigation />
    </div>
  );
}
