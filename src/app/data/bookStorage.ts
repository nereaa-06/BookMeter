import { Book, currentUser, mockBooks } from "./mockData";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { archivoADataUrl, subirImagenASupabase } from "./imageStorage";

const STORAGE_KEY = "bookmeter-uploaded-books";

interface BookSearchResult {
  isbn?: string;
  title: string;
  author: string;
  cover: string;
  synopsis: string;
}

const LEGACY_CURRENT_USER_ID = "current-user";

export interface ActiveOwner {
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

    return parsed as Book[];
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

function aRadianes(valor: number): number {
  return (valor * Math.PI) / 180;
}

function calcularDistanciaKm(
  origen: { lat: number; lng: number },
  destino: { lat: number; lng: number }
): number {
  const radioTierraKm = 6371;
  const diferenciaLat = aRadianes(destino.lat - origen.lat);
  const diferenciaLng = aRadianes(destino.lng - origen.lng);
  const latOrigen = aRadianes(origen.lat);
  const latDestino = aRadianes(destino.lat);

  const a =
    Math.sin(diferenciaLat / 2) * Math.sin(diferenciaLat / 2) +
    Math.sin(diferenciaLng / 2) * Math.sin(diferenciaLng / 2) * Math.cos(latOrigen) * Math.cos(latDestino);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(radioTierraKm * c * 10) / 10;
}

function normalizarLibro(libro: Book): Book {
  const latFallback = numeroSeguro(libro.owner?.location?.lat, currentUser.location.lat);
  const lngFallback = numeroSeguro(libro.owner?.location?.lng, currentUser.location.lng);
  const lat = numeroSeguro(libro.location?.lat, latFallback);
  const lng = numeroSeguro(libro.location?.lng, lngFallback);

  return {
    ...libro,
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

  return {
    id: textoSeguro(fila.id, `book-${Date.now()}`),
    title: textoSeguro(fila.titulo ?? fila.title, "Sin título"),
    author: textoSeguro(fila.autor ?? fila.author, "Autor desconocido"),
    cover: textoSeguro(fila.portada ?? fila.cover, ""),
    synopsis: textoSeguro(fila.sinopsis ?? fila.synopsis, "Sin sinopsis"),
    condition: textoSeguro(fila.estado ?? fila.condition, "Buen estado"),
    status: fila.disponibilidad === "reservado" || fila.disponibilidad === "intercambiado"
      ? fila.disponibilidad
      : "disponible",
    isbn: fila.isbn ?? undefined,
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

export async function getAllBooks(): Promise<Book[]> {
  const librosRemotos = await obtenerLibrosDeSupabase();
  if (librosRemotos) {
    const librosLocales = leerLibrosSubidosLocales();
    return anadirDistanciaCalculada(combinarLibrosSinDuplicar(librosRemotos, librosLocales));
  }

  return anadirDistanciaCalculada([...mockBooks, ...leerLibrosSubidosLocales()]);
}

export async function getBookById(id: string): Promise<Book | undefined> {
  const books = await getAllBooks();
  return books.find((book) => book.id === id);
}

export async function getCurrentUserLibrary(ownerId: string): Promise<Book[]> {
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

export async function addUploadedBook(
  bookData: BookSearchResult,
  condition: string,
  location: { lat: number; lng: number },
  owner: ActiveOwner
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
      return filaALibro(data as SupabaseBookRow);
    }
  }

  const librosLocales = leerLibrosSubidosLocales();

  const libroNuevo: Book = {
    id: `uploaded-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: bookData.title,
    author: bookData.author,
    cover: bookData.cover,
    synopsis: bookData.synopsis,
    condition,
    status: "disponible",
    isbn: bookData.isbn,
    owner,
    distance: calcularDistanciaKm(owner.location, location),
    location,
  };

  guardarLibrosSubidosLocales([libroNuevo, ...librosLocales]);
  return libroNuevo;
}

export async function subirFotoLibro(archivo: File, propietarioId: string): Promise<string | null> {
  const urlSupabase = await subirImagenASupabase(archivo, "book-images", propietarioId, "book");
  if (urlSupabase) {
    return urlSupabase;
  }

  try {
    return await archivoADataUrl(archivo);
  } catch {
    return null;
  }
}

export async function deleteUploadedBook(bookId: string, ownerId: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from("books")
      .delete()
      .eq("id", bookId)
      .eq("propietario_id", ownerId);

    if (!error) {
      return true;
    }
  }

  const librosLocales = leerLibrosSubidosLocales();
  const totalAntes = librosLocales.length;
  const filtrados = librosLocales.filter((libro) => !(libro.id === bookId && libro.owner.id === ownerId));
  guardarLibrosSubidosLocales(filtrados);
  return filtrados.length < totalAntes;
}

export async function updateBookStatus(
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
  }

  return cambiado;
}

export function escucharCambiosDeLibros(onChange: () => void): () => void {
  if (!isSupabaseConfigured || !supabase) {
    return () => {};
  }

  const supabaseClient = supabase;

  const channel = supabaseClient
    .channel(`bookmeter-book-updates-${Math.random().toString(36).slice(2, 8)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "books" },
      () => {
        onChange();
      }
    )
    .subscribe();

  return () => {
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
export const suscribirseACambiosDeLibros = escucharCambiosDeLibros;
