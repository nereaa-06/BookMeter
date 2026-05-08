import { Capacitor } from "@capacitor/core";
import { PushNotifications, type Token } from "@capacitor/push-notifications";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";

type RegistroPushResult = {
  ok: boolean;
  token?: string;
  error?: string;
};

export type ResultadoEnvioPush = {
  ok: boolean;
  sent: number;
  error?: string;
};

async function extraerDetalleErrorFuncion(error: unknown): Promise<string> {
  const tipoError =
    error && typeof error === "object" && "name" in error && typeof (error as { name?: unknown }).name === "string"
      ? (error as { name: string }).name
      : "Error";

  const mensajeBase =
    error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "Error al invocar send-push.";

  if (!error || typeof error !== "object" || !("context" in error)) {
    return mensajeBase;
  }

  const respuesta = (error as { context?: unknown }).context as
    | { status?: number; statusText?: string; text?: () => Promise<string> }
    | undefined;

  if (!respuesta || typeof respuesta !== "object") {
    return `${tipoError}: ${mensajeBase}`;
  }

  try {
    const status = typeof respuesta.status === "number" ? respuesta.status : 0;
    const statusText = typeof respuesta.statusText === "string" ? respuesta.statusText : "";
    const cuerpoTexto =
      typeof respuesta.text === "function"
        ? await ("clone" in respuesta && typeof (respuesta as { clone?: unknown }).clone === "function"
            ? (respuesta as { clone: () => { text: () => Promise<string> } }).clone().text()
            : respuesta.text())
        : "";

    if (cuerpoTexto) {
      try {
        const cuerpo = JSON.parse(cuerpoTexto) as { error?: unknown };
        if (typeof cuerpo.error === "string" && cuerpo.error.trim()) {
          return `${tipoError} HTTP ${status}${statusText ? ` ${statusText}` : ""}: ${cuerpo.error}`;
        }
      } catch {
        return `${tipoError} HTTP ${status}${statusText ? ` ${statusText}` : ""}: ${cuerpoTexto}`;
      }
    }

    if (status > 0) {
      return `${tipoError} HTTP ${status}${statusText ? ` ${statusText}` : ""}`;
    }
  } catch {
    // Si no se puede parsear el cuerpo, mantenemos el mensaje base.
  }

  return `${tipoError}: ${mensajeBase}`;
}

function extraerStatusErrorFuncion(error: unknown): number | null {
  if (!error || typeof error !== "object" || !("context" in error)) {
    return null;
  }

  const respuesta = (error as { context?: unknown }).context as { status?: unknown } | undefined;
  return typeof respuesta?.status === "number" ? respuesta.status : null;
}

type NotificacionChatPayload = {
  recipientUserId: string;
  senderName: string;
  bookTitle: string;
  preview: string;
};

type NotificacionLibroPayload = {
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  ownerName: string;
  ownerUserId: string;
  latitude: number;
  longitude: number;
};

const TOKEN_STORAGE_PREFIX = "bookmeter.push.token.";
let registroEnCurso: Promise<RegistroPushResult> | null = null;

