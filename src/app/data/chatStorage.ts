import type { Book } from "./mockData";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { archivoADataUrl, subirImagenASupabase } from "./imageStorage";

const CHAT_STORAGE_KEY = "bookmeter-chats";
const LEGACY_CURRENT_USER_ID = "current-user";
const PENDING_CHAT_STORAGE_KEY = "bookmeter-pending-chat";
const HIDDEN_CHAT_STORAGE_KEY = "bookmeter-hidden-chats";
const CHAT_READ_STORAGE_KEY = "bookmeter-chat-read";
const EVENTO_CHATS_CAMBIADOS = "bookmeter:chat-changed";

export interface ChatUserIdentity {
  id: string;
  name: string;
  avatar: string;
}

export interface ChatMessageItem {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  imageUrl?: string;
  timestamp: Date;
}

export interface ChatThreadItem {
  id: string;
  book: {
    id: string;
    title: string;
    cover: string;
  };
  otherUser: {
    id: string;
    name: string;
    avatar: string;
  };
  rolActual?: "propietario" | "solicitante" | "desconocido";
  tieneMatch?: boolean;
  messages: ChatMessageItem[];
}

export type DeleteChatResult = {
  ok: boolean;
  canUndo: boolean;
};

export type DeleteAllChatsResult = {
  ok: boolean;
  deletedCount: number;
};

type MensajeChatLocal = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  imageUrl?: string;
  timestamp: string;
};

type ChatLocal = {
  id: string;
  book: {
    id: string;
    title: string;
    cover: string;
  };
  owner: ChatUserIdentity;
  requester: ChatUserIdentity;
  messages: MensajeChatLocal[];
  createdAt: string;
};

type FilaChatSupabase = {
  id: string;
  libro_id: string;
  titulo_libro: string;
  portada_libro: string;
  propietario_id: string;
  nombre_propietario: string;
  avatar_propietario: string;
  solicitante_id: string;
  nombre_solicitante: string;
  avatar_solicitante: string;
  creado_en: string;
};

type FilaMensajeSupabase = {
  id: string;
  id_chat: string;
  remitente_id: string;
  nombre_remitente: string;
  texto: string;
  imagen_url: string | null;
  creado_en: string;
};

type ChatPendiente = {
  id: string;
  book: {
    id: string;
    title: string;
    cover: string;
  };
  owner: ChatUserIdentity;
  requester: ChatUserIdentity;
  createdAt: string;
};

type ChatsOcultosPorUsuario = Record<string, string[]>;
type ChatsLeidosPorUsuario = Record<string, Record<string, string>>;
type CambioChats = {
  chatId?: string;
  tabla?: "chats" | "messages" | "local";
};

function esTexto(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim().length > 0;
}

function esChatPendiente(chatId: string): boolean {
  return chatId.startsWith("pending-chat-");
}

function generarIdChatPendiente(bookId: string, ownerId: string, requesterId: string): string {
  return `pending-chat-${bookId}-${ownerId}-${requesterId}`;
}

function leerChatPendiente(): ChatPendiente | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(PENDING_CHAT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as ChatPendiente;
    if (!parsed || !esTexto(parsed.id) || !parsed.book || !parsed.owner || !parsed.requester) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function guardarChatPendiente(chat: ChatPendiente): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PENDING_CHAT_STORAGE_KEY, JSON.stringify(chat));
}

function notificarCambioDeChats(detalle?: CambioChats): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(EVENTO_CHATS_CAMBIADOS, { detail: detalle }));
}

function limpiarChatPendiente(chatId?: string): void {
  if (typeof window === "undefined") {
    return;
  }

  if (!chatId) {
    window.localStorage.removeItem(PENDING_CHAT_STORAGE_KEY);
    return;
  }

  const pendiente = leerChatPendiente();
  if (pendiente?.id === chatId) {
    window.localStorage.removeItem(PENDING_CHAT_STORAGE_KEY);
  }
}

function normalizarIdentidad(raw: unknown): ChatUserIdentity | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidato = raw as Partial<ChatUserIdentity>;
  if (!esTexto(candidato.id) || !esTexto(candidato.name)) {
    return null;
  }

  return {
    id: candidato.id,
    name: candidato.name,
    avatar: esTexto(candidato.avatar) ? candidato.avatar : "https://i.pravatar.cc/150?img=1",
  };
}

