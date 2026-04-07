const CLAVE_PERMISO_UBICACION = "bookmeter.permisos.ubicacion";

export type PreferenciaPermisoUbicacion = "aceptado" | "denegado" | "sin-definir";

export function obtenerPreferenciaPermisoUbicacion(): PreferenciaPermisoUbicacion {
  if (typeof window === "undefined") {
    return "sin-definir";
  }

  const valor = window.localStorage.getItem(CLAVE_PERMISO_UBICACION);

  if (valor === "aceptado" || valor === "denegado") {
    return valor;
  }

  return "sin-definir";
}

export function guardarPreferenciaPermisoUbicacion(preferencia: "aceptado" | "denegado") {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CLAVE_PERMISO_UBICACION, preferencia);
}

export function limpiarPreferenciaPermisoUbicacion() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(CLAVE_PERMISO_UBICACION);
}
