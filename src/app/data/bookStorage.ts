import { Book, currentUser, mockBooks } from "./mockData";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { subirImagenASupabase } from "./imageStorage";
import { calcularDistanciaKm } from "../lib/geoUtils";

const STORAGE_KEY = "bookmeter-uploaded-books";
const STORAGE_KEY_IMAGENES_ADICIONALES = "bookmeter-book-extra-images";
const EVENTO_LIBROS_CAMBIADOS = "bookmeter:books-changed";

interface ResultadoBusquedaLibro {
  isbn?: string;
  title: string;
  author: string;
  cover: string;
  synopsis: string;
}

type CambiosLibroEditable = {
  title: string;
  author: string;
  synopsis: string;
  condition: string;
  isbn?: string;
  cover?: string;
  imagenesAdicionales?: string[];
};

const LEGACY_CURRENT_USER_ID = "current-user";

export interface PropietarioActivo {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  totalRatings: number;
  location: {
    lat: number;
    lng: number;
  };
}

type ImagenesAdicionalesPorLibro = Record<string, string[]>;

function leerImagenesAdicionalesPorLibro(): ImagenesAdicionalesPorLibro {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_IMAGENES_ADICIONALES);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return parsed as ImagenesAdicionalesPorLibro;
  } catch {
    return {};
  }
}

function guardarImagenesAdicionalesPorLibro(mapa: ImagenesAdicionalesPorLibro): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY_IMAGENES_ADICIONALES, JSON.stringify(mapa));
}

function normalizarListaImagenesAdicionales(imagenes: unknown): string[] {
  if (!Array.isArray(imagenes)) {
    return [];
  }

  return imagenes
    .filter((imagen): imagen is string => typeof imagen === "string")
    .map((imagen) => normalizarUrlPortada(imagen))
    .filter(Boolean);
}

function obtenerImagenesAdicionalesDeLibro(bookId: string): string[] {
  const mapa = leerImagenesAdicionalesPorLibro();
  return normalizarListaImagenesAdicionales(mapa[bookId]);
}

function guardarImagenesAdicionalesDeLibro(bookId: string, imagenes: string[]): void {
  const mapa = leerImagenesAdicionalesPorLibro();
  mapa[bookId] = normalizarListaImagenesAdicionales(imagenes);
  guardarImagenesAdicionalesPorLibro(mapa);
}

function eliminarImagenesAdicionalesDeLibro(bookId: string): void {
  const mapa = leerImagenesAdicionalesPorLibro();
  if (bookId in mapa) {
    delete mapa[bookId];
    guardarImagenesAdicionalesPorLibro(mapa);
  }
}

function leerLibrosSubidosLocales(): Book[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const librosNormalizados = (parsed as Book[]).map((libro) => ({
      ...libro,
      cover: resolverPortada(libro.cover, libro.isbn),
    }));

    if (JSON.stringify(librosNormalizados) !== raw) {
      guardarLibrosSubidosLocales(librosNormalizados);
    }

    return librosNormalizados;
  } catch {
    return [];
  }
}

function guardarLibrosSubidosLocales(libros: Book[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(libros));
}

function notificarCambioDeLibros(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(EVENTO_LIBROS_CAMBIADOS));
}

