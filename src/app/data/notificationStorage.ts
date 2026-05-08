const NOTIFICATION_PREFERENCES_KEY = "bookmeter.notifications.preferences";
const NOTIFIED_CHAT_MESSAGES_KEY = "bookmeter.notifications.chatMessages";
const NOTIFIED_NEARBY_BOOKS_KEY = "bookmeter.notifications.nearbyBooks";

export type NotificationPreferences = {
  chatMessages: boolean;
  nearbyBooks: boolean;
  browserNotifications: boolean;
};

type ChatNotificationState = Record<string, string>;

type NearbyBooksNotificationState = Record<string, string>;

const DEFAULT_PREFERENCES: NotificationPreferences = {
  chatMessages: true,
  nearbyBooks: true,
  browserNotifications: false,
};

function leerJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return fallback;
    }

    return parsed as T;
  } catch {
    return fallback;
  }
}

function guardarJson(key: string, value: unknown): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function obtenerPreferenciasNotificaciones(): NotificationPreferences {
  return {
    ...DEFAULT_PREFERENCES,
    ...leerJson<Partial<NotificationPreferences>>(NOTIFICATION_PREFERENCES_KEY, {}),
  };
}

export function guardarPreferenciasNotificaciones(
  preferencias: Partial<NotificationPreferences>
): NotificationPreferences {
  const actuales = obtenerPreferenciasNotificaciones();
  const nuevas = {
    ...actuales,
    ...preferencias,
  };

  guardarJson(NOTIFICATION_PREFERENCES_KEY, nuevas);
  return nuevas;
}

export function notificacionesDelNavegadorDisponibles(): boolean {
  return typeof window !== "undefined" && typeof window.Notification !== "undefined";
}

export async function solicitarPermisoNotificaciones(): Promise<NotificationPermission> {
  if (!notificacionesDelNavegadorDisponibles()) {
    return "denied";
  }

  if (window.Notification.permission === "granted" || window.Notification.permission === "denied") {
    return window.Notification.permission;
  }

  return window.Notification.requestPermission();
}

export function permisoNotificacionesActual(): NotificationPermission {
  if (!notificacionesDelNavegadorDisponibles()) {
    return "denied";
  }

  return window.Notification.permission;
}

export function mostrarNotificacionNavegador(titulo: string, cuerpo: string): void {
  if (!notificacionesDelNavegadorDisponibles()) {
    return;
  }

  if (window.Notification.permission !== "granted") {
    return;
  }

  new window.Notification(titulo, {
    body: cuerpo,
    icon: "/pwa/icon-192.svg",
  });
}

export function obtenerMensajesChatNotificados(): ChatNotificationState {
  return leerJson<ChatNotificationState>(NOTIFIED_CHAT_MESSAGES_KEY, {});
}

export function guardarMensajesChatNotificados(valor: ChatNotificationState): void {
  guardarJson(NOTIFIED_CHAT_MESSAGES_KEY, valor);
}

export function obtenerLibrosCercanosNotificados(): NearbyBooksNotificationState {
  return leerJson<NearbyBooksNotificationState>(NOTIFIED_NEARBY_BOOKS_KEY, {});
}

export function guardarLibrosCercanosNotificados(valor: NearbyBooksNotificationState): void {
  guardarJson(NOTIFIED_NEARBY_BOOKS_KEY, valor);
}
