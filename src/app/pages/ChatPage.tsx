import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { ArrowLeft, Send, MoreVertical, ImagePlus, X } from "lucide-react";
import { currentUser } from "../data/mockData";
import { useAuth } from "../auth/AuthProvider";
import {
  obtenerChatsDelUsuario,
  obtenerChatDelUsuarioPorId,
  enviarMensajeAlChat,
  escucharCambiosDeChat,
  subirFotoAlChat,
  obtenerChatPendiente,
  borrarChatPorId,
  restaurarChatOculto,
  borrarTodosLosChats,
  marcarChatComoLeido,
  esChatNoLeidoParaUsuario,
  type ChatThreadItem,
} from "../data/chatStorage";
import { notificarChatNuevo } from "../data/pushNotifications";
import BookCover from "../components/BookCover";

export default function ChatPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario: usuarioSesion } = useAuth();
  const idUsuarioActual = usuarioSesion?.id ?? currentUser.id;
  const nombreUsuarioActual =
    typeof usuarioSesion?.user_metadata?.full_name === "string" && usuarioSesion.user_metadata.full_name
      ? usuarioSesion.user_metadata.full_name
      : currentUser.name;
  const avatarUsuarioActual = currentUser.avatar;

  const [mensajeTexto, setMensajeTexto] = useState("");
  const [listaChats, setListaChats] = useState<ChatThreadItem[]>([]);
  const [idChatSeleccionado, setIdChatSeleccionado] = useState<string | undefined>(id);
  const [cargandoChats, setCargandoChats] = useState(true);
  const [enviandoMensaje, setEnviandoMensaje] = useState(false);
  const [borrandoChat, setBorrandoChat] = useState(false);
  const [borrandoTodosChats, setBorrandoTodosChats] = useState(false);
  const [archivoImagen, setArchivoImagen] = useState<File | null>(null);
  const [previewImagen, setPreviewImagen] = useState<string | null>(null);
  const [errorImagen, setErrorImagen] = useState("");
  const [avisoPush, setAvisoPush] = useState("");
  const [undoBorradoChat, setUndoBorradoChat] = useState<{ chatId: string; titulo: string } | null>(null);
  const refContenedorMensajes = useRef<HTMLDivElement>(null);
  const intervaloAutoScrollRef = useRef<number | null>(null);
  const chatAutoScrollAplicadoRef = useRef<string | null>(null);
  const inputImagenRef = useRef<HTMLInputElement>(null);
  const timeoutUndoRef = useRef<number | null>(null);

  const chatActual =
    listaChats.find((chat) => chat.id === idChatSeleccionado) ??
    (idChatSeleccionado ? obtenerChatPendiente(idChatSeleccionado, idUsuarioActual) : null);
  const mensajes = chatActual?.messages ?? [];

  const cargarChats = useCallback(async (mostrarPantallaCarga = false) => {
    if (mostrarPantallaCarga) {
      setCargandoChats(true);
    }

    const chats = await obtenerChatsDelUsuario(idUsuarioActual);
    setListaChats(chats);

    const idDestino =
      id && (chats.some((chat) => chat.id === id) || id.startsWith("pending-chat-"))
        ? id
        : undefined;

    setIdChatSeleccionado(idDestino);

    if (mostrarPantallaCarga) {
      setCargandoChats(false);
    }
  }, [idUsuarioActual, id]);

  const sincronizarChatSeleccionado = useCallback(async () => {
    if (!idChatSeleccionado) {
      return;
    }

    const chatActualizado = await obtenerChatDelUsuarioPorId(idChatSeleccionado, idUsuarioActual);

    if (!chatActualizado) {
      setListaChats((anteriores) => anteriores.filter((chat) => chat.id !== idChatSeleccionado));
      return;
    }

    setListaChats((anteriores) => {
      const existe = anteriores.some((chat) => chat.id === chatActualizado.id);

      if (!existe) {
        return [chatActualizado, ...anteriores];
      }

      return anteriores
        .map((chat) => (chat.id === chatActualizado.id ? chatActualizado : chat))
        .sort((a, b) => {
          const tiempoA = a.messages[a.messages.length - 1]?.timestamp?.getTime() ?? 0;
          const tiempoB = b.messages[b.messages.length - 1]?.timestamp?.getTime() ?? 0;
          return tiempoB - tiempoA;
        });
    });
  }, [idChatSeleccionado, idUsuarioActual]);

  const sincronizarChatPorId = useCallback(
    async (chatId?: string) => {
      if (!chatId) {
        return sincronizarChatSeleccionado();
      }

      const chatActualizado = await obtenerChatDelUsuarioPorId(chatId, idUsuarioActual);

      if (!chatActualizado) {
        setListaChats((anteriores) => anteriores.filter((chat) => chat.id !== chatId));
        return;
      }

      setListaChats((anteriores) => {
        const existe = anteriores.some((chat) => chat.id === chatActualizado.id);

        if (!existe) {
          return [chatActualizado, ...anteriores];
        }

        return anteriores
          .map((chat) => (chat.id === chatActualizado.id ? chatActualizado : chat))
          .sort((a, b) => {
            const tiempoA = a.messages[a.messages.length - 1]?.timestamp?.getTime() ?? 0;
            const tiempoB = b.messages[b.messages.length - 1]?.timestamp?.getTime() ?? 0;
            return tiempoB - tiempoA;
          });
      });
    },
    [idUsuarioActual, sincronizarChatSeleccionado]
  );

  const irAlFinalMensajes = (behavior: ScrollBehavior = "smooth") => {
    const contenedor = refContenedorMensajes.current;
    if (!contenedor) {
      return;
    }

    if (behavior === "auto") {
      contenedor.scrollTop = contenedor.scrollHeight;
      return;
    }

    contenedor.scrollTo({
      top: contenedor.scrollHeight,
      behavior,
    });
  };

  useEffect(() => {
    return () => {
      if (previewImagen) {
        URL.revokeObjectURL(previewImagen);
      }

      if (timeoutUndoRef.current !== null) {
        window.clearTimeout(timeoutUndoRef.current);
      }

      if (intervaloAutoScrollRef.current !== null) {
        window.clearInterval(intervaloAutoScrollRef.current);
      }
    };
  }, [previewImagen]);

  useEffect(() => {
    void cargarChats(true);
  }, [cargarChats]);

  useEffect(() => {
    const unsubscribe = escucharCambiosDeChat((detalle) => {
      void sincronizarChatPorId(detalle?.chatId);
    });

    return () => {
      unsubscribe();
    };
  }, [sincronizarChatPorId]);

  useEffect(() => {
    if (id) {
      setIdChatSeleccionado(id);
      chatAutoScrollAplicadoRef.current = null;
    }
  }, [id]);

  useEffect(() => {
    if (!chatActual?.id) {
      return;
    }

    if (chatAutoScrollAplicadoRef.current === chatActual.id) {
      return;
    }

    if (mensajes.length === 0) {
      return;
    }

    let intentos = 0;
    const maxIntentos = 8;

    const intentar = () => {
      irAlFinalMensajes("auto");
      intentos += 1;

      if (intentos >= maxIntentos) {
        chatAutoScrollAplicadoRef.current = chatActual.id;
        if (intervaloAutoScrollRef.current !== null) {
          window.clearInterval(intervaloAutoScrollRef.current);
          intervaloAutoScrollRef.current = null;
        }
      }
    };

    intentar();
    intervaloAutoScrollRef.current = window.setInterval(intentar, 80);

    return () => {
      if (intervaloAutoScrollRef.current !== null) {
        window.clearInterval(intervaloAutoScrollRef.current);
        intervaloAutoScrollRef.current = null;
      }
    };
  }, [chatActual?.id, mensajes.length]);

  useEffect(() => {
    if (!chatActual?.id) {
      return;
    }

    marcarChatComoLeido(idUsuarioActual, chatActual.id);
  }, [chatActual?.id, idUsuarioActual]);

  const enviarMensaje = async () => {
    const texto = mensajeTexto.trim();
    if (!idChatSeleccionado || enviandoMensaje || (!texto && !archivoImagen)) {
      return;
    }

    setEnviandoMensaje(true);
    setErrorImagen("");

    let imageUrlFinal: string | null = null;
    if (archivoImagen) {
      imageUrlFinal = await subirFotoAlChat(archivoImagen, idUsuarioActual);
      if (!imageUrlFinal) {
        setErrorImagen("No se pudo subir la imagen. Intenta con otra foto.");
        setEnviandoMensaje(false);
        return;
      }
    }

    const idTemporal = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    setListaChats((anterior) =>
      anterior.map((chat) => {
        if (chat.id !== idChatSeleccionado) {
          return chat;
        }

        return {
          ...chat,
          messages: [
            ...chat.messages,
            {
              id: idTemporal,
              senderId: idUsuarioActual,
              senderName: nombreUsuarioActual,
              text: texto,
              imageUrl: imageUrlFinal ?? undefined,
              timestamp: new Date(),
            },
          ],
        };
      })
    );

    const frame = window.requestAnimationFrame(() => {
      irAlFinalMensajes("smooth");
    });
    window.setTimeout(() => window.cancelAnimationFrame(frame), 500);

    setMensajeTexto("");
    setArchivoImagen(null);
    if (previewImagen) {
      URL.revokeObjectURL(previewImagen);
    }
    setPreviewImagen(null);
    if (inputImagenRef.current) {
      inputImagenRef.current.value = "";
    }

    const chatIdReal = await enviarMensajeAlChat(idChatSeleccionado, texto, imageUrlFinal, {
      id: idUsuarioActual,
      name: nombreUsuarioActual,
      avatar: avatarUsuarioActual,
    });

    if (chatActual?.otherUser?.id && chatActual?.book?.title) {
      const resultadoPush = await notificarChatNuevo({
        recipientUserId: chatActual.otherUser.id,
        senderName: nombreUsuarioActual,
        bookTitle: chatActual.book.title,
        preview: texto || (imageUrlFinal ? "Imagen" : "Nuevo mensaje"),
      });

      if (!resultadoPush.ok) {
        setAvisoPush(`Mensaje enviado, pero falló la push: ${resultadoPush.error || "error desconocido"}`);
      } else if (resultadoPush.sent === 0) {
        setAvisoPush("Mensaje enviado, pero el otro móvil no tiene push activo todavía.");
      } else {
        setAvisoPush("");
      }
    }

    if (chatIdReal && chatIdReal !== idChatSeleccionado) {
      setIdChatSeleccionado(chatIdReal);
      navigate(`/chat/${chatIdReal}`, { replace: true });
    }

    setEnviandoMensaje(false);
  };

  const borrarChatActual = async () => {
    if (!chatActual || borrandoChat) {
      return;
    }

    const confirmar = window.confirm("¿Quieres borrar este chat? Esta acción no se puede deshacer.");
    if (!confirmar) {
      return;
    }

    setBorrandoChat(true);
    const resultadoBorrado = await borrarChatPorId(chatActual.id, idUsuarioActual);
    setBorrandoChat(false);

    if (!resultadoBorrado.ok) {
      window.alert("No se pudo borrar el chat. Revisa las políticas DELETE en Supabase.");
      return;
    }

    if (resultadoBorrado.canUndo) {
      setUndoBorradoChat({ chatId: chatActual.id, titulo: chatActual.book.title });

      if (timeoutUndoRef.current !== null) {
        window.clearTimeout(timeoutUndoRef.current);
      }

      timeoutUndoRef.current = window.setTimeout(() => {
        setUndoBorradoChat(null);
        timeoutUndoRef.current = null;
      }, 5000);
    } else {
      setUndoBorradoChat(null);
    }

    setListaChats((anteriores) => anteriores.filter((chat) => chat.id !== chatActual.id));
    setIdChatSeleccionado(undefined);
    navigate("/chat", { replace: true });
  };

  const deshacerBorradoChat = async () => {
    if (!undoBorradoChat) {
      return;
    }

    const restaurado = restaurarChatOculto(idUsuarioActual, undoBorradoChat.chatId);
    if (restaurado) {
      await cargarChats(false);
    }

    if (timeoutUndoRef.current !== null) {
      window.clearTimeout(timeoutUndoRef.current);
      timeoutUndoRef.current = null;
    }

    setUndoBorradoChat(null);
  };

  const borrarTodos = async () => {
    if (borrandoTodosChats || listaChats.length === 0) {
      return;
    }

    const confirmar = window.confirm(
      "¿Seguro que quieres borrar todos tus chats? Esta acción no se puede deshacer."
    );

    if (!confirmar) {
      return;
    }

    setBorrandoTodosChats(true);
    const resultado = await borrarTodosLosChats(idUsuarioActual);
    setBorrandoTodosChats(false);

    if (!resultado.ok) {
      window.alert("No se pudieron borrar tus chats. Inténtalo de nuevo.");
      return;
    }

    if (timeoutUndoRef.current !== null) {
      window.clearTimeout(timeoutUndoRef.current);
      timeoutUndoRef.current = null;
    }

    setUndoBorradoChat(null);
    setListaChats([]);
    setIdChatSeleccionado(undefined);
    navigate("/chat", { replace: true });
  };

  const seleccionarImagen = (archivo: File | null) => {
    if (!archivo) {
      return;
    }

    if (previewImagen) {
      URL.revokeObjectURL(previewImagen);
    }

    setArchivoImagen(archivo);
    setPreviewImagen(URL.createObjectURL(archivo));
    setErrorImagen("");
  };

  const quitarImagen = () => {
    setArchivoImagen(null);
    if (previewImagen) {
      URL.revokeObjectURL(previewImagen);
    }
    setPreviewImagen(null);
    if (inputImagenRef.current) {
      inputImagenRef.current.value = "";
    }
  };

  const formatearHora = (date: Date) => {
    return new Intl.DateTimeFormat("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const obtenerResumenMensaje = (chat: ChatThreadItem): string => {
    const ultimoMensaje = chat.messages[chat.messages.length - 1];
    if (!ultimoMensaje) {
      return "Sin mensajes todavía";
    }

    if (ultimoMensaje.imageUrl && !ultimoMensaje.text) {
      return "Imagen";
    }

    if (ultimoMensaje.imageUrl && ultimoMensaje.text) {
      return `Imagen · ${ultimoMensaje.text}`;
    }

    return ultimoMensaje.text;
  };

  const volverAtrasEnChat = () => {
    navigate("/chat", { replace: true });
  };

  if (cargandoChats) {
    return (
      <div className="flex-1 flex items-center justify-center pb-16">
        <div className="text-muted-foreground">Cargando chats...</div>
      </div>
    );
  }

  if (!chatActual && idChatSeleccionado) {
    return (
      <div className="flex-1 flex items-center justify-center pb-16 px-6 page-enter">
        <div className="text-center space-y-2">
          <div className="text-foreground">Abriendo chat...</div>
          <div className="text-sm text-muted-foreground">Espera un momento</div>
        </div>
      </div>
    );
  }

  if (listaChats.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center pb-16 px-6 page-enter">
        <div className="text-center">
          <h3 className="text-foreground mb-2">Aún no tienes chats</h3>
          <p className="text-muted-foreground mb-4">
            Solicita un intercambio desde la ficha de un libro para iniciar conversación.
          </p>
          <button
            onClick={() => navigate("/")}
            className="text-primary hover:underline"
          >
            Ir al mapa
          </button>
        </div>
      </div>
    );
  }

  if (!chatActual) {
    return (
      <div className="flex-1 flex flex-col pb-16 bg-background">
        <header className="bg-gradient-to-r from-secondary to-primary shadow-md px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-white">Chats</h2>
            <button
              onClick={() => {
                void borrarTodos();
              }}
              disabled={borrandoTodosChats || listaChats.length === 0}
              className="h-8 px-3 rounded-lg text-xs border border-white/35 text-white hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              {borrandoTodosChats ? "Borrando..." : "Borrar todos"}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-gradient-to-b from-transparent to-accent/20">
          {listaChats.map((chatItem) => (
            <button
              key={chatItem.id}
              onClick={() => {
                setIdChatSeleccionado(chatItem.id);
                navigate(`/chat/${chatItem.id}`);
              }}
              className={`w-full p-3 rounded-2xl transition-all hover:bg-accent/90 bg-card border shadow-sm hover:shadow-md ${
                esChatNoLeidoParaUsuario(idUsuarioActual, chatItem)
                  ? "border-primary/40 bg-primary/5"
                  : "border-border"
              }`}
            >
              <div className="flex items-start gap-2 text-left">
                <BookCover
                  src={chatItem.book.cover}
                  alt={chatItem.book.title}
                  className="w-10 h-14 object-cover"
                  containerClassName="w-10 h-14 rounded-md shadow-sm shrink-0"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs truncate ${esChatNoLeidoParaUsuario(idUsuarioActual, chatItem) ? "text-foreground font-semibold" : "text-foreground"}`}>
                      {chatItem.otherUser.name}
                    </p>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {chatItem.messages.length > 0
                        ? formatearHora(chatItem.messages[chatItem.messages.length - 1].timestamp)
                        : ""}
                    </span>
                  </div>
                  <p className={`text-[11px] truncate ${esChatNoLeidoParaUsuario(idUsuarioActual, chatItem) ? "text-secondary font-semibold" : "text-secondary/80"}`}>
                    {chatItem.book.title}
                  </p>
                  <p className={`text-[10px] truncate mt-0.5 ${esChatNoLeidoParaUsuario(idUsuarioActual, chatItem) ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                    {obtenerResumenMensaje(chatItem)}
                  </p>
                  {chatItem.tieneMatch && (
                    <span className="inline-flex mt-1 text-[10px] px-1.5 py-0.5 rounded-md bg-primary/15 text-primary">
                      Match
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {undoBorradoChat && (
          <div className="fixed left-3 right-3 bottom-20 z-[1200]">
            <div className="bg-secondary text-white rounded-xl px-4 py-3 shadow-xl flex items-center justify-between gap-3">
              <p className="text-sm truncate">Chat borrado: {undoBorradoChat.titulo}</p>
              <button
                onClick={() => {
                  void deshacerBorradoChat();
                }}
                className="text-sm px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
              >
                Deshacer
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100dvh-4rem)] overflow-hidden bg-background page-enter">
      <header className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-r from-secondary to-primary shadow-md px-4 py-3 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <div className="flex items-center gap-3">
          <button
            onClick={volverAtrasEnChat}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <BookCover
            src={chatActual.book.cover}
            alt={chatActual.book.title}
            className="w-10 h-14 object-cover"
            containerClassName="w-10 h-14 rounded shadow-sm"
          />

          <div className="flex-1 min-w-0">
            <h3 className="text-white truncate">{chatActual.book.title}</h3>
            <Link
              to={`/profile/${chatActual.otherUser.id}`}
              state={{ user: chatActual.otherUser }}
              className="text-sm text-white/80 hover:text-white truncate block"
            >
              {chatActual.otherUser.name}
            </Link>
          </div>

          <button
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white disabled:opacity-60"
            onClick={() => {
              void borrarChatActual();
            }}
            disabled={borrandoChat}
            aria-label="Borrar chat"
            title={borrandoChat ? "Borrando chat..." : "Borrar chat"}
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div
        ref={refContenedorMensajes}
        className="absolute left-0 right-0 overflow-y-auto px-4 py-5 space-y-4 bg-gradient-to-b from-transparent via-accent/10 to-accent/20"
        style={{
          top: "calc(5.25rem + env(safe-area-inset-top))",
          bottom: "calc(5.25rem + env(safe-area-inset-bottom))",
          WebkitOverflowScrolling: "touch",
          touchAction: "auto",
        }}
      >
        {mensajes.map((msg) => {
          const esMio = msg.senderId === idUsuarioActual;
          return (
            <div
              key={msg.id}
              className={`flex ${esMio ? "justify-end" : "justify-start"}`}
            >
              <div className={`flex gap-2 max-w-[75%] ${esMio ? "flex-row-reverse" : "flex-row"}`}>
                {!esMio && (
                  <img
                    src={chatActual.otherUser.avatar}
                    alt={chatActual.otherUser.name}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  />
                )}
                <div>
                  <div
                    className={`px-4 py-2.5 rounded-2xl shadow-sm border ${
                      esMio
                        ? "bg-primary text-primary-foreground border-primary/60 rounded-br-md"
                        : "bg-card text-foreground border-border rounded-bl-md"
                    }`}
                  >
                    {msg.imageUrl && (
                      <img
                        src={msg.imageUrl}
                        alt="Imagen enviada"
                        className="w-44 max-w-full rounded-lg mb-2 object-cover"
                      />
                    )}
                    {msg.text && <p className="text-sm leading-relaxed">{msg.text}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground mt-1 block px-2">
                    {formatearHora(msg.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="absolute left-0 right-0 bottom-0 z-20 px-4 py-3 bg-card/95 border-t border-border pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
        {previewImagen && (
          <div className="mb-3 relative w-28 rounded-xl p-1 bg-accent/60 border border-border">
            <img
              src={previewImagen}
              alt="Vista previa"
              className="w-28 h-28 object-cover rounded-lg border border-border"
            />
            <button
              onClick={quitarImagen}
              className="absolute -top-2 -right-2 bg-card border border-border rounded-full p-1 hover:bg-accent transition-colors"
              aria-label="Quitar imagen"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {errorImagen && <p className="text-xs text-destructive mb-2">{errorImagen}</p>}
        {avisoPush && <p className="text-xs text-amber-700 mb-2">{avisoPush}</p>}

        <div className="flex gap-2">
          <input
            ref={inputImagenRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => seleccionarImagen(e.target.files?.[0] ?? null)}
          />
          <button
            onClick={() => inputImagenRef.current?.click()}
            className="p-3 border border-border rounded-full bg-white hover:bg-accent transition-colors shadow-sm"
            aria-label="Adjuntar imagen"
          >
            <ImagePlus className="w-5 h-5" />
          </button>
          <input
            type="text"
            placeholder="Escribe un mensaje..."
            value={mensajeTexto}
            onChange={(e) => setMensajeTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void enviarMensaje()}
            className="flex-1 px-4 py-2.5 bg-white border border-border rounded-full outline-none focus:ring-2 focus:ring-primary/25 shadow-sm"
          />
          <button
            onClick={() => {
              void enviarMensaje();
            }}
            disabled={(!mensajeTexto.trim() && !archivoImagen) || enviandoMensaje}
            className="p-3 bg-primary text-primary-foreground rounded-full hover:opacity-90 hover:shadow-lg transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>

      {undoBorradoChat && (
        <div className="fixed left-3 right-3 bottom-20 z-[1200]">
          <div className="bg-secondary text-white rounded-xl px-4 py-3 shadow-xl flex items-center justify-between gap-3">
            <p className="text-sm truncate">Chat borrado: {undoBorradoChat.titulo}</p>
            <button
              onClick={() => {
                void deshacerBorradoChat();
              }}
              className="text-sm px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
            >
              Deshacer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