function normalizarUrlPortada(url?: string | null): string {
  if (!url || !url.trim()) {
    return "";
  }

  return url.trim().replace(/^http:\/\//i, "https://");
}

function construirPortadaPorIsbn(isbn?: string | null): string {
  const isbnLimpio = typeof isbn === "string" ? isbn.trim() : "";
  if (!isbnLimpio) {
    return "";
  }

  return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbnLimpio)}-L.jpg?default=true`;
}

function resolverPortada(cover?: string | null, isbn?: string | null): string {
  const portadaNormalizada = normalizarUrlPortada(cover);
  if (portadaNormalizada) {
    return portadaNormalizada;
  }

  const portadaPorISBN = construirPortadaPorIsbn(isbn);
  if (portadaPorISBN) {
    return portadaPorISBN;
  }

  return "https://placehold.co/240x360/EDE7DD/6B6962?text=Sin+portada";
}

function normalizarLibro(libro: Book): Book {
  const latFallback = numeroSeguro(libro.owner?.location?.lat, currentUser.location.lat);
  const lngFallback = numeroSeguro(libro.owner?.location?.lng, currentUser.location.lng);
  const lat = numeroSeguro(libro.location?.lat, latFallback);
  const lng = numeroSeguro(libro.location?.lng, lngFallback);

  return {
    ...libro,
    cover: resolverPortada(libro.cover, libro.isbn),
    imagenesAdicionales: normalizarListaImagenesAdicionales(libro.imagenesAdicionales),
    status:
      libro.status === "reservado" || libro.status === "intercambiado"
        ? libro.status
        : "disponible",
    owner: {
      ...libro.owner,
      location: {
        lat: latFallback,
        lng: lngFallback,
      },
    },
    location: {
      lat,
      lng,
    },
  };
}

function anadirDistanciaCalculada(libros: Book[]): Book[] {
  return libros.map((libro) => {
    const libroNormalizado = normalizarLibro(libro);

    return {
      ...libroNormalizado,
      imagenesAdicionales:
        libroNormalizado.imagenesAdicionales && libroNormalizado.imagenesAdicionales.length > 0
          ? libroNormalizado.imagenesAdicionales
          : obtenerImagenesAdicionalesDeLibro(libroNormalizado.id),
      distance: calcularDistanciaKm(currentUser.location, libroNormalizado.location),
    };
  });
}

function combinarLibrosSinDuplicar(librosA: Book[], librosB: Book[]): Book[] {
  const mapa = new Map<string, Book>();

  for (const libro of [...librosA, ...librosB]) {
    mapa.set(libro.id, libro);
  }

  return Array.from(mapa.values());
}

interface SupabaseBookRow {
  id?: string;
  titulo?: string;
  title?: string;
  autor?: string;
  author?: string;
  portada?: string;
  cover?: string;
  sinopsis?: string;
  synopsis?: string;
  estado?: string;
  disponibilidad?: "disponible" | "reservado" | "intercambiado" | null;
  condition?: string;
  isbn?: string | null;
  imagenes_adicionales?: string[] | null;
  propietario_id?: string;
  owner_id?: string;
  nombre_propietario?: string;
  owner_name?: string;
  avatar_propietario?: string;
  owner_avatar?: string;
  valoracion_propietario?: number;
  owner_rating?: number;
  total_valoraciones_propietario?: number;
  owner_total_ratings?: number;
  ubicacion_lat?: number;
  location_lat?: number;
  ubicacion_lng?: number;
  location_lng?: number;
}

function textoSeguro(valor: unknown, fallback = ""): string {
  return typeof valor === "string" && valor.trim() ? valor : fallback;
}

function numeroSeguro(valor: unknown, fallback: number): number {
  if (typeof valor === "number" && Number.isFinite(valor)) {
    return valor;
  }

  if (typeof valor === "string") {
    const numero = Number(valor.trim().replace(",", "."));
    if (Number.isFinite(numero)) {
      return numero;
    }
  }

  return fallback;
}

function filaALibro(fila: SupabaseBookRow): Book {
  const latitud = numeroSeguro(fila.ubicacion_lat ?? fila.location_lat, currentUser.location.lat);
  const longitud = numeroSeguro(fila.ubicacion_lng ?? fila.location_lng, currentUser.location.lng);
  const imagenesAdicionales = normalizarListaImagenesAdicionales(fila.imagenes_adicionales);

  return {
    id: textoSeguro(fila.id, `book-${Date.now()}`),
    title: textoSeguro(fila.titulo ?? fila.title, "Sin título"),
    author: textoSeguro(fila.autor ?? fila.author, "Autor desconocido"),
    cover: resolverPortada(fila.portada ?? fila.cover, fila.isbn),
    synopsis: textoSeguro(fila.sinopsis ?? fila.synopsis, "Sin sinopsis"),
    condition: textoSeguro(fila.estado ?? fila.condition, "Buen estado"),
    status: fila.disponibilidad === "reservado" || fila.disponibilidad === "intercambiado"
      ? fila.disponibilidad
      : "disponible",
    isbn: fila.isbn ?? undefined,
    imagenesAdicionales,
    owner: {
      id: textoSeguro(fila.propietario_id ?? fila.owner_id, currentUser.id),
      name: textoSeguro(fila.nombre_propietario ?? fila.owner_name, currentUser.name),
      avatar: textoSeguro(fila.avatar_propietario ?? fila.owner_avatar, currentUser.avatar),
      rating: numeroSeguro(fila.valoracion_propietario ?? fila.owner_rating, 0),
      totalRatings: numeroSeguro(fila.total_valoraciones_propietario ?? fila.owner_total_ratings, 0),
      location: {
        lat: latitud,
        lng: longitud,
      },
    },
    distance: calcularDistanciaKm(currentUser.location, {
      lat: latitud,
      lng: longitud,
    }),
    location: {
      lat: latitud,
      lng: longitud,
    },
  };
}

async function obtenerLibrosDeSupabase(): Promise<Book[] | null> {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("books")
    .select("*")
    .order("creado_en", { ascending: false });

  if (error || !data) {
    return null;
  }

  return data.map((fila) => filaALibro(fila as SupabaseBookRow));
}

async function getAllBooks(): Promise<Book[]> {
  const librosRemotos = await obtenerLibrosDeSupabase();
  if (librosRemotos) {
    const librosLocales = leerLibrosSubidosLocales();
    return anadirDistanciaCalculada(combinarLibrosSinDuplicar(librosRemotos, librosLocales));
  }

  return anadirDistanciaCalculada([...mockBooks, ...leerLibrosSubidosLocales()]);
}

async function getBookById(id: string): Promise<Book | undefined> {
  const books = await getAllBooks();
  return books.find((book) => book.id === id);
}

async function getCurrentUserLibrary(ownerId: string): Promise<Book[]> {
  const libros = await getAllBooks();
  const librosRemotosDelUsuario = libros.filter(
    (libro) => libro.owner.id === ownerId || libro.owner.id === LEGACY_CURRENT_USER_ID
  );

  if (librosRemotosDelUsuario.length > 0) {
    return librosRemotosDelUsuario;
  }

  const librosLocalesDelUsuario = leerLibrosSubidosLocales().filter((libro) => libro.owner.id === ownerId);
  return anadirDistanciaCalculada(librosLocalesDelUsuario);
}

async function addUploadedBook(
  bookData: ResultadoBusquedaLibro,
  condition: string,
  location: { lat: number; lng: number },
  owner: PropietarioActivo,
  imagenesAdicionales: string[] = []
): Promise<Book> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("books")
      .insert({
        titulo: bookData.title,
        autor: bookData.author,
        portada: bookData.cover,
        sinopsis: bookData.synopsis,
        estado: condition,
        disponibilidad: "disponible",
        isbn: bookData.isbn ?? null,
        imagenes_adicionales: normalizarListaImagenesAdicionales(imagenesAdicionales),
        propietario_id: owner.id,
        nombre_propietario: owner.name,
        avatar_propietario: owner.avatar,
        valoracion_propietario: owner.rating,
        total_valoraciones_propietario: owner.totalRatings,
        ubicacion_lat: location.lat,
        ubicacion_lng: location.lng,
      })
      .select("*")
      .single();

    if (!error && data) {
      notificarCambioDeLibros();
      return filaALibro(data as SupabaseBookRow);
    }
  }

  const librosLocales = leerLibrosSubidosLocales();

  const libroNuevo: Book = {
    id: `uploaded-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: bookData.title,
    author: bookData.author,
    cover: resolverPortada(bookData.cover, bookData.isbn),
    synopsis: bookData.synopsis,
    condition,
    status: "disponible",
    isbn: bookData.isbn,
    imagenesAdicionales: normalizarListaImagenesAdicionales(imagenesAdicionales),
    owner,
    distance: calcularDistanciaKm(owner.location, location),
    location,
  };

  guardarLibrosSubidosLocales([libroNuevo, ...librosLocales]);
  notificarCambioDeLibros();
  return libroNuevo;
}