function normalizarMensajes(raw: unknown): MensajeChatLocal[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item): MensajeChatLocal | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const mensaje = item as Partial<MensajeChatLocal>;
      if (!esTexto(mensaje.id) || !esTexto(mensaje.senderId) || !esTexto(mensaje.senderName)) {
        return null;
      }

      const texto = typeof mensaje.text === "string" ? mensaje.text : "";
      const imagen = esTexto(mensaje.imageUrl) ? mensaje.imageUrl : undefined;
      const fechaIso = esTexto(mensaje.timestamp)
        ? mensaje.timestamp
        : new Date().toISOString();

      return {
        id: mensaje.id,
        senderId: mensaje.senderId,
        senderName: mensaje.senderName,
        text: texto,
        imageUrl: imagen,
        timestamp: fechaIso,
      };
    })
    .filter((item): item is MensajeChatLocal => Boolean(item))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function normalizarLibro(raw: unknown): ChatLocal["book"] | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const libro = raw as Partial<ChatLocal["book"]>;
  if (!esTexto(libro.id) || !esTexto(libro.title)) {
    return null;
  }

  return {
    id: libro.id,
    title: libro.title,
    cover: esTexto(libro.cover) ? libro.cover : "https://placehold.co/240x360/EDE7DD/6B6962?text=Sin+portada",
  };
}

function esChatDePruebaNoReal(chat: ChatLocal): boolean {
  const nombreOwner = chat.owner.name.toLowerCase().trim();
  const nombreRequester = chat.requester.name.toLowerCase().trim();

  if (nombreOwner === "carlos ruiz" || nombreRequester === "carlos ruiz") {
    return true;
  }

  // Filtro extra para chats legacy de demo (ids numericos antiguos).
  const idsDemo = new Set(["1", "2", "3", "4"]);
  return idsDemo.has(chat.owner.id) || idsDemo.has(chat.requester.id);
}

