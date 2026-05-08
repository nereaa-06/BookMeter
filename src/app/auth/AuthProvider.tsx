import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";

type AuthContextValue = {
  usuario: User | null;
  cargando: boolean;
  configurado: boolean;
  iniciarSesion: (email: string, password: string) => Promise<{ error: string | null }>;
  registrarUsuario: (
    name: string,
    email: string,
    password: string
  ) => Promise<{ error: string | null; necesitaConfirmarEmail: boolean }>;
  actualizarCorreo: (email: string) => Promise<{ error: string | null }>;
  actualizarContrasena: (password: string) => Promise<{ error: string | null }>;
  cerrarSesion: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [cargando, setCargando] = useState(true);

  const adoptarDatosLegacy = async () => {
    if (!supabase) {
      return;
    }

    await supabase.rpc("adoptar_datos_legacy_usuario_actual");
  };

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setCargando(false);
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout>;

    // Si tarda demasiado en devolver sesion, dejamos de esperar.
    timeoutId = setTimeout(() => {
      console.warn("Tiempo de espera agotado al pedir la sesión de Supabase");
      setCargando(false);
    }, 5000);

    supabase.auth.getSession()
      .then(({ data }) => {
        clearTimeout(timeoutId);
        setUsuario(data.session?.user ?? null);
        setCargando(false);

        if (data.session?.user) {
          void adoptarDatosLegacy();
        }
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        console.error("Error obteniendo sesión:", error);
        setCargando(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      clearTimeout(timeoutId);
      setUsuario(session?.user ?? null);
      setCargando(false);

      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user) {
        void adoptarDatosLegacy();
      }
    });

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      usuario,
      cargando,
      configurado: isSupabaseConfigured,
      iniciarSesion: async (email, password) => {
        if (!supabase) {
          return { error: "Configura Supabase en .env para usar autenticacion." };
        }

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },
      registrarUsuario: async (name, email, password) => {
        if (!supabase) {
          return {
            error: "Configura Supabase en .env para usar autenticacion.",
            necesitaConfirmarEmail: false,
          };
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
          },
        });

        const necesitaConfirmarEmail = !data.session;
        return { error: error?.message ?? null, necesitaConfirmarEmail };
      },
      actualizarCorreo: async (email) => {
        if (!supabase) {
          return { error: "Configura Supabase en .env para usar autenticacion." };
        }

        const { error } = await supabase.auth.updateUser({ email });
        return { error: error?.message ?? null };
      },
      actualizarContrasena: async (password) => {
        if (!supabase) {
          return { error: "Configura Supabase en .env para usar autenticacion." };
        }

        const { error } = await supabase.auth.updateUser({ password });
        return { error: error?.message ?? null };
      },
      cerrarSesion: async () => {
        if (!supabase) {
          setUsuario(null);
          return;
        }

        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error) {
          throw new Error(error.message);
        }

        setUsuario(null);
      },
    }),
    [usuario, cargando]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth solo se puede usar dentro de AuthProvider");
  }

  return context;
}