async function subirFotoLibro(archivo: File, propietarioId: string): Promise<string | null> {
  const urlSupabase = await subirImagenASupabase(archivo, "book-images", propietarioId, "book");
  // Solo guardamos URL de Supabase para que la imagen funcione para todos.
  // Si falla la subida, devolvemos null y evitamos guardar una ruta rota.
  if (urlSupabase) {
    return urlSupabase;
  }

  return null;
}

async function deleteUploadedBook(bookId: string, ownerId: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from("books")
      .delete()
      .eq("id", bookId)
      .eq("propietario_id", ownerId);

    if (!error) {
      eliminarImagenesAdicionalesDeLibro(bookId);
      return true;
    }
  }

  const librosLocales = leerLibrosSubidosLocales();
  const totalAntes = librosLocales.length;
  const filtrados = librosLocales.filter((libro) => !(libro.id === bookId && libro.owner.id === ownerId));
  guardarLibrosSubidosLocales(filtrados);
  if (filtrados.length !== totalAntes) {
    eliminarImagenesAdicionalesDeLibro(bookId);
    notificarCambioDeLibros();
  }
  return filtrados.length < totalAntes;
}

async function updateBookStatus(
  bookId: string,
  ownerId: string,
  status: "disponible" | "reservado" | "intercambiado"
): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from("books")
      .update({ disponibilidad: status })
      .eq("id", bookId)
      .eq("propietario_id", ownerId);

    if (!error) {
      return true;
    }
  }

  const librosLocales = leerLibrosSubidosLocales();
  let cambiado = false;
  const actualizados = librosLocales.map((libro) => {
    if (libro.id === bookId && libro.owner.id === ownerId) {
      cambiado = true;
      return { ...libro, status };
    }

    return libro;
  });

  if (cambiado) {
    guardarLibrosSubidosLocales(actualizados);
    notificarCambioDeLibros();
  }

  return cambiado;
}