function normalizarChatLocal(raw: unknown): ChatLocal | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const chatRaw = raw as Record<string, unknown>;
  const book = normalizarLibro(chatRaw.book);
  if (!book) {
    return null;
  }

  const ownerDirecto = normalizarIdentidad(chatRaw.owner);
  const requesterDirecto = normalizarIdentidad(chatRaw.requester);

  // Compatibilidad con estructuras antiguas donde solo existia `otherUser`.
  const legacyOtherUser = normalizarIdentidad(chatRaw.otherUser);
  const legacyBookOwner = chatRaw.book && typeof chatRaw.book === "object"
    ? normalizarIdentidad((chatRaw.book as Record<string, unknown>).owner)
    : null;

  const owner = ownerDirecto ?? legacyBookOwner ?? legacyOtherUser;
  const requester = requesterDirecto ?? {
    id: "current-user",
    name: "Usuario",
    avatar: "https://i.pravatar.cc/150?img=5",
  };

  if (!owner) {
    return null;
  }

  const mensajes = normalizarMensajes(chatRaw.messages);

  const creadoEn = esTexto(chatRaw.createdAt)
    ? chatRaw.createdAt
    : mensajes[0]?.timestamp ?? new Date().toISOString();

  const chatId = esTexto(chatRaw.id)
    ? chatRaw.id
    : `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id: chatId,
    book,
    owner,
    requester,
    messages: mensajes,
    createdAt: creadoEn,
  };
}

function leerChatsLocales(): ChatLocal[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const chatsNormalizados = parsed
      .map((chat) => normalizarChatLocal(chat))
      .filter((chat): chat is ChatLocal => Boolean(chat))
      .filter((chat) => !esChatDePruebaNoReal(chat));

    // Si hubo migracion/limpieza, persistimos formato final para futuras cargas.
    if (chatsNormalizados.length !== parsed.length) {
      guardarChatsLocales(chatsNormalizados);
    }

    return chatsNormalizados;
  } catch {
    return [];
  }
}

function guardarChatsLocales(chats: ChatLocal[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chats));
}

function leerChatsOcultosPorUsuario(): ChatsOcultosPorUsuario {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(HIDDEN_CHAT_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return parsed as ChatsOcultosPorUsuario;
  } catch {
    return {};
  }
}

function guardarChatsOcultosPorUsuario(data: ChatsOcultosPorUsuario): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(HIDDEN_CHAT_STORAGE_KEY, JSON.stringify(data));
}

function obtenerSetChatsOcultos(currentUserId: string): Set<string> {
  const mapa = leerChatsOcultosPorUsuario();
  return new Set(mapa[currentUserId] ?? []);
}

function ocultarChatParaUsuario(currentUserId: string, chatId: string): void {
  const mapa = leerChatsOcultosPorUsuario();
  const actuales = new Set(mapa[currentUserId] ?? []);
  actuales.add(chatId);
  mapa[currentUserId] = Array.from(actuales);
  guardarChatsOcultosPorUsuario(mapa);
}

function ocultarMuchosChatsParaUsuario(currentUserId: string, chatIds: string[]): void {
  if (chatIds.length === 0) {
    return;
  }

  const mapa = leerChatsOcultosPorUsuario();
  const actuales = new Set(mapa[currentUserId] ?? []);
  chatIds.forEach((id) => actuales.add(id));
  mapa[currentUserId] = Array.from(actuales);
  guardarChatsOcultosPorUsuario(mapa);
}

function leerUltimasLecturas(): ChatsLeidosPorUsuario {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(CHAT_READ_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return parsed as ChatsLeidosPorUsuario;
  } catch {
    return {};
  }
}

function guardarUltimasLecturas(data: ChatsLeidosPorUsuario): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CHAT_READ_STORAGE_KEY, JSON.stringify(data));
}

function mostrarChatParaUsuario(currentUserId: string, chatId: string): boolean {
  const mapa = leerChatsOcultosPorUsuario();
  const actuales = new Set(mapa[currentUserId] ?? []);

  if (!actuales.has(chatId)) {
    return false;
  }

  actuales.delete(chatId);
  mapa[currentUserId] = Array.from(actuales);
  guardarChatsOcultosPorUsuario(mapa);
  return true;
}

function pasarChatLocalAChat(chat: ChatLocal, currentUserId: string): ChatThreadItem {
  const usuarioEsOwner = chat.owner.id === currentUserId || chat.owner.id === LEGACY_CURRENT_USER_ID;
  const otherUser = usuarioEsOwner ? chat.requester : chat.owner;

  return {
    id: chat.id,
    book: chat.book,
    otherUser,
    rolActual: usuarioEsOwner ? "propietario" : "solicitante",
    messages: chat.messages
      .map((message) => ({
        id: message.id,
        senderId: message.senderId,
        senderName: message.senderName,
        text: message.text,
          imageUrl: message.imageUrl,
        timestamp: new Date(message.timestamp),
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
  };
}

function marcarChatsConMatch(chats: ChatThreadItem[]): ChatThreadItem[] {
  const mapaRoles = new Map<string, Set<string>>();

  chats.forEach((chat) => {
    const key = chat.otherUser.id;
    const roles = mapaRoles.get(key) ?? new Set<string>();
    roles.add(chat.rolActual ?? "desconocido");
    mapaRoles.set(key, roles);
  });

  return chats.map((chat) => {
    const roles = mapaRoles.get(chat.otherUser.id);
    const tieneMatch = Boolean(roles && roles.has("propietario") && roles.has("solicitante"));
    return {
      ...chat,
      tieneMatch,
    };
  });
}

function esParticipanteDelChat(chat: ChatLocal, currentUserId: string): boolean {
  return (
    chat.owner.id === currentUserId ||
    chat.requester.id === currentUserId ||
    chat.owner.id === LEGACY_CURRENT_USER_ID ||
    chat.requester.id === LEGACY_CURRENT_USER_ID
  );
}

function claveChat(chat: ChatThreadItem): string {
  const miembros = [chat.otherUser.id, chat.book.id].join("|");
  return `${miembros}|${chat.id}`;
}

function combinarChatsSinDuplicar(remotos: ChatThreadItem[], locales: ChatThreadItem[]): ChatThreadItem[] {
  const mapa = new Map<string, ChatThreadItem>();

  for (const chat of locales) {
    mapa.set(claveChat(chat), chat);
  }

  for (const chat of remotos) {
    mapa.set(claveChat(chat), chat);
  }

  return Array.from(mapa.values()).sort((a, b) => {
    const tiempoA = a.messages[a.messages.length - 1]?.timestamp?.getTime() ?? 0;
    const tiempoB = b.messages[b.messages.length - 1]?.timestamp?.getTime() ?? 0;
    return tiempoB - tiempoA;
  });
}

async function obtenerChatsSupabase(currentUserId: string): Promise<ChatThreadItem[] | null> {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const { data: chats, error: chatsError } = await supabase
    .from("chats")
    .select("*")
    .or(`propietario_id.eq.${currentUserId},solicitante_id.eq.${currentUserId}`)
    .order("creado_en", { ascending: false });

  if (chatsError || !chats) {
    return null;
  }

  const chatRows = chats as FilaChatSupabase[];
  const chatIds = chatRows.map((chat) => chat.id);

  let messagesByChatId = new Map<string, FilaMensajeSupabase[]>();

  if (chatIds.length > 0) {
    const { data: messages } = await supabase
      .from("messages")
      .select("*")
      .in("id_chat", chatIds)
      .order("creado_en", { ascending: true });

    if (messages) {
      messagesByChatId = messages.reduce((map, message) => {
        const messageRow = message as FilaMensajeSupabase;
        const list = map.get(messageRow.id_chat) ?? [];
        list.push(messageRow);
        map.set(messageRow.id_chat, list);
        return map;
      }, new Map<string, FilaMensajeSupabase[]>());
    }
  }

  return chatRows
    .filter((chat) => {
      const propietario = chat.nombre_propietario.toLowerCase().trim();
      const solicitante = chat.nombre_solicitante.toLowerCase().trim();
      return propietario !== "carlos ruiz" && solicitante !== "carlos ruiz";
    })
    .map((chat) => {
    const isOwner = chat.propietario_id === currentUserId;
    const otherUser = isOwner
      ? {
          id: chat.solicitante_id,
          name: chat.nombre_solicitante,
          avatar: chat.avatar_solicitante,
        }
      : {
          id: chat.propietario_id,
          name: chat.nombre_propietario,
          avatar: chat.avatar_propietario,
        };

    const messages = (messagesByChatId.get(chat.id) ?? []).map((message) => ({
      id: message.id,
      senderId: message.remitente_id,
      senderName: message.nombre_remitente,
      text: message.texto,
      imageUrl: message.imagen_url ?? undefined,
      timestamp: new Date(message.creado_en),
    }));

    return {
      id: chat.id,
      book: {
        id: chat.libro_id,
        title: chat.titulo_libro,
        cover: chat.portada_libro,
      },
      otherUser,
      rolActual: isOwner ? "propietario" : "solicitante",
      messages,
    } as ChatThreadItem;
  });
}

async function getChatsForUser(currentUserId: string): Promise<ChatThreadItem[]> {
  const chatsOcultos = obtenerSetChatsOcultos(currentUserId);

  const supabaseChats = await obtenerChatsSupabase(currentUserId);
  const chatsLocales = leerChatsLocales()
    .filter((chat) => esParticipanteDelChat(chat, currentUserId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((chat) => pasarChatLocalAChat(chat, currentUserId))
    .filter((chat) => !chatsOcultos.has(chat.id));

  if (!supabaseChats) {
    return marcarChatsConMatch(chatsLocales);
  }

  return marcarChatsConMatch(
    combinarChatsSinDuplicar(supabaseChats, chatsLocales)
      .filter((chat) => !chatsOcultos.has(chat.id))
  );
}

async function getChatById(
  chatId: string,
  currentUserId: string
): Promise<ChatThreadItem | null> {
  if (!esTexto(chatId) || !esTexto(currentUserId)) {
    return null;
  }

  if (isSupabaseConfigured && supabase) {
    const { data: chat, error: chatError } = await supabase
      .from("chats")
      .select("*")
      .eq("id", chatId)
      .maybeSingle();

    if (!chatError && chat) {
      const chatRow = chat as FilaChatSupabase;
      const esOwner = chatRow.propietario_id === currentUserId;
      const otherUser = esOwner
        ? {
            id: chatRow.solicitante_id,
            name: chatRow.nombre_solicitante,
            avatar: chatRow.avatar_solicitante,
          }
        : {
            id: chatRow.propietario_id,
            name: chatRow.nombre_propietario,
            avatar: chatRow.avatar_propietario,
          };

      const { data: messages } = await supabase
        .from("messages")
        .select("*")
        .eq("id_chat", chatId)
        .order("creado_en", { ascending: true });

      return {
        id: chatRow.id,
        book: {
          id: chatRow.libro_id,
          title: chatRow.titulo_libro,
          cover: chatRow.portada_libro,
        },
        otherUser,
        rolActual: esOwner ? "propietario" : "solicitante",
        messages: (messages ?? []).map((message) => {
          const messageRow = message as FilaMensajeSupabase;
          return {
            id: messageRow.id,
            senderId: messageRow.remitente_id,
            senderName: messageRow.nombre_remitente,
            text: messageRow.texto,
            imageUrl: messageRow.imagen_url ?? undefined,
            timestamp: new Date(messageRow.creado_en),
          };
        }),
      };
    }
  }

  const localChat = leerChatsLocales().find((chat) => chat.id === chatId);
  if (!localChat || !esParticipanteDelChat(localChat, currentUserId)) {
    return null;
  }

  return pasarChatLocalAChat(localChat, currentUserId);
}

async function createOrGetChatForBook(
  book: Book,
  currentUser: ChatUserIdentity
): Promise<string> {
  if (book.owner.id === currentUser.id) {
    return "";
  }

  if (isSupabaseConfigured && supabase) {
    const { data: existingChat } = await supabase
      .from("chats")
      .select("id")
      .eq("libro_id", book.id)
      .eq("propietario_id", book.owner.id)
      .eq("solicitante_id", currentUser.id)
      .maybeSingle();

    if (existingChat?.id) {
      limpiarChatPendiente();
      return existingChat.id;
    }
  }

  const localChats = leerChatsLocales();
  const existingLocal = localChats.find(
    (chat) =>
      chat.book.id === book.id &&
      chat.owner.id === book.owner.id &&
      chat.requester.id === currentUser.id
  );

  if (existingLocal) {
    limpiarChatPendiente();
    return existingLocal.id;
  }

  const idPendiente = generarIdChatPendiente(book.id, book.owner.id, currentUser.id);
  guardarChatPendiente({
    id: idPendiente,
    book: {
      id: book.id,
      title: book.title,
      cover: book.cover,
    },
    owner: {
      id: book.owner.id,
      name: book.owner.name,
      avatar: book.owner.avatar,
    },
    requester: currentUser,
    createdAt: new Date().toISOString(),
  });

  return idPendiente;
}

async function materializarChatPendiente(chatId: string): Promise<string> {
  const pendiente = leerChatPendiente();
  if (!pendiente || pendiente.id !== chatId) {
    return chatId;
  }

  if (isSupabaseConfigured && supabase) {
    const { data: insertedChat, error } = await supabase
      .from("chats")
      .insert({
        libro_id: pendiente.book.id,
        titulo_libro: pendiente.book.title,
        portada_libro: pendiente.book.cover,
        propietario_id: pendiente.owner.id,
        nombre_propietario: pendiente.owner.name,
        avatar_propietario: pendiente.owner.avatar,
        solicitante_id: pendiente.requester.id,
        nombre_solicitante: pendiente.requester.name,
        avatar_solicitante: pendiente.requester.avatar,
      })
      .select("id")
      .single();

    if (!error && insertedChat?.id) {
      limpiarChatPendiente(chatId);
      notificarCambioDeChats({ chatId: insertedChat.id, tabla: "chats" });
      return insertedChat.id;
    }
  }

  const localChats = leerChatsLocales();
  const existente = localChats.find(
    (chat) =>
      chat.book.id === pendiente.book.id &&
      chat.owner.id === pendiente.owner.id &&
      chat.requester.id === pendiente.requester.id
  );

  if (existente) {
    limpiarChatPendiente(chatId);
    return existente.id;
  }

  const newLocalChat: ChatLocal = {
    id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    book: pendiente.book,
    owner: pendiente.owner,
    requester: pendiente.requester,
    messages: [],
    createdAt: pendiente.createdAt,
  };

  guardarChatsLocales([newLocalChat, ...localChats]);
  limpiarChatPendiente(chatId);
  notificarCambioDeChats({ chatId: newLocalChat.id, tabla: "local" });
  return newLocalChat.id;
}

async function sendMessageToChat(
  chatId: string,
  text: string,
  imageUrl: string | null,
  sender: ChatUserIdentity
): Promise<string> {
  const content = text.trim();
  const imagen = imageUrl?.trim() || null;

  if (!content && !imagen) {
    return chatId;
  }

  const chatIdReal = esChatPendiente(chatId)
    ? await materializarChatPendiente(chatId)
    : chatId;

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from("messages").insert({
      id_chat: chatIdReal,
      remitente_id: sender.id,
      nombre_remitente: sender.name,
      texto: content,
      imagen_url: imagen,
    });

    if (!error) {
      notificarCambioDeChats({ chatId: chatIdReal, tabla: "messages" });
      return chatIdReal;
    }
  }

  const chats = leerChatsLocales();
  const chatsActualizados = chats.map((chat) => {
    if (chat.id !== chatIdReal) {
      return chat;
    }

    return {
      ...chat,
      messages: [
        ...chat.messages,
        {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          senderId: sender.id,
          senderName: sender.name,
          text: content,
          imageUrl: imagen ?? undefined,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  });

  guardarChatsLocales(chatsActualizados);
  notificarCambioDeChats({ chatId: chatIdReal, tabla: "local" });
  return chatIdReal;
}

async function deleteChatById(chatId: string, currentUserId: string): Promise<DeleteChatResult> {
  if (!esTexto(chatId) || !esTexto(currentUserId)) {
    return { ok: false, canUndo: false };
  }

  if (esChatPendiente(chatId)) {
    limpiarChatPendiente(chatId);
    return { ok: true, canUndo: false };
  }

  ocultarChatParaUsuario(currentUserId, chatId);

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from("chats")
      .delete()
      .eq("id", chatId)
      .or(`propietario_id.eq.${currentUserId},solicitante_id.eq.${currentUserId}`);

    if (!error) {
      return { ok: true, canUndo: false };
    }
  }

  return { ok: true, canUndo: true };
}

function restoreHiddenChatForUser(currentUserId: string, chatId: string): boolean {
  if (!esTexto(currentUserId) || !esTexto(chatId)) {
    return false;
  }

  return mostrarChatParaUsuario(currentUserId, chatId);
}

async function countUnreadChats(currentUserId: string): Promise<number> {
  const chats = await getChatsForUser(currentUserId);
  const lecturas = leerUltimasLecturas();
  const lecturasUsuario = lecturas[currentUserId] ?? {};

  return chats.reduce((acumulado, chat) => {
    const ultimo = chat.messages[chat.messages.length - 1];
    if (!ultimo) {
      return acumulado;
    }

    if (ultimo.senderId === currentUserId) {
      return acumulado;
    }

    const leidoEn = lecturasUsuario[chat.id];
    if (!leidoEn) {
      return acumulado + 1;
    }

    return new Date(ultimo.timestamp).getTime() > new Date(leidoEn).getTime()
      ? acumulado + 1
      : acumulado;
  }, 0);
}

function markChatAsRead(currentUserId: string, chatId: string): void {
  if (!esTexto(currentUserId) || !esTexto(chatId)) {
    return;
  }

  const lecturas = leerUltimasLecturas();
  const lecturasUsuario = lecturas[currentUserId] ?? {};
  lecturas[currentUserId] = {
    ...lecturasUsuario,
    [chatId]: new Date().toISOString(),
  };
  guardarUltimasLecturas(lecturas);
}

function isChatUnreadForUser(currentUserId: string, chat: ChatThreadItem): boolean {
  if (!esTexto(currentUserId)) {
    return false;
  }

  const ultimo = chat.messages[chat.messages.length - 1];
  if (!ultimo || ultimo.senderId === currentUserId) {
    return false;
  }

  const lecturas = leerUltimasLecturas();
  const leidoEn = lecturas[currentUserId]?.[chat.id];

  if (!leidoEn) {
    return true;
  }

  return new Date(ultimo.timestamp).getTime() > new Date(leidoEn).getTime();
}

async function deleteAllChatsForUser(currentUserId: string): Promise<DeleteAllChatsResult> {
  if (!esTexto(currentUserId)) {
    return { ok: false, deletedCount: 0 };
  }

  const chatsActuales = await getChatsForUser(currentUserId);
  const idsChatsActuales = chatsActuales.map((chat) => chat.id);

  // Primero ocultamos para que desaparezcan de UI incluso si falla Supabase.
  ocultarMuchosChatsParaUsuario(currentUserId, idsChatsActuales.filter((id) => !esChatPendiente(id)));

  if (isSupabaseConfigured && supabase) {
    const { data: chatsRemotos, error: errorSelect } = await supabase
      .from("chats")
      .select("id")
      .or(`propietario_id.eq.${currentUserId},solicitante_id.eq.${currentUserId}`);

    if (!errorSelect && chatsRemotos && chatsRemotos.length > 0) {
      const idsRemotos = chatsRemotos
        .map((item) => (item as { id?: string }).id)
        .filter((id): id is string => esTexto(id));

      if (idsRemotos.length > 0) {
        await supabase.from("chats").delete().in("id", idsRemotos);
      }
    }
  }

  const locales = leerChatsLocales();
  const filtrados = locales.filter((chat) => !esParticipanteDelChat(chat, currentUserId));
  if (filtrados.length !== locales.length) {
    guardarChatsLocales(filtrados);
    notificarCambioDeChats();
  }

  const pendiente = leerChatPendiente();
  if (pendiente && (pendiente.owner.id === currentUserId || pendiente.requester.id === currentUserId)) {
    limpiarChatPendiente();
  }

  return { ok: true, deletedCount: idsChatsActuales.length };
}

function obtenerChatPendientePorId(chatId: string, currentUserId: string): ChatThreadItem | null {
  if (!esChatPendiente(chatId)) {
    return null;
  }

  const pendiente = leerChatPendiente();
  if (!pendiente || pendiente.id !== chatId) {
    return null;
  }

  const yoSoyOwner = pendiente.owner.id === currentUserId;
  const otherUser = yoSoyOwner ? pendiente.requester : pendiente.owner;

  return {
    id: pendiente.id,
    book: pendiente.book,
    otherUser,
      rolActual: yoSoyOwner ? "propietario" : "solicitante",
    messages: [],
  };
}

async function subirImagenDeChat(
  archivo: File,
  remitenteId: string
): Promise<string | null> {
  const urlSupabase = await subirImagenASupabase(archivo, "chat-images", remitenteId, "chat");
  if (urlSupabase) {
    return urlSupabase;
  }

  try {
    return await archivoADataUrl(archivo);
  } catch {
    return null;
  }
}

function obtenerChatIdDesdePayload(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const cambio = payload as {
    new?: Record<string, unknown>;
    old?: Record<string, unknown>;
  };

  const chatIdCandidato =
    cambio.new?.id_chat ??
    cambio.old?.id_chat ??
    cambio.new?.id ??
    cambio.old?.id;

  return esTexto(chatIdCandidato) ? chatIdCandidato : undefined;
}

function subscribeToChatChanges(onChange: (detalle?: CambioChats) => void): () => void {
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<CambioChats>;
    onChange(customEvent.detail);
  };

  if (typeof window !== "undefined") {
    window.addEventListener(EVENTO_CHATS_CAMBIADOS, listener);
  }

  if (!isSupabaseConfigured || !supabase) {
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(EVENTO_CHATS_CAMBIADOS, listener);
      }
    };
  }

  const supabaseClient = supabase;

  const channel = supabaseClient
    .channel(`bookmeter-chat-updates-${Math.random().toString(36).slice(2, 8)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "chats" },
      (payload) => {
        const detalle = { chatId: obtenerChatIdDesdePayload(payload), tabla: "chats" as const };
        notificarCambioDeChats(detalle);
        onChange(detalle);
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "messages" },
      (payload) => {
        const detalle = { chatId: obtenerChatIdDesdePayload(payload), tabla: "messages" as const };
        notificarCambioDeChats(detalle);
        onChange(detalle);
      }
    )
    .subscribe();

  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener(EVENTO_CHATS_CAMBIADOS, listener);
    }
    void supabaseClient.removeChannel(channel);
  };
}

export const obtenerChatsDelUsuario = getChatsForUser;
export const obtenerChatDelUsuarioPorId = getChatById;
export const crearOAbrirChatPorLibro = createOrGetChatForBook;
export const enviarMensajeAlChat = sendMessageToChat;
export const subirFotoAlChat = subirImagenDeChat;
export const escucharCambiosDeChat = subscribeToChatChanges;
export const obtenerChatPendiente = obtenerChatPendientePorId;
export const borrarChatPorId = deleteChatById;
export const restaurarChatOculto = restoreHiddenChatForUser;
export const borrarTodosLosChats = deleteAllChatsForUser;
export const contarChatsNoLeidos = countUnreadChats;
export const marcarChatComoLeido = markChatAsRead;
export const esChatNoLeidoParaUsuario = isChatUnreadForUser;

