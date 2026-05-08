import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router";
import { ArrowLeft, Star, MapPin, Settings, Palette, Heart } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { currentUser } from "../data/mockData";
import type { Book, User as BookMeterUser } from "../data/mockData";
import { obtenerTodosLosLibros, obtenerBibliotecaDelUsuario, eliminarLibroSubido } from "../data/bookStorage";
import BookCover from "../components/BookCover";
import { useAuth } from "../auth/AuthProvider";
import { obtenerUsuarioDeSesion } from "../auth/userProfile";
import { supabase } from "../../lib/supabase";
import { leerEstadoMapaGuardado, guardarEstadoMapa } from "../data/mapStateStorage";
import { obtenerCiudadDeUbicacion } from "../data/locationLookup";
import { obtenerChatsDelUsuario } from "../data/chatStorage";
import { subirImagenASupabase, archivoADataUrl } from "../data/imageStorage";
import { guardarPerfilPublico, obtenerPerfilPublico } from "../data/publicProfileStorage";
import {
  guardarRangoBusquedaPredeterminado,
  obtenerRangoBusquedaPredeterminado,
} from "../data/defaultRangeStorage";
import {
  aplicarTemaColor,
  obtenerTemaColorGuardado,
  type TemaColor,
} from "../data/themeStorage";
import {
  alternarFavorito,
  obtenerFavoritosUsuario,
  suscribirseACambiosDeFavoritos,
} from "../data/favoritesStorage";
import {
  guardarPreferenciasNotificaciones,
  obtenerPreferenciasNotificaciones,
  solicitarPermisoNotificaciones,
  type NotificationPreferences,
} from "../data/notificationStorage";
import { registrarDispositivoPush } from "../data/pushNotifications";
import {
  guardarValoracionUsuario,
  obtenerResumenValoracionesUsuario,
  obtenerValoracionDeUsuarioSobreOtro,
  type ResumenValoracion,
} from "../data/ratingStorage";

type PerfilNavegado = {
  user?: Partial<BookMeterUser> & { id: string };
};

type ItemGoogleBooks = {
  volumeInfo?: {
    title?: string;
    authors?: string[];
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
  };
};

type PreferenciaLibro = {
  title: string;
  author: string;
  cover: string;
};

