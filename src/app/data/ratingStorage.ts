import { isSupabaseConfigured, supabase } from "../../lib/supabase";

const RATING_STORAGE_KEY = "bookmeter-ratings";

type CalificacionLocal = {
  valoradoId: string;
  valoradorId: string;
  puntuacion: number;
  actualizadoEn: string;
};

type CalificacionRemota = {
  valorado_id: string;
  valorador_id: string;
  puntuacion: number;
};

export type ResumenValoracion = {
  media: number;
  total: number;
};

function normalizarPuntuacion(puntuacion: number): number {
  return Math.max(1, Math.min(5, Math.round(puntuacion)));
}

function leerValoracionesLocales(): CalificacionLocal[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(RATING_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is CalificacionLocal => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const valoracion = item as Partial<CalificacionLocal>;
      return typeof valoracion.valoradoId === "string"
        && typeof valoracion.valoradorId === "string"
        && typeof valoracion.puntuacion === "number";
    });
  } catch {
    return [];
  }
}

function guardarValoracionesLocales(valoraciones: CalificacionLocal[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(RATING_STORAGE_KEY, JSON.stringify(valoraciones));
}

function calcularResumenDesdePuntuaciones(puntuaciones: number[]): ResumenValoracion {
  if (puntuaciones.length === 0) {
    return { media: 0, total: 0 };
  }

  const suma = puntuaciones.reduce((acumulado, valor) => acumulado + valor, 0);
  return {
    media: Math.round((suma / puntuaciones.length) * 10) / 10,
    total: puntuaciones.length,
  };
}

export async function obtenerResumenValoracionesUsuario(usuarioId: string): Promise<ResumenValoracion> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("valoraciones")
      .select("puntuacion")
      .eq("valorado_id", usuarioId);

    if (!error && Array.isArray(data)) {
      return calcularResumenDesdePuntuaciones(
        data
          .map((item) => Number(item.puntuacion))
          .filter((valor) => Number.isFinite(valor))
          .map((valor) => normalizarPuntuacion(valor))
      );
    }

    return { media: 0, total: 0 };
  }

  const locales = leerValoracionesLocales()
    .filter((item) => item.valoradoId === usuarioId)
    .map((item) => normalizarPuntuacion(item.puntuacion));

  return calcularResumenDesdePuntuaciones(locales);
}

export async function obtenerValoracionDeUsuarioSobreOtro(
  valoradorId: string,
  valoradoId: string
): Promise<number | null> {
  if (!valoradorId || !valoradoId || valoradorId === valoradoId) {
    return null;
  }

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("valoraciones")
      .select("puntuacion")
      .eq("valorador_id", valoradorId)
      .eq("valorado_id", valoradoId)
      .maybeSingle();

    if (!error && data?.puntuacion) {
      return normalizarPuntuacion(Number(data.puntuacion));
    }

    return null;
  }

  const encontrada = leerValoracionesLocales().find(
    (item) => item.valoradorId === valoradorId && item.valoradoId === valoradoId
  );

  return encontrada ? normalizarPuntuacion(encontrada.puntuacion) : null;
}

export async function guardarValoracionUsuario(
  valoradorId: string,
  valoradoId: string,
  puntuacion: number
): Promise<boolean> {
  if (!valoradorId || !valoradoId || valoradorId === valoradoId) {
    return false;
  }

  const puntuacionFinal = normalizarPuntuacion(puntuacion);

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from("valoraciones")
      .upsert(
        {
          valorador_id: valoradorId,
          valorado_id: valoradoId,
          puntuacion: puntuacionFinal,
        } satisfies CalificacionRemota,
        { onConflict: "valorador_id,valorado_id" }
      );

    if (!error) {
      return true;
    }

    return false;
  }

  const locales = leerValoracionesLocales();
  const yaExiste = locales.findIndex(
    (item) => item.valoradorId === valoradorId && item.valoradoId === valoradoId
  );

  if (yaExiste >= 0) {
    locales[yaExiste] = {
      ...locales[yaExiste],
      puntuacion: puntuacionFinal,
      actualizadoEn: new Date().toISOString(),
    };
  } else {
    locales.unshift({
      valoradorId,
      valoradoId,
      puntuacion: puntuacionFinal,
      actualizadoEn: new Date().toISOString(),
    });
  }

  guardarValoracionesLocales(locales);
  return true;
}
