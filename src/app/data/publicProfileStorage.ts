import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { currentUser, type User } from "./mockData";

type PerfilPublicoRow = {
  usuario_id: string;
  nombre: string;
  avatar_url: string | null;
  ciudad: string | null;
  sobre_usuario: string | null;
  busca_libros: string | null;
  ubicacion_lat: number | null;
  ubicacion_lng: number | null;
};

export type PerfilPublico = {
  usuario: User;
  ciudad: string | null;
  sobreUsuario: string | null;
  buscaLibros: string | null;
};

function filaAPerfil(fila: PerfilPublicoRow): PerfilPublico {
  return {
    usuario: {
    id: fila.usuario_id,
    name: fila.nombre,
    avatar: fila.avatar_url || currentUser.avatar,
    rating: 0,
    totalRatings: 0,
    about: fila.sobre_usuario ?? undefined,
    location: {
      lat: typeof fila.ubicacion_lat === "number" ? fila.ubicacion_lat : currentUser.location.lat,
      lng: typeof fila.ubicacion_lng === "number" ? fila.ubicacion_lng : currentUser.location.lng,
    },
    },
    ciudad: fila.ciudad,
    sobreUsuario: fila.sobre_usuario,
    buscaLibros: fila.busca_libros,
  };
}

export async function obtenerPerfilPublico(usuarioId: string): Promise<PerfilPublico | null> {
  if (!usuarioId || !isSupabaseConfigured || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("perfiles_publicos")
    .select("usuario_id,nombre,avatar_url,ciudad,sobre_usuario,busca_libros,ubicacion_lat,ubicacion_lng")
    .eq("usuario_id", usuarioId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return filaAPerfil(data as PerfilPublicoRow);
}

export async function guardarPerfilPublico(params: {
  usuarioId: string;
  nombre: string;
  avatarUrl?: string | null;
  ciudad?: string | null;
  sobreUsuario?: string | null;
  buscaLibros?: string | null;
  ubicacion?: { lat: number; lng: number } | null;
}): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || !params.usuarioId) {
    return false;
  }

  const { error } = await supabase
    .from("perfiles_publicos")
    .upsert(
      {
        usuario_id: params.usuarioId,
        nombre: params.nombre,
        avatar_url: params.avatarUrl ?? null,
        ciudad: params.ciudad ?? null,
        sobre_usuario: params.sobreUsuario ?? null,
        busca_libros: params.buscaLibros ?? null,
        ubicacion_lat: params.ubicacion?.lat ?? null,
        ubicacion_lng: params.ubicacion?.lng ?? null,
      },
      { onConflict: "usuario_id" }
    );

  return !error;
}
