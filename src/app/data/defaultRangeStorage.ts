const CLAVE_RANGO_BUSQUEDA_PREDETERMINADO = "bookmeter.busqueda.rangoPredeterminado";

const RANGO_MINIMO = 1;
const RANGO_MAXIMO = 100;
const RANGO_POR_DEFECTO = 10;

function normalizarRango(valor: number): number {
  if (!Number.isFinite(valor)) {
    return RANGO_POR_DEFECTO;
  }

  return Math.min(RANGO_MAXIMO, Math.max(RANGO_MINIMO, Math.round(valor)));
}

export function obtenerRangoBusquedaPredeterminado(): number {
  if (typeof window === "undefined") {
    return RANGO_POR_DEFECTO;
  }

  const raw = window.localStorage.getItem(CLAVE_RANGO_BUSQUEDA_PREDETERMINADO);
  if (!raw) {
    return RANGO_POR_DEFECTO;
  }

  const valor = Number(raw);
  return normalizarRango(valor);
}

export function guardarRangoBusquedaPredeterminado(rango: number) {
  if (typeof window === "undefined") {
    return;
  }

  const valorNormalizado = normalizarRango(rango);
  window.localStorage.setItem(CLAVE_RANGO_BUSQUEDA_PREDETERMINADO, String(valorNormalizado));
}
