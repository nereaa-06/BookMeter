const CLAVE_FAVORITOS = "bookmeter.favoritos.porUsuario";
const EVENTO_FAVORITOS_CAMBIADOS = "bookmeter:favorites-changed";

type FavoritosPorUsuario = Record<string, string[]>;

function leerFavoritosPorUsuario(): FavoritosPorUsuario {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(CLAVE_FAVORITOS);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return parsed as FavoritosPorUsuario;
  } catch {
    return {};
  }
}

function guardarFavoritosPorUsuario(datos: FavoritosPorUsuario) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CLAVE_FAVORITOS, JSON.stringify(datos));
}

export function obtenerFavoritosUsuario(usuarioId: string): string[] {
  if (!usuarioId) {
    return [];
  }

  const favoritos = leerFavoritosPorUsuario();
  return Array.isArray(favoritos[usuarioId]) ? favoritos[usuarioId] : [];
}

export function esLibroFavorito(usuarioId: string, libroId: string): boolean {
  return obtenerFavoritosUsuario(usuarioId).includes(libroId);
}

export function alternarFavorito(usuarioId: string, libroId: string): boolean {
  if (!usuarioId || !libroId) {
    return false;
  }

  const favoritos = leerFavoritosPorUsuario();
  const listaActual = Array.isArray(favoritos[usuarioId]) ? favoritos[usuarioId] : [];
  const existe = listaActual.includes(libroId);
  const listaNueva = existe
    ? listaActual.filter((item) => item !== libroId)
    : [...listaActual, libroId];

  favoritos[usuarioId] = listaNueva;
  guardarFavoritosPorUsuario(favoritos);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENTO_FAVORITOS_CAMBIADOS));
  }
  return !existe;
}

export function quitarFavorito(usuarioId: string, libroId: string) {
  if (!usuarioId || !libroId) {
    return;
  }

  const favoritos = leerFavoritosPorUsuario();
  const listaActual = Array.isArray(favoritos[usuarioId]) ? favoritos[usuarioId] : [];
  favoritos[usuarioId] = listaActual.filter((item) => item !== libroId);
  guardarFavoritosPorUsuario(favoritos);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENTO_FAVORITOS_CAMBIADOS));
  }
}

export function suscribirseACambiosDeFavoritos(onChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const listener = () => onChange();
  window.addEventListener(EVENTO_FAVORITOS_CAMBIADOS, listener);

  return () => {
    window.removeEventListener(EVENTO_FAVORITOS_CAMBIADOS, listener);
  };
}
