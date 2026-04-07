import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { ArrowLeft, MapPin, Star, MessageCircle, Heart } from "lucide-react";
import type { Book } from "../data/mockData";
import { currentUser } from "../data/mockData";
import { obtenerLibroPorId, eliminarLibroSubido, actualizarEstadoLibro } from "../data/bookStorage";
import { crearOAbrirChatPorLibro } from "../data/chatStorage";
import { useAuth } from "../auth/AuthProvider";
import {
  alternarFavorito,
  esLibroFavorito,
  suscribirseACambiosDeFavoritos,
} from "../data/favoritesStorage";

export default function BookDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario: usuarioSesion } = useAuth();
  const [libro, setLibro] = useState<Book | undefined>(undefined);
  const [cargandoLibro, setCargandoLibro] = useState(true);
  const [abriendoChat, setAbriendoChat] = useState(false);
  const [borrandoLibro, setBorrandoLibro] = useState(false);
  const [actualizandoEstado, setActualizandoEstado] = useState(false);
  const [favoritosVersion, setFavoritosVersion] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const cargarLibro = async () => {
      if (!id) {
        if (isMounted) {
          setLibro(undefined);
          setCargandoLibro(false);
        }
        return;
      }

      const libroEncontrado = await obtenerLibroPorId(id);
      if (isMounted) {
        setLibro(libroEncontrado);
        setCargandoLibro(false);
      }
    };

    setCargandoLibro(true);
    void cargarLibro();

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    const desuscribir = suscribirseACambiosDeFavoritos(() => {
      setFavoritosVersion((valorActual) => valorActual + 1);
    });

    return () => {
      desuscribir();
    };
  }, []);

  if (cargandoLibro) {
    return (
      <div className="flex-1 flex items-center justify-center pb-16">
        <div className="text-muted-foreground">Cargando libro...</div>
      </div>
    );
  }

  const esLibroDelUsuario = libro.owner.id === (usuarioSesion?.id ?? currentUser.id);

  const textoEstado = (estado: Book["status"]) => {
    if (estado === "reservado") {
      return "Reservado";
    }

    if (estado === "intercambiado") {
      return "Intercambiado";
    }

    return "Disponible";
  };

  const borrarLibro = async () => {
    if (!libro || !usuarioSesion || borrandoLibro) {
      return;
    }

    const confirmar = window.confirm(`¿Quieres borrar el libro \"${libro.title}\"?`);
    if (!confirmar) {
      return;
    }

    setBorrandoLibro(true);
    const eliminado = await eliminarLibroSubido(libro.id, usuarioSesion.id);
    setBorrandoLibro(false);

    if (!eliminado) {
      window.alert("No se pudo borrar el libro. Inténtalo de nuevo.");
      return;
    }

    navigate("/profile/current-user");
  };

  const abrirChat = async () => {
    if (!libro || abriendoChat) {
      return;
    }

    const nombreUsuario =
      typeof usuarioSesion?.user_metadata?.full_name === "string" && usuarioSesion.user_metadata.full_name
        ? usuarioSesion.user_metadata.full_name
        : currentUser.name;

    setAbriendoChat(true);
    const chatId = await crearOAbrirChatPorLibro(libro, {
      id: usuarioSesion?.id ?? currentUser.id,
      name: nombreUsuario,
      avatar: currentUser.avatar,
    });
    setAbriendoChat(false);

    if (!chatId) {
      return;
    }

    navigate(`/chat/${chatId}`);
  };

  const cambiarEstado = async (estado: Book["status"]) => {
    if (!libro || !usuarioSesion || !esLibroDelUsuario || actualizandoEstado) {
      return;
    }

    setActualizandoEstado(true);
    const actualizado = await actualizarEstadoLibro(libro.id, usuarioSesion.id, estado);
    setActualizandoEstado(false);

    if (!actualizado) {
      window.alert("No se pudo actualizar el estado del libro.");
      return;
    }

    setLibro((anterior) => (anterior ? { ...anterior, status: estado } : anterior));
  };

  if (!libro) {
    return (
      <div className="flex-1 flex items-center justify-center pb-16">
        <div className="text-center">
          <h3 className="text-foreground mb-2">Libro no encontrado</h3>
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

  const esFavorito = esLibroFavorito(usuarioSesion?.id ?? currentUser.id, libro.id);

  const alternarFavoritoLibro = () => {
    alternarFavorito(usuarioSesion?.id ?? currentUser.id, libro.id);
    setFavoritosVersion((valorActual) => valorActual + 1);
  };

  return (
    <div className="flex-1 flex flex-col pb-16 bg-background overflow-y-auto">
      <div className="relative">
        <img
          src={libro.cover}
          alt={libro.title}
          className="w-full h-96 object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent"></div>

        <button
          onClick={() => navigate("/")}
          className="absolute top-4 left-4 p-2 bg-card/90 backdrop-blur-sm rounded-lg hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="flex gap-4 items-start">
            <img
              src={libro.cover}
              alt={libro.title}
              className="w-24 h-36 object-cover rounded-lg shadow-xl"
            />
            <div className="flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h1 className="text-foreground mb-1">{libro.title}</h1>
                  <p className="text-muted-foreground mb-2">{libro.author}</p>
                </div>
                <button
                  type="button"
                  onClick={alternarFavoritoLibro}
                  className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all ${
                    esFavorito
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card/90 text-muted-foreground border-border hover:text-primary"
                  }`}
                  aria-label={esFavorito ? "Quitar de favoritos" : "Añadir a favoritos"}
                >
                  <Heart className={`w-5 h-5 ${esFavorito ? "fill-current" : ""}`} />
                </button>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-primary">Aprox. {libro.distance} km de distancia</span>
              </div>
              <p className="text-xs text-secondary mt-2">Estado: {textoEstado(libro.status)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 pb-44 space-y-6">
        <div className="bg-accent rounded-xl p-5 border border-border">
          <h3 className="text-secondary mb-3">Propietario</h3>
          <Link
            to={`/profile/${libro.owner.id}`}
            state={{ user: libro.owner }}
            className="flex items-center gap-3 hover:bg-white p-2 rounded-lg transition-colors -m-2"
          >
            <img
              src={libro.owner.avatar}
              alt={libro.owner.name}
              className="w-12 h-12 rounded-full object-cover"
            />
            <div className="flex-1">
              <h4 className="text-foreground">{libro.owner.name}</h4>
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-primary text-primary" />
                <span className="text-sm text-muted-foreground">
                  {libro.owner.rating} ({libro.owner.totalRatings} valoraciones)
                </span>
              </div>
            </div>
          </Link>
        </div>

        <div className="bg-accent rounded-xl p-5 border border-border space-y-3">
          <h3 className="text-secondary">Detalles</h3>
          <div className="space-y-2">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Estado</span>
              <span className="text-foreground">{libro.condition}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Disponibilidad</span>
              <span className="text-foreground">{textoEstado(libro.status)}</span>
            </div>
            {libro.isbn && (
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">ISBN</span>
                <span className="text-foreground text-sm">{libro.isbn}</span>
              </div>
            )}
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Distancia aproximada</span>
              <span className="text-foreground">{libro.distance} km</span>
            </div>
          </div>
        </div>

        <div className="bg-accent rounded-xl p-5 border border-border">
          <h3 className="text-secondary mb-3">Sinopsis</h3>
          <p className="text-muted-foreground leading-relaxed">{libro.synopsis}</p>
        </div>

        {esLibroDelUsuario && (
          <div className="bg-accent rounded-xl p-5 border border-border">
            <h3 className="text-secondary mb-3">Cambiar disponibilidad</h3>
            <div className="grid grid-cols-3 gap-2">
              {(["disponible", "reservado", "intercambiado"] as const).map((estado) => (
                <button
                  key={estado}
                  onClick={() => {
                    void cambiarEstado(estado);
                  }}
                  disabled={actualizandoEstado}
                  className={`px-2 py-2 rounded-lg text-xs border transition-colors disabled:opacity-60 ${
                    libro.status === estado
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white border-border hover:bg-accent"
                  }`}
                >
                  {textoEstado(estado)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-20 left-0 right-0 px-6 pb-4 bg-gradient-to-t from-background via-background to-transparent pt-6">
        {esLibroDelUsuario ? (
          <button
            onClick={() => {
              void borrarLibro();
            }}
            className="flex items-center justify-center gap-2 w-full bg-red-600 text-white py-4 rounded-xl hover:bg-red-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-60"
            disabled={borrandoLibro}
          >
            <span>{borrandoLibro ? "Borrando libro..." : "Borrar libro"}</span>
          </button>
        ) : (
          <button
            onClick={() => {
              void abrirChat();
            }}
            className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground py-4 rounded-xl hover:opacity-90 transition-all shadow-lg hover:shadow-xl disabled:opacity-60"
            disabled={abriendoChat || libro.status === "intercambiado"}
          >
            <MessageCircle className="w-5 h-5" />
            <span>
              {libro.status === "intercambiado"
                ? "No disponible"
                : abriendoChat
                  ? "Abriendo chat..."
                  : "Solicitar Intercambio"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