function obtenerUrlFuncionPush(): string {
  const base = (import.meta.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
  return `${base}/functions/v1/send-push`;
}

function tokenPareceDeEsteProyecto(accessToken: string): boolean {
  try {
    const [, payloadBase64] = accessToken.split(".");
    if (!payloadBase64) {
      return false;
    }

    const normalizado = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalizado + "=".repeat((4 - (normalizado.length % 4)) % 4);
    const payloadTexto = atob(padded);
    const payload = JSON.parse(payloadTexto) as { iss?: unknown };
    const url = (import.meta.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");

    return typeof payload.iss === "string" && payload.iss.startsWith(`${url}/auth/v1`);
  } catch {
    return false;
  }
}

async function enviarSolicitudPush(
  anonKey: string,
  authorizationToken: string | null,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; sent?: number; status?: number; statusText?: string; error?: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: anonKey,
  };

  if (authorizationToken) {
    headers.Authorization = `Bearer ${authorizationToken}`;
  }

  const respuesta = await fetch(obtenerUrlFuncionPush(), {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const texto = await respuesta.text();
  if (!respuesta.ok) {
    let detalle = texto;
    try {
      const json = JSON.parse(texto) as { error?: unknown };
      if (typeof json.error === "string") {
        detalle = json.error;
      }
    } catch {
      // Si no es JSON, mostramos texto plano.
    }

    return {
      ok: false,
      status: respuesta.status,
      statusText: respuesta.statusText,
      error: detalle,
    };
  }

  const data = texto ? (JSON.parse(texto) as { sent?: unknown }) : {};
  const sent = typeof data.sent === "number" ? data.sent : 0;
  return { ok: true, sent };
}

function esPlataformaNativa(): boolean {
  return Capacitor.getPlatform() !== "web";
}

async function obtenerJwtSesionValido(): Promise<string | null> {
  if (!supabase) {
    return null;
  }

  const ahoraEpoch = Math.floor(Date.now() / 1000);
  const margenRefrescoSegundos = 30;
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  const tokenActual = session?.access_token?.trim() || "";
  const expiraEn = session?.expires_at ?? 0;

  if (tokenPareceDeEsteProyecto(tokenActual) && expiraEn > ahoraEpoch + margenRefrescoSegundos) {
    return tokenActual;
  }

  const { data: refreshedData, error } = await supabase.auth.refreshSession();
  if (error) {
    return null;
  }

  const tokenRefrescado = refreshedData.session?.access_token?.trim() || "";
  return tokenPareceDeEsteProyecto(tokenRefrescado) ? tokenRefrescado : null;
}

async function guardarTokenEnSupabase(usuarioId: string, token: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  await supabase.from("push_device_tokens").upsert(
    {
      usuario_id: usuarioId,
      token,
      plataforma: Capacitor.getPlatform(),
      habilitado: true,
    },
    { onConflict: "token" }
  );
}

function guardarTokenLocal(usuarioId: string, token: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(`${TOKEN_STORAGE_PREFIX}${usuarioId}`, token);
}

export async function registrarDispositivoPush(usuarioId: string): Promise<RegistroPushResult> {
  if (!usuarioId) {
    return { ok: false, error: "Falta el usuario activo." };
  }

  if (!esPlataformaNativa()) {
    return { ok: false, error: "Solo se registra push nativo en Android/iOS." };
  }

  if (registroEnCurso) {
    return registroEnCurso;
  }

  registroEnCurso = new Promise<RegistroPushResult>(async (resolve) => {
    try {
      const permisos = await PushNotifications.requestPermissions();
      if (permisos.receive !== "granted") {
        resolve({ ok: false, error: "Permiso de notificaciones denegado." });
        return;
      }

      const guardarTokenRegistrado = async (token: Token) => {
        const tokenPush = token.value.trim();
        guardarTokenLocal(usuarioId, tokenPush);
        await guardarTokenEnSupabase(usuarioId, tokenPush);
        resolve({ ok: true, token: tokenPush });
      };

      const manejadorError = (error: unknown) => {
        const mensaje = error instanceof Error ? error.message : "No se pudo registrar el dispositivo.";
        resolve({ ok: false, error: mensaje });
      };

      const subToken = await PushNotifications.addListener("registration", (token) => {
        void guardarTokenRegistrado(token);
      });

      const subError = await PushNotifications.addListener("registrationError", (error) => {
        manejadorError(error);
      });

      await PushNotifications.register();

      // Evitamos acumular listeners si el registro tarda o se repite.
      setTimeout(() => {
        void subToken.remove();
        void subError.remove();
      }, 10000);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : "No se pudo registrar el dispositivo.";
      resolve({ ok: false, error: mensaje });
    } finally {
      registroEnCurso = null;
    }
  });

  return registroEnCurso;
}

async function llamarFuncionNotificaciones(payload: Record<string, unknown>): Promise<ResultadoEnvioPush> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, sent: 0, error: "Supabase no está configurado." };
  }

  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
  if (!anonKey) {
    return { ok: false, sent: 0, error: "Falta VITE_SUPABASE_ANON_KEY." };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return { ok: false, sent: 0, error: "No hay sesion iniciada. Inicia sesion para enviar mensajes." };
  }

  const ahora = Math.floor(Date.now() / 1000);
  const expiraEn = sessionData.session.expires_at ?? 0;
  if (expiraEn <= ahora + 30) {
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      return { ok: false, sent: 0, error: "Tu sesion caduco. Cierra sesion y vuelve a iniciar." };
    }
  }

  try {
    const { data, error } = await supabase.functions.invoke("send-push", {
      body: payload,
    });

    if (error) {
      const status = extraerStatusErrorFuncion(error);
      if (status === 401) {
        const fallback = await enviarSolicitudPush(anonKey, anonKey, payload);
        if (fallback.ok) {
          return { ok: true, sent: fallback.sent ?? 0 };
        }
      }

      return {
        ok: false,
        sent: 0,
        error: await extraerDetalleErrorFuncion(error),
      };
    }

    const sent =
      data && typeof data === "object" && "sent" in data && typeof (data as { sent?: unknown }).sent === "number"
        ? (data as { sent: number }).sent
        : 0;

    return { ok: true, sent };
  } catch (error) {
    const detalle = await extraerDetalleErrorFuncion(error);
    return { ok: false, sent: 0, error: detalle };
  }
}

export async function notificarChatNuevo(payload: NotificacionChatPayload): Promise<ResultadoEnvioPush> {
  return llamarFuncionNotificaciones({
    kind: "chat",
    ...payload,
  });
}

export async function notificarLibroNuevo(payload: NotificacionLibroPayload): Promise<ResultadoEnvioPush> {
  return llamarFuncionNotificaciones({
    kind: "book",
    ...payload,
  });
}