async function updateUploadedBook(
  bookId: string,
  ownerId: string,
  cambios: CambiosLibroEditable
): Promise<boolean> {
  const isbnNormalizado = (cambios.isbn ?? "").trim();
  const imagenesAdicionalesNormalizadas =
    cambios.imagenesAdicionales !== undefined
      ? normalizarListaImagenesAdicionales(cambios.imagenesAdicionales)
      : undefined;

  if (isSupabaseConfigured && supabase) {
    const datosActualizar: Record<string, unknown> = {
      titulo: cambios.title,
      autor: cambios.author,
      sinopsis: cambios.synopsis,
      estado: cambios.condition,
      isbn: isbnNormalizado || null,
    };

    if (typeof cambios.cover === "string" && cambios.cover.trim()) {
      datosActualizar.portada = normalizarUrlPortada(cambios.cover);
    }

    if (imagenesAdicionalesNormalizadas !== undefined) {
      datosActualizar.imagenes_adicionales = imagenesAdicionalesNormalizadas;
    }

    const { error } = await supabase
      .from("books")
      .update(datosActualizar)
      .eq("id", bookId)
      .eq("propietario_id", ownerId);

    if (!error) {
      notificarCambioDeLibros();
      return true;
    }
  }

  const librosLocales = leerLibrosSubidosLocales();
  let cambiado = false;
  const actualizados = librosLocales.map((libro) => {
    if (libro.id === bookId && libro.owner.id === ownerId) {
      cambiado = true;
      return {
        ...libro,
        title: cambios.title,
        author: cambios.author,
        cover:
          typeof cambios.cover === "string" && cambios.cover.trim()
            ? normalizarUrlPortada(cambios.cover)
            : libro.cover,
        imagenesAdicionales:
          imagenesAdicionalesNormalizadas !== undefined
            ? imagenesAdicionalesNormalizadas
            : normalizarListaImagenesAdicionales(libro.imagenesAdicionales),
        synopsis: cambios.synopsis,
        condition: cambios.condition,
        isbn: isbnNormalizado || undefined,
      };
    }

    return libro;
  });

  if (cambiado) {
    guardarLibrosSubidosLocales(actualizados);
    notificarCambioDeLibros();
  }

  return cambiado;
}

export function escucharCambiosDeLibros(onChange: () => void): () => void {
  const listener = () => onChange();

  if (typeof window !== "undefined") {
    window.addEventListener(EVENTO_LIBROS_CAMBIADOS, listener);
  }

  if (!isSupabaseConfigured || !supabase) {
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(EVENTO_LIBROS_CAMBIADOS, listener);
      }
    };
  }

  const supabaseClient = supabase;

  const channel = supabaseClient
    .channel(`bookmeter-book-updates-${Math.random().toString(36).slice(2, 8)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "books" },
      () => {
        notificarCambioDeLibros();
        onChange();
      }
    )
    .subscribe();

  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener(EVENTO_LIBROS_CAMBIADOS, listener);
    }
    void supabaseClient.removeChannel(channel);
  };
}

export const obtenerTodosLosLibros = getAllBooks;
export const obtenerLibroPorId = getBookById;
export const obtenerBibliotecaDelUsuario = getCurrentUserLibrary;
export const subirLibro = addUploadedBook;
export const subirFotoDeLibro = subirFotoLibro;
export const eliminarLibroSubido = deleteUploadedBook;
export const actualizarEstadoLibro = updateBookStatus;
export const actualizarLibroSubido = updateUploadedBook;
export const suscribirseACambiosDeLibros = escucharCambiosDeLibros;
