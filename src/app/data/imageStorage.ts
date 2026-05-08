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
    console.error("[subirImagenASupabase] Supabase no está configurado");
    return null;
  }

  try {
    const extension = obtenerExtensionSegura(archivo.name);
    const nombre = `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    const ruta = `${propietarioId}/${nombre}`;

    console.log(`[subirImagenASupabase] Intentando subir: ${archivo.name} (${archivo.size} bytes) a ${bucket}/${ruta}`);

    const { error, data: uploadData } = await supabase.storage
      .from(bucket)
      .upload(ruta, archivo, {
        cacheControl: "3600",
        upsert: false,
        contentType: archivo.type || undefined,
      });

    if (error) {
      console.error(`[subirImagenASupabase] Error al subir: ${error.message}`, error);
      return null;
    }

    console.log(`[subirImagenASupabase] Archivo subido exitosamente: ${ruta}`);

    const { data } = supabase.storage.from(bucket).getPublicUrl(ruta);
    const baseUrl = data.publicUrl || null;
    
    if (!baseUrl) {
      console.error("[subirImagenASupabase] No se pudo obtener URL pública");
      return null;
    }

    const publicUrl = baseUrl.replace(/^http:\/\//i, "https://");
    console.log(`[subirImagenASupabase] URL pública: ${publicUrl}`);
    
    return publicUrl;
  } catch (error) {
    console.error("[subirImagenASupabase] Excepción:", error);
    return null;
  }
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