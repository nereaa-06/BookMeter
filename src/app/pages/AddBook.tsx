import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { ArrowLeft, Camera, Search, Scan, BookOpen, ImagePlus, X } from "lucide-react";
import { currentUser } from "../data/mockData";
import { subirFotoDeLibro, subirLibro } from "../data/bookStorage";
import { useAuth } from "../auth/AuthProvider";
import { obtenerUsuarioDeSesion } from "../auth/userProfile";
import {
  guardarPreferenciaPermisoUbicacion,
  obtenerPreferenciaPermisoUbicacion,
} from "../data/locationPermissionStorage";
import { BrowserMultiFormatReader } from "@zxing/browser";
import BookCover from "../components/BookCover";
import { notificarLibroNuevo } from "../data/pushNotifications";

interface LibroEnBusca {
  isbn?: string;
  title: string;
  author: string;
  cover: string;
  synopsis: string;
}

type ItemGoogleBooks = {
  volumeInfo?: {
    title?: string;
    authors?: string[];
    description?: string;
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
    industryIdentifiers?: Array<{ type?: string; identifier?: string }>;
  };
};

export default function AddBook() {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario: usuarioSesion } = useAuth();
  const duenoAutenticado = usuarioSesion
    ? obtenerUsuarioDeSesion(usuarioSesion, currentUser.location)
    : currentUser;

    const resetearFlujoAddBook = () => {
      detenerScanner();
      setIsScannerOpen(false);
      setSearchMode(null);
      setSearchQuery("");
      setSearchResults([]);
      setSearchError("");
      setSelectedBook(null);
      setManualBook({
        title: "",
        author: "",
        isbn: "",
        cover: "",
        synopsis: "",
      });
      setManualError("");
      setArchivoPortada(null);
      setArchivosImagenesAdicionales([]);
      setScannerError("");
      setScannerEstado("Abriendo camara...");
      setCondition("good");
      setShowSuccess(false);
      setPublicando(false);
      setErrorPublicar("");
      if (previewPortada) {
        URL.revokeObjectURL(previewPortada);
      }
      setPreviewPortada(null);
      previewsImagenesAdicionales.forEach((url) => URL.revokeObjectURL(url));
      setPreviewsImagenesAdicionales([]);
    };

    useEffect(() => {
      const params = new URLSearchParams(location.search);
      if (params.has("navReset")) {
        resetearFlujoAddBook();
      }
    }, [location.search]);
  const [searchMode, setSearchMode] = useState<"scan" | "search" | "manual" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LibroEnBusca[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedBook, setSelectedBook] = useState<LibroEnBusca | null>(null);
  const [manualBook, setManualBook] = useState({
    title: "",
    author: "",
    isbn: "",
    cover: "",
    synopsis: "",
  });
  const [manualError, setManualError] = useState("");
  const [archivoPortada, setArchivoPortada] = useState<File | null>(null);
  const [archivosImagenesAdicionales, setArchivosImagenesAdicionales] = useState<File[]>([]);
  const [previewPortada, setPreviewPortada] = useState<string | null>(null);
  const [previewsImagenesAdicionales, setPreviewsImagenesAdicionales] = useState<string[]>([]);
  const [errorImagenes, setErrorImagenes] = useState("");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [scannerEstado, setScannerEstado] = useState("Abriendo camara...");
  const [condition, setCondition] = useState("good");
  const [showSuccess, setShowSuccess] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [errorPublicar, setErrorPublicar] = useState("");
  const videoScannerRef = useRef<HTMLVideoElement>(null);
  const lectorScannerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlesScannerRef = useRef<{ stop: () => void } | null>(null);
  const ultimoCodigoRef = useRef<string | null>(null);

  const COVER_POR_DEFECTO = "https://placehold.co/240x360/EDE7DD/6B6962?text=Sin+portada";
  const PESO_MAXIMO_IMAGEN_MB = 5;
  const PESO_MAXIMO_IMAGEN_BYTES = PESO_MAXIMO_IMAGEN_MB * 1024 * 1024;

  const normalizarUrlPortada = (url?: string): string => {
    if (!url) {
      return "";
    }

    const urlHttps = url.replace(/^http:\/\//i, "https://");
    return urlHttps;
  };

  const construirPortadaOpenLibrary = (isbn?: string): string | null => {
    const isbnLimpio = isbn?.trim();
    if (!isbnLimpio) {
      return null;
    }

    return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbnLimpio)}-L.jpg?default=true`;
  };

  const validarArchivoImagen = (archivo: File): string | null => {
    if (!archivo.type.startsWith("image/")) {
      return `El archivo ${archivo.name} no es una imagen valida.`;
    }

    if (archivo.size > PESO_MAXIMO_IMAGEN_BYTES) {
      return `La imagen ${archivo.name} supera ${PESO_MAXIMO_IMAGEN_MB} MB.`;
    }

    return null;
  };

  const convertirItemsGoogleABooks = (items: ItemGoogleBooks[]): LibroEnBusca[] => {
    return items
      .map((item) => {
        const volume = item?.volumeInfo ?? {};
        const identifiers = Array.isArray(volume.industryIdentifiers)
          ? volume.industryIdentifiers
          : [];

        const isbn13 = identifiers.find((id) => id?.type === "ISBN_13")?.identifier;
        const isbn10 = identifiers.find((id) => id?.type === "ISBN_10")?.identifier;
        const isbnPrincipal = isbn13 || isbn10;
        const coverGoogle = normalizarUrlPortada(
          volume.imageLinks?.thumbnail ||
          volume.imageLinks?.smallThumbnail ||
          undefined
        );
        const coverOpenLibrary = construirPortadaOpenLibrary(isbnPrincipal);
        const cover = coverGoogle || coverOpenLibrary || COVER_POR_DEFECTO;

        if (!volume.title) {
          return null;
        }

        return {
          isbn: isbn13 || isbn10,
          title: volume.title,
          author: Array.isArray(volume.authors) ? volume.authors.join(", ") : "Autor desconocido",
          cover,
          synopsis: volume.description || "Sin sinopsis disponible.",
        } as LibroEnBusca;
      })
      .filter((book): book is LibroEnBusca => Boolean(book));
  };

  const buscarGoogle = async (query: string, restringirIdioma: boolean, signal?: AbortSignal): Promise<LibroEnBusca[]> => {
    const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY || "";
    const langParam = restringirIdioma ? "&langRestrict=es" : "";
    const keyParam = apiKey ? `&key=${apiKey}` : "";
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=12${langParam}${keyParam}`;

    const response = await fetch(url, { signal });

    if (!response.ok) {
      if (!apiKey) {
        throw new Error("error-google-books-sin-clave");
      }
      throw new Error("No se pudo consultar Google Books.");
    }

    const data = await response.json();
    const items = Array.isArray(data?.items) ? (data.items as ItemGoogleBooks[]) : [];
    return convertirItemsGoogleABooks(items);
  };

  const buscarEnGoogleBooks = async (texto: string) => {
    const textoLimpio = texto.trim();
    if (!textoLimpio) {
      return;
    }

    setSearchMode("search");
    setIsSearching(true);
    setSearchError("");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const soloDigitos = textoLimpio.replace(/[^0-9Xx]/g, "");
      const queryPrincipal = /^(isbn:|intitle:|inauthor:)/i.test(textoLimpio)
        ? textoLimpio
        : soloDigitos.length >= 10
          ? `isbn:${soloDigitos}`
          : textoLimpio;

      let resultados = await buscarGoogle(queryPrincipal, true, controller.signal);

      if (resultados.length === 0) {
        resultados = await buscarGoogle(queryPrincipal, false, controller.signal);
      }

      if (resultados.length === 0 && queryPrincipal !== textoLimpio) {
        resultados = await buscarGoogle(textoLimpio, false, controller.signal);
      }

      setSearchResults(resultados);
    } catch (err) {
      setSearchResults([]);
      if (err instanceof Error && err.name === "AbortError") {
        setSearchError("La búsqueda tardó demasiado. Comprueba tu conexión e inténtalo de nuevo.");
      } else {
        setSearchError("No hemos podido cargar resultados. Inténtalo de nuevo.");
      }
    } finally {
      clearTimeout(timeoutId);
      setIsSearching(false);
    }
  };

  const buscarLibro = () => {
    void buscarEnGoogleBooks(searchQuery);
  };

  const escanearLibro = () => {
    setSearchMode("scan");
    setScannerError("");
    setScannerEstado("Pidiendo acceso a la camara...");
    setIsScannerOpen(true);
  };

  const solicitarPermisoCamara = async (): Promise<boolean> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerError("Este dispositivo no soporta acceso a camara desde la app.");
      setScannerEstado("Camara no disponible");
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });

      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      setScannerError("No diste permiso de camara. Activalo en ajustes para escanear ISBN.");
      setScannerEstado("Permiso de camara denegado");
      return false;
    }
  };

  const detenerScanner = () => {
    try {
      controlesScannerRef.current?.stop();
    } catch {
      // Si la instancia de la camara ya se cerro, seguimos reseteando el estado.
    }

    controlesScannerRef.current = null;
    lectorScannerRef.current = null;
    ultimoCodigoRef.current = null;
  };

  const cerrarEscaner = (limpiarBusqueda = true) => {
    try {
      detenerScanner();
    } finally {
      setIsScannerOpen(false);
      setScannerEstado("Abriendo camara...");
      setScannerError("");

      if (limpiarBusqueda) {
        setSearchMode(null);
        setSearchResults([]);
        setSearchQuery("");
        setSelectedBook(null);
        setManualError("");
        setArchivoPortada(null);
        if (previewPortada) {
          URL.revokeObjectURL(previewPortada);
        }
        setPreviewPortada(null);
      }
    }
  };

  const usarCodigoEscaneado = (codigo: string) => {
    const codigoLimpio = codigo.trim().replace(/[^0-9Xx]/g, "");
    if (!codigoLimpio || ultimoCodigoRef.current === codigoLimpio) {
      return;
    }

    ultimoCodigoRef.current = codigoLimpio;
    setSearchQuery(codigoLimpio);
    cerrarEscaner(false);
    void buscarEnGoogleBooks(`isbn:${codigoLimpio}`);
  };

  const probarBusquedaManualISBN = () => {
    const isbn = searchQuery.trim();
    if (!isbn) {
      setScannerError("Escribe un ISBN antes de buscar.");
      return;
    }

    cerrarEscaner(false);
    void buscarEnGoogleBooks(isbn);
  };

  const seleccionarLibro = (book: LibroEnBusca) => {
    setSelectedBook(book);
  };

  const prepararLibroManual = () => {
    const titulo = manualBook.title.trim();
    const autor = manualBook.author.trim();
    const sinopsis = manualBook.synopsis.trim();

    if (!titulo || !autor || !sinopsis) {
      setManualError("Rellena al menos titulo, autor y sinopsis.");
      return;
    }

    setManualError("");
    setSelectedBook({
      title: titulo,
      author: autor,
      isbn: manualBook.isbn.trim() || undefined,
      synopsis: sinopsis,
      cover: manualBook.cover.trim() || COVER_POR_DEFECTO,
    });
  };

  const elegirPortada = (archivo: File | null) => {
    if (!archivo) {
      return;
    }

    const errorValidacion = validarArchivoImagen(archivo);
    if (errorValidacion) {
      setErrorImagenes(errorValidacion);
      return;
    }

    setErrorImagenes("");

    if (previewPortada) {
      URL.revokeObjectURL(previewPortada);
    }

    setArchivoPortada(archivo);
    const urlTemporal = URL.createObjectURL(archivo);
    setPreviewPortada(urlTemporal);
  };

  const elegirImagenesAdicionales = (archivos: FileList | null) => {
    if (!archivos || archivos.length === 0) {
      return;
    }

    const huecosActuales = Math.max(0, 6 - archivosImagenesAdicionales.length);
    if (huecosActuales === 0) {
      setErrorImagenes("Ya has llegado al maximo de 6 imagenes adicionales.");
      return;
    }

    const nuevosArchivos = Array.from(archivos);
    const archivosValidos: File[] = [];
    const erroresValidacion: string[] = [];

    for (const archivo of nuevosArchivos) {
      const errorValidacion = validarArchivoImagen(archivo);
      if (errorValidacion) {
        erroresValidacion.push(errorValidacion);
        continue;
      }
      archivosValidos.push(archivo);
    }

    if (archivosValidos.length === 0) {
      setErrorImagenes(
        erroresValidacion[0] ?? `No se pudieron añadir imagenes. Revisa formato y peso (max ${PESO_MAXIMO_IMAGEN_MB} MB).`
      );
      return;
    }

    setArchivosImagenesAdicionales((anteriores) => {
      const huecosDisponibles = Math.max(0, 6 - anteriores.length);
      const archivosParaAnadir = archivosValidos.slice(0, huecosDisponibles);
      return [...anteriores, ...archivosParaAnadir];
    });

    setPreviewsImagenesAdicionales((anteriores) => {
      const huecosDisponibles = Math.max(0, 6 - anteriores.length);
      const archivosParaAnadir = archivosValidos.slice(0, huecosDisponibles);
      const previewsNuevas = archivosParaAnadir.map((archivo) => URL.createObjectURL(archivo));
      return [...anteriores, ...previewsNuevas];
    });

    const avisos: string[] = [];
    if (erroresValidacion.length > 0) {
      avisos.push("Algunas imagenes no se añadieron por formato o tamaño.");
    }
    if (archivosValidos.length > huecosActuales) {
      avisos.push("Solo se añadieron imagenes hasta llegar al maximo de 6.");
    }
    setErrorImagenes(avisos.length > 0 ? avisos.join(" ") : "");
  };

  const quitarImagenAdicional = (indice: number) => {
    setArchivosImagenesAdicionales((anteriores) =>
      anteriores.filter((_, index) => index !== indice)
    );

    setPreviewsImagenesAdicionales((anteriores) => {
      const urlAEliminar = anteriores[indice];
      if (urlAEliminar) {
        URL.revokeObjectURL(urlAEliminar);
      }
      return anteriores.filter((_, index) => index !== indice);
    });

    setErrorImagenes("");
  };

  useEffect(() => {
    return () => {
      if (previewPortada) {
        URL.revokeObjectURL(previewPortada);
      }

      previewsImagenesAdicionales.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewPortada, previewsImagenesAdicionales]);

  useEffect(() => {
    if (!isScannerOpen) {
      detenerScanner();
      return;
    }

    let activo = true;
    setScannerEstado("Pidiendo acceso a la camara...");
    let lectorActivo: BrowserMultiFormatReader | null = null;

    const iniciarScanner = async () => {
      const permisoConcedido = await solicitarPermisoCamara();
      if (!activo || !permisoConcedido) {
        return;
      }

      detenerScanner();
      lectorActivo = new BrowserMultiFormatReader();
      lectorScannerRef.current = lectorActivo;
      setScannerEstado("Escaneando...");

      lectorActivo.decodeFromVideoDevice(undefined, videoScannerRef.current ?? undefined, (resultado, error, controles) => {
        if (!activo) {
          controles?.stop();
          return;
        }

        if (controles && controlesScannerRef.current !== controles) {
          controlesScannerRef.current?.stop();
          controlesScannerRef.current = controles;
        }

        if (resultado) {
          setScannerEstado("Codigo detectado");
          usarCodigoEscaneado(resultado.getText());
          controles?.stop();
          return;
        }

        if (error && error.name !== "NotFoundException") {
          setScannerError("No se pudo leer el codigo. Prueba con mejor luz o escribe el ISBN a mano.");
        }
      }).catch(() => {
        if (activo) {
          setScannerError("No se pudo abrir la camara. Comprueba los permisos en ajustes.");
          setScannerEstado("Camara no disponible");
        }
      });
    };

    void iniciarScanner();

    return () => {
      activo = false;
      controlesScannerRef.current?.stop();
      controlesScannerRef.current = null;
      lectorActivo = null;
      lectorScannerRef.current = null;
    };
  }, [isScannerOpen]);

  const publicarLibro = async () => {
    if (!selectedBook || publicando) {
      return;
    }

    setPublicando(true);
    setErrorPublicar("");

    const etiquetasEstado: Record<string, string> = {
      new: "Como nuevo",
      good: "Buen estado",
      used: "Usado - Buen estado",
      fair: "Usado - Estado aceptable",
    };

    const location = await new Promise<{ lat: number; lng: number }>((resolve) => {
      if (!navigator.geolocation) {
        resolve(currentUser.location);
        return;
      }

      const preferenciaPermiso = obtenerPreferenciaPermisoUbicacion();
      if (preferenciaPermiso !== "aceptado") {
        resolve(currentUser.location);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          guardarPreferenciaPermisoUbicacion("aceptado");
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          if (error.code === 1) {
            guardarPreferenciaPermisoUbicacion("denegado");
          }
          resolve(currentUser.location);
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    });

    let portadaFinal = selectedBook.cover;
    if (archivoPortada) {
      const portadaSubida = await subirFotoDeLibro(archivoPortada, duenoAutenticado.id);
      if (!portadaSubida) {
        setErrorPublicar("No se pudo subir la foto. Prueba otra imagen.");
        setPublicando(false);
        return;
      }
      portadaFinal = portadaSubida;
    }

    const imagenesAdicionalesFinales: string[] = [];
    for (const archivo of archivosImagenesAdicionales) {
      const imagenSubida = await subirFotoDeLibro(archivo, duenoAutenticado.id);
      if (!imagenSubida) {
        setErrorPublicar("No se pudieron subir todas las imagenes adicionales.");
        setPublicando(false);
        return;
      }
      imagenesAdicionalesFinales.push(imagenSubida);
    }

    await subirLibro(
      {
        ...selectedBook,
        cover: portadaFinal,
      },
      etiquetasEstado[condition] ?? condition,
      location,
      duenoAutenticado,
      imagenesAdicionalesFinales
    );

    void notificarLibroNuevo({
      bookId: selectedBook.isbn ?? `${selectedBook.title}-${Date.now()}`,
      bookTitle: selectedBook.title,
      bookAuthor: selectedBook.author,
      ownerName: duenoAutenticado.name,
      ownerUserId: duenoAutenticado.id,
      latitude: location.lat,
      longitude: location.lng,
    });

    setShowSuccess(true);
    setPublicando(false);
    setTimeout(() => {
      navigate("/");
    }, 2000);
  };

  if (showSuccess) {
    return (
      <div className="flex-1 flex items-center justify-center pb-16 bg-background">
        <div className="text-center space-y-4 px-6">
          <div className="w-20 h-20 bg-secondary/20 rounded-full flex items-center justify-center mx-auto">
            <BookOpen className="w-10 h-10 text-secondary" />
          </div>
          <h2 className="text-primary">¡Libro añadido!</h2>
          <p className="text-muted-foreground">
            Tu libro ya está disponible para intercambio
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col pb-16 bg-background">
      <header className="bg-secondary shadow-sm px-4 py-4">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate("/")}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-white">Subir Libro</h2>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {!selectedBook && !searchMode && (
          <div className="space-y-4">
            <div className="bg-accent rounded-xl p-6 border border-border">
              <h3 className="text-secondary mb-4">¿Cómo quieres añadir tu libro?</h3>

              <div className="space-y-3">
                <button
                  onClick={escanearLibro}
                  className="w-full flex items-center gap-4 bg-primary text-primary-foreground p-4 rounded-xl hover:opacity-90 transition-opacity shadow-md hover:shadow-lg"
                >
                  <Scan className="w-6 h-6" />
                  <div className="text-left">
                    <div className="font-medium">Escanear código de barras</div>
                    <div className="text-sm opacity-90">
                      Usa la cámara para escanear el ISBN
                    </div>
                  </div>
                </button>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar por título o autor..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && buscarLibro()}
                    className="w-full pl-12 pr-4 py-3 bg-white border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  {searchQuery && (
                    <button
                      onClick={buscarLibro}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary text-primary-foreground px-4 py-1.5 rounded-lg text-sm hover:opacity-90 transition-opacity"
                    >
                      Buscar
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setSearchMode("manual")}
                  className="w-full border-2 border-border rounded-xl p-3 text-foreground hover:bg-white hover:shadow-sm transition-all"
                >
                  Mi libro no aparece · Añadir manualmente
                </button>
              </div>
            </div>

            <div className="bg-accent/60 rounded-xl p-4 border border-border">
              <p className="text-sm text-muted-foreground">
                💡 <span className="font-medium">Tip:</span> Al escanear el código de barras
                obtendremos automáticamente la portada, autor y sinopsis del libro.
              </p>
            </div>
          </div>
        )}

        {searchMode === "scan" && !selectedBook && (
          <div className="bg-accent rounded-xl p-6 border border-border">
            <div className="text-center space-y-4">
              <div className="w-32 h-32 border-4 border-primary rounded-xl mx-auto flex items-center justify-center animate-pulse bg-white/60">
                <Camera className="w-16 h-16 text-primary" />
              </div>
              <h3 className="text-secondary">Escaneando código de barras...</h3>
              <p className="text-sm text-muted-foreground">
                Se abrirá la cámara para leer el ISBN automáticamente.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  onClick={() => {
                    setSearchMode("search");
                    setSearchQuery("");
                    setIsScannerOpen(false);
                  }}
                  className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-white transition-colors"
                >
                  Buscar manualmente
                </button>
                <button
                  onClick={() => setSearchMode(null)}
                  className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-white transition-colors"
                >
                  Volver
                </button>
              </div>
            </div>
          </div>
        )}

        {searchMode === "search" && !selectedBook && (
          <div className="space-y-3">
            <h3 className="text-secondary px-1">Resultados de búsqueda</h3>
            {isSearching && (
              <div className="bg-accent rounded-xl p-5 border border-border text-center text-muted-foreground">
                Buscando en Google Books...
              </div>
            )}

            {!isSearching && searchError && (
              <div className="bg-accent rounded-xl p-5 border border-border text-center space-y-3">
                <p className="text-destructive">{searchError}</p>
                <button
                  onClick={buscarLibro}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
                >
                  Reintentar
                </button>
              </div>
            )}

            {!isSearching && !searchError && searchResults.length === 0 && (
              <div className="bg-accent rounded-xl p-5 border border-border text-center text-muted-foreground space-y-3">
                <p>No se encontraron libros para esta busqueda.</p>
                <button
                  onClick={() => setSearchMode("manual")}
                  className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-white hover:shadow-sm transition-all"
                >
                  Añadir manualmente
                </button>
              </div>
            )}

            {!isSearching && !searchError && searchResults.map((book, index) => (
              <button
                key={`${book.isbn ?? book.title}-${index}`}
                onClick={() => seleccionarLibro(book)}
                className="w-full flex gap-4 bg-accent rounded-xl p-4 border border-border hover:border-primary hover:shadow-md transition-all text-left"
              >
                <BookCover
                  src={book.cover}
                  alt={book.title}
                  className="w-16 h-24 object-cover"
                  containerClassName="w-16 h-24 rounded-lg"
                />
                <div className="flex-1">
                  <h4 className="text-foreground mb-1">{book.title}</h4>
                  <p className="text-sm text-muted-foreground mb-2">{book.author}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {book.synopsis}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {searchMode === "manual" && !selectedBook && (
          <div className="space-y-4">
            <div className="bg-accent rounded-xl p-6 border border-border space-y-4">
              <h3 className="text-secondary">Añadir libro manualmente</h3>

              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Titulo *"
                  value={manualBook.title}
                  onChange={(e) => setManualBook((anterior) => ({ ...anterior, title: e.target.value }))}
                  className="w-full px-4 py-3 bg-white border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20"
                />

                <input
                  type="text"
                  placeholder="Autor *"
                  value={manualBook.author}
                  onChange={(e) => setManualBook((anterior) => ({ ...anterior, author: e.target.value }))}
                  className="w-full px-4 py-3 bg-white border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20"
                />

                <input
                  type="text"
                  placeholder="ISBN (opcional)"
                  value={manualBook.isbn}
                  onChange={(e) => setManualBook((anterior) => ({ ...anterior, isbn: e.target.value }))}
                  className="w-full px-4 py-3 bg-white border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20"
                />

                <input
                  type="url"
                  placeholder="URL de portada (opcional)"
                  value={manualBook.cover}
                  onChange={(e) => setManualBook((anterior) => ({ ...anterior, cover: e.target.value }))}
                  className="w-full px-4 py-3 bg-white border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20"
                />

                <textarea
                  placeholder="Sinopsis *"
                  value={manualBook.synopsis}
                  onChange={(e) => setManualBook((anterior) => ({ ...anterior, synopsis: e.target.value }))}
                  rows={4}
                  className="w-full px-4 py-3 bg-white border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>

              {manualError && (
                <p className="text-sm text-destructive">{manualError}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSearchMode(null);
                    setManualError("");
                  }}
                  className="flex-1 px-4 py-3 border-2 border-border rounded-xl text-foreground hover:bg-white hover:shadow-sm transition-all"
                >
                  Volver
                </button>
                <button
                  onClick={prepararLibroManual}
                  className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 hover:shadow-lg transition-all shadow-md"
                >
                  Continuar
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedBook && (
          <div className="space-y-6">
            <div className="bg-accent rounded-xl p-6 border border-border space-y-4">
              <h3 className="text-secondary">Detalles del libro</h3>

              <div className="flex gap-4">
                <BookCover
                  src={previewPortada ?? selectedBook.cover}
                  alt={selectedBook.title}
                  className="w-24 h-36 object-cover"
                  containerClassName="w-24 h-36 rounded-lg shadow-md"
                />
                <div className="flex-1">
                  <h4 className="text-foreground mb-1">{selectedBook.title}</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    {selectedBook.author}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ISBN: {selectedBook.isbn}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {selectedBook.synopsis}
                </p>
              </div>

              <div className="pt-4 border-t border-border space-y-2">
                <label className="text-sm text-foreground block">Foto del libro (opcional)</label>
                <label className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-border rounded-xl bg-white hover:shadow-sm transition-all cursor-pointer">
                  <ImagePlus className="w-4 h-4" />
                  <span className="text-sm text-foreground">Elegir imagen</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => elegirPortada(e.target.files?.[0] ?? null)}
                  />
                </label>
                {archivoPortada && (
                  <p className="text-xs text-muted-foreground">Seleccionada: {archivoPortada.name}</p>
                )}
                {errorImagenes && (
                  <p className="text-xs text-destructive">{errorImagenes}</p>
                )}
              </div>

              <div className="pt-4 border-t border-border space-y-2">
                <label className="text-sm text-foreground block">Imagenes adicionales del libro (opcional, max 6)</label>
                <label className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-border rounded-xl bg-white hover:shadow-sm transition-all cursor-pointer">
                  <ImagePlus className="w-4 h-4" />
                  <span className="text-sm text-foreground">Elegir imagenes</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => elegirImagenesAdicionales(e.target.files)}
                  />
                </label>
                {archivosImagenesAdicionales.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Seleccionadas: {archivosImagenesAdicionales.length}
                  </p>
                )}

                {previewsImagenesAdicionales.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {previewsImagenesAdicionales.map((url, index) => (
                      <div key={`${url}-${index}`} className="relative aspect-[3/4] rounded-lg border border-border bg-muted/40 overflow-hidden">
                        <img
                          src={url}
                          alt={`Imagen adicional ${index + 1}`}
                          className="w-full h-full object-contain"
                        />
                        <button
                          type="button"
                          onClick={() => quitarImagenAdicional(index)}
                          className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white hover:bg-black/85 transition-colors"
                          aria-label={`Quitar imagen adicional ${index + 1}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {errorImagenes && (
                  <p className="text-xs text-destructive">{errorImagenes}</p>
                )}
              </div>
            </div>

            <div className="bg-accent rounded-xl p-6 border border-border space-y-4">
              <h3 className="text-secondary">Estado del libro</h3>

              <div className="space-y-2">
                {[
                  { value: "new", label: "Como nuevo" },
                  { value: "good", label: "Buen estado" },
                  { value: "used", label: "Usado - Buen estado" },
                  { value: "fair", label: "Usado - Estado aceptable" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-white hover:shadow-sm transition-all bg-white/50"
                  >
                    <input
                      type="radio"
                      name="condition"
                      value={option.value}
                      checked={condition === option.value}
                      onChange={(e) => setCondition(e.target.value)}
                      className="w-4 h-4 text-primary"
                    />
                    <span className="text-foreground">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedBook(null);
                  setSearchMode(null);
                  setSearchQuery("");
                }}
                className="flex-1 px-6 py-3 border-2 border-border rounded-xl text-foreground hover:bg-white hover:shadow-sm transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={publicarLibro}
                disabled={publicando}
                className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 hover:shadow-lg transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {publicando ? "Publicando..." : "Publicar libro"}
              </button>
            </div>
            {errorPublicar && <p className="text-sm text-destructive">{errorPublicar}</p>}
          </div>
        )}
      </div>

      {isScannerOpen && (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)] sm:p-4">
          <div className="w-full max-w-sm sm:max-w-md max-h-[86dvh] bg-background rounded-3xl overflow-hidden shadow-2xl border border-border flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 bg-secondary text-white">
              <div>
                <h3 className="text-white">Escanear ISBN</h3>
                <p className="text-xs text-white/80">{scannerEstado}</p>
              </div>
              <button
                onClick={() => cerrarEscaner()}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Cerrar escáner"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] space-y-4 overflow-y-auto">
              <div className="relative aspect-[4/3] max-h-[28dvh] rounded-2xl overflow-hidden bg-black border border-border">
                <video
                  ref={videoScannerRef}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
                <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-px bg-primary/80 shadow-[0_0_20px_rgba(224,109,79,0.9)]" />
                <div className="absolute inset-0 border-2 border-dashed border-white/25 rounded-2xl" />
              </div>

              {scannerError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {scannerError}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm text-foreground block">Si la cámara falla, escribe el ISBN</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="978..."
                    className="flex-1 px-4 py-3 bg-white border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    onClick={probarBusquedaManualISBN}
                    className="w-full sm:w-auto px-4 py-3 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-colors"
                  >
                    Buscar
                  </button>
                </div>
              </div>

              <button
                onClick={() => cerrarEscaner()}
                className="w-full px-4 py-3 rounded-xl bg-secondary text-white hover:opacity-90 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
