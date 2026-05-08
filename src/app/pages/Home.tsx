import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { LocateFixed, MessageCircle, Search, Heart } from "lucide-react";
import { Geolocation } from "@capacitor/geolocation";
import { currentUser } from "../data/mockData";
import type { Book } from "../data/mockData";
import { obtenerTodosLosLibros, suscribirseACambiosDeLibros } from "../data/bookStorage";
import BookCover from "../components/BookCover";
import Map, { Marker, Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { crearOAbrirChatPorLibro } from "../data/chatStorage";
import { useAuth } from "../auth/AuthProvider";
import { obtenerUsuarioDeSesion } from "../auth/userProfile";
import {
  guardarPreferenciaPermisoUbicacion,
  obtenerPreferenciaPermisoUbicacion,
} from "../data/locationPermissionStorage";
import {
  guardarEstadoMapa,
  leerEstadoMapaGuardado,
  type PosicionUsuario,
} from "../data/mapStateStorage";
import { obtenerPerfilPublico } from "../data/publicProfileStorage";
import { obtenerRangoBusquedaPredeterminado } from "../data/defaultRangeStorage";
import {
  alternarFavorito,
  obtenerFavoritosUsuario,
  suscribirseACambiosDeFavoritos,
} from "../data/favoritesStorage";
import { calcularDistanciaKm } from "../lib/geoUtils";

function sacarSemillaDelId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function sacarUbicacionAproximada(location: PosicionUsuario, id: string): PosicionUsuario {
  const seed = sacarSemillaDelId(id);
  const angle = (seed % 360) * (Math.PI / 180);
  const radiusMeters = 180 + (seed % 220);

  const latOffset = (radiusMeters * Math.cos(angle)) / 111320;
  const lngOffset = (radiusMeters * Math.sin(angle)) / (111320 * Math.cos((location.lat * Math.PI) / 180));

  return {
    lat: location.lat + latOffset,
    lng: location.lng + lngOffset,
  };
}

function generarCirculoGeoJSON(
  centro: { lat: number; lng: number },
  radioKm: number,
  pasos: number = 64
) {
  const radioRadianes = radioKm / 6371;
  const latitud = (centro.lat * Math.PI) / 180;
  const longitud = (centro.lng * Math.PI) / 180;

  const puntos: Array<[number, number]> = [];

  for (let i = 0; i <= pasos; i += 1) {
    const angulo = (i / pasos) * 2 * Math.PI;

    const latitudPunto = Math.asin(
      Math.sin(latitud) * Math.cos(radioRadianes) +
        Math.cos(latitud) * Math.sin(radioRadianes) * Math.cos(angulo)
    );

    const longitudPunto =
      longitud +
      Math.atan2(
        Math.sin(angulo) * Math.sin(radioRadianes) * Math.cos(latitud),
        Math.cos(radioRadianes) - Math.sin(latitud) * Math.sin(latitudPunto)
      );

    const lng = ((longitudPunto * 180) / Math.PI + 540) % 360 - 180;
    const lat = (latitudPunto * 180) / Math.PI;
    puntos.push([lng, lat]);
  }

  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "Polygon" as const,
      coordinates: [puntos],
    },
  };
}

