import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { ArrowLeft, MapPin, Star, MessageCircle, Heart, ImagePlus, X } from "lucide-react";
import type { Book } from "../data/mockData";
import { currentUser } from "../data/mockData";
import {
  obtenerLibroPorId,
  eliminarLibroSubido,
  actualizarEstadoLibro,
  actualizarLibroSubido,
  subirFotoDeLibro,
} from "../data/bookStorage";
import { crearOAbrirChatPorLibro } from "../data/chatStorage";
import { useAuth } from "../auth/AuthProvider";
import BookCover from "../components/BookCover";
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
  const [editandoLibro, setEditandoLibro] = useState(false);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [tituloEditado, setTituloEditado] = useState("");
  const [autorEditado, setAutorEditado] = useState("");
  const [isbnEditado, setIsbnEditado] = useState("");
  const [estadoFisicoEditado, setEstadoFisicoEditado] = useState("");
  const [descripcionEditada, setDescripcionEditada] = useState("");
  const [mensajeEdicion, setMensajeEdicion] = useState("");
  const [errorEdicion, setErrorEdicion] = useState("");
  const [archivoPortadaEditada, setArchivoPortadaEditada] = useState<File | null>(null);
  const [previewPortadaEditada, setPreviewPortadaEditada] = useState("");
  const [imagenesExistentesEditadas, setImagenesExistentesEditadas] = useState<string[]>([]);
  const [archivosNuevasImagenes, setArchivosNuevasImagenes] = useState<File[]>([]);
  const [previewsNuevasImagenes, setPreviewsNuevasImagenes] = useState<string[]>([]);
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

  useEffect(() => {
    return () => {
      if (previewPortadaEditada) {
        URL.revokeObjectURL(previewPortadaEditada);
      }
      previewsNuevasImagenes.forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, [previewPortadaEditada, previewsNuevasImagenes]);

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

  const iniciarEdicion = () => {
    if (!libro) {
      return;
    }

    setTituloEditado(libro.title);
    setAutorEditado(libro.author);
    setIsbnEditado(libro.isbn ?? "");
    setEstadoFisicoEditado(libro.condition);
    setDescripcionEditada(libro.synopsis);
    setArchivoPortadaEditada(null);
    setPreviewPortadaEditada("");
    setArchivosNuevasImagenes([]);
    setPreviewsNuevasImagenes([]);
    setImagenesExistentesEditadas(Array.isArray(libro.imagenesAdicionales) ? [...libro.imagenesAdicionales] : []);
    setErrorEdicion("");
    setMensajeEdicion("");
    setEditandoLibro(true);
  };

  const limpiarSeleccionImagenesEdicion = () => {
    if (previewPortadaEditada) {
      URL.revokeObjectURL(previewPortadaEditada);
    }
    previewsNuevasImagenes.forEach((url) => {
      URL.revokeObjectURL(url);
    });

    setArchivoPortadaEditada(null);
    setPreviewPortadaEditada("");
    setImagenesExistentesEditadas([]);
    setArchivosNuevasImagenes([]);
    setPreviewsNuevasImagenes([]);
  };

  const cancelarEdicion = () => {
    limpiarSeleccionImagenesEdicion();
    setEditandoLibro(false);
    setErrorEdicion("");
  };

  const elegirPortadaEdicion = (archivo: File | null) => {
    if (!archivo) {
      return;
    }

    if (previewPortadaEditada) {
      URL.revokeObjectURL(previewPortadaEditada);
    }

    setArchivoPortadaEditada(archivo);
    setPreviewPortadaEditada(URL.createObjectURL(archivo));
    setErrorEdicion("");
  };

  const elegirImagenesAdicionalesEdicion = (lista: FileList | null) => {
    if (!lista || lista.length === 0) {
      return;
    }

    const archivosSeleccionados = Array.from(lista);
    const maximo = 6;
    const disponibles = maximo - imagenesExistentesEditadas.length - archivosNuevasImagenes.length;

    if (disponibles <= 0) {
      setErrorEdicion("Solo puedes tener hasta 6 imagenes adicionales.");
      return;
    }

    const archivosFinales = archivosSeleccionados.slice(0, disponibles);
    if (archivosFinales.length < archivosSeleccionados.length) {
      setErrorEdicion("Has superado el limite de 6 imagenes adicionales.");
    } else {
      setErrorEdicion("");
    }

    const nuevasPreviews = archivosFinales.map((archivo) => URL.createObjectURL(archivo));
    setArchivosNuevasImagenes((previas) => [...previas, ...archivosFinales]);
    setPreviewsNuevasImagenes((previas) => [...previas, ...nuevasPreviews]);
  };

  const quitarImagenExistenteEdicion = (index: number) => {
    setImagenesExistentesEditadas((anteriores) => anteriores.filter((_, i) => i !== index));
    setErrorEdicion("");
  };

  const quitarImagenNuevaEdicion = (index: number) => {
    const previewAQuitar = previewsNuevasImagenes[index];
    if (previewAQuitar) {
      URL.revokeObjectURL(previewAQuitar);
    }

    setArchivosNuevasImagenes((anteriores) => anteriores.filter((_, i) => i !== index));
    setPreviewsNuevasImagenes((anteriores) => anteriores.filter((_, i) => i !== index));
    setErrorEdicion("");
  };

  const guardarEdicionLibro = async () => {
    if (!libro || !usuarioSesion || !esLibroDelUsuario || guardandoEdicion) {
      return;
    }

    const titulo = tituloEditado.trim();
    const autor = autorEditado.trim();
    const descripcion = descripcionEditada.trim();
    const estadoFisico = estadoFisicoEditado.trim();
    const isbn = isbnEditado.trim();

    if (!titulo || !autor || !descripcion || !estadoFisico) {
      setErrorEdicion("Completa titulo, autor, estado y descripcion.");
      return;
    }

    setGuardandoEdicion(true);
    setErrorEdicion("");
    setMensajeEdicion("");

    let portadaFinal = libro.cover;
    if (archivoPortadaEditada) {
      const portadaSubida = await subirFotoDeLibro(archivoPortadaEditada, usuarioSesion.id);
      if (!portadaSubida) {
        setGuardandoEdicion(false);
        setErrorEdicion("No se pudo subir la nueva portada.");
        return;
      }
      portadaFinal = portadaSubida;
    }

    const nuevasImagenesSubidas: string[] = [];
    for (const archivo of archivosNuevasImagenes) {
      const imagenSubida = await subirFotoDeLibro(archivo, usuarioSesion.id);
      if (!imagenSubida) {
        setGuardandoEdicion(false);
        setErrorEdicion("No se pudieron subir todas las imagenes nuevas.");
        return;
      }
      nuevasImagenesSubidas.push(imagenSubida);
    }

    const imagenesAdicionalesFinales = [...imagenesExistentesEditadas, ...nuevasImagenesSubidas].slice(0, 6);

    const actualizado = await actualizarLibroSubido(libro.id, usuarioSesion.id, {
      title: titulo,
      author: autor,
      synopsis: descripcion,
      condition: estadoFisico,
      isbn: isbn || undefined,
      cover: portadaFinal,
      imagenesAdicionales: imagenesAdicionalesFinales,
    });

    setGuardandoEdicion(false);

    if (!actualizado) {
      setErrorEdicion("No se pudo guardar la edición del libro.");
      return;
    }

    setLibro((anterior) =>
      anterior
        ? {
            ...anterior,
            title: titulo,
            author: autor,
            cover: portadaFinal,
            imagenesAdicionales: imagenesAdicionalesFinales,
            synopsis: descripcion,
            condition: estadoFisico,
            isbn: isbn || undefined,
          }
        : anterior
    );

    limpiarSeleccionImagenesEdicion();
    setMensajeEdicion("Cambios guardados.");
    setEditandoLibro(false);
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
        <BookCover
          src={libro.cover}
          alt={libro.title}
          className="w-full h-96 object-cover"
          containerClassName="w-full h-96"
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
            <BookCover
              src={libro.cover}
              alt={libro.title}
              className="w-24 h-36 object-cover"
              containerClassName="w-24 h-36 rounded-lg shadow-xl"
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
          <h3 className="text-secondary mb-3">Descripcion del libro</h3>
          <p className="text-muted-foreground leading-relaxed">{libro.synopsis}</p>
        </div>

        {esLibroDelUsuario && (
          <div className="bg-accent rounded-xl p-5 border border-border space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-secondary">Editar libro</h3>
              {!editandoLibro && (
                <button
                  type="button"
                  onClick={iniciarEdicion}
                  className="px-3 py-1.5 rounded-lg text-xs border border-border hover:bg-white transition-colors"
                >
                  Editar datos
                </button>
              )}
            </div>

            {editandoLibro ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={tituloEditado}
                  onChange={(e) => setTituloEditado(e.target.value)}
                  placeholder="Titulo"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
                <input
                  type="text"
                  value={autorEditado}
                  onChange={(e) => setAutorEditado(e.target.value)}
                  placeholder="Autor"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
                <input
                  type="text"
                  value={estadoFisicoEditado}
                  onChange={(e) => setEstadoFisicoEditado(e.target.value)}
                  placeholder="Estado fisico del libro"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
                <input
                  type="text"
                  value={isbnEditado}
                  onChange={(e) => setIsbnEditado(e.target.value)}
                  placeholder="ISBN (opcional)"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
                <textarea
                  value={descripcionEditada}
                  onChange={(e) => setDescripcionEditada(e.target.value)}
                  placeholder="Descripcion del libro"
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm outline-none resize-none focus:ring-2 focus:ring-primary/20"
                />

                <div className="space-y-2 pt-2 border-t border-border">
                  <label className="text-xs text-muted-foreground block">Portada del libro</label>
                  <BookCover
                    src={previewPortadaEditada || libro.cover}
                    alt={tituloEditado || libro.title}
                    className="w-20 h-28 object-cover"
                    containerClassName="w-20 h-28 rounded-md border border-border"
                  />
                  <label className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg bg-white hover:shadow-sm transition-all cursor-pointer">
                    <ImagePlus className="w-4 h-4" />
                    <span className="text-xs text-foreground">Cambiar portada</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => elegirPortadaEdicion(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>

                <div className="space-y-2 pt-2 border-t border-border">
                  <label className="text-xs text-muted-foreground block">Imagenes adicionales (max 6)</label>
                  <label className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg bg-white hover:shadow-sm transition-all cursor-pointer">
                    <ImagePlus className="w-4 h-4" />
                    <span className="text-xs text-foreground">Añadir imagenes</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => elegirImagenesAdicionalesEdicion(e.target.files)}
                    />
                  </label>

                  {(imagenesExistentesEditadas.length > 0 || previewsNuevasImagenes.length > 0) && (
                    <div className="grid grid-cols-3 gap-2">
                      {imagenesExistentesEditadas.map((url, index) => (
                        <div key={`existente-${url}-${index}`} className="relative aspect-[3/4] rounded-md border border-border overflow-hidden bg-muted/40">
                          <img src={url} alt={`Imagen existente ${index + 1}`} className="w-full h-full object-contain" />
                          <button
                            type="button"
                            onClick={() => quitarImagenExistenteEdicion(index)}
                            className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white hover:bg-black/85"
                            aria-label={`Quitar imagen existente ${index + 1}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}

                      {previewsNuevasImagenes.map((url, index) => (
                        <div key={`nueva-${url}-${index}`} className="relative aspect-[3/4] rounded-md border border-border overflow-hidden bg-muted/40">
                          <img src={url} alt={`Imagen nueva ${index + 1}`} className="w-full h-full object-contain" />
                          <button
                            type="button"
                            onClick={() => quitarImagenNuevaEdicion(index)}
                            className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white hover:bg-black/85"
                            aria-label={`Quitar imagen nueva ${index + 1}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {errorEdicion && <p className="text-sm text-destructive">{errorEdicion}</p>}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={cancelarEdicion}
                    className="flex-1 px-4 py-2 rounded-lg border border-border text-sm hover:bg-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void guardarEdicionLibro();
                    }}
                    disabled={guardandoEdicion}
                    className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 transition-colors disabled:opacity-60"
                  >
                    {guardandoEdicion ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Puedes editar titulo, autor, estado fisico, ISBN, descripcion y fotos de este libro.
              </p>
            )}

            {mensajeEdicion && !editandoLibro && (
              <p className="text-sm text-secondary">{mensajeEdicion}</p>
            )}
          </div>
        )}

        {Array.isArray(libro.imagenesAdicionales) && libro.imagenesAdicionales.length > 0 && (
          <div className="bg-accent rounded-xl p-5 border border-border">
            <h3 className="text-secondary mb-3">Imagenes subidas por el usuario</h3>
            <div className="grid grid-cols-2 gap-3">
              {libro.imagenesAdicionales.map((imagen, index) => (
                <div key={`${imagen}-${index}`} className="aspect-[3/4] rounded-lg border border-border bg-muted/40 overflow-hidden">
                  <img
                    src={imagen}
                    alt={`Imagen adicional del libro ${index + 1}`}
                    className="w-full h-full object-contain"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

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
