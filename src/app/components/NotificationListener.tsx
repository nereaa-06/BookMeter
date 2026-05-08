import { useEffect, useMemo, useRef } from "react";
import { currentUser } from "../data/mockData";
import { obtenerUsuarioDeSesion } from "../auth/userProfile";
import { useAuth } from "../auth/AuthProvider";
import { obtenerChatsDelUsuario, escucharCambiosDeChat } from "../data/chatStorage";
import { obtenerTodosLosLibros, suscribirseACambiosDeLibros } from "../data/bookStorage";
import { obtenerRangoBusquedaPredeterminado } from "../data/defaultRangeStorage";
import { registrarDispositivoPush } from "../data/pushNotifications";
import {
  guardarLibrosCercanosNotificados,
  guardarMensajesChatNotificados,
  mostrarNotificacionNavegador,
  obtenerLibrosCercanosNotificados,
  obtenerMensajesChatNotificados,
  obtenerPreferenciasNotificaciones,
} from "../data/notificationStorage";
import { calcularDistanciaKm } from "../lib/geoUtils";

export default function NotificationListener() {
  const { usuario } = useAuth();
  const usuarioActual = useMemo(
    () => (usuario ? obtenerUsuarioDeSesion(usuario, currentUser.location) : null),
    [usuario?.id, usuario?.user_metadata?.full_name, usuario?.user_metadata?.avatar_url]
  );
  const chatInicializadoRef = useRef(false);
  const librosInicializadosRef = useRef(false);
  const pushRegistradoRef = useRef<string | null>(null);

  useEffect(() => {
    chatInicializadoRef.current = false;
    librosInicializadosRef.current = false;
  }, [usuarioActual?.id]);

  useEffect(() => {
    if (!usuarioActual?.id || pushRegistradoRef.current === usuarioActual.id) {
      return;
    }

    const preferencias = obtenerPreferenciasNotificaciones();
    if (!preferencias.browserNotifications) {
      return;
    }

    pushRegistradoRef.current = usuarioActual.id;
    void registrarDispositivoPush(usuarioActual.id);
  }, [usuarioActual?.id]);

  useEffect(() => {
    if (!usuarioActual?.id) {
      return;
    }

    let cancelado = false;

    const revisarChats = async () => {
      const preferencias = obtenerPreferenciasNotificaciones();
      if (!preferencias.chatMessages) {
        return;
      }

      const chats = await obtenerChatsDelUsuario(usuarioActual.id);
      if (cancelado) {
        return;
      }

      const estadoActual = obtenerMensajesChatNotificados();
      const siguienteEstado = { ...estadoActual };
      let cambio = false;

      for (const chat of chats) {
        const ultimo = chat.messages[chat.messages.length - 1];
        const ultimaFecha = ultimo ? ultimo.timestamp.toISOString() : "";

        if (!chatInicializadoRef.current) {
          siguienteEstado[chat.id] = ultimaFecha;
          continue;
        }

        const fechaGuardada = siguienteEstado[chat.id] ?? "";
        if (!ultimo) {
          if (!fechaGuardada) {
            siguienteEstado[chat.id] = "";
            cambio = true;
          }
          continue;
        }

        if (ultimo.senderId !== usuarioActual.id && (!fechaGuardada || new Date(ultimaFecha).getTime() > new Date(fechaGuardada).getTime())) {
          mostrarNotificacionNavegador(
            `Nuevo mensaje de ${chat.otherUser.name}`,
            ultimo.text.trim() || `${chat.book.title} · te ha enviado una imagen`
          );
          siguienteEstado[chat.id] = ultimaFecha;
          cambio = true;
        } else if (!fechaGuardada || new Date(ultimaFecha).getTime() > new Date(fechaGuardada).getTime()) {
          siguienteEstado[chat.id] = ultimaFecha;
          cambio = true;
        }
      }

      if (!chatInicializadoRef.current) {
        chatInicializadoRef.current = true;
      }

      if (cambio || Object.keys(estadoActual).length === 0) {
        guardarMensajesChatNotificados(siguienteEstado);
      }
    };

    const revisarLibrosCercanos = async () => {
      const preferencias = obtenerPreferenciasNotificaciones();
      if (!preferencias.nearbyBooks) {
        return;
      }

      const libros = await obtenerTodosLosLibros();
      if (cancelado) {
        return;
      }

      const rangoKm = obtenerRangoBusquedaPredeterminado();
      const estadoActual = obtenerLibrosCercanosNotificados();
      const siguienteEstado = { ...estadoActual };
      let cambio = false;

      for (const libro of libros) {
        if (libro.owner.id === usuarioActual.id) {
          continue;
        }

        const distancia = calcularDistanciaKm(usuarioActual.location, libro.location);
        if (distancia > rangoKm) {
          continue;
        }

        if (!librosInicializadosRef.current) {
          siguienteEstado[libro.id] = siguienteEstado[libro.id] ?? new Date().toISOString();
          continue;
        }

        if (!siguienteEstado[libro.id]) {
          mostrarNotificacionNavegador(
            `Libro cerca de ti`,
            `${libro.title} · ${distancia} km · ${libro.owner.name}`
          );
          siguienteEstado[libro.id] = new Date().toISOString();
          cambio = true;
        }
      }

      if (!librosInicializadosRef.current) {
        librosInicializadosRef.current = true;
      }

      if (cambio || Object.keys(estadoActual).length === 0) {
        guardarLibrosCercanosNotificados(siguienteEstado);
      }
    };

    const revisarNotificaciones = () => {
      void revisarChats();
      void revisarLibrosCercanos();
    };

    revisarNotificaciones();

    const desuscribirChats = escucharCambiosDeChat(() => {
      revisarNotificaciones();
    });

    const desuscribirLibros = suscribirseACambiosDeLibros(() => {
      revisarNotificaciones();
    });

    const manejarVisibilidad = () => {
      if (!document.hidden) {
        revisarNotificaciones();
      }
    };

    window.addEventListener("focus", revisarNotificaciones);
    document.addEventListener("visibilitychange", manejarVisibilidad);

    return () => {
      cancelado = true;
      desuscribirChats();
      desuscribirLibros();
      window.removeEventListener("focus", revisarNotificaciones);
      document.removeEventListener("visibilitychange", manejarVisibilidad);
    };
  }, [usuarioActual?.id, usuarioActual?.location.lat, usuarioActual?.location.lng, usuarioActual?.name]);

  return null;
}