function normalizarUrlPortada(url?: string): string {
  if (!url) {
    return "";
  }

  return url.replace(/^http:\/\//i, "https://");
}

function convertirAUsuarioPerfil(usuario: Partial<BookMeterUser> & { id: string }): BookMeterUser {
  return {
    id: usuario.id,
    name: usuario.name ?? "Usuario",
    avatar: usuario.avatar ?? currentUser.avatar,
    rating: typeof usuario.rating === "number" ? usuario.rating : 0,
    totalRatings: typeof usuario.totalRatings === "number" ? usuario.totalRatings : 0,
    location: usuario.location ?? currentUser.location,
  };
}

function convertirTextoALista(texto: string): string[] {
  return texto
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export default function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario: usuarioSesion, cerrarSesion, actualizarCorreo } = useAuth();
  const [librosUsuario, setLibrosUsuario] = useState<Book[]>([]);
  const [todosLosLibros, setTodosLosLibros] = useState<Book[]>([]);
  const [cargandoLibros, setCargandoLibros] = useState(true);
  const [borrandoCuenta, setBorrandoCuenta] = useState(false);
  const [eliminandoLibroId, setEliminandoLibroId] = useState<string | null>(null);
  const [resumenValoraciones, setResumenValoraciones] = useState<ResumenValoracion>({ media: 0, total: 0 });
  const [miValoracion, setMiValoracion] = useState<number>(0);
  const [guardandoValoracion, setGuardandoValoracion] = useState(false);
  const [actualizandoUbicacion, setActualizandoUbicacion] = useState(false);
  const [ciudadUbicacion, setCiudadUbicacion] = useState("Ubicación no disponible");
  const [subiendoAvatar, setSubiendoAvatar] = useState(false);
  const [cerrandoSesionPerfil, setCerrandoSesionPerfil] = useState(false);
  const [intercambiosCompletados, setIntercambiosCompletados] = useState(0);
  const [respuestaMediaMin, setRespuestaMediaMin] = useState<number | null>(null);
  const [actividadReciente, setActividadReciente] = useState<string[]>([]);
  const [avatarTemporal, setAvatarTemporal] = useState<string | null>(null);
  const [sobreUsuarioTexto, setSobreUsuarioTexto] = useState("");
  const [buscaLibrosTexto, setBuscaLibrosTexto] = useState("");
  const [perfilHidratado, setPerfilHidratado] = useState(false);
  const [guardandoSobreUsuario, setGuardandoSobreUsuario] = useState(false);
  const [descripcionGuardada, setDescripcionGuardada] = useState(false);
  const [busquedaPreferencias, setBusquedaPreferencias] = useState("");
  const [resultadosPreferencias, setResultadosPreferencias] = useState<PreferenciaLibro[]>([]);
  const [buscandoPreferencias, setBuscandoPreferencias] = useState(false);
  const [errorPreferencias, setErrorPreferencias] = useState("");
  const [rangoBusquedaPredeterminado, setRangoBusquedaPredeterminado] = useState(10);
  const [temaColorActual, setTemaColorActual] = useState<TemaColor>("moderno");
  const [mostrarSelectorTema, setMostrarSelectorTema] = useState(false);
  const [favoritosVersion, setFavoritosVersion] = useState(0);
  
  const [preferenciasNotificaciones, setPreferenciasNotificaciones] = useState<NotificationPreferences>(
    obtenerPreferenciasNotificaciones()
  );
  const [mensajePush, setMensajePush] = useState("");
  const [habilitandoPush, setHabilitandoPush] = useState(false);
  const inputAvatarRef = useRef<HTMLInputElement>(null);
  const timeoutDescripcionGuardadaRef = useRef<number | null>(null);

  const esUsuarioActual = id === "current-user";
  const usuarioSesionMostrado = useMemo(
    () => (usuarioSesion ? obtenerUsuarioDeSesion(usuarioSesion, currentUser.location) : currentUser),
    [usuarioSesion?.id, usuarioSesion?.user_metadata?.full_name, usuarioSesion?.user_metadata?.avatar_url]
  );
  const usuarioNavegado = (location.state as PerfilNavegado | null)?.user;
  const [usuarioPerfil, setUsuarioPerfil] = useState<BookMeterUser | null>(esUsuarioActual ? usuarioSesionMostrado : null);
  const [resolviendoUsuario, setResolviendoUsuario] = useState(!esUsuarioActual);
  const usuario = esUsuarioActual ? usuarioSesionMostrado : usuarioPerfil;
  const idUsuarioPerfil = usuario?.id ?? "";
  const preferenciasLibros = useMemo(() => convertirTextoALista(buscaLibrosTexto), [buscaLibrosTexto]);

  const avanzarRangoPredeterminado = () => {
    const pasosDisponibles = [10, 25, 50, 75, 100];
    const indiceActual = pasosDisponibles.indexOf(rangoBusquedaPredeterminado);
    const siguienteIndice = indiceActual >= 0 ? (indiceActual + 1) % pasosDisponibles.length : 0;
    const siguienteRango = pasosDisponibles[siguienteIndice];

    setRangoBusquedaPredeterminado(siguienteRango);
    guardarRangoBusquedaPredeterminado(siguienteRango);
  };

  useEffect(() => {
    setRangoBusquedaPredeterminado(obtenerRangoBusquedaPredeterminado());
    setTemaColorActual(obtenerTemaColorGuardado());
    setPreferenciasNotificaciones(obtenerPreferenciasNotificaciones());
  }, []);

  

  useEffect(() => {
    const desuscribir = suscribirseACambiosDeFavoritos(() => {
      setFavoritosVersion((valorActual) => valorActual + 1);
    });

    return () => {
      desuscribir();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutDescripcionGuardadaRef.current !== null) {
        window.clearTimeout(timeoutDescripcionGuardadaRef.current);
      }
    };
  }, []);

  const seleccionarTema = (tema: TemaColor) => {
    setTemaColorActual(tema);
    aplicarTemaColor(tema);
    setMostrarSelectorTema(false);
  };

  const actualizarPreferenciasNotificaciones = (cambios: Partial<NotificationPreferences>) => {
    const nuevas = guardarPreferenciasNotificaciones(cambios);
    setPreferenciasNotificaciones(nuevas);
  };

  const habilitarNotificacionesPush = async () => {
    setHabilitandoPush(true);
    setMensajePush("");

    try {
      // En mobile (Capacitor), registrar directamente sin pedir permisos del navegador
      if (Capacitor.isNativePlatform()) {
        if (usuarioSesion?.id) {
          const resultado = await registrarDispositivoPush(usuarioSesion.id);
          console.log("Resultado registro push nativo:", resultado);

          if (resultado.ok) {
            actualizarPreferenciasNotificaciones({ browserNotifications: true });
            setMensajePush("✓ Notificaciones push activadas correctamente");
          } else {
            setMensajePush(`Error: ${resultado.error}`);
          }
        } else {
          setMensajePush("⚠ No se encontró ID de usuario");
        }
      } else {
        // En web, pedir permisos del navegador
        const permiso = await solicitarPermisoNotificaciones();
        console.log("Permiso de notificaciones web:", permiso);

        if (permiso === "granted") {
          actualizarPreferenciasNotificaciones({ browserNotifications: true });
          setMensajePush("✓ Notificaciones activadas correctamente");
        } else if (permiso === "denied") {
          setMensajePush("❌ Permisos denegados. Habilítalos en configuración del navegador.");
        } else {
          setMensajePush(`⚠ Estado de permisos: ${permiso}`);
        }
      }
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : "Error al habilitar notificaciones";
      console.error("Error:", error);
      setMensajePush(mensaje);
    } finally {
      setHabilitandoPush(false);
    }
  };

  const favoritosIds = useMemo(() => {
    if (!esUsuarioActual) {
      return new Set<string>();
    }

    void favoritosVersion;
    return new Set(obtenerFavoritosUsuario(usuarioSesionMostrado.id));
  }, [esUsuarioActual, favoritosVersion, usuarioSesionMostrado.id]);

  const librosFavoritos = useMemo(() => {
    return todosLosLibros.filter((book) => favoritosIds.has(book.id));
  }, [favoritosIds, todosLosLibros]);

  const alternarFavoritoLibro = (bookId: string) => {
    alternarFavorito(usuarioSesionMostrado.id, bookId);
    setFavoritosVersion((valorActual) => valorActual + 1);
  };

  

  const buscarPreferenciasGoogleBooks = async () => {
    const query = busquedaPreferencias.trim();
    if (!query) {
      return;
    }

    setBuscandoPreferencias(true);
    setErrorPreferencias("");

    try {
      const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY || "";
      const keyParam = apiKey ? `&key=${apiKey}` : "";
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=8${keyParam}`;
      
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("error-google-books");
      }

      const data = await response.json();
      const items = Array.isArray(data?.items) ? (data.items as ItemGoogleBooks[]) : [];

      const encontrados = items
        .map((item) => {
          const title = item.volumeInfo?.title?.trim() ?? "";
          if (!title) {
            return null;
          }

          const author = Array.isArray(item.volumeInfo?.authors) && item.volumeInfo?.authors.length > 0
            ? item.volumeInfo?.authors.join(", ")
            : "Autor desconocido";

          return {
            title,
            author,
            cover:
              normalizarUrlPortada(item.volumeInfo?.imageLinks?.thumbnail) ||
              normalizarUrlPortada(item.volumeInfo?.imageLinks?.smallThumbnail) ||
              "https://placehold.co/72x108/EDE7DD/6B6962?text=Libro",
          };
        })
        .filter((item): item is PreferenciaLibro => Boolean(item));

      setResultadosPreferencias(encontrados);
      if (encontrados.length === 0) {
        setErrorPreferencias("No encontramos libros para esa búsqueda.");
      }
    } catch {
      setResultadosPreferencias([]);
      setErrorPreferencias("No se pudo buscar en Google Books. Inténtalo de nuevo.");
    } finally {
      setBuscandoPreferencias(false);
    }
  };

  const agregarPreferenciaLibro = (titulo: string) => {
    const limpio = titulo.trim();
    if (!limpio) {
      return;
    }

    if (preferenciasLibros.some((item) => item.toLowerCase() === limpio.toLowerCase())) {
      return;
    }

    setBuscaLibrosTexto((anterior) => {
      const actuales = convertirTextoALista(anterior);
      return [...actuales, limpio].join("\n");
    });
    setBusquedaPreferencias("");
    setResultadosPreferencias([]);
    setErrorPreferencias("");
  };

  const quitarPreferenciaLibro = (titulo: string) => {
    setBuscaLibrosTexto((anterior) => {
      const actuales = convertirTextoALista(anterior);
      return actuales.filter((item) => item !== titulo).join("\n");
    });
  };

  useEffect(() => {
    if (esUsuarioActual) {
      setPerfilHidratado(false);
      setUsuarioPerfil(usuarioSesionMostrado);
      if (usuarioSesionMostrado.id) {
        void obtenerPerfilPublico(usuarioSesionMostrado.id).then((perfilPublico) => {
          setSobreUsuarioTexto(perfilPublico?.sobreUsuario ?? usuarioSesionMostrado.about ?? "");
          setBuscaLibrosTexto(perfilPublico?.buscaLibros ?? "");

          if (perfilPublico?.ciudad) {
            setCiudadUbicacion(perfilPublico.ciudad);
          }

          setPerfilHidratado(true);
        });
      } else {
        setPerfilHidratado(true);
      }
      setResolviendoUsuario(false);
      return;
    }

    setPerfilHidratado(false);

    let activa = true;

    const resolverUsuario = async () => {
      setResolviendoUsuario(true);

      if (id) {
        const perfilPublico = await obtenerPerfilPublico(id);
        if (perfilPublico) {
          if (activa) {
            setUsuarioPerfil(perfilPublico.usuario);
            setSobreUsuarioTexto(perfilPublico.sobreUsuario ?? perfilPublico.usuario.about ?? "");
            setBuscaLibrosTexto(perfilPublico.buscaLibros ?? "");
            if (perfilPublico.ciudad) {
              setCiudadUbicacion(perfilPublico.ciudad);
            }
            setResolviendoUsuario(false);
          }
          return;
        }
      }

      if (usuarioNavegado?.id === id && usuarioNavegado) {
        if (activa) {
          setUsuarioPerfil(convertirAUsuarioPerfil(usuarioNavegado));
          setResolviendoUsuario(false);
        }
        return;
      }

      const libros = await obtenerTodosLosLibros();
      const libroCoincidente = libros.find((book) => book.owner.id === id);

      if (libroCoincidente) {
        if (activa) {
          setUsuarioPerfil(libroCoincidente.owner);
          setResolviendoUsuario(false);
        }
        return;
      }

      const chats = await obtenerChatsDelUsuario(usuarioSesionMostrado.id);
      const chatCoincidente = chats.find((chat) => chat.otherUser.id === id);

      if (chatCoincidente) {
        const resumenValoracion = await obtenerResumenValoracionesUsuario(chatCoincidente.otherUser.id);
        const librosDelUsuario = libros.filter((book) => book.owner.id === chatCoincidente.otherUser.id);
        const locationDelLibro = librosDelUsuario[0]?.location ?? currentUser.location;

        if (activa) {
          setUsuarioPerfil({
            id: chatCoincidente.otherUser.id,
            name: chatCoincidente.otherUser.name,
            avatar: chatCoincidente.otherUser.avatar,
            rating: resumenValoracion.total > 0 ? resumenValoracion.media : 0,
            totalRatings: resumenValoracion.total,
            location: locationDelLibro,
          });
          setResolviendoUsuario(false);
        }
        return;
      }

      if (activa) {
        setUsuarioPerfil(null);
        setResolviendoUsuario(false);
      }
    };

    void resolverUsuario();

    return () => {
      activa = false;
    };
  }, [esUsuarioActual, id, usuarioNavegado, usuarioSesionMostrado.id, usuarioSesionMostrado.name]);

  useEffect(() => {
    if (!usuario) {
      setResumenValoraciones({ media: 0, total: 0 });
      setMiValoracion(0);
      return;
    }

    let activa = true;

    const cargarValoraciones = async () => {
      const resumen = await obtenerResumenValoracionesUsuario(usuario.id);
      if (activa) {
        setResumenValoraciones(resumen);
      }

      if (usuarioSesion?.id && usuarioSesion.id !== usuario.id) {
        const valoracionHecha = await obtenerValoracionDeUsuarioSobreOtro(usuarioSesion.id, usuario.id);
        if (activa) {
          setMiValoracion(valoracionHecha ?? 0);
        }
      } else if (activa) {
        setMiValoracion(0);
      }
    };

    void cargarValoraciones();

    return () => {
      activa = false;
    };
  }, [usuario, usuarioSesion?.id]);

  useEffect(() => {
    if (!usuario) {
      setSobreUsuarioTexto("");
      setBuscaLibrosTexto("");
      setPerfilHidratado(false);
      return;
    }

    if (!esUsuarioActual && !sobreUsuarioTexto) {
      setSobreUsuarioTexto(usuario.about ?? "");
    }
  }, [esUsuarioActual, sobreUsuarioTexto, usuario?.about, usuario?.id]);

  useEffect(() => {
    if (!usuario) {
      return;
    }

    let activa = true;

    const posicion = esUsuarioActual
      ? leerEstadoMapaGuardado()?.posicionUsuario ?? usuario.location
      : usuario.location;

    const cargarCiudad = async () => {
      if (!esUsuarioActual && id) {
        const perfilPublico = await obtenerPerfilPublico(id);
        if (activa && perfilPublico?.ciudad) {
          setCiudadUbicacion(perfilPublico.ciudad);
          return;
        }
      }

      const ciudad = await obtenerCiudadDeUbicacion(posicion);
      if (activa) {
        setCiudadUbicacion(ciudad);
      }

      if (esUsuarioActual && usuarioSesion?.id && perfilHidratado) {
        void guardarPerfilPublico({
          usuarioId: usuarioSesion.id,
          nombre: usuario.name,
          avatarUrl: avatarTemporal ?? usuario.avatar,
          ciudad,
          sobreUsuario: sobreUsuarioTexto,
          buscaLibros: buscaLibrosTexto,
          ubicacion: {
            lat: posicion.lat,
            lng: posicion.lng,
          },
        });
      }
    };

    void cargarCiudad();

    return () => {
      activa = false;
    };
  }, [avatarTemporal, buscaLibrosTexto, esUsuarioActual, id, perfilHidratado, sobreUsuarioTexto, usuario, usuarioSesion?.id]);

  useEffect(() => {
    if (!esUsuarioActual || !usuarioSesion?.id || !usuario || !perfilHidratado) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void guardarPerfilPublico({
        usuarioId: usuarioSesion.id,
        nombre: usuario.name,
        avatarUrl: avatarTemporal ?? usuario.avatar,
        ciudad: ciudadUbicacion,
        sobreUsuario: sobreUsuarioTexto,
        buscaLibros: buscaLibrosTexto,
        ubicacion: {
          lat: usuario.location.lat,
          lng: usuario.location.lng,
        },
      });
    }, 700);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    avatarTemporal,
    buscaLibrosTexto,
    ciudadUbicacion,
    esUsuarioActual,
    perfilHidratado,
    sobreUsuarioTexto,
    usuario,
    usuarioSesion?.id,
  ]);

  useEffect(() => {
    let isMounted = true;

    const cargarLibros = async () => {
      if (!usuario) {
        if (isMounted) {
          setLibrosUsuario([]);
          setTodosLosLibros([]);
          setCargandoLibros(false);
        }
        return;
      }

      setCargandoLibros(true);

      if (esUsuarioActual) {
        const libros = await obtenerBibliotecaDelUsuario(usuarioSesionMostrado.id);
        if (isMounted) {
          setLibrosUsuario(libros);
          const librosTotales = await obtenerTodosLosLibros();
          if (isMounted) {
            setTodosLosLibros(librosTotales);
          }
          setCargandoLibros(false);
        }
        return;
      }

      const libros = await obtenerTodosLosLibros();
      if (isMounted) {
        setLibrosUsuario(libros.filter((book) => book.owner.id === usuario.id));
        setTodosLosLibros(libros);
        setCargandoLibros(false);
      }
    };

    void cargarLibros();

    return () => {
      isMounted = false;
    };
  }, [usuarioSesionMostrado.id, esUsuarioActual, usuario]);

  useEffect(() => {
    if (!esUsuarioActual || !usuarioSesionMostrado.id) {
      return;
    }

    let activa = true;

    const calcularEstadisticas = async () => {
      const completados = librosUsuario.filter((libro) => libro.status === "intercambiado").length;

      const chats = await obtenerChatsDelUsuario(usuarioSesionMostrado.id);
      const diferencias: number[] = [];

      chats.forEach((chat) => {
        for (let i = 0; i < chat.messages.length - 1; i += 1) {
          const mensajeActual = chat.messages[i];
          const siguiente = chat.messages[i + 1];

          if (mensajeActual.senderId !== usuarioSesionMostrado.id && siguiente.senderId === usuarioSesionMostrado.id) {
            const diferenciaMin = (siguiente.timestamp.getTime() - mensajeActual.timestamp.getTime()) / 60000;
            if (Number.isFinite(diferenciaMin) && diferenciaMin >= 0) {
              diferencias.push(diferenciaMin);
            }
          }
        }
      });

      const media = diferencias.length > 0
        ? Math.round((diferencias.reduce((acc, valor) => acc + valor, 0) / diferencias.length) * 10) / 10
        : null;

      const actividadChats = chats
        .filter((chat) => chat.messages.length > 0)
        .slice(0, 3)
        .map((chat) => {
          const ultimo = chat.messages[chat.messages.length - 1];
          const resumen = ultimo.text ? ultimo.text.slice(0, 28) : "Imagen";
          return `Chat con ${chat.otherUser.name}: ${resumen}`;
        });

      const actividadLibros = librosUsuario
        .slice(0, 2)
        .map((libro) => `Libro: ${libro.title} (${libro.status})`);

      if (activa) {
        setIntercambiosCompletados(completados);
        setRespuestaMediaMin(media);
        setActividadReciente([...actividadLibros, ...actividadChats].slice(0, 4));
      }
    };

    void calcularEstadisticas();

    return () => {
      activa = false;
    };
  }, [esUsuarioActual, librosUsuario, usuarioSesionMostrado.id]);

  if (resolviendoUsuario) {
    return (
      <div className="flex-1 flex items-center justify-center pb-16">
        <div className="text-muted-foreground">Cargando perfil...</div>
      </div>
    );
  }

  if (!usuario) {
    return (
      <div className="flex-1 flex items-center justify-center pb-16">
        <div className="text-center">
          <h3 className="text-foreground mb-2">Usuario no encontrado</h3>
          <button
            onClick={() => navigate("/")}
            className="text-primary hover:underline"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  const borrarCuenta = async () => {
    if (!usuarioSesion || borrandoCuenta) {
      return;
    }

    const confirmar = window.confirm(
      "¿Seguro que quieres borrar tu cuenta? Esta acción elimina tus libros, chats y mensajes de forma permanente."
    );

    if (!confirmar) {
      return;
    }

    if (!supabase) {
      window.alert("Supabase no está configurado en este entorno.");
      return;
    }

    setBorrandoCuenta(true);

    const { error } = await supabase.rpc("eliminar_cuenta_actual");

    if (error) {
      setBorrandoCuenta(false);
      window.alert("No se pudo borrar la cuenta. Inténtalo de nuevo.");
      return;
    }

    await cerrarSesion();
    setBorrandoCuenta(false);
    navigate("/auth");
  };

  const borrarLibro = async (book: Book) => {
    if (!usuarioSesion || eliminandoLibroId) {
      return;
    }

    const confirmar = window.confirm(`¿Quieres borrar el libro \"${book.title}\"?`);
    if (!confirmar) {
      return;
    }

    setEliminandoLibroId(book.id);
    const eliminado = await eliminarLibroSubido(book.id, usuarioSesion.id);

    if (eliminado) {
      setLibrosUsuario((anteriores) => anteriores.filter((item) => item.id !== book.id));
    } else {
      window.alert("No se pudo borrar el libro. Inténtalo de nuevo.");
    }

    setEliminandoLibroId(null);
  };

  const actualizarUbicacionPerfil = () => {
    if (!esUsuarioActual || actualizandoUbicacion) {
      return;
    }

    if (!navigator.geolocation) {
      window.alert("Este dispositivo no soporta geolocalización.");
      return;
    }

    setActualizandoUbicacion(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nuevaPosicion = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        const estadoActual = leerEstadoMapaGuardado();
        guardarEstadoMapa({
          posicionUsuario: nuevaPosicion,
          centroMapa: estadoActual?.centroMapa ?? [nuevaPosicion.lat, nuevaPosicion.lng],
          zoomMapa: estadoActual?.zoomMapa ?? 13,
        });

        void obtenerCiudadDeUbicacion(nuevaPosicion).then((ciudad) => {
          setCiudadUbicacion(ciudad);

          if (usuarioSesion?.id && usuario) {
            void guardarPerfilPublico({
              usuarioId: usuarioSesion.id,
              nombre: usuario.name,
              avatarUrl: avatarTemporal ?? usuario.avatar,
              ciudad,
              sobreUsuario: sobreUsuarioTexto,
              buscaLibros: buscaLibrosTexto,
              ubicacion: {
                lat: nuevaPosicion.lat,
                lng: nuevaPosicion.lng,
              },
            });
          }
        });
        setActualizandoUbicacion(false);
      },
      () => {
        setActualizandoUbicacion(false);
        window.alert("No se pudo obtener tu ubicación. Revisa el permiso de ubicación del navegador.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const valorarUsuario = async (valor: number) => {
    if (!usuarioSesion || !usuario || usuarioSesion.id === usuario.id || guardandoValoracion) {
      return;
    }

    setGuardandoValoracion(true);
    const guardado = await guardarValoracionUsuario(usuarioSesion.id, usuario.id, valor);

    if (!guardado) {
      setGuardandoValoracion(false);
      window.alert("No se pudo guardar la valoración. Inténtalo de nuevo.");
      return;
    }

    setMiValoracion(valor);
    const resumenActualizado = await obtenerResumenValoracionesUsuario(usuario.id);
    setResumenValoraciones(resumenActualizado);
    setGuardandoValoracion(false);
  };

  const mediaMostrada = resumenValoraciones.total > 0 ? resumenValoraciones.media : usuario.rating;
  const totalMostrado = resumenValoraciones.total > 0 ? resumenValoraciones.total : usuario.totalRatings;
  const avatarMostrado = avatarTemporal ?? usuario.avatar;

  const cambiarFotoPerfil = async (archivo: File | null) => {
    if (!archivo || !usuarioSesion || subiendoAvatar) {
      return;
    }

    setSubiendoAvatar(true);

    let urlAvatar: string | null = null;

    if (supabase) {
      urlAvatar = await subirImagenASupabase(archivo, "imagenes-perfil", usuarioSesion.id, "avatar");
    }

    if (!urlAvatar) {
      try {
        urlAvatar = await archivoADataUrl(archivo);
      } catch {
        urlAvatar = null;
      }
    }

    if (!urlAvatar) {
      window.alert("No se pudo actualizar la foto de perfil.");
      setSubiendoAvatar(false);
      return;
    }

    setAvatarTemporal(urlAvatar);

    if (supabase) {
      const { error: updateAuthError } = await supabase.auth.updateUser({
        data: {
          avatar_url: urlAvatar,
        },
      });

      if (updateAuthError) {
        window.alert("No se pudo guardar la foto en tu cuenta.");
        setSubiendoAvatar(false);
        return;
      }

      const [syncBooksOwner, syncChatsOwner, syncChatsRequester, syncPerfilPublico] = await Promise.all([
        supabase
          .from("books")
          .update({ avatar_propietario: urlAvatar })
          .eq("propietario_id", usuarioSesion.id),
        supabase
          .from("chats")
          .update({ avatar_propietario: urlAvatar })
          .eq("propietario_id", usuarioSesion.id),
        supabase
          .from("chats")
          .update({ avatar_solicitante: urlAvatar })
          .eq("solicitante_id", usuarioSesion.id),
        guardarPerfilPublico({
          usuarioId: usuarioSesion.id,
          nombre: usuario.name,
          avatarUrl: urlAvatar,
          ciudad: ciudadUbicacion,
          sobreUsuario: sobreUsuarioTexto,
          buscaLibros: buscaLibrosTexto,
          ubicacion: {
            lat: usuario.location.lat,
            lng: usuario.location.lng,
          },
        }),
      ]);

      const huboErroresSync =
        Boolean(syncBooksOwner.error) ||
        Boolean(syncChatsOwner.error) ||
        Boolean(syncChatsRequester.error);
      if (huboErroresSync) {
        window.alert(
          "La foto se guardó en tu perfil, pero no se pudo sincronizar en todos tus libros/chats. Revisa las políticas de actualización en Supabase."
        );
      }

      if (!syncPerfilPublico) {
        window.alert("La foto se guardó, pero no se pudo actualizar tu perfil público.");
      }
    }

    setSubiendoAvatar(false);
  };

  const manejarCerrarSesion = async () => {
    if (cerrandoSesionPerfil) {
      return;
    }

    setCerrandoSesionPerfil(true);

    try {
      await cerrarSesion();
      navigate("/auth", { replace: true });
    } catch {
      window.alert("No se pudo cerrar sesion. Intentalo de nuevo.");
    } finally {
      setCerrandoSesionPerfil(false);
    }
  };

  const guardarSobreUsuario = async () => {
    if (!esUsuarioActual || !usuarioSesion?.id || guardandoSobreUsuario) {
      return;
    }

    setGuardandoSobreUsuario(true);

    const guardado = await guardarPerfilPublico({
      usuarioId: usuarioSesion.id,
      nombre: usuario.name,
      avatarUrl: avatarTemporal ?? usuario.avatar,
      ciudad: ciudadUbicacion,
      sobreUsuario: sobreUsuarioTexto,
      buscaLibros: buscaLibrosTexto,
      ubicacion: {
        lat: usuario.location.lat,
        lng: usuario.location.lng,
      },
    });

    setGuardandoSobreUsuario(false);

    if (!guardado) {
      window.alert("No se pudo guardar la descripción. Inténtalo de nuevo.");
      setDescripcionGuardada(false);
      return;
    }

    setDescripcionGuardada(true);
    if (timeoutDescripcionGuardadaRef.current !== null) {
      window.clearTimeout(timeoutDescripcionGuardadaRef.current);
    }

    timeoutDescripcionGuardadaRef.current = window.setTimeout(() => {
      setDescripcionGuardada(false);
      timeoutDescripcionGuardadaRef.current = null;
    }, 2200);
  };

  return (
    <div className="flex-1 flex flex-col pb-16 bg-background overflow-y-auto page-enter">
      <header className="bg-secondary shadow-sm px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                  return;
                }

                navigate("/");
              }}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-white">Perfil</h2>
          </div>
          {esUsuarioActual && (
            <button
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
              onClick={() => setMostrarSelectorTema((valorActual) => !valorActual)}
              aria-label="Abrir ajustes de tema"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {esUsuarioActual && mostrarSelectorTema && (
        <div className="mx-6 mt-4 rounded-xl border border-border bg-card p-4 shadow-md soft-pop">
          <div className="flex items-center gap-2 mb-3">
            <Palette className="w-4 h-4 text-primary" />
            <h4 className="text-secondary">Tema de colores</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => seleccionarTema("moderno")}
              className={`rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
                temaColorActual === "moderno"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background hover:bg-accent"
              }`}
            >
              Moderno
            </button>
            <button
              type="button"
              onClick={() => seleccionarTema("atardecer")}
              className={`rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
                temaColorActual === "atardecer"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background hover:bg-accent"
              }`}
            >
              Atardecer
            </button>
            <button
              type="button"
              onClick={() => seleccionarTema("bosque")}
              className={`rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
                temaColorActual === "bosque"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background hover:bg-accent"
              }`}
            >
              Bosque
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-5xl px-4 py-6 space-y-6 sm:px-6">
        <div className="bg-accent rounded-xl p-5 sm:p-6 border border-border">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <img
                src={avatarMostrado}
                alt={usuario.name}
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md"
              />

              <div>
                <h2 className="text-secondary mb-2">{usuario.name}</h2>

                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-5 h-5 ${
                          i < Math.floor(mediaMostrada)
                            ? "fill-primary text-primary"
                            : "text-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {totalMostrado > 0
                      ? `${mediaMostrada} (${totalMostrado} valoraciones)`
                      : "Sin valoraciones todavía"}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span>{ciudadUbicacion}</span>
                </div>
              </div>
            </div>

            {esUsuarioActual && (
              <div className="flex flex-col sm:items-end gap-2">
                <input
                  ref={inputAvatarRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    void cambiarFotoPerfil(e.target.files?.[0] ?? null);
                    if (e.currentTarget) {
                      e.currentTarget.value = "";
                    }
                  }}
                />
                <button
                  onClick={() => inputAvatarRef.current?.click()}
                  disabled={subiendoAvatar}
                  className="px-3 h-8 rounded-lg text-xs border border-border hover:bg-white transition-colors disabled:opacity-60"
                >
                  {subiendoAvatar ? "Subiendo foto..." : "Cambiar foto de perfil"}
                </button>
                <button
                  onClick={actualizarUbicacionPerfil}
                  disabled={actualizandoUbicacion}
                  className="px-3 h-8 rounded-lg text-xs border border-border hover:bg-white transition-colors disabled:opacity-60"
                >
                  {actualizandoUbicacion ? "Actualizando ubicación..." : "Actualizar ubicación real"}
                </button>
              </div>
            )}
          </div>
        </div>

        {!esUsuarioActual && usuarioSesion && usuarioSesion.id !== idUsuarioPerfil && (
          <div className="bg-accent rounded-xl p-4 border border-border">
            <h3 className="text-secondary mb-2">Tu valoración</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Puntúa tu experiencia con este usuario (puedes cambiarla cuando quieras).
            </p>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((valor) => (
                <button
                  key={valor}
                  onClick={() => {
                    void valorarUsuario(valor);
                  }}
                  disabled={guardandoValoracion}
                  className="p-1 disabled:opacity-60"
                  aria-label={`Valorar con ${valor} estrellas`}
                >
                  <Star
                    className={`w-7 h-7 ${
                      valor <= miValoracion ? "fill-primary text-primary" : "text-muted"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="bg-accent rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h3 className="text-secondary">Sobre el usuario</h3>
            {esUsuarioActual && (
              <div className="flex items-center gap-2">
                {descripcionGuardada && !guardandoSobreUsuario && (
                  <span className="text-xs text-secondary">Guardado</span>
                )}
                <button
                  onClick={() => {
                    void guardarSobreUsuario();
                  }}
                  disabled={guardandoSobreUsuario}
                  className="px-3 py-1.5 rounded-lg text-xs border border-border hover:bg-white transition-colors disabled:opacity-60"
                >
                  {guardandoSobreUsuario ? "Guardando..." : "Guardar"}
                </button>
              </div>
            )}
          </div>

          {esUsuarioActual ? (
            <textarea
              value={sobreUsuarioTexto}
              onChange={(e) => {
                setSobreUsuarioTexto(e.target.value);
                if (descripcionGuardada) {
                  setDescripcionGuardada(false);
                }
              }}
              placeholder="Escribe una breve descripción sobre ti..."
              rows={4}
              maxLength={280}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
            />
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {sobreUsuarioTexto || "Este usuario todavía no ha escrito una descripción."}
            </p>
          )}
        </div>

        <div className="bg-accent rounded-xl p-4 border border-border">
          <h3 className="text-secondary mb-3">Buscando estos libros</h3>

          {esUsuarioActual && (
            <div className="space-y-2 mb-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={busquedaPreferencias}
                  onChange={(e) => setBusquedaPreferencias(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void buscarPreferenciasGoogleBooks()}
                  placeholder="Busca en Google Books"
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  onClick={() => {
                    void buscarPreferenciasGoogleBooks();
                  }}
                  disabled={buscandoPreferencias}
                  className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 transition-colors disabled:opacity-60"
                >
                  {buscandoPreferencias ? "Buscando..." : "Buscar"}
                </button>
              </div>

              {errorPreferencias && (
                <p className="text-xs text-destructive">{errorPreferencias}</p>
              )}

              {resultadosPreferencias.length > 0 && (
                <div className="rounded-lg border border-border bg-background max-h-44 overflow-y-auto shadow-sm">
                  {resultadosPreferencias.map((resultado) => (
                    <button
                      type="button"
                      key={`${resultado.title}-${resultado.author}`}
                      onClick={() => {
                        agregarPreferenciaLibro(resultado.title);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-accent/60 transition-colors border-b last:border-b-0 border-border"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-14 shrink-0 overflow-hidden rounded border border-border bg-muted/40 flex items-center justify-center">
                          <img
                            src={resultado.cover}
                            alt={resultado.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-foreground truncate">{resultado.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{resultado.author}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {preferenciasLibros.length > 0 ? (
              preferenciasLibros.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary"
                >
                  {item}
                  {esUsuarioActual && (
                    <button
                      onClick={() => quitarPreferenciaLibro(item)}
                      className="text-primary/80 hover:text-primary"
                      aria-label={`Quitar ${item}`}
                    >
                      x
                    </button>
                  )}
                </span>
              ))
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed">
                Este usuario todavía no ha indicado qué libros busca.
              </p>
            )}
          </div>
        </div>

        {esUsuarioActual && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-accent rounded-xl p-4 border border-border text-center">
              <div className="text-2xl text-primary mb-1">{librosUsuario.length}</div>
              <div className="text-xs text-muted-foreground">Libros publicados</div>
            </div>
            <div className="bg-accent rounded-xl p-4 border border-border text-center">
              <div className="text-2xl text-primary mb-1">{intercambiosCompletados}</div>
              <div className="text-xs text-muted-foreground">Intercambios completados</div>
            </div>
            <div className="bg-accent rounded-xl p-4 border border-border text-center">
              <div className="text-2xl text-primary mb-1">
                {respuestaMediaMin === null ? "-" : `${respuestaMediaMin} min`}
              </div>
              <div className="text-xs text-muted-foreground">Tiempo medio de respuesta</div>
            </div>
          </div>
        )}

        {esUsuarioActual && actividadReciente.length > 0 && (
          <div className="bg-accent rounded-xl p-4 border border-border">
            <h3 className="text-secondary mb-3">Actividad reciente</h3>
            <div className="space-y-2">
              {actividadReciente.map((actividad, index) => (
                <p key={`${actividad}-${index}`} className="text-sm text-muted-foreground">
                  {actividad}
                </p>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-secondary">
              {esUsuarioActual ? "Mi Biblioteca" : "Biblioteca"}
            </h3>
            <span className="text-sm text-muted-foreground">
              {librosUsuario.length} libros
            </span>
          </div>

          {librosUsuario.length === 0 ? (
            <div className="bg-accent/60 rounded-xl p-8 text-center border border-border">
              <p className="text-muted-foreground mb-4">
                {cargandoLibros
                  ? "Cargando biblioteca..."
                  : esUsuarioActual
                    ? "Aún no has añadido libros a tu biblioteca"
                    : "Este usuario no tiene libros publicados"}
              </p>
              {esUsuarioActual && (
                <Link
                  to="/add-book"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 hover:shadow-lg transition-all shadow-md"
                >
                  Añadir tu primer libro
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {librosUsuario.map((book) => (
                <div key={book.id} className="group">
                  <Link
                    to={`/book/${book.id}`}
                    className="block"
                  >
                    <div className="relative aspect-[2/3] rounded-lg overflow-hidden shadow-md mb-2 group-hover:shadow-xl transition-shadow">
                        <BookCover
                          src={book.cover}
                          alt={book.title}
                          className="w-full h-full object-cover"
                        />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                    <h4 className="text-sm text-foreground truncate mb-1">
                      {book.title}
                    </h4>
                    <p className="text-xs text-muted-foreground truncate">
                      {book.author}
                    </p>
                  </Link>

                  {esUsuarioActual && book.owner.id === usuarioSesionMostrado.id && (
                    <button
                      onClick={() => {
                        void borrarLibro(book);
                      }}
                      disabled={eliminandoLibroId === book.id}
                      className="mt-2 w-full text-xs px-2 py-1.5 rounded-md border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-60"
                    >
                      {eliminandoLibroId === book.id ? "Borrando..." : "Borrar libro"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {esUsuarioActual && (
          <div className="bg-accent rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-secondary">Favoritos</h3>
              <span className="text-sm text-muted-foreground">{librosFavoritos.length} guardados</span>
            </div>

            {librosFavoritos.length === 0 ? (
              <p className="text-sm text-muted-foreground leading-relaxed">
                Marca libros con el corazón para guardarlos aquí.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {librosFavoritos.map((book) => (
                  <div key={book.id} className="group relative">
                    <Link to={`/book/${book.id}`} className="block">
                      <div className="relative aspect-[2/3] rounded-lg overflow-hidden shadow-md mb-2 group-hover:shadow-xl transition-shadow">
                        <BookCover
                          src={book.cover}
                          alt={book.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <h4 className="text-sm text-foreground truncate mb-1">
                        {book.title}
                      </h4>
                      <p className="text-xs text-muted-foreground truncate">
                        {book.author}
                      </p>
                    </Link>

                    <button
                      type="button"
                      onClick={() => alternarFavoritoLibro(book.id)}
                      className="absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md"
                      aria-label={`Quitar ${book.title} de favoritos`}
                    >
                      <Heart className="w-4 h-4 fill-current" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {esUsuarioActual && (
          <div className="space-y-3">
            <h3 className="text-secondary">Configuración</h3>
            <div className="bg-accent rounded-xl border border-border divide-y divide-border">
              <div className="w-full px-5 py-4 text-left rounded-t-xl space-y-3">
                <div>
                  <div className="text-foreground">Notificaciones</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Activa avisos de chats y de libros cercanos.
                  </div>
                </div>

                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => actualizarPreferenciasNotificaciones({ chatMessages: !preferenciasNotificaciones.chatMessages })}
                    className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-white transition-colors"
                  >
                    <span>Chats</span>
                    <span>{preferenciasNotificaciones.chatMessages ? "Activado" : "Desactivado"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => actualizarPreferenciasNotificaciones({ nearbyBooks: !preferenciasNotificaciones.nearbyBooks })}
                    className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-white transition-colors"
                  >
                    <span>Libros cercanos</span>
                    <span>{preferenciasNotificaciones.nearbyBooks ? "Activado" : "Desactivado"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={habilitarNotificacionesPush}
                    disabled={habilitandoPush || preferenciasNotificaciones.browserNotifications}
                    className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>Notificaciones Push</span>
                    <span>{habilitandoPush ? "Activando..." : preferenciasNotificaciones.browserNotifications ? "Activado" : "Desactivado"}</span>
                  </button>
                </div>

                {mensajePush && <p className="text-xs text-muted-foreground">{mensajePush}</p>}
              </div>
              <button className="w-full px-5 py-4 text-left hover:bg-white transition-colors">
                <div className="text-foreground">Privacidad y seguridad</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Controla quién puede ver tu información
                </div>
              </button>
              <button
                className="w-full px-5 py-4 text-left hover:bg-white transition-colors"
                onClick={() => setMostrarSelectorTema((valorActual) => !valorActual)}
              >
                <div className="text-foreground">Tema de colores</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Actual: {temaColorActual}
                </div>
              </button>
              <button
                className="w-full px-5 py-4 text-left hover:bg-white transition-colors"
                onClick={avanzarRangoPredeterminado}
              >
                <div className="text-foreground">Radio de búsqueda predeterminado</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Actualmente: {rangoBusquedaPredeterminado} km · pulsa para cambiar
                </div>
              </button>
              <button
                className="w-full px-5 py-4 text-left hover:bg-white transition-colors rounded-b-xl"
                onClick={() => {
                  void manejarCerrarSesion();
                }}
                disabled={cerrandoSesionPerfil}
              >
                <div className="text-foreground">
                  {cerrandoSesionPerfil ? "Cerrando sesion..." : "Cerrar sesion"}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Sal de tu cuenta en este dispositivo
                </div>
              </button>
            </div>

            

            <button
              onClick={() => {
                void borrarCuenta();
              }}
              disabled={borrandoCuenta}
              className="w-full px-5 py-4 text-left rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-60"
            >
              <div className="text-red-700">
                {borrandoCuenta ? "Borrando cuenta..." : "Borrar cuenta"}
              </div>
              <div className="text-sm text-red-600 mt-1">
                Elimina tu cuenta y todos tus datos de forma permanente
              </div>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
