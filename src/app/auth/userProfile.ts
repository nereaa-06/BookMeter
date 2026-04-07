import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { User as BookMeterUser } from "../data/mockData";

const DEFAULT_AVATAR_BASE = "https://api.dicebear.com/9.x/thumbs/svg?seed=";

export function obtenerUsuarioDeSesion(
  usuarioSesion: SupabaseUser,
  ubicacion: { lat: number; lng: number }
): BookMeterUser {
  const nombreDelPerfil =
    typeof usuarioSesion.user_metadata?.full_name === "string"
      ? usuarioSesion.user_metadata.full_name.trim()
      : "";

  const avatarDelPerfil =
    typeof usuarioSesion.user_metadata?.avatar_url === "string"
      ? usuarioSesion.user_metadata.avatar_url.trim()
      : "";

  const nombrePorEmail = usuarioSesion.email ? usuarioSesion.email.split("@")[0] : "Usuario";

  return {
    id: usuarioSesion.id,
    name: nombreDelPerfil || nombrePorEmail,
    avatar: avatarDelPerfil || `${DEFAULT_AVATAR_BASE}${encodeURIComponent(usuarioSesion.id)}`,
    rating: 0,
    totalRatings: 0,
    location: ubicacion,
  };
}