function normalizarTexto(texto: unknown): string {
  if (typeof texto !== "string") {
    return "";
  }

  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizarIsbn(texto: unknown): string {
  return normalizarTexto(texto).replace(/[^a-z0-9]/g, "");
}

export default function Home() {
  const navigate = useNavigate();
  const { usuario: usuarioSesion } = useAuth();
  const estadoMapaInicial = useMemo(() => leerEstadoMapaGuardado(), []);
  const [distancia, setDistancia] = useState([obtenerRangoBusquedaPredeterminado()]);
  const [textoBusqueda, setTextoBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "disponible" | "reservado" | "intercambiado">("todos");
  const [sinRango, setSinRango] = useState(false);
  const [activarFiltroBuscados, setActivarFiltroBuscados] = useState(false);
  const [buscaLibrosPerfilTexto, setBuscaLibrosPerfilTexto] = useState("");
  const [posicionUsuario, setPosicionUsuario] = useState<PosicionUsuario>(
    estadoMapaInicial?.posicionUsuario ?? currentUser.location
  );
  const [centroMapa, setCentroMapa] = useState<[number, number]>(
    estadoMapaInicial?.centroMapa ?? [currentUser.location.lat, currentUser.location.lng]
  );
  const [zoomMapa, setZoomMapa] = useState<number>(estadoMapaInicial?.zoomMapa ?? 13);
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);
  const [permisoUbicacionDenegado, setPermisoUbicacionDenegado] = useState(false);
  const [errorUbicacion, setErrorUbicacion] = useState("");
  const [mostrarPestanaUbicacion, setMostrarPestanaUbicacion] = useState(false);
  const [libros, setLibros] = useState<Book[]>([]);
  const [abriendoChatLibroId, setAbriendoChatLibroId] = useState<string | null>(null);
  const [libroSeleccionadoEnMapa, setLibroSeleccionadoEnMapa] = useState<Book | null>(null);
  const [panelLibrosExpandido, setPanelLibrosExpandido] = useState(false);
  const [inicioArrastreY, setInicioArrastreY] = useState<number | null>(null);
  const [deltaArrastreY, setDeltaArrastreY] = useState(0);
  const [tocandoSlider, setTocandoSlider] = useState(false);
  const [favoritosVersion, setFavoritosVersion] = useState(0);

  const contextoSeguro = typeof window !== "undefined" ? window.isSecureContext : true;

  const usuarioActual = usuarioSesion
    ? obtenerUsuarioDeSesion(usuarioSesion, currentUser.location)
    : currentUser;

  useEffect(() => {
    guardarEstadoMapa({
      posicionUsuario,
      centroMapa,
      zoomMapa,
    });
  }, [posicionUsuario, centroMapa, zoomMapa]);

  useEffect(() => {
    const desuscribir = suscribirseACambiosDeFavoritos(() => {
      setFavoritosVersion((valorActual) => valorActual + 1);
    });

    return () => {
      desuscribir();
    };
  }, []);

  useEffect(() => {
    let activa = true;

    const cargarPreferencias = async () => {
      if (!usuarioActual.id || usuarioActual.id === "current-user") {
        if (activa) {
          setBuscaLibrosPerfilTexto("");
        }
        return;
      }

      const perfil = await obtenerPerfilPublico(usuarioActual.id);
      if (activa) {
        setBuscaLibrosPerfilTexto(perfil?.buscaLibros ?? "");
      }
    };

    void cargarPreferencias();

    return () => {
      activa = false;
    };
  }, [usuarioActual.id]);

  const librosConDistancia = useMemo(() => {
    return libros
      .map((book) => ({
        ...book,
        distance: calcularDistanciaKm(posicionUsuario, book.location),
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [libros, posicionUsuario]);

  const terminosBuscados = useMemo(() => {
    return buscaLibrosPerfilTexto
      .split(/[\n,;]+/)
      .map((item) => normalizarTexto(item))
      .filter(Boolean);
  }, [buscaLibrosPerfilTexto]);

  const librosFiltrados = useMemo(() => {
    const textoNormalizado = normalizarTexto(textoBusqueda);
    const terminosBusqueda = textoNormalizado.split(/\s+/).filter(Boolean);

    return librosConDistancia.filter((book) => {
      if (book.owner.id === usuarioActual.id) {
        return false;
      }

      const cumpleRango = sinRango || book.distance <= distancia[0];
      const titulo = normalizarTexto(book.title);
      const autor = normalizarTexto(book.author);
      const dueno = normalizarTexto(book.owner?.name);
      const sinopsis = normalizarTexto(book.synopsis);
      const isbn = normalizarIsbn(book.isbn ?? "");

      if (filtroEstado !== "todos" && book.status !== filtroEstado) {
        return false;
      }

      if (activarFiltroBuscados) {
        if (terminosBuscados.length === 0) {
          return false;
        }

        const coincideBuscado = terminosBuscados.some((terminoBuscado) => {
          const terminoIsbn = normalizarIsbn(terminoBuscado);
          if (terminoIsbn && isbn.includes(terminoIsbn)) {
            return true;
          }

          return (
            titulo.includes(terminoBuscado) ||
            autor.includes(terminoBuscado) ||
            sinopsis.includes(terminoBuscado)
          );
        });

        if (!coincideBuscado) {
          return false;
        }
      }

      if (terminosBusqueda.length === 0) {
        return cumpleRango;
      }

      const textoCompleto = `${titulo} ${autor} ${dueno} ${sinopsis}`;

      const coincideTexto = terminosBusqueda.every((termino) => {
        const terminoNormalizado = normalizarTexto(termino);
        const terminoIsbn = normalizarIsbn(termino);

        if (terminoIsbn && isbn.includes(terminoIsbn)) {
          return true;
        }

        return textoCompleto.includes(terminoNormalizado);
      });

      return coincideTexto;
    });
  }, [activarFiltroBuscados, filtroEstado, librosConDistancia, distancia, sinRango, terminosBuscados, textoBusqueda, usuarioActual.id]);

  const favoritosIds = useMemo(() => {
    const idUsuario = usuarioActual.id;
    void favoritosVersion;
    return new Set(obtenerFavoritosUsuario(idUsuario));
  }, [usuarioActual.id, favoritosVersion]);

  const alternarLibroFavorito = (bookId: string) => {
    alternarFavorito(usuarioActual.id, bookId);
    setFavoritosVersion((valorActual) => valorActual + 1);
  };

  const datosCirculo = useMemo(
    () => generarCirculoGeoJSON(posicionUsuario, distancia[0]),
    [posicionUsuario, distancia]
  );

  const busquedaActiva = textoBusqueda.trim().length > 0;
  const resultadosBusquedaRapida = useMemo(
    () => (busquedaActiva ? librosFiltrados.slice(0, 5) : []),
    [busquedaActiva, librosFiltrados]
  );

  const textoEstado = (estado: Book["status"]) => {
    if (estado === "reservado") {
      return "Reservado";
    }

    if (estado === "intercambiado") {
      return "Intercambiado";
    }

    return "Disponible";
  };

  const pedirUbicacionUsuario = (reabrirPestanaSiFalla = true, centrarMapa = false) => {
    setBuscandoUbicacion(true);
    setPermisoUbicacionDenegado(false);
    setErrorUbicacion("");

    const aplicarPosicion = (lat: number, lng: number) => {
      setPosicionUsuario({ lat, lng });
      if (centrarMapa) {
        setCentroMapa([lat, lng]);
        setZoomMapa((zoomActual) => Math.max(zoomActual, 13));
      }
      guardarPreferenciaPermisoUbicacion("aceptado");
      setPermisoUbicacionDenegado(false);
      setErrorUbicacion("");
      setMostrarPestanaUbicacion(false);
      setBuscandoUbicacion(false);
    };

    const manejarErrorFinal = (error: string) => {
      guardarPreferenciaPermisoUbicacion("denegado");
      setPermisoUbicacionDenegado(true);
      setErrorUbicacion(error);
      if (reabrirPestanaSiFalla) {
        setMostrarPestanaUbicacion(true);
      }
      setBuscandoUbicacion(false);
    };

    // Intentar con Capacitor Geolocation (nativo en Android/iOS)
    Geolocation.requestPermissions()
      .then((permisos) => {
        if (permisos.location !== "granted" && permisos.coarseLocation !== "granted") {
          manejarErrorFinal("Has bloqueado el permiso de ubicación. Revisa Ajustes.");
          return;
        }

        return Geolocation.getCurrentPosition({ enableHighAccuracy: true })
          .then((position) => {
            aplicarPosicion(position.coords.latitude, position.coords.longitude);
          });
      })
      .catch(() => {
        // Fallback a navigator.geolocation si Capacitor falla
        if (!navigator.geolocation) {
          manejarErrorFinal("Este dispositivo no soporta geolocalización.");
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            aplicarPosicion(position.coords.latitude, position.coords.longitude);
          },
          (error) => {
            const mensajeError =
              error.code === 1
                ? "Has bloqueado el permiso de ubicación. Revisa Ajustes."
                : "No se pudo obtener tu ubicación.";
            manejarErrorFinal(mensajeError);
          },
          { enableHighAccuracy: true, timeout: 9000, maximumAge: 0 }
        );
      });
  };

  const permitirUbicacion = () => {
    pedirUbicacionUsuario(true, true);
  };

  const omitirUbicacion = () => {
    setMostrarPestanaUbicacion(false);
  };

  useEffect(() => {
    const preferenciaGuardada = obtenerPreferenciaPermisoUbicacion();
    
    // Si el usuario ya autorizó antes, pedir ubicación automáticamente
    if (preferenciaGuardada === "aceptado") {
      pedirUbicacionUsuario(false, false);
    } else {
      // Si es la primera vez o fue denegado, mostrar el diálogo
      setMostrarPestanaUbicacion(true);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const cargarLibros = async () => {
      const books = await obtenerTodosLosLibros();
      if (isMounted) {
        setLibros(books);
      }
    };

    void cargarLibros();

    const desuscribirse = suscribirseACambiosDeLibros(() => {
      void cargarLibros();
    });

    return () => {
      isMounted = false;
      desuscribirse();
    };
  }, []);

  const iniciarChat = async (book: Book) => {
    if (book.owner.id === usuarioActual.id || abriendoChatLibroId) {
      return;
    }

    setAbriendoChatLibroId(book.id);
    const chatId = await crearOAbrirChatPorLibro(book, {
      id: usuarioActual.id,
      name: usuarioActual.name,
      avatar: usuarioActual.avatar,
    });
    setAbriendoChatLibroId(null);

    if (chatId) {
      navigate(`/chat/${chatId}`);
    }
  };

  const iniciarArrastrePanel = (y: number) => {
    setInicioArrastreY(y);
    setDeltaArrastreY(0);
  };

  const moverArrastrePanel = (y: number) => {
    if (inicioArrastreY === null) {
      return;
    }

    setDeltaArrastreY(y - inicioArrastreY);
  };

  const finalizarArrastrePanel = () => {
    if (inicioArrastreY === null) {
      return;
    }

    if (deltaArrastreY < -45) {
      setPanelLibrosExpandido(true);
    } else if (deltaArrastreY > 45) {
      setPanelLibrosExpandido(false);
    }

    setInicioArrastreY(null);
    setDeltaArrastreY(0);
  };

  const alturaPanel = panelLibrosExpandido ? "62%" : "168px";

  return (
    <div className="flex-1 pb-16 relative bg-muted overflow-hidden page-enter">
      {mostrarPestanaUbicacion && (
        <div className="absolute top-20 left-3 right-3 z-[950]">
          <div className="bg-white border border-border rounded-2xl shadow-xl p-4">
            <h4 className="text-secondary mb-1">Permiso de ubicación</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Para enseñarte libros cercanos, necesitamos acceso a tu ubicación.
            </p>
            <div className="flex gap-2">
              <button
                onClick={permitirUbicacion}
                className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
              >
                {buscandoUbicacion ? "Obteniendo ubicación..." : "Permitir ubicación"}
              </button>
              <button
                onClick={omitirUbicacion}
                className="h-9 px-3 rounded-lg border border-border text-sm text-foreground hover:bg-accent transition-colors"
              >
                Ahora no
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="absolute top-3 left-3 right-3 z-[900] pointer-events-none">
        <div className="pointer-events-auto bg-background/90 backdrop-blur-xl rounded-2xl shadow-lg border border-border px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por titulo, autor o usuario"
                value={textoBusqueda}
                onChange={(e) => setTextoBusqueda(e.target.value)}
                className="w-full h-9 pl-8 pr-3 text-sm bg-white border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button
              onClick={() => pedirUbicacionUsuario(true, true)}
              className="h-9 w-9 shrink-0 rounded-lg bg-secondary text-white flex items-center justify-center hover:opacity-90 transition-opacity"
              aria-label="Centrar en mi ubicacion"
              disabled={buscandoUbicacion}
            >
              <LocateFixed className={`w-4 h-4 ${buscandoUbicacion ? "animate-spin" : ""}`} />
            </button>
          </div>

          {busquedaActiva && (
            <div className="mt-2 rounded-xl border border-border bg-white shadow-sm overflow-hidden">
              {resultadosBusquedaRapida.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  No hay resultados con esos filtros
                </p>
              ) : (
                <div className="max-h-56 overflow-y-auto divide-y divide-border/60">
                  {resultadosBusquedaRapida.map((book) => (
                    <Link
                      key={book.id}
                      to={`/book/${book.id}`}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-accent transition-colors"
                    >
                      <BookCover
                        src={book.cover}
                        alt={book.title}
                        className="w-8 h-12 object-cover"
                        containerClassName="w-8 h-12 rounded border border-border/70"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-foreground truncate">{book.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {book.author} · {book.distance} km
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-2 flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">Radio:</span>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={distancia[0]}
              onChange={(e) => setDistancia([Number(e.target.value)])}
              onPointerDown={() => setTocandoSlider(true)}
              onPointerUp={() => setTocandoSlider(false)}
              onPointerLeave={() => setTocandoSlider(false)}
              className="w-full h-1.5 accent-primary cursor-pointer"
              aria-label="Distancia maxima"
            />
            <span className="text-[11px] text-secondary font-medium whitespace-nowrap">
              {distancia[0]} km
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">Estado:</span>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as "todos" | "disponible" | "reservado" | "intercambiado")}
              className="h-7 text-[11px] px-2 rounded-md border border-border bg-white"
            >
              <option value="todos">Todos</option>
              <option value="disponible">Disponibles</option>
              <option value="reservado">Reservados</option>
              <option value="intercambiado">Intercambiados</option>
            </select>
            <button
              type="button"
              onClick={() => setSinRango((valorActual) => !valorActual)}
              className={`h-7 px-2.5 rounded-md text-[11px] border transition-colors ${
                sinRango
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white text-foreground border-border hover:bg-accent"
              }`}
            >
              Sin rango
            </button>
          </div>

          {permisoUbicacionDenegado && (
            <p className="mt-2 text-[11px] text-amber-700">
              Activa el permiso de ubicación en el navegador para ver distancias reales cerca de ti.
            </p>
          )}

          {errorUbicacion && !permisoUbicacionDenegado && (
            <p className="mt-2 text-[11px] text-amber-700">
              {errorUbicacion}
            </p>
          )}
        </div>
      </div>

      <div className="absolute left-0 right-0 top-0 bottom-16 min-h-[40dvh] bg-muted">
        {libroSeleccionadoEnMapa && (
          <div className="absolute top-24 left-3 right-3 z-[905] pointer-events-none">
            <div className="pointer-events-auto bg-white/95 backdrop-blur rounded-xl border border-border shadow-lg p-3">
              <div className="flex items-start gap-3">
                <img
                  src={libroSeleccionadoEnMapa.cover}
                  alt={libroSeleccionadoEnMapa.title}
                  className="w-12 h-16 object-cover rounded"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate">{libroSeleccionadoEnMapa.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{libroSeleccionadoEnMapa.author}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {libroSeleccionadoEnMapa.distance} km · {libroSeleccionadoEnMapa.owner.name}
                  </p>
                  <p className="text-[11px] text-primary truncate">{textoEstado(libroSeleccionadoEnMapa.status)}</p>
                </div>
                <button
                  onClick={() => setLibroSeleccionadoEnMapa(null)}
                  className="text-xs px-2 h-7 rounded border border-border hover:bg-accent"
                >
                  Cerrar
                </button>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    if (libroSeleccionadoEnMapa) {
                      void iniciarChat(libroSeleccionadoEnMapa);
                    }
                  }}
                  disabled={
                    !libroSeleccionadoEnMapa ||
                    libroSeleccionadoEnMapa.owner.id === usuarioActual.id ||
                    libroSeleccionadoEnMapa.status === "intercambiado" ||
                    abriendoChatLibroId === libroSeleccionadoEnMapa.id
                  }
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-55"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>
                    {libroSeleccionadoEnMapa.owner.id === usuarioActual.id
                      ? "Tu libro"
                      : libroSeleccionadoEnMapa.status === "intercambiado"
                        ? "No disponible"
                      : abriendoChatLibroId === libroSeleccionadoEnMapa.id
                        ? "Abriendo chat..."
                        : "Chatear"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="absolute inset-0 overflow-hidden">
          <Map
            mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
            latitude={centroMapa[0]}
            longitude={centroMapa[1]}
            zoom={zoomMapa}
            minZoom={3}
            maxZoom={18}
            dragRotate={false}
            touchZoomRotate
            attributionControl={false}
            style={{ width: "100%", height: "100%" }}
            onMove={(evento) => {
              setCentroMapa([evento.viewState.latitude, evento.viewState.longitude]);
              setZoomMapa(evento.viewState.zoom);
            }}
            onClick={() => {
              setLibroSeleccionadoEnMapa(null);
            }}
          >
            <Source id="distancia-circle" type="geojson" data={datosCirculo}>
              <Layer
                id="distancia-circle-fill"
                type="fill"
                paint={{
                  "fill-color": "#3b82f6",
                  "fill-opacity": tocandoSlider ? 0.1 : 0,
                }}
              />
              <Layer
                id="distancia-circle-stroke"
                type="line"
                paint={{
                  "line-color": "#3b82f6",
                  "line-width": 2,
                  "line-opacity": tocandoSlider ? 0.6 : 0,
                }}
              />
            </Source>

            <Marker
              latitude={posicionUsuario.lat}
              longitude={posicionUsuario.lng}
              anchor="center"
            >
              <button
                type="button"
                aria-label="Tu ubicación"
                className="h-4 w-4 rounded-full bg-blue-600 ring-4 ring-blue-300/50"
              />
            </Marker>

            {librosFiltrados.map((book) => {
              const approximateLocation = sacarUbicacionAproximada(book.location, book.id);
              const estaSeleccionado = libroSeleccionadoEnMapa?.id === book.id;

              return (
                <Marker
                  key={book.id}
                  latitude={approximateLocation.lat}
                  longitude={approximateLocation.lng}
                  anchor="center"
                >
                  <button
                    type="button"
                    aria-label={`Libro: ${book.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setLibroSeleccionadoEnMapa(book);
                    }}
                    className={`rounded-full border-2 transition-all ${
                      estaSeleccionado
                        ? "h-5 w-5 bg-amber-600 border-amber-800"
                        : "h-4 w-4 bg-amber-500 border-amber-700"
                    }`}
                  />
                </Marker>
              );
            })}
          </Map>
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 z-[910] transition-[height] duration-300 ease-out"
          style={{ height: alturaPanel }}
        >
          <div className="h-full bg-gradient-to-t from-background via-background/95 to-transparent pt-5">
            <div className="h-full bg-background rounded-t-3xl shadow-xl border-t border-border flex flex-col">
              <div
                role="button"
                tabIndex={0}
                className="px-4 pt-2 pb-3 cursor-grab active:cursor-grabbing touch-pan-y"
                onClick={() => setPanelLibrosExpandido((valorActual) => !valorActual)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setPanelLibrosExpandido((valorActual) => !valorActual);
                  }
                }}
                onTouchStart={(e) => iniciarArrastrePanel(e.touches[0].clientY)}
                onTouchMove={(e) => moverArrastrePanel(e.touches[0].clientY)}
                onTouchEnd={finalizarArrastrePanel}
              >
                <div className="w-12 h-1.5 rounded-full bg-border mx-auto mb-2" />
                <div className="flex items-center justify-between">
                  <h3 className="text-secondary">Libros cerca de ti</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{librosFiltrados.length} encontrados</span>
                    <span className="text-xs text-primary">
                      {panelLibrosExpandido ? "Desliza abajo" : "Desliza arriba"}
                    </span>
                  </div>
                </div>

                <div className="mt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivarFiltroBuscados((valor) => !valor);
                    }}
                    className={`h-7 px-3 rounded-md text-[11px] border transition-colors ${
                      activarFiltroBuscados
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-white text-foreground border-border hover:bg-accent"
                    }`}
                  >
                    Libros buscados
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-4">
                {activarFiltroBuscados && terminosBuscados.length === 0 && (
                  <div className="text-center py-4 text-xs text-muted-foreground">
                    Añade "libros buscados" en tu perfil para activar este filtro.
                  </div>
                )}

                {librosFiltrados.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay libros disponibles en este radio
                  </div>
                ) : (
                  <div className="space-y-3">
                    {librosFiltrados.map((book) => (
                      <div
                          key={book.id}
                          className="bg-accent rounded-xl p-3 border border-border/70 hover:shadow-md transition-all relative"
                        >
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              alternarLibroFavorito(book.id);
                            }}
                            className={`absolute top-3 right-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border transition-all ${
                              favoritosIds.has(book.id)
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-white text-muted-foreground border-border hover:text-primary"
                            }`}
                            aria-label={
                              favoritosIds.has(book.id)
                                ? `Quitar ${book.title} de favoritos`
                                : `Añadir ${book.title} a favoritos`
                            }
                          >
                            <Heart className={`w-4 h-4 ${favoritosIds.has(book.id) ? "fill-current" : ""}`} />
                          </button>
                        <Link to={`/book/${book.id}`} className="flex gap-3">
                          <BookCover
                            src={book.cover}
                            alt={book.title}
                            className="w-16 h-24 object-cover"
                            containerClassName="w-16 h-24 rounded-lg shadow-sm"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-foreground truncate">{book.title}</h4>
                            <p className="text-sm text-muted-foreground truncate">
                              {book.author}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-primary">
                                📍 {book.distance} km
                              </span>
                              <span className="text-xs text-muted-foreground">
                                · {book.owner.name}
                              </span>
                              <span className="text-xs text-secondary">
                                · {textoEstado(book.status)}
                              </span>
                            </div>
                          </div>
                        </Link>

                        <button
                          onClick={() => {
                            void iniciarChat(book);
                          }}
                          disabled={
                            book.owner.id === usuarioActual.id ||
                            book.status === "intercambiado" ||
                            abriendoChatLibroId === book.id
                          }
                          className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-55"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>
                            {book.owner.id === usuarioActual.id
                              ? "Tu libro"
                              : book.status === "intercambiado"
                                ? "No disponible"
                              : abriendoChatLibroId === book.id
                                ? "Abriendo chat..."
                                : "Chatear"}
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
