// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";

type CargaChat = {
  kind: "chat";
  recipientUserId: string;
  senderName: string;
  bookTitle: string;
  preview: string;
};

type CargaLibro = {
  kind: "book";
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  ownerName: string;
  ownerUserId: string;
  latitude: number;
  longitude: number;
};

type CargaNotificacion = CargaChat | CargaLibro;

type FilaTokenDispositivo = {
  usuario_id: string;
  token: string;
  plataforma: string;
  habilitado: boolean;
};

type PerfilPublicoRow = {
  usuario_id: string;
  nombre: string;
  busca_libros: string | null;
  ubicacion_lat: number | null;
  ubicacion_lng: number | null;
};

type CuentaServicioFirebase = {
  project_id: string;
  client_email: string;
  private_key: string;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const firebaseServiceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON") ?? "";
const firebaseProjectIdEnv = Deno.env.get("FIREBASE_PROJECT_ID") ?? "";
const distanciaMaximaDefaultKm = 25;
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const FCM_V1_URL_BASE = "https://fcm.googleapis.com/v1/projects";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

function responderJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders,
    },
  });
}

function esTexto(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim().length > 0;
}

function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function calcularDistanciaKm(
  origen: { lat: number; lng: number },
  destino: { lat: number; lng: number }
): number {
  // Distancia aproximada en km entre dos puntos usando Haversine.
  const radioTierraKm = 6371;
  const latDiff = ((destino.lat - origen.lat) * Math.PI) / 180;
  const lngDiff = ((destino.lng - origen.lng) * Math.PI) / 180;
  const latOrigen = (origen.lat * Math.PI) / 180;
  const latDestino = (destino.lat * Math.PI) / 180;

  const a =
    Math.sin(latDiff / 2) * Math.sin(latDiff / 2) +
    Math.sin(lngDiff / 2) * Math.sin(lngDiff / 2) * Math.cos(latOrigen) * Math.cos(latDestino);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(radioTierraKm * c * 10) / 10;
}

function coincideConBusquedas(buscaLibros: string | null, bookTitle: string, bookAuthor: string): boolean {
  if (!buscaLibros || !buscaLibros.trim()) {
    return true;
  }

  const textoBuscado = normalizarTexto(buscaLibros);
  const terminos = textoBuscado.split(/[\n,;]+/).flatMap((bloque) => bloque.split(/\s+/)).filter(Boolean);
  if (terminos.length === 0) {
    return true;
  }

  const textoLibro = `${normalizarTexto(bookTitle)} ${normalizarTexto(bookAuthor)}`;
  return terminos.some((termino) => textoLibro.includes(termino));
}

function decodificarBase64Url(texto: string): Uint8Array {
  const base64 = texto.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const data = atob(base64 + padding);
  const bytes = new Uint8Array(data.length);
  for (let index = 0; index < data.length; index += 1) {
    bytes[index] = data.charCodeAt(index);
  }
  return bytes;
}

function codificarBase64Url(bytes: Uint8Array): string {
  let texto = "";
  for (const byte of bytes) {
    texto += String.fromCharCode(byte);
  }

  return btoa(texto)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function parsearCuentaFirebase(): CuentaServicioFirebase | null {
  if (!firebaseServiceAccountJson.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(firebaseServiceAccountJson) as Partial<CuentaServicioFirebase>;
    if (!esTexto(parsed.project_id) || !esTexto(parsed.client_email) || !esTexto(parsed.private_key)) {
      return null;
    }

    return {
      project_id: parsed.project_id,
      client_email: parsed.client_email,
      private_key: parsed.private_key,
    };
  } catch {
    return null;
  }
}

async function firmarJwtConCuentaServicio(
  cuenta: CuentaServicioFirebase,
  audiencia: string,
  scopes: string
): Promise<string> {
  const ahora = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: cuenta.client_email,
    scope: scopes,
    aud: audiencia,
    iat: ahora,
    exp: ahora + 3600,
  };

  // Montamos el JWT en tres partes: cabecera, payload y firma.
  const headerBase64 = codificarBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadBase64 = codificarBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${headerBase64}.${payloadBase64}`;

  const privateKeyPem = cuenta.private_key.replace(/\\n/g, "\n");
  const pkcs8 = privateKeyPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");

  const keyBytes = decodificarBase64Url(pkcs8);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const firma = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput)
  );

  const firmaBase64 = codificarBase64Url(new Uint8Array(firma));
  return `${signingInput}.${firmaBase64}`;
}

async function obtenerAccessTokenFirebase(cuenta: CuentaServicioFirebase): Promise<string | null> {
  try {
    const jwt = await firmarJwtConCuentaServicio(cuenta, TOKEN_ENDPOINT, FCM_SCOPE);
    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    });

    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return typeof data?.access_token === "string" ? data.access_token : null;
  } catch {
    return null;
  }
}

async function cargarTokensPorUsuarios(userIds: string[]): Promise<FilaTokenDispositivo[]> {
  if (!supabaseAdmin || userIds.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("push_device_tokens")
    .select("usuario_id,token,plataforma,habilitado")
    .eq("habilitado", true)
    .in("usuario_id", userIds);

  if (error || !data) {
    return [];
  }

  return data as FilaTokenDispositivo[];
}

async function enviarPushALista(
  cuenta: CuentaServicioFirebase,
  tokens: FilaTokenDispositivo[],
  titulo: string,
  cuerpo: string,
  data: Record<string, string>
): Promise<number> {
  if (tokens.length === 0) {
    return 0;
  }

  const accessToken = await obtenerAccessTokenFirebase(cuenta);
  if (!accessToken) {
    return 0;
  }

  let enviados = 0;
  const projectId = firebaseProjectIdEnv || cuenta.project_id;

  for (const registro of tokens) {
    const response = await fetch(`${FCM_V1_URL_BASE}/${projectId}/messages:send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: {
          token: registro.token,
          notification: {
            title: titulo,
            body: cuerpo,
          },
          data: Object.fromEntries(
            Object.entries(data).map(([key, value]) => [key, String(value)])
          ),
          android: {
            priority: "HIGH",
          },
        },
      }),
    });

    if (response.ok) {
      enviados += 1;
    }
  }

  return enviados;
}

