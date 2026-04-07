import { FormEvent, useEffect, useState } from "react";
import { Navigate } from "react-router";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";

export default function AuthPage() {
  const { usuario, cargando, iniciarSesion, registrarUsuario, configurado } = useAuth();
  const [modo, setModo] = useState<"login" | "register">("login");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [confirmarContrasena, setConfirmarContrasena] = useState("");
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [mostrarConfirmarContrasena, setMostrarConfirmarContrasena] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    setMessage("");
  }, [modo]);

  if (cargando) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (usuario) {
    return <Navigate to="/" replace />;
  }

  const enviarFormulario = async (event: FormEvent) => {
    event.preventDefault();
    setEnviando(true);
    setError("");
    setMessage("");

    if (!configurado) {
      setError("Falta configurar Supabase en el archivo .env");
      setEnviando(false);
      return;
    }

    if (modo === "register") {
      if (contrasena !== confirmarContrasena) {
        setError("Las contrasenas no coinciden.");
        setEnviando(false);
        return;
      }

      const result = await registrarUsuario(nombre.trim(), email.trim(), contrasena);
      if (result.error) {
        setError(result.error);
      } else if (result.necesitaConfirmarEmail) {
        setMessage("Cuenta creada. Revisa tu correo para confirmar el registro.");
      } else {
        setMessage("Cuenta creada correctamente. Ya puedes usar BookMeter.");
      }

      setEnviando(false);
      return;
    }

    const result = await iniciarSesion(email.trim(), contrasena);
    if (result.error) {
      setError(result.error);
    }

    setEnviando(false);
  };

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center px-4 py-8 page-enter">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-lg p-6 soft-pop">
        <h1 className="text-secondary text-center mb-1">BookMeter</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          {modo === "login" ? "Inicia sesion" : "Crea tu cuenta"}
        </p>

        <form onSubmit={enviarFormulario} className="space-y-4">
          {modo === "register" && (
            <input
              type="text"
              placeholder="Nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20"
            required
          />

          <div className="relative">
            <input
              type={mostrarContrasena ? "text" : "password"}
              placeholder="Contrasena"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              className="w-full px-4 pr-11 py-3 bg-white border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setMostrarContrasena((valorActual) => !valorActual)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={mostrarContrasena ? "Ocultar contrasena" : "Mostrar contrasena"}
            >
              {mostrarContrasena ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {modo === "register" && (
            <div className="relative">
              <input
                type={mostrarConfirmarContrasena ? "text" : "password"}
                placeholder="Confirmar contrasena"
                value={confirmarContrasena}
                onChange={(e) => setConfirmarContrasena(e.target.value)}
                className="w-full px-4 pr-11 py-3 bg-white border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setMostrarConfirmarContrasena((valorActual) => !valorActual)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={mostrarConfirmarContrasena ? "Ocultar confirmacion" : "Mostrar confirmacion"}
              >
                {mostrarConfirmarContrasena ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              {error}
            </p>
          )}

          {message && (
            <p className="text-sm text-secondary bg-secondary/10 border border-secondary/20 rounded-lg p-3">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {enviando
              ? "Procesando..."
              : modo === "login"
                ? "Entrar"
                : "Crear cuenta"}
          </button>
        </form>

        <button
          onClick={() => setModo(modo === "login" ? "register" : "login")}
          className="w-full mt-4 text-sm text-muted-foreground hover:text-secondary transition-colors"
          type="button"
        >
          {modo === "login"
            ? "No tienes cuenta? Registrate"
            : "Ya tienes cuenta? Inicia sesion"}
        </button>
      </div>
    </div>
  );
}
