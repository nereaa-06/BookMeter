const CLAVE_TEMA_COLOR = "bookmeter.tema.color";

export type TemaColor = "moderno" | "atardecer" | "bosque";

const TEMA_POR_DEFECTO: TemaColor = "moderno";

function esTemaColorValido(valor: unknown): valor is TemaColor {
  return valor === "moderno" || valor === "atardecer" || valor === "bosque";
}

export function obtenerTemaColorGuardado(): TemaColor {
  if (typeof window === "undefined") {
    return TEMA_POR_DEFECTO;
  }

  const valor = window.localStorage.getItem(CLAVE_TEMA_COLOR);
  if (esTemaColorValido(valor)) {
    return valor;
  }

  return TEMA_POR_DEFECTO;
}

export function aplicarTemaColor(tema: TemaColor) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CLAVE_TEMA_COLOR, tema);
  document.documentElement.setAttribute("data-theme", tema);
}

export function iniciarTemaColor() {
  const tema = obtenerTemaColorGuardado();
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", tema);
  }
}
