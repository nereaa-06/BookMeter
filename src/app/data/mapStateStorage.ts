export type PosicionUsuario = {
  lat: number;
  lng: number;
};

export type EstadoMapaGuardado = {
  posicionUsuario: PosicionUsuario;
  centroMapa: [number, number];
  zoomMapa: number;
};

const MAPA_ESTADO_STORAGE_KEY = "bookmeter.mapa.estado";

function esPosicionValida(valor: unknown): valor is PosicionUsuario {
  if (!valor || typeof valor !== "object") {
    return false;
  }

  const posicion = valor as Partial<PosicionUsuario>;
  return typeof posicion.lat === "number" && Number.isFinite(posicion.lat)
    && typeof posicion.lng === "number" && Number.isFinite(posicion.lng);
}

export function leerEstadoMapaGuardado(): EstadoMapaGuardado | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(MAPA_ESTADO_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<EstadoMapaGuardado>;
    if (!esPosicionValida(parsed.posicionUsuario) || !Array.isArray(parsed.centroMapa)) {
      return null;
    }

    const [latCentro, lngCentro] = parsed.centroMapa;
    if (typeof latCentro !== "number" || typeof lngCentro !== "number") {
      return null;
    }

    const zoomMapa = typeof parsed.zoomMapa === "number" && Number.isFinite(parsed.zoomMapa)
      ? parsed.zoomMapa
      : 13;

    return {
      posicionUsuario: parsed.posicionUsuario,
      centroMapa: [latCentro, lngCentro],
      zoomMapa,
    };
  } catch {
    return null;
  }
}

export function guardarEstadoMapa(estado: EstadoMapaGuardado) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(MAPA_ESTADO_STORAGE_KEY, JSON.stringify(estado));
}
