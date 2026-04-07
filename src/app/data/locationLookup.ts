import type { PosicionUsuario } from "./mapStateStorage";

const CACHE_KEY = "bookmeter.location.lookup.cache";
const memoriaCache = new Map<string, string>();

type CachePersistido = Record<string, string>;

function claveDePosicion(posicion: PosicionUsuario): string {
  return `${posicion.lat.toFixed(2)},${posicion.lng.toFixed(2)}`;
}

function leerCachePersistida(): CachePersistido {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return parsed as CachePersistido;
  } catch {
    return {};
  }
}

function guardarCachePersistida(cache: CachePersistido) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

function extraerCiudadDesdeRespuesta(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const direccion = (data as { address?: Record<string, unknown> }).address;
  if (!direccion || typeof direccion !== "object") {
    return null;
  }

  const campos = ["city", "town", "village", "municipality", "county", "state", "country"];
  for (const campo of campos) {
    const valor = direccion[campo];
    if (typeof valor === "string" && valor.trim()) {
      return valor.trim();
    }
  }

  return null;
}

export async function obtenerCiudadDeUbicacion(posicion: PosicionUsuario): Promise<string> {
  const clave = claveDePosicion(posicion);

  if (memoriaCache.has(clave)) {
    return memoriaCache.get(clave) ?? "Ubicación desconocida";
  }

  if (typeof window !== "undefined") {
    const cachePersistida = leerCachePersistida();
    if (cachePersistida[clave]) {
      memoriaCache.set(clave, cachePersistida[clave]);
      return cachePersistida[clave];
    }
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(posicion.lat));
    url.searchParams.set("lon", String(posicion.lng));
    url.searchParams.set("accept-language", "es");

    const respuesta = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!respuesta.ok) {
      throw new Error("No se pudo resolver la ciudad.");
    }

    const data = await respuesta.json();
    const ciudad = extraerCiudadDesdeRespuesta(data) ?? "Ubicación desconocida";

    memoriaCache.set(clave, ciudad);

    if (typeof window !== "undefined") {
      const cachePersistida = leerCachePersistida();
      cachePersistida[clave] = ciudad;
      guardarCachePersistida(cachePersistida);
    }

    return ciudad;
  } catch {
    return "Ubicación desconocida";
  }
}