async function manejarChat(cuenta: CuentaServicioFirebase, payload: CargaChat): Promise<Response> {
  if (!esTexto(payload.recipientUserId)) {
    return responderJson({ error: "Falta recipientUserId" }, 400);
  }

  const tokens = await cargarTokensPorUsuarios([payload.recipientUserId]);
  const titulo = `Nuevo mensaje de ${payload.senderName}`;
  const cuerpo = payload.preview || payload.bookTitle;

  const enviados = await enviarPushALista(cuenta, tokens, titulo, cuerpo, {
    kind: "chat",
    recipientUserId: payload.recipientUserId,
    senderName: payload.senderName,
    bookTitle: payload.bookTitle,
  });

  return responderJson({ ok: true, sent: enviados });
}

async function manejarLibro(cuenta: CuentaServicioFirebase, payload: CargaLibro): Promise<Response> {
  if (!supabaseAdmin) {
    return responderJson({ error: "Supabase no configurado" }, 500);
  }

  const { data: perfiles, error } = await supabaseAdmin
    .from("perfiles_publicos")
    .select("usuario_id,nombre,busca_libros,ubicacion_lat,ubicacion_lng")
    .neq("usuario_id", payload.ownerUserId);

  if (error || !perfiles) {
    return responderJson({ error: "No se pudieron leer los perfiles" }, 500);
  }

  const perfilesFiltrados = (perfiles as PerfilPublicoRow[]).filter((perfil) => {
    if (typeof perfil.ubicacion_lat !== "number" || typeof perfil.ubicacion_lng !== "number") {
      return false;
    }

    const distancia = calcularDistanciaKm(
      { lat: payload.latitude, lng: payload.longitude },
      { lat: perfil.ubicacion_lat, lng: perfil.ubicacion_lng }
    );

    if (distancia > distanciaMaximaDefaultKm) {
      return false;
    }

    return coincideConBusquedas(perfil.busca_libros, payload.bookTitle, payload.bookAuthor);
  });

  const idsUsuarios = perfilesFiltrados.map((perfil) => perfil.usuario_id);
  const tokens = await cargarTokensPorUsuarios(idsUsuarios);
  const cuerpo = `${payload.bookTitle} · ${payload.bookAuthor} · ${payload.ownerName}`;

  const enviados = await enviarPushALista(cuenta, tokens, "Libro cerca de ti", cuerpo, {
    kind: "book",
    bookId: payload.bookId,
    bookTitle: payload.bookTitle,
    bookAuthor: payload.bookAuthor,
    ownerName: payload.ownerName,
  });

  return responderJson({ ok: true, sent: enviados, recipients: idsUsuarios.length });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return responderJson({ error: "Método no permitido" }, 405);
  }

  if (!supabaseAdmin) {
    return responderJson({ error: "Faltan credenciales de Supabase" }, 500);
  }

  const cuenta = parsearCuentaFirebase();
  if (!cuenta) {
    return responderJson({ error: "Falta FIREBASE_SERVICE_ACCOUNT_JSON" }, 500);
  }

  const payload = (await req.json().catch(() => null)) as CargaNotificacion | null;
  if (!payload || !esTexto((payload as { kind?: unknown }).kind)) {
    return responderJson({ error: "Payload inválido" }, 400);
  }

  if (payload.kind === "chat") {
    return manejarChat(cuenta, payload);
  }

  if (payload.kind === "book") {
    return manejarLibro(cuenta, payload);
  }

  return responderJson({ error: "Tipo de notificación desconocido" }, 400);
});
