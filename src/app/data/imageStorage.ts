import { isSupabaseConfigured, supabase } from "../../lib/supabase";

function obtenerExtensionSegura(nombreArchivo: string): string {
  const extension = nombreArchivo.split(".").pop()?.toLowerCase() ?? "jpg";
  return /^[a-z0-9]+$/.test(extension) ? extension : "jpg";
}

export async function subirImagenASupabase(
  archivo: File,
  bucket: string,
  propietarioId: string,
  prefijo: string
): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const extension = obtenerExtensionSegura(archivo.name);
  const nombre = `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const ruta = `${propietarioId}/${nombre}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(ruta, archivo, {
      cacheControl: "3600",
      upsert: false,
      contentType: archivo.type || undefined,
    });

  if (error) {
    return null;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(ruta);
  return data.publicUrl || null;
}

export function archivoADataUrl(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();

    lector.onload = () => {
      if (typeof lector.result === "string") {
        resolve(lector.result);
        return;
      }
      reject(new Error("No se pudo convertir el archivo a data URL."));
    };

    lector.onerror = () => {
      reject(new Error("No se pudo leer el archivo."));
    };

    lector.readAsDataURL(archivo);
  });
}